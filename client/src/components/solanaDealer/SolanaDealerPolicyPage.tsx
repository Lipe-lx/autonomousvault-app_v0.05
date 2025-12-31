// SolanaDealerPolicyPage.tsx
// Policy Engine configuration page - Compact single-page layout

import React, { useState } from 'react';
import { 
    Shield, 
    Save, 
    RotateCcw,
    AlertTriangle,
    Check,
    X,
    Plus,
    Layers,
    Coins,
    Lock
} from 'lucide-react';
import { LPPolicyRules, DEFAULT_LP_POLICY, LPOperationScope, LP_SCOPE_METADATA } from '../../types/solanaLPTypes';
import { solanaDealerStore } from '../../state/solanaDealerStore';

interface SolanaDealerPolicyPageProps {
    policy: LPPolicyRules;
}

export const SolanaDealerPolicyPage: React.FC<SolanaDealerPolicyPageProps> = ({
    policy
}) => {
    const [localPolicy, setLocalPolicy] = useState<LPPolicyRules>(policy);
    const [newAllowToken, setNewAllowToken] = useState('');
    const [newBlockToken, setNewBlockToken] = useState('');
    const [hasChanges, setHasChanges] = useState(false);

    const updatePolicy = (updates: Partial<LPPolicyRules>) => {
        setLocalPolicy(prev => ({ ...prev, ...updates }));
        setHasChanges(true);
    };

    const handleSave = () => {
        solanaDealerStore.updatePolicy(localPolicy);
        setHasChanges(false);
    };

    const handleReset = () => {
        setLocalPolicy(DEFAULT_LP_POLICY);
        setHasChanges(true);
    };

    const addAllowToken = () => {
        if (newAllowToken && !localPolicy.tokenAllowlist.includes(newAllowToken.toUpperCase())) {
            updatePolicy({ tokenAllowlist: [...localPolicy.tokenAllowlist, newAllowToken.toUpperCase()] });
            setNewAllowToken('');
        }
    };

    const addBlockToken = () => {
        if (newBlockToken && !localPolicy.tokenBlocklist.includes(newBlockToken.toUpperCase())) {
            updatePolicy({ tokenBlocklist: [...localPolicy.tokenBlocklist, newBlockToken.toUpperCase()] });
            setNewBlockToken('');
        }
    };

    const removeToken = (list: 'allowlist' | 'blocklist', token: string) => {
        if (list === 'allowlist') {
            updatePolicy({ tokenAllowlist: localPolicy.tokenAllowlist.filter(t => t !== token) });
        } else {
            updatePolicy({ tokenBlocklist: localPolicy.tokenBlocklist.filter(t => t !== token) });
        }
    };

    const toggleConfirmation = (scope: LPOperationScope) => {
        const current = localPolicy.requireConfirmationFor;
        if (current.includes(scope)) {
            updatePolicy({ requireConfirmationFor: current.filter(s => s !== scope) });
        } else {
            updatePolicy({ requireConfirmationFor: [...current, scope] });
        }
    };

    return (
        <div className="flex flex-col h-full gap-3">
            
            {/* Compact Header */}
            <div className="glass-panel px-4 py-3 rounded shrink-0 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Shield size={18} className="text-[#E7FE55]" />
                    <span className="text-sm font-semibold text-white">Policy Engine</span>
                    <button
                        onClick={() => updatePolicy({ enabled: !localPolicy.enabled })}
                        className={`px-2 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider ${
                            localPolicy.enabled
                                ? 'bg-[#10b981]/20 text-[#10b981] border border-[#10b981]/30'
                                : 'bg-[#ef4444]/20 text-[#ef4444] border border-[#ef4444]/30'
                        }`}
                    >
                        {localPolicy.enabled ? 'Enabled' : 'Disabled'}
                    </button>
                    {hasChanges && (
                        <div className="flex items-center gap-1 text-[#f59e0b]">
                            <AlertTriangle size={12} />
                            <span className="text-[10px]">Unsaved</span>
                        </div>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={handleReset}
                        className="p-1.5 rounded hover:bg-[#1a1b21] text-[#747580] hover:text-white transition-colors"
                        title="Reset"
                    >
                        <RotateCcw size={14} />
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={!hasChanges}
                        className="flex items-center gap-1 px-2.5 py-1 bg-[#E7FE55] hover:bg-[#d4eb4c] text-black rounded text-[10px] font-semibold uppercase disabled:opacity-50"
                    >
                        <Save size={12} />
                        Save
                    </button>
                </div>
            </div>

            {/* Main 3-Column Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 flex-1 min-h-0">
                
                {/* Column 1: Constraints */}
                <div className="glass-panel rounded p-4 flex flex-col">
                    <div className="flex items-center gap-2 mb-3">
                        <Layers size={14} className="text-[#E7FE55]" />
                        <span className="text-[11px] font-semibold text-white uppercase tracking-wider">Constraints</span>
                    </div>
                    
                    <div className="space-y-3 flex-1">
                        {/* Max Range Width */}
                        <div>
                            <div className="flex justify-between text-[10px] mb-1">
                                <span className="text-[#747580]">Max Range Width</span>
                                <span className="text-white font-mono">{localPolicy.maxRangeWidthPercent}%</span>
                            </div>
                            <input type="range" min="5" max="200" value={localPolicy.maxRangeWidthPercent}
                                onChange={(e) => updatePolicy({ maxRangeWidthPercent: parseInt(e.target.value) })}
                                className="w-full accent-[#E7FE55] h-1" />
                        </div>

                        {/* Min Range Width */}
                        <div>
                            <div className="flex justify-between text-[10px] mb-1">
                                <span className="text-[#747580]">Min Range Width</span>
                                <span className="text-white font-mono">{localPolicy.minRangeWidthPercent}%</span>
                            </div>
                            <input type="range" min="1" max="50" value={localPolicy.minRangeWidthPercent}
                                onChange={(e) => updatePolicy({ minRangeWidthPercent: parseInt(e.target.value) })}
                                className="w-full accent-[#E7FE55] h-1" />
                        </div>

                        {/* Max Capital */}
                        <div>
                            <div className="flex justify-between text-[10px] mb-1">
                                <span className="text-[#747580]">Max Capital/Pool</span>
                                <span className="text-white font-mono">{localPolicy.maxCapitalPerPoolPercent}%</span>
                            </div>
                            <input type="range" min="5" max="100" value={localPolicy.maxCapitalPerPoolPercent}
                                onChange={(e) => updatePolicy({ maxCapitalPerPoolPercent: parseInt(e.target.value) })}
                                className="w-full accent-[#E7FE55] h-1" />
                        </div>

                        {/* Min TVL & Volume */}
                        <div className="grid grid-cols-2 gap-2 pt-1">
                            <div>
                                <label className="text-[9px] text-[#747580] uppercase">Min TVL</label>
                                <div className="relative mt-1">
                                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[#747580] text-[10px]">$</span>
                                    <input type="number" min="0" step="1000" value={localPolicy.minTVLRequired}
                                        onChange={(e) => updatePolicy({ minTVLRequired: parseInt(e.target.value) || 0 })}
                                        className="w-full pl-5 pr-2 py-1.5 bg-[#0f1015] border border-[#232328] rounded text-white text-[11px] font-mono focus:outline-none focus:border-[#E7FE55]" />
                                </div>
                            </div>
                            <div>
                                <label className="text-[9px] text-[#747580] uppercase">Min Volume</label>
                                <div className="relative mt-1">
                                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[#747580] text-[10px]">$</span>
                                    <input type="number" min="0" step="100" value={localPolicy.minVolumeRequired}
                                        onChange={(e) => updatePolicy({ minVolumeRequired: parseInt(e.target.value) || 0 })}
                                        className="w-full pl-5 pr-2 py-1.5 bg-[#0f1015] border border-[#232328] rounded text-white text-[11px] font-mono focus:outline-none focus:border-[#E7FE55]" />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Column 2: Token Filtering */}
                <div className="glass-panel rounded p-4 flex flex-col">
                    <div className="flex items-center gap-2 mb-3">
                        <Coins size={14} className="text-[#E7FE55]" />
                        <span className="text-[11px] font-semibold text-white uppercase tracking-wider">Token Filtering</span>
                    </div>
                    
                    <div className="space-y-3 flex-1">
                        {/* Allowlist */}
                        <div>
                            <label className="text-[9px] text-[#747580] uppercase">Allowlist <span className="normal-case text-[#5a5b63]">(empty=all)</span></label>
                            <div className="flex gap-1 mt-1">
                                <input type="text" value={newAllowToken}
                                    onChange={(e) => setNewAllowToken(e.target.value.toUpperCase())}
                                    onKeyPress={(e) => e.key === 'Enter' && addAllowToken()}
                                    className="flex-1 px-2 py-1 bg-[#0f1015] border border-[#232328] rounded text-white text-[11px] focus:outline-none focus:border-[#E7FE55]"
                                    placeholder="SOL, USDC..." />
                                <button onClick={addAllowToken} className="px-2 bg-[#10b981] hover:bg-[#0d9668] text-white rounded">
                                    <Plus size={12} />
                                </button>
                            </div>
                            <div className="flex flex-wrap gap-1 mt-2 min-h-[24px]">
                                {localPolicy.tokenAllowlist.length === 0 ? (
                                    <span className="text-[9px] text-[#5a5b63] italic">All allowed</span>
                                ) : localPolicy.tokenAllowlist.map(token => (
                                    <span key={token} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-[#10b981]/15 text-[#10b981] rounded text-[9px] border border-[#10b981]/30">
                                        {token}
                                        <button onClick={() => removeToken('allowlist', token)}><X size={10} /></button>
                                    </span>
                                ))}
                            </div>
                        </div>

                        {/* Blocklist */}
                        <div>
                            <label className="text-[9px] text-[#747580] uppercase">Blocklist</label>
                            <div className="flex gap-1 mt-1">
                                <input type="text" value={newBlockToken}
                                    onChange={(e) => setNewBlockToken(e.target.value.toUpperCase())}
                                    onKeyPress={(e) => e.key === 'Enter' && addBlockToken()}
                                    className="flex-1 px-2 py-1 bg-[#0f1015] border border-[#232328] rounded text-white text-[11px] focus:outline-none focus:border-[#E7FE55]"
                                    placeholder="Block tokens..." />
                                <button onClick={addBlockToken} className="px-2 bg-[#ef4444] hover:bg-[#dc2626] text-white rounded">
                                    <Plus size={12} />
                                </button>
                            </div>
                            <div className="flex flex-wrap gap-1 mt-2 min-h-[24px]">
                                {localPolicy.tokenBlocklist.length === 0 ? (
                                    <span className="text-[9px] text-[#5a5b63] italic">None blocked</span>
                                ) : localPolicy.tokenBlocklist.map(token => (
                                    <span key={token} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-[#ef4444]/15 text-[#ef4444] rounded text-[9px] border border-[#ef4444]/30">
                                        {token}
                                        <button onClick={() => removeToken('blocklist', token)}><X size={10} /></button>
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Column 3: Confirmations */}
                <div className="glass-panel rounded p-4 flex flex-col">
                    <div className="flex items-center gap-2 mb-3">
                        <Lock size={14} className="text-[#E7FE55]" />
                        <span className="text-[11px] font-semibold text-white uppercase tracking-wider">Confirmations</span>
                    </div>
                    
                    <div className="space-y-1.5 flex-1 overflow-y-auto custom-scrollbar">
                        {(Object.keys(LP_SCOPE_METADATA) as LPOperationScope[]).map(scope => {
                            const meta = LP_SCOPE_METADATA[scope];
                            const isEnabled = localPolicy.requireConfirmationFor.includes(scope);
                            
                            return (
                                <button
                                    key={scope}
                                    onClick={() => toggleConfirmation(scope)}
                                    className={`w-full flex items-center justify-between px-2.5 py-2 rounded transition-colors ${
                                        isEnabled
                                            ? 'bg-[#E7FE55]/10 border border-[#E7FE55]/30'
                                            : 'bg-[#0f1015] hover:bg-[#1a1b21] border border-[#232328]'
                                    }`}
                                >
                                    <div className="flex items-center gap-2">
                                        <div className={`w-4 h-4 rounded flex items-center justify-center text-[10px] ${
                                            isEnabled ? 'bg-[#E7FE55] text-black' : 'bg-[#232328] text-[#747580]'
                                        }`}>
                                            {isEnabled && <Check size={10} />}
                                        </div>
                                        <div className="text-left">
                                            <div className="text-[11px] text-white">{meta.label}</div>
                                        </div>
                                    </div>
                                    <span className={`text-[8px] uppercase font-semibold px-1.5 py-0.5 rounded ${
                                        meta.riskLevel === 'high' ? 'bg-[#ef4444]/15 text-[#ef4444]' :
                                        meta.riskLevel === 'medium' ? 'bg-[#f59e0b]/15 text-[#f59e0b]' :
                                        'bg-[#10b981]/15 text-[#10b981]'
                                    }`}>
                                        {meta.riskLevel}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
};
