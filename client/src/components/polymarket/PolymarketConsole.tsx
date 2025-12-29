// src/components/polymarket/PolymarketConsole.tsx
// Execution console for Polymarket Dealer - follows DealerConsole.tsx pattern

import React, { useState, useRef, useEffect } from 'react';
import { Terminal, Trash2, Filter, AlertTriangle, CheckCircle, Info, Zap, Brain } from 'lucide-react';
import { PolymarketLog } from '../../state/polymarketStore';

interface PolymarketConsoleProps {
    logs: PolymarketLog[];
    onClearLogs: () => void;
}

const LOG_TYPE_STYLES: Record<PolymarketLog['type'], { icon: React.ElementType; color: string; bg: string }> = {
    INFO: { icon: Info, color: 'text-blue-400', bg: 'bg-blue-500/10' },
    WARNING: { icon: AlertTriangle, color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
    ERROR: { icon: AlertTriangle, color: 'text-red-400', bg: 'bg-red-500/10' },
    TRADE: { icon: Zap, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    SIGNAL: { icon: CheckCircle, color: 'text-purple-400', bg: 'bg-purple-500/10' },
    REASONING: { icon: Brain, color: 'text-cyan-400', bg: 'bg-cyan-500/10' }
};

export const PolymarketConsole: React.FC<PolymarketConsoleProps> = ({ logs, onClearLogs }) => {
    const [filter, setFilter] = useState<PolymarketLog['type'] | 'ALL'>('ALL');
    const consoleRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to top when new logs arrive
    useEffect(() => {
        if (consoleRef.current) {
            consoleRef.current.scrollTop = 0;
        }
    }, [logs]);

    const filteredLogs = filter === 'ALL' ? logs : logs.filter(log => log.type === filter);

    const formatTimestamp = (ts: number) => {
        return new Date(ts).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    };

    return (
        <div className="bg-gray-900/50 backdrop-blur-xl border border-gray-700/50 rounded-2xl overflow-hidden flex flex-col h-full">
            {/* Header */}
            <div className="flex items-center justify-between p-3 border-b border-gray-700/50 shrink-0">
                <div className="flex items-center gap-2">
                    <Terminal className="h-4 w-4 text-[#E7FE55]" />
                    <span className="text-sm font-medium text-gray-200">Polymarket Console</span>
                    <span className="text-xs text-gray-500 font-mono">({filteredLogs.length} entries)</span>
                </div>
                <div className="flex items-center gap-2">
                    {/* Filter Dropdown */}
                    <div className="relative">
                        <select
                            value={filter}
                            onChange={(e) => setFilter(e.target.value as any)}
                            className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1 text-xs text-gray-300 focus:outline-none focus:border-[#E7FE55] appearance-none pr-6 cursor-pointer"
                        >
                            <option value="ALL">All Logs</option>
                            <option value="INFO">Info</option>
                            <option value="WARNING">Warnings</option>
                            <option value="ERROR">Errors</option>
                            <option value="TRADE">Trades</option>
                            <option value="SIGNAL">Signals</option>
                            <option value="REASONING">Reasoning</option>
                        </select>
                        <Filter className="absolute right-1.5 top-1/2 -translate-y-1/2 h-3 w-3 text-gray-500 pointer-events-none" />
                    </div>
                    {/* Clear Button */}
                    <button
                        onClick={onClearLogs}
                        className="p-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-red-400 transition-colors"
                        title="Clear Logs"
                    >
                        <Trash2 className="h-3.5 w-3.5" />
                    </button>
                </div>
            </div>

            {/* Console Output */}
            <div
                ref={consoleRef}
                className="flex-1 overflow-y-auto p-2 space-y-1 font-mono text-xs custom-scrollbar"
            >
                {filteredLogs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-gray-600">
                        <Terminal className="h-8 w-8 mb-2 opacity-50" />
                        <span className="text-sm">No logs yet</span>
                        <span className="text-xs text-gray-700">Activity will appear here</span>
                    </div>
                ) : (
                    filteredLogs.map((log) => {
                        const style = LOG_TYPE_STYLES[log.type];
                        const Icon = style.icon;

                        return (
                            <div
                                key={log.id}
                                className={`flex items-start gap-2 p-2 rounded-lg ${style.bg} border border-gray-800/50 hover:border-gray-700/50 transition-colors`}
                            >
                                <Icon className={`h-3.5 w-3.5 mt-0.5 shrink-0 ${style.color}`} />
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-0.5">
                                        <span className="text-gray-500 text-[10px]">
                                            {formatTimestamp(log.timestamp)}
                                        </span>
                                        <span className={`text-[9px] font-bold uppercase ${style.color}`}>
                                            {log.type}
                                        </span>
                                    </div>
                                    <p className="text-gray-300 break-words leading-relaxed">
                                        {log.message}
                                    </p>
                                    {log.details && (
                                        <pre className="mt-1 p-1.5 bg-gray-900/50 rounded text-[10px] text-gray-500 overflow-x-auto">
                                            {typeof log.details === 'string'
                                                ? log.details
                                                : JSON.stringify(log.details, null, 2).slice(0, 500)}
                                        </pre>
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
