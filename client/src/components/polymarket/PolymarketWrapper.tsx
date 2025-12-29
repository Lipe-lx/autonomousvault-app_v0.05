// src/components/polymarket/PolymarketWrapper.tsx
// Main wrapper for Polymarket Dealer with tabbed navigation - follows DealerConsole.tsx pattern

import React from 'react';
import { motion } from 'framer-motion';
import { usePolymarket } from '../../hooks/usePolymarket';
import { VaultState, AppTab } from '../../types';
import { TrendingUp, Wallet } from 'lucide-react';
import { PolymarketDashboardPage } from './PolymarketDashboardPage';
import { PolymarketConfigSection } from './PolymarketConfigSection';
import { PolymarketPromptPage } from './PolymarketPromptPage';
import { PolymarketThinkingPage } from './PolymarketThinkingPage';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../ui/tabs';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { cn } from '@/lib/utils';

interface PolymarketWrapperProps {
    vault: VaultState;
    password: string;
    activeTab: AppTab;
    setActiveTab: (tab: AppTab) => void;
}

export const PolymarketWrapper: React.FC<PolymarketWrapperProps> = ({ vault, password, activeTab, setActiveTab }) => {
    // Check if Polymarket wallet exists (required for Dealer)
    const hasPolymarketVault = !!vault.pmPublicKey;

    // Determine which view to show
    const currentView = activeTab === AppTab.POLYMARKET_DEALER ? AppTab.POLYMARKET_DASHBOARD : activeTab;

    const {
        state,
        toggleDealer,
        updateSettings,
        applyChanges,
        saveStrategy,
        clearLogs
    } = usePolymarket(vault, password);

    // Map AppTab to tab value
    const getTabValue = () => {
        switch (currentView) {
            case AppTab.POLYMARKET_DASHBOARD: return 'dashboard';
            case AppTab.POLYMARKET_THINKING: return 'thinking';
            case AppTab.POLYMARKET_CONFIG: return 'config';
            case AppTab.POLYMARKET_PROMPT: return 'prompt';
            default: return 'dashboard';
        }
    };

    const handleTabChange = (value: string) => {
        switch (value) {
            case 'dashboard': setActiveTab(AppTab.POLYMARKET_DASHBOARD); break;
            case 'thinking': setActiveTab(AppTab.POLYMARKET_THINKING); break;
            case 'config': setActiveTab(AppTab.POLYMARKET_CONFIG); break;
            case 'prompt': setActiveTab(AppTab.POLYMARKET_PROMPT); break;
        }
    };

    // If no Polymarket vault exists, show message to create one
    if (!hasPolymarketVault) {
        return (
            <motion.div
                className="flex flex-col h-[calc(100vh-8rem)] items-center justify-center"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
            >
                <div className="max-w-md w-full mx-auto space-y-6 p-8 text-center">
                    <div className="w-16 h-16 bg-[#1a1b21] rounded-full flex items-center justify-center mx-auto mb-4 border border-[#232328]">
                        <Wallet size={32} className="text-[#E7FE55]" />
                    </div>
                    <h2 className="text-xl font-semibold text-white tracking-tight">Create a Vault First</h2>
                    <p className="text-[#747580] text-sm">
                        You need to create a Polymarket wallet before using Polymarket Dealer.
                        Go to the <span className="text-[#E7FE55]">Vault</span> page to set up your wallet.
                    </p>
                    <Button
                        onClick={() => setActiveTab(AppTab.VAULT)}
                        variant="success"
                        size="lg"
                        className="mt-4 bg-[#E7FE55] hover:bg-[#d4eb4d] text-black"
                    >
                        Go to Vault
                    </Button>
                </div>
            </motion.div>
        );
    }

    return (
        <div className="h-full flex flex-col overflow-hidden">
            {/* VAULT LOCKED warning if needed */}
            {!vault.isUnlocked && (
                <motion.div
                    className="mb-3 flex justify-end shrink-0 px-4"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                >
                    <Badge variant="destructive" className="animate-pulse">
                        VAULT LOCKED
                    </Badge>
                </motion.div>
            )}

            {/* Tab Navigation is now in App.tsx header */}
            <Tabs value={getTabValue()} onValueChange={handleTabChange} className="flex-1 flex flex-col min-h-0">

                {/* Main Content - Full-Height Panel */}
                <div className="flex-1 min-h-0 relative">
                    <TabsContent value="dashboard" forceMount className="h-full mt-0 absolute inset-0 data-[state=inactive]:hidden">
                        <PolymarketDashboardPage
                            status={state}
                            onToggle={toggleDealer}
                            vaultAddress={vault.pmPublicKey}
                            setActiveTab={setActiveTab}
                        />
                    </TabsContent>

                    <TabsContent value="thinking" forceMount className="h-full mt-0 absolute inset-0 data-[state=inactive]:hidden">
                        <PolymarketThinkingPage
                            status={state}
                            onClearLogs={clearLogs}
                        />
                    </TabsContent>

                    <TabsContent value="config" forceMount className="h-full mt-0 absolute inset-0 overflow-y-auto data-[state=inactive]:hidden">
                        <PolymarketConfigSection
                            settings={state.settings}
                            onUpdateSettings={updateSettings}
                            onApplyChanges={applyChanges}
                            isOn={state.isOn}
                            onToggle={toggleDealer}
                        />
                    </TabsContent>

                    <TabsContent value="prompt" forceMount className="h-full mt-0 absolute inset-0 data-[state=inactive]:hidden">
                        <PolymarketPromptPage
                            settings={state.settings}
                            onUpdateSettings={updateSettings}
                            onApplyChanges={applyChanges}
                        />
                    </TabsContent>
                </div>
            </Tabs>
        </div>
    );
};
