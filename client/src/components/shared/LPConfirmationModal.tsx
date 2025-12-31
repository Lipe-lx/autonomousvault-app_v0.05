// LPConfirmationModal.tsx
// Semantic confirmation modal for sensitive LP operations

import React from 'react';
import { X, AlertTriangle, Shield, Info, Droplets } from 'lucide-react';
import { LPOperationScope, LP_SCOPE_METADATA } from '../../types/solanaLPTypes';

export interface LPConfirmationData {
    scope: LPOperationScope;
    action: string;
    poolAddress?: string;
    poolName?: string;
    params: Record<string, any>;
    rationale: string;
    warnings?: string[];
}

interface LPConfirmationModalProps {
    isOpen: boolean;
    data: LPConfirmationData | null;
    onConfirm: () => void;
    onCancel: () => void;
}

export const LPConfirmationModal: React.FC<LPConfirmationModalProps> = ({
    isOpen,
    data,
    onConfirm,
    onCancel
}) => {
    if (!isOpen || !data) return null;

    const scopeMeta = LP_SCOPE_METADATA[data.scope];
    const riskLevel = scopeMeta?.riskLevel || 'medium';

    const getRiskColor = () => {
        switch (riskLevel) {
            case 'high': return 'text-[#ef4444]';
            case 'medium': return 'text-[#f59e0b]';
            case 'low': return 'text-[#10b981]';
        }
    };

    const getRiskBg = () => {
        switch (riskLevel) {
            case 'high': return 'bg-[#ef4444]/10 border-[#ef4444]/30';
            case 'medium': return 'bg-[#f59e0b]/10 border-[#f59e0b]/30';
            case 'low': return 'bg-[#10b981]/10 border-[#10b981]/30';
        }
    };

    return (
        <>
            {/* Backdrop */}
            <div 
                className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
                onClick={onCancel}
            />
            
            {/* Modal */}
            <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-full max-w-md z-50">
                <div className="bg-[#14151a] border border-[#232328] rounded-xl shadow-2xl overflow-hidden">
                    {/* Header */}
                    <div className={`px-5 py-4 border-b border-[#232328] flex items-center justify-between ${getRiskBg()}`}>
                        <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${riskLevel === 'high' ? 'bg-[#ef4444]/20' : riskLevel === 'medium' ? 'bg-[#f59e0b]/20' : 'bg-[#10b981]/20'}`}>
                                <AlertTriangle size={20} className={getRiskColor()} />
                            </div>
                            <div>
                                <h3 className="text-white font-semibold">Confirm LP Operation</h3>
                                <p className={`text-xs uppercase tracking-wider ${getRiskColor()}`}>
                                    {riskLevel} risk
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={onCancel}
                            className="text-[#747580] hover:text-white transition-colors"
                        >
                            <X size={20} />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="px-5 py-4 space-y-4">
                        {/* Action */}
                        <div>
                            <div className="text-[10px] uppercase tracking-wider text-[#747580] mb-1">
                                Action
                            </div>
                            <div className="flex items-center gap-2">
                                <Shield size={14} className="text-[#E7FE55]" />
                                <span className="text-white font-medium">{scopeMeta?.label || data.scope}</span>
                            </div>
                            <p className="text-sm text-[#a0a1a8] mt-1">{data.action}</p>
                        </div>

                        {/* Pool */}
                        {data.poolName && (
                            <div>
                                <div className="text-[10px] uppercase tracking-wider text-[#747580] mb-1">
                                    Pool
                                </div>
                                <div className="flex items-center gap-2">
                                    <Droplets size={14} className="text-[#3b82f6]" />
                                    <span className="text-white">{data.poolName}</span>
                                </div>
                                {data.poolAddress && (
                                    <p className="text-xs text-[#5a5b63] font-mono mt-0.5">
                                        {data.poolAddress.slice(0, 20)}...{data.poolAddress.slice(-8)}
                                    </p>
                                )}
                            </div>
                        )}

                        {/* Parameters */}
                        {Object.keys(data.params).length > 0 && (
                            <div>
                                <div className="text-[10px] uppercase tracking-wider text-[#747580] mb-2">
                                    Parameters
                                </div>
                                <div className="bg-[#1a1b21] rounded-lg p-3 space-y-1.5">
                                    {Object.entries(data.params).map(([key, value]) => (
                                        <div key={key} className="flex justify-between text-sm">
                                            <span className="text-[#747580]">{key}</span>
                                            <span className="text-white font-medium">
                                                {typeof value === 'number' 
                                                    ? value.toLocaleString(undefined, { maximumFractionDigits: 4 })
                                                    : String(value)}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Rationale */}
                        <div className="bg-[#1a1b21] rounded-lg p-3 border-l-2 border-[#E7FE55]">
                            <div className="flex items-start gap-2">
                                <Info size={14} className="text-[#E7FE55] mt-0.5 flex-shrink-0" />
                                <div>
                                    <div className="text-[10px] uppercase tracking-wider text-[#747580] mb-1">
                                        Rationale
                                    </div>
                                    <p className="text-sm text-[#a0a1a8] italic">
                                        "{data.rationale}"
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Warnings */}
                        {data.warnings && data.warnings.length > 0 && (
                            <div className="bg-[#f59e0b]/10 border border-[#f59e0b]/30 rounded-lg p-3">
                                <div className="flex items-start gap-2">
                                    <AlertTriangle size={14} className="text-[#f59e0b] mt-0.5 flex-shrink-0" />
                                    <div>
                                        <div className="text-xs font-medium text-[#f59e0b] mb-1">
                                            Warnings
                                        </div>
                                        <ul className="text-xs text-[#f59e0b]/80 space-y-0.5">
                                            {data.warnings.map((w, i) => (
                                                <li key={i}>• {w}</li>
                                            ))}
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Actions */}
                    <div className="px-5 py-4 border-t border-[#232328] flex gap-3">
                        <button
                            onClick={onCancel}
                            className="flex-1 px-4 py-2.5 bg-[#1a1b21] hover:bg-[#232328] text-[#a0a1a8] hover:text-white rounded-lg text-sm font-medium transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={onConfirm}
                            className="flex-1 px-4 py-2.5 bg-[#E7FE55] hover:bg-[#d4eb4c] text-black rounded-lg text-sm font-medium transition-colors"
                        >
                            Confirm & Execute
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
};
