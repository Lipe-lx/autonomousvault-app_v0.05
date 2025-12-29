// ADAPTER
// Hyperliquid Market Data Adapter
// Implements MarketDataAdapter interface for Hyperliquid exchange
//
// This adapter handles READ-ONLY market data operations
// No signing or authentication required

import type { OHLCV, MarketPrice, OrderBookMetrics } from '../core/types';
import type { MarketDataAdapter, CandleOptions, PerpetualMarketDataAdapter, FundingRate } from './marketdata.adapter';

/**
 * Hyperliquid API endpoints
 */
const HYPERLIQUID_API = {
    MAINNET: 'https://api.hyperliquid.xyz/info',
    TESTNET: 'https://api.hyperliquid-testnet.xyz/info'
};

/**
 * Hyperliquid Market Data Adapter Implementation
 * 
 * Handles all read-only market data operations:
 * - Price fetching
 * - Candle/OHLCV data
 * - Order book metrics
 * - Funding rates
 * - Asset metadata
 */
export class HyperliquidMarketDataAdapter implements PerpetualMarketDataAdapter {
    private apiUrl: string;
    private assetIndices: Map<string, number> = new Map();
    private assetMetadata: Map<string, { szDecimals: number; maxLeverage: number }> = new Map();

    constructor(testnet: boolean = false) {
        this.apiUrl = testnet ? HYPERLIQUID_API.TESTNET : HYPERLIQUID_API.MAINNET;
    }

    /**
     * Set API endpoint
     */
    setTestnet(testnet: boolean): void {
        this.apiUrl = testnet ? HYPERLIQUID_API.TESTNET : HYPERLIQUID_API.MAINNET;
    }

    /**
     * Initialize asset indices and metadata
     */
    private async ensureMetadata(): Promise<void> {
        if (this.assetIndices.size > 0) return;

        try {
            const response = await fetch(this.apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type: 'meta' })
            });

            const data = await response.json();
            const universe = data.universe as any[];

            universe.forEach((asset, index) => {
                this.assetIndices.set(asset.name, index);
                this.assetMetadata.set(asset.name, {
                    szDecimals: asset.szDecimals,
                    maxLeverage: asset.maxLeverage
                });
            });
        } catch (error) {
            console.warn('[HyperliquidAdapter] Failed to fetch metadata:', error);
        }
    }

    /**
     * Get current price for a symbol
     */
    async getPrice(symbol: string): Promise<MarketPrice> {
        await this.ensureMetadata();

        const response = await fetch(this.apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'allMids' })
        });

        const mids = await response.json() as Record<string, string>;
        const price = parseFloat(mids[symbol]);

        if (isNaN(price)) {
            throw new Error(`Price not found for ${symbol}`);
        }

        return {
            price,
            exchange: 'Hyperliquid',
            lastUpdate: new Date().toISOString()
        };
    }

    /**
     * Get OHLCV candle data
     */
    async getCandles(symbol: string, options: CandleOptions): Promise<OHLCV[]> {
        await this.ensureMetadata();

        const intervalMap: Record<string, string> = {
            '1m': '1m', '5m': '5m', '15m': '15m',
            '1h': '1h', '4h': '4h', '1d': '1d'
        };

        const interval = intervalMap[options.interval] || '1h';
        const limit = options.limit || 100;

        const response = await fetch(this.apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                type: 'candleSnapshot',
                req: {
                    coin: symbol,
                    interval,
                    startTime: options.startTime || Date.now() - limit * 60 * 60 * 1000,
                    endTime: Date.now()
                }
            })
        });

        const candles = await response.json() as any[];

        return candles.slice(-limit).map(c => ({
            open: parseFloat(c.o),
            high: parseFloat(c.h),
            low: parseFloat(c.l),
            close: parseFloat(c.c),
            volume: parseFloat(c.v),
            timestamp: c.t
        }));
    }

    /**
     * Get order book metrics
     */
    async getOrderBookMetrics(symbol: string): Promise<OrderBookMetrics> {
        const response = await fetch(this.apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                type: 'l2Book',
                coin: symbol
            })
        });

        const data = await response.json();
        const bids = data.levels?.[0] || [];
        const asks = data.levels?.[1] || [];

        if (bids.length === 0 || asks.length === 0) {
            throw new Error(`No order book data for ${symbol}`);
        }

        const bestBid = parseFloat(bids[0].px);
        const bestAsk = parseFloat(asks[0].px);
        const midPrice = (bestBid + bestAsk) / 2;

        // Calculate depths
        let nearBidDepth = 0, nearAskDepth = 0;
        let totalBidDepth = 0, totalAskDepth = 0;
        const nearRange = midPrice * 0.005; // 0.5% from mid

        for (const bid of bids) {
            const px = parseFloat(bid.px);
            const sz = parseFloat(bid.sz);
            totalBidDepth += sz;
            if (Math.abs(px - midPrice) <= nearRange) {
                nearBidDepth += sz;
            }
        }

        for (const ask of asks) {
            const px = parseFloat(ask.px);
            const sz = parseFloat(ask.sz);
            totalAskDepth += sz;
            if (Math.abs(px - midPrice) <= nearRange) {
                nearAskDepth += sz;
            }
        }

        const imbalanceRatio = totalBidDepth / (totalBidDepth + totalAskDepth);

        return {
            bidAskSpread: bestAsk - bestBid,
            bidAskSpreadUSDC: bestAsk - bestBid,
            imbalanceRatio,
            nearBidDepth,
            nearAskDepth,
            totalBidDepth,
            totalAskDepth,
            midPrice,
            bestBid,
            bestAsk
        };
    }

    /**
     * Get available trading symbols
     */
    async getAvailableSymbols(): Promise<string[]> {
        await this.ensureMetadata();
        return Array.from(this.assetIndices.keys());
    }

    /**
     * Check if a symbol is valid
     */
    async isValidSymbol(symbol: string): Promise<boolean> {
        await this.ensureMetadata();
        return this.assetIndices.has(symbol);
    }

    /**
     * Health check
     */
    async checkHealth(): Promise<boolean> {
        try {
            const response = await fetch(this.apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type: 'meta' })
            });
            return response.ok;
        } catch {
            return false;
        }
    }

    /**
     * Get funding rate for perpetual
     */
    async getFundingRate(symbol: string): Promise<FundingRate> {
        const response = await fetch(this.apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                type: 'metaAndAssetCtxs'
            })
        });

        const data = await response.json();
        const assetCtxs = data[1] as any[];
        const index = this.assetIndices.get(symbol);

        if (index === undefined || !assetCtxs[index]) {
            return { symbol, rate: 0 };
        }

        const ctx = assetCtxs[index];
        return {
            symbol,
            rate: parseFloat(ctx.funding) || 0,
            nextFundingTime: Date.now() + (8 - (new Date().getUTCHours() % 8)) * 60 * 60 * 1000
        };
    }

    /**
     * Get asset metadata
     */
    async getAssetMetadata(symbol: string): Promise<{ szDecimals: number; maxLeverage: number }> {
        await this.ensureMetadata();
        const meta = this.assetMetadata.get(symbol);
        return meta || { szDecimals: 4, maxLeverage: 50 };
    }
}

// Export factory function
export function createHyperliquidMarketDataAdapter(testnet: boolean = false): HyperliquidMarketDataAdapter {
    return new HyperliquidMarketDataAdapter(testnet);
}
