// ADAPTER
// AI adapter interface - boundary between core and AI providers
// Defines how AI analysis is abstracted (Gemini, OpenAI, Claude, etc.)

import type { BatchAnalysisContext, AnalysisResponse } from '../core/types';

/**
 * AI message role
 */
export type MessageRole = 'user' | 'model' | 'system';

/**
 * AI message
 */
export interface AIMessage {
    role: MessageRole;
    content: string;
}

/**
 * AI adapter interface
 * 
 * Implementors:
 * - GeminiAIAdapter
 * - OpenAIAdapter
 * - ClaudeAdapter
 * - SupabaseEdgeAIAdapter (Edge Function proxy)
 */
export interface AIAdapter {
    /**
     * Initialize the adapter with API key
     * @param apiKey - Provider API key
     */
    initialize(apiKey: string): void;

    /**
     * Check if adapter is ready
     */
    isReady(): boolean;

    /**
     * Get batch dealer analysis
     * @param context - Market context for all coins
     * @param strategyPrompt - User's strategy prompt
     * @param abortSignal - Optional abort signal
     */
    getBatchAnalysis(
        context: BatchAnalysisContext,
        strategyPrompt: string,
        abortSignal?: AbortSignal
    ): Promise<AnalysisResponse>;

    /**
     * Send a general message (for agent/chat use)
     * @param history - Message history
     * @param newMessage - New user message
     * @param systemInstruction - System prompt
     */
    sendMessage(
        history: AIMessage[],
        newMessage: string,
        systemInstruction: string
    ): Promise<string>;

    /**
     * Get current model name
     */
    getModel(): string;

    /**
     * Set model to use
     * @param model - Model identifier
     */
    setModel(model: string): void;
}

/**
 * AI provider types
 */
export type AIProviderType = 'gemini' | 'openai' | 'claude' | 'anthropic';

/**
 * AI provider configuration
 */
export interface AIProviderConfig {
    provider: AIProviderType;
    apiKey: string;
    model: string;
    maxTokens?: number;
    temperature?: number;
}

/**
 * Factory for creating AI adapters
 */
export interface AIAdapterFactory {
    /**
     * Create an AI adapter for the given provider
     */
    create(config: AIProviderConfig): AIAdapter;

    /**
     * Get available providers
     */
    getAvailableProviders(): AIProviderType[];

    /**
     * Get available models for a provider
     */
    getModelsForProvider(provider: AIProviderType): string[];
}
