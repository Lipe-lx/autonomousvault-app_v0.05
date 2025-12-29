import React, { useState, useMemo } from 'react';
import {
    Activity, Zap, TrendingUp, BarChart2, Settings,
    ChevronDown, ChevronUp, RefreshCw, Cpu
} from 'lucide-react';
import {
    IndicatorSettings,
    IndicatorConfig,
    DEFAULT_INDICATOR_SETTINGS,
    INDICATOR_CATEGORIES,
    INDICATOR_PRESETS,
    MAX_TOTAL_INDICATORS,
    IndicatorCategoryName,
    PresetName
} from '../../state/dealerStore';
import { marketDataMCP } from '../../mcp/marketData/marketDataMCP';
import {
    countEnabledInCategory,
    isCategoryAtLimit,
    countTotalEnabled,
    isTotalLimitReached,
    canEnableIndicator,
    applyPreset,
    detectCurrentPreset
} from '../../utils/indicatorUtils';

interface IndicatorConfigPanelProps {
    indicatorSettings: IndicatorSettings;
    autonomousMode: boolean;
    selectedPreset: PresetName;
    onUpdateIndicatorSettings: (settings: Partial<IndicatorSettings>) => void;
    onToggleAutonomousMode: (enabled: boolean) => void;
    onSelectPreset: (preset: PresetName) => void;
}

interface IndicatorMeta {
    name: string;
    key: keyof IndicatorSettings;
    description: string;
    icon: React.ReactNode;
    params: { key: string; label: string; default: number }[];
}

// Indicator metadata for UI
const INDICATOR_METADATA: Record<keyof IndicatorSettings, IndicatorMeta> = {
    rsi: {
        name: 'RSI',
        key: 'rsi',
        description: 'Relative Strength Index',
        icon: <Activity size={14} />,
        params: [{ key: 'period', label: 'Period', default: 14 }]
    },
    macd: {
        name: 'MACD',
        key: 'macd',
        description: 'Moving Average Convergence Divergence',
        icon: <TrendingUp size={14} />,
        params: [
            { key: 'fast', label: 'Fast', default: 12 },
            { key: 'slow', label: 'Slow', default: 26 },
            { key: 'signal', label: 'Signal', default: 9 }
        ]
    },
    bollinger: {
        name: 'Bollinger',
        key: 'bollinger',
        description: 'Bollinger Bands',
        icon: <BarChart2 size={14} />,
        params: [
            { key: 'period', label: 'Period', default: 20 },
            { key: 'stdDev', label: 'StdDev', default: 2 }
        ]
    },
    atr: {
        name: 'ATR',
        key: 'atr',
        description: 'Average True Range',
        icon: <Zap size={14} />,
        params: [{ key: 'period', label: 'Period', default: 14 }]
    },
    adx: {
        name: 'ADX',
        key: 'adx',
        description: 'Average Directional Index',
        icon: <TrendingUp size={14} />,
        params: [{ key: 'period', label: 'Period', default: 14 }]
    },
    obv: {
        name: 'OBV',
        key: 'obv',
        description: 'On-Balance Volume',
        icon: <BarChart2 size={14} />,
        params: []
    },
    vwap: {
        name: 'VWAP',
        key: 'vwap',
        description: 'Volume Weighted Avg Price',
        icon: <Activity size={14} />,
        params: []
    },
    ichimoku: {
        name: 'Ichimoku',
        key: 'ichimoku',
        description: 'Ichimoku Cloud',
        icon: <TrendingUp size={14} />,
        params: [
            { key: 'conversion', label: 'Conv', default: 9 },
            { key: 'base', label: 'Base', default: 26 },
            { key: 'spanB', label: 'SpanB', default: 52 },
            { key: 'displacement', label: 'Disp', default: 26 }
        ]
    },
    ema: {
        name: 'EMA',
        key: 'ema',
        description: 'Exponential Moving Average',
        icon: <TrendingUp size={14} />,
        params: [{ key: 'period', label: 'Period', default: 20 }]
    },
    sma: {
        name: 'SMA',
        key: 'sma',
        description: 'Simple Moving Average',
        icon: <TrendingUp size={14} />,
        params: [{ key: 'period', label: 'Period', default: 20 }]
    },
    stoch: {
        name: 'Stochastic',
        key: 'stoch',
        description: 'Stochastic Oscillator',
        icon: <Activity size={14} />,
        params: [
            { key: 'period', label: 'Period', default: 14 },
            { key: 'signalPeriod', label: 'Signal', default: 3 }
        ]
    }
};

// Category colors
const CATEGORY_COLORS: Record<IndicatorCategoryName, { bg: string; text: string; border: string }> = {
    trend: { bg: 'bg-purple-500/10', text: 'text-purple-400', border: 'border-purple-500/30' },
    momentum: { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/30' },
    volume: { bg: 'bg-green-500/10', text: 'text-green-400', border: 'border-green-500/30' },
    volatility: { bg: 'bg-orange-500/10', text: 'text-orange-400', border: 'border-orange-500/30' }
};

// Category icons
const CATEGORY_ICONS: Record<IndicatorCategoryName, React.ReactNode> = {
    trend: <TrendingUp size={14} />,
    momentum: <Activity size={14} />,
    volume: <BarChart2 size={14} />,
    volatility: <Zap size={14} />
};

interface TestResult {
    indicator: string;
    value: any;
    loading: boolean;
    error?: string;
}

export const IndicatorConfigPanel: React.FC<IndicatorConfigPanelProps> = ({
    indicatorSettings,
    autonomousMode,
    selectedPreset,
    onUpdateIndicatorSettings,
    onToggleAutonomousMode,
    onSelectPreset
}) => {
    const [expandedCategory, setExpandedCategory] = useState<IndicatorCategoryName | null>('trend');
    const [expandedIndicator, setExpandedIndicator] = useState<string | null>(null);
    const [testResults, setTestResults] = useState<TestResult[]>([]);
    const [isTesting, setIsTesting] = useState(false);
    const [showTestResults, setShowTestResults] = useState(false);

    // Calculate summary
    const totalEnabled = useMemo(() => countTotalEnabled(indicatorSettings), [indicatorSettings]);
    const currentPreset = useMemo(() => detectCurrentPreset(indicatorSettings), [indicatorSettings]);
    const totalLimitReached = useMemo(() => isTotalLimitReached(indicatorSettings), [indicatorSettings]);

    const toggleIndicator = (key: keyof IndicatorSettings) => {
        const current = indicatorSettings[key];
        const canToggle = canEnableIndicator(indicatorSettings, key);

        if (!canToggle && !current.enabled) {
            return; // Cannot enable - limit reached
        }

        onUpdateIndicatorSettings({
            [key]: { ...current, enabled: !current.enabled }
        });

        // If toggling changes preset detection, update to custom
        if (currentPreset !== 'custom') {
            onSelectPreset('custom');
        }
    };

    const updateWeight = (key: keyof IndicatorSettings, weight: number) => {
        const current = indicatorSettings[key];
        onUpdateIndicatorSettings({
            [key]: { ...current, weight: Math.max(0.5, Math.min(2.0, weight)) }
        });
    };

    const updateParam = (key: keyof IndicatorSettings, paramKey: string, value: number) => {
        const current = indicatorSettings[key];
        onUpdateIndicatorSettings({
            [key]: {
                ...current,
                params: { ...current.params, [paramKey]: value }
            }
        });
    };

    const handlePresetSelect = (preset: PresetName) => {
        if (preset === 'custom') return;
        const newSettings = applyPreset(preset, indicatorSettings);
        onUpdateIndicatorSettings(newSettings);
        onSelectPreset(preset);
    };

    const resetToDefaults = () => {
        onUpdateIndicatorSettings(DEFAULT_INDICATOR_SETTINGS);
        onSelectPreset('balanced');
    };

    const testIndicators = async () => {
        setIsTesting(true);
        setShowTestResults(true);
        const results: TestResult[] = [];

        const enabledIndicators = Object.keys(indicatorSettings).filter(
            key => indicatorSettings[key as keyof IndicatorSettings].enabled
        ) as (keyof IndicatorSettings)[];

        for (const key of enabledIndicators) {
            const meta = INDICATOR_METADATA[key];
            results.push({ indicator: meta.name, value: null, loading: true });
            setTestResults([...results]);

            try {
                const config = indicatorSettings[key];
                const result = await marketDataMCP.getIndicator('BTCUSDT', key, '60', config.params);
                results[results.length - 1] = {
                    indicator: meta.name,
                    value: result.value,
                    loading: false
                };
            } catch (error: any) {
                results[results.length - 1] = {
                    indicator: meta.name,
                    value: null,
                    loading: false,
                    error: error.message
                };
            }
            setTestResults([...results]);
        }

        setIsTesting(false);
    };

    // If autonomous mode, show enhanced message with preset info
    if (autonomousMode) {
        return (
            <div className="h-full flex flex-col items-center justify-center text-center p-4">
                <div className="h-14 w-14 rounded-full bg-gradient-to-br from-emerald-500/30 to-cyan-500/30 flex items-center justify-center mb-4 border border-emerald-500/20">
                    <Cpu className="h-7 w-7 text-emerald-400" />
                </div>
                <h3 className="text-white font-semibold mb-2">Autonomous Mode Active</h3>
                <p className="text-xs text-gray-400 max-w-[280px] mb-4">
                    AI will analyze market conditions and choose the optimal preset each cycle:
                </p>
                <div className="grid grid-cols-2 gap-2 w-full max-w-[320px] text-[10px]">
                    {(Object.entries(INDICATOR_PRESETS) as [PresetName, typeof INDICATOR_PRESETS[PresetName]][])
                        .filter(([key]) => key !== 'custom')
                        .map(([key, preset]) => (
                            <div
                                key={key}
                                className="bg-gray-800/50 border border-gray-700/30 rounded-lg p-2 text-left"
                            >
                                <div className="flex items-center gap-1.5 mb-0.5">
                                    <span>{preset.emoji}</span>
                                    <span className="text-gray-300 font-medium">{preset.name}</span>
                                </div>
                                <div className="text-gray-500">{preset.marketCondition}</div>
                            </div>
                        ))}
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {/* Preset Selector */}
            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <span className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Presets</span>
                    <span className={`text-[10px] font-mono ${totalLimitReached ? 'text-orange-400' : 'text-gray-400'}`}>
                        {totalEnabled} / {MAX_TOTAL_INDICATORS} selected
                    </span>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                    {(Object.entries(INDICATOR_PRESETS) as [PresetName, typeof INDICATOR_PRESETS[PresetName]][])
                        .filter(([key]) => key !== 'custom')
                        .map(([key, preset]) => (
                            <button
                                key={key}
                                onClick={() => handlePresetSelect(key)}
                                className={`px-2 py-1.5 rounded-lg text-[10px] font-medium transition-all border ${currentPreset === key
                                    ? 'bg-purple-500/20 border-purple-500/50 text-purple-300'
                                    : 'bg-gray-800/30 border-gray-700/30 text-gray-400 hover:border-gray-600'
                                    }`}
                                title={preset.description}
                            >
                                <span className="mr-1">{preset.emoji}</span>
                                {preset.name}
                            </button>
                        ))}
                </div>
                {currentPreset === 'custom' && (
                    <div className="text-[10px] text-gray-500 text-center">
                        ⚙️ Custom configuration
                    </div>
                )}
            </div>

            {/* Categories */}
            <div className="space-y-2">
                {(Object.entries(INDICATOR_CATEGORIES) as [IndicatorCategoryName, typeof INDICATOR_CATEGORIES[IndicatorCategoryName]][]).map(([categoryKey, category]) => {
                    const isExpanded = expandedCategory === categoryKey;
                    const enabledInCat = countEnabledInCategory(indicatorSettings, categoryKey);
                    const atLimit = isCategoryAtLimit(indicatorSettings, categoryKey);
                    const colors = CATEGORY_COLORS[categoryKey];

                    return (
                        <div key={categoryKey} className={`rounded-lg border ${colors.border} overflow-hidden`}>
                            {/* Category Header */}
                            <button
                                onClick={() => setExpandedCategory(isExpanded ? null : categoryKey)}
                                className={`w-full px-3 py-2 flex items-center justify-between ${colors.bg}`}
                            >
                                <div className="flex items-center gap-2">
                                    <span className={colors.text}>{CATEGORY_ICONS[categoryKey]}</span>
                                    <span className={`text-xs font-medium ${colors.text}`}>{category.name}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${atLimit
                                        ? 'bg-orange-500/20 text-orange-400'
                                        : 'bg-gray-700/50 text-gray-400'
                                        }`}>
                                        {enabledInCat}/{category.maxIndicators}
                                    </span>
                                    {isExpanded ? (
                                        <ChevronUp size={14} className="text-gray-500" />
                                    ) : (
                                        <ChevronDown size={14} className="text-gray-500" />
                                    )}
                                </div>
                            </button>

                            {/* Indicators in Category */}
                            {isExpanded && (
                                <div className="p-2 space-y-1.5 bg-gray-900/30">
                                    {category.indicators.map((indKey) => {
                                        const config = indicatorSettings[indKey];
                                        const meta = INDICATOR_METADATA[indKey];
                                        const canToggleOn = canEnableIndicator(indicatorSettings, indKey);
                                        const isIndExpanded = expandedIndicator === indKey;

                                        return (
                                            <div
                                                key={indKey}
                                                className={`rounded-lg border transition-all ${config.enabled
                                                    ? `${colors.border} ${colors.bg}`
                                                    : 'border-gray-700/30 bg-gray-800/20'
                                                    }`}
                                            >
                                                {/* Indicator Row */}
                                                <div className="px-2.5 py-1.5 flex items-center gap-2">
                                                    {/* Enable Toggle */}
                                                    <button
                                                        onClick={() => toggleIndicator(indKey)}
                                                        disabled={!canToggleOn && !config.enabled}
                                                        className={`shrink-0 w-7 h-3.5 rounded-full relative transition-all ${config.enabled
                                                            ? 'bg-purple-500'
                                                            : canToggleOn
                                                                ? 'bg-gray-600'
                                                                : 'bg-gray-700 opacity-40 cursor-not-allowed'
                                                            }`}
                                                        title={!canToggleOn && !config.enabled ? 'Limit reached' : undefined}
                                                    >
                                                        <div
                                                            className="absolute top-0.5 w-2.5 h-2.5 rounded-full bg-white transition-all"
                                                            style={{ left: config.enabled ? '14px' : '2px' }}
                                                        />
                                                    </button>

                                                    {/* Expand button */}
                                                    <button
                                                        onClick={() => setExpandedIndicator(isIndExpanded ? null : indKey)}
                                                        className="flex items-center gap-1.5 flex-1 text-left"
                                                    >
                                                        <span className={`text-xs font-medium ${config.enabled ? 'text-white' : 'text-gray-400'}`}>
                                                            {meta.name}
                                                        </span>
                                                        <span className="text-[9px] text-gray-500 truncate">
                                                            {meta.description}
                                                        </span>
                                                    </button>

                                                    {/* Weight Badge */}
                                                    {config.enabled && (
                                                        <span className={`text-[9px] font-mono px-1 py-0.5 rounded ${config.weight > 1
                                                            ? 'bg-green-500/20 text-green-400'
                                                            : config.weight < 1
                                                                ? 'bg-yellow-500/20 text-yellow-400'
                                                                : 'bg-gray-700/50 text-gray-400'
                                                            }`}>
                                                            {config.weight.toFixed(1)}×
                                                        </span>
                                                    )}

                                                    {/* Expand icon */}
                                                    {(meta.params.length > 0 || config.enabled) && (
                                                        <button onClick={() => setExpandedIndicator(isIndExpanded ? null : indKey)}>
                                                            {isIndExpanded ? (
                                                                <ChevronUp size={12} className="text-gray-500" />
                                                            ) : (
                                                                <ChevronDown size={12} className="text-gray-500" />
                                                            )}
                                                        </button>
                                                    )}
                                                </div>

                                                {/* Expanded: Params + Weight */}
                                                {isIndExpanded && (
                                                    <div className="px-2.5 pb-2 pt-1 border-t border-gray-700/30 space-y-2">
                                                        {/* Weight Slider */}
                                                        {config.enabled && (
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-[9px] text-gray-500 w-10">Weight</span>
                                                                <input
                                                                    type="range"
                                                                    min="0.5"
                                                                    max="2.0"
                                                                    step="0.1"
                                                                    value={config.weight}
                                                                    onChange={(e) => updateWeight(indKey, parseFloat(e.target.value))}
                                                                    className="flex-1 h-1 bg-gray-700 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-purple-500"
                                                                />
                                                                <span className={`text-[10px] font-mono w-8 text-right ${config.weight > 1
                                                                    ? 'text-green-400'
                                                                    : config.weight < 1
                                                                        ? 'text-yellow-400'
                                                                        : 'text-gray-400'
                                                                    }`}>
                                                                    {config.weight.toFixed(1)}×
                                                                </span>
                                                            </div>
                                                        )}

                                                        {/* Parameters */}
                                                        {meta.params.length > 0 && (
                                                            <div className="flex flex-wrap gap-1.5">
                                                                {meta.params.map(param => (
                                                                    <div key={param.key} className="flex items-center gap-1 bg-gray-900/50 px-1.5 py-0.5 rounded">
                                                                        <label className="text-[9px] text-gray-400">{param.label}</label>
                                                                        <input
                                                                            type="number"
                                                                            value={config.params[param.key] || param.default}
                                                                            onChange={(e) => updateParam(indKey, param.key, parseInt(e.target.value))}
                                                                            className="w-10 bg-transparent border border-gray-700/50 rounded px-1 py-0.5 text-[9px] text-white focus:outline-none focus:border-purple-500"
                                                                        />
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-center gap-2 pt-2 border-t border-gray-700/30">
                <button
                    onClick={testIndicators}
                    disabled={isTesting || totalEnabled === 0}
                    className="flex items-center justify-center gap-1.5 bg-[#E7FE55] hover:bg-[#d4e94d] disabled:bg-gray-700 disabled:text-gray-500 text-black px-3 py-1.5 rounded text-[10px] font-bold uppercase tracking-wide transition-all"
                >
                    {isTesting ? (
                        <RefreshCw size={10} className="animate-spin" />
                    ) : (
                        <Zap size={10} />
                    )}
                    Test ({totalEnabled})
                </button>
                <button
                    onClick={resetToDefaults}
                    className="px-2 py-1.5 bg-gray-700 hover:bg-gray-600 text-white rounded text-[10px] transition-all"
                    title="Reset to Balanced Preset"
                >
                    <RefreshCw size={10} />
                </button>
            </div>

            {/* Test Results */}
            {showTestResults && testResults.length > 0 && (
                <div className="bg-gray-900/50 rounded-lg border border-gray-700/30 p-2">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-bold text-gray-400">Results (BTC 1H)</span>
                        <button
                            onClick={() => { setTestResults([]); setShowTestResults(false); }}
                            className="text-[9px] text-gray-500 hover:text-gray-300"
                        >
                            Clear
                        </button>
                    </div>
                    <div className="space-y-1">
                        {testResults.map((result, i) => (
                            <div key={i} className="flex items-center justify-between text-[10px] bg-gray-800/30 px-2 py-1 rounded">
                                <span className="text-gray-300">{result.indicator}</span>
                                {result.loading ? (
                                    <span className="text-gray-500">...</span>
                                ) : result.error ? (
                                    <span className="text-red-400" title={result.error}>ERR</span>
                                ) : (
                                    <span className="text-emerald-400 font-mono">
                                        {typeof result.value === 'object'
                                            ? '✓'
                                            : typeof result.value === 'number'
                                                ? result.value.toFixed(2)
                                                : String(result.value)}
                                    </span>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};
