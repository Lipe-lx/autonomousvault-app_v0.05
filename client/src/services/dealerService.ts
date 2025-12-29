import { dealerStore, INDICATOR_PRESETS } from '../state/dealerStore';
import { cycleSummaryStore } from '../state/cycleSummaryStore';
import { dealerMCP } from '../mcp/dealer/dealerMCP';
import { hyperliquidService } from './hyperliquidService';
import { marketDataMCP } from '../mcp/marketData/marketDataMCP';
import { aiService } from './aiService';
import { backgroundTimer } from './backgroundTimer';
import { keepAlive } from './keepAlive';

// Timer IDs for background-safe timers
const DEALER_TIMER_ID = 'hyperliquid-dealer-cycle';
const SYNC_TIMER_ID = 'hyperliquid-dealer-sync';

// The Dealer Service runs the main loop
export class DealerService {
    private isLoopRunning = false;
    private currentCycleAbortController: AbortController | null = null;

    constructor() {
        // Subscribe to store changes to start/stop loop
        dealerStore.subscribe(() => {
            const state = dealerStore.getSnapshot();
            if (state.isOn && !this.isLoopRunning) {
                this.startLoop();
            } else if (!state.isOn && this.isLoopRunning) {
                this.stopLoop();
            }
        });
    }

    startLoop() {
        if (this.isLoopRunning) return;
        this.isLoopRunning = true;
        console.log('[DealerService] 🚀 Starting loop with Web Worker timer (background-safe)...');

        // Start silent audio to prevent browser from throttling this tab
        // This makes the browser think audio is playing, exempting the tab from throttling
        keepAlive.start();

        const state = dealerStore.getSnapshot();
        const interval = state.settings.checkIntervalSeconds * 1000 || 60000;

        // Use Web Worker-based timer that is NOT throttled in background tabs
        backgroundTimer.start(DEALER_TIMER_ID, interval, () => this.runCycle());

        // Start Sync Loop (High Frequency)
        this.startSyncLoop();

        this.runCycle(); // Run immediately
    }

    startSyncLoop() {
        // Stop existing sync timer if running
        backgroundTimer.stop(SYNC_TIMER_ID);
        console.log('[DealerService] Starting sync loop with Web Worker timer...');

        const SYNC_INTERVAL = 15000; // 15 seconds (reduced from 5s to prevent rate limiting)
        backgroundTimer.start(SYNC_TIMER_ID, SYNC_INTERVAL, () => this.syncPortfolio());
        this.syncPortfolio(); // Run immediately
    }

    async syncPortfolio() {
        if (!this.vaultContext.walletAddress) return;

        // Skip sync if dealer is actively analyzing (dealer has priority)
        if (hyperliquidService.isDealerActive()) {
            console.log('[DealerService] ⏸️  Skipping sync - dealer is active');
            return;
        }

        try {
            // Use shared cache to reduce duplicate API requests
            const userState = await hyperliquidService.getUserStateShared(this.vaultContext.walletAddress);
            let currentPositions: any[] = [];
            let portfolioValue = 0;

            if (userState) {
                // positions
                if (userState.assetPositions) {
                    currentPositions = userState.assetPositions.filter((p: any) => parseFloat(p.position.szi) !== 0);
                    this.vaultContext.positions = currentPositions;
                }

                // portfolio value (margin summary)
                if (userState.marginSummary) {
                    portfolioValue = parseFloat(userState.marginSummary.accountValue || '0');
                }
            }

            // Calculate Exposure
            let totalExposure = 0;
            const dealerPositions = currentPositions.map((p: any) => {
                const size = parseFloat(p.position.szi);
                const entryPx = parseFloat(p.position.entryPx);
                const exposure = Math.abs(size * entryPx);
                totalExposure += exposure;

                return {
                    coin: p.position.coin,
                    size: size,
                    entryPrice: entryPx,
                    unrealizedPnl: parseFloat(p.position.unrealizedPnl || '0'),
                    side: (size > 0 ? 'LONG' : 'SHORT') as 'LONG' | 'SHORT',
                    leverage: parseFloat(p.position.leverage?.value || '1'),
                    liquidationPrice: p.position.liquidationPx ? parseFloat(p.position.liquidationPx) : undefined
                };
            });

            // Validate against local budget/settings if needed (e.g. check if we are overexposed)
            this.vaultContext.balance = portfolioValue; // Update context balance approximation

            // Update Store
            dealerStore.updatePortfolioState(
                dealerPositions,
                portfolioValue,
                totalExposure
            );

        } catch (syncErr) {
            console.warn('[DealerService] syncPortfolio failed:', syncErr);
        }
    }

    stopLoop() {
        if (!this.isLoopRunning) return;
        console.log('[DealerService] 🛑 Stopping loop...');

        // Abort any in-flight requests from current cycle
        if (this.currentCycleAbortController) {
            console.log('[DealerService] 🛑 Aborting current cycle requests...');
            this.currentCycleAbortController.abort();
            this.currentCycleAbortController = null;
        }

        // Stop Web Worker-based timers
        backgroundTimer.stop(DEALER_TIMER_ID);
        backgroundTimer.stop(SYNC_TIMER_ID);

        // Stop silent audio keep-alive
        keepAlive.stop();

        this.isLoopRunning = false;
        dealerStore.updateStatus(null, null, 'System paused', undefined, 'Dealer offline');
    }

    // Context Data
    private vaultContext: any = {
        balance: 0,
        positions: []
    };

    // Tracking errors to report to AI
    private lastError: { message: string, timestamp: number } | null = null;


    public setVaultContext(context: any) {
        this.vaultContext = { ...this.vaultContext, ...context };
    }

    // Circuit Breaker State
    private consecutiveFailures = 0;

    async runCycle() {
        // 1. Check if we should run
        const state = dealerStore.getSnapshot();
        if (!state.isOn) {
            this.stopLoop();
            return;
        }

        // Create new AbortController for this cycle
        this.currentCycleAbortController = new AbortController();
        const abortSignal = this.currentCycleAbortController.signal;

        // 2. Acquire Dealer Lock - gives priority access to API
        // Other components (Dashboard, ActivityFeed) will skip their requests
        hyperliquidService.acquireDealerLock();

        // Get enabled indicators for display
        const indicators = state.settings.indicatorSettings;
        const enabledIndicators = Object.entries(indicators)
            .filter(([_, config]) => config.enabled)
            .map(([name, _]) => name.toUpperCase());
        const indicatorList = enabledIndicators.join(', ') || 'Default';
        const pairsCount = state.settings.tradingPairs.length;
        const timeframe = state.settings.analysisTimeframe;
        const timeframeLabel = timeframe === '1' ? '1m' : timeframe === '5' ? '5m' :
            timeframe === '15' ? '15m' : timeframe === '60' ? '1h' :
                timeframe === '240' ? '4h' : timeframe === 'D' ? '1D' : `${timeframe}m`;

        // Macro timeframe label for status display
        const macroTF = state.settings.macroTimeframe;
        const macroTimeframeLabel = state.settings.macroTimeframeEnabled
            ? ` → ${macroTF === '15' ? '15m' : macroTF === '60' ? '1H' : macroTF === '240' ? '4H' : macroTF === 'D' ? '1D' : macroTF === 'W' ? '1W' : macroTF}`
            : '';

        // 3. Set Status
        dealerStore.setAnalyzing(true);
        dealerStore.updateStatus(
            '🔍 Scanning Markets',
            null,
            'Initializing market analysis cycle...',
            undefined,
            `📊 ${pairsCount} pairs • ${timeframeLabel}${macroTimeframeLabel} • ${indicatorList}`
        );

        const cycleStartTime = Date.now();
        let fetchTimeTotal = 0;
        let analysisTimeTotal = 0;
        let execTimeTotal = 0;

        try {
            // A. Sync Portfolio (Now handled by High-Freq Sync Loop)
            // We just grab the latest from context, which should be fresh (max 5s old)
            let currentPositions = this.vaultContext.positions || [];

            // Double check: If context is empty but we have address, force a sync? 
            // Maybe not needed if sync loop is reliable.
            // Let's rely on sync loop to keep this.vaultContext.positions populated.
            if (this.vaultContext.walletAddress && (!currentPositions || currentPositions.length === 0)) {
                // First run edge case
                await this.syncPortfolio();
                currentPositions = this.vaultContext.positions || [];
            }

            const allCoins = state.settings.tradingPairs;
            if (allCoins.length === 0) {
                dealerStore.addLog('WARNING', 'No trading pairs configured.');
                return;
            }

            // B. Chunk Processing (Max 5 coins per AI call)
            const CHUNK_SIZE = 5;
            const chunks = [];
            for (let i = 0; i < allCoins.length; i += CHUNK_SIZE) {
                chunks.push(allCoins.slice(i, i + CHUNK_SIZE));
            }

            // Global Cycle Limits (uses user-configured Max Pairs setting)
            const MAX_TRADES_PER_CYCLE = state.settings.maxOpenPositions || 3;

            // ============================================
            // PHASE 1: COLLECT ALL DECISIONS FROM ALL CHUNKS
            // ============================================
            interface CollectedDecision {
                decision: any;
                marketContext: any;
            }
            const allCollectedDecisions: CollectedDecision[] = [];
            const allMarketContextsMap = new Map<string, any>();

            for (let i = 0; i < chunks.length; i++) {
                // Check abort signal at start of each chunk
                if (abortSignal.aborted) {
                    throw new DOMException('Dealer cycle aborted', 'AbortError');
                }

                const chunkCoins = chunks[i];
                const currentChunkIndex = i + 1;
                const coinsList = chunkCoins.join(', ');
                dealerStore.updateStatus(
                    '📡 Fetching Data',
                    null,
                    `Collecting market data for ${coinsList}...`,
                    undefined,
                    `Batch ${currentChunkIndex}/${chunks.length} • ${chunkCoins.length} coins`
                );

                // 1. Gather Data for Chunk
                const t0_fetch = Date.now();
                const marketContexts: any[] = [];
                for (const coin of chunkCoins) {
                    // Check abort signal before each coin fetch
                    if (abortSignal.aborted) {
                        throw new DOMException('Dealer cycle aborted', 'AbortError');
                    }

                    // Pass indicator settings (null if autonomous mode - let AI decide)
                    const indicatorSettings = state.settings.autonomousIndicators
                        ? undefined
                        : state.settings.indicatorSettings;

                    const context = await dealerMCP.getMarketContext(
                        coin,
                        this.vaultContext.walletAddress,
                        state.settings.analysisTimeframe || '60',
                        indicatorSettings,
                        state.settings.historyCandles || 100
                    );

                    // Fetch macro timeframe snapshot if enabled
                    if (state.settings.macroTimeframeEnabled && state.settings.macroTimeframe && !context.error) {
                        // Filter indicators based on user's macro selection
                        let macroSettings = indicatorSettings;
                        if (macroSettings && state.settings.macroEnabledIndicators) {
                            // Shallow clone is enough as we only modify 'enabled'
                            macroSettings = { ...macroSettings };
                            // We need to iterate over keys to check against allowed list
                            // Create a new object to avoid mutating the original reference in any way
                            const filtered: any = {};
                            const allowed = state.settings.macroEnabledIndicators;
                            for (const [key, config] of Object.entries(macroSettings)) {
                                filtered[key] = {
                                    ...config,
                                    enabled: config.enabled && allowed.includes(key)
                                };
                            }
                            macroSettings = filtered;
                        }

                        const macroSnapshot = await dealerMCP.getMacroSnapshot(
                            coin,
                            state.settings.macroTimeframe,
                            macroSettings
                        );
                        if (Object.keys(macroSnapshot.indicators).length > 0) {
                            context.macro = macroSnapshot;
                        }
                    }

                    if (!context.error) {
                        marketContexts.push(context);
                        allMarketContextsMap.set(coin, context);
                    }
                    // Tiny delay for API politeness
                    await new Promise(resolve => setTimeout(resolve, 200));
                }
                fetchTimeTotal += (Date.now() - t0_fetch);

                if (marketContexts.length === 0) continue;

                // 2.5 INJECT POSITION DATA DIRECTLY INTO EACH COIN CONTEXT
                // This prevents AI from hallucinating PnL values - data is explicit per coin
                for (const ctx of marketContexts) {
                    const coinSymbol = ctx.symbol;
                    const matchingPosition = currentPositions.find((p: any) =>
                        p.position?.coin === coinSymbol || p.coin === coinSymbol
                    );

                    if (matchingPosition && parseFloat(matchingPosition.position?.szi || matchingPosition.szi || '0') !== 0) {
                        const pos = matchingPosition.position || matchingPosition;
                        ctx.openPosition = {
                            hasPosition: true,
                            side: parseFloat(pos.szi) > 0 ? 'LONG' : 'SHORT',
                            size: Math.abs(parseFloat(pos.szi)),
                            entryPrice: parseFloat(pos.entryPx || '0'),
                            unrealizedPnl: parseFloat(pos.unrealizedPnl || '0'),
                            leverage: parseFloat(pos.leverage?.value || '1')
                        };
                    } else {
                        ctx.openPosition = { hasPosition: false };
                    }
                }

                // 2. Prepare Context
                const positionBreakevens = currentPositions.length > 0
                    ? dealerMCP.calculatePositionBreakevens(
                        currentPositions,
                        { makerFee: 0.0002, takerFee: 0.0005 },
                        new Map(marketContexts.map(c => [c.symbol, c.tradingCosts?.fundingRate || 0]))
                    )
                    : [];

                const batchContext = {
                    coins: marketContexts,
                    portfolio: {
                        balance: this.vaultContext.balance,
                        positions: currentPositions,
                        positionBreakevens: positionBreakevens,
                        settings: {
                            maxPositions: state.settings.maxOpenPositions,
                            maxLeverage: state.settings.maxLeverage,
                            bankrollType: state.settings.bankrollType,
                            manualBankroll: state.settings.manualBankroll,
                            stopLossEnabled: state.settings.stopLossEnabled,
                            stopLossPercent: state.settings.stopLossPercent,
                            takeProfitEnabled: state.settings.takeProfitEnabled,
                            takeProfitPercent: state.settings.takeProfitPercent
                        },
                        // Fees are global (same for all coins), moved here to save tokens
                        userFees: { makerFee: 0.0002, takerFee: 0.0005 },
                        // Only pass error if it happened very recently
                        lastExecutionError: this.lastError && (Date.now() - this.lastError.timestamp < 60000) ? {
                            message: this.lastError.message,
                            timestamp: this.lastError.timestamp
                        } : null
                    },
                    // Autonomous mode configuration
                    autonomousMode: state.settings.autonomousIndicators,
                    availablePresets: state.settings.autonomousIndicators ? INDICATOR_PRESETS : undefined,
                    // Cycle summary context (AI memory from previous cycles)
                    cycleSummary: cycleSummaryStore.getContextForAI('hyperliquid')
                };


                // 3. AI Analysis
                const coinNames = marketContexts.map(c => c.symbol).join(', ');
                dealerStore.updateStatus(
                    '🧠 Analyzing',
                    null,
                    `AI processing ${coinNames}...`,
                    undefined,
                    `Using ${indicatorList} indicators`
                );
                const strategyPrompt = state.settings.strategyPrompt || "Scalp trading. Buy low RSI, Sell high RSI.";

                // Log if cycle summary is being included
                const cycleSummaryContext = batchContext.cycleSummary;
                if (cycleSummaryContext) {
                    dealerStore.addLog('INFO', `🧠 Cycle Summary: Including ${cycleSummaryContext.length} char context from previous cycles`);
                }

                const t0_analysis = Date.now();

                // Check abort signal before calling AI
                if (abortSignal.aborted) {
                    throw new DOMException('Dealer cycle aborted', 'AbortError');
                }

                const aiResponse = await aiService.getDealerBatchAnalysis(batchContext, strategyPrompt, abortSignal);
                analysisTimeTotal += (Date.now() - t0_analysis);

                // Handle new response format: { decisions: [...], cycleSummary?: string }
                let decisions: any[] = [];
                let responseCycleSummary: string | undefined;
                const response = aiResponse as any;

                // Extract decisions and cycleSummary from response
                if (response && typeof response === 'object' && !Array.isArray(response)) {
                    decisions = response.decisions || [];
                    responseCycleSummary = response.cycleSummary;

                    // Handle autonomous mode
                    if (state.settings.autonomousIndicators && response.chosenPreset) {
                        dealerStore.addLog('INFO', `🤖 AI chose preset: ${INDICATOR_PRESETS[response.chosenPreset as keyof typeof INDICATOR_PRESETS]?.emoji || ''} ${response.chosenPreset}`);
                        if (response.presetReason) {
                            dealerStore.addLog('INFO', `📊 Preset reason: ${response.presetReason}`);
                        }
                    }
                } else if (Array.isArray(response)) {
                    // Legacy fallback: direct array of decisions
                    decisions = response;
                }

                // Store the cycle summary immediately if present
                if (responseCycleSummary) {
                    cycleSummaryStore.setSummary('hyperliquid', responseCycleSummary);
                    dealerStore.addLog('INFO', `🧠 AI Summary: ${responseCycleSummary.slice(0, 80)}...`);
                }

                // Collect decisions with their market context
                for (const decision of decisions) {
                    const coin = decision.coin;
                    const action = decision.action;
                    const reason = decision.reason;
                    const confidence = decision.confidence || 0;
                    const marketContext = allMarketContextsMap.get(coin);

                    // Log reasoning for ALL decisions with full context
                    dealerStore.addLog(
                        'REASONING',
                        `${coin}: ${action} (Conf: ${(confidence * 100).toFixed(0)}%)`,
                        {
                            fullReason: reason,
                            context: {
                                ...decision,
                                // Include market context for transparency
                                currentPrice: marketContext?.currentPrice,
                                indicators: marketContext?.indicators,
                                enabledIndicators: marketContext?.enabledIndicators,
                                tradingCosts: marketContext?.tradingCosts,
                                // Include order book metrics for liquidity/imbalance analysis
                                orderBook: marketContext?.orderBook,
                                // Include macro timeframe data if available
                                macro: marketContext?.macro
                            }
                        }
                    );

                    // Skip HOLD actions
                    if (action === 'HOLD') continue;

                    // Skip low confidence (but still log)
                    const confidenceThreshold = state.settings.aggressiveMode ? 0.50 : 0.60;
                    if (confidence < confidenceThreshold) {
                        dealerStore.addLog('INFO', `Skipped ${action} on ${coin}: Confidence ${(confidence * 100).toFixed(0)}% < ${(confidenceThreshold * 100).toFixed(0)}%`);
                        continue;
                    }

                    // Collect valid decisions
                    allCollectedDecisions.push({
                        decision,
                        marketContext: allMarketContextsMap.get(coin)
                    });
                }

                // Delay between chunks
                if (i < chunks.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
            } // End Chunk Loop

            // ============================================
            // PHASE 2: SORT BY CONFIDENCE AND EXECUTE TOP N
            // ============================================
            const signalCount = allCollectedDecisions.length;
            dealerStore.updateStatus(
                '📋 Prioritizing',
                null,
                signalCount > 0
                    ? `Found ${signalCount} trading signal${signalCount > 1 ? 's' : ''}`
                    : 'No actionable signals found',
                undefined,
                signalCount > 0 ? 'Ranking by confidence...' : 'Monitoring for opportunities'
            );

            // Sort by confidence descending (highest first)
            // CLOSE actions get priority boost (+0.5) to ensure positions are closed
            allCollectedDecisions.sort((a, b) => {
                const confA = (a.decision.confidence || 0) + (a.decision.action === 'CLOSE' ? 0.5 : 0);
                const confB = (b.decision.confidence || 0) + (b.decision.action === 'CLOSE' ? 0.5 : 0);
                return confB - confA;
            });

            if (allCollectedDecisions.length > MAX_TRADES_PER_CYCLE) {
                dealerStore.addLog('INFO', `📊 Prioritizing top ${MAX_TRADES_PER_CYCLE} trades from ${allCollectedDecisions.length} signals (sorted by confidence)`);
            }

            // Execute top decisions
            let tradesExecutedInCycle = 0;
            const t0_exec = Date.now();

            for (const { decision, marketContext } of allCollectedDecisions) {
                // Check abort signal before each trade execution
                if (abortSignal.aborted) {
                    throw new DOMException('Dealer cycle aborted', 'AbortError');
                }

                const coin = decision.coin;
                const action = decision.action;
                const reason = decision.reason;
                const confidence = decision.confidence || 0;

                // CHECK: Max Trades Per Cycle (CLOSE actions bypass this)
                if (tradesExecutedInCycle >= MAX_TRADES_PER_CYCLE && action !== 'CLOSE') {
                    dealerStore.addLog('INFO', `⏸️ Skipping ${action} on ${coin} (${(confidence * 100).toFixed(0)}%): Cycle limit reached, lower priority`);
                    continue;
                }

                // CHECK: Max Open Positions
                const totalOpenPositions = currentPositions.length;
                if (action === 'BUY' && totalOpenPositions >= state.settings.maxOpenPositions) {
                    const hasPos = currentPositions.some((p: any) => p.coin === coin || p.position?.coin === coin);
                    if (!hasPos) {
                        dealerStore.addLog('WARNING', `Ignored BUY on ${coin}: Max positions reached.`);
                        continue;
                    }
                }

                dealerStore.addLog('SIGNAL', `🎯 Executing ${action} on ${coin} (${(confidence * 100).toFixed(0)}% confidence)`);

                if (this.executor) {
                    // Calculate Size
                    let intendedSize = decision.sizeUSDC || state.settings.maxPositionSizeUSDC || 20;

                    if (state.settings.maxPositionSizeUSDC) {
                        intendedSize = Math.min(intendedSize, state.settings.maxPositionSizeUSDC);
                    }
                    // Calculate and cap leverage to user's max
                    const suggestedLeverage = decision.suggestedLeverage || state.settings.maxLeverage || 1;
                    const leverage = Math.min(suggestedLeverage, state.settings.maxLeverage || 1);

                    // Log if leverage was capped
                    if (suggestedLeverage > leverage) {
                        dealerStore.addLog('INFO', `⚠️ Leverage capped for ${coin}: ${suggestedLeverage}x → ${leverage}x (max: ${state.settings.maxLeverage}x)`);
                    }

                    const availableBalance = this.vaultContext.balance || 0;
                    const maxAffordableSize = availableBalance * leverage * 0.95;

                    if (intendedSize > maxAffordableSize) {
                        intendedSize = maxAffordableSize;
                    }

                    if (intendedSize < 10 && action !== 'CLOSE') {
                        dealerStore.addLog('WARNING', `Trade skipped on ${coin}: Size < $10`);
                        continue;
                    }

                    try {
                        const actionEmoji = action === 'BUY' ? '📈' : action === 'SELL' ? '📉' : '🔄';
                        dealerStore.updateStatus(
                            `${actionEmoji} Executing`,
                            null,
                            `${action} ${coin} @ $${marketContext?.currentPrice?.toFixed(2) || 'market'}`,
                            undefined,
                            `Confidence: ${(confidence * 100).toFixed(0)}% • Size: $${intendedSize.toFixed(0)}`
                        );
                        await this.executor({
                            coin: coin,
                            action: action,
                            type: decision.orderType || 'limit',
                            price: decision.price || marketContext?.currentPrice,
                            sizeUSDC: intendedSize,
                            leverage: leverage,
                            reason: reason,
                            cloid: this.generateCloid(),
                            stopLoss: decision.stopLoss,
                            takeProfit: decision.takeProfit
                        });

                        tradesExecutedInCycle += (action !== 'CLOSE' ? 1 : 0); // CLOSE never counts toward limit
                        // Execution Delay (Rate Limit) - Critical for batch
                        await new Promise(resolve => setTimeout(resolve, 2000));

                    } catch (execErr: any) {
                        console.error(`[DealerService] Execution failed for ${coin}:`, execErr);
                        dealerStore.addLog('ERROR', `Execution failed for ${coin}: ${execErr.message}`);
                    }
                }
            } // End Execution Loop
            execTimeTotal += (Date.now() - t0_exec);

            // Log Telemetry
            const totalCycleTime = (Date.now() - cycleStartTime) / 1000;
            console.log(`[DealerService] Cycle Telemetry: Total=${totalCycleTime.toFixed(1)}s, Fetch=${(fetchTimeTotal / 1000).toFixed(1)}s, AI=${(analysisTimeTotal / 1000).toFixed(1)}s, Exec=${(execTimeTotal / 1000).toFixed(1)}s`);


            // Record cycle data (for tracking purposes, not for generating summary)
            cycleSummaryStore.recordCycle('hyperliquid', {
                timestamp: Date.now(),
                decisions: allCollectedDecisions.map(d => ({
                    asset: d.decision.coin,
                    action: d.decision.action,
                    confidence: d.decision.confidence || 0
                })),
                assetsAnalyzed: allCoins
            });
            // Note: cycleSummary is now generated and stored in the main AI response above

            // Reset Circuit Breaker on Success
            this.consecutiveFailures = 0;

        } catch (error: any) {
            // Handle graceful abort - don't log as error
            if (error?.name === 'AbortError') {
                console.log('[DealerService] ⏹️ Cycle aborted by user');
                dealerStore.addLog('INFO', '⏹️ Analysis cycle cancelled');
                return; // Exit early, finally block will still run
            }

            console.error('[DealerService] Cycle Error:', error);
            dealerStore.addLog('ERROR', `Cycle failed: ${error.message}`);
            this.lastError = { message: error.message, timestamp: Date.now() };

            // --- CIRCUIT BREAKER REMOVED ---
            // this.consecutiveFailures++;
            // if (this.consecutiveFailures >= 2) { ... }

        } finally {
            // Release dealer lock - allow other components to sync
            hyperliquidService.releaseDealerLock();

            // Clear shared cache after cycle ends (data may be stale after trades)
            hyperliquidService.clearSharedCache();

            dealerStore.setAnalyzing(false);
            const nextCycleSec = state.settings.checkIntervalSeconds;
            const nextCycleMin = Math.floor(nextCycleSec / 60);
            const nextCycleLabel = nextCycleMin >= 1 ? `${nextCycleMin}min` : `${nextCycleSec}s`;
            dealerStore.updateStatus(
                '⏳ Waiting',
                null,
                'Analysis complete, waiting for next cycle',
                undefined,
                `Next scan in ${nextCycleLabel}`
            );
        }
    }

    // Dependency Injection for Execution
    private executor: ((intent: any) => Promise<void>) | null = null;

    public setExecutor(fn: (intent: any) => Promise<void>) {
        this.executor = fn;
    }

    private generateCloid(): string {
        // Generate a 128-bit hex string (32 hex characters)
        // Use a prefix to identify Dealer transactions easily if needed, 
        // effectively 0x + 32 hex chars.
        // Hyperliquid expects a 128-bit hex string.
        const array = new Uint8Array(16);
        crypto.getRandomValues(array);
        return '0x' + Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
    }
}

const globalAny: any = typeof window !== 'undefined' ? window : {};

// Only expose to window in development for HMR support
// In production, this prevents console access to the dealer service
if (import.meta.env.DEV) {
    if (globalAny.__dealerService) {
        console.log('[DealerService] Stopping old instance for HMR...');
        globalAny.__dealerService.stopLoop();
    }
    globalAny.__dealerService = new DealerService();
}

export const dealerService = import.meta.env.DEV
    ? globalAny.__dealerService
    : new DealerService();

