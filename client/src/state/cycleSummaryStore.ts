// src/state/cycleSummaryStore.ts
// Unified cycle summary store for Hyperliquid and Polymarket Dealers

import { StorageService } from '../services/storageService';

// ============================================
// TYPES
// ============================================

export type DealerType = 'hyperliquid' | 'polymarket';

export interface CycleDecision {
    asset: string;      // Coin symbol or market question
    action: string;     // BUY, SELL, HOLD, CLOSE, etc.
    confidence: number; // 0-1
}

export interface CycleRecord {
    timestamp: number;
    decisions: CycleDecision[];
    assetsAnalyzed: string[];
    cycleNumber: number;
}

export interface DealerSummaryState {
    recentCycles: CycleRecord[];    // Last 5 cycles (rolling window)
    aiSummary: string | null;       // AI-generated contextual summary
    lastSummaryTime: number;        // Timestamp of last AI summary
    isGenerating: boolean;          // Loading state for UI
}

// ============================================
// CONSTANTS
// ============================================

const MAX_CYCLES = 5;
const STORAGE_KEY_PREFIX = 'dealer_cycle_summary';

// ============================================
// INITIAL STATE
// ============================================

const INITIAL_STATE: DealerSummaryState = {
    recentCycles: [],
    aiSummary: null,
    lastSummaryTime: 0,
    isGenerating: false
};

// ============================================
// STORE IMPLEMENTATION
// ============================================

class CycleSummaryStore {
    private state: Map<DealerType, DealerSummaryState> = new Map();
    private listeners: Map<DealerType, Set<() => void>> = new Map();
    private initialized: Map<DealerType, boolean> = new Map();

    constructor() {
        // Initialize maps for both dealer types
        this.state.set('hyperliquid', { ...INITIAL_STATE });
        this.state.set('polymarket', { ...INITIAL_STATE });
        this.listeners.set('hyperliquid', new Set());
        this.listeners.set('polymarket', new Set());
        this.initialized.set('hyperliquid', false);
        this.initialized.set('polymarket', false);
    }

    // --- STORAGE ---

    private getStorageKey(dealerType: DealerType): string {
        return StorageService.getUserKey(`${STORAGE_KEY_PREFIX}_${dealerType}`);
    }

    async loadState(dealerType: DealerType): Promise<void> {
        if (this.initialized.get(dealerType)) return;

        try {
            const key = this.getStorageKey(dealerType);
            const saved = await StorageService.getItem(key);

            if (saved) {
                const parsed = JSON.parse(saved);
                this.state.set(dealerType, {
                    ...INITIAL_STATE,
                    ...parsed,
                    isGenerating: false // Always reset loading state
                });
                console.log(`[CycleSummaryStore] Loaded ${dealerType} state: ${parsed.recentCycles?.length || 0} cycles`);
            }
        } catch (e) {
            console.warn(`[CycleSummaryStore] Failed to load ${dealerType} state:`, e);
        }

        this.initialized.set(dealerType, true);
    }

    private async saveState(dealerType: DealerType): Promise<void> {
        try {
            const key = this.getStorageKey(dealerType);
            const state = this.state.get(dealerType);
            if (state) {
                // Don't persist isGenerating
                const { isGenerating, ...persistState } = state;
                await StorageService.setItem(key, JSON.stringify(persistState));
            }
        } catch (e) {
            console.warn(`[CycleSummaryStore] Failed to save ${dealerType} state:`, e);
        }
    }

    // --- STATE ACCESS ---

    getSnapshot(dealerType: DealerType): DealerSummaryState {
        return this.state.get(dealerType) || { ...INITIAL_STATE };
    }

    // --- SUBSCRIPTIONS ---

    subscribe(dealerType: DealerType, listener: () => void): () => void {
        const listeners = this.listeners.get(dealerType);
        if (listeners) {
            listeners.add(listener);
        }
        return () => {
            listeners?.delete(listener);
        };
    }

    private notify(dealerType: DealerType): void {
        const listeners = this.listeners.get(dealerType);
        listeners?.forEach(l => l());
    }

    // --- ACTIONS ---

    /**
     * Record a completed cycle
     */
    recordCycle(dealerType: DealerType, record: Omit<CycleRecord, 'cycleNumber'>): void {
        const state = this.state.get(dealerType);
        if (!state) return;

        const cycleNumber = state.recentCycles.length + 1;
        const newCycle: CycleRecord = {
            ...record,
            cycleNumber
        };

        // Add to front, keep only MAX_CYCLES
        const updatedCycles = [newCycle, ...state.recentCycles].slice(0, MAX_CYCLES);

        this.state.set(dealerType, {
            ...state,
            recentCycles: updatedCycles
        });

        this.notify(dealerType);
        this.saveState(dealerType);

        console.log(`[CycleSummaryStore] Recorded ${dealerType} cycle #${cycleNumber}: ${record.decisions.length} decisions`);
    }

    /**
     * Set generating state (for UI loading indicator)
     */
    setGenerating(dealerType: DealerType, isGenerating: boolean): void {
        const state = this.state.get(dealerType);
        if (!state) return;

        this.state.set(dealerType, {
            ...state,
            isGenerating
        });
        this.notify(dealerType);
    }

    /**
     * Update AI-generated summary
     */
    setSummary(dealerType: DealerType, summary: string): void {
        const state = this.state.get(dealerType);
        if (!state) return;

        this.state.set(dealerType, {
            ...state,
            aiSummary: summary,
            lastSummaryTime: Date.now(),
            isGenerating: false
        });

        this.notify(dealerType);
        this.saveState(dealerType);

        console.log(`[CycleSummaryStore] Updated ${dealerType} AI summary (${summary.length} chars)`);
    }

    /**
     * Clear all data for a dealer
     */
    clear(dealerType: DealerType): void {
        this.state.set(dealerType, { ...INITIAL_STATE });
        this.notify(dealerType);
        this.saveState(dealerType);
    }

    /**
     * Get formatted context for AI prompt
     * Returns a compact string summarizing recent activity
     */
    getContextForAI(dealerType: DealerType): string | null {
        const state = this.state.get(dealerType);
        if (!state || !state.aiSummary) return null;

        return state.aiSummary;
    }

    /**
     * Get raw cycles for summary generation
     */
    getCyclesForSummary(dealerType: DealerType): CycleRecord[] {
        const state = this.state.get(dealerType);
        return state?.recentCycles || [];
    }
}

// Singleton export
export const cycleSummaryStore = new CycleSummaryStore();
