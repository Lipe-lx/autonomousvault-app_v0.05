// lpToolHandler.ts
// Handler for Liquidity Pool AI tool calls

import { liquidityPoolMCP } from '../mcp/solana/liquidityPoolMCP';
import { meteoraService } from '../services/meteoraService';
import { raydiumService } from '../services/raydiumService';
import { volatilityService } from '../services/volatilityService';
import { lpPolicyService } from '../services/lpPolicyService';
import { solanaDealerStore } from '../state/solanaDealerStore';
import { meteoraMCP } from '../mcp/meteora/meteoraMCP';
import { raydiumMCP } from '../mcp/raydium/raydiumMCP';
import {
    LiquidityPool,
    PoolQueryFilters,
    TimeFrame
} from '../types/solanaLiquidityTypes';
import { LPOperationScope, SemanticType, LPAuditEntry } from '../types/solanaLPTypes';
import { 
    StructuredResult, 
    PoolItem, 
    VolatilityItem,
    RangeSuggestion,
    ProtocolId,
    getPoolUrl 
} from '../types/structuredResponseTypes';

// Semantic types for visual differentiation
export type { SemanticType } from '../types/solanaLPTypes';

export interface ToolResult {
    type: 'success' | 'error' | 'info';
    semanticType?: SemanticType; // 'analysis' | 'decision' | 'execution'
    title: string;
    details: string;
    rationale?: string;
    tx?: string;
    // Structured data for rich card rendering
    structuredData?: StructuredResult;
    // For confirmation flow
    requiresConfirmation?: boolean;
    confirmationData?: {
        scope: LPOperationScope;
        action: string;
        poolAddress?: string;
        poolName?: string;
        params: Record<string, any>;
        rationale: string;
    };
}

/**
 * Handle LP-related AI tool calls
 * @returns ToolResult if tool was handled, null if tool is not LP-related
 */
export async function handleLPToolCall(
    name: string,
    args: any,
    walletAddress?: string,
    setStatus?: (status: string) => void
): Promise<ToolResult | null> {

    const setAiStatus = setStatus || (() => {});

    // =============================================
    // ANALYTICS & DISCOVERY
    // =============================================

    if (name === 'searchLiquidityPools') {
        try {
            setAiStatus('Searching liquidity pools...');

            const filters: PoolQueryFilters = {
                tokenPair: args.tokenA && args.tokenB ? { tokenA: args.tokenA, tokenB: args.tokenB } : undefined,
                minTVL: args.minTVL,
                minVolume: args.minVolume,
                volumeTimeframe: args.volumeTimeframe as TimeFrame,
                minAPY: args.minAPY,
                sortBy: args.sortBy || 'tvl',
                sortOrder: 'desc',
                limit: args.limit || 10
            };

            // Filter by protocol if specified
            if (args.protocol) {
                if (args.protocol === 'meteora') {
                    filters.protocol = ['meteora_dlmm', 'meteora_damm'];
                } else if (args.protocol === 'raydium') {
                    filters.protocol = ['raydium_clmm', 'raydium_cpmm'];
                }
            }

            const pools = await liquidityPoolMCP.discoverPools(filters);

            if (pools.length === 0) {
                return {
                    type: 'info',
                    title: 'No Pools Found',
                    details: 'No pools match your search criteria.'
                };
            }

            let details = `Found ${pools.length} pools:\n\n`;
            details += '| Pool | Protocol | TVL | Volume 24h | APY |\n|------|----------|-----|------------|-----|\n';
            
            pools.forEach(pool => {
                const protocol = pool.protocol.includes('meteora') ? 'MET' : 'RAY';
                details += `| ${pool.name} | ${protocol} | $${pool.tvl.toLocaleString()} | $${(pool.volume['24h'] || 0).toLocaleString()} | ${(pool.apy || 0).toFixed(2)}% |\n`;
            });

            // Log to audit
            solanaDealerStore.addLog('INFO', `Searched pools: ${pools.length} results`, { filters });

            // Build structured data for rich cards
            const poolItems: PoolItem[] = pools.map(pool => {
                const protocolId: ProtocolId = pool.protocol.includes('meteora') ? 'meteora' : 'raydium';
                return {
                    type: 'pool' as const,
                    protocol: protocolId,
                    name: pool.name,
                    tokenA: { symbol: pool.tokenA.symbol, mint: pool.tokenA.mint },
                    tokenB: { symbol: pool.tokenB.symbol, mint: pool.tokenB.mint },
                    volume24h: pool.volume['24h'] || 0,
                    tvl: pool.tvl,
                    apy: pool.apy || 0,
                    feeBps: pool.feeBps,
                    poolAddress: pool.address,
                    poolUrl: getPoolUrl(protocolId, pool.address),
                    currentPrice: pool.currentPrice
                };
            });

            return { 
                type: 'success', 
                semanticType: 'analysis', 
                title: 'Liquidity Pools', 
                details,
                structuredData: {
                    resultType: 'pools',
                    items: poolItems,
                    summary: `Found ${pools.length} pools`
                }
            };
        } catch (err: any) {
            return { type: 'error', semanticType: 'analysis', title: 'Search Error', details: err.message };
        }
    }

    if (name === 'getPoolDetails') {
        try {
            setAiStatus('Fetching pool details...');
            
            // Try Meteora first, then Raydium
            let pool = await meteoraService.getPool(args.poolAddress);
            if (!pool) {
                pool = await raydiumService.getPoolById(args.poolAddress);
            }

            if (!pool) {
                return { type: 'error', title: 'Pool Not Found', details: `No pool found with address: ${args.poolAddress}` };
            }

            const details = `
**${pool.name}**
- Protocol: ${pool.protocol}
- Address: ${pool.address}
- TVL: $${pool.tvl.toLocaleString()}
- Volume 24h: $${(pool.volume['24h'] || 0).toLocaleString()}
- APY: ${(pool.apy || 0).toFixed(2)}%
- Fee: ${pool.feeBps} bps (${(pool.feeBps / 100).toFixed(2)}%)
- Token A: ${pool.tokenA.symbol} (${pool.tokenA.mint.slice(0, 8)}...)
- Token B: ${pool.tokenB.symbol} (${pool.tokenB.mint.slice(0, 8)}...)
            `.trim();

            return { type: 'success', title: 'Pool Details', details };
        } catch (err: any) {
            return { type: 'error', title: 'Pool Details Error', details: err.message };
        }
    }

    if (name === 'getTopLiquidityPools') {
        try {
            setAiStatus(`Getting top pools by ${args.criteria}...`);
            
            const rankings = await liquidityPoolMCP.getTopPools(
                args.criteria,
                {
                    timeframe: args.volumeTimeframe as TimeFrame,
                    minTVL: args.minTVL,
                    limit: args.limit || 10
                }
            );

            if (rankings.length === 0) {
                return { type: 'info', title: 'No Pools', details: 'No pools found matching criteria.' };
            }

            // Ensure descending order (highest first)
            const sorted = [...rankings].sort((a, b) => b.score - a.score);

            let details = `Top ${sorted.length} pools by ${args.criteria}:\n\n`;
            sorted.forEach((r, idx) => {
                const protocol = r.pool.protocol.includes('meteora') ? 'MET' : 'RAY';
                let value = '';
                if (args.criteria === 'volume') {
                    value = `Vol: $${(r.pool.volume['24h'] || 0).toLocaleString()}`;
                } else if (args.criteria === 'apy') {
                    value = `APY: ${(r.pool.apy || 0).toFixed(2)}%`;
                } else {
                    value = `TVL: $${r.pool.tvl.toLocaleString()}`;
                }
                details += `${idx + 1}. [${protocol}] ${r.pool.name} - ${value}\n`;
            });

            // Build structured data for rich cards
            const poolItems: PoolItem[] = sorted.map(r => {
                const protocolId: ProtocolId = r.pool.protocol.includes('meteora') ? 'meteora' : 'raydium';
                return {
                    type: 'pool' as const,
                    protocol: protocolId,
                    name: r.pool.name,
                    tokenA: { symbol: r.pool.tokenA.symbol, mint: r.pool.tokenA.mint },
                    tokenB: { symbol: r.pool.tokenB.symbol, mint: r.pool.tokenB.mint },
                    volume24h: r.pool.volume['24h'] || 0,
                    tvl: r.pool.tvl,
                    apy: r.pool.apy || 0,
                    feeBps: r.pool.feeBps,
                    poolAddress: r.pool.address,
                    poolUrl: getPoolUrl(protocolId, r.pool.address),
                    currentPrice: r.pool.currentPrice
                };
            });

            return { 
                type: 'success', 
                title: `Top Pools by ${args.criteria.toUpperCase()}`, 
                details,
                structuredData: {
                    resultType: 'pools',
                    items: poolItems,
                    summary: `Top ${sorted.length} pools by ${args.criteria}`,
                    title: `Top Pools by ${args.criteria.toUpperCase()}`
                }
            };
        } catch (err: any) {
            return { type: 'error', title: 'Ranking Error', details: err.message };
        }
    }

    if (name === 'compareLiquidityPools') {
        try {
            setAiStatus('Comparing pools...');
            
            if (args.tokenPair) {
                const [tokenA, tokenB] = args.tokenPair.split('/').map((t: string) => t.trim());
                const comparison = await liquidityPoolMCP.compareProtocols(tokenA, tokenB);
                
                let details = `**Comparison for ${args.tokenPair}**\n\n`;
                details += `Meteora Pools: ${comparison.meteora.length}\n`;
                details += `Raydium Pools: ${comparison.raydium.length}\n\n`;
                
                if (comparison.recommendation.poolAddress) {
                    details += `**Recommendation:** ${comparison.recommendation.protocol}\n`;
                    details += `Reason: ${comparison.recommendation.reason}`;
                }

                return { type: 'success', title: 'Pool Comparison', details };
            }

            return { type: 'error', title: 'Compare Error', details: 'Please provide tokenPair (e.g., "SOL/USDC")' };
        } catch (err: any) {
            return { type: 'error', title: 'Compare Error', details: err.message };
        }
    }

    if (name === 'getPoolHistory') {
        try {
            setAiStatus('Fetching pool history...');
            
            const history = await meteoraService.getPoolTVLHistory(args.poolAddress, args.days || 7);
            
            if (history.length === 0) {
                return { type: 'info', title: 'No History', details: 'No historical data available.' };
            }

            let details = `${args.metric.toUpperCase()} History (${args.days || 7} days):\n\n`;
            history.slice(-5).forEach(point => {
                const date = new Date(point.timestamp).toLocaleDateString();
                details += `${date}: $${point.value.toLocaleString()}\n`;
            });

            return { type: 'success', title: 'Pool History', details };
        } catch (err: any) {
            return { type: 'error', title: 'History Error', details: err.message };
        }
    }

    // =============================================
    // PORTFOLIO & POSITIONS
    // =============================================

    if (name === 'getLPPositions') {
        try {
            setAiStatus('Fetching LP positions...');
            
            if (!walletAddress) {
                return { type: 'error', title: 'Wallet Required', details: 'Please connect a wallet to view positions.' };
            }

            const positionData = await liquidityPoolMCP.getAllPositions(walletAddress);
            const allPositions = [...positionData.meteora, ...positionData.raydium];

            if (allPositions.length === 0) {
                return { type: 'info', title: 'No Positions', details: 'You have no active LP positions.' };
            }

            let details = `**Your LP Portfolio**\n`;
            details += `Total Value: $${positionData.totalValueUSD.toLocaleString()}\n`;
            details += `Unclaimed Fees: $${positionData.totalUnclaimedFeesUSD.toFixed(2)}\n\n`;
            details += `Meteora: ${positionData.meteora.length} positions\n`;
            details += `Raydium: ${positionData.raydium.length} positions\n\n`;

            allPositions.slice(0, 5).forEach((pos, i) => {
                const protocol = pos.protocol.includes('meteora') ? 'MET' : 'RAY';
                details += `${i + 1}. [${protocol}] Pool: ${pos.poolAddress.slice(0, 8)}...\n`;
                details += `   Value: $${pos.valueUSD.toLocaleString()} | Fees: $${pos.unclaimedFees.totalUSD.toFixed(2)}\n`;
            });

            return { type: 'success', title: 'LP Positions', details };
        } catch (err: any) {
            return { type: 'error', title: 'Positions Error', details: err.message };
        }
    }

    if (name === 'getLPPositionDetails') {
        try {
            setAiStatus('Fetching position details...');
            
            // Try both services
            let position = await meteoraService.getPosition(args.positionAddress);
            if (!position) {
                position = await raydiumService.getPositionByNft(args.positionAddress);
            }

            if (!position) {
                return { type: 'error', title: 'Position Not Found', details: `Position not found: ${args.positionAddress}` };
            }

            const details = `
**Position Details**
- Address: ${position.positionAddress}
- Pool: ${position.poolAddress}
- Protocol: ${position.protocol}
- Value: $${position.valueUSD.toLocaleString()}
- Token A: ${position.tokenAAmount}
- Token B: ${position.tokenBAmount}
- Unclaimed Fees: $${position.unclaimedFees.totalUSD.toFixed(2)}
${position.priceRange ? `- Price Range: ${position.priceRange.min.toFixed(4)} - ${position.priceRange.max.toFixed(4)}
- In Range: ${position.priceRange.inRange ? '✅' : '❌'}` : ''}
            `.trim();

            return { type: 'success', title: 'Position Details', details };
        } catch (err: any) {
            return { type: 'error', title: 'Position Error', details: err.message };
        }
    }

    if (name === 'getUnclaimedLPRewards') {
        try {
            setAiStatus('Checking unclaimed rewards...');
            
            if (args.positionAddress) {
                const fees = await meteoraService.getUnclaimedFees(args.positionAddress);
                return {
                    type: 'success',
                    title: 'Unclaimed Fees',
                    details: `Position ${args.positionAddress.slice(0, 8)}...\nToken A: ${fees.tokenA}\nToken B: ${fees.tokenB}\nTotal USD: $${fees.totalUSD.toFixed(2)}`
                };
            }

            if (!walletAddress) {
                return { type: 'error', title: 'Wallet Required', details: 'Please connect a wallet.' };
            }

            const positionData = await liquidityPoolMCP.getAllPositions(walletAddress);
            return {
                type: 'success',
                title: 'Total Unclaimed Rewards',
                details: `Total unclaimed fees across all positions: $${positionData.totalUnclaimedFeesUSD.toFixed(2)}`
            };
        } catch (err: any) {
            return { type: 'error', title: 'Rewards Error', details: err.message };
        }
    }

    if (name === 'estimateLPPositionPnL') {
        try {
            setAiStatus('Calculating PnL...');
            
            // This would require historical data we don't have stored
            // For now, return a placeholder
            return {
                type: 'info',
                title: 'PnL Estimation',
                details: 'PnL calculation requires entry data. Please check your position details for current value and unclaimed fees.'
            };
        } catch (err: any) {
            return { type: 'error', title: 'PnL Error', details: err.message };
        }
    }

    // =============================================
    // OPERATIONS (Require SDK - placeholders)
    // =============================================

    if (name === 'addLiquidity') {
        // Get policy for validation
        const policy = solanaDealerStore.getPolicy();
        
        // Validate against policy
        const validation = lpPolicyService.validateOperation(
            'OPEN_POSITION',
            {
                poolAddress: args.poolAddress,
                rangeWidthPercent: args.priceMin && args.priceMax && args.currentPrice 
                    ? ((args.priceMax - args.priceMin) / args.currentPrice) * 100 
                    : undefined
            },
            policy
        );

        if (!validation.allowed) {
            // Log policy violation
            solanaDealerStore.addAuditEntry({
                scope: 'OPEN_POSITION',
                action: 'Add liquidity blocked by policy',
                poolAddress: args.poolAddress,
                rationale: 'Policy violation detected',
                params: { amountA: args.amountA, amountB: args.amountB },
                status: 'rejected',
                policyViolations: validation.violations
            });

            return {
                type: 'error',
                semanticType: 'decision',
                title: 'Policy Violation',
                details: `❌ **Operação bloqueada pela Policy Engine**\n\n${validation.violations.map(v => '• ' + v).join('\n')}\n\nAjuste suas políticas em Solana Dealer > Policy para prosseguir.`
            };
        }

        // Check if confirmation is required
        const requiresConfirmation = lpPolicyService.requiresConfirmation('OPEN_POSITION', policy);
        const rationale = `Adição de liquidez na pool ${args.poolAddress?.slice(0, 8) || 'unknown'}. Valores: ${args.amountA} token A + ${args.amountB} token B.`;
        
        if (requiresConfirmation) {
            // Log pending confirmation
            solanaDealerStore.addAuditEntry({
                scope: 'OPEN_POSITION',
                action: 'Add liquidity - awaiting confirmation',
                poolAddress: args.poolAddress,
                rationale,
                params: { amountA: args.amountA, amountB: args.amountB, priceMin: args.priceMin, priceMax: args.priceMax },
                status: 'pending'
            });

            return {
                type: 'info',
                semanticType: 'decision',
                title: 'Confirm Add Liquidity',
                details: `Adicionando liquidez à pool ${args.poolAddress?.slice(0, 8) || 'unknown'}:\n- Amount A: ${args.amountA}\n- Amount B: ${args.amountB}\n${args.priceMin ? `- Range: ${args.priceMin} - ${args.priceMax}` : ''}`,
                rationale,
                requiresConfirmation: true,
                confirmationData: {
                    scope: 'OPEN_POSITION',
                    action: 'Add Liquidity',
                    poolAddress: args.poolAddress,
                    params: { amountA: args.amountA, amountB: args.amountB, priceMin: args.priceMin, priceMax: args.priceMax },
                    rationale
                }
            };
        }

        // No confirmation needed - log and return
        solanaDealerStore.addLog('OPERATION', `Add liquidity to ${args.poolAddress?.slice(0, 8)}`, args);

        return {
            type: 'info',
            semanticType: 'execution',
            title: 'Add Liquidity',
            details: `To add liquidity to pool ${args.poolAddress?.slice(0, 8) || 'unknown'}...:\n- Amount A: ${args.amountA}\n- Amount B: ${args.amountB}\n${args.priceMin ? `- Price Range: ${args.priceMin} - ${args.priceMax}` : ''}\n\n⚠️ SDK integration required. Please use the protocol's web interface for now.`,
            rationale
        };
    }

    if (name === 'removeLiquidity') {
        const policy = solanaDealerStore.getPolicy();
        const requiresConfirmation = lpPolicyService.requiresConfirmation('CLOSE_POSITION', policy);
        const rationale = `Remoção de ${args.percentage}% da posição ${args.positionAddress?.slice(0, 8) || 'unknown'}.`;

        // Log to audit
        solanaDealerStore.addAuditEntry({
            scope: 'CLOSE_POSITION',
            action: `Remove ${args.percentage}% liquidity`,
            poolAddress: args.positionAddress,
            rationale,
            params: { percentage: args.percentage },
            status: requiresConfirmation ? 'pending' : 'executed'
        });

        if (requiresConfirmation) {
            return {
                type: 'info',
                semanticType: 'decision',
                title: 'Confirm Remove Liquidity',
                details: `Removendo ${args.percentage}% da posição ${args.positionAddress?.slice(0, 8) || 'unknown'}`,
                rationale,
                requiresConfirmation: true,
                confirmationData: {
                    scope: 'CLOSE_POSITION',
                    action: 'Remove Liquidity',
                    poolAddress: args.positionAddress,
                    params: { percentage: args.percentage },
                    rationale
                }
            };
        }

        return {
            type: 'info',
            semanticType: 'execution',
            title: 'Remove Liquidity',
            details: `To remove ${args.percentage}% from position ${args.positionAddress?.slice(0, 8) || 'unknown'}...\n\n⚠️ SDK integration required. Please use the protocol's web interface for now.`,
            rationale
        };
    }

    if (name === 'claimLPFees' || name === 'claimLPRewards') {
        const rationale = `Claim de fees/rewards da posição ${args.positionAddress?.slice(0, 8) || 'unknown'}.`;
        
        solanaDealerStore.addAuditEntry({
            scope: 'CLAIM_FEES',
            action: 'Claim fees/rewards',
            poolAddress: args.positionAddress,
            rationale,
            params: {},
            status: 'executed'
        });

        return {
            type: 'info',
            semanticType: 'execution',
            title: 'Claim Fees/Rewards',
            details: `To claim from position ${args.positionAddress?.slice(0, 8) || 'unknown'}...\n\n⚠️ SDK integration required. Please use the protocol's web interface for now.`,
            rationale
        };
    }

    if (name === 'rebalanceLPPosition') {
        const policy = solanaDealerStore.getPolicy();
        const requiresConfirmation = lpPolicyService.requiresConfirmation('REBALANCE_RANGE', policy);
        const rationale = `Rebalanceamento para novo range: ${args.newPriceMin} - ${args.newPriceMax}.`;

        solanaDealerStore.addAuditEntry({
            scope: 'REBALANCE_RANGE',
            action: 'Rebalance to new range',
            poolAddress: args.positionAddress,
            rationale,
            params: { newPriceMin: args.newPriceMin, newPriceMax: args.newPriceMax },
            status: requiresConfirmation ? 'pending' : 'executed'
        });

        if (requiresConfirmation) {
            return {
                type: 'info',
                semanticType: 'decision',
                title: 'Confirm Rebalance',
                details: `Rebalanceando posição para range ${args.newPriceMin} - ${args.newPriceMax}`,
                rationale,
                requiresConfirmation: true,
                confirmationData: {
                    scope: 'REBALANCE_RANGE',
                    action: 'Rebalance Position',
                    poolAddress: args.positionAddress,
                    params: { newPriceMin: args.newPriceMin, newPriceMax: args.newPriceMax },
                    rationale
                }
            };
        }

        return {
            type: 'info',
            semanticType: 'execution',
            title: 'Rebalance Position',
            details: `To rebalance position to range ${args.newPriceMin} - ${args.newPriceMax}:\n\n⚠️ SDK integration required. Please use the protocol's web interface for now.`,
            rationale
        };
    }

    // =============================================
    // SIMULATIONS & HELPERS
    // =============================================

    if (name === 'simulateAddLiquidity') {
        try {
            setAiStatus('Simulating liquidity addition...');
            
            // Get pool details to calculate share
            const pool = await meteoraService.getPool(args.poolAddress) || 
                        await raydiumService.getPoolById(args.poolAddress);

            if (!pool) {
                return { type: 'error', title: 'Pool Not Found', details: 'Cannot simulate - pool not found.' };
            }

            const estimatedValue = (args.amountA || 0) * 100 + (args.amountB || 0); // Rough estimate
            const shareOfPool = pool.tvl > 0 ? (estimatedValue / (pool.tvl + estimatedValue)) * 100 : 100;

            return {
                type: 'success',
                title: 'Liquidity Simulation',
                details: `**Simulation Results**
- Pool: ${pool.name}
- Adding: ${args.amountA} token A + ${args.amountB} token B
- Estimated Value: ~$${estimatedValue.toLocaleString()}
- Share of Pool: ~${shareOfPool.toFixed(4)}%
- Current Pool TVL: $${pool.tvl.toLocaleString()}
- Pool APY: ${(pool.apy || 0).toFixed(2)}%`
            };
        } catch (err: any) {
            return { type: 'error', title: 'Simulation Error', details: err.message };
        }
    }

    if (name === 'estimateImpermanentLoss') {
        try {
            const priceChange = args.priceChangePercent / 100;
            const k = Math.abs(priceChange);
            
            // IL Formula: IL = 2 * sqrt(1+k) / (2+k) - 1
            const sqrtFactor = Math.sqrt(1 + k);
            const ilPercent = (2 * sqrtFactor / (2 + k) - 1) * 100;

            return {
                type: 'success',
                title: 'Impermanent Loss Estimate',
                details: `**Price Change: ${args.priceChangePercent > 0 ? '+' : ''}${args.priceChangePercent}%**

Estimated Impermanent Loss: ${Math.abs(ilPercent).toFixed(2)}%

Note: This is a simplified calculation. Actual IL depends on:
- Price range (for concentrated liquidity)
- Pool type (constant product vs concentrated)
- Fees earned (which offset IL)`
            };
        } catch (err: any) {
            return { type: 'error', title: 'IL Calculation Error', details: err.message };
        }
    }

    if (name === 'calculateOptimalPriceRange') {
        try {
            const pool = await meteoraService.getPool(args.poolAddress) ||
                        await raydiumService.getPoolById(args.poolAddress);

            if (!pool || !pool.currentPrice) {
                return { type: 'error', title: 'Range Error', details: 'Could not get current price for pool.' };
            }

            const range = raydiumMCP.calculateOptimalRange(pool.currentPrice, args.riskLevel);

            return {
                type: 'success',
                title: 'Optimal Price Range',
                details: `**${args.riskLevel.toUpperCase()} Range**
- Current Price: $${pool.currentPrice.toFixed(4)}
- Suggested Min: $${range.priceMin.toFixed(4)}
- Suggested Max: $${range.priceMax.toFixed(4)}
- Range Width: ±${(range.rangeWidth / 2).toFixed(1)}%

Wider ranges = more fees earned, less impermanent loss
Tighter ranges = higher capital efficiency, more active management needed`
            };
        } catch (err: any) {
            return { type: 'error', title: 'Range Error', details: err.message };
        }
    }

    if (name === 'getLPSwapQuote') {
        try {
            setAiStatus('Getting swap quote...');
            
            const quote = await raydiumService.getSwapQuote({
                inputMint: args.inputToken,
                outputMint: args.outputToken,
                amount: args.amount,
                slippageBps: args.slippageBps || 50
            });

            if (!quote) {
                return { type: 'error', title: 'Quote Error', details: 'Could not get swap quote.' };
            }

            return {
                type: 'success',
                title: 'Swap Quote',
                details: `**${args.inputToken} → ${args.outputToken}**
- Input: ${args.amount}
- Output: ${quote.outputAmount}
- Price Impact: ${(quote.priceImpact * 100).toFixed(2)}%
- Fee: ${quote.fee}`
            };
        } catch (err: any) {
            return { type: 'error', title: 'Quote Error', details: err.message };
        }
    }

    // =============================================
    // VOLATILITY & RANGE SUGGESTIONS
    // =============================================

    if (name === 'getTopVolatilityPools') {
        try {
            setAiStatus('Calculating volatility for all pools...');
            
            const limit = args.limit || 10;
            const days = args.days || 7;
            const minTVL = args.minTVL || 0;
            const protocol = args.protocol as 'meteora' | 'raydium' | undefined;
            
            const results = await volatilityService.getTopPoolsByVolatility(limit, days, minTVL, protocol);
            
            if (results.length === 0) {
                return { 
                    type: 'info', 
                    title: 'No Pools Found', 
                    details: 'No pools with volatility data found in database.\n\nThis could mean:\n- No pools have been synced yet\n- No historical data available for volatility calculation\n\nData sync runs every 5 minutes.' 
                };
            }

            let details = `📊 **Top ${results.length} Pools by Volatility**\n\n`;
            details += `| # | Pool | Protocol | Daily Vol | Ann. Vol | Price Δ 24h | TVL |\n`;
            details += `|---|------|----------|-----------|----------|-------------|-----|\n`;
            
            // Build structured volatility items
            const volatilityItems: VolatilityItem[] = [];
            
            results.forEach((r, idx) => {
                const protocolLabel = r.pool.protocol.includes('meteora') ? 'MET' : 'RAY';
                const protocolId: ProtocolId = r.pool.protocol.includes('meteora') ? 'meteora' : 'raydium';
                const tvl = r.pool.tvl >= 1000 ? `$${(r.pool.tvl / 1000).toFixed(1)}K` : `$${r.pool.tvl.toFixed(0)}`;
                const priceChange = r.volatility.priceChange24h >= 0 ? `+${r.volatility.priceChange24h.toFixed(2)}%` : `${r.volatility.priceChange24h.toFixed(2)}%`;
                
                details += `| ${idx + 1} | ${r.pool.name.slice(0, 15)} | ${protocolLabel} | ${r.volatility.volatilityDaily.toFixed(2)}% | ${r.volatility.volatilityAnnualized.toFixed(1)}% | ${priceChange} | ${tvl} |\n`;
                
                volatilityItems.push({
                    type: 'volatility' as const,
                    poolName: r.pool.name,
                    poolAddress: r.pool.address,
                    protocol: protocolId,
                    currentPrice: r.volatility.currentPrice,
                    volatilityDaily: r.volatility.volatilityDaily,
                    volatilityAnnualized: r.volatility.volatilityAnnualized,
                    priceChange24h: r.volatility.priceChange24h,
                    priceChange7d: r.volatility.priceChange7d,
                    tvl: r.pool.tvl,
                    confidence: r.volatility.confidence as 'high' | 'medium' | 'low',
                    dataPoints: r.volatility.dataPoints
                });
            });
            
            details += `\n*Volatility calculated from ${days} days of historical data.*`;
            if (minTVL > 0) {
                details += `\n*Filtered to pools with TVL ≥ $${minTVL.toLocaleString()}*`;
            }

            // Log to audit
            solanaDealerStore.addLog('INFO', `Top volatility pools: ${results.length} results`, { limit, days, minTVL, protocol });

            return { 
                type: 'success', 
                semanticType: 'analysis',
                title: 'Top Pools by Volatility', 
                details,
                structuredData: {
                    resultType: 'volatility',
                    items: volatilityItems,
                    summary: `Top ${results.length} pools by volatility`,
                    title: 'Pools Ranked by Volatility'
                }
            };
        } catch (err: any) {
            return { type: 'error', title: 'Volatility Error', details: err.message };
        }
    }

    if (name === 'getPoolVolatility') {
        try {
            setAiStatus('Calculating pool volatility...');
            
            // If tokenA/tokenB provided, show volatility for ALL pools of that pair
            if (args.tokenA && args.tokenB && !args.poolAddress) {
                setAiStatus('Finding pools for token pair...');
                
                // Search pools from Supabase (where historical data exists)
                const pools = await volatilityService.searchPoolsByTokenPair(args.tokenA, args.tokenB, 10);
                
                if (pools.length === 0) {
                    return { 
                        type: 'info', 
                        title: 'No Pool Found', 
                        details: `No pool found in database for ${args.tokenA}/${args.tokenB}.\n\nThis could mean:\n- No pools exist for this pair\n- Pools haven't been synced yet (sync runs every 5 min)\n\nTry searching for available pools with: "liste pools"` 
                    };
                }
                
                let details = `📊 **Volatility Analysis for ${args.tokenA}/${args.tokenB}**\n`;
                details += `Found ${pools.length} pools\n\n`;
                details += `| Pool | Protocol | TVL | Daily Vol | Ann. Vol | Price |\n`;
                details += `|------|----------|-----|-----------|----------|-------|\n`;
                
                // Build structured volatility items
                const volatilityItems: VolatilityItem[] = [];
                
                for (const pool of pools) {
                    const volatility = await volatilityService.calculateVolatility(pool.address, args.days || 7);
                    const protocol = pool.protocol.includes('meteora') ? 'MET' : 'RAY';
                    const protocolId: ProtocolId = pool.protocol.includes('meteora') ? 'meteora' : 'raydium';
                    const dailyVol = volatility.error ? 'N/A' : `${volatility.volatilityDaily.toFixed(2)}%`;
                    const annVol = volatility.error ? 'N/A' : `${volatility.volatilityAnnualized.toFixed(1)}%`;
                    const price = volatility.currentPrice > 0 ? `$${volatility.currentPrice.toFixed(4)}` : 'N/A';
                    const tvl = pool.tvl >= 1000 ? `$${(pool.tvl / 1000).toFixed(1)}K` : `$${pool.tvl.toFixed(0)}`;
                    
                    details += `| ${pool.name.slice(0, 15)} | ${protocol} | ${tvl} | ${dailyVol} | ${annVol} | ${price} |\n`;
                    
                    // Add to structured items if volatility was calculated
                    if (!volatility.error) {
                        volatilityItems.push({
                            type: 'volatility' as const,
                            poolName: pool.name,
                            poolAddress: pool.address,
                            protocol: protocolId,
                            currentPrice: volatility.currentPrice,
                            volatilityDaily: volatility.volatilityDaily,
                            volatilityAnnualized: volatility.volatilityAnnualized,
                            priceChange24h: volatility.priceChange24h,
                            priceChange7d: volatility.priceChange7d,
                            tvl: pool.tvl,
                            confidence: volatility.confidence as 'high' | 'medium' | 'low',
                            dataPoints: volatility.dataPoints
                        });
                    }
                }
                
                details += `\n*Note: Volatility calculated from ${args.days || 7} days of historical data.*`;
                
                return { 
                    type: 'success', 
                    title: `${args.tokenA}/${args.tokenB} Volatility`, 
                    details,
                    structuredData: volatilityItems.length > 0 ? {
                        resultType: 'volatility',
                        items: volatilityItems,
                        summary: `Found ${pools.length} pools for ${args.tokenA}/${args.tokenB}`,
                        title: `${args.tokenA}/${args.tokenB} Volatility Analysis`
                    } : undefined
                };
            }
            
            // Single pool by address
            if (!args.poolAddress) {
                return { 
                    type: 'error', 
                    title: 'Missing Parameter', 
                    details: 'Please provide either poolAddress OR tokenA and tokenB (e.g., tokenA="SOL", tokenB="USDC")' 
                };
            }
            
            const days = args.days || 7;
            const volatility = await volatilityService.calculateVolatility(args.poolAddress, days);

            if (volatility.error) {
                return { type: 'error', title: 'Volatility Error', details: volatility.error };
            }

            const confidenceEmoji = {
                'high': '🟢',
                'medium': '🟡',
                'low': '🔴'
            }[volatility.confidence];

            return {
                type: 'success',
                title: 'Pool Volatility',
                details: `📊 **Volatility Analysis**
- Pool: ${args.poolAddress.slice(0, 8)}...
- Current Price: $${volatility.currentPrice.toFixed(4)}

**Volatility:**
- Daily: ${volatility.volatilityDaily.toFixed(2)}%
- Annualized: ${volatility.volatilityAnnualized.toFixed(2)}%

**Price Changes:**
- 24h: ${volatility.priceChange24h >= 0 ? '+' : ''}${volatility.priceChange24h.toFixed(2)}%
- 7d: ${volatility.priceChange7d >= 0 ? '+' : ''}${volatility.priceChange7d.toFixed(2)}%

${confidenceEmoji} Confidence: ${volatility.confidence.toUpperCase()} (${volatility.dataPoints} data points)`
            };
        } catch (err: any) {
            return { type: 'error', title: 'Volatility Error', details: err.message };
        }
    }

    if (name === 'suggestOptimalRangeByVolatility') {
        try {
            setAiStatus('Calculating optimal ranges...');
            
            let poolAddress = args.poolAddress;
            let poolName = '';
            
            // If no poolAddress but tokenA/tokenB provided, find the best pool from Supabase
            if (!poolAddress && args.tokenA && args.tokenB) {
                setAiStatus('Finding best pool for token pair...');
                const pools = await volatilityService.searchPoolsByTokenPair(args.tokenA, args.tokenB, 1);
                
                if (pools.length === 0) {
                    return { 
                        type: 'info', 
                        title: 'No Pool Found', 
                        details: `No pool found in database for ${args.tokenA}/${args.tokenB}.\n\nTry: "liste pools" to see available pools.` 
                    };
                }
                
                poolAddress = pools[0].address;
                poolName = pools[0].name;
            }
            
            if (!poolAddress) {
                return { 
                    type: 'error', 
                    title: 'Missing Parameter', 
                    details: 'Please provide either poolAddress OR tokenA and tokenB' 
                };
            }
            
            // Get volatility
            const volatility = await volatilityService.calculateVolatility(poolAddress, args.days || 7);
            
            if (!volatility.currentPrice || volatility.currentPrice === 0) {
                return { type: 'error', title: 'Range Error', details: 'Could not get current price for pool. Make sure the pool has historical data in the database.' };
            }

            // Get range suggestions
            const ranges = volatilityService.suggestOptimalRanges(volatility.currentPrice, volatility);

            const strategyEmoji = {
                'conservative': '🟢',
                'moderate': '🟡',
                'aggressive': '🔴'
            };

            const poolDisplay = poolName || poolAddress.slice(0, 8) + '...';
            let details = `📐 **Optimal Range Suggestions for ${poolDisplay}**\n`;
            details += `Current Price: $${volatility.currentPrice.toFixed(4)}\n`;
            details += `Daily Volatility: ${volatility.volatilityDaily.toFixed(2)}%\n\n`;

            ranges.forEach(range => {
                const emoji = strategyEmoji[range.strategy];
                details += `${emoji} **${range.strategy.toUpperCase()} (±${range.sigmaMultiple}σ)**\n`;
                details += `   Range: $${range.priceMin.toFixed(4)} - $${range.priceMax.toFixed(4)}\n`;
                details += `   Width: ${range.widthPercent.toFixed(1)}%\n`;
                details += `   ${range.estimatedTimeInRange}\n\n`;
            });

            if (volatility.confidence === 'low') {
                details += `\n⚠️ *Low confidence: ranges based on estimated volatility due to insufficient historical data.*`;
            }

            // Generate rationale for the moderate strategy (most common choice)
            const moderateRange = ranges.find(r => r.strategy === 'moderate');
            const rationale = moderateRange 
                ? lpPolicyService.generateRangeRationale(
                    'moderate',
                    volatility,
                    { tvl: undefined, volume24h: undefined }
                )
                : 'Sugestão de range baseada na volatilidade calculada.';

            // Log to audit
            solanaDealerStore.addLog('INFO', `Range suggestion for ${poolDisplay}`, { 
                strategy: 'all', 
                volatilityDaily: volatility.volatilityDaily,
                currentPrice: volatility.currentPrice
            });

            return { 
                type: 'success', 
                semanticType: 'decision',
                title: 'Range Suggestions', 
                details,
                rationale
            };
        } catch (err: any) {
            return { type: 'error', semanticType: 'analysis', title: 'Range Error', details: err.message };
        }
    }

    // =============================================
    // POOL CREATION
    // =============================================

    if (name === 'createLiquidityPool') {
        return {
            type: 'info',
            title: 'Create Pool',
            details: `**Pool Creation Request**
- Protocol: ${args.protocol}
- Tokens: ${args.tokenA} / ${args.tokenB}
- Fee: ${args.feeBps} bps
- Initial Price: ${args.initialPrice}

⚠️ Pool creation requires SDK integration. Please use the protocol's web interface:
- Meteora: https://devnet.meteora.ag
- Raydium: https://raydium.io (switch to devnet)`
        };
    }

    if (name === 'estimatePoolCreationCost') {
        const costs: Record<string, string> = {
            'meteora_dlmm': '~0.5 SOL',
            'raydium_clmm': '~0.3 SOL',
            'raydium_cpmm': '~0.2 SOL'
        };

        return {
            type: 'success',
            title: 'Pool Creation Cost',
            details: `Estimated cost for ${args.protocol}: ${costs[args.protocol] || '~0.3-0.5 SOL'}

Includes:
- Account rent
- Transaction fees
- Protocol fees (if any)`
        };
    }

    // Not an LP tool
    return null;
}

/**
 * Check if a tool name is an LP-related tool
 */
export function isLPTool(name: string): boolean {
    const lpToolNames = [
        'searchLiquidityPools',
        'getPoolDetails',
        'getTopLiquidityPools',
        'compareLiquidityPools',
        'getPoolHistory',
        'getLPPositions',
        'getLPPositionDetails',
        'getUnclaimedLPRewards',
        'estimateLPPositionPnL',
        'addLiquidity',
        'removeLiquidity',
        'claimLPFees',
        'claimLPRewards',
        'rebalanceLPPosition',
        'simulateAddLiquidity',
        'estimateImpermanentLoss',
        'calculateOptimalPriceRange',
        'getLPSwapQuote',
        'createLiquidityPool',
        'estimatePoolCreationCost',
        // Volatility tools
        'getPoolVolatility',
        'suggestOptimalRangeByVolatility',
        'getTopVolatilityPools'
    ];
    return lpToolNames.includes(name);
}
