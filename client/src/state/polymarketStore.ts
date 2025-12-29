// src/state/polymarketStore.ts
// State management for Polymarket Dealer - follows dealerStore.ts pattern

import { PolymarketPosition, PolymarketCategory } from '../types';
import { StorageService } from '../services/storageService';

// ============================================
// CATEGORY OPTIONS
// ============================================

export const POLYMARKET_CATEGORIES: { value: PolymarketCategory; label: string; icon: string }[] = [
    { value: 'politics', label: 'Politics', icon: '🏛️' },
    { value: 'crypto', label: 'Crypto', icon: '₿' },
    { value: 'sports', label: 'Sports', icon: '⚽' },
    { value: 'pop-culture', label: 'Pop Culture', icon: '🎬' },
    { value: 'science', label: 'Science', icon: '🔬' },
    { value: 'business', label: 'Business', icon: '💼' },
    { value: 'other', label: 'Other', icon: '📦' }
];

// ============================================
// TYPES
// ============================================

export interface PolymarketLog {
    id: string;
    timestamp: number;
    type: 'INFO' | 'WARNING' | 'ERROR' | 'TRADE' | 'SIGNAL' | 'REASONING';
    message: string;
    details?: any;
}

export interface PolymarketSettings {
    // Strategy
    strategyPrompt: string;

    // Market Selection
    marketSelectionMode: 'MANUAL' | 'AI_DISCOVERY';
    selectedMarkets: string[]; // Market slugs when in MANUAL mode
    allowedCategories: PolymarketCategory[]; // Categories AI can trade in

    // Risk Management
    maxPositionSizeUSDC: number;
    maxOpenPositions: number;
    minLiquidity: number; // Minimum market liquidity to trade
    minVolume24h: number; // Minimum 24h volume to trade

    // Additional thresholds for Config UI
    minVolumeThreshold: number;
    minLiquidityThreshold: number;
    minSpreadThreshold: number;
    confidenceThreshold: number;

    // Bankroll (Independent from Hyperliquid)
    bankrollType: 'MANUAL' | 'ALL_AVAILABLE';
    manualBankroll: number;

    // Timing
    checkIntervalSeconds: number;

    // Prompt Mode
    promptMode: 'preset' | 'custom';
    selectedPreset: PolymarketPresetName;
}

// ============================================
// PRESETS
// ============================================

export type PolymarketPresetName = 'balanced' | 'highVolume' | 'crypto' | 'conservative' | 'custom';

export interface PolymarketPreset {
    name: string;
    description: string;
    emoji: string;
    categories: PolymarketCategory[];
    marketCondition: string;
}

export const POLYMARKET_PRESETS: Record<PolymarketPresetName, PolymarketPreset> = {
    balanced: {
        name: 'Balanced',
        description: 'Trade across all categories with balanced risk',
        emoji: '⚖️',
        categories: ['politics', 'crypto', 'business', 'science'],
        marketCondition: 'diverse markets with good liquidity'
    },
    highVolume: {
        name: 'High Volume',
        description: 'Focus on most liquid markets',
        emoji: '📊',
        categories: ['politics', 'crypto', 'sports'],
        marketCondition: 'high volume markets with tight spreads'
    },
    crypto: {
        name: 'Crypto Focus',
        description: 'Only cryptocurrency-related markets',
        emoji: '₿',
        categories: ['crypto'],
        marketCondition: 'crypto market events and predictions'
    },
    conservative: {
        name: 'Conservative',
        description: 'Low risk, high confidence trades only',
        emoji: '🛡️',
        categories: ['politics', 'business'],
        marketCondition: 'stable markets with clear probable outcomes'
    },
    custom: {
        name: 'Custom',
        description: 'Your custom configuration',
        emoji: '⚙️',
        categories: [],
        marketCondition: 'user-defined'
    }
};

export const POLYMARKET_PRESET_PROMPTS: Record<PolymarketPresetName, string> = {
    balanced: `You are Polymarket Dealer, an autonomous prediction market trading engine.
Your goal is to identify high-probability trading opportunities across diverse markets.

RULES:
1. Analyze market question, current probability, volume, and time to resolution.
2. BUY YES when probability is undervalued (market < 40% but your analysis suggests > 60%).
3. BUY NO when probability is overvalued (market > 60% but your analysis suggests < 40%).
4. SELL positions when probability has moved 15%+ in your favor OR if new information changes thesis.
5. AVOID markets with < $10k liquidity or < 7 days to resolution (unless very high confidence).
6. Max position: 5% of bankroll per market.
7. HOLD if confidence < 65%.`,

    highVolume: `You are Polymarket Dealer, focused on liquid markets with high volume.
Your goal is to trade actively in markets with the best liquidity and tightest spreads.

RULES:
1. Only trade markets with > $50k volume in 24h.
2. Target spreads < 5% for entries and exits.
3. Look for momentum: price moving in a direction with increasing volume.
4. Use smaller positions (2% max) but trade more frequently.
5. Take profits quickly: exit at 10%+ gain.
6. Cut losses at 8%.
7. AVOID low-liquidity markets even if edge seems large.`,

    crypto: `You are Polymarket Dealer, specialized in cryptocurrency prediction markets.
Your goal is to leverage crypto market knowledge for prediction market alpha.

RULES:
1. Trade only crypto-related markets (price predictions, ETF approvals, protocol events).
2. Use your understanding of crypto market dynamics and sentiment.
3. BUY YES on bullish crypto catalysts you believe are underpriced.
4. BUY NO when crypto hype seems overextended.
5. Watch for correlation with actual crypto prices.
6. Higher conviction trades allowed (up to 8% of bankroll).
7. AVOID markets about specific coins you lack knowledge of.`,

    conservative: `You are Polymarket Dealer, taking a conservative low-risk approach.
Your goal is to identify very high probability trades with minimal downside.

RULES:
1. Only trade when confidence > 80%.
2. Focus on markets where outcome seems nearly certain (price > 85% or < 15%).
3. Look for arbitrage opportunities and mispriced markets.
4. Small position sizes (max 3% of bankroll).
5. AVOID volatile markets or those with incoming news catalysts.
6. Prefer longer time horizons (> 30 days to resolution).
7. HOLD cash if no clear opportunities.`,

    custom: `// Write your custom strategy instructions here...
// Example:
// You are a specialized Polymarket trader.
// 1. Focus on political markets only.
// 2. Trade based on polling data and historical patterns.
// 3. Never risk more than 2% per trade.`
};

// ============================================
// DEFAULT VALUES
// ============================================

const DEFAULT_STRATEGY = POLYMARKET_PRESET_PROMPTS.balanced;

const DEFAULT_SETTINGS: PolymarketSettings = {
    strategyPrompt: DEFAULT_STRATEGY,
    marketSelectionMode: 'AI_DISCOVERY',
    selectedMarkets: [],
    allowedCategories: ['politics', 'crypto', 'business', 'science'],
    maxPositionSizeUSDC: 50,
    maxOpenPositions: 5,
    minLiquidity: 10000, // $10k minimum liquidity
    minVolume24h: 5000, // $5k minimum 24h volume
    minVolumeThreshold: 5000,
    minLiquidityThreshold: 10000,
    minSpreadThreshold: 0.02,
    confidenceThreshold: 0.6,
    bankrollType: 'MANUAL',
    manualBankroll: 100,
    checkIntervalSeconds: 300,
    promptMode: 'preset',
    selectedPreset: 'balanced'
};

// ============================================
// OPERATION RECORD
// ============================================

export interface PolymarketOperationRecord {
    id: string;
    marketId: string;
    question: string;
    outcome: 'YES' | 'NO';
    action: 'BUY' | 'SELL';
    timestamp: number;
    price: number;
    shares: number;
    sizeUSDC: number;
    pnl?: number;
    reasoning: string;
    confidence: number;
    status: 'OPEN' | 'CLOSED';
}

// ============================================
// STATE
// ============================================

export interface PolymarketState {
    isOn: boolean;
    isAnalyzing: boolean;
    statusMessage: string;
    statusDetail: string;

    // Live execution data
    currentTask: string | null;
    currentSignal: 'BULLISH' | 'BEARISH' | 'NEUTRAL' | null;
    analysisNote: string;
    pendingExecution: boolean;
    currentExposure: number;

    // Portfolio
    activePositions: PolymarketPosition[];
    portfolioValue: number;
    lastSyncTimestamp: number;

    // Settings
    settings: PolymarketSettings;

    // Logs
    logs: PolymarketLog[];

    // Operation History
    operationHistory: PolymarketOperationRecord[];
}

const INITIAL_STATE: PolymarketState = {
    isOn: false,
    isAnalyzing: false,
    statusMessage: 'Ready',
    statusDetail: 'Awaiting activation',
    currentTask: null,
    currentSignal: null,
    analysisNote: 'Waiting for data...',
    pendingExecution: false,
    currentExposure: 0,
    activePositions: [],
    portfolioValue: 0,
    lastSyncTimestamp: 0,
    settings: DEFAULT_SETTINGS,
    logs: [],
    operationHistory: []
};

// ============================================
// STORE IMPLEMENTATION
// ============================================

class PolymarketStore {
    private state: PolymarketState;
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
        console.log('[PolymarketStore] Reloading from storage...');
        await this.loadState();
        this.notifyListeners();
    }

    /**
     * Reset state to initial values. Should be called on account deletion.
     */
    reset(): void {
        console.log('[PolymarketStore] Resetting to initial state...');
        this.state = { ...INITIAL_STATE };
        this.notifyListeners();
    }

    private async loadState(): Promise<void> {
        try {
            const key = StorageService.getUserKey('vault_polymarket_storage');
            console.log('[PolymarketStore] Loading from key:', key);
            const saved = await StorageService.getItem(key);
            if (saved) {
                const parsed = JSON.parse(saved);
                console.log('[PolymarketStore] Loaded settings:', parsed.settings);
                this.state = {
                    ...INITIAL_STATE,
                    ...parsed,
                    settings: {
                        ...DEFAULT_SETTINGS,
                        ...(parsed.settings || {})
                    },
                    // Reset transient state
                    isAnalyzing: false,
                    pendingExecution: false,
                    logs: parsed.logs || []
                };
            } else {
                console.log('[PolymarketStore] No saved data found');
            }
        } catch (e) {
            console.error('Failed to load Polymarket state:', e);
        }
    }

    private async saveState(): Promise<void> {
        try {
            await StorageService.setItem(
                StorageService.getUserKey('vault_polymarket_storage'),
                JSON.stringify(this.state)
            );
        } catch (e) {
            console.error('Failed to save Polymarket state:', e);
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
            statusMessage: isOn ? 'Polymarket Dealer Activated' : 'Polymarket Dealer Stopped'
        };
        this.addLog('INFO', `Polymarket Dealer turned ${isOn ? 'ON' : 'OFF'}`);
        this.notify();
    }

    public updateSettings(newSettings: Partial<PolymarketSettings>) {
        this.state = {
            ...this.state,
            settings: { ...this.state.settings, ...newSettings }
        };
        this.addLog('INFO', 'Polymarket settings updated');
        this.notify();
    }

    public setStrategyPrompt(prompt: string) {
        this.updateSettings({ strategyPrompt: prompt });
    }

    public setAnalyzing(isAnalyzing: boolean) {
        this.state = { ...this.state, isAnalyzing };
        this.notify();
    }

    public setCurrentTask(task: string | null) {
        this.state = { ...this.state, currentTask: task };
        this.notify();
    }

    public setStatusMessage(message: string) {
        this.state = { ...this.state, statusMessage: message };
        this.notify();
    }

    public setStatusDetail(detail: string) {
        this.state = { ...this.state, statusDetail: detail };
        this.notify();
    }

    public setAnalysisNote(note: string) {
        this.state = { ...this.state, analysisNote: note };
        this.notify();
    }

    public setCurrentSignal(signal: PolymarketState['currentSignal']) {
        this.state = { ...this.state, currentSignal: signal };
        this.notify();
    }

    public updateStatus(
        task: string | null,
        signal: PolymarketState['currentSignal'],
        note: string,
        exposure?: number,
        detail?: string
    ) {
        this.state = {
            ...this.state,
            currentTask: task !== undefined ? task : this.state.currentTask,
            currentSignal: signal !== undefined ? signal : this.state.currentSignal,
            analysisNote: note !== undefined ? note : this.state.analysisNote,
            currentExposure: exposure !== undefined ? exposure : this.state.currentExposure,
            statusDetail: detail !== undefined ? detail : this.state.statusDetail
        };
        this.notify();
    }

    public updatePortfolioState(
        positions: PolymarketPosition[],
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

    public addLog(type: PolymarketLog['type'], message: string, details?: any) {
        const newLog: PolymarketLog = {
            id: Date.now().toString() + Math.random().toString().slice(2, 5),
            timestamp: Date.now(),
            type,
            message,
            details
        };

        const updatedLogs = [newLog, ...this.state.logs].slice(0, 100);
        this.state = { ...this.state, logs: updatedLogs };
        this.notify();
    }

    public clearLogs() {
        this.state = { ...this.state, logs: [] };
        this.notify();
    }

    public reload() {
        this.state = {
            ...this.state,
            isAnalyzing: false,
            currentTask: null,
            currentSignal: null,
            pendingExecution: false,
            analysisNote: 'Reset by user',
            statusMessage: 'Settings Applied'
        };
        this.addLog('INFO', 'Polymarket system reloaded manually');
        this.notify();
    }

    // --- Operation History Methods ---

    public addOperationRecord(record: Omit<PolymarketOperationRecord, 'id'>) {
        const newRecord: PolymarketOperationRecord = {
            ...record,
            id: Date.now().toString() + Math.random().toString().slice(2, 5)
        };

        const updatedHistory = [newRecord, ...this.state.operationHistory].slice(0, 50);
        this.state = { ...this.state, operationHistory: updatedHistory };
        this.notify();
    }

    public updateOperationStatus(id: string, updates: Partial<PolymarketOperationRecord>) {
        const updatedHistory = this.state.operationHistory.map(op =>
            op.id === id ? { ...op, ...updates } : op
        );
        this.state = { ...this.state, operationHistory: updatedHistory };
        this.notify();
    }

    public getTradeHistory(limit: number = 10, includeReasoning: boolean = true) {
        let operations = this.state.operationHistory;

        const reasoningLogs = includeReasoning
            ? this.state.logs.filter(log => log.type === 'REASONING' || log.type === 'TRADE' || log.type === 'SIGNAL')
            : [];

        const history = operations.slice(0, limit).map(op => {
            const matchingLog = reasoningLogs.find(log =>
                log.message.includes(op.question.slice(0, 30)) &&
                Math.abs(log.timestamp - op.timestamp) < 60000
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

export const polymarketStore = new PolymarketStore();
