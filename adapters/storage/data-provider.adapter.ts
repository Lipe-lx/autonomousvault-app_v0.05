// Data Provider Adapter Interface
// Abstraction layer for storage backends (IndexedDB vs Supabase)
// Enables seamless switching between local and cloud storage

// --- Types ---

export interface Trade {
    id: string;
    userId: string;
    exchange: string;
    coin: string;
    action: 'BUY' | 'SELL' | 'CLOSE';
    sizeUsdc: number;
    price: number;
    leverage: number;
    orderId?: string;
    cloid?: string;
    status: 'pending' | 'filled' | 'failed';
    error?: string;
    confidence: number;
    reason: string;
    createdAt: Date;
}

export interface EncryptedKey {
    keyName: string;
    encryptedBlob: string;
    encryptionSalt: string;
    publicAddress?: string;
    encryptedPassword?: string | null; // Tier C only
    lastRotatedAt?: Date;
}

export interface DealerSettings {
    strategyPrompt?: string;
    indicatorSettings?: any;
    tradingPairs?: string[];
    maxLeverage?: number;
    maxPositionSizeUSDC?: number;
    maxOpenPositions?: number;
    checkIntervalSeconds?: number;
    [key: string]: any;
}

// --- Adapter Interface ---

export interface DataProviderAdapter {
    /**
     * Provider name for logging
     */
    readonly name: string;

    /**
     * Initialize the provider
     */
    initialize(): Promise<void>;

    // --- Settings ---

    /**
     * Get settings by key
     */
    getSettings<T extends object>(key: string): Promise<T | null>;

    /**
     * Save settings
     */
    saveSettings<T extends object>(key: string, value: T): Promise<void>;

    /**
     * Delete settings
     */
    deleteSettings(key: string): Promise<void>;

    // --- Trade History ---

    /**
     * Get trade history
     * @param limit Maximum trades to return
     * @param coin Optional filter by coin
     */
    getTrades(limit?: number, coin?: string): Promise<Trade[]>;

    /**
     * Save a trade record
     */
    saveTrade(trade: Omit<Trade, 'id' | 'createdAt'>): Promise<Trade>;

    // --- Encrypted Keys ---

    /**
     * Get encrypted key by name
     */
    getEncryptedKey(keyName: string): Promise<EncryptedKey | null>;

    /**
     * Save or update encrypted key
     */
    saveEncryptedKey(keyName: string, data: Omit<EncryptedKey, 'keyName'>): Promise<void>;

    /**
     * Delete encrypted key
     */
    deleteEncryptedKey(keyName: string): Promise<void>;

    // --- Sync Operations ---

    /**
     * Sync local data to remote (for migration scenarios)
     * Only applicable when transitioning between providers
     */
    syncToRemote?(targetProvider: DataProviderAdapter): Promise<{ synced: number; errors: string[] }>;

    /**
     * Check if provider is available/connected
     */
    isAvailable(): Promise<boolean>;
}

// --- Factory Type ---

export type DataProviderType = 'local' | 'supabase';

export interface DataProviderFactoryOptions {
    userId?: string;
}
