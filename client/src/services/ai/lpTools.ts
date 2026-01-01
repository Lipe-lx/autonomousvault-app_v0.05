// lpTools.ts
// AI Function Declarations for Liquidity Pool Operations

import { FunctionDeclaration, Type } from '@google/genai';

/**
 * Get all LP-related function declarations for AI tools
 */
export function getLPToolDeclarations(): FunctionDeclaration[] {
    // ============================================
    // ANALYTICS & DISCOVERY
    // ============================================

    const searchPoolsTool: FunctionDeclaration = {
        name: 'searchLiquidityPools',
        description: `Search and filter liquidity pools on Meteora and Raydium (Solana DEVNET).
        
        Supports filtering by:
        - Token pair (e.g., SOL/USDC)
        - Protocol (meteora, raydium, or both)
        - Minimum TVL
        - Minimum volume (with timeframe)
        - Minimum APY
        - Sorting by tvl, volume, apy, or fee
        
        IMPORTANT: If user doesn't specify protocol, ASK which they prefer.`,
        parameters: {
            type: Type.OBJECT,
            properties: {
                tokenA: { type: Type.STRING, description: 'First token symbol (e.g., "SOL")' },
                tokenB: { type: Type.STRING, description: 'Second token symbol (e.g., "USDC")' },
                protocol: { type: Type.STRING, description: 'Filter by protocol: "meteora", "raydium", or empty for both' },
                minTVL: { type: Type.NUMBER, description: 'Minimum TVL in USD' },
                minVolume: { type: Type.NUMBER, description: 'Minimum volume in USD' },
                volumeTimeframe: { type: Type.STRING, description: 'Timeframe for volume: "5m", "1h", "24h", "7d"' },
                minAPY: { type: Type.NUMBER, description: 'Minimum APY percentage' },
                sortBy: { type: Type.STRING, description: 'Sort by: "tvl", "volume", "apy"' },
                limit: { type: Type.NUMBER, description: 'Maximum results (default 10)' }
            }
        }
    };

    const getPoolDetailsTool: FunctionDeclaration = {
        name: 'getPoolDetails',
        description: 'Get detailed information about a specific liquidity pool.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                poolAddress: { type: Type.STRING, description: 'Pool address or ID' }
            },
            required: ['poolAddress']
        }
    };

    const getTopPoolsTool: FunctionDeclaration = {
        name: 'getTopLiquidityPools',
        description: `Get ranked list of top liquidity pools by volume, APY, or TVL.
        
        Examples:
        - "pools com maior volume em 5 minutos" → criteria: "volume", volumeTimeframe: "5m"
        - "melhor rentabilidade com TVL > $5000" → criteria: "apy", minTVL: 5000`,
        parameters: {
            type: Type.OBJECT,
            properties: {
        criteria: { type: Type.STRING, description: 'Ranking criteria: "volume", "apy", or "tvl"' },
                volumeTimeframe: { type: Type.STRING, description: 'Timeframe for volume criteria: "5m", "1h", "24h", "7d"' },
                minTVL: { type: Type.NUMBER, description: 'Minimum TVL filter in USD' },
                protocol: { type: Type.STRING, description: 'Filter by protocol: "meteora", "raydium", or empty for all' },
                limit: { type: Type.NUMBER, description: 'Number of results (default 10)' }
            },
            required: ['criteria']
        }
    };

    const getTopVolatilityPoolsTool: FunctionDeclaration = {
        name: 'getTopVolatilityPools',
        description: `Get ranked list of liquidity pools by volatility (highest first).
        
        Use this when user asks for:
        - "pools com maior volatilidade"
        - "most volatile pools"
        - "quais pools estão mais voláteis?"
        - "ranking de volatilidade"
        - "pools mais arriscadas"
        
        Returns pools sorted by daily volatility percentage, including price changes and confidence levels.`,
        parameters: {
            type: Type.OBJECT,
            properties: {
                limit: { type: Type.NUMBER, description: 'Number of results (default 10)' },
                days: { type: Type.NUMBER, description: 'Days for volatility calculation (default 7)' },
                minTVL: { type: Type.NUMBER, description: 'Minimum TVL in USD (optional filter)' },
                protocol: { type: Type.STRING, description: 'Filter by protocol: "meteora" or "raydium" (optional)' }
            }
        }
    };

    const comparePoolsTool: FunctionDeclaration = {
        name: 'compareLiquidityPools',
        description: 'Compare multiple pools side by side or compare protocols for a token pair.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                poolAddresses: { type: Type.ARRAY, items: { type: Type.STRING }, description: 'Array of pool addresses to compare' },
                tokenPair: { type: Type.STRING, description: 'Token pair to compare across protocols (e.g., "SOL/USDC")' }
            }
        }
    };

    const getPoolHistoryTool: FunctionDeclaration = {
        name: 'getPoolHistory',
        description: 'Get historical data for a pool (TVL, volume, APY over time).',
        parameters: {
            type: Type.OBJECT,
            properties: {
                poolAddress: { type: Type.STRING, description: 'Pool address' },
                metric: { type: Type.STRING, description: 'Metric: "tvl", "volume", or "apy"' },
                days: { type: Type.NUMBER, description: 'Number of days of history (default 7)' }
            },
            required: ['poolAddress', 'metric']
        }
    };

    // ============================================
    // PORTFOLIO & POSITIONS
    // ============================================

    const getLPPositionsTool: FunctionDeclaration = {
        name: 'getLPPositions',
        description: 'Get all liquidity positions for the connected wallet across Meteora and Raydium.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                protocol: { type: Type.STRING, description: 'Optional: filter by "meteora" or "raydium"' }
            }
        }
    };

    const getPositionDetailsTool: FunctionDeclaration = {
        name: 'getLPPositionDetails',
        description: 'Get detailed information about a specific LP position.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                positionAddress: { type: Type.STRING, description: 'Position address or NFT mint' }
            },
            required: ['positionAddress']
        }
    };

    const getUnclaimedRewardsTool: FunctionDeclaration = {
        name: 'getUnclaimedLPRewards',
        description: 'Get unclaimed fees and rewards from LP positions.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                positionAddress: { type: Type.STRING, description: 'Optional: specific position. If empty, shows all.' }
            }
        }
    };

    const estimatePositionPnLTool: FunctionDeclaration = {
        name: 'estimateLPPositionPnL',
        description: 'Calculate profit/loss for an LP position including impermanent loss and fees earned.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                positionAddress: { type: Type.STRING, description: 'Position address' }
            },
            required: ['positionAddress']
        }
    };

    // ============================================
    // OPERATIONS
    // ============================================

    const addLiquidityTool: FunctionDeclaration = {
        name: 'addLiquidity',
        description: `Add liquidity to a pool on Meteora or Raydium.
        
        BEFORE EXECUTING:
        1. Confirm pool address and protocol
        2. Confirm token amounts
        3. For concentrated liquidity (DLMM/CLMM), confirm price range
        4. Show simulation result first
        5. Get user confirmation
        
        IMPORTANT: If protocol not specified, ASK the user first.`,
        parameters: {
            type: Type.OBJECT,
            properties: {
                poolAddress: { type: Type.STRING, description: 'Pool address' },
                amountA: { type: Type.NUMBER, description: 'Amount of first token' },
                amountB: { type: Type.NUMBER, description: 'Amount of second token' },
                priceMin: { type: Type.NUMBER, description: 'Minimum price for range (DLMM/CLMM)' },
                priceMax: { type: Type.NUMBER, description: 'Maximum price for range (DLMM/CLMM)' },
                slippageBps: { type: Type.NUMBER, description: 'Slippage tolerance in basis points (default 50)' }
            },
            required: ['poolAddress', 'amountA', 'amountB']
        }
    };

    const removeLiquidityTool: FunctionDeclaration = {
        name: 'removeLiquidity',
        description: `Remove liquidity from an LP position.
        
        BEFORE EXECUTING:
        1. Show current position value
        2. Confirm removal percentage
        3. Get user confirmation`,
        parameters: {
            type: Type.OBJECT,
            properties: {
                positionAddress: { type: Type.STRING, description: 'Position address' },
                percentage: { type: Type.NUMBER, description: 'Percentage to remove (1-100)' },
                slippageBps: { type: Type.NUMBER, description: 'Slippage tolerance in basis points' }
            },
            required: ['positionAddress', 'percentage']
        }
    };

    const claimFeesTool: FunctionDeclaration = {
        name: 'claimLPFees',
        description: 'Claim accumulated trading fees from an LP position.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                positionAddress: { type: Type.STRING, description: 'Position address' }
            },
            required: ['positionAddress']
        }
    };

    const claimRewardsTool: FunctionDeclaration = {
        name: 'claimLPRewards',
        description: 'Claim farming/staking rewards from an LP position.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                positionAddress: { type: Type.STRING, description: 'Position address' }
            },
            required: ['positionAddress']
        }
    };

    const rebalancePositionTool: FunctionDeclaration = {
        name: 'rebalanceLPPosition',
        description: 'Rebalance an LP position to a new price range (closes and reopens with new range).',
        parameters: {
            type: Type.OBJECT,
            properties: {
                positionAddress: { type: Type.STRING, description: 'Current position address' },
                newPriceMin: { type: Type.NUMBER, description: 'New minimum price' },
                newPriceMax: { type: Type.NUMBER, description: 'New maximum price' }
            },
            required: ['positionAddress', 'newPriceMin', 'newPriceMax']
        }
    };

    // ============================================
    // SIMULATIONS & HELPERS
    // ============================================

    const simulateAddLiquidityTool: FunctionDeclaration = {
        name: 'simulateAddLiquidity',
        description: 'Simulate adding liquidity without executing. Shows expected outcome, share of pool, and price impact.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                poolAddress: { type: Type.STRING, description: 'Pool address' },
                amountA: { type: Type.NUMBER, description: 'Amount of first token' },
                amountB: { type: Type.NUMBER, description: 'Amount of second token' },
                priceMin: { type: Type.NUMBER, description: 'Min price for range (optional)' },
                priceMax: { type: Type.NUMBER, description: 'Max price for range (optional)' }
            },
            required: ['poolAddress', 'amountA', 'amountB']
        }
    };

    const estimateImpermanentLossTool: FunctionDeclaration = {
        name: 'estimateImpermanentLoss',
        description: 'Calculate potential impermanent loss for a pool based on price change scenarios.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                poolAddress: { type: Type.STRING, description: 'Pool address' },
                priceChangePercent: { type: Type.NUMBER, description: 'Expected price change in percentage (e.g., 10 for +10%, -20 for -20%)' }
            },
            required: ['poolAddress', 'priceChangePercent']
        }
    };

    const calculateOptimalRangeTool: FunctionDeclaration = {
        name: 'calculateOptimalPriceRange',
        description: 'Suggest an optimal price range for concentrated liquidity based on volatility and risk level.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                poolAddress: { type: Type.STRING, description: 'Pool address' },
                riskLevel: { type: Type.STRING, description: 'Risk tolerance: "conservative", "moderate", or "aggressive"' }
            },
            required: ['poolAddress', 'riskLevel']
        }
    };

    const getSwapQuoteTool: FunctionDeclaration = {
        name: 'getLPSwapQuote',
        description: 'Get a swap quote through liquidity pools.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                inputToken: { type: Type.STRING, description: 'Input token symbol or mint' },
                outputToken: { type: Type.STRING, description: 'Output token symbol or mint' },
                amount: { type: Type.NUMBER, description: 'Amount to swap' },
                slippageBps: { type: Type.NUMBER, description: 'Slippage tolerance in basis points' }
            },
            required: ['inputToken', 'outputToken', 'amount']
        }
    };

    // ============================================
    // POOL CREATION
    // ============================================

    const createPoolTool: FunctionDeclaration = {
        name: 'createLiquidityPool',
        description: `Create a new liquidity pool on Meteora or Raydium.
        
        REQUIRES CONFIRMATION:
        1. Protocol (Meteora DLMM or Raydium CLMM/CPMM)
        2. Token pair
        3. Fee tier
        4. Initial price
        5. Initial liquidity amounts`,
        parameters: {
            type: Type.OBJECT,
            properties: {
                protocol: { type: Type.STRING, description: 'Protocol: "meteora_dlmm", "raydium_clmm", or "raydium_cpmm"' },
                tokenA: { type: Type.STRING, description: 'First token mint address' },
                tokenB: { type: Type.STRING, description: 'Second token mint address' },
                feeBps: { type: Type.NUMBER, description: 'Fee in basis points (e.g., 25 = 0.25%)' },
                initialPrice: { type: Type.NUMBER, description: 'Initial price of tokenA in terms of tokenB' },
                initialLiquidityA: { type: Type.NUMBER, description: 'Optional: initial amount of tokenA' },
                initialLiquidityB: { type: Type.NUMBER, description: 'Optional: initial amount of tokenB' }
            },
            required: ['protocol', 'tokenA', 'tokenB', 'feeBps', 'initialPrice']
        }
    };

    const estimatePoolCreationCostTool: FunctionDeclaration = {
        name: 'estimatePoolCreationCost',
        description: 'Estimate the cost (in SOL) to create a new liquidity pool.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                protocol: { type: Type.STRING, description: 'Protocol: "meteora_dlmm", "raydium_clmm", or "raydium_cpmm"' }
            },
            required: ['protocol']
        }
    };

    return [
        // Analytics & Discovery
        searchPoolsTool,
        getPoolDetailsTool,
        getTopPoolsTool,
        getTopVolatilityPoolsTool,
        comparePoolsTool,
        getPoolHistoryTool,
        // Portfolio & Positions
        getLPPositionsTool,
        getPositionDetailsTool,
        getUnclaimedRewardsTool,
        estimatePositionPnLTool,
        // Operations
        addLiquidityTool,
        removeLiquidityTool,
        claimFeesTool,
        claimRewardsTool,
        rebalancePositionTool,
        // Simulations & Helpers
        simulateAddLiquidityTool,
        estimateImpermanentLossTool,
        calculateOptimalRangeTool,
        getSwapQuoteTool,
        // Pool Creation
        createPoolTool,
        estimatePoolCreationCostTool
    ];
}
