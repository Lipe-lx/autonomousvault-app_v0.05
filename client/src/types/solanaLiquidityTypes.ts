// solanaLiquidityTypes.ts
// Types for Solana Liquidity Pool operations (Meteora + Raydium)

// ============================================
// PROTOCOL TYPES
// ============================================

export type PoolProtocol = 'meteora_dlmm' | 'meteora_damm' | 'raydium_clmm' | 'raydium_cpmm';
export type TimeFrame = '5m' | '15m' | '1h' | '4h' | '24h' | '7d';

// ============================================
// POOL TYPES
// ============================================

export interface PoolToken {
    mint: string;
    symbol: string;
    decimals: number;
    logoURI?: string;
}

export interface LiquidityPool {
    address: string;
    protocol: PoolProtocol;
    name: string;
    tokenA: PoolToken;
    tokenB: PoolToken;
    tvl: number;
    feeBps: number;
    apy?: number;
    volume: {
        '5m'?: number;
        '15m'?: number;
        '1h'?: number;
        '4h'?: number;
        '24h': number;
        '7d'?: number;
    };
    binStep?: number; // DLMM specific
    tickSpacing?: number; // CLMM specific
    currentPrice?: number;
    createdAt?: number;
}

export interface PoolQueryFilters {
    protocol?: PoolProtocol[];
    tokenMint?: string;
    tokenPair?: { tokenA: string; tokenB: string };
    minTVL?: number;
    maxTVL?: number;
    minVolume?: number;
    volumeTimeframe?: TimeFrame;
    minAPY?: number;
    maxAPY?: number;
    sortBy?: 'tvl' | 'volume' | 'apy' | 'fee';
    sortOrder?: 'asc' | 'desc';
    limit?: number;
    offset?: number;
}

export interface PoolRanking {
    pool: LiquidityPool;
    rank: number;
    score: number;
    reason: string;
}

// ============================================
// POSITION TYPES
// ============================================

export interface LiquidityPosition {
    positionAddress: string;
    poolAddress: string;
    protocol: PoolProtocol;
    tokenAAmount: number;
    tokenBAmount: number;
    valueUSD: number;
    unclaimedFees: {
        tokenA: number;
        tokenB: number;
        totalUSD: number;
    };
    unclaimedRewards?: {
        token: string;
        amount: number;
        valueUSD: number;
    }[];
    priceRange?: {
        min: number;
        max: number;
        current: number;
        inRange: boolean;
    };
    // DLMM specific
    binIds?: number[];
    // CLMM specific
    tickLower?: number;
    tickUpper?: number;
    nftMint?: string;
    createdAt?: number;
}

export interface PositionPnL {
    positionAddress: string;
    initialValueUSD: number;
    currentValueUSD: number;
    feesEarnedUSD: number;
    rewardsEarnedUSD: number;
    impermanentLoss: number;
    impermanentLossPercent: number;
    netPnL: number;
    netPnLPercent: number;
}

// ============================================
// OPERATION TYPES
// ============================================

export interface AddLiquidityParams {
    poolAddress: string;
    amountA: number;
    amountB: number;
    priceMin?: number;
    priceMax?: number;
    slippageBps?: number;
}

export interface RemoveLiquidityParams {
    positionAddress: string;
    percentage: number; // 1-100
    slippageBps?: number;
}

export interface CreatePoolParams {
    protocol: PoolProtocol;
    tokenA: string;
    tokenB: string;
    feeBps: number;
    initialPrice: number;
    binStep?: number; // DLMM
    tickSpacing?: number; // CLMM
    initialLiquidityA?: number;
    initialLiquidityB?: number;
}

export interface SwapParams {
    inputMint: string;
    outputMint: string;
    amount: number;
    slippageBps?: number;
    poolAddress?: string; // Optional: force specific pool
}

export interface LPOperationResult {
    success: boolean;
    txSignature?: string;
    error?: string;
    positionAddress?: string;
    tokensDeposited?: { tokenA: number; tokenB: number };
    tokensReceived?: { tokenA: number; tokenB: number };
    feesClaimed?: { tokenA: number; tokenB: number; totalUSD: number };
    details?: Record<string, any>;
}

// ============================================
// SIMULATION TYPES
// ============================================

export interface AddLiquiditySimulation {
    poolAddress: string;
    estimatedTokenA: number;
    estimatedTokenB: number;
    estimatedLPTokens?: number;
    priceImpact: number;
    shareOfPool: number;
    fees: number;
}

export interface ImpermanentLossEstimate {
    priceChangePercent: number;
    ilPercent: number;
    ilValueUSD: number;
    holdValueUSD: number;
    lpValueUSD: number;
}

export interface OptimalRangeResult {
    priceMin: number;
    priceMax: number;
    currentPrice: number;
    rangeWidth: number;
    estimatedAPY: number;
    riskLevel: 'conservative' | 'moderate' | 'aggressive';
    reason: string;
}

export interface SwapQuote {
    inputMint: string;
    outputMint: string;
    inputAmount: number;
    outputAmount: number;
    priceImpact: number;
    fee: number;
    route: string[];
}

// ============================================
// ANALYTICS TYPES
// ============================================

export interface PoolHistoryPoint {
    timestamp: number;
    value: number;
}

export interface PoolAnalytics {
    poolAddress: string;
    tvlHistory: PoolHistoryPoint[];
    volumeHistory: PoolHistoryPoint[];
    apyHistory: PoolHistoryPoint[];
    feeHistory: PoolHistoryPoint[];
}

export interface ProtocolComparison {
    tokenPair: string;
    meteora: LiquidityPool[];
    raydium: LiquidityPool[];
    recommendation: {
        protocol: PoolProtocol;
        poolAddress: string;
        reason: string;
    };
}

// ============================================
// MCP CONTEXT TYPES
// ============================================

export interface LPPortfolioContext {
    positions: LiquidityPosition[];
    totalValueUSD: number;
    totalUnclaimedFeesUSD: number;
    totalUnclaimedRewardsUSD: number;
    byProtocol: {
        protocol: PoolProtocol;
        positionCount: number;
        totalValueUSD: number;
    }[];
}

export interface LPMarketContext {
    topPoolsByVolume: PoolRanking[];
    topPoolsByAPY: PoolRanking[];
    recentPools: LiquidityPool[];
    totalTVL: number;
    totalVolume24h: number;
}

// ============================================
// VOLATILITY TYPES
// ============================================

export interface VolatilityMetrics {
    poolAddress: string;
    poolName?: string;
    currentPrice: number;
    volatilityDaily: number;      // Daily volatility (%)
    volatilityAnnualized: number; // Annualized volatility (%)
    priceChange24h: number;       // 24h price change (%)
    priceChange7d: number;        // 7d price change (%)
    dataPoints: number;           // Number of snapshots used
    confidence: 'low' | 'medium' | 'high';
    error?: string;
}

export interface VolatilityBasedRange {
    strategy: 'conservative' | 'moderate' | 'aggressive';
    priceMin: number;
    priceMax: number;
    widthPercent: number;
    sigmaMultiple: number;
    estimatedTimeInRange: string;
    description: string;
}
