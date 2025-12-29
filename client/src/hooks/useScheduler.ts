import { useState, useEffect, useRef } from 'react';
import { Keypair } from '@solana/web3.js';
import { ScheduledTask, VaultState } from '../types';
import { marketDataMCP } from '../mcp/marketData/marketDataMCP';
import { solanaService } from '../services/solanaService';
import { CryptoService } from '../services/cryptoService';
import { hyperliquidMCP } from '../mcp/hyperliquid/hyperliquidMCP';
import { hyperliquidService } from '../services/hyperliquidService';
import { backgroundTimer } from '../services/backgroundTimer';
import { StorageService } from '../services/storageService';

// Timer ID for the scheduler
const SCHEDULER_TIMER_ID = 'vault-scheduler';

export const useScheduler = (
    vault: VaultState,
    password: string,
    addNotification: (msg: string) => void,
    refreshBalance: (pubkey: string) => void,
    addActivityLog: (type: string, desc: string, signature: string) => void
) => {
    const [scheduledTasks, setScheduledTasks] = useState<ScheduledTask[]>([]);
    const [isInitialized, setIsInitialized] = useState(false);

    // Load tasks from IndexedDB on mount
    useEffect(() => {
        const loadTasks = async () => {
            const key = StorageService.getUserKey('agent_scheduled_tasks');
            const saved = await StorageService.getItem(key);
            if (saved) {
                setScheduledTasks(JSON.parse(saved));
            }
            setIsInitialized(true);
        };
        loadTasks();
    }, []);

    // Use ref to store latest checkTasks function for stable callback
    const checkTasksRef = useRef<(() => Promise<void>) | null>(null);

    // --- Scheduler Execution Loop ---
    useEffect(() => {
        if (!vault.isUnlocked) {
            // Stop scheduler if vault is locked
            backgroundTimer.stop(SCHEDULER_TIMER_ID);
            return;
        }

        console.log('[Scheduler] 🚀 Starting scheduler loop with Web Worker timer (background-safe, checks every 10s)');

        const checkTasks = async () => {
            const now = Date.now();
            const activeTasks = scheduledTasks.filter(t => t.status === 'active');

            if (activeTasks.length === 0) {
                console.log('[Scheduler] ⏸️  No active tasks to check');
                return;
            }

            console.log(`[Scheduler] 🔍 Checking ${activeTasks.length} active task(s)...`);

            for (const task of activeTasks) {
                let shouldExecute = false;

                // 1. Time-based check
                if (task.executeAt && task.executeAt <= now) {
                    console.log(`[Scheduler] ⏰ Time-based task ${String(task.id).slice(0, 6)} triggered`);
                    shouldExecute = true;
                }
                // 2. Condition-based check (if condition exists)
                else if (task.condition) {
                    try {
                        const { symbol, indicator, operator, value, timeframe } = task.condition;
                        console.log(`[Scheduler] 📊 Checking ${indicator.toUpperCase()} for ${symbol} (${timeframe}): target ${operator} ${value}`);

                        // Fetch indicator value
                        const indicatorData = await marketDataMCP.getIndicator(symbol, indicator, timeframe);

                        // Parse value based on indicator type
                        let currentVal = 0;
                        if (typeof indicatorData.value === 'number') {
                            // Simple number indicators (RSI, EMA, SMA, Price)
                            currentVal = indicatorData.value;
                        } else if (typeof indicatorData.value === 'object' && indicatorData.value !== null) {
                            // Complex indicators (MACD, Stochastic)
                            const indicatorLower = indicator.toLowerCase();

                            if (indicatorLower === 'macd') {
                                // For MACD, use the 'macd' line value (not signal or histogram)
                                currentVal = (indicatorData.value as any).macd || 0;
                            } else if (indicatorLower === 'stoch' || indicatorLower === 'stochastic') {
                                // For Stochastic, use the 'k' value
                                currentVal = (indicatorData.value as any).k || 0;
                            } else if ('value' in indicatorData.value) {
                                // Generic fallback for objects with 'value' property
                                currentVal = (indicatorData.value as any).value;
                            } else if ('rsi' in indicatorData.value) {
                                // Fallback for RSI if it comes as object
                                currentVal = (indicatorData.value as any).rsi;
                            } else {
                                console.warn(`[Scheduler] Unknown indicator object structure for ${indicator}:`, indicatorData.value);
                            }
                        }

                        console.log(`[Scheduler] 📈 Current ${indicator.toUpperCase()}: ${currentVal.toFixed(2)} | Condition: ${operator} ${value}`);

                        // Compare
                        if (operator === '>' && currentVal > value) shouldExecute = true;
                        if (operator === '<' && currentVal < value) shouldExecute = true;
                        if (operator === '>=' && currentVal >= value) shouldExecute = true;
                        if (operator === '<=' && currentVal <= value) shouldExecute = true;
                        if (operator === '==' && currentVal == value) shouldExecute = true;

                        if (shouldExecute) {
                            console.log(`[Scheduler] ✅ Condition MET! ${currentVal.toFixed(2)} ${operator} ${value}`);
                        } else {
                            console.log(`[Scheduler] ❌ Condition NOT met: ${currentVal.toFixed(2)} ${operator} ${value}`);
                        }

                    } catch (err) {
                        console.error(`[Scheduler] ⚠️  Error checking condition for task ${task.id}:`, err);
                    }
                }

                if (shouldExecute) {
                    // DOUBLE-SPENDING PREVENTION: Check if task is already executing or recently completed
                    const taskStatus = scheduledTasks.find(t => t.id === task.id)?.status;
                    if (taskStatus === 'executing') {
                        console.log(`[Scheduler] ⏭️  Task ${String(task.id).slice(0, 6)} is already executing, skipping...`);
                        continue;
                    }

                    // Prevent re-execution if completed less than 5 minutes ago (cooldown period)
                    const lastExecuted = scheduledTasks.find(t => t.id === task.id)?.lastExecuted;
                    if (lastExecuted && (Date.now() - lastExecuted) < 300000) { // 5 minutes
                        console.log(`[Scheduler] 🕐 Task ${String(task.id).slice(0, 6)} was recently completed (${Math.round((Date.now() - lastExecuted) / 1000)}s ago), skipping...`);
                        continue;
                    }

                    // Execute Task
                    console.log(`[Scheduler] 🎯 Executing task ${String(task.id).slice(0, 6)} (${task.type})...`);

                    // Mark as executing IMMEDIATELY to prevent double execution
                    setScheduledTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: 'executing' as const } : t));

                    try {

                        // Perform Action
                        const params = JSON.parse(task.params || '{}');
                        let resultTx = '';

                        // Reconstruct keypair from encrypted vault key
                        if (!vault.encryptedPrivateKey) {
                            throw new Error('Vault encrypted key not available');
                        }

                        const decryptedStr = await CryptoService.decrypt(vault.encryptedPrivateKey, password);
                        const secretKey = Uint8Array.from(JSON.parse(decryptedStr));
                        const kp = Keypair.fromSecretKey(secretKey);

                        if (task.type === 'SWAP') {
                            // Execute Real Swap
                            console.log(`[Scheduler] 💱 Swapping ${params.amount} ${params.inputToken} -> ${params.outputToken}`);
                            try {
                                resultTx = await solanaService.executeSwap(
                                    kp,
                                    params.inputToken,
                                    params.outputToken,
                                    params.amount,
                                    (status) => console.log(`[Scheduler] ${status}`)
                                );
                                addActivityLog('Swap', `Scheduled: Swapped ${params.amount} ${params.inputToken} -> ${params.outputToken}`, resultTx);
                            } catch (swapErr: any) {
                                // If timeout error, verify transaction status on-chain
                                if (swapErr.message?.includes('timeout') || (swapErr as any).isTimeout) {
                                    console.warn(`[Scheduler] ⚠️  Swap confirmation timeout. Verifying transaction status...`);

                                    const signature = (swapErr as any).signature;

                                    if (signature) {
                                        // Verify transaction status on-chain
                                        try {
                                            const statusResponse = await solanaService.connection.getSignatureStatus(signature);
                                            const status = statusResponse?.value;

                                            if (status?.confirmationStatus === 'finalized' || status?.confirmationStatus === 'confirmed') {
                                                // Transaction succeeded!
                                                console.log(`[Scheduler] ✅ Transaction verified as successful: ${signature}`);
                                                resultTx = signature;
                                                addActivityLog('Swap', `Scheduled: Swapped ${params.amount} ${params.inputToken} -> ${params.outputToken}`, signature);

                                                // Mark as completed
                                                setScheduledTasks(prev => {
                                                    const updated = prev.map(t => t.id === task.id ? {
                                                        ...t,
                                                        status: 'completed' as const,
                                                        lastExecuted: Date.now(),
                                                        result: `Success: ${signature}`
                                                    } : t);
                                                    StorageService.setItem(StorageService.getUserKey('agent_scheduled_tasks'), JSON.stringify(updated));
                                                    return updated;
                                                });

                                                addNotification(`Task ${String(task.id).slice(0, 4)} completed: ${signature.slice(0, 8)}...`);
                                                refreshBalance(vault.publicKey!);
                                                continue; // Skip to next task
                                            } else if (status?.err) {
                                                // Transaction actually failed on-chain
                                                console.error(`[Scheduler] ❌ Transaction failed on-chain:`, status.err);
                                                throw new Error(`Transaction failed: ${JSON.stringify(status.err)}`);
                                            } else {
                                                // Status unknown, mark with warning
                                                console.warn(`[Scheduler] ⚠️  Transaction status unknown. Signature: ${signature}`);
                                                setScheduledTasks(prev => {
                                                    const updated = prev.map(t => t.id === task.id ? {
                                                        ...t,
                                                        status: 'completed' as const,
                                                        lastExecuted: Date.now(),
                                                        result: `Warning: Status unknown - verify manually: ${signature}`
                                                    } : t);
                                                    StorageService.setItem(StorageService.getUserKey('agent_scheduled_tasks'), JSON.stringify(updated));
                                                    return updated;
                                                });
                                                addNotification(`Task ${String(task.id).slice(0, 4)} - verify: ${signature.slice(0, 8)}...`);
                                                refreshBalance(vault.publicKey!);
                                                continue;
                                            }
                                        } catch (verifyErr) {
                                            console.error(`[Scheduler] ⚠️  Failed to verify transaction:`, verifyErr);
                                            // Fall through to mark as failed
                                        }
                                    }
                                }
                                throw swapErr; // Re-throw if not timeout or verification failed
                            }
                        } else if (task.type === 'TRANSFER') {
                            // Execute Real Transfer
                            console.log(`[Scheduler] 📤 Transferring ${params.amount} tokens to Owner`);
                            if (!vault.ownerPublicKey) {
                                throw new Error('Owner wallet not connected');
                            }

                            try {
                                if (params.tokenMint === 'So11111111111111111111111111111111111111112') {
                                    // SOL transfer
                                    resultTx = await solanaService.transferSol(kp, vault.ownerPublicKey, params.amount);
                                } else {
                                    // SPL Token transfer
                                    resultTx = await solanaService.transferToken(
                                        kp,
                                        params.tokenMint,
                                        vault.ownerPublicKey,
                                        params.amount,
                                        params.decimals || 9
                                    );
                                }
                                addActivityLog('Transfer', `Scheduled: Sent ${params.amount} to Owner`, resultTx);
                            } catch (transferErr: any) {
                                // If timeout error, verify transaction status on-chain
                                if (transferErr.message?.includes('timeout') || (transferErr as any).isTimeout) {
                                    console.warn(`[Scheduler] ⚠️  Transfer confirmation timeout. Verifying transaction status...`);

                                    const signature = (transferErr as any).signature;

                                    if (signature) {
                                        // Verify transaction status on-chain
                                        try {
                                            const statusResponse = await solanaService.connection.getSignatureStatus(signature);
                                            const status = statusResponse?.value;

                                            if (status?.confirmationStatus === 'finalized' || status?.confirmationStatus === 'confirmed') {
                                                // Transaction succeeded!
                                                console.log(`[Scheduler] ✅ Transaction verified as successful: ${signature}`);
                                                resultTx = signature;
                                                addActivityLog('Transfer', `Scheduled: Sent ${params.amount} to Owner`, signature);

                                                // Mark as completed
                                                setScheduledTasks(prev => {
                                                    const updated = prev.map(t => t.id === task.id ? {
                                                        ...t,
                                                        status: 'completed' as const,
                                                        lastExecuted: Date.now(),
                                                        result: `Success: ${signature}`
                                                    } : t);
                                                    StorageService.setItem(StorageService.getUserKey('agent_scheduled_tasks'), JSON.stringify(updated));
                                                    return updated;
                                                });

                                                addNotification(`Task ${String(task.id).slice(0, 4)} completed: ${signature.slice(0, 8)}...`);
                                                refreshBalance(vault.publicKey!);
                                                continue; // Skip to next task
                                            } else if (status?.err) {
                                                // Transaction actually failed on-chain
                                                console.error(`[Scheduler] ❌ Transaction failed on-chain:`, status.err);
                                                throw new Error(`Transaction failed: ${JSON.stringify(status.err)}`);
                                            } else {
                                                // Status unknown, mark with warning
                                                console.warn(`[Scheduler] ⚠️  Transaction status unknown. Signature: ${signature}`);
                                                setScheduledTasks(prev => {
                                                    const updated = prev.map(t => t.id === task.id ? {
                                                        ...t,
                                                        status: 'completed' as const,
                                                        lastExecuted: Date.now(),
                                                        result: `Warning: Status unknown - verify manually: ${signature}`
                                                    } : t);
                                                    StorageService.setItem(StorageService.getUserKey('agent_scheduled_tasks'), JSON.stringify(updated));
                                                    return updated;
                                                });
                                                addNotification(`Task ${String(task.id).slice(0, 4)} - verify: ${signature.slice(0, 8)}...`);
                                                refreshBalance(vault.publicKey!);
                                                continue;
                                            }
                                        } catch (verifyErr) {
                                            console.error(`[Scheduler] ⚠️  Failed to verify transaction:`, verifyErr);
                                            // Fall through to mark as failed
                                        }
                                    }
                                }
                                throw transferErr; // Re-throw if not timeout or verification failed
                            }
                        } else if (task.type === 'ALERT') {
                            // Execute Alert
                            console.log(`[Scheduler] 🔔 Alert triggered for task ${String(task.id).slice(0, 6)}`);
                            resultTx = 'ALERT_TRIGGERED'; // Dummy "tx" for logs
                            addNotification(`🔔 ALERT: ${task.condition?.indicator.toUpperCase()} ${task.condition?.operator} ${task.condition?.value}`);
                        } else if (task.type === 'HL_ORDER') {
                            // Execute Hyperliquid Order
                            console.log(`[Scheduler] ⚡ Executing Hyperliquid Order: ${params.side} ${params.size} ${params.coin}`);

                            if (!vault.hlEncryptedPrivateKey) {
                                throw new Error('Hyperliquid Vault not available');
                            }

                            // Decrypt HL Key
                            const decryptedStr = await CryptoService.decrypt(vault.hlEncryptedPrivateKey, password);
                            const wallet = hyperliquidService.getWalletFromPrivateKey(decryptedStr);

                            // Set leverage if specified and different from 1x
                            if (params.leverage && params.leverage !== 1) {
                                await hyperliquidMCP.updateLeverage(wallet, params.coin, params.leverage, false);
                            }

                            // 1. Determine Side (Buy/Sell)
                            const isBuy = params.isBuy !== undefined ? params.isBuy : (params.side === 'B');



                            // 2. Determine Size (Coin Amount)
                            let size = params.size;

                            // If size is missing but usdcAmount is present, calculate size
                            if ((size === undefined || size === null) && params.usdcAmount) {
                                console.log(`[Scheduler] 🧮 Calculating size for ${params.usdcAmount} USDC of ${params.coin}...`);
                                try {
                                    let price = params.price;

                                    // If no limit price, get current market price
                                    if (!price) {
                                        const marketData = await hyperliquidService.getMarketData(params.coin);
                                        // Use Ask for Buy (we pay Ask), Bid for Sell (we get Bid)
                                        // levels[0] = bids, levels[1] = asks
                                        // If buying, we care about the Ask price (lowest seller)
                                        // If selling, we care about the Bid price (highest buyer)
                                        const bestAsk = parseFloat(marketData.levels[1][0].px);
                                        const bestBid = parseFloat(marketData.levels[0][0].px);
                                        price = isBuy ? bestAsk : bestBid;
                                        console.log(`[Scheduler] 🏷️  Current Price for ${params.coin}: ${price}`);
                                    }

                                    if (!price || price === 0) throw new Error('Could not determine price for size calculation');

                                    // Get decimals
                                    const decimals = await hyperliquidService.getAssetDecimals(params.coin);

                                    // Calculate precise size: Amount / Price
                                    // Round to 'decimals' precision
                                    const rawSize = params.usdcAmount / price;
                                    const scale = Math.pow(10, decimals);
                                    size = Math.floor(rawSize * scale) / scale; // Floor to avoid exceeding available balance/precision

                                    console.log(`[Scheduler] 📏 Calculated Size: ${size} ${params.coin} (Decimals: ${decimals})`);

                                } catch (calcErr) {
                                    console.error('[Scheduler] ❌ Error calculating size:', calcErr);
                                    throw new Error(`Failed to calculate order size: ${(calcErr as any).message}`);
                                }
                            }

                            if (!size || size <= 0) {
                                throw new Error(`Invalid order size: ${size}`);
                            }

                            // Handle Market Orders: Hyperliquid requires market orders to be sent as Limit IOC with slippage
                            let finalOrderType = params.orderType || 'limit';
                            let finalPrice = params.price;

                            // Get decimals for price rounding (needed for both market and limit orders)
                            const decimals = await hyperliquidService.getAssetDecimals(params.coin);
                            const maxPriceDecimals = Math.max(0, 6 - decimals);

                            if (finalOrderType === 'market') {
                                console.log(`[Scheduler] 🔄 Converting Market Order to Limit IOC with slippage...`);

                                // Fetch current price if we don't have one
                                const marketData = await hyperliquidService.getMarketData(params.coin);
                                const bestBid = parseFloat(marketData.levels[0][0].px);
                                const bestAsk = parseFloat(marketData.levels[1][0].px);
                                const basePrice = isBuy ? bestAsk : bestBid;

                                // Apply 5% slippage
                                const slippage = 0.05;
                                let rawPrice = isBuy
                                    ? basePrice * (1 + slippage)
                                    : basePrice * (1 - slippage);

                                // Round to correct decimals (max 5 sig figs, max decimals = 6 - szDecimals)
                                let roundedPrice = parseFloat(rawPrice.toFixed(maxPriceDecimals));
                                roundedPrice = parseFloat(roundedPrice.toPrecision(5));
                                finalPrice = parseFloat(roundedPrice.toFixed(maxPriceDecimals));

                                // Switch to IOC (Immediate or Cancel)
                                finalOrderType = 'ioc';
                                console.log(`[Scheduler] 🏷️  Market -> IOC: Base ${basePrice} -> Slippage ${finalPrice}`);
                            } else if (finalPrice) {
                                // Limit order: Round provided price to valid tick size
                                let roundedPrice = parseFloat(finalPrice.toFixed(maxPriceDecimals));
                                roundedPrice = parseFloat(roundedPrice.toPrecision(5));
                                finalPrice = parseFloat(roundedPrice.toFixed(maxPriceDecimals));
                                console.log(`[Scheduler] 🏷️  Limit price rounded: ${params.price} -> ${finalPrice} (maxDecimals=${maxPriceDecimals})`);
                            }

                            const result = await hyperliquidMCP.createOrder(
                                wallet,
                                params.coin,
                                isBuy,
                                size,
                                finalPrice,
                                {
                                    orderType: finalOrderType as 'limit' | 'market' | 'ioc' | 'alo',
                                    reduceOnly: params.reduceOnly || false,
                                    stopLoss: params.stopLoss,
                                    takeProfit: params.takeProfit
                                }
                            );

                            if (result.status === 'ok') {
                                const status = result.response?.data?.statuses?.[0];
                                if (status?.error) {
                                    throw new Error(`HL Order Error: ${status.error}`);
                                }
                                resultTx = `HL_ORDER:${status?.filled?.oid || status?.resting?.oid || 'placed'}`;
                                addActivityLog('HL Order', `Placed ${params.side} ${params.size} ${params.coin} @ ${params.price}`, resultTx);
                            } else {
                                throw new Error(`HL Order Failed: ${JSON.stringify(result)}`);
                            }
                        }

                        // Mark as completed
                        setScheduledTasks(prev => {
                            const updated = prev.map(t => t.id === task.id ? {
                                ...t,
                                status: 'completed' as const,
                                lastExecuted: Date.now(),
                                result: `Success: ${resultTx}`
                            } : t);
                            StorageService.setItem(StorageService.getUserKey('agent_scheduled_tasks'), JSON.stringify(updated)); // Update storage
                            return updated;
                        });

                        console.log(`[Scheduler] ✅ Task ${String(task.id).slice(0, 6)} completed! TX: ${resultTx.slice(0, 12)}...`);
                        addNotification(`Task ${String(task.id).slice(0, 4)} executed: ${resultTx.slice(0, 8)}...`);
                        refreshBalance(vault.publicKey!);

                    } catch (err: any) {
                        console.error(`[Scheduler] ❌ Task ${task.id} failed:`, err);
                        setScheduledTasks(prev => {
                            const updated = prev.map(t => t.id === task.id ? {
                                ...t,
                                status: 'failed' as const,
                                lastExecuted: Date.now(),
                                result: err.message
                            } : t);
                            StorageService.setItem(StorageService.getUserKey('agent_scheduled_tasks'), JSON.stringify(updated));
                            return updated;
                        });
                        addNotification(`Task ${String(task.id).slice(0, 4)} failed: ${err.message}`);
                    }
                }
            }
        };

        // Store ref to latest checkTasks for stable callback
        checkTasksRef.current = checkTasks;

        // Use Web Worker-based timer that is NOT throttled in background tabs
        backgroundTimer.start(SCHEDULER_TIMER_ID, 10000, () => {
            // Call latest version of checkTasks via ref
            if (checkTasksRef.current) {
                checkTasksRef.current();
            }
        });

        // Run immediately on mount
        checkTasks();

        return () => {
            console.log('[Scheduler] 🛑 Stopping scheduler loop');
            backgroundTimer.stop(SCHEDULER_TIMER_ID);
        };
    }, [vault.isUnlocked, scheduledTasks]);

    return {
        scheduledTasks,
        setScheduledTasks
    };
};
