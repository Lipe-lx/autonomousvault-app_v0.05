// solanaLPTypes.ts
// Types for Solana LP Dealer: scopes, policies, and audit

// ============================================
// PERMISSION SCOPES (Logical, for logging/audit)
// ============================================

/**
 * LP Operation Scopes - used for logging, audit trail, and confirmation requirements
 * These are logical permissions, not on-chain
 */
export type LPOperationScope =
    | 'EXECUTE_LP_OPS'      // General LP operations
    | 'OPEN_POSITION'       // Open new LP position
    | 'CLOSE_POSITION'      // Close existing position
    | 'REBALANCE_RANGE'     // Adjust price range
    | 'CLAIM_FEES'          // Claim unclaimed fees
    | 'CLAIM_REWARDS';      // Claim farming rewards

// Scope metadata for UI display
export const LP_SCOPE_METADATA: Record<LPOperationScope, { label: string; description: string; riskLevel: 'low' | 'medium' | 'high' }> = {
    EXECUTE_LP_OPS: { label: 'Execute LP Operations', description: 'General LP management', riskLevel: 'medium' },
    OPEN_POSITION: { label: 'Open Position', description: 'Create new liquidity position', riskLevel: 'high' },
    CLOSE_POSITION: { label: 'Close Position', description: 'Remove liquidity from position', riskLevel: 'high' },
    REBALANCE_RANGE: { label: 'Rebalance Range', description: 'Adjust position price range', riskLevel: 'high' },
    CLAIM_FEES: { label: 'Claim Fees', description: 'Collect earned trading fees', riskLevel: 'low' },
    CLAIM_REWARDS: { label: 'Claim Rewards', description: 'Collect farming rewards', riskLevel: 'low' }
};

// ============================================
// POLICY RULES
// ============================================

/**
 * LP Policy Rules - configurable constraints for LP operations
 */
export interface LPPolicyRules {
    // Range constraints
    maxRangeWidthPercent: number;      // Maximum allowed range width (e.g., 50%)
    minRangeWidthPercent: number;      // Minimum allowed range width (e.g., 5%)
    
    // Capital constraints
    maxCapitalPerPoolPercent: number;  // Max % of portfolio in single pool (e.g., 25%)
    maxTotalLPExposurePercent: number; // Max % of portfolio in all LP (e.g., 80%)
    
    // Pool requirements
    minTVLRequired: number;            // Minimum TVL in USD (e.g., 10000)
    minVolumeRequired: number;         // Minimum 24h volume in USD (e.g., 1000)
    minAPYRequired: number;            // Minimum APY (e.g., 5%)
    
    // Token filtering
    tokenAllowlist: string[];          // Only allow these tokens (empty = all allowed)
    tokenBlocklist: string[];          // Block these tokens
    protocolAllowlist: string[];       // Only allow these protocols (empty = all allowed)
    
    // Confirmation requirements
    requireConfirmationFor: LPOperationScope[];  // Which operations need confirmation
    
    // Feature toggles
    enabled: boolean;                  // Policy engine enabled/disabled
}

/**
 * Default policy rules - safe defaults
 */
export const DEFAULT_LP_POLICY: LPPolicyRules = {
    maxRangeWidthPercent: 100,
    minRangeWidthPercent: 1,
    maxCapitalPerPoolPercent: 50,
    maxTotalLPExposurePercent: 100,
    minTVLRequired: 0,
    minVolumeRequired: 0,
    minAPYRequired: 0,
    tokenAllowlist: [],
    tokenBlocklist: [],
    protocolAllowlist: [],
    requireConfirmationFor: ['OPEN_POSITION', 'CLOSE_POSITION', 'REBALANCE_RANGE'],
    enabled: true
};

// ============================================
// AUDIT LOG
// ============================================

/**
 * LP Audit Entry - record of an LP operation
 */
export interface LPAuditEntry {
    id: string;
    timestamp: number;
    scope: LPOperationScope;
    action: string;                    // Human-readable action description
    poolAddress?: string;
    poolName?: string;
    protocol?: string;
    
    // Operation details
    params: Record<string, any>;       // Operation parameters
    rationale: string;                 // AI-generated explanation of decision
    
    // Status tracking
    status: 'pending' | 'confirmed' | 'executed' | 'rejected' | 'failed';
    statusMessage?: string;
    
    // Policy validation
    policyViolations?: string[];       // List of policy violations if any
    policyOverridden?: boolean;        // Was policy manually overridden?
    
    // Transaction
    txSignature?: string;
    
    // Metadata
    userId?: string;
}

// ============================================
// TOOL RESULTS (Enhanced)
// ============================================

/**
 * Semantic types for visual differentiation
 */
export type SemanticType = 'analysis' | 'decision' | 'execution';

/**
 * Enhanced LP Tool Result with semantic typing and rationale
 */
export interface LPToolResult {
    type: 'success' | 'error' | 'info';
    semanticType: SemanticType;
    title: string;
    details: string;
    
    // Rationale log
    rationale?: string;
    
    // Confirmation flow
    requiresConfirmation?: boolean;
    confirmationData?: {
        scope: LPOperationScope;
        action: string;
        poolAddress?: string;
        poolName?: string;
        params: Record<string, any>;
    };
    
    // Transaction
    tx?: string;
}

// ============================================
// SOLANA DEALER STATE
// ============================================

/**
 * Dealer status log entry
 */
export interface SolanaDealerLog {
    id: string;
    timestamp: number;
    type: 'INFO' | 'WARNING' | 'ERROR' | 'OPERATION' | 'POLICY';
    message: string;
    details?: any;
}

/**
 * Position summary for dashboard
 */
export interface LPPositionSummary {
    poolAddress: string;
    poolName: string;
    protocol: 'meteora_dlmm' | 'meteora_damm' | 'raydium_clmm' | 'raydium_cpmm';
    valueUSD: number;
    unclaimedFeesUSD: number;
    inRange: boolean;
    priceRange?: { min: number; max: number };
    currentPrice?: number;
}

/**
 * Solana Dealer Settings
 */
export interface SolanaDealerSettings {
    policy: LPPolicyRules;
    autoClaimFees: boolean;
    autoRebalance: boolean;
    rebalanceThresholdPercent: number;  // Trigger rebalance when out of range by X%
}

/**
 * Solana Dealer State
 */
export interface SolanaDealerState {
    isOn: boolean;
    statusMessage: string;
    statusDetail: string;
    
    // Positions
    activePositions: LPPositionSummary[];
    totalValueUSD: number;
    totalUnclaimedFeesUSD: number;
    
    // Settings
    settings: SolanaDealerSettings;
    
    // Logs
    logs: SolanaDealerLog[];
    auditLog: LPAuditEntry[];
    
    // Pending confirmations
    pendingConfirmation: LPToolResult | null;
}
