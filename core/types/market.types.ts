// DOMAIN CORE
// Market and price data type definitions
// NO infrastructure dependencies allowed

/**
 * Market data with bid/ask spread
 */
export interface MarketData {
    coin: string;
    bid: number;
    ask: number;
    spread: number;
    spreadPercent: number;
    lastUpdate?: number;
}

/**
 * Asset metadata
 */
export interface AssetMetadata {
    coin: string;
    szDecimals: number;
    maxLeverage?: number;
}

/**
 * Market price from exchange
 */
export interface MarketPrice {
    price: number;
    exchange: string;
    lastUpdate: string;
}

/**
 * OHLCV candle data
 */
export interface OHLCV {
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    timestamp: string | number;
}

/**
 * Order book metrics for liquidity analysis
 */
export interface OrderBookMetrics {
    bidAskSpread: number;
    bidAskSpreadUSDC: number;
    imbalanceRatio: number;
    nearBidDepth: number;
    nearAskDepth: number;
    totalBidDepth: number;
    totalAskDepth: number;
    bidWallPrice?: number;
    askWallPrice?: number;
    midPrice: number;
    bestBid: number;
    bestAsk: number;
}

/**
 * Trading costs for P&L calculations
 */
export interface TradingCosts {
    fundingRate: number;
    dailyHoldingCost: number;
}
