// raydiumService.ts
// Service for Raydium protocol operations (CLMM, CPMM) on Solana DEVNET

import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import { SOLANA_RPC_DEVNET } from '../constants';
import {
    LiquidityPool,
    LiquidityPosition,
    PoolQueryFilters,
    AddLiquidityParams,
    RemoveLiquidityParams,
    SwapParams,
    LPOperationResult,
    SwapQuote,
    TimeFrame
} from '../types/solanaLiquidityTypes';

// ============================================
// RAYDIUM SERVICE CLASS
// ============================================

class RaydiumService {
    private connection: Connection;
    private apiBaseUrl: string;

    constructor() {
        this.connection = new Connection(SOLANA_RPC_DEVNET, 'confirmed');
        // Use proxy in dev mode to avoid CORS, mainnet API for data
        this.apiBaseUrl = import.meta.env.DEV ? '/raydium-api' : 'https://api-v3.raydium.io';
    }

    // ============================================
    // POOL DISCOVERY & ANALYTICS
    // ============================================

    /**
     * Get pool list from Raydium API
     */
    async getPoolList(poolType?: 'clmm' | 'cpmm' | 'all'): Promise<LiquidityPool[]> {
        try {
            // Use the correct Raydium v3 API endpoint
            const type = poolType === 'clmm' ? 'Concentrated' : poolType === 'cpmm' ? 'Standard' : 'all';
            const response = await fetch(
                `${this.apiBaseUrl}/pools/info/list?poolType=${type}&poolSortField=default&sortType=desc&pageSize=50&page=1`
            );
            if (!response.ok) {
                throw new Error(`Raydium API error: ${response.status}`);
            }

            const json = await response.json();
            const pools = json.data?.data || json.data || [];

            return pools.map((pool: any) => this.mapApiPoolToLiquidityPool(pool, poolType));
        } catch (error) {
            console.error('[RaydiumService] Error fetching pools:', error);
            return [];
        }
    }

    /**
     * Get pool by ID
     */
    async getPoolById(poolId: string): Promise<LiquidityPool | null> {
        try {
            const response = await fetch(`${this.apiBaseUrl}/pools/info/ids?ids=${poolId}`);
            if (!response.ok) {
                if (response.status === 404) return null;
                throw new Error(`Raydium API error: ${response.status}`);
            }

            const data = await response.json();
            const pools = data.data || data || [];
            if (pools.length === 0) return null;

            return this.mapApiPoolToLiquidityPool(pools[0]);
        } catch (error) {
            console.error('[RaydiumService] Error fetching pool:', error);
            return null;
        }
    }

    /**
     * Fetch pools by token mints
     */
    async fetchPoolByMints(mintA: string, mintB: string): Promise<LiquidityPool[]> {
        try {
            const response = await fetch(
                `${this.apiBaseUrl}/pools/info/mint?mint1=${mintA}&mint2=${mintB}`
            );

            if (!response.ok) {
                throw new Error(`Raydium API error: ${response.status}`);
            }

            const data = await response.json();
            const pools = data.data || data || [];

            return pools.map((pool: any) => this.mapApiPoolToLiquidityPool(pool));
        } catch (error) {
            console.error('[RaydiumService] Error fetching pools by mints:', error);
            return [];
        }
    }

    /**
     * Query pools with advanced filters
     */
    async queryPools(filters: PoolQueryFilters): Promise<LiquidityPool[]> {
        try {
            let pools = await this.getPoolList('all');

            // Filter by protocol type
            if (filters.protocol && filters.protocol.length > 0) {
                pools = pools.filter(p => filters.protocol!.includes(p.protocol));
            }

            // Filter by token mint
            if (filters.tokenMint) {
                const mint = filters.tokenMint.toLowerCase();
                pools = pools.filter(p =>
                    p.tokenA.mint.toLowerCase() === mint ||
                    p.tokenB.mint.toLowerCase() === mint
                );
            }

            // Filter by token pair
            if (filters.tokenPair) {
                const { tokenA, tokenB } = filters.tokenPair;
                pools = pools.filter(p =>
                    (p.tokenA.symbol.toUpperCase() === tokenA.toUpperCase() &&
                     p.tokenB.symbol.toUpperCase() === tokenB.toUpperCase()) ||
                    (p.tokenA.symbol.toUpperCase() === tokenB.toUpperCase() &&
                     p.tokenB.symbol.toUpperCase() === tokenA.toUpperCase())
                );
            }

            // Filter by TVL
            if (filters.minTVL !== undefined) {
                pools = pools.filter(p => p.tvl >= filters.minTVL!);
            }

            if (filters.maxTVL !== undefined) {
                pools = pools.filter(p => p.tvl <= filters.maxTVL!);
            }

            // Filter by volume
            if (filters.minVolume !== undefined) {
                const timeframe = filters.volumeTimeframe || '24h';
                pools = pools.filter(p => {
                    const vol = p.volume[timeframe] || p.volume['24h'] || 0;
                    return vol >= filters.minVolume!;
                });
            }

            // Filter by APY
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
            console.error('[RaydiumService] Error querying pools:', error);
            return [];
        }
    }

    /**
     * Get pool volume for timeframe
     */
    async getPoolVolume(poolId: string, timeframe: TimeFrame): Promise<number> {
        const pool = await this.getPoolById(poolId);
        if (!pool) return 0;
        return pool.volume[timeframe] || pool.volume['24h'] || 0;
    }

    /**
     * Get pool APY
     */
    async getPoolAPY(poolId: string): Promise<number> {
        const pool = await this.getPoolById(poolId);
        return pool?.apy || 0;
    }

    // ============================================
    // POSITION MANAGEMENT
    // ============================================

    /**
     * Get CLMM positions for a wallet
     */
    async getPositions(walletAddress: string): Promise<LiquidityPosition[]> {
        try {
            const response = await fetch(
                `${this.apiBaseUrl}/clmm/position/byOwner?owner=${walletAddress}`
            );

            if (!response.ok) {
                if (response.status === 404) return [];
                throw new Error(`Raydium API error: ${response.status}`);
            }

            const data = await response.json();
            const positions = data.data || data || [];

            return positions.map((pos: any) => this.mapApiPositionToLiquidityPosition(pos));
        } catch (error) {
            console.error('[RaydiumService] Error fetching positions:', error);
            return [];
        }
    }

    /**
     * Get position details by NFT mint
     */
    async getPositionByNft(nftMint: string): Promise<LiquidityPosition | null> {
        try {
            const response = await fetch(
                `${this.apiBaseUrl}/clmm/position/byNft?nft=${nftMint}`
            );

            if (!response.ok) {
                if (response.status === 404) return null;
                throw new Error(`Raydium API error: ${response.status}`);
            }

            const data = await response.json();
            return this.mapApiPositionToLiquidityPosition(data.data || data);
        } catch (error) {
            console.error('[RaydiumService] Error fetching position:', error);
            return null;
        }
    }

    // ============================================
    // SWAP OPERATIONS
    // ============================================

    /**
     * Get swap quote
     */
    async getSwapQuote(params: SwapParams): Promise<SwapQuote | null> {
        try {
            const response = await fetch(
                `${this.apiBaseUrl}/compute/swap-base-in?inputMint=${params.inputMint}&outputMint=${params.outputMint}&amount=${params.amount}&slippageBps=${params.slippageBps || 50}`
            );

            if (!response.ok) {
                throw new Error(`Raydium API error: ${response.status}`);
            }

            const data = await response.json();
            
            return {
                inputMint: params.inputMint,
                outputMint: params.outputMint,
                inputAmount: params.amount,
                outputAmount: data.data?.outputAmount || data.outputAmount || 0,
                priceImpact: data.data?.priceImpact || data.priceImpact || 0,
                fee: data.data?.fee || data.fee || 0,
                route: data.data?.routePlan || data.route || []
            };
        } catch (error) {
            console.error('[RaydiumService] Error getting swap quote:', error);
            return null;
        }
    }

    /**
     * Execute swap using Raydium SDK
     */
    async swap(wallet: Keypair, params: SwapParams): Promise<LPOperationResult> {
        try {
            console.log('[RaydiumService] Executing swap:', params);

            const Raydium = await this.loadRaydiumSDK();
            if (!Raydium) {
                return {
                    success: false,
                    error: 'Raydium SDK not available. Run: npm install @raydium-io/raydium-sdk-v2'
                };
            }

            // Initialize Raydium SDK
            const raydium = await Raydium.load({
                connection: this.connection,
                owner: wallet,
                cluster: 'devnet'
            });

            // Get swap quote first
            const quote = await this.getSwapQuote(params);
            if (!quote) {
                return { success: false, error: 'Could not get swap quote' };
            }

            // Execute swap
            const { txId } = await raydium.trade.swap({
                inputMint: new PublicKey(params.inputMint),
                outputMint: new PublicKey(params.outputMint),
                amount: params.amount,
                slippage: (params.slippageBps || 50) / 10000
            });

            await this.connection.confirmTransaction(txId, 'confirmed');

            return {
                success: true,
                txSignature: txId,
                details: {
                    inputAmount: params.amount,
                    outputAmount: quote.outputAmount,
                    priceImpact: quote.priceImpact
                }
            };
        } catch (error: any) {
            console.error('[RaydiumService] Error executing swap:', error);
            return {
                success: false,
                error: error.message || 'Failed to execute swap'
            };
        }
    }

    // ============================================
    // LIQUIDITY OPERATIONS
    // ============================================

    /**
     * Add liquidity to CLMM pool
     */
    async addLiquidityCLMM(
        wallet: Keypair,
        params: AddLiquidityParams
    ): Promise<LPOperationResult> {
        try {
            console.log('[RaydiumService] Adding CLMM liquidity:', params);

            const Raydium = await this.loadRaydiumSDK();
            if (!Raydium) {
                return {
                    success: false,
                    error: 'Raydium SDK not available. Run: npm install @raydium-io/raydium-sdk-v2'
                };
            }

            // Initialize Raydium SDK
            const raydium = await Raydium.load({
                connection: this.connection,
                owner: wallet,
                cluster: 'devnet'
            });

            // Get pool info
            const pool = await this.getPoolById(params.poolAddress);
            if (!pool) {
                return { success: false, error: 'Pool not found' };
            }

            // Calculate ticks from price range
            let tickLower, tickUpper;
            if (params.priceMin && params.priceMax) {
                tickLower = this.priceToTick(params.priceMin, pool.tokenA.decimals, pool.tokenB.decimals);
                tickUpper = this.priceToTick(params.priceMax, pool.tokenA.decimals, pool.tokenB.decimals);
            } else {
                // Default range around current price
                const currentTick = this.priceToTick(pool.currentPrice || 1, pool.tokenA.decimals, pool.tokenB.decimals);
                tickLower = currentTick - 1000;
                tickUpper = currentTick + 1000;
            }

            // Open position
            const { txId, nftMint } = await raydium.clmm.openPositionFromBase({
                poolId: params.poolAddress,
                ownerInfo: { useSOLBalance: true },
                tickLower,
                tickUpper,
                base: 'MintA',
                baseAmount: BigInt(Math.floor(params.amountA * Math.pow(10, pool.tokenA.decimals))),
                otherAmountMax: BigInt(Math.floor(params.amountB * Math.pow(10, pool.tokenB.decimals)))
            });

            await this.connection.confirmTransaction(txId, 'confirmed');

            return {
                success: true,
                txSignature: txId,
                positionAddress: nftMint?.toString(),
                tokensDeposited: {
                    tokenA: params.amountA,
                    tokenB: params.amountB
                }
            };
        } catch (error: any) {
            console.error('[RaydiumService] Error adding liquidity:', error);
            return {
                success: false,
                error: error.message || 'Failed to add liquidity'
            };
        }
    }

    /**
     * Add liquidity to CPMM pool
     */
    async addLiquidityCPMM(
        wallet: Keypair,
        params: AddLiquidityParams
    ): Promise<LPOperationResult> {
        try {
            console.log('[RaydiumService] Adding CPMM liquidity:', params);

            const Raydium = await this.loadRaydiumSDK();
            if (!Raydium) {
                return {
                    success: false,
                    error: 'Raydium SDK not available. Run: npm install @raydium-io/raydium-sdk-v2'
                };
            }

            // Initialize Raydium SDK
            const raydium = await Raydium.load({
                connection: this.connection,
                owner: wallet,
                cluster: 'devnet'
            });

            // Get pool info
            const pool = await this.getPoolById(params.poolAddress);
            if (!pool) {
                return { success: false, error: 'Pool not found' };
            }

            // Add to CPMM pool
            const { txId } = await raydium.cpmm.addLiquidity({
                poolId: params.poolAddress,
                inputAmount: BigInt(Math.floor(params.amountA * Math.pow(10, pool.tokenA.decimals))),
                slippage: (params.slippageBps || 50) / 10000
            });

            await this.connection.confirmTransaction(txId, 'confirmed');

            return {
                success: true,
                txSignature: txId,
                tokensDeposited: {
                    tokenA: params.amountA,
                    tokenB: params.amountB
                }
            };
        } catch (error: any) {
            console.error('[RaydiumService] Error adding liquidity:', error);
            return {
                success: false,
                error: error.message || 'Failed to add liquidity'
            };
        }
    }

    /**
     * Remove liquidity from position
     */
    async removeLiquidity(
        wallet: Keypair,
        params: RemoveLiquidityParams
    ): Promise<LPOperationResult> {
        try {
            console.log('[RaydiumService] Removing liquidity:', params);

            const Raydium = await this.loadRaydiumSDK();
            if (!Raydium) {
                return {
                    success: false,
                    error: 'Raydium SDK not available. Run: npm install @raydium-io/raydium-sdk-v2'
                };
            }

            // Initialize Raydium SDK
            const raydium = await Raydium.load({
                connection: this.connection,
                owner: wallet,
                cluster: 'devnet'
            });

            // Get position info
            const position = await this.getPositionByNft(params.positionAddress);
            if (!position) {
                return { success: false, error: 'Position not found' };
            }

            // Close position (or partial close)
            const closeCompletely = params.percentage >= 100;

            const { txId } = await raydium.clmm.decreaseLiquidity({
                poolId: position.poolAddress,
                ownerPosition: new PublicKey(params.positionAddress),
                liquidity: closeCompletely ? 'all' : `${params.percentage}%`,
                amountMinA: '0',
                amountMinB: '0'
            });

            await this.connection.confirmTransaction(txId, 'confirmed');

            return {
                success: true,
                txSignature: txId,
                tokensReceived: {
                    tokenA: position.tokenAAmount * (params.percentage / 100),
                    tokenB: position.tokenBAmount * (params.percentage / 100)
                }
            };
        } catch (error: any) {
            console.error('[RaydiumService] Error removing liquidity:', error);
            return {
                success: false,
                error: error.message || 'Failed to remove liquidity'
            };
        }
    }

    /**
     * Load Raydium SDK dynamically (optional dependency)
     * Uses variable-based import to prevent static analysis
     */
    private async loadRaydiumSDK(): Promise<any> {
        try {
            // Use variable to prevent Vite from statically analyzing the import
            const moduleName = '@raydium-io/raydium-sdk-v2';
            const sdkModule = await import(/* @vite-ignore */ moduleName);
            return sdkModule.Raydium || sdkModule.default;
        } catch (error) {
            console.warn('[RaydiumService] Raydium SDK not available - operations will return gracefully');
            return null;
        }
    }

    // ============================================
    // HELPER METHODS
    // ============================================

    /**
     * Convert price to tick (for CLMM)
     */
    priceToTick(price: number, decimalsA: number, decimalsB: number): number {
        const adjustedPrice = price * Math.pow(10, decimalsB - decimalsA);
        return Math.floor(Math.log(adjustedPrice) / Math.log(1.0001));
    }

    /**
     * Convert tick to price (for CLMM)
     */
    tickToPrice(tick: number, decimalsA: number, decimalsB: number): number {
        const rawPrice = Math.pow(1.0001, tick);
        return rawPrice * Math.pow(10, decimalsA - decimalsB);
    }

    private mapApiPoolToLiquidityPool(pool: any, type?: string): LiquidityPool {
        // Raydium API returns 'Concentrated' or 'Standard' for pool types
        const poolType = pool.type || type;
        const protocol = (poolType === 'Concentrated' || poolType === 'clmm')
            ? 'raydium_clmm' 
            : 'raydium_cpmm';

        // Extract volume from day object or direct field
        const volume24h = pool.day?.volume || pool.volume24h || 0;
        const volume7d = pool.week?.volume || pool.volume7d || 0;

        return {
            address: pool.id || pool.poolId || pool.address,
            protocol: protocol,
            name: pool.poolName || `${pool.mintA?.symbol || 'Token'}-${pool.mintB?.symbol || 'Token'}`,
            tokenA: {
                mint: pool.mintA?.address || pool.baseMint || '',
                symbol: pool.mintA?.symbol || pool.baseSymbol || 'Unknown',
                decimals: pool.mintA?.decimals || pool.baseDecimals || 9
            },
            tokenB: {
                mint: pool.mintB?.address || pool.quoteMint || '',
                symbol: pool.mintB?.symbol || pool.quoteSymbol || 'Unknown',
                decimals: pool.mintB?.decimals || pool.quoteDecimals || 9
            },
            tvl: pool.tvl || pool.liquidity || 0,
            feeBps: pool.feeRate ? pool.feeRate * 10000 : pool.feeBps || 0,
            apy: pool.day?.apr || pool.apy || 0,
            volume: {
                '24h': volume24h,
                '7d': volume7d
            },
            tickSpacing: pool.tickSpacing,
            currentPrice: pool.price
        };
    }

    private mapApiPositionToLiquidityPosition(pos: any): LiquidityPosition {
        return {
            positionAddress: pos.nftMint || pos.positionId || pos.address,
            poolAddress: pos.poolId || pos.pool,
            protocol: 'raydium_clmm',
            tokenAAmount: pos.amountA || pos.tokenA || 0,
            tokenBAmount: pos.amountB || pos.tokenB || 0,
            valueUSD: pos.positionUsd || pos.valueUsd || 0,
            unclaimedFees: {
                tokenA: pos.tokenFeeAmountA || 0,
                tokenB: pos.tokenFeeAmountB || 0,
                totalUSD: pos.unclaimedFeeUsd || 0
            },
            priceRange: {
                min: pos.priceLower || 0,
                max: pos.priceUpper || 0,
                current: pos.currentPrice || 0,
                inRange: pos.inRange ?? true
            },
            tickLower: pos.tickLower,
            tickUpper: pos.tickUpper,
            nftMint: pos.nftMint
        };
    }
}

export const raydiumService = new RaydiumService();
