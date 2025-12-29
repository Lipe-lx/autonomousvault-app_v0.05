// src/components/polymarket/PolymarketPromptPage.tsx
// Strategy prompt editor for Polymarket Dealer - follows DealerPromptPage.tsx pattern

import React, { useState, useEffect } from 'react';
import { Save, Sparkles, Wand2 } from 'lucide-react';
import {
    PolymarketSettings,
    PolymarketPresetName,
    POLYMARKET_PRESETS,
    POLYMARKET_PRESET_PROMPTS
} from '../../state/polymarketStore';

interface PolymarketPromptPageProps {
    settings: PolymarketSettings;
    onUpdateSettings: (settings: Partial<PolymarketSettings>) => void;
    onApplyChanges: () => void;
}

export const PolymarketPromptPage: React.FC<PolymarketPromptPageProps> = ({
    settings,
    onUpdateSettings,
    onApplyChanges
}) => {
    const [localPrompt, setLocalPrompt] = useState(settings.strategyPrompt);
    const [hasChanges, setHasChanges] = useState(false);
    const [promptMode, setPromptMode] = useState<'preset' | 'custom'>(settings.promptMode || 'preset');
    const [selectedPreset, setSelectedPreset] = useState<PolymarketPresetName>(settings.selectedPreset || 'balanced');

    useEffect(() => {
        setLocalPrompt(settings.strategyPrompt);
        setPromptMode(settings.promptMode || 'preset');
        setSelectedPreset(settings.selectedPreset || 'balanced');
    }, [settings.strategyPrompt, settings.promptMode, settings.selectedPreset]);

    useEffect(() => {
        setHasChanges(localPrompt !== settings.strategyPrompt);
    }, [localPrompt, settings.strategyPrompt]);

    const handlePresetSelect = (preset: PolymarketPresetName) => {
        if (preset === 'custom') {
            setPromptMode('custom');
            setSelectedPreset('custom');
            setHasChanges(true);
        } else {
            const presetPrompt = POLYMARKET_PRESET_PROMPTS[preset];
            setLocalPrompt(presetPrompt);
            setPromptMode('preset');
            setSelectedPreset(preset);
            setHasChanges(presetPrompt !== settings.strategyPrompt);
        }
    };

    const handlePromptChange = (value: string) => {
        setLocalPrompt(value);

        // Check if text matches any preset
        const matchingPreset = (Object.entries(POLYMARKET_PRESET_PROMPTS) as [PolymarketPresetName, string][])
            .find(([_, prompt]) => prompt === value);

        if (matchingPreset) {
            setPromptMode('preset');
            setSelectedPreset(matchingPreset[0]);
        } else {
            setPromptMode('custom');
            setSelectedPreset('custom');
        }

        setHasChanges(value !== settings.strategyPrompt);
    };

    const handleSave = () => {
        onUpdateSettings({
            strategyPrompt: localPrompt,
            promptMode,
            selectedPreset
        });
        onApplyChanges();
        setHasChanges(false);
    };

    // Preset button styles
    const getPresetButtonClass = (preset: PolymarketPresetName) => {
        const isSelected = selectedPreset === preset && promptMode === 'preset';
        const isCustomSelected = promptMode === 'custom' && preset === 'custom';
        const active = isSelected || isCustomSelected;

        return `
            flex items-center gap-1.5 px-3 py-1.5 rounded text-[10px] font-semibold uppercase tracking-[0.08em] transition-all
            ${active
                ? 'bg-[#E7FE55] text-black'
                : 'bg-transparent text-[#747580] hover:text-[#a0a1a8] hover:bg-[#1a1b21]'}
        `;
    };

    return (
        <div className="h-full flex flex-col gap-4 overflow-hidden">

            {/* Compact Header Row */}
            <div className="glass-panel p-4 shrink-0">
                <div className="flex items-center justify-between">
                    {/* Left: Title + Mode Badge */}
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                            <Sparkles className="h-4 w-4 text-[#E7FE55]" />
                            <span className="text-sm font-semibold text-white">Strategy Prompt</span>
                        </div>

                        {/* Current Mode Badge - Compact */}
                        <div className={`
                            inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider
                            ${promptMode === 'preset'
                                ? 'bg-[#E7FE55]/10 text-[#E7FE55]'
                                : 'bg-[#1a1b21] text-[#747580]'}
                        `}>
                            <span className={`h-1 w-1 rounded-full ${promptMode === 'preset' ? 'bg-[#E7FE55]' : 'bg-[#747580]'}`} />
                            {promptMode === 'preset'
                                ? `${POLYMARKET_PRESETS[selectedPreset]?.emoji} ${POLYMARKET_PRESETS[selectedPreset]?.name}`
                                : 'Custom'
                            }
                        </div>

                        {hasChanges && (
                            <span className="text-[9px] text-amber-500 uppercase tracking-wider font-medium">• Unsaved</span>
                        )}
                    </div>

                    {/* Right: Save Button */}
                    <button
                        onClick={handleSave}
                        disabled={!hasChanges}
                        className={`
                            flex items-center gap-2 px-4 py-1.5 rounded text-[10px] font-semibold uppercase tracking-wider transition-all
                            ${hasChanges
                                ? 'bg-[#E7FE55] hover:bg-[#f0ff7a] text-black'
                                : 'bg-[#1a1b21] text-[#3a3b42] cursor-not-allowed'}
                        `}
                    >
                        <Save className="h-3.5 w-3.5" />
                        Save
                    </button>
                </div>
            </div>

            {/* Main Content: 2-Column Layout */}
            <div className="flex-1 flex gap-4 min-h-0 overflow-hidden">

                {/* Left Sidebar: Presets */}
                <div className="w-40 shrink-0 flex flex-col gap-2">
                    {/* Presets Label */}
                    <div className="flex items-center gap-1.5 px-1 py-2">
                        <Wand2 size={12} className="text-[#E7FE55]" />
                        <span className="text-[9px] text-[#747580] uppercase tracking-[0.1em] font-semibold">Presets</span>
                    </div>

                    {/* Preset Buttons - Vertical Stack */}
                    <div className="flex flex-col gap-1">
                        {(Object.entries(POLYMARKET_PRESETS) as [PolymarketPresetName, typeof POLYMARKET_PRESETS[PolymarketPresetName]][])
                            .filter(([key]) => key !== 'custom')
                            .map(([key, preset]) => (
                                <button
                                    key={key}
                                    onClick={() => handlePresetSelect(key)}
                                    className={getPresetButtonClass(key)}
                                >
                                    <span>{preset.emoji}</span>
                                    <span>{preset.name}</span>
                                </button>
                            ))}

                        {/* Divider */}
                        <div className="h-px bg-[#232328] my-2" />

                        {/* Custom Mode Button */}
                        <button
                            onClick={() => handlePresetSelect('custom')}
                            className={getPresetButtonClass('custom')}
                        >
                            <span>⚙️</span>
                            <span>Custom</span>
                        </button>
                    </div>

                    {/* Help Text */}
                    <div className="mt-auto pt-4 px-1">
                        <p className="text-[10px] text-[#3a3b42] leading-relaxed">
                            Edit the prompt to switch to custom mode automatically.
                        </p>
                    </div>
                </div>

                {/* Right: Editor */}
                <div className="flex-1 glass-panel relative overflow-hidden flex flex-col">
                    {/* Top fade */}
                    <div className="absolute inset-x-0 top-0 h-6 bg-gradient-to-b from-[#1e2028] to-transparent pointer-events-none z-10" />

                    <textarea
                        value={localPrompt}
                        onChange={(e) => handlePromptChange(e.target.value)}
                        className="w-full h-full bg-transparent text-[#a0a1a8] font-mono text-[13px] p-5 resize-none focus:outline-none leading-relaxed custom-scrollbar selection:bg-[#E7FE55]/30"
                        spellCheck={false}
                        placeholder={`// Define your prediction market strategy here...
// 
// Example:
// You are a probability analyst focusing on mispriced markets.
// 1. Look for markets with high volume and clear catalysts.
// 2. Prioritize events with upcoming resolution dates.
// 3. Consider news sentiment and expert opinions.`}
                    />

                    {/* Bottom fade */}
                    <div className="absolute inset-x-0 bottom-0 h-6 bg-gradient-to-t from-[#1e2028] to-transparent pointer-events-none z-10" />

                    {/* Minimal Status Indicator */}
                    <div className="absolute bottom-3 right-3 flex items-center gap-2 opacity-50 hover:opacity-100 transition-opacity">
                        <span className="h-1.5 w-1.5 rounded-full bg-[#E7FE55]" />
                        <span className="text-[9px] text-[#747580] font-mono uppercase tracking-wider">Live Context</span>
                    </div>
                </div>
            </div>
        </div>
    );
};
