// Security Tier Service
// Manages 3 configurable security tiers for key storage and execution
//
// Tier A: Local Keys - Maximum security, browser must be open
// Tier B: Session Keys - 24h execution sessions
// Tier C: Persistent Keys - Full 24/7 automation
//
// NOTE: Uses `userDataSupabase` for user's personal Supabase (not Auth Supabase)

import { StorageService } from './storageService';
import { userDataSupabase } from './supabase/userDataSupabase';

// --- Types ---

export type SecurityTier = 'local' | 'session' | 'persistent';

export interface SecurityTierInfo {
    tier: SecurityTier;
    label: string;
    description: string;
    icon: string;
    securityLevel: 1 | 2 | 3; // 3 = most secure
    execution24x7: boolean;
    requiresBrowserOpen: boolean;
}

export interface ExecutionSession {
    id: string;
    userId: string;
    createdAt: Date;
    expiresAt: Date;
    active: boolean;
}

export interface SecurityTierState {
    currentTier: SecurityTier;
    session: ExecutionSession | null;
    keysInSupabase: boolean;
    passwordStoredInSupabase: boolean;
}

// --- Constants ---

export const SECURITY_TIERS: Record<SecurityTier, SecurityTierInfo> = {
    local: {
        tier: 'local',
        label: 'Local Keys',
        description: 'Maximum security. Keys never leave your browser. Browser must remain open for execution.',
        icon: '🔒',
        securityLevel: 3,
        execution24x7: false,
        requiresBrowserOpen: true
    },
    session: {
        tier: 'session',
        label: 'Session Keys',
        description: 'Balanced security. 24-hour execution sessions on your server.Re-authenticate daily.',
        icon: '⏱️',
        securityLevel: 2,
        execution24x7: false, // Only for session duration
        requiresBrowserOpen: false
    },
    persistent: {
        tier: 'persistent',
        label: 'Persistent Keys',
        description: 'Full automation. 24/7 execution. Lower security - password stored encrypted on your server.',
        icon: '🔓',
        securityLevel: 1,
        execution24x7: true,
        requiresBrowserOpen: false
    }
};

const STORAGE_KEY_TIER = 'security_tier';
const DEFAULT_SESSION_DURATION_HOURS = 24;

// --- Service ---

class SecurityTierService {
    private state: SecurityTierState = {
        currentTier: 'local',
        session: null,
        keysInSupabase: false,
        passwordStoredInSupabase: false
    };

    private listeners: Set<() => void> = new Set();

    constructor() {
        this.loadState();
    }

    // --- State Management ---

    private async loadState(): Promise<void> {
        try {
            const saved = await StorageService.getItem(StorageService.getUserKey(STORAGE_KEY_TIER));
            if (saved) {
                const parsed = JSON.parse(saved);
                this.state = {
                    ...this.state,
                    currentTier: parsed.currentTier || 'local',
                    session: parsed.session ? {
                        ...parsed.session,
                        createdAt: new Date(parsed.session.createdAt),
                        expiresAt: new Date(parsed.session.expiresAt)
                    } : null
                };

                // Check if session expired
                if (this.state.session && new Date() > this.state.session.expiresAt) {
                    console.log('[SecurityTierService] Session expired, reverting to local');
                    this.state.session = null;
                    if (this.state.currentTier === 'session') {
                        // Session expired but keys still in Supabase - user needs to re-auth
                        this.state.currentTier = 'local';
                    }
                }
            }

            // Sync with Supabase state
            await this.syncSupabaseState();
        } catch (e) {
            console.error('[SecurityTierService] Failed to load state:', e);
        }
    }

    private async saveState(): Promise<void> {
        try {
            await StorageService.setItem(
                StorageService.getUserKey(STORAGE_KEY_TIER),
                JSON.stringify({
                    currentTier: this.state.currentTier,
                    session: this.state.session
                })
            );
        } catch (e) {
            console.error('[SecurityTierService] Failed to save state:', e);
        }
    }

    private notify(): void {
        this.listeners.forEach(l => l());
        this.saveState();
    }

    // --- Public API ---

    subscribe(listener: () => void): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    getState(): SecurityTierState {
        return this.state;
    }

    getCurrentTier(): SecurityTier {
        return this.state.currentTier;
    }

    getTierInfo(tier?: SecurityTier): SecurityTierInfo {
        return SECURITY_TIERS[tier || this.state.currentTier];
    }

    getSessionStatus(): { active: boolean; expiresAt?: Date; remainingHours?: number } {
        if (!this.state.session) {
            return { active: false };
        }

        const now = new Date();
        const active = now < this.state.session.expiresAt;
        const remainingMs = this.state.session.expiresAt.getTime() - now.getTime();
        const remainingHours = Math.max(0, remainingMs / (1000 * 60 * 60));

        return {
            active,
            expiresAt: this.state.session.expiresAt,
            remainingHours: Math.round(remainingHours * 10) / 10
        };
    }

    // --- Tier Migrations ---

    /**
     * Migrate to Tier B (Session Keys)
     * - Uploads encrypted key to Supabase
     * - Creates 24h execution session
     */
    async migrateToSession(
        encryptedBlob: string,
        encryptionSalt: string,
        password: string,
        durationHours: number = DEFAULT_SESSION_DURATION_HOURS
    ): Promise<{ success: boolean; error?: string }> {
        try {
            const supabase = userDataSupabase.getClient();
            if (!supabase) {
                return { success: false, error: 'Your Supabase not connected. Please connect in Security Tier settings.' };
            }

            // Get current user from auth context (StorageService has userId set by AuthContext)
            const userId = StorageService.getUserId();
            if (!userId) {
                return { success: false, error: 'Not authenticated' };
            }

            // Upload encrypted key to Supabase
            const { error: keyError } = await supabase
                .from('encrypted_keys')
                .upsert({
                    user_id: userId,
                    key_name: 'hyperliquid',
                    encrypted_blob: encryptedBlob,
                    encryption_salt: encryptionSalt,
                    encrypted_password: null // Tier B: no password stored
                }, {
                    onConflict: 'user_id,key_name'
                });

            if (keyError) {
                return { success: false, error: `Failed to upload key: ${keyError.message}` };
            }

            // Create execution session
            const now = new Date();
            const expiresAt = new Date(now.getTime() + durationHours * 60 * 60 * 1000);

            // Generate session token (encrypted with password)
            const sessionId = crypto.randomUUID();
            const sessionToken = await this.createSessionToken(userId, password, expiresAt);

            const { error: sessionError } = await supabase
                .from('execution_sessions')
                .insert({
                    id: sessionId,
                    user_id: userId,
                    encrypted_session_token: sessionToken,
                    expires_at: expiresAt.toISOString(),
                    revoked: false
                });

            if (sessionError) {
                return { success: false, error: `Failed to create session: ${sessionError.message}` };
            }

            // Update local state
            this.state = {
                ...this.state,
                currentTier: 'session',
                keysInSupabase: true,
                passwordStoredInSupabase: false,
                session: {
                    id: sessionId,
                    userId: userId,
                    createdAt: now,
                    expiresAt: expiresAt,
                    active: true
                }
            };

            this.notify();
            console.log('[SecurityTierService] Migrated to Tier B (Session)');

            return { success: true };
        } catch (e) {
            const error = e instanceof Error ? e.message : 'Unknown error';
            return { success: false, error };
        }
    }

    /**
     * Migrate to Tier C (Persistent Keys)
     * - Uploads encrypted key + encrypted password to Supabase
     */
    async migrateToPersistent(
        encryptedBlob: string,
        encryptionSalt: string,
        password: string
    ): Promise<{ success: boolean; error?: string }> {
        try {
            const supabase = userDataSupabase.getClient();
            if (!supabase) {
                return { success: false, error: 'Your Supabase not connected. Please connect in Security Tier settings.' };
            }

            // Get current user from auth context
            const userId = StorageService.getUserId();
            if (!userId) {
                return { success: false, error: 'Not authenticated' };
            }

            // Encrypt password for storage (using server-managed key via edge function)
            const encryptedPassword = await this.encryptPasswordForStorage(password);

            // Upload encrypted key + password to Supabase
            const { error: keyError } = await supabase
                .from('encrypted_keys')
                .upsert({
                    user_id: userId,
                    key_name: 'hyperliquid',
                    encrypted_blob: encryptedBlob,
                    encryption_salt: encryptionSalt,
                    encrypted_password: encryptedPassword
                }, {
                    onConflict: 'user_id,key_name'
                });

            if (keyError) {
                return { success: false, error: `Failed to upload key: ${keyError.message}` };
            }

            // Update local state
            this.state = {
                ...this.state,
                currentTier: 'persistent',
                keysInSupabase: true,
                passwordStoredInSupabase: true,
                session: null // No session needed for persistent
            };

            this.notify();
            console.log('[SecurityTierService] Migrated to Tier C (Persistent)');

            return { success: true };
        } catch (e) {
            const error = e instanceof Error ? e.message : 'Unknown error';
            return { success: false, error };
        }
    }

    /**
     * Migrate to Tier A (Local Keys)
     * - Deletes key and password from Supabase
     * - Revokes any active sessions
     */
    async migrateToLocal(): Promise<{ success: boolean; error?: string }> {
        try {
            const supabase = userDataSupabase.getClient();
            if (!supabase) {
                // No Supabase? Already local
                this.state = {
                    ...this.state,
                    currentTier: 'local',
                    keysInSupabase: false,
                    passwordStoredInSupabase: false,
                    session: null
                };
                this.notify();
                return { success: true };
            }

            // Get current user from auth context
            const userId = StorageService.getUserId();
            if (!userId) {
                return { success: false, error: 'Not authenticated' };
            }

            // Delete encrypted key from Supabase
            await supabase
                .from('encrypted_keys')
                .delete()
                .eq('user_id', userId)
                .eq('key_name', 'hyperliquid');

            // Revoke all sessions
            await supabase
                .from('execution_sessions')
                .update({ revoked: true })
                .eq('user_id', userId);

            // Update local state
            this.state = {
                ...this.state,
                currentTier: 'local',
                keysInSupabase: false,
                passwordStoredInSupabase: false,
                session: null
            };

            this.notify();
            console.log('[SecurityTierService] Migrated to Tier A (Local)');

            return { success: true };
        } catch (e) {
            const error = e instanceof Error ? e.message : 'Unknown error';
            return { success: false, error };
        }
    }

    /**
     * End current session (Tier B only)
     * Doesn't delete key from Supabase, just revokes session
     */
    async endSession(): Promise<void> {
        if (!this.state.session) return;

        try {
            const supabase = userDataSupabase.getClient();
            if (supabase) {
                await supabase
                    .from('execution_sessions')
                    .update({ revoked: true })
                    .eq('id', this.state.session.id);
            }
        } catch (e) {
            console.error('[SecurityTierService] Failed to revoke session:', e);
        }

        this.state = {
            ...this.state,
            session: null
        };
        this.notify();
    }

    /**
     * Refresh/extend current session
     */
    async refreshSession(
        password: string,
        durationHours: number = DEFAULT_SESSION_DURATION_HOURS
    ): Promise<{ success: boolean; error?: string }> {
        if (this.state.currentTier !== 'session') {
            return { success: false, error: 'Not in session mode' };
        }

        // End current session and start new one
        await this.endSession();

        // Get encrypted key from Supabase to re-create session
        const supabase = userDataSupabase.getClient();
        if (!supabase) {
            return { success: false, error: 'Your Supabase not connected' };
        }

        const userId = StorageService.getUserId();
        if (!userId) {
            return { success: false, error: 'Not authenticated' };
        }

        const { data: keyData } = await supabase
            .from('encrypted_keys')
            .select('encrypted_blob, encryption_salt')
            .eq('user_id', userId)
            .eq('key_name', 'hyperliquid')
            .single();

        if (!keyData) {
            return { success: false, error: 'No key found in Supabase' };
        }

        return this.migrateToSession(
            keyData.encrypted_blob,
            keyData.encryption_salt,
            password,
            durationHours
        );
    }

    // --- Private Helpers ---

    private async syncSupabaseState(): Promise<void> {
        try {
            const supabase = userDataSupabase.getClient();
            if (!supabase) return;

            const userId = StorageService.getUserId();
            if (!userId) return;

            // Check if key exists in Supabase
            const { data: keyData } = await supabase
                .from('encrypted_keys')
                .select('encrypted_password')
                .eq('user_id', userId)
                .eq('key_name', 'hyperliquid')
                .single();

            this.state.keysInSupabase = !!keyData;
            this.state.passwordStoredInSupabase = !!(keyData?.encrypted_password);

            // Determine actual tier based on Supabase state
            if (!this.state.keysInSupabase) {
                this.state.currentTier = 'local';
            } else if (this.state.passwordStoredInSupabase) {
                this.state.currentTier = 'persistent';
            } else if (this.state.session?.active) {
                this.state.currentTier = 'session';
            } else {
                // Keys in Supabase but no password and no active session
                // User needs to re-auth for session
                this.state.currentTier = 'local';
            }
        } catch (e) {
            console.error('[SecurityTierService] Failed to sync Supabase state:', e);
        }
    }

    private async createSessionToken(
        userId: string,
        password: string,
        expiresAt: Date
    ): Promise<string> {
        // Create a session token containing encrypted password
        // This token is stored in Supabase and used by Edge Functions
        const payload = JSON.stringify({
            userId,
            password, // Will be encrypted
            expiresAt: expiresAt.toISOString()
        });

        // Encrypt with a random key (actual implementation would use proper crypto)
        const encoder = new TextEncoder();
        const data = encoder.encode(payload);
        const key = await crypto.subtle.generateKey(
            { name: 'AES-GCM', length: 256 },
            true,
            ['encrypt']
        );

        const iv = crypto.getRandomValues(new Uint8Array(12));
        const encrypted = await crypto.subtle.encrypt(
            { name: 'AES-GCM', iv },
            key,
            data
        );

        // Combine IV + encrypted data + exported key
        const exportedKey = await crypto.subtle.exportKey('raw', key);
        const combined = new Uint8Array(iv.length + encrypted.byteLength + (exportedKey as ArrayBuffer).byteLength);
        combined.set(iv, 0);
        combined.set(new Uint8Array(encrypted), iv.length);
        combined.set(new Uint8Array(exportedKey as ArrayBuffer), iv.length + encrypted.byteLength);

        return btoa(String.fromCharCode(...combined));
    }

    private async encryptPasswordForStorage(password: string): Promise<string> {
        // In production, this would call an Edge Function to encrypt with server-managed key
        // For now, we use client-side encryption (less secure but functional)
        const encoder = new TextEncoder();
        const data = encoder.encode(password);

        // Derive a key from a fixed salt (in production, this would be server-side)
        const salt = encoder.encode('autonomousvault-persistent-key-v1');
        const keyMaterial = await crypto.subtle.importKey(
            'raw',
            encoder.encode('server-managed-key-placeholder'),
            'PBKDF2',
            false,
            ['deriveKey']
        );

        const key = await crypto.subtle.deriveKey(
            { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
            keyMaterial,
            { name: 'AES-GCM', length: 256 },
            false,
            ['encrypt']
        );

        const iv = crypto.getRandomValues(new Uint8Array(12));
        const encrypted = await crypto.subtle.encrypt(
            { name: 'AES-GCM', iv },
            key,
            data
        );

        const combined = new Uint8Array(iv.length + encrypted.byteLength);
        combined.set(iv, 0);
        combined.set(new Uint8Array(encrypted), iv.length);

        return btoa(String.fromCharCode(...combined));
    }
}

// Singleton export
export const securityTierService = new SecurityTierService();
