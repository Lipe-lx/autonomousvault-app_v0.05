// SUPABASE INFRA
// Supabase Auth Service
// Replaces Firebase Auth from v0.03
//
// Provides: Google OAuth, Email/Password, Session management

import { getSupabaseClient, isSupabaseConfigured } from '../client';

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
        const supabase = getSupabaseClient();
        if (!supabase) throw new Error('Supabase not initialized');

        const { data, error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: window.location.origin
            }
        });

        if (error) throw error;

        // User will be set via onAuthStateChange after redirect
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
     * Initialize auth listener
     */
    async initialize(): Promise<void> {
        const supabase = getSupabaseClient();
        if (!supabase) {
            console.warn('[SupabaseAuth] Cannot initialize: client not available');
            return;
        }

        // Set up auth state listener
        supabase.auth.onAuthStateChange((_event: any, session: any) => {
            this.currentUser = session ? mapSupabaseUser(session.user) : null;
            this.notifyListeners();
        });

        // Get initial session
        const { data: { session } } = await supabase.auth.getSession();
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
