import { getSupabaseClient } from './supabase/client';
import { LiquidityPool, PoolQueryFilters } from '../types/solanaLiquidityTypes';

export class PoolService {
    /**
     * Search pools using Supabase tables (efficient, cached)
     */
    async searchPools(filters: PoolQueryFilters): Promise<LiquidityPool[]> {
        const supabase = getSupabaseClient();
        if (!supabase) {
            console.warn('[PoolService] Supabase client not initialized, skipping search.');
            return [];
        }

        try {
            let query = supabase
                .from('liquidity_pools')
                .select(`
                    id,
                    address,
                    protocol,
                    name,
                    token_a_mint,
                    token_b_mint,
                    liquidity_pool_snapshots (
                        tvl,
                        volume_24h,
                        apy,
                        price,
                        timestamp
                    )
                `)
                .order('timestamp', { foreignTable: 'liquidity_pool_snapshots', ascending: false })
                .limit(1, { foreignTable: 'liquidity_pool_snapshots' });

            // Apply Filters
            if (filters.protocol && filters.protocol.length > 0) {
                query = query.in('protocol', filters.protocol);
            }

            // Note: Filters like mint match would go here
            if (filters.tokenPair) {
                 // For now, simple client side filtering might be needed if not querying exact address
                 // Or improved SQL query with OR filters for tokens
            }

            const { data, error } = await query;
            if (error) throw error;
            if (!data) return [];

            return data.map((row: any) => this.mapRowToPool(row));
        } catch (error) {
            console.error('[PoolService] Error searching pools:', error);
            return [];
        }
    }

    /**
     * Get Top Pools by Volume/TVL/APY using Database efficient queries
     * Uses RPC 'get_top_pools_with_delta' for time-based queries
     */
    async getTopPools(
        criteria: 'volume' | 'apy' | 'tvl',
        timeframeMinutes: number = 24 * 60 // Default 24h
    ): Promise<LiquidityPool[]> {
        const supabase = getSupabaseClient();
        if (!supabase) return [];

        try {
            // If user wants high-frequency volume delta (e.g. 5 min, 1h)
            // we use the RPC function we created
            if (criteria === 'volume' && timeframeMinutes < 24 * 60) {
                const { data, error } = await supabase.rpc('get_top_pools_with_delta', {
                    timeframe_minutes: timeframeMinutes,
                    rank_limit: 50
                });

                if (error) {
                    // Fallback if RPC fails or not exists
                    console.warn('[PoolService] RPC failed, falling back to standard', error);
                } else {
                    return (data || []).map((row: any) => ({
                        address: row.pool_address,
                        protocol: row.protocol,
                        name: row.pool_name,
                        tokenA: { mint: '', symbol: row.pool_name.split('-')[0] || '?', decimals: 9 }, 
                        tokenB: { mint: '', symbol: row.pool_name.split('-')[1] || '?', decimals: 9 },
                        tvl: row.current_tvl,
                        volume: {
                            '24h': row.delta_volume, 
                        },
                        apy: row.current_apy
                    } as any));
                }
            }

            // Standard Queries (Metadata + Latest Snapshot)
            const { data, error } = await supabase
                .from('liquidity_pools')
                .select(`
                    *,
                    liquidity_pool_snapshots (
                        tvl,
                        volume_24h,
                        apy,
                        timestamp
                    )
                `)
                .order('timestamp', { foreignTable: 'liquidity_pool_snapshots', ascending: false })
                .limit(1, { foreignTable: 'liquidity_pool_snapshots' });

            if (error) throw error;

            let pools = (data || []).map((row: any) => this.mapRowToPool(row));

            // Client-side sort
            pools.sort((a, b) => {
                if (criteria === 'tvl') return b.tvl - a.tvl;
                if (criteria === 'apy') return b.apy - a.apy;
                return (b.volume['24h'] || 0) - (a.volume['24h'] || 0);
            });

            return pools.slice(0, 50);
        } catch (error) {
            console.error('[PoolService] Error getting top pools:', error);
            return [];
        }
    }

    private mapRowToPool(row: any): LiquidityPool {
        const snapshot = row.liquidity_pool_snapshots?.[0] || {};
        return {
            address: row.address,
            protocol: row.protocol,
            name: row.name,
            tokenA: {
                mint: row.token_a_mint,
                symbol: row.name.split('-')[0] || 'Unknown',
                decimals: 9 
            },
            tokenB: {
                mint: row.token_b_mint,
                symbol: row.name.split('-')[1] || 'Unknown',
                decimals: 9
            },
            tvl: snapshot.tvl || 0,
            feeBps: 0,
            apy: snapshot.apy || 0,
            volume: {
                '24h': snapshot.volume_24h || 0,
                '7d': 0
            },
            currentPrice: snapshot.current_price || snapshot.price || 0
        };
    }
}

export const poolService = new PoolService();
