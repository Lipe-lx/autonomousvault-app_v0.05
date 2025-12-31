// meteoraMCP.ts
// MCP (Model Context Provider) for Meteora DLMM/DAMM operations

import { meteoraService } from '../../services/meteoraService';
import {
    LiquidityPool,
    LiquidityPosition,
    PoolQueryFilters,
    PoolRanking,
    LPPortfolioContext,
    TimeFrame
} from '../../types/solanaLiquidityTypes';

// ============================================
// TYPES
// ============================================

interface MeteoraPoolContext {
    pool: LiquidityPool;
    volume24h: number;
    volume7d: number;
    tvl: number;
    apy: number;
    feeBps: number;
    binStep?: number;
    currentPrice?: number;
    timestamp: number;
}

interface MeteoraBatchContext {
    pools: MeteoraPoolContext[];
    topByVolume: PoolRanking[];
    topByAPY: PoolRanking[];
    positions: LiquidityPosition[];
    totalValueUSD: number;
    timestamp: number;
}

// ============================================
// METEORA MCP CLASS
// ============================================

class MeteoraMCP {

    // ============================================
    // CONTEXT BUILDING
    // ============================================

    /**
     * Get context for a single pool (for AI analysis)
     */
    async getPoolContext(poolAddress: string): Promise<MeteoraPoolContext | null> {
        const pool = await meteoraService.getPool(poolAddress);
        if (!pool) return null;

        return {
            pool,
            volume24h: pool.volume['24h'] || 0,
            volume7d: pool.volume['7d'] || 0,
            tvl: pool.tvl,
            apy: pool.apy || 0,
            feeBps: pool.feeBps,
            binStep: pool.binStep,
            currentPrice: pool.currentPrice,
            timestamp: Date.now()
        };
    }

    /**
     * Get batch context for AI analysis (pools + positions)
     */
    async getBatchContext(
        walletAddress?: string,
        filters?: PoolQueryFilters
    ): Promise<MeteoraBatchContext> {
        // Get pools
        const pools = await meteoraService.queryPools(filters || { limit: 50 });
        const poolContexts: MeteoraPoolContext[] = pools.map(pool => ({
            pool,
            volume24h: pool.volume['24h'] || 0,
            volume7d: pool.volume['7d'] || 0,
            tvl: pool.tvl,
            apy: pool.apy || 0,
            feeBps: pool.feeBps,
            binStep: pool.binStep,
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
            positions = await meteoraService.getPositions(walletAddress);
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
        const positions = await meteoraService.getPositions(walletAddress);
        
        const totalValueUSD = positions.reduce((sum, p) => sum + p.valueUSD, 0);
        const totalUnclaimedFeesUSD = positions.reduce(
            (sum, p) => sum + (p.unclaimedFees?.totalUSD || 0), 
            0
        );

        return {
            positions,
            totalValueUSD,
            totalUnclaimedFeesUSD,
            totalUnclaimedRewardsUSD: 0,
            byProtocol: [{
                protocol: 'meteora_dlmm',
                positionCount: positions.length,
                totalValueUSD
            }]
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
        }
    ): Promise<PoolRanking[]> {
        const filters: PoolQueryFilters = {
            minTVL: options?.minTVL,
            volumeTimeframe: options?.timeframe,
            sortBy: criteria,
            sortOrder: 'desc',
            limit: options?.limit || 10
        };

        const pools = await meteoraService.queryPools(filters);
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
        const pools = await meteoraService.queryPools({
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
            reason: `Best Meteora pool for ${tokenA}/${tokenB} by ${criteria}`
        };
    }

    // ============================================
    // AI PROMPT GENERATION
    // ============================================

    /**
     * Build analysis prompt for AI
     */
    buildAnalysisPrompt(context: MeteoraBatchContext, userQuery: string): string {
        const {
            pools,
            topByVolume,
            topByAPY,
            positions,
            totalValueUSD
        } = context;

        let prompt = `## Meteora DLMM Context\n\n`;
        prompt += `**User Query:** ${userQuery}\n\n`;

        // Portfolio summary
        if (positions.length > 0) {
            prompt += `### Your Meteora Positions\n`;
            prompt += `- Total Positions: ${positions.length}\n`;
            prompt += `- Total Value: $${totalValueUSD.toLocaleString()}\n\n`;
            
            positions.slice(0, 5).forEach((pos, i) => {
                prompt += `${i + 1}. Pool: ${pos.poolAddress.slice(0, 8)}... | `;
                prompt += `Value: $${pos.valueUSD.toLocaleString()} | `;
                prompt += `Unclaimed Fees: $${pos.unclaimedFees.totalUSD.toFixed(2)}\n`;
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

export const meteoraMCP = new MeteoraMCP();
