// src/components/polymarket/PolymarketThinkingPage.tsx
// Thinking/Reasoning page for Polymarket Dealer - follows DealerThinkingPage.tsx pattern exactly

import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ScrollText, Download, Trash2, Brain, Terminal, ChevronDown, ChevronRight } from 'lucide-react';
import { PolymarketState, PolymarketLog } from '../../state/polymarketStore';
import { PolymarketReasoningLog } from './PolymarketReasoningLog';
import { Badge } from '../ui/badge';
import { cn } from '@/lib/utils';

interface PolymarketThinkingPageProps {
    status: PolymarketState;
    onClearLogs: () => void;
}

// Collapsible log item component
const CollapsibleLogItem: React.FC<{
    log: PolymarketLog;
    index: number;
    getLogBadgeVariant: (type: string) => string;
}> = ({ log, index, getLogBadgeVariant }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const hasDetails = log.details && Object.keys(log.details).length > 0;

    return (
        <motion.div
            key={log.id}
            className="flex gap-3 p-3 hover:bg-[#1a1b21] rounded border-b border-[#232328] last:border-0 transition-colors"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.02 }}
        >
            <span className="text-[#747580] shrink-0 text-[10px] mt-0.5 font-mono">
                {new Date(log.timestamp).toLocaleTimeString()}
            </span>
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    <Badge variant={getLogBadgeVariant(log.type) as any} className="text-[9px] uppercase tracking-wider">
                        {log.type}
                    </Badge>
                    <span className="text-[#a0a1a8] flex-1 text-sm truncate">{log.message}</span>
                    {hasDetails && (
                        <button
                            onClick={() => setIsExpanded(!isExpanded)}
                            className="text-[#747580] hover:text-white transition-colors p-1 rounded hover:bg-[#232328]"
                            title={isExpanded ? "Collapse details" : "Expand details"}
                        >
                            {isExpanded ? (
                                <ChevronDown className="h-4 w-4" />
                            ) : (
                                <ChevronRight className="h-4 w-4" />
                            )}
                        </button>
                    )}
                </div>
                <AnimatePresence>
                    {hasDetails && isExpanded && (
                        <motion.pre
                            className="mt-2 text-[10px] text-[#747580] bg-[#0f1015] p-3 rounded overflow-x-auto max-h-[300px] overflow-y-auto custom-scrollbar border border-[#232328] font-mono"
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.2 }}
                        >
                            {JSON.stringify(log.details, null, 2)}
                        </motion.pre>
                    )}
                </AnimatePresence>
            </div>
        </motion.div>
    );
};

export const PolymarketThinkingPage: React.FC<PolymarketThinkingPageProps> = ({ status, onClearLogs }) => {
    const [activeTab, setActiveTab] = useState<'thinking' | 'logs'>('thinking');
    const scrollRef = useRef<HTMLDivElement>(null);

    // Error state check after hooks
    if (!status) return <div className="p-4 text-red-500">Error: Status not available</div>;

    const exportLogs = () => {
        const dataStr = JSON.stringify(status.logs, null, 2);
        const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
        const exportFileDefaultName = `polymarket_logs_${new Date().toISOString()}.json`;
        const linkElement = document.createElement('a');
        linkElement.setAttribute('href', dataUri);
        linkElement.setAttribute('download', exportFileDefaultName);
        linkElement.click();
    };

    const getLogBadgeVariant = (type: string) => {
        switch (type) {
            case 'INFO': return 'info';
            case 'WARNING': return 'warning';
            case 'ERROR': return 'destructive';
            case 'TRADE': return 'success';
            case 'SIGNAL': return 'purple';
            case 'REASONING': return 'secondary';
            default: return 'secondary';
        }
    };

    return (
        <div className="flex flex-col h-full gap-4 overflow-hidden p-4">
            {/* Tab Selector Card */}
            <div className="glass-panel p-4 shrink-0">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 bg-[#1a1b21] p-1 rounded border border-[#232328]">
                        <button
                            onClick={() => setActiveTab('thinking')}
                            className={`flex items-center gap-2 px-4 py-2 rounded text-[11px] font-medium uppercase tracking-[0.05em] transition-colors ${activeTab === 'thinking'
                                ? 'bg-[#E7FE55] text-black'
                                : 'text-[#747580] hover:text-[#a0a1a8]'
                                }`}
                        >
                            <Brain className="h-4 w-4" />
                            Thinking
                        </button>
                        <button
                            onClick={() => setActiveTab('logs')}
                            className={`flex items-center gap-2 px-4 py-2 rounded text-[11px] font-medium uppercase tracking-[0.05em] transition-colors ${activeTab === 'logs'
                                ? 'bg-[#E7FE55] text-black'
                                : 'text-[#747580] hover:text-[#a0a1a8]'
                                }`}
                        >
                            <ScrollText className="h-4 w-4" />
                            Activity Log
                            {status.logs.length > 0 && (
                                <span className="bg-white/20 px-1.5 py-0.5 rounded text-[9px]">
                                    {status.logs.length}
                                </span>
                            )}
                        </button>
                    </div>

                    <AnimatePresence>
                        {activeTab === 'logs' && (
                            <motion.div
                                className="flex items-center gap-2"
                                initial={{ opacity: 0, x: 10 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 10 }}
                            >
                                <button
                                    onClick={onClearLogs}
                                    className="p-2 rounded hover:bg-red-500/10 text-[#747580] hover:text-red-400 transition-colors border border-[#232328]"
                                    title="Clear Logs"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </button>
                                <button
                                    onClick={exportLogs}
                                    className="p-2 rounded hover:bg-[#1a1b21] text-[#747580] hover:text-white transition-colors border border-[#232328]"
                                    title="Export JSON"
                                >
                                    <Download className="h-4 w-4" />
                                </button>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>

            {/* Content Card */}
            <div className="glass-panel flex-1 min-h-0 overflow-hidden flex flex-col">
                {activeTab === 'thinking' && (
                    <PolymarketReasoningLog logs={status.logs} onClearLogs={onClearLogs} />
                )}

                {activeTab === 'logs' && (
                    <div className="flex-1 min-h-0 relative">
                        <div
                            ref={scrollRef}
                            className="absolute inset-0 overflow-y-auto custom-scrollbar"
                        >
                            {status.logs.length === 0 ? (
                                <motion.div
                                    className="h-full flex flex-col items-center justify-center text-[#747580] gap-3 py-12"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                >
                                    <Terminal className="h-10 w-10 opacity-30" />
                                    <p className="text-sm">No operations recorded yet.</p>
                                </motion.div>
                            ) : (
                                <AnimatePresence>
                                    {status.logs.map((log, index) => (
                                        <CollapsibleLogItem
                                            key={log.id}
                                            log={log}
                                            index={index}
                                            getLogBadgeVariant={getLogBadgeVariant}
                                        />
                                    ))}
                                </AnimatePresence>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
