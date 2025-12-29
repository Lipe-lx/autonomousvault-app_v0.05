// src/components/polymarket/PolymarketReasoningLog.tsx
// AI Reasoning Log for Polymarket Dealer - follows DealerReasoningLog pattern exactly

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PolymarketLog } from '../../state/polymarketStore';
import { Brain, TrendingUp, TrendingDown, Minus, Clock, ExternalLink, ChevronDown, ChevronUp, DollarSign } from 'lucide-react';

interface PolymarketReasoningLogProps {
    logs: PolymarketLog[];
    onClearLogs: () => void;
}

export const PolymarketReasoningLog: React.FC<PolymarketReasoningLogProps> = ({ logs, onClearLogs }) => {
    const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

    // Filter only REASONING, SIGNAL, TRADE, and relevant INFO/WARNING logs for this view
    const reasoningLogs = logs.filter(l => {
        if (['REASONING', 'SIGNAL', 'TRADE', 'ERROR'].includes(l.type)) return true;
        if (['INFO', 'WARNING'].includes(l.type)) {
            const msg = l.message.toLowerCase();
            return msg.includes('executing') || msg.includes('skipping') || msg.includes('ignored') || msg.includes('position');
        }
        return false;
    });

    const getIcon = (type: string, message: string) => {
        if (type === 'ERROR') return <div className="text-red-400"><Minus size={16} /></div>;
        if (type === 'TRADE') return <div className="text-[#34d399]"><ExternalLink size={16} /></div>;
        if (message.includes('YES') || message.includes('BULLISH')) return <div className="text-[#34d399]"><TrendingUp size={16} /></div>;
        if (message.includes('NO') || message.includes('BEARISH')) return <div className="text-red-400"><TrendingDown size={16} /></div>;
        return <div className="text-[#E7FE55]"><Brain size={16} /></div>;
    };

    const formatTime = (timestamp: number) => {
        return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
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
                                        <div className="mt-2 p-2 bg-[#0f1015] rounded text-[11px] text-[#747580] font-mono italic border-l-2 border-[#E7FE55]/30 whitespace-pre-wrap">
                                            "{typeof log.details.fullReason === 'string' ? log.details.fullReason : JSON.stringify(log.details.fullReason)}"
                                        </div>
                                    )}

                                    {/* Context Expand Button */}
                                    {hasContext && (
                                        <button
                                            onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                                            className="mt-2 flex items-center gap-1 text-[10px] text-[#E7FE55] hover:text-[#d4eb4d] transition-colors uppercase tracking-wider"
                                        >
                                            {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                                            {isExpanded ? 'Hide' : 'Show'} Market Context
                                        </button>
                                    )}

                                    {/* Expanded Context */}
                                    {isExpanded && hasContext && (
                                        <div className="mt-3 p-3 bg-[#0f1015] rounded border border-[#232328] space-y-3">
                                            {/* Market Info */}
                                            {context.question && (
                                                <div className="text-[10px] text-[#747580]">
                                                    Market: <span className="text-white">{context.question.slice(0, 100)}{context.question.length > 100 ? '...' : ''}</span>
                                                </div>
                                            )}

                                            {/* Market Metrics */}
                                            {(context.volume24h || context.liquidity) && (
                                                <div>
                                                    <div className="flex items-center gap-1 text-[10px] text-[#34d399] mb-2 uppercase tracking-wider font-semibold">
                                                        <DollarSign size={10} />
                                                        <span>Market Metrics</span>
                                                    </div>
                                                    <div className="grid grid-cols-3 gap-1">
                                                        {context.volume24h && (
                                                            <div className="bg-[#34d399]/10 border border-[#34d399]/20 px-2 py-1 rounded text-[10px]">
                                                                <span className="text-[#34d399] uppercase font-medium">Volume 24h</span>
                                                                <span className="text-[#4ade80] font-mono ml-2">${context.volume24h.toLocaleString()}</span>
                                                            </div>
                                                        )}
                                                        {context.liquidity && (
                                                            <div className="bg-[#34d399]/10 border border-[#34d399]/20 px-2 py-1 rounded text-[10px]">
                                                                <span className="text-[#34d399] uppercase font-medium">Liquidity</span>
                                                                <span className="text-[#4ade80] font-mono ml-2">${context.liquidity.toLocaleString()}</span>
                                                            </div>
                                                        )}
                                                        {context.spread && (
                                                            <div className="bg-[#34d399]/10 border border-[#34d399]/20 px-2 py-1 rounded text-[10px]">
                                                                <span className="text-[#34d399] uppercase font-medium">Spread</span>
                                                                <span className="text-[#4ade80] font-mono ml-2">{(context.spread * 100).toFixed(2)}%</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Current Prices */}
                                            {(context.yesPrice || context.noPrice) && (
                                                <div className="text-[10px] text-[#747580]">
                                                    Prices:
                                                    {context.yesPrice && <span className="text-[#34d399] font-mono ml-2">YES: {(context.yesPrice * 100).toFixed(1)}¢</span>}
                                                    {context.noPrice && <span className="text-red-400 font-mono ml-2">NO: {(context.noPrice * 100).toFixed(1)}¢</span>}
                                                </div>
                                            )}

                                            {/* Raw Context Data */}
                                            <pre className="text-[9px] text-[#747580] overflow-x-auto whitespace-pre-wrap custom-scrollbar max-h-[200px]">
                                                {JSON.stringify(context, null, 2)}
                                            </pre>
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
