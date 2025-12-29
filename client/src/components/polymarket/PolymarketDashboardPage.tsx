// src/components/polymarket/PolymarketDashboardPage.tsx
// Main dashboard for Polymarket Dealer - follows DealerDashboardPage.tsx pattern

import React, { useEffect, useState, useMemo } from 'react';
import {
    TrendingUp, Activity, DollarSign, Clock, BarChart2,
    PieChart, ShieldCheck, Target, Wallet, Brain,
    ChevronLeft, ChevronRight, Layers
} from 'lucide-react';

import { PolymarketState, PolymarketLog } from '../../state/polymarketStore';
import { useCycleSummary } from '../../hooks/useCycleSummary';
import { polymarketService } from '../../services/polymarketService';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer
} from 'recharts';
import { AppTab } from '../../types';

interface PolymarketDashboardPageProps {
    status: PolymarketState;
    onToggle: (isOn: boolean) => void;
    vaultAddress: string | null;
    setActiveTab: (tab: AppTab) => void;
}

// Helper to extract market from log message
const extractMarketFromMessage = (message: string): string | null => {
    const match = message.match(/Market:\s*(.+?)(?:\s*\||$)/);
    return match ? match[1].slice(0, 30) : null;
};

export const PolymarketDashboardPage: React.FC<PolymarketDashboardPageProps> = ({
    status,
    onToggle,
    vaultAddress,
    setActiveTab
}) => {
    const [balance, setBalance] = useState(0);
    const [pnlHistory, setPnlHistory] = useState<any[]>([]);
    const [stats, setStats] = useState({
        totalPnl: 0,
        winRate: 0,
        totalVolume: 0,
        tradesWithPnl: 0
    });

    // AI Summary toggle state
    const [showSummary, setShowSummary] = useState(false);
    const { summary: cycleSummary, isGenerating: isSummaryGenerating, cycleCount, lastUpdate: summaryLastUpdate, hasSummary } = useCycleSummary('polymarket');

    // Reasoning navigation state
    const [reasoningIndex, setReasoningIndex] = useState(0);

    // Extract reasoning logs from status logs
    const reasoningLogs = useMemo(() => {
        return status.logs
            .filter(log => log.type === 'REASONING' || log.type === 'SIGNAL')
            .slice(0, 20);
    }, [status.logs]);

    // Group reasoning by market
    const marketReasonings = useMemo(() => {
        const marketMap = new Map<string, PolymarketLog>();

        for (const log of reasoningLogs) {
            const market = extractMarketFromMessage(log.message) || log.details?.context?.question?.slice(0, 30);
            if (market && !marketMap.has(market)) {
                marketMap.set(market, log);
            }
        }

        return Array.from(marketMap.entries())
            .sort((a, b) => b[1].timestamp - a[1].timestamp)
            .map(([market, log]) => ({ market, log }));
    }, [reasoningLogs]);

    // Reset index when new analysis comes in
    useEffect(() => {
        if (marketReasonings.length > 0 && !status.isAnalyzing) {
            setReasoningIndex(0);
        }
    }, [marketReasonings.length, status.isAnalyzing]);

    // Current reasoning to display
    const currentReasoning = marketReasonings[reasoningIndex];

    // Calculate stats from operation history
    useEffect(() => {
        if (status.operationHistory.length > 0) {
            let totalPnl = 0;
            let wins = 0;
            let losses = 0;
            let volume = 0;

            const chartData: any[] = [];
            let cumulativePnl = 0;

            status.operationHistory
                .slice()
                .reverse()
                .forEach(op => {
                    const pnl = op.pnl || 0;
                    cumulativePnl += pnl;
                    totalPnl += pnl;
                    volume += op.sizeUSDC;

                    if (pnl > 0) wins++;
                    else if (pnl < 0) losses++;

                    chartData.push({
                        time: op.timestamp,
                        date: new Date(op.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                        pnl: cumulativePnl
                    });
                });

            const totalTrades = wins + losses;
            setStats({
                totalPnl,
                winRate: totalTrades > 0 ? (wins / totalTrades) * 100 : 0,
                totalVolume: volume,
                tradesWithPnl: totalTrades
            });
            setPnlHistory(chartData);
        }
    }, [status.operationHistory]);

    // Fetch balance
    useEffect(() => {
        if (!vaultAddress) return;

        const fetchBalance = async () => {
            try {
                const bal = await polymarketService.getBalance();
                setBalance(bal);
            } catch (e) {
                console.error('Failed to fetch Polymarket balance', e);
            }
        };

        fetchBalance();
        const interval = setInterval(fetchBalance, 60000);
        return () => clearInterval(interval);
    }, [vaultAddress]);

    const handleToggle = () => {
        if (!vaultAddress) return;
        onToggle(!status.isOn);
    };

    const unrealizedPnl = useMemo(() => {
        return status.activePositions.reduce((sum, pos) => sum + pos.unrealizedPnl, 0);
    }, [status.activePositions]);

    // Reasoning navigation handlers
    const handlePrevReasoning = () => {
        setReasoningIndex(prev => Math.min(marketReasonings.length - 1, prev + 1));
    };

    const handleNextReasoning = () => {
        setReasoningIndex(prev => Math.max(0, prev - 1));
    };

    // ============================================
    // NO VAULT STATE
    // ============================================
    if (!vaultAddress) {
        return (
            <div className="flex flex-col h-full items-center justify-center">
                <div className="max-w-md w-full mx-auto space-y-6 p-8 text-center">
                    <div className="w-16 h-16 bg-[#1a1b21] rounded-full flex items-center justify-center mx-auto mb-4 border border-[#232328]">
                        <Wallet size={32} className="text-[#E7FE55]" />
                    </div>
                    <h2 className="text-xl font-semibold text-white tracking-tight">Polymarket Vault Required</h2>
                    <p className="text-[#747580] text-sm">
                        To use the Polymarket Dealer, you need to create a <span className="text-[#E7FE55]">Polymarket Vault</span> first.
                    </p>
                    <button
                        onClick={() => setActiveTab(AppTab.VAULT)}
                        className="mt-4 px-6 py-3 bg-[#E7FE55] hover:bg-[#d4eb4d] text-black font-bold rounded-xl transition-all"
                    >
                        Go to Vault Operator
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full gap-4 overflow-y-auto custom-scrollbar pb-4">

            {/* Main Layout: Stats + Charts with Live Analysis on the right */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 shrink-0">

                {/* Left Column: Stats + Performance Curve (2/3 width) */}
                <div className="lg:col-span-2 flex flex-col gap-4">

                    {/* Top Row: Status + KPIs */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

                        {/* Status Card */}
                        <div className="glass-panel p-4 rounded flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                {/* Status Badge */}
                                <div className={`px-3 py-1.5 rounded border flex items-center gap-2 transition-all ${status.isOn
                                    ? 'bg-[#E7FE55]/10 border-[#E7FE55]/30'
                                    : 'bg-[#1a1b21] border-[#232328]'
                                    }`}>
                                    <span className="relative flex h-2 w-2">
                                        {status.isOn && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#E7FE55] opacity-75"></span>}
                                        <span className={`relative inline-flex rounded-full h-2 w-2 ${status.isOn ? 'bg-[#E7FE55]' : 'bg-red-500'}`}></span>
                                    </span>
                                    <span className={`font-semibold tracking-wider text-[10px] uppercase ${status.isOn ? 'text-[#E7FE55]' : 'text-[#747580]'}`}>
                                        {status.isOn ? 'ACTIVE' : 'OFFLINE'}
                                    </span>
                                </div>

                                {/* Toggle Switch */}
                                <div className="flex items-center gap-2">
                                    <span className="text-[9px] font-medium text-[#747580] uppercase tracking-[0.1em]">Master</span>
                                    <button
                                        onClick={handleToggle}
                                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-all focus:outline-none ${status.isOn ? 'bg-[#E7FE55]' : 'bg-[#232328] hover:bg-[#2a2b30]'}`}
                                    >
                                        <span className={`${status.isOn ? 'translate-x-5' : 'translate-x-1'} inline-block h-3 w-3 transform rounded-full bg-black transition-transform`} />
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Total Profit Card */}
                        <div className="glass-panel p-4 rounded">
                            <div className="text-[10px] text-[#747580] uppercase tracking-[0.1em] mb-1">Total Profit</div>
                            <div className={`text-xl font-semibold font-mono tracking-tight ${stats.totalPnl >= 0 ? 'text-[#34d399]' : 'text-red-400'}`}>
                                {stats.totalPnl >= 0 ? '+' : ''}{stats.totalPnl.toFixed(2)} USD
                            </div>
                        </div>

                        {/* Unrealized PnL Card */}
                        <div className="glass-panel p-4 rounded">
                            <div className="text-[10px] text-[#747580] uppercase tracking-[0.1em] mb-1">Unrealized PnL</div>
                            <div className={`text-xl font-semibold font-mono tracking-tight ${unrealizedPnl >= 0 ? 'text-[#34d399]' : 'text-red-400'}`}>
                                {unrealizedPnl >= 0 ? '+' : ''}{unrealizedPnl.toFixed(2)} USD
                            </div>
                        </div>

                        {/* Win Rate Card */}
                        <div className="glass-panel p-4 rounded">
                            <div className="text-[10px] text-[#747580] uppercase tracking-[0.1em] mb-1">Win Rate</div>
                            <div className="text-xl font-semibold text-white font-mono tracking-tight">{stats.winRate.toFixed(1)}%</div>
                        </div>
                    </div>

                    {/* Configuration Metrics Row */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="glass-panel p-4 rounded flex items-center justify-between">
                            <div className="flex flex-col">
                                <span className="text-[9px] text-[#747580] uppercase tracking-[0.1em] mb-1">Exposure</span>
                                <span className="text-white font-mono text-sm font-semibold">${status.currentExposure.toLocaleString()}</span>
                            </div>
                            <ShieldCheck className="h-4 w-4 text-[#747580]" />
                        </div>
                        <div className="glass-panel p-4 rounded flex items-center justify-between">
                            <div className="flex flex-col">
                                <span className="text-[9px] text-[#747580] uppercase tracking-[0.1em] mb-1">Categories</span>
                                <span className="text-white font-mono text-sm font-semibold">{status.settings.allowedCategories.length}</span>
                            </div>
                            <PieChart className="h-4 w-4 text-[#747580]" />
                        </div>
                        <div className="glass-panel p-4 rounded flex items-center justify-between">
                            <div className="flex flex-col">
                                <span className="text-[9px] text-[#747580] uppercase tracking-[0.1em] mb-1">Interval</span>
                                <span className="text-white font-mono text-sm font-semibold">{status.settings.checkIntervalSeconds}s</span>
                            </div>
                            <Clock className="h-4 w-4 text-[#747580]" />
                        </div>
                        <div className="glass-panel p-4 rounded flex items-center justify-between">
                            <div className="flex flex-col">
                                <span className="text-[9px] text-[#747580] uppercase tracking-[0.1em] mb-1">Max Position</span>
                                <span className="text-white font-mono text-sm font-semibold">${status.settings.maxPositionSizeUSDC}</span>
                            </div>
                            <DollarSign className="h-4 w-4 text-[#747580]" />
                        </div>
                    </div>

                    {/* Performance Curve Card */}
                    <div className="glass-panel p-5 rounded min-h-[220px] flex flex-col flex-1">
                        <div className="flex items-center gap-2 mb-4">
                            <TrendingUp className="h-4 w-4 text-[#E7FE55]" />
                            <span className="text-sm font-semibold text-white">Performance Curve</span>
                        </div>
                        <div className="flex-1 w-full">
                            {pnlHistory.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%" minWidth={100} minHeight={100}>
                                    <AreaChart data={pnlHistory}>
                                        <defs>
                                            <linearGradient id="colorPnlPoly" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#E7FE55" stopOpacity={0.2} />
                                                <stop offset="95%" stopColor="#E7FE55" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#232328" vertical={false} />
                                        <XAxis dataKey="date" stroke="#747580" fontSize={10} tickLine={false} axisLine={false} />
                                        <YAxis stroke="#747580" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(val) => `$${val}`} />
                                        <RechartsTooltip
                                            contentStyle={{ backgroundColor: '#14151a', borderColor: '#232328', borderRadius: '4px' }}
                                            itemStyle={{ color: '#E7FE55' }}
                                            formatter={(value: number) => [`$${value.toFixed(2)}`, 'Net PnL']}
                                        />
                                        <Area type="monotone" dataKey="pnl" stroke="#E7FE55" strokeWidth={1.5} fillOpacity={1} fill="url(#colorPnlPoly)" />
                                    </AreaChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center text-[#747580]">
                                    <BarChart2 className="h-8 w-8 mb-2 opacity-40" />
                                    <span className="text-[11px]">No performance data yet</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Right Column: Live Analysis (1/3 width, spans full height) */}
                <div className="glass-panel p-5 rounded flex flex-col">
                    {/* Header with toggle */}
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                            <Brain className={`h-4 w-4 shrink-0 ${status.isAnalyzing ? 'text-[#E7FE55] animate-pulse' : 'text-[#E7FE55]/60'}`} />

                            {/* Toggle Pills */}
                            <div className="flex items-center bg-[#0f1015] rounded-full p-0.5 border border-[#232328]">
                                <button
                                    onClick={() => setShowSummary(false)}
                                    className={`px-2 py-0.5 rounded-full text-[9px] font-semibold uppercase tracking-wider transition-all ${!showSummary
                                            ? 'bg-[#E7FE55] text-black'
                                            : 'text-[#747580] hover:text-white'
                                        }`}
                                >
                                    Live
                                </button>
                                <button
                                    onClick={() => hasSummary && setShowSummary(true)}
                                    disabled={!hasSummary}
                                    className={`px-2 py-0.5 rounded-full text-[9px] font-semibold uppercase tracking-wider transition-all ${showSummary
                                            ? 'bg-[#E7FE55] text-black'
                                            : hasSummary
                                                ? 'text-[#747580] hover:text-white'
                                                : 'text-[#3a3b42] cursor-not-allowed'
                                        }`}
                                    title={hasSummary ? 'View AI Summary' : `Available after ${2 - cycleCount} more cycles`}
                                >
                                    Summary
                                </button>
                            </div>

                            {status.isAnalyzing && !showSummary && (
                                <span className="px-2 py-0.5 rounded bg-[#E7FE55]/15 text-[#E7FE55] text-[9px] font-semibold uppercase tracking-wider animate-pulse">
                                    LIVE
                                </span>
                            )}
                        </div>

                        {/* Navigation arrows - only show when NOT analyzing, has reasoning, and not showing summary */}
                        {!status.isAnalyzing && marketReasonings.length > 0 && !showSummary && (
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={handlePrevReasoning}
                                    disabled={reasoningIndex >= marketReasonings.length - 1}
                                    className={`p-1 rounded transition-colors ${reasoningIndex >= marketReasonings.length - 1
                                        ? 'text-[#3a3b42] cursor-not-allowed'
                                        : 'text-[#747580] hover:text-white hover:bg-[#1a1b21]'
                                        }`}
                                    title="Previous market"
                                >
                                    <ChevronLeft size={16} />
                                </button>
                                <span className="text-[10px] text-[#747580] font-mono min-w-[32px] text-center">
                                    {reasoningIndex + 1}/{marketReasonings.length}
                                </span>
                                <button
                                    onClick={handleNextReasoning}
                                    disabled={reasoningIndex <= 0}
                                    className={`p-1 rounded transition-colors ${reasoningIndex <= 0
                                        ? 'text-[#3a3b42] cursor-not-allowed'
                                        : 'text-[#747580] hover:text-white hover:bg-[#1a1b21]'
                                        }`}
                                    title="Next market"
                                >
                                    <ChevronRight size={16} />
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Content: Show summary, live activity, or reasoning based on state */}
                    {showSummary ? (
                        <>
                            {/* AI Summary Mode */}
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                    <span className="px-2 py-0.5 rounded bg-[#E7FE55]/15 text-[#E7FE55] text-[9px] font-semibold uppercase tracking-wider">
                                        {cycleCount} cycles
                                    </span>
                                    {isSummaryGenerating && (
                                        <span className="text-[10px] text-[#747580] animate-pulse">generating...</span>
                                    )}
                                </div>
                                {summaryLastUpdate > 0 && (
                                    <span className="text-[10px] text-[#747580] font-mono">
                                        {new Date(summaryLastUpdate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                )}
                            </div>

                            <div className="flex-1 bg-[#0f1015] rounded p-3 border border-[#232328] overflow-y-auto custom-scrollbar min-h-0 mb-3">
                                {cycleSummary ? (
                                    <p className="text-[13px] text-[#a0a1a8] leading-relaxed whitespace-pre-wrap">
                                        {cycleSummary}
                                    </p>
                                ) : (
                                    <p className="text-[13px] text-[#747580] italic">
                                        Summary will be generated after 2+ analysis cycles...
                                    </p>
                                )}
                            </div>
                        </>
                    ) : status.isAnalyzing ? (
                        <>
                            {/* Live Activity Mode */}
                            <div className="flex items-center justify-between mb-3">
                                <span className={`px-2 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider ${status.currentSignal === 'BULLISH' ? 'bg-[#34d399]/15 text-[#34d399]' :
                                    status.currentSignal === 'BEARISH' ? 'bg-red-500/15 text-red-400' :
                                        'bg-[#1a1b21] text-[#747580]'
                                    }`}>
                                    {status.currentSignal || 'ANALYZING'}
                                </span>
                            </div>

                            <div className="flex-1 bg-[#0f1015] rounded p-3 border border-[#232328] overflow-y-auto custom-scrollbar min-h-0 mb-3">
                                <p className="text-[13px] text-[#a0a1a8] italic leading-relaxed">
                                    "{status.statusDetail || status.statusMessage}"
                                </p>
                            </div>
                        </>
                    ) : currentReasoning ? (
                        <>
                            {/* Reasoning Mode - Paginated */}
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                    <span className="px-2 py-1 rounded bg-[#E7FE55]/15 text-[#E7FE55] text-xs font-semibold uppercase tracking-wider truncate max-w-[150px]">
                                        {currentReasoning.market}
                                    </span>
                                    <span className="text-[10px] text-[#747580] font-mono">
                                        {new Date(currentReasoning.log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </div>
                            </div>

                            {/* Reasoning Content */}
                            <div className="flex-1 bg-[#0f1015] rounded p-3 border border-[#232328] overflow-y-auto custom-scrollbar min-h-0 mb-3">
                                <p className="text-[13px] text-[#a0a1a8] italic leading-relaxed whitespace-pre-wrap">
                                    "{currentReasoning.log.details?.fullReason || currentReasoning.log.message}"
                                </p>
                            </div>
                        </>
                    ) : (
                        <>
                            {/* Fallback: No reasoning logs yet */}
                            <div className="flex items-center justify-between mb-3">
                                <span className={`px-2 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider ${status.currentSignal === 'BULLISH' ? 'bg-[#34d399]/15 text-[#34d399]' :
                                    status.currentSignal === 'BEARISH' ? 'bg-red-500/15 text-red-400' :
                                        'bg-[#1a1b21] text-[#747580]'
                                    }`}>
                                    {status.currentSignal || 'NEUTRAL'}
                                </span>
                            </div>

                            <div className="flex-1 bg-[#0f1015] rounded p-3 border border-[#232328] overflow-y-auto custom-scrollbar min-h-0 mb-3">
                                <p className="text-[13px] text-[#a0a1a8] italic leading-relaxed">
                                    "{status.statusMessage || 'Waiting for analysis...'}"
                                </p>
                            </div>
                        </>
                    )}

                    {/* Status Grid */}
                    <div className="pt-3 border-t border-[#232328] flex flex-col gap-2 shrink-0">
                        <div className="flex items-center gap-2">
                            <span className="text-[9px] text-[#747580] uppercase tracking-[0.05em] w-12 shrink-0">Task</span>
                            <div className="text-[10px] text-white truncate font-mono flex-1">
                                {status.currentTask || '⏸️ Idle'}
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-[9px] text-[#747580] uppercase tracking-[0.05em] w-12 shrink-0">Status</span>
                            <div className="text-[10px] text-[#a0a1a8] font-mono truncate flex-1">
                                {status.statusMessage}
                            </div>
                        </div>
                        {status.statusDetail && (
                            <div className="flex items-center gap-2">
                                <span className="text-[9px] text-[#747580] uppercase tracking-[0.05em] w-12 shrink-0">Info</span>
                                <div className="text-[10px] text-[#E7FE55] truncate flex-1">
                                    {status.statusDetail}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Active Positions Card */}
            <div className="glass-panel p-5 rounded shrink-0">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <Target className="h-4 w-4 text-[#E7FE55]" />
                        <span className="text-sm font-semibold text-white">Active Positions</span>
                    </div>
                    <span className="text-[10px] text-[#747580]">
                        {status.activePositions.length} / {status.settings.maxOpenPositions}
                    </span>
                </div>

                {status.activePositions.length > 0 ? (
                    <div className="overflow-auto max-h-[200px] custom-scrollbar">
                        <table className="w-full text-xs">
                            <thead className="text-[#747580] text-left sticky top-0 bg-[#14151a]">
                                <tr>
                                    <th className="pb-2 font-medium">Market</th>
                                    <th className="pb-2 font-medium">Side</th>
                                    <th className="pb-2 font-medium text-right">Shares</th>
                                    <th className="pb-2 font-medium text-right">Avg Price</th>
                                    <th className="pb-2 font-medium text-right">Current</th>
                                    <th className="pb-2 font-medium text-right">PnL</th>
                                </tr>
                            </thead>
                            <tbody className="text-[#a0a1a8]">
                                {status.activePositions.map((pos, idx) => (
                                    <tr key={idx} className="border-t border-[#232328] hover:bg-[#1a1b21]">
                                        <td className="py-2 max-w-[200px] truncate" title={pos.question}>
                                            {pos.question.slice(0, 40)}...
                                        </td>
                                        <td className={`py-2 font-medium ${pos.outcome === 'YES' ? 'text-[#34d399]' : 'text-red-400'}`}>
                                            {pos.outcome}
                                        </td>
                                        <td className="py-2 text-right font-mono">{pos.shares.toFixed(2)}</td>
                                        <td className="py-2 text-right font-mono">{(pos.avgPrice * 100).toFixed(1)}¢</td>
                                        <td className="py-2 text-right font-mono">{(pos.currentPrice * 100).toFixed(1)}¢</td>
                                        <td className={`py-2 text-right font-mono ${pos.unrealizedPnl >= 0 ? 'text-[#34d399]' : 'text-red-400'}`}>
                                            {pos.unrealizedPnl >= 0 ? '+' : ''}${pos.unrealizedPnl.toFixed(2)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="h-24 flex flex-col items-center justify-center text-[#747580] gap-2 bg-[#0f1015] rounded border border-[#232328]">
                        <Wallet className="h-6 w-6 opacity-40" />
                        <span className="text-[11px]">No active positions</span>
                    </div>
                )}
            </div>

        </div>
    );
};
