import React from 'react';
import { motion } from 'framer-motion';
import { useDealer } from '../../hooks/useDealer';
import { VaultState, AppTab } from '../../types';
import { TrendingUp } from 'lucide-react';
import { DealerDashboardPage } from './DealerDashboardPage';
import { DealerThinkingPage } from './DealerThinkingPage';
import { DealerConfigSection } from '../configuration/DealerConfigSection';
import { DealerPromptPage } from './DealerPromptPage';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../ui/tabs';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { cn } from '@/lib/utils';

interface DealerConsoleProps {
    vault: VaultState;
    password: string;
    activeTab: AppTab;
    setActiveTab: (tab: AppTab) => void;
}

export const DealerConsole: React.FC<DealerConsoleProps> = ({ vault, password, activeTab, setActiveTab }) => {
    // Check if Hyperliquid wallet exists (required for Dealer)
    const hasHyperliquidVault = !!vault.hlPublicKey;

    // Determine which view to show
    const currentView = activeTab === AppTab.VAULT_DEALER ? AppTab.DEALER_DASHBOARD : activeTab;

    const {
        isOn,
        isAnalyzing,
        statusMessage,
        statusDetail,
        currentTask,
        currentSignal,
        trendAssessment,
        pendingExecution,
        currentExposure,
        activePositions,
        portfolioValue,
        lastSyncTimestamp,
        settings,
        logs,
        operationHistory,
        toggleDealer,
        updateSettings,
        applyChanges,
        saveStrategy,
        clearLogs
    } = useDealer(vault, password);

    const statusState = {
        isOn,
        isAnalyzing,
        statusMessage,
        statusDetail,
        currentTask,
        currentSignal,
        trendAssessment,
        pendingExecution,
        currentExposure,
        activePositions,
        portfolioValue,
        lastSyncTimestamp,
        settings,
        logs,
        operationHistory
    };

    // Map AppTab to tab value
    const getTabValue = () => {
        switch (currentView) {
            case AppTab.DEALER_DASHBOARD: return 'dashboard';
            case AppTab.DEALER_THINKING: return 'thinking';
            case AppTab.DEALER_CONFIG: return 'config';
            case AppTab.DEALER_PROMPT: return 'prompt';
            default: return 'dashboard';
        }
    };

    const handleTabChange = (value: string) => {
        switch (value) {
            case 'dashboard': setActiveTab(AppTab.DEALER_DASHBOARD); break;
            case 'thinking': setActiveTab(AppTab.DEALER_THINKING); break;
            case 'config': setActiveTab(AppTab.DEALER_CONFIG); break;
            case 'prompt': setActiveTab(AppTab.DEALER_PROMPT); break;
        }
    };

    // If no Hyperliquid vault exists, show message to create one
    if (!hasHyperliquidVault) {
        return (
            <motion.div
                className="flex flex-col h-[calc(100vh-8rem)] items-center justify-center"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
            >
                <div className="max-w-md w-full mx-auto space-y-6 p-8 text-center">
                    <div className="w-16 h-16 bg-[#1a1b21] rounded-full flex items-center justify-center mx-auto mb-4 border border-[#232328]">
                        <TrendingUp size={32} className="text-[#34d399]" />
                    </div>
                    <h2 className="text-xl font-semibold text-white tracking-tight">Create a Vault First</h2>
                    <p className="text-[#747580] text-sm">
                        You need to create a Hyperliquid wallet before using Hyperliquid Dealer.
                        Go to the <span className="text-[#34d399]">Vault</span> page to set up your wallet.
                    </p>
                    <Button
                        onClick={() => setActiveTab(AppTab.VAULT)}
                        variant="success"
                        size="lg"
                        className="mt-4"
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
                    <TabsContent value="dashboard" className="h-full mt-0 absolute inset-0">
                        <DealerDashboardPage
                            status={statusState}
                            onToggle={toggleDealer}
                            vaultAddress={vault.hlPublicKey}
                            setActiveTab={setActiveTab}
                        />
                    </TabsContent>

                    <TabsContent value="thinking" className="h-full mt-0 absolute inset-0">
                        <DealerThinkingPage
                            status={statusState}
                            onClearLogs={clearLogs}
                        />
                    </TabsContent>

                    <TabsContent value="config" className="h-full mt-0 absolute inset-0 overflow-y-auto">
                        <DealerConfigSection
                            status={statusState}
                            onToggle={toggleDealer}
                            onUpdateSettings={updateSettings}
                            onApplyChanges={applyChanges}
                            onSaveStrategy={saveStrategy}
                        />
                    </TabsContent>

                    <TabsContent value="prompt" className="h-full mt-0 absolute inset-0">
                        <DealerPromptPage
                            status={statusState}
                            onSaveStrategy={saveStrategy}
                            onUpdateSettings={updateSettings}
                        />
                    </TabsContent>
                </div>
            </Tabs>
        </div>
    );
};
