// services/ai/geminiProvider.ts
// Google Gemini AI Provider implementation

import { GoogleGenAI, FunctionDeclaration, Type, Tool } from '@google/genai';
import { IAIProvider, AIResponse } from './aiTypes';
import { aiRequestQueue } from './requestQueue';
import { AgentMessage } from '../../types';

export class GeminiProvider implements IAIProvider {
    readonly providerType = 'gemini' as const;
    private client: GoogleGenAI | null = null;
    private modelName: string = 'gemini-2.5-flash';

    constructor() {
        // Queue is global singleton, no initialization needed here
    }

    isInitialized(): boolean {
        return this.client !== null;
    }

    initialize(apiKey: string): void {
        this.client = new GoogleGenAI({ apiKey });
    }

    setModel(model: string): void {
        this.modelName = model;
    }

    getModel(): string {
        return this.modelName;
    }

    getTools(): Tool[] {
        const getBalanceTool: FunctionDeclaration = {
            name: 'getVaultBalance',
            description: 'Get the balance of the internal Vault Wallet. Can show all balances or a specific token balance.',
            parameters: {
                type: Type.OBJECT,
                properties: {
                    token: { type: Type.STRING, description: 'Optional: Symbol or Mint Address of specific token to check.' },
                },
            },
        };

        const swapTool: FunctionDeclaration = {
            name: 'executeSwap',
            description: 'Execute a token swap on Raydium Devnet.',
            parameters: {
                type: Type.OBJECT,
                properties: {
                    inputToken: { type: Type.STRING, description: 'Symbol or Mint Address of token to sell' },
                    outputToken: { type: Type.STRING, description: 'Symbol or Mint Address of token to buy' },
                    amount: { type: Type.NUMBER, description: 'Amount of input token to swap' },
                },
                required: ['inputToken', 'outputToken', 'amount'],
            },
        };

        const withdrawTool: FunctionDeclaration = {
            name: 'withdrawSol',
            description: 'Transfer SOL from the internal Vault to the connected Owner Wallet.',
            parameters: {
                type: Type.OBJECT,
                properties: {
                    amount: { type: Type.NUMBER, description: 'Amount of SOL to transfer' },
                },
                required: ['amount'],
            },
        };

        const transferTokenTool: FunctionDeclaration = {
            name: 'transferToken',
            description: 'Transfer SPL tokens or NFTs from the Vault to the Owner Wallet.',
            parameters: {
                type: Type.OBJECT,
                properties: {
                    tokenMint: { type: Type.STRING, description: 'Mint address of the token to transfer' },
                    amount: { type: Type.NUMBER, description: 'Amount of tokens to transfer' }
                },
                required: ['tokenMint', 'amount']
            }
        };

        const getMarketPriceTool: FunctionDeclaration = {
            name: 'getMarketPrice',
            description: 'Get the current market price for a given symbol.',
            parameters: {
                type: Type.OBJECT,
                properties: {
                    symbol: { type: Type.STRING, description: 'Trading symbol (e.g., "BTCUSDT")' },
                },
                required: ['symbol'],
            },
        };

        const getOHLCVTool: FunctionDeclaration = {
            name: 'getOHLCV',
            description: 'Get OHLCV candlestick data for a symbol.',
            parameters: {
                type: Type.OBJECT,
                properties: {
                    symbol: { type: Type.STRING, description: 'Trading symbol' },
                    timeframe: { type: Type.STRING, description: 'Timeframe (e.g., "1", "5", "15", "60", "240", "D")' },
                },
                required: ['symbol'],
            },
        };

        const getIndicatorTool: FunctionDeclaration = {
            name: 'getIndicator',
            description: 'Get a specific technical indicator value for a symbol.',
            parameters: {
                type: Type.OBJECT,
                properties: {
                    symbol: { type: Type.STRING, description: 'Trading symbol' },
                    indicator: { type: Type.STRING, description: 'Indicator name: "rsi", "macd", "ema", "sma", "stoch"' },
                    timeframe: { type: Type.STRING, description: 'Timeframe' },
                },
                required: ['symbol', 'indicator'],
            },
        };

        const getTradingViewSummaryTool: FunctionDeclaration = {
            name: 'getTradingViewSummary',
            description: 'Get TradingView buy/sell/neutral recommendation summary.',
            parameters: {
                type: Type.OBJECT,
                properties: {
                    symbol: { type: Type.STRING, description: 'Trading symbol' },
                },
                required: ['symbol'],
            },
        };

        const getHLBalanceTool: FunctionDeclaration = {
            name: 'getHLBalance',
            description: 'Get the balance of the Hyperliquid Vault and positions.',
            parameters: { type: Type.OBJECT, properties: {} },
        };

        const getHLPositionsTool: FunctionDeclaration = {
            name: 'getHLPositions',
            description: 'Get open positions in the Hyperliquid Vault.',
            parameters: { type: Type.OBJECT, properties: {} },
        };

        const getHLMarketDataTool: FunctionDeclaration = {
            name: 'getHLMarketData',
            description: 'Get market data for a Hyperliquid asset.',
            parameters: {
                type: Type.OBJECT,
                properties: {
                    coin: { type: Type.STRING, description: 'Asset symbol (e.g., "BTC", "ETH")' },
                },
                required: ['coin'],
            },
        };

        const createHLOrderTool: FunctionDeclaration = {
            name: 'createHLOrder',
            description: 'Place an order on Hyperliquid Testnet.',
            parameters: {
                type: Type.OBJECT,
                properties: {
                    coin: { type: Type.STRING, description: 'Asset symbol' },
                    isBuy: { type: Type.BOOLEAN, description: 'True for LONG, False for SHORT' },
                    size: { type: Type.NUMBER, description: 'Size of the order' },
                    usdcAmount: { type: Type.NUMBER, description: 'Amount in USDC to spend' },
                    orderType: { type: Type.STRING, description: 'Order type: "limit", "market"' },
                    price: { type: Type.NUMBER, description: 'Limit price' },
                    leverage: { type: Type.NUMBER, description: 'Leverage multiplier (1-50)' },
                    stopLoss: { type: Type.NUMBER, description: 'Stop loss price' },
                    takeProfit: { type: Type.NUMBER, description: 'Take profit price' },
                    reduceOnly: { type: Type.BOOLEAN, description: 'True to only reduce existing position' }
                },
                required: ['coin', 'isBuy', 'orderType'],
            },
        };

        const cancelHLOrderTool: FunctionDeclaration = {
            name: 'cancelHLOrder',
            description: 'Cancel a specific order on Hyperliquid.',
            parameters: {
                type: Type.OBJECT,
                properties: {
                    coin: { type: Type.STRING, description: 'Asset symbol' },
                    orderId: { type: Type.NUMBER, description: 'Order ID to cancel' },
                },
                required: ['coin', 'orderId'],
            },
        };

        const updateHLLeverageTool: FunctionDeclaration = {
            name: 'updateHLLeverage',
            description: 'Update leverage for a specific asset on Hyperliquid.',
            parameters: {
                type: Type.OBJECT,
                properties: {
                    coin: { type: Type.STRING, description: 'Asset symbol' },
                    leverage: { type: Type.NUMBER, description: 'New leverage (1-50)' },
                    isCross: { type: Type.BOOLEAN, description: 'True for cross margin' }
                },
                required: ['coin', 'leverage', 'isCross'],
            },
        };

        const closeHLPositionTool: FunctionDeclaration = {
            name: 'closeHLPosition',
            description: 'Close an open position on Hyperliquid.',
            parameters: {
                type: Type.OBJECT,
                properties: {
                    coin: { type: Type.STRING, description: 'Asset symbol' },
                    size: { type: Type.NUMBER, description: 'Optional: partial close size' },
                    orderType: { type: Type.STRING, description: 'Order type: "market" or "limit"' },
                    price: { type: Type.NUMBER, description: 'Price for limit orders' }
                },
                required: ['coin', 'orderType'],
            },
        };

        const withdrawFromHLTool: FunctionDeclaration = {
            name: 'withdrawFromHL',
            description: 'Execute a USDC withdrawal from Hyperliquid Testnet.',
            parameters: {
                type: Type.OBJECT,
                properties: {
                    amount: { type: Type.NUMBER, description: 'Amount of USDC to withdraw' }
                },
                required: ['amount']
            }
        };

        const getDealerTradeHistoryTool: FunctionDeclaration = {
            name: 'getDealerTradeHistory',
            description: 'Query the Hyperliquid Dealer\'s trade history and AI reasoning.',
            parameters: {
                type: Type.OBJECT,
                properties: {
                    coin: { type: Type.STRING, description: 'Optional: Filter by coin' },
                    limit: { type: Type.NUMBER, description: 'Max records to return (default 10)' },
                    includeReasoning: { type: Type.BOOLEAN, description: 'Include full AI reasoning' }
                }
            }
        };

        const scheduleTaskTool: FunctionDeclaration = {
            name: 'scheduleTask',
            description: 'Schedule a task to execute at a specific time or when a market condition is met.',
            parameters: {
                type: Type.OBJECT,
                properties: {
                    taskType: { type: Type.STRING, description: 'Type: SWAP, TRANSFER, ALERT, or HL_ORDER' },
                    inputToken: { type: Type.STRING, description: 'For SWAP/TRANSFER: Input token' },
                    outputToken: { type: Type.STRING, description: 'For SWAP: Output token' },
                    amount: { type: Type.NUMBER, description: 'Amount to swap or transfer' },
                    coin: { type: Type.STRING, description: 'For HL_ORDER: Asset symbol' },
                    isBuy: { type: Type.BOOLEAN, description: 'For HL_ORDER: True for LONG' },
                    size: { type: Type.NUMBER, description: 'For HL_ORDER: Order size' },
                    orderType: { type: Type.STRING, description: 'For HL_ORDER: Order type' },
                    price: { type: Type.NUMBER, description: 'For HL_ORDER: Limit price' },
                    leverage: { type: Type.NUMBER, description: 'For HL_ORDER: Leverage' },
                    stopLoss: { type: Type.NUMBER, description: 'For HL_ORDER: Stop loss' },
                    takeProfit: { type: Type.NUMBER, description: 'For HL_ORDER: Take profit' },
                    reduceOnly: { type: Type.BOOLEAN, description: 'For HL_ORDER: Reduce only' },
                    delayMinutes: { type: Type.NUMBER, description: 'For time-based: Delay in minutes' },
                    conditionIndicator: { type: Type.STRING, description: 'For condition-based: Indicator name' },
                    conditionSymbol: { type: Type.STRING, description: 'For condition-based: Trading symbol' },
                    conditionOperator: { type: Type.STRING, description: 'For condition-based: Comparison operator' },
                    conditionValue: { type: Type.NUMBER, description: 'For condition-based: Threshold value' },
                    conditionTimeframe: { type: Type.STRING, description: 'For condition-based: Timeframe' }
                },
                required: ['taskType']
            }
        };

        return [{
            functionDeclarations: [
                getBalanceTool, swapTool, withdrawTool, transferTokenTool, scheduleTaskTool,
                getMarketPriceTool, getOHLCVTool, getIndicatorTool, getTradingViewSummaryTool,
                getHLBalanceTool, getHLPositionsTool, getHLMarketDataTool,
                createHLOrderTool, cancelHLOrderTool, updateHLLeverageTool,
                closeHLPositionTool, withdrawFromHLTool, getDealerTradeHistoryTool
            ]
        }];
    }

    async sendMessage(
        history: AgentMessage[],
        newMessage: string,
        systemInstruction: string,
        tools?: any[]
    ): Promise<AIResponse> {
        if (!this.client) throw new Error("Gemini not initialized. Please set API Key.");

        const client = this.client;
        const modelName = this.modelName;
        const getTools = () => this.getTools();

        // Use global queue for rate limiting
        return aiRequestQueue.enqueue({
            priority: 'HIGH',
            source: 'operator',
            provider: 'gemini',
            execute: async () => {
                const chatHistory = history.map(h => ({
                    role: h.role === 'model' ? 'model' : 'user',
                    parts: [{ text: h.content }],
                }));

                const chat = client.chats.create({
                    model: modelName,
                    config: {
                        systemInstruction: systemInstruction,
                        tools: tools || getTools(),
                    },
                    history: chatHistory
                });

                const result = await chat.sendMessage({ message: newMessage });

                // Extract text from response
                let text = '';
                if (result.candidates && result.candidates[0]?.content?.parts) {
                    for (const part of result.candidates[0].content.parts) {
                        if (part.text) text += part.text;
                    }
                }

                return {
                    text,
                    usageMetadata: result.usageMetadata ? {
                        promptTokenCount: result.usageMetadata.promptTokenCount || 0,
                        candidatesTokenCount: result.usageMetadata.candidatesTokenCount || 0,
                    } : undefined,
                    functionCalls: result.functionCalls?.map(fc => ({
                        name: fc.name,
                        args: fc.args as Record<string, any>
                    })) || undefined
                };
            }
        });
    }

    async sendJsonAnalysis(prompt: string, systemInstruction: string): Promise<string | null> {
        if (!this.client) {
            console.warn("[GeminiProvider] Client not initialized");
            return null;
        }

        const client = this.client;
        const modelName = this.modelName;

        // Use global queue for rate limiting
        return aiRequestQueue.enqueue({
            priority: 'NORMAL',
            source: 'polymarketDealer',
            provider: 'gemini',
            execute: async () => {
                const chat = client.chats.create({
                    model: modelName,
                    config: {
                        systemInstruction: systemInstruction,
                        responseMimeType: 'application/json'
                    }
                });

                const result = await chat.sendMessage({ message: prompt });

                let text = '';
                if (result.candidates && result.candidates[0]?.content?.parts) {
                    for (const part of result.candidates[0].content.parts) {
                        if (part.text) text += part.text;
                    }
                }

                return text || null;
            }
        });
    }

    async sendBatchAnalysis(context: any, strategyPrompt: string, abortSignal?: AbortSignal): Promise<{ decisions: any[], cycleSummary?: string }> {
        if (!this.client) {
            throw new Error("Gemini not initialized. Please set API Key.");
        }

        // Check if already aborted
        if (abortSignal?.aborted) {
            throw new DOMException('Dealer cycle aborted', 'AbortError');
        }

        const client = this.client;
        const modelName = this.modelName;
        const dealerSystemInstruction = this.getBatchDealerSystemInstruction();
        const normalizeDecisions = (parsed: any, usageMetadata: any, ctx: any) =>
            this.normalizeDecisions(parsed, usageMetadata, ctx);

        // Build cycle summary section if available
        const cycleSummarySection = context.cycleSummary
            ? `\n[RECENT ACTIVITY CONTEXT]\n${context.cycleSummary}\n`
            : '';

        const contextMessage = `
            [USER STRATEGY]
            ${strategyPrompt}
            ${cycleSummarySection}
            [BATCH MARKET DATA]
            ${JSON.stringify(context)}

            Analyze all assets in the batch. Return a JSON Array of decisions.
        `;

        // Use global queue for rate limiting (queue handles retries internally)
        return aiRequestQueue.enqueue({
            priority: 'NORMAL',
            source: 'hyperliquidDealer',
            provider: 'gemini',
            execute: async () => {
                // Check abort signal before making request
                if (abortSignal?.aborted) {
                    throw new DOMException('Dealer cycle aborted', 'AbortError');
                }

                const chat = client.chats.create({
                    model: modelName,
                    config: {
                        systemInstruction: dealerSystemInstruction,
                        responseMimeType: 'application/json'
                    }
                });

                const result = await chat.sendMessage({ message: contextMessage });

                // Check abort signal after request completes
                if (abortSignal?.aborted) {
                    throw new DOMException('Dealer cycle aborted', 'AbortError');
                }

                let text = '';
                if (result.candidates && result.candidates[0]?.content?.parts) {
                    for (const part of result.candidates[0].content.parts) {
                        if (part.text) text += part.text;
                    }
                }

                if (!text) {
                    console.warn('[GeminiProvider] Empty response from batch analysis');
                    return { decisions: [] };
                }

                const jsonText = text.replace(/```json/g, '').replace(/```/g, '').trim();
                let parsed;
                try {
                    parsed = JSON.parse(jsonText);
                } catch (parseError) {
                    console.error('[GeminiProvider] Failed to parse batch response:', parseError);
                    return { decisions: [] };
                }

                return normalizeDecisions(parsed, result.usageMetadata, context);
            }
        });
    }

    private normalizeDecisions(parsed: any, usageMetadata: any, context: any): { decisions: any[], cycleSummary?: string } {
        let decisions: any[] = [];
        let cycleSummary: string | undefined;

        if (Array.isArray(parsed)) {
            decisions = parsed;
        } else if (typeof parsed === 'object') {
            if (parsed.decisions) {
                decisions = parsed.decisions;
            } else {
                decisions = [parsed];
            }
            // Extract cycleSummary if present
            if (parsed.cycleSummary && typeof parsed.cycleSummary === 'string') {
                cycleSummary = parsed.cycleSummary.slice(0, 350); // Limit length
            }
        }

        // Normalize actions
        const normalized = decisions.map(d => {
            if (d.action === 'LONG') return { ...d, action: 'BUY' };
            if (d.action === 'SHORT') return { ...d, action: 'SELL' };
            if (d.action === 'WAIT') return { ...d, action: 'HOLD' };
            return d;
        });

        // Filter valid decisions
        const valid = normalized.filter(d => {
            const hasCoin = typeof d.coin === 'string' && d.coin.length > 0;
            const hasAction = ['BUY', 'SELL', 'HOLD', 'CLOSE'].includes(d.action);
            return hasCoin && hasAction;
        });

        // Deduplicate
        const coinMap = new Map<string, any>();
        const priority: Record<string, number> = { 'CLOSE': 3, 'BUY': 2, 'SELL': 2, 'HOLD': 1 };

        for (const d of valid) {
            const coin = d.coin.toUpperCase();
            const existing = coinMap.get(coin);
            if (!existing) {
                coinMap.set(coin, d);
            } else {
                const existingP = priority[existing.action] || 0;
                const newP = priority[d.action] || 0;
                if (newP > existingP || (newP === existingP && (d.confidence || 0) > (existing.confidence || 0))) {
                    coinMap.set(coin, d);
                }
            }
        }

        return { decisions: Array.from(coinMap.values()), cycleSummary };
    }

    private getBatchDealerSystemInstruction(): string {
        return `
            You are Hyperliquid Dealer, an autonomous crypto trading engine.
            Your goal is to analyze specific assets and output a TRADING DECISION for EACH one.

            You will receive:
            1. A JSON Object containing an array of 'coins' with their Market Data (Price, Indicators) AND HISTORICAL SERIES.
            2. Portfolio Context (Balance, Open Positions, Risk Limits, userFees with makerFee/takerFee).
            3. PRE-CALCULATED DIVERGENCE SIGNALS: Each coin includes a 'divergences' array with detected divergence patterns.
            4. [RECENT ACTIVITY CONTEXT]: Summary of your previous analysis cycles (if available).

            You must return valid JSON with this EXACT structure:
            {
                "decisions": [
                    {
                        "coin": "Symbol analyzed",
                        "action": "BUY" | "SELL" | "HOLD" | "CLOSE",
                        "confidence": number (0.0 to 1.0),
                        "reason": "Format: [ACTION] Position Status + Explanation. Max 600 chars.",
                        "suggestedLeverage": number (1-50, optional),
                        "sizeUSDC": number (optional),
                        "orderType": "limit" | "market",
                        "price": number (for limit orders, optional),
                        "stopLoss": number (optional, ONLY for BUY/SELL actions),
                        "takeProfit": number (optional, ONLY for BUY/SELL actions)
                    }
                ],
                "cycleSummary": "Brief 1-2 sentence summary of this analysis cycle for context in the next cycle. Include: key market observations, actions taken, and any notable patterns. Max 300 chars."
            }

            CRITICAL RULES:
            1. ONLY output valid JSON with the structure above.
            2. Must return one decision object per coin provided in the decisions array.
            3. CHECK PORTFOLIO LIMITS: Do not suggest BUY if maxPositions is reached.
            4. CLOSE POSITIONS: Prioritize checking existing positions for exit signals.
            5. LEVERAGE CONSTRAINT: suggestedLeverage MUST NOT exceed portfolio.settings.maxLeverage.
            6. CYCLE SUMMARY: ALWAYS include a cycleSummary field with a brief context for the next cycle.
            
            REASONING FORMAT (CRITICAL - MUST FOLLOW):
            - Start with action: "LONG:", "SHORT:", "CLOSE:", or "WAIT:".
            - POSITION STATUS (MANDATORY - ALWAYS INCLUDE):
              - Check each coin's 'openPosition.hasPosition' field.
              - If hasPosition === false: MUST say "No position." at the START of your reason.
              - If hasPosition === true: MUST say "In [side] at $[entryPx], PnL: $[unrealizedPnl]" at the START.
            - ENTRY/SL/TP VALUES:
              - ONLY include Entry, SL, TP values for BUY or SELL actions (new trades).
              - For HOLD or CLOSE actions, do NOT include Entry/SL/TP values.
            - CRITICAL: If hasPosition is false, DO NOT report SL/TP values - there is no position to have SL/TP.
            - Examples:
              - HOLD with no position: "WAIT: No position. RSI neutral, waiting for signal."
              - BUY with no position: "LONG: No position. RSI divergence detected. Entry: $95000, SL: $93100, TP: $98800"
              - CLOSE with position: "CLOSE: In LONG at $95000, PnL: +$150. Take profit target reached."
        `;
    }
}
