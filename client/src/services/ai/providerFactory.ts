// services/ai/providerFactory.ts
// Factory for creating and managing AI provider instances

import { AIProviderType, AIComponentType, IAIProvider, PROVIDER_MODELS } from './aiTypes';
import { GeminiProvider } from './geminiProvider';
import { OpenAIProvider } from './openaiProvider';
import { ClaudeProvider } from './claudeProvider';
import { aiConfigStore } from '../../state/aiConfigStore';

class AIProviderFactory {
    private providers: Map<AIProviderType, IAIProvider> = new Map();

    constructor() {
        // Pre-create provider instances
        this.providers.set('gemini', new GeminiProvider());
        this.providers.set('openai', new OpenAIProvider());
        this.providers.set('claude', new ClaudeProvider());

        // Initialize from stored config
        this.initializeFromConfig();

        // Subscribe to config changes
        aiConfigStore.subscribe(() => {
            this.initializeFromConfig();
        });
    }

    /**
     * Initialize providers from stored configuration
     */
    private initializeFromConfig() {
        const config = aiConfigStore.getSnapshot();

        for (const [providerType, credential] of Object.entries(config.credentials)) {
            if (credential.isConfigured && credential.apiKey) {
                this.initializeProvider(providerType as AIProviderType, credential.apiKey);
            }
        }

        // Set models for each component
        for (const [component, compConfig] of Object.entries(config.componentConfigs)) {
            const provider = this.getProvider(compConfig.providerType);
            if (provider && 'setModel' in provider) {
                (provider as any).setModel(compConfig.modelId);
            }
        }
    }

    /**
     * Get a provider instance by type
     */
    public getProvider(type: AIProviderType): IAIProvider | null {
        return this.providers.get(type) || null;
    }

    /**
     * Initialize a specific provider with API key
     */
    public initializeProvider(type: AIProviderType, apiKey: string): void {
        const provider = this.providers.get(type);
        if (provider) {
            provider.initialize(apiKey);
            console.log(`[ProviderFactory] Initialized ${type} provider`);
        }
    }

    /**
     * Get the provider configured for a specific component
     */
    public getProviderForComponent(component: AIComponentType): IAIProvider | null {
        const config = aiConfigStore.getSnapshot();
        const compConfig = config.componentConfigs[component];

        if (!compConfig) {
            console.warn(`[ProviderFactory] No config found for component: ${component}`);
            return null;
        }

        const provider = this.providers.get(compConfig.providerType);

        if (!provider) {
            console.warn(`[ProviderFactory] Provider ${compConfig.providerType} not found`);
            return null;
        }

        if (!provider.isInitialized()) {
            // Try to initialize from config
            const apiKey = aiConfigStore.getApiKey(compConfig.providerType);
            if (apiKey) {
                provider.initialize(apiKey);
            } else {
                console.warn(`[ProviderFactory] Provider ${compConfig.providerType} not initialized (no API key)`);
                return null;
            }
        }

        // Set the model for this provider
        if ('setModel' in provider) {
            (provider as any).setModel(compConfig.modelId);
        }

        return provider;
    }

    /**
     * Get the model ID configured for a specific component
     */
    public getModelForComponent(component: AIComponentType): string {
        const config = aiConfigStore.getSnapshot();
        return config.componentConfigs[component]?.modelId || '';
    }

    /**
     * Check if a component has a valid AI configuration
     */
    public isComponentReady(component: AIComponentType): boolean {
        const provider = this.getProviderForComponent(component);
        return provider !== null && provider.isInitialized();
    }

    /**
     * Get all available providers (for UI)
     */
    public getAvailableProviders(): AIProviderType[] {
        return Array.from(this.providers.keys());
    }

    /**
     * Get models for a specific provider (for UI)
     */
    public getModelsForProvider(providerType: AIProviderType) {
        return PROVIDER_MODELS[providerType] || [];
    }

    /**
     * Validate that all required providers are configured
     */
    public validateConfiguration(): { valid: boolean; missing: AIComponentType[] } {
        const missing: AIComponentType[] = [];
        const components: AIComponentType[] = ['operator', 'hyperliquidDealer', 'polymarketDealer'];

        for (const component of components) {
            if (!this.isComponentReady(component)) {
                missing.push(component);
            }
        }

        return { valid: missing.length === 0, missing };
    }
}

// Singleton instance
export const providerFactory = new AIProviderFactory();
