// services/polymarketDealerService.ts
// Main loop service for Polymarket Dealer - follows dealerService.ts pattern

import { polymarketStore, POLYMARKET_PRESET_PROMPTS } from '../state/polymarketStore';
import { cycleSummaryStore } from '../state/cycleSummaryStore';
import { polymarketMCP, PolymarketDealerIntent } from '../mcp/polymarket/polymarketMCP';
import { polymarketService } from './polymarketService';
import { aiService } from './aiService';
import { PolymarketCategory, PolymarketPosition } from '../types';
import { backgroundTimer } from './backgroundTimer';
import { keepAlive } from './keepAlive';

// Timer IDs for background-safe timers
const PM_DEALER_TIMER_ID = 'polymarket-dealer-cycle';
const PM_SYNC_TIMER_ID = 'polymarket-dealer-sync';

/**
 * PolymarketDealerService manages the main trading loop for Polymarket
 */
class PolymarketDealerService {
    private isLoopRunning = false;
    private executor: ((intent: PolymarketDealerIntent) => Promise<void>) | null = null;

    constructor() {
        // Subscribe to store changes to start/stop loop
        polymarketStore.subscribe(() => {
            const state = polymarketStore.getSnapshot();
            if (state.isOn && !this.isLoopRunning) {
                this.startLoop();
            } else if (!state.isOn && this.isLoopRunning) {
                this.stopLoop();
            }
        });
    }

    public startLoop() {
        if (this.isLoopRunning) return;

        const state = polymarketStore.getSnapshot();
        if (!state.isOn) return;

        console.log('[PolymarketDealerService] 🚀 Starting main loop with Web Worker timer (background-safe)...');
        this.isLoopRunning = true;

        // Start silent audio to prevent browser from throttling this tab
        keepAlive.start();

        polymarketStore.addLog('INFO', 'Polymarket Dealer loop started');

        // Run first cycle immediately
        this.runCycle();

        // Use Web Worker-based timer that is NOT throttled in background tabs
        const intervalMs = state.settings.checkIntervalSeconds * 1000;
        backgroundTimer.start(PM_DEALER_TIMER_ID, intervalMs, () => this.runCycle());

        // Start sync loop for portfolio updates
        this.startSyncLoop();
    }

    private startSyncLoop() {
        // Sync portfolio every 30 seconds using Web Worker timer
        backgroundTimer.start(PM_SYNC_TIMER_ID, 30000, () => this.syncPortfolio());
    }

    private async syncPortfolio() {
        if (!polymarketService.getIsInitialized()) return;

        try {
            const [balance, positions] = await Promise.all([
                polymarketService.getBalance(),
                polymarketService.getPositions()
            ]);

            const exposure = positions.reduce((sum, pos) => sum + pos.currentValue, 0);
            polymarketStore.updatePortfolioState(positions, balance, exposure);
        } catch (error) {
            console.error('[PolymarketDealerService] Sync error:', error);
        }
    }

    public stopLoop() {
        console.log('[PolymarketDealerService] 🛑 Stopping loop...');

        // Stop Web Worker-based timers
        backgroundTimer.stop(PM_DEALER_TIMER_ID);
        backgroundTimer.stop(PM_SYNC_TIMER_ID);

        // Stop silent audio keep-alive
        keepAlive.stop();

        this.isLoopRunning = false;
        polymarketStore.addLog('INFO', 'Polymarket Dealer loop stopped');
        polymarketStore.setAnalyzing(false);
    }

    /**
     * Set the executor function for trade execution
     */
    public setExecutor(fn: (intent: PolymarketDealerIntent) => Promise<void>) {
        this.executor = fn;
    }

    /**
     * Main analysis and trading cycle
     */
    public async runCycle() {
        const state = polymarketStore.getSnapshot();

        if (!state.isOn) {
            this.stopLoop();
            return;
        }

        if (!polymarketService.getIsInitialized()) {
            polymarketStore.addLog('WARNING', 'Polymarket service not initialized, skipping cycle');
            return;
        }

        try {
            console.log('[PolymarketDealerService] === Starting new cycle ===');
            polymarketStore.setAnalyzing(true);
            polymarketStore.setStatusMessage('Starting analysis cycle...');

            // ============================================
            // PHASE 1: GATHER MARKET DATA
            // ============================================
            polymarketStore.setCurrentTask('Fetching Markets');
            polymarketStore.setStatusMessage('Fetching active markets from Polymarket...');

            const settings = state.settings;

            // Get current positions and balance
            const [balance, positions] = await Promise.all([
                polymarketService.getBalance(),
                polymarketService.getPositions()
            ]);

            // Update portfolio state
            const exposure = positions.reduce((sum, pos) => sum + pos.currentValue, 0);
            polymarketStore.updatePortfolioState(positions, balance, exposure);

            // Check if we have capacity for new positions
            const canOpenNew = positions.length < settings.maxOpenPositions;
            const availableBankroll = settings.bankrollType === 'MANUAL'
                ? Math.min(settings.manualBankroll, balance)
                : balance;

            if (availableBankroll < settings.maxPositionSizeUSDC) {
                polymarketStore.addLog('WARNING', 'Insufficient balance for new positions');
            }

            // ============================================
            // PHASE 2: BUILD MARKET CONTEXT
            // ============================================
            polymarketStore.setCurrentTask('Building Context');
            polymarketStore.setStatusMessage('Building market context for AI analysis...');

            const batchContext = await polymarketMCP.getBatchContext(
                settings.allowedCategories.length > 0
                    ? settings.allowedCategories
                    : ['politics', 'crypto', 'business'] as PolymarketCategory[],
                positions,
                availableBankroll,
                {
                    maxPositionSizeUSDC: settings.maxPositionSizeUSDC,
                    maxOpenPositions: settings.maxOpenPositions,
                    minLiquidity: settings.minLiquidity,
                    minVolume24h: settings.minVolume24h,
                    allowedCategories: settings.allowedCategories
                },
                20 // Limit to 20 markets
            );

            if (batchContext.markets.length === 0) {
                polymarketStore.addLog('REASONING', 'No actionable markets found', {
                    fullReason: `Scanned available markets but none met the filtering criteria.
                    Filters: Min Liquidity: $${settings.minLiquidity.toLocaleString()}, Min Volume: $${settings.minVolume24h.toLocaleString()}
                    Allowed categories: ${settings.allowedCategories.join(', ')}
                    Waiting for better opportunities in the next cycle.`,
                    context: {
                        minLiquidity: settings.minLiquidity,
                        minVolume24h: settings.minVolume24h,
                        allowedCategories: settings.allowedCategories,
                        availableBankroll: availableBankroll,
                        openPositions: positions.length
                    }
                });
                polymarketStore.setAnalyzing(false);
                polymarketStore.setCurrentTask('');
                polymarketStore.setStatusMessage('Waiting for next cycle...');
                return;
            }

            polymarketStore.setStatusDetail('Found ' + batchContext.markets.length + ' markets to analyze');

            // ============================================
            // PHASE 3: AI ANALYSIS
            // ============================================
            polymarketStore.setCurrentTask('AI Analysis');
            polymarketStore.setStatusMessage('Consulting AI for trading decisions...');

            // Get the strategy prompt
            const strategyPrompt = settings.promptMode === 'preset'
                ? POLYMARKET_PRESET_PROMPTS[settings.selectedPreset]
                : settings.strategyPrompt;

            // Build the analysis prompt (with cycle summary context if available)
            const cycleSummary = cycleSummaryStore.getContextForAI('polymarket');

            // Log if cycle summary is being included
            if (cycleSummary) {
                polymarketStore.addLog('INFO', `🧠 Cycle Summary: Including ${cycleSummary.length} char context from previous cycles`);
            }

            const analysisPrompt = polymarketMCP.buildAnalysisPrompt(batchContext, strategyPrompt, cycleSummary);

            // Call AI service
            const aiResponse = await aiService.getPolymarketAnalysis(analysisPrompt);

            if (!aiResponse) {
                polymarketStore.addLog('ERROR', 'AI analysis failed - no response');
                polymarketStore.setAnalyzing(false);
                return;
            }

            // Parse AI response to get intents
            const intents = polymarketMCP.parseAIResponse(aiResponse);

            // Extract human-readable summary and cycleSummary from AI response
            let summaryNote = '';
            let responseCycleSummary: string | undefined;
            try {
                const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    const parsed = JSON.parse(jsonMatch[0]);
                    if (parsed.marketOverview) {
                        summaryNote = parsed.marketOverview;
                    }
                    if (parsed.riskAssessment && summaryNote) {
                        summaryNote += ' | Risk: ' + parsed.riskAssessment;
                    }
                    // Extract cycleSummary from AI response
                    if (parsed.cycleSummary && typeof parsed.cycleSummary === 'string') {
                        responseCycleSummary = parsed.cycleSummary.slice(0, 350);
                    }
                }
            } catch {
                // Fallback to truncated response if parsing fails
                summaryNote = aiResponse.replace(/\{[\s\S]*\}/, '').trim().slice(0, 200) || 'Analysis complete';
            }

            // Store the cycle summary immediately if present
            if (responseCycleSummary) {
                cycleSummaryStore.setSummary('polymarket', responseCycleSummary);
                polymarketStore.addLog('INFO', `🧠 AI Summary: ${responseCycleSummary.slice(0, 80)}...`);
            }

            // Log full AI reasoning for the Thinking page
            polymarketStore.addLog('REASONING', summaryNote || 'AI Analysis Complete', {
                fullReason: aiResponse,
                context: {
                    marketsAnalyzed: batchContext.markets.length,
                    currentBalance: balance,
                    currentExposure: exposure,
                    openPositions: positions.length,
                    maxPositions: settings.maxOpenPositions,
                    allowedCategories: settings.allowedCategories,
                    intentsFound: intents.length
                }
            });
            polymarketStore.setAnalysisNote(summaryNote || 'Analyzed ' + batchContext.markets.length + ' markets');

            if (intents.length === 0) {
                polymarketStore.addLog('REASONING', 'No trades recommended - HOLD strategy', {
                    fullReason: 'After analyzing the available markets, no opportunities met the confidence threshold or risk parameters. Current market conditions suggest holding existing positions.',
                    context: {
                        marketsAnalyzed: batchContext.markets.length,
                        currentBalance: balance,
                        recommendation: 'HOLD'
                    }
                });
                polymarketStore.setCurrentSignal('NEUTRAL');
                polymarketStore.setStatusDetail('No trades recommended - holding');
            } else {
                // Determine overall sentiment
                const buyCount = intents.filter(i => i.action.startsWith('BUY')).length;
                const sellCount = intents.filter(i => i.action.startsWith('SELL')).length;
                const sentiment = buyCount > sellCount ? 'BULLISH' : sellCount > buyCount ? 'BEARISH' : 'NEUTRAL';

                polymarketStore.addLog('SIGNAL', `${intents.length} trading signals - ${sentiment}`, {
                    fullReason: `AI identified ${intents.length} trading opportunities across the analyzed markets.
                    ${buyCount} BUY signals and ${sellCount} SELL signals indicate a ${sentiment} overall stance.`,
                    context: {
                        totalIntents: intents.length,
                        buySignals: buyCount,
                        sellSignals: sellCount,
                        sentiment: sentiment,
                        intents: intents.map(i => ({
                            market: i.question.slice(0, 60),
                            action: i.action,
                            confidence: i.confidence,
                            reason: i.reason?.slice(0, 100)
                        }))
                    }
                });
                polymarketStore.setCurrentSignal(sentiment as any);
                polymarketStore.setStatusDetail(`${buyCount} buy signals, ${sellCount} sell signals`);
            }

            // ============================================
            // PHASE 4: EXECUTE TRADES
            // ============================================
            if (intents.length > 0 && canOpenNew && this.executor) {
                polymarketStore.setCurrentTask('Executing Trades');
                polymarketStore.setStatusMessage('Executing trading decisions...');

                for (const intent of intents) {
                    // Skip if confidence is too low
                    if (intent.confidence < 60) {
                        polymarketStore.addLog('INFO', 'Skipping low-confidence intent: ' + intent.question.slice(0, 50));
                        continue;
                    }

                    // Check position limits
                    if (positions.length >= settings.maxOpenPositions) {
                        polymarketStore.addLog('WARNING', 'Max positions reached, skipping remaining intents');
                        break;
                    }

                    // Execute the trade
                    try {
                        await this.executor(intent);
                        polymarketStore.addLog('TRADE', `${intent.action} on "${intent.question.slice(0, 40)}..."`, {
                            fullReason: intent.reason || 'Trade executed based on AI analysis',
                            context: {
                                action: intent.action,
                                confidence: intent.confidence,
                                marketId: intent.marketId,
                                question: intent.question,
                                suggestedPrice: intent.suggestedPrice,
                                suggestedSize: intent.suggestedSize
                            }
                        });
                    } catch (error) {
                        polymarketStore.addLog('ERROR', 'Failed to execute: ' + (error as Error).message);
                    }
                }
            }

            // ============================================
            // PHASE 5: CLEANUP
            // ============================================
            polymarketStore.setAnalyzing(false);
            polymarketStore.setCurrentTask('');
            polymarketStore.setStatusMessage('Cycle complete. Waiting ' + settings.checkIntervalSeconds + 's...');
            polymarketStore.setStatusDetail('');

            console.log('[PolymarketDealerService] === Cycle complete ===');


            // Record cycle data (for tracking purposes, not for generating summary)
            const marketsAnalyzed = batchContext.markets.map(m => m.market.question.slice(0, 30));
            cycleSummaryStore.recordCycle('polymarket', {
                timestamp: Date.now(),
                decisions: intents.map(i => ({
                    asset: i.question.slice(0, 40),
                    action: i.action,
                    confidence: i.confidence / 100 // Normalize to 0-1
                })),
                assetsAnalyzed: marketsAnalyzed
            });
            // Note: cycleSummary is now generated and stored in the main AI response above

        } catch (error) {
            console.error('[PolymarketDealerService] Cycle error:', error);
            polymarketStore.addLog('ERROR', 'Cycle error: ' + (error as Error).message);
            polymarketStore.setAnalyzing(false);
            polymarketStore.setCurrentTask('');
            polymarketStore.setStatusMessage('Error occurred. Retrying next cycle...');
        }
    }
}

// Singleton with HMR support
const globalAny: any = typeof window !== 'undefined' ? window : {};

// Only expose to window in development for HMR support
// In production, this prevents console access to the dealer service
if (import.meta.env.DEV) {
    if (globalAny.__polymarketDealerService) {
        console.log('[PolymarketDealerService] Stopping old instance for HMR...');
        globalAny.__polymarketDealerService.stopLoop();
    }
    globalAny.__polymarketDealerService = new PolymarketDealerService();
}

export const polymarketDealerService = import.meta.env.DEV
    ? globalAny.__polymarketDealerService
    : new PolymarketDealerService();

