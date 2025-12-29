// src/hooks/usePolymarket.ts
// React hook for Polymarket Dealer - follows useDealer.ts pattern

import { useSyncExternalStore, useRef, useEffect } from 'react';
import { polymarketStore, PolymarketSettings, PolymarketState } from '../state/polymarketStore';
import { polymarketService } from '../services/polymarketService';
import { polymarketDealerService } from '../services/polymarketDealerService';
import { CryptoService } from '../services/cryptoService';
import { VaultState } from '../types';

export function usePolymarket(vault: VaultState, password: string) {
    const state = useSyncExternalStore<PolymarketState>(
        polymarketStore.subscribe.bind(polymarketStore),
        polymarketStore.getSnapshot.bind(polymarketStore)
    );

    const executorSetRef = useRef(false);

    // Initialize service when vault is unlocked
    useEffect(() => {
        // Only attempt to initialize if:
        // 1. Vault is unlocked
        // 2. We have an encrypted private key
        // 3. Password is not empty
        if (!vault.isUnlocked || !vault.pmEncryptedPrivateKey || !password || password.trim() === '') {
            return;
        }

        const initService = async () => {
            try {
                // Decrypt private key using async method
                const privateKey = await CryptoService.decrypt(vault.pmEncryptedPrivateKey!, password);

                // Initialize Polymarket service
                const success = await polymarketService.initialize(privateKey);

                if (success) {
                    polymarketStore.addLog('INFO', 'Polymarket service initialized');
                } else {
                    polymarketStore.addLog('ERROR', 'Failed to initialize Polymarket service');
                }
            } catch (error) {
                console.error('[usePolymarket] Init error:', error);
                polymarketStore.addLog('ERROR', 'Initialization error: ' + (error as Error).message);
            }
        };

        initService();
    }, [vault.isUnlocked, vault.pmEncryptedPrivateKey, password]);

    // Set up trade executor for the dealer service
    useEffect(() => {
        if (!executorSetRef.current) {
            polymarketDealerService.setExecutor(async (intent) => {
                await executeOrderFromIntent(intent);
            });
            executorSetRef.current = true;
        }
    }, []);

    // Execute order from dealer intent
    const executeOrderFromIntent = async (intent: any) => {
        if (!polymarketService.getIsInitialized()) {
            polymarketStore.addLog('ERROR', 'Service not initialized');
            return;
        }

        // Use the correct field names from PolymarketDealerIntent
        const price = intent.suggestedPrice || 0.5; // Default to 50% if not specified
        const size = intent.suggestedSize || state.settings.maxPositionSizeUSDC;

        // Get tokenId from intent or try to look it up
        let tokenId = intent.tokenId;

        if (!tokenId) {
            // Log that we're skipping due to missing tokenId
            polymarketStore.addLog('WARNING', `Skipping "${intent.question?.slice(0, 40)}..." - tokenId not available`);
            return;
        }

        const pricePercent = (price * 100).toFixed(1);
        polymarketStore.addLog('TRADE', `Executing ${intent.action} on "${intent.question?.slice(0, 40)}..." @ ${pricePercent}¢`);

        const result = await polymarketService.createOrder({
            tokenId,
            side: intent.action === 'BUY_YES' || intent.action === 'BUY_NO' ? 'BUY' : 'SELL',
            price,
            size: Math.floor(size / price) // Calculate shares from USDC size
        });

        if (result.success) {
            polymarketStore.addLog('TRADE', `Order placed: ${result.orderId}`);

            polymarketStore.addOperationRecord({
                marketId: intent.marketId,
                question: intent.question,
                outcome: intent.action.includes('YES') ? 'YES' : 'NO',
                action: intent.action.startsWith('BUY') ? 'BUY' : 'SELL',
                timestamp: Date.now(),
                price,
                shares: size / price,
                sizeUSDC: size,
                reasoning: intent.reason || intent.reasoning || '',
                confidence: intent.confidence,
                status: 'OPEN'
            });
        } else {
            polymarketStore.addLog('ERROR', `Order failed: ${result.error}`);
        }
    };

    // Sync portfolio state periodically
    useEffect(() => {
        if (!state.isOn || !polymarketService.getIsInitialized()) return;

        const syncPortfolio = async () => {
            try {
                const [balance, positions] = await Promise.all([
                    polymarketService.getBalance(),
                    polymarketService.getPositions()
                ]);

                const exposure = positions.reduce((sum, pos) => sum + pos.currentValue, 0);

                polymarketStore.updatePortfolioState(positions, balance, exposure);
            } catch (error) {
                console.error('[usePolymarket] Sync error:', error);
            }
        };

        syncPortfolio();
        const interval = setInterval(syncPortfolio, 30000); // Every 30 seconds
        return () => clearInterval(interval);
    }, [state.isOn]);

    // ============================================
    // ACTIONS
    // ============================================

    const toggleDealer = (isOn: boolean) => {
        polymarketStore.toggleDealer(isOn);

        if (isOn) {
            polymarketStore.addLog('INFO', 'Polymarket Dealer activated');
        } else {
            polymarketStore.addLog('INFO', 'Polymarket Dealer deactivated');
        }
    };

    const updateSettings = (settings: Partial<PolymarketSettings>) => {
        polymarketStore.updateSettings(settings);
    };

    const applyChanges = () => {
        polymarketStore.reload();
        polymarketStore.addLog('INFO', 'Settings applied');
    };

    const saveStrategy = (prompt: string) => {
        polymarketStore.setStrategyPrompt(prompt);
        polymarketStore.addLog('INFO', 'Strategy prompt updated');
    };

    const clearLogs = () => {
        polymarketStore.clearLogs();
    };

    // ============================================
    // TRADING ACTIONS
    // ============================================

    const executeOrder = async (params: {
        marketId: string;
        tokenId: string;
        side: 'BUY' | 'SELL';
        outcome: 'YES' | 'NO';
        price: number;
        size: number;
        question: string;
        reason: string;
        confidence: number;
    }) => {
        if (!polymarketService.getIsInitialized()) {
            polymarketStore.addLog('ERROR', 'Service not initialized');
            return { success: false, error: 'Service not initialized' };
        }

        const pricePercent = (params.price * 100).toFixed(1);
        polymarketStore.addLog('TRADE', 'Executing ' + params.side + ' ' + params.outcome + ' @ ' + pricePercent + 'c');

        const result = await polymarketService.createOrder({
            tokenId: params.tokenId,
            side: params.side,
            price: params.price,
            size: params.size
        });

        if (result.success) {
            polymarketStore.addLog('TRADE', 'Order placed: ' + result.orderId);

            // Record operation
            polymarketStore.addOperationRecord({
                marketId: params.marketId,
                question: params.question,
                outcome: params.outcome,
                action: params.side,
                timestamp: Date.now(),
                price: params.price,
                shares: params.size,
                sizeUSDC: params.size * params.price,
                reasoning: params.reason,
                confidence: params.confidence,
                status: 'OPEN'
            });
        } else {
            polymarketStore.addLog('ERROR', 'Order failed: ' + result.error);
        }

        return result;
    };

    const cancelOrder = async (orderId: string) => {
        const success = await polymarketService.cancelOrder(orderId);
        if (success) {
            polymarketStore.addLog('INFO', 'Order ' + orderId + ' canceled');
        } else {
            polymarketStore.addLog('ERROR', 'Failed to cancel order ' + orderId);
        }
        return success;
    };

    return {
        // State
        state,
        isOn: state.isOn,
        isAnalyzing: state.isAnalyzing,
        settings: state.settings,
        logs: state.logs,
        positions: state.activePositions,
        operationHistory: state.operationHistory,

        // Actions
        toggleDealer,
        updateSettings,
        applyChanges,
        saveStrategy,
        clearLogs,

        // Trading
        executeOrder,
        cancelOrder
    };
}
