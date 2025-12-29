// ADAPTER
// IndexedDB Storage Adapter
// Implements StorageAdapter interface using idb-keyval
//
// This adapter provides browser-side persistent storage

import type { StorageAdapter, UserScopedStorageAdapter, EncryptedStorageAdapter } from './storage.adapter';

// Note: When building, import from idb-keyval
// import { get, set, del, keys, clear } from 'idb-keyval';
// For now, we define the interface

/**
 * IndexedDB Storage Adapter Implementation
 * Uses idb-keyval for simple key-value storage
 */
export class IndexedDBStorageAdapter implements UserScopedStorageAdapter {
    private userId: string | null = null;
    private dbPrefix: string;

    constructor(dbPrefix: string = 'vault') {
        this.dbPrefix = dbPrefix;
    }

    /**
     * Set current user ID for scoped storage
     */
    setUserId(userId: string | null): void {
        this.userId = userId;
    }

    /**
     * Get current user ID
     */
    getUserId(): string | null {
        return this.userId;
    }

    /**
     * Build scoped key
     */
    private buildKey(key: string): string {
        if (this.userId) {
            return `${this.dbPrefix}:${this.userId}:${key}`;
        }
        return `${this.dbPrefix}:${key}`;
    }

    /**
     * Get a value from storage
     */
    async get<T>(key: string): Promise<T | null> {
        const scopedKey = this.buildKey(key);

        // Using native IndexedDB for now
        return new Promise((resolve) => {
            const request = indexedDB.open(this.dbPrefix, 1);

            request.onupgradeneeded = () => {
                const db = request.result;
                if (!db.objectStoreNames.contains('keyval')) {
                    db.createObjectStore('keyval');
                }
            };

            request.onsuccess = () => {
                const db = request.result;
                const tx = db.transaction('keyval', 'readonly');
                const store = tx.objectStore('keyval');
                const getRequest = store.get(scopedKey);

                getRequest.onsuccess = () => {
                    resolve(getRequest.result ?? null);
                };

                getRequest.onerror = () => {
                    resolve(null);
                };
            };

            request.onerror = () => {
                resolve(null);
            };
        });
    }

    /**
     * Set a value in storage
     */
    async set<T>(key: string, value: T): Promise<void> {
        const scopedKey = this.buildKey(key);

        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbPrefix, 1);

            request.onupgradeneeded = () => {
                const db = request.result;
                if (!db.objectStoreNames.contains('keyval')) {
                    db.createObjectStore('keyval');
                }
            };

            request.onsuccess = () => {
                const db = request.result;
                const tx = db.transaction('keyval', 'readwrite');
                const store = tx.objectStore('keyval');
                store.put(value, scopedKey);

                tx.oncomplete = () => resolve();
                tx.onerror = () => reject(tx.error);
            };

            request.onerror = () => {
                reject(request.error);
            };
        });
    }

    /**
     * Remove a value from storage
     */
    async remove(key: string): Promise<void> {
        const scopedKey = this.buildKey(key);

        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbPrefix, 1);

            request.onsuccess = () => {
                const db = request.result;
                const tx = db.transaction('keyval', 'readwrite');
                const store = tx.objectStore('keyval');
                store.delete(scopedKey);

                tx.oncomplete = () => resolve();
                tx.onerror = () => reject(tx.error);
            };

            request.onerror = () => {
                reject(request.error);
            };
        });
    }

    /**
     * List all keys with a given prefix
     */
    async keys(prefix?: string): Promise<string[]> {
        const scopedPrefix = this.buildKey(prefix || '');

        return new Promise((resolve) => {
            const request = indexedDB.open(this.dbPrefix, 1);

            request.onsuccess = () => {
                const db = request.result;
                const tx = db.transaction('keyval', 'readonly');
                const store = tx.objectStore('keyval');
                const allKeysRequest = store.getAllKeys();

                allKeysRequest.onsuccess = () => {
                    const allKeys = (allKeysRequest.result as string[]).filter(k =>
                        typeof k === 'string' && k.startsWith(scopedPrefix)
                    );
                    resolve(allKeys);
                };

                allKeysRequest.onerror = () => resolve([]);
            };

            request.onerror = () => resolve([]);
        });
    }

    /**
     * Clear all storage
     */
    async clear(): Promise<void> {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbPrefix, 1);

            request.onsuccess = () => {
                const db = request.result;
                const tx = db.transaction('keyval', 'readwrite');
                const store = tx.objectStore('keyval');
                store.clear();

                tx.oncomplete = () => resolve();
                tx.onerror = () => reject(tx.error);
            };

            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Clear all data for a specific user
     */
    async clearUserData(userId: string): Promise<void> {
        const userPrefix = `${this.dbPrefix}:${userId}:`;
        const userKeys = await this.keys(userPrefix);

        for (const key of userKeys) {
            await this.remove(key);
        }
    }
}

/**
 * Create IndexedDB storage adapter
 */
export function createIndexedDBStorageAdapter(dbPrefix?: string): IndexedDBStorageAdapter {
    return new IndexedDBStorageAdapter(dbPrefix);
}
