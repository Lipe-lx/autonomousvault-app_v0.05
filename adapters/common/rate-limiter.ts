// ADAPTER
// Rate Limiter with Weight-Based Budgeting
// Extracted from v0.03 hyperliquidService.ts
//
// Implements sliding window rate limiting with priority support

/**
 * Endpoint weight configuration
 */
export interface EndpointWeights {
    [endpoint: string]: number;
}

/**
 * Default Hyperliquid endpoint weights
 */
export const HYPERLIQUID_ENDPOINT_WEIGHTS: EndpointWeights = {
    'allMids': 2,
    'l2Book': 2,
    'clearinghouseState': 20,
    'exchangeStatus': 2,
    'meta': 20,
    'metaAndAssetCtxs': 20,
    'candleSnapshot': 20, // Base weight, additional per 60 items
    'userFills': 20,
    'openOrders': 20,
    'userRole': 60,
    'default': 20
};

/**
 * Rate limiter configuration
 */
export interface RateLimiterConfig {
    /** Budget per minute (Hyperliquid: 1200) */
    budgetPerMinute: number;
    /** Sliding window in milliseconds (typically 60000) */
    windowMs: number;
    /** Endpoint-specific weights */
    endpointWeights: EndpointWeights;
}

/**
 * Weight entry for history tracking
 */
interface WeightEntry {
    timestamp: number;
    weight: number;
}

/**
 * Weight-based Rate Limiter
 * 
 * Uses sliding window to track request weights and throttle as needed.
 * Supports priority lock for dealer cycles.
 */
export class WeightBasedRateLimiter {
    private config: RateLimiterConfig;
    private weightHistory: WeightEntry[] = [];

    // Priority lock system
    private priorityLockActive = false;
    private priorityLockResolver: (() => void) | null = null;
    private waitingForUnlock: Promise<void> = Promise.resolve();

    constructor(config: RateLimiterConfig) {
        this.config = config;
    }

    /**
     * Acquire priority lock - gives exclusive access
     */
    acquirePriorityLock(): void {
        if (this.priorityLockActive) return;

        this.priorityLockActive = true;
        this.waitingForUnlock = new Promise(resolve => {
            this.priorityLockResolver = resolve;
        });

        console.log('[RateLimiter] Priority lock ACQUIRED');
    }

    /**
     * Release priority lock
     */
    releasePriorityLock(): void {
        if (!this.priorityLockActive) return;

        this.priorityLockActive = false;
        if (this.priorityLockResolver) {
            this.priorityLockResolver();
            this.priorityLockResolver = null;
        }
        this.waitingForUnlock = Promise.resolve();

        console.log('[RateLimiter] Priority lock RELEASED');
    }

    /**
     * Check if priority lock is active
     */
    isPriorityLocked(): boolean {
        return this.priorityLockActive;
    }

    /**
     * Get current weight used in sliding window
     */
    getCurrentWeight(): number {
        const now = Date.now();
        const windowStart = now - this.config.windowMs;

        // Clean old entries and sum current weight
        this.weightHistory = this.weightHistory.filter(entry => entry.timestamp > windowStart);
        return this.weightHistory.reduce((sum, entry) => sum + entry.weight, 0);
    }

    /**
     * Get available budget
     */
    getAvailableBudget(): number {
        return this.config.budgetPerMinute - this.getCurrentWeight();
    }

    /**
     * Record a request's weight
     */
    recordWeight(weight: number): void {
        this.weightHistory.push({ timestamp: Date.now(), weight });
    }

    /**
     * Calculate weight for a request
     */
    calculateWeight(endpointType: string, itemCount?: number): number {
        const baseWeight = this.config.endpointWeights[endpointType] ||
            this.config.endpointWeights['default'] || 20;

        // candleSnapshot has additional weight per 60 items
        if (endpointType === 'candleSnapshot' && itemCount) {
            return baseWeight + Math.ceil(itemCount / 60);
        }

        return baseWeight;
    }

    /**
     * Wait until budget is available
     */
    async waitForBudget(weight: number): Promise<void> {
        // If priority lock is active and we're not the holder, wait
        if (this.priorityLockActive) {
            await this.waitingForUnlock;
        }

        const currentWeight = this.getCurrentWeight();
        const availableBudget = this.config.budgetPerMinute - currentWeight;

        if (weight <= availableBudget) {
            return; // We have budget
        }

        // Calculate wait time for oldest entries to expire
        const now = Date.now();
        const windowStart = now - this.config.windowMs;
        const sortedHistory = [...this.weightHistory].sort((a, b) => a.timestamp - b.timestamp);

        let weightToFree = weight - availableBudget;
        let waitUntil = now;

        for (const entry of sortedHistory) {
            if (entry.timestamp <= windowStart) continue;
            weightToFree -= entry.weight;
            waitUntil = entry.timestamp + this.config.windowMs;
            if (weightToFree <= 0) break;
        }

        const waitTime = Math.max(0, waitUntil - now);
        if (waitTime > 0) {
            console.log(`[RateLimiter] Budget: ${currentWeight}/${this.config.budgetPerMinute}, waiting ${(waitTime / 1000).toFixed(1)}s...`);
            await new Promise(resolve => setTimeout(resolve, waitTime + 100));
        }
    }

    /**
     * Execute a request with rate limiting
     */
    async execute<T>(
        fn: () => Promise<T>,
        endpointType: string = 'default',
        itemCount?: number
    ): Promise<T> {
        const weight = this.calculateWeight(endpointType, itemCount);
        await this.waitForBudget(weight);

        try {
            const result = await fn();
            this.recordWeight(weight);
            return result;
        } catch (error) {
            // Still record weight on error (request was made)
            this.recordWeight(weight);
            throw error;
        }
    }

    /**
     * Get metrics
     */
    getMetrics(): { currentWeight: number; available: number; historySize: number } {
        return {
            currentWeight: this.getCurrentWeight(),
            available: this.getAvailableBudget(),
            historySize: this.weightHistory.length
        };
    }

    /**
     * Reset rate limiter
     */
    reset(): void {
        this.weightHistory = [];
        this.releasePriorityLock();
    }
}

/**
 * Create Hyperliquid-configured rate limiter
 */
export function createHyperliquidRateLimiter(): WeightBasedRateLimiter {
    return new WeightBasedRateLimiter({
        budgetPerMinute: 1200,
        windowMs: 60000,
        endpointWeights: HYPERLIQUID_ENDPOINT_WEIGHTS
    });
}
