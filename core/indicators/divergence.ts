// DOMAIN CORE
// Full divergence detection logic
// NO infrastructure dependencies allowed
//
// Detects price/indicator divergences for trading signals
// Extracted from v0.03 marketDataMCP.ts lines 393-550

import type { DivergenceSignal } from '../types';

/**
 * Detect divergences between price and RSI/MACD indicators
 * Pure function - no side effects, no API calls
 * 
 * @param prices - Array of closing prices (oldest to newest)
 * @param rsiValues - Array of RSI values
 * @param macdHistogram - Array of MACD histogram values
 * @returns Array of detected divergence signals
 */
export function detectDivergences(
    prices: number[],
    rsiValues: number[],
    macdHistogram: number[]
): DivergenceSignal[] {
    const signals: DivergenceSignal[] = [];
    const lookback = 20; // Periods to analyze for divergence

    if (prices.length < lookback || rsiValues.length < lookback) {
        return signals;
    }

    // Get last N values for analysis
    const recentPrices = prices.slice(-lookback);
    const recentRSI = rsiValues.slice(-lookback);
    const recentMACD = macdHistogram.slice(-lookback);

    const priceExtremes = findExtremes(recentPrices);
    const rsiExtremes = findExtremes(recentRSI);

    // Check for BULLISH DIVERGENCE: Price lower low + RSI higher low
    if (priceExtremes.minima.length >= 2 && rsiExtremes.minima.length >= 2) {
        const lastPriceMin = priceExtremes.minima[priceExtremes.minima.length - 1];
        const prevPriceMin = priceExtremes.minima[priceExtremes.minima.length - 2];
        const lastRSIMin = rsiExtremes.minima[rsiExtremes.minima.length - 1];
        const prevRSIMin = rsiExtremes.minima[rsiExtremes.minima.length - 2];

        const priceLowerLow = recentPrices[lastPriceMin] < recentPrices[prevPriceMin];
        const rsiHigherLow = recentRSI[lastRSIMin] > recentRSI[prevRSIMin];

        if (priceLowerLow && rsiHigherLow) {
            const strength = recentRSI[lastRSIMin] < 30 ? 'STRONG' : recentRSI[lastRSIMin] < 40 ? 'MODERATE' : 'WEAK';
            signals.push({
                type: 'BULLISH',
                indicator: 'RSI',
                description: `Price made lower low (${recentPrices[prevPriceMin].toFixed(2)} → ${recentPrices[lastPriceMin].toFixed(2)}) but RSI made higher low (${recentRSI[prevRSIMin].toFixed(1)} → ${recentRSI[lastRSIMin].toFixed(1)}). Potential reversal UP.`,
                strength,
                priceRange: { start: recentPrices[prevPriceMin], end: recentPrices[lastPriceMin] },
                indicatorRange: { start: recentRSI[prevRSIMin], end: recentRSI[lastRSIMin] }
            });
        }

        // Check for HIDDEN BULLISH: Price higher low + RSI lower low (trend continuation)
        const priceHigherLow = recentPrices[lastPriceMin] > recentPrices[prevPriceMin];
        const rsiLowerLow = recentRSI[lastRSIMin] < recentRSI[prevRSIMin];

        if (priceHigherLow && rsiLowerLow) {
            signals.push({
                type: 'HIDDEN_BULLISH',
                indicator: 'RSI',
                description: `Price made higher low but RSI made lower low. Bullish trend continuation signal.`,
                strength: 'MODERATE',
                priceRange: { start: recentPrices[prevPriceMin], end: recentPrices[lastPriceMin] },
                indicatorRange: { start: recentRSI[prevRSIMin], end: recentRSI[lastRSIMin] }
            });
        }
    }

    // Check for BEARISH DIVERGENCE: Price higher high + RSI lower high
    if (priceExtremes.maxima.length >= 2 && rsiExtremes.maxima.length >= 2) {
        const lastPriceMax = priceExtremes.maxima[priceExtremes.maxima.length - 1];
        const prevPriceMax = priceExtremes.maxima[priceExtremes.maxima.length - 2];
        const lastRSIMax = rsiExtremes.maxima[rsiExtremes.maxima.length - 1];
        const prevRSIMax = rsiExtremes.maxima[rsiExtremes.maxima.length - 2];

        const priceHigherHigh = recentPrices[lastPriceMax] > recentPrices[prevPriceMax];
        const rsiLowerHigh = recentRSI[lastRSIMax] < recentRSI[prevRSIMax];

        if (priceHigherHigh && rsiLowerHigh) {
            const strength = recentRSI[lastRSIMax] > 70 ? 'STRONG' : recentRSI[lastRSIMax] > 60 ? 'MODERATE' : 'WEAK';
            signals.push({
                type: 'BEARISH',
                indicator: 'RSI',
                description: `Price made higher high (${recentPrices[prevPriceMax].toFixed(2)} → ${recentPrices[lastPriceMax].toFixed(2)}) but RSI made lower high (${recentRSI[prevRSIMax].toFixed(1)} → ${recentRSI[lastRSIMax].toFixed(1)}). Potential reversal DOWN.`,
                strength,
                priceRange: { start: recentPrices[prevPriceMax], end: recentPrices[lastPriceMax] },
                indicatorRange: { start: recentRSI[prevRSIMax], end: recentRSI[lastRSIMax] }
            });
        }

        // Check for HIDDEN BEARISH: Price lower high + RSI higher high (trend continuation)
        const priceLowerHigh = recentPrices[lastPriceMax] < recentPrices[prevPriceMax];
        const rsiHigherHigh = recentRSI[lastRSIMax] > recentRSI[prevRSIMax];

        if (priceLowerHigh && rsiHigherHigh) {
            signals.push({
                type: 'HIDDEN_BEARISH',
                indicator: 'RSI',
                description: `Price made lower high but RSI made higher high. Bearish trend continuation signal.`,
                strength: 'MODERATE',
                priceRange: { start: recentPrices[prevPriceMax], end: recentPrices[lastPriceMax] },
                indicatorRange: { start: recentRSI[prevRSIMax], end: recentRSI[lastRSIMax] }
            });
        }
    }

    // MACD Histogram Divergence (simpler check)
    if (recentMACD.length >= 10) {
        const macdTrend = recentMACD[recentMACD.length - 1] - recentMACD[recentMACD.length - 5];
        const priceTrend = recentPrices[recentPrices.length - 1] - recentPrices[recentPrices.length - 5];

        // MACD falling while price rising = bearish divergence
        if (macdTrend < -0.5 && priceTrend > 0) {
            signals.push({
                type: 'BEARISH',
                indicator: 'MACD',
                description: `MACD histogram declining while price rising. Momentum weakening.`,
                strength: 'WEAK',
                priceRange: { start: recentPrices[recentPrices.length - 5], end: recentPrices[recentPrices.length - 1] },
                indicatorRange: { start: recentMACD[recentMACD.length - 5], end: recentMACD[recentMACD.length - 1] }
            });
        }

        // MACD rising while price falling = bullish divergence
        if (macdTrend > 0.5 && priceTrend < 0) {
            signals.push({
                type: 'BULLISH',
                indicator: 'MACD',
                description: `MACD histogram rising while price falling. Momentum building.`,
                strength: 'WEAK',
                priceRange: { start: recentPrices[recentPrices.length - 5], end: recentPrices[recentPrices.length - 1] },
                indicatorRange: { start: recentMACD[recentMACD.length - 5], end: recentMACD[recentMACD.length - 1] }
            });
        }
    }

    return signals;
}

/**
 * Find local minima and maxima in a data series
 * Helper function for divergence detection
 * 
 * @param data - Array of numeric values
 * @param window - Window size for extreme detection
 * @returns Object with arrays of indices for minima and maxima
 */
export function findExtremes(
    data: number[],
    window: number = 5
): { minima: number[]; maxima: number[] } {
    const minima: number[] = [];
    const maxima: number[] = [];

    for (let i = window; i < data.length - window; i++) {
        let isMin = true;
        let isMax = true;

        for (let j = i - window; j <= i + window; j++) {
            if (j === i) continue;
            if (data[j] <= data[i]) isMin = false;
            if (data[j] >= data[i]) isMax = false;
        }

        if (isMin) minima.push(i);
        if (isMax) maxima.push(i);
    }

    return { minima, maxima };
}

/**
 * Classify divergence strength based on magnitude
 */
export function classifyDivergenceStrength(
    priceDelta: number,
    indicatorDelta: number
): 'WEAK' | 'MODERATE' | 'STRONG' {
    const ratio = Math.abs(indicatorDelta / priceDelta);

    if (ratio > 2) return 'STRONG';
    if (ratio > 1) return 'MODERATE';
    return 'WEAK';
}
