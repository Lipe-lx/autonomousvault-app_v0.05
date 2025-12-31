// SolanaDealerLogPage.tsx
// Audit log view for LP operations - Following app design patterns

import React, { useState, useMemo } from 'react';
import { 
    FileText, 
    Filter,
    ChevronDown,
    ChevronUp,
    CheckCircle2,
    XCircle,
    Clock,
    AlertTriangle,
    ExternalLink,
    Search,
    Download
} from 'lucide-react';
import { LPAuditEntry, LPOperationScope, LP_SCOPE_METADATA } from '../../types/solanaLPTypes';

interface SolanaDealerLogPageProps {
    auditLog: LPAuditEntry[];
}

export const SolanaDealerLogPage: React.FC<SolanaDealerLogPageProps> = ({
    auditLog
}) => {
    const [filterScope, setFilterScope] = useState<LPOperationScope | 'all'>('all');
    const [filterStatus, setFilterStatus] = useState<LPAuditEntry['status'] | 'all'>('all');
    const [expandedEntry, setExpandedEntry] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    // Filter entries
    const filteredEntries = useMemo(() => {
        return auditLog.filter(entry => {
            if (filterScope !== 'all' && entry.scope !== filterScope) return false;
            if (filterStatus !== 'all' && entry.status !== filterStatus) return false;
            if (searchQuery && !entry.action.toLowerCase().includes(searchQuery.toLowerCase()) &&
                !entry.poolName?.toLowerCase().includes(searchQuery.toLowerCase())) return false;
            return true;
        });
    }, [auditLog, filterScope, filterStatus, searchQuery]);

    // Stats
    const stats = useMemo(() => {
        const executed = auditLog.filter(e => e.status === 'executed').length;
        const failed = auditLog.filter(e => e.status === 'failed' || e.status === 'rejected').length;
        const pending = auditLog.filter(e => e.status === 'pending' || e.status === 'confirmed').length;
        return { executed, failed, pending, total: auditLog.length };
    }, [auditLog]);

    // Export logs
    const exportLogs = () => {
        const dataStr = JSON.stringify(auditLog, null, 2);
        const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
        const exportFileDefaultName = `solana_audit_log_${new Date().toISOString()}.json`;
        const linkElement = document.createElement('a');
        linkElement.setAttribute('href', dataUri);
        linkElement.setAttribute('download', exportFileDefaultName);
        linkElement.click();
    };

    // Status icon
    const getStatusIcon = (status: LPAuditEntry['status']) => {
        switch (status) {
            case 'executed':
                return <CheckCircle2 size={14} className="text-[#10b981]" />;
            case 'failed':
            case 'rejected':
                return <XCircle size={14} className="text-[#ef4444]" />;
            case 'pending':
            case 'confirmed':
                return <Clock size={14} className="text-[#f59e0b]" />;
            default:
                return null;
        }
    };

    // Status color
    const getStatusColor = (status: LPAuditEntry['status']) => {
        switch (status) {
            case 'executed': return 'text-[#10b981] bg-[#10b981]/15 border-[#10b981]/30';
            case 'failed': return 'text-[#ef4444] bg-[#ef4444]/15 border-[#ef4444]/30';
            case 'rejected': return 'text-[#ef4444] bg-[#ef4444]/15 border-[#ef4444]/30';
            case 'pending': return 'text-[#f59e0b] bg-[#f59e0b]/15 border-[#f59e0b]/30';
            case 'confirmed': return 'text-[#3b82f6] bg-[#3b82f6]/15 border-[#3b82f6]/30';
            default: return 'text-[#747580] bg-[#747580]/15 border-[#747580]/30';
        }
    };

    return (
        <div className="flex flex-col h-full gap-4 overflow-hidden">
            
            {/* Header Card */}
            <div className="glass-panel p-5 rounded shrink-0">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-[#E7FE55]/10">
                            <FileText size={20} className="text-[#E7FE55]" />
                        </div>
                        <div>
                            <h2 className="text-sm font-semibold text-white">Audit Log</h2>
                            <p className="text-[10px] text-[#747580] uppercase tracking-wider">
                                {stats.total} total entries
                            </p>
                        </div>
                    </div>

                    <button
                        onClick={exportLogs}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1a1b21] hover:bg-[#232328] rounded text-[10px] text-[#a0a1a8] hover:text-white transition-colors border border-[#232328]"
                    >
                        <Download size={12} />
                        Export
                    </button>
                </div>

                {/* Stats Row */}
                <div className="grid grid-cols-4 gap-3">
                    <div className="bg-[#0f1015] rounded p-3 border border-[#232328]">
                        <div className="text-[9px] text-[#747580] uppercase tracking-wider mb-1">Total</div>
                        <div className="text-lg font-semibold text-white font-mono">{stats.total}</div>
                    </div>
                    <div className="bg-[#0f1015] rounded p-3 border border-[#232328]">
                        <div className="text-[9px] text-[#747580] uppercase tracking-wider mb-1">Executed</div>
                        <div className="text-lg font-semibold text-[#10b981] font-mono">{stats.executed}</div>
                    </div>
                    <div className="bg-[#0f1015] rounded p-3 border border-[#232328]">
                        <div className="text-[9px] text-[#747580] uppercase tracking-wider mb-1">Failed</div>
                        <div className="text-lg font-semibold text-[#ef4444] font-mono">{stats.failed}</div>
                    </div>
                    <div className="bg-[#0f1015] rounded p-3 border border-[#232328]">
                        <div className="text-[9px] text-[#747580] uppercase tracking-wider mb-1">Pending</div>
                        <div className="text-lg font-semibold text-[#f59e0b] font-mono">{stats.pending}</div>
                    </div>
                </div>
            </div>

            {/* Filters Card */}
            <div className="glass-panel p-4 rounded shrink-0">
                <div className="flex flex-wrap items-center gap-3">
                    {/* Search */}
                    <div className="relative flex-1 min-w-[200px]">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#747580]" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search actions or pools..."
                            className="w-full pl-9 pr-3 py-2 bg-[#0f1015] border border-[#232328] rounded text-white text-sm focus:outline-none focus:border-[#E7FE55]"
                        />
                    </div>

                    {/* Scope Filter */}
                    <div className="flex items-center gap-2">
                        <Filter size={14} className="text-[#747580]" />
                        <select
                            value={filterScope}
                            onChange={(e) => setFilterScope(e.target.value as any)}
                            className="px-3 py-2 bg-[#0f1015] border border-[#232328] rounded text-white text-sm focus:outline-none focus:border-[#E7FE55]"
                        >
                            <option value="all">All Scopes</option>
                            {(Object.keys(LP_SCOPE_METADATA) as LPOperationScope[]).map(scope => (
                                <option key={scope} value={scope}>
                                    {LP_SCOPE_METADATA[scope].label}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Status Filter */}
                    <select
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value as any)}
                        className="px-3 py-2 bg-[#0f1015] border border-[#232328] rounded text-white text-sm focus:outline-none focus:border-[#E7FE55]"
                    >
                        <option value="all">All Status</option>
                        <option value="executed">Executed</option>
                        <option value="pending">Pending</option>
                        <option value="confirmed">Confirmed</option>
                        <option value="rejected">Rejected</option>
                        <option value="failed">Failed</option>
                    </select>

                    <span className="text-[10px] text-[#747580] font-mono">
                        {filteredEntries.length} / {auditLog.length}
                    </span>
                </div>
            </div>

            {/* Log Entries Card */}
            <div className="glass-panel rounded flex-1 min-h-0 overflow-hidden">
                {filteredEntries.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-[#747580] gap-3 py-12">
                        <FileText className="h-10 w-10 opacity-30" />
                        <p className="text-sm">No audit entries found</p>
                        <p className="text-[11px] text-[#5a5b63]">LP operations will be logged here</p>
                    </div>
                ) : (
                    <div className="h-full overflow-y-auto custom-scrollbar divide-y divide-[#232328]">
                        {filteredEntries.map((entry) => (
                            <div key={entry.id} className="hover:bg-[#1a1b21]/50 transition-colors">
                                {/* Entry Header */}
                                <button
                                    onClick={() => setExpandedEntry(
                                        expandedEntry === entry.id ? null : entry.id
                                    )}
                                    className="w-full px-5 py-4 flex items-center justify-between"
                                >
                                    <div className="flex items-center gap-4">
                                        {getStatusIcon(entry.status)}
                                        <div className="text-left">
                                            <div className="text-sm text-white font-medium">
                                                {entry.action}
                                            </div>
                                            <div className="text-[10px] text-[#747580] flex items-center gap-2">
                                                <span className="px-1.5 py-0.5 rounded bg-[#232328] text-[9px] uppercase">
                                                    {LP_SCOPE_METADATA[entry.scope]?.label}
                                                </span>
                                                <span>•</span>
                                                <span>{entry.poolName || entry.poolAddress?.slice(0, 8) || 'N/A'}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-4">
                                        <div className="text-right">
                                            <div className={`px-2 py-0.5 rounded text-[9px] font-semibold uppercase border ${getStatusColor(entry.status)}`}>
                                                {entry.status}
                                            </div>
                                            <div className="text-[10px] text-[#747580] mt-1 font-mono">
                                                {new Date(entry.timestamp).toLocaleString([], { 
                                                    month: 'short', 
                                                    day: 'numeric', 
                                                    hour: '2-digit', 
                                                    minute: '2-digit' 
                                                })}
                                            </div>
                                        </div>
                                        {expandedEntry === entry.id ? (
                                            <ChevronUp size={16} className="text-[#747580]" />
                                        ) : (
                                            <ChevronDown size={16} className="text-[#747580]" />
                                        )}
                                    </div>
                                </button>

                                {/* Entry Details */}
                                {expandedEntry === entry.id && (
                                    <div className="px-5 pb-4 pt-0 space-y-4">
                                        {/* Rationale */}
                                        {entry.rationale && (
                                            <div className="bg-[#0f1015] rounded p-4 border border-[#232328]">
                                                <div className="text-[9px] uppercase tracking-wider text-[#E7FE55] mb-2 font-semibold">
                                                    Rationale
                                                </div>
                                                <p className="text-[13px] text-[#a0a1a8] italic leading-relaxed">
                                                    "{entry.rationale}"
                                                </p>
                                            </div>
                                        )}

                                        {/* Policy Violations */}
                                        {entry.policyViolations && entry.policyViolations.length > 0 && (
                                            <div className="bg-[#ef4444]/5 border border-[#ef4444]/30 rounded p-4">
                                                <div className="flex items-center gap-2 mb-3">
                                                    <AlertTriangle size={14} className="text-[#ef4444]" />
                                                    <span className="text-[10px] font-semibold text-[#ef4444] uppercase tracking-wider">
                                                        Policy Violations
                                                    </span>
                                                </div>
                                                <ul className="text-[12px] text-[#ef4444]/80 space-y-1">
                                                    {entry.policyViolations.map((v, i) => (
                                                        <li key={i} className="flex items-start gap-2">
                                                            <span className="text-[#ef4444]">•</span>
                                                            {v}
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}

                                        {/* Parameters */}
                                        {Object.keys(entry.params).length > 0 && (
                                            <div>
                                                <div className="text-[9px] uppercase tracking-wider text-[#747580] mb-2 font-semibold">
                                                    Parameters
                                                </div>
                                                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                                    {Object.entries(entry.params).map(([key, value]) => (
                                                        <div key={key} className="bg-[#0f1015] rounded px-3 py-2 border border-[#232328]">
                                                            <span className="text-[9px] text-[#747580] uppercase">{key}</span>
                                                            <div className="text-[12px] text-white font-mono truncate">
                                                                {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Transaction */}
                                        {entry.txSignature && (
                                            <div className="flex items-center gap-3 pt-2 border-t border-[#232328]">
                                                <span className="text-[9px] uppercase tracking-wider text-[#747580]">
                                                    Transaction
                                                </span>
                                                <a
                                                    href={`https://explorer.solana.com/tx/${entry.txSignature}?cluster=devnet`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="flex items-center gap-1 text-[11px] text-[#3b82f6] hover:text-[#60a5fa] transition-colors font-mono"
                                                >
                                                    {entry.txSignature.slice(0, 16)}...{entry.txSignature.slice(-8)}
                                                    <ExternalLink size={10} />
                                                </a>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};
