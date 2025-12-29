// ADAPTER
// WebWorker Scheduler Adapter
// Implements SchedulerAdapter using Web Workers
//
// Web Workers run in a separate thread and are NOT subject to
// browser throttling of background tabs

import type { SchedulerAdapter, ScheduledJob, ScheduleOptions, SchedulerMetrics } from './scheduler.adapter';

/**
 * Callback function type for timer ticks
 */
type TickCallback = (timestamp: number) => void;

/**
 * WebWorker-based scheduler that resists browser throttling
 */
export class WebWorkerSchedulerAdapter implements SchedulerAdapter {
    private worker: Worker | null = null;
    private callbacks = new Map<string, TickCallback>();
    private jobs = new Map<string, ScheduledJob>();
    private fallbackTimers = new Map<string, ReturnType<typeof setInterval>>();
    private isSupported: boolean;

    constructor() {
        this.isSupported = typeof Worker !== 'undefined';

        if (this.isSupported) {
            this.initWorker();
        } else {
            console.warn('[WebWorkerScheduler] Web Workers not supported, using fallback');
        }
    }

    /**
     * Initialize the Web Worker with inline code
     */
    private initWorker(): void {
        try {
            const workerCode = `
        const timers = new Map();
        
        self.onmessage = (event) => {
          const { type, timerId, intervalMs } = event.data;
          
          if (type === 'START' && timerId && intervalMs) {
            if (timers.has(timerId)) {
              clearInterval(timers.get(timerId));
            }
            const id = setInterval(() => {
              self.postMessage({ type: 'TICK', timerId, timestamp: Date.now() });
            }, intervalMs);
            timers.set(timerId, id);
          }
          
          if (type === 'STOP' && timerId) {
            if (timers.has(timerId)) {
              clearInterval(timers.get(timerId));
              timers.delete(timerId);
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
                        console.error(`[WebWorkerScheduler] Error in callback for "${timerId}":`, err);
                    }
                }
            };

            this.worker.onerror = (err) => {
                console.error('[WebWorkerScheduler] Worker error:', err);
            };

            console.log('[WebWorkerScheduler] Web Worker initialized');
        } catch (err) {
            console.error('[WebWorkerScheduler] Failed to initialize Worker:', err);
            this.isSupported = false;
        }
    }

    /**
     * Schedule a recurring job
     */
    async schedule(
        jobId: string,
        callback: () => Promise<void> | void,
        options: ScheduleOptions
    ): Promise<ScheduledJob> {
        const job: ScheduledJob = {
            id: jobId,
            status: 'scheduled',
            nextRun: Date.now() + options.intervalMs,
            lastRun: null
        };

        this.jobs.set(jobId, job);

        const wrappedCallback: TickCallback = async (timestamp) => {
            const currentJob = this.jobs.get(jobId);
            if (!currentJob) return;

            currentJob.status = 'running';
            currentJob.lastRun = timestamp;

            try {
                await callback();
                currentJob.status = 'scheduled';
                currentJob.nextRun = timestamp + options.intervalMs;
            } catch (err) {
                currentJob.status = 'failed';
                currentJob.error = err instanceof Error ? err.message : 'Unknown error';
            }
        };

        this.callbacks.set(jobId, wrappedCallback);

        if (this.worker) {
            this.worker.postMessage({ type: 'START', timerId: jobId, intervalMs: options.intervalMs });
        } else {
            const fallbackId = setInterval(() => wrappedCallback(Date.now()), options.intervalMs);
            this.fallbackTimers.set(jobId, fallbackId);
        }

        return job;
    }

    /**
     * Cancel a scheduled job
     */
    async cancel(jobId: string): Promise<boolean> {
        if (!this.jobs.has(jobId)) return false;

        this.callbacks.delete(jobId);
        this.jobs.delete(jobId);

        if (this.worker) {
            this.worker.postMessage({ type: 'STOP', timerId: jobId });
        }

        if (this.fallbackTimers.has(jobId)) {
            clearInterval(this.fallbackTimers.get(jobId));
            this.fallbackTimers.delete(jobId);
        }

        return true;
    }

    /**
     * Pause a job
     */
    async pause(jobId: string): Promise<boolean> {
        const job = this.jobs.get(jobId);
        if (!job) return false;

        job.status = 'paused';
        if (this.worker) {
            this.worker.postMessage({ type: 'STOP', timerId: jobId });
        }
        return true;
    }

    /**
     * Resume a paused job
     */
    async resume(jobId: string): Promise<boolean> {
        const job = this.jobs.get(jobId);
        if (!job || job.status !== 'paused') return false;

        job.status = 'scheduled';
        // Note: Would need to re-schedule with original interval
        return true;
    }

    /**
     * Get job status
     */
    async getJobStatus(jobId: string): Promise<ScheduledJob | null> {
        return this.jobs.get(jobId) || null;
    }

    /**
     * Get all active jobs
     */
    async getActiveJobs(): Promise<ScheduledJob[]> {
        return Array.from(this.jobs.values());
    }

    /**
     * Update job interval
     */
    updateInterval(jobId: string, intervalMs: number): void {
        if (this.worker && this.callbacks.has(jobId)) {
            this.worker.postMessage({ type: 'UPDATE_INTERVAL', timerId: jobId, intervalMs });
        } else if (this.fallbackTimers.has(jobId)) {
            const callback = this.callbacks.get(jobId);
            if (callback) {
                clearInterval(this.fallbackTimers.get(jobId));
                const newId = setInterval(() => callback(Date.now()), intervalMs);
                this.fallbackTimers.set(jobId, newId);
            }
        }
    }

    /**
     * Check if a timer is running
     */
    isRunning(jobId: string): boolean {
        const job = this.jobs.get(jobId);
        return job?.status === 'scheduled' || job?.status === 'running';
    }

    /**
     * Destroy scheduler and all timers
     */
    destroy(): void {
        for (const jobId of this.callbacks.keys()) {
            this.cancel(jobId);
        }

        if (this.worker) {
            this.worker.terminate();
            this.worker = null;
        }

        this.callbacks.clear();
        this.jobs.clear();
        this.fallbackTimers.clear();
    }
}

/**
 * Create WebWorker scheduler adapter
 */
export function createWebWorkerSchedulerAdapter(): WebWorkerSchedulerAdapter {
    return new WebWorkerSchedulerAdapter();
}
