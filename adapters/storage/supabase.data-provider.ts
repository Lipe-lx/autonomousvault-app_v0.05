// Supabase Data Provider
// Implements DataProviderAdapter using Supabase Database
// This is the provider for Tier B (Session) and Tier C (Persistent)

import type { SupabaseClient } from '@supabase/supabase-js';
import type {
    DataProviderAdapter,
    Trade,
    EncryptedKey
} from './data-provider.adapter';

export class SupabaseDataProvider implements DataProviderAdapter {
    readonly name = 'SupabaseDataProvider';
    private client: SupabaseClient | null = null;
    private userId: string | null = null;

    constructor(client?: SupabaseClient) {
        this.client = client || null;
    }

    async initialize(): Promise<void> {
        if (!this.client) {
            // Try to get client from global module
            const { getSupabaseClient } = await import('../../client/src/services/supabase/client');
            this.client = getSupabaseClient();
        }

        if (!this.client) {
            throw new Error('Supabase client not available');
        }

        // Get current user
        const { data: { user } } = await this.client.auth.getUser();
        this.userId = user?.id || null;

        console.log(`[SupabaseDataProvider] Initialized for user: ${this.userId?.substring(0, 8) || 'none'}`);
    }

    private ensureInitialized(): void {
        if (!this.client || !this.userId) {
            throw new Error('SupabaseDataProvider not initialized');
        }
    }

    // --- Settings ---

    async getSettings<T extends object>(key: string): Promise<T | null> {
        this.ensureInitialized();

        try {
            const { data, error } = await this.client!
                .from('user_settings')
                .select('dealer_settings')
                .eq('user_id', this.userId)
                .single();

            if (error && error.code !== 'PGRST116') { // Not found is ok
                throw error;
            }

            if (!data?.dealer_settings) return null;

            // Settings are stored as a nested object with keys
            return data.dealer_settings[key] || null;
        } catch (e) {
            console.error('[SupabaseDataProvider] getSettings error:', e);
            return null;
        }
    }

    async saveSettings<T extends object>(key: string, value: T): Promise<void> {
        this.ensureInitialized();

        try {
            // Get existing settings
            const { data: existing } = await this.client!
                .from('user_settings')
                .select('dealer_settings')
                .eq('user_id', this.userId)
                .single();

            const currentSettings = existing?.dealer_settings || {};
            const newSettings = { ...currentSettings, [key]: value };

            // Upsert
            const { error } = await this.client!
                .from('user_settings')
                .upsert({
                    user_id: this.userId,
                    dealer_settings: newSettings
                }, {
                    onConflict: 'user_id'
                });

            if (error) throw error;
        } catch (e) {
            console.error('[SupabaseDataProvider] saveSettings error:', e);
            throw e;
        }
    }

    async deleteSettings(key: string): Promise<void> {
        this.ensureInitialized();

        try {
            const { data: existing } = await this.client!
                .from('user_settings')
                .select('dealer_settings')
                .eq('user_id', this.userId)
                .single();

            if (existing?.dealer_settings) {
                const { [key]: _, ...remainingSettings } = existing.dealer_settings;

                await this.client!
                    .from('user_settings')
                    .update({ dealer_settings: remainingSettings })
                    .eq('user_id', this.userId);
            }
        } catch (e) {
            console.error('[SupabaseDataProvider] deleteSettings error:', e);
        }
    }

    // --- Trade History ---

    async getTrades(limit: number = 50, coin?: string): Promise<Trade[]> {
        this.ensureInitialized();

        try {
            let query = this.client!
                .from('trade_history')
                .select('*')
                .eq('user_id', this.userId)
                .order('created_at', { ascending: false })
                .limit(limit);

            if (coin) {
                query = query.eq('coin', coin.toUpperCase());
            }

            const { data, error } = await query;

            if (error) throw error;

            return (data || []).map(row => ({
                id: row.id,
                userId: row.user_id,
                exchange: row.exchange,
                coin: row.coin,
                action: row.action,
                sizeUsdc: parseFloat(row.size_usdc),
                price: parseFloat(row.price),
                leverage: row.leverage,
                orderId: row.order_id,
                cloid: row.cloid,
                status: row.status,
                error: row.error,
                confidence: parseFloat(row.confidence),
                reason: row.reason,
                createdAt: new Date(row.created_at)
            }));
        } catch (e) {
            console.error('[SupabaseDataProvider] getTrades error:', e);
            return [];
        }
    }

    async saveTrade(trade: Omit<Trade, 'id' | 'createdAt'>): Promise<Trade> {
        this.ensureInitialized();

        try {
            const { data, error } = await this.client!
                .from('trade_history')
                .insert({
                    user_id: this.userId,
                    exchange: trade.exchange,
                    coin: trade.coin,
                    action: trade.action,
                    size_usdc: trade.sizeUsdc,
                    price: trade.price,
                    leverage: trade.leverage,
                    order_id: trade.orderId,
                    cloid: trade.cloid,
                    status: trade.status,
                    error: trade.error,
                    confidence: trade.confidence,
                    reason: trade.reason
                })
                .select()
                .single();

            if (error) throw error;

            return {
                id: data.id,
                userId: data.user_id,
                exchange: data.exchange,
                coin: data.coin,
                action: data.action,
                sizeUsdc: parseFloat(data.size_usdc),
                price: parseFloat(data.price),
                leverage: data.leverage,
                orderId: data.order_id,
                cloid: data.cloid,
                status: data.status,
                error: data.error,
                confidence: parseFloat(data.confidence),
                reason: data.reason,
                createdAt: new Date(data.created_at)
            };
        } catch (e) {
            console.error('[SupabaseDataProvider] saveTrade error:', e);
            throw e;
        }
    }

    // --- Encrypted Keys ---

    async getEncryptedKey(keyName: string): Promise<EncryptedKey | null> {
        this.ensureInitialized();

        try {
            const { data, error } = await this.client!
                .from('encrypted_keys')
                .select('*')
                .eq('user_id', this.userId)
                .eq('key_name', keyName)
                .single();

            if (error && error.code !== 'PGRST116') {
                throw error;
            }

            if (!data) return null;

            return {
                keyName: data.key_name,
                encryptedBlob: data.encrypted_blob,
                encryptionSalt: data.encryption_salt,
                publicAddress: data.public_address,
                encryptedPassword: data.encrypted_password,
                lastRotatedAt: data.last_rotated_at ? new Date(data.last_rotated_at) : undefined
            };
        } catch (e) {
            console.error('[SupabaseDataProvider] getEncryptedKey error:', e);
            return null;
        }
    }

    async saveEncryptedKey(keyName: string, data: Omit<EncryptedKey, 'keyName'>): Promise<void> {
        this.ensureInitialized();

        try {
            const { error } = await this.client!
                .from('encrypted_keys')
                .upsert({
                    user_id: this.userId,
                    key_name: keyName,
                    encrypted_blob: data.encryptedBlob,
                    encryption_salt: data.encryptionSalt,
                    public_address: data.publicAddress,
                    encrypted_password: data.encryptedPassword,
                    last_rotated_at: data.lastRotatedAt?.toISOString()
                }, {
                    onConflict: 'user_id,key_name'
                });

            if (error) throw error;
        } catch (e) {
            console.error('[SupabaseDataProvider] saveEncryptedKey error:', e);
            throw e;
        }
    }

    async deleteEncryptedKey(keyName: string): Promise<void> {
        this.ensureInitialized();

        try {
            const { error } = await this.client!
                .from('encrypted_keys')
                .delete()
                .eq('user_id', this.userId)
                .eq('key_name', keyName);

            if (error) throw error;
        } catch (e) {
            console.error('[SupabaseDataProvider] deleteEncryptedKey error:', e);
        }
    }

    // --- Availability ---

    async isAvailable(): Promise<boolean> {
        if (!this.client) return false;

        try {
            const { error } = await this.client.auth.getSession();
            return !error;
        } catch {
            return false;
        }
    }
}

export function createSupabaseDataProvider(client?: SupabaseClient): SupabaseDataProvider {
    return new SupabaseDataProvider(client);
}
