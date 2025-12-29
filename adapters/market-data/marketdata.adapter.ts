// ADAPTER
// Market data adapter interface - boundary between core and market data sources
// Defines how market data is abstracted (Hyperliquid API, other exchanges, etc.)

import type { OHLCV, MarketPrice, OrderBookMetrics } from '../core/types';

/**
 * Candle/OHLCV fetch options
 */
export interface CandleOptions {
    interval: string;  // '1m', '5m', '15m', '1h', '4h', '1d'
    limit?: number;    // Number of candles
    startTime?: number;
}

/**
 * Market data adapter interface
 * 
 * Implementors:
 * - HyperliquidMarketDataAdapter
 * - BinanceMarketDataAdapter (future)
 * - MockMarketDataAdapter (testing)
 */
export interface MarketDataAdapter {
    /**
     * Get current price for a symbol
     * @param symbol - Trading pair symbol (e.g., 'BTC', 'ETH')
     */
    getPrice(symbol: string): Promise<MarketPrice>;

    /**
     * Get OHLCV candle data
     * @param symbol - Trading pair symbol
     * @param options - Candle fetch options
     */
    getCandles(symbol: string, options: CandleOptions): Promise<OHLCV[]>;

    /**
     * Get order book metrics (spread, depth, imbalance)
     * @param symbol - Trading pair symbol
     */
    getOrderBookMetrics(symbol: string): Promise<OrderBookMetrics>;

    /**
     * Get all available trading symbols
     */
    getAvailableSymbols(): Promise<string[]>;

    /**
     * Check if a symbol is valid/tradeable
     * @param symbol - Symbol to validate
     */
    isValidSymbol(symbol: string): Promise<boolean>;

    /**
     * Health check for the data source
     */
    checkHealth(): Promise<boolean>;
}

/**
 * Funding rate data
 */
export interface FundingRate {
    symbol: string;
    rate: number;
    nextFundingTime?: number;
}

/**
 * Extended market data adapter with perpetuals support
 */
export interface PerpetualMarketDataAdapter extends MarketDataAdapter {
    /**
     * Get current funding rate
     * @param symbol - Trading pair symbol
     */
    getFundingRate(symbol: string): Promise<FundingRate>;

    /**
     * Get asset metadata (decimals, max leverage, etc.)
     * @param symbol - Trading pair symbol
     */
    getAssetMetadata(symbol: string): Promise<{
        szDecimals: number;
        maxLeverage: number;
    }>;
}
