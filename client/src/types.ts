export enum AppTab {
    DASHBOARD = 'dashboard',
    VAULT = 'vault',
    AGENT = 'agent',
    SCHEDULER = 'scheduler',
    HYPERLIQUID = 'hyperliquid',
    VAULT_DEALER = 'vault_dealer',
    DEALER_DASHBOARD = 'dealer_dashboard',
    DEALER_THINKING = 'dealer_thinking',
    DEALER_CONFIG = 'dealer_config',
    DEALER_PROMPT = 'dealer_prompt',
    CONFIGURATION = 'configuration',
    SETTINGS = 'settings',
    HISTORY = 'history',
    TOKEN_COSTS = 'token_costs',
    // Polymarket Dealer tabs
    POLYMARKET_DEALER = 'polymarket_dealer',
    POLYMARKET_DASHBOARD = 'polymarket_dashboard',
    POLYMARKET_THINKING = 'polymarket_thinking',
    POLYMARKET_CONFIG = 'polymarket_config',
    POLYMARKET_PROMPT = 'polymarket_prompt',
    // Legal
    PRIVACY = 'privacy',
    TERMS = 'terms'
}

export type VaultTab = 'main' | 'solana' | 'hyperliquid' | 'polymarket';

export interface Token {
    symbol: string;
    name: string;
    mint: string;
    decimals: number;
    logoURI?: string;
    balance?: number;
}

/**
 * Withdrawal network type for dual-network support
 */
export type WithdrawalNetwork = 'SOL' | 'HYPE';

/**
 * Withdrawal state management
 */
export interface WithdrawalState {
    network: WithdrawalNetwork;
    amount: string;
    isProcessing: boolean;
}

/**
 * Hyperliquid position data
 */
export interface HyperliquidPosition {

    position: {
        coin: string;
        szi: string; // Size (positive for long, negative for short)
        entryPx: string; // Entry price
        positionValue: string; // Position value in USDC
        leverage: {
            type: string; // 'cross' or 'isolated'
            value: number;
        };
        unrealizedPnl: string;
        returnOnEquity: string;
        liquidationPx: string | null; // Liquidation price
        marginUsed: string; // Margin used for this position
        maxTradeSzs?: string[]; // Max trade sizes
    };
}

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
 * Vault state containing both Solana and Hyperliquid wallet information
 */
export interface VaultState {
    /** Solana wallet public key (Base58) */
    publicKey: string | null;
    /** Encrypted Solana private key */
    encryptedPrivateKey: string | null;
    /** SOL balance in the vault */
    solBalance: number;
    /** Available Solana tokens */
    tokens: Token[];
    /** Solana wallet assets (SPL tokens, NFTs) */
    assets?: any[];
    /** Whether the vault is currently unlocked */
    isUnlocked: boolean;
    /** Connected Solana owner wallet address for withdrawals */
    ownerPublicKey?: string | null;

    // Hyperliquid Vault
    /** Hyperliquid wallet address (EVM format) */
    hlPublicKey?: string | null;
    /** Encrypted Hyperliquid private key */
    hlEncryptedPrivateKey?: string | null;
    /** USDC balance in Hyperliquid vault */
    hlBalance?: number;
    /** Connected Hyperliquid owner wallet address (EVM) for withdrawals */
    hlOwnerPublicKey?: string | null;
    /** Open positions on Hyperliquid */
    hlPositions?: HyperliquidPosition[];

    // Polymarket Vault (Polygon Network)
    /** Polymarket wallet address (EVM format on Polygon) */
    pmPublicKey?: string | null;
    /** Encrypted Polymarket private key */
    pmEncryptedPrivateKey?: string | null;
    /** USDC balance on Polygon for Polymarket */
    pmBalance?: number;
    /** Connected Polymarket owner wallet address (EVM) for withdrawals */
    pmOwnerPublicKey?: string | null;
}

export interface AgentMessage {
    id: string;
    role: 'user' | 'model' | 'system';
    content: string;
    timestamp: number;
    toolCalls?: any[];
    toolResults?: any[];
}

export interface Conversation {
    id: string;
    title: string;
    lastMessage: string;
    timestamp: number;
    messages: AgentMessage[];
}

export interface ScheduledTask {
    id: string;
    type: 'DCA' | 'SWAP' | 'TRANSFER' | 'STOP_LOSS' | 'ALERT' | 'HL_ORDER';
    status: 'active' | 'paused' | 'completed' | 'failed' | 'executing';
    params: string; // JSON string of params
    executeAt?: number; // Timestamp when task should execute (for time-based tasks)
    condition?: {
        // For condition-based tasks (e.g., "when RSI < 30")
        symbol: string; // Trading symbol (e.g., "SOLUSDT")
        indicator: string; // Indicator name (e.g., "rsi", "macd", "price")
        operator: '<' | '>' | '<=' | '>=' | '=='; // Comparison operator
        value: number; // Target value
        timeframe?: string; // Optional timeframe for indicator (e.g., "D" for daily)
    };
    lastExecuted?: number;
    result?: string;
    createdAt: number;
}

export interface SwapQuote {
    inputMint: string;
    outputMint: string;
    amountIn: number;
    estimatedAmountOut: number;
    priceImpact: number;
}

// Market Data MCP Types
export interface MarketPrice {
    price: number;
    exchange: string;
    lastUpdate: string;
}

export interface OHLCV {
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    timestamp: string;
}

export interface TechnicalIndicator {
    symbol?: string;
    indicator: string;
    value: number | string | any;
    timestamp?: number;
}

export interface TradingViewSummary {
    buy: number;
    sell: number;
    neutral: number;
    recommendation: 'BUY' | 'SELL' | 'STRONG_BUY' | 'STRONG_SELL' | 'NEUTRAL';
}

/**
 * Divergence signal detected by MCP (pre-calculated for AI consumption)
 */
export interface DivergenceSignal {
    type: 'BULLISH' | 'BEARISH' | 'HIDDEN_BULLISH' | 'HIDDEN_BEARISH';
    indicator: 'RSI' | 'MACD';
    description: string;
    strength: 'WEAK' | 'MODERATE' | 'STRONG';
    /** Price range where divergence was detected */
    priceRange: { start: number; end: number };
    /** Indicator value range during divergence */
    indicatorRange: { start: number; end: number };
}

// ============================================
// POLYMARKET TYPES
// ============================================

/**
 * Polymarket market category for filtering
 */
export type PolymarketCategory = 'politics' | 'crypto' | 'sports' | 'pop-culture' | 'science' | 'business' | 'other';

/**
 * Polymarket market/event data
 */
export interface PolymarketMarket {
    id: string;
    conditionId: string;
    questionId: string;
    slug: string;
    question: string;
    description?: string;
    /** YES outcome token ID */
    tokenIdYes: string;
    /** NO outcome token ID */
    tokenIdNo: string;
    /** Current YES price (0.00 to 1.00 = probability) */
    priceYes: number;
    /** Current NO price (0.00 to 1.00) */
    priceNo: number;
    /** 24h trading volume in USDC */
    volume24h: number;
    /** Total liquidity in USDC */
    liquidity: number;
    /** Market end date (resolution date) */
    endDate: string;
    /** Market category */
    category: PolymarketCategory;
    /** Whether market is active for trading */
    active: boolean;
    /** Whether market has been resolved */
    resolved: boolean;
    /** Resolution outcome if resolved */
    outcome?: 'YES' | 'NO' | null;
}

/**
 * User position on Polymarket
 */
export interface PolymarketPosition {
    marketId: string;
    question: string;
    outcome: 'YES' | 'NO';
    /** Number of shares held */
    shares: number;
    /** Average entry price */
    avgPrice: number;
    /** Current market price */
    currentPrice: number;
    /** Unrealized PnL in USDC */
    unrealizedPnl: number;
    /** Unrealized PnL as percentage */
    unrealizedPnlPercent: number;
    /** Cost basis in USDC */
    costBasis: number;
    /** Current value in USDC */
    currentValue: number;
}

/**
 * Polymarket order data
 */
export interface PolymarketOrder {
    id: string;
    marketId: string;
    tokenId: string;
    side: 'BUY' | 'SELL';
    outcome: 'YES' | 'NO';
    price: number;
    size: number;
    filledSize: number;
    status: 'OPEN' | 'FILLED' | 'CANCELED' | 'PARTIALLY_FILLED';
    createdAt: number;
}

/**
 * Polymarket trade/fill data
 */
export interface PolymarketTrade {
    id: string;
    marketId: string;
    question: string;
    outcome: 'YES' | 'NO';
    side: 'BUY' | 'SELL';
    price: number;
    size: number;
    fee: number;
    timestamp: number;
    realizedPnl?: number;
}
