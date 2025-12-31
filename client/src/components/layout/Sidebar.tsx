import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ShieldCheck,
    Activity,
    LockKeyhole,
    Bot,
    Zap,
    Coins,
    TrendingUp,
    Droplets,
    ChevronDown,
    ChevronRight,
    Briefcase
} from 'lucide-react';
import { AppTab } from '../../types';
import { hyperliquidService } from '../../services/hyperliquidService';
import { TooltipProvider } from '../ui/tooltip';
import { cn } from '@/lib/utils';

interface SidebarProps {
    activeTab: AppTab;
    setActiveTab: (tab: AppTab) => void;
    isVaultUnlocked: boolean;
    onSelectConversation: (id: string) => void;
    onNewChat: () => void;
    currentConversationId: string | null;
    password: string;
    isOpen?: boolean;
    onClose?: () => void;
}

interface NavItemProps {
    icon: React.ReactNode;
    label: string;
    isActive: boolean;
    onClick: () => void;
    isSubItem?: boolean;
}

const NavItem: React.FC<NavItemProps> = ({ icon, label, isActive, onClick, isSubItem = false }) => (
    <button
        onClick={onClick}
        className={cn(
            "w-full flex items-center gap-3 text-[13px] font-medium transition-all duration-200 rounded-xl relative overflow-hidden",
            isSubItem ? "px-3 py-2 pl-6" : "px-3 py-2.5",
            isActive
                ? "text-white bg-[#1a1b21]/80 backdrop-blur-sm"
                : "text-[#747580] hover:text-[#a0a1a8] hover:bg-[#1a1b21]/40"
        )}
        title={label}
    >
        {/* Active indicator bar */}
        {isActive && (
            <div className={cn(
                "absolute top-1/2 -translate-y-1/2 w-1 rounded-full bg-[#E7FE55]",
                isSubItem ? "left-0 h-4" : "left-0 h-6"
            )} />
        )}
        <span className={cn(
            "flex items-center justify-center transition-colors",
            !isSubItem && "ml-1",
            isActive && "text-[#E7FE55]"
        )}>
            {icon}
        </span>
        <span className="tracking-wide">{label}</span>
    </button>
);

interface NavGroupProps {
    icon: React.ReactNode;
    label: string;
    isExpanded: boolean;
    onToggle: () => void;
    hasActiveChild: boolean;
    children: React.ReactNode;
}

const NavGroup: React.FC<NavGroupProps> = ({ icon, label, isExpanded, onToggle, hasActiveChild, children }) => (
    <div className="space-y-0.5">
        <button
            onClick={onToggle}
            className={cn(
                "w-full flex items-center justify-between px-3 py-2.5 text-[13px] font-medium transition-all duration-200 rounded-xl relative overflow-hidden",
                hasActiveChild
                    ? "text-white bg-[#1a1b21]/80 backdrop-blur-sm"
                    : "text-[#747580] hover:text-[#a0a1a8] hover:bg-[#1a1b21]/40"
            )}
            title={label}
        >
            <div className="flex items-center gap-3">
                {/* Active indicator bar */}
                {hasActiveChild && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-[#E7FE55] rounded-full" />
                )}
                <span className={cn(
                    "flex items-center justify-center transition-colors ml-1",
                    hasActiveChild && "text-[#E7FE55]"
                )}>
                    {icon}
                </span>
                <span className="tracking-wide">{label}</span>
            </div>
            <motion.span
                initial={false}
                animate={{ rotate: isExpanded ? 180 : 0 }}
                transition={{ duration: 0.2 }}
                className="text-[#5a5b63]"
            >
                <ChevronDown size={14} />
            </motion.span>
        </button>
        <AnimatePresence initial={false}>
            {isExpanded && (
                <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2, ease: "easeInOut" }}
                    className="overflow-hidden"
                >
                    <div className="relative ml-1 pl-2 border-l border-[#2a2b30]">
                        {children}
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    </div>
);

const StatusIndicator: React.FC<{ status: 'Online' | 'Down' | 'Checking'; label: string; latency?: string; network: 'solana' | 'hyperliquid' }> = ({
    status,
    label,
    latency,
    network
}) => {
    const isDown = status === 'Down';
    const isChecking = status === 'Checking';
    const dotColor = isDown ? '#ef4444' : isChecking ? '#747580' : '#E7FE55';

    return (
        <div className="flex items-center justify-between py-0.5">
            <span className="text-[9px] uppercase tracking-[0.05em] text-[#5a5b63]">
                {label}
            </span>
            <div className="flex items-center gap-1.5">
                <span className="text-[9px] font-mono text-[#5a5b63]">
                    {isDown ? 'DOWN' : isChecking ? '...' : latency}
                </span>
                <div
                    className="w-1 h-1 rounded-full"
                    style={{ backgroundColor: dotColor }}
                />
            </div>
        </div>
    );
};

export const Sidebar: React.FC<SidebarProps> = ({
    activeTab,
    setActiveTab,
    isVaultUnlocked,
    onSelectConversation,
    onNewChat,
    currentConversationId,
    password,
    isOpen = false,
    onClose
}) => {
    const [hlStatus, setHlStatus] = useState<'Online' | 'Down' | 'Checking'>('Checking');
    
    // State for dealer submenu expansion - auto-expand when any dealer is active
    const isDealerActive = [AppTab.VAULT_DEALER, AppTab.DEALER_DASHBOARD, AppTab.DEALER_THINKING, AppTab.DEALER_CONFIG, AppTab.DEALER_PROMPT].includes(activeTab);
    const isPolymarketDealerActive = [AppTab.POLYMARKET_DEALER, AppTab.POLYMARKET_DASHBOARD, AppTab.POLYMARKET_THINKING, AppTab.POLYMARKET_CONFIG, AppTab.POLYMARKET_PROMPT].includes(activeTab);
    const isSolanaDealerActive = [AppTab.SOLANA_DEALER, AppTab.SOLANA_DEALER_DASHBOARD, AppTab.SOLANA_DEALER_THINKING, AppTab.SOLANA_DEALER_POLICY, AppTab.SOLANA_DEALER_LOG].includes(activeTab);
    const isAnyDealerActive = isDealerActive || isPolymarketDealerActive || isSolanaDealerActive;
    
    const [isDealerExpanded, setIsDealerExpanded] = useState(isAnyDealerActive);
    const isManagerActive = activeTab === AppTab.AGENT;

    // Auto-expand when dealer becomes active
    useEffect(() => {
        if (isAnyDealerActive) {
            setIsDealerExpanded(true);
        }
    }, [isAnyDealerActive]);

    useEffect(() => {
        const checkStatus = async () => {
            const isHealthy = await hyperliquidService.checkHealth();
            setHlStatus(isHealthy ? 'Online' : 'Down');
        };
        checkStatus();
        const interval = setInterval(checkStatus, 30000);
        return () => clearInterval(interval);
    }, []);

    const handleNavigation = (tab: AppTab) => {
        setActiveTab(tab);
        if (onClose) onClose();
    };

    return (
        <TooltipProvider delayDuration={300}>
            {/* Mobile Backdrop */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/60 z-40 xl:hidden"
                        onClick={onClose}
                    />
                )}
            </AnimatePresence>

            <aside className={cn(
                "m-3 p-5 flex flex-col fixed h-[calc(100%-24px)] bg-[#0f1015]/95 backdrop-blur-xl z-50 w-60 transform transition-transform duration-300 ease-in-out",
                "rounded-2xl border border-[#232328]/60 shadow-2xl shadow-black/20",
                isOpen ? "translate-x-0" : "-translate-x-full",
                "xl:translate-x-0"
            )}>
                {/* Logo */}
                <div className="mb-8 flex items-center gap-3 px-2">
                    <div className="w-8 h-8 flex-shrink-0 bg-[#E7FE55] rounded flex items-center justify-center">
                        <ShieldCheck className="text-black w-5 h-5" />
                    </div>
                    <h1 className="text-[15px] font-semibold text-white tracking-tight hidden xl:block">
                        AutonomousVault
                    </h1>
                </div>

                <nav className="space-y-1 flex-1">
                    {/* Dashboard */}
                    <NavItem
                        icon={<Activity size={18} />}
                        label="Dashboard"
                        isActive={activeTab === AppTab.DASHBOARD}
                        onClick={() => handleNavigation(AppTab.DASHBOARD)}
                    />

                    {/* Vault Operator */}
                    <NavItem
                        icon={<Bot size={18} />}
                        label="Vault Operator"
                        isActive={isManagerActive}
                        onClick={() => handleNavigation(AppTab.AGENT)}
                    />

                    {/* Vault Dealer - Parent with expandable subpages */}
                    <NavGroup
                        icon={<Briefcase size={18} />}
                        label="Vault Dealer"
                        isExpanded={isDealerExpanded}
                        onToggle={() => setIsDealerExpanded(!isDealerExpanded)}
                        hasActiveChild={isAnyDealerActive}
                    >
                        {/* Hyperliquid */}
                        <NavItem
                            icon={<Zap size={16} />}
                            label="Hyperliquid"
                            isActive={isDealerActive}
                            onClick={() => handleNavigation(AppTab.VAULT_DEALER)}
                            isSubItem
                        />
                        
                        {/* Solana */}
                        <NavItem
                            icon={<Droplets size={16} />}
                            label="Solana"
                            isActive={isSolanaDealerActive}
                            onClick={() => handleNavigation(AppTab.SOLANA_DEALER)}
                            isSubItem
                        />
                        
                        {/* Polymarket */}
                        <NavItem
                            icon={<TrendingUp size={16} />}
                            label="Polymarket"
                            isActive={isPolymarketDealerActive}
                            onClick={() => handleNavigation(AppTab.POLYMARKET_DEALER)}
                            isSubItem
                        />
                    </NavGroup>

                    {/* Vault */}
                    <NavItem
                        icon={<LockKeyhole size={18} />}
                        label="Vault"
                        isActive={activeTab === AppTab.VAULT}
                        onClick={() => handleNavigation(AppTab.VAULT)}
                    />

                    {/* Token Costs */}
                    <NavItem
                        icon={<Coins size={18} />}
                        label="Token Costs"
                        isActive={activeTab === AppTab.TOKEN_COSTS}
                        onClick={() => handleNavigation(AppTab.TOKEN_COSTS)}
                    />
                </nav>

                {/* Network Status */}
                <div className="pt-6 border-t border-[#232328]">
                    <div className="text-[10px] uppercase tracking-[0.1em] text-[#747580] font-semibold mb-3 px-2">
                        Network Status
                    </div>
                    <div className="space-y-2 px-2">
                        <StatusIndicator
                            status="Online"
                            label="Solana Devnet"
                            latency="18m"
                            network="solana"
                        />
                        <StatusIndicator
                            status={hlStatus}
                            label="Hyperliquid Testnet"
                            latency="450ms"
                            network="hyperliquid"
                        />
                    </div>
                </div>
            </aside>
        </TooltipProvider>
    );
};

