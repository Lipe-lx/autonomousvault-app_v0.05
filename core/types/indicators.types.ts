// DOMAIN CORE
// Technical indicator type definitions
// NO infrastructure dependencies allowed

/**
 * Technical indicator value
 */
export interface TechnicalIndicator {
    symbol?: string;
    indicator: string;
    value: number | string | Record<string, number>;
    timestamp?: number;
}

/**
 * Indicator data with value, history, weight, and category
 */
export interface IndicatorData {
    value: number | Record<string, number>;
    history?: any[];
    weight: number;
    category: string | null;
}

/**
 * Indicator configuration for enabling/disabling indicators
 */
export interface IndicatorConfig {
    enabled: boolean;
    weight?: number;
    params?: Record<string, number>;
}

/**
 * Indicator settings map
 */
export type IndicatorSettings = Record<string, IndicatorConfig>;

/**
 * TradingView-style summary
 */
export interface TradingViewSummary {
    buy: number;
    sell: number;
    neutral: number;
    recommendation: 'BUY' | 'SELL' | 'STRONG_BUY' | 'STRONG_SELL' | 'NEUTRAL';
}

/**
 * Divergence signal detected between price and indicator
 */
export interface DivergenceSignal {
    type: 'BULLISH' | 'BEARISH' | 'HIDDEN_BULLISH' | 'HIDDEN_BEARISH';
    indicator: 'RSI' | 'MACD';
    description: string;
    strength: 'WEAK' | 'MODERATE' | 'STRONG';
    priceRange: { start: number; end: number };
    indicatorRange: { start: number; end: number };
}

/**
 * Macro timeframe indicator snapshot
 * Used for multi-timeframe confirmation
 */
export interface MacroIndicatorSnapshot {
    timeframe: string;
    indicators: Record<string, { value: number | Record<string, number> }>;
    ts: number;
}
