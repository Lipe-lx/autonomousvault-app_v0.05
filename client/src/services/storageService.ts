
import { get, set, del, keys, clear } from 'idb-keyval';
import { CryptoService } from './cryptoService';

/**
 * StorageService provides an abstraction over IndexedDB (via idb-keyval).
 * It also handles user-scoped storage and migration from localStorage to IndexedDB.
 */
export class StorageService {

    // --- USER CONTEXT ---
    private static currentUserId: string | null = null;

    /**
     * Set the current user ID for scoped storage operations.
     * Should be called after Firebase auth state changes.
     */
    static setUserId(userId: string | null): void {
        console.log(`[StorageService] User context set to: ${userId ? userId.substring(0, 8) + '...' : 'null'}`);
        this.currentUserId = userId;
    }

    /**
     * Get the current user ID.
     */
    static getUserId(): string | null {
        return this.currentUserId;
    }

    /**
     * Generate a user-scoped key.
     * @param baseKey The base key name (e.g., 'agent_vault_pubkey')
     * @returns User-scoped key (e.g., 'agent_vault_pubkey_abc123')
     */
    static getUserKey(baseKey: string): string {
        if (!this.currentUserId) {
            console.warn(`[StorageService] No user context set! Using global key for: ${baseKey}`);
            return baseKey;
        }
        return `${baseKey}_${this.currentUserId}`;
    }

    // --- CORE OPERATIONS ---

    /**
     * Get a value from storage.
     * @param key The key to retrieve
     * @returns The value or null/undefined
     */
    static async getItem(key: string): Promise<string | null | undefined> {
        try {
            return await get(key);
        } catch (error) {
            console.error(`[StorageService] Failed to get item ${key}:`, error);
            return null;
        }
    }

    /**
     * Set a value in storage.
     * @param key The key to set
     * @param value The value to store
     */
    static async setItem(key: string, value: string): Promise<void> {
        try {
            await set(key, value);
        } catch (error) {
            console.error(`[StorageService] Failed to set item ${key}:`, error);
        }
    }

    /**
     * Remove a value from storage.
     * @param key The key to remove
     */
    static async removeItem(key: string): Promise<void> {
        try {
            await del(key);
        } catch (error) {
            console.error(`[StorageService] Failed to remove item ${key}:`, error);
        }
    }

    /**
     * Clear all data in the storage.
     */
    static async clear(): Promise<void> {
        try {
            await clear();
        } catch (error) {
            console.error('[StorageService] Failed to clear storage:', error);
        }
    }

    /**
     * Clear all data for a specific user.
     * @param userId The user ID whose data should be cleared
     */
    static async clearUserData(userId: string): Promise<void> {
        try {
            const allKeys = await keys();
            const userSuffix = `_${userId}`;
            const userKeys = (allKeys as string[]).filter(key =>
                typeof key === 'string' && key.endsWith(userSuffix)
            );

            console.log(`[StorageService] Clearing ${userKeys.length} keys for user ${userId.substring(0, 8)}...`);

            for (const key of userKeys) {
                await del(key);
            }

            console.log('[StorageService] User data cleared.');
        } catch (error) {
            console.error('[StorageService] Failed to clear user data:', error);
        }
    }

    // --- MIGRATION LOGIC ---

    /**
     * Migration from localStorage to IndexedDB.
     * Should be called once on app startup.
     * Moves all known keys from localStorage to IndexedDB and then clears localStorage.
     */
    static async migrateFromLocalStorage(): Promise<void> {
        console.log('[StorageService] Checking for legacy localStorage data...');

        // List of keys we care about migrating
        const keysToMigrate = [
            'agent_vault_pubkey',
            'agent_vault_enc',
            'agent_owner_pubkey',
            'agent_hl_vault_pubkey',
            'agent_hl_vault_enc',
            'agent_hl_owner_pubkey',
            'agent_pm_vault_pubkey',
            'agent_pm_vault_enc',
            'agent_pm_owner_pubkey',
            'agent_chat_history',
            'agent_chat_sessions',
            'vault_dealer_strategy',
            'agent_activity_log',
            'agent_scheduler_tasks',
            'agent_dealer_settings'
        ];

        let migratedCount = 0;

        for (const key of keysToMigrate) {
            const value = localStorage.getItem(key);
            if (value) {
                try {
                    // Check if it already exists in IDB to avoid overwriting newer data
                    // (Though in a fresh migration scenario, IDB should be empty or strictly older)
                    // For safety, we overwrite IDB with localStorage if localStorage triggers the migration flag.
                    // But to be safer, let's just write.
                    await set(key, value);
                    console.log(`[StorageService] Migrated key: ${key}`);
                    migratedCount++;
                } catch (e) {
                    console.error(`[StorageService] Failed to migrate key ${key}:`, e);
                }
            }
        }

        if (migratedCount > 0) {
            console.log(`[StorageService] Migration complete. Moved ${migratedCount} items.`);
            // Optional: Clear localStorage to prevent confusion? 
            // Better to rename them or clear them to strictly enforce IDB usage.
            // We will clear the specific keys only.
            for (const key of keysToMigrate) {
                localStorage.removeItem(key);
            }
            console.log('[StorageService] Legacy localStorage keys cleared.');
        } else {
            console.log('[StorageService] No legacy data found to migrate.');
        }
    }

    /**
     * Migration from unscoped IndexedDB keys to user-scoped keys.
     * Should be called after user is authenticated and userId is set.
     * This handles data that was saved before user-scoping was added.
     */
    static async migrateToUserScoped(): Promise<void> {
        if (!this.currentUserId) {
            console.warn('[StorageService] Cannot migrate to user-scoped: no userId set');
            return;
        }

        console.log('[StorageService] Checking for unscoped IndexedDB data to migrate...');

        // List of keys that need to be migrated to user-scoped format
        const keysToMigrate = [
            'agent_vault_pubkey',
            'agent_vault_enc',
            'agent_owner_pubkey',
            'agent_hl_vault_pubkey',
            'agent_hl_vault_enc',
            'agent_hl_owner_pubkey',
            'agent_pm_vault_pubkey',
            'agent_pm_vault_enc',
            'agent_pm_owner_pubkey',
            'vault_dealer_strategy',
            'agent_activity_log',
            'agent_scheduler_tasks',
            'agent_conversations_metadata',
            'vault_dealer_storage',
            'vault_polymarket_storage',
            'ai_config_store',
            'vault_balance_history',
            'token_usage_store'
        ];

        // Also migrate conversation data (prefixed keys)
        const allKeys = await keys();
        const conversationKeys = (allKeys as string[]).filter(key =>
            typeof key === 'string' &&
            key.startsWith('agent_conversation_') &&
            !key.includes('_' + this.currentUserId)
        );

        const allKeysToMigrate = [...keysToMigrate, ...conversationKeys];
        let migratedCount = 0;

        for (const key of allKeysToMigrate) {
            try {
                const value = await get(key);
                if (value) {
                    const userScopedKey = `${key}_${this.currentUserId}`;

                    // Check if user-scoped key already exists
                    const existingScoped = await get(userScopedKey);
                    if (!existingScoped) {
                        // Migrate to user-scoped key
                        await set(userScopedKey, value);
                        console.log(`[StorageService] Migrated to user-scoped: ${key} -> ${userScopedKey}`);
                        migratedCount++;
                    }

                    // Delete the old unscoped key to prevent confusion
                    await del(key);
                }
            } catch (e) {
                console.error(`[StorageService] Failed to migrate key ${key}:`, e);
            }
        }

        if (migratedCount > 0) {
            console.log(`[StorageService] User-scoped migration complete. Moved ${migratedCount} items.`);
        } else {
            console.log('[StorageService] No unscoped data found to migrate.');
        }
    }
}
