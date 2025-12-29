// ADAPTER
// AI Request Queue with Rate Limiting
// Extracted from v0.03 services/ai/requestQueue.ts
//
// Global singleton queue for all AI API calls
// Handles rate limiting, retries, and priority ordering

import { AIProviderType, PROVIDER_QUEUE_CONFIGS, QueueConfig } from './types';

/**
 * Request priority levels
 */
export type RequestPriority = 'CRITICAL' | 'HIGH' | 'NORMAL' | 'LOW';

/**
 * Queue metrics for monitoring
 */
export interface QueueMetrics {
    queueLength: number;
    avgWaitTimeMs: number;
    successCount: number;
    failureCount: number;
    lastRequestTime: number;
    consecutiveRateLimits: number;
    isProcessing: boolean;
}

/**
 * Queue request definition
 */
export interface QueueRequest<T = any> {
    priority: RequestPriority;
    source: 'operator' | 'hyperliquidDealer' | 'polymarketDealer' | 'unknown';
    execute: () => Promise<T>;
    provider?: AIProviderType;
}

/**
 * Internal queued request with metadata
 */
interface QueuedRequest<T = any> {
    id: string;
    priority: RequestPriority;
    source: string;
    execute: () => Promise<T>;
    resolve: (value: T) => void;
    reject: (error: any) => void;
    timestamp: number;
    retries: number;
    provider: AIProviderType;
}

/**
 * Priority weights for sorting
 */
const PRIORITY_WEIGHTS: Record<RequestPriority, number> = {
    'CRITICAL': 100,
    'HIGH': 75,
    'NORMAL': 50,
    'LOW': 25
};

/**
 * AI Request Queue - Singleton
 * Handles rate limiting and retry logic for all AI API calls
 */
export class AIRequestQueue {
    private static instance: AIRequestQueue;

    private queue: QueuedRequest[] = [];
    private isProcessing: boolean = false;
    private lastRequestTime: number = 0;
    private consecutiveRateLimits: number = 0;
    private blockedUntil: number = 0;

    // Metrics
    private successCount: number = 0;
    private failureCount: number = 0;
    private totalWaitTimeMs: number = 0;
    private requestCount: number = 0;

    // Default config (Gemini)
    private config: QueueConfig = {
        minIntervalMs: 5000,
        maxRetries: 5,
        baseBackoffMs: 5000,
        maxBackoffMs: 120000,
        jitterMs: 1000
    };

    private constructor() {
        console.log('[AIRequestQueue] Initialized global request queue');
    }

    static getInstance(): AIRequestQueue {
        if (!AIRequestQueue.instance) {
            AIRequestQueue.instance = new AIRequestQueue();
        }
        return AIRequestQueue.instance;
    }

    /**
     * Update queue configuration based on provider
     */
    setConfig(provider: AIProviderType): void {
        const config = PROVIDER_QUEUE_CONFIGS[provider];
        if (config) {
            this.config = { ...config };
            console.log(`[AIRequestQueue] Config updated for provider: ${provider}`);
        }
    }

    /**
     * Enqueue a request and return a promise that resolves when complete
     */
    enqueue<T>(request: QueueRequest<T>): Promise<T> {
        return new Promise((resolve, reject) => {
            const id = this.generateId();
            const queuedRequest: QueuedRequest<T> = {
                id,
                priority: request.priority,
                source: request.source,
                execute: request.execute,
                resolve,
                reject,
                timestamp: Date.now(),
                retries: 0,
                provider: request.provider || 'gemini'
            };

            this.insertByPriority(queuedRequest);

            const position = this.queue.findIndex(r => r.id === id) + 1;
            console.log(`[AIRequestQueue] Queued #${id.slice(-6)} (pos: ${position}, priority: ${request.priority})`);

            if (!this.isProcessing) {
                this.processQueue();
            }
        });
    }

    /**
     * Insert request maintaining priority order
     */
    private insertByPriority(request: QueuedRequest): void {
        const weight = PRIORITY_WEIGHTS[request.priority];
        let insertIndex = this.queue.length;

        for (let i = 0; i < this.queue.length; i++) {
            const existingWeight = PRIORITY_WEIGHTS[this.queue[i].priority];
            if (weight > existingWeight) {
                insertIndex = i;
                break;
            }
        }

        this.queue.splice(insertIndex, 0, request);
    }

    /**
     * Main queue processing loop
     */
    private async processQueue(): Promise<void> {
        if (this.isProcessing) return;
        this.isProcessing = true;

        while (this.queue.length > 0) {
            const request = this.queue.shift()!;

            try {
                await this.waitForSlot();

                const result = await this.executeWithRetry(request);
                const waitTime = Date.now() - request.timestamp;

                this.successCount++;
                this.totalWaitTimeMs += waitTime;
                this.requestCount++;
                this.consecutiveRateLimits = 0;

                request.resolve(result);

            } catch (error: any) {
                this.failureCount++;
                console.error(`[AIRequestQueue] Request #${request.id.slice(-6)} failed:`, error.message);
                request.reject(error);
            }
        }

        this.isProcessing = false;
    }

    /**
     * Execute request with retry logic
     */
    private async executeWithRetry<T>(request: QueuedRequest<T>): Promise<T> {
        let lastError: any;

        for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
            try {
                if (attempt > 0) {
                    console.log(`[AIRequestQueue] Retry ${attempt}/${this.config.maxRetries} for #${request.id.slice(-6)}`);
                }

                const result = await request.execute();
                return result;

            } catch (error: any) {
                lastError = error;

                if (this.isRateLimitError(error)) {
                    const retryDelay = this.parseRetryDelay(error);
                    this.handleRateLimit(retryDelay);

                    if (attempt < this.config.maxRetries) {
                        await this.waitForSlot();
                        continue;
                    }
                }

                if (attempt === this.config.maxRetries) break;

                const backoffMs = this.calculateBackoff(attempt);
                await this.sleep(backoffMs);
            }
        }

        throw lastError;
    }

    /**
     * Wait for an available slot before making request
     */
    private async waitForSlot(): Promise<void> {
        const now = Date.now();

        if (this.blockedUntil > now) {
            const waitTime = this.blockedUntil - now;
            console.log(`[AIRequestQueue] Rate limited, waiting ${(waitTime / 1000).toFixed(1)}s...`);
            await this.sleep(waitTime);
        }

        const backoffMultiplier = Math.pow(2, Math.min(this.consecutiveRateLimits, 6));
        const effectiveInterval = this.config.minIntervalMs * backoffMultiplier;
        const cappedInterval = Math.min(effectiveInterval, this.config.maxBackoffMs);
        const jitter = Math.random() * this.config.jitterMs;
        const totalInterval = cappedInterval + jitter;

        const timeSinceLastRequest = now - this.lastRequestTime;
        if (timeSinceLastRequest < totalInterval) {
            const waitTime = totalInterval - timeSinceLastRequest;
            await this.sleep(waitTime);
        }

        this.lastRequestTime = Date.now();
    }

    /**
     * Handle rate limit error
     */
    private handleRateLimit(retryAfterSeconds: number): void {
        this.consecutiveRateLimits++;

        const exponentialBuffer = Math.min(
            this.config.baseBackoffMs + (Math.pow(2, this.consecutiveRateLimits) * 5000),
            this.config.maxBackoffMs
        );

        this.blockedUntil = Date.now() + (retryAfterSeconds * 1000) + exponentialBuffer;
    }

    /**
     * Calculate exponential backoff delay
     */
    private calculateBackoff(attempt: number): number {
        const exponentialDelay = this.config.baseBackoffMs * Math.pow(2, attempt);
        const jitter = Math.random() * this.config.jitterMs;
        return Math.min(exponentialDelay + jitter, this.config.maxBackoffMs);
    }

    /**
     * Check if error is rate limit related
     */
    private isRateLimitError(error: any): boolean {
        const message = typeof error === 'string' ? error : JSON.stringify(error);
        return message.includes('429') ||
            message.includes('RESOURCE_EXHAUSTED') ||
            message.includes('Too Many Requests') ||
            message.includes('quota') ||
            message.includes('rate_limit') ||
            message.includes('rate limit');
    }

    /**
     * Parse retry delay from error response
     */
    private parseRetryDelay(error: any): number {
        try {
            const message = typeof error === 'string' ? error : JSON.stringify(error);

            const retryMatch = message.match(/retry in (\d+\.?\d*)s/i);
            if (retryMatch) return Math.ceil(parseFloat(retryMatch[1]));

            const delayMatch = message.match(/"retryDelay"\s*:\s*"(\d+)s?"/i);
            if (delayMatch) return parseInt(delayMatch[1]);

            const retryAfterMatch = message.match(/retry-after[:\s]+(\d+)/i);
            if (retryAfterMatch) return parseInt(retryAfterMatch[1]);
        } catch (e) { }

        return 30;
    }

    private generateId(): string {
        return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Get queue metrics
     */
    getMetrics(): QueueMetrics {
        return {
            queueLength: this.queue.length,
            avgWaitTimeMs: this.requestCount > 0 ? this.totalWaitTimeMs / this.requestCount : 0,
            successCount: this.successCount,
            failureCount: this.failureCount,
            lastRequestTime: this.lastRequestTime,
            consecutiveRateLimits: this.consecutiveRateLimits,
            isProcessing: this.isProcessing
        };
    }

    /**
     * Clear the queue
     */
    clear(): void {
        this.queue.forEach(req => req.reject(new Error('Queue cleared')));
        this.queue = [];
    }

    /**
     * Reset metrics
     */
    resetMetrics(): void {
        this.successCount = 0;
        this.failureCount = 0;
        this.totalWaitTimeMs = 0;
        this.requestCount = 0;
    }
}

// Export singleton instance
export const aiRequestQueue = AIRequestQueue.getInstance();
