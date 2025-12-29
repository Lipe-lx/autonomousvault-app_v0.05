// ADAPTER
// Gemini AI Provider Implementation
// Extracted from v0.03 services/ai/geminiProvider.ts
//
// NOTE: This file requires @google/genai package

import type { IAIProvider, AIResponse, AIProviderType, AgentMessage, BatchAnalysisResult } from '../types';
import { aiRequestQueue } from '../request-queue';

// @google/genai types (declared for compilation without import)
declare const GoogleGenAI: any;

/**
 * Gemini Provider Implementation
 */
export class GeminiProvider implements IAIProvider {
    readonly providerType: AIProviderType = 'gemini';
    private client: any = null;
    private modelName: string = 'gemini-2.5-flash';

    isInitialized(): boolean {
        return this.client !== null;
    }

    initialize(apiKey: string): void {
        // In actual implementation: this.client = new GoogleGenAI({ apiKey });
        this.client = { apiKey }; // Stub for now
    }

    setModel(model: string): void {
        this.modelName = model;
    }

    getModel(): string {
        return this.modelName;
    }

    async sendMessage(
        history: AgentMessage[],
        newMessage: string,
        systemInstruction: string,
        tools?: any[]
    ): Promise<AIResponse> {
        if (!this.client) throw new Error("Gemini not initialized. Please set API Key.");

        return aiRequestQueue.enqueue({
            priority: 'HIGH',
            source: 'operator',
            provider: 'gemini',
            execute: async () => {
                // Actual implementation would use GoogleGenAI SDK
                throw new Error('[STUB] GeminiProvider.sendMessage not fully implemented');
            }
        });
    }

    async sendJsonAnalysis(prompt: string, systemInstruction: string): Promise<string | null> {
        if (!this.client) {
            console.warn("[GeminiProvider] Client not initialized");
            return null;
        }

        return aiRequestQueue.enqueue({
            priority: 'NORMAL',
            source: 'polymarketDealer',
            provider: 'gemini',
            execute: async () => {
                // Actual implementation would use GoogleGenAI SDK
                throw new Error('[STUB] GeminiProvider.sendJsonAnalysis not fully implemented');
            }
        });
    }

    async sendBatchAnalysis(
        context: any,
        strategyPrompt: string,
        abortSignal?: AbortSignal
    ): Promise<BatchAnalysisResult> {
        if (!this.client) {
            throw new Error("Gemini not initialized. Please set API Key.");
        }

        if (abortSignal?.aborted) {
            throw new DOMException('Dealer cycle aborted', 'AbortError');
        }

        const systemInstruction = this.getBatchDealerSystemInstruction();

        return aiRequestQueue.enqueue({
            priority: 'NORMAL',
            source: 'hyperliquidDealer',
            provider: 'gemini',
            execute: async () => {
                // Check abort before request
                if (abortSignal?.aborted) {
                    throw new DOMException('Dealer cycle aborted', 'AbortError');
                }

                // Actual implementation would:
                // 1. Create chat with systemInstruction
                // 2. Send context as message
                // 3. Parse JSON response
                // 4. Return normalized decisions

                throw new Error('[STUB] GeminiProvider.sendBatchAnalysis not fully implemented');
            }
        });
    }

    /**
     * System instruction for batch dealer analysis
     */
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
    `;
    }
}

/**
 * Factory function
 */
export function createGeminiProvider(): GeminiProvider {
    return new GeminiProvider();
}
