// ADAPTER
// AI Provider Types and Interfaces
// Extracted from v0.03 services/ai/aiTypes.ts

/**
 * Supported AI provider types
 */
export type AIProviderType = 'gemini' | 'openai' | 'claude';

/**
 * Component types that use AI
 */
export type AIComponentType = 'operator' | 'hyperliquidDealer' | 'polymarketDealer';

/**
 * Model information with pricing
 */
export interface ModelInfo {
    id: string;
    name: string;
    description: string;
    inputPricePerMillion: number;
    outputPricePerMillion: number;
}

/**
 * Provider model catalogs
 */
export const PROVIDER_MODELS: Record<AIProviderType, ModelInfo[]> = {
    gemini: [
        { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash Preview', description: 'Next generation (Preview)', inputPricePerMillion: 0.10, outputPricePerMillion: 0.40 },
        { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', description: 'Fast & balanced', inputPricePerMillion: 0.15, outputPricePerMillion: 0.60 },
        { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', description: 'Most capable', inputPricePerMillion: 1.25, outputPricePerMillion: 10.00 },
        { id: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash-Lite', description: 'Lightweight', inputPricePerMillion: 0.075, outputPricePerMillion: 0.30 },
        { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', description: 'Stable', inputPricePerMillion: 0.10, outputPricePerMillion: 0.40 },
    ],
    openai: [
        { id: 'gpt-4o', name: 'GPT-4o', description: 'Most capable', inputPricePerMillion: 2.50, outputPricePerMillion: 10.00 },
        { id: 'gpt-4o-mini', name: 'GPT-4o Mini', description: 'Fast & affordable', inputPricePerMillion: 0.15, outputPricePerMillion: 0.60 },
        { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', description: 'Stable', inputPricePerMillion: 10.00, outputPricePerMillion: 30.00 },
        { id: 'o1-mini', name: 'o1-mini', description: 'Reasoning model', inputPricePerMillion: 3.00, outputPricePerMillion: 12.00 },
    ],
    claude: [
        { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', description: 'Latest & fastest', inputPricePerMillion: 3.00, outputPricePerMillion: 15.00 },
        { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', description: 'Previous gen', inputPricePerMillion: 3.00, outputPricePerMillion: 15.00 },
        { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus', description: 'Most capable', inputPricePerMillion: 15.00, outputPricePerMillion: 75.00 },
        { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku', description: 'Economy', inputPricePerMillion: 0.25, outputPricePerMillion: 1.25 },
    ],
};

/**
 * Provider metadata
 */
export const PROVIDER_INFO: Record<AIProviderType, { name: string; icon: string; color: string; keyUrl: string }> = {
    gemini: { name: 'Google Gemini', icon: '✨', color: '#4285F4', keyUrl: 'https://aistudio.google.com/apikey' },
    openai: { name: 'OpenAI', icon: '🤖', color: '#10A37F', keyUrl: 'https://platform.openai.com/api-keys' },
    claude: { name: 'Anthropic Claude', icon: '🧠', color: '#D97757', keyUrl: 'https://console.anthropic.com/settings/keys' },
};

/**
 * AI response format
 */
export interface AIResponse {
    text: string;
    usageMetadata?: {
        promptTokenCount: number;
        candidatesTokenCount: number;
    };
    functionCalls?: Array<{
        name: string;
        args: Record<string, any>;
    }>;
}

/**
 * Rate limiter configuration
 */
export interface RateLimiterConfig {
    minIntervalMs: number;
    maxRetries: number;
    baseBackoffMs: number;
}

/**
 * Queue configuration (extended)
 */
export interface QueueConfig extends RateLimiterConfig {
    maxBackoffMs: number;
    jitterMs: number;
}

/**
 * Provider rate limits
 */
export const PROVIDER_RATE_LIMITS: Record<AIProviderType, RateLimiterConfig> = {
    gemini: { minIntervalMs: 5000, maxRetries: 5, baseBackoffMs: 5000 },
    openai: { minIntervalMs: 500, maxRetries: 3, baseBackoffMs: 1000 },
    claude: { minIntervalMs: 500, maxRetries: 3, baseBackoffMs: 1000 },
};

/**
 * Extended queue configs
 */
export const PROVIDER_QUEUE_CONFIGS: Record<AIProviderType, QueueConfig> = {
    gemini: { minIntervalMs: 5000, maxRetries: 5, baseBackoffMs: 5000, maxBackoffMs: 120000, jitterMs: 1000 },
    openai: { minIntervalMs: 500, maxRetries: 3, baseBackoffMs: 1000, maxBackoffMs: 30000, jitterMs: 500 },
    claude: { minIntervalMs: 500, maxRetries: 3, baseBackoffMs: 1000, maxBackoffMs: 30000, jitterMs: 500 },
};

/**
 * Message format for chat history
 */
export interface AgentMessage {
    role: 'user' | 'model';
    content: string;
    timestamp?: number;
}

/**
 * Batch analysis result
 */
export interface BatchAnalysisResult {
    decisions: any[];
    cycleSummary?: string;
    chosenPreset?: string;
    presetReason?: string;
}

/**
 * AI Provider Interface
 */
export interface IAIProvider {
    readonly providerType: AIProviderType;

    // Initialization
    isInitialized(): boolean;
    initialize(apiKey: string): void;
    setModel(model: string): void;
    getModel(): string;

    // Chat with function calling (for Operator)
    sendMessage(
        history: AgentMessage[],
        newMessage: string,
        systemInstruction: string,
        tools?: any[]
    ): Promise<AIResponse>;

    // JSON analysis (for Dealers)
    sendJsonAnalysis(
        prompt: string,
        systemInstruction: string
    ): Promise<string | null>;

    // Batch analysis for Hyperliquid Dealer
    sendBatchAnalysis(
        context: any,
        strategyPrompt: string,
        abortSignal?: AbortSignal
    ): Promise<BatchAnalysisResult>;
}
