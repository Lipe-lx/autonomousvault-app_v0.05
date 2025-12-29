// DOMAIN CORE
// Dealer and trading decision type definitions
// NO infrastructure dependencies allowed

import type { IndicatorData, DivergenceSignal, MacroIndicatorSnapshot } from './indicators.types';
import type { TradingCosts, OrderBookMetrics } from './market.types';
import type { Position, PositionBreakeven, UserFees } from './portfolio.types';

/**
 * Trading action types
 */
export type TradeAction = 'BUY' | 'SELL' | 'HOLD' | 'CLOSE';

/**
 * Order types
 */
export type OrderType = 'limit' | 'market' | 'ioc' | 'alo';

/**
 * Dealer intent - AI decision output
 */
export interface DealerIntent {
    action: TradeAction;
    confidence: number;
    coin: string;
    reason: string;
    suggestedLeverage?: number;
    suggestedSizeUSDC?: number;
    stopLossPrice?: number;
    takeProfitPrice?: number;
    orderType?: OrderType;
    price?: number;
}

/**
 * Execution intent - ready for execution layer
 */
export interface ExecutionIntent {
    coin: string;
    action: TradeAction;
    type: OrderType;
    price?: number;
    sizeUSDC: number;
    leverage: number;
    reason: string;
    cloid: string;
    stopLoss?: number;
    takeProfit?: number;
}

/**
 * Open position context injected into market context
 */
export interface OpenPositionContext {
    hasPosition: boolean;
    side?: 'LONG' | 'SHORT';
    size?: number;
    entryPrice?: number;
    unrealizedPnl?: number;
    leverage?: number;
}

/**
 * Market context with all analysis data for a single coin
 */
export interface MarketContext {
    symbol: string;
    currentPrice: number;
    history: any[];
    indicators: Record<string, IndicatorData>;
    divergences: DivergenceSignal[];
    tradingCosts: TradingCosts;
    orderBook?: OrderBookMetrics;
    ts: number;
    error?: string;
    macro?: MacroIndicatorSnapshot;
    openPosition?: OpenPositionContext;
}

/**
 * Batch context for AI analysis
 */
export interface BatchAnalysisContext {
    coins: MarketContext[];
    portfolio: {
        balance: number;
        positions: Position[];
        positionBreakevens: PositionBreakeven[];
        settings: DealerSettings;
        userFees: UserFees;
        lastExecutionError?: { message: string; timestamp: number } | null;
    };
    autonomousMode?: boolean;
    availablePresets?: Record<string, any>;
    cycleSummary?: string;
}

/**
 * Dealer settings
 */
export interface DealerSettings {
    maxPositions: number;
    maxLeverage: number;
    bankrollType: 'full' | 'manual';
    manualBankroll?: number;
    stopLossEnabled: boolean;
    stopLossPercent: number;
    takeProfitEnabled: boolean;
    takeProfitPercent: number;
    maxPositionSizeUSDC?: number;
    checkIntervalSeconds?: number;
    analysisTimeframe?: string;
    macroTimeframeEnabled?: boolean;
    macroTimeframe?: string;
    aggressiveMode?: boolean;
    autonomousIndicators?: boolean;
    tradingPairs?: string[];
    historyCandles?: number;
}

/**
 * AI analysis response
 */
export interface AnalysisResponse {
    decisions: DealerIntent[];
    cycleSummary?: string;
    chosenPreset?: string;
    presetReason?: string;
}

/**
 * Log entry types
 */
export type LogType = 'INFO' | 'WARNING' | 'ERROR' | 'SIGNAL' | 'REASONING';

/**
 * Dealer log entry
 */
export interface DealerLogEntry {
    type: LogType;
    message: string;
    timestamp: number;
    context?: Record<string, any>;
}
