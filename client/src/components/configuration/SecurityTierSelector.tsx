// Security Tier Selector Component
// Allows users to configure and migrate between security tiers

import React, { useState, useEffect, useSyncExternalStore } from 'react';
import { Shield, Clock, Zap, Database } from 'lucide-react';
import {
    securityTierService,
    SecurityTier,
    SECURITY_TIERS,
} from '../../services/securityTierService';
import { StorageService } from '../../services/storageService';
import { userDataSupabase } from '../../services/supabase/userDataSupabase';
import { SupabaseConnectModal } from './modals/SupabaseConnectModal';
import { SessionKeyModal } from './modals/SessionKeyModal';
import { PersistentKeyModal } from './modals/PersistentKeyModal';

interface SecurityTierSelectorProps {
    onTierChange?: (tier: SecurityTier) => void;
}

export const SecurityTierSelector: React.FC<SecurityTierSelectorProps> = ({ onTierChange }) => {
    const tierState = useSyncExternalStore(
        securityTierService.subscribe.bind(securityTierService),
        () => securityTierService.getState()
    );

    const [selectedTier, setSelectedTier] = useState<SecurityTier>(tierState.currentTier);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showSupabaseSetup, setShowSupabaseSetup] = useState(false);
    const [isSupabaseConnected, setIsSupabaseConnected] = useState(userDataSupabase.isConnected());

    // Modal States
    const [isSessionModalOpen, setIsSessionModalOpen] = useState(false);
    const [isPersistentModalOpen, setIsPersistentModalOpen] = useState(false);

    const sessionStatus = securityTierService.getSessionStatus();

    // Update selected tier when state changes
    useEffect(() => {
        setSelectedTier(tierState.currentTier);
    }, [tierState.currentTier]);

    // Subscribe to user's Supabase connection state
    useEffect(() => {
        const unsubscribe = userDataSupabase.subscribe((connected) => {
            setIsSupabaseConnected(connected);
        });
        return () => unsubscribe();
    }, []);

    const handleTierSelect = async (tier: SecurityTier) => {
        // If selecting the already active tier, do nothing
        if (tier === tierState.currentTier) {
            setSelectedTier(tier);
            return;
        }

        // For Tier B or C, check if user's Supabase is connected
        if ((tier === 'session' || tier === 'persistent') && !isSupabaseConnected) {
            setSelectedTier(tier); // Visually select it
            setShowSupabaseSetup(true);
            return;
        }

        setSelectedTier(tier);
        setError(null);

        // Open appropriate modal or execute immediate migration
        if (tier === 'local') {
            await handleMigrateToLocal();
        } else if (tier === 'session') {
            setIsSessionModalOpen(true);
        } else if (tier === 'persistent') {
            setIsPersistentModalOpen(true);
        }
    };

    // Called when Supabase setup wizard completes
    const handleSupabaseConnected = () => {
        setShowSupabaseSetup(false);
        setIsSupabaseConnected(true);
        
        // Resume the flow based on selected tier
        if (selectedTier === 'session') {
            setIsSessionModalOpen(true);
        } else if (selectedTier === 'persistent') {
            setIsPersistentModalOpen(true);
        }
    };

    const handleMigrateToLocal = async () => {
        setIsLoading(true);
        try {
            const result = await securityTierService.migrateToLocal();
            if (!result.success) throw new Error(result.error || 'Migration failed');
            onTierChange?.('local');
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Unknown error');
            // Revert selection
            setSelectedTier(tierState.currentTier);
        } finally {
            setIsLoading(false);
        }
    };

    const handleMigrateToSession = async (password: string, duration: number) => {
        setIsLoading(true);
        try {
            const encryptedBlob = await StorageService.getItem(
                StorageService.getUserKey('agent_hl_vault_enc')
            );
            const encryptionSalt = await StorageService.getItem(
                StorageService.getUserKey('agent_hl_vault_salt')
            );

            if (!encryptedBlob || !encryptionSalt) {
                throw new Error('No encrypted key found. Please set up your wallet first.');
            }

            const result = await securityTierService.migrateToSession(
                encryptedBlob,
                encryptionSalt,
                password,
                duration
            );

            if (!result.success) throw new Error(result.error || 'Migration failed');
            
            setIsSessionModalOpen(false);
            onTierChange?.('session');
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Unknown error');
        } finally {
            setIsLoading(false);
        }
    };

    const handleMigrateToPersistent = async (password: string) => {
        setIsLoading(true);
        try {
            const encryptedBlob = await StorageService.getItem(
                StorageService.getUserKey('agent_hl_vault_enc')
            );
            const encryptionSalt = await StorageService.getItem(
                StorageService.getUserKey('agent_hl_vault_salt')
            );

            if (!encryptedBlob || !encryptionSalt) {
                throw new Error('No encrypted key found. Please set up your wallet first.');
            }

            const result = await securityTierService.migrateToPersistent(
                encryptedBlob,
                encryptionSalt,
                password
            );

            if (!result.success) throw new Error(result.error || 'Migration failed');

            setIsPersistentModalOpen(false);
            onTierChange?.('persistent');
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Unknown error');
        } finally {
            setIsLoading(false);
        }
    };

    const getTierIcon = (tier: SecurityTier) => {
        switch (tier) {
            case 'local': return <Shield className="w-6 h-6" />;
            case 'session': return <Clock className="w-6 h-6" />;
            case 'persistent': return <Zap className="w-6 h-6" />;
        }
    };

    const getTierColor = (tier: SecurityTier, isSelected: boolean, isCurrent: boolean) => {
        if (isCurrent) return 'border-emerald-500/50 bg-emerald-500/5';
        if (isSelected) return 'border-blue-500 bg-blue-500/5';
        return 'border-gray-800 hover:border-gray-700 bg-gray-900/40';
    };

    return (
        <div className="space-y-6">
            {/* Current Status Banner */}
            {tierState.currentTier === 'session' && sessionStatus.active && (
                <div className="flex items-center gap-3 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg animate-in fade-in slide-in-from-top-1">
                    <div className="p-1.5 bg-amber-500/20 rounded-full animate-pulse">
                         <Clock className="w-3.5 h-3.5 text-amber-400" />
                    </div>
                    <div className="flex-1">
                        <span className="text-sm font-medium text-amber-200">
                            Session Active
                        </span>
                        <span className="text-xs text-amber-200/70 block">
                             {sessionStatus.remainingHours}h remaining
                        </span>
                    </div>
                </div>
            )}

            {/* Tier Cards Grid */}
            <div className="grid gap-3">
                {(Object.keys(SECURITY_TIERS) as SecurityTier[]).map((tier) => {
                    const info = SECURITY_TIERS[tier];
                    const isCurrent = tierState.currentTier === tier;
                    const isSelected = selectedTier === tier;

                    return (
                        <button
                            key={tier}
                            onClick={() => handleTierSelect(tier)}
                            className={`
                                group relative p-4 rounded-xl border transition-all duration-300 text-left w-full
                                ${getTierColor(tier, isSelected, isCurrent)}
                            `}
                        >
                            {/* Current Badge */}
                            {isCurrent && (
                                <div className="absolute top-3 right-3 flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 backdrop-blur-sm">
                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                    <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">Active</span>
                                </div>
                            )}

                            <div className="flex items-start gap-4">
                                {/* Icon */}
                                <div className={`
                                    p-3 rounded-xl transition-colors
                                    ${tier === 'local' ? 'bg-emerald-500/10 text-emerald-400 group-hover:bg-emerald-500/20' :
                                        tier === 'session' ? 'bg-amber-500/10 text-amber-400 group-hover:bg-amber-500/20' :
                                            'bg-red-500/10 text-red-400 group-hover:bg-red-500/20'}
                                `}>
                                    {getTierIcon(tier)}
                                </div>

                                {/* Content */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <h4 className={`font-semibold text-sm ${isCurrent ? 'text-white' : 'text-gray-200 group-hover:text-white'}`}>
                                            {info.label}
                                        </h4>
                                    </div>
                                    
                                    <p className="text-xs text-gray-500 leading-relaxed mb-3 pr-8">
                                        {info.description}
                                    </p>

                                    {/* Features Badges */}
                                    <div className="flex flex-wrap gap-2">
                                        <span className={`
                                            px-2 py-0.5 text-[10px] uppercase tracking-wider font-medium rounded-md border
                                            ${info.execution24x7
                                                ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-400'
                                                : 'bg-gray-800 border-gray-700 text-gray-400'}
                                        `}>
                                            {info.execution24x7 ? '24/7 Cloud Run' : 'Browser Only'}
                                        </span>
                                        <span className={`
                                            px-2 py-0.5 text-[10px] uppercase tracking-wider font-medium rounded-md border
                                            ${info.securityLevel === 3 ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-400' :
                                                info.securityLevel === 2 ? 'bg-amber-500/5 border-amber-500/20 text-amber-400' :
                                                    'bg-red-500/5 border-red-500/20 text-red-400'}
                                        `}>
                                            {info.securityLevel === 3 ? 'High Security' :
                                                info.securityLevel === 2 ? 'Medium Security' :
                                                    'Low Security'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </button>
                    );
                })}
            </div>

            {/* Supabase Status Footer */}
            {(selectedTier === 'session' || selectedTier === 'persistent' || isSupabaseConnected) && (
                <div className="pt-2">
                    <div className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${
                        isSupabaseConnected 
                        ? 'bg-emerald-900/10 border-emerald-500/20' 
                        : 'bg-blue-900/10 border-blue-500/20'
                    }`}>
                        <div className={`p-1.5 rounded-md ${isSupabaseConnected ? 'bg-emerald-500/20' : 'bg-blue-500/20'}`}>
                            <Database className={`w-3.5 h-3.5 ${isSupabaseConnected ? 'text-emerald-400' : 'text-blue-400'}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className={`text-xs font-medium ${isSupabaseConnected ? 'text-emerald-200' : 'text-blue-200'}`}>
                                {isSupabaseConnected ? 'Supabase Connected' : 'Supabase Connection Required'}
                            </p>
                            <p className={`text-[10px] truncate ${isSupabaseConnected ? 'text-emerald-200/60' : 'text-blue-200/60'}`}>
                                {isSupabaseConnected 
                                    ? `Project: ${userDataSupabase.getConfig()?.projectId}` 
                                    : 'Required for cloud execution modes'}
                            </p>
                        </div>
                        {isSupabaseConnected && (
                            <button
                                onClick={() => setShowSupabaseSetup(true)}
                                className="text-[10px] font-medium text-emerald-400 hover:text-emerald-300 transition-colors px-2 py-1 bg-emerald-500/10 rounded hover:bg-emerald-500/20"
                            >
                                Edit
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* Error Display */}
            {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg animate-in fade-in slide-in-from-top-1">
                    <p className="text-xs text-red-300 font-medium">{error}</p>
                </div>
            )}

            {/* Modals and Wizards */}
            <SupabaseConnectModal
                isOpen={showSupabaseSetup}
                onClose={() => {
                    setShowSupabaseSetup(false);
                    // If we were just trying to connect, we don't necessarily need to revert tier,
                    // but if the user cancelled the connect mandatory for a tier, we should probably revert.
                    // However, visual selection might be kept or reverted.
                    // Let's revert to keep it consistent with "Cancel".
                    if (selectedTier !== tierState.currentTier) {
                         setSelectedTier(tierState.currentTier);
                    }
                }}
                onConnect={handleSupabaseConnected}
            />

            <SessionKeyModal 
                isOpen={isSessionModalOpen}
                onClose={() => setIsSessionModalOpen(false)}
                onConfirm={handleMigrateToSession}
                isLoading={isLoading}
                error={error}
            />

            <PersistentKeyModal
                isOpen={isPersistentModalOpen}
                onClose={() => setIsPersistentModalOpen(false)}
                onConfirm={handleMigrateToPersistent}
                isLoading={isLoading}
                error={error}
            />
        </div>
    );
};
