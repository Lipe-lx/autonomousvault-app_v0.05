import React, { ReactNode } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { LoginPage } from './LoginPage';

interface AuthGateProps {
    children: ReactNode;
}

export function AuthGate({ children }: AuthGateProps) {
    const { user, loading } = useAuth();

    // Show loading spinner while checking auth state
    if (loading) {
        return (
            <div className="h-screen w-screen bg-[#0f1015] flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    {/* Animated loading spinner */}
                    <div className="relative w-12 h-12">
                        <div className="absolute inset-0 border-2 border-[#232328] rounded-full" />
                        <div className="absolute inset-0 border-2 border-transparent border-t-[#E7FE55] rounded-full animate-spin" />
                    </div>
                    <p className="text-[#747580] text-sm">Loading...</p>
                </div>
            </div>
        );
    }

    // Show login page if not authenticated
    if (!user) {
        return <LoginPage />;
    }

    // User is authenticated, render the app
    return <>{children}</>;
}
