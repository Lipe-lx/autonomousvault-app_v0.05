/**
 * Indicator Utility Functions
 * 
 * Centralized helpers for the indicator categorization system.
 * Handles category limits, presets, and settings migration.
 */

import {
    IndicatorSettings,
    IndicatorConfig,
    INDICATOR_CATEGORIES,
    IndicatorCategoryName,
    MAX_TOTAL_INDICATORS,
    INDICATOR_PRESETS,
    PresetName,
    DEFAULT_INDICATOR_SETTINGS
} from '../state/dealerStore';

/**
 * Get the category of an indicator
 */
export function getIndicatorCategory(indicatorKey: keyof IndicatorSettings): IndicatorCategoryName | null {
    for (const [category, config] of Object.entries(INDICATOR_CATEGORIES)) {
        if (config.indicators.includes(indicatorKey)) {
            return category as IndicatorCategoryName;
        }
    }
    return null;
}

/**
 * Count enabled indicators in a category
 */
export function countEnabledInCategory(
    settings: IndicatorSettings,
    category: IndicatorCategoryName
): number {
    const categoryIndicators = INDICATOR_CATEGORIES[category].indicators;
    return categoryIndicators.filter(ind => settings[ind]?.enabled).length;
}

/**
 * Check if a category has reached its limit
 */
export function isCategoryAtLimit(
    settings: IndicatorSettings,
    category: IndicatorCategoryName
): boolean {
    const count = countEnabledInCategory(settings, category);
    return count >= INDICATOR_CATEGORIES[category].maxIndicators;
}

/**
 * Count total enabled indicators
 */
export function countTotalEnabled(settings: IndicatorSettings): number {
    return Object.values(settings).filter(config => config.enabled).length;
}

/**
 * Check if total limit is reached
 */
export function isTotalLimitReached(settings: IndicatorSettings): boolean {
    return countTotalEnabled(settings) >= MAX_TOTAL_INDICATORS;
}

/**
 * Check if an indicator can be enabled
 * Returns true if already enabled (for toggle off) or if limits allow
 */
export function canEnableIndicator(
    settings: IndicatorSettings,
    indicatorKey: keyof IndicatorSettings
): boolean {
    // Already enabled? Always allow toggle off
    if (settings[indicatorKey]?.enabled) return true;

    // Check total limit
    if (isTotalLimitReached(settings)) return false;

    // Check category limit
    const category = getIndicatorCategory(indicatorKey);
    if (category && isCategoryAtLimit(settings, category)) return false;

    return true;
}

/**
 * Apply a preset to indicator settings (preserves user weights)
 */
export function applyPreset(preset: PresetName, currentSettings?: IndicatorSettings): IndicatorSettings {
    const baseSettings = currentSettings || DEFAULT_INDICATOR_SETTINGS;
    const newSettings = { ...baseSettings };

    // Disable all indicators first
    for (const key of Object.keys(newSettings) as (keyof IndicatorSettings)[]) {
        newSettings[key] = { ...newSettings[key], enabled: false };
    }

    // Enable preset indicators (if not custom)
    if (preset !== 'custom') {
        const presetConfig = INDICATOR_PRESETS[preset];
        for (const ind of presetConfig.indicators) {
            if (newSettings[ind]) {
                newSettings[ind] = { ...newSettings[ind], enabled: true };
            }
        }
    }

    return newSettings;
}

/**
 * Detect which preset matches current settings (or 'custom')
 */
export function detectCurrentPreset(settings: IndicatorSettings): PresetName {
    const enabledIndicators = (Object.keys(settings) as (keyof IndicatorSettings)[])
        .filter(key => settings[key].enabled)
        .sort();

    for (const [presetName, preset] of Object.entries(INDICATOR_PRESETS)) {
        if (presetName === 'custom') continue;

        const presetIndicators = [...preset.indicators].sort();
        if (JSON.stringify(enabledIndicators) === JSON.stringify(presetIndicators)) {
            return presetName as PresetName;
        }
    }

    return 'custom';
}

/**
 * Migrate old indicator settings to new format (with weights)
 * Handles stored data from before the weight field was added
 */
export function migrateIndicatorSettings(oldSettings: any): IndicatorSettings {
    const migrated = { ...DEFAULT_INDICATOR_SETTINGS };

    if (!oldSettings || typeof oldSettings !== 'object') {
        return migrated;
    }

    for (const key of Object.keys(migrated) as (keyof IndicatorSettings)[]) {
        if (oldSettings[key]) {
            migrated[key] = {
                enabled: oldSettings[key].enabled ?? migrated[key].enabled,
                params: oldSettings[key].params ?? migrated[key].params,
                weight: oldSettings[key].weight ?? 1.0  // Default weight if not present
            };
        }
    }

    return migrated;
}

/**
 * Get all indicators for a specific preset
 */
export function getPresetIndicators(preset: PresetName): (keyof IndicatorSettings)[] {
    return INDICATOR_PRESETS[preset]?.indicators || [];
}

/**
 * Validate indicator settings (ensure weights are in valid range)
 */
export function validateIndicatorSettings(settings: IndicatorSettings): IndicatorSettings {
    const validated = { ...settings };

    for (const key of Object.keys(validated) as (keyof IndicatorSettings)[]) {
        const config = validated[key];
        // Clamp weight to valid range
        config.weight = Math.max(0.5, Math.min(2.0, config.weight || 1.0));
    }

    return validated;
}

/**
 * Get a summary of enabled indicators by category
 * Useful for displaying in UI
 */
export function getIndicatorSummary(settings: IndicatorSettings): {
    total: number;
    byCategory: Record<IndicatorCategoryName, { enabled: number; max: number }>;
} {
    const byCategory: Record<IndicatorCategoryName, { enabled: number; max: number }> = {
        trend: { enabled: 0, max: INDICATOR_CATEGORIES.trend.maxIndicators },
        momentum: { enabled: 0, max: INDICATOR_CATEGORIES.momentum.maxIndicators },
        volume: { enabled: 0, max: INDICATOR_CATEGORIES.volume.maxIndicators },
        volatility: { enabled: 0, max: INDICATOR_CATEGORIES.volatility.maxIndicators }
    };

    for (const category of Object.keys(byCategory) as IndicatorCategoryName[]) {
        byCategory[category].enabled = countEnabledInCategory(settings, category);
    }

    return {
        total: countTotalEnabled(settings),
        byCategory
    };
}
