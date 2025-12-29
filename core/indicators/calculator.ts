// DOMAIN CORE
// Full indicator calculation logic
// NO infrastructure dependencies allowed
//
// This module contains pure functions for calculating technical indicators
// from OHLCV candle data. Extracted from v0.03 marketDataMCP.ts
//
// DEPENDENCIES: technicalindicators library (pure math, no I/O)

import type { OHLCV, IndicatorData, IndicatorSettings } from '../types';

// Note: When building, import like: import * as TI from 'technicalindicators';
// For stub purposes, we define the interface without actual import
declare const TI: {
    RSI: { calculate: (input: any) => number[] };
    MACD: { calculate: (input: any) => any[] };
    EMA: { calculate: (input: any) => number[] };
    SMA: { calculate: (input: any) => number[] };
    Stochastic: { calculate: (input: any) => any[] };
    BollingerBands: { calculate: (input: any) => any[] };
    ATR: { calculate: (input: any) => number[] };
    ADX: { calculate: (input: any) => any[] };
    OBV: { calculate: (input: any) => number[] };
    IchimokuCloud: { calculate: (input: any) => any[] };
};

/**
 * Candle data structure for indicator calculations
 */
export interface CandleData {
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}

/**
 * Indicator calculation result with value and history
 */
export interface IndicatorResult {
    value: number | Record<string, number>;
    history: any[];
}

/**
 * Calculate a single indicator from candle data
 * Pure function - no side effects, no API calls
 * 
 * @param candles - Array of OHLCV candle data
 * @param indicator - Indicator name (rsi, macd, ema, sma, etc.)
 * @param params - Optional custom parameters
 * @returns Indicator result with value and history
 */
export function calculateIndicatorFromCandles(
    candles: CandleData[],
    indicator: string,
    params?: Record<string, number>
): IndicatorResult {
    if (!candles || candles.length === 0) {
        return { value: 0, history: [] };
    }

    const closes = candles.map(c => c.close);
    const highs = candles.map(c => c.high);
    const lows = candles.map(c => c.low);
    const volumes = candles.map(c => c.volume || 0);

    let value: number | Record<string, number> = 0;
    let history: any[] = [];
    const ind = indicator.toLowerCase();

    switch (ind) {
        case 'rsi': {
            const rsiPeriod = params?.period || 14;
            const rsiResult = TI.RSI.calculate({ values: closes, period: rsiPeriod });
            value = rsiResult[rsiResult.length - 1] || 0;
            history = rsiResult.slice(-100);
            break;
        }

        case 'macd': {
            const macdResult = TI.MACD.calculate({
                values: closes,
                fastPeriod: params?.fast || 12,
                slowPeriod: params?.slow || 26,
                signalPeriod: params?.signal || 9,
                SimpleMAOscillator: false,
                SimpleMASignal: false
            });
            const lastMacd = macdResult[macdResult.length - 1];
            value = {
                macd: lastMacd?.MACD || 0,
                signal: lastMacd?.signal || 0,
                histogram: lastMacd?.histogram || 0
            };
            history = macdResult.slice(-100).map((m: any) => ({
                macd: m?.MACD || 0,
                signal: m?.signal || 0,
                histogram: m?.histogram || 0
            }));
            break;
        }

        case 'ema': {
            const emaResult = TI.EMA.calculate({ period: params?.period || 20, values: closes });
            value = emaResult[emaResult.length - 1] || 0;
            history = emaResult.slice(-100);
            break;
        }

        case 'sma': {
            const smaResult = TI.SMA.calculate({ period: params?.period || 20, values: closes });
            value = smaResult[smaResult.length - 1] || 0;
            history = smaResult.slice(-100);
            break;
        }

        case 'stoch': {
            const stochResult = TI.Stochastic.calculate({
                high: highs, low: lows, close: closes,
                period: params?.period || 14,
                signalPeriod: params?.signalPeriod || 3
            });
            const lastStoch = stochResult[stochResult.length - 1];
            value = { k: lastStoch?.k || 0, d: lastStoch?.d || 0 };
            history = stochResult.slice(-100);
            break;
        }

        case 'bollinger': {
            const bbResult = TI.BollingerBands.calculate({
                period: params?.period || 20,
                values: closes,
                stdDev: params?.stdDev || 2
            });
            const lastBB = bbResult[bbResult.length - 1];
            const currentPrice = closes[closes.length - 1];
            const percentB = lastBB ? (currentPrice - lastBB.lower) / (lastBB.upper - lastBB.lower) : 0.5;
            value = {
                upper: lastBB?.upper || 0,
                middle: lastBB?.middle || 0,
                lower: lastBB?.lower || 0,
                pb: percentB
            };
            history = bbResult.slice(-100);
            break;
        }

        case 'atr': {
            const atrResult = TI.ATR.calculate({
                high: highs, low: lows, close: closes,
                period: params?.period || 14
            });
            value = atrResult[atrResult.length - 1] || 0;
            history = atrResult.slice(-100);
            break;
        }

        case 'adx': {
            const adxResult = TI.ADX.calculate({
                high: highs, low: lows, close: closes,
                period: params?.period || 14
            });
            const lastADX = adxResult[adxResult.length - 1];
            value = { adx: lastADX?.adx || 0, pdi: lastADX?.pdi || 0, mdi: lastADX?.mdi || 0 };
            history = adxResult.slice(-100);
            break;
        }

        case 'obv': {
            const obvResult = TI.OBV.calculate({ close: closes, volume: volumes });
            value = obvResult[obvResult.length - 1] || 0;
            history = obvResult.slice(-100);
            break;
        }

        case 'vwap': {
            // VWAP calculation: cumulative(price * volume) / cumulative(volume)
            // Using typical price = (high + low + close) / 3
            let cumulativePV = 0;
            let cumulativeVol = 0;
            const vwapHistory: number[] = [];
            for (let i = 0; i < candles.length; i++) {
                const typicalPrice = (highs[i] + lows[i] + closes[i]) / 3;
                cumulativePV += typicalPrice * volumes[i];
                cumulativeVol += volumes[i];
                vwapHistory.push(cumulativeVol > 0 ? cumulativePV / cumulativeVol : typicalPrice);
            }
            value = vwapHistory[vwapHistory.length - 1] || closes[closes.length - 1];
            history = vwapHistory.slice(-100);
            break;
        }

        case 'ichimoku': {
            const displacement = params?.displacement || 26;
            const ichimokuResult = TI.IchimokuCloud.calculate({
                high: highs, low: lows,
                conversionPeriod: params?.conversion || 9,
                basePeriod: params?.base || 26,
                spanPeriod: params?.spanB || 52,
                displacement
            });
            const lastIchi = ichimokuResult[ichimokuResult.length - 1];
            value = {
                tenkanSen: lastIchi?.conversion || 0,
                kijunSen: lastIchi?.base || 0,
                senkouSpanA: lastIchi?.spanA || 0,
                senkouSpanB: lastIchi?.spanB || 0,
                chikouSpan: closes[closes.length - displacement] || closes[closes.length - 1]
            };
            history = ichimokuResult.slice(-100);
            break;
        }

        case 'price': {
            value = closes[closes.length - 1];
            history = closes.slice(-100);
            break;
        }

        default:
            console.warn(`[Core/Indicators] Unknown indicator: ${indicator}`);
    }

    return { value, history };
}

/**
 * Calculate multiple indicators from the same candle data
 * Optimized to share data processing
 * 
 * @param candles - Array of OHLCV candle data
 * @param settings - Map of indicator name to config
 * @returns Map of indicator name to calculated data
 */
export function calculateIndicators(
    candles: CandleData[],
    settings: IndicatorSettings
): Record<string, IndicatorData> {
    const results: Record<string, IndicatorData> = {};

    for (const [name, config] of Object.entries(settings)) {
        if (config.enabled) {
            try {
                const result = calculateIndicatorFromCandles(candles, name, config.params);
                results[name] = {
                    value: result.value,
                    history: result.history,
                    weight: config.weight || 1,
                    category: getIndicatorCategory(name)
                };
            } catch (error) {
                console.warn(`[Core/Indicators] Failed to calculate ${name}:`, error);
            }
        }
    }

    return results;
}

/**
 * Get the category for an indicator
 * Categories: momentum, trend, volatility, volume
 */
export function getIndicatorCategory(indicator: string): string | null {
    const categories: Record<string, string> = {
        rsi: 'momentum',
        macd: 'momentum',
        stoch: 'momentum',
        ema: 'trend',
        sma: 'trend',
        adx: 'trend',
        ichimoku: 'trend',
        bollinger: 'volatility',
        atr: 'volatility',
        obv: 'volume',
        vwap: 'volume'
    };

    return categories[indicator.toLowerCase()] || null;
}

/**
 * Default indicator parameters
 */
export const DEFAULT_INDICATOR_PARAMS: Record<string, Record<string, number>> = {
    rsi: { period: 14 },
    macd: { fast: 12, slow: 26, signal: 9 },
    ema: { period: 20 },
    sma: { period: 20 },
    stoch: { period: 14, signalPeriod: 3 },
    bollinger: { period: 20, stdDev: 2 },
    atr: { period: 14 },
    adx: { period: 14 },
    obv: {},
    vwap: {},
    ichimoku: { conversion: 9, base: 26, spanB: 52, displacement: 26 }
};

/**
 * Supported indicator list
 */
export const SUPPORTED_INDICATORS = [
    'rsi',
    'macd',
    'ema',
    'sma',
    'stoch',
    'bollinger',
    'atr',
    'adx',
    'obv',
    'vwap',
    'ichimoku'
] as const;

export type SupportedIndicator = typeof SUPPORTED_INDICATORS[number];
