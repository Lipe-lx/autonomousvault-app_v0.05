// SolanaDealerPolicyPage.tsx
// Policy Engine configuration page - Compact single-page layout

import React, { useState, useEffect } from 'react';
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
    Lock,
    Minus
} from 'lucide-react';
import { LPPolicyRules, DEFAULT_LP_POLICY, LPOperationScope, LP_SCOPE_METADATA } from '../../types/solanaLPTypes';
import { solanaDealerStore } from '../../state/solanaDealerStore';
import { FormattedNumberInput } from '../ui/FormattedNumberInput';


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

    // Update local policy when prop changes (e.g. after loading from storage)
    useEffect(() => {
        setLocalPolicy(policy);
    }, [policy]);

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
            
            {/* Top Grid: Status & Key Logic Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* 1. Policy Status & Controls */}
                <div className="glass-panel px-4 py-3 rounded flex flex-col justify-between h-[88px] relative overflow-hidden group">
                    <div className="flex items-center justify-between z-10">
                        <div className="flex items-center gap-2">
                            <Shield size={18} className="text-[#E7FE55]" />
                            <span className="text-sm font-semibold text-white">Policy Engine</span>
                        </div>
                        {hasChanges && (
                            <div className="flex items-center gap-1 text-[#f59e0b] bg-[#f59e0b]/10 px-1.5 py-0.5 rounded text-[10px]">
                                <AlertTriangle size={10} />
                                <span>Unsaved</span>
                            </div>
                        )}
                    </div>

                    <div className="flex items-center justify-between gap-2 z-10 mt-2">
                        {/* Toggle Switch */}
                        <div 
                            onClick={() => updatePolicy({ enabled: !localPolicy.enabled })}
                            className={`cursor-pointer w-12 h-6 rounded-full p-1 transition-colors relative ${
                                localPolicy.enabled ? 'bg-[#E7FE55] border border-[#E7FE55]' : 'bg-[#232328] border border-[#303036]'
                            }`}
                            title={localPolicy.enabled ? 'Click to Disable' : 'Click to Enable'}
                        >
                            <div className={`w-3.5 h-3.5 rounded-full shadow-sm transition-all absolute top-1 ${
                                localPolicy.enabled 
                                    ? 'bg-black left-[calc(100%-1.25rem)]' 
                                    : 'bg-[#747580] left-1'
                            }`} />
                        </div>
                        <span className={`text-[10px] font-medium uppercase tracking-wider mr-auto ml-2 ${
                             localPolicy.enabled ? 'text-[#E7FE55]' : 'text-[#747580]'
                        }`}>
                            {localPolicy.enabled ? 'Active' : 'Stopped'}
                        </span>
                        
                        <div className="flex gap-1">
                            <button
                                onClick={handleReset}
                                className="p-1.5 rounded bg-[#232328] hover:bg-[#2a2b30] text-[#747580] hover:text-white transition-colors border border-transparent hover:border-[#303036]"
                                title="Reset Changes"
                            >
                                <RotateCcw size={14} />
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={!hasChanges}
                                className="px-3 py-1.5 bg-[#E7FE55] hover:bg-[#d4eb4c] text-black rounded text-[10px] font-semibold uppercase disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 shadow-[0_0_10px_rgba(231,254,85,0.2)]"
                            >
                                <Save size={12} />
                                Save
                            </button>
                        </div>
                    </div>
                </div>

                {/* 2. Min TVL Card */}
                <div className="glass-panel px-4 py-3 rounded flex flex-col justify-between h-[88px] relative overflow-hidden group">
                    <label className="text-[10px] font-semibold text-[#747580] uppercase tracking-wider z-10 flex items-center gap-2">
                        <Lock size={12} />
                        Min TVL Required
                    </label>
                    
                    <div className="flex items-center justify-between z-10 mt-auto">
                        <div className="flex items-baseline gap-1">
                            <span className="text-lg font-bold text-[#E7FE55]">$</span>
                            <FormattedNumberInput
                                className="text-2xl font-bold text-white font-mono bg-transparent outline-none w-32 appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                value={localPolicy.minTVLRequired}
                                onChange={(val) => updatePolicy({ minTVLRequired: val })}
                            />
                        </div>
                        
                        <div className="flex flex-col gap-0.5">
                            <button 
                                onClick={() => updatePolicy({ minTVLRequired: localPolicy.minTVLRequired + 1000 })}
                                className="p-1 rounded bg-[#232328] hover:bg-[#303036] text-[#E7FE55] transition-colors"
                            >
                                <Plus size={10} />
                            </button>
                            <button 
                                onClick={() => updatePolicy({ minTVLRequired: Math.max(0, localPolicy.minTVLRequired - 1000) })}
                                className="p-1 rounded bg-[#232328] hover:bg-[#303036] text-[#747580] hover:text-white transition-colors"
                            >
                                <Minus size={10} />
                            </button>
                        </div>
                    </div>
                     <div className="w-full h-1 bg-[#232328] rounded-full mt-2 overflow-hidden z-10">
                        <div className="h-full bg-[#E7FE55]/50 w-1/2 rounded-full" />
                    </div>
                </div>

                {/* 3. Min Volume Card */}
                <div className="glass-panel px-4 py-3 rounded flex flex-col justify-between h-[88px] relative overflow-hidden group">
                    <label className="text-[10px] font-semibold text-[#747580] uppercase tracking-wider z-10 flex items-center gap-2">
                        <Coins size={12} />
                        Min 24h Volume
                    </label>
                    
                    <div className="flex items-center justify-between z-10 mt-auto">
                        <div className="flex items-baseline gap-1">
                            <span className="text-lg font-bold text-[#E7FE55]">$</span>
                            <FormattedNumberInput
                                className="text-2xl font-bold text-white font-mono bg-transparent outline-none w-32 appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                value={localPolicy.minVolumeRequired}
                                onChange={(val) => updatePolicy({ minVolumeRequired: val })}
                            />
                        </div>
                        
                        <div className="flex flex-col gap-0.5">
                            <button 
                                onClick={() => updatePolicy({ minVolumeRequired: localPolicy.minVolumeRequired + 100 })}
                                className="p-1 rounded bg-[#232328] hover:bg-[#303036] text-[#E7FE55] transition-colors"
                            >
                                <Plus size={10} />
                            </button>
                             <button 
                                onClick={() => updatePolicy({ minVolumeRequired: Math.max(0, localPolicy.minVolumeRequired - 100) })}
                                className="p-1 rounded bg-[#232328] hover:bg-[#303036] text-[#747580] hover:text-white transition-colors"
                            >
                                <Minus size={10} />
                            </button>
                        </div>
                    </div>
                    <div className="w-full h-1 bg-[#232328] rounded-full mt-2 overflow-hidden z-10">
                        <div className="h-full bg-[#E7FE55]/50 w-2/3 rounded-full" />
                    </div>
                </div>
            </div>

            {/* Main 3-Column Grid (Grid 2) */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 flex-1 min-h-0">
                
                {/* Column 1: Constraints */}
                <div className="glass-panel rounded p-4 flex flex-col">
                    <div className="flex items-center gap-2 mb-3">
                        <Layers size={14} className="text-[#E7FE55]" />
                        <span className="text-[11px] font-semibold text-white uppercase tracking-wider">Advanced Constraints</span>
                    </div>
                    
                    <div className="space-y-4 flex-1">
                        {/* Max Range Width */}
                        <div>
                            <div className="flex justify-between text-[10px] mb-2">
                                <span className="text-[#747580]">Max Range Width</span>
                                <span className="text-white font-mono bg-[#1a1b21] px-1.5 py-0.5 rounded border border-[#232328]">{localPolicy.maxRangeWidthPercent}%</span>
                            </div>
                            <input type="range" min="5" max="200" value={localPolicy.maxRangeWidthPercent}
                                onChange={(e) => updatePolicy({ maxRangeWidthPercent: parseInt(e.target.value) })}
                                className="w-full h-2 bg-[#232328] rounded-lg appearance-none cursor-pointer accent-[#E7FE55] hover:accent-[#d4eb4c]" />
                            <div className="flex justify-between text-[8px] text-[#5a5b63] mt-1 font-medium tracking-wide">
                                <span>TIGHT</span>
                                <span>WIDE</span>
                            </div>
                        </div>

                        {/* Min Range Width */}
                        <div>
                            <div className="flex justify-between text-[10px] mb-2">
                                <span className="text-[#747580]">Min Range Width</span>
                                <span className="text-white font-mono bg-[#1a1b21] px-1.5 py-0.5 rounded border border-[#232328]">{localPolicy.minRangeWidthPercent}%</span>
                            </div>
                            <input type="range" min="1" max="50" value={localPolicy.minRangeWidthPercent}
                                onChange={(e) => updatePolicy({ minRangeWidthPercent: parseInt(e.target.value) })}
                                className="w-full h-2 bg-[#232328] rounded-lg appearance-none cursor-pointer accent-[#E7FE55] hover:accent-[#d4eb4c]" />
                            <div className="flex justify-between text-[8px] text-[#5a5b63] mt-1 font-medium tracking-wide">
                                <span>CONCENTRATED</span>
                                <span>LOOSE</span>
                            </div>
                        </div>

                        {/* Max Capital */}
                        <div>
                            <div className="flex justify-between text-[10px] mb-2">
                                <span className="text-[#747580]">Max Capital / Pool</span>
                                <span className="text-white font-mono bg-[#1a1b21] px-1.5 py-0.5 rounded border border-[#232328]">{localPolicy.maxCapitalPerPoolPercent}%</span>
                            </div>
                            <input type="range" min="5" max="100" value={localPolicy.maxCapitalPerPoolPercent}
                                onChange={(e) => updatePolicy({ maxCapitalPerPoolPercent: parseInt(e.target.value) })}
                                className="w-full h-2 bg-[#232328] rounded-lg appearance-none cursor-pointer accent-[#E7FE55] hover:accent-[#d4eb4c]" />
                           <p className="text-[9px] text-[#5a5b63] mt-1">
                               Max % of wallet capital to allocate to a single pool.
                           </p>
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
