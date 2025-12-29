import { VaultState } from '../types';
import { StorageService } from '../services/storageService';

// --- Types ---

// Individual indicator configuration
export interface IndicatorConfig {
    enabled: boolean;
    params: Record<string, number>;
    weight: number; // 0.5 to 2.0, default 1.0 - affects AI signal priority
}

// All available indicators with their configurations
export interface IndicatorSettings {
    rsi: IndicatorConfig;
    macd: IndicatorConfig;
    bollinger: IndicatorConfig;
    atr: IndicatorConfig;
    adx: IndicatorConfig;
    obv: IndicatorConfig;
    vwap: IndicatorConfig;
    ichimoku: IndicatorConfig;
    ema: IndicatorConfig;
    sma: IndicatorConfig;
    stoch: IndicatorConfig;
}

// --- Indicator Categories ---
// Organizes indicators by function with per-category limits

export type IndicatorCategoryName = 'trend' | 'momentum' | 'volume' | 'volatility';

export interface IndicatorCategory {
    name: string;
    color: string;
    icon: string;
    maxIndicators: number;
    indicators: (keyof IndicatorSettings)[];
    description: string;
}

export const INDICATOR_CATEGORIES: Record<IndicatorCategoryName, IndicatorCategory> = {
    trend: {
        name: 'Trend / Structure',
        color: 'purple',
        icon: 'TrendingUp',
        maxIndicators: 2,
        indicators: ['ema', 'sma', 'adx', 'ichimoku'],
        description: 'Market direction and trend strength'
    },
    momentum: {
        name: 'Momentum',
        color: 'blue',
        icon: 'Activity',
        maxIndicators: 2,
        indicators: ['rsi', 'macd', 'stoch'],
        description: 'Entry/exit timing and divergences'
    },
    volume: {
        name: 'Volume',
        color: 'green',
        icon: 'BarChart2',
        maxIndicators: 1,
        indicators: ['obv', 'vwap'],
        description: 'Move confirmation with participation'
    },
    volatility: {
        name: 'Volatility / Risk',
        color: 'orange',
        icon: 'Zap',
        maxIndicators: 1,
        indicators: ['atr', 'bollinger'],
        description: 'Risk context and market regime'
    }
};

export const MAX_TOTAL_INDICATORS = 5;

// --- Indicator Presets ---
// Pre-configured indicator combinations for different trading styles

export type PresetName = 'balanced' | 'scalp' | 'trendFollowing' | 'meanReversion' | 'volumeConfirm' | 'custom';

export interface IndicatorPreset {
    name: string;
    description: string;
    emoji: string;
    indicators: (keyof IndicatorSettings)[];
    marketCondition: string; // When AI should choose this preset in autonomous mode
}

export const INDICATOR_PRESETS: Record<PresetName, IndicatorPreset> = {
    balanced: {
        name: 'Balanced',
        description: 'Trend + Momentum + Timing + Risk',
        emoji: '🧪',
        indicators: ['ema', 'rsi', 'macd', 'atr'],
        marketCondition: 'uncertain or mixed signals'
    },
    scalp: {
        name: 'Scalp Momentum',
        description: 'Fast entries, frequent trades (5m-15m)',
        emoji: '⚡',
        indicators: ['ema', 'rsi', 'stoch', 'vwap'],
        marketCondition: 'high volatility with quick reversals'
    },
    trendFollowing: {
        name: 'Trend Following',
        description: 'Sustained movements (15m-1h)',
        emoji: '📈',
        indicators: ['ema', 'sma', 'adx', 'macd'],
        marketCondition: 'strong directional trend'
    },
    meanReversion: {
        name: 'Mean Reversion',
        description: 'Range / Lateral markets',
        emoji: '🔄',
        indicators: ['bollinger', 'rsi', 'stoch', 'vwap'],
        marketCondition: 'ranging or sideways market'
    },
    volumeConfirm: {
        name: 'Volume Confirmation',
        description: 'Avoid fake breakouts',
        emoji: '🧠',
        indicators: ['ema', 'rsi', 'obv', 'vwap'],
        marketCondition: 'breakout scenarios or unusual volume'
    },
    custom: {
        name: 'Custom',
        description: 'Your custom configuration',
        emoji: '⚙️',
        indicators: [],
        marketCondition: 'user-defined'
    }
};

// --- Preset Prompts ---
// Default strategy prompts optimized for each indicator preset

export const PRESET_PROMPTS: Record<PresetName, string> = {
    balanced: `You are Hyperliquid Dealer, an autonomous trading engine.
Your goal is to identify balanced trading opportunities using a combination of indicators.

RULES:
1. Use EMA for trend confirmation, RSI for timing, MACD for momentum, and ATR for risk management.
2. Enter LONG when: EMA points UP + RSI < 40 + MACD histogram positive.
3. Enter SHORT when: EMA points DOWN + RSI > 60 + MACD histogram negative.
4. Stop Loss: Position at 1.5x ATR from entry price.
5. Take Profit: Target 2x risk (1:2 ratio).
6. HOLD if indicators give conflicting signals.`,

    scalp: `You are Hyperliquid Dealer, a high-frequency scalping engine.
Your goal is to capture quick price movements (5m-15m) in volatile markets.

RULES:
1. Use EMA(9) for immediate direction, RSI for entry, Stoch for confirmation, VWAP as support/resistance.
2. LONG: Price above VWAP + RSI < 35 + Stoch crossing up.
3. SHORT: Price below VWAP + RSI > 65 + Stoch crossing down.
4. Quick trades: Target 0.3-0.5% profit per trade.
5. Tight stop: 0.5% maximum.
6. AVOID trades during low volatility.`,

    trendFollowing: `You are Hyperliquid Dealer, specialized in following strong trends.
Your goal is to ride sustained directional movements (15m-1h).

RULES:
1. Use EMA/SMA to confirm trend, ADX for strength, MACD for timing.
2. ONLY enter when ADX > 25 (strong trend).
3. LONG: EMA(20) > SMA(50) + ADX > 25 + MACD positive.
4. SHORT: EMA(20) < SMA(50) + ADX > 25 + MACD negative.
5. Let profits run: Trailing stop at 2x ATR.
6. HOLD in sideways markets (ADX < 20).`,

    meanReversion: `You are Hyperliquid Dealer, specialized in mean reversion.
Your goal is to trade ranging/sideways markets, buying dips and selling tops.

RULES:
1. Use Bollinger Bands for extremes, RSI for oversold/overbought, Stoch for confirmation, VWAP as anchor.
2. LONG: Price touches lower Bollinger + RSI < 30 + Stoch < 20.
3. SHORT: Price touches upper Bollinger + RSI > 70 + Stoch > 80.
4. Target: Return to mean (Bollinger middle or VWAP).
5. Stop: Outside the opposite band.
6. AVOID trading when Bollinger expands (breakout).`,

    volumeConfirm: `You are Hyperliquid Dealer with focus on volume confirmation.
Your goal is to avoid false breakouts by only trading with volume confirmation.

RULES:
1. Use EMA for trend, RSI for timing, OBV for volume flow, VWAP for institutional levels.
2. LONG: EMA up + RSI < 45 + OBV making higher highs + price above VWAP.
3. SHORT: EMA down + RSI > 55 + OBV making lower lows + price below VWAP.
4. Volume is KING: No OBV confirmation = no trade.
5. Breakouts: Only enter if volume > 1.5x average.
6. HOLD if OBV diverges from price (possible reversal signal).`,

    custom: `// Write your custom strategy instructions here...
// Example:
// You are a conservative trader focused on mean reversion.
// 1. Only trade when RSI is above 70 or below 30.
// 2. Prioritize high volume tokens.
// 3. Never risk more than 1% of equity per trade.`
};

// Default indicator settings with market-standard parameters
// Uses "Balanced" preset as default (EMA, RSI, MACD, ATR)
export const DEFAULT_INDICATOR_SETTINGS: IndicatorSettings = {
    rsi: { enabled: true, params: { period: 14 }, weight: 1.0 },
    macd: { enabled: true, params: { fast: 12, slow: 26, signal: 9 }, weight: 1.0 },
    bollinger: { enabled: false, params: { period: 20, stdDev: 2 }, weight: 1.0 },
    atr: { enabled: true, params: { period: 14 }, weight: 1.0 },
    adx: { enabled: false, params: { period: 14 }, weight: 1.0 },
    obv: { enabled: false, params: {}, weight: 1.0 },
    vwap: { enabled: false, params: {}, weight: 1.0 },
    ichimoku: { enabled: false, params: { conversion: 9, base: 26, spanB: 52, displacement: 26 }, weight: 1.0 },
    ema: { enabled: true, params: { period: 20 }, weight: 1.0 },
    sma: { enabled: false, params: { period: 20 }, weight: 1.0 },
    stoch: { enabled: false, params: { period: 14, signalPeriod: 3 }, weight: 1.0 }
};

export interface DealerLog {
    id: string;
    timestamp: number;
    type: 'INFO' | 'WARNING' | 'ERROR' | 'TRADE' | 'SIGNAL' | 'REASONING';
    message: string;
    details?: any;
}

export interface DealerPosition {
    coin: string;
    size: number;
    entryPrice: number;
    unrealizedPnl: number;
    side: 'LONG' | 'SHORT';
    leverage: number;
    liquidationPrice?: number;
}

export interface DealerSettings {
    strategyPrompt: string;
    aggressiveMode: boolean; // Not used yet, but good for future
    maxLeverage: number;
    maxPositionSizeUSDC: number;
    maxOpenPositions: number; // Maximum number of concurrent positions
    bankrollType: 'MANUAL' | 'ALL_AVAILABLE'; // Logic to determine available capital
    manualBankroll: number; // User-defined cap if type is MANUAL
    tradingPairs: string[]; // e.g., ["BTC", "ETH", "SOL"]
    checkIntervalSeconds: number;
    analysisTimeframe: string; // '1', '5', '15', '60', '240', 'D'
    historyCandles: number; // Number of historical candles to analyze (10-100)
    // Macro Timeframe Confirmation
    macroTimeframeEnabled: boolean; // Enable multi-timeframe confirmation
    macroTimeframe: string; // '15', '60', '240', 'D', 'W' - higher timeframe for confirmation
    macroEnabledIndicators: string[]; // List of specific indicator names to check on macro timeframe
    // Indicator Configuration
    indicatorSettings: IndicatorSettings;
    autonomousIndicators: boolean; // When true, AI chooses preset each cycle
    selectedPreset: PresetName; // Currently selected preset (for manual mode)
    promptMode: 'preset' | 'custom'; // Whether using preset prompt or custom edited prompt
    // Risk Protection - Stop Loss / Take Profit
    stopLossEnabled: boolean;
    stopLossPercent: number | null;  // null = AI decides, number = fixed % from entry
    takeProfitEnabled: boolean;
    takeProfitPercent: number | null;  // null = AI decides, number = fixed % from entry
}

/**
 * Record of a trade operation for Manager visibility
 */
export interface DealerOperationRecord {
    id: string;
    coin: string;
    action: 'BUY' | 'SELL' | 'CLOSE';
    timestamp: number;
    entryPrice?: number;
    exitPrice?: number;
    size: number;
    sizeUSDC: number;
    pnl?: number;
    reasoning: string;
    confidence: number;
    status: 'OPEN' | 'CLOSED';
    cloid?: string; // Client order ID for tracking
}

export interface DealerState {
    isOn: boolean;
    isAnalyzing: boolean;
    statusMessage: string;
    statusDetail: string; // Detailed step description for user feedback

    // Live execution data
    currentTask: string | null;
    currentSignal: 'BULLISH' | 'BEARISH' | 'NEUTRAL' | null;
    trendAssessment: string;
    pendingExecution: boolean;
    currentExposure: number; // USD value of open positions initiated by Dealer

    // Real-time Context
    activePositions: DealerPosition[];
    portfolioValue: number;
    lastSyncTimestamp: number;

    // Settings
    settings: DealerSettings;

    // Logs
    logs: DealerLog[];

    // Operation History (for Manager queries)
    operationHistory: DealerOperationRecord[];
}

// --- Default Values ---

// Default strategy uses the balanced preset prompt
const DEFAULT_STRATEGY = PRESET_PROMPTS.balanced;

const DEFAULT_SETTINGS: DealerSettings = {
    strategyPrompt: DEFAULT_STRATEGY,
    aggressiveMode: false,

    maxLeverage: 5,
    maxPositionSizeUSDC: 50,
    maxOpenPositions: 3,
    bankrollType: 'MANUAL',
    manualBankroll: 100,
    tradingPairs: ["BTC", "ETH", "SOL"],
    checkIntervalSeconds: 300,
    analysisTimeframe: '60',
    historyCandles: 30,
    macroTimeframeEnabled: false, // Multi-timeframe confirmation disabled by default
    macroTimeframe: '240', // Default to 4H for macro confirmation
    macroEnabledIndicators: ['rsi', 'macd', 'ema'], // Default indicators for macro
    indicatorSettings: DEFAULT_INDICATOR_SETTINGS,
    autonomousIndicators: false,
    selectedPreset: 'balanced',
    promptMode: 'preset',
    // Risk Protection defaults
    stopLossEnabled: false,
    stopLossPercent: null,
    takeProfitEnabled: false,
    takeProfitPercent: null,
};

const INITIAL_STATE: DealerState = {
    isOn: false,
    isAnalyzing: false,
    statusMessage: 'Ready',
    statusDetail: 'Awaiting activation',
    currentTask: null,
    currentSignal: null,
    trendAssessment: 'Waiting for data...',
    pendingExecution: false,
    currentExposure: 0,
    activePositions: [],
    portfolioValue: 0,
    lastSyncTimestamp: 0,
    settings: DEFAULT_SETTINGS,
    logs: [],
    operationHistory: []
};

// --- Store Implementation (Vanilla Singleton + Subscription) ---

class DealerStore {
    private state: DealerState;
    private listeners: Set<() => void>;
    private isInitialized: boolean = false;
    private initPromise: Promise<void> | null = null;

    constructor() {
        this.state = INITIAL_STATE;
        this.listeners = new Set();
        this.initPromise = this.initialize();
    }

    async initialize(): Promise<void> {
        if (this.isInitialized) return;
        await this.loadState();
        this.isInitialized = true;
        this.notifyListeners();
    }

    async waitForInit(): Promise<void> {
        if (this.initPromise) {
            await this.initPromise;
        }
    }

    /**
     * Reload state from storage. Should be called after import or when data is externally updated.
     */
    async reloadFromStorage(): Promise<void> {
        console.log('[DealerStore] Reloading from storage...');
        await this.loadState();
        this.notifyListeners();
    }

    /**
     * Reset state to initial values. Should be called on account deletion.
     */
    reset(): void {
        console.log('[DealerStore] Resetting to initial state...');
        this.state = { ...INITIAL_STATE };
        this.notifyListeners();
    }

    private async loadState(): Promise<void> {
        try {
            const saved = await StorageService.getItem(StorageService.getUserKey('vault_dealer_storage'));
            if (saved) {
                const parsed = JSON.parse(saved);

                // Migrate old indicator settings (add weight field if missing)
                let indicatorSettings = parsed.settings?.indicatorSettings || DEFAULT_INDICATOR_SETTINGS;
                const migratedIndicatorSettings: Record<string, IndicatorConfig> = {};
                for (const key of Object.keys(DEFAULT_INDICATOR_SETTINGS) as (keyof IndicatorSettings)[]) {
                    const oldConfig = indicatorSettings[key];
                    const defaultConfig = DEFAULT_INDICATOR_SETTINGS[key];
                    migratedIndicatorSettings[key] = {
                        enabled: oldConfig?.enabled ?? defaultConfig.enabled,
                        params: oldConfig?.params ?? defaultConfig.params,
                        weight: oldConfig?.weight ?? 1.0 // Default weight if not present
                    };
                }

                // Merge with initial state to handle new fields in future updates
                this.state = {
                    ...INITIAL_STATE,
                    ...parsed,
                    // Ensure settings are merged correctly
                    settings: {
                        ...DEFAULT_SETTINGS,
                        ...(parsed.settings || {}),
                        // Use migrated indicator settings
                        indicatorSettings: migratedIndicatorSettings as unknown as IndicatorSettings,
                        // Ensure selectedPreset exists
                        selectedPreset: parsed.settings?.selectedPreset || 'balanced'
                    },
                    // Reset transient state
                    isAnalyzing: false,
                    pendingExecution: false,
                    // Keep logs? Maybe limit them
                    logs: parsed.logs || []
                };
            }
        } catch (e) {
            console.error('Failed to load dealer state:', e);
        }
    }

    private async saveState(): Promise<void> {
        try {
            await StorageService.setItem(
                StorageService.getUserKey('vault_dealer_storage'),
                JSON.stringify(this.state)
            );
        } catch (e) {
            console.error('Failed to save dealer state:', e);
        }
    }

    private notifyListeners() {
        this.listeners.forEach(listener => listener());
    }

    private notify() {
        this.notifyListeners();
        this.saveState(); // Fire and forget
    }

    // --- Public API ---

    public subscribe(listener: () => void) {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    public getSnapshot() {
        return this.state;
    }

    // Actions

    public toggleDealer(isOn: boolean) {
        this.state = {
            ...this.state,
            isOn,
            statusMessage: isOn ? 'Dealer Activated' : 'Dealer Stopped'
        };
        this.addLog('INFO', `Dealer turned ${isOn ? 'ON' : 'OFF'}`);
        this.notify();
    }

    public updateSettings(newSettings: Partial<DealerSettings>) {
        this.state = {
            ...this.state,
            settings: { ...this.state.settings, ...newSettings }
        };
        this.addLog('INFO', 'Settings updated');
        // Reset internal logic state if critical settings change? 
        // For now, simple update.
        this.notify();
    }

    public setStrategyPrompt(prompt: string) {
        this.updateSettings({ strategyPrompt: prompt });
    }

    public setAnalyzing(isAnalyzing: boolean) {
        this.state = { ...this.state, isAnalyzing };
        this.notify();
    }

    public updateStatus(
        task: string | null,
        signal: DealerState['currentSignal'],
        assessment: string,
        exposure?: number,
        detail?: string
    ) {
        this.state = {
            ...this.state,
            currentTask: task !== undefined ? task : this.state.currentTask,
            currentSignal: signal !== undefined ? signal : this.state.currentSignal,
            trendAssessment: assessment !== undefined ? assessment : this.state.trendAssessment,
            currentExposure: exposure !== undefined ? exposure : this.state.currentExposure,
            statusDetail: detail !== undefined ? detail : this.state.statusDetail
        };
        this.notify();
    }

    public updatePortfolioState(
        positions: DealerPosition[],
        portfolioValue: number,
        exposure: number
    ) {
        this.state = {
            ...this.state,
            activePositions: positions,
            portfolioValue: portfolioValue,
            currentExposure: exposure,
            lastSyncTimestamp: Date.now()
        };
        this.notify();
    }

    public addLog(type: DealerLog['type'], message: string, details?: any) {
        const newLog: DealerLog = {
            id: Date.now().toString() + Math.random().toString().slice(2, 5),
            timestamp: Date.now(),
            type,
            message,
            details
        };

        // Keep last 100 logs
        const updatedLogs = [newLog, ...this.state.logs].slice(0, 100);

        this.state = { ...this.state, logs: updatedLogs };
        this.notify();
    }

    public clearLogs() {
        this.state = { ...this.state, logs: [] };
        this.notify();
    }

    public reload() {
        // "Apply Changes" logic helper - reloads from storage if needed or just forces a notify
        // But mainly resets transient state
        this.state = {
            ...this.state,
            isAnalyzing: false,
            currentTask: null,
            currentSignal: null,
            pendingExecution: false,
            trendAssessment: 'Reset by user',
            statusMessage: 'Settings Applied'
        };
        this.addLog('INFO', 'System reloaded manually');
        this.notify();
    }

    // --- Operation History Methods (for Manager queries) ---

    /**
     * Record a new trade operation (called when executing a trade)
     */
    public addOperationRecord(record: Omit<DealerOperationRecord, 'id'>) {
        const newRecord: DealerOperationRecord = {
            ...record,
            id: Date.now().toString() + Math.random().toString().slice(2, 5)
        };

        // Keep last 50 operations
        const updatedHistory = [newRecord, ...this.state.operationHistory].slice(0, 50);

        this.state = { ...this.state, operationHistory: updatedHistory };
        this.notify();
    }

    /**
     * Update an operation status (e.g., mark as CLOSED when position is closed)
     */
    public updateOperationStatus(cloid: string, updates: Partial<DealerOperationRecord>) {
        const updatedHistory = this.state.operationHistory.map(op =>
            op.cloid === cloid ? { ...op, ...updates } : op
        );
        this.state = { ...this.state, operationHistory: updatedHistory };
        this.notify();
    }

    /**
     * Get trade history with reasoning (for Vault Operator queries)
     * @param coin Optional filter by coin
     * @param limit Maximum records to return (default 10)
     * @param includeReasoning Whether to include full reasoning (default true)
     */
    public getTradeHistory(coin?: string, limit: number = 10, includeReasoning: boolean = true) {
        let operations = this.state.operationHistory;

        // Filter by coin if specified
        if (coin) {
            operations = operations.filter(op => op.coin.toUpperCase() === coin.toUpperCase());
        }

        // Get REASONING logs for additional context
        const reasoningLogs = includeReasoning
            ? this.state.logs.filter(log => log.type === 'REASONING' || log.type === 'TRADE' || log.type === 'SIGNAL')
            : [];

        // Combine operation records with relevant logs
        const history = operations.slice(0, limit).map(op => {
            // Find matching reasoning log
            const matchingLog = reasoningLogs.find(log =>
                log.message.includes(op.coin) &&
                Math.abs(log.timestamp - op.timestamp) < 60000 // Within 1 minute
            );

            return {
                ...op,
                fullReasoning: matchingLog?.details?.fullReason || op.reasoning,
                analysisContext: matchingLog?.details?.context
            };
        });

        return {
            operations: history,
            totalOperations: operations.length,
            recentLogs: reasoningLogs.slice(0, 5)
        };
    }
}

export const dealerStore = new DealerStore();
