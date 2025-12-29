import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ShieldCheck,
    Activity,
    LockKeyhole,
    Bot,
    Zap,
    Plus,
    Coins,
    TrendingUp
} from 'lucide-react';
import { AppTab } from '../../types';
import { hyperliquidService } from '../../services/hyperliquidService';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';
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
}

const NavItem: React.FC<NavItemProps> = ({ icon, label, isActive, onClick }) => (
    <button
        onClick={onClick}
        className={cn(
            "w-full flex items-center gap-3 px-3 py-2.5 text-[13px] font-medium transition-all duration-200 rounded-xl relative overflow-hidden",
            isActive
                ? "text-white bg-[#1a1b21]/80 backdrop-blur-sm"
                : "text-[#747580] hover:text-[#a0a1a8] hover:bg-[#1a1b21]/40"
        )}
        title={label}
    >
        {/* Active indicator bar */}
        {isActive && (
            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-[#E7FE55] rounded-full" />
        )}
        <span className={cn(
            "flex items-center justify-center transition-colors ml-1",
            isActive && "text-[#E7FE55]"
        )}>
            {icon}
        </span>
        <span className="tracking-wide">{label}</span>
    </button>
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

    const isDealerActive = [AppTab.VAULT_DEALER, AppTab.DEALER_DASHBOARD, AppTab.DEALER_THINKING, AppTab.DEALER_CONFIG, AppTab.DEALER_PROMPT].includes(activeTab);
    const isPolymarketDealerActive = [AppTab.POLYMARKET_DEALER, AppTab.POLYMARKET_DASHBOARD, AppTab.POLYMARKET_THINKING, AppTab.POLYMARKET_CONFIG, AppTab.POLYMARKET_PROMPT].includes(activeTab);
    const isManagerActive = activeTab === AppTab.AGENT;

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

                    {/* Vault Operator Group */}
                    <div
                        onClick={() => handleNavigation(AppTab.AGENT)}
                        className={cn(
                            "flex items-center justify-between px-3 py-2.5 rounded-xl transition-all duration-200 cursor-pointer relative overflow-hidden",
                            isManagerActive
                                ? "bg-[#1a1b21]/80 backdrop-blur-sm"
                                : "hover:bg-[#1a1b21]/40"
                        )}
                    >
                        {/* Active indicator bar */}
                        {isManagerActive && (
                            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-[#E7FE55] rounded-full" />
                        )}
                        <div
                            className={cn(
                                "ml-1",
                                "flex flex-1 items-center gap-3 text-[13px] font-medium",
                                activeTab === AppTab.AGENT ? "text-white" : "text-[#747580] hover:text-[#a0a1a8]"
                            )}
                            title="Vault Operator"
                        >
                            <span className={cn(
                                "transition-colors",
                                activeTab === AppTab.AGENT && "text-[#E7FE55]"
                            )}>
                                <Bot size={18} />
                            </span>
                            <span className="tracking-wide">Vault Operator</span>
                        </div>

                    </div>

                    {/* Hyperliquid Dealer (Green) */}
                    <div className="pt-2">
                        <button
                            onClick={() => handleNavigation(AppTab.VAULT_DEALER)}
                            className={cn(
                                "w-full flex items-center gap-3 px-3 py-2.5 text-[13px] font-medium transition-all duration-200 rounded-xl relative overflow-hidden",
                                isDealerActive
                                    ? "text-white bg-[#1a1b21]/80 backdrop-blur-sm"
                                    : "text-[#747580] hover:text-[#a0a1a8] hover:bg-[#1a1b21]/40"
                            )}
                            title="Hyperliquid Dealer"
                        >
                            {/* Active indicator bar */}
                            {isDealerActive && (
                                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-[#E7FE55] rounded-full" />
                            )}
                            <span className={cn(
                                "transition-colors ml-1",
                                isDealerActive && "text-[#E7FE55]"
                            )}>
                                <Zap size={18} />
                            </span>
                            <span className="tracking-wide">Hyperliquid Dealer</span>
                        </button>
                    </div>

                    {/* Polymarket Dealer - (Blue) */}
                    <div>
                        <button
                            onClick={() => handleNavigation(AppTab.POLYMARKET_DEALER)}
                            className={cn(
                                "w-full flex items-center gap-3 px-3 py-2.5 text-[13px] font-medium transition-all duration-200 rounded-xl relative overflow-hidden",
                                isPolymarketDealerActive
                                    ? "text-white bg-[#1a1b21]/80 backdrop-blur-sm"
                                    : "text-[#747580] hover:text-[#a0a1a8] hover:bg-[#1a1b21]/40"
                            )}
                            title="Polymarket Dealer"
                        >
                            {/* Active indicator bar */}
                            {isPolymarketDealerActive && (
                                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-[#E7FE55] rounded-full" />
                            )}
                            <span className={cn(
                                "transition-colors ml-1",
                                isPolymarketDealerActive && "text-[#E7FE55]"
                            )}>
                                <TrendingUp size={18} />
                            </span>
                            <span className="tracking-wide">Polymarket Dealer</span>
                        </button>
                    </div>

                    {/* Vault - Solana (Purple) */}
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

