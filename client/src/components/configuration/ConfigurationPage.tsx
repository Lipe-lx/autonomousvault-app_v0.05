import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Cpu, Activity, Key, Eye, EyeOff, Check, AlertCircle, MessageSquare, TrendingUp, Target, ExternalLink, ChevronDown, Globe, User } from 'lucide-react';
import { aiConfigStore, ComponentModelConfig } from '../../state/aiConfigStore';
import { AIProviderType, AIComponentType, PROVIDER_MODELS, PROVIDER_INFO } from '../../services/ai/aiTypes';
import { VaultState } from '../../types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { cn } from '@/lib/utils';
import { UserSettingsPage } from './UserSettingsPage';

interface ConfigurationPageProps {
    vault: VaultState;
    password: string;
    addNotification: (msg: string) => void;
    activeTab: 'providers' | 'user';
    setActiveTab: (tab: 'providers' | 'user') => void;
}

// Component info for display
const COMPONENT_INFO: Record<AIComponentType, { name: string; shortName: string; icon: React.ReactNode; description: string; color: string }> = {
    operator: {
        name: 'Chat Operator',
        shortName: 'Operator',
        icon: <MessageSquare size={14} />,
        description: 'Chat assistant',
        color: '#9b87f5'
    },
    hyperliquidDealer: {
        name: 'Hyperliquid Dealer',
        shortName: 'Hyperliquid Dealer',
        icon: <TrendingUp size={14} />,
        description: 'Perp trading',
        color: '#E7FE55'
    },
    polymarketDealer: {
        name: 'Polymarket Dealer',
        shortName: 'Polymarket Dealer',
        icon: <Target size={14} />,
        description: 'Predictions',
        color: '#22d3ee'
    }
};

export const ConfigurationPage: React.FC<ConfigurationPageProps> = ({ vault, password, addNotification, activeTab, setActiveTab }) => {
    // Config tab state managed by parent App.tsx now


    // Provider tab state
    const [activeProviderTab, setActiveProviderTab] = useState<AIProviderType>('gemini');

    // API Keys per provider
    const [apiKeys, setApiKeys] = useState<Record<AIProviderType, string>>({
        gemini: '',
        openai: '',
        claude: ''
    });
    const [showApiKey, setShowApiKey] = useState<Record<AIProviderType, boolean>>({
        gemini: false,
        openai: false,
        claude: false
    });
    const [keyStatus, setKeyStatus] = useState<Record<AIProviderType, 'empty' | 'saved' | 'modified'>>({
        gemini: 'empty',
        openai: 'empty',
        claude: 'empty'
    });

    // Component configs
    const [componentConfigs, setComponentConfigs] = useState<Record<AIComponentType, ComponentModelConfig>>({
        operator: { providerType: 'gemini', modelId: 'gemini-2.5-flash' },
        hyperliquidDealer: { providerType: 'gemini', modelId: 'gemini-2.5-flash' },
        polymarketDealer: { providerType: 'gemini', modelId: 'gemini-2.5-flash' }
    });

    // Network states
    const [solanaNetwork, setSolanaNetwork] = useState<'devnet' | 'mainnet'>('devnet');
    const [hyperliquidNetwork, setHyperliquidNetwork] = useState<'testnet' | 'mainnet'>('testnet');

    // Collapsible sections
    const [showNetworks, setShowNetworks] = useState(false);

    // Load saved config on mount
    useEffect(() => {
        const config = aiConfigStore.getSnapshot();

        // Load API keys
        const loadedKeys: Record<AIProviderType, string> = { gemini: '', openai: '', claude: '' };
        const loadedStatus: Record<AIProviderType, 'empty' | 'saved' | 'modified'> = { gemini: 'empty', openai: 'empty', claude: 'empty' };

        for (const provider of ['gemini', 'openai', 'claude'] as AIProviderType[]) {
            const key = aiConfigStore.getApiKey(provider);
            loadedKeys[provider] = key;
            loadedStatus[provider] = key ? 'saved' : 'empty';
        }

        setApiKeys(loadedKeys);
        setKeyStatus(loadedStatus);
        setComponentConfigs(config.componentConfigs);

        // Subscribe to config changes
        const unsubscribe = aiConfigStore.subscribe(() => {
            const newConfig = aiConfigStore.getSnapshot();
            setComponentConfigs(newConfig.componentConfigs);
        });

        return () => { unsubscribe(); };
    }, []);

    // Handle API key operations
    const handleApiKeyChange = (provider: AIProviderType, value: string) => {
        setApiKeys(prev => ({ ...prev, [provider]: value }));
        const savedKey = aiConfigStore.getApiKey(provider);
        setKeyStatus(prev => ({
            ...prev,
            [provider]: value === '' ? 'empty' : value !== savedKey ? 'modified' : 'saved'
        }));
    };

    const handleSaveApiKey = (provider: AIProviderType) => {
        const key = apiKeys[provider].trim();
        if (key) {
            aiConfigStore.setApiKey(provider, key);
            setKeyStatus(prev => ({ ...prev, [provider]: 'saved' }));
            addNotification(`${PROVIDER_INFO[provider].name} API Key saved!`);
        }
    };

    const handleClearApiKey = (provider: AIProviderType) => {
        aiConfigStore.clearApiKey(provider);
        setApiKeys(prev => ({ ...prev, [provider]: '' }));
        setKeyStatus(prev => ({ ...prev, [provider]: 'empty' }));
        addNotification(`${PROVIDER_INFO[provider].name} API Key cleared`);
    };

    // Handle component config changes
    const handleProviderChange = (component: AIComponentType, provider: AIProviderType) => {
        const models = PROVIDER_MODELS[provider];
        const defaultModel = models[0]?.id || '';

        const newConfig: ComponentModelConfig = {
            providerType: provider,
            modelId: defaultModel
        };

        // Only update if provider is configured
        if (aiConfigStore.isProviderConfigured(provider)) {
            aiConfigStore.setComponentConfig(component, newConfig);
            addNotification(`${COMPONENT_INFO[component].name} now using ${PROVIDER_INFO[provider].name}`);
        } else {
            addNotification(`Please configure ${PROVIDER_INFO[provider].name} API key first`);
        }
    };

    const handleModelChange = (component: AIComponentType, modelId: string) => {
        const currentConfig = componentConfigs[component];
        const newConfig: ComponentModelConfig = {
            ...currentConfig,
            modelId
        };

        aiConfigStore.setComponentConfig(component, newConfig);
        const modelInfo = PROVIDER_MODELS[currentConfig.providerType].find(m => m.id === modelId);
        addNotification(`${COMPONENT_INFO[component].name} model changed to ${modelInfo?.name || modelId}`);
    };

    const getConfiguredProviders = (): AIProviderType[] => {
        return aiConfigStore.getConfiguredProviders();
    };

    return (
        <motion.div
            className="h-full flex flex-col gap-4 overflow-y-auto custom-scrollbar pb-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
        >
            {/* Conditional Content */}
            {activeTab === 'user' ? (
                <UserSettingsPage addNotification={addNotification} password={password} />
            ) : (
                <>
                    {/* AI Providers Section */}
                    <div className="glass-panel p-5 rounded">
                        {/* Header */}
                        <div className="flex items-center gap-2 mb-4">
                            <Cpu className="h-4 w-4 text-[#E7FE55]" />
                            <span className="text-sm font-semibold text-white">AI Providers</span>
                            {/* Provider status dots */}
                            <div className="flex items-center gap-1.5 ml-auto">
                                {(['gemini', 'openai', 'claude'] as AIProviderType[]).map((provider) => (
                                    <div
                                        key={provider}
                                        className={cn(
                                            "w-2 h-2 rounded-full transition-all",
                                            keyStatus[provider] === 'saved' ? "bg-[#34d399]" : "bg-[#3a3b42]"
                                        )}
                                        title={`${PROVIDER_INFO[provider].name}: ${keyStatus[provider] === 'saved' ? 'Configured' : 'Not configured'}`}
                                    />
                                ))}
                            </div>
                        </div>

                        {/* Provider Tabs */}
                        <div className="flex bg-[#14151a] rounded-lg p-1 border border-[#232328] mb-4">
                            {(['gemini', 'openai', 'claude'] as AIProviderType[]).map((provider) => {
                                const info = PROVIDER_INFO[provider];
                                const isActive = activeProviderTab === provider;
                                const isConfigured = keyStatus[provider] === 'saved';
                                return (
                                    <button
                                        key={provider}
                                        onClick={() => setActiveProviderTab(provider)}
                                        className={cn(
                                            "flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-xs font-medium transition-all",
                                            isActive
                                                ? "bg-[#1a1b21] text-white"
                                                : "text-[#747580] hover:text-[#a0a1a8]"
                                        )}
                                    >
                                        <span>{info.icon}</span>
                                        <span>{info.name.split(' ')[0]}</span>
                                        {isConfigured && (
                                            <span className="relative flex h-2 w-2">
                                                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#34d399]" />
                                            </span>
                                        )}
                                    </button>
                                );
                            })}
                        </div>

                        {/* Active Provider Config */}
                        <div className="space-y-3">
                            <div className="flex items-center gap-2">
                                <Key size={14} className="text-[#747580]" />
                                <span className="text-[10px] text-[#747580] uppercase tracking-[0.1em]">
                                    {PROVIDER_INFO[activeProviderTab].name} API Key
                                </span>
                                {keyStatus[activeProviderTab] === 'saved' && (
                                    <span className="px-2 py-0.5 rounded bg-[#34d399]/15 text-[#34d399] text-[9px] font-semibold uppercase tracking-wider flex items-center gap-1">
                                        <Check size={10} /> Saved
                                    </span>
                                )}
                                {keyStatus[activeProviderTab] === 'modified' && (
                                    <span className="px-2 py-0.5 rounded bg-amber-500/15 text-amber-400 text-[9px] font-semibold uppercase tracking-wider flex items-center gap-1">
                                        <AlertCircle size={10} /> Unsaved
                                    </span>
                                )}
                            </div>

                            <div className="flex gap-2">
                                <div className="relative flex-1">
                                    <input
                                        type={showApiKey[activeProviderTab] ? 'text' : 'password'}
                                        value={apiKeys[activeProviderTab]}
                                        onChange={(e) => handleApiKeyChange(activeProviderTab, e.target.value)}
                                        placeholder={`Enter ${PROVIDER_INFO[activeProviderTab].name} key...`}
                                        className="w-full h-9 px-3 pr-9 text-xs font-mono bg-[#0f1015] border border-[#232328] rounded text-white placeholder:text-[#3a3b42] focus:outline-none focus:border-[#E7FE55]/30 transition-colors"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowApiKey(prev => ({ ...prev, [activeProviderTab]: !prev[activeProviderTab] }))}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[#747580] hover:text-white transition-colors"
                                    >
                                        {showApiKey[activeProviderTab] ? <EyeOff size={14} /> : <Eye size={14} />}
                                    </button>
                                </div>
                                <button
                                    onClick={() => handleSaveApiKey(activeProviderTab)}
                                    disabled={keyStatus[activeProviderTab] !== 'modified'}
                                    className={cn(
                                        "h-9 px-4 rounded text-xs font-semibold transition-all",
                                        keyStatus[activeProviderTab] === 'modified'
                                            ? "bg-[#E7FE55] text-black hover:bg-[#E7FE55]/90"
                                            : "bg-[#232328] text-[#3a3b42] cursor-not-allowed"
                                    )}
                                >
                                    Save
                                </button>
                            </div>

                            <div className="flex items-center justify-between">
                                {apiKeys[activeProviderTab] && (
                                    <button
                                        onClick={() => handleClearApiKey(activeProviderTab)}
                                        className="text-[10px] text-red-400/70 hover:text-red-400 transition-colors"
                                    >
                                        Clear key
                                    </button>
                                )}
                                <a
                                    href={PROVIDER_INFO[activeProviderTab].keyUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-[10px] text-[#E7FE55]/60 hover:text-[#E7FE55] transition-colors flex items-center gap-1 ml-auto"
                                >
                                    Get API key <ExternalLink size={10} />
                                </a>
                            </div>
                        </div>
                    </div>

                    {/* Component Model Assignment */}
                    <div className="glass-panel p-5 rounded">
                        {/* Header */}
                        <div className="flex items-center gap-2 mb-4">
                            <Activity className="h-4 w-4 text-[#E7FE55]" />
                            <span className="text-sm font-semibold text-white">Component Models</span>
                        </div>

                        {/* Component Cards - Horizontal Grid */}
                        <div className="grid grid-cols-3 gap-3">
                            {(['operator', 'hyperliquidDealer', 'polymarketDealer'] as AIComponentType[]).map((component) => {
                                const info = COMPONENT_INFO[component];
                                const config = componentConfigs[component];
                                const availableModels = PROVIDER_MODELS[config.providerType];
                                const configuredProviders = getConfiguredProviders();
                                const isReady = configuredProviders.includes(config.providerType);

                                return (
                                    <div
                                        key={component}
                                        className="p-4 rounded border border-[#232328] bg-[#14151a] space-y-3"
                                    >
                                        {/* Component Header */}
                                        <div className="flex items-center gap-2">
                                            <div
                                                className="p-1.5 rounded"
                                                style={{ backgroundColor: `${info.color}15` }}
                                            >
                                                <span style={{ color: info.color }}>{info.icon}</span>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-1.5">
                                                    <span className="text-xs font-semibold text-white truncate">{info.shortName}</span>
                                                    <span className="relative flex h-2 w-2">
                                                        {isReady && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#34d399] opacity-75" />}
                                                        <span className={cn(
                                                            "relative inline-flex rounded-full h-2 w-2",
                                                            isReady ? "bg-[#34d399]" : "bg-amber-400"
                                                        )} />
                                                    </span>
                                                </div>
                                                <p className="text-[9px] text-[#747580] uppercase tracking-[0.05em]">{info.description}</p>
                                            </div>
                                        </div>

                                        {/* Provider Select */}
                                        <div>
                                            <label className="text-[9px] text-[#747580] uppercase tracking-[0.1em] mb-1.5 block">Provider</label>
                                            <Select
                                                value={config.providerType}
                                                onValueChange={(value) => handleProviderChange(component, value as AIProviderType)}
                                            >
                                                <SelectTrigger className="w-full h-8 text-xs bg-[#0f1015] border-[#232328] text-white">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent className="bg-[#14151a] border-[#232328]">
                                                    {(['gemini', 'openai', 'claude'] as AIProviderType[]).map((provider) => {
                                                        const provInfo = PROVIDER_INFO[provider];
                                                        const isConfigured = configuredProviders.includes(provider);
                                                        return (
                                                            <SelectItem
                                                                key={provider}
                                                                value={provider}
                                                                disabled={!isConfigured}
                                                                className="text-xs"
                                                            >
                                                                <div className="flex items-center gap-2">
                                                                    <span>{provInfo.icon}</span>
                                                                    <span>{provInfo.name.split(' ')[0]}</span>
                                                                    {!isConfigured && <span className="text-[#3a3b42] text-[10px]">(no key)</span>}
                                                                </div>
                                                            </SelectItem>
                                                        );
                                                    })}
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        {/* Model Select */}
                                        <div>
                                            <label className="text-[9px] text-[#747580] uppercase tracking-[0.1em] mb-1.5 block">Model</label>
                                            <Select
                                                value={config.modelId}
                                                onValueChange={(value) => handleModelChange(component, value)}
                                            >
                                                <SelectTrigger className="w-full h-8 text-xs bg-[#0f1015] border-[#232328] text-white">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent className="bg-[#14151a] border-[#232328]">
                                                    {availableModels.map((model) => (
                                                        <SelectItem key={model.id} value={model.id} className="text-xs">
                                                            <span>{model.name}</span>
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Networks Section - Collapsible */}
                    <div className="glass-panel rounded overflow-hidden">
                        <button
                            onClick={() => setShowNetworks(!showNetworks)}
                            className="w-full p-4 flex items-center justify-between hover:bg-[#1a1b21]/50 transition-all"
                        >
                            <div className="flex items-center gap-2">
                                <Globe className="h-4 w-4 text-[#34d399]" />
                                <span className="text-sm font-semibold text-white">Networks</span>
                            </div>
                            <ChevronDown
                                size={16}
                                className={cn(
                                    "text-[#747580] transition-transform duration-200",
                                    showNetworks && "rotate-180"
                                )}
                            />
                        </button>

                        {showNetworks && (
                            <div className="px-4 pb-4 border-t border-[#232328] space-y-3 pt-3">
                                {/* Solana Network */}
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] text-[#747580] uppercase tracking-[0.1em]">Solana</span>
                                    <div className="flex bg-[#14151a] rounded-lg p-1 border border-[#232328]">
                                        <button
                                            onClick={() => setSolanaNetwork('devnet')}
                                            className={cn(
                                                "px-3 py-1.5 rounded-md text-[11px] font-medium transition-all",
                                                solanaNetwork === 'devnet'
                                                    ? "bg-[#1a1b21] text-white"
                                                    : "text-[#747580]"
                                            )}
                                        >
                                            Devnet
                                        </button>
                                        <button
                                            disabled
                                            className="px-3 py-1.5 rounded-md text-[11px] text-[#3a3b42] flex items-center gap-1"
                                        >
                                            Mainnet <span className="text-[8px] text-[#747580] bg-[#232328] px-1 rounded">SOON</span>
                                        </button>
                                    </div>
                                </div>

                                {/* Hyperliquid Network */}
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] text-[#747580] uppercase tracking-[0.1em]">Hyperliquid</span>
                                    <div className="flex bg-[#14151a] rounded-lg p-1 border border-[#232328]">
                                        <button
                                            onClick={() => setHyperliquidNetwork('testnet')}
                                            className={cn(
                                                "px-3 py-1.5 rounded-md text-[11px] font-medium transition-all",
                                                hyperliquidNetwork === 'testnet'
                                                    ? "bg-[#1a1b21] text-white"
                                                    : "text-[#747580]"
                                            )}
                                        >
                                            Testnet
                                        </button>
                                        <button
                                            disabled
                                            className="px-3 py-1.5 rounded-md text-[11px] text-[#3a3b42] flex items-center gap-1"
                                        >
                                            Mainnet <span className="text-[8px] text-[#747580] bg-[#232328] px-1 rounded">SOON</span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </>
            )}
        </motion.div>
    );
};
