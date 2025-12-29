import React, { useState, useEffect } from 'react';
import {
    RefreshCw, Settings, ShieldCheck, Zap, DollarSign, Activity, Target, X,
    Clock, BarChart2, TrendingUp
} from 'lucide-react';
import { DealerState, IndicatorSettings, PresetName, DealerSettings } from '../../state/dealerStore';
import { hyperliquidService } from '../../services/hyperliquidService';
import { IndicatorConfigPanel } from '../dealer/IndicatorConfigPanel';


interface DealerConfigSectionProps {
    status: DealerState;
    onToggle: (isOn: boolean) => void;
    onUpdateSettings: (settings: any) => void;
    onApplyChanges: () => void;
    onSaveStrategy: (prompt: string) => void;
}

export const DealerConfigSection: React.FC<DealerConfigSectionProps> = ({
    status,
    onToggle,
    onUpdateSettings,
    onApplyChanges
}) => {
    const settings = status.settings;

    // Local state for edits
    const [localSettings, setLocalSettings] = useState<DealerSettings>(settings);
    const [hasChanges, setHasChanges] = useState(false);

    // Sync from upstream when saved settings change (external update)
    // We use JSON.stringify to only update when content actually differs
    useEffect(() => {
        setLocalSettings(settings);
    }, [JSON.stringify(settings)]);

    // Check for changes
    useEffect(() => {
        setHasChanges(JSON.stringify(localSettings) !== JSON.stringify(settings));
    }, [localSettings, settings]);

    const handleLocalUpdate = (updates: Partial<DealerSettings>) => {
        setLocalSettings(prev => ({ ...prev, ...updates }));
    };

    const handleApply = () => {
        onUpdateSettings(localSettings);
        onApplyChanges();
    };

    // Trading Pairs State
    const [availableAssets, setAvailableAssets] = useState<string[]>([]);
    const [isLoadingAssets, setIsLoadingAssets] = useState(false);

    // Fetch Assets on Mount
    useEffect(() => {
        const fetchAssets = async () => {
            setIsLoadingAssets(true);
            try {
                const assets = await hyperliquidService.getAllAvailableAssets();
                setAvailableAssets(assets.sort());
            } catch (e) {
                console.error("Failed to fetch assets", e);
            } finally {
                setIsLoadingAssets(false);
            }
        };
        fetchAssets();
    }, []);

    // Asset Management
    const addAsset = (asset: string) => {
        if (!localSettings.tradingPairs.includes(asset)) {
            handleLocalUpdate({ tradingPairs: [...localSettings.tradingPairs, asset] });
        }
    };

    const removeAsset = (asset: string) => {
        handleLocalUpdate({ tradingPairs: localSettings.tradingPairs.filter(p => p !== asset) });
    };

    return (
        <div className="h-full flex flex-col gap-4 overflow-y-auto custom-scrollbar">
            {/* ===================== TOP SECTION: 2 COLUMNS ===================== */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

                {/* LEFT COLUMN: Engine + Core Settings + Capital/Risk */}
                <div className="flex flex-col gap-4">

                    {/* Engine Status Card */}
                    <div className="glass-panel p-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className={`h-10 w-10 rounded flex items-center justify-center ${status.isOn ? 'bg-[#E7FE55]/15 text-[#E7FE55]' : 'bg-[#1a1b21] text-[#747580]'}`}>
                                    <Zap className="h-5 w-5" />
                                </div>
                                <div>
                                    <span className="block text-sm font-semibold text-white">Engine Status</span>
                                    <div className="flex items-center gap-1.5 mt-0.5">
                                        <span className={`w-1.5 h-1.5 rounded-full ${status.isOn ? 'bg-[#E7FE55] animate-pulse' : 'bg-[#747580]'}`} />
                                        <span className="text-[10px] text-[#747580] font-medium uppercase tracking-wider">{status.isOn ? 'Active & Running' : 'Stopped'}</span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => onToggle(!status.isOn)}
                                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${status.isOn ? 'bg-[#E7FE55]' : 'bg-[#3a3b42]'}`}
                                >
                                    <span className={`${status.isOn ? 'translate-x-6' : 'translate-x-1'} inline-block h-4 w-4 transform rounded-full bg-black transition-transform shadow`} />
                                </button>
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

                    {/* Capital & Risk Card - Compact */}
                    <div className="glass-panel p-3">
                        <div className="flex items-center gap-2 text-[10px] text-[#E7FE55] font-semibold uppercase tracking-[0.1em] mb-2">
                            <DollarSign className="h-3 w-3" /> Capital & Risk
                        </div>

                        {/* Main Grid - 5 columns */}
                        <div className="grid grid-cols-5 gap-2 mb-2">
                            {/* Capital Type */}
                            <div className="bg-[#0f1015] p-2 rounded border border-[#232328]">
                                <label className="block text-[9px] text-[#747580] uppercase tracking-wider mb-1">Type</label>
                                <div className="flex gap-0.5">
                                    <button
                                        onClick={() => handleLocalUpdate({ bankrollType: 'MANUAL' })}
                                        className={`flex-1 py-1 text-[9px] font-semibold rounded transition-all ${localSettings.bankrollType === 'MANUAL' ? 'bg-[#E7FE55] text-black' : 'text-[#747580] hover:text-white'}`}
                                    >Fix</button>
                                    <button
                                        onClick={() => handleLocalUpdate({ bankrollType: 'ALL_AVAILABLE' })}
                                        className={`flex-1 py-1 text-[9px] font-semibold rounded transition-all ${localSettings.bankrollType === 'ALL_AVAILABLE' ? 'bg-[#E7FE55] text-black' : 'text-[#747580] hover:text-white'}`}
                                    >Max</button>
                                </div>
                            </div>

                            {/* Amount (conditional) */}
                            <div className="bg-[#0f1015] p-2 rounded border border-[#232328]">
                                <label className="block text-[9px] text-[#747580] uppercase tracking-wider mb-1">Amount ($)</label>
                                {localSettings.bankrollType === 'MANUAL' ? (
                                    <div className="flex items-center">
                                        <input
                                            type="number"
                                            value={localSettings.manualBankroll}
                                            onChange={(e) => handleLocalUpdate({ manualBankroll: parseFloat(e.target.value) })}
                                            className="w-full bg-transparent text-sm font-mono text-white focus:outline-none"
                                        />
                                    </div>
                                ) : (
                                    <span className="text-sm font-mono text-[#E7FE55]">Auto</span>
                                )}
                            </div>

                            {/* Leverage */}
                            <div className="bg-[#0f1015] p-2 rounded border border-[#232328]">
                                <label className="block text-[9px] text-[#747580] uppercase tracking-wider mb-1">Leverage</label>
                                <div className="flex items-center">
                                    <input
                                        type="number"
                                        value={localSettings.maxLeverage}
                                        onChange={(e) => handleLocalUpdate({ maxLeverage: parseInt(e.target.value) })}
                                        className="w-full bg-transparent text-sm font-bold font-mono text-white focus:outline-none"
                                    />
                                    <span className="text-[14px] text-[#747580]">x</span>
                                </div>
                            </div>

                            {/* Pos/Cycle */}
                            <div className="bg-[#0f1015] p-2 rounded border border-[#232328]">
                                <label className="block text-[9px] text-[#747580] uppercase tracking-wider mb-1">Pos/Cycle</label>
                                <input
                                    type="number"
                                    value={localSettings.maxOpenPositions}
                                    onChange={(e) => handleLocalUpdate({ maxOpenPositions: parseInt(e.target.value) })}
                                    className="w-full bg-transparent text-sm font-bold font-mono text-white focus:outline-none"
                                />
                            </div>

                            {/* Max Size */}
                            <div className="bg-[#0f1015] p-2 rounded border border-[#232328]">
                                <label className="block text-[9px] text-[#747580] uppercase tracking-wider mb-1">Max Size ($)</label>
                                <div className="flex items-center">
                                    <input
                                        type="number"
                                        value={localSettings.maxPositionSizeUSDC}
                                        onChange={(e) => handleLocalUpdate({ maxPositionSizeUSDC: parseInt(e.target.value) })}
                                        className="w-full bg-transparent text-sm font-bold font-mono text-white focus:outline-none"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Toggles Row - Aggressive + SL + TP */}
                        <div className="flex items-center gap-4 pt-2 border-t border-[#232328]">
                            {/* Aggressive */}
                            <label className="flex items-center gap-1.5 cursor-pointer group">
                                <Zap className="h-3 w-3 text-red-400" />
                                <span className="text-[10px] text-[#747580] group-hover:text-white">Aggressive</span>
                                <button
                                    onClick={() => handleLocalUpdate({ aggressiveMode: !localSettings.aggressiveMode })}
                                    className={`relative inline-flex h-4 w-7 items-center rounded-full transition-colors ${localSettings.aggressiveMode ? 'bg-red-500' : 'bg-[#3a3b42]'}`}
                                >
                                    <span className={`${localSettings.aggressiveMode ? 'translate-x-4' : 'translate-x-0.5'} inline-block h-2.5 w-2.5 transform rounded-full bg-white transition-transform`} />
                                </button>
                            </label>

                            <div className="w-px h-4 bg-[#232328]" />

                            {/* Stop Loss */}
                            <div className="flex items-center gap-1.5">
                                <ShieldCheck className="h-3 w-3 text-red-400" />
                                <span className="text-[10px] text-[#747580]">STOP LOSS</span>
                                {localSettings.stopLossEnabled && (
                                    <>
                                        <input
                                            type="number"
                                            step="0.5"
                                            value={localSettings.stopLossPercent ?? ''}
                                            placeholder="AI"
                                            onChange={(e) => handleLocalUpdate({ stopLossPercent: e.target.value ? parseFloat(e.target.value) : null })}
                                            className="w-10 bg-[#0f1015] border border-[#232328] rounded px-1 py-0.5 text-[10px] text-white font-mono focus:outline-none placeholder:text-[#747580]"
                                        />
                                        <span className="text-[9px] text-[#747580]">%</span>
                                    </>
                                )}
                                <button
                                    onClick={() => handleLocalUpdate({ stopLossEnabled: !localSettings.stopLossEnabled })}
                                    className={`relative inline-flex h-4 w-7 items-center rounded-full transition-colors ${localSettings.stopLossEnabled ? 'bg-red-500' : 'bg-[#3a3b42]'}`}
                                >
                                    <span className={`${localSettings.stopLossEnabled ? 'translate-x-4' : 'translate-x-0.5'} inline-block h-2.5 w-2.5 transform rounded-full bg-white transition-transform`} />
                                </button>
                            </div>

                            <div className="w-px h-4 bg-[#232328]" />

                            {/* Take Profit */}
                            <div className="flex items-center gap-1.5">
                                <Target className="h-3 w-3 text-[#34d399]" />
                                <span className="text-[10px] text-[#747580]">TAKE PROFIT</span>
                                {localSettings.takeProfitEnabled && (
                                    <>
                                        <input
                                            type="number"
                                            step="0.5"
                                            value={localSettings.takeProfitPercent ?? ''}
                                            placeholder="AI"
                                            onChange={(e) => handleLocalUpdate({ takeProfitPercent: e.target.value ? parseFloat(e.target.value) : null })}
                                            className="w-10 bg-[#0f1015] border border-[#232328] rounded px-1 py-0.5 text-[10px] text-white font-mono focus:outline-none placeholder:text-[#747580]"
                                        />
                                        <span className="text-[9px] text-[#747580]">%</span>
                                    </>
                                )}
                                <button
                                    onClick={() => handleLocalUpdate({ takeProfitEnabled: !localSettings.takeProfitEnabled })}
                                    className={`relative inline-flex h-4 w-7 items-center rounded-full transition-colors ${localSettings.takeProfitEnabled ? 'bg-[#34d399]' : 'bg-[#3a3b42]'}`}
                                >
                                    <span className={`${localSettings.takeProfitEnabled ? 'translate-x-4' : 'translate-x-0.5'} inline-block h-2.5 w-2.5 transform rounded-full bg-white transition-transform`} />
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Core Analysis Settings Card */}
                    <div className="glass-panel p-4">
                        <div className="flex items-center gap-2 text-[10px] text-[#E7FE55] font-semibold uppercase tracking-[0.1em] mb-3">
                            <BarChart2 className="h-3.5 w-3.5" /> Analysis Settings
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                            <div className="bg-[#0f1015] p-3 rounded border border-[#232328]">
                                <label className="block text-[10px] text-[#747580] font-medium mb-1.5 uppercase tracking-wider">Timeframe</label>
                                <select
                                    className="w-full bg-transparent text-sm font-mono text-white focus:outline-none cursor-pointer [&>option]:bg-[#0f1015]"
                                    value={localSettings.analysisTimeframe || '60'}
                                    onChange={(e) => handleLocalUpdate({ analysisTimeframe: e.target.value })}
                                >
                                    <option value="1">1m</option>
                                    <option value="5">5m</option>
                                    <option value="15">15m</option>
                                    <option value="60">1H</option>
                                    <option value="240">4H</option>
                                    <option value="D">1D</option>
                                </select>
                            </div>
                            <div className="bg-[#0f1015] p-3 rounded border border-[#232328]">
                                <label className="block text-[10px] text-[#747580] font-medium mb-1.5 uppercase tracking-wider">Indicators History</label>
                                <input
                                    type="number"
                                    min={10}
                                    max={100}
                                    value={localSettings.historyCandles || 100}
                                    onChange={(e) => handleLocalUpdate({
                                        historyCandles: Math.min(100, Math.max(10, parseInt(e.target.value) || 100))
                                    })}
                                    className="w-full bg-transparent text-sm font-mono text-white focus:outline-none"
                                    title="10-100"
                                />
                            </div>
                            <div className="bg-[#0f1015] p-3 rounded border border-[#232328]">
                                <label className="block text-[10px] text-[#747580] font-medium mb-1.5 uppercase tracking-wider">
                                    <Clock className="inline h-3 w-3 mr-1 opacity-50" />Interval
                                </label>
                                <div className="flex items-baseline gap-1">
                                    <input
                                        type="number"
                                        value={localSettings.checkIntervalSeconds}
                                        onChange={(e) => handleLocalUpdate({ checkIntervalSeconds: Math.max(60, parseInt(e.target.value) || 60) })}
                                        className="w-full bg-transparent text-sm font-mono text-white focus:outline-none"
                                    />
                                    <span className="text-[10px] text-[#747580]">s</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Macro Timeframe Card */}
                    <div className="glass-panel p-4">
                        <div className="flex items-center gap-2 text-[10px] text-[#E7FE55] font-semibold uppercase tracking-[0.1em] mb-3">
                            <TrendingUp className="h-3.5 w-3.5" /> Macro Timeframe
                        </div>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <span className="text-[11px] text-[#747580]">Multi-timeframe confirmation</span>
                            </div>
                            <div className="flex items-center gap-3">
                                {localSettings.macroTimeframeEnabled && (
                                    <select
                                        className="bg-[#0f1015] border border-[#232328] rounded py-1.5 px-2 text-[11px] text-white focus:outline-none focus:border-amber-500 [&>option]:bg-[#0f1015]"
                                        value={localSettings.macroTimeframe || '240'}
                                        onChange={(e) => handleLocalUpdate({ macroTimeframe: e.target.value })}
                                    >
                                        <option value="15">15m</option>
                                        <option value="60">1H</option>
                                        <option value="240">4H</option>
                                        <option value="D">1D</option>
                                        <option value="W">1W</option>
                                    </select>
                                )}
                                <button
                                    onClick={() => handleLocalUpdate({ macroTimeframeEnabled: !localSettings.macroTimeframeEnabled })}
                                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${localSettings.macroTimeframeEnabled ? 'bg-amber-500' : 'bg-[#3a3b42]'}`}
                                >
                                    <span className={`${localSettings.macroTimeframeEnabled ? 'translate-x-5' : 'translate-x-1'} inline-block h-3 w-3 transform rounded-full bg-white transition-transform`} />
                                </button>
                            </div>
                        </div>
                        {localSettings.macroTimeframeEnabled && (
                            <div className="mt-3">
                                <div className="text-[10px] text-[#747580] mb-2 uppercase tracking-wider">Active Indicators:</div>
                                <div className="grid grid-cols-4 gap-1.5">
                                    {Object.entries(localSettings.indicatorSettings)
                                        .filter(([_, config]) => config.enabled)
                                        .map(([name, _]) => {
                                            const isSelected = localSettings.macroEnabledIndicators?.includes(name);
                                            return (
                                                <button
                                                    key={name}
                                                    onClick={() => {
                                                        const current = localSettings.macroEnabledIndicators || [];
                                                        const updated = current.includes(name)
                                                            ? current.filter(i => i !== name)
                                                            : [...current, name];
                                                        handleLocalUpdate({ macroEnabledIndicators: updated });
                                                    }}
                                                    className={`
                                                        px-1.5 py-0.5 rounded text-[10px] font-mono border transition-all truncate
                                                        ${isSelected
                                                            ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 hover:bg-amber-500/30'
                                                            : 'bg-[#0f1015] border-[#232328] text-[#747580] hover:border-[#747580]'
                                                        }
                                                    `}
                                                    title={name.toUpperCase()}
                                                >
                                                    {name.toUpperCase()}
                                                </button>
                                            );
                                        })}
                                </div>
                                {(!localSettings.macroEnabledIndicators || localSettings.macroEnabledIndicators.length === 0) && (
                                    <div className="text-[10px] text-red-400 mt-2 flex items-center gap-1">
                                        <ShieldCheck size={10} /> No macro indicators selected
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Trading Pairs Card */}
                    <div className="glass-panel p-4">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2 text-[10px] text-[#E7FE55] font-semibold uppercase tracking-[0.1em]">
                                <Target className="h-3.5 w-3.5" /> Trading Pairs
                            </div>
                            <span className="text-[10px] bg-[#E7FE55]/15 text-[#E7FE55] px-2 py-0.5 rounded border border-[#E7FE55]/30 font-mono">
                                {localSettings.tradingPairs.length}
                            </span>
                        </div>

                        {/* Add Pair */}
                        <select
                            disabled={isLoadingAssets}
                            onChange={(e) => {
                                if (e.target.value) addAsset(e.target.value);
                                e.target.value = "";
                            }}
                            className="w-full bg-[#0f1015] border border-[#232328] rounded py-2 px-3 text-[11px] text-[#747580] focus:outline-none focus:text-white focus:border-[#E7FE55] transition-colors [&>option]:bg-[#0f1015] cursor-pointer hover:border-[#E7FE55]/30 mb-3"
                        >
                            <option value="">{isLoadingAssets ? "Loading..." : "+ Add Pair..."}</option>
                            {!isLoadingAssets && availableAssets
                                .filter(a => !localSettings.tradingPairs.includes(a))
                                .map(asset => (
                                    <option key={asset} value={asset}>{asset}</option>
                                ))
                            }
                        </select>

                        {/* Chips */}
                        <div className="flex flex-wrap gap-1.5 max-h-[120px] overflow-y-auto custom-scrollbar">
                            {localSettings.tradingPairs.map(asset => (
                                <span key={asset} className="inline-flex items-center gap-1 bg-[#1a1b21] hover:bg-[#232328] border border-[#232328] hover:border-[#E7FE55]/50 text-[#a0a1a8] hover:text-white px-2 py-1 rounded text-[10px] font-mono transition-all">
                                    {asset}
                                    <button
                                        onClick={() => removeAsset(asset)}
                                        className="text-[#747580] hover:text-red-400 transition-colors"
                                    >
                                        <X size={10} />
                                    </button>
                                </span>
                            ))}
                            {localSettings.tradingPairs.length === 0 && (
                                <div className="w-full py-4 flex flex-col items-center justify-center text-[#747580] opacity-60 border border-dashed border-[#232328] rounded">
                                    <Target className="h-5 w-5 mb-1" />
                                    <span className="text-[10px]">No pairs</span>
                                </div>
                            )}
                        </div>
                    </div>

                </div>

                {/* RIGHT COLUMN: Indicators */}
                <div className="glass-panel flex flex-col overflow-hidden">
                    <div className="p-3 border-b border-[#232328] flex items-center justify-between shrink-0">
                        <div className="flex items-center gap-2 text-[10px] text-[#E7FE55] font-semibold uppercase tracking-[0.1em]">
                            <Activity className="h-3.5 w-3.5" /> Indicators
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] text-[#747580]">
                                {localSettings.autonomousIndicators ? 'Auto' : 'Manual'}
                            </span>
                            <button
                                onClick={() => handleLocalUpdate({ autonomousIndicators: !localSettings.autonomousIndicators })}
                                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${localSettings.autonomousIndicators ? 'bg-[#34d399]' : 'bg-[#E7FE55]'}`}
                                title={localSettings.autonomousIndicators ? 'AI selects indicators' : 'Manual selection'}
                            >
                                <span className={`${localSettings.autonomousIndicators ? 'translate-x-5' : 'translate-x-1'} inline-block h-3 w-3 transform rounded-full bg-white transition-transform`} />
                            </button>
                        </div>
                    </div>

                    {/* Indicators Panel */}
                    <div className="p-4">
                        <IndicatorConfigPanel
                            indicatorSettings={localSettings.indicatorSettings}
                            autonomousMode={localSettings.autonomousIndicators}
                            selectedPreset={localSettings.selectedPreset || 'balanced'}
                            onUpdateIndicatorSettings={(newSettings: Partial<IndicatorSettings>) => {
                                handleLocalUpdate({
                                    indicatorSettings: { ...localSettings.indicatorSettings, ...newSettings }
                                });
                            }}
                            onToggleAutonomousMode={(enabled: boolean) => {
                                handleLocalUpdate({ autonomousIndicators: enabled });
                            }}
                            onSelectPreset={(preset) => {
                                handleLocalUpdate({ selectedPreset: preset });
                            }}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};
