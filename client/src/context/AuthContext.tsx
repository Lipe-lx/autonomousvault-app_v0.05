import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabaseAuth, SupabaseUser } from '../services/supabase/auth.service';
import { initializeSupabase, isSupabaseConfigured } from '../services/supabase/client';
import { StorageService } from '../services/storageService';
import { aiConfigStore } from '../state/aiConfigStore';
import { dealerStore } from '../state/dealerStore';
import { polymarketStore } from '../state/polymarketStore';

// User type compatible with the rest of the app
export interface User {
    uid: string;
    email: string | null;
    displayName: string | null;
    photoURL: string | null;
    emailVerified: boolean;
}

interface AuthContextType {
    user: User | null;
    loading: boolean;
    signInWithGoogle: () => Promise<void>;
    signInWithGitHub: () => Promise<void>;
    signInWithDiscord: () => Promise<void>;
    signInWithEthereum: () => Promise<void>;
    signInWithSolana: () => Promise<void>;
    signInWithEmail: (email: string, password: string) => Promise<void>;
    signUp: (email: string, password: string) => Promise<void>;
    logout: () => Promise<void>;
    deleteAccount: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth(): AuthContextType {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}

/**
 * Convert SupabaseUser to our User format (compatible with Firebase User interface)
 */
function mapToUser(supabaseUser: SupabaseUser | null): User | null {
    if (!supabaseUser) return null;
    return {
        uid: supabaseUser.id,
        email: supabaseUser.email,
        displayName: supabaseUser.displayName,
        photoURL: supabaseUser.photoURL,
        emailVerified: supabaseUser.emailVerified
    };
}

interface AuthProviderProps {
    children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    // Initialize Supabase and listen to auth state changes
    useEffect(() => {
        const initAuth = async () => {
            // Check if Supabase is configured
            if (!isSupabaseConfigured()) {
                console.warn('[AuthContext] Supabase not configured. Auth will not work until configured.');
                setLoading(false);
                return;
            }

            // Initialize Supabase client
            await initializeSupabase();

            // Initialize auth service
            await supabaseAuth.initialize();

            // Get initial user
            const currentUser = mapToUser(supabaseAuth.getUser());
            setUser(currentUser);

            // Set user context for StorageService (user-scoped storage)
            StorageService.setUserId(currentUser?.uid || null);

            if (currentUser?.uid) {
                await StorageService.migrateToUserScoped();
                await aiConfigStore.reload();
                await dealerStore.reloadFromStorage();
                await polymarketStore.reloadFromStorage();
            }

            setLoading(false);
        };

        initAuth();

        // Subscribe to auth state changes
        const unsubscribe = supabaseAuth.onAuthStateChange(async (supabaseUser) => {
            const mappedUser = mapToUser(supabaseUser);
            setUser(mappedUser);

            // Set user context for StorageService (user-scoped storage)
            StorageService.setUserId(mappedUser?.uid || null);

            // Migrate legacy unscoped data to user-scoped keys and reload stores
            if (mappedUser?.uid) {
                await StorageService.migrateToUserScoped();
                await aiConfigStore.reload();
                await dealerStore.reloadFromStorage();
                await polymarketStore.reloadFromStorage();
            } else {
                // User logged out - reset stores to clear data
                dealerStore.reset();
                polymarketStore.reset();
            }
        });

        // Cleanup subscription
        return () => unsubscribe();
    }, []);

    const signInWithGoogle = async () => {
        try {
            await supabaseAuth.signInWithGoogle();
        } catch (error) {
            console.error('Google sign-in error:', error);
            throw error;
        }
    };

    const signInWithGitHub = async () => {
        try {
            await supabaseAuth.signInWithGitHub();
        } catch (error) {
            console.error('GitHub sign-in error:', error);
            throw error;
        }
    };

    const signInWithDiscord = async () => {
        try {
            await supabaseAuth.signInWithDiscord();
        } catch (error) {
            console.error('Discord sign-in error:', error);
            throw error;
        }
    };

    const signInWithEthereum = async () => {
        try {
            await supabaseAuth.signInWithEthereum();
        } catch (error) {
            console.error('Ethereum sign-in error:', error);
            throw error;
        }
    };

    const signInWithSolana = async () => {
        try {
            await supabaseAuth.signInWithSolana();
        } catch (error) {
            console.error('Solana sign-in error:', error);
            throw error;
        }
    };

    const signInWithEmail = async (email: string, password: string) => {
        try {
            await supabaseAuth.signInWithEmail(email, password);
        } catch (error) {
            console.error('Email sign-in error:', error);
            throw error;
        }
    };

    const signUp = async (email: string, password: string) => {
        try {
            await supabaseAuth.signUp(email, password);
        } catch (error) {
            console.error('Sign-up error:', error);
            throw error;
        }
    };

    const logout = async () => {
        try {
            await supabaseAuth.logout();
        } catch (error) {
            console.error('Logout error:', error);
            throw error;
        }
    };

    const deleteAccount = async () => {
        try {
            await supabaseAuth.deleteAccount();
        } catch (error) {
            console.error('Delete account error:', error);
            throw error;
        }
    };

    const value: AuthContextType = {
        user,
        loading,
        signInWithGoogle,
        signInWithGitHub,
        signInWithDiscord,
        signInWithEthereum,
        signInWithSolana,
        signInWithEmail,
        signUp,
        logout,
        deleteAccount,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
