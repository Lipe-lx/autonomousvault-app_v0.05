import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Line, ComposedChart, BarChart, Bar } from 'recharts';
import { Wallet, Activity, TrendingUp, Clock, ArrowUpRight, ArrowDownLeft, ExternalLink, ChevronLeft, ChevronRight, Zap, Globe, RefreshCw, BarChartHorizontal, PieChart as PieChartIcon, Plus } from 'lucide-react';
import { StatCard } from '../shared/StatCard';
import { COLORS, MOCK_POOL_PRICES } from '../../constants';
import { VaultState, ScheduledTask, AppTab } from '../../types';
import { MOCK_HISTORY_DATA } from '../../hooks/useMarketData';
import { ActivityItem } from '../../hooks/useActivityFeed';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { cn } from '@/lib/utils';

interface DashboardProps {
    vault: VaultState;
    connectOwnerWallet: () => void;
    disconnectOwnerWallet: () => void;
    connectHLOwnerWallet: () => void;
    disconnectHLOwnerWallet: () => void;
    connectPMOwnerWallet: () => void;
    disconnectPMOwnerWallet: () => void;
    assetPrices: Record<string, number>;
    portfolioHistoryDaily: any[]; // 15-minute snapshots for 1D view
    portfolioHistoryLongTerm: any[]; // Daily snapshots for 1W, 1M, 1Y views
    scheduledTasks: ScheduledTask[];
    assetAllocationData: { data: any[], totalValue: number };
    activityFeed: ActivityItem[];
    activityDisplayCount: number;
    setActivityDisplayCount: (count: number) => void;
    setActiveTab: (tab: AppTab) => void;
    refreshData: () => void;
    onNewChat?: () => void;
}


// Network badge component - Purple for Solana, Green for Hyperliquid, Blue for Polymarket
const NetworkBadge: React.FC<{ network: 'solana' | 'hyperliquid' | 'polymarket' }> = ({ network }) => {
    const colors = {
        solana: 'bg-[#9b87f5]/15 text-[#9b87f5] border-[#9b87f5]/30',
        hyperliquid: 'bg-[#34d399]/15 text-[#34d399] border-[#34d399]/30',
        polymarket: 'bg-[#60a5fa]/15 text-[#60a5fa] border-[#60a5fa]/30'
    };
    const labels = { solana: 'SOL', hyperliquid: 'HL', polymarket: 'PM' };

    return (
        <span className={`px-1.5 py-0.5 text-[10px] font-semibold rounded uppercase tracking-[0.05em] border ${colors[network]}`}>
            {labels[network]}
        </span>
    );
};

// Quick action button component
const QuickAction: React.FC<{
    icon: React.ReactNode;
    label: string;
    onClick?: () => void;
    href?: string;
}> = ({ icon, label, onClick, href }) => {
    const content = (
        <div className="flex flex-col items-center gap-2 p-3 rounded bg-[#14151a] hover:bg-[#1a1b21] border border-[#232328] transition-colors cursor-pointer group">
            <div className="p-2 rounded bg-[#1a1b21] group-hover:bg-[#E7FE55]/20 transition-colors">
                {icon}
            </div>
            <span className="text-xs text-[#747580] group-hover:text-[#a0a1a8] text-center">{label}</span>
        </div>
    );

    if (href) {
        return (
            <a href={href} target="_blank" rel="noopener noreferrer">
                {content}
            </a>
        );
    }
    return <div onClick={onClick}>{content}</div>;
};

export const Dashboard: React.FC<DashboardProps> = ({
    vault,
    connectOwnerWallet,
    disconnectOwnerWallet,
    connectHLOwnerWallet,
    disconnectHLOwnerWallet,
    connectPMOwnerWallet,
    disconnectPMOwnerWallet,
    assetPrices,
    portfolioHistoryDaily,
    portfolioHistoryLongTerm,
    scheduledTasks,
    assetAllocationData,
    activityFeed,
    activityDisplayCount,
    setActivityDisplayCount,
    setActiveTab,
    refreshData,
    onNewChat
}) => {
    // Local state for filters and pagination
    const [activityFilter, setActivityFilter] = useState<'all' | 'solana' | 'hyperliquid'>('all');
    const [activityPage, setActivityPage] = useState(0);
    const ACTIVITY_PAGE_SIZE = 2;

    // Period filter state for Portfolio Evolution chart
    const [selectedPeriod, setSelectedPeriod] = useState<'1D' | '1W' | '1M' | '1Y'>('1D');

    // Calculate which periods are available based on data length
    const historyDays = portfolioHistoryLongTerm.length;
    const availablePeriods = useMemo(() => ({
        '1D': portfolioHistoryDaily.length > 0 || historyDays >= 1,
        '1W': historyDays >= 7,
        '1M': historyDays >= 30,
        '1Y': historyDays >= 365
    }), [historyDays, portfolioHistoryDaily.length]);

    // Get filtered data for the selected period
    const filteredHistory = useMemo(() => {
        // For 1D, use intraday 15-minute data
        if (selectedPeriod === '1D') {
            return portfolioHistoryDaily;
        }
        // For longer periods, use daily data
        if (portfolioHistoryLongTerm.length === 0) return [];
        const periodDays = { '1D': 1, '1W': 7, '1M': 30, '1Y': 365 };
        const days = periodDays[selectedPeriod] || 30;
        return portfolioHistoryLongTerm.slice(-days);
    }, [portfolioHistoryDaily, portfolioHistoryLongTerm, selectedPeriod]);


    const [tasksPage, setTasksPage] = useState(0);
    const TASKS_PAGE_SIZE = 2;

    // Copy to clipboard state
    const [copiedAddress, setCopiedAddress] = useState<string | null>(null);

    // Chart Type state for Asset Allocation
    const [allocationChartType, setAllocationChartType] = useState<'bar' | 'pie'>('pie');
    // State for interactive bar chart hover
    const [hoveredAsset, setHoveredAsset] = useState<string | null>(null);
    // State for interactive pie chart
    const [pieActiveIndex, setPieActiveIndex] = useState<number | undefined>(undefined);

    // Copy address to clipboard with feedback
    const copyToClipboard = async (address: string) => {
        try {
            await navigator.clipboard.writeText(address);
            setCopiedAddress(address);
            setTimeout(() => setCopiedAddress(null), 2000);
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    };

    const getExplorerUrl = (item: ActivityItem) => {
        if (item.network === 'solana' && item.signature) {
            return `https://solscan.io/tx/${item.signature}?cluster=devnet`;
        }
        if (item.network === 'hyperliquid' && item.signature) {
            // Extract transaction ID from signature (format: hl-{tid})
            const tid = item.signature.replace('hl-', '');
            return `https://app.hyperliquid-testnet.xyz/explorer/tx/${tid}`;
        }
        return null;
    };

    return (
        <div className="space-y-6">
            {/* Top Stats Row - Responsive Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 2xl:grid-cols-4 gap-4 lg:gap-6">
                {/* Column 1: Net Worth & New Chat Split */}
                <div className="flex flex-col gap-4 lg:gap-6">
                    {/* Total Net Worth */}
                    <div className="glass-panel p-5 rounded relative overflow-hidden flex-1 flex flex-col justify-center group">
                        <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                            <Wallet size={48} className="text-white" />
                        </div>
                        <h3 className="text-[10px] uppercase tracking-[0.1em] text-[#747580] font-semibold mb-2">
                            Total Net Worth
                        </h3>
                        <div className="text-2xl lg:text-3xl font-semibold text-white tracking-tight">
                            ${assetAllocationData.totalValue.toFixed(2)}
                        </div>
                        <div className="text-[11px] text-[#747580] mt-1">Cross-Chain Unified Portfolio</div>
                    </div>

                    {/* New Chat Button */}
                    <button
                        onClick={onNewChat}
                        className="glass-panel p-5 rounded relative overflow-hidden flex-1 flex flex-col justify-center items-start text-left hover:bg-[#1a1b21] transition-colors group border border-dashed border-[#232328] hover:border-[#E7FE55]/50"
                    >
                        <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity text-[#E7FE55]">
                            <Plus size={48} />
                        </div>
                        <div className="flex items-center gap-2 mb-1">
                            <div className="p-1.5 rounded bg-[#E7FE55]/15 text-[#E7FE55] group-hover:bg-[#E7FE55] group-hover:text-black transition-colors">
                                <Plus size={16} />
                            </div>
                            <h3 className="text-[#E7FE55] font-medium text-sm">New Conversation</h3>
                        </div>
                        <div className="text-[11px] text-[#747580]">
                            Start a new task or query
                        </div>
                    </button>
                </div>

                {/* Solana Vault */}
                <div className="glass-panel p-6 rounded relative overflow-hidden flex flex-col">
                    <div className="absolute top-0 right-0 p-4 opacity-5">
                        <Activity size={48} className="text-white" />
                    </div>
                    <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-[10px] uppercase tracking-[0.1em] text-[#747580] font-semibold">Solana Vault</h3>
                    </div>
                    <div className="text-xl lg:text-2xl font-semibold text-white tracking-tight">{vault.solBalance.toFixed(4)} SOL</div>
                    <div className="text-[11px] text-[#E7FE55] mt-1">
                        ≈ ${(vault.solBalance * (assetPrices['SOL'] || MOCK_POOL_PRICES.SOL)).toFixed(2)}
                    </div>

                    {/* Vault Address Display */}
                    <div className="mt-4 pt-3 border-t border-[#232328]">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] font-semibold uppercase tracking-[0.05em] text-[#747580]">Vault Address</span>
                            {vault.publicKey && (
                                <a
                                    href={`https://solscan.io/address/${vault.publicKey}?cluster=devnet`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-[10px] text-[#E7FE55] hover:text-[#f0ff85] flex items-center gap-1"
                                    title="View on Solscan Explorer"
                                >
                                    <Globe size={10} /> Solscan
                                </a>
                            )}
                        </div>
                        {vault.publicKey ? (
                            <div
                                onClick={() => copyToClipboard(vault.publicKey!)}
                                className="flex items-center gap-2 cursor-pointer group"
                            >
                                <div className="w-1.5 h-1.5 rounded-full bg-[#E7FE55]" />
                                <span className="text-xs text-white font-mono truncate group-hover:text-[#E7FE55] transition-colors">
                                    {vault.publicKey.slice(0, 4)}...{vault.publicKey.slice(-4)}
                                </span>
                                {copiedAddress === vault.publicKey ? (
                                    <span className="text-[10px] text-[#E7FE55] ml-auto">Copied!</span>
                                ) : (
                                    <span className="text-[10px] text-[#747580] ml-auto opacity-0 group-hover:opacity-100 transition-opacity">Click to copy</span>
                                )}
                            </div>
                        ) : (
                            <div className="text-[10px] text-[#747580] italic">Not created</div>
                        )}
                    </div>

                    {/* Solana Owner Section */}
                    <div className="mt-3 pt-3 border-t border-[#232328]">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] uppercase tracking-[0.05em] font-semibold text-[#747580]">
                                Solana Owner
                            </span>
                        </div>
                        {vault.ownerPublicKey ? (
                            <div className="flex items-center justify-between">
                                <div
                                    onClick={() => copyToClipboard(vault.ownerPublicKey!)}
                                    className="flex items-center gap-2 cursor-pointer group flex-1"
                                >
                                    <div className="w-1.5 h-1.5 rounded-full bg-[#E7FE55]" />
                                    <span className="text-xs text-white font-mono truncate group-hover:text-[#E7FE55] transition-colors">
                                        {vault.ownerPublicKey.slice(0, 4)}...{vault.ownerPublicKey.slice(-4)}
                                    </span>
                                    {copiedAddress === vault.ownerPublicKey ? (
                                        <span className="text-[10px] text-[#E7FE55] ml-2">Copied!</span>
                                    ) : (
                                        <span className="text-[10px] text-[#747580] ml-2 opacity-0 group-hover:opacity-100 transition-opacity">Click to copy</span>
                                    )}
                                </div>
                                <button
                                    onClick={disconnectOwnerWallet}
                                    className="ml-2 px-2 py-1 text-[10px] font-medium text-[#747580] hover:text-[#E7FE55] bg-transparent hover:bg-[#E7FE55]/10 rounded border border-[#232328] hover:border-[#E7FE55]/30 transition-colors flex-shrink-0"
                                >
                                    Disconnect
                                </button>
                            </div>
                        ) : (
                            <div className="flex items-center justify-between">
                                <div className="text-[10px] text-[#747580] italic">Not connected</div>
                                <button
                                    onClick={connectOwnerWallet}
                                    className="px-2 py-1 text-[10px] font-medium text-[#E7FE55] hover:text-[#f0ff85] bg-[#E7FE55]/10 hover:bg-[#E7FE55]/20 rounded border border-[#E7FE55]/20 transition-colors flex-shrink-0"
                                >
                                    Connect
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Hyperliquid Vault */}
                <div className="glass-panel p-6 rounded relative overflow-hidden flex flex-col">
                    <div className="absolute top-0 right-0 p-4 opacity-5">
                        <TrendingUp size={48} className="text-white" />
                    </div>
                    <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-[10px] uppercase tracking-[0.1em] text-[#747580] font-semibold">Hyperliquid Vault</h3>
                    </div>
                    <div className="text-xl lg:text-2xl font-semibold text-white tracking-tight">{(vault.hlBalance || 0).toFixed(2)} USDC</div>
                    <div className="text-[11px] text-[#747580] mt-1">
                        {vault.hlPositions && vault.hlPositions.length > 0
                            ? `${vault.hlPositions.length} open position${vault.hlPositions.length > 1 ? 's' : ''}`
                            : 'No open positions'}
                    </div>

                    {/* HL Vault Address Display */}
                    <div className="mt-4 pt-3 border-t border-[#232328]">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] font-semibold uppercase tracking-[0.05em] text-[#747580]">Vault Address</span>
                            <a
                                href="https://app.hyperliquid-testnet.xyz"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[10px] text-[#E7FE55] hover:text-[#f0ff85] flex items-center gap-1"
                                title="Hyperliquid Platform Official Website"
                            >
                                <TrendingUp size={10} /> Hyperliquid
                            </a>
                        </div>
                        {vault.hlPublicKey ? (
                            <div
                                onClick={() => copyToClipboard(vault.hlPublicKey!)}
                                className="flex items-center gap-2 cursor-pointer group"
                            >
                                <div className="w-1.5 h-1.5 rounded-full bg-[#E7FE55]" />
                                <span className="text-xs text-white font-mono truncate group-hover:text-[#E7FE55] transition-colors">
                                    {vault.hlPublicKey.slice(0, 6)}...{vault.hlPublicKey.slice(-4)}
                                </span>
                                {copiedAddress === vault.hlPublicKey ? (
                                    <span className="text-[10px] text-[#E7FE55] ml-auto">Copied!</span>
                                ) : (
                                    <span className="text-[10px] text-[#747580] ml-auto opacity-0 group-hover:opacity-100 transition-opacity">Click to copy</span>
                                )}
                            </div>
                        ) : (
                            <div className="text-[10px] text-[#747580] italic">Not created</div>
                        )}
                    </div>

                    {/* Hyperliquid Owner Section */}
                    <div className="mt-3 pt-3 border-t border-[#232328]">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] uppercase tracking-[0.05em] font-semibold text-[#747580]">
                                Hyperliquid Owner
                            </span>
                        </div>
                        {vault.hlOwnerPublicKey ? (
                            <div className="flex items-center justify-between">
                                <div
                                    onClick={() => copyToClipboard(vault.hlOwnerPublicKey!)}
                                    className="flex items-center gap-2 cursor-pointer group flex-1"
                                >
                                    <div className="w-1.5 h-1.5 rounded-full bg-[#E7FE55]" />
                                    <span className="text-xs text-white font-mono truncate group-hover:text-[#E7FE55] transition-colors">
                                        {vault.hlOwnerPublicKey.slice(0, 4)}...{vault.hlOwnerPublicKey.slice(-4)}
                                    </span>
                                    {copiedAddress === vault.hlOwnerPublicKey ? (
                                        <span className="text-[10px] text-[#E7FE55] ml-2">Copied!</span>
                                    ) : (
                                        <span className="text-[10px] text-[#747580] ml-2 opacity-0 group-hover:opacity-100 transition-opacity">Click to copy</span>
                                    )}
                                </div>
                                <button
                                    onClick={disconnectHLOwnerWallet}
                                    className="ml-2 px-2 py-1 text-[10px] font-medium text-[#747580] hover:text-[#E7FE55] bg-transparent hover:bg-[#E7FE55]/10 rounded border border-[#232328] hover:border-[#E7FE55]/30 transition-colors flex-shrink-0"
                                >
                                    Disconnect
                                </button>
                            </div>
                        ) : (
                            <div className="flex items-center justify-between">
                                <div className="text-[10px] text-[#747580] italic">Not connected</div>
                                <button
                                    onClick={connectHLOwnerWallet}
                                    className="px-2 py-1 text-[10px] font-medium text-[#E7FE55] hover:text-[#f0ff85] bg-[#E7FE55]/10 hover:bg-[#E7FE55]/20 rounded border border-[#E7FE55]/20 transition-colors flex-shrink-0"
                                >
                                    Connect
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Polymarket Vault */}
                <div className="glass-panel p-6 rounded relative overflow-hidden flex flex-col">
                    <div className="absolute top-0 right-0 p-4 opacity-5">
                        <Globe size={48} className="text-white" />
                    </div>
                    <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-[10px] uppercase tracking-[0.1em] text-[#747580] font-semibold">Polymarket Vault</h3>
                    </div>
                    <div className="text-xl lg:text-2xl font-semibold text-white tracking-tight">{(vault.pmBalance || 0).toFixed(2)} USDC</div>
                    <div className="text-[11px] text-[#E7FE55] mt-1">
                        ≈ ${(vault.pmBalance || 0).toFixed(2)}
                    </div>

                    {/* PM Vault Address Display */}
                    <div className="mt-4 pt-3 border-t border-[#232328]">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] font-semibold uppercase tracking-[0.05em] text-[#747580]">Vault Address</span>
                            <a
                                href="https://polymarket.com"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[10px] text-[#E7FE55] hover:text-[#f0ff85] flex items-center gap-1"
                                title="Polymarket Platform"
                            >
                                <Globe size={10} /> Polymarket
                            </a>
                        </div>
                        {vault.pmPublicKey ? (
                            <div
                                onClick={() => copyToClipboard(vault.pmPublicKey!)}
                                className="flex items-center gap-2 cursor-pointer group"
                            >
                                <div className="w-1.5 h-1.5 rounded-full bg-[#E7FE55]" />
                                <span className="text-xs text-white font-mono truncate group-hover:text-[#E7FE55] transition-colors">
                                    {vault.pmPublicKey.slice(0, 6)}...{vault.pmPublicKey.slice(-4)}
                                </span>
                                {copiedAddress === vault.pmPublicKey ? (
                                    <span className="text-[10px] text-[#E7FE55] ml-auto">Copied!</span>
                                ) : (
                                    <span className="text-[10px] text-[#747580] ml-auto opacity-0 group-hover:opacity-100 transition-opacity">Click to copy</span>
                                )}
                            </div>
                        ) : (
                            <div className="text-[10px] text-[#747580] italic">Not created</div>
                        )}
                    </div>

                    {/* Polymarket Owner Section */}
                    <div className="mt-3 pt-3 border-t border-[#232328]">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] uppercase tracking-[0.05em] font-semibold text-[#747580]">
                                Polymarket Owner
                            </span>
                        </div>
                        {vault.pmOwnerPublicKey ? (
                            <div className="flex items-center justify-between">
                                <div
                                    onClick={() => copyToClipboard(vault.pmOwnerPublicKey!)}
                                    className="flex items-center gap-2 cursor-pointer group flex-1"
                                >
                                    <div className="w-1.5 h-1.5 rounded-full bg-[#E7FE55]" />
                                    <span className="text-xs text-white font-mono truncate group-hover:text-[#E7FE55] transition-colors">
                                        {vault.pmOwnerPublicKey.slice(0, 4)}...{vault.pmOwnerPublicKey.slice(-4)}
                                    </span>
                                    {copiedAddress === vault.pmOwnerPublicKey ? (
                                        <span className="text-[10px] text-[#E7FE55] ml-2">Copied!</span>
                                    ) : (
                                        <span className="text-[10px] text-[#747580] ml-2 opacity-0 group-hover:opacity-100 transition-opacity">Click to copy</span>
                                    )}
                                </div>
                                <button
                                    onClick={disconnectPMOwnerWallet}
                                    className="ml-2 px-2 py-1 text-[10px] font-medium text-[#747580] hover:text-[#E7FE55] bg-transparent hover:bg-[#E7FE55]/10 rounded border border-[#232328] hover:border-[#E7FE55]/30 transition-colors flex-shrink-0"
                                >
                                    Disconnect
                                </button>
                            </div>
                        ) : (
                            <div className="flex items-center justify-between">
                                <div className="text-[10px] text-[#747580] italic">Not connected</div>
                                <button
                                    onClick={connectPMOwnerWallet}
                                    className="px-2 py-1 text-[10px] font-medium text-[#E7FE55] hover:text-[#f0ff85] bg-[#E7FE55]/10 hover:bg-[#E7FE55]/20 rounded border border-[#E7FE55]/20 transition-colors flex-shrink-0"
                                >
                                    Connect
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>



            {/* Main Grid: Charts & Activity */}
            <div className="grid grid-cols-1 2xl:grid-cols-3 gap-6">
                {/* Left Column: Portfolio & Tasks (2/3 width) */}
                <div className="2xl:col-span-2 space-y-6">
                    {/* Portfolio Evolution Chart */}
                    <div className="glass-panel p-6 rounded">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
                            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                                <Activity className="text-[#E7FE55]" size={18} />
                                Portfolio Evolution
                            </h3>
                            <div className="flex gap-2">
                                {(['1D', '1W', '1M', '1Y'] as const).map((period) => {
                                    const isAvailable = availablePeriods[period];
                                    const isSelected = period === selectedPeriod;
                                    return (
                                        <button
                                            key={period}
                                            disabled={!isAvailable}
                                            onClick={() => isAvailable && setSelectedPeriod(period)}
                                            className={`px-3 py-1 rounded text-xs font-medium transition-colors ${!isAvailable
                                                ? 'text-[#3a3a40] cursor-not-allowed'
                                                : isSelected
                                                    ? 'bg-[#E7FE55]/15 text-[#E7FE55] border border-[#E7FE55]/30'
                                                    : 'text-[#747580] hover:text-[#a0a1a8] hover:bg-[#1a1b21]'
                                                }`}
                                        >
                                            {period}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                        <div className="h-[250px] lg:h-[300px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <ComposedChart data={filteredHistory.length > 0 ? filteredHistory : []}>
                                    <defs>
                                        <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#E7FE55" stopOpacity={0.25} />
                                            <stop offset="50%" stopColor="#E7FE55" stopOpacity={0.08} />
                                            <stop offset="95%" stopColor="#E7FE55" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#232328" vertical={false} />
                                    <XAxis
                                        dataKey="date"
                                        stroke="#747580"
                                        tick={{ fill: '#747580', fontSize: 10 }}
                                        tickLine={false}
                                        axisLine={false}
                                    />
                                    <YAxis
                                        stroke="#747580"
                                        tick={{ fill: '#747580', fontSize: 10 }}
                                        tickLine={false}
                                        axisLine={false}
                                        tickFormatter={(value) => `$${value}`}
                                        width={50}
                                    />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: '#14151a', borderColor: '#232328', borderRadius: '4px' }}
                                        itemStyle={{ color: '#e4e5e9' }}
                                        labelStyle={{ color: '#747580' }}
                                        itemSorter={(item: any) => {
                                            const order: Record<string, number> = {
                                                'value': 0,
                                                'solValue': 1,
                                                'hlValue': 2,
                                                'pmValue': 3
                                            };
                                            return order[item.dataKey] ?? 10;
                                        }}
                                        formatter={(value: number, name: string) => [
                                            `$${value.toFixed(2)}`,
                                            name === 'value' ? 'Total Value' :
                                                name === 'solValue' ? 'SOL Value' :
                                                    name === 'hlValue' ? 'HL Value' :
                                                        name === 'pmValue' ? 'PM Value' : name
                                        ]}
                                    />
                                    <Area
                                        type="monotone"
                                        dataKey="value"
                                        stroke="#E7FE55"
                                        strokeWidth={1.5}
                                        fillOpacity={1}
                                        fill="url(#colorValue)"
                                    />
                                    <Line type="monotone" dataKey="solValue" stroke="#9b87f5" strokeWidth={1.5} dot={false} />
                                    <Line type="monotone" dataKey="hlValue" stroke="#34d399" strokeWidth={1.5} dot={false} />
                                    <Line type="monotone" dataKey="pmValue" stroke="#60a5fa" strokeWidth={1.5} dot={false} />
                                </ComposedChart>
                            </ResponsiveContainer>
                        </div>
                        {/* Legend */}
                        <div className="flex items-center justify-center gap-6 mt-4 text-[11px] text-[#747580]">
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-[#E7FE55]" />
                                <span>Total Value</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-[#9b87f5]" />
                                <span>SOL Value</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-[#34d399]" />
                                <span>HL Value</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-[#60a5fa]" />
                                <span>PM Value</span>
                            </div>
                        </div>
                    </div>

                    {/* Open Trading - Active Positions */}
                    <div className="glass-panel p-6 rounded">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                                <TrendingUp className="text-[#E7FE55]" size={18} />
                                Open Trading
                            </h3>
                            <button
                                onClick={() => setActiveTab(AppTab.HYPERLIQUID)}
                                className="text-[10px] px-3 py-1.5 rounded uppercase tracking-wider font-medium transition-colors flex items-center gap-2 text-[#747580] hover:text-[#E7FE55] bg-transparent hover:bg-[#E7FE55]/10 border border-[#232328] hover:border-[#E7FE55]/30"
                            >
                                <TrendingUp size={12} />
                                Details
                            </button>
                        </div>

                        {!vault.hlPositions || vault.hlPositions.length === 0 ? (
                            <div className="text-center py-8 text-[#747580] text-sm bg-[#14151a] rounded border border-[#232328]">
                                No open positions. Start trading to see your portfolio grow!
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="text-[10px] uppercase tracking-[0.05em] text-[#747580] border-b border-[#232328]">
                                            <th className="py-3 pl-4 font-medium">Symbol</th>
                                            <th className="py-3 font-medium">Size</th>
                                            <th className="py-3 font-medium">Entry Price</th>
                                            <th className="py-3 font-medium">Mark Price</th>
                                            <th className="py-3 font-medium">Liq. Price</th>
                                            <th className="py-3 font-medium">Leverage</th>
                                            <th className="py-3 pr-4 font-medium text-right">Unrealized PnL</th>
                                        </tr>
                                    </thead>
                                    <tbody className="text-sm">
                                        {vault.hlPositions.map((pos, idx) => {
                                            const size = parseFloat(pos.position.szi);
                                            const entryPrice = parseFloat(pos.position.entryPx);
                                            const markPrice = assetPrices[pos.position.coin] || entryPrice; // Fallback
                                            const pnl = parseFloat(pos.position.unrealizedPnl);
                                            const leverage = pos.position.leverage.value;
                                            const isLong = size > 0;

                                            // Rough estimation of Liq Price if not provided
                                            // Long: Entry * (1 - 1/Lev) | Short: Entry * (1 + 1/Lev)
                                            // This is an approximation, real liq price depends on margin fraction & maintenance margin
                                            const liqPrice = isLong
                                                ? entryPrice * (1 - (0.9 / leverage)) // 0.9 safety buffer assumption
                                                : entryPrice * (1 + (0.9 / leverage));

                                            return (
                                                <tr key={idx} className="border-b border-[#232328]/50 last:border-0 hover:bg-[#1a1b21] transition-colors">
                                                    <td className="py-3 pl-4">
                                                        <div className="flex items-center gap-2">
                                                            <div className={`w-1 h-6 rounded-full ${isLong ? 'bg-[#34d399]' : 'bg-red-500'}`} />
                                                            <span className="font-semibold text-white">{pos.position.coin}</span>
                                                            <span className={`text-[9px] px-1.5 py-0.5 rounded uppercase tracking-wider ${isLong ? 'bg-[#34d399]/15 text-[#34d399]' : 'bg-red-500/15 text-red-400'}`}>
                                                                {isLong ? 'LONG' : 'SHORT'}
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td className="py-3 text-[#a0a1a8]">
                                                        {Math.abs(size).toFixed(4)}
                                                    </td>
                                                    <td className="py-3 text-[#a0a1a8]">
                                                        ${entryPrice.toFixed(4)}
                                                    </td>
                                                    <td className="py-3 text-[#a0a1a8]">
                                                        ${markPrice.toFixed(4)}
                                                    </td>
                                                    <td className="py-3 text-orange-400/80">
                                                        ${liqPrice.toFixed(4)}
                                                    </td>
                                                    <td className="py-3 text-[#747580]">
                                                        {leverage}x
                                                    </td>
                                                    <td className={`py-3 pr-4 text-right font-medium ${pnl >= 0 ? 'text-[#34d399]' : 'text-red-400'}`}>
                                                        {pnl >= 0 ? '+' : ''}{pnl.toFixed(2)} USDC
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    {/* Agent Tasks Summary */}
                    <div className="glass-panel p-6 rounded flex flex-col">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                                <Clock className="text-[#E7FE55]" size={18} />
                                Open Tasks
                            </h3>
                            <span className="text-[10px] bg-[#1a1b21] text-[#747580] px-2 py-1 rounded uppercase tracking-wider">
                                {scheduledTasks.filter(t => t.status === 'active').length} Active
                            </span>
                            <button
                                onClick={() => setActiveTab(AppTab.SCHEDULER)}
                                className="text-[10px] px-3 py-1.5 rounded uppercase tracking-wider font-medium transition-colors flex items-center gap-2 text-[#747580] hover:text-[#E7FE55] bg-transparent hover:bg-[#E7FE55]/10 border border-[#232328] hover:border-[#E7FE55]/30"
                            >
                                <Clock size={12} />
                                Details
                            </button>
                        </div>
                        <div className="flex-1 flex flex-col">
                            {scheduledTasks.filter(t => t.status === 'active').length === 0 ? (
                                <div className="text-center py-8 text-[#747580] text-sm my-auto bg-[#14151a] rounded border border-[#232328]">
                                    No active tasks scheduled. Ask the AI to schedule a swap or transfer.
                                </div>
                            ) : (
                                <>
                                    <div className="space-y-3">
                                        {scheduledTasks
                                            .filter(t => t.status === 'active')
                                            .slice(tasksPage * TASKS_PAGE_SIZE, (tasksPage + 1) * TASKS_PAGE_SIZE)
                                            .map(task => (
                                                <div key={task.id} className="bg-[#14151a] p-4 rounded border border-[#232328] flex items-center justify-between">
                                                    <div className="flex items-center gap-3">
                                                        <div className={`w-1.5 h-1.5 rounded-full bg-[#E7FE55]`} />
                                                        <div>
                                                            <div className="text-sm font-medium text-white flex items-center gap-2">
                                                                {task.type}
                                                                {task.type === 'HL_ORDER' && <NetworkBadge network="hyperliquid" />}
                                                                {task.condition && <span className="text-[10px] text-yellow-500">(Condition)</span>}
                                                            </div>
                                                            <div className="text-[11px] text-[#747580]">
                                                                {task.condition
                                                                    ? `${task.condition.indicator.toUpperCase()} ${task.condition.operator} ${task.condition.value} (${task.condition.symbol})`
                                                                    : `Executes in ${Math.max(0, Math.round(((task.executeAt || 0) - Date.now()) / 60000))} mins`
                                                                }
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="text-[10px] font-mono text-[#747580]">
                                                        ID: {task.id.slice(-4)}
                                                    </div>
                                                </div>
                                            ))}
                                    </div>

                                    {/* Tasks Pagination */}
                                    <div className="mt-auto">
                                        {scheduledTasks.filter(t => t.status === 'active').length > TASKS_PAGE_SIZE && (
                                            <div className="flex items-center justify-between mt-4 pt-2 border-t border-[#232328]">
                                                <button
                                                    onClick={() => setTasksPage(Math.max(0, tasksPage - 1))}
                                                    disabled={tasksPage === 0}
                                                    className={`p-1 rounded hover:bg-[#1a1b21] transition-colors ${tasksPage === 0 ? 'text-[#3a3b42] cursor-not-allowed' : 'text-[#747580]'}`}
                                                >
                                                    <ChevronLeft size={16} />
                                                </button>
                                                <span className="text-[10px] text-[#747580]">
                                                    Page {tasksPage + 1} of {Math.ceil(scheduledTasks.filter(t => t.status === 'active').length / TASKS_PAGE_SIZE)}
                                                </span>
                                                <button
                                                    onClick={() => setTasksPage(Math.min(Math.ceil(scheduledTasks.filter(t => t.status === 'active').length / TASKS_PAGE_SIZE) - 1, tasksPage + 1))}
                                                    disabled={tasksPage >= Math.ceil(scheduledTasks.filter(t => t.status === 'active').length / TASKS_PAGE_SIZE) - 1}
                                                    className={`p-1 rounded hover:bg-[#1a1b21] transition-colors ${tasksPage >= Math.ceil(scheduledTasks.filter(t => t.status === 'active').length / TASKS_PAGE_SIZE) - 1 ? 'text-[#3a3b42] cursor-not-allowed' : 'text-[#747580]'}`}
                                                >
                                                    <ChevronRight size={16} />
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                {/* Right Column: Asset Allocation & Activity (1/3 width) */}
                <div className="space-y-6 flex flex-col">
                    {/* Asset Allocation Chart */}
                    <div className="glass-panel p-6 rounded flex flex-col">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-sm font-semibold text-white">Asset Allocation</h3>
                            <div className="flex gap-1 bg-[#1a1b21] p-1 rounded border border-[#232328]">
                                <button
                                    onClick={() => setAllocationChartType('bar')}
                                    className={`p-1.5 rounded transition-colors ${allocationChartType === 'bar'
                                        ? 'bg-[#232328] text-[#E7FE55]'
                                        : 'text-[#747580] hover:text-[#a0a1a8]'
                                        }`}
                                    title="Bar View"
                                >
                                    <BarChartHorizontal size={14} />
                                </button>
                                <button
                                    onClick={() => setAllocationChartType('pie')}
                                    className={`p-1.5 rounded transition-colors ${allocationChartType === 'pie'
                                        ? 'bg-[#232328] text-[#E7FE55]'
                                        : 'text-[#747580] hover:text-[#a0a1a8]'
                                        }`}
                                    title="Pie View"
                                >
                                    <PieChartIcon size={14} />
                                </button>
                            </div>
                        </div>
                        <div className="h-[180px] w-full relative flex-shrink-0">
                            <ResponsiveContainer width="100%" height="100%">
                                {allocationChartType === 'pie' ? (
                                    <PieChart>
                                        <Pie
                                            data={assetAllocationData.data}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={45}
                                            outerRadius={pieActiveIndex !== undefined ? 65 : 70}
                                            paddingAngle={3}
                                            dataKey="value"
                                            onMouseEnter={(_, index) => setPieActiveIndex(index)}
                                            onMouseLeave={() => setPieActiveIndex(undefined)}
                                            animationBegin={0}
                                            animationDuration={800}
                                            animationEasing="ease-out"
                                        >
                                            {assetAllocationData.data.map((entry, index) => (
                                                <Cell
                                                    key={`cell-${index}`}
                                                    fill={entry.color}
                                                    stroke={pieActiveIndex === index ? entry.color : 'transparent'}
                                                    strokeWidth={pieActiveIndex === index ? 3 : 0}
                                                    style={{
                                                        cursor: 'pointer',
                                                        transition: 'all 0.2s ease-out',
                                                        filter: pieActiveIndex === index
                                                            ? `brightness(1.2) drop-shadow(0 0 8px ${entry.color})`
                                                            : 'brightness(1)',
                                                        transform: pieActiveIndex === index ? 'scale(1.05)' : 'scale(1)',
                                                        transformOrigin: 'center'
                                                    }}
                                                />
                                            ))}
                                        </Pie>
                                        {/* Center text when hovering */}
                                        {pieActiveIndex !== undefined && assetAllocationData.data[pieActiveIndex] && (
                                            <g>
                                                <text x="50%" y="42%" textAnchor="middle" fill="#fff" fontSize={12} fontWeight="bold">
                                                    {assetAllocationData.data[pieActiveIndex].symbol}
                                                </text>
                                                <text
                                                    x="50%"
                                                    y="54%"
                                                    textAnchor="middle"
                                                    fill={assetAllocationData.data[pieActiveIndex].color}
                                                    fontSize={15}
                                                    fontWeight="bold"
                                                    fontFamily="monospace"
                                                >
                                                    ${assetAllocationData.data[pieActiveIndex].value.toFixed(2)}
                                                </text>
                                                <text x="50%" y="65%" textAnchor="middle" fill="#747580" fontSize={10}>
                                                    {((assetAllocationData.data[pieActiveIndex].value / (assetAllocationData.totalValue || 1)) * 100).toFixed(1)}%
                                                </text>
                                            </g>
                                        )}
                                        {/* Default center text */}
                                        {pieActiveIndex === undefined && (
                                            <g>
                                                <text x="50%" y="46%" textAnchor="middle" fill="#747580" fontSize={10} style={{ textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                                                    Total
                                                </text>
                                                <text x="50%" y="58%" textAnchor="middle" fill="#fff" fontSize={18} fontWeight="600">
                                                    ${assetAllocationData.totalValue.toFixed(0)}
                                                </text>
                                            </g>
                                        )}
                                    </PieChart>
                                ) : (
                                    <BarChart
                                        data={[
                                            assetAllocationData.data.reduce((acc, item) => ({ ...acc, [item.symbol]: item.value }), { name: 'Total' })
                                        ]}
                                        layout="vertical"
                                        margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                                    >
                                        <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={true} stroke="#232328" />
                                        <XAxis
                                            type="number"
                                            tickFormatter={(value) => `$${value}`}
                                            tick={{ fill: '#747580', fontSize: 10 }}
                                            tickLine={false}
                                            axisLine={false}
                                        />
                                        <YAxis
                                            type="category"
                                            dataKey="name"
                                            hide
                                        />
                                        <Tooltip
                                            cursor={{ fill: 'transparent' }}
                                            content={({ active, payload }) => {
                                                if (!active || !payload || !payload.length || !hoveredAsset) return null;
                                                const data = payload.find(p => p.dataKey === hoveredAsset);
                                                if (!data) return null;
                                                return (
                                                    <div className="bg-[#14151a] border border-[#232328] p-2 rounded shadow-lg">
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: data.color }} />
                                                            <span className="text-[#a0a1a8] font-semibold text-[11px]">{data.name}</span>
                                                        </div>
                                                        <p className="text-white font-mono text-sm">
                                                            ${Number(data.value).toFixed(2)}
                                                        </p>
                                                    </div>
                                                );
                                            }}
                                        />
                                        {assetAllocationData.data.map((entry, index) => (
                                            <Bar
                                                key={entry.symbol}
                                                dataKey={entry.symbol}
                                                stackId="a"
                                                fill={entry.color}
                                                onMouseEnter={() => setHoveredAsset(entry.symbol)}
                                                onMouseLeave={() => setHoveredAsset(null)}
                                                radius={
                                                    index === 0 && assetAllocationData.data.length === 1 ? [4, 4, 4, 4] :
                                                        index === 0 ? [4, 0, 0, 4] :
                                                            index === assetAllocationData.data.length - 1 ? [0, 4, 4, 0] :
                                                                [0, 0, 0, 0]
                                                }
                                                barSize={40}
                                            />
                                        ))}
                                    </BarChart>
                                )}
                            </ResponsiveContainer>
                        </div>

                        {/* Custom Legend - Interactive */}
                        <div className="mt-4 space-y-1 flex-1 overflow-y-auto pr-2 custom-scrollbar">
                            {assetAllocationData.data.map((entry, index) => (
                                <div
                                    key={index}
                                    className={`flex items-center justify-between text-sm p-2 rounded-lg transition-all cursor-pointer ${pieActiveIndex === index
                                        ? 'bg-[#232328]'
                                        : 'hover:bg-[#1a1b21]'
                                        }`}
                                    onMouseEnter={() => setPieActiveIndex(index)}
                                    onMouseLeave={() => setPieActiveIndex(undefined)}
                                >
                                    <div className="flex items-center gap-2">
                                        <div
                                            className="w-3 h-3 rounded-full flex-shrink-0 transition-transform"
                                            style={{
                                                backgroundColor: entry.color,
                                                transform: pieActiveIndex === index ? 'scale(1.3)' : 'scale(1)',
                                                boxShadow: pieActiveIndex === index ? `0 0 8px ${entry.color}` : 'none'
                                            }}
                                        />
                                        <span className={`truncate max-w-[80px] sm:max-w-[100px] text-xs transition-colors ${pieActiveIndex === index ? 'text-white' : 'text-[#a0a1a8]'
                                            }`}>
                                            {entry.symbol}
                                        </span>
                                        {entry.network && (
                                            <span className={`text-[9px] px-1 rounded uppercase tracking-wider ${entry.network === 'solana' ? 'bg-[#9b87f5]/15 text-[#9b87f5]' :
                                                entry.network === 'hyperliquid' ? 'bg-[#34d399]/15 text-[#34d399]' :
                                                    'bg-[#60a5fa]/15 text-[#60a5fa]'
                                                }`}>
                                                {entry.network === 'solana' ? 'SOL' : entry.network === 'hyperliquid' ? 'HL' : 'PM'}
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className={`text-xs font-mono transition-colors ${pieActiveIndex === index ? 'text-white' : 'text-[#747580]'
                                            }`}>
                                            ${entry.value.toFixed(2)}
                                        </span>
                                        <span
                                            className="text-xs font-mono font-semibold"
                                            style={{ color: entry.color }}
                                        >
                                            {((entry.value / (assetAllocationData.totalValue || 1)) * 100).toFixed(1)}%
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Recent Activity Feed - NETWORK COLORS */}
                    <div className="glass-panel p-6 rounded flex flex-col">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-sm font-semibold text-white">Recent Activity</h3>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => { setActivityFilter(activityFilter === 'solana' ? 'all' : 'solana'); setActivityPage(0); }}
                                    className={`text-[9px] px-2 py-1 rounded uppercase tracking-wider font-medium transition-colors ${activityFilter === 'solana' ? 'bg-[#9b87f5] text-white' : 'bg-[#9b87f5]/15 text-[#9b87f5] hover:bg-[#9b87f5]/25'}`}
                                >
                                    SOL
                                </button>
                                <button
                                    onClick={() => { setActivityFilter(activityFilter === 'hyperliquid' ? 'all' : 'hyperliquid'); setActivityPage(0); }}
                                    className={`text-[9px] px-2 py-1 rounded uppercase tracking-wider font-medium transition-colors ${activityFilter === 'hyperliquid' ? 'bg-[#34d399] text-[#0f1015]' : 'bg-[#34d399]/15 text-[#34d399] hover:bg-[#34d399]/25'}`}
                                >
                                    HL
                                </button>
                            </div>
                        </div>
                        <div className="flex-1 flex flex-col">
                            {activityFeed
                                .filter(item => activityFilter === 'all' || item.network === activityFilter)
                                .length === 0 ? (
                                <div className="text-center text-[#747580] text-sm py-4 my-auto bg-[#14151a] rounded border border-[#232328]">No recent activity</div>
                            ) : (
                                <>
                                    <div className="space-y-3">
                                        {activityFeed
                                            .filter(item => activityFilter === 'all' || item.network === activityFilter)
                                            .slice(activityPage * ACTIVITY_PAGE_SIZE, (activityPage + 1) * ACTIVITY_PAGE_SIZE)
                                            .map((item, i) => (
                                                <div key={i} className="flex items-start gap-3 pb-3 border-b border-[#232328] last:border-0">
                                                    <div className={`mt-1 p-1.5 rounded-full ${item.status === 'failed'
                                                        ? 'bg-red-500/15 text-red-400'
                                                        : item.network === 'solana'
                                                            ? 'bg-[#9b87f5]/15 text-[#9b87f5]'
                                                            : 'bg-[#34d399]/15 text-[#34d399]'
                                                        }`}>
                                                        {item.status === 'failed' ? <ArrowDownLeft size={14} /> : <ArrowUpRight size={14} />}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex justify-between items-start gap-2">
                                                            <div className="flex items-center gap-2">
                                                                <span className={`text-sm font-medium ${item.status === 'failed'
                                                                    ? 'text-red-400'
                                                                    : item.network === 'solana'
                                                                        ? 'text-[#9b87f5]'
                                                                        : 'text-[#34d399]'
                                                                    }`}>
                                                                    {item.type}
                                                                </span>
                                                                <NetworkBadge network={item.network} />
                                                            </div>
                                                            <span className="text-[10px] text-[#747580] flex-shrink-0">{item.time}</span>
                                                        </div>
                                                        <div className="text-[11px] text-[#747580] truncate mt-0.5">
                                                            {item.desc}
                                                        </div>
                                                        {item.signature && getExplorerUrl(item) && (
                                                            <a
                                                                href={getExplorerUrl(item)!}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className={`text-[10px] ${item.network === 'solana' ? 'text-[#9b87f5] hover:text-[#a78bfa]' : 'text-[#34d399] hover:text-[#4ade80]'} flex items-center gap-1 mt-1`}
                                                            >
                                                                {item.network === 'solana' ? 'View on Solscan Explorer' : 'View on HL Explorer'} <ExternalLink size={10} />
                                                            </a>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                    </div>

                                    {/* Activity Pagination */}
                                    <div className="mt-auto">
                                        {activityFeed.filter(item => activityFilter === 'all' || item.network === activityFilter).length > ACTIVITY_PAGE_SIZE && (
                                            <div className="flex items-center justify-between mt-4 pt-2 border-t border-[#232328]">
                                                <button
                                                    onClick={() => setActivityPage(Math.max(0, activityPage - 1))}
                                                    disabled={activityPage === 0}
                                                    className={`p-1 rounded hover:bg-[#1a1b21] transition-colors ${activityPage === 0 ? 'text-[#3a3b42] cursor-not-allowed' : 'text-[#747580]'}`}
                                                >
                                                    <ChevronLeft size={16} />
                                                </button>
                                                <span className="text-[10px] text-[#747580]">
                                                    Page {activityPage + 1} of {Math.ceil(activityFeed.filter(item => activityFilter === 'all' || item.network === activityFilter).length / ACTIVITY_PAGE_SIZE)}
                                                </span>
                                                <button
                                                    onClick={() => setActivityPage(Math.min(Math.ceil(activityFeed.filter(item => activityFilter === 'all' || item.network === activityFilter).length / ACTIVITY_PAGE_SIZE) - 1, activityPage + 1))}
                                                    disabled={activityPage >= Math.ceil(activityFeed.filter(item => activityFilter === 'all' || item.network === activityFilter).length / ACTIVITY_PAGE_SIZE) - 1}
                                                    className={`p-1 rounded hover:bg-[#1a1b21] transition-colors ${activityPage >= Math.ceil(activityFeed.filter(item => activityFilter === 'all' || item.network === activityFilter).length / ACTIVITY_PAGE_SIZE) - 1 ? 'text-[#3a3b42] cursor-not-allowed' : 'text-[#747580]'}`}
                                                >
                                                    <ChevronRight size={16} />
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>


        </div>
    );
};
