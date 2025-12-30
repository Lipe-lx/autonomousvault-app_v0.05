// Supabase Auth Service
// Provides: Google OAuth, Email/Password, Session management

import { getSupabaseClient, isSupabaseConfigured } from './client';

/**
 * User type matching Firebase User interface for compatibility
 */
export interface SupabaseUser {
    id: string;
    email: string | null;
    displayName: string | null;
    photoURL: string | null;
    emailVerified: boolean;
    createdAt: string;
}

/**
 * Auth state
 */
export interface AuthState {
    user: SupabaseUser | null;
    loading: boolean;
    error: string | null;
}

/**
 * Convert Supabase user to our User format
 */
function mapSupabaseUser(supabaseUser: any): SupabaseUser | null {
    if (!supabaseUser) return null;

    return {
        id: supabaseUser.id,
        email: supabaseUser.email || null,
        displayName: supabaseUser.user_metadata?.full_name || supabaseUser.email?.split('@')[0] || null,
        photoURL: supabaseUser.user_metadata?.avatar_url || null,
        emailVerified: supabaseUser.email_confirmed_at !== null,
        createdAt: supabaseUser.created_at
    };
}

/**
 * Supabase Auth Service
 * 
 * Mirrors the Firebase AuthContext API for easy migration
 */
export class SupabaseAuthService {
    private currentUser: SupabaseUser | null = null;
    private listeners: Array<(user: SupabaseUser | null) => void> = [];

    /**
     * Get current user
     */
    getUser(): SupabaseUser | null {
        return this.currentUser;
    }

    /**
     * Subscribe to auth state changes
     */
    onAuthStateChange(callback: (user: SupabaseUser | null) => void): () => void {
        this.listeners.push(callback);

        // Return unsubscribe function
        return () => {
            this.listeners = this.listeners.filter(l => l !== callback);
        };
    }

    /**
     * Sign in with Google OAuth
     */
    async signInWithGoogle(): Promise<SupabaseUser> {
        return this.signInWithProvider('google', {
            queryParams: {
                access_type: 'offline',
                prompt: 'consent',
            },
        });
    }

    /**
     * Sign in with GitHub OAuth
     */
    async signInWithGitHub(): Promise<SupabaseUser> {
        // GitHub requires explicit scopes for email access
        return this.signInWithProvider('github', {
            scopes: 'read:user user:email'
        });
    }

    /**
     * Sign in with Discord OAuth
     */
    async signInWithDiscord(): Promise<SupabaseUser> {
        // Discord requires explicit scopes for identity and email
        return this.signInWithProvider('discord', {
            scopes: 'identify email'
        });
    }

    /**
     * Generic OAuth sign in
     */
    async signInWithProvider(
        provider: 'google' | 'github' | 'discord',
        options?: {
            scopes?: string;
            queryParams?: { [key: string]: string };
        }
    ): Promise<SupabaseUser> {
        const supabase = getSupabaseClient();
        if (!supabase) {
            console.error('[Auth] Supabase client not initialized');
            throw new Error('Supabase not initialized');
        }

        console.log(`[Auth] Starting sign in with ${provider}...`, options);

        try {
            const { data, error } = await supabase.auth.signInWithOAuth({
                provider,
                options: {
                    redirectTo: window.location.origin,
                    scopes: options?.scopes,
                    queryParams: options?.queryParams,
                    skipBrowserRedirect: false,
                }
            });

            if (error) {
                console.error(`[Auth] Error signing in with ${provider}:`, error);
                throw error;
            }

            console.log(`[Auth] params for ${provider} sign in initiated`, data);

            // Note: Since we are redirecting, this return might not be reached immediately
            // But we return user if it somehow continues or for type consistency
            return this.currentUser!;
        } catch (err) {
            console.error(`[Auth] Unexpected error during ${provider} sign in:`, err);
            throw err;
        }
    }

    /**
     * Sign in with Ethereum wallet (EIP-4361 / SIWE)
     */
    async signInWithEthereum(): Promise<SupabaseUser> {
        const supabase = getSupabaseClient();
        if (!supabase) throw new Error('Supabase not initialized');

        // Check if ethereum wallet is available
        if (typeof window !== 'undefined' && !(window as any).ethereum) {
            throw new Error('No Ethereum wallet detected. Please install MetaMask or another Web3 wallet.');
        }

        const { data, error } = await supabase.auth.signInWithWeb3({
            chain: 'ethereum',
            statement: 'I accept the AutonomousVault Terms of Service',
        });

        if (error) throw error;

        this.currentUser = mapSupabaseUser(data.user);
        this.notifyListeners();
        return this.currentUser!;
    }

    /**
     * Sign in with Solana wallet (SIWS)
     */
    async signInWithSolana(): Promise<SupabaseUser> {
        const supabase = getSupabaseClient();
        if (!supabase) throw new Error('Supabase not initialized');

        // Check if solana wallet is available
        if (typeof window !== 'undefined' && !(window as any).solana) {
            throw new Error('No Solana wallet detected. Please install Phantom or another Solana wallet.');
        }

        // Connect to Solana wallet first
        try {
            await (window as any).solana.connect();
        } catch (e) {
            throw new Error('Failed to connect to Solana wallet');
        }

        const { data, error } = await supabase.auth.signInWithWeb3({
            chain: 'solana',
            statement: 'I accept the AutonomousVault Terms of Service',
        });

        if (error) throw error;

        this.currentUser = mapSupabaseUser(data.user);
        this.notifyListeners();
        return this.currentUser!;
    }

    /**
     * Sign in with email and password
     */
    async signInWithEmail(email: string, password: string): Promise<SupabaseUser> {
        const supabase = getSupabaseClient();
        if (!supabase) throw new Error('Supabase not initialized');

        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password
        });

        if (error) throw error;

        this.currentUser = mapSupabaseUser(data.user);
        this.notifyListeners();
        return this.currentUser!;
    }

    /**
     * Sign up with email and password
     */
    async signUp(email: string, password: string): Promise<SupabaseUser> {
        const supabase = getSupabaseClient();
        if (!supabase) throw new Error('Supabase not initialized');

        const { data, error } = await supabase.auth.signUp({
            email,
            password
        });

        if (error) throw error;

        this.currentUser = mapSupabaseUser(data.user);
        this.notifyListeners();
        return this.currentUser!;
    }

    /**
     * Sign out
     */
    async logout(): Promise<void> {
        const supabase = getSupabaseClient();
        if (!supabase) throw new Error('Supabase not initialized');

        const { error } = await supabase.auth.signOut();
        if (error) throw error;

        this.currentUser = null;
        this.notifyListeners();
    }

    /**
     * Delete account permanently
     * This will:
     * 1. Clear all local storage data
     * 2. Delete user from Supabase Auth (triggers CASCADE delete of all user data)
     * 
     * WARNING: This action is irreversible!
     */
    async deleteAccount(): Promise<void> {
        const supabase = getSupabaseClient();
        if (!supabase) throw new Error('Supabase not initialized');

        // Get current user to ensure they're authenticated
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Not authenticated');

        // Clear local storage first
        try {
            // Clear IndexedDB (via StorageService)
            const { StorageService } = await import('../storageService');
            await StorageService.clearUserData(user.id);
            console.log('[Auth] Local storage cleared');
        } catch (e) {
            console.warn('[Auth] Failed to clear local storage:', e);
        }

        // Delete user from Supabase Auth
        // Note: This requires the user to have the ability to delete themselves
        // In Supabase, this is typically done via an Edge Function or Admin API
        // For now, we'll use the RPC function if available, or just sign out
        try {
            // Try RPC function first (requires setup in Supabase)
            const { error: rpcError } = await supabase.rpc('delete_user');
            
            if (rpcError) {
                // RPC not available, try direct admin deletion if service role
                console.warn('[Auth] RPC delete_user not available, signing out only:', rpcError.message);
                // Sign out the user - they'll need to contact support for full deletion
                await this.logout();
                throw new Error('Account deletion requires admin action. Please contact support or delete via Supabase dashboard.');
            }
        } catch (e: any) {
            if (e.message?.includes('contact support')) {
                throw e;
            }
            // If RPC failed for other reasons, still sign out
            await this.logout();
            throw new Error('Account deletion failed. You have been signed out. Please contact support to complete account deletion.');
        }

        // Clear current user and notify
        this.currentUser = null;
        this.notifyListeners();
        console.log('[Auth] Account deleted successfully');
    }

    /**
     * Initialize auth listener
     */
    async initialize(): Promise<void> {
        const supabase = getSupabaseClient();
        if (!supabase) {
            console.warn('[SupabaseAuth] Cannot initialize: client not available');
            return;
        }

        // Set up auth state listener
        supabase.auth.onAuthStateChange((event, session) => {
            console.log(`[SupabaseAuth] Auth state change: ${event}`, session?.user?.email);
            
            if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
                console.log('[SupabaseAuth] User signed in/refreshed');
            } else if (event === 'SIGNED_OUT') {
                console.log('[SupabaseAuth] User signed out');
            }

            this.currentUser = session ? mapSupabaseUser(session.user) : null;
            this.notifyListeners();
        });

        // Get initial session
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) {
            console.error('[SupabaseAuth] Error getting initial session:', error);
        }
        
        console.log('[SupabaseAuth] Initial session check:', session ? 'Session found' : 'No session found');
        this.currentUser = session ? mapSupabaseUser(session.user) : null;
        this.notifyListeners();
    }

    /**
     * Notify all listeners of auth state change
     */
    private notifyListeners(): void {
        this.listeners.forEach(callback => {
            try {
                callback(this.currentUser);
            } catch (err) {
                console.error('[SupabaseAuth] Listener error:', err);
            }
        });
    }

    /**
     * Get user ID (for storage scoping)
     */
    getUserId(): string | null {
        return this.currentUser?.id || null;
    }

    /**
     * Check if user is authenticated
     */
    isAuthenticated(): boolean {
        return this.currentUser !== null;
    }

    /**
     * Get access token (for API calls)
     */
    async getAccessToken(): Promise<string | null> {
        const supabase = getSupabaseClient();
        if (!supabase) return null;

        const { data: { session } } = await supabase.auth.getSession();
        return session?.access_token || null;
    }
}

// Singleton instance
export const supabaseAuth = new SupabaseAuthService();
