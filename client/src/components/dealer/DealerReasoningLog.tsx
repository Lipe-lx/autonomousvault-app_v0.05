import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { DealerLog } from '../../state/dealerStore';
import { Brain, TrendingUp, TrendingDown, Minus, Clock, ExternalLink, ChevronDown, ChevronUp, Activity, DollarSign } from 'lucide-react';
import { cn } from '@/lib/utils';


interface DealerReasoningLogProps {
    logs: DealerLog[];
    onClearLogs: () => void;
}

export const DealerReasoningLog: React.FC<DealerReasoningLogProps> = ({ logs, onClearLogs }) => {
    const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

    // Filter only REASONING, SIGNAL, TRADE, and relevant INFO/WARNING logs for this view
    const reasoningLogs = logs.filter(l => {
        if (['REASONING', 'SIGNAL', 'TRADE', 'ERROR'].includes(l.type)) return true;
        // Also capture high-level execution info/warnings
        if (['INFO', 'WARNING'].includes(l.type)) {
            const msg = l.message.toLowerCase();
            return msg.includes('executing') || msg.includes('skipping') || msg.includes('ignored');
        }
        return false;
    });

    const getIcon = (type: string, message: string) => {
        if (type === 'ERROR') return <div className="text-red-400"><Minus size={16} /></div>;
        if (type === 'TRADE') return <div className="text-[#34d399]"><ExternalLink size={16} /></div>;
        if (message.includes('BUY') || message.includes('BULLISH')) return <div className="text-[#34d399]"><TrendingUp size={16} /></div>;
        if (message.includes('SELL') || message.includes('BEARISH') || message.includes('SHORT')) return <div className="text-red-400"><TrendingDown size={16} /></div>;
        if (message.includes('CLOSE')) return <div className="text-orange-400"><Minus size={16} /></div>;
        return <div className="text-[#E7FE55]"><Brain size={16} /></div>;
    };

    const formatTime = (timestamp: number) => {
        return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    };

    const formatIndicatorValue = (value: any): string => {
        if (typeof value === 'number') return value.toFixed(2);
        if (typeof value === 'object' && value !== null) {
            return Object.entries(value)
                .map(([k, v]) => `${k}: ${typeof v === 'number' ? (v as number).toFixed(2) : v}`)
                .join(', ');
        }
        return String(value);
    };

    return (
        <div className="flex flex-col h-full overflow-hidden">
            <div className="p-4 border-b border-[#232328] flex justify-between items-center shrink-0">
                <h3 className="text-sm font-semibold flex items-center gap-2 text-white">
                    <Brain className="h-4 w-4 text-[#E7FE55]" />
                    AI Reasoning Log
                </h3>
                <button
                    onClick={onClearLogs}
                    className="text-[10px] text-[#747580] hover:text-white transition-colors uppercase tracking-wider"
                >
                    Clear History
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                {reasoningLogs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-[#747580] opacity-50 py-12">
                        <Brain size={48} className="mb-4 opacity-30" />
                        <p className="text-sm">No analysis recorded yet.</p>
                        <p className="text-[10px] text-[#747580]">Start the dealer to see its thought process.</p>
                    </div>
                ) : (
                    reasoningLogs.map((log) => {
                        const isExpanded = expandedLogId === log.id;
                        const hasContext = log.details?.context;
                        const context = log.details?.context;

                        return (
                            <div key={log.id} className="relative pl-6 pb-2 border-l border-[#232328] last:border-0 transition-colors group">
                                {/* Timeline Dot */}
                                <div className="absolute -left-[5px] top-1 w-2.5 h-2.5 rounded-full bg-[#14151a] border border-[#232328] group-hover:border-[#747580] transition-colors" />

                                <div className="bg-[#14151a] p-3 rounded border border-[#232328] hover:border-[#3a3b42] transition-all">
                                    <div className="flex items-center justify-between mb-1">
                                        <div className="flex items-center gap-2">
                                            {getIcon(log.type, log.message)}
                                            <span className={`text-[10px] font-semibold uppercase tracking-wider ${log.type === 'ERROR' ? 'text-red-400' :
                                                log.type === 'TRADE' ? 'text-[#34d399]' :
                                                    log.type === 'SIGNAL' ? 'text-[#E7FE55]' :
                                                        'text-[#a0a1a8]'
                                                }`}>
                                                {log.type}
                                            </span>
                                        </div>
                                        <span className="text-[10px] text-[#747580] flex items-center gap-1 font-mono">
                                            <Clock size={10} />
                                            {formatTime(log.timestamp)}
                                        </span>
                                    </div>

                                    <p className="text-sm text-[#a0a1a8] leading-relaxed">
                                        {log.message}
                                    </p>

                                    {log.details && log.details.fullReason && (
                                        <div className="mt-2 p-2 bg-[#0f1015] rounded text-[11px] text-[#747580] font-mono italic border-l-2 border-[#60a5fa]/30">
                                            "{log.details.fullReason}"
                                        </div>
                                    )}

                                    {/* Context Expand Button */}
                                    {hasContext && (
                                        <button
                                            onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                                            className="mt-2 flex items-center gap-1 text-[10px] text-[#60a5fa] hover:text-[#93c5fd] transition-colors uppercase tracking-wider"
                                        >
                                            {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                                            {isExpanded ? 'Hide' : 'Show'} Analysis Context
                                        </button>
                                    )}

                                    {/* Expanded Context */}
                                    {isExpanded && hasContext && (
                                        <div className="mt-3 p-3 bg-[#0f1015] rounded border border-[#232328] space-y-3">
                                            {/* Indicators Section */}
                                            {context.indicators && Object.keys(context.indicators).length > 0 && (
                                                <div>
                                                    <div className="flex items-center gap-1 text-[10px] text-[#34d399] mb-2 uppercase tracking-wider font-semibold">
                                                        <Activity size={10} />
                                                        <span>Indicators Used</span>
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-1">
                                                        {Object.entries(context.indicators).map(([name, data]: [string, any]) => (
                                                            <div key={name} className="flex justify-between bg-[#34d399]/10 border border-[#34d399]/20 px-2 py-1 rounded text-[10px]">
                                                                <span className="text-[#34d399] uppercase font-medium">{name}</span>
                                                                <span className="text-[#4ade80] font-mono">{formatIndicatorValue(data?.value || data)}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Macro Timeframe Indicators */}
                                            {context.macro && Object.keys(context.macro.indicators || {}).length > 0 && (
                                                <div>
                                                    <div className="flex items-center gap-1 text-[10px] text-amber-400 mb-2 uppercase tracking-wider font-semibold">
                                                        <TrendingUp size={10} />
                                                        <span>
                                                            Macro Confirmation ({
                                                                context.macro.timeframe === '15' ? '15m' :
                                                                    context.macro.timeframe === '60' ? '1H' :
                                                                        context.macro.timeframe === '240' ? '4H' :
                                                                            context.macro.timeframe === 'D' ? 'Daily' :
                                                                                context.macro.timeframe === 'W' ? 'Weekly' :
                                                                                    context.macro.timeframe
                                                            })
                                                        </span>
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-1">
                                                        {Object.entries(context.macro.indicators).map(([name, data]: [string, any]) => {
                                                            // Compare with main indicator if available
                                                            const mainValue = context.indicators?.[name]?.value;
                                                            const macroValue = data?.value || data;

                                                            // Determine alignment (RSI-based detection)
                                                            let alignmentStatus = '';
                                                            const mainNum = typeof mainValue === 'number' ? mainValue :
                                                                (typeof mainValue === 'object' && mainValue !== null ? Object.values(mainValue)[0] : null);
                                                            const macroNum = typeof macroValue === 'number' ? macroValue :
                                                                (typeof macroValue === 'object' && macroValue !== null ? Object.values(macroValue)[0] : null);

                                                            if (name === 'rsi' && typeof mainNum === 'number' && typeof macroNum === 'number') {
                                                                const mainOverbought = mainNum > 70;
                                                                const mainOversold = mainNum < 30;
                                                                const macroOverbought = macroNum > 70;
                                                                const macroOversold = macroNum < 30;

                                                                if ((mainOverbought && macroOversold) || (mainOversold && macroOverbought)) {
                                                                    alignmentStatus = '⚠️ '; // Conflict
                                                                } else if ((mainOverbought && macroOverbought) || (mainOversold && macroOversold)) {
                                                                    alignmentStatus = '✅ '; // Aligned
                                                                }
                                                            }

                                                            return (
                                                                <div key={name} className="flex justify-between bg-amber-500/10 border border-amber-500/20 px-2 py-1 rounded text-[10px]">
                                                                    <span className="text-amber-400 uppercase font-medium">{name}</span>
                                                                    <span className="text-amber-300 font-mono">
                                                                        {alignmentStatus}{formatIndicatorValue(macroValue)}
                                                                    </span>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Trading Costs */}
                                            {context.tradingCosts && (
                                                <div>
                                                    <div className="flex items-center gap-1 text-[10px] text-[#747580] mb-2 uppercase tracking-wider font-semibold">
                                                        <DollarSign size={10} />
                                                        <span>Trading Costs</span>
                                                    </div>
                                                    <div className="grid grid-cols-3 gap-1">
                                                        <div className="bg-[#1a1b21] px-2 py-1 rounded text-[10px] border border-[#232328]">
                                                            <span className="text-[#747580]">Maker: </span>
                                                            <span className="text-white font-mono">{((context.tradingCosts.makerFee ?? 0.0002) * 100).toFixed(3)}%</span>
                                                        </div>
                                                        <div className="bg-[#1a1b21] px-2 py-1 rounded text-[10px] border border-[#232328]">
                                                            <span className="text-[#747580]">Taker: </span>
                                                            <span className="text-white font-mono">{((context.tradingCosts.takerFee ?? 0.0005) * 100).toFixed(3)}%</span>
                                                        </div>
                                                        <div className="bg-[#1a1b21] px-2 py-1 rounded text-[10px] border border-[#232328]">
                                                            <span className="text-[#747580]">Funding: </span>
                                                            <span className={(context.tradingCosts.fundingRate ?? 0) > 0 ? 'text-red-400 font-mono' : 'text-[#34d399] font-mono'}>
                                                                {((context.tradingCosts.fundingRate ?? 0) * 100).toFixed(4)}%
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Price Info */}
                                            {context.currentPrice && (
                                                <div className="text-[10px] text-[#747580]">
                                                    Price at analysis: <span className="text-white font-mono">${context.currentPrice.toLocaleString()}</span>
                                                </div>
                                            )}

                                            {/* Enabled Indicators List */}
                                            {context.enabledIndicators && context.enabledIndicators.length > 0 && (
                                                <div className="text-[10px] text-[#747580]">
                                                    Enabled: <span className="font-mono">{context.enabledIndicators.join(', ').toUpperCase()}</span>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
};
