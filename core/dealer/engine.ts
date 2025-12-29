// DOMAIN CORE
// Pure dealer engine logic - decision making without execution
// NO infrastructure dependencies allowed
//
// This module contains the pure business logic for:
// - Market context aggregation
// - Decision filtering and prioritization  
// - Position limit checking
// - Risk validation
//
// It does NOT contain:
// - Signing or execution
// - API calls
// - State management
// - Timer/loop management

import type {
    MarketContext,
    BatchAnalysisContext,
    DealerIntent,
    AnalysisResponse,
    ExecutionIntent,
    DealerSettings,
    Position,
    PositionBreakeven,
    UserFees
} from '../types';

/**
 * Filter and prioritize trading decisions from AI analysis
 * 
 * @param decisions - Raw AI decisions
 * @param settings - Dealer settings for thresholds
 * @param currentPositions - Current open positions
 * @returns Filtered and sorted decisions ready for execution
 */
export function prioritizeDecisions(
    decisions: DealerIntent[],
    settings: DealerSettings,
    currentPositions: Position[]
): DealerIntent[] {
    const confidenceThreshold = settings.aggressiveMode ? 0.50 : 0.60;

    // Filter by confidence threshold
    const filtered = decisions.filter(d => {
        // Always allow HOLD
        if (d.action === 'HOLD') return false; // Skip HOLDs from execution

        // Check confidence
        return d.confidence >= confidenceThreshold;
    });

    // Sort by confidence (highest first)
    // CLOSE actions get priority boost (+0.5)
    const sorted = [...filtered].sort((a, b) => {
        const confA = a.confidence + (a.action === 'CLOSE' ? 0.5 : 0);
        const confB = b.confidence + (b.action === 'CLOSE' ? 0.5 : 0);
        return confB - confA;
    });

    return sorted;
}

/**
 * Check if a new position can be opened
 * 
 * @param coin - Coin to open position for
 * @param action - BUY or SELL
 * @param currentPositions - Current open positions
 * @param maxPositions - Maximum allowed positions
 * @returns Object with canOpen flag and reason
 */
export function canOpenPosition(
    coin: string,
    action: 'BUY' | 'SELL',
    currentPositions: Position[],
    maxPositions: number
): { canOpen: boolean; reason?: string } {
    // Check if we already have a position in this coin
    const existingPosition = currentPositions.find(p => p.coin === coin);
    if (existingPosition) {
        return { canOpen: true }; // Can always modify existing position
    }

    // Check max positions limit
    if (currentPositions.length >= maxPositions) {
        return {
            canOpen: false,
            reason: `Max positions reached (${maxPositions})`
        };
    }

    return { canOpen: true };
}

/**
 * Calculate position size with risk constraints
 * 
 * @param suggestedSize - AI suggested size in USDC
 * @param balance - Available balance
 * @param leverage - Leverage to use
 * @param maxPositionSize - Max position size setting
 * @returns Adjusted position size
 */
export function calculatePositionSize(
    suggestedSize: number,
    balance: number,
    leverage: number,
    maxPositionSize?: number
): number {
    let size = suggestedSize;

    // Cap to max position size if set
    if (maxPositionSize) {
        size = Math.min(size, maxPositionSize);
    }

    // Cap to 95% of affordable size
    const maxAffordable = balance * leverage * 0.95;
    size = Math.min(size, maxAffordable);

    return size;
}

/**
 * Validate leverage against user limits
 * 
 * @param suggestedLeverage - AI suggested leverage
 * @param maxLeverage - User's max leverage setting
 * @returns Capped leverage value
 */
export function validateLeverage(
    suggestedLeverage: number,
    maxLeverage: number
): { leverage: number; wasCapped: boolean } {
    const leverage = Math.min(suggestedLeverage, maxLeverage);
    return {
        leverage,
        wasCapped: suggestedLeverage > maxLeverage
    };
}

/**
 * Calculate position breakeven prices
 * Pure calculation based on entry price, fees, and funding
 * 
 * @param positions - Current positions
 * @param userFees - User's fee tier
 * @param fundingRates - Map of coin to funding rate
 * @returns Array of breakeven calculations
 */
export function calculatePositionBreakevens(
    positions: Position[],
    userFees: UserFees,
    fundingRates: Map<string, number>
): PositionBreakeven[] {
    return positions.map(pos => {
        const fundingRate = fundingRates.get(pos.coin) || 0;
        const totalFees = userFees.takerFee * 2; // Entry + exit
        const fundingCost = Math.abs(fundingRate) * 24; // Daily estimate

        const totalCostPercent = totalFees + fundingCost;
        const direction = pos.side === 'LONG' ? 1 : -1;

        const breakevenPrice = pos.entryPrice * (1 + direction * totalCostPercent);
        const minProfitPrice = pos.entryPrice * (1 + direction * (totalCostPercent + 0.001)); // 0.1% min profit

        const currentPnlPercent = pos.unrealizedPnl / (pos.entryPrice * Math.abs(pos.size)) * 100;

        return {
            coin: pos.coin,
            entryPrice: pos.entryPrice,
            breakevenPrice,
            minProfitPrice,
            currentPnlPercent,
            isAboveBreakeven: pos.side === 'LONG'
                ? pos.entryPrice * (1 + currentPnlPercent / 100) > breakevenPrice
                : pos.entryPrice * (1 - currentPnlPercent / 100) < breakevenPrice
        };
    });
}

/**
 * Convert DealerIntent to ExecutionIntent
 * Applies all validations and adjustments
 */
export function intentToExecution(
    intent: DealerIntent,
    context: {
        marketPrice: number;
        balance: number;
        settings: DealerSettings;
        cloid: string;
    }
): ExecutionIntent | null {
    const { settings, balance, marketPrice, cloid } = context;

    // Validate leverage
    const { leverage, wasCapped } = validateLeverage(
        intent.suggestedLeverage || settings.maxLeverage,
        settings.maxLeverage
    );

    // Calculate size
    const sizeUSDC = calculatePositionSize(
        intent.suggestedSizeUSDC || settings.maxPositionSizeUSDC || 20,
        balance,
        leverage,
        settings.maxPositionSizeUSDC
    );

    // Minimum size check
    if (sizeUSDC < 10 && intent.action !== 'CLOSE') {
        return null; // Too small
    }

    return {
        coin: intent.coin,
        action: intent.action,
        type: intent.orderType || 'limit',
        price: intent.price || marketPrice,
        sizeUSDC,
        leverage,
        reason: intent.reason,
        cloid,
        stopLoss: intent.stopLossPrice,
        takeProfit: intent.takeProfitPrice
    };
}
