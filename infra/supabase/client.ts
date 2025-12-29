// SUPABASE INFRA
// Supabase Client Configuration
// This file initializes the Supabase client for the application
//
// Environment variables required:
// - VITE_SUPABASE_URL
// - VITE_SUPABASE_ANON_KEY

import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * Supabase client configuration type
 */
export interface SupabaseConfig {
    url: string;
    anonKey: string;
}

/**
 * Get Supabase configuration from environment
 */
export function getSupabaseConfig(): SupabaseConfig {
    const url = import.meta.env.VITE_SUPABASE_URL;
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    if (!url || !anonKey) {
        console.warn('[Supabase] Missing environment variables. Connect via Setup Wizard.');
        return {
            url: '',
            anonKey: ''
        };
    }

    return { url, anonKey };
}

/**
 * Connection status
 */
export interface ConnectionStatus {
    connected: boolean;
    projectId: string | null;
    error: string | null;
}

// Supabase client singleton
let supabaseClient: SupabaseClient | null = null;

/**
 * Initialize Supabase client
 * Call this once at app startup
 */
export async function initializeSupabase(): Promise<boolean> {
    const config = getSupabaseConfig();

    if (!config.url || !config.anonKey) {
        console.error('[Supabase] Cannot initialize: missing configuration');
        return false;
    }

    try {
        supabaseClient = createClient(config.url, config.anonKey, {
            auth: {
                autoRefreshToken: true,
                persistSession: true,
                detectSessionInUrl: true,
            },
        });

        console.log('[Supabase] Client initialized successfully');
        return true;
    } catch (error) {
        console.error('[Supabase] Initialization failed:', error);
        return false;
    }
}

/**
 * Initialize Supabase with dynamic credentials (from Setup Wizard)
 */
export async function initializeSupabaseWithCredentials(
    url: string,
    anonKey: string
): Promise<ConnectionStatus> {
    try {
        // Validate URL format
        if (!url.startsWith('https://') || !url.includes('.supabase.co')) {
            return {
                connected: false,
                projectId: null,
                error: 'Invalid Supabase URL format',
            };
        }

        // Create client
        const client = createClient(url, anonKey, {
            auth: {
                autoRefreshToken: true,
                persistSession: true,
                detectSessionInUrl: true,
            },
        });

        // Test connection by fetching auth settings
        const { error } = await client.auth.getSession();

        if (error) {
            return {
                connected: false,
                projectId: null,
                error: `Connection test failed: ${error.message}`,
            };
        }

        // Extract project ID from URL
        const projectId = url.split('//')[1]?.split('.')[0] || null;

        // Store client
        supabaseClient = client;

        console.log('[Supabase] Connected to project:', projectId);

        return {
            connected: true,
            projectId,
            error: null,
        };
    } catch (error) {
        return {
            connected: false,
            projectId: null,
            error: error instanceof Error ? error.message : 'Unknown error',
        };
    }
}

/**
 * Get the Supabase client instance
 */
export function getSupabaseClient(): SupabaseClient | null {
    if (!supabaseClient) {
        console.warn('[Supabase] Client not initialized. Call initializeSupabase() first.');
    }
    return supabaseClient;
}

/**
 * Check if Supabase is configured
 */
export function isSupabaseConfigured(): boolean {
    const config = getSupabaseConfig();
    return !!(config.url && config.anonKey);
}

/**
 * Check if Supabase client is connected
 */
export function isSupabaseConnected(): boolean {
    return supabaseClient !== null;
}

/**
 * Disconnect Supabase client
 */
export function disconnectSupabase(): void {
    supabaseClient = null;
    console.log('[Supabase] Client disconnected');
}

/**
 * Get connection status
 */
export async function getConnectionStatus(): Promise<ConnectionStatus> {
    if (!supabaseClient) {
        return {
            connected: false,
            projectId: null,
            error: 'Client not initialized',
        };
    }

    try {
        const { error } = await supabaseClient.auth.getSession();

        if (error) {
            return {
                connected: false,
                projectId: null,
                error: error.message,
            };
        }

        const config = getSupabaseConfig();
        const projectId = config.url.split('//')[1]?.split('.')[0] || null;

        return {
            connected: true,
            projectId,
            error: null,
        };
    } catch (error) {
        return {
            connected: false,
            projectId: null,
            error: error instanceof Error ? error.message : 'Unknown error',
        };
    }
}
