// Local Data Provider
// Implements DataProviderAdapter using IndexedDB (via idb-keyval)
// This is the default provider for Tier A (Local Keys)

import { get, set, del, keys } from 'idb-keyval';
import { StorageService } from '../../client/src/services/storageService';
import type {
    DataProviderAdapter,
    Trade,
    EncryptedKey,
    DealerSettings
} from './data-provider.adapter';

// Storage keys
const STORAGE_KEYS = {
    SETTINGS_PREFIX: 'av_settings_',
    TRADES: 'av_trade_history',
    KEYS_PREFIX: 'av_key_'
};

export class LocalDataProvider implements DataProviderAdapter {
    readonly name = 'LocalDataProvider';
    private userId: string | null = null;

    constructor(userId?: string) {
        this.userId = userId || null;
    }

    async initialize(): Promise<void> {
        // Load userId from StorageService if not provided
        if (!this.userId) {
            this.userId = StorageService.getUserId();
        }
        console.log(`[LocalDataProvider] Initialized for user: ${this.userId?.substring(0, 8) || 'anonymous'}`);
    }

    private getUserKey(baseKey: string): string {
        if (!this.userId) return baseKey;
        return `${baseKey}_${this.userId}`;
    }

    // --- Settings ---

    async getSettings<T extends object>(key: string): Promise<T | null> {
        try {
            const storageKey = this.getUserKey(`${STORAGE_KEYS.SETTINGS_PREFIX}${key}`);
            const data = await get(storageKey);
            return data ? JSON.parse(data as string) : null;
        } catch (e) {
            console.error('[LocalDataProvider] getSettings error:', e);
            return null;
        }
    }

    async saveSettings<T extends object>(key: string, value: T): Promise<void> {
        try {
            const storageKey = this.getUserKey(`${STORAGE_KEYS.SETTINGS_PREFIX}${key}`);
            await set(storageKey, JSON.stringify(value));
        } catch (e) {
            console.error('[LocalDataProvider] saveSettings error:', e);
            throw e;
        }
    }

    async deleteSettings(key: string): Promise<void> {
        try {
            const storageKey = this.getUserKey(`${STORAGE_KEYS.SETTINGS_PREFIX}${key}`);
            await del(storageKey);
        } catch (e) {
            console.error('[LocalDataProvider] deleteSettings error:', e);
        }
    }

    // --- Trade History ---

    async getTrades(limit: number = 50, coin?: string): Promise<Trade[]> {
        try {
            const storageKey = this.getUserKey(STORAGE_KEYS.TRADES);
            const data = await get(storageKey);
            let trades: Trade[] = data ? JSON.parse(data as string) : [];

            // Parse dates
            trades = trades.map(t => ({
                ...t,
                createdAt: new Date(t.createdAt)
            }));

            // Filter by coin if specified
            if (coin) {
                trades = trades.filter(t => t.coin.toUpperCase() === coin.toUpperCase());
            }

            // Sort by date descending and limit
            return trades
                .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
                .slice(0, limit);
        } catch (e) {
            console.error('[LocalDataProvider] getTrades error:', e);
            return [];
        }
    }

    async saveTrade(trade: Omit<Trade, 'id' | 'createdAt'>): Promise<Trade> {
        try {
            const storageKey = this.getUserKey(STORAGE_KEYS.TRADES);

            // Get existing trades
            const data = await get(storageKey);
            const trades: Trade[] = data ? JSON.parse(data as string) : [];

            // Create new trade with ID and timestamp
            const newTrade: Trade = {
                ...trade,
                id: `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                createdAt: new Date()
            };

            // Add to beginning and limit to 500 trades
            trades.unshift(newTrade);
            const limitedTrades = trades.slice(0, 500);

            await set(storageKey, JSON.stringify(limitedTrades));
            return newTrade;
        } catch (e) {
            console.error('[LocalDataProvider] saveTrade error:', e);
            throw e;
        }
    }

    // --- Encrypted Keys ---

    async getEncryptedKey(keyName: string): Promise<EncryptedKey | null> {
        try {
            const storageKey = this.getUserKey(`${STORAGE_KEYS.KEYS_PREFIX}${keyName}`);
            const data = await get(storageKey);
            return data ? JSON.parse(data as string) : null;
        } catch (e) {
            console.error('[LocalDataProvider] getEncryptedKey error:', e);
            return null;
        }
    }

    async saveEncryptedKey(keyName: string, data: Omit<EncryptedKey, 'keyName'>): Promise<void> {
        try {
            const storageKey = this.getUserKey(`${STORAGE_KEYS.KEYS_PREFIX}${keyName}`);
            const fullKey: EncryptedKey = {
                keyName,
                ...data
            };
            await set(storageKey, JSON.stringify(fullKey));
        } catch (e) {
            console.error('[LocalDataProvider] saveEncryptedKey error:', e);
            throw e;
        }
    }

    async deleteEncryptedKey(keyName: string): Promise<void> {
        try {
            const storageKey = this.getUserKey(`${STORAGE_KEYS.KEYS_PREFIX}${keyName}`);
            await del(storageKey);
        } catch (e) {
            console.error('[LocalDataProvider] deleteEncryptedKey error:', e);
        }
    }

    // --- Sync Operations ---

    async syncToRemote(targetProvider: DataProviderAdapter): Promise<{ synced: number; errors: string[] }> {
        const errors: string[] = [];
        let synced = 0;

        try {
            // Sync settings
            const allKeys = await keys();
            const settingsKeys = (allKeys as string[]).filter(k =>
                k.startsWith(STORAGE_KEYS.SETTINGS_PREFIX) &&
                (this.userId ? k.includes(this.userId) : true)
            );

            for (const fullKey of settingsKeys) {
                try {
                    const baseKey = fullKey.replace(STORAGE_KEYS.SETTINGS_PREFIX, '').replace(`_${this.userId}`, '');
                    const value = await this.getSettings(baseKey);
                    if (value) {
                        await targetProvider.saveSettings(baseKey, value);
                        synced++;
                    }
                } catch (e) {
                    errors.push(`Settings ${fullKey}: ${e}`);
                }
            }

            // Sync trades
            const trades = await this.getTrades(500);
            for (const trade of trades) {
                try {
                    const { id, createdAt, ...tradeData } = trade;
                    await targetProvider.saveTrade(tradeData);
                    synced++;
                } catch (e) {
                    errors.push(`Trade ${trade.id}: ${e}`);
                }
            }

            // Sync keys
            const keyNames = ['hyperliquid', 'polymarket', 'solana'];
            for (const keyName of keyNames) {
                try {
                    const key = await this.getEncryptedKey(keyName);
                    if (key) {
                        const { keyName: _, ...keyData } = key;
                        await targetProvider.saveEncryptedKey(keyName, keyData);
                        synced++;
                    }
                } catch (e) {
                    errors.push(`Key ${keyName}: ${e}`);
                }
            }
        } catch (e) {
            errors.push(`Sync failed: ${e}`);
        }

        return { synced, errors };
    }

    async isAvailable(): Promise<boolean> {
        try {
            // Test IndexedDB availability
            await get('__test__');
            return true;
        } catch {
            return false;
        }
    }
}

export function createLocalDataProvider(userId?: string): LocalDataProvider {
    return new LocalDataProvider(userId);
}
