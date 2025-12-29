// src/state/balanceHistoryStore.ts
// Stores balance snapshots for the Portfolio Evolution chart
// - Daily snapshots for long-term history (1W, 1M, 1Y)
// - 15-minute snapshots for intraday view (1D)

import { StorageService } from '../services/storageService';

export interface BalanceSnapshot {
    date: string; // YYYY-MM-DD format
    timestamp: number;
    solValue: number; // SOL balance in USD
    hlValue: number; // Hyperliquid equity in USD
    pmValue: number; // Polymarket equity in USD
    totalValue: number;
}

export interface IntradaySnapshot {
    timestamp: number;
    timeKey: string; // HH:MM format (15-min intervals)
    solValue: number;
    hlValue: number;
    pmValue: number;
    totalValue: number;
}

const STORAGE_KEY = 'vault_balance_history';
const INTRADAY_STORAGE_KEY = 'vault_intraday_history';
const MAX_DAYS = 90; // Keep 90 days of history
const MAX_INTRADAY_POINTS = 96; // 24 hours * 4 (15-min intervals)

class BalanceHistoryStore {
    private history: BalanceSnapshot[] = [];
    private intradayHistory: IntradaySnapshot[] = [];
    private listeners: Set<() => void> = new Set();
    private isInitialized: boolean = false;
    private initPromise: Promise<void> | null = null;

    constructor() {
        this.initPromise = this.initialize();
    }

    async initialize(): Promise<void> {
        if (this.isInitialized) return;
        await this.loadFromStorage();
        this.isInitialized = true;
        this.notify();
    }

    async waitForInit(): Promise<void> {
        if (this.initPromise) {
            await this.initPromise;
        }
    }

    private async loadFromStorage(): Promise<void> {
        try {
            const saved = await StorageService.getItem(StorageService.getUserKey(STORAGE_KEY));
            if (saved) {
                this.history = JSON.parse(saved);
            }
            const intradaySaved = await StorageService.getItem(StorageService.getUserKey(INTRADAY_STORAGE_KEY));
            if (intradaySaved) {
                this.intradayHistory = JSON.parse(intradaySaved);
                // Clean up old intraday data (keep only last 24 hours)
                const cutoff = Date.now() - 24 * 60 * 60 * 1000;
                this.intradayHistory = this.intradayHistory.filter(s => s.timestamp > cutoff);
            }
        } catch (e) {
            console.error('[BalanceHistory] Failed to load:', e);
            this.history = [];
            this.intradayHistory = [];
        }
    }

    private async saveToStorage(): Promise<void> {
        try {
            await StorageService.setItem(
                StorageService.getUserKey(STORAGE_KEY),
                JSON.stringify(this.history)
            );
            await StorageService.setItem(
                StorageService.getUserKey(INTRADAY_STORAGE_KEY),
                JSON.stringify(this.intradayHistory)
            );
        } catch (e) {
            console.error('[BalanceHistory] Failed to save:', e);
        }
    }

    private notify(): void {
        this.listeners.forEach(listener => listener());
    }

    private getTodayDate(): string {
        return new Date().toISOString().split('T')[0];
    }

    private get15MinTimeKey(): string {
        const now = new Date();
        const minutes = Math.floor(now.getMinutes() / 15) * 15;
        return `${now.getHours().toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    }

    // --- Public API ---

    /**
     * Reload history from storage. Should be called after user login.
     */
    public async reloadFromStorage(): Promise<void> {
        console.log('[BalanceHistory] Reloading from storage...');
        await this.loadFromStorage();
        this.notify();
    }

    /**
     * Reset history to empty. Should be called on logout.
     */
    public reset(): void {
        console.log('[BalanceHistory] Resetting history...');
        this.history = [];
        this.intradayHistory = [];
        this.notify();
    }

    public subscribe(listener: () => void): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    public getSnapshot(): BalanceSnapshot[] {
        return this.history;
    }

    /**
     * Record balance snapshot.
     * - Saves one snapshot per day for long-term history
     * - Saves one snapshot per 15-minute interval for intraday history
     */
    public recordSnapshot(solValue: number, hlValue: number, pmValue: number): void {
        const today = this.getTodayDate();
        const totalValue = solValue + hlValue + pmValue;
        const now = Date.now();

        // --- Daily Snapshot ---
        const existingIndex = this.history.findIndex(s => s.date === today);

        const newSnapshot: BalanceSnapshot = {
            date: today,
            timestamp: now,
            solValue,
            hlValue,
            pmValue,
            totalValue
        };

        if (existingIndex >= 0) {
            // Update today's snapshot
            this.history[existingIndex] = newSnapshot;
        } else {
            // Add new snapshot
            this.history.push(newSnapshot);
        }

        // Sort by date and keep only last MAX_DAYS
        this.history.sort((a, b) => a.date.localeCompare(b.date));
        if (this.history.length > MAX_DAYS) {
            this.history = this.history.slice(-MAX_DAYS);
        }

        // --- Intraday Snapshot (15-min intervals) ---
        const timeKey = this.get15MinTimeKey();

        // Clean up old intraday data (keep only last 24 hours)
        const cutoff = now - 24 * 60 * 60 * 1000;
        this.intradayHistory = this.intradayHistory.filter(s => s.timestamp > cutoff);

        // Check if we already have a snapshot for this 15-min interval
        const existingIntradayIndex = this.intradayHistory.findIndex(s => s.timeKey === timeKey && now - s.timestamp < 15 * 60 * 1000);

        const newIntradaySnapshot: IntradaySnapshot = {
            timestamp: now,
            timeKey,
            solValue,
            hlValue,
            pmValue,
            totalValue
        };

        if (existingIntradayIndex >= 0) {
            // Update existing 15-min snapshot
            this.intradayHistory[existingIntradayIndex] = newIntradaySnapshot;
        } else {
            // Add new 15-min snapshot
            this.intradayHistory.push(newIntradaySnapshot);
        }

        // Keep only last MAX_INTRADAY_POINTS
        if (this.intradayHistory.length > MAX_INTRADAY_POINTS) {
            this.intradayHistory = this.intradayHistory.slice(-MAX_INTRADAY_POINTS);
        }

        this.saveToStorage(); // Fire and forget
        this.notify();

        console.log(`[BalanceHistory] 📸 Snapshot saved: SOL=$${solValue.toFixed(2)}, HL=$${hlValue.toFixed(2)}, PM=$${pmValue.toFixed(2)} [${timeKey}]`);
    }

    /**
     * Get history for the chart.
     * For days=1, returns intraday 15-min snapshots.
     * For days>1, returns daily snapshots.
     */
    public getHistoryForChart(days: number = 30): {
        date: string;
        value: number;
        solValue: number;
        hlValue: number;
        pmValue: number;
    }[] {
        // For 1 day, return intraday data with 15-min intervals
        if (days === 1) {
            return this.intradayHistory.map(snapshot => ({
                date: snapshot.timeKey,
                value: snapshot.totalValue,
                solValue: snapshot.solValue,
                hlValue: snapshot.hlValue,
                pmValue: snapshot.pmValue
            }));
        }

        // For longer periods, return daily data
        const recentHistory = this.history.slice(-days);

        return recentHistory.map(snapshot => ({
            date: new Date(snapshot.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            value: snapshot.totalValue,
            solValue: snapshot.solValue,
            hlValue: snapshot.hlValue,
            pmValue: snapshot.pmValue
        }));
    }

    /**
     * Check if we have enough history to display the chart.
     */
    public hasHistory(): boolean {
        return this.history.length > 0 || this.intradayHistory.length > 0;
    }

    /**
     * Get the number of days in history.
     */
    public getHistoryDays(): number {
        return this.history.length;
    }

    /**
     * Check if we have intraday data.
     */
    public hasIntradayHistory(): boolean {
        return this.intradayHistory.length > 0;
    }

    /**
     * Clear all history (for debugging/reset).
     */
    public clearHistory(): void {
        this.history = [];
        this.intradayHistory = [];
        this.saveToStorage();
        this.notify();
    }
}

export const balanceHistoryStore = new BalanceHistoryStore();
