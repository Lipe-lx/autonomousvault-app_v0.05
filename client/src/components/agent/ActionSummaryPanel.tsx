import React, { useMemo, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AgentMessage } from '../../types';
import { ArrowUpRight, Activity } from 'lucide-react';
import { Card } from '../ui/card';
import { cn } from '@/lib/utils';

interface ActionSummaryPanelProps {
    messages: AgentMessage[];
}

interface ActionData {
    type: 'price' | 'swap' | 'transfer' | 'order' | 'balance' | 'info' | 'error';
    title: string;
    details: string;
    subDetails?: string;
    timestamp: number;
    tx?: string;
}

export const ActionSummaryPanel: React.FC<ActionSummaryPanelProps> = ({ messages }) => {
    const scrollRef = useRef<HTMLDivElement>(null);

    const actions = useMemo<ActionData[]>(() => {
        const extractedActions: ActionData[] = [];

        messages.forEach(msg => {
            if (msg.role === 'model' && msg.toolResults && msg.toolResults.length > 0) {
                msg.toolResults.forEach(result => {
                    if (result.type === 'error') return;

                    const title = result.title || '';
                    const details = result.details || '';

                    if (title.includes('Swap') || title.includes('Order') || title.includes('Transfer') ||
                        title.includes('Withdraw') || title.includes('Position') || title.includes('Leverage')) {
                        let type: ActionData['type'] = 'info';
                        if (title.includes('Swap')) type = 'swap';
                        else if (title.includes('Order') || title.includes('Position') || title.includes('Leverage')) type = 'order';
                        else if (title.includes('Transfer') || title.includes('Withdraw')) type = 'transfer';

                        extractedActions.push({
                            type,
                            title,
                            details: details.split('\n')[0] || details,
                            subDetails: result.tx ? 'Transaction Executed' : undefined,
                            timestamp: msg.timestamp,
                            tx: result.tx
                        });
                    } else if (title.includes('Task') || title.includes('Scheduled')) {
                        extractedActions.push({ type: 'info', title, details, timestamp: msg.timestamp });
                    } else if (title.includes('Price') || title.includes('OHLCV') || title.includes('Indicator') ||
                        title.includes('TradingView') || title.includes('Summary') || title.includes('Market Data')) {
                        extractedActions.push({ type: 'price', title, details, timestamp: msg.timestamp });
                    } else if (title.includes('Balance')) {
                        extractedActions.push({
                            type: 'balance',
                            title: 'Balance Checked',
                            details: details.split('\n')[0],
                            subDetails: 'View specific assets in chat',
                            timestamp: msg.timestamp
                        });
                    } else {
                        extractedActions.push({
                            type: 'info',
                            title,
                            details: details.substring(0, 100) + (details.length > 100 ? '...' : ''),
                            timestamp: msg.timestamp
                        });
                    }
                });
            }
        });

        return extractedActions;
    }, [messages]);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
        }
    }, [actions.length]);

    if (actions.length === 0) return null;

    return (
        <div ref={scrollRef} className="w-full h-full overflow-y-auto pr-1 custom-scrollbar space-y-3 pb-4">
            <div className="flex items-center gap-2 mb-2 px-1 sticky top-0 bg-slate-900/90 backdrop-blur-sm py-2 z-10">
                <Activity size={12} className="text-indigo-400" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Activity Feed
                </span>
            </div>

            <AnimatePresence>
                {actions.map((action, idx) => {
                    const txHash = action.tx;
                    const isHyperliquid = action.title.includes('Hyperliquid') || action.title.includes('Order');
                    const explorerUrl = txHash
                        ? isHyperliquid
                            ? `https://app.hyperliquid.xyz/explorer/tx/${txHash}`
                            : `https://solscan.io/tx/${txHash}`
                        : null;

                    return (
                        <motion.div
                            key={`${action.timestamp}-${idx}`}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.05 }}
                        >
                            <Card className="p-3 relative overflow-hidden group hover:border-indigo-500/30 transition-all duration-300">
                                <div className="absolute top-0 right-0 w-12 h-12 bg-indigo-500/5 rounded-full blur-xl -z-10 transition-all duration-700 group-hover:bg-indigo-500/10" />

                                <div className="flex items-center justify-between mb-1.5">
                                    <div className="flex items-center gap-1.5">
                                        <div className={cn("w-1 h-1 rounded-full", action.type === 'error' ? 'bg-red-500' : 'bg-indigo-500')} />
                                        <span className="text-[9px] text-slate-600 font-mono">
                                            {new Date(action.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>
                                </div>

                                <div className="space-y-1">
                                    <h3 className="text-xs font-bold text-white leading-tight">{action.title}</h3>

                                    <div className="py-1">
                                        {action.type === 'swap' ? (
                                            <div className="bg-slate-800/50 rounded-lg p-2 border border-slate-700/50">
                                                <p className="text-[10px] text-slate-300 font-medium">{action.details}</p>
                                            </div>
                                        ) : action.type === 'price' && action.details.includes(':') && !action.details.includes('\n') ? (
                                            <div className="flex flex-col gap-0.5">
                                                <div className="text-lg font-bold text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-300">
                                                    {action.details.split(':')[1]?.trim()}
                                                </div>
                                                <div className="text-[10px] text-slate-400 font-medium">
                                                    {action.details.split(':')[0]}
                                                </div>
                                            </div>
                                        ) : (
                                            <p className="text-[10px] text-slate-300 font-medium">{action.details}</p>
                                        )}
                                    </div>

                                    <div className="flex items-center justify-between mt-1 pt-1 border-t border-slate-800/50">
                                        {action.subDetails && !txHash && (
                                            <div className="flex items-center gap-1.5 text-[10px] text-emerald-400 font-medium">
                                                {action.subDetails}
                                            </div>
                                        )}

                                        {txHash && (
                                            <a
                                                href={explorerUrl || '#'}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex items-center gap-1.5 text-[10px] text-indigo-400 hover:text-indigo-300 transition-colors group/link ml-auto"
                                            >
                                                View Transaction
                                                <ArrowUpRight size={10} className="group-hover/link:translate-x-0.5 group-hover/link:-translate-y-0.5 transition-transform" />
                                            </a>
                                        )}
                                    </div>
                                </div>
                            </Card>
                        </motion.div>
                    );
                })}
            </AnimatePresence>
        </div>
    );
};
