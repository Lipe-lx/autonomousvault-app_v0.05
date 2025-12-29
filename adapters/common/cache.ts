// ADAPTER
// Memory-based Cache with TTL
// Provides in-memory caching for API responses

/**
 * Cache entry with TTL
 */
interface CacheEntry<T> {
    value: T;
    expiresAt: number;
}

/**
 * Cache configuration
 */
export interface CacheConfig {
    /** Default TTL in milliseconds */
    defaultTtlMs: number;
    /** Maximum entries before cleanup */
    maxEntries: number;
}

/**
 * Memory Cache with TTL support
 */
export class MemoryCache {
    private cache = new Map<string, CacheEntry<any>>();
    private config: CacheConfig;

    constructor(config: Partial<CacheConfig> = {}) {
        this.config = {
            defaultTtlMs: 5000,  // 5 seconds default
            maxEntries: 1000,
            ...config
        };
    }

    /**
     * Get value from cache
     */
    get<T>(key: string): T | null {
        const entry = this.cache.get(key);

        if (!entry) return null;

        // Check expiration
        if (Date.now() > entry.expiresAt) {
            this.cache.delete(key);
            return null;
        }

        return entry.value as T;
    }

    /**
     * Set value in cache
     */
    set<T>(key: string, value: T, ttlMs?: number): void {
        // Cleanup if at max capacity
        if (this.cache.size >= this.config.maxEntries) {
            this.cleanup();
        }

        this.cache.set(key, {
            value,
            expiresAt: Date.now() + (ttlMs || this.config.defaultTtlMs)
        });
    }

    /**
     * Check if key exists and is not expired
     */
    has(key: string): boolean {
        const entry = this.cache.get(key);
        if (!entry) return false;

        if (Date.now() > entry.expiresAt) {
            this.cache.delete(key);
            return false;
        }

        return true;
    }

    /**
     * Delete a key
     */
    delete(key: string): boolean {
        return this.cache.delete(key);
    }

    /**
     * Delete all keys matching a prefix
     */
    deleteByPrefix(prefix: string): number {
        let count = 0;
        for (const key of this.cache.keys()) {
            if (key.startsWith(prefix)) {
                this.cache.delete(key);
                count++;
            }
        }
        return count;
    }

    /**
     * Clear all entries
     */
    clear(): void {
        this.cache.clear();
    }

    /**
     * Cleanup expired entries
     */
    cleanup(): number {
        const now = Date.now();
        let removed = 0;

        for (const [key, entry] of this.cache.entries()) {
            if (now > entry.expiresAt) {
                this.cache.delete(key);
                removed++;
            }
        }

        return removed;
    }

    /**
     * Get cache statistics
     */
    getStats(): { size: number; maxEntries: number } {
        return {
            size: this.cache.size,
            maxEntries: this.config.maxEntries
        };
    }

    /**
     * Get or set with factory function
     */
    async getOrSet<T>(
        key: string,
        factory: () => Promise<T>,
        ttlMs?: number
    ): Promise<T> {
        const cached = this.get<T>(key);
        if (cached !== null) return cached;

        const value = await factory();
        this.set(key, value, ttlMs);
        return value;
    }
}

/**
 * Singleton cache for market data
 */
export const marketDataCache = new MemoryCache({
    defaultTtlMs: 2000,  // 2 seconds for prices
    maxEntries: 500
});

/**
 * Singleton cache for metadata (longer TTL)
 */
export const metadataCache = new MemoryCache({
    defaultTtlMs: 300000,  // 5 minutes for metadata
    maxEntries: 100
});

/**
 * Create custom cache
 */
export function createMemoryCache(config?: Partial<CacheConfig>): MemoryCache {
    return new MemoryCache(config);
}
