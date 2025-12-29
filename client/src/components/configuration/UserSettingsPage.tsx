import React, { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import {
    Trash2,
    ExternalLink,
    Download,
    Upload,
    AlertTriangle,
    FileJson,
    Check,
    X,
    Shield,
    FileText,
    Scale,
    MessageSquare
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { StorageService } from '../../services/storageService';
import { ConversationService, Conversation } from '../../services/conversationService';
import { dealerStore } from '../../state/dealerStore';
import { polymarketStore } from '../../state/polymarketStore';
import { cn } from '@/lib/utils';

// Keys that are safe to export (non-sensitive)
const EXPORTABLE_KEYS = [
    'agent_activity_log',
    'vault_dealer_strategy',
    'agent_scheduler_tasks',
    // We'll handle dealer settings specially to exclude sensitive parts
];

// Keys that should NEVER be exported
const SENSITIVE_PATTERNS = [
    'enc', 'encrypted', 'private', 'key', 'secret', 'password', 'token', 'api'
];

interface UserSettingsPageProps {
    addNotification: (msg: string) => void;
    password: string;
}

interface BackupData {
    version: string;
    exportedAt: string;
    data: {
        activityLog?: any[];
        conversations?: Conversation[];
        hyperliquidDealer?: {
            settings?: any;
            strategyPrompt?: string;
        };
        polymarketDealer?: {
            settings?: any;
            strategyPrompt?: string;
        };
        schedulerTasks?: any[];
    };
}

export const UserSettingsPage: React.FC<UserSettingsPageProps> = ({ addNotification, password }) => {
    const { user, logout } = useAuth();
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [deleteConfirmText, setDeleteConfirmText] = useState('');

    const [showImportModal, setShowImportModal] = useState(false);
    const [importData, setImportData] = useState<BackupData | null>(null);
    const [isExporting, setIsExporting] = useState(false);
    const [isImporting, setIsImporting] = useState(false);

    // Password for encryption during import (if prop is missing)
    const [importPassword, setImportPassword] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Export modal state
    const [showExportModal, setShowExportModal] = useState(false);
    const [exportPassword, setExportPassword] = useState('');

    // Execute export with validated password
    const executeExport = async (validatedPassword: string) => {
        if (!user?.uid) {
            addNotification('No user session found');
            return;
        }

        setIsExporting(true);
        try {
            // Collect exportable data
            const activityLogKey = StorageService.getUserKey('agent_activity_log');
            const strategyKey = StorageService.getUserKey('vault_dealer_strategy');
            const schedulerKey = StorageService.getUserKey('agent_scheduler_tasks');

            const [activityLog, strategyPrompt, schedulerTasks] = await Promise.all([
                StorageService.getItem(activityLogKey),
                StorageService.getItem(strategyKey),
                StorageService.getItem(schedulerKey)
            ]);

            // Get conversation history (decrypted)
            let conversations: Conversation[] = [];
            if (validatedPassword) {
                const conversationMetas = await ConversationService.getHistory();
                for (const meta of conversationMetas) {
                    try {
                        const conv = await ConversationService.loadConversation(meta.id, validatedPassword);
                        if (conv) {
                            conversations.push(conv);
                        }
                    } catch (e) {
                        console.warn(`Failed to decrypt conversation ${meta.id}`, e);
                    }
                }
            }

            // Get dealer settings (from IndexedDB via StorageService)
            const dealerStorageRaw = await StorageService.getItem(StorageService.getUserKey('vault_dealer_storage'));
            let dealerSettings = null;
            if (dealerStorageRaw) {
                try {
                    const parsed = JSON.parse(dealerStorageRaw);
                    // Export all Hyperliquid dealer settings
                    dealerSettings = {
                        // Core Settings
                        strategyPrompt: parsed.settings?.strategyPrompt,
                        aggressiveMode: parsed.settings?.aggressiveMode,
                        maxLeverage: parsed.settings?.maxLeverage,
                        maxPositionSizeUSDC: parsed.settings?.maxPositionSizeUSDC,
                        maxOpenPositions: parsed.settings?.maxOpenPositions,
                        // Bankroll
                        bankrollType: parsed.settings?.bankrollType,
                        manualBankroll: parsed.settings?.manualBankroll,
                        // Trading Configuration
                        tradingPairs: parsed.settings?.tradingPairs,
                        checkIntervalSeconds: parsed.settings?.checkIntervalSeconds,
                        analysisTimeframe: parsed.settings?.analysisTimeframe,
                        historyCandles: parsed.settings?.historyCandles,
                        // Macro Timeframe Configuration
                        macroTimeframeEnabled: parsed.settings?.macroTimeframeEnabled,
                        macroTimeframe: parsed.settings?.macroTimeframe,
                        macroEnabledIndicators: parsed.settings?.macroEnabledIndicators,
                        // Indicator Configuration
                        indicatorSettings: parsed.settings?.indicatorSettings,
                        autonomousIndicators: parsed.settings?.autonomousIndicators,
                        selectedPreset: parsed.settings?.selectedPreset,
                        promptMode: parsed.settings?.promptMode,
                        // Risk Protection
                        stopLossEnabled: parsed.settings?.stopLossEnabled,
                        stopLossPercent: parsed.settings?.stopLossPercent,
                        takeProfitEnabled: parsed.settings?.takeProfitEnabled,
                        takeProfitPercent: parsed.settings?.takeProfitPercent,
                    };
                } catch (e) {
                    console.error('Failed to parse dealer settings', e);
                }
            }

            // Get Polymarket dealer settings (from IndexedDB via StorageService)
            const polymarketStorageRaw = await StorageService.getItem(StorageService.getUserKey('vault_polymarket_storage'));
            let polymarketSettings = null;
            let polymarketStrategyPrompt: string | undefined = undefined;
            if (polymarketStorageRaw) {
                try {
                    const parsed = JSON.parse(polymarketStorageRaw);
                    // Export all Polymarket settings with correct field names
                    polymarketSettings = {
                        // Strategy
                        strategyPrompt: parsed.settings?.strategyPrompt,
                        promptMode: parsed.settings?.promptMode,
                        selectedPreset: parsed.settings?.selectedPreset,
                        // Market Selection
                        marketSelectionMode: parsed.settings?.marketSelectionMode,
                        selectedMarkets: parsed.settings?.selectedMarkets,
                        allowedCategories: parsed.settings?.allowedCategories,
                        // Risk Management
                        maxPositionSizeUSDC: parsed.settings?.maxPositionSizeUSDC,
                        maxOpenPositions: parsed.settings?.maxOpenPositions,
                        minLiquidity: parsed.settings?.minLiquidity,
                        minVolume24h: parsed.settings?.minVolume24h,
                        // Additional thresholds
                        minVolumeThreshold: parsed.settings?.minVolumeThreshold,
                        minLiquidityThreshold: parsed.settings?.minLiquidityThreshold,
                        minSpreadThreshold: parsed.settings?.minSpreadThreshold,
                        confidenceThreshold: parsed.settings?.confidenceThreshold,
                        // Bankroll
                        bankrollType: parsed.settings?.bankrollType,
                        manualBankroll: parsed.settings?.manualBankroll,
                        // Timing
                        checkIntervalSeconds: parsed.settings?.checkIntervalSeconds,
                    };
                    // Get custom strategy prompt separately for backwards compatibility
                    polymarketStrategyPrompt = parsed.settings?.strategyPrompt;
                } catch (e) {
                    console.error('Failed to parse polymarket settings', e);
                }
            }

            const backup: BackupData = {
                version: '1.0',
                exportedAt: new Date().toISOString(),
                data: {
                    activityLog: activityLog ? JSON.parse(activityLog) : [],
                    conversations: conversations.length > 0 ? conversations : undefined,
                    hyperliquidDealer: {
                        settings: dealerSettings,
                        strategyPrompt: strategyPrompt || undefined
                    },
                    polymarketDealer: {
                        settings: polymarketSettings,
                        strategyPrompt: polymarketStrategyPrompt
                    },
                    schedulerTasks: schedulerTasks ? JSON.parse(schedulerTasks) : []
                }
            };

            // Create and download file
            const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `autonomousvault_backup_${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            addNotification('Backup exported successfully!');
            setShowExportModal(false);
            setExportPassword('');
        } catch (error) {
            console.error('Export failed:', error);
            addNotification('Failed to export data');
        } finally {
            setIsExporting(false);
        }
    };

    // Open export password modal
    const initiateExport = () => {
        setExportPassword('');
        setShowExportModal(true);
    };

    // Confirm export password
    const handleConfirmExport = () => {
        if (!exportPassword) {
            addNotification('Please enter your password');
            return;
        }

        if (exportPassword !== password) {
            addNotification('Incorrect password');
            return;
        }

        executeExport(exportPassword);
    };

    // Handle file selection for import
    const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const content = e.target?.result as string;
                const parsed = JSON.parse(content) as BackupData;

                // Validate structure
                if (!parsed.version || !parsed.data) {
                    addNotification('Invalid backup file format');
                    return;
                }

                setImportData(parsed);
                setShowImportModal(true);
            } catch (error) {
                console.error('Failed to parse backup file:', error);
                addNotification('Failed to read backup file');
            }
        };
        reader.readAsText(file);

        // Reset input
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    // Import data from backup
    const handleImport = async () => {
        if (!importData || !user?.uid) return;

        setIsImporting(true);
        try {
            const { data } = importData;

            // Restore activity log
            if (data.activityLog?.length) {
                const key = StorageService.getUserKey('agent_activity_log');
                await StorageService.setItem(key, JSON.stringify(data.activityLog));
            }

            // Restore scheduler tasks
            if (data.schedulerTasks?.length) {
                const key = StorageService.getUserKey('agent_scheduler_tasks');
                await StorageService.setItem(key, JSON.stringify(data.schedulerTasks));
            }

            // Restore Hyperliquid strategy prompt
            if (data.hyperliquidDealer?.strategyPrompt) {
                const key = StorageService.getUserKey('vault_dealer_strategy');
                await StorageService.setItem(key, data.hyperliquidDealer.strategyPrompt);
            }

            // Restore conversations (re-encrypt with current password)
            const passwordToUse = password || importPassword;
            if (data.conversations?.length) {
                if (!passwordToUse) {
                    addNotification('ERROR: Password required to import conversations');
                    setIsImporting(false);
                    return;
                }

                console.log(`[Import] Restoring ${data.conversations.length} conversations using provided password...`);
                for (const conv of data.conversations) {
                    try {
                        await ConversationService.saveConversation(conv, passwordToUse);
                    } catch (e) {
                        console.warn(`Failed to restore conversation ${conv.id}`, e);
                    }
                }
            }

            // Restore Hyperliquid dealer settings (merge with existing)
            if (data.hyperliquidDealer?.settings) {
                const existingRaw = await StorageService.getItem(StorageService.getUserKey('vault_dealer_storage'));
                try {
                    const existing = existingRaw ? JSON.parse(existingRaw) : { settings: {} };
                    existing.settings = {
                        ...existing.settings,
                        ...data.hyperliquidDealer.settings
                    };
                    await StorageService.setItem(StorageService.getUserKey('vault_dealer_storage'), JSON.stringify(existing));
                } catch (e) {
                    console.error('Failed to merge dealer settings', e);
                }
            }

            // Restore Polymarket dealer settings
            if (data.polymarketDealer?.settings || data.polymarketDealer?.strategyPrompt) {
                console.log('[Import] Restoring Polymarket settings:', data.polymarketDealer);
                const existingRaw = await StorageService.getItem(StorageService.getUserKey('vault_polymarket_storage'));
                try {
                    const existing = existingRaw ? JSON.parse(existingRaw) : { settings: {} };
                    if (data.polymarketDealer.settings) {
                        existing.settings = {
                            ...existing.settings,
                            ...data.polymarketDealer.settings
                        };
                    }
                    // Restore strategy prompt
                    if (data.polymarketDealer.strategyPrompt) {
                        existing.settings = {
                            ...existing.settings,
                            strategyPrompt: data.polymarketDealer.strategyPrompt
                        };
                    }
                    console.log('[Import] Saving Polymarket settings:', existing.settings);
                    await StorageService.setItem(StorageService.getUserKey('vault_polymarket_storage'), JSON.stringify(existing));
                } catch (e) {
                    console.error('Failed to merge polymarket settings', e);
                }
            } else {
                console.log('[Import] No Polymarket settings to restore');
            }

            // Reload stores to reflect imported data in memory
            console.log('[Import] Reloading stores from storage...');
            await dealerStore.reloadFromStorage();
            await polymarketStore.reloadFromStorage();

            addNotification('Data restored successfully!');
            setShowImportModal(false);
            setImportData(null);
        } catch (error) {
            console.error('Import failed:', error);
            addNotification('Failed to import data');
        } finally {
            setIsImporting(false);
        }
    };

    // Delete account and all data
    const handleDeleteAccount = async () => {
        if (!user?.uid || deleteConfirmText !== 'DELETE') return;

        setIsDeleting(true);
        try {
            // Reset all in-memory stores to initial state
            dealerStore.reset();
            polymarketStore.reset();

            // Clear all user-scoped data from IndexedDB
            // This includes: conversations, dealer settings, activity logs, vault data, API keys, etc.
            await StorageService.clearUserData(user.uid);

            // Sign out
            await logout();

            addNotification('Account deleted successfully');
        } catch (error) {
            console.error('Delete account failed:', error);
            addNotification('Failed to delete account');
            setIsDeleting(false);
        }
    };

    return (
        <motion.div
            className="h-full flex flex-col gap-4 overflow-y-auto custom-scrollbar pb-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
        >
            {/* Legal Links Section */}
            <div className="glass-panel p-5 rounded">
                <div className="flex items-center gap-2 mb-4">
                    <Scale className="h-4 w-4 text-[#E7FE55]" />
                    <span className="text-sm font-semibold text-white">Legal</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <a
                        href="/terms.html"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 p-4 bg-[#14151a] border border-[#232328] rounded hover:border-[#E7FE55]/30 transition-all group"
                    >
                        <div className="p-2 rounded bg-[#E7FE55]/10">
                            <FileText size={18} className="text-[#E7FE55]" />
                        </div>
                        <div className="flex-1">
                            <span className="text-sm font-medium text-white group-hover:text-[#E7FE55] transition-colors">
                                Terms of Use
                            </span>
                            <p className="text-[10px] text-[#747580]">Read our terms and conditions</p>
                        </div>
                        <ExternalLink size={14} className="text-[#747580] group-hover:text-[#E7FE55]" />
                    </a>

                    <a
                        href="/privacy.html"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 p-4 bg-[#14151a] border border-[#232328] rounded hover:border-[#E7FE55]/30 transition-all group"
                    >
                        <div className="p-2 rounded bg-[#E7FE55]/10">
                            <Shield size={18} className="text-[#E7FE55]" />
                        </div>
                        <div className="flex-1">
                            <span className="text-sm font-medium text-white group-hover:text-[#E7FE55] transition-colors">
                                Privacy Policy
                            </span>
                            <p className="text-[10px] text-[#747580]">How we handle your data</p>
                        </div>
                        <ExternalLink size={14} className="text-[#747580] group-hover:text-[#E7FE55]" />
                    </a>
                </div>
            </div>

            {/* Data Export/Import Section */}
            <div className="glass-panel p-5 rounded">
                <div className="flex items-center gap-2 mb-4">
                    <FileJson className="h-4 w-4 text-[#E7FE55]" />
                    <span className="text-sm font-semibold text-white">Data Backup</span>
                </div>

                <p className="text-xs text-[#747580] mb-4">
                    Export your settings, activity history, and prompts to restore on another device.
                    <span className="text-amber-400"> Private keys and sensitive data are never included.</span>
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Export Button */}
                    <button
                        onClick={initiateExport}
                        disabled={isExporting}
                        className="flex items-center gap-3 p-4 bg-[#14151a] border border-[#232328] rounded hover:border-[#E7FE55]/30 transition-all group disabled:opacity-50"
                    >
                        <div className="p-2 rounded bg-emerald-500/10">
                            <Download size={18} className="text-emerald-400" />
                        </div>
                        <div className="flex-1 text-left">
                            <span className="text-sm font-medium text-white group-hover:text-emerald-400 transition-colors">
                                {isExporting ? 'Exporting...' : 'Export Data'}
                            </span>
                            <p className="text-[10px] text-[#747580]">Download your settings as JSON</p>
                        </div>
                    </button>

                    {/* Import Button */}
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        className="flex items-center gap-3 p-4 bg-[#14151a] border border-[#232328] rounded hover:border-[#E7FE55]/30 transition-all group"
                    >
                        <div className="p-2 rounded bg-blue-500/10">
                            <Upload size={18} className="text-blue-400" />
                        </div>
                        <div className="flex-1 text-left">
                            <span className="text-sm font-medium text-white group-hover:text-blue-400 transition-colors">
                                Import Data
                            </span>
                            <p className="text-[10px] text-[#747580]">Restore from a backup file</p>
                        </div>
                    </button>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".json"
                        onChange={handleFileSelect}
                        className="hidden"
                    />
                </div>
            </div>

            {/* Account Deletion Section */}
            <div className="glass-panel p-5 rounded border border-red-500/20">
                <div className="flex items-center gap-2 mb-4">
                    <Trash2 className="h-4 w-4 text-red-400" />
                    <span className="text-sm font-semibold text-white">Danger Zone</span>
                </div>

                <div className="bg-red-500/5 border border-red-500/20 rounded p-4 mb-4">
                    <div className="flex gap-3">
                        <AlertTriangle size={20} className="text-red-400 shrink-0 mt-0.5" />
                        <div>
                            <p className="text-sm font-medium text-red-400 mb-1">Delete Account</p>
                            <p className="text-xs text-[#a0a1a8]">
                                This will permanently delete all your data including activity history,
                                dealer configurations, prompts, and scheduled tasks. This action cannot be undone.
                            </p>
                        </div>
                    </div>
                </div>

                <button
                    onClick={() => setShowDeleteModal(true)}
                    className="px-4 py-2 bg-red-500/10 border border-red-500/30 rounded text-red-400 text-sm font-medium hover:bg-red-500/20 transition-colors"
                >
                    Delete My Account
                </button>
            </div>

            {/* Delete Confirmation Modal */}
            {showDeleteModal && (
                <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-[#14151a] border border-[#232328] w-full max-w-md rounded-xl shadow-2xl overflow-hidden">
                        <div className="p-6">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="p-3 rounded-full bg-red-500/10">
                                    <AlertTriangle size={24} className="text-red-400" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-white">Delete Account</h3>
                                    <p className="text-xs text-[#747580]">This action is irreversible</p>
                                </div>
                            </div>

                            <p className="text-sm text-[#a0a1a8] mb-4">
                                All your data will be permanently deleted. To confirm, type <strong className="text-white">DELETE</strong> below:
                            </p>

                            <input
                                type="text"
                                value={deleteConfirmText}
                                onChange={(e) => setDeleteConfirmText(e.target.value)}
                                placeholder="Type DELETE to confirm"
                                className="w-full px-3 py-2 bg-[#0f1015] border border-[#232328] rounded text-white placeholder:text-[#3a3b42] focus:outline-none focus:border-red-500/50 mb-4"
                            />

                            <div className="flex gap-3">
                                <button
                                    onClick={() => {
                                        setShowDeleteModal(false);
                                        setDeleteConfirmText('');
                                    }}
                                    className="flex-1 px-4 py-2 bg-[#232328] rounded text-white text-sm font-medium hover:bg-[#2a2b30] transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleDeleteAccount}
                                    disabled={deleteConfirmText !== 'DELETE' || isDeleting}
                                    className={cn(
                                        "flex-1 px-4 py-2 rounded text-sm font-medium transition-colors",
                                        deleteConfirmText === 'DELETE'
                                            ? "bg-red-500 text-white hover:bg-red-600"
                                            : "bg-red-500/30 text-red-400/50 cursor-not-allowed"
                                    )}
                                >
                                    {isDeleting ? 'Deleting...' : 'Delete Account'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Import Preview Modal */}
            {showImportModal && importData && (
                <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-[#14151a] border border-[#232328] w-full max-w-md rounded-xl shadow-2xl overflow-hidden">
                        <div className="p-6">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="p-3 rounded-full bg-blue-500/10">
                                    <Upload size={24} className="text-blue-400" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-white">Import Backup</h3>
                                    <p className="text-xs text-[#747580]">
                                        Created: {new Date(importData.exportedAt).toLocaleDateString()}
                                    </p>
                                </div>
                            </div>

                            <div className="bg-[#0f1015] border border-[#232328] rounded p-4 mb-4 space-y-2">
                                <p className="text-xs text-[#747580] uppercase tracking-wider mb-2">Data to restore:</p>

                                {importData.data.activityLog?.length ? (
                                    <div className="flex items-center gap-2 text-sm text-[#a0a1a8]">
                                        <Check size={14} className="text-emerald-400" />
                                        <span>Activity Log ({importData.data.activityLog.length} items)</span>
                                    </div>
                                ) : null}

                                {importData.data.conversations?.length ? (
                                    <div className="flex items-center gap-2 text-sm text-[#a0a1a8]">
                                        <Check size={14} className="text-emerald-400" />
                                        <span>Conversations ({importData.data.conversations.length} chats)</span>
                                    </div>
                                ) : null}

                                {importData.data.hyperliquidDealer?.settings ? (
                                    <div className="flex items-center gap-2 text-sm text-[#a0a1a8]">
                                        <Check size={14} className="text-emerald-400" />
                                        <span>Hyperliquid Dealer Settings</span>
                                    </div>
                                ) : null}

                                {importData.data.hyperliquidDealer?.strategyPrompt ? (
                                    <div className="flex items-center gap-2 text-sm text-[#a0a1a8]">
                                        <Check size={14} className="text-emerald-400" />
                                        <span>Hyperliquid Strategy Prompt</span>
                                    </div>
                                ) : null}

                                {importData.data.polymarketDealer?.settings ? (
                                    <div className="flex items-center gap-2 text-sm text-[#a0a1a8]">
                                        <Check size={14} className="text-emerald-400" />
                                        <span>Polymarket Dealer Settings</span>
                                    </div>
                                ) : null}

                                {importData.data.polymarketDealer?.strategyPrompt ? (
                                    <div className="flex items-center gap-2 text-sm text-[#a0a1a8]">
                                        <Check size={14} className="text-emerald-400" />
                                        <span>Polymarket Strategy Prompt</span>
                                    </div>
                                ) : null}

                                {importData.data.schedulerTasks?.length ? (
                                    <div className="flex items-center gap-2 text-sm text-[#a0a1a8]">
                                        <Check size={14} className="text-emerald-400" />
                                        <span>Scheduled Tasks ({importData.data.schedulerTasks.length} items)</span>
                                    </div>
                                ) : null}
                            </div>

                            {/* Password input for encryption if restoring conversations */}
                            {importData.data.conversations?.length ? (
                                <div className="mb-4">
                                    <p className="text-xs text-[#747580] mb-2">
                                        Encryption password required to secure imported conversations:
                                    </p>
                                    <input
                                        type="password"
                                        value={importPassword}
                                        onChange={(e) => setImportPassword(e.target.value)}
                                        placeholder="Enter encryption password"
                                        className="w-full px-3 py-2 bg-[#0f1015] border border-[#232328] rounded text-white placeholder:text-[#3a3b42] focus:outline-none focus:border-[#E7FE55]/50"
                                    />
                                    {!importPassword && !password && (
                                        <p className="text-[10px] text-amber-500 mt-1">
                                            Warning: Without password, conversations will NOT be imported.
                                        </p>
                                    )}
                                </div>
                            ) : null}

                            <p className="text-xs text-amber-400 mb-4">
                                ⚠️ This will overwrite your current settings. Are you sure?
                            </p>

                            <div className="flex gap-3">
                                <button
                                    onClick={() => {
                                        setShowImportModal(false);
                                        setImportData(null);
                                        setImportPassword('');
                                    }}
                                    className="flex-1 px-4 py-2 bg-[#232328] rounded text-white text-sm font-medium hover:bg-[#2a2b30] transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleImport}
                                    disabled={isImporting}
                                    className="flex-1 px-4 py-2 bg-[#E7FE55] rounded text-black text-sm font-semibold hover:bg-[#d9f044] transition-colors disabled:opacity-50"
                                >
                                    {isImporting ? 'Importing...' : 'Restore Data'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Export Password Modal */}
            {showExportModal && (
                <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-[#14151a] border border-[#232328] w-full max-w-md rounded-xl shadow-2xl overflow-hidden">
                        <div className="p-6">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="p-3 rounded-full bg-emerald-500/10">
                                    <Download size={24} className="text-emerald-400" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-white">Confirm Data Export</h3>
                                    <p className="text-xs text-[#747580]">Security check required</p>
                                </div>
                            </div>

                            <p className="text-sm text-[#a0a1a8] mb-4">
                                Please enter your Vault password to authorize the export. This ensures only you can download your data.
                            </p>

                            <div className="mb-4">
                                <input
                                    type="password"
                                    value={exportPassword}
                                    onChange={(e) => setExportPassword(e.target.value)}
                                    placeholder="Enter Vault password"
                                    className="w-full px-3 py-2 bg-[#0f1015] border border-[#232328] rounded text-white placeholder:text-[#3a3b42] focus:outline-none focus:border-[#E7FE55]/50"
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') handleConfirmExport();
                                    }}
                                />
                            </div>

                            <div className="flex gap-3">
                                <button
                                    onClick={() => {
                                        setShowExportModal(false);
                                        setExportPassword('');
                                    }}
                                    className="flex-1 px-4 py-2 bg-[#232328] rounded text-white text-sm font-medium hover:bg-[#2a2b30] transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleConfirmExport}
                                    className="flex-1 px-4 py-2 bg-[#E7FE55] rounded text-black text-sm font-semibold hover:bg-[#d9f044] transition-colors"
                                >
                                    Export
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </motion.div>
    );
};
