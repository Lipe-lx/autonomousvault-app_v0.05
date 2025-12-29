// Token Usage Store - Tracks AI token consumption for cost analysis

import { StorageService } from '../services/storageService';

export interface TokenUsageRecord {
    id: string;
    timestamp: number;
    source: 'MANAGER' | 'DEALER' | 'POLYMARKET_DEALER';
    operation: 'QUERY' | 'ANALYSIS' | 'BATCH_ANALYSIS' | 'CYCLE_SUMMARY';
    inputTokens: number;
    outputTokens: number;
    model: string;
    metadata?: {
        coinsAnalyzed?: number;
        toolsUsed?: string[];
        conversationId?: string;
    };
}

export interface TokenPricing {
    inputPricePerMillion: number;
    outputPricePerMillion: number;
    customModelPricing?: Record<string, { input: number; output: number }>;
}

export interface TokenUsageState {
    records: TokenUsageRecord[];
    pricing: TokenPricing;
}

export interface TokenUsageStats {
    totalInputTokens: number;
    totalOutputTokens: number;
    totalCost: number;
    bySource: {
        MANAGER: { input: number; output: number; cost: number; count: number };
        DEALER: { input: number; output: number; cost: number; count: number };
        POLYMARKET_DEALER: { input: number; output: number; cost: number; count: number };
    };
    byOperation: Record<string, { input: number; output: number; cost: number; count: number }>;
    today: { input: number; output: number; cost: number };
    thisMonth: { input: number; output: number; cost: number };
    dealerMetrics: {
        avgTokensPerCoin: number;
        avgTokensPerCycle: number;
        totalCoinsAnalyzed: number;
    };
    managerMetrics: {
        avgTokensPerQuery: number;
        totalQueries: number;
    };
}

const DEFAULT_PRICING: TokenPricing = {
    inputPricePerMillion: 0.15,  // Gemini 2.5 Flash
    outputPricePerMillion: 0.60,
    customModelPricing: {
        'gemini-3-flash-preview': { input: 0.15, output: 0.60 },
        'gemini-2.5-pro': { input: 1.25, output: 10.00 },
        'gemini-2.5-flash': { input: 0.15, output: 0.60 },
        'gemini-2.5-flash-lite': { input: 0.075, output: 0.30 },
        'gemini-2.0-flash': { input: 0.10, output: 0.40 },
        'gemini-2.0-flash-lite': { input: 0.075, output: 0.30 },
    }
};

const INITIAL_STATE: TokenUsageState = {
    records: [],
    pricing: DEFAULT_PRICING
};

const STORAGE_KEY = 'token_usage_store';

class TokenUsageStore {
    private state: TokenUsageState;
    private listeners: Set<() => void>;
    private isInitialized: boolean = false;
    private initPromise: Promise<void> | null = null;

    constructor() {
        this.state = INITIAL_STATE;
        this.listeners = new Set();
        this.initPromise = this.initialize();
    }

    async initialize(): Promise<void> {
        if (this.isInitialized) return;
        await this.loadState();
        this.isInitialized = true;
        this.notifyListeners();
    }

    async waitForInit(): Promise<void> {
        if (this.initPromise) {
            await this.initPromise;
        }
    }

    private async loadState(): Promise<void> {
        try {
            const saved = await StorageService.getItem(StorageService.getUserKey(STORAGE_KEY));
            if (saved) {
                const parsed = JSON.parse(saved);
                this.state = {
                    ...INITIAL_STATE,
                    ...parsed,
                    pricing: {
                        ...DEFAULT_PRICING,
                        ...(parsed.pricing || {})
                    }
                };
            }
        } catch (e) {
            console.error('[TokenUsageStore] Failed to load state:', e);
        }
    }

    private async saveState(): Promise<void> {
        try {
            await StorageService.setItem(
                StorageService.getUserKey(STORAGE_KEY),
                JSON.stringify(this.state)
            );
        } catch (e) {
            console.error('[TokenUsageStore] Failed to save state:', e);
        }
    }

    private notifyListeners() {
        this.listeners.forEach(listener => listener());
    }

    private notify() {
        this.notifyListeners();
        this.saveState(); // Fire and forget
    }

    // --- Public API ---

    public subscribe(listener: () => void) {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    public getSnapshot() {
        return this.state;
    }

    public addRecord(record: Omit<TokenUsageRecord, 'id' | 'timestamp'>) {
        const newRecord: TokenUsageRecord = {
            ...record,
            id: Date.now().toString() + Math.random().toString().slice(2, 6),
            timestamp: Date.now()
        };

        // Keep last 1000 records
        const updatedRecords = [newRecord, ...this.state.records].slice(0, 1000);

        this.state = { ...this.state, records: updatedRecords };
        this.notify();

        console.log(`[TokenUsageStore] Recorded: ${record.source} ${record.operation} - In: ${record.inputTokens}, Out: ${record.outputTokens}`);
    }

    public updatePricing(pricing: Partial<TokenPricing>) {
        this.state = {
            ...this.state,
            pricing: { ...this.state.pricing, ...pricing }
        };
        this.notify();
    }

    public clearHistory() {
        this.state = { ...this.state, records: [] };
        this.notify();
    }

    private calculateCost(inputTokens: number, outputTokens: number, model?: string): number {
        const pricing = this.state.pricing;

        // Check for model-specific pricing
        if (model && pricing.customModelPricing?.[model]) {
            const modelPricing = pricing.customModelPricing[model];
            return (inputTokens * modelPricing.input / 1_000_000) +
                (outputTokens * modelPricing.output / 1_000_000);
        }

        // Default pricing
        return (inputTokens * pricing.inputPricePerMillion / 1_000_000) +
            (outputTokens * pricing.outputPricePerMillion / 1_000_000);
    }

    public getStats(): TokenUsageStats {
        const records = this.state.records;
        const now = new Date();
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

        // Initialize stats
        const stats: TokenUsageStats = {
            totalInputTokens: 0,
            totalOutputTokens: 0,
            totalCost: 0,
            bySource: {
                MANAGER: { input: 0, output: 0, cost: 0, count: 0 },
                DEALER: { input: 0, output: 0, cost: 0, count: 0 },
                POLYMARKET_DEALER: { input: 0, output: 0, cost: 0, count: 0 }
            },
            byOperation: {},
            today: { input: 0, output: 0, cost: 0 },
            thisMonth: { input: 0, output: 0, cost: 0 },
            dealerMetrics: {
                avgTokensPerCoin: 0,
                avgTokensPerCycle: 0,
                totalCoinsAnalyzed: 0
            },
            managerMetrics: {
                avgTokensPerQuery: 0,
                totalQueries: 0
            }
        };

        // Dealer-specific tracking
        let dealerTotalTokens = 0;
        let dealerCycles = 0;

        for (const record of records) {
            const cost = this.calculateCost(record.inputTokens, record.outputTokens, record.model);

            // Totals
            stats.totalInputTokens += record.inputTokens;
            stats.totalOutputTokens += record.outputTokens;
            stats.totalCost += cost;

            // By source
            stats.bySource[record.source].input += record.inputTokens;
            stats.bySource[record.source].output += record.outputTokens;
            stats.bySource[record.source].cost += cost;
            stats.bySource[record.source].count++;

            // By operation
            if (!stats.byOperation[record.operation]) {
                stats.byOperation[record.operation] = { input: 0, output: 0, cost: 0, count: 0 };
            }
            stats.byOperation[record.operation].input += record.inputTokens;
            stats.byOperation[record.operation].output += record.outputTokens;
            stats.byOperation[record.operation].cost += cost;
            stats.byOperation[record.operation].count++;

            // Time-based stats
            if (record.timestamp >= startOfDay) {
                stats.today.input += record.inputTokens;
                stats.today.output += record.outputTokens;
                stats.today.cost += cost;
            }
            if (record.timestamp >= startOfMonth) {
                stats.thisMonth.input += record.inputTokens;
                stats.thisMonth.output += record.outputTokens;
                stats.thisMonth.cost += cost;
            }

            // Dealer-specific metrics
            if (record.source === 'DEALER') {
                dealerTotalTokens += record.inputTokens + record.outputTokens;
                dealerCycles++;
                if (record.metadata?.coinsAnalyzed) {
                    stats.dealerMetrics.totalCoinsAnalyzed += record.metadata.coinsAnalyzed;
                }
            }

            // Manager-specific metrics
            if (record.source === 'MANAGER') {
                stats.managerMetrics.totalQueries++;
            }
        }

        // Calculate averages
        if (stats.dealerMetrics.totalCoinsAnalyzed > 0) {
            stats.dealerMetrics.avgTokensPerCoin = dealerTotalTokens / stats.dealerMetrics.totalCoinsAnalyzed;
        }
        if (dealerCycles > 0) {
            stats.dealerMetrics.avgTokensPerCycle = dealerTotalTokens / dealerCycles;
        }
        if (stats.managerMetrics.totalQueries > 0) {
            const managerTotalTokens = stats.bySource.MANAGER.input + stats.bySource.MANAGER.output;
            stats.managerMetrics.avgTokensPerQuery = managerTotalTokens / stats.managerMetrics.totalQueries;
        }

        return stats;
    }

    public getRecords(limit: number = 50, source?: 'MANAGER' | 'DEALER'): TokenUsageRecord[] {
        let records = this.state.records;
        if (source) {
            records = records.filter(r => r.source === source);
        }
        return records.slice(0, limit);
    }
}

export const tokenUsageStore = new TokenUsageStore();
