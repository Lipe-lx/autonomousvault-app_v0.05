// Supabase Dealer Client
// Frontend service for invoking Supabase Edge Functions
// Used for Tier B (Session) and Tier C (Persistent) execution modes

import { getSupabaseClient } from './supabase/client';

/**
 * Dealer cycle parameters
 */
export interface DealerCycleParams {
    coins: string[];
    settings: {
        intervalMs: number;
        maxPositions: number;
        maxLeverage: number;
        slPercent?: number;
        tpPercent?: number;
        indicatorSettings?: any;
        strategyPrompt?: string;
    };
    aiConfig: {
        provider: 'gemini' | 'openai' | 'claude';
        apiKey: string;
        modelId: string;
        systemPrompt?: string;
    };
    executeTradesIfSignal: boolean;
}

/**
 * Decision from AI analysis
 */
export interface AIDecision {
    coin: string;
    action: 'BUY' | 'SELL' | 'CLOSE' | 'HOLD';
    confidence: number;
    reason: string;
    executed?: boolean;
    orderId?: string;
    error?: string;
}

/**
 * Cycle result from Edge Function
 */
export interface CycleResult {
    success: boolean;
    decisions: AIDecision[];
    usage: {
        cyclesUsed: number;
        cyclesRemaining: number;
    };
    timestamp: string;
    error?: string;
}

/**
 * Schedule configuration
 */
export interface ScheduleConfig {
    enabled: boolean;
    intervalSeconds: number;
    coins: string[];
}

/**
 * Supabase Dealer Client
 * 
 * Invokes Edge Functions for Tier B/C execution modes
 */
class SupabaseDealerClient {
    private supabase = getSupabaseClient();

    /**
     * Check if Supabase is available
     */
    isAvailable(): boolean {
        return this.supabase !== null;
    }

    /**
     * Run a single dealer cycle via Edge Function
     * 
     * @param params Cycle parameters
     * @returns Cycle result with decisions
     */
    async runCycle(params: DealerCycleParams): Promise<CycleResult> {
        if (!this.supabase) {
            throw new Error('Supabase not connected');
        }

        const { data, error } = await this.supabase.functions.invoke('dealer-cycle', {
            body: params
        });

        if (error) {
            console.error('[SupabaseDealerClient] Cycle error:', error);
            return {
                success: false,
                decisions: [],
                usage: { cyclesUsed: 0, cyclesRemaining: 0 },
                timestamp: new Date().toISOString(),
                error: error.message
            };
        }

        return data as CycleResult;
    }

    /**
     * Sync portfolio from Edge Function
     */
    async syncPortfolio(): Promise<{
        positions: any[];
        portfolioValue: number;
        error?: string;
    }> {
        if (!this.supabase) {
            throw new Error('Supabase not connected');
        }

        const { data, error } = await this.supabase.functions.invoke('sync-portfolio', {
            body: {}
        });

        if (error) {
            console.error('[SupabaseDealerClient] Sync error:', error);
            return {
                positions: [],
                portfolioValue: 0,
                error: error.message
            };
        }

        return data;
    }

    /**
     * Enable scheduled execution (cron)
     * 
     * @param config Schedule configuration
     */
    async enableSchedule(config: ScheduleConfig): Promise<{ success: boolean; error?: string }> {
        if (!this.supabase) {
            throw new Error('Supabase not connected');
        }

        const { data: { user } } = await this.supabase.auth.getUser();
        if (!user) {
            return { success: false, error: 'Not authenticated' };
        }

        const { error } = await this.supabase
            .from('cron_schedules')
            .upsert({
                user_id: user.id,
                schedule_name: 'default',
                enabled: config.enabled,
                interval_seconds: config.intervalSeconds,
                coins: config.coins,
                next_run_at: config.enabled ? new Date().toISOString() : null
            }, {
                onConflict: 'user_id,schedule_name'
            });

        if (error) {
            console.error('[SupabaseDealerClient] Schedule error:', error);
            return { success: false, error: error.message };
        }

        return { success: true };
    }

    /**
     * Disable scheduled execution
     */
    async disableSchedule(): Promise<{ success: boolean; error?: string }> {
        return this.enableSchedule({
            enabled: false,
            intervalSeconds: 300,
            coins: []
        });
    }

    /**
     * Get current schedule status
     */
    async getScheduleStatus(): Promise<{
        enabled: boolean;
        intervalSeconds: number;
        coins: string[];
        lastRunAt?: Date;
        nextRunAt?: Date;
        runCount: number;
        lastError?: string;
    } | null> {
        if (!this.supabase) return null;

        const { data: { user } } = await this.supabase.auth.getUser();
        if (!user) return null;

        const { data, error } = await this.supabase
            .from('cron_schedules')
            .select('*')
            .eq('user_id', user.id)
            .eq('schedule_name', 'default')
            .single();

        if (error || !data) return null;

        return {
            enabled: data.enabled,
            intervalSeconds: data.interval_seconds,
            coins: data.coins || [],
            lastRunAt: data.last_run_at ? new Date(data.last_run_at) : undefined,
            nextRunAt: data.next_run_at ? new Date(data.next_run_at) : undefined,
            runCount: data.run_count || 0,
            lastError: data.last_error
        };
    }

    /**
     * Get execution session status (Tier B)
     */
    async getSessionStatus(): Promise<{
        hasActiveSession: boolean;
        expiresAt?: Date;
        tier: 'local' | 'session' | 'persistent';
    }> {
        if (!this.supabase) {
            return { hasActiveSession: false, tier: 'local' };
        }

        const { data: { user } } = await this.supabase.auth.getUser();
        if (!user) {
            return { hasActiveSession: false, tier: 'local' };
        }

        // Check for stored password (Tier C)
        const { data: keyData } = await this.supabase
            .from('encrypted_keys')
            .select('encrypted_password')
            .eq('user_id', user.id)
            .eq('key_name', 'hyperliquid')
            .single();

        if (keyData?.encrypted_password) {
            return { hasActiveSession: true, tier: 'persistent' };
        }

        // Check for active session (Tier B)
        const { data: sessionData } = await this.supabase
            .from('execution_sessions')
            .select('expires_at')
            .eq('user_id', user.id)
            .eq('revoked', false)
            .gt('expires_at', new Date().toISOString())
            .order('expires_at', { ascending: false })
            .limit(1)
            .single();

        if (sessionData) {
            return {
                hasActiveSession: true,
                expiresAt: new Date(sessionData.expires_at),
                tier: 'session'
            };
        }

        return { hasActiveSession: false, tier: 'local' };
    }

    /**
     * Get usage statistics
     */
    async getUsageStats(): Promise<{
        cyclesExecuted: number;
        tradesExecuted: number;
        cyclesRemaining: number;
        periodStart: Date;
    } | null> {
        if (!this.supabase) return null;

        const { data: { user } } = await this.supabase.auth.getUser();
        if (!user) return null;

        // Get current period start (first of month)
        const now = new Date();
        const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);

        const { data, error } = await this.supabase
            .from('usage_tracking')
            .select('*')
            .eq('user_id', user.id)
            .eq('period_start', periodStart.toISOString().split('T')[0])
            .single();

        if (error && error.code !== 'PGRST116') {
            console.error('[SupabaseDealerClient] Usage error:', error);
            return null;
        }

        // Get user's plan limits
        const { data: planData } = await this.supabase
            .from('user_plans')
            .select('cycles_limit')
            .eq('user_id', user.id)
            .single();

        const cyclesLimit = planData?.cycles_limit || 1000; // Default limit

        return {
            cyclesExecuted: data?.cycles_executed || 0,
            tradesExecuted: data?.trades_executed || 0,
            cyclesRemaining: Math.max(0, cyclesLimit - (data?.cycles_executed || 0)),
            periodStart
        };
    }
}

// Singleton export
export const supabaseDealerClient = new SupabaseDealerClient();
