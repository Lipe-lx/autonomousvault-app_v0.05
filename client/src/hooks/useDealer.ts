import { useSyncExternalStore, useRef, useEffect } from 'react';
import { StorageService } from '../services/storageService';
import { dealerStore } from '../state/dealerStore';
import { dealerService } from '../services/dealerService';
import { aiService } from '../services/aiService';
import { hyperliquidMCP } from '../mcp/hyperliquid/hyperliquidMCP';
import { hyperliquidService } from '../services/hyperliquidService';
import { CryptoService } from '../services/cryptoService';
import { VaultState } from '../types';

export const useDealer = (vault: VaultState, password: string) => {
    // 1. Sync with Store
    const state = useSyncExternalStore(
        (listener) => dealerStore.subscribe(listener),
        () => dealerStore.getSnapshot()
    );

    // 2. Executor Injection
    const hasInjectedExecutor = useRef(false);

    // 2.1 Ensure AI Service is initialized (needed for Dealer Analysis)
    useEffect(() => {
        // Priority: 1) aiService (IndexedDB via aiConfigStore), 2) env variables
        const storedKey = aiService.getApiKey();
        const apiKey = storedKey || (import.meta as any).env?.VITE_GEMINI_API_KEY || (window as any).process?.env?.GEMINI_API_KEY;
        if (apiKey) {
            aiService.initialize(apiKey);
        }
    }, []);

    // 2.2 Sync Vault Context to DealerService (for Bankroll logic)
    useEffect(() => {
        dealerService.setVaultContext({
            walletAddress: vault.hlPublicKey,
            balance: vault.hlBalance || 0
        });
    }, [vault.hlBalance, vault.hlPublicKey]);

    useEffect(() => {
        // Always update executor when vault/password changes to ensure we have the latest closure

        dealerService.setExecutor(async (intent: any) => {
            console.log('[useDealer] GENUINE EXECUTION TRIGGERED:', intent);

            if (!vault.isUnlocked || !vault.hlPublicKey || !vault.hlEncryptedPrivateKey) {
                dealerStore.addLog('ERROR', 'Cannot execute: Vault locked or HL not initialized');
                return;
            }

            try {
                // 1. Decrypt Private Key
                if (!password) throw new Error("Password required for execution");
                const privateKey = await CryptoService.decrypt(vault.hlEncryptedPrivateKey, password);

                // 2. Create Wallet Instance
                const wallet = hyperliquidService.getWalletFromPrivateKey(privateKey);

                // 3. Log Execution Intent
                dealerStore.addLog('TRADE', `🚀 EXECUTING ${intent.action} ${intent.coin}...`, {
                    reason: intent.reason,
                    confidence: intent.confidence
                });

                let isBuy = intent.action === 'BUY';
                let isReduceOnly = false;

                if (intent.action === 'CLOSE') {
                    // CRITICAL: Fetch FRESH positions from API instead of using stale cache
                    // This fixes the issue where vault.hlPositions isn't updated after BUY orders
                    console.log('[useDealer] Seeking position for CLOSE:', intent.coin);
                    console.log('[useDealer] Cached Positions (may be stale):', vault.hlPositions?.map((p: any) => p?.position?.coin || p?.coin));

                    // Fetch current positions directly from Hyperliquid
                    dealerStore.addLog('INFO', `Fetching current positions for ${intent.coin}...`);
                    let freshPositions: any[] = [];
                    try {
                        const userState = await hyperliquidService.getUserState(vault.hlPublicKey!);
                        freshPositions = userState?.assetPositions || [];
                        console.log('[useDealer] Fresh Positions from API:', freshPositions.map((p: any) => p?.position?.coin || p?.coin));
                    } catch (e) {
                        console.error('[useDealer] Failed to fetch fresh positions:', e);
                        dealerStore.addLog('ERROR', `Failed to fetch positions: ${(e as Error).message}`);
                        return;
                    }

                    const position = freshPositions.find((p: any) => p.position?.coin === intent.coin);
                    if (position && parseFloat(position.position.szi) !== 0) {
                        // HL state structure: { position: { coin, szi, ... } }
                        const szi = position.position.szi;
                        const size = parseFloat(szi);
                        // If Short (negative size), we need to BUY to close.
                        // If Long (positive size), we need to SELL to close.
                        isBuy = size < 0;
                        isReduceOnly = true;
                        dealerStore.addLog('INFO', `Closing ${size} ${intent.coin} (Side: ${isBuy ? 'BUY' : 'SELL'}, ReduceOnly: Yes)`);
                    } else {
                        dealerStore.addLog('WARNING', `CLOSE signal ignored: No open position found for ${intent.coin}`);
                        console.log('[useDealer] Position not found or size is 0. Available positions:', freshPositions.map((p: any) => `${p?.position?.coin}: ${p?.position?.szi}`));
                        return;
                    }
                }
                const isMarket = intent.type === 'market';

                // 4. Fetch Market Data for Price
                dealerStore.addLog('INFO', 'Fetching market data...');
                const marketData = await hyperliquidMCP.getMarketData(intent.coin);
                const bestBid = parseFloat(marketData.levels[0][0].px);
                const bestAsk = parseFloat(marketData.levels[1][0].px);
                const basePrice = isBuy ? bestAsk : bestBid;

                // 5. Calculate Size from USDC
                const decimals = await hyperliquidMCP.getAssetDecimals(intent.coin);
                const usdcAmount = intent.sizeUSDC || state.settings.maxPositionSizeUSDC || 20;
                const rawSize = usdcAmount / basePrice;
                const orderSize = parseFloat(rawSize.toFixed(decimals));

                // 6. Calculate Price (with slippage for market orders)
                let calculatedPrice: number;
                let finalOrderType: 'limit' | 'market' | 'ioc' | 'alo' = isMarket ? 'ioc' : 'limit';

                // Calculate max price decimals for this asset (Hyperliquid constraint: 6 - szDecimals)
                const maxPriceDecimals = Math.max(0, 6 - decimals);

                if (isMarket) {
                    const slippage = 0.05; // 5%
                    let rawPrice = isBuy
                        ? basePrice * (1 + slippage)
                        : basePrice * (1 - slippage);
                    let roundedPrice = parseFloat(rawPrice.toFixed(maxPriceDecimals));
                    roundedPrice = parseFloat(roundedPrice.toPrecision(5));
                    calculatedPrice = parseFloat(roundedPrice.toFixed(maxPriceDecimals));
                } else {
                    // Limit order: Round the AI-provided price to valid tick size
                    const rawLimitPrice = intent.price || basePrice;
                    let roundedPrice = parseFloat(rawLimitPrice.toFixed(maxPriceDecimals));
                    roundedPrice = parseFloat(roundedPrice.toPrecision(5));
                    calculatedPrice = parseFloat(roundedPrice.toFixed(maxPriceDecimals));
                    console.log(`[useDealer] Limit price rounded: ${rawLimitPrice} -> ${calculatedPrice} (maxDecimals=${maxPriceDecimals})`);
                }

                // 7. Set Leverage if needed (with error handling for margin constraints)
                const suggestedLeverage = intent.leverage || state.settings.maxLeverage || 1;
                const leverage = Math.min(suggestedLeverage, state.settings.maxLeverage || 1);

                // Log if leverage was capped
                if (suggestedLeverage > leverage) {
                    dealerStore.addLog('INFO', `⚠️ Leverage capped for ${intent.coin}: ${suggestedLeverage}x → ${leverage}x (max: ${state.settings.maxLeverage}x)`);
                }

                if (leverage > 1) {
                    try {
                        await hyperliquidMCP.updateLeverage(wallet, intent.coin, leverage, false);
                    } catch (leverageErr: any) {
                        // Log warning but continue with order (use current leverage)
                        console.warn(`[useDealer] Leverage update failed, using current: ${leverageErr.message}`);
                        dealerStore.addLog('WARNING', `Leverage update failed (using current): ${leverageErr.message.slice(0, 50)}...`);
                    }
                }

                // DEBUG: Log SL/TP settings and intent values
                console.log(`[useDealer SL/TP DEBUG] Settings:`, {
                    stopLossEnabled: state.settings.stopLossEnabled,
                    stopLossPercent: state.settings.stopLossPercent,
                    takeProfitEnabled: state.settings.takeProfitEnabled,
                    takeProfitPercent: state.settings.takeProfitPercent
                });
                console.log(`[useDealer SL/TP DEBUG] AI Intent:`, {
                    stopLoss: intent.stopLoss,
                    takeProfit: intent.takeProfit
                });

                // 8. Calculate Stop Loss price (if enabled)
                let stopLossPrice: number | undefined;
                if (state.settings.stopLossEnabled && !isReduceOnly) {
                    if (state.settings.stopLossPercent !== null) {
                        // User-defined fixed percentage from entry price
                        const slPercent = state.settings.stopLossPercent / 100;
                        stopLossPrice = isBuy
                            ? calculatedPrice * (1 - slPercent)  // LONG: SL below entry
                            : calculatedPrice * (1 + slPercent); // SHORT: SL above entry
                        dealerStore.addLog('INFO', `📉 Stop Loss: ${state.settings.stopLossPercent}% → $${stopLossPrice.toFixed(2)}`);
                    } else if (intent.stopLoss) {
                        // AI-suggested absolute price
                        stopLossPrice = intent.stopLoss;
                        dealerStore.addLog('INFO', `📉 Stop Loss (AI): $${stopLossPrice.toFixed(2)}`);
                    }
                    // Note: If enabled but no user % and no AI suggestion, stopLoss will be undefined (no order placed)
                }

                // 9. Calculate Take Profit price (if enabled)
                let takeProfitPrice: number | undefined;
                if (state.settings.takeProfitEnabled && !isReduceOnly) {
                    if (state.settings.takeProfitPercent !== null) {
                        // User-defined fixed percentage from entry price
                        const tpPercent = state.settings.takeProfitPercent / 100;
                        takeProfitPrice = isBuy
                            ? calculatedPrice * (1 + tpPercent)  // LONG: TP above entry
                            : calculatedPrice * (1 - tpPercent); // SHORT: TP below entry
                        dealerStore.addLog('INFO', `📈 Take Profit: ${state.settings.takeProfitPercent}% → $${takeProfitPrice.toFixed(2)}`);
                    } else if (intent.takeProfit) {
                        // AI-suggested absolute price
                        takeProfitPrice = intent.takeProfit;
                        dealerStore.addLog('INFO', `📈 Take Profit (AI): $${takeProfitPrice.toFixed(2)}`);
                    }
                    // Note: If enabled but no user % and no AI suggestion, takeProfit will be undefined (no order placed)
                }

                // 10. Execute Order via hyperliquidMCP (Matches Vault Operator)
                const hasSlTp = stopLossPrice || takeProfitPrice;
                dealerStore.addLog('INFO', `Placing ${finalOrderType.toUpperCase()} order: ${orderSize} ${intent.coin} @ ${calculatedPrice.toFixed(2)}${hasSlTp ? ' (with SL/TP)' : ''}`);

                const result = await hyperliquidMCP.createOrder(
                    wallet,
                    intent.coin,
                    isBuy,
                    orderSize,
                    calculatedPrice,
                    {
                        orderType: finalOrderType,
                        reduceOnly: isReduceOnly,
                        cloid: intent.cloid,
                        stopLoss: stopLossPrice,
                        takeProfit: takeProfitPrice
                    }
                );

                dealerStore.addLog('INFO', `Order Placed: ${result.status || 'Submitted'}`);

                // Record operation for Manager visibility
                dealerStore.addOperationRecord({
                    coin: intent.coin,
                    action: intent.action,
                    timestamp: Date.now(),
                    entryPrice: calculatedPrice,
                    size: orderSize,
                    sizeUSDC: usdcAmount,
                    reasoning: intent.reason || 'AI analysis decision',
                    confidence: intent.confidence || 0.7,
                    status: intent.action === 'CLOSE' ? 'CLOSED' : 'OPEN',
                    cloid: intent.cloid
                });

            } catch (err: any) {
                console.error("Execution Error:", err);
                dealerStore.addLog('ERROR', `Execution Failed: ${err.message}`);
            }
        });

        hasInjectedExecutor.current = true;
    }, [vault.isUnlocked, vault.hlPublicKey, password, state.settings.maxPositionSizeUSDC, state.settings.maxLeverage, state.settings.stopLossEnabled, state.settings.stopLossPercent, state.settings.takeProfitEnabled, state.settings.takeProfitPercent]);


    // 3. Expose Actions
    const toggleDealer = (isOn: boolean) => {
        dealerStore.toggleDealer(isOn);
        if (isOn) {
            dealerService.startLoop();
        } else {
            dealerService.stopLoop();
        }
    };

    const updateSettings = (settings: any) => {
        dealerStore.updateSettings(settings);
    };

    const applyChanges = () => {
        dealerStore.reload();
        // If it was running, restart it to pick up new frequency/settings
        if (state.isOn) {
            dealerService.stopLoop();
            setTimeout(() => dealerService.startLoop(), 500);
        }
    };

    const saveStrategy = (prompt: string) => {
        dealerStore.setStrategyPrompt(prompt);
    };

    const clearLogs = () => {
        dealerStore.clearLogs();
    };

    return {
        ...state,
        toggleDealer,
        updateSettings,
        applyChanges,
        saveStrategy,
        clearLogs
    };
};
