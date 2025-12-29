import * as TI from 'technicalindicators';
import { MarketPrice, OHLCV, TechnicalIndicator, TradingViewSummary, DivergenceSignal } from '../../types';
import { hyperliquidService } from '../../services/hyperliquidService';

/**
 * Market Data MCP - Provides market data via Hyperliquid API
 * Uses Hyperliquid REST API for prices and candles (no WebSocket needed)
 * Calculates technical indicators locally using technicalindicators library
 */
export class MarketDataMCP {

    /**
     * Convert TradingView-style timeframe to Hyperliquid interval
     */
    private normalizeInterval(timeframe: string): string {
        const tf = timeframe.toLowerCase();
        const map: Record<string, string> = {
            '1': '1m',
            '5': '5m',
            '15': '15m',
            '60': '1h',
            '240': '4h',
            'd': '1d',
            '1d': '1d',
            'w': '1d',  // Weekly uses daily candles
            '1w': '1d',
            '7d': '1d'  // 7-day view uses daily candles
        };
        return map[tf] || '1h';
    }

    /**
     * Get current market price for a symbol
     * @param symbol - Trading symbol (e.g., "BTCUSDT", "SOLUSDT")
     * @returns Market price data
     */
    async getMarketPrice(symbol: string): Promise<MarketPrice> {
        try {
            // Convert symbol to Hyperliquid coin format (BTCUSDT -> BTC)
            const coin = symbol.replace(/USDT$/i, '').replace(/USD$/i, '');
            const price = await hyperliquidService.getCurrentPrice(coin);

            return {
                price,
                exchange: 'Hyperliquid',
                lastUpdate: new Date().toISOString(),
            };
        } catch (error: any) {
            console.error(`Error fetching market price for ${symbol}:`, error);
            throw new Error(`Failed to get market price: ${error.message}`);
        }
    }

    /**
     * Get OHLCV (candlestick) data for a symbol
     * @param symbol - Trading symbol (e.g., "BTCUSDT", "SOLUSDT")
     * @param timeframe - Timeframe (e.g., "1", "5", "15", "60", "240", "D")
     * @returns OHLCV data
     */
    async getOHLCV(symbol: string, timeframe: string = '60'): Promise<OHLCV> {
        try {
            const coin = symbol.replace(/USDT$/i, '').replace(/USD$/i, '');
            const interval = this.normalizeInterval(timeframe);
            const candles = await hyperliquidService.getCandles(coin, interval, 1);

            if (!candles || candles.length === 0) {
                throw new Error('No candle data available');
            }

            const latestCandle = candles[candles.length - 1];

            return {
                open: latestCandle.open,
                high: latestCandle.high,
                low: latestCandle.low,
                close: latestCandle.close,
                volume: latestCandle.volume || 0,
                timestamp: new Date(latestCandle.time).toISOString(),
            };
        } catch (error: any) {
            console.error(`Error fetching OHLCV for ${symbol}:`, error);
            throw new Error(`Failed to get OHLCV data: ${error.message}`);
        }
    }

    /**
     * Get historical OHLCV data for a symbol
     * @param symbol - Trading symbol (e.g., "BTCUSDT")
     * @param timeframe - Timeframe (e.g., "D")
     * @param limit - Number of candles to fetch
     */
    async getHistory(symbol: string, timeframe: string = '1D', limit: number = 100): Promise<any[]> {
        try {
            const coin = symbol.replace(/USDT$/i, '').replace(/USD$/i, '');
            const interval = this.normalizeInterval(timeframe);
            const candles = await hyperliquidService.getCandles(coin, interval, limit);

            return candles.map(c => ({
                time: Math.floor(c.time / 1000), // Convert to seconds for compatibility
                open: c.open,
                high: c.high,
                low: c.low,
                close: c.close,
                volume: c.volume
            }));
        } catch (error: any) {
            console.error(`Error fetching history for ${symbol}:`, error);
            return [];
        }
    }

    /**
     * Get technical indicator value
     * @param symbol - Trading symbol
     * @param indicator - Indicator name: "rsi", "macd", "ema", "sma", "stoch", "bollinger", "atr", "adx", "obv", "vwap", "ichimoku"
     * @param timeframe - Timeframe (e.g., "1", "5", "15", "60", "240", "D")
     * @param params - Optional custom parameters for the indicator
     */
    async getIndicator(symbol: string, indicator: string, timeframe: string = '60', params?: Record<string, number>): Promise<TechnicalIndicator> {
        try {
            const coin = symbol.replace(/USDT$/i, '').replace(/USD$/i, '');
            const interval = this.normalizeInterval(timeframe);

            // Fetch enough data for calculations (200 candles)
            const candles = await hyperliquidService.getCandles(coin, interval, 200);

            if (!candles || candles.length === 0) {
                throw new Error('No data available for indicator calculation');
            }

            // Extract data arrays for technicalindicators
            const closes = candles.map(c => c.close);
            const highs = candles.map(c => c.high);
            const lows = candles.map(c => c.low);
            const volumes = candles.map(c => c.volume || 0);

            let value: number | { [key: string]: number } = 0;
            let history: any[] = [];
            const ind = indicator.toLowerCase();

            switch (ind) {
                case 'rsi':
                    const rsiPeriod = params?.period || 14;
                    const rsiInput = {
                        values: closes,
                        period: rsiPeriod
                    };
                    const rsiResult = TI.RSI.calculate(rsiInput);
                    value = rsiResult[rsiResult.length - 1];
                    history = rsiResult.slice(-100);
                    break;

                case 'macd':
                    const macdInput = {
                        values: closes,
                        fastPeriod: params?.fast || 12,
                        slowPeriod: params?.slow || 26,
                        signalPeriod: params?.signal || 9,
                        SimpleMAOscillator: false,
                        SimpleMASignal: false
                    };
                    const macdResult = TI.MACD.calculate(macdInput);
                    const lastMacd = macdResult[macdResult.length - 1];
                    value = {
                        macd: lastMacd?.MACD || 0,
                        signal: lastMacd?.signal || 0,
                        histogram: lastMacd?.histogram || 0
                    };
                    history = macdResult.slice(-100);
                    break;

                case 'ema':
                    const emaPeriod = params?.period || 20;
                    const emaInput = {
                        period: emaPeriod,
                        values: closes
                    };
                    const emaResult = TI.EMA.calculate(emaInput);
                    value = emaResult[emaResult.length - 1];
                    history = emaResult.slice(-100);
                    break;

                case 'sma':
                    const smaPeriod = params?.period || 20;
                    const smaInput = {
                        period: smaPeriod,
                        values: closes
                    };
                    const smaResult = TI.SMA.calculate(smaInput);
                    value = smaResult[smaResult.length - 1];
                    history = smaResult.slice(-100);
                    break;

                case 'stoch':
                    const stochInput = {
                        high: highs,
                        low: lows,
                        close: closes,
                        period: params?.period || 14,
                        signalPeriod: params?.signalPeriod || 3
                    };
                    const stochResult = TI.Stochastic.calculate(stochInput);
                    const lastStoch = stochResult[stochResult.length - 1];
                    value = {
                        k: lastStoch?.k || 0,
                        d: lastStoch?.d || 0
                    };
                    history = stochResult.slice(-100);
                    break;

                case 'bollinger':
                    const bbPeriod = params?.period || 20;
                    const bbStdDev = params?.stdDev || 2;
                    const bbInput = {
                        period: bbPeriod,
                        values: closes,
                        stdDev: bbStdDev
                    };
                    const bbResult = TI.BollingerBands.calculate(bbInput);
                    const lastBB = bbResult[bbResult.length - 1];
                    const currentPrice = closes[closes.length - 1];
                    // Calculate %B (Percent B) - position within bands
                    const percentB = lastBB ? (currentPrice - lastBB.lower) / (lastBB.upper - lastBB.lower) : 0.5;
                    value = {
                        upper: lastBB?.upper || 0,
                        middle: lastBB?.middle || 0,
                        lower: lastBB?.lower || 0,
                        pb: percentB // %B indicator
                    };
                    history = bbResult.slice(-100);
                    break;

                case 'atr':
                    const atrPeriod = params?.period || 14;
                    const atrInput = {
                        high: highs,
                        low: lows,
                        close: closes,
                        period: atrPeriod
                    };
                    const atrResult = TI.ATR.calculate(atrInput);
                    value = atrResult[atrResult.length - 1] || 0;
                    history = atrResult.slice(-100);
                    break;

                case 'adx':
                    const adxPeriod = params?.period || 14;
                    const adxInput = {
                        high: highs,
                        low: lows,
                        close: closes,
                        period: adxPeriod
                    };
                    const adxResult = TI.ADX.calculate(adxInput);
                    const lastADX = adxResult[adxResult.length - 1];
                    value = {
                        adx: lastADX?.adx || 0,
                        pdi: lastADX?.pdi || 0,
                        mdi: lastADX?.mdi || 0
                    };
                    history = adxResult.slice(-100);
                    break;

                case 'obv':
                    const obvInput = {
                        close: closes,
                        volume: volumes
                    };
                    const obvResult = TI.OBV.calculate(obvInput);
                    value = obvResult[obvResult.length - 1] || 0;
                    history = obvResult.slice(-100);
                    break;

                case 'vwap':
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

                case 'ichimoku':
                    const conversionPeriod = params?.conversion || 9;
                    const basePeriod = params?.base || 26;
                    const spanBPeriod = params?.spanB || 52;
                    const displacement = params?.displacement || 26;
                    const ichimokuInput = {
                        high: highs,
                        low: lows,
                        conversionPeriod,
                        basePeriod,
                        spanPeriod: spanBPeriod,
                        displacement
                    };
                    const ichimokuResult = TI.IchimokuCloud.calculate(ichimokuInput);
                    const lastIchimoku = ichimokuResult[ichimokuResult.length - 1];
                    value = {
                        tenkanSen: lastIchimoku?.conversion || 0,
                        kijunSen: lastIchimoku?.base || 0,
                        senkouSpanA: lastIchimoku?.spanA || 0,
                        senkouSpanB: lastIchimoku?.spanB || 0,
                        chikouSpan: closes[closes.length - displacement] || closes[closes.length - 1]
                    };
                    history = ichimokuResult.slice(-100);
                    break;

                case 'price':
                    value = closes[closes.length - 1];
                    history = closes.slice(-100);
                    break;

                default:
                    throw new Error(`Unsupported indicator: ${indicator}`);
            }

            return {
                symbol,
                indicator: indicator.toUpperCase(),
                value,
                history, // Include history for AI analysis
                timestamp: Date.now()
            } as any;


        } catch (error: any) {
            console.error(`Error calculating indicator ${indicator} for ${symbol}:`, error);
            throw new Error(`Failed to calculate indicator: ${error.message}`);
        }
    }

    /**
     * Get market summary with recommendation
     * @param symbol - Trading symbol
     * @returns Summary with recommendation
     */
    async getTradingViewSummary(symbol: string): Promise<TradingViewSummary> {
        try {
            const coin = symbol.replace(/USDT$/i, '').replace(/USD$/i, '');
            const candles = await hyperliquidService.getCandles(coin, '1h', 12);

            if (!candles || candles.length < 2) {
                return { buy: 0, sell: 0, neutral: 1, recommendation: 'NEUTRAL' };
            }

            // Simple trend analysis based on recent price movement
            let upCount = 0;
            let downCount = 0;

            for (let i = 1; i < candles.length; i++) {
                if (candles[i].close > candles[i - 1].close) {
                    upCount++;
                } else {
                    downCount++;
                }
            }

            const neutralCount = Math.max(0, candles.length - 1 - upCount - downCount);

            let recommendation: 'BUY' | 'SELL' | 'STRONG_BUY' | 'STRONG_SELL' | 'NEUTRAL';

            if (upCount > 8) {
                recommendation = 'STRONG_BUY';
            } else if (upCount > 6) {
                recommendation = 'BUY';
            } else if (downCount > 8) {
                recommendation = 'STRONG_SELL';
            } else if (downCount > 6) {
                recommendation = 'SELL';
            } else {
                recommendation = 'NEUTRAL';
            }

            return {
                buy: upCount,
                sell: downCount,
                neutral: neutralCount,
                recommendation,
            };
        } catch (error: any) {
            console.error(`Error fetching summary for ${symbol}:`, error);
            return { buy: 0, sell: 0, neutral: 1, recommendation: 'NEUTRAL' };
        }
    }

    /**
     * Detect price/indicator divergences
     * Calculates divergences automatically for AI consumption
     * @param prices - Array of closing prices (oldest to newest)
     * @param rsiValues - Array of RSI values
     * @param macdHistogram - Array of MACD histogram values
     * @returns Array of detected divergence signals
     */
    detectDivergences(
        prices: number[],
        rsiValues: number[],
        macdHistogram: number[]
    ): DivergenceSignal[] {
        const signals: DivergenceSignal[] = [];
        const lookback = 20; // Periods to analyze for divergence

        if (prices.length < lookback || rsiValues.length < lookback) {
            return signals;
        }

        // Helper: Find local minima and maxima
        const findExtremes = (data: number[], window: number = 5): { minima: number[]; maxima: number[] } => {
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
        };

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
     * Calculate indicator from pre-fetched candle data (avoids duplicate API calls)
     * @param candles - Array of candle data with open, high, low, close, volume
     * @param indicator - Indicator name: "rsi", "macd", "ema", "sma", etc.
     * @param params - Optional custom parameters for the indicator
     * @returns Indicator result with value and history
     */
    calculateIndicatorFromCandles(
        candles: { open: number; high: number; low: number; close: number; volume: number }[],
        indicator: string,
        params?: Record<string, number>
    ): { value: number | Record<string, number>; history: any[] } {
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
            case 'rsi':
                const rsiPeriod = params?.period || 14;
                const rsiResult = TI.RSI.calculate({ values: closes, period: rsiPeriod });
                value = rsiResult[rsiResult.length - 1] || 0;
                history = rsiResult.slice(-100);
                break;

            case 'macd':
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

            case 'ema':
                const emaResult = TI.EMA.calculate({ period: params?.period || 20, values: closes });
                value = emaResult[emaResult.length - 1] || 0;
                history = emaResult.slice(-100);
                break;

            case 'sma':
                const smaResult = TI.SMA.calculate({ period: params?.period || 20, values: closes });
                value = smaResult[smaResult.length - 1] || 0;
                history = smaResult.slice(-100);
                break;

            case 'stoch':
                const stochResult = TI.Stochastic.calculate({
                    high: highs, low: lows, close: closes,
                    period: params?.period || 14,
                    signalPeriod: params?.signalPeriod || 3
                });
                const lastStoch = stochResult[stochResult.length - 1];
                value = { k: lastStoch?.k || 0, d: lastStoch?.d || 0 };
                history = stochResult.slice(-100);
                break;

            case 'bollinger':
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

            case 'atr':
                const atrResult = TI.ATR.calculate({
                    high: highs, low: lows, close: closes,
                    period: params?.period || 14
                });
                value = atrResult[atrResult.length - 1] || 0;
                history = atrResult.slice(-100);
                break;

            case 'adx':
                const adxResult = TI.ADX.calculate({
                    high: highs, low: lows, close: closes,
                    period: params?.period || 14
                });
                const lastADX = adxResult[adxResult.length - 1];
                value = { adx: lastADX?.adx || 0, pdi: lastADX?.pdi || 0, mdi: lastADX?.mdi || 0 };
                history = adxResult.slice(-100);
                break;

            case 'obv':
                const obvResult = TI.OBV.calculate({ close: closes, volume: volumes });
                value = obvResult[obvResult.length - 1] || 0;
                history = obvResult.slice(-100);
                break;

            case 'vwap':
                let cumulativePV = 0, cumulativeVol = 0;
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

            case 'ichimoku':
                const ichimokuResult = TI.IchimokuCloud.calculate({
                    high: highs, low: lows,
                    conversionPeriod: params?.conversion || 9,
                    basePeriod: params?.base || 26,
                    spanPeriod: params?.spanB || 52,
                    displacement: params?.displacement || 26
                });
                const lastIchi = ichimokuResult[ichimokuResult.length - 1];
                const displacement = params?.displacement || 26;
                value = {
                    tenkanSen: lastIchi?.conversion || 0,
                    kijunSen: lastIchi?.base || 0,
                    senkouSpanA: lastIchi?.spanA || 0,
                    senkouSpanB: lastIchi?.spanB || 0,
                    chikouSpan: closes[closes.length - displacement] || closes[closes.length - 1]
                };
                history = ichimokuResult.slice(-100);
                break;

            default:
                console.warn(`[MarketDataMCP] Unknown indicator: ${indicator}`);
        }

        return { value, history };
    }
}

// Export singleton instance
export const marketDataMCP = new MarketDataMCP();
