// src/state/aiConfigStore.ts
// State management for AI provider configurations and component assignments

import { AIProviderType, AIComponentType, PROVIDER_MODELS } from 'adapters/ai/types';
import { StorageService } from '../services/storageService';

// ============================================
// Types
// ============================================

export interface AIProviderCredential {
    providerType: AIProviderType;
    apiKey: string;
    isConfigured: boolean;
}

export interface ComponentModelConfig {
    providerType: AIProviderType;
    modelId: string;
}

export interface AIConfigState {
    credentials: Record<AIProviderType, AIProviderCredential>;
    componentConfigs: Record<AIComponentType, ComponentModelConfig>;
}

// ============================================
// Default Values
// ============================================

const DEFAULT_CREDENTIALS: Record<AIProviderType, AIProviderCredential> = {
    gemini: { providerType: 'gemini', apiKey: '', isConfigured: false },
    openai: { providerType: 'openai', apiKey: '', isConfigured: false },
    claude: { providerType: 'claude', apiKey: '', isConfigured: false },
};

const DEFAULT_COMPONENT_CONFIGS: Record<AIComponentType, ComponentModelConfig> = {
    operator: { providerType: 'gemini', modelId: 'gemini-2.5-flash' },
    hyperliquidDealer: { providerType: 'gemini', modelId: 'gemini-2.5-flash' },
    polymarketDealer: { providerType: 'gemini', modelId: 'gemini-2.5-flash' },
};

const INITIAL_STATE: AIConfigState = {
    credentials: DEFAULT_CREDENTIALS,
    componentConfigs: DEFAULT_COMPONENT_CONFIGS,
};

const STORAGE_KEY = 'ai_config_store';

// ============================================
// Store Implementation
// ============================================

class AIConfigStore {
    private state: AIConfigState;
    private listeners: Set<() => void>;
    private isInitialized: boolean = false;
    private initPromise: Promise<void> | null = null;

    constructor() {
        this.state = INITIAL_STATE;
        this.listeners = new Set();
        // Start async initialization
        this.initPromise = this.initialize();
    }

    async initialize(): Promise<void> {
        if (this.isInitialized) return;

        // If no userId is set yet, just mark as initialized but don't load
        // The reload() function will be called after auth sets the userId
        if (!StorageService.getUserId()) {
            console.log('[AIConfigStore] No user context yet, skipping initial load');
            this.isInitialized = true;
            return;
        }

        await this.loadFromStorage();
        this.isInitialized = true;
        this.notifyListeners();
    }

    /**
     * Reload state from storage. Should be called after userId is set.
     */
    async reload(): Promise<void> {
        console.log('[AIConfigStore] Reloading from storage...');
        await this.loadFromStorage();
        this.notifyListeners();
    }

    /**
     * Reset state to initial values. Should be called on account deletion.
     */
    reset(): void {
        console.log('[AIConfigStore] Resetting to initial state...');
        this.state = { ...INITIAL_STATE };
        this.notifyListeners();
    }

    private async loadFromStorage(): Promise<void> {
        try {
            const saved = await StorageService.getItem(StorageService.getUserKey(STORAGE_KEY));
            if (saved) {
                const parsed = JSON.parse(saved);

                this.state = {
                    ...INITIAL_STATE,
                    ...parsed,
                    credentials: {
                        ...DEFAULT_CREDENTIALS,
                        ...parsed.credentials
                    },
                    componentConfigs: {
                        ...DEFAULT_COMPONENT_CONFIGS,
                        ...parsed.componentConfigs
                    }
                };
                console.log('[AIConfigStore] Loaded credentials from storage');
            }
        } catch (e) {
            console.error('Failed to load AI config state:', e);
        }
    }

    async waitForInit(): Promise<void> {
        if (this.initPromise) {
            await this.initPromise;
        }
    }

    private async saveState(): Promise<void> {
        try {
            await StorageService.setItem(
                StorageService.getUserKey(STORAGE_KEY),
                JSON.stringify(this.state)
            );
        } catch (e) {
            console.error('Failed to save AI config state:', e);
        }
    }

    private notifyListeners() {
        this.listeners.forEach(listener => listener());
    }

    private notify() {
        this.notifyListeners();
        this.saveState(); // Fire and forget - no await needed
    }

    // ============================================
    // Public API
    // ============================================

    public subscribe(listener: () => void) {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    public getSnapshot(): AIConfigState {
        return this.state;
    }

    // --- Credentials Management ---

    public setApiKey(providerType: AIProviderType, apiKey: string) {
        this.state = {
            ...this.state,
            credentials: {
                ...this.state.credentials,
                [providerType]: {
                    providerType,
                    apiKey,
                    isConfigured: apiKey.trim().length > 0
                }
            }
        };
        this.notify();
    }

    public getApiKey(providerType: AIProviderType): string {
        return this.state.credentials[providerType].apiKey;
    }

    public clearApiKey(providerType: AIProviderType) {
        this.setApiKey(providerType, '');
    }

    public isProviderConfigured(providerType: AIProviderType): boolean {
        return this.state.credentials[providerType].isConfigured;
    }

    public getConfiguredProviders(): AIProviderType[] {
        return Object.entries(this.state.credentials)
            .filter(([_, cred]) => cred.isConfigured)
            .map(([type, _]) => type as AIProviderType);
    }

    // --- Component Configuration ---

    public setComponentConfig(component: AIComponentType, config: ComponentModelConfig) {
        // Validate that the provider is configured
        if (!this.state.credentials[config.providerType].isConfigured) {
            console.warn(`Cannot set ${component} to use ${config.providerType}: API key not configured`);
            return false;
        }

        // Validate that the model exists for the provider
        const models = PROVIDER_MODELS[config.providerType];
        if (!models.find(m => m.id === config.modelId)) {
            console.warn(`Invalid model ${config.modelId} for provider ${config.providerType}`);
            return false;
        }

        this.state = {
            ...this.state,
            componentConfigs: {
                ...this.state.componentConfigs,
                [component]: config
            }
        };
        this.notify();
        return true;
    }

    public getComponentConfig(component: AIComponentType): ComponentModelConfig {
        return this.state.componentConfigs[component];
    }

    public getComponentProvider(component: AIComponentType): AIProviderType {
        return this.state.componentConfigs[component].providerType;
    }

    public getComponentModel(component: AIComponentType): string {
        return this.state.componentConfigs[component].modelId;
    }

    public getComponentApiKey(component: AIComponentType): string {
        const provider = this.getComponentProvider(component);
        return this.getApiKey(provider);
    }

    // --- Validation ---

    public isComponentConfigValid(component: AIComponentType): boolean {
        const config = this.state.componentConfigs[component];
        return this.state.credentials[config.providerType].isConfigured;
    }

    public getInvalidComponents(): AIComponentType[] {
        return (Object.keys(this.state.componentConfigs) as AIComponentType[])
            .filter(component => !this.isComponentConfigValid(component));
    }
}

export const aiConfigStore = new AIConfigStore();
