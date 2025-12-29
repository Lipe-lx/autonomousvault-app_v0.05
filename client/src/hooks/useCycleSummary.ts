// src/hooks/useCycleSummary.ts
// React hook for consuming cycle summary state

import { useSyncExternalStore, useEffect } from 'react';
import { cycleSummaryStore, DealerType, DealerSummaryState } from '../state/cycleSummaryStore';

export interface CycleSummaryHook {
    summary: string | null;
    isGenerating: boolean;
    cycleCount: number;
    lastUpdate: number;
    hasSummary: boolean;
}

export const useCycleSummary = (dealerType: DealerType): CycleSummaryHook => {
    // Subscribe to store changes
    const state = useSyncExternalStore<DealerSummaryState>(
        (listener) => cycleSummaryStore.subscribe(dealerType, listener),
        () => cycleSummaryStore.getSnapshot(dealerType)
    );

    // Load persisted state on mount
    useEffect(() => {
        cycleSummaryStore.loadState(dealerType);
    }, [dealerType]);

    return {
        summary: state.aiSummary,
        isGenerating: state.isGenerating,
        cycleCount: state.recentCycles.length,
        lastUpdate: state.lastSummaryTime,
        hasSummary: !!state.aiSummary && state.aiSummary.length > 0
    };
};
