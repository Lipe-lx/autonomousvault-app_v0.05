import React, { useEffect, useState, useSyncExternalStore } from 'react';
import { Target, Layers, AlertCircle, RefreshCw, XCircle, TrendingUp } from 'lucide-react';
import { hyperliquidMCP } from '../../mcp/hyperliquid/hyperliquidMCP';
import { AppTab } from '../../types';
import { dealerStore } from '../../state/dealerStore';


interface DealerOpenOrdersProps {
    vaultAddress: string | null;
    setActiveTab: (tab: AppTab) => void;
}

interface OpenPosition {
    coin: string;
    szi: string; // Size (signed)
    entryPx: string;
    positionValue: string;
    unrealizedPnl: string;
    returnOnEquity: string;
    liquidationPx: string | null;
    leverage: any;
}

interface OpenOrder {
    oid: number;
    coin: string;
    side: string; // 'B' or 'A'
    limitPx: string;
    sz: string;
    orderType: string;
    timestamp: number;
    triggerCondition?: string; // e.g., 'tp' (take profit), 'sl' (stop loss)
    isPositionTpsl?: boolean; // true if order is a TP/SL for a position
    isTrigger?: boolean; // true if it's a trigger order
    triggerPx?: string; // trigger price for stop/TP orders
}

export const DealerOpenOrders: React.FC<DealerOpenOrdersProps> = ({ vaultAddress, setActiveTab }) => {
    const [positions, setPositions] = useState<OpenPosition[]>([]);
    const [orders, setOrders] = useState<OpenOrder[]>([]);
    const [loading, setLoading] = useState(false);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

    // Subscribe to dealer state to avoid polling during active cycles
    const dealerState = useSyncExternalStore(
        (listener) => dealerStore.subscribe(listener),
        () => dealerStore.getSnapshot()
    );

    const fetchData = async () => {
        if (!vaultAddress) return;
        setLoading(true);
        try {
            // 1. Fetch User State for Positions
            const userState = await hyperliquidMCP.getUserState(vaultAddress);
            if (userState && userState.assetPositions) {
                const activePositions = userState.assetPositions
                    .filter((p: any) => parseFloat(p.position.szi) !== 0)
                    .map((p: any) => ({
                        coin: p.position.coin,
                        szi: p.position.szi,
                        entryPx: p.position.entryPx,
                        positionValue: p.position.positionValue,
                        unrealizedPnl: p.position.unrealizedPnl,
                        returnOnEquity: p.position.returnOnEquity,
                        liquidationPx: p.position.liquidationPx,
                        leverage: p.position.leverage
                    }));
                setPositions(activePositions);
            }

            // 2. Fetch Open Orders (using frontendOpenOrders for more info)
            const openOrders = await hyperliquidMCP.getOpenOrders(vaultAddress);
            console.log('[DealerOpenOrders] Raw orders:', openOrders); // Debug log
            if (openOrders && Array.isArray(openOrders)) {
                setOrders(openOrders.map((o: any) => ({
                    oid: o.oid,
                    coin: o.coin,
                    side: o.side,
                    limitPx: o.limitPx,
                    sz: o.sz,
                    orderType: o.orderType,
                    timestamp: o.timestamp,
                    triggerCondition: o.triggerCondition,
                    isPositionTpsl: o.isPositionTpsl,
                    isTrigger: o.isTrigger,
                    triggerPx: o.triggerPx
                })));
            }
            setLastUpdated(new Date());

        } catch (error) {
            console.error('[DealerOpenOrders] Failed to fetch data:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        // Initial fetch only if dealer is not analyzing
        if (!dealerState.isAnalyzing) {
            fetchData();
        }

        // Poll only when dealer is in "waiting" state (not analyzing)
        const interval = setInterval(() => {
            if (!dealerState.isAnalyzing && !dealerState.pendingExecution) {
                fetchData();
            }
        }, 30000); // Poll every 30s when idle

        return () => clearInterval(interval);
    }, [vaultAddress, dealerState.isAnalyzing, dealerState.pendingExecution]);

    return (
        <div className="flex flex-col min-h-[150px]">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                    <Layers className="h-4 w-4 text-[#E7FE55]" />
                    Open Trading
                    <button
                        onClick={fetchData}
                        className={`p-1.5 rounded hover:bg-[#1a1b21] transition-colors ${loading ? 'animate-spin text-[#E7FE55]' : 'text-[#747580]'}`}
                        title="Refresh"
                    >
                        <RefreshCw className="h-3.5 w-3.5" />
                    </button>
                </h3>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setActiveTab(AppTab.HYPERLIQUID)}
                        className="text-[10px] bg-[#E7FE55]/10 hover:bg-[#E7FE55]/20 text-[#E7FE55] border border-[#E7FE55]/30 px-3 py-1.5 rounded transition-colors flex items-center gap-2 uppercase tracking-wider font-medium"
                        title="View Trading Page"
                    >
                        <TrendingUp size={12} /> Details
                    </button>
                    <span className="text-[10px] text-[#747580] bg-[#1a1b21] px-2 py-1 rounded uppercase tracking-wider">
                        {positions.length} Pos • {orders.length} Ord
                    </span>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar">
                {positions.length === 0 && orders.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-[#747580] gap-2 py-8 bg-[#0f1015] rounded border border-[#232328]">
                        <Layers className="h-8 w-8 opacity-30" />
                        <span className="text-[11px]">No open positions or active orders</span>
                    </div>
                ) : (
                    <div className="flex flex-col gap-4">
                        {/* Positions Section */}
                        {positions.length > 0 && (
                            <div className="bg-[#0f1015] rounded border border-[#232328] overflow-hidden">
                                <div className="px-4 py-2 border-b border-[#232328] flex items-center gap-2">
                                    <Target className="h-3.5 w-3.5 text-[#E7FE55]" />
                                    <span className="text-[10px] font-semibold text-[#E7FE55] uppercase tracking-[0.1em]">Active Positions</span>
                                    {positions.length > 5 && (
                                        <span className="text-[9px] text-[#747580] ml-auto">scroll ↓</span>
                                    )}
                                </div>
                                {/* Header row - aligned with Active Orders */}
                                <div className="grid text-[#747580] border-b border-[#232328] text-[9px] uppercase tracking-[0.05em] font-medium" style={{ gridTemplateColumns: '0.8fr 0.9fr 0.9fr 0.8fr 1fr 0.9fr 1fr' }}>
                                    <div className="px-3 py-2">Pair</div>
                                    <div className="px-3 py-2">Side</div>
                                    <div className="px-3 py-2">Size</div>
                                    <div className="px-3 py-2 text-right">Entry</div>
                                    <div className="px-3 py-2 text-right">Exposure</div>
                                    <div className="px-3 py-2 text-right">Liq.</div>
                                    <div className="px-3 py-2 text-right">PnL (ROE%)</div>
                                </div>
                                {/* Scrollable body - max 5 rows (~200px) */}
                                <div className="max-h-[200px] overflow-y-auto custom-scrollbar">
                                    {positions.map((pos) => {
                                        const pnl = parseFloat(pos.unrealizedPnl);
                                        const roe = (parseFloat(pos.returnOnEquity) * 100).toFixed(2);
                                        const isProfit = pnl >= 0;
                                        const isLong = parseFloat(pos.szi) > 0;
                                        const leverageVal = pos.leverage?.value || 0;
                                        const exposure = Math.abs(parseFloat(pos.szi)) * parseFloat(pos.entryPx);

                                        return (
                                            <div key={pos.coin} className="grid border-b border-[#232328]/50 last:border-0 hover:bg-[#1a1b21] transition-colors text-[11px]" style={{ gridTemplateColumns: '0.8fr 0.9fr 0.9fr 0.8fr 1fr 0.9fr 1fr' }}>
                                                <div className="px-3 py-3 font-semibold text-white">{pos.coin}</div>
                                                <div className="px-3 py-3">
                                                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider ${isLong
                                                        ? 'bg-[#34d399]/15 text-[#34d399]'
                                                        : 'bg-red-500/15 text-red-400'}`}>
                                                        {isLong ? 'LONG' : 'SHORT'} {leverageVal}x
                                                    </span>
                                                </div>
                                                <div className={`px-3 py-3 font-mono ${isLong ? 'text-[#34d399]' : 'text-red-400'}`}>
                                                    {isLong ? '+' : ''}{pos.szi}
                                                </div>
                                                <div className="px-3 py-3 text-right text-[#a0a1a8] font-mono">${parseFloat(pos.entryPx).toFixed(2)}</div>
                                                <div className="px-3 py-3 text-right text-[#a0a1a8] font-mono">
                                                    ${exposure.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </div>
                                                <div className="px-3 py-3 text-right text-[#747580] font-mono">
                                                    {pos.liquidationPx ? `$${parseFloat(pos.liquidationPx).toFixed(2)}` : '-'}
                                                </div>
                                                <div className={`px-3 py-3 text-right font-mono font-semibold ${isProfit ? 'text-[#34d399]' : 'text-red-400'}`}>
                                                    {isProfit ? '+' : ''}{pnl.toFixed(2)} ({isProfit ? '+' : ''}{roe}%)
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Orders Section */}
                        {orders.length > 0 && (
                            <div className="bg-[#0f1015] rounded border border-[#232328] overflow-hidden">
                                <div className="px-4 py-2 border-b border-[#232328] flex items-center gap-2">
                                    <AlertCircle className="h-3.5 w-3.5 text-[#E7FE55]" />
                                    <span className="text-[10px] font-semibold text-[#E7FE55] uppercase tracking-[0.1em]">Active Orders</span>
                                    {orders.length > 5 && (
                                        <span className="text-[9px] text-[#747580] ml-auto">scroll ↓</span>
                                    )}
                                </div>
                                {/* Header row - aligned with Active Positions */}
                                <div className="grid text-[#747580] border-b border-[#232328] text-[9px] uppercase tracking-[0.05em] font-medium" style={{ gridTemplateColumns: '0.8fr 0.9fr 0.9fr 0.8fr 1fr 0.9fr 1fr' }}>
                                    <div className="px-3 py-2">Pair</div>
                                    <div className="px-3 py-2">Side</div>
                                    <div className="px-3 py-2">Type</div>
                                    <div className="px-3 py-2 text-right">Size</div>
                                    <div className="px-3 py-2 text-right">Price</div>
                                    <div className="px-3 py-2 text-right">Exp. %</div>
                                    <div className="px-3 py-2 text-right">Action</div>
                                </div>
                                {/* Scrollable body - max 5 rows (~200px) */}
                                <div className="max-h-[200px] overflow-y-auto custom-scrollbar">
                                    {orders.map((ord) => {
                                        const type = ord.orderType || 'Limit';
                                        // Detect SL/TP from multiple sources
                                        const isStopLoss = ord.triggerCondition === 'sl' || 
                                                          type.toLowerCase().includes('stop') ||
                                                          (ord.isPositionTpsl && ord.side === 'A');
                                        const isTakeProfit = ord.triggerCondition === 'tp' || 
                                                            type.toLowerCase().includes('take profit') ||
                                                            (ord.isPositionTpsl && ord.side === 'B');
                                        const isTriggerOrder = ord.isTrigger && !isStopLoss && !isTakeProfit;
                                        
                                        // Calculate expected % by comparing order price with position entry price
                                        const position = positions.find(p => p.coin === ord.coin);
                                        let expectedPct: number | null = null;
                                        if (position) {
                                            const entryPx = parseFloat(position.entryPx);
                                            const orderPx = parseFloat(ord.limitPx);
                                            const isLong = parseFloat(position.szi) > 0;
                                            if (isLong) {
                                                expectedPct = ((orderPx - entryPx) / entryPx) * 100;
                                            } else {
                                                expectedPct = ((entryPx - orderPx) / entryPx) * 100;
                                            }
                                        }
                                        
                                        return (
                                            <div key={ord.oid} className="grid border-b border-[#232328]/50 last:border-0 hover:bg-[#1a1b21] transition-colors text-[11px]" style={{ gridTemplateColumns: '0.8fr 0.9fr 0.9fr 0.8fr 1fr 0.9fr 1fr' }}>
                                                <div className="px-3 py-3 font-semibold text-white">{ord.coin}</div>
                                                <div className="px-3 py-3">
                                                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider ${ord.side === 'B' ? 'bg-[#34d399]/15 text-[#34d399]' : 'bg-red-500/15 text-red-400'}`}>
                                                        {ord.side === 'B' ? 'BUY' : 'SELL'}
                                                    </span>
                                                </div>
                                                <div className="px-3 py-3">
                                                    {isStopLoss && (
                                                        <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider bg-red-500/15 text-red-400">
                                                            Stop Loss
                                                        </span>
                                                    )}
                                                    {isTakeProfit && (
                                                        <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider bg-[#34d399]/15 text-[#34d399]">
                                                            Take Profit
                                                        </span>
                                                    )}
                                                    {isTriggerOrder && (
                                                        <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider bg-[#60a5fa]/15 text-[#60a5fa]">
                                                            Trigger
                                                        </span>
                                                    )}
                                                    {!isStopLoss && !isTakeProfit && !isTriggerOrder && (
                                                        <span className="text-[#a0a1a8] uppercase">Limit</span>
                                                    )}
                                                </div>
                                                <div className="px-3 py-3 text-right text-[#a0a1a8] font-mono">{ord.sz}</div>
                                                <div className="px-3 py-3 text-right text-[#a0a1a8] font-mono">${parseFloat(ord.limitPx).toFixed(2)}</div>
                                                <div className={`px-3 py-3 text-right font-mono font-semibold ${expectedPct !== null ? (expectedPct >= 0 ? 'text-[#34d399]' : 'text-red-400') : 'text-[#747580]'}`}>
                                                    {expectedPct !== null ? `${expectedPct >= 0 ? '+' : ''}${expectedPct.toFixed(2)}%` : '-'}
                                                </div>
                                                <div className="px-3 py-3 text-right">
                                                    <span className="text-[#747580] text-[9px] italic">Pending</span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            <div className="pt-4 flex justify-end">
                <a
                    href="https://app.hyperliquid-testnet.xyz/trade"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] text-[#E7FE55] hover:text-[#E7FE55]/80 flex items-center gap-1 transition-colors"
                    title="Hyperliquid Platform Official Website"
                >
                    <TrendingUp size={10} /> Hyperliquid Platform Testnet
                </a>
            </div>
        </div>
    );
};
