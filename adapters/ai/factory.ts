// ADAPTER
// AI Provider Factory
// Creates appropriate provider based on type

import type { IAIProvider, AIProviderType, PROVIDER_MODELS, PROVIDER_INFO } from './types';
import { GeminiProvider } from './providers/gemini';
import { ClaudeProvider } from './providers/claude';
import { OpenAIProvider } from './providers/openai';

/**
 * Create a provider instance by type
 */
export function createProvider(type: AIProviderType): IAIProvider {
    switch (type) {
        case 'gemini':
            return new GeminiProvider();
        case 'claude':
            return new ClaudeProvider();
        case 'openai':
            return new OpenAIProvider();
        default:
            throw new Error(`Unknown provider type: ${type}`);
    }
}

/**
 * Get available providers
 */
export function getAvailableProviders(): AIProviderType[] {
    return ['gemini', 'openai', 'claude'];
}

/**
 * Get default model for a provider
 */
export function getDefaultModel(provider: AIProviderType): string {
    const defaults: Record<AIProviderType, string> = {
        gemini: 'gemini-2.5-flash',
        openai: 'gpt-4o-mini',
        claude: 'claude-sonnet-4-20250514'
    };
    return defaults[provider];
}

/**
 * Provider configuration for storage
 */
export interface ProviderConfig {
    provider: AIProviderType;
    apiKey: string;
    model: string;
}

/**
 * Initialize a provider with config
 */
export function initializeProvider(config: ProviderConfig): IAIProvider {
    const provider = createProvider(config.provider);
    provider.initialize(config.apiKey);
    provider.setModel(config.model);
    return provider;
}
