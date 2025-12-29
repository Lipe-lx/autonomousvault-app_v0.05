// ADAPTER
// Execution adapter interface - boundary between core and infrastructure
// Defines how trade execution is abstracted
//
// CRITICAL: Implementations of this adapter handle SIGNING and must remain CLIENT-ONLY

import type { ExecutionIntent } from '../core/types';

/**
 * Order result from execution
 */
export interface OrderResult {
    success: boolean;
    orderId?: string;
    cloid?: string;
    error?: string;
    filledSize?: number;
    filledPrice?: number;
    fees?: number;
}

/**
 * Execution adapter interface
 * 
 * Implementors:
 * - HyperliquidClientExecutor (client-side, uses wallet for signing)
 * - SupabaseEdgeExecutor (server-side, uses encrypted key + password)
 * 
 * ⚠️ NON-CUSTODIAL REQUIREMENT:
 * Server-side implementations MUST:
 * - Receive encrypted private key from client
 * - Receive user's execution password
 * - Decrypt in-memory only
 * - Never persist decrypted keys
 * - Clear memory immediately after signing
 */
export interface ExecutionAdapter {
    /**
     * Execute a trading intent
     * @param intent - The execution intent from core dealer
     * @returns Order result
     */
    execute(intent: ExecutionIntent): Promise<OrderResult>;

    /**
     * Cancel an open order
     * @param coin - Coin symbol
     * @param orderId - Order ID to cancel
     */
    cancelOrder(coin: string, orderId: string): Promise<OrderResult>;

    /**
     * Check if adapter is ready to execute
     * (e.g., wallet connected, credentials available)
     */
    isReady(): boolean;

    /**
     * Get the wallet/account address
     */
    getAddress(): string | null;
}

/**
 * Factory function type for creating execution adapters
 */
export type ExecutionAdapterFactory = () => ExecutionAdapter;
