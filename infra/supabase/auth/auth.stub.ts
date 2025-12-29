// SUPABASE INFRA
// Auth stub - placeholder for Supabase Auth integration
// NO implementation yet - structural only
//
// Future: This will wrap Supabase Auth for:
// - User registration/login
// - Session management
// - JWT token handling

/**
 * Auth user type
 */
export interface AuthUser {
    id: string;
    email?: string;
    createdAt: string;
}

/**
 * Auth session type
 */
export interface AuthSession {
    accessToken: string;
    refreshToken: string;
    expiresAt: number;
    user: AuthUser;
}

/**
 * Auth adapter interface for Supabase
 * STUB: No implementation
 */
export interface SupabaseAuthAdapter {
    /**
     * Sign up a new user
     */
    signUp(email: string, password: string): Promise<AuthSession>;

    /**
     * Sign in existing user
     */
    signIn(email: string, password: string): Promise<AuthSession>;

    /**
     * Sign out current user
     */
    signOut(): Promise<void>;

    /**
     * Get current session
     */
    getSession(): Promise<AuthSession | null>;

    /**
     * Get current user
     */
    getUser(): Promise<AuthUser | null>;

    /**
     * Refresh session token
     */
    refreshSession(): Promise<AuthSession>;

    /**
     * Listen for auth state changes
     */
    onAuthStateChange(callback: (session: AuthSession | null) => void): () => void;
}

/**
 * STUB: Factory function (not implemented)
 */
export function createSupabaseAuthAdapter(): SupabaseAuthAdapter {
    throw new Error('[STUB] SupabaseAuthAdapter not implemented');
}
