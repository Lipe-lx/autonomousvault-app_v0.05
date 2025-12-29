// ADAPTER
// Hyperliquid Execution Adapter
// Implements ExecutionAdapter for Hyperliquid exchange
//
// ⚠️ CLIENT-ONLY: This adapter handles SIGNING
// Must NEVER run on server or store private keys

import type { ExecutionAdapter, ExecuteOrderParams, OrderResult, CancelOrderParams } from './execution.adapter';

/**
 * Hyperliquid execution adapter implementation
 * 
 * SECURITY: This adapter handles EIP-712 signing and must remain client-only.
 * The actual signing is performed using ethers.js wallet instance.
 */
export class HyperliquidExecutionAdapter implements ExecutionAdapter {
    private wallet: any = null; // ethers.Wallet
    private isTestnet: boolean = false;
    private userAddress: string | null = null;

    constructor(testnet: boolean = false) {
        this.isTestnet = testnet;
    }

    /**
     * Set the wallet for signing transactions
     * MUST be called with a decrypted wallet from client-side vault
     */
    setWallet(wallet: any): void {
        this.wallet = wallet;
        this.userAddress = wallet?.address || null;
    }

    /**
     * Set testnet mode
     */
    setTestnet(testnet: boolean): void {
        this.isTestnet = testnet;
    }

    /**
     * Check if wallet is ready
     */
    isReady(): boolean {
        return this.wallet !== null;
    }

    /**
     * Get user address
     */
    getUserAddress(): string | null {
        return this.userAddress;
    }

    /**
     * Execute a trading order
     * 
     * This method performs EIP-712 signing and posts to Hyperliquid
     */
    async executeOrder(params: ExecuteOrderParams): Promise<OrderResult> {
        if (!this.wallet) {
            throw new Error('Wallet not set. Cannot execute order without signing capability.');
        }

        const apiUrl = this.isTestnet
            ? 'https://api.hyperliquid-testnet.xyz/exchange'
            : 'https://api.hyperliquid.xyz/exchange';

        // Build order request
        const orderRequest = this.buildOrderRequest(params);

        // Sign the order using EIP-712
        const signature = await this.signL1Action(orderRequest);

        // Post to exchange
        try {
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: orderRequest,
                    nonce: Date.now(),
                    signature
                })
            });

            const result = await response.json();

            if (result.status === 'ok') {
                return {
                    success: true,
                    orderId: result.response?.data?.statuses?.[0]?.resting?.oid,
                    message: 'Order executed successfully'
                };
            } else {
                return {
                    success: false,
                    error: result.response || 'Order execution failed'
                };
            }
        } catch (error: any) {
            return {
                success: false,
                error: `Network error: ${error.message}`
            };
        }
    }

    /**
     * Cancel an existing order
     */
    async cancelOrder(params: CancelOrderParams): Promise<OrderResult> {
        if (!this.wallet) {
            throw new Error('Wallet not set. Cannot cancel order without signing capability.');
        }

        const apiUrl = this.isTestnet
            ? 'https://api.hyperliquid-testnet.xyz/exchange'
            : 'https://api.hyperliquid.xyz/exchange';

        const cancelRequest = {
            type: 'cancel',
            cancels: [{
                asset: params.assetIndex,
                oid: params.orderId
            }]
        };

        const signature = await this.signL1Action(cancelRequest);

        try {
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: cancelRequest,
                    nonce: Date.now(),
                    signature
                })
            });

            const result = await response.json();
            return {
                success: result.status === 'ok',
                message: result.status === 'ok' ? 'Order cancelled' : result.response
            };
        } catch (error: any) {
            return {
                success: false,
                error: `Cancel failed: ${error.message}`
            };
        }
    }

    /**
     * Build order request from params
     */
    private buildOrderRequest(params: ExecuteOrderParams): any {
        const order = {
            a: params.assetIndex,
            b: params.isBuy,
            p: params.price?.toString() || '0',
            s: params.size.toString(),
            r: params.reduceOnly || false,
            t: {
                limit: params.orderType === 'limit' ? { tif: 'Gtc' } : undefined,
                trigger: undefined
            }
        };

        return {
            type: 'order',
            orders: [order],
            grouping: 'na'
        };
    }

    /**
     * Sign an L1 action using EIP-712
     * 
     * This is the critical non-custodial signing function.
     * The wallet's private key is used here and never leaves the client.
     */
    private async signL1Action(action: any): Promise<string> {
        if (!this.wallet) {
            throw new Error('No wallet available for signing');
        }

        // EIP-712 domain and types for Hyperliquid
        const domain = {
            name: 'Exchange',
            version: '1',
            chainId: this.isTestnet ? 421614 : 42161, // Arbitrum testnet/mainnet
            verifyingContract: '0x0000000000000000000000000000000000000000'
        };

        const types = {
            Agent: [
                { name: 'source', type: 'string' },
                { name: 'connectionId', type: 'bytes32' }
            ]
        };

        // Actual implementation would use wallet._signTypedData
        // For stub: throw error indicating implementation needed
        throw new Error('[STUB] HyperliquidExecutionAdapter.signL1Action needs full implementation with ethers.js');
    }
}

/**
 * Create Hyperliquid execution adapter
 * 
 * @param testnet - Use testnet endpoints
 */
export function createHyperliquidExecutionAdapter(testnet: boolean = false): HyperliquidExecutionAdapter {
    return new HyperliquidExecutionAdapter(testnet);
}
