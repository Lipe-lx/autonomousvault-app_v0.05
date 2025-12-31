// raydiumMCP.ts
// MCP (Model Context Provider) for Raydium CLMM/CPMM operations

import { raydiumService } from '../../services/raydiumService';
import {
    LiquidityPool,
    LiquidityPosition,
    PoolQueryFilters,
    PoolRanking,
    LPPortfolioContext,
    TimeFrame,
    SwapQuote
} from '../../types/solanaLiquidityTypes';

// ============================================
// TYPES
// ============================================

interface RaydiumPoolContext {
    pool: LiquidityPool;
    volume24h: number;
    volume7d: number;
    tvl: number;
    apy: number;
    feeBps: number;
    tickSpacing?: number;
    currentPrice?: number;
    timestamp: number;
}

interface RaydiumBatchContext {
    pools: RaydiumPoolContext[];
    topByVolume: PoolRanking[];
    topByAPY: PoolRanking[];
    positions: LiquidityPosition[];
    totalValueUSD: number;
    timestamp: number;
}

// ============================================
// RAYDIUM MCP CLASS
// ============================================

class RaydiumMCP {

    // ============================================
    // CONTEXT BUILDING
    // ============================================

    /**
     * Get context for a single pool
     */
    async getPoolContext(poolId: string): Promise<RaydiumPoolContext | null> {
        const pool = await raydiumService.getPoolById(poolId);
        if (!pool) return null;

        return {
            pool,
            volume24h: pool.volume['24h'] || 0,
            volume7d: pool.volume['7d'] || 0,
            tvl: pool.tvl,
            apy: pool.apy || 0,
            feeBps: pool.feeBps,
            tickSpacing: pool.tickSpacing,
            currentPrice: pool.currentPrice,
            timestamp: Date.now()
        };
    }

    /**
     * Get batch context for AI analysis
     */
    async getBatchContext(
        walletAddress?: string,
        filters?: PoolQueryFilters
    ): Promise<RaydiumBatchContext> {
        // Get pools
        const pools = await raydiumService.queryPools(filters || { limit: 50 });
        const poolContexts: RaydiumPoolContext[] = pools.map(pool => ({
            pool,
            volume24h: pool.volume['24h'] || 0,
            volume7d: pool.volume['7d'] || 0,
            tvl: pool.tvl,
            apy: pool.apy || 0,
            feeBps: pool.feeBps,
            tickSpacing: pool.tickSpacing,
            currentPrice: pool.currentPrice,
            timestamp: Date.now()
        }));

        // Get top pools by volume
        const topByVolume = this.rankPools(pools, 'volume', 10);

        // Get top pools by APY
        const topByAPY = this.rankPools(pools, 'apy', 10);

        // Get positions if wallet provided
        let positions: LiquidityPosition[] = [];
        let totalValueUSD = 0;

        if (walletAddress) {
            positions = await raydiumService.getPositions(walletAddress);
            totalValueUSD = positions.reduce((sum, p) => sum + p.valueUSD, 0);
        }

        return {
            pools: poolContexts,
            topByVolume,
            topByAPY,
            positions,
            totalValueUSD,
            timestamp: Date.now()
        };
    }

    /**
     * Get portfolio context for wallet
     */
    async getPortfolioContext(walletAddress: string): Promise<LPPortfolioContext> {
        const positions = await raydiumService.getPositions(walletAddress);
        
        const totalValueUSD = positions.reduce((sum, p) => sum + p.valueUSD, 0);
        const totalUnclaimedFeesUSD = positions.reduce(
            (sum, p) => sum + (p.unclaimedFees?.totalUSD || 0), 
            0
        );

        // Group by protocol (CLMM vs CPMM)
        const clmmPositions = positions.filter(p => p.protocol === 'raydium_clmm');
        const cpmmPositions = positions.filter(p => p.protocol === 'raydium_cpmm');

        return {
            positions,
            totalValueUSD,
            totalUnclaimedFeesUSD,
            totalUnclaimedRewardsUSD: 0,
            byProtocol: [
                {
                    protocol: 'raydium_clmm',
                    positionCount: clmmPositions.length,
                    totalValueUSD: clmmPositions.reduce((sum, p) => sum + p.valueUSD, 0)
                },
                {
                    protocol: 'raydium_cpmm',
                    positionCount: cpmmPositions.length,
                    totalValueUSD: cpmmPositions.reduce((sum, p) => sum + p.valueUSD, 0)
                }
            ]
        };
    }

    // ============================================
    // ANALYTICS & RANKINGS
    // ============================================

    /**
     * Get top pools by criteria
     */
    async getTopPools(
        criteria: 'volume' | 'apy' | 'tvl',
        options?: {
            timeframe?: TimeFrame;
            minTVL?: number;
            limit?: number;
            poolType?: 'clmm' | 'cpmm';
        }
    ): Promise<PoolRanking[]> {
        const filters: PoolQueryFilters = {
            minTVL: options?.minTVL,
            volumeTimeframe: options?.timeframe,
            sortBy: criteria,
            sortOrder: 'desc',
            limit: options?.limit || 10
        };

        if (options?.poolType) {
            filters.protocol = [options.poolType === 'clmm' ? 'raydium_clmm' : 'raydium_cpmm'];
        }

        const pools = await raydiumService.queryPools(filters);
        return this.rankPools(pools, criteria, options?.limit || 10);
    }

    /**
     * Find best pool for a token pair
     */
    async findBestPool(
        tokenA: string,
        tokenB: string,
        criteria: 'apy' | 'volume' | 'tvl' = 'tvl'
    ): Promise<PoolRanking | null> {
        const pools = await raydiumService.queryPools({
            tokenPair: { tokenA, tokenB },
            sortBy: criteria,
            sortOrder: 'desc',
            limit: 1
        });

        if (pools.length === 0) return null;

        return {
            pool: pools[0],
            rank: 1,
            score: this.getPoolScore(pools[0], criteria),
            reason: `Best Raydium pool for ${tokenA}/${tokenB} by ${criteria}`
        };
    }

    /**
     * Get swap quote through pool
     */
    async getSwapQuote(
        inputMint: string,
        outputMint: string,
        amount: number,
        slippageBps?: number
    ): Promise<SwapQuote | null> {
        return raydiumService.getSwapQuote({
            inputMint,
            outputMint,
            amount,
            slippageBps
        });
    }

    // ============================================
    // PRICE & TICK HELPERS
    // ============================================

    /**
     * Convert price to tick (for CLMM position ranges)
     */
    priceToTick(price: number, decimalsA: number, decimalsB: number): number {
        return raydiumService.priceToTick(price, decimalsA, decimalsB);
    }

    /**
     * Convert tick to price
     */
    tickToPrice(tick: number, decimalsA: number, decimalsB: number): number {
        return raydiumService.tickToPrice(tick, decimalsA, decimalsB);
    }

    /**
     * Calculate optimal price range based on volatility
     */
    calculateOptimalRange(
        currentPrice: number,
        riskLevel: 'conservative' | 'moderate' | 'aggressive'
    ): { priceMin: number; priceMax: number; rangeWidth: number } {
        const multipliers = {
            conservative: 0.1, // ±10%
            moderate: 0.25,    // ±25%
            aggressive: 0.5   // ±50%
        };

        const mult = multipliers[riskLevel];
        const priceMin = currentPrice * (1 - mult);
        const priceMax = currentPrice * (1 + mult);

        return {
            priceMin,
            priceMax,
            rangeWidth: mult * 2 * 100 // percentage
        };
    }

    // ============================================
    // AI PROMPT GENERATION
    // ============================================

    /**
     * Build analysis prompt for AI
     */
    buildAnalysisPrompt(context: RaydiumBatchContext, userQuery: string): string {
        const {
            pools,
            topByVolume,
            topByAPY,
            positions,
            totalValueUSD
        } = context;

        let prompt = `## Raydium Context\n\n`;
        prompt += `**User Query:** ${userQuery}\n\n`;

        // Portfolio summary
        if (positions.length > 0) {
            prompt += `### Your Raydium Positions\n`;
            prompt += `- Total Positions: ${positions.length}\n`;
            prompt += `- Total Value: $${totalValueUSD.toLocaleString()}\n\n`;
            
            positions.slice(0, 5).forEach((pos, i) => {
                prompt += `${i + 1}. Pool: ${pos.poolAddress.slice(0, 8)}... | `;
                prompt += `Value: $${pos.valueUSD.toLocaleString()} | `;
                prompt += `Unclaimed: $${pos.unclaimedFees.totalUSD.toFixed(2)}\n`;
            });
            prompt += `\n`;
        }

        // Top pools by volume
        prompt += `### Top Pools by Volume (24h)\n`;
        topByVolume.slice(0, 5).forEach((r, i) => {
            prompt += `${i + 1}. ${r.pool.name} | TVL: $${r.pool.tvl.toLocaleString()} | `;
            prompt += `Vol: $${(r.pool.volume['24h'] || 0).toLocaleString()} | `;
            prompt += `APY: ${(r.pool.apy || 0).toFixed(2)}%\n`;
        });
        prompt += `\n`;

        // Top pools by APY
        prompt += `### Top Pools by APY\n`;
        topByAPY.slice(0, 5).forEach((r, i) => {
            prompt += `${i + 1}. ${r.pool.name} | APY: ${(r.pool.apy || 0).toFixed(2)}% | `;
            prompt += `TVL: $${r.pool.tvl.toLocaleString()}\n`;
        });

        return prompt;
    }

    // ============================================
    // HELPER METHODS
    // ============================================

    private rankPools(
        pools: LiquidityPool[],
        criteria: 'volume' | 'apy' | 'tvl',
        limit: number
    ): PoolRanking[] {
        const sorted = [...pools].sort((a, b) => {
            const valA = this.getPoolScore(a, criteria);
            const valB = this.getPoolScore(b, criteria);
            return valB - valA;
        });

        return sorted.slice(0, limit).map((pool, index) => ({
            pool,
            rank: index + 1,
            score: this.getPoolScore(pool, criteria),
            reason: `Ranked #${index + 1} by ${criteria}`
        }));
    }

    private getPoolScore(pool: LiquidityPool, criteria: 'volume' | 'apy' | 'tvl'): number {
        switch (criteria) {
            case 'volume':
                return pool.volume['24h'] || 0;
            case 'apy':
                return pool.apy || 0;
            case 'tvl':
                return pool.tvl;
            default:
                return 0;
        }
    }
}

export const raydiumMCP = new RaydiumMCP();
