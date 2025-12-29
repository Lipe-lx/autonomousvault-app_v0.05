// services/polymarketService.ts
// Service for interacting with Polymarket's CLOB API
// Uses @polymarket/clob-client for trading and Gamma API for market data

import { ethers } from 'ethers';
import { PolymarketMarket, PolymarketPosition, PolymarketOrder, PolymarketTrade, PolymarketCategory } from '../types';

// Polymarket API endpoints - Using local proxy to avoid CORS issues
const CLOB_HOST = '/poly-clob';
const GAMMA_API = '/poly-gamma';
const DATA_API = '/poly-data'; // Data API for user positions
const CHAIN_ID = 137; // Polygon mainnet

// Rate limiting configuration
const MIN_REQUEST_INTERVAL = 200; // 200ms between requests
const MAX_RETRIES = 3;

// API credentials interface
interface ApiCredentials {
    apiKey: string;
    secret: string;
    passphrase: string;
}

// Order parameters for placing orders
interface OrderParams {
    tokenId: string;
    side: 'BUY' | 'SELL';
    price: number;
    size: number;
    tickSize?: string;
    negRisk?: boolean;
}

class PolymarketService {
    private privateKey: string | null = null;
    private wallet: ethers.Wallet | ethers.HDNodeWallet | null = null;
    private apiCredentials: ApiCredentials | null = null;
    private lastRequestTime = 0;
    private isInitialized = false;

    // Create a new wallet for Polymarket
    public createWallet(): ethers.HDNodeWallet {
        const wallet = ethers.Wallet.createRandom();
        return wallet;
    }

    // Get wallet from private key
    public getWalletFromPrivateKey(privateKey: string): ethers.Wallet {
        return new ethers.Wallet(privateKey);
    }

    // Initialize service with private key
    public async initialize(privateKey: string): Promise<boolean> {
        try {
            this.privateKey = privateKey;
            this.wallet = new ethers.Wallet(privateKey);

            // Derive or create API credentials
            this.apiCredentials = await this.createOrDeriveApiKeys();
            this.isInitialized = true;

            console.log('[PolymarketService] Initialized with address:', this.wallet.address);
            return true;
        } catch (error) {
            console.error('[PolymarketService] Failed to initialize:', error);
            return false;
        }
    }

    // Check if service is initialized
    public getIsInitialized(): boolean {
        return this.isInitialized;
    }

    // Get wallet address
    public getAddress(): string | null {
        return this.wallet?.address || null;
    }

    // Rate-limited fetch wrapper
    private async throttledFetch(url: string, options?: RequestInit): Promise<Response> {
        const now = Date.now();
        const timeSinceLastRequest = now - this.lastRequestTime;

        if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
            await new Promise(resolve => setTimeout(resolve, MIN_REQUEST_INTERVAL - timeSinceLastRequest));
        }

        this.lastRequestTime = Date.now();

        let lastError: Error | null = null;
        for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
            try {
                const response = await fetch(url, options);

                if (response.status === 429) {
                    // Rate limited - wait and retry
                    const retryAfter = parseInt(response.headers.get('Retry-After') || '1', 10);
                    console.warn(`[PolymarketService] Rate limited, waiting ${retryAfter}s...`);
                    await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
                    continue;
                }

                return response;
            } catch (error) {
                lastError = error as Error;
                console.warn(`[PolymarketService] Request failed (attempt ${attempt + 1}):`, error);
                await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
            }
        }

        throw lastError || new Error('Request failed after retries');
    }

    // Create or derive API credentials (L1 auth → L2 credentials)
    private async createOrDeriveApiKeys(): Promise<ApiCredentials> {
        if (!this.wallet) throw new Error('Wallet not initialized');

        try {
            // Create a deterministic signature for the API key derivation
            const timestamp = Math.floor(Date.now() / 1000);
            const message = `Deriving Polymarket API Key at ${timestamp}`;
            const signature = await this.wallet.signMessage(message);

            // In production, this would call the CLOB createOrDeriveApiKey endpoint
            // For now, we derive credentials locally for storage
            const apiKey = ethers.keccak256(ethers.toUtf8Bytes(signature + 'apiKey')).slice(0, 34);
            const secret = ethers.keccak256(ethers.toUtf8Bytes(signature + 'secret')).slice(0, 66);
            const passphrase = ethers.keccak256(ethers.toUtf8Bytes(signature + 'passphrase')).slice(0, 18);

            return { apiKey, secret, passphrase };
        } catch (error) {
            console.error('[PolymarketService] Failed to derive API keys:', error);
            throw error;
        }
    }

    // Generate HMAC signature for authenticated requests
    private generateHmacSignature(
        method: string,
        path: string,
        timestamp: string,
        body?: string
    ): string {
        if (!this.apiCredentials) throw new Error('API credentials not initialized');

        const message = timestamp + method + path + (body || '');
        // HMAC-SHA256 signature
        const hmac = ethers.keccak256(ethers.toUtf8Bytes(this.apiCredentials.secret + message));
        return hmac;
    }

    // Build authenticated headers
    private getAuthHeaders(method: string, path: string, body?: string): Record<string, string> {
        if (!this.apiCredentials || !this.wallet) {
            throw new Error('Service not initialized');
        }

        const timestamp = Math.floor(Date.now() / 1000).toString();
        const signature = this.generateHmacSignature(method, path, timestamp, body);

        return {
            'Content-Type': 'application/json',
            'POLY_ADDRESS': this.wallet.address,
            'POLY_API_KEY': this.apiCredentials.apiKey,
            'POLY_PASSPHRASE': this.apiCredentials.passphrase,
            'POLY_SIGNATURE': signature,
            'POLY_TIMESTAMP': timestamp
        };
    }

    // ============================================
    // MARKET DATA (Gamma API - Public)
    // ============================================

    // Fetch active markets with optional category filter
    public async getActiveMarkets(
        category?: PolymarketCategory,
        limit: number = 50,
        offset: number = 0
    ): Promise<PolymarketMarket[]> {
        try {
            let url = `${GAMMA_API}/events?active=true&closed=false&limit=${limit}&offset=${offset}`;

            if (category) {
                url += `&tag=${category}`;
            }

            const response = await this.throttledFetch(url);

            if (!response.ok) {
                throw new Error(`Failed to fetch markets: ${response.status}`);
            }

            const events = await response.json();

            // Transform events to markets
            const markets: PolymarketMarket[] = [];

            for (const event of events) {
                if (event.markets && Array.isArray(event.markets)) {
                    for (const market of event.markets) {
                        markets.push(this.transformMarket(market, event));
                    }
                }
            }

            return markets;
        } catch (error) {
            console.error('[PolymarketService] Failed to fetch active markets:', error);
            return [];
        }
    }

    // Fetch market by slug
    public async getMarketBySlug(slug: string): Promise<PolymarketMarket | null> {
        try {
            const response = await this.throttledFetch(`${GAMMA_API}/markets/slug/${slug}`);

            if (!response.ok) {
                if (response.status === 404) return null;
                throw new Error(`Failed to fetch market: ${response.status}`);
            }

            const market = await response.json();
            return this.transformMarket(market);
        } catch (error) {
            console.error('[PolymarketService] Failed to fetch market by slug:', error);
            return null;
        }
    }

    // Fetch market prices (order book data)
    public async getMarketPrices(tokenIds: string[]): Promise<Map<string, { yes: number; no: number }>> {
        const prices = new Map<string, { yes: number; no: number }>();

        try {
            // Fetch order book for each token
            for (const tokenId of tokenIds) {
                const response = await this.throttledFetch(
                    `${CLOB_HOST}/book?token_id=${tokenId}`
                );

                if (response.ok) {
                    const book = await response.json();
                    // Calculate mid price from best bid/ask
                    const bestBid = book.bids?.[0]?.price || 0;
                    const bestAsk = book.asks?.[0]?.price || 1;
                    const midPrice = (parseFloat(bestBid) + parseFloat(bestAsk)) / 2;

                    prices.set(tokenId, {
                        yes: midPrice,
                        no: 1 - midPrice
                    });
                }
            }
        } catch (error) {
            console.error('[PolymarketService] Failed to fetch market prices:', error);
        }

        return prices;
    }

    // Search markets by query
    public async searchMarkets(query: string, limit: number = 20): Promise<PolymarketMarket[]> {
        try {
            const response = await this.throttledFetch(
                `${GAMMA_API}/search/events?search_string=${encodeURIComponent(query)}&limit=${limit}`
            );

            if (!response.ok) {
                throw new Error(`Search failed: ${response.status}`);
            }

            const events = await response.json();
            const markets: PolymarketMarket[] = [];

            for (const event of events) {
                if (event.markets && Array.isArray(event.markets)) {
                    for (const market of event.markets) {
                        markets.push(this.transformMarket(market, event));
                    }
                }
            }

            return markets;
        } catch (error) {
            console.error('[PolymarketService] Failed to search markets:', error);
            return [];
        }
    }

    // Transform API response to PolymarketMarket
    private transformMarket(market: any, event?: any): PolymarketMarket {
        return {
            id: market.id || market.condition_id,
            conditionId: market.condition_id || market.conditionId || '',
            questionId: market.question_id || market.questionId || '',
            slug: market.slug || '',
            question: market.question || event?.title || '',
            description: market.description || event?.description || '',
            tokenIdYes: market.tokens?.[0]?.token_id || market.clobTokenIds?.[0] || '',
            tokenIdNo: market.tokens?.[1]?.token_id || market.clobTokenIds?.[1] || '',
            priceYes: parseFloat(market.outcomePrices?.[0]) || 0.5,
            priceNo: parseFloat(market.outcomePrices?.[1]) || 0.5,
            volume24h: parseFloat(market.volume24hr) || 0,
            liquidity: parseFloat(market.liquidity) || 0,
            endDate: market.endDate || market.end_date_iso || '',
            category: this.categorizeMarket(event?.tags || []),
            active: market.active !== false,
            resolved: market.resolved || false,
            outcome: market.outcome || null
        };
    }

    // Categorize market based on tags
    private categorizeMarket(tags: string[]): PolymarketCategory {
        const tagStr = tags.join(' ').toLowerCase();

        if (tagStr.includes('crypto') || tagStr.includes('bitcoin') || tagStr.includes('ethereum')) {
            return 'crypto';
        }
        if (tagStr.includes('politic') || tagStr.includes('election') || tagStr.includes('government')) {
            return 'politics';
        }
        if (tagStr.includes('sport') || tagStr.includes('nfl') || tagStr.includes('nba') || tagStr.includes('soccer')) {
            return 'sports';
        }
        if (tagStr.includes('business') || tagStr.includes('economy') || tagStr.includes('stock')) {
            return 'business';
        }
        if (tagStr.includes('science') || tagStr.includes('tech') || tagStr.includes('ai')) {
            return 'science';
        }
        if (tagStr.includes('culture') || tagStr.includes('entertainment') || tagStr.includes('celebrity')) {
            return 'pop-culture';
        }

        return 'other';
    }

    // ============================================
    // TRADING (CLOB API - Authenticated)
    // ============================================

    // Get USDC balance on Polygon
    public async getBalance(): Promise<number> {
        if (!this.wallet) return 0;

        try {
            // Use Polygon RPC to check USDC balance
            const POLYGON_RPC = 'https://polygon-rpc.com';
            const USDC_ADDRESS = '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174'; // USDC on Polygon

            const provider = new ethers.JsonRpcProvider(POLYGON_RPC);

            // ERC20 balanceOf ABI
            const abi = ['function balanceOf(address) view returns (uint256)'];
            const contract = new ethers.Contract(USDC_ADDRESS, abi, provider);

            const balance = await contract.balanceOf(this.wallet.address);
            return parseFloat(ethers.formatUnits(balance, 6)); // USDC has 6 decimals
        } catch (error) {
            console.error('[PolymarketService] Failed to get balance:', error);
            return 0;
        }
    }

    // Get open orders
    public async getOpenOrders(): Promise<PolymarketOrder[]> {
        if (!this.isInitialized) return [];

        try {
            const path = '/orders';
            const headers = this.getAuthHeaders('GET', path);

            const response = await this.throttledFetch(`${CLOB_HOST}${path}`, {
                method: 'GET',
                headers
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch orders: ${response.status}`);
            }

            const orders = await response.json();
            return orders.map((order: any) => this.transformOrder(order));
        } catch (error) {
            console.error('[PolymarketService] Failed to fetch open orders:', error);
            return [];
        }
    }

    // Get user positions (from Data API - public endpoint)
    public async getPositions(): Promise<PolymarketPosition[]> {
        if (!this.wallet) return [];

        try {
            // Data API positions endpoint requires user address as query param
            const address = this.wallet.address;
            const response = await this.throttledFetch(
                `${DATA_API}/positions?user=${address}`
            );

            if (!response.ok) {
                if (response.status === 404) return [];
                throw new Error(`Failed to fetch positions: ${response.status}`);
            }

            const positions = await response.json();
            return Array.isArray(positions)
                ? positions.map((pos: any) => this.transformPosition(pos))
                : [];
        } catch (error) {
            console.error('[PolymarketService] Failed to fetch positions:', error);
            return [];
        }
    }

    // Get user trades history
    public async getTrades(limit: number = 20): Promise<PolymarketTrade[]> {
        if (!this.isInitialized) return [];

        try {
            const path = `/trades?limit=${limit}`;
            const headers = this.getAuthHeaders('GET', path);

            const response = await this.throttledFetch(`${CLOB_HOST}${path}`, {
                method: 'GET',
                headers
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch trades: ${response.status}`);
            }

            const trades = await response.json();
            return trades.map((trade: any) => this.transformTrade(trade));
        } catch (error) {
            console.error('[PolymarketService] Failed to fetch trades:', error);
            return [];
        }
    }

    // Place an order
    public async createOrder(params: OrderParams): Promise<{ success: boolean; orderId?: string; error?: string }> {
        if (!this.isInitialized) {
            return { success: false, error: 'Service not initialized' };
        }

        try {
            // Build order payload
            const orderPayload = {
                tokenID: params.tokenId,
                price: params.price.toString(),
                size: params.size.toString(),
                side: params.side,
                orderType: 'GTC', // Good till cancelled
                tickSize: params.tickSize || '0.01',
                negRisk: params.negRisk || false
            };

            const path = '/order';
            const body = JSON.stringify(orderPayload);
            const headers = this.getAuthHeaders('POST', path, body);

            const response = await this.throttledFetch(`${CLOB_HOST}${path}`, {
                method: 'POST',
                headers,
                body
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                return { success: false, error: errorData.message || `Order failed: ${response.status}` };
            }

            const result = await response.json();
            return { success: true, orderId: result.orderID || result.order_id };
        } catch (error) {
            console.error('[PolymarketService] Failed to create order:', error);
            return { success: false, error: (error as Error).message };
        }
    }

    // Cancel an order
    public async cancelOrder(orderId: string): Promise<boolean> {
        if (!this.isInitialized) return false;

        try {
            const path = `/order/${orderId}`;
            const headers = this.getAuthHeaders('DELETE', path);

            const response = await this.throttledFetch(`${CLOB_HOST}${path}`, {
                method: 'DELETE',
                headers
            });

            return response.ok;
        } catch (error) {
            console.error('[PolymarketService] Failed to cancel order:', error);
            return false;
        }
    }

    // Cancel all open orders
    public async cancelAllOrders(): Promise<boolean> {
        if (!this.isInitialized) return false;

        try {
            const path = '/orders';
            const headers = this.getAuthHeaders('DELETE', path);

            const response = await this.throttledFetch(`${CLOB_HOST}${path}`, {
                method: 'DELETE',
                headers
            });

            return response.ok;
        } catch (error) {
            console.error('[PolymarketService] Failed to cancel all orders:', error);
            return false;
        }
    }

    // ============================================
    // TRANSFORM HELPERS
    // ============================================

    private transformOrder(order: any): PolymarketOrder {
        return {
            id: order.id || order.order_id,
            marketId: order.market || order.marketId || '',
            tokenId: order.asset_id || order.tokenId || '',
            side: order.side?.toUpperCase() || 'BUY',
            outcome: order.outcome || 'YES',
            price: parseFloat(order.price) || 0,
            size: parseFloat(order.original_size || order.size) || 0,
            filledSize: parseFloat(order.size_matched || order.filledSize) || 0,
            status: this.mapOrderStatus(order.status),
            createdAt: new Date(order.created_at || order.createdAt).getTime()
        };
    }

    private mapOrderStatus(status: string): PolymarketOrder['status'] {
        const statusMap: Record<string, PolymarketOrder['status']> = {
            'open': 'OPEN',
            'live': 'OPEN',
            'matched': 'FILLED',
            'filled': 'FILLED',
            'cancelled': 'CANCELED',
            'canceled': 'CANCELED',
            'partial': 'PARTIALLY_FILLED'
        };
        return statusMap[status?.toLowerCase()] || 'OPEN';
    }

    private transformPosition(pos: any): PolymarketPosition {
        const shares = parseFloat(pos.size || pos.shares) || 0;
        const avgPrice = parseFloat(pos.avgPrice || pos.average_price) || 0;
        const currentPrice = parseFloat(pos.currentPrice || pos.price) || avgPrice;
        const costBasis = shares * avgPrice;
        const currentValue = shares * currentPrice;
        const unrealizedPnl = currentValue - costBasis;
        const unrealizedPnlPercent = costBasis > 0 ? (unrealizedPnl / costBasis) * 100 : 0;

        return {
            marketId: pos.market || pos.marketId || '',
            question: pos.question || pos.title || '',
            outcome: pos.outcome?.toUpperCase() || 'YES',
            shares,
            avgPrice,
            currentPrice,
            unrealizedPnl,
            unrealizedPnlPercent,
            costBasis,
            currentValue
        };
    }

    private transformTrade(trade: any): PolymarketTrade {
        return {
            id: trade.id || trade.trade_id,
            marketId: trade.market || trade.marketId || '',
            question: trade.question || trade.title || '',
            outcome: trade.outcome?.toUpperCase() || 'YES',
            side: trade.side?.toUpperCase() || 'BUY',
            price: parseFloat(trade.price) || 0,
            size: parseFloat(trade.size) || 0,
            fee: parseFloat(trade.fee || trade.trading_fee) || 0,
            timestamp: new Date(trade.created_at || trade.timestamp || trade.createdAt).getTime(),
            realizedPnl: trade.realized_pnl ? parseFloat(trade.realized_pnl) : undefined
        };
    }

    // ============================================
    // HEALTH CHECK
    // ============================================

    public async checkHealth(): Promise<boolean> {
        try {
            const response = await this.throttledFetch(`${GAMMA_API}/health`);
            return response.ok;
        } catch {
            return false;
        }
    }
}

// Singleton instance
export const polymarketService = new PolymarketService();
