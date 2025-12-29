// services/backgroundTimer.ts
// Web Worker-based timer service that is NOT throttled in background tabs
// Browsers throttle setInterval/setTimeout in background tabs to 1x/min after 5min
// Web Workers run in a separate thread and are NOT subject to this throttling

type TickCallback = (timestamp: number) => void;

class BackgroundTimerService {
    private worker: Worker | null = null;
    private callbacks = new Map<string, TickCallback>();
    private fallbackTimers = new Map<string, ReturnType<typeof setInterval>>();
    private isSupported: boolean;

    constructor() {
        this.isSupported = typeof Worker !== 'undefined';

        if (this.isSupported) {
            this.initWorker();
        } else {
            console.warn('[BackgroundTimer] ⚠️ Web Workers not supported, falling back to setInterval (will be throttled in background)');
        }
    }

    private initWorker() {
        try {
            // Create worker from inline code (Blob) for Vite/bundler compatibility
            // This avoids needing a separate worker file that bundlers might miss
            const workerCode = `
                const timers = new Map();
                
                self.onmessage = (event) => {
                    const { type, timerId, intervalMs } = event.data;
                    
                    if (type === 'START' && timerId && intervalMs) {
                        // Clear existing timer if any
                        if (timers.has(timerId)) {
                            clearInterval(timers.get(timerId));
                        }
                        
                        // Start new timer
                        const id = setInterval(() => {
                            self.postMessage({ type: 'TICK', timerId, timestamp: Date.now() });
                        }, intervalMs);
                        timers.set(timerId, id);
                        
                        // Log start (visible in browser console under Worker context)
                        console.log('[TimerWorker] Started timer "' + timerId + '" with ' + intervalMs + 'ms interval');
                    }
                    
                    if (type === 'STOP' && timerId) {
                        if (timers.has(timerId)) {
                            clearInterval(timers.get(timerId));
                            timers.delete(timerId);
                            console.log('[TimerWorker] Stopped timer "' + timerId + '"');
                        }
                    }
                    
                    if (type === 'UPDATE_INTERVAL' && timerId && intervalMs) {
                        if (timers.has(timerId)) {
                            clearInterval(timers.get(timerId));
                        }
                        const id = setInterval(() => {
                            self.postMessage({ type: 'TICK', timerId, timestamp: Date.now() });
                        }, intervalMs);
                        timers.set(timerId, id);
                        console.log('[TimerWorker] Updated timer "' + timerId + '" to ' + intervalMs + 'ms');
                    }
                };
            `;

            const blob = new Blob([workerCode], { type: 'application/javascript' });
            this.worker = new Worker(URL.createObjectURL(blob));

            this.worker.onmessage = (event) => {
                const { type, timerId, timestamp } = event.data;
                if (type === 'TICK' && this.callbacks.has(timerId)) {
                    try {
                        this.callbacks.get(timerId)!(timestamp);
                    } catch (err) {
                        console.error(`[BackgroundTimer] Error in callback for "${timerId}":`, err);
                    }
                }
            };

            this.worker.onerror = (err) => {
                console.error('[BackgroundTimer] Worker error:', err);
            };

            console.log('[BackgroundTimer] ✅ Web Worker initialized - timers will run in background');
        } catch (err) {
            console.error('[BackgroundTimer] Failed to initialize Worker:', err);
            this.isSupported = false;
        }
    }

    /**
     * Start a background-safe timer that won't be throttled
     * @param timerId Unique identifier for this timer
     * @param intervalMs Interval in milliseconds
     * @param callback Function to call on each tick
     */
    start(timerId: string, intervalMs: number, callback: TickCallback): void {
        // Store callback
        this.callbacks.set(timerId, callback);

        if (this.worker) {
            // Use Web Worker (not throttled)
            this.worker.postMessage({ type: 'START', timerId, intervalMs });
        } else {
            // Fallback to regular setInterval (will be throttled in background)
            console.warn(`[BackgroundTimer] Using fallback for "${timerId}" - may be throttled in background`);
            const fallbackId = setInterval(() => callback(Date.now()), intervalMs);
            this.fallbackTimers.set(timerId, fallbackId);
        }
    }

    /**
     * Stop a timer
     */
    stop(timerId: string): void {
        this.callbacks.delete(timerId);

        if (this.worker) {
            this.worker.postMessage({ type: 'STOP', timerId });
        }

        // Also clear fallback if it exists
        if (this.fallbackTimers.has(timerId)) {
            clearInterval(this.fallbackTimers.get(timerId));
            this.fallbackTimers.delete(timerId);
        }
    }

    /**
     * Update timer interval without stopping
     */
    updateInterval(timerId: string, intervalMs: number): void {
        if (this.worker && this.callbacks.has(timerId)) {
            this.worker.postMessage({ type: 'UPDATE_INTERVAL', timerId, intervalMs });
        } else if (this.fallbackTimers.has(timerId)) {
            // For fallback, we need to recreate the timer
            const callback = this.callbacks.get(timerId);
            if (callback) {
                clearInterval(this.fallbackTimers.get(timerId));
                const newId = setInterval(() => callback(Date.now()), intervalMs);
                this.fallbackTimers.set(timerId, newId);
            }
        }
    }

    /**
     * Check if a timer is currently running
     */
    isRunning(timerId: string): boolean {
        return this.callbacks.has(timerId);
    }

    /**
     * Get all active timer IDs
     */
    getActiveTimers(): string[] {
        return Array.from(this.callbacks.keys());
    }

    /**
     * Clean up worker and all timers
     */
    destroy(): void {
        // Stop all timers
        for (const timerId of this.callbacks.keys()) {
            this.stop(timerId);
        }

        // Terminate worker
        if (this.worker) {
            this.worker.terminate();
            this.worker = null;
        }

        this.callbacks.clear();
        this.fallbackTimers.clear();
    }
}

// Singleton instance with HMR support
const globalAny: any = typeof window !== 'undefined' ? window : {};

// Only expose to window in development for HMR support
// In production, this prevents console access to the timer service
if (import.meta.env.DEV) {
    if (globalAny.__backgroundTimer) {
        console.log('[BackgroundTimer] Cleaning up old instance for HMR...');
        globalAny.__backgroundTimer.destroy();
    }
    globalAny.__backgroundTimer = new BackgroundTimerService();
}

export const backgroundTimer = import.meta.env.DEV
    ? globalAny.__backgroundTimer
    : new BackgroundTimerService();

