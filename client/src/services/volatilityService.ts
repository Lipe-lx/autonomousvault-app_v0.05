// volatilityService.ts
// Service for calculating pool volatility and suggesting optimal price ranges

import { getSupabaseClient } from './supabase/client';

// ============================================
// TYPES
// ============================================

export interface VolatilityResult {
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

export interface RangeSuggestion {
    strategy: 'conservative' | 'moderate' | 'aggressive';
    priceMin: number;
    priceMax: number;
    widthPercent: number;
    sigmaMultiple: number;
    estimatedTimeInRange: string;
    description: string;
}

export interface PriceSnapshot {
    timestamp: Date;
    price: number;
}

// ============================================
// VOLATILITY SERVICE
// ============================================

class VolatilityService {
    
    /**
     * Calculate volatility for a pool using historical price data
     * Uses standard deviation of log returns
     */
    async calculateVolatility(
        poolAddress: string,
        days: number = 7
    ): Promise<VolatilityResult> {
        try {
            // Fetch price history from Supabase
            const priceHistory = await this.getPriceHistory(poolAddress, days);
            
            if (priceHistory.length < 2) {
                return {
                    poolAddress,
                    currentPrice: priceHistory[0]?.price || 0,
                    volatilityDaily: 0,
                    volatilityAnnualized: 0,
                    priceChange24h: 0,
                    priceChange7d: 0,
                    dataPoints: priceHistory.length,
                    confidence: 'low',
                    error: 'Insufficient data for volatility calculation'
                };
            }

            // Calculate log returns
            const logReturns: number[] = [];
            for (let i = 1; i < priceHistory.length; i++) {
                const prevPrice = priceHistory[i - 1].price;
                const currPrice = priceHistory[i].price;
                if (prevPrice > 0 && currPrice > 0) {
                    logReturns.push(Math.log(currPrice / prevPrice));
                }
            }

            if (logReturns.length === 0) {
                return {
                    poolAddress,
                    currentPrice: priceHistory[priceHistory.length - 1]?.price || 0,
                    volatilityDaily: 0,
                    volatilityAnnualized: 0,
                    priceChange24h: 0,
                    priceChange7d: 0,
                    dataPoints: priceHistory.length,
                    confidence: 'low',
                    error: 'Could not calculate returns from price data'
                };
            }

            // Calculate standard deviation of log returns
            const mean = logReturns.reduce((a, b) => a + b, 0) / logReturns.length;
            const squaredDiffs = logReturns.map(r => Math.pow(r - mean, 2));
            const variance = squaredDiffs.reduce((a, b) => a + b, 0) / logReturns.length;
            const stdDev = Math.sqrt(variance);

            // Snapshots are every 5 minutes = 288 per day
            // Daily volatility = stdDev * sqrt(288)
            const periodsPerDay = 288;
            const dailyVolatility = stdDev * Math.sqrt(periodsPerDay) * 100;
            
            // Annualized volatility = daily * sqrt(365)
            const annualizedVolatility = dailyVolatility * Math.sqrt(365);

            // Calculate price changes
            const currentPrice = priceHistory[priceHistory.length - 1].price;
            const price24hAgo = this.findPriceAtTime(priceHistory, 24 * 60);
            const price7dAgo = this.findPriceAtTime(priceHistory, 7 * 24 * 60);

            const priceChange24h = price24hAgo > 0 
                ? ((currentPrice - price24hAgo) / price24hAgo) * 100 
                : 0;
            
            const priceChange7d = price7dAgo > 0 
                ? ((currentPrice - price7dAgo) / price7dAgo) * 100 
                : 0;

            // Determine confidence based on data points
            // 288 points = 24h of 5min snapshots
            let confidence: 'low' | 'medium' | 'high';
            if (priceHistory.length >= 288 * 3) { // 3+ days
                confidence = 'high';
            } else if (priceHistory.length >= 288) { // 1+ day
                confidence = 'medium';
            } else {
                confidence = 'low';
            }

            return {
                poolAddress,
                currentPrice,
                volatilityDaily: Math.round(dailyVolatility * 100) / 100,
                volatilityAnnualized: Math.round(annualizedVolatility * 100) / 100,
                priceChange24h: Math.round(priceChange24h * 100) / 100,
                priceChange7d: Math.round(priceChange7d * 100) / 100,
                dataPoints: priceHistory.length,
                confidence
            };
        } catch (error: any) {
            console.error('[VolatilityService] Error calculating volatility:', error);
            return {
                poolAddress,
                currentPrice: 0,
                volatilityDaily: 0,
                volatilityAnnualized: 0,
                priceChange24h: 0,
                priceChange7d: 0,
                dataPoints: 0,
                confidence: 'low',
                error: error.message
            };
        }
    }

    /**
     * Suggest optimal price ranges based on volatility
     * Uses sigma multiples for different risk levels
     */
    suggestOptimalRanges(
        currentPrice: number,
        volatility: VolatilityResult
    ): RangeSuggestion[] {
        const dailyVol = volatility.volatilityDaily / 100; // Convert to decimal

        // If no volatility data, return default ranges
        if (dailyVol === 0 || currentPrice === 0) {
            return this.getDefaultRanges(currentPrice);
        }

        const suggestions: RangeSuggestion[] = [
            // Conservative: ±2σ (~95% of price movements)
            {
                strategy: 'conservative',
                ...this.calculateRange(currentPrice, dailyVol, 2, 7),
                sigmaMultiple: 2,
                estimatedTimeInRange: '~95% do tempo',
                description: 'Faixa ampla, menor rendimento, menor risco de sair da faixa'
            },
            // Moderate: ±1.5σ (~87% of price movements)
            {
                strategy: 'moderate',
                ...this.calculateRange(currentPrice, dailyVol, 1.5, 7),
                sigmaMultiple: 1.5,
                estimatedTimeInRange: '~87% do tempo',
                description: 'Balanço entre rendimento e risco'
            },
            // Aggressive: ±1σ (~68% of price movements)
            {
                strategy: 'aggressive',
                ...this.calculateRange(currentPrice, dailyVol, 1, 7),
                sigmaMultiple: 1,
                estimatedTimeInRange: '~68% do tempo',
                description: 'Faixa estreita, maior rendimento, maior risco de sair da faixa'
            }
        ];

        return suggestions;
    }

    /**
     * Calculate 24h volume change percentage
     * Compares current 24h volume with volume from ~24h ago
     */
    async getVolumeChange24h(
        poolAddress: string
    ): Promise<{ current: number; previous: number; changePercent: number } | null> {
        const supabase = getSupabaseClient();
        if (!supabase) {
            console.warn('[VolatilityService] Supabase client not available');
            return null;
        }

        try {
            // Get pool ID
            const { data: pool, error: poolError } = await supabase
                .from('liquidity_pools')
                .select('id')
                .eq('address', poolAddress)
                .single();

            if (poolError || !pool) {
                console.warn('[VolatilityService] Pool not found for volume:', poolAddress);
                return null;
            }

            // Get the most recent snapshot
            const { data: currentSnapshot, error: currentError } = await supabase
                .from('liquidity_pool_snapshots')
                .select('volume_24h, timestamp')
                .eq('pool_id', pool.id)
                .order('timestamp', { ascending: false })
                .limit(1)
                .single();

            if (currentError || !currentSnapshot) {
                return null;
            }

            // Get snapshot from ~24 hours ago
            const past24h = new Date();
            past24h.setHours(past24h.getHours() - 24);

            const { data: pastSnapshot, error: pastError } = await supabase
                .from('liquidity_pool_snapshots')
                .select('volume_24h, timestamp')
                .eq('pool_id', pool.id)
                .lte('timestamp', past24h.toISOString())
                .order('timestamp', { ascending: false })
                .limit(1)
                .single();

            const currentVolume = parseFloat(currentSnapshot.volume_24h) || 0;
            
            // If no past snapshot, return current volume only
            if (pastError || !pastSnapshot) {
                return {
                    current: currentVolume,
                    previous: 0,
                    changePercent: 0
                };
            }

            const previousVolume = parseFloat(pastSnapshot.volume_24h) || 0;

            // Calculate percentage change
            let changePercent = 0;
            if (previousVolume > 0) {
                changePercent = ((currentVolume - previousVolume) / previousVolume) * 100;
            } else if (currentVolume > 0) {
                changePercent = 100; // From 0 to something = 100% increase
            }

            return {
                current: currentVolume,
                previous: previousVolume,
                changePercent: Math.round(changePercent * 100) / 100
            };
        } catch (error) {
            console.error('[VolatilityService] Error calculating volume change:', error);
            return null;
        }
    }

    /**
     * Get price history from Supabase
     */
    async getPriceHistory(
        poolAddress: string,
        days: number = 7
    ): Promise<PriceSnapshot[]> {
        const supabase = getSupabaseClient();
        if (!supabase) {
            console.warn('[VolatilityService] Supabase client not available');
            return [];
        }

        try {
            // First get the pool ID
            const { data: pool, error: poolError } = await supabase
                .from('liquidity_pools')
                .select('id, name')
                .eq('address', poolAddress)
                .single();

            if (poolError || !pool) {
                console.warn('[VolatilityService] Pool not found:', poolAddress);
                return [];
            }

            // Get snapshots for the time period
            const startTime = new Date();
            startTime.setDate(startTime.getDate() - days);

            const { data: snapshots, error } = await supabase
                .from('liquidity_pool_snapshots')
                .select('timestamp, price')
                .eq('pool_id', pool.id)
                .gte('timestamp', startTime.toISOString())
                .order('timestamp', { ascending: true });

            if (error) {
                console.error('[VolatilityService] Error fetching snapshots:', error);
                return [];
            }

            return (snapshots || []).map(s => ({
                timestamp: new Date(s.timestamp),
                price: parseFloat(s.price) || 0
            })).filter(s => s.price > 0);
        } catch (error) {
            console.error('[VolatilityService] Error in getPriceHistory:', error);
            return [];
        }
    }

    /**
     * Search pools by token pair name from Supabase
     * Returns pools that have historical data for volatility calculation
     */
    async searchPoolsByTokenPair(
        tokenA: string,
        tokenB: string,
        limit: number = 20
    ): Promise<{ address: string; name: string; protocol: string; tvl: number }[]> {
        const supabase = getSupabaseClient();
        if (!supabase) {
            console.warn('[VolatilityService] Supabase client not available');
            return [];
        }

        try {
            // Search by pool name containing both tokens (case insensitive)
            // Using multiple patterns to catch "SOL-USDC", "USDC/SOL", "SOL/USDC", etc.
            const { data: pools, error } = await supabase
                .from('liquidity_pools')
                .select(`
                    address,
                    name,
                    protocol,
                    liquidity_pool_snapshots (
                        tvl,
                        timestamp
                    )
                `)
                .or(`name.ilike.%${tokenA}%${tokenB}%,name.ilike.%${tokenB}%${tokenA}%`)
                .order('timestamp', { foreignTable: 'liquidity_pool_snapshots', ascending: false })
                .limit(1, { foreignTable: 'liquidity_pool_snapshots' });

            if (error) {
                console.error('[VolatilityService] Error searching pools:', error);
                return [];
            }

            // Filter out pools that don't actually contain both tokens in the name logic
            // (ilike %SOL%USDC% might catch "SOLAR-USDC")
            const filteredPools = (pools || []).filter(p => {
                const name = p.name.toUpperCase();
                const partA = tokenA.toUpperCase();
                const partB = tokenB.toUpperCase();
                
                // Check if tokens are distinct parts of the name
                const regexA = new RegExp(`(^|[^A-Z])${partA}([^A-Z]|$)`);
                const regexB = new RegExp(`(^|[^A-Z])${partB}([^A-Z]|$)`);
                return regexA.test(name) && regexB.test(name);
            });

            // Map and sort by TVL
            const result = filteredPools.map((p: any) => ({
                address: p.address,
                name: p.name,
                protocol: p.protocol,
                tvl: p.liquidity_pool_snapshots?.[0]?.tvl || 0
            })).sort((a, b) => b.tvl - a.tvl).slice(0, limit);

            return result;
        } catch (error) {
            console.error('[VolatilityService] Error in searchPoolsByTokenPair:', error);
            return [];
        }
    }

    /**
     * Get all pools from Supabase with recent snapshots
     */
    async getAllPoolsFromDatabase(
        minTVL: number = 0,
        protocol?: 'meteora' | 'raydium',
        limit: number = 100
    ): Promise<{ address: string; name: string; protocol: string; tvl: number }[]> {
        const supabase = getSupabaseClient();
        if (!supabase) {
            console.warn('[VolatilityService] Supabase client not available');
            return [];
        }

        try {
            let query = supabase
                .from('liquidity_pools')
                .select(`
                    address,
                    name,
                    protocol,
                    liquidity_pool_snapshots (
                        tvl,
                        timestamp
                    )
                `)
                .order('timestamp', { foreignTable: 'liquidity_pool_snapshots', ascending: false })
                .limit(1, { foreignTable: 'liquidity_pool_snapshots' });

            // Filter by protocol if specified
            if (protocol) {
                query = query.ilike('protocol', `%${protocol}%`);
            }

            const { data: pools, error } = await query.limit(limit);

            if (error) {
                console.error('[VolatilityService] Error fetching pools:', error);
                return [];
            }

            // Map and filter by TVL
            const result = (pools || [])
                .map((p: any) => ({
                    address: p.address,
                    name: p.name,
                    protocol: p.protocol,
                    tvl: p.liquidity_pool_snapshots?.[0]?.tvl || 0
                }))
                .filter(p => p.tvl >= minTVL)
                .sort((a, b) => b.tvl - a.tvl);

            return result;
        } catch (error) {
            console.error('[VolatilityService] Error in getAllPoolsFromDatabase:', error);
            return [];
        }
    }

    /**
     * Get top pools ranked by volatility (highest first)
     * @param limit Number of pools to return (default 10)
     * @param days Number of days for volatility calculation (default 7)
     * @param minTVL Minimum TVL filter (default 0)
     * @param protocol Optional protocol filter ('meteora' or 'raydium')
     */
    async getTopPoolsByVolatility(
        limit: number = 10,
        days: number = 7,
        minTVL: number = 0,
        protocol?: 'meteora' | 'raydium'
    ): Promise<{ pool: { address: string; name: string; protocol: string; tvl: number }; volatility: VolatilityResult }[]> {
        try {
            // Get all pools from database
            const pools = await this.getAllPoolsFromDatabase(minTVL, protocol, 50);
            
            if (pools.length === 0) {
                console.warn('[VolatilityService] No pools found in database');
                return [];
            }

            // Calculate volatility for each pool (in batches to avoid overwhelming the database)
            const results: { pool: typeof pools[0]; volatility: VolatilityResult }[] = [];
            const batchSize = 5;
            
            for (let i = 0; i < pools.length; i += batchSize) {
                const batch = pools.slice(i, i + batchSize);
                const batchResults = await Promise.all(
                    batch.map(async (pool) => {
                        const volatility = await this.calculateVolatility(pool.address, days);
                        volatility.poolName = pool.name;
                        return { pool, volatility };
                    })
                );
                results.push(...batchResults);
            }

            // Filter out pools with errors or no volatility data
            const validResults = results.filter(r => 
                !r.volatility.error && 
                r.volatility.volatilityDaily > 0
            );

            // Sort by daily volatility (highest first)
            validResults.sort((a, b) => b.volatility.volatilityDaily - a.volatility.volatilityDaily);

            // Return top N
            return validResults.slice(0, limit);
        } catch (error: any) {
            console.error('[VolatilityService] Error in getTopPoolsByVolatility:', error);
            return [];
        }
    }

    // ============================================
    // HELPER METHODS
    // ============================================

    private calculateRange(
        currentPrice: number,
        dailyVolatility: number,
        sigmaMultiple: number,
        days: number
    ): { priceMin: number; priceMax: number; widthPercent: number } {
        // Project volatility over the period
        // σ_period = σ_daily * sqrt(days)
        const periodVolatility = dailyVolatility * Math.sqrt(days);
        
        // Range = price * (1 ± sigma * volatility)
        const range = sigmaMultiple * periodVolatility;
        
        const priceMin = currentPrice * (1 - range);
        const priceMax = currentPrice * (1 + range);
        const widthPercent = range * 2 * 100;

        return {
            priceMin: Math.round(priceMin * 10000) / 10000,
            priceMax: Math.round(priceMax * 10000) / 10000,
            widthPercent: Math.round(widthPercent * 10) / 10
        };
    }

    private findPriceAtTime(
        history: PriceSnapshot[],
        minutesAgo: number
    ): number {
        const targetTime = new Date();
        targetTime.setMinutes(targetTime.getMinutes() - minutesAgo);
        
        // Find closest snapshot to target time
        let closest = history[0];
        let minDiff = Math.abs(history[0].timestamp.getTime() - targetTime.getTime());
        
        for (const snapshot of history) {
            const diff = Math.abs(snapshot.timestamp.getTime() - targetTime.getTime());
            if (diff < minDiff) {
                minDiff = diff;
                closest = snapshot;
            }
        }
        
        // Only return if within 30 minutes of target
        if (minDiff < 30 * 60 * 1000) {
            return closest.price;
        }
        return 0;
    }

    private getDefaultRanges(currentPrice: number): RangeSuggestion[] {
        // Default ranges when no volatility data is available
        // Based on typical crypto volatility (~3-5% daily)
        const defaultDailyVol = 0.04; // 4%

        return [
            {
                strategy: 'conservative',
                ...this.calculateRange(currentPrice, defaultDailyVol, 2, 7),
                sigmaMultiple: 2,
                estimatedTimeInRange: '~95% do tempo (estimado)',
                description: 'Faixa baseada em volatilidade típica (dados insuficientes)'
            },
            {
                strategy: 'moderate',
                ...this.calculateRange(currentPrice, defaultDailyVol, 1.5, 7),
                sigmaMultiple: 1.5,
                estimatedTimeInRange: '~87% do tempo (estimado)',
                description: 'Faixa baseada em volatilidade típica (dados insuficientes)'
            },
            {
                strategy: 'aggressive',
                ...this.calculateRange(currentPrice, defaultDailyVol, 1, 7),
                sigmaMultiple: 1,
                estimatedTimeInRange: '~68% do tempo (estimado)',
                description: 'Faixa baseada em volatilidade típica (dados insuficientes)'
            }
        ];
    }
}

export const volatilityService = new VolatilityService();
