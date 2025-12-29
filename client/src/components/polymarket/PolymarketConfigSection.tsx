// src/components/polymarket/PolymarketConfigSection.tsx
// Configuration panel for Polymarket Dealer - follows DealerConfigSection pattern

import React, { useState, useEffect } from 'react';
import {
    RefreshCw, Zap, DollarSign, Clock, Target, X, AlertCircle,
    Sparkles, Filter, TrendingUp
} from 'lucide-react';
import {
    PolymarketSettings,
    PolymarketPresetName,
    POLYMARKET_PRESETS,
    POLYMARKET_CATEGORIES
} from '../../state/polymarketStore';
import { PolymarketCategory } from '../../types';

interface PolymarketConfigSectionProps {
    settings: PolymarketSettings;
    onUpdateSettings: (settings: Partial<PolymarketSettings>) => void;
    onApplyChanges: () => void;
    isOn?: boolean;
    onToggle?: (isOn: boolean) => void;
}

export const PolymarketConfigSection: React.FC<PolymarketConfigSectionProps> = ({
    settings,
    onUpdateSettings,
    onApplyChanges,
    isOn = false,
    onToggle
}) => {
    const [localSettings, setLocalSettings] = useState<PolymarketSettings>(settings);
    const [hasChanges, setHasChanges] = useState(false);

    useEffect(() => {
        setLocalSettings(settings);
    }, [settings]);

    useEffect(() => {
        setHasChanges(JSON.stringify(localSettings) !== JSON.stringify(settings));
    }, [localSettings, settings]);

    const handleLocalChange = (updates: Partial<PolymarketSettings>) => {
        setLocalSettings(prev => ({ ...prev, ...updates }));
    };

    const handleApply = () => {
        onUpdateSettings(localSettings);
        onApplyChanges();
    };

    const handleReset = () => {
        setLocalSettings(settings);
        setHasChanges(false);
    };

    const handlePresetChange = (preset: PolymarketPresetName) => {
        if (preset === 'custom') return;
        const presetConfig = POLYMARKET_PRESETS[preset];
        if (!presetConfig) return;

        handleLocalChange({
            selectedPreset: preset,
            allowedCategories: presetConfig.categories
        });
    };

    const handleCategoryToggle = (category: PolymarketCategory) => {
        const current = localSettings.allowedCategories;
        const updated = current.includes(category)
            ? current.filter(c => c !== category)
            : [...current, category];
        handleLocalChange({ allowedCategories: updated });
    };

    return (
        <div className="h-full flex flex-col gap-4 overflow-y-auto custom-scrollbar">
            {/* ===================== TOP SECTION: 2 COLUMNS ===================== */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

                {/* LEFT COLUMN: Engine + Core Settings */}
                <div className="flex flex-col gap-4">

                    {/* Engine Status Card */}
                    <div className="glass-panel p-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className={`h-10 w-10 rounded flex items-center justify-center ${isOn ? 'bg-[#E7FE55]/15 text-[#E7FE55]' : 'bg-[#1a1b21] text-[#747580]'}`}>
                                    <Zap className="h-5 w-5" />
                                </div>
                                <div>
                                    <span className="block text-sm font-semibold text-white">Engine Status</span>
                                    <div className="flex items-center gap-1.5 mt-0.5">
                                        <span className={`w-1.5 h-1.5 rounded-full ${isOn ? 'bg-[#E7FE55] animate-pulse' : 'bg-[#747580]'}`} />
                                        <span className="text-[10px] text-[#747580] font-medium uppercase tracking-wider">{isOn ? 'Active & Running' : 'Stopped'}</span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                {onToggle && (
                                    <button
                                        onClick={() => onToggle(!isOn)}
                                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${isOn ? 'bg-[#E7FE55]' : 'bg-[#3a3b42]'}`}
                                    >
                                        <span className={`${isOn ? 'translate-x-6' : 'translate-x-1'} inline-block h-4 w-4 transform rounded-full bg-black transition-transform shadow`} />
                                    </button>
                                )}
                                {hasChanges && (
                                    <button
                                        onClick={handleReset}
                                        className="flex items-center gap-2 bg-[#1a1b21] hover:bg-[#232328] text-[#747580] px-3 py-1.5 rounded text-[10px] font-semibold uppercase tracking-wider transition-all"
                                    >
                                        <X className="h-3 w-3" /> Reset
                                    </button>
                                )}
                                <button
                                    onClick={handleApply}
                                    disabled={!hasChanges}
                                    className={`flex items-center gap-2 px-3 py-1.5 rounded text-[10px] font-semibold uppercase tracking-wider transition-all active:scale-95
                                        ${hasChanges
                                            ? 'bg-[#E7FE55] hover:bg-[#d4e94d] text-black'
                                            : 'bg-[#1a1b21] text-[#747580] cursor-not-allowed opacity-50'
                                        }`}
                                >
                                    <RefreshCw className="h-3 w-3" /> Apply
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Strategy Preset Card */}
                    <div className="glass-panel p-4">
                        <div className="flex items-center gap-2 text-[10px] text-[#E7FE55] font-semibold uppercase tracking-[0.1em] mb-3">
                            <Sparkles className="h-3.5 w-3.5" /> Strategy Preset
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            {(Object.entries(POLYMARKET_PRESETS) as [PolymarketPresetName, typeof POLYMARKET_PRESETS[PolymarketPresetName]][])
                                .filter(([key]) => key !== 'custom')
                                .map(([key, preset]) => (
                                    <button
                                        key={key}
                                        onClick={() => handlePresetChange(key)}
                                        className={`p-3 rounded border text-left transition-all ${localSettings.selectedPreset === key
                                            ? 'border-[#E7FE55] bg-[#E7FE55]/10'
                                            : 'border-[#232328] hover:border-[#747580] bg-[#0f1015]'
                                            }`}
                                    >
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-sm">{preset.emoji}</span>
                                            <span className="text-[11px] font-semibold text-white">{preset.name}</span>
                                        </div>
                                        <p className="text-[10px] text-[#747580] leading-relaxed">{preset.description}</p>
                                    </button>
                                ))}
                        </div>
                    </div>

                    {/* Capital & Risk Card */}
                    <div className="glass-panel p-4">
                        <div className="flex items-center gap-2 text-[10px] text-[#E7FE55] font-semibold uppercase tracking-[0.1em] mb-3">
                            <DollarSign className="h-3.5 w-3.5" /> Capital & Risk
                        </div>

                        <div className="grid grid-cols-4 gap-3">
                            {/* Capital Type */}
                            <div className="bg-[#0f1015] p-3 rounded border border-[#232328]">
                                <label className="block text-[9px] text-[#747580] uppercase tracking-wider mb-1.5">Type</label>
                                <div className="flex gap-0.5">
                                    <button
                                        onClick={() => handleLocalChange({ bankrollType: 'MANUAL' })}
                                        className={`flex-1 py-1 text-[9px] font-semibold rounded transition-all ${localSettings.bankrollType === 'MANUAL' ? 'bg-[#60a5fa] text-white' : 'text-[#747580] hover:text-white'}`}
                                    >Fix</button>
                                    <button
                                        onClick={() => handleLocalChange({ bankrollType: 'ALL_AVAILABLE' })}
                                        className={`flex-1 py-1 text-[9px] font-semibold rounded transition-all ${localSettings.bankrollType === 'ALL_AVAILABLE' ? 'bg-[#34d399] text-white' : 'text-[#747580] hover:text-white'}`}
                                    >Max</button>
                                </div>
                            </div>

                            {/* Amount */}
                            <div className="bg-[#0f1015] p-3 rounded border border-[#232328]">
                                <label className="block text-[9px] text-[#747580] uppercase tracking-wider mb-1.5">Amount ($)</label>
                                {localSettings.bankrollType === 'MANUAL' ? (
                                    <input
                                        type="number"
                                        value={localSettings.manualBankroll}
                                        onChange={(e) => handleLocalChange({ manualBankroll: parseFloat(e.target.value) || 0 })}
                                        className="w-full bg-transparent text-sm font-mono text-white focus:outline-none"
                                    />
                                ) : (
                                    <span className="text-sm font-mono text-[#34d399]">Auto</span>
                                )}
                            </div>

                            {/* Max Position */}
                            <div className="bg-[#0f1015] p-3 rounded border border-[#232328]">
                                <label className="block text-[9px] text-[#747580] uppercase tracking-wider mb-1.5">Max Pos ($)</label>
                                <input
                                    type="number"
                                    value={localSettings.maxPositionSizeUSDC}
                                    onChange={(e) => handleLocalChange({ maxPositionSizeUSDC: parseInt(e.target.value) || 0 })}
                                    className="w-full bg-transparent text-sm font-mono text-white focus:outline-none"
                                />
                            </div>

                            {/* Max Open */}
                            <div className="bg-[#0f1015] p-3 rounded border border-[#232328]">
                                <label className="block text-[9px] text-[#747580] uppercase tracking-wider mb-1.5">Max Open</label>
                                <input
                                    type="number"
                                    value={localSettings.maxOpenPositions}
                                    onChange={(e) => handleLocalChange({ maxOpenPositions: parseInt(e.target.value) || 1 })}
                                    className="w-full bg-transparent text-sm font-mono text-white focus:outline-none"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Analysis Settings Card */}
                    <div className="glass-panel p-4">
                        <div className="flex items-center gap-2 text-[10px] text-[#E7FE55] font-semibold uppercase tracking-[0.1em] mb-3">
                            <Clock className="h-3.5 w-3.5" /> Analysis Settings
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                            <div className="bg-[#0f1015] p-3 rounded border border-[#232328]">
                                <label className="block text-[9px] text-[#747580] uppercase tracking-wider mb-1.5">Interval</label>
                                <div className="flex items-baseline gap-1">
                                    <input
                                        type="number"
                                        value={localSettings.checkIntervalSeconds}
                                        onChange={(e) => handleLocalChange({ checkIntervalSeconds: Math.max(60, parseInt(e.target.value) || 60) })}
                                        className="w-full bg-transparent text-sm font-mono text-white focus:outline-none"
                                    />
                                    <span className="text-[10px] text-[#747580]">s</span>
                                </div>
                            </div>

                            <div className="bg-[#0f1015] p-3 rounded border border-[#232328]">
                                <label className="block text-[9px] text-[#747580] uppercase tracking-wider mb-1.5">Min Volume</label>
                                <div className="flex items-center">
                                    <span className="text-[10px] text-[#747580] mr-1">$</span>
                                    <input
                                        type="number"
                                        value={localSettings.minVolumeThreshold}
                                        onChange={(e) => handleLocalChange({ minVolumeThreshold: parseInt(e.target.value) || 0 })}
                                        className="w-full bg-transparent text-sm font-mono text-white focus:outline-none"
                                    />
                                </div>
                            </div>

                            <div className="bg-[#0f1015] p-3 rounded border border-[#232328]">
                                <label className="block text-[9px] text-[#747580] uppercase tracking-wider mb-1.5">Min Liquidity</label>
                                <div className="flex items-center">
                                    <span className="text-[10px] text-[#747580] mr-1">$</span>
                                    <input
                                        type="number"
                                        value={localSettings.minLiquidityThreshold}
                                        onChange={(e) => handleLocalChange({ minLiquidityThreshold: parseInt(e.target.value) || 0 })}
                                        className="w-full bg-transparent text-sm font-mono text-white focus:outline-none"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                </div>

                {/* RIGHT COLUMN: Categories */}
                <div className="flex flex-col gap-4">

                    {/* Market Categories Card */}
                    <div className="glass-panel p-4">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2 text-[10px] text-[#E7FE55] font-semibold uppercase tracking-[0.1em]">
                                <Filter className="h-3.5 w-3.5" /> Market Categories
                            </div>
                            <span className="text-[10px] bg-[#E7FE55]/15 text-[#E7FE55] px-2 py-0.5 rounded border border-[#E7FE55]/30 font-mono">
                                {localSettings.allowedCategories.length}
                            </span>
                        </div>

                        <div className="flex flex-wrap gap-2">
                            {POLYMARKET_CATEGORIES.map(cat => (
                                <button
                                    key={cat.value}
                                    onClick={() => handleCategoryToggle(cat.value)}
                                    className={`px-3 py-1.5 rounded-full text-xs flex items-center gap-1.5 transition-all ${localSettings.allowedCategories.includes(cat.value)
                                        ? 'bg-[#E7FE55]/20 text-[#E7FE55] border border-[#E7FE55]/50'
                                        : 'bg-[#0f1015] text-[#747580] border border-[#232328] hover:border-[#747580]'
                                        }`}
                                >
                                    <span>{cat.icon}</span>
                                    {cat.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Market Filters Card */}
                    <div className="glass-panel p-4">
                        <div className="flex items-center gap-2 text-[10px] text-[#E7FE55] font-semibold uppercase tracking-[0.1em] mb-3">
                            <TrendingUp className="h-3.5 w-3.5" /> Market Filters
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="bg-[#0f1015] p-3 rounded border border-[#232328]">
                                <label className="block text-[9px] text-[#747580] uppercase tracking-wider mb-1.5">Spread Edge</label>
                                <div className="flex items-baseline gap-1">
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={localSettings.minSpreadThreshold || 0.02}
                                        onChange={(e) => handleLocalChange({ minSpreadThreshold: parseFloat(e.target.value) || 0.02 })}
                                        className="w-full bg-transparent text-sm font-mono text-white focus:outline-none"
                                    />
                                </div>
                            </div>

                            <div className="bg-[#0f1015] p-3 rounded border border-[#232328]">
                                <label className="block text-[9px] text-[#747580] uppercase tracking-wider mb-1.5">Confidence</label>
                                <div className="flex items-baseline gap-1">
                                    <input
                                        type="number"
                                        step="0.05"
                                        min="0"
                                        max="1"
                                        value={localSettings.confidenceThreshold || 0.6}
                                        onChange={(e) => handleLocalChange({ confidenceThreshold: parseFloat(e.target.value) || 0.6 })}
                                        className="w-full bg-transparent text-sm font-mono text-white focus:outline-none"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Info Box */}
                    <div className="glass-panel p-4 flex items-start gap-3">
                        <AlertCircle className="h-4 w-4 text-[#E7FE55] shrink-0 mt-0.5" />
                        <div>
                            <p className="text-[10px] text-[#747580] leading-relaxed">
                                <strong className="text-[#a0a1a8]">Polymarket Data:</strong> Market data is fetched via the CLOB API.
                                Categories filter which markets are analyzed. Higher confidence = fewer but more certain trades.
                            </p>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
};
