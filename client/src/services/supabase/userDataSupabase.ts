// User's Personal Supabase for Data Storage
// Separate from Auth Supabase - used for Security Tiers B and C
// 
// The user provides their own Supabase credentials to enable:
// - Tier B: Session-based 24h execution
// - Tier C: Persistent 24/7 automation
//
// Credentials are stored in IndexedDB (user-scoped)

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { StorageService } from '../storageService';

// --- Types ---

export interface UserSupabaseConfig {
    url: string;
    anonKey: string;
    projectId: string;
    connectedAt: string;
}

export interface ConnectionResult {
    success: boolean;
    projectId: string | null;
    error?: string;
}

export interface SchemaValidation {
    valid: boolean;
    missingTables: string[];
    error?: string;
}

// --- Storage Key ---
const USER_SUPABASE_CONFIG_KEY = 'user_supabase_config';

// Required tables for Security Tiers B/C
const REQUIRED_TABLES = ['encrypted_keys', 'execution_sessions'];

// --- Service ---

class UserDataSupabaseService {
    private client: SupabaseClient | null = null;
    private config: UserSupabaseConfig | null = null;
    private listeners: Set<(connected: boolean) => void> = new Set();

    constructor() {
        // Auto-load stored config on init
        this.loadStoredConfig();
    }

    // --- State Management ---

    /**
     * Subscribe to connection state changes
     */
    subscribe(listener: (connected: boolean) => void): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    private notify(): void {
        const connected = this.isConnected();
        this.listeners.forEach(l => l(connected));
    }

    // --- Public API ---

    /**
     * Check if user's Supabase is configured and connected
     */
    isConnected(): boolean {
        return this.client !== null && this.config !== null;
    }

    /**
     * Get current configuration
     */
    getConfig(): UserSupabaseConfig | null {
        return this.config;
    }

    /**
     * Get active Supabase client for data operations
     */
    getClient(): SupabaseClient | null {
        return this.client;
    }

    /**
     * Load stored configuration from IndexedDB
     */
    async loadStoredConfig(): Promise<boolean> {
        try {
            const stored = await StorageService.getItem(
                StorageService.getUserKey(USER_SUPABASE_CONFIG_KEY)
            );

            if (!stored) {
                console.log('[UserDataSupabase] No stored configuration found');
                return false;
            }

            const config: UserSupabaseConfig = JSON.parse(stored);
            
            // Reconnect using stored credentials
            const result = await this.connect(config.url, config.anonKey);
            
            if (result.success) {
                console.log('[UserDataSupabase] Reconnected using stored config');
                return true;
            } else {
                console.warn('[UserDataSupabase] Failed to reconnect:', result.error);
                return false;
            }
        } catch (error) {
            console.error('[UserDataSupabase] Failed to load stored config:', error);
            return false;
        }
    }

    /**
     * Validate URL format
     */
    validateUrl(url: string): { valid: boolean; error?: string } {
        if (!url) {
            return { valid: false, error: 'URL is required' };
        }
        if (!url.startsWith('https://')) {
            return { valid: false, error: 'URL must start with https://' };
        }
        if (!url.includes('.supabase.co')) {
            return { valid: false, error: 'URL must be a Supabase project URL (*.supabase.co)' };
        }
        return { valid: true };
    }

    /**
     * Validate anon key format
     */
    validateAnonKey(anonKey: string): { valid: boolean; error?: string } {
        if (!anonKey) {
            return { valid: false, error: 'Anon key is required' };
        }
        if (anonKey.length < 100) {
            return { valid: false, error: 'Anon key appears invalid (too short)' };
        }
        if (!anonKey.startsWith('eyJ')) {
            return { valid: false, error: 'Anon key should be a JWT token' };
        }
        return { valid: true };
    }

    /**
     * Connect to user's Supabase project
     */
    async connect(url: string, anonKey: string): Promise<ConnectionResult> {
        // Validate inputs
        const urlValidation = this.validateUrl(url);
        if (!urlValidation.valid) {
            return { success: false, projectId: null, error: urlValidation.error };
        }

        const keyValidation = this.validateAnonKey(anonKey);
        if (!keyValidation.valid) {
            return { success: false, projectId: null, error: keyValidation.error };
        }

        try {
            // Create client
            const client = createClient(url, anonKey, {
                auth: {
                    autoRefreshToken: false,
                    persistSession: false,
                    detectSessionInUrl: false,
                },
            });

            // Test connection by making a simple request
            const { error } = await client.auth.getSession();

            if (error && error.message !== 'Auth session missing!') {
                // Auth session missing is expected - we're not using auth on this client
                return { success: false, projectId: null, error: `Connection failed: ${error.message}` };
            }

            // Extract project ID from URL
            const projectId = url.split('//')[1]?.split('.')[0] || null;

            // Store config
            this.config = {
                url,
                anonKey,
                projectId: projectId || '',
                connectedAt: new Date().toISOString(),
            };

            this.client = client;

            // Save to IndexedDB
            await this.saveConfig();

            console.log('[UserDataSupabase] Connected to project:', projectId);
            this.notify();

            return { success: true, projectId };
        } catch (error) {
            return {
                success: false,
                projectId: null,
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    }

    /**
     * Validate that required tables exist in user's Supabase
     */
    async validateSchema(): Promise<SchemaValidation> {
        if (!this.client) {
            return { valid: false, missingTables: REQUIRED_TABLES, error: 'Not connected' };
        }

        const missingTables: string[] = [];

        for (const table of REQUIRED_TABLES) {
            try {
                const { error } = await this.client.from(table).select('id').limit(1);
                
                // Check for "relation does not exist" error
                if (error && (error.code === '42P01' || error.message.includes('does not exist'))) {
                    missingTables.push(table);
                }
            } catch {
                missingTables.push(table);
            }
        }

        return {
            valid: missingTables.length === 0,
            missingTables,
        };
    }

    /**
     * Disconnect and clear stored credentials
     */
    async disconnect(): Promise<void> {
        this.client = null;
        this.config = null;

        // Clear from IndexedDB
        await StorageService.removeItem(
            StorageService.getUserKey(USER_SUPABASE_CONFIG_KEY)
        );

        console.log('[UserDataSupabase] Disconnected and cleared config');
        this.notify();
    }

    /**
     * Get SQL schema for manual setup
     */
    getSetupSQL(): string {
        return `-- AutonomousVault Security Tier Schema
-- Run this in your Supabase SQL Editor

-- Table for storing encrypted keys (Tier B & C)
CREATE TABLE IF NOT EXISTS encrypted_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    key_name TEXT NOT NULL,
    encrypted_blob TEXT NOT NULL,
    encryption_salt TEXT NOT NULL,
    encrypted_password TEXT, -- Only for Tier C (persistent)
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, key_name)
);

-- Table for execution sessions (Tier B)
CREATE TABLE IF NOT EXISTS execution_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    encrypted_session_token TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Row Level Security (RLS) policies
ALTER TABLE encrypted_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE execution_sessions ENABLE ROW LEVEL SECURITY;

-- Users can only access their own data
CREATE POLICY "Users can manage own keys" ON encrypted_keys
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own sessions" ON execution_sessions
    FOR ALL USING (auth.uid() = user_id);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_encrypted_keys_user ON encrypted_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_execution_sessions_user ON execution_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_execution_sessions_expires ON execution_sessions(expires_at);
`;
    }

    // --- Private Helpers ---

    private async saveConfig(): Promise<void> {
        if (!this.config) return;

        try {
            await StorageService.setItem(
                StorageService.getUserKey(USER_SUPABASE_CONFIG_KEY),
                JSON.stringify(this.config)
            );
        } catch (error) {
            console.error('[UserDataSupabase] Failed to save config:', error);
        }
    }
}

// Singleton export
export const userDataSupabase = new UserDataSupabaseService();
