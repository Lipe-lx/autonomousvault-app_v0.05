// SolanaDealerConsole.tsx
// Main wrapper component for Solana Dealer - manages sub-tabs

import React from 'react';
import { AppTab } from '../../types';
import { useSolanaDealerStore } from '../../state/solanaDealerStore';
import { SolanaDealerDashboard } from './SolanaDealerDashboard';
import { SolanaDealerPolicyPage } from './SolanaDealerPolicyPage';
import { SolanaDealerLogPage } from './SolanaDealerLogPage';
import { SolanaDealerThinkingPage } from './SolanaDealerThinkingPage';

interface SolanaDealerConsoleProps {
    activeTab: AppTab;
    walletAddress?: string;
}

export const SolanaDealerConsole: React.FC<SolanaDealerConsoleProps> = ({
    activeTab,
    walletAddress
}) => {
    const state = useSolanaDealerStore();

    // Render appropriate sub-page based on active tab
    const renderContent = () => {
        switch (activeTab) {
            case AppTab.SOLANA_DEALER:
            case AppTab.SOLANA_DEALER_DASHBOARD:
                return (
                    <SolanaDealerDashboard
                        state={state}
                        walletAddress={walletAddress}
                    />
                );
            
            case AppTab.SOLANA_DEALER_THINKING:
                return (
                    <SolanaDealerThinkingPage
                        logs={state.logs}
                    />
                );
            
            case AppTab.SOLANA_DEALER_POLICY:
                return (
                    <SolanaDealerPolicyPage
                        policy={state.settings.policy}
                    />
                );
            
            case AppTab.SOLANA_DEALER_LOG:
                return (
                    <SolanaDealerLogPage
                        auditLog={state.auditLog}
                    />
                );
            
            default:
                return (
                    <SolanaDealerDashboard
                        state={state}
                        walletAddress={walletAddress}
                    />
                );
        }
    };

    return (
        <div className="h-full flex flex-col">
            {renderContent()}
        </div>
    );
};
