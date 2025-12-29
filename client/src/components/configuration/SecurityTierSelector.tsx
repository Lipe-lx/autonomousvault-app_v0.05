// Security Tier Selector Component
// Allows users to configure and migrate between security tiers

import React, { useState, useEffect, useSyncExternalStore } from 'react';
import { Shield, Clock, Zap, AlertTriangle, Check, Loader2, Info } from 'lucide-react';
import {
    securityTierService,
    SecurityTier,
    SECURITY_TIERS,
    SecurityTierInfo
} from '../../services/securityTierService';
import { StorageService } from '../../services/storageService';

interface SecurityTierSelectorProps {
    onTierChange?: (tier: SecurityTier) => void;
}

export const SecurityTierSelector: React.FC<SecurityTierSelectorProps> = ({ onTierChange }) => {
    const tierState = useSyncExternalStore(
        securityTierService.subscribe.bind(securityTierService),
        () => securityTierService.getState()
    );

    const [selectedTier, setSelectedTier] = useState<SecurityTier>(tierState.currentTier);
    const [password, setPassword] = useState('');
    const [sessionDuration, setSessionDuration] = useState(24);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showConfirmation, setShowConfirmation] = useState(false);
    const [acknowledgedRisk, setAcknowledgedRisk] = useState(false);

    const sessionStatus = securityTierService.getSessionStatus();

    // Update selected tier when state changes
    useEffect(() => {
        setSelectedTier(tierState.currentTier);
    }, [tierState.currentTier]);

    const handleTierSelect = (tier: SecurityTier) => {
        setSelectedTier(tier);
        setError(null);
        setShowConfirmation(tier !== tierState.currentTier);
        setAcknowledgedRisk(false);
    };

    const handleMigrate = async () => {
        if (selectedTier === tierState.currentTier) return;

        // For Tier C, require explicit risk acknowledgment
        if (selectedTier === 'persistent' && !acknowledgedRisk) {
            setError('You must acknowledge the security implications');
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            let result: { success: boolean; error?: string };

            if (selectedTier === 'local') {
                result = await securityTierService.migrateToLocal();
            } else {
                // Need encrypted key for Tier B and C
                const encryptedBlob = await StorageService.getItem(
                    StorageService.getUserKey('agent_hl_vault_enc')
                );
                const encryptionSalt = await StorageService.getItem(
                    StorageService.getUserKey('agent_hl_vault_salt')
                );

                if (!encryptedBlob || !encryptionSalt) {
                    throw new Error('No encrypted key found. Please set up your wallet first.');
                }

                if (!password) {
                    throw new Error('Password is required');
                }

                if (selectedTier === 'session') {
                    result = await securityTierService.migrateToSession(
                        encryptedBlob,
                        encryptionSalt,
                        password,
                        sessionDuration
                    );
                } else {
                    result = await securityTierService.migrateToPersistent(
                        encryptedBlob,
                        encryptionSalt,
                        password
                    );
                }
            }

            if (!result.success) {
                throw new Error(result.error || 'Migration failed');
            }

            setPassword('');
            setShowConfirmation(false);
            onTierChange?.(selectedTier);
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
        if (isCurrent && isSelected) return 'border-green-500 bg-green-500/10';
        if (isSelected) return 'border-blue-500 bg-blue-500/10';
        return 'border-zinc-700 hover:border-zinc-500';
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-3">
                <Shield className="w-5 h-5 text-blue-400" />
                <h3 className="text-lg font-semibold text-white">Security Tier</h3>
            </div>

            {/* Current Status */}
            {tierState.currentTier === 'session' && sessionStatus.active && (
                <div className="flex items-center gap-2 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                    <Clock className="w-4 h-4 text-amber-400" />
                    <span className="text-sm text-amber-200">
                        Session active: {sessionStatus.remainingHours}h remaining
                    </span>
                </div>
            )}

            {/* Tier Cards */}
            <div className="grid gap-4">
                {(Object.keys(SECURITY_TIERS) as SecurityTier[]).map((tier) => {
                    const info = SECURITY_TIERS[tier];
                    const isCurrent = tierState.currentTier === tier;
                    const isSelected = selectedTier === tier;

                    return (
                        <button
                            key={tier}
                            onClick={() => handleTierSelect(tier)}
                            className={`
                                relative p-4 rounded-xl border-2 transition-all text-left
                                ${getTierColor(tier, isSelected, isCurrent)}
                            `}
                        >
                            {/* Current badge */}
                            {isCurrent && (
                                <span className="absolute top-2 right-2 px-2 py-0.5 text-xs font-medium bg-green-500/20 text-green-400 rounded-full">
                                    Active
                                </span>
                            )}

                            <div className="flex items-start gap-4">
                                {/* Icon */}
                                <div className={`
                                    p-2 rounded-lg
                                    ${tier === 'local' ? 'bg-green-500/20 text-green-400' :
                                        tier === 'session' ? 'bg-amber-500/20 text-amber-400' :
                                            'bg-red-500/20 text-red-400'}
                                `}>
                                    {getTierIcon(tier)}
                                </div>

                                {/* Content */}
                                <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                        <h4 className="font-semibold text-white">
                                            {info.icon} {info.label}
                                        </h4>
                                    </div>
                                    <p className="text-sm text-zinc-400 mt-1">
                                        {info.description}
                                    </p>

                                    {/* Features */}
                                    <div className="flex flex-wrap gap-2 mt-3">
                                        <span className={`
                                            px-2 py-0.5 text-xs rounded-full
                                            ${info.execution24x7
                                                ? 'bg-green-500/20 text-green-300'
                                                : 'bg-zinc-700 text-zinc-400'}
                                        `}>
                                            {info.execution24x7 ? '24/7 Execution' : 'Browser Required'}
                                        </span>
                                        <span className={`
                                            px-2 py-0.5 text-xs rounded-full
                                            ${info.securityLevel === 3 ? 'bg-green-500/20 text-green-300' :
                                                info.securityLevel === 2 ? 'bg-amber-500/20 text-amber-300' :
                                                    'bg-red-500/20 text-red-300'}
                                        `}>
                                            {info.securityLevel === 3 ? 'Max Security' :
                                                info.securityLevel === 2 ? 'Medium Security' :
                                                    'Lower Security'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </button>
                    );
                })}
            </div>

            {/* Migration Form */}
            {showConfirmation && selectedTier !== tierState.currentTier && (
                <div className="p-4 bg-zinc-800/50 border border-zinc-700 rounded-xl space-y-4">
                    <h4 className="font-medium text-white flex items-center gap-2">
                        <Info className="w-4 h-4 text-blue-400" />
                        Migrate to {SECURITY_TIERS[selectedTier].label}
                    </h4>

                    {/* Password input for Tier B and C */}
                    {selectedTier !== 'local' && (
                        <div>
                            <label className="block text-sm text-zinc-400 mb-1">
                                Wallet Password
                            </label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Enter your wallet password"
                                className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-white placeholder:text-zinc-500 focus:border-blue-500 focus:outline-none"
                            />
                        </div>
                    )}

                    {/* Session duration for Tier B */}
                    {selectedTier === 'session' && (
                        <div>
                            <label className="block text-sm text-zinc-400 mb-1">
                                Session Duration (hours)
                            </label>
                            <input
                                type="number"
                                value={sessionDuration}
                                onChange={(e) => setSessionDuration(Math.max(1, Math.min(72, parseInt(e.target.value) || 24)))}
                                min={1}
                                max={72}
                                className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-white focus:border-blue-500 focus:outline-none"
                            />
                            <p className="text-xs text-zinc-500 mt-1">1-72 hours. Dealer will stop after expiration.</p>
                        </div>
                    )}

                    {/* Risk acknowledgment for Tier C */}
                    {selectedTier === 'persistent' && (
                        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                            <div className="flex items-start gap-2">
                                <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                                <div>
                                    <p className="text-sm text-red-200 font-medium">Security Warning</p>
                                    <p className="text-xs text-red-300/80 mt-1">
                                        Your password will be stored encrypted on the server. This enables 24/7
                                        execution but reduces security. If the server is compromised, your
                                        encrypted wallet could potentially be decrypted.
                                    </p>
                                    <label className="flex items-center gap-2 mt-3 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={acknowledgedRisk}
                                            onChange={(e) => setAcknowledgedRisk(e.target.checked)}
                                            className="w-4 h-4 rounded border-zinc-600 text-red-500 focus:ring-red-500"
                                        />
                                        <span className="text-sm text-red-200">
                                            I understand and accept the risks
                                        </span>
                                    </label>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Downgrade notice */}
                    {selectedTier === 'local' && tierState.keysInSupabase && (
                        <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                            <p className="text-sm text-blue-200">
                                Your encrypted key and any stored password will be deleted from the server.
                                Keys will only exist in your browser.
                            </p>
                        </div>
                    )}

                    {/* Error */}
                    {error && (
                        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                            <p className="text-sm text-red-300">{error}</p>
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-3">
                        <button
                            onClick={() => {
                                setShowConfirmation(false);
                                setSelectedTier(tierState.currentTier);
                                setPassword('');
                                setError(null);
                            }}
                            className="flex-1 px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleMigrate}
                            disabled={isLoading || (selectedTier === 'persistent' && !acknowledgedRisk)}
                            className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-700 disabled:cursor-not-allowed text-white rounded-lg transition-colors flex items-center justify-center gap-2"
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Migrating...
                                </>
                            ) : (
                                <>
                                    <Check className="w-4 h-4" />
                                    Confirm Migration
                                </>
                            )}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SecurityTierSelector;
