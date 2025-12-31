// SolanaDealerDashboard.tsx
// Dashboard view for Solana LP Dealer - Following Hyperliquid Dealer layout structure

import React, { useMemo } from 'react';
import { 
    Droplets, 
    TrendingUp, 
    DollarSign, 
    AlertCircle,
    CheckCircle2,
    XCircle,
    RefreshCw,
    Shield,
    Brain,
    ChevronLeft,
    ChevronRight,
    PieChart,
    Layers,
    Activity
} from 'lucide-react';
import { SolanaDealerState, LPPositionSummary } from '../../types/solanaLPTypes';
import { solanaDealerStore } from '../../state/solanaDealerStore';
import { liquidityPoolMCP } from '../../mcp/solana/liquidityPoolMCP';

interface SolanaDealerDashboardProps {
    state: SolanaDealerState;
    walletAddress?: string;
}

export const SolanaDealerDashboard: React.FC<SolanaDealerDashboardProps> = ({
    state,
    walletAddress
}) => {
    const [isRefreshing, setIsRefreshing] = React.useState(false);
    const [showSummary, setShowSummary] = React.useState(false);
    const [activityIndex, setActivityIndex] = React.useState(0);

    // Refresh positions
    const handleRefresh = async () => {
        if (!walletAddress) return;
        
        setIsRefreshing(true);
        try {
            const positionData = await liquidityPoolMCP.getAllPositions(walletAddress);
            const positions: LPPositionSummary[] = [
                ...positionData.meteora.map(p => ({
                    poolAddress: p.poolAddress,
                    poolName: p.poolAddress.slice(0, 8) + '...',
                    protocol: p.protocol as LPPositionSummary['protocol'],
                    valueUSD: p.valueUSD,
                    unclaimedFeesUSD: p.unclaimedFees.totalUSD,
                    inRange: p.priceRange?.inRange ?? true,
                    priceRange: p.priceRange ? { min: p.priceRange.min, max: p.priceRange.max } : undefined,
                    currentPrice: p.priceRange?.current
                })),
                ...positionData.raydium.map(p => ({
                    poolAddress: p.poolAddress,
                    poolName: p.poolAddress.slice(0, 8) + '...',
                    protocol: p.protocol as LPPositionSummary['protocol'],
                    valueUSD: p.valueUSD,
                    unclaimedFeesUSD: p.unclaimedFees.totalUSD,
                    inRange: p.priceRange?.inRange ?? true,
                    priceRange: p.priceRange ? { min: p.priceRange.min, max: p.priceRange.max } : undefined,
                    currentPrice: p.priceRange?.current
                }))
            ];
            solanaDealerStore.updatePositions(positions);
            solanaDealerStore.addLog('INFO', `Refreshed ${positions.length} positions`);
        } catch (error: any) {
            solanaDealerStore.addLog('ERROR', 'Failed to refresh positions', error.message);
        }
        setIsRefreshing(false);
    };

    // Stats
    const positionsInRange = state.activePositions.filter(p => p.inRange).length;
    const positionsOutOfRange = state.activePositions.filter(p => !p.inRange).length;

    // Recent activities for navigation (like coin reasonings in HyperliquidDealer)
    const recentActivities = useMemo(() => {
        return state.logs.slice(0, 10);
    }, [state.logs]);

    const currentActivity = recentActivities[activityIndex];

    const handlePrevActivity = () => {
        setActivityIndex(prev => Math.min(recentActivities.length - 1, prev + 1));
    };

    const handleNextActivity = () => {
        setActivityIndex(prev => Math.max(0, prev - 1));
    };

    const handleToggle = () => {
        const newState = !state.settings.policy.enabled;
        solanaDealerStore.updatePolicy({ enabled: newState });
    };

    return (
        <div className="flex flex-col h-full gap-4 overflow-y-auto custom-scrollbar pb-4">

            {/* Main Layout: Stats + Positions with Live Activity on the right */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 shrink-0">

                {/* Left Column: Stats + Positions (2/3 width) */}
                <div className="lg:col-span-2 flex flex-col gap-4">

                    {/* Top Row: Status + KPIs */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

                        {/* Status Card */}
                        <div className="glass-panel p-4 rounded flex flex-wrap items-center justify-between gap-2">
                            {/* Status Badge */}
                            <div className={`px-3 py-1.5 rounded border flex items-center gap-2 transition-all ${state.settings.policy.enabled
                                ? 'bg-[#E7FE55]/10 border-[#E7FE55]/30'
                                : 'bg-[#1a1b21] border-[#232328]'
                                }`}>
                                <span className="relative flex h-2 w-2">
                                    {state.settings.policy.enabled && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#E7FE55] opacity-75"></span>}
                                    <span className={`relative inline-flex rounded-full h-2 w-2 ${state.settings.policy.enabled ? 'bg-[#E7FE55]' : 'bg-red-500'}`}></span>
                                </span>
                                <span className={`font-semibold tracking-wider text-[10px] uppercase ${state.settings.policy.enabled ? 'text-[#E7FE55]' : 'text-[#747580]'}`}>
                                    {state.settings.policy.enabled ? 'ACTIVE' : 'OFFLINE'}
                                </span>
                            </div>

                            {/* Toggle Switch */}
                            <div className="flex items-center gap-2">
                                <span className="text-[9px] font-medium text-[#747580] uppercase tracking-[0.1em]">Policy</span>
                                <button
                                    onClick={handleToggle}
                                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-all focus:outline-none ${state.settings.policy.enabled ? 'bg-[#E7FE55]' : 'bg-[#232328] hover:bg-[#2a2b30]'}`}
                                >
                                    <span className={`${state.settings.policy.enabled ? 'translate-x-5' : 'translate-x-1'} inline-block h-3 w-3 transform rounded-full bg-black transition-transform`} />
                                </button>
                            </div>
                        </div>

                        {/* Total Value Card */}
                        <div className="glass-panel p-4 rounded">
                            <div className="text-[10px] text-[#747580] uppercase tracking-[0.1em] mb-1">Total Value</div>
                            <div className="text-xl font-semibold text-white font-mono tracking-tight">
                                ${state.totalValueUSD.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                            </div>
                        </div>

                        {/* Unclaimed Fees Card */}
                        <div className="glass-panel p-4 rounded">
                            <div className="text-[10px] text-[#747580] uppercase tracking-[0.1em] mb-1">Unclaimed Fees</div>
                            <div className="text-xl font-semibold text-[#34d399] font-mono tracking-tight">
                                +${state.totalUnclaimedFeesUSD.toFixed(2)}
                            </div>
                        </div>

                        {/* Positions Count Card */}
                        <div className="glass-panel p-4 rounded">
                            <div className="text-[10px] text-[#747580] uppercase tracking-[0.1em] mb-1">Positions</div>
                            <div className="text-xl font-semibold text-white font-mono tracking-tight">{state.activePositions.length}</div>
                        </div>
                    </div>

                    {/* Configuration Metrics Row */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="glass-panel p-4 rounded flex items-center justify-between">
                            <div className="flex flex-col">
                                <span className="text-[9px] text-[#747580] uppercase tracking-[0.1em] mb-1">In Range</span>
                                <span className="text-white font-mono text-sm font-semibold">{positionsInRange}</span>
                            </div>
                            <CheckCircle2 className="h-4 w-4 text-[#34d399]" />
                        </div>
                        <div className="glass-panel p-4 rounded flex items-center justify-between">
                            <div className="flex flex-col">
                                <span className="text-[9px] text-[#747580] uppercase tracking-[0.1em] mb-1">Out of Range</span>
                                <span className="text-white font-mono text-sm font-semibold">{positionsOutOfRange}</span>
                            </div>
                            <XCircle className="h-4 w-4 text-[#ef4444]" />
                        </div>
                        <div className="glass-panel p-4 rounded flex items-center justify-between">
                            <div className="flex flex-col">
                                <span className="text-[9px] text-[#747580] uppercase tracking-[0.1em] mb-1">Min TVL</span>
                                <span className="text-white font-mono text-sm font-semibold">${state.settings.policy.minTVLRequired.toLocaleString()}</span>
                            </div>
                            <Shield className="h-4 w-4 text-[#747580]" />
                        </div>
                        <div className="glass-panel p-4 rounded flex items-center justify-between">
                            <div className="flex flex-col">
                                <span className="text-[9px] text-[#747580] uppercase tracking-[0.1em] mb-1">Max Range</span>
                                <span className="text-white font-mono text-sm font-semibold">{state.settings.policy.maxRangeWidthPercent}%</span>
                            </div>
                            <Layers className="h-4 w-4 text-[#747580]" />
                        </div>
                    </div>

                    {/* Active LP Positions Card */}
                    <div className="glass-panel p-5 rounded min-h-[220px] flex flex-col flex-1">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <Droplets className="h-4 w-4 text-[#E7FE55]" />
                                <span className="text-sm font-semibold text-white">Active LP Positions</span>
                            </div>
                            <button
                                onClick={handleRefresh}
                                disabled={isRefreshing || !walletAddress}
                                className="flex items-center gap-1 px-2 py-1 text-[10px] text-[#747580] hover:text-white transition-colors disabled:opacity-50"
                            >
                                <RefreshCw size={12} className={isRefreshing ? 'animate-spin' : ''} />
                                Refresh
                            </button>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto custom-scrollbar">
                            {state.activePositions.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-[#747580]">
                                    <Droplets className="h-8 w-8 mb-2 opacity-40" />
                                    <span className="text-[11px]">No active LP positions</span>
                                    <span className="text-[10px] text-[#5a5b63] mt-1">
                                        {walletAddress ? 'Use the Vault Operator to open positions' : 'Connect wallet to view positions'}
                                    </span>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {state.activePositions.map((position, idx) => (
                                        <div key={idx} className="bg-[#0f1015] rounded p-3 border border-[#232328] flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-2 h-2 rounded-full ${position.inRange ? 'bg-[#10b981]' : 'bg-[#ef4444]'}`} />
                                                <div>
                                                    <div className="text-sm font-medium text-white">{position.poolName}</div>
                                                    <div className="text-[10px] text-[#747580] uppercase">
                                                        {position.protocol.replace('_', ' ')}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-sm font-medium text-white font-mono">
                                                    ${position.valueUSD.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                                                </div>
                                                {position.unclaimedFeesUSD > 0 && (
                                                    <div className="text-[10px] text-[#10b981] font-mono">
                                                        +${position.unclaimedFeesUSD.toFixed(2)} fees
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Right Column: Live Activity (1/3 width, spans full height) */}
                <div className="glass-panel p-5 rounded flex flex-col">
                    {/* Header with toggle */}
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                            <Brain className={`h-4 w-4 shrink-0 ${state.logs.length > 0 ? 'text-[#E7FE55]' : 'text-[#E7FE55]/60'}`} />

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
                                    onClick={() => setShowSummary(true)}
                                    className={`px-2 py-0.5 rounded-full text-[9px] font-semibold uppercase tracking-wider transition-all ${showSummary
                                        ? 'bg-[#E7FE55] text-black'
                                        : 'text-[#747580] hover:text-white'
                                        }`}
                                >
                                    Policy
                                </button>
                            </div>
                        </div>

                        {/* Navigation arrows */}
                        {!showSummary && recentActivities.length > 0 && (
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={handlePrevActivity}
                                    disabled={activityIndex >= recentActivities.length - 1}
                                    className={`p-1 rounded transition-colors ${activityIndex >= recentActivities.length - 1
                                        ? 'text-[#3a3b42] cursor-not-allowed'
                                        : 'text-[#747580] hover:text-white hover:bg-[#1a1b21]'
                                        }`}
                                    title="Previous activity"
                                >
                                    <ChevronLeft size={16} />
                                </button>
                                <span className="text-[10px] text-[#747580] font-mono min-w-[32px] text-center">
                                    {activityIndex + 1}/{recentActivities.length}
                                </span>
                                <button
                                    onClick={handleNextActivity}
                                    disabled={activityIndex <= 0}
                                    className={`p-1 rounded transition-colors ${activityIndex <= 0
                                        ? 'text-[#3a3b42] cursor-not-allowed'
                                        : 'text-[#747580] hover:text-white hover:bg-[#1a1b21]'
                                        }`}
                                    title="Next activity"
                                >
                                    <ChevronRight size={16} />
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Content: Show policy summary or live activity */}
                    {showSummary ? (
                        <>
                            {/* Policy Summary Mode */}
                            <div className="flex items-center justify-between mb-3">
                                <span className="px-2 py-0.5 rounded bg-[#E7FE55]/15 text-[#E7FE55] text-[9px] font-semibold uppercase tracking-wider">
                                    POLICY CONFIG
                                </span>
                            </div>

                            <div className="flex-1 bg-[#0f1015] rounded p-3 border border-[#232328] overflow-y-auto custom-scrollbar min-h-0 mb-3">
                                <div className="space-y-3 text-[13px]">
                                    <div className="flex justify-between">
                                        <span className="text-[#747580]">Min TVL Required</span>
                                        <span className="text-white font-mono">${state.settings.policy.minTVLRequired.toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-[#747580]">Max Range Width</span>
                                        <span className="text-white font-mono">{state.settings.policy.maxRangeWidthPercent}%</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-[#747580]">Max Capital/Pool</span>
                                        <span className="text-white font-mono">{state.settings.policy.maxCapitalPerPoolPercent}%</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-[#747580]">Confirmation Actions</span>
                                        <span className="text-white font-mono">{state.settings.policy.requireConfirmationFor.length}</span>
                                    </div>
                                    <div className="pt-2 border-t border-[#232328]">
                                        <span className="text-[#747580] text-[11px] uppercase tracking-wider">Requires Confirmation</span>
                                        <div className="mt-2 flex flex-wrap gap-1">
                                            {state.settings.policy.requireConfirmationFor.map((action, idx) => (
                                                <span key={idx} className="px-2 py-0.5 rounded bg-[#232328] text-[#a0a1a8] text-[10px]">
                                                    {action}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </>
                    ) : currentActivity ? (
                        <>
                            {/* Activity Mode - Paginated */}
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                    <span className={`px-2 py-1 rounded text-xs font-semibold uppercase tracking-wider ${
                                        currentActivity.type === 'ERROR' ? 'bg-red-500/15 text-red-400' :
                                        currentActivity.type === 'WARNING' ? 'bg-[#f59e0b]/15 text-[#f59e0b]' :
                                        currentActivity.type === 'POLICY' ? 'bg-[#a855f7]/15 text-[#a855f7]' :
                                        'bg-[#E7FE55]/15 text-[#E7FE55]'
                                    }`}>
                                        {currentActivity.type}
                                    </span>
                                    <span className="text-[10px] text-[#747580] font-mono">
                                        {new Date(currentActivity.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </div>
                            </div>

                            {/* Activity Content */}
                            <div className="flex-1 bg-[#0f1015] rounded p-3 border border-[#232328] overflow-y-auto custom-scrollbar min-h-0 mb-3">
                                <p className="text-[13px] text-[#a0a1a8] leading-relaxed whitespace-pre-wrap">
                                    {currentActivity.message}
                                </p>
                                {currentActivity.details && (
                                    <div className="mt-3 pt-3 border-t border-[#232328] text-[11px] text-[#747580] font-mono">
                                        {typeof currentActivity.details === 'string' 
                                            ? currentActivity.details 
                                            : JSON.stringify(currentActivity.details, null, 2)}
                                    </div>
                                )}
                            </div>
                        </>
                    ) : (
                        <>
                            {/* Fallback: No activity yet */}
                            <div className="flex items-center justify-between mb-3">
                                <span className="px-2 py-0.5 rounded bg-[#1a1b21] text-[#747580] text-[9px] font-semibold uppercase tracking-wider">
                                    IDLE
                                </span>
                            </div>

                            <div className="flex-1 bg-[#0f1015] rounded p-3 border border-[#232328] overflow-y-auto custom-scrollbar min-h-0 mb-3">
                                <p className="text-[13px] text-[#747580] italic leading-relaxed">
                                    No recent activity. Start interacting with LP positions to see updates here.
                                </p>
                            </div>
                        </>
                    )}

                    {/* Status Grid */}
                    <div className="pt-3 border-t border-[#232328] flex flex-col gap-2 shrink-0">
                        <div className="flex items-center gap-2">
                            <span className="text-[9px] text-[#747580] uppercase tracking-[0.05em] w-16 shrink-0">Status</span>
                            <div className="text-[10px] text-white truncate font-mono flex-1">
                                {state.settings.policy.enabled ? '🟢 Policy Active' : '⏸️ Policy Disabled'}
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-[9px] text-[#747580] uppercase tracking-[0.05em] w-16 shrink-0">Positions</span>
                            <div className="text-[10px] text-[#a0a1a8] font-mono truncate flex-1">
                                {state.activePositions.length} active ({positionsInRange} in range)
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-[9px] text-[#747580] uppercase tracking-[0.05em] w-16 shrink-0">Wallet</span>
                            <div className="text-[10px] text-[#E7FE55] truncate flex-1 font-mono">
                                {walletAddress ? `${walletAddress.slice(0, 8)}...${walletAddress.slice(-6)}` : 'Not connected'}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Recent Activity Log */}
            <div className="glass-panel p-5 rounded shrink-0">
                <div className="flex items-center gap-2 mb-4">
                    <Activity className="h-4 w-4 text-[#E7FE55]" />
                    <span className="text-sm font-semibold text-white">Activity Log</span>
                    <span className="text-[10px] text-[#747580] ml-auto">{state.logs.length} entries</span>
                </div>
                <div className="max-h-48 overflow-y-auto custom-scrollbar">
                    {state.logs.slice(0, 10).map((log, idx) => (
                        <div key={idx} className="py-2 border-b border-[#232328]/50 last:border-0 flex items-start gap-3">
                            <span className={`text-[10px] font-medium uppercase shrink-0 ${
                                log.type === 'ERROR' ? 'text-[#ef4444]' :
                                log.type === 'WARNING' ? 'text-[#f59e0b]' :
                                log.type === 'POLICY' ? 'text-[#a855f7]' :
                                'text-[#747580]'
                            }`}>
                                {log.type}
                            </span>
                            <span className="text-[10px] text-[#747580] font-mono shrink-0">
                                {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            <span className="text-[12px] text-[#a0a1a8] flex-1 truncate">{log.message}</span>
                        </div>
                    ))}
                    {state.logs.length === 0 && (
                        <div className="py-4 text-center text-[#747580] text-[11px]">
                            No activity recorded yet
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
