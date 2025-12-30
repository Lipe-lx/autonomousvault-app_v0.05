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
    MessageSquare,
    Save
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { StorageService } from '../../services/storageService';
import { ConversationService, Conversation } from '../../services/conversationService';
import { dealerStore } from '../../state/dealerStore';
import { polymarketStore } from '../../state/polymarketStore';
import { cn } from '@/lib/utils';
import { SecurityTierSelector } from './SecurityTierSelector';

// Keys that are safe to export (non-sensitive)
const EXPORTABLE_KEYS = [
    'agent_activity_log',
    'vault_dealer_strategy',
    'agent_scheduler_tasks',
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
    const { user, logout, deleteAccount } = useAuth();
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [deleteConfirmText, setDeleteConfirmText] = useState('');

    const [showImportModal, setShowImportModal] = useState(false);
    const [importData, setImportData] = useState<BackupData | null>(null);
    const [isExporting, setIsExporting] = useState(false);
    const [isImporting, setIsImporting] = useState(false);

    const [importPassword, setImportPassword] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

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
            const activityLogKey = StorageService.getUserKey('agent_activity_log');
            const strategyKey = StorageService.getUserKey('vault_dealer_strategy');
            const schedulerKey = StorageService.getUserKey('agent_scheduler_tasks');

            const [activityLog, strategyPrompt, schedulerTasks] = await Promise.all([
                StorageService.getItem(activityLogKey),
                StorageService.getItem(strategyKey),
                StorageService.getItem(schedulerKey)
            ]);

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

            const dealerStorageRaw = await StorageService.getItem(StorageService.getUserKey('vault_dealer_storage'));
            let dealerSettings = null;
            if (dealerStorageRaw) {
                try {
                    const parsed = JSON.parse(dealerStorageRaw);
                    dealerSettings = {
                        strategyPrompt: parsed.settings?.strategyPrompt,
                        aggressiveMode: parsed.settings?.aggressiveMode,
                        maxLeverage: parsed.settings?.maxLeverage,
                        maxPositionSizeUSDC: parsed.settings?.maxPositionSizeUSDC,
                        maxOpenPositions: parsed.settings?.maxOpenPositions,
                        bankrollType: parsed.settings?.bankrollType,
                        manualBankroll: parsed.settings?.manualBankroll,
                        tradingPairs: parsed.settings?.tradingPairs,
                        checkIntervalSeconds: parsed.settings?.checkIntervalSeconds,
                        analysisTimeframe: parsed.settings?.analysisTimeframe,
                        historyCandles: parsed.settings?.historyCandles,
                        macroTimeframeEnabled: parsed.settings?.macroTimeframeEnabled,
                        macroTimeframe: parsed.settings?.macroTimeframe,
                        macroEnabledIndicators: parsed.settings?.macroEnabledIndicators,
                        indicatorSettings: parsed.settings?.indicatorSettings,
                        autonomousIndicators: parsed.settings?.autonomousIndicators,
                        selectedPreset: parsed.settings?.selectedPreset,
                        promptMode: parsed.settings?.promptMode,
                        stopLossEnabled: parsed.settings?.stopLossEnabled,
                        stopLossPercent: parsed.settings?.stopLossPercent,
                        takeProfitEnabled: parsed.settings?.takeProfitEnabled,
                        takeProfitPercent: parsed.settings?.takeProfitPercent,
                    };
                } catch (e) {
                    console.error('Failed to parse dealer settings', e);
                }
            }

            const polymarketStorageRaw = await StorageService.getItem(StorageService.getUserKey('vault_polymarket_storage'));
            let polymarketSettings = null;
            let polymarketStrategyPrompt: string | undefined = undefined;
            if (polymarketStorageRaw) {
                try {
                    const parsed = JSON.parse(polymarketStorageRaw);
                    polymarketSettings = {
                        strategyPrompt: parsed.settings?.strategyPrompt,
                        promptMode: parsed.settings?.promptMode,
                        selectedPreset: parsed.settings?.selectedPreset,
                        marketSelectionMode: parsed.settings?.marketSelectionMode,
                        selectedMarkets: parsed.settings?.selectedMarkets,
                        allowedCategories: parsed.settings?.allowedCategories,
                        maxPositionSizeUSDC: parsed.settings?.maxPositionSizeUSDC,
                        maxOpenPositions: parsed.settings?.maxOpenPositions,
                        minLiquidity: parsed.settings?.minLiquidity,
                        minVolume24h: parsed.settings?.minVolume24h,
                        minVolumeThreshold: parsed.settings?.minVolumeThreshold,
                        minLiquidityThreshold: parsed.settings?.minLiquidityThreshold,
                        minSpreadThreshold: parsed.settings?.minSpreadThreshold,
                        confidenceThreshold: parsed.settings?.confidenceThreshold,
                        bankrollType: parsed.settings?.bankrollType,
                        manualBankroll: parsed.settings?.manualBankroll,
                        checkIntervalSeconds: parsed.settings?.checkIntervalSeconds,
                    };
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

    const initiateExport = () => {
        setExportPassword('');
        setShowExportModal(true);
    };

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

    const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const content = e.target?.result as string;
                const parsed = JSON.parse(content) as BackupData;

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

        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleImport = async () => {
        if (!importData || !user?.uid) return;

        setIsImporting(true);
        try {
            const { data } = importData;

            if (data.activityLog?.length) {
                const key = StorageService.getUserKey('agent_activity_log');
                await StorageService.setItem(key, JSON.stringify(data.activityLog));
            }

            if (data.schedulerTasks?.length) {
                const key = StorageService.getUserKey('agent_scheduler_tasks');
                await StorageService.setItem(key, JSON.stringify(data.schedulerTasks));
            }

            if (data.hyperliquidDealer?.strategyPrompt) {
                const key = StorageService.getUserKey('vault_dealer_strategy');
                await StorageService.setItem(key, data.hyperliquidDealer.strategyPrompt);
            }

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

    const handleDeleteAccount = async () => {
        if (!user || deleteConfirmText !== 'DELETE') return;

        setIsDeleting(true);
        try {
            dealerStore.reset();
            polymarketStore.reset();

            await deleteAccount();

            addNotification('Account deleted successfully');
        } catch (error: any) {
            console.error('Delete account failed:', error);
            addNotification(error.message || 'Failed to delete account');
            setIsDeleting(false);
        }
    };

    return (
        <motion.div
            className="flex flex-col gap-6"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
        >
            <div className="flex flex-col gap-2 mb-2">
                <h1 className="text-3xl font-light tracking-tight text-white">User Settings</h1>
                <p className="text-sm text-gray-500 font-light">Manage security, backups, and account data.</p>
            </div>

            {/* Two Column Masonry Layout */}
            <div className="columns-1 lg:columns-2 gap-6 space-y-6">
                {/* Security & Execution Section */}
                <section className="rounded-lg border border-gray-800/60 overflow-hidden break-inside-avoid">
                    <div className="px-6 py-4 border-b border-gray-800/60 flex items-center gap-3">
                        <div className="p-2 bg-blue-500/10 rounded-lg">
                            <Shield className="h-4 w-4 text-blue-400" />
                        </div>
                        <div className="flex-1">
                            <h2 className="text-sm font-bold text-white tracking-wide">Security & Execution</h2>
                            <p className="text-[11px] text-gray-500 mt-0.5">Choose how your bot runs and stores keys</p>
                        </div>
                    </div>
                    <div className="p-6">
                        <SecurityTierSelector
                            onTierChange={(tier) => addNotification(`Security tier changed to ${tier}`)}
                        />
                    </div>
                </section>

                {/* Data Export/Import Section */}
                <section className="rounded-lg border border-gray-800/60 overflow-hidden break-inside-avoid">
                    <div className="px-6 py-4 border-b border-gray-800/60 flex items-center gap-3">
                        <div className="p-2 bg-gray-800/30 rounded-lg">
                            <Save className="h-4 w-4 text-blue-400" />
                        </div>
                        <div className="flex-1">
                            <h2 className="text-sm font-medium text-gray-200 tracking-wide">Data Backup</h2>
                            <p className="text-[11px] text-gray-500 mt-0.5">Export your settings to move to another device</p>
                        </div>
                    </div>

                    <div className="p-6">
                        <p className="text-xs text-gray-500 mb-5 font-light leading-relaxed">
                            Export your full configuration history, conversations, and strategies to a JSON file.
                            <br />
                            <span className="text-amber-500/80 font-medium"> Note: Private keys and sensitive API tokens are never included in exports.</span>
                        </p>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {/* Export Button */}
                            <button
                                onClick={initiateExport}
                                disabled={isExporting}
                                className="group flex items-start gap-4 p-4 border border-gray-800/60 rounded-lg hover:border-gray-700 transition-all text-left"
                            >
                                <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-500 group-hover:text-emerald-400 transition-colors">
                                    <Download size={18} />
                                </div>
                                <div className="flex-1">
                                    <span className="text-sm font-semibold text-gray-200 block mb-1 group-hover:text-white transition-colors">
                                        {isExporting ? 'Exporting...' : 'Export Data'}
                                    </span>
                                    <p className="text-[11px] text-gray-500 leading-snug">Download settings backup file</p>
                                </div>
                            </button>

                            {/* Import Button */}
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className="group flex items-start gap-4 p-4 border border-gray-800/60 rounded-lg hover:border-gray-700 transition-all text-left"
                            >
                                <div className="p-2 rounded-lg bg-blue-500/10 text-blue-500 group-hover:text-blue-400 transition-colors">
                                    <Upload size={18} />
                                </div>
                                <div className="flex-1">
                                    <span className="text-sm font-semibold text-gray-200 block mb-1 group-hover:text-white transition-colors">
                                        Import Data
                                    </span>
                                    <p className="text-[11px] text-gray-500 leading-snug">Restore from backup JSON</p>
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
                </section>

                {/* Account Deletion Section */}
                <section className="rounded-lg border border-red-900/20 overflow-hidden break-inside-avoid">
                    <div className="px-6 py-4 border-b border-red-900/20 flex items-center gap-3 bg-red-950/10">
                        <div className="p-2 bg-red-900/20 rounded-lg">
                            <Trash2 className="h-4 w-4 text-red-400" />
                        </div>
                        <div className="flex-1">
                            <h2 className="text-sm font-medium text-red-200 tracking-wide">Danger Zone</h2>
                        </div>
                    </div>

                    <div className="p-6">
                        <div className="mb-4">
                            <h3 className="text-sm font-medium text-red-300 mb-1">Delete Account</h3>
                            <p className="text-xs text-gray-500 leading-relaxed">
                                Permanently remove your account and all associated data. This involves clearing your local storage, 
                                dealer settings, and cloud database records. <strong className="text-red-400/80">This action cannot be undone.</strong>
                            </p>
                        </div>

                        <button
                            onClick={() => setShowDeleteModal(true)}
                            className="px-5 py-2.5 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-xs font-semibold hover:bg-red-500 hover:text-white hover:border-red-500 transition-all whitespace-nowrap"
                        >
                            Delete Account
                        </button>
                    </div>
                </section>
            </div>

            {/* Delete Confirmation Modal */}
            {showDeleteModal && (
                <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                    <motion.div 
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-[#13141A] border border-gray-800 w-full max-w-md rounded-xl shadow-2xl overflow-hidden"
                    >
                        <div className="p-6">
                            <div className="flex items-center gap-4 mb-5">
                                <div className="p-3 rounded-full bg-red-500/10">
                                    <AlertTriangle size={24} className="text-red-400" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-white tracking-tight">Delete Account</h3>
                                    <p className="text-xs text-gray-500">This action is irreversible</p>
                                </div>
                            </div>

                            <p className="text-sm text-gray-400 mb-5 leading-relaxed">
                                All your data will be permanently deleted. 
                                <br/>To confirm, type <strong className="text-white">DELETE</strong> below:
                            </p>

                            <input
                                type="text"
                                value={deleteConfirmText}
                                onChange={(e) => setDeleteConfirmText(e.target.value)}
                                placeholder="Type DELETE to confirm"
                                className="w-full px-4 py-2.5 bg-transparent border border-gray-800 rounded-lg text-white placeholder:text-gray-600 focus:outline-none focus:border-red-500/50 focus:ring-1 focus:ring-red-500/20 transition-all mb-5 text-sm"
                            />

                            <div className="flex gap-3">
                                <button
                                    onClick={() => {
                                        setShowDeleteModal(false);
                                        setDeleteConfirmText('');
                                    }}
                                    className="flex-1 px-4 py-2.5 bg-gray-800 rounded-lg text-gray-300 text-sm font-medium hover:bg-gray-700 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleDeleteAccount}
                                    disabled={deleteConfirmText !== 'DELETE' || isDeleting}
                                    className={cn(
                                        "flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-all",
                                        deleteConfirmText === 'DELETE'
                                            ? "bg-red-500 text-white hover:bg-red-600"
                                            : "bg-red-500/20 text-red-500/40 cursor-not-allowed"
                                    )}
                                >
                                    {isDeleting ? 'Deleting...' : 'Delete Account'}
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}

            {/* Import Preview Modal */}
            {showImportModal && importData && (
                <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                    <motion.div 
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-[#13141A] border border-gray-800 w-full max-w-md rounded-xl shadow-2xl overflow-hidden"
                    >
                        <div className="p-6">
                            <div className="flex items-center gap-4 mb-5">
                                <div className="p-3 rounded-full bg-blue-500/10">
                                    <Upload size={24} className="text-blue-400" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-white tracking-tight">Import Backup</h3>
                                    <p className="text-xs text-gray-500">
                                        Created: {new Date(importData.exportedAt).toLocaleDateString()}
                                    </p>
                                </div>
                            </div>

                            <div className="border border-gray-800 rounded-lg p-4 mb-5 space-y-2">
                                <p className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider mb-2">Data to restore:</p>

                                {importData.data.activityLog?.length ? (
                                    <div className="flex items-center gap-2 text-xs text-gray-300">
                                        <Check size={12} className="text-emerald-500" />
                                        <span>Activity Log ({importData.data.activityLog.length} items)</span>
                                    </div>
                                ) : null}

                                {importData.data.conversations?.length ? (
                                    <div className="flex items-center gap-2 text-xs text-gray-300">
                                        <Check size={12} className="text-emerald-500" />
                                        <span>Conversations ({importData.data.conversations.length} chats)</span>
                                    </div>
                                ) : null}

                                {importData.data.hyperliquidDealer?.settings ? (
                                    <div className="flex items-center gap-2 text-xs text-gray-300">
                                        <Check size={12} className="text-emerald-500" />
                                        <span>Hyperliquid Dealer Settings</span>
                                    </div>
                                ) : null}

                                <div className="text-[10px] text-gray-600 pl-5">
                                    ...and {Object.keys(importData.data).length - 2} other data points
                                </div>
                            </div>

                            {importData.data.conversations?.length ? (
                                <div className="mb-5">
                                    <p className="text-xs text-gray-400 mb-2">
                                        Encryption password required:
                                    </p>
                                    <input
                                        type="password"
                                        value={importPassword}
                                        onChange={(e) => setImportPassword(e.target.value)}
                                        placeholder="Enter encryption password"
                                        className="w-full px-4 py-2.5 bg-transparent border border-gray-800 rounded-lg text-white placeholder:text-gray-600 focus:outline-none focus:border-blue-500/50 transition-all text-sm"
                                    />
                                    {!importPassword && !password && (
                                        <p className="text-[10px] text-amber-500 mt-1.5 flex items-center gap-1">
                                            <AlertTriangle size={10} /> Password required to decrypt conversations
                                        </p>
                                    )}
                                </div>
                            ) : null}

                            <div className="flex gap-3">
                                <button
                                    onClick={() => {
                                        setShowImportModal(false);
                                        setImportData(null);
                                        setImportPassword('');
                                    }}
                                    className="flex-1 px-4 py-2.5 bg-gray-800 rounded-lg text-gray-300 text-sm font-medium hover:bg-gray-700 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleImport}
                                    disabled={isImporting}
                                    className="flex-1 px-4 py-2.5 bg-white text-black rounded-lg text-sm font-semibold hover:bg-gray-200 transition-colors disabled:opacity-50"
                                >
                                    {isImporting ? 'Importing...' : 'Restore Data'}
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}

            {/* Export Password Modal */}
            {showExportModal && (
                <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                    <motion.div 
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-[#13141A] border border-gray-800 w-full max-w-md rounded-xl shadow-2xl overflow-hidden"
                    >
                        <div className="p-6">
                            <div className="flex items-center gap-4 mb-5">
                                <div className="p-3 rounded-full bg-emerald-500/10">
                                    <Download size={24} className="text-emerald-400" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-white tracking-tight">Confirm Export</h3>
                                    <p className="text-xs text-gray-500">Security check required</p>
                                </div>
                            </div>

                            <p className="text-sm text-gray-400 mb-5 leading-relaxed">
                                Please enter your Vault password to authorize the export. This ensures only you can download your data.
                            </p>

                            <div className="mb-5">
                                <input
                                    type="password"
                                    value={exportPassword}
                                    onChange={(e) => setExportPassword(e.target.value)}
                                    placeholder="Enter Vault password"
                                    className="w-full px-4 py-2.5 bg-transparent border border-gray-800 rounded-lg text-white placeholder:text-gray-600 focus:outline-none focus:border-emerald-500/50 transition-all text-sm"
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
                                    className="flex-1 px-4 py-2.5 bg-gray-800 rounded-lg text-gray-300 text-sm font-medium hover:bg-gray-700 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleConfirmExport}
                                    className="flex-1 px-4 py-2.5 bg-white text-black rounded-lg text-sm font-semibold hover:bg-gray-200 transition-colors"
                                >
                                    Export
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </motion.div>
    );
};
