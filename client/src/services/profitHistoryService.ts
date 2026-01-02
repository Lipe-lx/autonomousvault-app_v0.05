/**
 * ProfitHistoryService - Manages portfolio value snapshots for Performance Curve
 * 
 * Captures real portfolio snapshots for accurate performance tracking.
 * Stores data in IndexedDB (via StorageService) for user privacy.
 */

import { StorageService } from './storageService';

const STORAGE_KEY = 'hl_dealer_profit_history';
const MAX_SNAPSHOTS = 1000; // ~10 days at 15s intervals
const DEDUP_THRESHOLD_MS = 60000; // 60 seconds - don't record if value unchanged within this window

export interface ProfitSnapshot {
    timestamp: number;
    portfolioValue: number;      // Account value from marginSummary
    unrealizedPnl: number;       // Sum of unrealized PnL across positions
    positionCount: number;       // Number of open positions
    trigger: 'sync' | 'trade';   // What triggered this snapshot
}

class ProfitHistoryService {
    private cache: ProfitSnapshot[] | null = null;
    private lastValue: number | null = null;
    private lastTimestamp: number = 0;

    /**
     * Record a new portfolio snapshot.
     * Deduplicates if value unchanged within threshold.
     */
    async recordSnapshot(snapshot: ProfitSnapshot): Promise<void> {
        // Deduplication: Skip if value unchanged and within time threshold
        const timeSinceLast = snapshot.timestamp - this.lastTimestamp;
        const valueUnchanged = this.lastValue !== null && 
            Math.abs(snapshot.portfolioValue - this.lastValue) < 0.01;
        
        // Always record trade triggers, but dedupe sync triggers
        if (snapshot.trigger === 'sync' && valueUnchanged && timeSinceLast < DEDUP_THRESHOLD_MS) {
            return;
        }

        // Load existing history
        const history = await this.loadHistory();
        
        // Append new snapshot
        history.push(snapshot);
        
        // Trim to max size (remove oldest)
        if (history.length > MAX_SNAPSHOTS) {
            history.splice(0, history.length - MAX_SNAPSHOTS);
        }

        // Save
        await this.saveHistory(history);
        
        // Update cache
        this.cache = history;
        this.lastValue = snapshot.portfolioValue;
        this.lastTimestamp = snapshot.timestamp;
        
        console.log(`[ProfitHistory] 📊 Recorded snapshot: $${snapshot.portfolioValue.toFixed(2)} (${snapshot.trigger})`);
    }

    /**
     * Get history, optionally filtered by baseline timestamp.
     */
    async getHistory(fromTimestamp?: number): Promise<ProfitSnapshot[]> {
        const history = await this.loadHistory();
        
        if (fromTimestamp) {
            return history.filter(s => s.timestamp >= fromTimestamp);
        }
        
        return history;
    }

    /**
     * Clear all history for the user.
     */
    async clearHistory(): Promise<void> {
        await StorageService.removeItem(StorageService.getUserKey(STORAGE_KEY));
        this.cache = null;
        this.lastValue = null;
        this.lastTimestamp = 0;
        console.log('[ProfitHistory] 🗑️ History cleared');
    }

    /**
     * Load history from storage.
     */
    private async loadHistory(): Promise<ProfitSnapshot[]> {
        if (this.cache !== null) {
            return this.cache;
        }

        try {
            const stored = await StorageService.getItem(StorageService.getUserKey(STORAGE_KEY));
            if (stored) {
                this.cache = JSON.parse(stored);
                // Update last value from most recent entry
                if (this.cache && this.cache.length > 0) {
                    const last = this.cache[this.cache.length - 1];
                    this.lastValue = last.portfolioValue;
                    this.lastTimestamp = last.timestamp;
                }
                return this.cache;
            }
        } catch (e) {
            console.warn('[ProfitHistory] Failed to load history:', e);
        }

        this.cache = [];
        return this.cache;
    }

    /**
     * Save history to storage.
     */
    private async saveHistory(history: ProfitSnapshot[]): Promise<void> {
        try {
            await StorageService.setItem(
                StorageService.getUserKey(STORAGE_KEY),
                JSON.stringify(history)
            );
        } catch (e) {
            console.error('[ProfitHistory] Failed to save history:', e);
        }
    }
}

export const profitHistoryService = new ProfitHistoryService();
