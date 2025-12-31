// meteoraService.ts
// Service for Meteora protocol operations (DLMM, DAMM) on Solana DEVNET

import { Connection, Keypair, PublicKey, Transaction } from '@solana/web3.js';
import { SOLANA_RPC_DEVNET, METEORA_API, METEORA_DLMM_PROGRAM } from '../constants';
import {
    LiquidityPool,
    LiquidityPosition,
    PoolQueryFilters,
    AddLiquidityParams,
    RemoveLiquidityParams,
    LPOperationResult,
    PoolAnalytics,
    TimeFrame,
    PoolToken
} from '../types/solanaLiquidityTypes';

// ============================================
// METEORA SERVICE CLASS
// ============================================

class MeteoraService {
    private connection: Connection;
    private apiBaseUrl: string;

    constructor() {
        this.connection = new Connection(SOLANA_RPC_DEVNET, 'confirmed');
        // Use proxy in dev mode to avoid CORS, mainnet API for data
        this.apiBaseUrl = import.meta.env.DEV ? '/meteora-api' : METEORA_API;
    }

    // ============================================
    // POOL DISCOVERY & ANALYTICS
    // ============================================

    /**
     * Fetch all DLMM pools from Meteora API
     */
    async getAllPools(limit: number = 100): Promise<LiquidityPool[]> {
        try {
            const response = await fetch(`${this.apiBaseUrl}/pair/all`);
            if (!response.ok) {
                throw new Error(`Meteora API error: ${response.status}`);
            }

            const data = await response.json();
            const rawPools = Array.isArray(data) ? data : data.pairs || [];

            // Pre-sort by liquidity (descending) to get pools with actual data
            // API returns liquidity as string, so parse it
            rawPools.sort((a: any, b: any) => {
                const liqA = parseFloat(a.liquidity) || 0;
                const liqB = parseFloat(b.liquidity) || 0;
                return liqB - liqA;
            });

            return rawPools.slice(0, limit).map((pool: any) => this.mapApiPoolToLiquidityPool(pool));
        } catch (error) {
            console.error('[MeteoraService] Error fetching pools:', error);
            return [];
        }
    }

    /**
     * Get pool details by address
     */
    async getPool(address: string): Promise<LiquidityPool | null> {
        try {
            const response = await fetch(`${this.apiBaseUrl}/pair/${address}`);
            if (!response.ok) {
                if (response.status === 404) return null;
                throw new Error(`Meteora API error: ${response.status}`);
            }

            const pool = await response.json();
            return this.mapApiPoolToLiquidityPool(pool);
        } catch (error) {
            console.error('[MeteoraService] Error fetching pool:', error);
            return null;
        }
    }

    /**
     * Query pools with advanced filters
     */
    async queryPools(filters: PoolQueryFilters): Promise<LiquidityPool[]> {
        try {
            let pools = await this.getAllPools(500);

            // Apply filters
            if (filters.tokenMint) {
                const mint = filters.tokenMint.toLowerCase();
                pools = pools.filter(p =>
                    p.tokenA.mint.toLowerCase() === mint ||
                    p.tokenB.mint.toLowerCase() === mint
                );
            }

            if (filters.tokenPair) {
                const { tokenA, tokenB } = filters.tokenPair;
                pools = pools.filter(p =>
                    (p.tokenA.symbol.toUpperCase() === tokenA.toUpperCase() &&
                     p.tokenB.symbol.toUpperCase() === tokenB.toUpperCase()) ||
                    (p.tokenA.symbol.toUpperCase() === tokenB.toUpperCase() &&
                     p.tokenB.symbol.toUpperCase() === tokenA.toUpperCase())
                );
            }

            if (filters.minTVL !== undefined) {
                pools = pools.filter(p => p.tvl >= filters.minTVL!);
            }

            if (filters.maxTVL !== undefined) {
                pools = pools.filter(p => p.tvl <= filters.maxTVL!);
            }

            if (filters.minVolume !== undefined) {
                const timeframe = filters.volumeTimeframe || '24h';
                pools = pools.filter(p => {
                    const vol = p.volume[timeframe] || p.volume['24h'] || 0;
                    return vol >= filters.minVolume!;
                });
            }

            if (filters.minAPY !== undefined) {
                pools = pools.filter(p => (p.apy || 0) >= filters.minAPY!);
            }

            // Sort
            if (filters.sortBy) {
                const order = filters.sortOrder === 'asc' ? 1 : -1;
                pools.sort((a, b) => {
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
                        case 'fee':
                            valA = a.feeBps;
                            valB = b.feeBps;
                            break;
                        default:
                            valA = 0;
                            valB = 0;
                    }
                    return (valB - valA) * order;
                });
            }

            // Apply limit
            if (filters.limit) {
                pools = pools.slice(0, filters.limit);
            }

            return pools;
        } catch (error) {
            console.error('[MeteoraService] Error querying pools:', error);
            return [];
        }
    }

    /**
     * Get pool volume for a specific timeframe
     */
    async getPoolVolume(address: string, timeframe: TimeFrame): Promise<number> {
        try {
            const days = this.timeframeToDays(timeframe);
            const response = await fetch(
                `${this.apiBaseUrl}/pair/${address}/analytic/pair_trade_volume?days=${days}`
            );

            if (!response.ok) return 0;

            const data = await response.json();
            if (Array.isArray(data) && data.length > 0) {
                // Sum volume for the period
                return data.reduce((sum: number, d: any) => sum + (d.volume || 0), 0);
            }
            return 0;
        } catch (error) {
            console.error('[MeteoraService] Error fetching pool volume:', error);
            return 0;
        }
    }

    /**
     * Get pool APY
     */
    async getPoolAPY(address: string): Promise<number> {
        const pool = await this.getPool(address);
        return pool?.apy || 0;
    }

    /**
     * Get pool TVL history
     */
    async getPoolTVLHistory(address: string, days: number = 7): Promise<{ timestamp: number; value: number }[]> {
        try {
            const response = await fetch(
                `${this.apiBaseUrl}/pair/${address}/analytic/pair_tvl?days=${days}`
            );

            if (!response.ok) return [];

            const data = await response.json();
            if (Array.isArray(data)) {
                return data.map((d: any) => ({
                    timestamp: new Date(d.date || d.timestamp).getTime(),
                    value: d.tvl || d.value || 0
                }));
            }
            return [];
        } catch (error) {
            console.error('[MeteoraService] Error fetching TVL history:', error);
            return [];
        }
    }

    // ============================================
    // POSITION MANAGEMENT
    // ============================================

    /**
     * Get all positions for a wallet
     */
    async getPositions(walletAddress: string): Promise<LiquidityPosition[]> {
        try {
            const response = await fetch(
                `${this.apiBaseUrl}/wallet/${walletAddress}/positions`
            );

            if (!response.ok) {
                if (response.status === 404) return [];
                throw new Error(`Meteora API error: ${response.status}`);
            }

            const data = await response.json();
            const positions = Array.isArray(data) ? data : data.positions || [];

            return positions.map((pos: any) => this.mapApiPositionToLiquidityPosition(pos));
        } catch (error) {
            console.error('[MeteoraService] Error fetching positions:', error);
            return [];
        }
    }

    /**
     * Get specific position details
     */
    async getPosition(positionAddress: string): Promise<LiquidityPosition | null> {
        try {
            const response = await fetch(
                `${this.apiBaseUrl}/position/${positionAddress}`
            );

            if (!response.ok) {
                if (response.status === 404) return null;
                throw new Error(`Meteora API error: ${response.status}`);
            }

            const position = await response.json();
            return this.mapApiPositionToLiquidityPosition(position);
        } catch (error) {
            console.error('[MeteoraService] Error fetching position:', error);
            return null;
        }
    }

    /**
     * Get unclaimed fees for a position
     */
    async getUnclaimedFees(positionAddress: string): Promise<{ tokenA: number; tokenB: number; totalUSD: number }> {
        try {
            const response = await fetch(
                `${this.apiBaseUrl}/position/${positionAddress}/claim_fees`
            );

            if (!response.ok) {
                return { tokenA: 0, tokenB: 0, totalUSD: 0 };
            }

            const data = await response.json();
            return {
                tokenA: data.feeX || data.tokenA || 0,
                tokenB: data.feeY || data.tokenB || 0,
                totalUSD: data.totalUSD || 0
            };
        } catch (error) {
            console.error('[MeteoraService] Error fetching unclaimed fees:', error);
            return { tokenA: 0, tokenB: 0, totalUSD: 0 };
        }
    }

    // ============================================
    // LIQUIDITY OPERATIONS
    // ============================================

    /**
     * Add liquidity to a DLMM pool
     * Uses @meteora-ag/dlmm SDK
     */
    async addLiquidity(
        wallet: Keypair,
        params: AddLiquidityParams
    ): Promise<LPOperationResult> {
        try {
            console.log('[MeteoraService] Adding liquidity:', params);

            // Dynamic import to handle module loading
            const DLMM = await this.loadDLMMSDK();
            if (!DLMM) {
                return {
                    success: false,
                    error: 'Meteora DLMM SDK not available. Run: npm install @meteora-ag/dlmm'
                };
            }

            // Create DLMM instance
            const dlmm = await DLMM.create(
                this.connection,
                new PublicKey(params.poolAddress)
            );

            // Get pool information
            const activeBin = await dlmm.getActiveBin();
            const binStep = dlmm.lbPair.binStep;

            // Calculate bin range from price range
            let minBin, maxBin;
            if (params.priceMin && params.priceMax) {
                minBin = dlmm.getBinIdFromPrice(params.priceMin, true);
                maxBin = dlmm.getBinIdFromPrice(params.priceMax, false);
            } else {
                // Default: use 10 bins around active bin
                minBin = activeBin.binId - 5;
                maxBin = activeBin.binId + 5;
            }

            // Build add liquidity transaction
            const addLiqTx = await dlmm.addLiquidityByStrategy({
                positionPubKey: wallet.publicKey,
                user: wallet.publicKey,
                totalXAmount: BigInt(params.amountA * Math.pow(10, 9)),
                totalYAmount: BigInt(params.amountB * Math.pow(10, 9)),
                strategy: {
                    minBinId: minBin,
                    maxBinId: maxBin,
                    strategyType: 'Spot' // Uniform distribution
                },
                slippage: params.slippageBps ? params.slippageBps / 10000 : 0.005
            });

            // Sign and send transaction
            const txHash = await this.connection.sendTransaction(
                addLiqTx,
                [wallet],
                { skipPreflight: false }
            );

            // Wait for confirmation
            await this.connection.confirmTransaction(txHash, 'confirmed');

            return {
                success: true,
                txSignature: txHash,
                positionAddress: wallet.publicKey.toString(),
                tokensDeposited: {
                    tokenA: params.amountA,
                    tokenB: params.amountB
                }
            };
        } catch (error: any) {
            console.error('[MeteoraService] Error adding liquidity:', error);
            return {
                success: false,
                error: error.message || 'Failed to add liquidity'
            };
        }
    }

    /**
     * Remove liquidity from a position
     */
    async removeLiquidity(
        wallet: Keypair,
        params: RemoveLiquidityParams
    ): Promise<LPOperationResult> {
        try {
            console.log('[MeteoraService] Removing liquidity:', params);

            const DLMM = await this.loadDLMMSDK();
            if (!DLMM) {
                return {
                    success: false,
                    error: 'Meteora DLMM SDK not available. Run: npm install @meteora-ag/dlmm'
                };
            }

            // Get position info to find the pool
            const position = await this.getPosition(params.positionAddress);
            if (!position) {
                return { success: false, error: 'Position not found' };
            }

            // Create DLMM instance
            const dlmm = await DLMM.create(
                this.connection,
                new PublicKey(position.poolAddress)
            );

            // Build remove liquidity transaction
            const bpsToRemove = Math.floor((params.percentage / 100) * 10000);
            
            const removeLiqTx = await dlmm.removeLiquidity({
                user: wallet.publicKey,
                position: new PublicKey(params.positionAddress),
                binLiquidityRemoval: bpsToRemove,
                shouldClaimAndClose: params.percentage >= 100
            });

            // Sign and send
            const txHash = await this.connection.sendTransaction(
                removeLiqTx,
                [wallet],
                { skipPreflight: false }
            );

            await this.connection.confirmTransaction(txHash, 'confirmed');

            return {
                success: true,
                txSignature: txHash,
                tokensReceived: {
                    tokenA: position.tokenAAmount * (params.percentage / 100),
                    tokenB: position.tokenBAmount * (params.percentage / 100)
                }
            };
        } catch (error: any) {
            console.error('[MeteoraService] Error removing liquidity:', error);
            return {
                success: false,
                error: error.message || 'Failed to remove liquidity'
            };
        }
    }

    /**
     * Claim fees from a position
     */
    async claimFees(
        wallet: Keypair,
        positionAddress: string
    ): Promise<LPOperationResult> {
        try {
            console.log('[MeteoraService] Claiming fees:', positionAddress);

            const DLMM = await this.loadDLMMSDK();
            if (!DLMM) {
                return {
                    success: false,
                    error: 'Meteora DLMM SDK not available. Run: npm install @meteora-ag/dlmm'
                };
            }

            // Get position info
            const position = await this.getPosition(positionAddress);
            if (!position) {
                return { success: false, error: 'Position not found' };
            }

            // Create DLMM instance
            const dlmm = await DLMM.create(
                this.connection,
                new PublicKey(position.poolAddress)
            );

            // Build claim fees transaction
            const claimTx = await dlmm.claimSwapFee({
                owner: wallet.publicKey,
                position: new PublicKey(positionAddress)
            });

            // Sign and send
            const txHash = await this.connection.sendTransaction(
                claimTx,
                [wallet],
                { skipPreflight: false }
            );

            await this.connection.confirmTransaction(txHash, 'confirmed');

            return {
                success: true,
                txSignature: txHash,
                feesClaimed: {
                    tokenA: position.unclaimedFees.tokenA,
                    tokenB: position.unclaimedFees.tokenB,
                    totalUSD: position.unclaimedFees.totalUSD
                }
            };
        } catch (error: any) {
            console.error('[MeteoraService] Error claiming fees:', error);
            return {
                success: false,
                error: error.message || 'Failed to claim fees'
            };
        }
    }

    /**
     * Claim rewards from a position
     */
    async claimRewards(
        wallet: Keypair,
        positionAddress: string
    ): Promise<LPOperationResult> {
        try {
            console.log('[MeteoraService] Claiming rewards:', positionAddress);

            const DLMM = await this.loadDLMMSDK();
            if (!DLMM) {
                return {
                    success: false,
                    error: 'Meteora DLMM SDK not available. Run: npm install @meteora-ag/dlmm'
                };
            }

            // Get position info
            const position = await this.getPosition(positionAddress);
            if (!position) {
                return { success: false, error: 'Position not found' };
            }

            // Create DLMM instance
            const dlmm = await DLMM.create(
                this.connection,
                new PublicKey(position.poolAddress)
            );

            // Build claim rewards transaction
            const claimTx = await dlmm.claimLMReward({
                owner: wallet.publicKey,
                position: new PublicKey(positionAddress)
            });

            // Sign and send
            const txHash = await this.connection.sendTransaction(
                claimTx,
                [wallet],
                { skipPreflight: false }
            );

            await this.connection.confirmTransaction(txHash, 'confirmed');

            return {
                success: true,
                txSignature: txHash
            };
        } catch (error: any) {
            console.error('[MeteoraService] Error claiming rewards:', error);
            return {
                success: false,
                error: error.message || 'Failed to claim rewards'
            };
        }
    }

    /**
     * Load DLMM SDK dynamically (optional dependency)
     * Uses variable-based import to prevent static analysis
     */
    private async loadDLMMSDK(): Promise<any> {
        try {
            // Use variable to prevent Vite from statically analyzing the import
            const moduleName = '@meteora-ag/dlmm';
            const dlmmModule = await import(/* @vite-ignore */ moduleName);
            return dlmmModule.DLMM || dlmmModule.default;
        } catch (error) {
            console.warn('[MeteoraService] DLMM SDK not available - operations will return gracefully');
            return null;
        }
    }

    // ============================================
    // HELPER METHODS
    // ============================================

    private mapApiPoolToLiquidityPool(pool: any): LiquidityPool {
        // Parse liquidity/tvl - API returns it as a string
        const tvl = parseFloat(pool.liquidity) || pool.tvl || 0;
        const volume24h = pool.trade_volume_24h || pool.volume24h || pool.volume || 0;
        const volume7d = pool.trade_volume_7d || pool.volume7d || 0;

        // Debug first few pools
        if (tvl > 10000) {
            console.log('[MeteoraService] Pool with TVL:', pool.name, 'TVL:', tvl, 'Vol24h:', volume24h);
        }

        return {
            address: pool.address || pool.pair_address || pool.pubkey,
            protocol: 'meteora_dlmm',
            name: pool.name || `${pool.mint_x_symbol || 'Token'}-${pool.mint_y_symbol || 'Token'}`,
            tokenA: {
                mint: pool.mint_x || pool.tokenAMint || '',
                symbol: pool.mint_x_symbol || pool.tokenASymbol || 'Unknown',
                decimals: pool.mint_x_decimals || pool.tokenADecimals || 9
            },
            tokenB: {
                mint: pool.mint_y || pool.tokenBMint || '',
                symbol: pool.mint_y_symbol || pool.tokenBSymbol || 'Unknown',
                decimals: pool.mint_y_decimals || pool.tokenBDecimals || 9
            },
            tvl: tvl,
            feeBps: pool.base_fee_bps || pool.fee_bps || pool.feeBps || 0,
            apy: pool.apy || pool.apr || 0,
            volume: {
                '24h': volume24h,
                '7d': volume7d
            },
            binStep: pool.bin_step || pool.binStep,
            currentPrice: pool.current_price || pool.price
        };
    }

    private mapApiPositionToLiquidityPosition(pos: any): LiquidityPosition {
        return {
            positionAddress: pos.address || pos.position_address || pos.pubkey,
            poolAddress: pos.pair_address || pos.pool_address || pos.pool,
            protocol: 'meteora_dlmm',
            tokenAAmount: pos.token_x_amount || pos.tokenA || 0,
            tokenBAmount: pos.token_y_amount || pos.tokenB || 0,
            valueUSD: pos.value_usd || pos.totalValue || 0,
            unclaimedFees: {
                tokenA: pos.unclaimed_fee_x || 0,
                tokenB: pos.unclaimed_fee_y || 0,
                totalUSD: pos.unclaimed_fee_usd || 0
            },
            priceRange: pos.lower_bin_id && pos.upper_bin_id ? {
                min: pos.lower_bin_price || 0,
                max: pos.upper_bin_price || 0,
                current: pos.current_price || 0,
                inRange: pos.in_range ?? true
            } : undefined,
            binIds: pos.bin_ids || []
        };
    }

    private timeframeToDays(timeframe: TimeFrame): number {
        switch (timeframe) {
            case '5m': return 1;
            case '15m': return 1;
            case '1h': return 1;
            case '4h': return 1;
            case '24h': return 1;
            case '7d': return 7;
            default: return 1;
        }
    }
}

export const meteoraService = new MeteoraService();
