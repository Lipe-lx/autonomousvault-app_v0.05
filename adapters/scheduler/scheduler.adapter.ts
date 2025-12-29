// ADAPTER
// Scheduler adapter interface - boundary between core and scheduling infrastructure
// Defines how recurring tasks are abstracted (Web Workers, Cron, Edge Functions)

/**
 * Scheduled job status
 */
export type JobStatus = 'active' | 'paused' | 'completed' | 'failed';

/**
 * Scheduled job definition
 */
export interface ScheduledJob {
    id: string;
    name: string;
    intervalMs: number;
    status: JobStatus;
    lastRun?: number;
    nextRun?: number;
    handler: () => Promise<void>;
}

/**
 * Scheduler adapter interface
 * 
 * Implementors:
 * - WebWorkerScheduler (client-side, background-safe)
 * - SupabaseCronScheduler (server-side Edge Functions)
 * 
 * Note: For server-side scheduling, the handler would be
 * a reference to an Edge Function, not an actual function
 */
export interface SchedulerAdapter {
    /**
     * Start a recurring job
     * @param id - Unique job identifier
     * @param intervalMs - Interval between runs in milliseconds
     * @param handler - Function to execute
     */
    start(id: string, intervalMs: number, handler: () => Promise<void>): void;

    /**
     * Stop a running job
     * @param id - Job identifier to stop
     */
    stop(id: string): void;

    /**
     * Check if a job is currently running
     * @param id - Job identifier
     */
    isRunning(id: string): boolean;

    /**
     * Get all active jobs
     */
    getActiveJobs(): ScheduledJob[];

    /**
     * Stop all jobs
     */
    stopAll(): void;
}

/**
 * Background-safe scheduler for browser environments
 * Uses techniques to prevent throttling (Web Workers, Web Locks, etc.)
 */
export interface BackgroundSafeScheduler extends SchedulerAdapter {
    /**
     * Start keep-alive mechanism to prevent tab throttling
     */
    startKeepAlive(): void;

    /**
     * Stop keep-alive mechanism
     */
    stopKeepAlive(): void;

    /**
     * Check if running in background
     */
    isInBackground(): boolean;
}
