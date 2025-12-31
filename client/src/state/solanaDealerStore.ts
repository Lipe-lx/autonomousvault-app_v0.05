// solanaDealerStore.ts
// State management for Solana LP Dealer

import { StorageService } from '../services/storageService';
import {
    LPPolicyRules,
    DEFAULT_LP_POLICY,
    LPAuditEntry,
    SolanaDealerLog,
    LPPositionSummary,
    SolanaDealerSettings,
    SolanaDealerState,
    LPOperationScope
} from '../types/solanaLPTypes';

// ============================================
// DEFAULT VALUES
// ============================================

const DEFAULT_SETTINGS: SolanaDealerSettings = {
    policy: DEFAULT_LP_POLICY,
    autoClaimFees: false,
    autoRebalance: false,
    rebalanceThresholdPercent: 10
};

const INITIAL_STATE: SolanaDealerState = {
    isOn: false,
    statusMessage: 'Ready',
    statusDetail: 'Awaiting activation',
    activePositions: [],
    totalValueUSD: 0,
    totalUnclaimedFeesUSD: 0,
    settings: DEFAULT_SETTINGS,
    logs: [],
    auditLog: [],
    pendingConfirmation: null
};

// ============================================
// STORE IMPLEMENTATION
// ============================================

class SolanaDealerStore {
    private state: SolanaDealerState;
    private listeners: Set<() => void>;
    private isInitialized: boolean = false;
    private initPromise: Promise<void> | null = null;

    constructor() {
        this.state = INITIAL_STATE;
        this.listeners = new Set();
    }

    // --- Initialization ---
    
    async init(): Promise<void> {
        if (this.isInitialized) return;
        if (this.initPromise) return this.initPromise;

        this.initPromise = (async () => {
            try {
                const saved = await StorageService.getItem('solana_dealer_settings');
                if (saved) {
                    const parsed = JSON.parse(saved);
                    this.state = {
                        ...INITIAL_STATE,
                        settings: { ...DEFAULT_SETTINGS, ...parsed.settings }
                    };
                }
                this.isInitialized = true;
            } catch (error) {
                console.error('[SolanaDealerStore] Failed to load settings:', error);
                this.isInitialized = true;
            }
        })();

        return this.initPromise;
    }

    // --- Subscription ---
    
    subscribe(listener: () => void): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    private notify(): void {
        this.listeners.forEach(listener => listener());
    }

    // --- Getters ---
    
    getState(): SolanaDealerState {
        return this.state;
    }

    getPolicy(): LPPolicyRules {
        return this.state.settings.policy;
    }

    getAuditLog(): LPAuditEntry[] {
        return this.state.auditLog;
    }

    getLogs(): SolanaDealerLog[] {
        return this.state.logs;
    }

    // --- State Updates ---
    
    setStatus(message: string, detail?: string): void {
        this.state = {
            ...this.state,
            statusMessage: message,
            statusDetail: detail || this.state.statusDetail
        };
        this.notify();
    }

    setOn(isOn: boolean): void {
        this.state = { ...this.state, isOn };
        this.notify();
        this.addLog('INFO', isOn ? 'Solana Dealer activated' : 'Solana Dealer deactivated');
    }

    // --- Policy Management ---
    
    updatePolicy(policy: Partial<LPPolicyRules>): void {
        this.state = {
            ...this.state,
            settings: {
                ...this.state.settings,
                policy: { ...this.state.settings.policy, ...policy }
            }
        };
        this.notify();
        this.saveSettings();
        this.addLog('POLICY', 'Policy updated', policy);
    }

    resetPolicy(): void {
        this.state = {
            ...this.state,
            settings: {
                ...this.state.settings,
                policy: DEFAULT_LP_POLICY
            }
        };
        this.notify();
        this.saveSettings();
        this.addLog('POLICY', 'Policy reset to defaults');
    }

    // --- Audit Log ---
    
    addAuditEntry(entry: Omit<LPAuditEntry, 'id' | 'timestamp'>): string {
        const id = `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const newEntry: LPAuditEntry = {
            ...entry,
            id,
            timestamp: Date.now()
        };

        this.state = {
            ...this.state,
            auditLog: [newEntry, ...this.state.auditLog].slice(0, 500) // Keep last 500 entries
        };
        this.notify();
        this.saveAuditLog();
        
        return id;
    }

    updateAuditEntry(id: string, updates: Partial<LPAuditEntry>): void {
        this.state = {
            ...this.state,
            auditLog: this.state.auditLog.map(entry =>
                entry.id === id ? { ...entry, ...updates } : entry
            )
        };
        this.notify();
        this.saveAuditLog();
    }

    // --- General Logs ---
    
    addLog(type: SolanaDealerLog['type'], message: string, details?: any): void {
        const log: SolanaDealerLog = {
            id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            timestamp: Date.now(),
            type,
            message,
            details
        };

        this.state = {
            ...this.state,
            logs: [log, ...this.state.logs].slice(0, 200) // Keep last 200 logs
        };
        this.notify();
    }

    clearLogs(): void {
        this.state = { ...this.state, logs: [] };
        this.notify();
    }

    // --- Positions ---
    
    updatePositions(positions: LPPositionSummary[]): void {
        const totalValueUSD = positions.reduce((sum, p) => sum + p.valueUSD, 0);
        const totalUnclaimedFeesUSD = positions.reduce((sum, p) => sum + p.unclaimedFeesUSD, 0);

        this.state = {
            ...this.state,
            activePositions: positions,
            totalValueUSD,
            totalUnclaimedFeesUSD
        };
        this.notify();
    }

    // --- Confirmation Flow ---
    
    setPendingConfirmation(confirmation: SolanaDealerState['pendingConfirmation']): void {
        this.state = { ...this.state, pendingConfirmation: confirmation };
        this.notify();
    }

    clearPendingConfirmation(): void {
        this.state = { ...this.state, pendingConfirmation: null };
        this.notify();
    }

    // --- Persistence ---
    
    private async saveSettings(): Promise<void> {
        try {
            await StorageService.setItem('solana_dealer_settings', JSON.stringify({
                settings: this.state.settings
            }));
        } catch (error) {
            console.error('[SolanaDealerStore] Failed to save settings:', error);
        }
    }

    private async saveAuditLog(): Promise<void> {
        try {
            // Save only last 100 audit entries to storage
            await StorageService.setItem('solana_dealer_audit', JSON.stringify(
                this.state.auditLog.slice(0, 100)
            ));
        } catch (error) {
            console.error('[SolanaDealerStore] Failed to save audit log:', error);
        }
    }

    async loadAuditLog(): Promise<void> {
        try {
            const saved = await StorageService.getItem('solana_dealer_audit');
            if (saved) {
                const parsed = JSON.parse(saved);
                this.state = {
                    ...this.state,
                    auditLog: parsed
                };
                this.notify();
            }
        } catch (error) {
            console.error('[SolanaDealerStore] Failed to load audit log:', error);
        }
    }

    // --- Utility Methods ---
    
    /**
     * Get recent audit entries for a specific scope
     */
    getAuditByScope(scope: LPOperationScope, limit: number = 10): LPAuditEntry[] {
        return this.state.auditLog
            .filter(entry => entry.scope === scope)
            .slice(0, limit);
    }

    /**
     * Get audit entries for a specific pool
     */
    getAuditByPool(poolAddress: string, limit: number = 10): LPAuditEntry[] {
        return this.state.auditLog
            .filter(entry => entry.poolAddress === poolAddress)
            .slice(0, limit);
    }

    /**
     * Get summary statistics
     */
    getStats(): {
        totalOperations: number;
        successfulOperations: number;
        failedOperations: number;
        policyViolations: number;
    } {
        const log = this.state.auditLog;
        return {
            totalOperations: log.length,
            successfulOperations: log.filter(e => e.status === 'executed').length,
            failedOperations: log.filter(e => e.status === 'failed').length,
            policyViolations: log.filter(e => e.policyViolations && e.policyViolations.length > 0).length
        };
    }
}

// Singleton export
export const solanaDealerStore = new SolanaDealerStore();

// Hook for React components
export function useSolanaDealerStore(): SolanaDealerState {
    const [state, setState] = React.useState(solanaDealerStore.getState());

    React.useEffect(() => {
        solanaDealerStore.init();
        return solanaDealerStore.subscribe(() => {
            setState(solanaDealerStore.getState());
        });
    }, []);

    return state;
}

// Need to import React for the hook
import React from 'react';
