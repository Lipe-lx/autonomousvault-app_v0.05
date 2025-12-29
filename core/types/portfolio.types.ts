// DOMAIN CORE
// Portfolio and position type definitions
// NO infrastructure dependencies allowed

/**
 * Position side
 */
export type PositionSide = 'LONG' | 'SHORT';

/**
 * Leverage configuration
 */
export interface LeverageConfig {
    type: 'cross' | 'isolated';
    value: number;
}

/**
 * Active trading position
 */
export interface Position {
    coin: string;
    size: number;
    entryPrice: number;
    unrealizedPnl: number;
    side: PositionSide;
    leverage: number;
    liquidationPrice?: number;
    marginUsed?: number;
}

/**
 * Hyperliquid position data (raw format)
 */
export interface HyperliquidPosition {
    position: {
        coin: string;
        szi: string;
        entryPx: string;
        positionValue: string;
        leverage: LeverageConfig;
        unrealizedPnl: string;
        returnOnEquity: string;
        liquidationPx: string | null;
        marginUsed: string;
        maxTradeSzs?: string[];
    };
}

/**
 * Position breakeven calculation result
 */
export interface PositionBreakeven {
    coin: string;
    entryPrice: number;
    breakevenPrice: number;
    minProfitPrice: number;
    currentPnlPercent: number;
    isAboveBreakeven: boolean;
}

/**
 * Portfolio state summary
 */
export interface PortfolioState {
    balance: number;
    positions: Position[];
    totalExposure: number;
    maxPositions: number;
    maxLeverage: number;
}

/**
 * User fee tier
 */
export interface UserFees {
    makerFee: number;
    takerFee: number;
}

/**
 * Token/asset balance
 */
export interface Token {
    symbol: string;
    name: string;
    mint: string;
    decimals: number;
    logoURI?: string;
    balance?: number;
}
