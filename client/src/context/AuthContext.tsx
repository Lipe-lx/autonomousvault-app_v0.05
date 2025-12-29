import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import {
    User,
    onAuthStateChanged,
    signInWithPopup,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut,
} from 'firebase/auth';
import { auth, googleProvider } from '../services/firebase';
import { StorageService } from '../services/storageService';
import { aiConfigStore } from '../state/aiConfigStore';
import { dealerStore } from '../state/dealerStore';
import { polymarketStore } from '../state/polymarketStore';

interface AuthContextType {
    user: User | null;
    loading: boolean;
    signInWithGoogle: () => Promise<void>;
    signInWithEmail: (email: string, password: string) => Promise<void>;
    signUp: (email: string, password: string) => Promise<void>;
    logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth(): AuthContextType {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}

interface AuthProviderProps {
    children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    // Listen to auth state changes
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            setUser(user);
            // Set user context for StorageService (user-scoped storage)
            StorageService.setUserId(user?.uid || null);

            // Migrate legacy unscoped data to user-scoped keys and reload stores
            if (user?.uid) {
                await StorageService.migrateToUserScoped();
                // Reload aiConfigStore to get API keys with correct user-scoped key
                await aiConfigStore.reload();
                // Reload dealer stores to get user settings
                await dealerStore.reloadFromStorage();
                await polymarketStore.reloadFromStorage();
            } else {
                // User logged out - reset stores to clear data
                dealerStore.reset();
                polymarketStore.reset();
                // We might want to clear local storage that was scoped? No, just reset in-memory.
            }

            setLoading(false);
        });

        // Cleanup subscription
        return () => unsubscribe();
    }, []);

    const signInWithGoogle = async () => {
        try {
            await signInWithPopup(auth, googleProvider);
        } catch (error) {
            console.error('Google sign-in error:', error);
            throw error;
        }
    };

    const signInWithEmail = async (email: string, password: string) => {
        try {
            await signInWithEmailAndPassword(auth, email, password);
        } catch (error) {
            console.error('Email sign-in error:', error);
            throw error;
        }
    };

    const signUp = async (email: string, password: string) => {
        try {
            await createUserWithEmailAndPassword(auth, email, password);
        } catch (error) {
            console.error('Sign-up error:', error);
            throw error;
        }
    };

    const logout = async () => {
        try {
            await signOut(auth);
        } catch (error) {
            console.error('Logout error:', error);
            throw error;
        }
    };

    const value: AuthContextType = {
        user,
        loading,
        signInWithGoogle,
        signInWithEmail,
        signUp,
        logout,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
