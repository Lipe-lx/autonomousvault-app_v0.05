import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Coins, TrendingUp, TrendingDown, Zap, Bot, RefreshCw, Trash2, Settings, ChevronDown, ChevronUp } from 'lucide-react';
import { tokenUsageStore, TokenUsageStats, TokenUsageRecord, TokenPricing } from '../../state/tokenUsageStore';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { cn } from '@/lib/utils';

interface TokenCostsPageProps {
    addNotification: (msg: string) => void;
}

// Helper function to calculate cost based on current pricing
// Always uses the user-configured input/output prices (ignores model-specific pricing)
const calculateCostWithPricing = (
    inputTokens: number,
    outputTokens: number,
    pricing: TokenPricing
): number => {
    return (inputTokens * pricing.inputPricePerMillion / 1_000_000) +
        (outputTokens * pricing.outputPricePerMillion / 1_000_000);
};

export const TokenCostsPage: React.FC<TokenCostsPageProps> = ({ addNotification }) => {
    const [stats, setStats] = useState<TokenUsageStats | null>(null);
    const [records, setRecords] = useState<TokenUsageRecord[]>([]);
    const [showPricing, setShowPricing] = useState(false);
    const [showHistory, setShowHistory] = useState(false);
    const [historyLimit, setHistoryLimit] = useState(20);
    const [filterSource, setFilterSource] = useState<'ALL' | 'MANAGER' | 'DEALER'>('ALL');

    // Separate state for editing pricing (user inputs)
    const [editPricing, setEditPricing] = useState(tokenUsageStore.getSnapshot().pricing);
    // Applied pricing (used for calculations)
    const [appliedPricing, setAppliedPricing] = useState(tokenUsageStore.getSnapshot().pricing);

    // Helper to recalculate stats with given pricing
    const recalculateStats = (pricing: TokenPricing): TokenUsageStats | null => {
        const allRecords = tokenUsageStore.getRecords(1000);
        const baseStats = tokenUsageStore.getStats();
        if (!baseStats) return null;

        const now = new Date();
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

        let totalCost = 0;
        const bySourceCost = { MANAGER: 0, DEALER: 0, POLYMARKET_DEALER: 0 };
        const todayCost = { input: 0, output: 0, cost: 0 };
        const thisMonthCost = { input: 0, output: 0, cost: 0 };

        for (const record of allRecords) {
            const cost = calculateCostWithPricing(record.inputTokens, record.outputTokens, pricing);
            totalCost += cost;
            bySourceCost[record.source] += cost;

            if (record.timestamp >= startOfDay) {
                todayCost.input += record.inputTokens;
                todayCost.output += record.outputTokens;
                todayCost.cost += cost;
            }
            if (record.timestamp >= startOfMonth) {
                thisMonthCost.input += record.inputTokens;
                thisMonthCost.output += record.outputTokens;
                thisMonthCost.cost += cost;
            }
        }

        return {
            ...baseStats,
            totalCost,
            bySource: {
                MANAGER: { ...baseStats.bySource.MANAGER, cost: bySourceCost.MANAGER },
                DEALER: { ...baseStats.bySource.DEALER, cost: bySourceCost.DEALER },
                POLYMARKET_DEALER: { ...baseStats.bySource.POLYMARKET_DEALER, cost: bySourceCost.POLYMARKET_DEALER }
            },
            today: todayCost,
            thisMonth: thisMonthCost
        };
    };

    useEffect(() => {
        const updateData = () => {
            setStats(recalculateStats(appliedPricing));
            setRecords(tokenUsageStore.getRecords(historyLimit, filterSource === 'ALL' ? undefined : filterSource));
        };
        updateData();
        const unsubscribe = tokenUsageStore.subscribe(updateData);
        return () => { unsubscribe(); };
    }, [historyLimit, filterSource]);

    // This effect runs when appliedPricing changes
    useEffect(() => {
        const newStats = recalculateStats(appliedPricing);
        setStats(newStats);
    }, [appliedPricing]);

    const handleApplyPricing = () => {
        tokenUsageStore.updatePricing(editPricing);
        setAppliedPricing({ ...editPricing }); // Create new object reference to ensure React detects change
        addNotification('Pricing updated successfully');
    };

    const handleClearHistory = () => {
        if (confirm('Are you sure you want to clear all token usage history?')) {
            tokenUsageStore.clearHistory();
            addNotification('Token usage history cleared');
        }
    };

    const formatNumber = (num: number): string => {
        if (num >= 1_000_000) return (num / 1_000_000).toFixed(2) + 'M';
        if (num >= 1_000) return (num / 1_000).toFixed(1) + 'K';
        return num.toFixed(0);
    };

    const formatCurrency = (amount: number): string => '$' + amount.toFixed(4);
    const formatDate = (timestamp: number): string => new Date(timestamp).toLocaleString();

    if (!stats) {
        return (
            <div className="flex items-center justify-center h-64">
                <motion.div
                    className="h-8 w-8 border-b-2 border-indigo-500 rounded-full"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                />
            </div>
        );
    }

    return (
        <motion.div
            className="h-full flex flex-col space-y-6 overflow-y-auto px-1 pb-8"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
        >
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="border-slate-700/50 bg-gradient-to-br from-slate-900/80 to-slate-800/30">
                    <CardContent className="p-5">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-indigo-500/20"><Zap className="text-indigo-400" size={20} /></div>
                                <span className="text-sm text-slate-400">Total Tokens</span>
                            </div>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={handleClearHistory}
                                className="h-7 px-2 text-xs text-slate-400 hover:text-red-400 hover:bg-red-500/10"
                            >
                                <Trash2 size={14} className="mr-1" /> Clear
                            </Button>
                        </div>
                        <div className="text-2xl font-bold text-white">{formatNumber(stats.totalInputTokens + stats.totalOutputTokens)}</div>
                        <div className="flex gap-4 mt-2 text-xs text-slate-500">
                            <span>In: {formatNumber(stats.totalInputTokens)}</span>
                            <span>Out: {formatNumber(stats.totalOutputTokens)}</span>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-amber-500/30 bg-gradient-to-br from-slate-900/80 to-amber-950/20">
                    <CardContent className="p-5">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="p-2 rounded-lg bg-amber-500/20"><Coins className="text-amber-400" size={20} /></div>
                            <span className="text-sm text-slate-400">Total Cost</span>
                        </div>
                        <div className="text-2xl font-bold text-amber-400">{formatCurrency(stats.totalCost)}</div>
                        <div className="text-xs text-slate-500 mt-2">Estimated based on current pricing</div>
                    </CardContent>
                </Card>

                <Card className="border-emerald-500/30 bg-gradient-to-br from-slate-900/80 to-emerald-950/20">
                    <CardContent className="p-5">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="p-2 rounded-lg bg-emerald-500/20"><TrendingUp className="text-emerald-400" size={20} /></div>
                            <span className="text-sm text-slate-400">Today</span>
                        </div>
                        <div className="text-2xl font-bold text-white">{formatNumber(stats.today.input + stats.today.output)}</div>
                        <div className="text-xs text-emerald-400 mt-2">{formatCurrency(stats.today.cost)}</div>
                    </CardContent>
                </Card>

                <Card className="border-blue-500/30 bg-gradient-to-br from-slate-900/80 to-blue-950/20">
                    <CardContent className="p-5">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="p-2 rounded-lg bg-blue-500/20"><TrendingDown className="text-blue-400" size={20} /></div>
                            <span className="text-sm text-slate-400">This Month</span>
                        </div>
                        <div className="text-2xl font-bold text-white">{formatNumber(stats.thisMonth.input + stats.thisMonth.output)}</div>
                        <div className="text-xs text-blue-400 mt-2">{formatCurrency(stats.thisMonth.cost)}</div>
                    </CardContent>
                </Card>
            </div>

            {/* Source Breakdown */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Manager Stats */}
                <Card className="border-indigo-500/30 bg-gradient-to-br from-slate-900/80 to-indigo-950/20">
                    <CardHeader className="pb-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-indigo-500/20"><Bot className="text-indigo-400" size={24} /></div>
                            <div>
                                <CardTitle className="text-base">Vault Operator</CardTitle>
                                <CardDescription>User queries and tool calls</CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div className="flex justify-between items-center"><span className="text-sm text-slate-400">Total Queries</span><span className="text-white font-medium">{stats.managerMetrics.totalQueries}</span></div>
                        <div className="flex justify-between items-center"><span className="text-sm text-slate-400">Avg Tokens/Query</span><span className="text-white font-medium">{formatNumber(stats.managerMetrics.avgTokensPerQuery)}</span></div>
                        <div className="flex justify-between items-center"><span className="text-sm text-slate-400">Avg Cost/Interaction</span><span className="text-indigo-400 font-medium">{stats.managerMetrics.totalQueries > 0 ? formatCurrency(stats.bySource.MANAGER.cost / stats.managerMetrics.totalQueries) : '$0.0000'}</span></div>
                        <div className="flex justify-between items-center"><span className="text-sm text-slate-400">Total Cost</span><span className="text-indigo-400 font-medium">{formatCurrency(stats.bySource.MANAGER.cost)}</span></div>
                        <div className="mt-4 pt-4 border-t border-slate-700/50">
                            <div className="flex justify-between text-xs text-slate-500 mb-1">
                                <span>Input: {formatNumber(stats.bySource.MANAGER.input)}</span>
                                <span>Output: {formatNumber(stats.bySource.MANAGER.output)}</span>
                            </div>
                            <div className="h-2 bg-slate-800 rounded-full overflow-hidden flex">
                                <div className="bg-indigo-500 h-full" style={{ width: `${stats.bySource.MANAGER.input / (stats.bySource.MANAGER.input + stats.bySource.MANAGER.output + 1) * 100}%` }} />
                                <div className="bg-indigo-300 h-full" style={{ width: `${stats.bySource.MANAGER.output / (stats.bySource.MANAGER.input + stats.bySource.MANAGER.output + 1) * 100}%` }} />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Dealer Stats */}
                <Card className="border-amber-500/30 bg-gradient-to-br from-slate-900/80 to-amber-950/20">
                    <CardHeader className="pb-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-amber-500/20"><Zap className="text-amber-400" size={24} /></div>
                            <div>
                                <CardTitle className="text-base">Hyperliquid Dealer</CardTitle>
                                <CardDescription>Automated analysis cycles</CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div className="flex justify-between items-center"><span className="text-sm text-slate-400">Analysis Cycles</span><span className="text-white font-medium">{stats.bySource.DEALER.count}</span></div>
                        <div className="flex justify-between items-center"><span className="text-sm text-slate-400">Coins Analyzed</span><span className="text-white font-medium">{stats.dealerMetrics.totalCoinsAnalyzed}</span></div>
                        <div className="flex justify-between items-center"><span className="text-sm text-slate-400">Avg Cost/Cycle</span><span className="text-amber-400 font-medium">{stats.bySource.DEALER.count > 0 ? formatCurrency(stats.bySource.DEALER.cost / stats.bySource.DEALER.count) : '$0.0000'}</span></div>
                        <div className="flex justify-between items-center"><span className="text-sm text-slate-400">Avg Cost/Coin</span><span className="text-amber-400 font-medium">{stats.dealerMetrics.totalCoinsAnalyzed > 0 ? formatCurrency(stats.bySource.DEALER.cost / stats.dealerMetrics.totalCoinsAnalyzed) : '$0.0000'}</span></div>
                        <div className="flex justify-between items-center"><span className="text-sm text-slate-400">Total Cost</span><span className="text-amber-400 font-medium">{formatCurrency(stats.bySource.DEALER.cost)}</span></div>
                        <div className="mt-4 pt-4 border-t border-slate-700/50">
                            <div className="flex justify-between text-xs text-slate-500 mb-1">
                                <span>Input: {formatNumber(stats.bySource.DEALER.input)}</span>
                                <span>Output: {formatNumber(stats.bySource.DEALER.output)}</span>
                            </div>
                            <div className="h-2 bg-slate-800 rounded-full overflow-hidden flex">
                                <div className="bg-amber-500 h-full" style={{ width: `${stats.bySource.DEALER.input / (stats.bySource.DEALER.input + stats.bySource.DEALER.output + 1) * 100}%` }} />
                                <div className="bg-amber-300 h-full" style={{ width: `${stats.bySource.DEALER.output / (stats.bySource.DEALER.input + stats.bySource.DEALER.output + 1) * 100}%` }} />
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Collapsible Pricing Configuration */}
            <Card>
                <button onClick={() => setShowPricing(!showPricing)} className="w-full p-4 flex items-center justify-between hover:bg-slate-800/50 rounded-xl transition-all">
                    <div className="flex items-center gap-3">
                        <Settings size={20} className="text-slate-400" />
                        <span className="text-white font-medium">Pricing Configuration</span>
                    </div>
                    {showPricing ? <ChevronUp size={20} className="text-slate-400" /> : <ChevronDown size={20} className="text-slate-400" />}
                </button>

                {showPricing && (
                    <CardContent className="pt-0 border-t border-slate-700/50">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                            <div>
                                <label className="block text-sm text-slate-400 mb-2">Input Price (per 1M tokens)</label>
                                <Input
                                    type="number"
                                    step="0.01"
                                    value={editPricing.inputPricePerMillion}
                                    onChange={(e) => setEditPricing(prev => ({ ...prev, inputPricePerMillion: parseFloat(e.target.value) || 0 }))}
                                    className="focus-visible:ring-[#E7FE55]/20 focus-visible:border-[#E7FE55]/30"
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-slate-400 mb-2">Output Price (per 1M tokens)</label>
                                <Input
                                    type="number"
                                    step="0.01"
                                    value={editPricing.outputPricePerMillion}
                                    onChange={(e) => setEditPricing(prev => ({ ...prev, outputPricePerMillion: parseFloat(e.target.value) || 0 }))}
                                    className="focus-visible:ring-[#E7FE55]/20 focus-visible:border-[#E7FE55]/30"
                                />
                            </div>
                        </div>
                        <div className="mt-4 flex justify-end">
                            <Button onClick={handleApplyPricing} variant="success" size="sm">
                                Apply Pricing
                            </Button>
                        </div>
                    </CardContent>
                )}
            </Card>

            {/* Collapsible History Table */}
            <Card>
                <button onClick={() => setShowHistory(!showHistory)} className="w-full p-4 flex items-center justify-between hover:bg-slate-800/50 rounded-xl transition-all">
                    <div className="flex items-center gap-3">
                        <RefreshCw size={20} className="text-slate-400" />
                        <span className="text-white font-medium">Usage History</span>
                        <Badge variant="secondary">{records.length} records</Badge>
                    </div>
                    {showHistory ? <ChevronUp size={20} className="text-slate-400" /> : <ChevronDown size={20} className="text-slate-400" />}
                </button>

                {showHistory && (
                    <CardContent className="pt-0 border-t border-slate-700/50">
                        <div className="flex items-center gap-4 mt-4 mb-4">
                            <div className="flex bg-slate-800 rounded-lg p-1">
                                {(['ALL', 'MANAGER', 'DEALER'] as const).map((source) => (
                                    <Button
                                        key={source}
                                        variant={filterSource === source ? 'default' : 'ghost'}
                                        size="sm"
                                        onClick={() => setFilterSource(source)}
                                        className="text-xs"
                                    >
                                        {source}
                                    </Button>
                                ))}
                            </div>
                            <select
                                value={historyLimit}
                                onChange={(e) => setHistoryLimit(parseInt(e.target.value))}
                                className="bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-1.5 text-xs"
                            >
                                <option value={10}>10 records</option>
                                <option value={20}>20 records</option>
                                <option value={50}>50 records</option>
                            </select>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-slate-400 text-xs uppercase border-b border-slate-700">
                                        <th className="text-left py-3 px-2">Timestamp</th>
                                        <th className="text-left py-3 px-2">Source</th>
                                        <th className="text-left py-3 px-2">Operation</th>
                                        <th className="text-right py-3 px-2">Input</th>
                                        <th className="text-right py-3 px-2">Output</th>
                                        <th className="text-right py-3 px-2">Cost</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {records.map((record) => (
                                        <tr key={record.id} className="border-b border-slate-800 hover:bg-slate-800/50">
                                            <td className="py-2 px-2 text-slate-400 text-xs">{formatDate(record.timestamp)}</td>
                                            <td className="py-2 px-2">
                                                <Badge variant={record.source === 'MANAGER' ? 'info' : 'warning'}>{record.source}</Badge>
                                            </td>
                                            <td className="py-2 px-2 text-slate-300 text-xs">{record.operation}</td>
                                            <td className="py-2 px-2 text-right text-slate-300">{formatNumber(record.inputTokens)}</td>
                                            <td className="py-2 px-2 text-right text-slate-300">{formatNumber(record.outputTokens)}</td>
                                            <td className="py-2 px-2 text-right text-amber-400 font-medium">
                                                {formatCurrency((record.inputTokens * appliedPricing.inputPricePerMillion / 1_000_000) + (record.outputTokens * appliedPricing.outputPricePerMillion / 1_000_000))}
                                            </td>
                                        </tr>
                                    ))}
                                    {records.length === 0 && (
                                        <tr><td colSpan={6} className="py-8 text-center text-slate-500">No usage records yet.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                )}
            </Card>
        </motion.div>
    );
};
