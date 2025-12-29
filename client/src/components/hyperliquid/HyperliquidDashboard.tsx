import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { VaultState, MarketData } from '../../types';
import { TrendingUp, Wallet, Activity, AlertTriangle, RefreshCw, Search, TrendingDown } from 'lucide-react';
import { hyperliquidMCP } from '../../mcp/hyperliquid/hyperliquidMCP';
import { Card, CardContent } from '../ui/card';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { cn } from '@/lib/utils';



interface HyperliquidDashboardProps {
    vault: VaultState;
    connectHLOwnerWallet: () => Promise<void>;
    refreshHLBalance: (address: string) => Promise<void>;
    activityLog?: any[];
}

export const HyperliquidDashboard: React.FC<HyperliquidDashboardProps> = ({ vault, connectHLOwnerWallet, refreshHLBalance, activityLog = [] }) => {
    const [positions, setPositions] = useState<any[]>([]);
    const [orders, setOrders] = useState<any[]>([]);
    const [marketDataMap, setMarketDataMap] = useState<Map<string, MarketData>>(new Map());
    const [availableAssets, setAvailableAssets] = useState<string[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [lastUpdate, setLastUpdate] = useState<number>(Date.now());
    const [autoRefresh, setAutoRefresh] = useState(true);
    const [copiedAddress, setCopiedAddress] = useState<string | null>(null);

    const copyToClipboard = async (address: string) => {
        try {
            await navigator.clipboard.writeText(address);
            setCopiedAddress(address);
            setTimeout(() => setCopiedAddress(null), 2000);
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    };

    // Fetch all data
    const fetchData = useCallback(async () => {
        if (!vault.hlPublicKey) return;
        setIsLoading(true);
        try {
            // Refresh Balance
            await refreshHLBalance(vault.hlPublicKey);

            // Fetch Positions & Orders
            const state = await hyperliquidMCP.getUserState(vault.hlPublicKey);
            const activePositions = state.assetPositions.filter((p: any) => parseFloat(p.position.szi) !== 0);
            setPositions(activePositions);

            const openOrders = await hyperliquidMCP.getOpenOrders(vault.hlPublicKey);
            setOrders(openOrders);

            // Fetch available assets
            const assets = await hyperliquidMCP.getAvailableAssets();
            setAvailableAssets(assets);

            // Fetch market data for assets with positions only (to avoid excessive API calls)
            const assetsToFetch = new Set([...activePositions.map((p: any) => p.position.coin)]);
            // Add a few more popular assets if needed
            const popularAssets = ['BTC', 'ETH', 'SOL', 'BNB', 'DOGE', 'AVAX', 'MATIC', 'ARB', 'OP', 'APT'];
            popularAssets.forEach(a => assetsToFetch.add(a));

            const marketDataPromises = [...assetsToFetch].slice(0, 15).map(async (coin) => {
                try {
                    const md = await hyperliquidMCP.getMarketData(coin);
                    const bid = parseFloat(md.levels[0]?.[0]?.px || 0);
                    const ask = parseFloat(md.levels[1]?.[0]?.px || 0);
                    const spread = ask - bid;
                    const spreadPercent = bid > 0 ? (spread / bid) * 100 : 0;

                    return {
                        coin,
                        bid,
                        ask,
                        spread,
                        spreadPercent,
                        lastUpdate: Date.now()
                    } as MarketData;
                } catch (e) {
                    console.error(`Failed to fetch market data for ${coin}`, e);
                    return null;
                }
            });

            const marketDataResults = await Promise.all(marketDataPromises);
            const newMarketDataMap = new Map<string, MarketData>();
            marketDataResults.forEach(md => {
                if (md) newMarketDataMap.set(md.coin, md);
            });
            setMarketDataMap(newMarketDataMap);
            setLastUpdate(Date.now());

        } catch (e) {
            console.error("Failed to fetch HL data", e);
        } finally {
            setIsLoading(false);
        }
    }, [vault.hlPublicKey, refreshHLBalance]);

    // Initial fetch
    useEffect(() => {
        if (vault.hlPublicKey) {
            fetchData();
        }
    }, [vault.hlPublicKey]);

    // Auto-refresh every 60 seconds (reduced from 10s to avoid rate limiting)
    useEffect(() => {
        if (!autoRefresh || !vault.hlPublicKey) return;

        const interval = setInterval(() => {
            fetchData();
        }, 60000);

        return () => clearInterval(interval);
    }, [autoRefresh, vault.hlPublicKey, fetchData]);

    // Calculate total metrics
    const totalUnrealizedPnl = positions.reduce((sum, p) => sum + parseFloat(p.position.unrealizedPnl || 0), 0);
    const totalPositionValue = positions.reduce((sum, p) => {
        const size = Math.abs(parseFloat(p.position.szi));
        const entryPx = parseFloat(p.position.entryPx);
        return sum + (size * entryPx);
    }, 0);

    // Filter assets based on search
    const filteredAssets = availableAssets.filter(asset =>
        asset.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Separate assets with positions
    const assetsWithPositions = new Set(positions.map(p => p.position.coin));

    // Filter for Hyperliquid activities - improved logic to catch all HL items
    const hlActivities = activityLog.filter(log =>
        log.network === 'hyperliquid' ||
        log.type === 'HL Order' ||
        log.type.startsWith('HL')
    );

    return (
        <div className="space-y-6">
            {/* Vault Overview Header */}
            {/* Vault Overview Header */}
            <div className="grid grid-cols-1 sm:grid-cols-2 2xl:grid-cols-4 gap-4 lg:gap-6">
                {/* Vault Balance with Auto-Refresh */}
                {/* Vault Balance with Auto-Refresh */}
                <div className="glass-panel p-6 rounded relative overflow-hidden flex flex-col justify-center group">
                    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                        <Wallet size={48} className="text-white" />
                    </div>
                    <div className="flex items-center justify-between mb-2">
                        <h3 className="text-[10px] uppercase tracking-[0.1em] text-[#747580] font-semibold">Vault Balance</h3>
                    </div>
                    <div className="text-2xl lg:text-3xl font-semibold text-white tracking-tight mb-1">
                        ${vault.hlBalance?.toFixed(2) || '0.00'}
                    </div>
                    <div className="text-[11px] text-[#747580] mb-3">USDC</div>

                    {/* Auto-refresh control */}
                    <div className="flex items-center justify-between pt-3 border-t border-[#232328]">
                        <div className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                id="autoRefresh"
                                checked={autoRefresh}
                                onChange={(e) => setAutoRefresh(e.target.checked)}
                                className="w-3.5 h-3.5 rounded border-[#232328] bg-[#1a1b21] key-emerald-600 focus:ring-emerald-500"
                            />
                            <label htmlFor="autoRefresh" className="text-[10px] text-[#747580] cursor-pointer">
                                Auto-refresh
                            </label>
                        </div>
                        <button
                            onClick={fetchData}
                            disabled={isLoading}
                            className="p-1.5 hover:bg-[#1a1b21] rounded transition-colors text-[#E7FE55] hover:text-[#f0ff85] disabled:opacity-50"
                            title="Refresh now"
                        >
                            <RefreshCw size={14} className={isLoading ? "animate-spin" : ""} />
                        </button>
                    </div>
                </div>

                {/* Total Position Value */}
                {/* Total Position Value */}
                <div className="glass-panel p-6 rounded relative overflow-hidden flex flex-col justify-center">
                    <div className="absolute top-0 right-0 p-4 opacity-5">
                        <TrendingUp size={48} className="text-white" />
                    </div>
                    <div className="flex items-center justify-between mb-2">
                        <h3 className="text-[10px] uppercase tracking-[0.1em] text-[#747580] font-semibold">Position Value</h3>
                    </div>
                    <div className="text-2xl lg:text-3xl font-semibold text-white tracking-tight mb-1">
                        ${totalPositionValue.toFixed(2)}
                    </div>
                    <div className="flex items-center justify-between mt-1">
                        <div className="text-[11px] text-[#747580]">{positions.length} open position{positions.length !== 1 ? 's' : ''}</div>
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
                </div>

                {/* Unrealized PnL */}
                {/* Unrealized PnL */}
                <div className="glass-panel p-6 rounded relative overflow-hidden flex flex-col justify-center">
                    <div className="absolute top-0 right-0 p-4 opacity-5">
                        {totalUnrealizedPnl >= 0 ? (
                            <TrendingUp size={48} className="text-white" />
                        ) : (
                            <TrendingDown size={48} className="text-white" />
                        )}
                    </div>
                    <div className="flex items-center justify-between mb-2">
                        <h3 className="text-[10px] uppercase tracking-[0.1em] text-[#747580] font-semibold">
                            Unrealized PnL
                        </h3>
                    </div>
                    <div className={`text-2xl lg:text-3xl font-semibold tracking-tight mb-1 ${totalUnrealizedPnl >= 0 ? 'text-[#34d399]' : 'text-red-400'}`}>
                        {totalUnrealizedPnl >= 0 ? '+' : ''}{totalUnrealizedPnl.toFixed(2)}
                    </div>
                    <div className="text-[11px] text-[#747580] mt-1">USDC</div>
                </div>

                {/* Vault Wallet Address */}
                {/* Vault Wallet Address */}
                <div className="glass-panel p-6 rounded relative overflow-hidden flex flex-col justify-center">
                    <div className="absolute top-0 right-0 p-4 opacity-5">
                        <Wallet size={48} className="text-white" />
                    </div>
                    <div className="flex items-center justify-between mb-2">
                        <h3 className="text-[10px] uppercase tracking-[0.1em] text-[#747580] font-semibold">Vault Address</h3>
                    </div>
                    {vault.hlPublicKey ? (
                        <div
                            onClick={() => copyToClipboard(vault.hlPublicKey!)}
                            className="flex items-center gap-2 cursor-pointer group"
                        >
                            <div className="w-1.5 h-1.5 rounded-full bg-[#E7FE55]" />
                            <span className="text-sm font-mono text-white truncate group-hover:text-[#E7FE55] transition-colors">
                                {vault.hlPublicKey.slice(0, 6)}...{vault.hlPublicKey.slice(-4)}
                            </span>
                            {copiedAddress === vault.hlPublicKey ? (
                                <span className="text-[10px] text-[#E7FE55] ml-auto">Copied!</span>
                            ) : (
                                <span className="text-[10px] text-[#747580] ml-auto opacity-0 group-hover:opacity-100 transition-opacity">Click to copy</span>
                            )}
                        </div>
                    ) : (
                        <div className="text-sm font-mono text-white mb-1 truncate">
                            Not Available
                        </div>
                    )}
                    <div className="text-[11px] text-[#747580] mt-1">
                        {lastUpdate && `Updated ${new Date(lastUpdate).toLocaleTimeString()}`}
                    </div>
                </div>
            </div>

            {/* Open Positions */}
            <div className="glass-panel p-6 rounded relative overflow-hidden flex flex-col">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                        <Activity size={18} className="text-[#E7FE55]" />
                        Open Positions
                    </h3>
                    <span className="text-[10px] bg-[#1a1b21] text-[#747580] px-2 py-1 rounded uppercase tracking-wider">{positions.length} active</span>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm border-collapse">
                        <thead>
                            <tr className="text-[10px] uppercase tracking-[0.05em] text-[#747580] border-b border-[#232328]">
                                <th className="py-3 pl-4 font-medium">Symbol</th>
                                <th className="py-3 font-medium">Side</th>
                                <th className="py-3 font-medium">Size</th>
                                <th className="py-3 font-medium">Entry Price</th>
                                <th className="py-3 font-medium">Current Price</th>
                                <th className="py-3 font-medium">Leverage</th>
                                <th className="py-3 font-medium">Margin Type</th>
                                <th className="py-3 font-medium">Liq. Price</th>
                                <th className="py-3 font-medium">Unrealized PnL</th>
                                <th className="py-3 pr-4 font-medium">ROE</th>
                            </tr>
                        </thead>
                        <tbody className="text-sm">
                            {positions.length === 0 ? (
                                <tr>
                                    <td colSpan={10} className="p-8 text-center text-slate-500">
                                        No open positions
                                    </td>
                                </tr>
                            ) : (
                                positions.map((p: any, i: number) => {
                                    const isLong = parseFloat(p.position.szi) > 0;
                                    const size = Math.abs(parseFloat(p.position.szi));
                                    const entryPx = parseFloat(p.position.entryPx);
                                    const unrealizedPnl = parseFloat(p.position.unrealizedPnl);
                                    const roe = parseFloat(p.position.returnOnEquity);
                                    const leverage = p.position.leverage?.value || 1;
                                    const leverageType = p.position.leverage?.type || 'cross';
                                    const liqPx = p.position.liquidationPx;
                                    const currentPrice = marketDataMap.get(p.position.coin);
                                    const currentPx = isLong ? currentPrice?.bid : currentPrice?.ask;

                                    return (
                                        <tr key={i} className="border-b border-[#232328]/50 last:border-0 hover:bg-[#1a1b21] transition-colors">
                                            <td className="py-3 pl-4 font-medium text-white">{p.position.coin}</td>
                                            <td className={`py-3 font-semibold ${isLong ? 'text-[#34d399]' : 'text-red-400'}`}>
                                                {isLong ? 'LONG' : 'SHORT'}
                                            </td>
                                            <td className="py-3 text-[#a0a1a8]">{size.toFixed(4)}</td>
                                            <td className="py-3 text-[#a0a1a8]">${entryPx}</td>
                                            <td className="py-3 text-[#a0a1a8]">
                                                {currentPx ? `$${currentPx.toFixed(2)}` : '-'}
                                            </td>
                                            <td className="py-3 text-[#E7FE55] font-medium">{leverage}x</td>
                                            <td className="py-3">
                                                <span className={`px-2 py-1 rounded text-[10px] font-medium uppercase tracking-wider ${leverageType === 'isolated'
                                                    ? 'bg-purple-500/15 text-purple-400'
                                                    : 'bg-blue-500/15 text-blue-400'
                                                    }`}>
                                                    {leverageType}
                                                </span>
                                            </td>
                                            <td className="py-3 text-red-400/80">
                                                {liqPx ? `$${parseFloat(liqPx).toFixed(2)}` : '-'}
                                            </td>
                                            <td className={`py-3 font-semibold ${unrealizedPnl >= 0 ? 'text-[#34d399]' : 'text-red-400'}`}>
                                                {unrealizedPnl >= 0 ? '+' : ''}{unrealizedPnl.toFixed(2)}
                                            </td>
                                            <td className={`py-3 pr-4 font-medium ${roe >= 0 ? 'text-[#34d399]' : 'text-red-400'}`}>
                                                {roe >= 0 ? '+' : ''}{(roe * 100).toFixed(2)}%
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Open Orders */}
            <div className="glass-panel p-6 rounded relative overflow-hidden flex flex-col">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                        <AlertTriangle size={18} className="text-yellow-500" />
                        Open Orders
                    </h3>
                    <span className="text-[10px] bg-[#1a1b21] text-[#747580] px-2 py-1 rounded uppercase tracking-wider">{orders.length} pending</span>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm border-collapse">
                        <thead>
                            <tr className="text-[10px] uppercase tracking-[0.05em] text-[#747580] border-b border-[#232328]">
                                <th className="py-3 pl-4 font-medium">Symbol</th>
                                <th className="py-3 font-medium">Side</th>
                                <th className="py-3 font-medium">Size</th>
                                <th className="py-3 font-medium">Price</th>
                                <th className="py-3 font-medium">Type</th>
                            </tr>
                        </thead>
                        <tbody className="text-sm">
                            {orders.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="p-8 text-center text-slate-500">
                                        No open orders
                                    </td>
                                </tr>
                            ) : (
                                orders.map((o: any, i: number) => (
                                    <tr key={i} className="border-b border-[#232328]/50 last:border-0 hover:bg-[#1a1b21]">
                                        <td className="py-3 pl-4 font-medium text-white">{o.coin}</td>
                                        <td className={`py-3 font-medium ${o.side === 'B' ? 'text-[#34d399]' : 'text-red-400'}`}>
                                            {o.side === 'B' ? 'BUY' : 'SELL'}
                                        </td>
                                        <td className="py-3 text-[#a0a1a8]">{o.sz}</td>
                                        <td className="py-3 text-[#a0a1a8]">${o.limitPx}</td>
                                        <td className="py-3 text-[#a0a1a8]">{o.orderType}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>



            {/* Recent Activity and Market Data - Side by Side */}
            <div className="grid grid-cols-1 2xl:grid-cols-2 gap-6">
                {/* Recent Activity - Split into two columns */}
                <div className="glass-panel p-6 rounded relative overflow-hidden flex flex-col">
                    <div className="flex items-center justify-between mb-4 border-b border-[#232328] pb-2">
                        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                            <Activity size={18} className="text-[#E7FE55]" />
                            Recent Activity
                        </h3>
                    </div>
                    <div className="flex-1">
                        {hlActivities.length === 0 ? (
                            <div className="text-center py-8 text-[#747580] text-sm">
                                No recent transactions
                            </div>
                        ) : (
                            <div className="space-y-3 max-h-80 overflow-y-auto pr-2 custom-scrollbar">
                                {hlActivities.slice(0, 15).map((log, i) => (
                                    <div key={i} className="flex items-start gap-3 pb-3 border-b border-[#232328]/50 last:border-0 border-dashed">
                                        <div className="mt-1 p-1.5 rounded-full bg-[#E7FE55]/15 text-[#E7FE55]">
                                            <Activity size={12} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex justify-between items-start gap-2">
                                                <span className="text-xs font-medium text-[#E7FE55]">{log.type}</span>
                                                <span className="text-[10px] text-[#747580] flex-shrink-0">
                                                    {new Date(log.timestamp).toLocaleTimeString()}
                                                </span>
                                            </div>
                                            <div className="text-[11px] text-[#a0a1a8] truncate mt-0.5">{log.desc}</div>
                                            {log.signature && log.signature !== 'pending' && (
                                                <div className="text-[9px] text-[#747580] font-mono mt-1 hover:text-[#E7FE55] cursor-pointer transition-colors">
                                                    {log.signature.slice(0, 6)}...
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Market Data - All Assets */}
                <div className="glass-panel p-6 rounded relative overflow-hidden flex flex-col">
                    <div className="flex justify-between items-start mb-4 border-b border-[#232328] pb-2">
                        <div className="flex flex-col">
                            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                                <TrendingUp size={18} className="text-[#E7FE55]" />
                                Market Data
                            </h3>
                            <span className="text-[10px] text-[#747580] mt-1">{filteredAssets.length} assets</span>
                        </div>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[#747580]" size={14} />
                            <input
                                type="text"
                                placeholder="Search assets..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-48 pl-9 pr-3 py-1.5 bg-[#14151a] border border-[#232328] text-white rounded text-xs focus:outline-none focus:border-[#E7FE55]"
                            />
                        </div>
                    </div>
                    <div className="overflow-x-auto max-h-96 custom-scrollbar">
                        <table className="w-full text-left text-sm border-collapse">
                            <thead className="sticky top-0 bg-[#0c0d10] z-10">
                                <tr className="text-[10px] uppercase tracking-[0.05em] text-[#747580] border-b border-[#232328]">
                                    <th className="py-2 pl-2 font-medium">Asset</th>
                                    <th className="py-2 font-medium">Bid</th>
                                    <th className="py-2 font-medium">Ask</th>
                                    <th className="py-2 font-medium">Spread %</th>
                                </tr>
                            </thead>
                            <tbody className="text-sm">
                                {filteredAssets.length === 0 ? (
                                    <tr>
                                        <td colSpan={4} className="py-8 text-center text-[#747580]">
                                            No assets found
                                        </td>
                                    </tr>
                                ) : (
                                    filteredAssets.slice(0, 20).map((asset) => {
                                        const md = marketDataMap.get(asset);
                                        const hasPosition = assetsWithPositions.has(asset);

                                        return (
                                            <tr key={asset} className={`border-b border-[#232328]/50 last:border-0 hover:bg-[#1a1b21] transition-colors ${hasPosition ? 'bg-[#E7FE55]/5' : ''}`}>
                                                <td className="py-2 pl-2 font-medium text-white flex items-center gap-2">
                                                    {asset}
                                                    {hasPosition && (
                                                        <span className="w-1.5 h-1.5 rounded-full bg-[#E7FE55]" title="Open Position" />
                                                    )}
                                                </td>
                                                <td className="py-2 text-[#34d399] font-medium">
                                                    {md ? `$${md.bid.toFixed(2)}` : '-'}
                                                </td>
                                                <td className="py-2 text-red-400 font-medium">
                                                    {md ? `$${md.ask.toFixed(2)}` : '-'}
                                                </td>
                                                <td className="py-2 text-[#a0a1a8]">
                                                    {md ? `${md.spreadPercent.toFixed(3)}%` : '-'}
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};
