// SUPABASE INFRA
// Rate limiting and monetization hooks
// NO implementation yet - structural only
//
// Future: This will enforce plan-based limits via RLS

/**
 * User plan tiers
 */
export type PlanTier = 'free' | 'starter' | 'pro' | 'unlimited';

/**
 * Plan limits configuration
 */
export interface PlanLimits {
    tier: PlanTier;
    maxCyclesPerMonth: number;
    maxTradesPerMonth: number;
    maxAITokensPerMonth: number;
    maxStrategies: number;
    maxTradingPairs: number;
    checkIntervalMinSeconds: number;
}

/**
 * Default plan configurations
 */
export const PLAN_LIMITS: Record<PlanTier, PlanLimits> = {
    free: {
        tier: 'free',
        maxCyclesPerMonth: 100,
        maxTradesPerMonth: 20,
        maxAITokensPerMonth: 100000,
        maxStrategies: 1,
        maxTradingPairs: 3,
        checkIntervalMinSeconds: 300 // 5 min minimum
    },
    starter: {
        tier: 'starter',
        maxCyclesPerMonth: 1000,
        maxTradesPerMonth: 100,
        maxAITokensPerMonth: 500000,
        maxStrategies: 3,
        maxTradingPairs: 10,
        checkIntervalMinSeconds: 60 // 1 min minimum
    },
    pro: {
        tier: 'pro',
        maxCyclesPerMonth: 10000,
        maxTradesPerMonth: 500,
        maxAITokensPerMonth: 2000000,
        maxStrategies: 10,
        maxTradingPairs: 50,
        checkIntervalMinSeconds: 30 // 30s minimum
    },
    unlimited: {
        tier: 'unlimited',
        maxCyclesPerMonth: Infinity,
        maxTradesPerMonth: Infinity,
        maxAITokensPerMonth: Infinity,
        maxStrategies: Infinity,
        maxTradingPairs: Infinity,
        checkIntervalMinSeconds: 10 // 10s minimum
    }
};

/**
 * Current usage state
 */
export interface UsageState {
    cyclesUsed: number;
    tradesExecuted: number;
    aiTokensUsed: number;
    periodStart: Date;
    periodEnd: Date;
}

/**
 * Usage check result
 */
export interface UsageCheckResult {
    allowed: boolean;
    reason?: string;
    remainingCycles?: number;
    remainingTrades?: number;
    remainingTokens?: number;
}

/**
 * Check if action is allowed under plan limits
 * STUB: Would query Supabase for current usage
 */
export function checkUsageLimit(
    action: 'cycle' | 'trade' | 'tokens',
    amount: number,
    usage: UsageState,
    limits: PlanLimits
): UsageCheckResult {
    switch (action) {
        case 'cycle':
            if (usage.cyclesUsed + amount > limits.maxCyclesPerMonth) {
                return {
                    allowed: false,
                    reason: `Cycle limit reached (${limits.maxCyclesPerMonth}/month)`,
                    remainingCycles: Math.max(0, limits.maxCyclesPerMonth - usage.cyclesUsed)
                };
            }
            break;
        case 'trade':
            if (usage.tradesExecuted + amount > limits.maxTradesPerMonth) {
                return {
                    allowed: false,
                    reason: `Trade limit reached (${limits.maxTradesPerMonth}/month)`,
                    remainingTrades: Math.max(0, limits.maxTradesPerMonth - usage.tradesExecuted)
                };
            }
            break;
        case 'tokens':
            if (usage.aiTokensUsed + amount > limits.maxAITokensPerMonth) {
                return {
                    allowed: false,
                    reason: `AI token limit reached (${limits.maxAITokensPerMonth}/month)`,
                    remainingTokens: Math.max(0, limits.maxAITokensPerMonth - usage.aiTokensUsed)
                };
            }
            break;
    }

    return { allowed: true };
}

/**
 * STUB: Get user's current plan
 */
export function getUserPlan(userId: string): Promise<PlanTier> {
    // STUB: Would query Supabase
    throw new Error('[STUB] getUserPlan not implemented');
}

/**
 * STUB: Get user's current usage
 */
export function getUserUsage(userId: string): Promise<UsageState> {
    // STUB: Would query Supabase
    throw new Error('[STUB] getUserUsage not implemented');
}

/**
 * STUB: Record usage
 */
export function recordUsage(
    userId: string,
    action: 'cycle' | 'trade' | 'tokens',
    amount: number
): Promise<void> {
    // STUB: Would update Supabase
    throw new Error('[STUB] recordUsage not implemented');
}
