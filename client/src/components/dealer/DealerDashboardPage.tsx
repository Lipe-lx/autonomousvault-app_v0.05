import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
    Radio, TrendingUp, AlertTriangle, Activity,
    DollarSign, Clock, BarChart2, PieChart, ShieldCheck,
    ChevronLeft, ChevronRight, Brain, Layers, RotateCcw
} from 'lucide-react';
import { StorageService } from '../../services/storageService';

import { DealerOpenOrders } from './DealerOpenOrders';
import { DealerState, DealerLog } from '../../state/dealerStore';
import { useCycleSummary } from '../../hooks/useCycleSummary';
import { hyperliquidService } from '../../services/hyperliquidService';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
    BarChart, Bar, Cell
} from 'recharts';
import { AppTab } from '../../types';

interface DealerDashboardPageProps {
    status: DealerState;
    onToggle: (isOn: boolean) => void;
    vaultAddress: string | null;
    setActiveTab: (tab: AppTab) => void;
}

interface TradeFill {
    coin: string;
    side: string; // 'A' = Ask (Sell), 'B' = Bid (Buy)
    px: string;
    sz: string;
    time: number;
    closedPnl?: string; // Realized PnL if available
    fee: string;
    tid: number;
    cloid?: string; // Client Order ID for filtering
}

// Helper to extract coin from log message
const extractCoinFromMessage = (message: string): string | null => {
    const match = message.match(/(\w+):/);
    return match ? match[1] : null;
};

// Number of items per page for Recent Fills
const FILLS_PER_PAGE = 8;

export const DealerDashboardPage: React.FC<DealerDashboardPageProps> = ({
    status,
    onToggle,
    vaultAddress,
    setActiveTab
}) => {
    const [fills, setFills] = useState<TradeFill[]>([]);
    const [pnlHistory, setPnlHistory] = useState<any[]>([]);
    const [fillsPage, setFillsPage] = useState(0);
    const [stats, setStats] = useState({
        totalPnl: 0,
        winRate: 0,
        totalVolume: 0,
        tradesWithPnl: 0
    });
    const [unrealizedPnl, setUnrealizedPnl] = useState(0);

    // Baseline timestamp for reset functionality - metrics calculated from this point forward
    const BASELINE_STORAGE_KEY = 'hl_dealer_metrics_baseline';
    const [baselineTimestamp, setBaselineTimestamp] = useState<number | null>(null);
    const [baselineLoaded, setBaselineLoaded] = useState(false);

    // Load baseline from storage on mount
    useEffect(() => {
        const loadBaseline = async () => {
            try {
                const storedBaseline = await StorageService.getItem(StorageService.getUserKey(BASELINE_STORAGE_KEY));
                if (storedBaseline) {
                    setBaselineTimestamp(parseInt(storedBaseline, 10));
                }
            } catch (e) {
                console.warn('[DealerDashboard] Failed to load baseline:', e);
            }
            setBaselineLoaded(true);
        };
        loadBaseline();
    }, []);

    // Reset metrics handler
    const handleResetMetrics = useCallback(async () => {
        const now = Date.now();
        setBaselineTimestamp(now);
        try {
            await StorageService.setItem(StorageService.getUserKey(BASELINE_STORAGE_KEY), now.toString());
            console.log('[DealerDashboard] Metrics baseline reset to:', new Date(now).toISOString());
        } catch (e) {
            console.error('[DealerDashboard] Failed to save baseline:', e);
        }
    }, []);

    // AI Summary toggle state
    const [showSummary, setShowSummary] = useState(false);
    const { summary: cycleSummary, isGenerating: isSummaryGenerating, cycleCount, lastUpdate: summaryLastUpdate, hasSummary } = useCycleSummary('hyperliquid');

    // Reasoning navigation state
    const [reasoningIndex, setReasoningIndex] = useState(0);

    // Extract reasoning logs from status logs (newest first, but we want most recent analysis cycle)
    const reasoningLogs = useMemo(() => {
        return status.logs
            .filter(log => log.type === 'REASONING' || log.type === 'SIGNAL')
            .slice(0, 20); // Limit to recent logs
    }, [status.logs]);

    // Group reasoning by coin (get unique coins from recent logs)
    const coinReasonings = useMemo(() => {
        const coinMap = new Map<string, DealerLog>();

        // Go through logs and keep only the most recent per coin
        for (const log of reasoningLogs) {
            const coin = extractCoinFromMessage(log.message) || log.details?.context?.coin;
            if (coin && !coinMap.has(coin)) {
                coinMap.set(coin, log);
            }
        }

        // Convert to array sorted by timestamp (newest first)
        return Array.from(coinMap.entries())
            .sort((a, b) => b[1].timestamp - a[1].timestamp)
            .map(([coin, log]) => ({ coin, log }));
    }, [reasoningLogs]);

    // Reset index when new analysis comes in
    useEffect(() => {
        if (coinReasonings.length > 0 && !status.isAnalyzing) {
            // When analysis finishes, show the most recent (index 0)
            setReasoningIndex(0);
        }
    }, [coinReasonings.length, status.isAnalyzing]);

    // Current reasoning to display
    const currentReasoning = coinReasonings[reasoningIndex];

    // Reversed fills for display (newest first)
    const reversedFills = useMemo(() => [...fills].reverse(), [fills]);
    const totalPages = Math.ceil(reversedFills.length / FILLS_PER_PAGE);
    const paginatedFills = useMemo(() => {
        const start = fillsPage * FILLS_PER_PAGE;
        return reversedFills.slice(start, start + FILLS_PER_PAGE);
    }, [reversedFills, fillsPage]);

    // Process PnL data with baseline filtering
    const processPnlData = useCallback((fillData: TradeFill[], baseline: number | null) => {
        // Filter fills to only include those after the baseline timestamp
        const filteredFills = baseline
            ? fillData.filter(fill => fill.time >= baseline)
            : fillData;

        let cumulativePnl = 0;
        let wins = 0;
        let losses = 0;
        let volume = 0;
        let countPnl = 0;

        const chartData = filteredFills.map(fill => {
            const pnl = parseFloat(fill.closedPnl || '0');
            const fee = parseFloat(fill.fee || '0');
            const netPnl = pnl - fee; // Net PnL = Closed PnL - Fee

            // Win/Loss based on NET PnL (after fees)
            // Only count trades that actually closed a position (have closedPnl)
            if (pnl !== 0) {
                countPnl++;
                if (netPnl > 0) wins++;
                else if (netPnl < 0) losses++;
                // If netPnl === 0 exactly, it's breakeven - don't count as win or loss
            }

            cumulativePnl += netPnl; // Net PnL after fees
            volume += (parseFloat(fill.px) * parseFloat(fill.sz));

            return {
                time: fill.time,
                date: new Date(fill.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                pnl: cumulativePnl,
                rawPnl: pnl
            };
        });

        const totalTrades = wins + losses;
        setStats({
            totalPnl: cumulativePnl,
            winRate: totalTrades > 0 ? (wins / totalTrades) * 100 : 0,
            totalVolume: volume,
            tradesWithPnl: countPnl
        });

        // Downsample chart data if too many points?
        setPnlHistory(chartData);
    }, []);

    // Fetch History
    useEffect(() => {
        if (!vaultAddress) return;

        const fetchHistory = async () => {
            try {
                // Skip fetch if dealer is actively analyzing (dealer has priority)
                if (hyperliquidService.isDealerActive()) {
                    console.log('[Dashboard] ⏸️  Skipping fetch - dealer is active');
                    return;
                }

                // Fetch recent user fills (using shared cache)
                const recentFills = await hyperliquidService.getUserFillsShared(vaultAddress);
                if (recentFills && Array.isArray(recentFills)) {
                    // Filter: Only show Dealer transactions (those with a cloid)
                    const dealerFills = recentFills.filter((f: any) => f.cloid || f.c);

                    // Fills are usually returned newest first
                    // We want to process them chronologically for the chart
                    // Note: dealerFills is what we want to display, but for PnL chart we might want ALL history?
                    // User request: "Os dados do dealer dashboard devem refletir apenas ao que o dealer está fazendo"
                    // So we should filter EVERYTHING by dealer fills.
                    const sortedFills = [...dealerFills].sort((a: any, b: any) => a.time - b.time);
                    setFills(sortedFills);
                    processPnlData(sortedFills, baselineTimestamp);
                }

                // Fetch User State for Unrealized PnL (using shared cache)
                const userState = await hyperliquidService.getUserStateShared(vaultAddress);
                if (userState && userState.assetPositions) {
                    const totalUnrealized = userState.assetPositions.reduce((acc: number, p: any) => {
                        return acc + parseFloat(p.position.unrealizedPnl || '0');
                    }, 0);
                    setUnrealizedPnl(totalUnrealized);
                }
            } catch (e) {
                console.error("Failed to load dealer history", e);
            }
        };

        fetchHistory();
        // Poll every 30s
        const interval = setInterval(fetchHistory, 30000);
        return () => clearInterval(interval);
    }, [vaultAddress, baselineTimestamp, processPnlData]);

    // Recalculate stats when baseline changes
    useEffect(() => {
        if (fills.length > 0) {
            processPnlData(fills, baselineTimestamp);
        }
    }, [baselineTimestamp, fills, processPnlData]);



    const handleToggle = () => {
        onToggle(!status.isOn);
    };

    const handlePrevPage = () => {
        setFillsPage(prev => Math.max(0, prev - 1));
    };

    const handleNextPage = () => {
        setFillsPage(prev => Math.min(totalPages - 1, prev + 1));
    };

    // Reasoning navigation handlers
    const handlePrevReasoning = () => {
        setReasoningIndex(prev => Math.min(coinReasonings.length - 1, prev + 1));
    };

    const handleNextReasoning = () => {
        setReasoningIndex(prev => Math.max(0, prev - 1));
    };

    return (
        <div className="flex flex-col h-full gap-4 overflow-y-auto custom-scrollbar pb-4">

            {/* Main Layout: Stats + Charts with Live Analysis on the right */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 shrink-0">

                {/* Left Column: Stats + Performance Curve (2/3 width) */}
                <div className="lg:col-span-2 flex flex-col gap-4">

                    {/* Top Row: Status + KPIs */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

                        {/* Status Card */}
                        <div className="glass-panel p-4 rounded flex flex-wrap items-center justify-between gap-2">
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

                        {/* Total Profit Card */}
                        <div className="glass-panel p-4 rounded relative group">
                            <div className="flex items-center justify-between mb-1">
                                <div className="text-[10px] text-[#747580] uppercase tracking-[0.1em]">Total Profit</div>
                                <button
                                    onClick={handleResetMetrics}
                                    className="p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity text-[#747580] hover:text-[#E7FE55] hover:bg-[#1a1b21]"
                                    title="Reset metrics from now"
                                >
                                    <RotateCcw size={12} />
                                </button>
                            </div>
                            <div className={`text-xl font-semibold font-mono tracking-tight ${stats.totalPnl >= 0 ? 'text-[#34d399]' : 'text-red-400'}`}>
                                {stats.totalPnl >= 0 ? '+' : ''}{stats.totalPnl.toFixed(2)} USD
                            </div>
                            {baselineTimestamp && (
                                <div className="text-[8px] text-[#3a3b42] mt-1" title={`Measuring since ${new Date(baselineTimestamp).toLocaleString()}`}>
                                    Since {new Date(baselineTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </div>
                            )}
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
                                <span className="text-[9px] text-[#747580] uppercase tracking-[0.1em] mb-1">Active Pairs</span>
                                <span className="text-white font-mono text-sm font-semibold">{status.settings.tradingPairs.length}</span>
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
                                <span className="text-[9px] text-[#747580] uppercase tracking-[0.1em] mb-1">Max Leverage</span>
                                <span className="text-white font-mono text-sm font-semibold">{status.settings.maxLeverage}x</span>
                            </div>
                            <BarChart2 className="h-4 w-4 text-[#747580]" />
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
                                            <linearGradient id="colorPnl" x1="0" y1="0" x2="0" y2="1">
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
                                        <Area type="monotone" dataKey="pnl" stroke="#E7FE55" strokeWidth={1.5} fillOpacity={1} fill="url(#colorPnl)" />
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
                        {!status.isAnalyzing && coinReasonings.length > 0 && !showSummary && (
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={handlePrevReasoning}
                                    disabled={reasoningIndex >= coinReasonings.length - 1}
                                    className={`p-1 rounded transition-colors ${reasoningIndex >= coinReasonings.length - 1
                                        ? 'text-[#3a3b42] cursor-not-allowed'
                                        : 'text-[#747580] hover:text-white hover:bg-[#1a1b21]'
                                        }`}
                                    title="Previous coin"
                                >
                                    <ChevronLeft size={16} />
                                </button>
                                <span className="text-[10px] text-[#747580] font-mono min-w-[32px] text-center">
                                    {reasoningIndex + 1}/{coinReasonings.length}
                                </span>
                                <button
                                    onClick={handleNextReasoning}
                                    disabled={reasoningIndex <= 0}
                                    className={`p-1 rounded transition-colors ${reasoningIndex <= 0
                                        ? 'text-[#3a3b42] cursor-not-allowed'
                                        : 'text-[#747580] hover:text-white hover:bg-[#1a1b21]'
                                        }`}
                                    title="Next coin"
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
                                    "{status.trendAssessment}"
                                </p>
                            </div>
                        </>
                    ) : currentReasoning ? (
                        <>
                            {/* Reasoning Mode - Paginated */}
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                    <span className="px-2 py-1 rounded bg-[#E7FE55]/15 text-[#E7FE55] text-xs font-semibold uppercase tracking-wider">
                                        {currentReasoning.coin}
                                    </span>
                                    <span className="text-[10px] text-[#747580] font-mono">
                                        {new Date(currentReasoning.log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </div>
                                {currentReasoning.log.details?.signal && (
                                    <span className={`px-2 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider ${currentReasoning.log.details.signal === 'BUY' || currentReasoning.log.details.signal === 'LONG'
                                        ? 'bg-[#34d399]/15 text-[#34d399]'
                                        : currentReasoning.log.details.signal === 'SELL' || currentReasoning.log.details.signal === 'SHORT'
                                            ? 'bg-red-500/15 text-red-400'
                                            : 'bg-[#1a1b21] text-[#747580]'
                                        }`}>
                                        {currentReasoning.log.details.signal}
                                    </span>
                                )}
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
                                    "{status.trendAssessment}"
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

            {/* Open Operations Card */}
            <div className="glass-panel p-5 rounded shrink-0">
                <DealerOpenOrders vaultAddress={vaultAddress} setActiveTab={setActiveTab} />
            </div>

        </div>
    );
};
