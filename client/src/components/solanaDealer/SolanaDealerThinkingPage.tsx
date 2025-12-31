// SolanaDealerThinkingPage.tsx
// Real-time logs and reasoning display - Following Hyperliquid Dealer design

import React, { useState, useRef } from 'react';
import { 
    Brain,
    Info,
    AlertTriangle,
    XCircle,
    Zap,
    Shield,
    Trash2,
    Download,
    ScrollText,
    Terminal,
    ChevronDown,
    ChevronRight
} from 'lucide-react';
import { SolanaDealerLog } from '../../types/solanaLPTypes';
import { solanaDealerStore } from '../../state/solanaDealerStore';

interface SolanaDealerThinkingPageProps {
    logs: SolanaDealerLog[];
}

// Collapsible log item component
const CollapsibleLogItem: React.FC<{
    log: SolanaDealerLog;
    index: number;
}> = ({ log, index }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const hasDetails = log.details && (typeof log.details === 'object' ? Object.keys(log.details).length > 0 : true);

    const getLogIcon = (type: SolanaDealerLog['type']) => {
        switch (type) {
            case 'ERROR':
                return <XCircle size={14} className="text-[#ef4444]" />;
            case 'WARNING':
                return <AlertTriangle size={14} className="text-[#f59e0b]" />;
            case 'OPERATION':
                return <Zap size={14} className="text-[#3b82f6]" />;
            case 'POLICY':
                return <Shield size={14} className="text-[#a855f7]" />;
            default:
                return <Info size={14} className="text-[#747580]" />;
        }
    };

    const getLogBadgeClass = (type: SolanaDealerLog['type']) => {
        switch (type) {
            case 'ERROR': return 'bg-[#ef4444]/15 text-[#ef4444] border-[#ef4444]/30';
            case 'WARNING': return 'bg-[#f59e0b]/15 text-[#f59e0b] border-[#f59e0b]/30';
            case 'OPERATION': return 'bg-[#3b82f6]/15 text-[#3b82f6] border-[#3b82f6]/30';
            case 'POLICY': return 'bg-[#a855f7]/15 text-[#a855f7] border-[#a855f7]/30';
            default: return 'bg-[#747580]/15 text-[#747580] border-[#747580]/30';
        }
    };

    return (
        <div
            className="flex gap-3 p-3 hover:bg-[#1a1b21] rounded border-b border-[#232328] last:border-0 transition-colors"
        >
            <span className="text-[#747580] shrink-0 text-[10px] mt-0.5 font-mono">
                {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    {getLogIcon(log.type)}
                    <span className={`px-1.5 py-0.5 rounded text-[9px] uppercase tracking-wider font-medium border ${getLogBadgeClass(log.type)}`}>
                        {log.type}
                    </span>
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
                {hasDetails && isExpanded && (
                    <pre className="mt-2 text-[10px] text-[#747580] bg-[#0f1015] p-3 rounded overflow-x-auto max-h-[300px] overflow-y-auto custom-scrollbar border border-[#232328] font-mono">
                        {typeof log.details === 'string' 
                            ? log.details 
                            : JSON.stringify(log.details, null, 2)}
                    </pre>
                )}
            </div>
        </div>
    );
};

// Reasoning display component
const ReasoningView: React.FC<{ logs: SolanaDealerLog[] }> = ({ logs }) => {
    const reasoningLogs = logs.filter(log => 
        log.type === 'POLICY' || log.type === 'OPERATION' || log.message.toLowerCase().includes('analyzing')
    );

    if (reasoningLogs.length === 0) {
        return (
            <div className="h-full flex flex-col items-center justify-center text-[#747580] gap-3 py-12">
                <Brain className="h-10 w-10 opacity-30" />
                <p className="text-sm">No reasoning activity yet</p>
                <p className="text-xs text-[#5a5b63]">AI analysis will appear here during operations</p>
            </div>
        );
    }

    return (
        <div className="p-4 space-y-4">
            {reasoningLogs.slice(0, 20).map((log, idx) => (
                <div key={log.id} className={`p-4 rounded-lg border-l-2 ${
                    log.type === 'POLICY' ? 'bg-[#a855f7]/5 border-[#a855f7]' :
                    log.type === 'OPERATION' ? 'bg-[#3b82f6]/5 border-[#3b82f6]' :
                    'bg-[#E7FE55]/5 border-[#E7FE55]'
                }`}>
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                            {log.type === 'POLICY' ? (
                                <Shield size={14} className="text-[#a855f7]" />
                            ) : log.type === 'OPERATION' ? (
                                <Zap size={14} className="text-[#3b82f6]" />
                            ) : (
                                <Brain size={14} className="text-[#E7FE55]" />
                            )}
                            <span className={`text-[10px] font-medium uppercase ${
                                log.type === 'POLICY' ? 'text-[#a855f7]' :
                                log.type === 'OPERATION' ? 'text-[#3b82f6]' :
                                'text-[#E7FE55]'
                            }`}>{log.type}</span>
                        </div>
                        <span className="text-[10px] text-[#747580] font-mono">
                            {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                    </div>
                    <p className="text-[13px] text-[#a0a1a8] leading-relaxed">{log.message}</p>
                    {log.details && (
                        <div className="mt-3 pt-3 border-t border-[#232328]">
                            <pre className="text-[10px] text-[#747580] font-mono overflow-x-auto">
                                {typeof log.details === 'string' ? log.details : JSON.stringify(log.details, null, 2)}
                            </pre>
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
};

export const SolanaDealerThinkingPage: React.FC<SolanaDealerThinkingPageProps> = ({
    logs
}) => {
    const [activeTab, setActiveTab] = useState<'thinking' | 'logs'>('thinking');
    const scrollRef = useRef<HTMLDivElement>(null);

    const handleClearLogs = () => {
        solanaDealerStore.clearLogs();
    };

    const exportLogs = () => {
        const dataStr = JSON.stringify(logs, null, 2);
        const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
        const exportFileDefaultName = `solana_dealer_logs_${new Date().toISOString()}.json`;
        const linkElement = document.createElement('a');
        linkElement.setAttribute('href', dataUri);
        linkElement.setAttribute('download', exportFileDefaultName);
        linkElement.click();
    };

    return (
        <div className="flex flex-col h-full gap-4 overflow-hidden">
            {/* Tab Selector Card */}
            <div className="glass-panel p-4 rounded shrink-0">
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
                            {logs.length > 0 && (
                                <span className="bg-white/20 px-1.5 py-0.5 rounded text-[9px]">
                                    {logs.length}
                                </span>
                            )}
                        </button>
                    </div>

                    {activeTab === 'logs' && (
                        <div className="flex items-center gap-2">
                            <button
                                onClick={handleClearLogs}
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
                        </div>
                    )}
                </div>
            </div>

            {/* Content Card */}
            <div className="glass-panel rounded flex-1 min-h-0 overflow-hidden flex flex-col">
                {activeTab === 'thinking' && (
                    <div className="flex-1 overflow-y-auto custom-scrollbar">
                        <ReasoningView logs={logs} />
                    </div>
                )}

                {activeTab === 'logs' && (
                    <div
                        ref={scrollRef}
                        className="flex-1 overflow-y-auto custom-scrollbar"
                    >
                        {logs.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-[#747580] gap-3 py-12">
                                <Terminal className="h-10 w-10 opacity-30" />
                                <p className="text-sm">No operations recorded yet.</p>
                            </div>
                        ) : (
                            <div className="p-2">
                                {logs.map((log, index) => (
                                    <CollapsibleLogItem
                                        key={log.id}
                                        log={log}
                                        index={index}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};
