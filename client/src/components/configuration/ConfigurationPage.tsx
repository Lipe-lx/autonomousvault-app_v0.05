import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Cpu, Activity, Key, Eye, EyeOff, Check, AlertCircle, MessageSquare, TrendingUp, Target, ExternalLink, Globe, Zap } from 'lucide-react';
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
        icon: <MessageSquare size={16} />,
        description: 'Chat assistant',
        color: '#9b87f5'
    },
    hyperliquidDealer: {
        name: 'Hyperliquid Dealer',
        shortName: 'Hyperliquid',
        icon: <TrendingUp size={16} />,
        description: 'Perp trading',
        color: '#E7FE55'
    },
    polymarketDealer: {
        name: 'Polymarket Dealer',
        shortName: 'Polymarket',
        icon: <Target size={16} />,
        description: 'Predictions',
        color: '#22d3ee'
    }
};

export const ConfigurationPage: React.FC<ConfigurationPageProps> = ({ vault, password, addNotification, activeTab, setActiveTab }) => {
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
            className="h-full flex flex-col overflow-y-auto custom-scrollbar"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4 }}
        >
            {/* Centered Container */}
            <div className="flex-1 w-full max-w-5xl mx-auto px-6 py-8 flex flex-col gap-6">
                
                {/* Header */}
                {activeTab !== 'user' && (
                    <header className="mb-2">
                        <h1 className="text-3xl font-light tracking-tight text-white">System Configuration</h1>
                        <p className="text-sm text-gray-500 mt-2 font-light">Manage your AI providers, model assignments, and network connections.</p>
                    </header>
                )}

                {/* Conditional Content */}
                {activeTab === 'user' ? (
                    <UserSettingsPage addNotification={addNotification} password={password} />
                ) : (
                    /* Two Column Masonry Layout */
                    <div className="columns-1 lg:columns-2 gap-6 space-y-6">
                        {/* AI Providers Section */}
                        <section className="glass-panel rounded break-inside-avoid">
                            <div className="px-6 py-4 border-b border-gray-800/60 flex items-center justify-between font-light">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-gray-800/30 rounded">
                                        <Cpu className="h-4 w-4 text-white" />
                                    </div>
                                    <h2 className="text-sm font-bold text-white tracking-wide">AI Providers</h2>
                                </div>
                                {/* Provider status dots */}
                                <div className="flex items-center gap-2">
                                    {(['gemini', 'openai', 'claude'] as AIProviderType[]).map((provider) => (
                                        <div
                                            key={provider}
                                            className={cn(
                                                "w-1.5 h-1.5 rounded-full transition-all",
                                                keyStatus[provider] === 'saved' ? "bg-emerald-500" : "bg-gray-700"
                                            )}
                                            title={`${PROVIDER_INFO[provider].name}: ${keyStatus[provider] === 'saved' ? 'Configured' : 'Not configured'}`}
                                        />
                                    ))}
                                </div>
                            </div>

                            <div className="p-6">
                                {/* Provider Selection Tabs */}
                                <div className="flex items-center gap-6 border-b border-gray-800/60 mb-6 pb-1">
                                    {(['gemini', 'openai', 'claude'] as AIProviderType[]).map((provider) => {
                                        const isActive = activeProviderTab === provider;
                                        return (
                                            <button
                                                key={provider}
                                                onClick={() => setActiveProviderTab(provider)}
                                                className={cn(
                                                    "relative pb-3 text-sm font-medium transition-all",
                                                    isActive
                                                        ? "text-white"
                                                        : "text-gray-500 hover:text-gray-300"
                                                )}
                                            >
                                                {PROVIDER_INFO[provider].name}
                                                {isActive && (
                                                    <motion.div
                                                        layoutId="activeTab"
                                                        className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#E7FE55]"
                                                    />
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>

                                {/* Active Provider Config */}
                                <div>
                                    <div className="flex items-center justify-between mb-3">
                                        <label className="text-xs font-medium text-gray-400 uppercase tracking-wider flex items-center gap-2">
                                            <span>API Key</span>
                                            {keyStatus[activeProviderTab] === 'saved' && (
                                                <span className="text-emerald-500 flex items-center gap-1 normal-case tracking-normal bg-emerald-500/10 px-2 py-0.5 rounded text-[10px] font-semibold">
                                                    <Check size={10} /> Saved
                                                </span>
                                            )}
                                        </label>
                                        <a
                                            href={PROVIDER_INFO[activeProviderTab].keyUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-xs text-[#E7FE55] hover:underline flex items-center gap-1 transition-colors"
                                        >
                                            Get API key <ExternalLink size={10} />
                                        </a>
                                    </div>

                                    <div className="relative group mb-4">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                            <Key size={14} className="text-gray-600 group-focus-within:text-white transition-colors" />
                                        </div>
                                        <input
                                            type={showApiKey[activeProviderTab] ? 'text' : 'password'}
                                            value={apiKeys[activeProviderTab]}
                                            onChange={(e) => handleApiKeyChange(activeProviderTab, e.target.value)}
                                            placeholder={`Enter ${PROVIDER_INFO[activeProviderTab].name} key...`}
                                            className="w-full bg-transparent border border-gray-800 rounded-lg py-2.5 pl-10 pr-10 text-sm text-gray-200 focus:outline-none focus:border-[#E7FE55]/50 focus:ring-1 focus:ring-[#E7FE55]/20 font-mono transition-all placeholder:text-gray-700"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowApiKey(prev => ({ ...prev, [activeProviderTab]: !prev[activeProviderTab] }))}
                                            className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-600 hover:text-white transition-colors"
                                        >
                                            {showApiKey[activeProviderTab] ? <EyeOff size={14} /> : <Eye size={14} />}
                                        </button>
                                    </div>

                                    <div className="flex items-center gap-3">
                                        <button
                                            onClick={() => handleSaveApiKey(activeProviderTab)}
                                            disabled={keyStatus[activeProviderTab] !== 'modified'}
                                            className={cn(
                                                "h-9 px-5 rounded-lg text-sm font-medium transition-all",
                                                keyStatus[activeProviderTab] === 'modified'
                                                    ? "bg-white text-black hover:bg-gray-200"
                                                    : "bg-gray-800/50 text-gray-500 cursor-not-allowed border border-gray-800"
                                            )}
                                        >
                                            Save Changes
                                        </button>
                                        
                                        {keyStatus[activeProviderTab] !== 'empty' && (
                                            <button
                                                onClick={() => handleClearApiKey(activeProviderTab)}
                                                className="h-9 px-4 rounded-lg text-sm text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-all ml-auto"
                                            >
                                                Disconnect
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </section>

                        {/* Networks Section - Always Visible */}
                        <section className="glass-panel rounded break-inside-avoid">
                            <div className="px-6 py-4 border-b border-gray-800/60 flex items-center gap-3">
                                <div className="p-2 bg-gray-800/30 rounded">
                                    <Globe className="h-4 w-4 text-white" />
                                </div>
                                <div className="text-left">
                                    <h2 className="text-sm font-bold text-white tracking-wide">Network Settings</h2>
                                    <p className="text-[11px] text-gray-500 mt-0.5 font-light">Configure blockchain connections</p>
                                </div>
                            </div>

                            <div className="p-6 space-y-4">
                                {/* Solana Network */}
                                <div className="flex items-center justify-between p-4 rounded-lg border border-gray-800/40">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-gray-800/50 border border-gray-800 flex items-center justify-center">
                                            <Zap size={14} className="text-[#9945FF]" />
                                        </div>
                                        <div>
                                            <span className="text-sm text-gray-300 font-medium block">Solana</span>
                                            <span className="text-xs text-gray-600 block">Blockchain Network</span>
                                        </div>
                                    </div>
                                    
                                    <div className="flex rounded-lg p-1 border border-gray-800/60">
                                        <button
                                            onClick={() => setSolanaNetwork('devnet')}
                                            className={cn(
                                                "px-4 py-1.5 rounded-md text-xs font-medium transition-all",
                                                solanaNetwork === 'devnet'
                                                    ? "bg-gray-800 text-white"
                                                    : "text-gray-500 hover:text-gray-300"
                                            )}
                                        >
                                            Devnet
                                        </button>
                                        <button
                                            disabled
                                            className="px-4 py-1.5 rounded-md text-xs text-gray-600 flex items-center gap-1.5 cursor-not-allowed opacity-60"
                                        >
                                            Mainnet <span className="text-[9px] bg-gray-800 text-gray-400 px-1 rounded uppercase tracking-wider">Soon</span>
                                        </button>
                                    </div>
                                </div>

                                {/* Hyperliquid Network */}
                                <div className="flex items-center justify-between p-4 rounded-lg border border-gray-800/40">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-gray-800/50 border border-gray-800 flex items-center justify-center">
                                            <TrendingUp size={14} className="text-[#E7FE55]" />
                                        </div>
                                        <div>
                                            <span className="text-sm text-gray-300 font-medium block">Hyperliquid</span>
                                            <span className="text-xs text-gray-600 block">Trading Engine</span>
                                        </div>
                                    </div>

                                    <div className="flex rounded-lg p-1 border border-gray-800/60">
                                        <button
                                            onClick={() => setHyperliquidNetwork('testnet')}
                                            className={cn(
                                                "px-4 py-1.5 rounded-md text-xs font-medium transition-all",
                                                hyperliquidNetwork === 'testnet'
                                                    ? "bg-gray-800 text-white"
                                                    : "text-gray-500 hover:text-gray-300"
                                            )}
                                        >
                                            Testnet
                                        </button>
                                        <button
                                            disabled
                                            className="px-4 py-1.5 rounded-md text-xs text-gray-600 flex items-center gap-1.5 cursor-not-allowed opacity-60"
                                        >
                                            Mainnet <span className="text-[9px] bg-gray-800 text-gray-400 px-1 rounded uppercase tracking-wider">Soon</span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </section>

                        {/* Component Model Assignment */}
                        <section className="glass-panel rounded break-inside-avoid">
                            <div className="px-6 py-4 border-b border-gray-800/60 flex items-center gap-3">
                                <div className="p-2 bg-gray-800/30 rounded">
                                    <Activity className="h-4 w-4 text-white" />
                                </div>
                                <h2 className="text-sm font-bold text-white tracking-wide">Model Assignment</h2>
                            </div>

                            <div className="p-6">
                                <div className="flex flex-col gap-4">
                                    {(['operator', 'hyperliquidDealer', 'polymarketDealer'] as AIComponentType[]).map((component) => {
                                        const info = COMPONENT_INFO[component];
                                        const config = componentConfigs[component];
                                        const availableModels = PROVIDER_MODELS[config.providerType];
                                        const configuredProviders = getConfiguredProviders();
                                        const isReady = configuredProviders.includes(config.providerType);

                                        return (
                                            <div
                                                key={component}
                                                className="group p-4 rounded-lg border border-gray-800/60 hover:border-gray-700 transition-all duration-300"
                                            >
                                                {/* Component Header */}
                                                <div className="flex items-center gap-3 mb-4">
                                                    <div
                                                        className="p-1.5 rounded-lg shrink-0"
                                                        style={{ backgroundColor: `${info.color}10`, color: info.color }}
                                                    >
                                                        {info.icon}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center justify-between">
                                                            <h3 className="text-sm font-semibold text-gray-200">{info.shortName}</h3>
                                                            <span className={cn(
                                                                "w-2 h-2 rounded-full",
                                                                isReady ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]" : "bg-amber-500"
                                                            )} />
                                                        </div>
                                                        <p className="text-[11px] text-gray-500 mt-0.5">{info.description}</p>
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-2 gap-3">
                                                    {/* Provider Select */}
                                                    <div>
                                                        <label className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider mb-1.5 block">Provider</label>
                                                        <Select
                                                            value={config.providerType}
                                                            onValueChange={(value) => handleProviderChange(component, value as AIProviderType)}
                                                        >
                                                            <SelectTrigger className="w-full h-9 bg-transparent border-gray-800 hover:border-gray-700 text-xs text-gray-300 focus:ring-1 focus:ring-gray-700 transition-colors">
                                                                <SelectValue />
                                                            </SelectTrigger>
                                                            <SelectContent className="bg-[#1A1B21] border-[#2E2F36]">
                                                                {(['gemini', 'openai', 'claude'] as AIProviderType[]).map((provider) => {
                                                                    const provInfo = PROVIDER_INFO[provider];
                                                                    const isConfigured = configuredProviders.includes(provider);
                                                                    return (
                                                                        <SelectItem
                                                                            key={provider}
                                                                            value={provider}
                                                                            disabled={!isConfigured}
                                                                            className="text-xs text-gray-300 focus:bg-[#2E2F36] focus:text-white"
                                                                        >
                                                                            <div className="flex items-center gap-2">
                                                                                <span>{provInfo.name}</span>
                                                                                {!isConfigured && <span className="opacity-50 text-[10px] ml-auto">(no key)</span>}
                                                                            </div>
                                                                        </SelectItem>
                                                                    );
                                                                })}
                                                            </SelectContent>
                                                        </Select>
                                                    </div>

                                                    {/* Model Select */}
                                                    <div>
                                                        <label className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider mb-1.5 block">Model</label>
                                                        <Select
                                                            value={config.modelId}
                                                            onValueChange={(value) => handleModelChange(component, value)}
                                                        >
                                                            <SelectTrigger className="w-full h-9 bg-transparent border-gray-800 hover:border-gray-700 text-xs text-gray-300 focus:ring-1 focus:ring-gray-700 transition-colors">
                                                                <SelectValue />
                                                            </SelectTrigger>
                                                            <SelectContent className="bg-[#1A1B21] border-[#2E2F36]">
                                                                {availableModels.map((model) => (
                                                                    <SelectItem 
                                                                        key={model.id} 
                                                                        value={model.id} 
                                                                        className="text-xs text-gray-300 focus:bg-[#2E2F36] focus:text-white"
                                                                    >
                                                                        {model.name}
                                                                    </SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </section>
                    </div>
                )}
            </div>
        </motion.div>
    );
};
