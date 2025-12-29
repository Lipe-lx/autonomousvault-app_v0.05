// services/ai/openaiProvider.ts
// OpenAI GPT Provider implementation

import { IAIProvider, AIResponse, PROVIDER_RATE_LIMITS } from './aiTypes';
import { aiRequestQueue } from './requestQueue';
import { AgentMessage } from '../../types';

// Note: OpenAI SDK needs to be installed: npm install openai
// This implementation uses fetch API for compatibility

export class OpenAIProvider implements IAIProvider {
    readonly providerType = 'openai' as const;
    private apiKey: string = '';
    private modelName: string = 'gpt-4o-mini';
    private baseUrl: string = 'https://api.openai.com/v1';

    constructor() {
        // Queue is global singleton
    }

    isInitialized(): boolean {
        return this.apiKey.length > 0;
    }

    initialize(apiKey: string): void {
        this.apiKey = apiKey;
    }

    setModel(model: string): void {
        this.modelName = model;
    }

    getModel(): string {
        return this.modelName;
    }

    private convertToolsToOpenAI(geminiTools?: any[]): any[] {
        if (!geminiTools || geminiTools.length === 0) return [];

        const tools: any[] = [];
        for (const toolGroup of geminiTools) {
            if (toolGroup.functionDeclarations) {
                for (const fn of toolGroup.functionDeclarations) {
                    tools.push({
                        type: 'function',
                        function: {
                            name: fn.name,
                            description: fn.description,
                            parameters: this.convertGeminiParamsToOpenAI(fn.parameters)
                        }
                    });
                }
            }
        }
        return tools;
    }

    private convertGeminiParamsToOpenAI(params: any): any {
        if (!params) return { type: 'object', properties: {} };

        const properties: any = {};
        const required: string[] = params.required || [];

        if (params.properties) {
            for (const [key, value] of Object.entries(params.properties as Record<string, any>)) {
                properties[key] = {
                    type: this.convertGeminiTypeToOpenAI(value.type),
                    description: value.description || ''
                };
            }
        }

        return {
            type: 'object',
            properties,
            required
        };
    }

    private convertGeminiTypeToOpenAI(geminiType: string): string {
        const typeMap: Record<string, string> = {
            'STRING': 'string',
            'NUMBER': 'number',
            'BOOLEAN': 'boolean',
            'OBJECT': 'object',
            'ARRAY': 'array'
        };
        return typeMap[geminiType] || 'string';
    }

    async sendMessage(
        history: AgentMessage[],
        newMessage: string,
        systemInstruction: string,
        tools?: any[]
    ): Promise<AIResponse> {
        if (!this.isInitialized()) {
            throw new Error("OpenAI not initialized. Please set API Key.");
        }

        // Use global queue
        return aiRequestQueue.enqueue({
            priority: 'HIGH',
            source: 'operator',
            provider: 'openai',
            execute: async () => {
                // Convert history to OpenAI format
                const messages: any[] = [
                    { role: 'system', content: systemInstruction }
                ];

                for (const msg of history) {
                    messages.push({
                        role: msg.role === 'model' ? 'assistant' : 'user',
                        content: msg.content
                    });
                }

                messages.push({ role: 'user', content: newMessage });

                const openaiTools = this.convertToolsToOpenAI(tools);

                const body: any = {
                    model: this.modelName,
                    messages,
                };

                if (openaiTools.length > 0) {
                    body.tools = openaiTools;
                    body.tool_choice = 'auto';
                }

                const response = await fetch(`${this.baseUrl}/chat/completions`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${this.apiKey}`
                    },
                    body: JSON.stringify(body)
                });

                if (!response.ok) {
                    const error = await response.text();
                    throw new Error(`OpenAI API error: ${response.status} ${error}`);
                }

                const data = await response.json();

                const choice = data.choices?.[0];
                const message = choice?.message;

                // Extract function calls
                const functionCalls: Array<{ name: string; args: Record<string, any> }> = [];
                if (message?.tool_calls) {
                    for (const tc of message.tool_calls) {
                        if (tc.type === 'function') {
                            functionCalls.push({
                                name: tc.function.name,
                                args: JSON.parse(tc.function.arguments || '{}')
                            });
                        }
                    }
                }

                return {
                    text: message?.content || '',
                    usageMetadata: data.usage ? {
                        promptTokenCount: data.usage.prompt_tokens || 0,
                        candidatesTokenCount: data.usage.completion_tokens || 0,
                    } : undefined,
                    functionCalls: functionCalls.length > 0 ? functionCalls : undefined
                };
            }
        });
    }

    async sendJsonAnalysis(prompt: string, systemInstruction: string): Promise<string | null> {
        if (!this.isInitialized()) {
            console.warn("[OpenAIProvider] Client not initialized");
            return null;
        }

        // Use global queue
        return aiRequestQueue.enqueue({
            priority: 'NORMAL',
            source: 'polymarketDealer',
            provider: 'openai',
            execute: async () => {
                const response = await fetch(`${this.baseUrl}/chat/completions`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${this.apiKey}`
                    },
                    body: JSON.stringify({
                        model: this.modelName,
                        messages: [
                            { role: 'system', content: systemInstruction },
                            { role: 'user', content: prompt }
                        ],
                        response_format: { type: 'json_object' }
                    })
                });

                if (!response.ok) {
                    const error = await response.text();
                    throw new Error(`OpenAI API error: ${response.status} ${error}`);
                }

                const data = await response.json();
                return data.choices?.[0]?.message?.content || null;
            }
        });
    }

    async sendBatchAnalysis(context: any, strategyPrompt: string, abortSignal?: AbortSignal): Promise<{ decisions: any[], cycleSummary?: string }> {
        if (!this.isInitialized()) {
            throw new Error("OpenAI not initialized. Please set API Key.");
        }

        // Check if already aborted
        if (abortSignal?.aborted) {
            throw new DOMException('Dealer cycle aborted', 'AbortError');
        }

        const dealerSystemInstruction = this.getBatchDealerSystemInstruction();
        const contextMessage = `
            [USER STRATEGY]
            ${strategyPrompt}

            [BATCH MARKET DATA]
            ${JSON.stringify(context)}

            Analyze all assets in the batch. Return a JSON object with decisions array and cycleSummary.
        `;

        // Use global queue
        return aiRequestQueue.enqueue({
            priority: 'NORMAL',
            source: 'hyperliquidDealer',
            provider: 'openai',
            execute: async () => {
                const response = await fetch(`${this.baseUrl}/chat/completions`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${this.apiKey}`
                    },
                    body: JSON.stringify({
                        model: this.modelName,
                        messages: [
                            { role: 'system', content: dealerSystemInstruction },
                            { role: 'user', content: contextMessage }
                        ],
                        response_format: { type: 'json_object' }
                    }),
                    signal: abortSignal
                });

                if (!response.ok) {
                    const error = await response.text();
                    throw new Error(`OpenAI API error: ${response.status} ${error}`);
                }

                const data = await response.json();
                const text = data.choices?.[0]?.message?.content;

                if (!text) throw new Error("Empty response from OpenAI");

                // Check for truncation or failure
                if (data.choices?.[0]?.finish_reason === 'length') {
                    throw new Error("Response truncated by length limit");
                }

                let parsed;
                try {
                    parsed = JSON.parse(text);
                } catch (e: any) {
                    throw new Error(`Failed to parse JSON response: ${e.message}`);
                }

                return this.normalizeDecisions(parsed);
            }
        });
    }

    private normalizeDecisions(parsed: any): { decisions: any[], cycleSummary?: string } {
        let decisions: any[] = [];
        let cycleSummary: string | undefined;

        // Handle wrapped response: { decisions: [...], cycleSummary: "..." }
        if (typeof parsed === 'object' && parsed.decisions) {
            decisions = parsed.decisions;
            if (parsed.cycleSummary && typeof parsed.cycleSummary === 'string') {
                cycleSummary = parsed.cycleSummary.slice(0, 350);
            }
        } else if (Array.isArray(parsed)) {
            decisions = parsed;
        } else if (typeof parsed === 'object') {
            decisions = [parsed];
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

            RESPONSE FORMAT:
            You MUST return a JSON object with a "decisions" array:
            {
                "decisions": [
                    {
                        "coin": "BTC",
                        "action": "BUY" | "SELL" | "HOLD" | "CLOSE",
                        "confidence": 0.0 to 1.0,
                        "reason": "Format: [ACTION] Position Status + Explanation. See REASONING FORMAT below.",
                        "suggestedLeverage": 1-50,
                        "sizeUSDC": number,
                        "orderType": "limit" | "market",
                        "price": number (optional),
                        "stopLoss": number (optional, ONLY for BUY/SELL actions),
                        "takeProfit": number (optional, ONLY for BUY/SELL actions)
                    }
                ]
            }

            CRITICAL RULES:
            1. Return valid JSON with "decisions" array.
            2. One decision per coin provided.
            3. CHECK PORTFOLIO LIMITS: Do not suggest BUY if maxPositions is reached.
            4. LEVERAGE CONSTRAINT: suggestedLeverage MUST NOT exceed portfolio.settings.maxLeverage.
            5. Consider trading costs before recommending trades.
            
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
              - HOLD: "WAIT: No position. RSI neutral, waiting for signal."
              - BUY: "LONG: No position. RSI divergence. Entry: $95000, SL: $93100, TP: $98800"
              - CLOSE: "CLOSE: In LONG at $95000, PnL: +$150. Take profit reached."
        `;
    }
}
