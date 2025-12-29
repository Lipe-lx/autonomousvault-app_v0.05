import { useState, useEffect } from 'react';
import { VaultState } from '../types';
import { solanaService } from '../services/solanaService';
import { hyperliquidService } from '../services/hyperliquidService';
import { StorageService } from '../services/storageService';

export interface ActivityItem {
    type: string;
    desc: string;
    time: string;
    status: string;
    signature?: string;
    network: 'solana' | 'hyperliquid';
    timestamp: number;
}

export const useActivityFeed = (vault: VaultState) => {
    const [activityFeed, setActivityFeed] = useState<ActivityItem[]>([]);
    const [localActivityLog, setLocalActivityLog] = useState<any[]>([]);
    const [activityDisplayCount, setActivityDisplayCount] = useState(4);

    // Load activity log from IndexedDB on mount
    useEffect(() => {
        const loadActivityLog = async () => {
            const key = StorageService.getUserKey('agent_activity_log');
            const saved = await StorageService.getItem(key);
            if (saved) {
                setLocalActivityLog(JSON.parse(saved));
            }
        };
        loadActivityLog();
    }, []);

    const addActivityLog = (type: string, desc: string, signature: string) => {
        const newLog = {
            type,
            desc,
            signature,
            timestamp: Date.now(),
            status: 'pending'
        };
        setLocalActivityLog(prev => {
            const updated = [newLog, ...prev].slice(0, 50);
            StorageService.setItem(StorageService.getUserKey('agent_activity_log'), JSON.stringify(updated));
            return updated;
        });
    };

    // Fetch real transaction history from both networks
    useEffect(() => {
        if (!vault.isUnlocked) return;

        const fetchHistory = async () => {
            try {
                // Skip fetch if dealer is actively analyzing (dealer has priority)
                if (hyperliquidService.isDealerActive()) {
                    console.log('[ActivityFeed] ⏸️  Skipping fetch - dealer is active');
                    return;
                }

                const allActivity: ActivityItem[] = [];

                // Fetch Solana transactions
                if (vault.publicKey) {
                    const solanaHistory = await solanaService.getRecentTransactions(vault.publicKey);
                    const solanaTxs = solanaHistory.map(tx => ({
                        type: tx.err ? 'Failed' : 'Transaction',
                        desc: `Signature: ${tx.signature.slice(0, 8)}...`,
                        time: tx.blockTime ? new Date(tx.blockTime * 1000).toLocaleTimeString() : 'Unknown',
                        status: tx.err ? 'failed' : 'success',
                        signature: tx.signature,
                        network: 'solana' as const,
                        timestamp: tx.blockTime ? tx.blockTime * 1000 : 0
                    }));
                    allActivity.push(...solanaTxs);
                }

                // Fetch Hyperliquid fills (using shared cache)
                if (vault.hlPublicKey) {
                    const hlFills = await hyperliquidService.getUserFillsShared(vault.hlPublicKey, 20);
                    const hlTxs = hlFills.map(fill => {
                        const side = fill.side === 'B' ? 'Buy' : 'Sell';
                        const dir = fill.dir || side;
                        const pnl = parseFloat(fill.closedPnl || '0');
                        const pnlText = pnl !== 0 ? ` (PnL: ${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)})` : '';

                        return {
                            type: dir,
                            desc: `${fill.coin} ${parseFloat(fill.sz).toFixed(4)} @ $${parseFloat(fill.px).toFixed(2)}${pnlText}`,
                            time: new Date(fill.time).toLocaleTimeString(),
                            status: 'success',
                            signature: `hl-${fill.tid}`,
                            network: 'hyperliquid' as const,
                            timestamp: fill.time
                        };
                    });
                    allActivity.push(...hlTxs);
                }

                // Sort by timestamp (newest first)
                allActivity.sort((a, b) => b.timestamp - a.timestamp);
                setActivityFeed(allActivity);

            } catch (error) {
                console.error('Failed to fetch history', error);
            }
        };

        fetchHistory();
        const interval = setInterval(fetchHistory, 30000); // Refresh every 30s
        return () => clearInterval(interval);
    }, [vault.isUnlocked, vault.publicKey, vault.hlPublicKey]);

    return {
        activityFeed,
        localActivityLog,
        activityDisplayCount,
        setActivityDisplayCount,
        addActivityLog
    };
};
