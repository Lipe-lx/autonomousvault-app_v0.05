import { ethers } from 'ethers';
import msgpack from 'msgpack-lite';

// Use local proxy in development to avoid CORS
const BASE_URL = import.meta.env.DEV ? '/hl-api' : 'https://api.hyperliquid-testnet.xyz';

const TESTNET_API_URL = BASE_URL;
const EXCHANGE_API_URL = `${BASE_URL}/exchange`;
const INFO_API_URL = `${BASE_URL}/info`;
const IS_MAINNET = false; // Using Testnet

// Rate limiting configuration based on Hyperliquid documentation
// Total budget: 1200 weight per minute per IP
const WEIGHT_BUDGET_PER_MINUTE = 1200;
const WEIGHT_WINDOW_MS = 60 * 1000; // 1 minute sliding window
const MIN_REQUEST_INTERVAL_MS = 100; // Minimum 100ms between any requests
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY_MS = 2000; // Start with 2s delay after 429

// Request weights per endpoint type (from Hyperliquid docs)
const ENDPOINT_WEIGHTS: Record<string, number> = {
    'l2Book': 2,
    'allMids': 2,
    'clearinghouseState': 2,
    'orderStatus': 2,
    'spotClearinghouseState': 2,
    'exchangeStatus': 2,
    'meta': 20,
    'metaAndAssetCtxs': 20,
    'candleSnapshot': 20, // Base weight, additional per 60 items
    'userFills': 20,
    'openOrders': 20,
    'userRole': 60,
    'default': 20 // Default for other info requests
};

export interface OrderOptions {
    orderType?: 'limit' | 'market' | 'ioc' | 'alo';
    reduceOnly?: boolean;
    stopLoss?: number;
    takeProfit?: number;
    tif?: 'Gtc' | 'Ioc' | 'Alo';
    cloid?: string;
}

/**
 * Order book metrics for liquidity and market microstructure analysis
 * Provides condensed metrics from L2 order book data
 */
export interface OrderBookMetrics {
    bidAskSpread: number;           // % spread between best bid and ask
    bidAskSpreadUSDC: number;       // Absolute spread in USDC
    imbalanceRatio: number;         // Bid volume / Ask volume (>1 = bullish pressure, <1 = bearish)
    nearBidDepth: number;           // Total bid volume in top 5 levels (USDC)
    nearAskDepth: number;           // Total ask volume in top 5 levels (USDC)
    totalBidDepth: number;          // Total bid volume in book (USDC)
    totalAskDepth: number;          // Total ask volume in book (USDC)
    bidWallPrice?: number;          // Price level with concentrated bid volume (>20% of total)
    askWallPrice?: number;          // Price level with concentrated ask volume (>20% of total)
    midPrice: number;               // Mid price ((bestBid + bestAsk) / 2)
    bestBid: number;                // Best bid price
    bestAsk: number;                // Best ask price
}

export class HyperliquidService {
    // Weight-based rate limiting state
    private weightHistory: { timestamp: number; weight: number }[] = [];
    private requestQueue: Promise<any> = Promise.resolve();
    private lastRequestTime = 0;

    // Response caching for frequently accessed data
    private cache = new Map<string, { data: any; timestamp: number }>();
    private readonly CACHE_TTL_MS = 5000; // 5 second cache for most data
    private readonly PRICE_CACHE_TTL_MS = 2000; // 2 seconds for prices
    private readonly CANDLE_CACHE_TTL_MS = 10000; // 10 seconds for candles
    private readonly ASSET_CONTEXT_CACHE_TTL_MS = 30000; // 30 seconds for funding/asset contexts

    // ============================================
    // DEALER PRIORITY LOCK SYSTEM
    // When dealer is active, non-dealer requests should skip/wait
    // ============================================
    private dealerLockActive = false;
    private dealerLockResolver: (() => void) | null = null;
    private waitingForDealerUnlock: Promise<void> = Promise.resolve();

    // Shared data cache for cross-component data sharing
    private sharedDataCache = new Map<string, { data: any; timestamp: number }>();
    private readonly SHARED_CACHE_TTL_MS = 15000; // 15s for shared data between components

    /**
     * Acquire dealer lock - gives dealer priority access to API
     * Other components should skip their requests while lock is active
     */
    public acquireDealerLock(): void {
        if (this.dealerLockActive) return;
        this.dealerLockActive = true;
        this.waitingForDealerUnlock = new Promise(resolve => {
            this.dealerLockResolver = resolve;
        });
        console.log('[Hyperliquid] 🔒 Dealer lock ACQUIRED - other requests will be skipped');
    }

    /**
     * Release dealer lock - allows other components to sync
     */
    public releaseDealerLock(): void {
        if (!this.dealerLockActive) return;
        this.dealerLockActive = false;
        if (this.dealerLockResolver) {
            this.dealerLockResolver();
            this.dealerLockResolver = null;
        }
        this.waitingForDealerUnlock = Promise.resolve();
        console.log('[Hyperliquid] 🔓 Dealer lock RELEASED - other requests can proceed');
    }

    /**
     * Check if dealer is currently active (has priority)
     */
    public isDealerActive(): boolean {
        return this.dealerLockActive;
    }

    /**
     * Get current weight used in the sliding window
     */
    private getCurrentWeight(): number {
        const now = Date.now();
        const windowStart = now - WEIGHT_WINDOW_MS;

        // Clean old entries and sum current weight
        this.weightHistory = this.weightHistory.filter(entry => entry.timestamp > windowStart);
        return this.weightHistory.reduce((sum, entry) => sum + entry.weight, 0);
    }

    /**
     * Record a request's weight
     */
    private recordWeight(weight: number): void {
        this.weightHistory.push({ timestamp: Date.now(), weight });
    }

    /**
     * Calculate weight for a request based on endpoint type and response size
     */
    private calculateWeight(endpointType: string, itemCount?: number): number {
        const baseWeight = ENDPOINT_WEIGHTS[endpointType] || ENDPOINT_WEIGHTS['default'];

        // candleSnapshot has additional weight per 60 items
        if (endpointType === 'candleSnapshot' && itemCount) {
            return baseWeight + Math.ceil(itemCount / 60);
        }

        return baseWeight;
    }

    /**
     * Wait until we have budget for the request
     */
    private async waitForBudget(weight: number): Promise<void> {
        const currentWeight = this.getCurrentWeight();
        const availableBudget = WEIGHT_BUDGET_PER_MINUTE - currentWeight;

        if (weight <= availableBudget) {
            return; // We have budget
        }

        // Calculate how long to wait for oldest entries to expire
        const now = Date.now();
        const windowStart = now - WEIGHT_WINDOW_MS;

        // Find oldest entry that needs to expire
        const sortedHistory = [...this.weightHistory].sort((a, b) => a.timestamp - b.timestamp);
        let weightToFree = weight - availableBudget;
        let waitUntil = now;

        for (const entry of sortedHistory) {
            if (entry.timestamp <= windowStart) continue; // Already expired
            weightToFree -= entry.weight;
            waitUntil = entry.timestamp + WEIGHT_WINDOW_MS;
            if (weightToFree <= 0) break;
        }

        const waitTime = Math.max(0, waitUntil - now);
        if (waitTime > 0) {
            console.log(`[Hyperliquid] Rate budget: ${currentWeight}/${WEIGHT_BUDGET_PER_MINUTE} used, waiting ${(waitTime / 1000).toFixed(1)}s for budget...`);
            await new Promise(resolve => setTimeout(resolve, waitTime + 100)); // Add 100ms buffer
        }
    }

    /**
     * Throttled fetch that respects rate limits using weight-based budgeting
     * @param url - URL to fetch
     * @param options - Fetch options
     * @param cacheKey - Optional cache key
     * @param cacheTtl - Optional cache TTL
     * @param endpointType - Type of endpoint for weight calculation
     * @param expectedItems - Expected number of items in response (for candleSnapshot)
     */
    private async throttledFetch(
        url: string,
        options: RequestInit,
        cacheKey?: string,
        cacheTtl?: number,
        endpointType: string = 'default',
        expectedItems?: number
    ): Promise<Response> {
        // Check cache first
        if (cacheKey) {
            const cached = this.cache.get(cacheKey);
            if (cached && Date.now() - cached.timestamp < (cacheTtl || this.CACHE_TTL_MS)) {
                // Return a fake Response with cached data
                return new Response(JSON.stringify(cached.data), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' }
                });
            }
        }

        // Calculate weight for this request
        const weight = this.calculateWeight(endpointType, expectedItems);

        // Queue the request to ensure proper spacing and weight budget
        this.requestQueue = this.requestQueue.then(async () => {
            // Wait for weight budget
            await this.waitForBudget(weight);

            // Also enforce minimum interval between requests
            const now = Date.now();
            const timeSinceLastRequest = now - this.lastRequestTime;

            if (timeSinceLastRequest < MIN_REQUEST_INTERVAL_MS) {
                await new Promise(resolve => setTimeout(resolve, MIN_REQUEST_INTERVAL_MS - timeSinceLastRequest));
            }

            this.lastRequestTime = Date.now();
        });

        await this.requestQueue;

        // Record the weight before making request
        this.recordWeight(weight);

        // Execute with retry logic and exponential backoff
        let lastError: Error | null = null;
        for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
            try {
                const response = await fetch(url, options);

                if (response.status === 429) {
                    // Rate limited - use exponential backoff (2s, 4s, 8s)
                    const retryAfter = parseInt(response.headers.get('Retry-After') || '2', 10);
                    const waitTime = Math.max(retryAfter * 1000, INITIAL_RETRY_DELAY_MS * Math.pow(2, attempt));
                    console.warn(`[Hyperliquid] Rate limited (429), waiting ${waitTime}ms before retry ${attempt + 1}/${MAX_RETRIES}`);
                    await new Promise(resolve => setTimeout(resolve, waitTime));
                    continue;
                }

                // Cache successful responses
                if (response.ok && cacheKey) {
                    const clonedResponse = response.clone();
                    try {
                        const data = await clonedResponse.json();
                        this.cache.set(cacheKey, { data, timestamp: Date.now() });
                    } catch (e) {
                        // Ignore cache errors
                    }
                }

                return response;
            } catch (e: any) {
                lastError = e;
                if (attempt < MAX_RETRIES - 1) {
                    const waitTime = INITIAL_RETRY_DELAY_MS * Math.pow(2, attempt);
                    await new Promise(resolve => setTimeout(resolve, waitTime));
                }
            }
        }

        throw lastError || new Error('Request failed after retries');
    }
    async checkHealth(): Promise<boolean> {
        try {
            await this.getMetadata();
            return true;
        } catch (e) {
            console.error("Hyperliquid Health Check Failed:", e);
            return false;
        }
    }

    // --- Wallet Management ---

    createVaultWallet(): ethers.Wallet {
        const hdWallet = ethers.Wallet.createRandom();
        // Convert HDNodeWallet to Wallet to avoid type mismatch
        return new ethers.Wallet(hdWallet.privateKey);
    }

    getWalletFromPrivateKey(privateKey: string): ethers.Wallet {
        return new ethers.Wallet(privateKey);
    }

    // --- Info API ---

    async getMarketData(coin: string) {
        try {
            const response = await this.throttledFetch(
                INFO_API_URL,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ type: 'l2Book', coin })
                },
                `marketData:${coin}`,
                this.PRICE_CACHE_TTL_MS,
                'l2Book'
            );
            if (!response.ok) throw new Error(`Failed to fetch market data: ${response.statusText}`);
            return await response.json();
        } catch (e) {
            console.error("Hyperliquid Market Data Error:", e);
            throw e;
        }
    }

    /**
     * Get condensed order book metrics for a coin
     * Extracts liquidity, spread, imbalance, and wall detection from L2 order book
     * @param coin - Coin symbol (e.g., "BTC", "ETH", "SOL")
     * @returns OrderBookMetrics with condensed analysis
     */
    async getOrderBookMetrics(coin: string): Promise<OrderBookMetrics> {
        try {
            const marketData = await this.getMarketData(coin);

            // levels[0] = Bids (buy orders), levels[1] = Asks (sell orders)
            // Each level: { px: string, sz: string, n: number }
            const bids = marketData.levels?.[0] || [];
            const asks = marketData.levels?.[1] || [];

            if (bids.length === 0 || asks.length === 0) {
                throw new Error(`No order book data for ${coin}`);
            }

            // Best prices
            const bestBid = parseFloat(bids[0]?.px || '0');
            const bestAsk = parseFloat(asks[0]?.px || '0');
            const midPrice = (bestBid + bestAsk) / 2;

            // Spread calculations
            const bidAskSpreadUSDC = bestAsk - bestBid;
            const bidAskSpread = midPrice > 0 ? (bidAskSpreadUSDC / midPrice) * 100 : 0;

            // Calculate depth for top 5 levels and total
            const TOP_LEVELS = 5;
            let nearBidDepth = 0;
            let nearAskDepth = 0;
            let totalBidDepth = 0;
            let totalAskDepth = 0;

            // Track volume at each price level for wall detection
            const bidVolumes: { price: number; volume: number }[] = [];
            const askVolumes: { price: number; volume: number }[] = [];

            // Process bids
            for (let i = 0; i < bids.length; i++) {
                const price = parseFloat(bids[i]?.px || '0');
                const size = parseFloat(bids[i]?.sz || '0');
                const volumeUSDC = price * size;

                if (i < TOP_LEVELS) {
                    nearBidDepth += volumeUSDC;
                }
                totalBidDepth += volumeUSDC;
                bidVolumes.push({ price, volume: volumeUSDC });
            }

            // Process asks
            for (let i = 0; i < asks.length; i++) {
                const price = parseFloat(asks[i]?.px || '0');
                const size = parseFloat(asks[i]?.sz || '0');
                const volumeUSDC = price * size;

                if (i < TOP_LEVELS) {
                    nearAskDepth += volumeUSDC;
                }
                totalAskDepth += volumeUSDC;
                askVolumes.push({ price, volume: volumeUSDC });
            }

            // Imbalance ratio (>1 = more buying pressure, <1 = more selling pressure)
            const imbalanceRatio = totalAskDepth > 0 ? totalBidDepth / totalAskDepth : 1;

            // Detect walls (price levels with >20% of total volume)
            const BID_WALL_THRESHOLD = 0.20;
            const ASK_WALL_THRESHOLD = 0.20;

            let bidWallPrice: number | undefined;
            let askWallPrice: number | undefined;

            for (const { price, volume } of bidVolumes) {
                if (totalBidDepth > 0 && volume / totalBidDepth > BID_WALL_THRESHOLD) {
                    bidWallPrice = price;
                    break; // Take first (closest to mid) wall
                }
            }

            for (const { price, volume } of askVolumes) {
                if (totalAskDepth > 0 && volume / totalAskDepth > ASK_WALL_THRESHOLD) {
                    askWallPrice = price;
                    break; // Take first (closest to mid) wall
                }
            }

            const metrics: OrderBookMetrics = {
                bidAskSpread: parseFloat(bidAskSpread.toFixed(4)),
                bidAskSpreadUSDC: parseFloat(bidAskSpreadUSDC.toFixed(4)),
                imbalanceRatio: parseFloat(imbalanceRatio.toFixed(3)),
                nearBidDepth: parseFloat(nearBidDepth.toFixed(2)),
                nearAskDepth: parseFloat(nearAskDepth.toFixed(2)),
                totalBidDepth: parseFloat(totalBidDepth.toFixed(2)),
                totalAskDepth: parseFloat(totalAskDepth.toFixed(2)),
                bidWallPrice,
                askWallPrice,
                midPrice: parseFloat(midPrice.toFixed(6)),
                bestBid: parseFloat(bestBid.toFixed(6)),
                bestAsk: parseFloat(bestAsk.toFixed(6))
            };

            console.log(`[Hyperliquid] OrderBook ${coin}: Spread=${metrics.bidAskSpread}%, Imbalance=${metrics.imbalanceRatio}, NearDepth(B/A)=${metrics.nearBidDepth}/${metrics.nearAskDepth}`);

            return metrics;

        } catch (e) {
            console.error(`Hyperliquid OrderBook Metrics Error for ${coin}:`, e);
            // Return default/empty metrics on error
            return {
                bidAskSpread: 0,
                bidAskSpreadUSDC: 0,
                imbalanceRatio: 1,
                nearBidDepth: 0,
                nearAskDepth: 0,
                totalBidDepth: 0,
                totalAskDepth: 0,
                midPrice: 0,
                bestBid: 0,
                bestAsk: 0
            };
        }
    }

    async getUserState(address: string) {
        try {
            const response = await this.throttledFetch(
                INFO_API_URL,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ type: 'clearinghouseState', user: address })
                },
                `userState:${address}`,
                this.CACHE_TTL_MS,
                'clearinghouseState'
            );
            if (!response.ok) throw new Error(`Failed to fetch user state: ${response.statusText}`);
            return await response.json();
        } catch (e) {
            console.error("Hyperliquid User State Error:", e);
            throw e;
        }
    }

    async getOpenOrders(address: string) {
        try {
            const response = await this.throttledFetch(
                INFO_API_URL,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ type: 'openOrders', user: address })
                },
                `openOrders:${address}`,
                this.CACHE_TTL_MS,
                'openOrders'
            );
            if (!response.ok) throw new Error(`Failed to fetch open orders: ${response.statusText}`);
            return await response.json();
        } catch (e) {
            console.error("Hyperliquid Open Orders Error:", e);
            throw e;
        }
    }

    /**
     * Get user's recent trading fills (executed orders)
     * Returns trade history including price, size, side, PnL, and fees
     */
    async getUserFills(address: string, limit = 20): Promise<any[]> {
        try {
            const response = await this.throttledFetch(
                INFO_API_URL,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ type: 'userFills', user: address })
                },
                `userFills:${address}`,
                this.CACHE_TTL_MS,
                'userFills'
            );
            if (!response.ok) throw new Error(`Failed to fetch user fills: ${response.statusText}`);
            const fills = await response.json();
            // Return most recent fills, limited by count
            return Array.isArray(fills) ? fills.slice(0, limit) : [];
        } catch (e) {
            console.error("Hyperliquid User Fills Error:", e);
            return [];
        }
    }

    /**
     * Get historical candle (OHLCV) data for a coin
     * @param coin - Coin symbol (e.g., "BTC", "ETH", "SOL")
     * @param interval - Candle interval: "1m", "5m", "15m", "1h", "4h", "1d"
     * @param limit - Number of candles to fetch (default 100, max ~5000)
     * @returns Array of candle data with time, open, high, low, close, volume
     */
    async getCandles(coin: string, interval: string = '1h', limit: number = 100): Promise<{
        time: number;
        open: number;
        high: number;
        low: number;
        close: number;
        volume: number;
    }[]> {
        try {
            // Calculate startTime based on interval and limit
            const now = Date.now();
            const intervalMs = this.intervalToMs(interval);
            const startTime = now - (intervalMs * limit);

            const response = await this.throttledFetch(
                INFO_API_URL,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        type: 'candleSnapshot',
                        req: {
                            coin,
                            interval,
                            startTime
                        }
                    })
                },
                `candles:${coin}:${interval}:${limit}`, // Include limit in cache key to avoid collisions
                this.CANDLE_CACHE_TTL_MS,
                'candleSnapshot',
                limit // Expected items for additional weight calculation
            );

            if (!response.ok) throw new Error(`Failed to fetch candles: ${response.statusText}`);
            const data = await response.json();

            // Hyperliquid returns: { s: "ok", t: [...], o: [...], h: [...], l: [...], c: [...], v: [...] }
            // Or array of candle objects depending on endpoint version
            if (Array.isArray(data)) {
                // New format: array of candle objects
                return data.map((candle: any) => ({
                    time: candle.t || candle.time,
                    open: parseFloat(candle.o || candle.open),
                    high: parseFloat(candle.h || candle.high),
                    low: parseFloat(candle.l || candle.low),
                    close: parseFloat(candle.c || candle.close),
                    volume: parseFloat(candle.v || candle.volume || '0')
                }));
            } else if (data.t && Array.isArray(data.t)) {
                // Old format: separate arrays
                return data.t.map((time: number, i: number) => ({
                    time,
                    open: parseFloat(data.o[i]),
                    high: parseFloat(data.h[i]),
                    low: parseFloat(data.l[i]),
                    close: parseFloat(data.c[i]),
                    volume: parseFloat(data.v?.[i] || '0')
                }));
            }

            return [];
        } catch (e) {
            console.error("Hyperliquid Candles Error:", e);
            return [];
        }
    }

    /**
     * Get current price for a coin using mid price from order book
     * @param coin - Coin symbol (e.g., "BTC", "ETH", "SOL")
     * @returns Current mid price
     */
    async getCurrentPrice(coin: string): Promise<number> {
        try {
            const marketData = await this.getMarketData(coin);
            // levels[0] are Bids, levels[1] are Asks
            const bestBid = parseFloat(marketData.levels[0][0]?.px || '0');
            const bestAsk = parseFloat(marketData.levels[1][0]?.px || '0');
            return (bestBid + bestAsk) / 2;
        } catch (e) {
            console.error(`Hyperliquid Price Error for ${coin}:`, e);
            throw e;
        }
    }

    /**
     * Convert interval string to milliseconds
     */
    private intervalToMs(interval: string): number {
        const map: Record<string, number> = {
            '1m': 60 * 1000,
            '5m': 5 * 60 * 1000,
            '15m': 15 * 60 * 1000,
            '1h': 60 * 60 * 1000,
            '4h': 4 * 60 * 60 * 1000,
            '1d': 24 * 60 * 60 * 1000,
            '1D': 24 * 60 * 60 * 1000
        };
        return map[interval] || 60 * 60 * 1000; // Default to 1h
    }

    async getMetadata() {
        try {
            const response = await this.throttledFetch(
                INFO_API_URL,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ type: 'meta' })
                },
                'metadata',
                60000, // 60 second cache - metadata rarely changes
                'meta'
            );
            if (!response.ok) throw new Error(`Failed to fetch metadata: ${response.statusText}`);
            return await response.json();
        } catch (e) {
            console.error("Hyperliquid Metadata Error:", e);
            throw e;
        }
    }

    async getAllAvailableAssets(): Promise<string[]> {
        try {
            const metadata = await this.getMetadata();
            // Filter out delisted assets and return only the coin names
            return metadata.universe
                .filter((asset: any) => !asset.isDelisted)
                .map((asset: any) => asset.name);
        } catch (e) {
            console.error("Hyperliquid Get Available Assets Error:", e);
            throw e;
        }
    }

    async isValidAsset(coin: string): Promise<boolean> {
        try {
            const availableAssets = await this.getAllAvailableAssets();
            // Case-insensitive comparison
            return availableAssets.some(asset => asset.toLowerCase() === coin.toLowerCase());
        } catch (e) {
            console.error("Hyperliquid Asset Validation Error:", e);
            // If we can't fetch metadata, assume the asset might be valid
            return true;
        }
    }

    // --- Exchange API & EIP-712 Signing ---

    /**
     * Sign L1 Action using EIP-712 "Phantom Agent" approach
     * Based on Hyperliquid Python SDK implementation
     */
    private async signL1Action(
        wallet: ethers.Wallet,
        action: any,
        vaultAddress: string | null,
        nonce: number,
        expiresAfter?: number
    ): Promise<{ r: string; s: string; v: number }> {
        // Step 1: Create action hash using msgpack
        const actionHash = this.actionHash(action, vaultAddress, nonce, expiresAfter);

        // Step 2: Construct phantom agent
        const phantomAgent = this.constructPhantomAgent(actionHash, IS_MAINNET);

        // Step 3: Create EIP-712 payload
        const domain = {
            name: 'Exchange',
            version: '1',
            chainId: 1337,
            verifyingContract: '0x0000000000000000000000000000000000000000'
        };

        const types = {
            Agent: [
                { name: 'source', type: 'string' },
                { name: 'connectionId', type: 'bytes32' }
            ]
        };

        // Step 4: Sign using EIP-712
        const signature = await wallet.signTypedData(domain, types, phantomAgent);
        const sig = ethers.Signature.from(signature);

        console.log('[Hyperliquid] 📝 Signing Action:');
        console.log('  - Domain:', JSON.stringify(domain));
        console.log('  - Types:', JSON.stringify(types));
        console.log('  - Phantom Agent:', JSON.stringify(phantomAgent));
        console.log('  - Signature:', signature);

        return {
            r: sig.r,
            s: sig.s,
            v: sig.v
        };
    }

    /**
     * Create action hash using msgpack (matches Python SDK)
     */
    private actionHash(
        action: any,
        vaultAddress: string | null,
        nonce: number,
        expiresAfter?: number
    ): string {
        // Pack action with msgpack
        let data = msgpack.encode(action);

        // Add nonce (8 bytes, big endian)
        const nonceBuffer = Buffer.alloc(8);
        nonceBuffer.writeBigUInt64BE(BigInt(nonce), 0);
        data = Buffer.concat([data, nonceBuffer]);

        // Add vault address
        if (vaultAddress === null) {
            data = Buffer.concat([data, Buffer.from([0x00])]);
        } else {
            data = Buffer.concat([data, Buffer.from([0x01])]);
            const addressBytes = Buffer.from(vaultAddress.replace('0x', ''), 'hex');
            data = Buffer.concat([data, addressBytes]);
        }

        // Add expires_after if present
        if (expiresAfter !== undefined) {
            data = Buffer.concat([data, Buffer.from([0x00])]);
            const expiresBuffer = Buffer.alloc(8);
            expiresBuffer.writeBigUInt64BE(BigInt(expiresAfter), 0);
            data = Buffer.concat([data, expiresBuffer]);
        }

        // Return keccak256 hash
        return ethers.keccak256(data);
    }

    /**
     * Construct phantom agent (matches Python SDK)
     */
    private constructPhantomAgent(hash: string, isMainnet: boolean): { source: string; connectionId: string } {
        return {
            source: isMainnet ? 'a' : 'b',
            connectionId: hash
        };
    }

    /**
     * Convert float to wire format (remove trailing zeros)
     */
    private floatToWire(x: number): string {
        if (x === 0) return '0';
        // toFixed(8) gives us 8 decimal places
        const rounded = x.toFixed(8);
        // Remove trailing zeros and decimal point if needed, avoiding scientific notation
        // parseFloat().toString() can produce scientific notation for small numbers, so we do string manipulation
        return rounded.replace(/\.?0+$/, '');
    }

    /**
     * Post action to exchange endpoint
     */
    private async postAction(action: any, wallet: ethers.Wallet, nonce: number) {
        const signature = await this.signL1Action(wallet, action, null, nonce);

        const payload = {
            action,
            nonce,
            signature,
            vaultAddress: null
        };

        console.log('[Hyperliquid] 🚀 Sending action:', JSON.stringify({ action, nonce }, null, 2));
        console.log('[Hyperliquid] 📦 Payload:', JSON.stringify(payload, null, 2));

        const response = await fetch(EXCHANGE_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        // Check if response is OK first
        if (!response.ok) {
            let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
            try {
                const errorText = await response.text();
                console.error('[Hyperliquid] Error response:', errorText);
                // Try to parse as JSON
                try {
                    const errorData = JSON.parse(errorText);
                    errorMessage = `Exchange API Error (${response.status}): ${JSON.stringify(errorData)}`;
                } catch {
                    // Not JSON, use text as-is
                    errorMessage = `Exchange API Error (${response.status}): ${errorText}`;
                }
            } catch (e) {
                console.error('[Hyperliquid] Failed to read error response:', e);
            }
            throw new Error(errorMessage);
        }

        // Parse successful response
        const data = await response.json();
        console.log('[Hyperliquid] 📩 Raw Response:', JSON.stringify(data, null, 2));

        if (data.status !== 'ok') {
            throw new Error(`Exchange API Error: ${JSON.stringify(data.response || data)}`);
        }

        // Check for inner statuses (critical for order placement)
        // Structure: { status: 'ok', response: { type: 'order', data: { statuses: [{...}] } } }
        if (data.response?.data?.statuses) {
            const statuses = data.response.data.statuses;
            const firstError = statuses.find((s: any) => s.error);
            if (firstError) {
                throw new Error(`Order Failed: ${firstError.error}`);
            }
        }

        return data;
    }

    /**
     * Place an order with full options support
     */
    async placeOrder(
        wallet: ethers.Wallet,
        coin: string,
        isBuy: boolean,
        size: number,
        price?: number,
        options?: OrderOptions
    ) {
        const nonce = Date.now();
        const assetIndex = await this.getAssetIndex(coin);

        const orderType = options?.orderType || 'limit';
        const reduceOnly = options?.reduceOnly || false;

        // Build order type object
        let orderTypeObj: any;
        if (orderType === 'market') {
            orderTypeObj = { market: {} };
        } else {
            const tif = options?.tif || (orderType === 'ioc' ? 'Ioc' : orderType === 'alo' ? 'Alo' : 'Gtc');
            orderTypeObj = { limit: { tif } };
        }

        // Calculate proper price rounding based on asset's tick size
        // Hyperliquid constraint: maxPriceDecimals = 6 - szDecimals
        // Also must have max 5 significant figures
        let formattedPrice = '0';
        if (price) {
            const decimals = await this.getAssetDecimals(coin);
            const maxPriceDecimals = Math.max(0, 6 - decimals);
            // 1. Round to max decimal places
            let roundedPrice = parseFloat(price.toFixed(maxPriceDecimals));
            // 2. Enforce 5 significant figures
            roundedPrice = parseFloat(roundedPrice.toPrecision(5));
            // 3. Ensure max decimals again (toPrecision can add decimals)
            roundedPrice = parseFloat(roundedPrice.toFixed(maxPriceDecimals));
            formattedPrice = this.floatToWire(roundedPrice);
            console.log(`[Hyperliquid] Price rounding: ${price} -> ${formattedPrice} (maxDecimals=${maxPriceDecimals}, szDecimals=${decimals})`);
        }

        // Main order
        const order: any = {
            a: assetIndex,
            b: isBuy,
            p: formattedPrice,
            s: this.floatToWire(size),
            r: reduceOnly,
            t: orderTypeObj
        };

        if (options?.cloid) {
            order.c = options.cloid;
        }

        const action = {
            type: 'order',
            orders: [order],
            grouping: 'na'
        };

        const result = await this.postAction(action, wallet, nonce);

        // If TP/SL requested, place additional trigger orders
        // Pass the cloid to link TP/SL orders to the main order for proper tracking
        if (options?.stopLoss || options?.takeProfit) {
            await this.placeTpSlOrders(wallet, coin, isBuy, size, options.stopLoss, options.takeProfit, options.cloid);
        }

        return result;
    }

    /**
     * Place Stop Loss / Take Profit orders
     * @param cloidPrefix - Optional cloid prefix to link TP/SL orders to the main order for tracking
     */
    private async placeTpSlOrders(
        wallet: ethers.Wallet,
        coin: string,
        isBuy: boolean,
        size: number,
        stopLoss?: number,
        takeProfit?: number,
        cloidPrefix?: string
    ) {
        const assetIndex = await this.getAssetIndex(coin);
        const decimals = await this.getAssetDecimals(coin);
        const maxPriceDecimals = 6 - decimals; // Hyperliquid price constraint

        // Helper to round price correctly
        const roundPrice = (price: number): string => {
            // 1. Round to max decimal places
            let rounded = parseFloat(price.toFixed(maxPriceDecimals));
            // 2. Enforce 5 significant figures
            rounded = parseFloat(rounded.toPrecision(5));
            // 3. Ensure max decimals again
            rounded = parseFloat(rounded.toFixed(maxPriceDecimals));
            return this.floatToWire(rounded);
        };

        // Helper to generate valid 128-bit hex cloid
        const generateHexCloid = (): string => {
            const array = new Uint8Array(16);
            crypto.getRandomValues(array);
            return '0x' + Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
        };

        const orders: any[] = [];

        // Stop Loss (opposite side, trigger)
        if (stopLoss) {
            const slPrice = roundPrice(stopLoss);
            const slCloid = generateHexCloid();
            console.log(`[HL TP/SL] SL Price: ${stopLoss} -> Rounded: ${slPrice}, cloid: ${slCloid}`);
            orders.push({
                a: assetIndex,
                b: !isBuy, // Opposite side
                p: slPrice,
                s: this.floatToWire(size),
                r: true, // Reduce only
                t: {
                    trigger: {
                        isMarket: true,
                        triggerPx: slPrice,
                        tpsl: 'sl'
                    }
                },
                c: slCloid // Valid 128-bit hex cloid for Dealer tracking
            });
        }

        // Take Profit (opposite side, trigger)
        if (takeProfit) {
            const tpPrice = roundPrice(takeProfit);
            const tpCloid = generateHexCloid();
            console.log(`[HL TP/SL] TP Price: ${takeProfit} -> Rounded: ${tpPrice}, cloid: ${tpCloid}`);
            orders.push({
                a: assetIndex,
                b: !isBuy, // Opposite side
                p: tpPrice,
                s: this.floatToWire(size),
                r: true, // Reduce only
                t: {
                    trigger: {
                        isMarket: true,
                        triggerPx: tpPrice,
                        tpsl: 'tp'
                    }
                },
                c: tpCloid // Valid 128-bit hex cloid for Dealer tracking
            });
        }

        if (orders.length > 0) {
            const nonce = Date.now();
            const action = {
                type: 'order',
                orders,
                grouping: 'positionTpsl'
            };

            await this.postAction(action, wallet, nonce);
        }
    }



    /**
     * Cancel an order
     */
    async cancelOrder(wallet: ethers.Wallet, coin: string, orderId: number) {
        const nonce = Date.now();
        const action = {
            type: 'cancel',
            cancels: [{
                a: await this.getAssetIndex(coin),
                o: orderId
            }]
        };

        return await this.postAction(action, wallet, nonce);
    }

    /**
     * Update leverage for an asset
     */
    async updateLeverage(wallet: ethers.Wallet, coin: string, leverage: number, isCross: boolean) {
        const nonce = Date.now();
        const action = {
            type: 'updateLeverage',
            asset: await this.getAssetIndex(coin),
            isCross,
            leverage
        };

        return await this.postAction(action, wallet, nonce);
    }

    /**
     * Update isolated margin for a position
     * @param ntli Amount of margin to add (positive) or remove (negative) in USD
     */
    async updateIsolatedMargin(wallet: ethers.Wallet, coin: string, isBuy: boolean, ntli: number) {
        const nonce = Date.now();

        // ntli is the amount of margin in USDC (float)
        // Hyperliquid expects this value to be scaled by 1e6 and passed as an integer (for updateIsolatedMargin specifically)
        // unlike order prices/sizes which are strings.
        // CHECK: We need to verify if other tools handle this scaling or if we should do it here.
        // Based on search results: ntli is integer scaled by 1e6.
        const scaledNtli = Math.floor(ntli * 1_000_000);

        const action = {
            type: 'updateIsolatedMargin',
            asset: await this.getAssetIndex(coin),
            isBuy,
            ntli: scaledNtli
        };

        console.log(`[Hyperliquid] Updating Isolated Margin: ${ntli} USDC -> ntli: ${scaledNtli} for ${coin} (isBuy: ${isBuy})`);

        return await this.postAction(action, wallet, nonce);
    }

    /**
     * Close a position (helper method)
     */
    async closePosition(
        wallet: ethers.Wallet,
        coin: string,
        size?: number,
        orderType: 'market' | 'limit' = 'market',
        price?: number
    ) {
        // Get current position to determine side
        const userState = await this.getUserState(wallet.address);
        const position = userState.assetPositions.find((p: any) => p.position.coin === coin);

        if (!position || parseFloat(position.position.szi) === 0) {
            throw new Error(`No open position for ${coin}`);
        }

        const positionSize = parseFloat(position.position.szi);
        const isBuy = positionSize < 0; // If short, we buy to close
        const closeSize = size || Math.abs(positionSize);

        let finalOrderType: 'market' | 'limit' | 'ioc' | 'alo' = orderType;
        let finalPrice = price;

        // If Market Close, we need to fetch price and send Limit IOC with slippage
        if (orderType === 'market') {
            const marketData = await this.getMarketData(coin);
            // levels[0] are Bids (Buy), levels[1] are Asks (Sell)
            const bestBid = parseFloat(marketData.levels[0][0].px);
            const bestAsk = parseFloat(marketData.levels[1][0].px);

            // Base price: Buy = Ask, Sell = Bid
            const basePrice = isBuy ? bestAsk : bestBid;

            // 1% slippage (Reduced from 5% to avoid Price Band protection rejects on huge spreads)
            const slippage = 0.01;
            let rawPrice = isBuy
                ? basePrice * (1 + slippage)
                : basePrice * (1 - slippage);

            // Rounding Logic (Max 5 sig figs, Max Decimals = 6 - szDecimals)
            const decimals = await this.getAssetDecimals(coin);
            const maxPriceDecimals = 6 - decimals;

            let roundedPrice = parseFloat(rawPrice.toFixed(maxPriceDecimals));
            roundedPrice = parseFloat(roundedPrice.toPrecision(5));
            finalPrice = parseFloat(roundedPrice.toFixed(maxPriceDecimals));

            finalOrderType = 'ioc'; // Immediate or Cancel (Market behavior)

            console.log(`[HL Close] Market Close -> Base: ${basePrice}, Price: ${finalPrice} `);
        }

        return await this.placeOrder(
            wallet,
            coin,
            isBuy,
            closeSize,
            finalPrice,
            {
                orderType: finalOrderType === 'market' ? 'ioc' : finalOrderType, // Ensure we never send 'market' if we can help it
                reduceOnly: true
            }
        );
    }

    /**
     * Withdraw USDC from Hyperliquid Testnet to another address on Hyperliquid
     * Fee: $1 USDC per withdrawal (fixed)
     * Time: ~5 minutes to finalize
     * Network: Hyperliquid Testnet (internal transfer, not bridge)
     */
    async withdrawUSDC(
        wallet: ethers.Wallet,
        destinationAddress: string,
        amount: number
    ) {
        if (amount <= 1) {
            throw new Error('Withdrawal amount must be greater than $1 to cover the withdrawal fee');
        }

        const nonce = Date.now();
        const action = {
            type: 'usdSend',
            hyperliquidChain: 'Testnet',
            signatureChainId: '0xa4b1', // Arbitrum chain ID in hex
            destination: destinationAddress,
            amount: this.floatToWire(amount),
            time: nonce
        };

        return await this.postAction(action, wallet, nonce);
    }

    private universeCache: any[] = [];
    private lastCacheUpdate = 0;

    /**
     * Get asset index from coin symbol
     */
    private async getAssetIndex(coin: string): Promise<number> {
        await this.updateUniverseCache();
        const asset = this.universeCache.find((a: any) => a.name === coin);
        if (!asset) throw new Error(`Asset ${coin} not found`);
        return this.universeCache.indexOf(asset);
    }

    /**
     * Get asset decimals (szDecimals)
     */
    async getAssetDecimals(coin: string): Promise<number> {
        await this.updateUniverseCache();
        const asset = this.universeCache.find((a: any) => a.name === coin);
        if (!asset) throw new Error(`Asset ${coin} not found`);
        return asset.szDecimals;
    }

    /**
     * Update universe cache if needed (TTL 5 minutes)
     */
    private async updateUniverseCache() {
        const now = Date.now();
        if (this.universeCache.length > 0 && now - this.lastCacheUpdate < 5 * 60 * 1000) {
            return;
        }

        const response = await this.throttledFetch(
            INFO_API_URL,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type: 'meta' })
            },
            'universeCache',
            5 * 60 * 1000 // 5 minute cache
        );
        const data = await response.json();
        this.universeCache = data.universe;
        this.lastCacheUpdate = now;
    }

    // ==========================================
    // Trading Costs & Funding API Methods
    // ==========================================

    /**
     * Get perpetual asset contexts including funding rates
     * Returns funding rate, open interest, mark price for all assets
     */
    async getAssetContexts(): Promise<any[]> {
        try {
            const response = await this.throttledFetch(
                INFO_API_URL,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ type: 'metaAndAssetCtxs' })
                },
                'assetContexts',
                this.ASSET_CONTEXT_CACHE_TTL_MS,
                'metaAndAssetCtxs'
            );
            if (!response.ok) throw new Error(`Failed to fetch asset contexts: ${response.statusText}`);
            const data = await response.json();
            // Returns [meta, assetCtxs[]] - we want the asset contexts
            return Array.isArray(data) && data.length > 1 ? data[1] : [];
        } catch (e) {
            console.error("Hyperliquid Asset Contexts Error:", e);
            return [];
        }
    }

    /**
     * Get funding rate for a specific asset
     * @returns Object with funding rate and predicted next rate
     */
    async getFundingRate(coin: string): Promise<{ funding: number; premium: number; nextFunding: number } | null> {
        try {
            const contexts = await this.getAssetContexts();
            await this.updateUniverseCache();

            const assetIndex = this.universeCache.findIndex((a: any) => a.name === coin);
            if (assetIndex === -1) return null;

            const ctx = contexts[assetIndex];
            if (!ctx) return null;

            return {
                funding: parseFloat(ctx.funding || '0'),
                premium: parseFloat(ctx.premium || '0'),
                nextFunding: parseFloat(ctx.funding || '0') // Predicted is same as current in HL
            };
        } catch (e) {
            console.error(`Hyperliquid Funding Rate Error for ${coin}:`, e);
            return null;
        }
    }

    /**
     * Get user's fee schedule/tier
     * Returns maker and taker fee rates
     */
    async getUserFees(address: string): Promise<{
        makerFee: number;
        takerFee: number;
        dailyVolume: number;
        feeSchedule: any;
    }> {
        try {
            const response = await fetch(INFO_API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type: 'userFees', user: address })
            });
            if (!response.ok) throw new Error(`Failed to fetch user fees: ${response.statusText}`);
            const data = await response.json();

            // Hyperliquid returns fee schedule information
            // Default to standard fees if not available
            return {
                makerFee: parseFloat(data?.userCrossRate || data?.userAddRate || '0.0002'),  // 0.02% maker
                takerFee: parseFloat(data?.userCrossRate || data?.userRemoveRate || '0.0005'), // 0.05% taker
                dailyVolume: parseFloat(data?.dailyUserVlm || '0'),
                feeSchedule: data?.feeSchedule || null
            };
        } catch (e) {
            console.error("Hyperliquid User Fees Error:", e);
            // Return default Hyperliquid fees on error
            return {
                makerFee: 0.0002,  // 0.02%
                takerFee: 0.0005, // 0.05%
                dailyVolume: 0,
                feeSchedule: null
            };
        }
    }

    /**
     * Get historical funding payments for a user
     * @param address User wallet address
     * @param startTime Start timestamp in ms (default: 24h ago)
     * @param endTime End timestamp in ms (default: now)
     */
    async getUserFundingHistory(
        address: string,
        startTime?: number,
        endTime?: number
    ): Promise<any[]> {
        try {
            const now = Date.now();
            const payload: any = {
                type: 'userFunding',
                user: address,
                startTime: startTime || now - 24 * 60 * 60 * 1000 // Default 24h ago
            };
            if (endTime) payload.endTime = endTime;

            const response = await fetch(INFO_API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (!response.ok) throw new Error(`Failed to fetch funding history: ${response.statusText}`);
            return await response.json();
        } catch (e) {
            console.error("Hyperliquid Funding History Error:", e);
            return [];
        }
    }

    /**
     * Calculate breakeven price for a position including fees and estimated funding
     * @param entryPrice Entry price of the position
     * @param leverage Current leverage
     * @param isBuy True for long, false for short
     * @param makerFee Maker fee rate (default 0.02%)
     * @param takerFee Taker fee rate (default 0.05%)
     * @param fundingRate Current 8h funding rate
     * @param holdingHours Expected holding time in hours
     */
    calculateBreakevenPrice(
        entryPrice: number,
        leverage: number,
        isBuy: boolean,
        makerFee: number = 0.0002,
        takerFee: number = 0.0005,
        fundingRate: number = 0,
        holdingHours: number = 8
    ): {
        breakevenPrice: number;
        minProfitPrice: number;
        totalCostPercent: number;
        costBreakdown: {
            entryFeePercent: number;
            exitFeePercent: number;
            fundingCostPercent: number;
        };
    } {
        // Entry fee (assuming taker for market orders)
        const entryFeePercent = takerFee;
        // Exit fee (assuming taker for simplicity)
        const exitFeePercent = takerFee;
        // Funding cost estimate (funding rate * number of 8h periods * leverage effect)
        const fundingPeriods = holdingHours / 8;
        const fundingCostPercent = Math.abs(fundingRate) * fundingPeriods;

        // Total cost as percentage of position
        const totalCostPercent = entryFeePercent + exitFeePercent + fundingCostPercent;

        // For longs: need price to move up by total cost %
        // For shorts: need price to move down by total cost %
        const priceMovementNeeded = entryPrice * totalCostPercent;

        const breakevenPrice = isBuy
            ? entryPrice + priceMovementNeeded
            : entryPrice - priceMovementNeeded;

        // Min profit price (add 1% profit margin)
        const profitMargin = 0.01;
        const minProfitPrice = isBuy
            ? breakevenPrice * (1 + profitMargin)
            : breakevenPrice * (1 - profitMargin);

        return {
            breakevenPrice,
            minProfitPrice,
            totalCostPercent,
            costBreakdown: {
                entryFeePercent,
                exitFeePercent,
                fundingCostPercent
            }
        };
    }

    // ============================================
    // SHARED DATA METHODS
    // These methods use a longer cache TTL and are shared between components
    // to reduce duplicate API calls
    // ============================================

    /**
     * Get user state with shared caching (15s TTL)
     * Multiple components can call this without triggering duplicate API requests
     */
    async getUserStateShared(address: string): Promise<any> {
        const cacheKey = `shared:userState:${address}`;
        const cached = this.sharedDataCache.get(cacheKey);

        if (cached && Date.now() - cached.timestamp < this.SHARED_CACHE_TTL_MS) {
            console.log('[Hyperliquid] 📦 Using shared cache for userState');
            return cached.data;
        }

        const data = await this.getUserState(address);
        this.sharedDataCache.set(cacheKey, { data, timestamp: Date.now() });
        return data;
    }

    /**
     * Get user fills with shared caching (15s TTL)
     * Multiple components can call this without triggering duplicate API requests
     */
    async getUserFillsShared(address: string, limit = 20): Promise<any[]> {
        const cacheKey = `shared:userFills:${address}`;
        const cached = this.sharedDataCache.get(cacheKey);

        if (cached && Date.now() - cached.timestamp < this.SHARED_CACHE_TTL_MS) {
            console.log('[Hyperliquid] 📦 Using shared cache for userFills');
            return cached.data;
        }

        const data = await this.getUserFills(address, limit);
        this.sharedDataCache.set(cacheKey, { data, timestamp: Date.now() });
        return data;
    }

    /**
     * Clear shared data cache (useful after executing trades)
     */
    clearSharedCache(): void {
        this.sharedDataCache.clear();
        console.log('[Hyperliquid] 🧹 Shared cache cleared');
    }
}

export const hyperliquidService = new HyperliquidService();
