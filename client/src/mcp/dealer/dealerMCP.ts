// mcp/dealer/dealerMCP.ts
import { marketDataMCP } from '../marketData/marketDataMCP';
import { hyperliquidMCP } from '../hyperliquid/hyperliquidMCP';
import { hyperliquidService, OrderBookMetrics } from '../../services/hyperliquidService';
import { IndicatorSettings, IndicatorConfig } from '../../state/dealerStore';
import { DivergenceSignal } from '../../types';
import { getIndicatorCategory } from '../../utils/indicatorUtils';

export interface DealerIntent {
    action: 'BUY' | 'SELL' | 'HOLD' | 'CLOSE';
    confidence: number; // 0-1
    coin: string;
    reason: string;
    suggestedLeverage?: number;
    suggestedSizeUSDC?: number;
    stopLossPrice?: number;
    takeProfitPrice?: number;
}

// Compact trading costs (makerFee/takerFee moved to portfolio.userFees)
export interface TradingCosts {
    fundingRate: number;
    dailyHoldingCost: number; // As percentage
}

// Indicator data with value, history, weight, and category
export interface IndicatorData {
    value: number | Record<string, number>;
    history?: any[];
    weight: number; // User-configured weight (0.5-2.0)
    category: string | null; // trend, momentum, volume, volatility
}

export interface MarketContextWithCosts {
    symbol: string;
    currentPrice: number;
    history: any[];
    indicators: Record<string, IndicatorData>; // Dynamic indicator storage (keys = enabled indicators)
    divergences: DivergenceSignal[]; // Pre-calculated divergence signals
    tradingCosts: TradingCosts;
    orderBook?: OrderBookMetrics; // Order book metrics for liquidity/imbalance analysis
    ts: number; // Unix timestamp (compact)
    error?: string;
    macro?: MacroIndicatorSnapshot; // Optional macro timeframe data for confirmation
}

/**
 * Macro timeframe indicator snapshot (current values only, no history)
 * Used for multi-timeframe confirmation
 */
export interface MacroIndicatorSnapshot {
    timeframe: string;
    indicators: Record<string, { value: number | Record<string, number> }>;
    ts: number;
}


export class DealerMCP {

    // Cache for user fees (avoid repeated API calls)
    private userFeesCache: { makerFee: number; takerFee: number } | null = null;
    private userFeesCacheTime = 0;
    private readonly FEES_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

    /**
     * Get or refresh user fee tier from cache
     */
    async getUserFeesFromCache(userAddress?: string): Promise<{ makerFee: number; takerFee: number }> {
        const now = Date.now();
        if (this.userFeesCache && (now - this.userFeesCacheTime < this.FEES_CACHE_TTL)) {
            return this.userFeesCache;
        }

        if (userAddress) {
            try {
                const fees = await hyperliquidMCP.getUserFees(userAddress);
                this.userFeesCache = { makerFee: fees.makerFee, takerFee: fees.takerFee };
                this.userFeesCacheTime = now;
                return this.userFeesCache;
            } catch (e) {
                console.warn('[DealerMCP] Failed to fetch user fees, using defaults');
            }
        }

        // Return default Hyperliquid fees
        return { makerFee: 0.0002, takerFee: 0.0005 };
    }

    /**
     * Gather real market data for a target coin INCLUDING trading costs.
     * This enhanced version provides all data needed for profit calculations.
     * @param coin - Coin symbol (e.g., "BTC")
     * @param userAddress - User wallet address for fee lookup
     * @param timeframe - Analysis timeframe
     * @param indicatorSettings - Optional indicator configuration (fetches RSI+MACD if not provided)
     * @param historyCandles - Number of historical candles to fetch (10-100, default 100)
     */
    async getMarketContext(
        coin: string,
        userAddress?: string,
        timeframe: string = '60',
        indicatorSettings?: IndicatorSettings,
        historyCandles: number = 100
    ): Promise<MarketContextWithCosts> {
        const tvSymbol = `${coin}USDT`;

        try {
            // 1. Fetch Price Data
            const priceData = await marketDataMCP.getMarketPrice(tvSymbol);

            // 2. Fetch 200 candles ONCE for all calculations (indicators need at least 35+ candles for MACD)
            const CANDLES_FOR_INDICATORS = 200;
            const allCandles = await marketDataMCP.getHistory(tvSymbol, timeframe, CANDLES_FOR_INDICATORS);

            // Slice last N candles for AI history (user-configured)
            const history = allCandles.slice(-historyCandles);

            console.log(`[DealerMCP] Fetched ${allCandles.length} candles, using last ${history.length} for history (config: ${historyCandles})`);

            // 3. Calculate Indicators from the same candle data (no additional API calls!)
            const indicators: Record<string, IndicatorData> = {};
            const enabledIndicators: string[] = [];

            // Prepare candles in the format expected by calculateIndicatorFromCandles
            const candlesForCalc = allCandles.map((c: any) => ({
                open: c.open,
                high: c.high,
                low: c.low,
                close: c.close,
                volume: c.volume || 0
            }));

            // Determine which indicators to calculate
            const indicatorsToFetch = indicatorSettings
                ? Object.entries(indicatorSettings)
                    .filter(([_, config]) => config.enabled)
                    .map(([name, config]) => ({ name, params: config.params }))
                : [
                    { name: 'rsi', params: { period: 14 } },
                    { name: 'macd', params: { fast: 12, slow: 26, signal: 9 } }
                ];

            // Calculate each enabled indicator from the same candle data
            for (const { name, params } of indicatorsToFetch) {
                try {
                    const result = marketDataMCP.calculateIndicatorFromCandles(candlesForCalc, name, params);
                    // Get weight from settings (default 1.0) and category
                    const indicatorConfig = indicatorSettings?.[name as keyof IndicatorSettings];
                    const weight = indicatorConfig?.weight ?? 1.0;
                    const category = getIndicatorCategory(name as keyof IndicatorSettings);

                    indicators[name] = {
                        value: result.value,
                        history: result.history,
                        weight: weight,
                        category: category
                    };
                    enabledIndicators.push(name);
                } catch (indError) {
                    console.warn(`[DealerMCP] Failed to calculate ${name} for ${coin}:`, indError);
                }
            }

            // 4. Fetch Real Trading Costs and Order Book Metrics from Hyperliquid
            const [fundingRateData, userFees, orderBookMetrics] = await Promise.all([
                hyperliquidMCP.getFundingRate(coin).catch(() => null),
                this.getUserFeesFromCache(userAddress),
                hyperliquidService.getOrderBookMetrics(coin).catch(() => null)
            ]);

            // Calculate estimated daily holding cost (3 funding periods per day)
            const fundingRate = fundingRateData?.funding || 0;
            const estimatedDailyHoldingCost = Math.abs(fundingRate) * 3; // 3x 8h periods

            // Note: makerFee/takerFee moved to portfolio.userFees to avoid repetition
            const tradingCosts = {
                fundingRate: fundingRate,
                dailyHoldingCost: estimatedDailyHoldingCost
            };

            // 5. Calculate Divergences (pre-calculated for AI)
            const rsiHistory = indicators.rsi?.history as number[] || [];
            const macdHistory = indicators.macd?.history as any[] || [];
            const macdHistogram = macdHistory.map((m: any) => m?.histogram || 0);
            const priceCloses = history.map((h: any) => h.close);

            const divergences = marketDataMCP.detectDivergences(priceCloses, rsiHistory, macdHistogram);

            if (divergences.length > 0) {
                console.log(`[DealerMCP] Divergences detected for ${coin}:`, divergences.map(d => `${d.type}(${d.indicator})`).join(', '));
            }

            console.log(`[DealerMCP] Context for ${coin} (${timeframe}m): Price=${priceData.price}, Indicators=[${enabledIndicators.join(',')}], Divergences=${divergences.length}, OrderBook=${orderBookMetrics ? 'OK' : 'N/A'}`);

            return {
                symbol: coin,
                currentPrice: priceData.price,
                history: history,
                indicators: indicators,
                // enabledIndicators removed - AI can infer from indicators object keys
                divergences: divergences,
                tradingCosts: tradingCosts,
                orderBook: orderBookMetrics || undefined, // Only include if available
                ts: Math.floor(Date.now() / 1000) // Unix timestamp (compact)
            };

        } catch (error: any) {
            console.error(`[DealerMCP] Failed to gather context for ${coin}:`, error);
            // Return minimal context on error to avoid crashing the loop
            return {
                symbol: coin,
                currentPrice: 0,
                history: [],
                indicators: {},
                divergences: [],
                tradingCosts: {
                    fundingRate: 0,
                    dailyHoldingCost: 0
                },
                error: error.message || "Data unavailable",
                ts: Math.floor(Date.now() / 1000)
            };

        }
    }

    /**
     * Calculate breakeven prices for all open positions
     */
    calculatePositionBreakevens(
        positions: any[],
        userFees: { makerFee: number; takerFee: number },
        fundingRates: Map<string, number>
    ): Array<{
        coin: string;
        entryPrice: number;
        breakevenPrice: number;
        minProfitPrice: number;
        currentPnlPercent: number;
        isAboveBreakeven: boolean;
    }> {
        return positions.map(pos => {
            const coin = pos.position?.coin || pos.coin;
            const entryPrice = parseFloat(pos.position?.entryPx || pos.entryPx || '0');
            const leverage = pos.position?.leverage?.value || 1;
            const szi = parseFloat(pos.position?.szi || pos.szi || '0');
            const isBuy = szi > 0; // Positive = long
            const fundingRate = fundingRates.get(coin) || 0;

            const breakeven = hyperliquidMCP.calculateBreakevenPrice(
                entryPrice,
                leverage,
                isBuy,
                userFees.makerFee,
                userFees.takerFee,
                fundingRate,
                8 // 8 hours default holding
            );

            // NOTE: We don't have current price here, so we calculate from unrealizedPnl if available
            const unrealizedPnl = parseFloat(pos.position?.unrealizedPnl || '0');
            const positionValue = parseFloat(pos.position?.positionValue || '0');
            const currentPnlPercent = positionValue > 0 ? (unrealizedPnl / positionValue) * 100 : 0;

            return {
                coin,
                entryPrice,
                breakevenPrice: breakeven.breakevenPrice,
                minProfitPrice: breakeven.minProfitPrice,
                currentPnlPercent,
                isAboveBreakeven: unrealizedPnl > 0
            };
        });
    }

    /**
     * Get macro timeframe indicator snapshot (current values only, no history)
     * Used for multi-timeframe confirmation analysis
     * @param coin - Coin symbol (e.g., "BTC")
     * @param timeframe - Macro timeframe (e.g., '240', 'D', 'W')
     * @param indicatorSettings - Indicator configuration (same as main analysis)
     */
    async getMacroSnapshot(
        coin: string,
        timeframe: string,
        indicatorSettings?: IndicatorSettings
    ): Promise<MacroIndicatorSnapshot> {
        const tvSymbol = `${coin}USDT`;

        try {
            // Fetch minimal candles for indicator calculation (enough for EMA/RSI etc)
            const CANDLES_FOR_MACRO = 50;
            const candles = await marketDataMCP.getHistory(tvSymbol, timeframe, CANDLES_FOR_MACRO);

            if (candles.length < 20) {
                console.warn(`[DealerMCP] Insufficient candles for macro ${coin}@${timeframe}`);
                return {
                    timeframe,
                    indicators: {},
                    ts: Math.floor(Date.now() / 1000)
                };
            }

            const candlesForCalc = candles.map((c: any) => ({
                open: c.open,
                high: c.high,
                low: c.low,
                close: c.close,
                volume: c.volume || 0
            }));

            const indicators: Record<string, { value: number | Record<string, number> }> = {};

            // Calculate same indicators as main analysis (but only current value)
            const indicatorsToFetch = indicatorSettings
                ? Object.entries(indicatorSettings)
                    .filter(([_, config]) => config.enabled)
                    .map(([name, config]) => ({ name, params: config.params }))
                : [
                    { name: 'rsi', params: { period: 14 } },
                    { name: 'macd', params: { fast: 12, slow: 26, signal: 9 } }
                ];

            for (const { name, params } of indicatorsToFetch) {
                try {
                    const result = marketDataMCP.calculateIndicatorFromCandles(candlesForCalc, name, params);
                    indicators[name] = { value: result.value };
                } catch (err) {
                    console.warn(`[DealerMCP] Failed to calc macro ${name} for ${coin}:`, err);
                }
            }

            console.log(`[DealerMCP] Macro snapshot for ${coin}@${timeframe}: ${Object.keys(indicators).join(',')}`);

            return {
                timeframe,
                indicators,
                ts: Math.floor(Date.now() / 1000)
            };

        } catch (error: any) {
            console.error(`[DealerMCP] Macro snapshot failed for ${coin}:`, error);
            return {
                timeframe,
                indicators: {},
                ts: Math.floor(Date.now() / 1000)
            };
        }
    }
}

export const dealerMCP = new DealerMCP();

