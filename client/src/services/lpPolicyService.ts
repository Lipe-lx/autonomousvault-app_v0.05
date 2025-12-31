// lpPolicyService.ts
// Policy Engine for LP Operations - validates operations against configurable rules

import {
    LPPolicyRules,
    LPOperationScope,
    LP_SCOPE_METADATA
} from '../types/solanaLPTypes';
import { VolatilityResult } from './volatilityService';

// ============================================
// POLICY VALIDATION RESULT
// ============================================

export interface PolicyValidationResult {
    allowed: boolean;
    violations: string[];
    warnings: string[];
}

// ============================================
// POLICY SERVICE
// ============================================

class LPPolicyService {
    /**
     * Validate an LP operation against policy rules
     */
    validateOperation(
        operation: LPOperationScope,
        params: {
            poolAddress?: string;
            poolName?: string;
            rangeWidthPercent?: number;
            capitalPercent?: number;
            capitalUSD?: number;
            tokens?: string[];
            protocol?: string;
            tvl?: number;
            volume24h?: number;
            apy?: number;
        },
        policy: LPPolicyRules
    ): PolicyValidationResult {
        const violations: string[] = [];
        const warnings: string[] = [];

        // If policy is disabled, allow everything
        if (!policy.enabled) {
            return { allowed: true, violations: [], warnings: [] };
        }

        // --- Range Width Validation ---
        if (params.rangeWidthPercent !== undefined) {
            if (params.rangeWidthPercent > policy.maxRangeWidthPercent) {
                violations.push(
                    `Range width ${params.rangeWidthPercent.toFixed(1)}% exceeds maximum allowed ${policy.maxRangeWidthPercent}%`
                );
            }
            if (params.rangeWidthPercent < policy.minRangeWidthPercent) {
                violations.push(
                    `Range width ${params.rangeWidthPercent.toFixed(1)}% is below minimum required ${policy.minRangeWidthPercent}%`
                );
            }
        }

        // --- Capital Constraints ---
        if (params.capitalPercent !== undefined && params.capitalPercent > policy.maxCapitalPerPoolPercent) {
            violations.push(
                `Capital allocation ${params.capitalPercent.toFixed(1)}% exceeds maximum ${policy.maxCapitalPerPoolPercent}% per pool`
            );
        }

        // --- TVL Requirement ---
        if (params.tvl !== undefined && params.tvl < policy.minTVLRequired) {
            violations.push(
                `Pool TVL $${params.tvl.toLocaleString()} is below minimum required $${policy.minTVLRequired.toLocaleString()}`
            );
        }

        // --- Volume Requirement ---
        if (params.volume24h !== undefined && params.volume24h < policy.minVolumeRequired) {
            violations.push(
                `24h volume $${params.volume24h.toLocaleString()} is below minimum required $${policy.minVolumeRequired.toLocaleString()}`
            );
        }

        // --- APY Requirement ---
        if (params.apy !== undefined && params.apy < policy.minAPYRequired) {
            warnings.push(
                `Pool APY ${params.apy.toFixed(2)}% is below preferred minimum ${policy.minAPYRequired}%`
            );
        }

        // --- Token Allowlist ---
        if (params.tokens && policy.tokenAllowlist.length > 0) {
            const disallowedTokens = params.tokens.filter(
                token => !policy.tokenAllowlist.some(
                    allowed => allowed.toUpperCase() === token.toUpperCase()
                )
            );
            if (disallowedTokens.length > 0) {
                violations.push(
                    `Token(s) not in allowlist: ${disallowedTokens.join(', ')}`
                );
            }
        }

        // --- Token Blocklist ---
        if (params.tokens && policy.tokenBlocklist.length > 0) {
            const blockedTokens = params.tokens.filter(
                token => policy.tokenBlocklist.some(
                    blocked => blocked.toUpperCase() === token.toUpperCase()
                )
            );
            if (blockedTokens.length > 0) {
                violations.push(
                    `Blocked token(s) detected: ${blockedTokens.join(', ')}`
                );
            }
        }

        // --- Protocol Allowlist ---
        if (params.protocol && policy.protocolAllowlist.length > 0) {
            const isAllowed = policy.protocolAllowlist.some(
                allowed => params.protocol!.toLowerCase().includes(allowed.toLowerCase())
            );
            if (!isAllowed) {
                violations.push(
                    `Protocol "${params.protocol}" is not in the allowed list`
                );
            }
        }

        return {
            allowed: violations.length === 0,
            violations,
            warnings
        };
    }

    /**
     * Check if an operation requires user confirmation
     */
    requiresConfirmation(operation: LPOperationScope, policy: LPPolicyRules): boolean {
        if (!policy.enabled) return false;
        return policy.requireConfirmationFor.includes(operation);
    }

    /**
     * Get risk level for an operation scope
     */
    getRiskLevel(operation: LPOperationScope): 'low' | 'medium' | 'high' {
        return LP_SCOPE_METADATA[operation]?.riskLevel || 'medium';
    }

    /**
     * Generate rationale for a range selection decision
     */
    generateRangeRationale(
        strategy: 'conservative' | 'moderate' | 'aggressive',
        volatility: VolatilityResult,
        poolData?: { volume24h?: number; tvl?: number; apy?: number }
    ): string {
        const parts: string[] = [];

        // Strategy description
        const strategyDesc = {
            conservative: 'Faixa ampla (±2σ)',
            moderate: 'Faixa moderada (±1.5σ)',
            aggressive: 'Faixa estreita (±1σ)'
        }[strategy];

        parts.push(`${strategyDesc} selecionada`);

        // Volatility reason
        if (volatility.volatilityDaily > 0) {
            parts.push(`devido à volatilidade diária de ${volatility.volatilityDaily.toFixed(2)}%`);
        }

        // Volume context
        if (poolData?.volume24h && poolData.volume24h > 0) {
            const volumeStr = poolData.volume24h >= 1000
                ? `$${(poolData.volume24h / 1000).toFixed(1)}K`
                : `$${poolData.volume24h.toFixed(0)}`;
            parts.push(`volume 24h de ${volumeStr}`);
        }

        // TVL context
        if (poolData?.tvl && poolData.tvl > 0) {
            const tvlStr = poolData.tvl >= 1000000
                ? `$${(poolData.tvl / 1000000).toFixed(2)}M`
                : poolData.tvl >= 1000
                    ? `$${(poolData.tvl / 1000).toFixed(1)}K`
                    : `$${poolData.tvl.toFixed(0)}`;
            parts.push(`TVL de ${tvlStr}`);
        }

        // APY context
        if (poolData?.apy && poolData.apy > 0) {
            parts.push(`APY estimado de ${poolData.apy.toFixed(2)}%`);
        }

        // Confidence note
        if (volatility.confidence === 'low') {
            parts.push('(dados históricos limitados)');
        } else if (volatility.confidence === 'high') {
            parts.push('(alta confiança nos dados)');
        }

        // Combine parts naturally in Portuguese
        if (parts.length <= 2) {
            return parts.join(' ');
        }

        const lastPart = parts.pop();
        return parts.join(', ') + ' e ' + lastPart;
    }

    /**
     * Generate rationale for opening a position
     */
    generateOpenPositionRationale(
        poolName: string,
        strategy: 'conservative' | 'moderate' | 'aggressive',
        rangeMin: number,
        rangeMax: number,
        volatility: VolatilityResult,
        capitalUSD: number
    ): string {
        const rangeWidth = ((rangeMax - rangeMin) / volatility.currentPrice) * 100;
        
        let rationale = `Abertura de posição em ${poolName} com estratégia ${strategy}. `;
        rationale += `Range de $${rangeMin.toFixed(4)} a $${rangeMax.toFixed(4)} (${rangeWidth.toFixed(1)}% de largura). `;
        rationale += `Capital: $${capitalUSD.toLocaleString()}. `;
        
        if (volatility.volatilityDaily > 5) {
            rationale += `⚠️ Alta volatilidade (${volatility.volatilityDaily.toFixed(2)}%/dia) - maior risco de sair do range. `;
        } else if (volatility.volatilityDaily < 2) {
            rationale += `Baixa volatilidade (${volatility.volatilityDaily.toFixed(2)}%/dia) - range deve permanecer ativo. `;
        }

        if (volatility.priceChange24h > 10) {
            rationale += `Preço subiu ${volatility.priceChange24h.toFixed(2)}% em 24h - considere range assimétrico para cima.`;
        } else if (volatility.priceChange24h < -10) {
            rationale += `Preço caiu ${Math.abs(volatility.priceChange24h).toFixed(2)}% em 24h - considere range assimétrico para baixo.`;
        }

        return rationale.trim();
    }

    /**
     * Generate rationale for closing a position
     */
    generateClosePositionRationale(
        poolName: string,
        inRange: boolean,
        unclaimedFees: number,
        reason?: string
    ): string {
        let rationale = `Fechamento de posição em ${poolName}. `;
        
        if (!inRange) {
            rationale += `Posição fora do range - não está gerando fees. `;
        }
        
        if (unclaimedFees > 0) {
            rationale += `Fees não coletados: $${unclaimedFees.toFixed(2)} serão resgatados automaticamente. `;
        }
        
        if (reason) {
            rationale += reason;
        }

        return rationale.trim();
    }

    /**
     * Generate rationale for rebalancing
     */
    generateRebalanceRationale(
        poolName: string,
        oldRange: { min: number; max: number },
        newRange: { min: number; max: number },
        currentPrice: number,
        volatility: VolatilityResult
    ): string {
        let rationale = `Rebalanceamento de ${poolName}. `;
        rationale += `Range anterior: $${oldRange.min.toFixed(4)} - $${oldRange.max.toFixed(4)}. `;
        rationale += `Novo range: $${newRange.min.toFixed(4)} - $${newRange.max.toFixed(4)}. `;
        rationale += `Preço atual: $${currentPrice.toFixed(4)}. `;
        
        // Calculate position relative to old range
        if (currentPrice < oldRange.min) {
            const pctBelow = ((oldRange.min - currentPrice) / oldRange.min) * 100;
            rationale += `Preço ${pctBelow.toFixed(1)}% abaixo do range anterior. `;
        } else if (currentPrice > oldRange.max) {
            const pctAbove = ((currentPrice - oldRange.max) / oldRange.max) * 100;
            rationale += `Preço ${pctAbove.toFixed(1)}% acima do range anterior. `;
        }

        rationale += `Volatilidade: ${volatility.volatilityDaily.toFixed(2)}%/dia.`;

        return rationale.trim();
    }
}

// Singleton export
export const lpPolicyService = new LPPolicyService();
