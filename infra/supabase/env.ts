// SUPABASE INFRA
// Environment configuration template
// Copy this to .env.local and fill in your Supabase credentials

/**
 * Environment variables required for Supabase:
 * 
 * VITE_SUPABASE_URL=https://your-project.supabase.co
 * VITE_SUPABASE_ANON_KEY=your-anon-key
 * 
 * Optional for additional features:
 * VITE_SUPABASE_SERVICE_KEY=your-service-key (only for server-side)
 */

export interface EnvConfig {
    supabase: {
        url: string;
        anonKey: string;
        serviceKey?: string;
    };
    features: {
        enableTestnet: boolean;
        enablePolymarket: boolean;
    };
}

/**
 * Get environment configuration
 */
export function getEnvConfig(): EnvConfig {
    return {
        supabase: {
            url: import.meta.env.VITE_SUPABASE_URL || '',
            anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY || '',
            serviceKey: import.meta.env.VITE_SUPABASE_SERVICE_KEY
        },
        features: {
            enableTestnet: import.meta.env.VITE_ENABLE_TESTNET === 'true',
            enablePolymarket: import.meta.env.VITE_ENABLE_POLYMARKET === 'true'
        }
    };
}

/**
 * Validate required environment variables
 */
export function validateEnv(): { valid: boolean; missing: string[] } {
    const required = [
        'VITE_SUPABASE_URL',
        'VITE_SUPABASE_ANON_KEY'
    ];

    const missing = required.filter(key => !import.meta.env[key]);

    return {
        valid: missing.length === 0,
        missing
    };
}
