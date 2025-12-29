// ADAPTER
// Storage adapter interface - boundary between core and persistence
// Defines how data storage is abstracted (IndexedDB, Supabase, etc.)

/**
 * Storage adapter interface
 * 
 * Implementors:
 * - IndexedDBStorageAdapter (client-side)
 * - SupabaseStorageAdapter (server-side)
 * 
 * ⚠️ NON-CUSTODIAL REQUIREMENT:
 * - NEVER store decrypted private keys
 * - Encrypted keys may be stored
 * - User passwords must NEVER be persisted
 */
export interface StorageAdapter {
    /**
     * Get a value from storage
     * @param key - Storage key
     * @returns Value or null if not found
     */
    get<T>(key: string): Promise<T | null>;

    /**
     * Set a value in storage
     * @param key - Storage key
     * @param value - Value to store
     */
    set<T>(key: string, value: T): Promise<void>;

    /**
     * Remove a value from storage
     * @param key - Storage key
     */
    remove(key: string): Promise<void>;

    /**
     * List all keys with a given prefix
     * @param prefix - Key prefix to filter by
     */
    keys(prefix?: string): Promise<string[]>;

    /**
     * Clear all storage
     * ⚠️ Dangerous operation
     */
    clear(): Promise<void>;
}

/**
 * User-scoped storage adapter
 * Automatically prefixes keys with user ID
 */
export interface UserScopedStorageAdapter extends StorageAdapter {
    /**
     * Set the current user ID for scoping
     */
    setUserId(userId: string | null): void;

    /**
     * Get the current user ID
     */
    getUserId(): string | null;

    /**
     * Clear all data for a specific user
     */
    clearUserData(userId: string): Promise<void>;
}

/**
 * Encrypted storage for sensitive data
 */
export interface EncryptedStorageAdapter {
    /**
     * Store encrypted data
     * @param key - Storage key
     * @param data - Data to encrypt and store
     * @param password - User's encryption password
     */
    setEncrypted(key: string, data: string, password: string): Promise<void>;

    /**
     * Retrieve and decrypt data
     * @param key - Storage key
     * @param password - User's decryption password
     * @returns Decrypted data or null
     */
    getDecrypted(key: string, password: string): Promise<string | null>;
}
