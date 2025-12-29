// CORE
// Dealer Cycle Orchestrator
// Extracted from v0.03 services/dealerService.ts
//
// Manages the complete dealer analysis and execution cycle
// Pure orchestration logic, no side effects

import type { DealerDecision } from './engine';
import type { MarketContextWithCosts, IndicatorCategory } from '../types';

/**
 * Cycle configuration
 */
export interface CycleConfig {
    /** Max trades per cycle */
    maxTradesPerCycle: number;
    /** Chunk size for AI calls */
    chunkSize: number;
    /** Confidence threshold (0.0 - 1.0) */
    confidenceThreshold: number;
    /** Delay between chunk processing (ms) */
    chunkDelayMs: number;
    /** Delay between coin fetches (ms) */
    fetchDelayMs: number;
}

/**
 * Default cycle configuration
 */
export const DEFAULT_CYCLE_CONFIG: CycleConfig = {
    maxTradesPerCycle: 3,
    chunkSize: 5,
    confidenceThreshold: 0.60,
    chunkDelayMs: 500,
    fetchDelayMs: 200
};

/**
 * Portfolio context for cycle
 */
export interface PortfolioContext {
    balance: number;
    positions: any[];
    settings: {
        maxPositions: number;
        maxLeverage: number;
        stopLossEnabled: boolean;
        stopLossPercent: number;
        takeProfitEnabled: boolean;
        takeProfitPercent: number;
    };
    userFees: { makerFee: number; takerFee: number };
}

/**
 * Collected decision with context
 */
export interface CollectedDecision {
    decision: DealerDecision;
    marketContext: MarketContextWithCosts;
}

/**
 * Cycle result
 */
export interface CycleResult {
    success: boolean;
    decisionsCollected: number;
    tradesExecuted: number;
    timing: {
        fetchMs: number;
        analysisMs: number;
        executionMs: number;
        totalMs: number;
    };
    cycleSummary?: string;
    error?: string;
}

/**
 * Adapter interfaces for orchestrator dependencies
 */
export interface MarketDataFetcher {
    getMarketContext(
        coin: string,
        timeframe: string,
        indicatorSettings?: Record<string, any>
    ): Promise<MarketContextWithCosts>;
    getMacroSnapshot?(
        coin: string,
        timeframe: string,
        indicatorSettings?: Record<string, any>
    ): Promise<any>;
}

export interface AIAnalyzer {
    analyzeBatch(
        context: any,
        strategyPrompt: string,
        abortSignal?: AbortSignal
    ): Promise<{ decisions: DealerDecision[]; cycleSummary?: string }>;
}

export interface TradeExecutor {
    execute(decision: DealerDecision, context: MarketContextWithCosts): Promise<boolean>;
}

export interface CycleLogger {
    log(level: 'INFO' | 'WARNING' | 'ERROR' | 'REASONING', message: string, context?: any): void;
    updateStatus(phase: string, message: string, detail?: string): void;
}

/**
 * Create chunks from an array
 */
export function createChunks<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
        chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
}

/**
 * Sort decisions by confidence with CLOSE priority
 */
export function sortByConfidence(decisions: CollectedDecision[]): CollectedDecision[] {
    return [...decisions].sort((a, b) => {
        // CLOSE actions get priority boost
        const confA = (a.decision.confidence || 0) + (a.decision.action === 'CLOSE' ? 0.5 : 0);
        const confB = (b.decision.confidence || 0) + (b.decision.action === 'CLOSE' ? 0.5 : 0);
        return confB - confA;
    });
}

/**
 * Filter decisions by confidence threshold
 */
export function filterByConfidence(
    decisions: DealerDecision[],
    threshold: number
): DealerDecision[] {
    return decisions.filter(d => {
        // HOLD is always filtered out
        if (d.action === 'HOLD') return false;
        return (d.confidence || 0) >= threshold;
    });
}

/**
 * Inject position data into market context
 */
export function injectPositionData(
    context: MarketContextWithCosts,
    positions: any[]
): MarketContextWithCosts {
    const matchingPosition = positions.find((p: any) =>
        p.position?.coin === context.symbol || p.coin === context.symbol
    );

    if (matchingPosition) {
        const pos = matchingPosition.position || matchingPosition;
        const size = parseFloat(pos.szi || '0');

        if (size !== 0) {
            return {
                ...context,
                openPosition: {
                    hasPosition: true,
                    side: size > 0 ? 'LONG' : 'SHORT',
                    size: Math.abs(size),
                    entryPrice: parseFloat(pos.entryPx || '0'),
                    unrealizedPnl: parseFloat(pos.unrealizedPnl || '0'),
                    leverage: parseFloat(pos.leverage?.value || '1')
                }
            };
        }
    }

    return {
        ...context,
        openPosition: { hasPosition: false }
    };
}

/**
 * Build batch context for AI analysis
 */
export function buildBatchContext(
    marketContexts: MarketContextWithCosts[],
    portfolio: PortfolioContext,
    options: {
        autonomousMode?: boolean;
        presets?: Record<string, any>;
        cycleSummary?: string;
    } = {}
): any {
    return {
        coins: marketContexts,
        portfolio: {
            balance: portfolio.balance,
            positions: portfolio.positions,
            settings: portfolio.settings,
            userFees: portfolio.userFees
        },
        autonomousMode: options.autonomousMode,
        availablePresets: options.autonomousMode ? options.presets : undefined,
        cycleSummary: options.cycleSummary
    };
}

/**
 * Run a complete dealer cycle
 * 
 * This is the main orchestration function that coordinates:
 * 1. Data fetching (chunked)
 * 2. AI analysis
 * 3. Decision collection and prioritization
 * 4. Trade execution
 */
export async function runDealerCycle(
    coins: string[],
    portfolio: PortfolioContext,
    config: CycleConfig,
    fetcher: MarketDataFetcher,
    analyzer: AIAnalyzer,
    executor: TradeExecutor,
    logger: CycleLogger,
    options: {
        timeframe?: string;
        strategyPrompt?: string;
        indicatorSettings?: Record<string, any>;
        macroTimeframe?: string;
        autonomousMode?: boolean;
        previousCycleSummary?: string;
        abortSignal?: AbortSignal;
    } = {}
): Promise<CycleResult> {
    const startTime = Date.now();
    let fetchTime = 0;
    let analysisTime = 0;
    let executionTime = 0;
    let cycleSummary: string | undefined;

    // Check abort early
    if (options.abortSignal?.aborted) {
        return {
            success: false,
            decisionsCollected: 0,
            tradesExecuted: 0,
            timing: { fetchMs: 0, analysisMs: 0, executionMs: 0, totalMs: 0 },
            error: 'Cycle aborted'
        };
    }

    try {
        // PHASE 1: COLLECT ALL DECISIONS FROM ALL CHUNKS
        const chunks = createChunks(coins, config.chunkSize);
        const allDecisions: CollectedDecision[] = [];
        const marketContextMap = new Map<string, MarketContextWithCosts>();

        for (let i = 0; i < chunks.length; i++) {
            // Check abort
            if (options.abortSignal?.aborted) {
                throw new Error('Cycle aborted');
            }

            const chunk = chunks[i];
            logger.updateStatus(
                '📡 Fetching Data',
                `Batch ${i + 1}/${chunks.length}`,
                `${chunk.join(', ')}`
            );

            // Fetch market data for chunk
            const t0Fetch = Date.now();
            const contexts: MarketContextWithCosts[] = [];

            for (const coin of chunk) {
                if (options.abortSignal?.aborted) {
                    throw new Error('Cycle aborted');
                }

                try {
                    const ctx = await fetcher.getMarketContext(
                        coin,
                        options.timeframe || '60',
                        options.indicatorSettings
                    );

                    // Fetch macro if enabled
                    if (options.macroTimeframe && fetcher.getMacroSnapshot) {
                        const macro = await fetcher.getMacroSnapshot(
                            coin,
                            options.macroTimeframe,
                            options.indicatorSettings
                        );
                        (ctx as any).macro = macro;
                    }

                    // Inject position data
                    const enrichedCtx = injectPositionData(ctx, portfolio.positions);
                    contexts.push(enrichedCtx);
                    marketContextMap.set(coin, enrichedCtx);
                } catch (err) {
                    logger.log('WARNING', `Failed to fetch ${coin}: ${err}`);
                }

                // Delay between fetches
                if (config.fetchDelayMs > 0) {
                    await new Promise(r => setTimeout(r, config.fetchDelayMs));
                }
            }

            fetchTime += Date.now() - t0Fetch;

            if (contexts.length === 0) continue;

            // AI Analysis
            logger.updateStatus(
                '🧠 Analyzing',
                `Processing ${contexts.map(c => c.symbol).join(', ')}`,
                'AI analyzing...'
            );

            const t0Analysis = Date.now();
            const batchContext = buildBatchContext(contexts, portfolio, {
                autonomousMode: options.autonomousMode,
                cycleSummary: options.previousCycleSummary
            });

            const { decisions, cycleSummary: summary } = await analyzer.analyzeBatch(
                batchContext,
                options.strategyPrompt || 'Trade based on technical indicators',
                options.abortSignal
            );

            analysisTime += Date.now() - t0Analysis;

            if (summary) {
                cycleSummary = summary;
            }

            // Collect valid decisions
            const validDecisions = filterByConfidence(decisions, config.confidenceThreshold);
            for (const decision of validDecisions) {
                const ctx = marketContextMap.get(decision.coin);
                if (ctx) {
                    allDecisions.push({ decision, marketContext: ctx });
                    logger.log('REASONING', `${decision.coin}: ${decision.action}`, {
                        confidence: decision.confidence,
                        reason: decision.reason
                    });
                }
            }

            // Delay between chunks
            if (i < chunks.length - 1 && config.chunkDelayMs > 0) {
                await new Promise(r => setTimeout(r, config.chunkDelayMs));
            }
        }

        // PHASE 2: SORT BY CONFIDENCE AND EXECUTE
        const sortedDecisions = sortByConfidence(allDecisions);

        logger.updateStatus(
            '📋 Executing',
            `${sortedDecisions.length} signals found`,
            'Prioritizing by confidence...'
        );

        const t0Exec = Date.now();
        let tradesExecuted = 0;

        for (const { decision, marketContext } of sortedDecisions) {
            if (options.abortSignal?.aborted) {
                throw new Error('Cycle aborted');
            }

            // Max trades check (CLOSE bypasses)
            if (tradesExecuted >= config.maxTradesPerCycle && decision.action !== 'CLOSE') {
                logger.log('INFO', `Skipped ${decision.action} on ${decision.coin}: Cycle limit reached`);
                continue;
            }

            // Max positions check
            const openPositionCount = portfolio.positions.filter(
                (p: any) => parseFloat(p.position?.szi || p.szi || '0') !== 0
            ).length;

            if (decision.action !== 'CLOSE' && openPositionCount >= portfolio.settings.maxPositions) {
                logger.log('INFO', `Skipped ${decision.action} on ${decision.coin}: Max positions reached`);
                continue;
            }

            // Execute
            try {
                const success = await executor.execute(decision, marketContext);
                if (success) {
                    tradesExecuted++;
                    logger.log('INFO', `✅ Executed ${decision.action} on ${decision.coin}`);
                }
            } catch (err) {
                logger.log('ERROR', `Failed to execute ${decision.coin}: ${err}`);
            }
        }

        executionTime = Date.now() - t0Exec;

        return {
            success: true,
            decisionsCollected: allDecisions.length,
            tradesExecuted,
            timing: {
                fetchMs: fetchTime,
                analysisMs: analysisTime,
                executionMs: executionTime,
                totalMs: Date.now() - startTime
            },
            cycleSummary
        };

    } catch (error: any) {
        return {
            success: false,
            decisionsCollected: 0,
            tradesExecuted: 0,
            timing: {
                fetchMs: fetchTime,
                analysisMs: analysisTime,
                executionMs: executionTime,
                totalMs: Date.now() - startTime
            },
            error: error.message
        };
    }
}
