// liquidityPoolMCP.ts
// Unified MCP for cross-protocol liquidity pool operations (Meteora + Raydium)

import { meteoraMCP } from '../meteora/meteoraMCP';
import { raydiumMCP } from '../raydium/raydiumMCP';
import { meteoraService } from '../../services/meteoraService';
import { raydiumService } from '../../services/raydiumService';
import {
    LiquidityPool,
    LiquidityPosition,
    PoolQueryFilters,
    PoolRanking,
    LPPortfolioContext,
    ProtocolComparison,
    TimeFrame,
    PoolProtocol
} from '../../types/solanaLiquidityTypes';

// ============================================
// TYPES
// ============================================

interface UnifiedPoolContext {
    meteora: {
        pools: LiquidityPool[];
        topByVolume: PoolRanking[];
        topByAPY: PoolRanking[];
    };
    raydium: {
        pools: LiquidityPool[];
        topByVolume: PoolRanking[];
        topByAPY: PoolRanking[];
    };
    combined: {
        topByVolume: PoolRanking[];
        topByAPY: PoolRanking[];
    };
    positions: {
        meteora: LiquidityPosition[];
        raydium: LiquidityPosition[];
        totalValueUSD: number;
        totalUnclaimedFeesUSD: number;
    };
    timestamp: number;
}

// ============================================
// UNIFIED LIQUIDITY POOL MCP
// ============================================

class LiquidityPoolMCP {

    // ============================================
    // UNIFIED POOL DISCOVERY
    // ============================================

    /**
     * Discover pools across both protocols
     */
    async discoverPools(filters?: PoolQueryFilters): Promise<LiquidityPool[]> {
        const [meteoraPools, raydiumPools] = await Promise.all([
            meteoraService.queryPools(filters || {}),
            raydiumService.queryPools(filters || {})
        ]);

        let allPools = [...meteoraPools, ...raydiumPools];

        // Apply cross-protocol sorting if needed
        if (filters?.sortBy) {
            allPools.sort((a, b) => {
                const order = filters.sortOrder === 'asc' ? 1 : -1;
                let valA: number, valB: number;

                switch (filters.sortBy) {
                    case 'tvl':
                        valA = a.tvl;
                        valB = b.tvl;
                        break;
                    case 'volume':
                        const tf = filters.volumeTimeframe || '24h';
                        valA = a.volume[tf] || a.volume['24h'] || 0;
                        valB = b.volume[tf] || b.volume['24h'] || 0;
                        break;
                    case 'apy':
                        valA = a.apy || 0;
                        valB = b.apy || 0;
                        break;
                    default:
                        valA = 0;
                        valB = 0;
                }
                return (valB - valA) * order;
            });
        }

        if (filters?.limit) {
            allPools = allPools.slice(0, filters.limit);
        }

        return allPools;
    }

    /**
     * Search pools by token pair across protocols
     */
    async searchPools(
        tokenA: string,
        tokenB: string,
        protocol?: 'meteora' | 'raydium'
    ): Promise<LiquidityPool[]> {
        const filters: PoolQueryFilters = {
            tokenPair: { tokenA, tokenB },
            sortBy: 'tvl',
            sortOrder: 'desc'
        };

        if (protocol === 'meteora') {
            return meteoraService.queryPools(filters);
        } else if (protocol === 'raydium') {
            return raydiumService.queryPools(filters);
        }

        // Search both
        const [meteoraPools, raydiumPools] = await Promise.all([
            meteoraService.queryPools(filters),
            raydiumService.queryPools(filters)
        ]);

        return [...meteoraPools, ...raydiumPools].sort((a, b) => b.tvl - a.tvl);
    }

    // ============================================
    // UNIFIED PORTFOLIO
    // ============================================

    /**
     * Get all LP positions across protocols
     */
    async getAllPositions(walletAddress: string): Promise<{
        meteora: LiquidityPosition[];
        raydium: LiquidityPosition[];
        totalValueUSD: number;
        totalUnclaimedFeesUSD: number;
    }> {
        const [meteoraPositions, raydiumPositions] = await Promise.all([
            meteoraService.getPositions(walletAddress),
            raydiumService.getPositions(walletAddress)
        ]);

        const allPositions = [...meteoraPositions, ...raydiumPositions];
        const totalValueUSD = allPositions.reduce((sum, p) => sum + p.valueUSD, 0);
        const totalUnclaimedFeesUSD = allPositions.reduce(
            (sum, p) => sum + (p.unclaimedFees?.totalUSD || 0),
            0
        );

        return {
            meteora: meteoraPositions,
            raydium: raydiumPositions,
            totalValueUSD,
            totalUnclaimedFeesUSD
        };
    }

    /**
     * Get unified portfolio context
     */
    async getPortfolioContext(walletAddress: string): Promise<LPPortfolioContext> {
        const positionData = await this.getAllPositions(walletAddress);
        const allPositions = [...positionData.meteora, ...positionData.raydium];

        return {
            positions: allPositions,
            totalValueUSD: positionData.totalValueUSD,
            totalUnclaimedFeesUSD: positionData.totalUnclaimedFeesUSD,
            totalUnclaimedRewardsUSD: 0,
            byProtocol: [
                {
                    protocol: 'meteora_dlmm' as PoolProtocol,
                    positionCount: positionData.meteora.length,
                    totalValueUSD: positionData.meteora.reduce((s, p) => s + p.valueUSD, 0)
                },
                {
                    protocol: 'raydium_clmm' as PoolProtocol,
                    positionCount: positionData.raydium.length,
                    totalValueUSD: positionData.raydium.reduce((s, p) => s + p.valueUSD, 0)
                }
            ]
        };
    }

    // ============================================
    // CROSS-PROTOCOL ANALYTICS
    // ============================================

    /**
     * Get top pools across all protocols
     */
    async getTopPools(
        criteria: 'volume' | 'apy' | 'tvl',
        options?: {
            timeframe?: TimeFrame;
            minTVL?: number;
            limit?: number;
        }
    ): Promise<PoolRanking[]> {
        const pools = await this.discoverPools({
            minTVL: options?.minTVL,
            volumeTimeframe: options?.timeframe,
            sortBy: criteria,
            sortOrder: 'desc',
            limit: (options?.limit || 10) * 2 // Get extra for filtering
        });

        return pools.slice(0, options?.limit || 10).map((pool, index) => ({
            pool,
            rank: index + 1,
            score: this.getPoolScore(pool, criteria),
            reason: `#${index + 1} by ${criteria} across all protocols`
        }));
    }

    /**
     * Compare protocols for a token pair
     */
    async compareProtocols(tokenA: string, tokenB: string): Promise<ProtocolComparison> {
        const [meteoraPools, raydiumPools] = await Promise.all([
            meteoraService.queryPools({ tokenPair: { tokenA, tokenB } }),
            raydiumService.queryPools({ tokenPair: { tokenA, tokenB } })
        ]);

        // Find best pool
        const allPools = [...meteoraPools, ...raydiumPools];
        let bestPool: LiquidityPool | null = null;
        let bestScore = -1;

        for (const pool of allPools) {
            // Score based on TVL, volume, and APY
            const score = (pool.tvl / 1000) + (pool.volume['24h'] || 0) / 100 + (pool.apy || 0);
            if (score > bestScore) {
                bestScore = score;
                bestPool = pool;
            }
        }

        return {
            tokenPair: `${tokenA}/${tokenB}`,
            meteora: meteoraPools,
            raydium: raydiumPools,
            recommendation: bestPool ? {
                protocol: bestPool.protocol,
                poolAddress: bestPool.address,
                reason: `Best overall score considering TVL ($${bestPool.tvl.toLocaleString()}), ` +
                        `volume ($${(bestPool.volume['24h'] || 0).toLocaleString()}), ` +
                        `and APY (${(bestPool.apy || 0).toFixed(2)}%)`
            } : {
                protocol: 'meteora_dlmm',
                poolAddress: '',
                reason: 'No pools found for this token pair'
            }
        };
    }

    /**
     * Recommend best protocol for a token pair
     */
    async recommendProtocol(
        tokenA: string,
        tokenB: string,
        criteria: 'apy' | 'volume' | 'tvl' = 'tvl'
    ): Promise<{ protocol: PoolProtocol; poolAddress: string; reason: string }[]> {
        const comparison = await this.compareProtocols(tokenA, tokenB);
        const allPools = [...comparison.meteora, ...comparison.raydium];

        if (allPools.length === 0) {
            return [{
                protocol: 'meteora_dlmm',
                poolAddress: '',
                reason: `No pools found for ${tokenA}/${tokenB}`
            }];
        }

        // Sort by criteria
        const sorted = allPools.sort((a, b) => {
            const valA = this.getPoolScore(a, criteria);
            const valB = this.getPoolScore(b, criteria);
            return valB - valA;
        });

        return sorted.slice(0, 3).map((pool, index) => ({
            protocol: pool.protocol,
            poolAddress: pool.address,
            reason: `#${index + 1} by ${criteria}: ${this.formatScore(pool, criteria)}`
        }));
    }

    // ============================================
    // UNIFIED CONTEXT FOR AI
    // ============================================

    /**
     * Build unified context for AI analysis
     */
    async buildUnifiedContext(
        walletAddress?: string,
        filters?: PoolQueryFilters
    ): Promise<UnifiedPoolContext> {
        const [meteoraContext, raydiumContext] = await Promise.all([
            meteoraMCP.getBatchContext(walletAddress, filters),
            raydiumMCP.getBatchContext(walletAddress, filters)
        ]);

        // Combine top pools
        const allPools = [...meteoraContext.pools.map(c => c.pool), ...raydiumContext.pools.map(c => c.pool)];
        
        const combinedTopByVolume = allPools
            .sort((a, b) => (b.volume['24h'] || 0) - (a.volume['24h'] || 0))
            .slice(0, 10)
            .map((pool, i) => ({ pool, rank: i + 1, score: pool.volume['24h'] || 0, reason: 'Top volume' }));

        const combinedTopByAPY = allPools
            .sort((a, b) => (b.apy || 0) - (a.apy || 0))
            .slice(0, 10)
            .map((pool, i) => ({ pool, rank: i + 1, score: pool.apy || 0, reason: 'Top APY' }));

        return {
            meteora: {
                pools: meteoraContext.pools.map(c => c.pool),
                topByVolume: meteoraContext.topByVolume,
                topByAPY: meteoraContext.topByAPY
            },
            raydium: {
                pools: raydiumContext.pools.map(c => c.pool),
                topByVolume: raydiumContext.topByVolume,
                topByAPY: raydiumContext.topByAPY
            },
            combined: {
                topByVolume: combinedTopByVolume,
                topByAPY: combinedTopByAPY
            },
            positions: {
                meteora: meteoraContext.positions,
                raydium: raydiumContext.positions,
                totalValueUSD: meteoraContext.totalValueUSD + raydiumContext.totalValueUSD,
                totalUnclaimedFeesUSD: 
                    meteoraContext.positions.reduce((s, p) => s + (p.unclaimedFees?.totalUSD || 0), 0) +
                    raydiumContext.positions.reduce((s, p) => s + (p.unclaimedFees?.totalUSD || 0), 0)
            },
            timestamp: Date.now()
        };
    }

    /**
     * Build analysis prompt for AI
     */
    buildAnalysisPrompt(context: UnifiedPoolContext, userQuery: string): string {
        let prompt = `## Solana Liquidity Pool Context\n\n`;
        prompt += `**Query:** ${userQuery}\n\n`;

        // Portfolio summary
        const { positions } = context;
        if (positions.meteora.length > 0 || positions.raydium.length > 0) {
            prompt += `### Your LP Portfolio\n`;
            prompt += `- Total Value: $${positions.totalValueUSD.toLocaleString()}\n`;
            prompt += `- Unclaimed Fees: $${positions.totalUnclaimedFeesUSD.toFixed(2)}\n`;
            prompt += `- Meteora Positions: ${positions.meteora.length}\n`;
            prompt += `- Raydium Positions: ${positions.raydium.length}\n\n`;
        }

        // Top pools across protocols
        prompt += `### Top Pools by Volume (All Protocols)\n`;
        context.combined.topByVolume.slice(0, 5).forEach((r, i) => {
            const protocol = r.pool.protocol.includes('meteora') ? 'MET' : 'RAY';
            prompt += `${i + 1}. [${protocol}] ${r.pool.name} | `;
            prompt += `TVL: $${r.pool.tvl.toLocaleString()} | `;
            prompt += `Vol: $${(r.pool.volume['24h'] || 0).toLocaleString()}\n`;
        });
        prompt += `\n`;

        prompt += `### Top Pools by APY\n`;
        context.combined.topByAPY.slice(0, 5).forEach((r, i) => {
            const protocol = r.pool.protocol.includes('meteora') ? 'MET' : 'RAY';
            prompt += `${i + 1}. [${protocol}] ${r.pool.name} | `;
            prompt += `APY: ${(r.pool.apy || 0).toFixed(2)}% | `;
            prompt += `TVL: $${r.pool.tvl.toLocaleString()}\n`;
        });

        return prompt;
    }

    // ============================================
    // HELPER METHODS
    // ============================================

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

    private formatScore(pool: LiquidityPool, criteria: 'volume' | 'apy' | 'tvl'): string {
        switch (criteria) {
            case 'volume':
                return `$${(pool.volume['24h'] || 0).toLocaleString()}`;
            case 'apy':
                return `${(pool.apy || 0).toFixed(2)}%`;
            case 'tvl':
                return `$${pool.tvl.toLocaleString()}`;
            default:
                return '';
        }
    }
}

export const liquidityPoolMCP = new LiquidityPoolMCP();
