import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from './hooks/useAuth';
import { AppTab, VaultTab } from './types';
import { Sidebar } from './components/layout/Sidebar';
import { Dashboard } from './components/dashboard/Dashboard';
import { Vault } from './components/vault/Vault';
import { AgentConsole } from './components/agent/AgentConsole';
import { Scheduler } from './components/scheduler/Scheduler';
import { DealerConsole } from './components/dealer/DealerConsole';
import { HyperliquidDashboard } from './components/hyperliquid/HyperliquidDashboard';
import { SolanaBackupModal } from './components/shared/SolanaBackupModal';
import { HyperliquidBackupModal } from './components/shared/HyperliquidBackupModal';
import { PolymarketBackupModal } from './components/shared/PolymarketBackupModal';
import { useVault } from './hooks/useVault';
import { useMarketData } from './hooks/useMarketData';
import { useActivityFeed } from './hooks/useActivityFeed';
import { useScheduler } from './hooks/useScheduler';
import { useAgent } from './hooks/useAgent';
import { usePolymarket } from './hooks/usePolymarket';
import { ConversationService } from './services/conversationService';
import { X, RefreshCw, Menu, Settings, ChevronDown, ChevronUp, Clock, CalendarClock, Plus, LogOut } from 'lucide-react';

import { HistoryPage } from './components/agent/HistoryPage';
import { ConfigurationPage } from './components/configuration/ConfigurationPage';
import { TokenCostsPage } from './components/admin/TokenCostsPage';

// Polymarket Components
import { PolymarketWrapper } from './components/polymarket/PolymarketWrapper';
import { PrivacyPolicy } from './pages/PrivacyPolicy';
import { TermsOfUse } from './pages/TermsOfUse';
import { ConsentModal } from './components/legal/ConsentModal';

import { Footer } from './components/layout/Footer';

export default function App() {
    // --- UI State ---
    const [activeTab, setActiveTab] = useState<AppTab>(AppTab.AGENT);
    const [notifications, setNotifications] = useState<{ id: number, message: string }[]>([]);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

    // Configuration Tab State
    const [activeConfigTab, setActiveConfigTab] = useState<'providers' | 'user'>('providers');

    // Vault Tab State
    const [activeVaultTab, setActiveVaultTab] = useState<VaultTab>('main');

    // Auth
    const { user, logout } = useAuth();

    // Scroll ref for main content
    const mainRef = useRef<HTMLElement>(null);

    // Reset scroll when tab changes
    useEffect(() => {
        if (mainRef.current) {
            mainRef.current.scrollTop = 0;
        }
    }, [activeTab]);

    const addNotification = (msg: string) => {
        const id = Date.now();
        setNotifications(prev => [...prev, { id, message: msg }]);
        setTimeout(() => {
            setNotifications(prev => prev.filter(n => n.id !== id));
        }, 5000);
    };

    // --- Hooks ---
    const {
        vault,
        password,
        setPassword,
        withdrawAmount,
        setWithdrawAmount,
        withdrawNetwork,
        setWithdrawNetwork,
        showBackupModal,
        setShowBackupModal,
        backupKey,
        setBackupKey,
        showHLBackupModal,
        setShowHLBackupModal,
        hlBackupKey,
        setHLBackupKey,
        isImporting,
        setIsImporting,
        importKey,
        setImportKey,
        refreshBalance,
        connectOwnerWallet,
        disconnectOwnerWallet,
        createVault,
        unlockVault,
        requestAirdrop,
        handleWithdraw,
        handleWithdrawHL,
        handleWithdrawPM,
        importVault,

        resolveTokenMint,
        connectHLOwnerWallet,
        disconnectHLOwnerWallet,
        refreshHLBalance,
        // Individual Wallet Props
        isImportingSolana,
        setIsImportingSolana,
        isImportingHyperliquid,
        setIsImportingHyperliquid,
        isImportingPolymarket,
        setIsImportingPolymarket,
        solanaPassword,
        setSolanaPassword,
        hyperliquidPassword,
        setHyperliquidPassword,
        polymarketPassword,
        setPolymarketPassword,
        solanaImportKey,
        setSolanaImportKey,
        hlImportKey,
        setHLImportKey,
        pmImportKey,
        setPMImportKey,
        createSolanaVault,
        createHyperliquidVault,
        createPolymarketVault,
        importSolanaVault,
        importHyperliquidVault,
        importPolymarketVault,
        // Polymarket Owner Wallet
        connectPMOwnerWallet,
        disconnectPMOwnerWallet,
        refreshPMBalance,
        showPMBackupModal,
        setShowPMBackupModal,
        pmBackupKey,
        setPMBackupKey
    } = useVault(addNotification, user?.uid || null);

    // Navigation Guard - Only redirect for Vault Operator and Hyperliquid Dealer when no vault exists
    const hasVault = !!(vault.publicKey || vault.hlPublicKey);
    useEffect(() => {
        // Only redirect from Vault Operator and Hyperliquid Dealer pages when vault is not unlocked
        const protectedTabs = [
            AppTab.AGENT,
            AppTab.VAULT_DEALER,
            AppTab.DEALER_DASHBOARD,
            AppTab.DEALER_THINKING,
            AppTab.DEALER_CONFIG
        ];

        // If on a protected tab and vault is locked (but exists), redirect to Vault page
        if (protectedTabs.includes(activeTab) && !vault.isUnlocked && hasVault) {
            setActiveTab(AppTab.VAULT);
        }
    }, [activeTab, vault.isUnlocked, hasVault]);

    // Redirect to Dashboard on Unlock
    useEffect(() => {
        if (vault.isUnlocked) {
            setActiveTab(AppTab.DASHBOARD);
        }
    }, [vault.isUnlocked]);

    const {
        portfolioHistoryDaily,
        portfolioHistoryLongTerm,
        assetPrices,
        assetAllocationData
    } = useMarketData(vault);

    const {
        activityFeed,
        localActivityLog, // Not used in UI directly but managed
        activityDisplayCount,
        setActivityDisplayCount,
        addActivityLog
    } = useActivityFeed(vault);

    const {
        scheduledTasks,
        setScheduledTasks
    } = useScheduler(vault, password, addNotification, refreshBalance, addActivityLog);

    const {
        messages,
        inputMessage,
        setInputMessage,
        isAiProcessing,
        aiStatus,
        scrollRef,
        handleSendMessage,
        activeConversationId,
        loadConversation,
        startNewConversation
    } = useAgent(vault, password, setScheduledTasks, addNotification, refreshBalance, addActivityLog, resolveTokenMint);

    // Polymarket Hook
    const polymarket = usePolymarket(vault, password);

    // --- Actions ---
    const handleSelectConversation = async (id: string) => {
        try {
            const conversation = await ConversationService.loadConversation(id, password);
            if (conversation) {
                loadConversation(conversation);
            } else {
                addNotification('Failed to load conversation.');
            }
        } catch (e) {
            console.error(e);
            addNotification('Error loading conversation. Check password.');
        }
    };

    const handleNewChat = () => {
        startNewConversation();
        setActiveTab(AppTab.AGENT);
    };

    const handleRefreshData = async () => {
        addNotification("Refreshing data...");
        try {
            const promises = [];
            if (vault.publicKey) {
                promises.push(refreshBalance(vault.publicKey));
            }
            if (vault.hlPublicKey) {
                promises.push(refreshHLBalance(vault.hlPublicKey));
            }
            // Add other data refreshes here if needed

            await Promise.all(promises);
            addNotification("Data refreshed successfully");
        } catch (error) {
            console.error("Refresh failed", error);
            addNotification("Failed to refresh data");
        }
    };

    // --- Render ---
    return (
        <div className="flex h-screen bg-[#0f1015] text-[#e4e5e9] font-sans selection:bg-[#E7FE55]/30 overflow-hidden">
            {/* Sidebar */}
            <Sidebar
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                isVaultUnlocked={vault.isUnlocked}
                onSelectConversation={handleSelectConversation}
                onNewChat={handleNewChat}
                currentConversationId={activeConversationId}
                password={password}
                isOpen={isSidebarOpen}
                onClose={() => setIsSidebarOpen(false)}
            />

            {/* Main Content */}
            {/* Main Content */}
            {/* Main Content */}
            {/* Main Content */}
            <main ref={mainRef} className={`flex-1 ml-0 xl:ml-[264px] h-full flex flex-col relative transition-all duration-300 ${[AppTab.VAULT_DEALER, AppTab.DEALER_DASHBOARD, AppTab.DEALER_THINKING, AppTab.DEALER_CONFIG, AppTab.DEALER_PROMPT, AppTab.POLYMARKET_DEALER, AppTab.POLYMARKET_DASHBOARD, AppTab.POLYMARKET_THINKING, AppTab.POLYMARKET_CONFIG, AppTab.POLYMARKET_PROMPT].includes(activeTab) ? 'overflow-hidden' : 'overflow-y-auto'}`}>
                {/* Vault Operator Header - Outside padded container for full-width */}
                {activeTab === AppTab.AGENT && (
                    <header className="flex justify-between items-center mb-0 sticky top-0 z-40 bg-[#0f1015] pt-8 pb-4 px-4 md:px-8 lg:px-12 xl:px-16 transition-all shrink-0 relative">
                        {/* Left: Title */}
                        <div className="flex items-center gap-3 min-w-0">
                            {/* Mobile Hamburger */}
                            <button
                                onClick={() => setIsSidebarOpen(true)}
                                className="xl:hidden text-[#747580] hover:text-white transition-colors"
                            >
                                <Menu size={24} />
                            </button>

                            <div>
                                <h2 className="text-xl font-semibold text-white tracking-tight">
                                    Vault Operator
                                </h2>
                                <p className="text-[#747580] text-sm hidden sm:block">
                                    Interact with Vault Operator using natural language.
                                </p>
                            </div>
                        </div>

                        {/* Center: Quick Actions - Absolutely positioned */}
                        <div className="hidden sm:flex items-center gap-2 absolute left-1/2 transform -translate-x-1/2">
                            {/* New Chat Button */}
                            <button
                                onClick={handleNewChat}
                                className="flex items-center gap-2 px-3 py-1.5 rounded bg-[#E7FE55] hover:bg-[#f0ff7a] text-black text-sm font-medium transition-colors"
                                title="New Chat"
                            >
                                <div className="w-5 h-5 rounded bg-black/20 flex items-center justify-center">
                                    <Plus size={12} strokeWidth={2.5} />
                                </div>
                                <span className="hidden md:inline">New</span>
                            </button>

                            {/* Divider */}
                            <div className="h-6 w-px bg-[#232328]" />

                            {/* History Button */}
                            <button
                                onClick={() => setActiveTab(AppTab.HISTORY)}
                                className="flex items-center gap-2 px-3 py-1.5 rounded bg-[#14151a] hover:bg-[#1a1b21] text-[#a0a1a8] hover:text-white text-sm font-medium transition-colors border border-[#232328]"
                                title="Chat History"
                            >
                                <Clock size={14} />
                                <span className="hidden md:inline">History</span>
                            </button>

                            {/* Automations Button */}
                            <button
                                onClick={() => setActiveTab(AppTab.SCHEDULER)}
                                className="flex items-center gap-2 px-3 py-1.5 rounded bg-[#14151a] hover:bg-[#1a1b21] text-[#a0a1a8] hover:text-white text-sm font-medium transition-colors border border-[#232328]"
                                title="Automations"
                            >
                                <CalendarClock size={14} />
                                <span className="hidden md:inline">Automations</span>
                            </button>
                        </div>

                        {/* Right: Status & Actions */}
                        <div className="flex items-center gap-4">
                            <div className="text-right hidden md:block">
                                <div className="text-[9px] uppercase tracking-[0.05em] text-[#5a5b63]">System Status</div>
                                <div className="flex items-center justify-end gap-1.5 text-[#E7FE55] text-[11px] font-medium">
                                    <div className="w-1 h-1 bg-[#E7FE55] rounded-full" />
                                    Online
                                </div>
                            </div>

                            {/* User Profile Menu */}
                            <div className="relative">
                                <button
                                    onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                                    className="flex items-center gap-2 p-1 rounded-lg hover:bg-[#1a1b21] transition-colors border border-transparent hover:border-[#232328]"
                                    title={user?.email || 'User'}
                                >
                                    {user?.photoURL ? (
                                        <img
                                            src={user.photoURL}
                                            alt="User"
                                            className="w-8 h-8 rounded-full border border-[#232328]"
                                        />
                                    ) : (
                                        <div className="w-8 h-8 rounded-full bg-[#E7FE55] flex items-center justify-center text-black font-semibold text-sm">
                                            {user?.email?.[0]?.toUpperCase() || 'U'}
                                        </div>
                                    )}
                                </button>

                                {/* Dropdown Menu */}
                                {isUserMenuOpen && (
                                    <>
                                        {/* Backdrop */}
                                        <div
                                            className="fixed inset-0 z-40"
                                            onClick={() => setIsUserMenuOpen(false)}
                                        />
                                        {/* Menu */}
                                        <div className="absolute right-0 top-full mt-2 w-64 bg-[#14151a] border border-[#232328] rounded-lg shadow-xl z-50 overflow-hidden">
                                            {/* User Info */}
                                            <div className="px-4 py-3 border-b border-[#232328]">
                                                <div className="flex items-center gap-3">
                                                    {user?.photoURL ? (
                                                        <img
                                                            src={user.photoURL}
                                                            alt="User"
                                                            className="w-10 h-10 rounded-full border border-[#232328]"
                                                        />
                                                    ) : (
                                                        <div className="w-10 h-10 rounded-full bg-[#E7FE55] flex items-center justify-center text-black font-semibold">
                                                            {user?.email?.[0]?.toUpperCase() || 'U'}
                                                        </div>
                                                    )}
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-white text-sm font-medium truncate">
                                                            {user?.displayName || 'User'}
                                                        </p>
                                                        <p className="text-[#747580] text-xs truncate">
                                                            {user?.email}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                            {/* Actions */}
                                            <div className="p-2 space-y-1">
                                                <button
                                                    onClick={() => {
                                                        setIsUserMenuOpen(false);
                                                        handleRefreshData();
                                                    }}
                                                    className="w-full flex items-center gap-3 px-3 py-2 text-[#a0a1a8] hover:text-white hover:bg-[#1a1b21] rounded-lg transition-colors text-sm"
                                                >
                                                    <RefreshCw size={16} />
                                                    Refresh Data
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        setIsUserMenuOpen(false);
                                                        setActiveTab(AppTab.CONFIGURATION);
                                                    }}
                                                    className="w-full flex items-center gap-3 px-3 py-2 text-[#a0a1a8] hover:text-white hover:bg-[#1a1b21] rounded-lg transition-colors text-sm"
                                                >
                                                    <Settings size={16} />
                                                    Configuration
                                                </button>
                                                <div className="border-t border-[#232328] my-2" />
                                                <button
                                                    onClick={async () => {
                                                        setIsUserMenuOpen(false);
                                                        await logout();
                                                    }}
                                                    className="w-full flex items-center gap-3 px-3 py-2 text-[#a0a1a8] hover:text-white hover:bg-[#1a1b21] rounded-lg transition-colors text-sm"
                                                >
                                                    <LogOut size={16} />
                                                    Sign Out
                                                </button>
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    </header>
                )}

                <div className={`flex-1 pb-8 max-w-[1920px] mx-auto w-full ${activeTab === AppTab.AGENT ? 'px-6 md:px-24 lg:px-40 xl:px-64' : 'px-4 md:px-8 lg:px-12 xl:px-16'} ${[AppTab.VAULT_DEALER, AppTab.DEALER_DASHBOARD, AppTab.DEALER_THINKING, AppTab.DEALER_CONFIG, AppTab.DEALER_PROMPT, AppTab.POLYMARKET_DEALER, AppTab.POLYMARKET_DASHBOARD, AppTab.POLYMARKET_THINKING, AppTab.POLYMARKET_CONFIG, AppTab.POLYMARKET_PROMPT].includes(activeTab) ? 'flex flex-col h-full' : ''}`}>
                    {/* Header for non-AGENT tabs */}
                    {activeTab !== AppTab.AGENT && (
                        <header className="flex justify-between items-center mb-6 sticky top-0 z-40 bg-[#0f1015] pt-8 pb-4 -mx-4 px-4 md:px-0 md:-mx-0 transition-all shrink-0">
                            {/* Left: Title */}
                            <div className="flex items-center gap-3 min-w-0">
                                {/* Mobile Hamburger */}
                                <button
                                    onClick={() => setIsSidebarOpen(true)}
                                    className="xl:hidden text-[#747580] hover:text-white transition-colors"
                                >
                                    <Menu size={24} />
                                </button>

                                <div className="flex items-center gap-4">
                                    <div>
                                        <h2 className="text-xl font-semibold text-white tracking-tight">
                                            {activeTab === AppTab.DASHBOARD && 'Dashboard'}
                                            {activeTab === AppTab.VAULT && 'Vault'}
                                            {activeTab === AppTab.SCHEDULER && 'Automations'}
                                            {[AppTab.VAULT_DEALER, AppTab.DEALER_DASHBOARD, AppTab.DEALER_THINKING, AppTab.DEALER_CONFIG, AppTab.DEALER_PROMPT].includes(activeTab) && 'Hyperliquid Dealer'}
                                            {activeTab === AppTab.CONFIGURATION && 'Configuration'}
                                            {activeTab === AppTab.HYPERLIQUID && 'Hyperliquid Trading'}
                                            {activeTab === AppTab.HISTORY && 'History'}
                                            {activeTab === AppTab.TOKEN_COSTS && 'Token Costs'}
                                            {[AppTab.POLYMARKET_DEALER, AppTab.POLYMARKET_DASHBOARD].includes(activeTab) && 'Polymarket Dealer'}
                                            {activeTab === AppTab.POLYMARKET_CONFIG && 'Polymarket Config'}
                                            {activeTab === AppTab.POLYMARKET_PROMPT && 'Polymarket Strategy'}
                                        </h2>
                                        <p className="text-[#747580] text-sm hidden sm:block">
                                            {activeTab === AppTab.DASHBOARD && 'Overview of your autonomous DeFi agent.'}
                                            {activeTab === AppTab.VAULT && 'Manage your secure local vault and assets.'}
                                            {activeTab === AppTab.SCHEDULER && 'Automate swaps, transfers and trading strategies.'}
                                            {[AppTab.VAULT_DEALER, AppTab.DEALER_DASHBOARD, AppTab.DEALER_THINKING, AppTab.DEALER_CONFIG, AppTab.DEALER_PROMPT].includes(activeTab) && 'Autonomous trading engine (BETA).'}
                                            {activeTab === AppTab.CONFIGURATION && 'Configure trading parameters and risk management.'}
                                            {activeTab === AppTab.HYPERLIQUID && 'Trade on Hyperliquid Testnet.'}
                                            {activeTab === AppTab.HISTORY && 'Review past conversations.'}
                                            {activeTab === AppTab.TOKEN_COSTS && 'Monitor AI token consumption and costs.'}
                                            {[AppTab.POLYMARKET_DEALER, AppTab.POLYMARKET_DASHBOARD].includes(activeTab) && 'Autonomous prediction market trading (BETA).'}
                                            {activeTab === AppTab.POLYMARKET_CONFIG && 'Configure Polymarket trading parameters.'}
                                            {activeTab === AppTab.POLYMARKET_PROMPT && 'Customize your Polymarket strategy.'}
                                        </p>
                                    </div>


                                </div>
                            </div>

                            {/* Center: Hyperliquid Dealer Tabs */}
                            {[AppTab.VAULT_DEALER, AppTab.DEALER_DASHBOARD, AppTab.DEALER_THINKING, AppTab.DEALER_CONFIG, AppTab.DEALER_PROMPT].includes(activeTab) && (
                                <div className="hidden sm:flex items-center gap-1 bg-[#1a1b21] p-1 rounded border border-[#232328] absolute left-1/2 transform -translate-x-1/2">
                                    <button
                                        onClick={() => setActiveTab(AppTab.DEALER_DASHBOARD)}
                                        className={`px-3 py-1.5 rounded text-[11px] font-medium uppercase tracking-[0.05em] transition-colors ${[AppTab.VAULT_DEALER, AppTab.DEALER_DASHBOARD].includes(activeTab)
                                            ? 'bg-[#E7FE55] text-black'
                                            : 'text-[#747580] hover:text-[#a0a1a8]'
                                            }`}
                                    >
                                        Dashboard
                                    </button>
                                    <button
                                        onClick={() => setActiveTab(AppTab.DEALER_THINKING)}
                                        className={`px-3 py-1.5 rounded text-[11px] font-medium uppercase tracking-[0.05em] transition-colors ${activeTab === AppTab.DEALER_THINKING
                                            ? 'bg-[#E7FE55] text-black'
                                            : 'text-[#747580] hover:text-[#a0a1a8]'
                                            }`}
                                    >
                                        Thinking
                                    </button>
                                    <button
                                        onClick={() => setActiveTab(AppTab.DEALER_CONFIG)}
                                        className={`px-3 py-1.5 rounded text-[11px] font-medium uppercase tracking-[0.05em] transition-colors ${activeTab === AppTab.DEALER_CONFIG
                                            ? 'bg-[#E7FE55] text-black'
                                            : 'text-[#747580] hover:text-[#a0a1a8]'
                                            }`}
                                    >
                                        Configuration
                                    </button>
                                    <button
                                        onClick={() => setActiveTab(AppTab.DEALER_PROMPT)}
                                        className={`px-3 py-1.5 rounded text-[11px] font-medium uppercase tracking-[0.05em] transition-colors ${activeTab === AppTab.DEALER_PROMPT
                                            ? 'bg-[#E7FE55] text-black'
                                            : 'text-[#747580] hover:text-[#a0a1a8]'
                                            }`}
                                    >
                                        Prompt
                                    </button>
                                </div>
                            )}

                            {/* Center: Polymarket Dealer Tabs */}
                            {[AppTab.POLYMARKET_DEALER, AppTab.POLYMARKET_DASHBOARD, AppTab.POLYMARKET_THINKING, AppTab.POLYMARKET_CONFIG, AppTab.POLYMARKET_PROMPT].includes(activeTab) && (
                                <div className="hidden sm:flex items-center gap-1 bg-[#1a1b21] p-1 rounded border border-[#232328] absolute left-1/2 transform -translate-x-1/2">
                                    <button
                                        onClick={() => setActiveTab(AppTab.POLYMARKET_DASHBOARD)}
                                        className={`px-3 py-1.5 rounded text-[11px] font-medium uppercase tracking-[0.05em] transition-colors ${[AppTab.POLYMARKET_DEALER, AppTab.POLYMARKET_DASHBOARD].includes(activeTab)
                                            ? 'bg-[#E7FE55] text-black'
                                            : 'text-[#747580] hover:text-[#a0a1a8]'
                                            }`}
                                    >
                                        Dashboard
                                    </button>
                                    <button
                                        onClick={() => setActiveTab(AppTab.POLYMARKET_THINKING)}
                                        className={`px-3 py-1.5 rounded text-[11px] font-medium uppercase tracking-[0.05em] transition-colors ${activeTab === AppTab.POLYMARKET_THINKING
                                            ? 'bg-[#E7FE55] text-black'
                                            : 'text-[#747580] hover:text-[#a0a1a8]'
                                            }`}
                                    >
                                        Thinking
                                    </button>
                                    <button
                                        onClick={() => setActiveTab(AppTab.POLYMARKET_CONFIG)}
                                        className={`px-3 py-1.5 rounded text-[11px] font-medium uppercase tracking-[0.05em] transition-colors ${activeTab === AppTab.POLYMARKET_CONFIG
                                            ? 'bg-[#E7FE55] text-black'
                                            : 'text-[#747580] hover:text-[#a0a1a8]'
                                            }`}
                                    >
                                        Configuration
                                    </button>
                                    <button
                                        onClick={() => setActiveTab(AppTab.POLYMARKET_PROMPT)}
                                        className={`px-3 py-1.5 rounded text-[11px] font-medium uppercase tracking-[0.05em] transition-colors ${activeTab === AppTab.POLYMARKET_PROMPT
                                            ? 'bg-[#E7FE55] text-black'
                                            : 'text-[#747580] hover:text-[#a0a1a8]'
                                            }`}
                                    >
                                        Prompt
                                    </button>
                                </div>
                            )}

                            {/* Center: Configuration Page Tabs */}
                            {activeTab === AppTab.CONFIGURATION && (
                                <div className="hidden sm:flex items-center gap-1 bg-[#1a1b21] p-1 rounded border border-[#232328] absolute left-1/2 transform -translate-x-1/2">
                                    <button
                                        onClick={() => setActiveConfigTab('providers')}
                                        className={`px-3 py-1.5 rounded text-[11px] font-medium uppercase tracking-[0.05em] transition-colors ${activeConfigTab === 'providers'
                                            ? 'bg-[#E7FE55] text-black'
                                            : 'text-[#747580] hover:text-[#a0a1a8]'
                                            }`}
                                    >
                                        AI Providers
                                    </button>
                                    <button
                                        onClick={() => setActiveConfigTab('user')}
                                        className={`px-3 py-1.5 rounded text-[11px] font-medium uppercase tracking-[0.05em] transition-colors ${activeConfigTab === 'user'
                                            ? 'bg-[#E7FE55] text-black'
                                            : 'text-[#747580] hover:text-[#a0a1a8]'
                                            }`}
                                    >
                                        User Settings
                                    </button>
                                </div>
                            )}

                            {/* Center: Vault Tabs */}
                            {activeTab === AppTab.VAULT && (
                                <div className="hidden sm:flex items-center gap-1 bg-[#1a1b21] p-1 rounded border border-[#232328] absolute left-1/2 transform -translate-x-1/2">
                                    <button
                                        onClick={() => setActiveVaultTab('main')}
                                        className={`px-3 py-1.5 rounded text-[11px] font-medium uppercase tracking-[0.05em] transition-colors ${activeVaultTab === 'main'
                                            ? 'bg-[#E7FE55] text-black'
                                            : 'text-[#747580] hover:text-[#a0a1a8]'
                                            }`}
                                    >
                                        Overview
                                    </button>
                                    <button
                                        onClick={() => setActiveVaultTab('solana')}
                                        className={`px-3 py-1.5 rounded text-[11px] font-medium uppercase tracking-[0.05em] transition-colors ${activeVaultTab === 'solana'
                                            ? 'bg-[#E7FE55] text-black'
                                            : 'text-[#747580] hover:text-[#a0a1a8]'
                                            }`}
                                    >
                                        Solana
                                    </button>
                                    <button
                                        onClick={() => setActiveVaultTab('hyperliquid')}
                                        className={`px-3 py-1.5 rounded text-[11px] font-medium uppercase tracking-[0.05em] transition-colors ${activeVaultTab === 'hyperliquid'
                                            ? 'bg-[#E7FE55] text-black'
                                            : 'text-[#747580] hover:text-[#a0a1a8]'
                                            }`}
                                    >
                                        Hyperliquid
                                    </button>
                                    <button
                                        onClick={() => setActiveVaultTab('polymarket')}
                                        className={`px-3 py-1.5 rounded text-[11px] font-medium uppercase tracking-[0.05em] transition-colors ${activeVaultTab === 'polymarket'
                                            ? 'bg-[#E7FE55] text-black'
                                            : 'text-[#747580] hover:text-[#a0a1a8]'
                                            }`}
                                    >
                                        Polymarket
                                    </button>
                                </div>
                            )}

                            {/* Right: Status & Actions */}
                            <div className="flex items-center gap-4">
                                <div className="text-right hidden md:block">
                                    <div className="text-[9px] uppercase tracking-[0.05em] text-[#5a5b63]">System Status</div>
                                    <div className="flex items-center justify-end gap-1.5 text-[#E7FE55] text-[11px] font-medium">
                                        <div className="w-1 h-1 bg-[#E7FE55] rounded-full" />
                                        Online
                                    </div>
                                </div>

                                {/* User Profile Menu */}
                                <div className="relative">
                                    <button
                                        onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                                        className="flex items-center gap-2 p-1 rounded-lg hover:bg-[#1a1b21] transition-colors border border-transparent hover:border-[#232328]"
                                        title={user?.email || 'User'}
                                    >
                                        {user?.photoURL ? (
                                            <img
                                                src={user.photoURL}
                                                alt="User"
                                                className="w-8 h-8 rounded-full border border-[#232328]"
                                            />
                                        ) : (
                                            <div className="w-8 h-8 rounded-full bg-[#E7FE55] flex items-center justify-center text-black font-semibold text-sm">
                                                {user?.email?.[0]?.toUpperCase() || 'U'}
                                            </div>
                                        )}
                                    </button>

                                    {/* Dropdown Menu */}
                                    {isUserMenuOpen && (
                                        <>
                                            {/* Backdrop */}
                                            <div
                                                className="fixed inset-0 z-40"
                                                onClick={() => setIsUserMenuOpen(false)}
                                            />
                                            {/* Menu */}
                                            <div className="absolute right-0 top-full mt-2 w-64 bg-[#14151a] border border-[#232328] rounded-lg shadow-xl z-50 overflow-hidden">
                                                {/* User Info */}
                                                <div className="px-4 py-3 border-b border-[#232328]">
                                                    <div className="flex items-center gap-3">
                                                        {user?.photoURL ? (
                                                            <img
                                                                src={user.photoURL}
                                                                alt="User"
                                                                className="w-10 h-10 rounded-full border border-[#232328]"
                                                            />
                                                        ) : (
                                                            <div className="w-10 h-10 rounded-full bg-[#E7FE55] flex items-center justify-center text-black font-semibold">
                                                                {user?.email?.[0]?.toUpperCase() || 'U'}
                                                            </div>
                                                        )}
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-white text-sm font-medium truncate">
                                                                {user?.displayName || 'User'}
                                                            </p>
                                                            <p className="text-[#747580] text-xs truncate">
                                                                {user?.email}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>
                                                {/* Actions */}
                                                <div className="p-2 space-y-1">
                                                    <button
                                                        onClick={() => {
                                                            setIsUserMenuOpen(false);
                                                            handleRefreshData();
                                                        }}
                                                        className="w-full flex items-center gap-3 px-3 py-2 text-[#a0a1a8] hover:text-white hover:bg-[#1a1b21] rounded-lg transition-colors text-sm"
                                                    >
                                                        <RefreshCw size={16} />
                                                        Refresh Data
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            setIsUserMenuOpen(false);
                                                            setActiveTab(AppTab.CONFIGURATION);
                                                        }}
                                                        className="w-full flex items-center gap-3 px-3 py-2 text-[#a0a1a8] hover:text-white hover:bg-[#1a1b21] rounded-lg transition-colors text-sm"
                                                    >
                                                        <Settings size={16} />
                                                        Configuration
                                                    </button>
                                                    <div className="border-t border-[#232328] my-2" />
                                                    <button
                                                        onClick={async () => {
                                                            setIsUserMenuOpen(false);
                                                            await logout();
                                                        }}
                                                        className="w-full flex items-center gap-3 px-3 py-2 text-[#a0a1a8] hover:text-white hover:bg-[#1a1b21] rounded-lg transition-colors text-sm"
                                                    >
                                                        <LogOut size={16} />
                                                        Sign Out
                                                    </button>
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </div>

                            </div>
                        </header>
                    )}

                    {/* Content Area */}
                    <div className={`animate-fade-in ${[AppTab.VAULT_DEALER, AppTab.DEALER_DASHBOARD, AppTab.DEALER_THINKING, AppTab.DEALER_CONFIG, AppTab.DEALER_PROMPT, AppTab.POLYMARKET_DEALER, AppTab.POLYMARKET_DASHBOARD, AppTab.POLYMARKET_THINKING, AppTab.POLYMARKET_CONFIG, AppTab.POLYMARKET_PROMPT].includes(activeTab) ? 'flex-1 min-h-0' : ''}`}>
                        {activeTab === AppTab.DASHBOARD && (
                            <Dashboard
                                vault={vault}
                                connectOwnerWallet={connectOwnerWallet}
                                disconnectOwnerWallet={disconnectOwnerWallet}
                                connectHLOwnerWallet={connectHLOwnerWallet}
                                disconnectHLOwnerWallet={disconnectHLOwnerWallet}
                                connectPMOwnerWallet={connectPMOwnerWallet}
                                disconnectPMOwnerWallet={disconnectPMOwnerWallet}
                                assetPrices={assetPrices}
                                portfolioHistoryDaily={portfolioHistoryDaily}
                                portfolioHistoryLongTerm={portfolioHistoryLongTerm}
                                scheduledTasks={scheduledTasks}
                                assetAllocationData={assetAllocationData}
                                activityFeed={activityFeed}
                                activityDisplayCount={activityDisplayCount}
                                setActiveTab={setActiveTab}
                                refreshData={handleRefreshData}
                                onNewChat={handleNewChat} setActivityDisplayCount={function (count: number): void {
                                    throw new Error('Function not implemented.');
                                }} />
                        )}

                        {activeTab === AppTab.VAULT && (
                            <Vault
                                vault={vault}
                                password={password}
                                setPassword={setPassword}
                                withdrawAmount={withdrawAmount}
                                setWithdrawAmount={setWithdrawAmount}
                                withdrawNetwork={withdrawNetwork}
                                setWithdrawNetwork={setWithdrawNetwork}
                                isImporting={isImporting}
                                setIsImporting={setIsImporting}
                                importKey={importKey}
                                setImportKey={setImportKey}
                                createVault={createVault}
                                unlockVault={unlockVault}
                                requestAirdrop={requestAirdrop}
                                handleWithdraw={handleWithdraw}
                                handleWithdrawHL={handleWithdrawHL}
                                handleWithdrawPM={handleWithdrawPM}
                                importVault={importVault}
                                addNotification={addNotification}
                                // Individual Wallet Props
                                isImportingSolana={isImportingSolana}
                                setIsImportingSolana={setIsImportingSolana}
                                isImportingHyperliquid={isImportingHyperliquid}
                                setIsImportingHyperliquid={setIsImportingHyperliquid}
                                isImportingPolymarket={isImportingPolymarket}
                                setIsImportingPolymarket={setIsImportingPolymarket}
                                solanaPassword={solanaPassword}
                                setSolanaPassword={setSolanaPassword}
                                hyperliquidPassword={hyperliquidPassword}
                                setHyperliquidPassword={setHyperliquidPassword}
                                polymarketPassword={polymarketPassword}
                                setPolymarketPassword={setPolymarketPassword}
                                solanaImportKey={solanaImportKey}
                                setSolanaImportKey={setSolanaImportKey}
                                hlImportKey={hlImportKey}
                                setHLImportKey={setHLImportKey}
                                pmImportKey={pmImportKey}
                                setPMImportKey={setPMImportKey}
                                createSolanaVault={createSolanaVault}
                                createHyperliquidVault={createHyperliquidVault}
                                createPolymarketVault={createPolymarketVault}
                                importSolanaVault={importSolanaVault}
                                importHyperliquidVault={importHyperliquidVault}
                                importPolymarketVault={importPolymarketVault}
                                setActiveTab={setActiveTab}
                                activeVaultTab={activeVaultTab}
                                setActiveVaultTab={setActiveVaultTab}
                            />
                        )}

                        {activeTab === AppTab.AGENT && (
                            <AgentConsole
                                messages={messages}
                                inputMessage={inputMessage}
                                setInputMessage={setInputMessage}
                                handleSendMessage={handleSendMessage}
                                isAiProcessing={isAiProcessing}
                                aiStatus={aiStatus}
                                scrollRef={scrollRef}
                                isVaultUnlocked={vault.isUnlocked}
                                password={password}
                                setPassword={setPassword}
                                unlockVault={unlockVault}
                                hasVault={!!(vault.publicKey || vault.hlPublicKey)}
                                onNavigate={setActiveTab}
                            />
                        )}

                        {activeTab === AppTab.HISTORY && (
                            <HistoryPage
                                onSelectConversation={(id) => {
                                    handleSelectConversation(id);
                                    setActiveTab(AppTab.AGENT);
                                }}
                            />
                        )}

                        {activeTab === AppTab.SCHEDULER && (
                            <Scheduler
                                scheduledTasks={scheduledTasks}
                                setScheduledTasks={setScheduledTasks}
                                addNotification={addNotification}
                            />
                        )}

                        {[AppTab.VAULT_DEALER, AppTab.DEALER_DASHBOARD, AppTab.DEALER_THINKING, AppTab.DEALER_CONFIG, AppTab.DEALER_PROMPT].includes(activeTab) && (
                            <DealerConsole
                                vault={vault}
                                password={password}
                                activeTab={activeTab}
                                setActiveTab={setActiveTab}
                            />
                        )}

                        {activeTab === AppTab.CONFIGURATION && (
                            <ConfigurationPage
                                vault={vault}
                                password={password}
                                addNotification={addNotification}
                                activeTab={activeConfigTab}
                                setActiveTab={setActiveConfigTab}
                            />
                        )}

                        {activeTab === AppTab.HYPERLIQUID && (
                            <HyperliquidDashboard
                                vault={vault}
                                connectHLOwnerWallet={connectHLOwnerWallet}
                                refreshHLBalance={refreshHLBalance}
                                activityLog={activityFeed}
                            />
                        )}

                        {activeTab === AppTab.TOKEN_COSTS && (
                            <TokenCostsPage
                                addNotification={addNotification}
                            />
                        )}

                        {/* Polymarket Dealer Routes */}
                        {[AppTab.POLYMARKET_DEALER, AppTab.POLYMARKET_DASHBOARD, AppTab.POLYMARKET_THINKING, AppTab.POLYMARKET_CONFIG, AppTab.POLYMARKET_PROMPT].includes(activeTab) && (
                            <PolymarketWrapper
                                vault={vault}
                                password={password}
                                activeTab={activeTab}
                                setActiveTab={setActiveTab}
                            />
                        )}

                        {activeTab === AppTab.PRIVACY && <PrivacyPolicy />}
                        {activeTab === AppTab.TERMS && <TermsOfUse />}
                    </div>
                </div>
                {activeTab !== AppTab.AGENT && <Footer onNavigate={setActiveTab} />}
            </main>

            {/* Notifications Toast */}
            <div className="fixed bottom-6 right-6 z-[60] space-y-2 pointer-events-none">
                {notifications.map(n => (
                    <div key={n.id} className="bg-[#14151a] border border-[#232328] text-white px-4 py-3 rounded shadow-xl flex items-center gap-3 animate-slide-up pointer-events-auto max-w-sm">
                        <div className="w-1.5 h-1.5 bg-[#E7FE55] rounded-full" />
                        <span className="text-sm font-medium">{n.message}</span>
                        <button onClick={() => setNotifications(prev => prev.filter(x => x.id !== n.id))} className="text-[#747580] hover:text-white ml-2">
                            <X size={14} />
                        </button>
                    </div>
                ))}
            </div>

            {/* Backup Modals - Sequential Flow */}
            {showBackupModal && (
                <SolanaBackupModal
                    backupKey={backupKey}
                    setBackupKey={setBackupKey}
                    setShowBackupModal={setShowBackupModal}
                    addNotification={addNotification}
                    onClose={() => {
                        // After Solana backup is confirmed, show Hyperliquid backup
                        setShowHLBackupModal(true);
                    }}
                />
            )}

            {showHLBackupModal && (
                <HyperliquidBackupModal
                    backupKey={hlBackupKey}
                    setBackupKey={setHLBackupKey}
                    setShowBackupModal={setShowHLBackupModal}
                    addNotification={addNotification}
                />
            )}

            {showPMBackupModal && (
                <PolymarketBackupModal
                    backupKey={pmBackupKey}
                    setBackupKey={setPMBackupKey}
                    setShowBackupModal={setShowPMBackupModal}
                    addNotification={addNotification}
                />
            )}

            {/* Legal Consent Modal */}
            <ConsentModal userId={user?.uid || null} />
        </div>
    );
}
