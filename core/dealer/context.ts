// DOMAIN CORE
// Market context builder and position calculations
// NO infrastructure dependencies allowed
//
// Pure functions for building market context and calculating position metrics
// Extracted from v0.03 mcp/dealer/dealerMCP.ts

import type {
    MarketContext,
    DealerSettings,
    Position,
    PositionBreakeven,
    UserFees,
    TradingCosts,
    IndicatorData,
    OpenPositionContext
} from '../types';
import type { DivergenceSignal, MacroIndicatorSnapshot } from '../types';
import { calculateIndicatorFromCandles, type CandleData, type IndicatorResult } from '../indicators/calculator';
import { detectDivergences } from '../indicators/divergence';

/**
 * Build market context from raw data
 * Pure function - assembles context object from provided data
 * 
 * @param coin - Coin symbol (e.g., "BTC")
 * @param currentPrice - Current market price
 * @param candles - Historical candle data
 * @param indicatorSettings - Which indicators to calculate
 * @returns Assembled market context
 */
export function buildMarketContext(
    coin: string,
    currentPrice: number,
    candles: CandleData[],
    indicatorSettings: Record<string, { enabled: boolean; weight?: number; params?: Record<string, number> }>,
    tradingCosts: TradingCosts = { fundingRate: 0, dailyHoldingCost: 0 }
): Omit<MarketContext, 'orderBook' | 'macro' | 'openPosition'> {
    // Calculate enabled indicators
    const indicators: Record<string, IndicatorData> = {};

    for (const [name, config] of Object.entries(indicatorSettings)) {
        if (config.enabled) {
            try {
                const result = calculateIndicatorFromCandles(candles, name, config.params);
                indicators[name] = {
                    value: result.value,
                    history: result.history,
                    weight: config.weight || 1,
                    category: getIndicatorCategoryLocal(name)
                };
            } catch (error) {
                console.warn(`[Core/Context] Failed to calculate ${name} for ${coin}:`, error);
            }
        }
    }

    // Calculate divergences if RSI and MACD are available
    const rsiHistory = (indicators.rsi?.history as number[]) || [];
    const macdHistory = (indicators.macd?.history as any[]) || [];
    const macdHistogram = macdHistory.map((m: any) => m?.histogram || 0);
    const priceCloses = candles.map(c => c.close);

    const divergences = detectDivergences(priceCloses, rsiHistory, macdHistogram);

    return {
        symbol: coin,
        currentPrice,
        history: candles.slice(-100), // Last 100 candles for AI
        indicators,
        divergences,
        tradingCosts,
        ts: Math.floor(Date.now() / 1000)
    };
}

/**
 * Inject position context into market context
 */
export function injectPositionContext(
    context: MarketContext,
    positions: Position[]
): MarketContext {
    const matchingPosition = positions.find(p => p.coin === context.symbol);

    if (matchingPosition && matchingPosition.size !== 0) {
        context.openPosition = {
            hasPosition: true,
            side: matchingPosition.side,
            size: Math.abs(matchingPosition.size),
            entryPrice: matchingPosition.entryPrice,
            unrealizedPnl: matchingPosition.unrealizedPnl,
            leverage: matchingPosition.leverage
        };
    } else {
        context.openPosition = { hasPosition: false };
    }

    return context;
}

/**
 * Calculate breakeven prices for all open positions
 * Pure calculation based on entry price, fees, and funding
 * 
 * Extracted from dealerMCP.ts calculatePositionBreakevens
 */
export function calculatePositionBreakevens(
    positions: Position[],
    userFees: UserFees,
    fundingRates: Map<string, number>
): PositionBreakeven[] {
    return positions.map(pos => {
        const fundingRate = fundingRates.get(pos.coin) || 0;

        // Calculate breakeven considering:
        // - Entry fee (taker usually)
        // - Exit fee (maker or taker)
        // - Funding cost (estimated for 8h holding)
        const entryFee = userFees.takerFee / pos.leverage;
        const exitFee = userFees.makerFee / pos.leverage;
        const fundingCost = Math.abs(fundingRate) * 8; // 8 hours default holding

        const totalCostPercent = entryFee + exitFee + fundingCost;
        const direction = pos.side === 'LONG' ? 1 : -1;

        // Breakeven price = entry * (1 + direction * totalCost)
        const breakevenPrice = pos.entryPrice * (1 + direction * totalCostPercent);

        // Min profit price = breakeven + 0.1% margin
        const minProfitPrice = pos.entryPrice * (1 + direction * (totalCostPercent + 0.001));

        // Calculate current PnL percent
        const currentPnlPercent = pos.unrealizedPnl / (pos.entryPrice * Math.abs(pos.size)) * 100;

        return {
            coin: pos.coin,
            entryPrice: pos.entryPrice,
            breakevenPrice,
            minProfitPrice,
            currentPnlPercent,
            isAboveBreakeven: pos.side === 'LONG'
                ? pos.entryPrice * (1 + currentPnlPercent / 100) > breakevenPrice
                : pos.entryPrice * (1 - currentPnlPercent / 100) < breakevenPrice
        };
    });
}

/**
 * Get indicator category (local version to avoid circular deps)
 */
function getIndicatorCategoryLocal(indicator: string): string | null {
    const categories: Record<string, string> = {
        rsi: 'momentum',
        macd: 'momentum',
        stoch: 'momentum',
        ema: 'trend',
        sma: 'trend',
        adx: 'trend',
        ichimoku: 'trend',
        bollinger: 'volatility',
        atr: 'volatility',
        obv: 'volume',
        vwap: 'volume'
    };
    return categories[indicator.toLowerCase()] || null;
}

/**
 * Normalize timeframe string to standard format
 */
export function normalizeTimeframe(timeframe: string): string {
    const tf = timeframe.toLowerCase();
    const map: Record<string, string> = {
        '1': '1m',
        '5': '5m',
        '15': '15m',
        '60': '1h',
        '240': '4h',
        'd': '1d',
        '1d': '1d',
        'w': '1d',
        '1w': '1d',
        '7d': '1d'
    };
    return map[tf] || '1h';
}

/**
 * Convert timeframe to interval in milliseconds
 */
export function timeframeToMs(timeframe: string): number {
    const map: Record<string, number> = {
        '1m': 60 * 1000,
        '5m': 5 * 60 * 1000,
        '15m': 15 * 60 * 1000,
        '1h': 60 * 60 * 1000,
        '4h': 4 * 60 * 60 * 1000,
        '1d': 24 * 60 * 60 * 1000
    };
    return map[normalizeTimeframe(timeframe)] || 60 * 60 * 1000;
}
