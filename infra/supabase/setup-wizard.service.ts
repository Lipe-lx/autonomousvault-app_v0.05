// SUPABASE INFRA
// Setup Wizard Service
// Handles one-click Supabase project setup and connection validation

import {
    initializeSupabaseWithCredentials,
    getSupabaseClient,
    isSupabaseConnected,
    getConnectionStatus,
    ConnectionStatus
} from './client';

/**
 * Setup step status
 */
export type SetupStepStatus = 'pending' | 'in-progress' | 'completed' | 'error';

/**
 * Setup step
 */
export interface SetupStep {
    id: string;
    label: string;
    status: SetupStepStatus;
    error?: string;
}

/**
 * Validation result
 */
export interface ValidationResult {
    valid: boolean;
    errors: string[];
}

/**
 * Connection test result
 */
export interface ConnectionTestResult {
    success: boolean;
    projectId: string | null;
    features: {
        database: boolean;
        auth: boolean;
        edgeFunctions: boolean;
    };
    error?: string;
}

/**
 * Stored credentials (persisted in localStorage)
 */
interface StoredCredentials {
    url: string;
    anonKey: string;
    projectId: string;
    connectedAt: string;
}

const CREDENTIALS_KEY = 'autonomousvault_supabase_credentials';

/**
 * Setup Wizard Service
 */
export class SetupWizardService {
    private steps: SetupStep[] = [
        { id: 'validate', label: 'Validating credentials', status: 'pending' },
        { id: 'connect', label: 'Connecting to Supabase', status: 'pending' },
        { id: 'test-db', label: 'Testing database access', status: 'pending' },
        { id: 'test-auth', label: 'Verifying auth configuration', status: 'pending' },
    ];

    /**
     * Get current setup steps
     */
    getSteps(): SetupStep[] {
        return [...this.steps];
    }

    /**
     * Validate Supabase URL format
     */
    validateUrl(url: string): ValidationResult {
        const errors: string[] = [];

        if (!url) {
            errors.push('URL is required');
        } else if (!url.startsWith('https://')) {
            errors.push('URL must start with https://');
        } else if (!url.includes('.supabase.co')) {
            errors.push('URL must be a Supabase project URL (*.supabase.co)');
        }

        return { valid: errors.length === 0, errors };
    }

    /**
     * Validate anon key format
     */
    validateAnonKey(anonKey: string): ValidationResult {
        const errors: string[] = [];

        if (!anonKey) {
            errors.push('Anon key is required');
        } else if (anonKey.length < 100) {
            errors.push('Anon key appears to be invalid (too short)');
        } else if (!anonKey.startsWith('eyJ')) {
            errors.push('Anon key should be a JWT token');
        }

        return { valid: errors.length === 0, errors };
    }

    /**
     * Run full setup flow
     */
    async runSetup(
        url: string,
        anonKey: string,
        onProgress?: (step: SetupStep) => void
    ): Promise<ConnectionTestResult> {
        // Reset steps
        this.steps.forEach(s => {
            s.status = 'pending';
            s.error = undefined;
        });

        try {
            // Step 1: Validate
            this.updateStep('validate', 'in-progress');
            onProgress?.(this.getStep('validate')!);

            const urlValidation = this.validateUrl(url);
            const keyValidation = this.validateAnonKey(anonKey);

            if (!urlValidation.valid || !keyValidation.valid) {
                const errors = [...urlValidation.errors, ...keyValidation.errors];
                this.updateStep('validate', 'error', errors.join(', '));
                onProgress?.(this.getStep('validate')!);
                return {
                    success: false,
                    projectId: null,
                    features: { database: false, auth: false, edgeFunctions: false },
                    error: errors.join(', '),
                };
            }

            this.updateStep('validate', 'completed');
            onProgress?.(this.getStep('validate')!);

            // Step 2: Connect
            this.updateStep('connect', 'in-progress');
            onProgress?.(this.getStep('connect')!);

            const connectionResult = await initializeSupabaseWithCredentials(url, anonKey);

            if (!connectionResult.connected) {
                this.updateStep('connect', 'error', connectionResult.error || 'Connection failed');
                onProgress?.(this.getStep('connect')!);
                return {
                    success: false,
                    projectId: null,
                    features: { database: false, auth: false, edgeFunctions: false },
                    error: connectionResult.error || 'Connection failed',
                };
            }

            this.updateStep('connect', 'completed');
            onProgress?.(this.getStep('connect')!);

            // Step 3: Test database
            this.updateStep('test-db', 'in-progress');
            onProgress?.(this.getStep('test-db')!);

            const dbTest = await this.testDatabase();
            if (!dbTest) {
                this.updateStep('test-db', 'error', 'Database access failed');
                onProgress?.(this.getStep('test-db')!);
                // Continue anyway - might be first setup
            } else {
                this.updateStep('test-db', 'completed');
                onProgress?.(this.getStep('test-db')!);
            }

            // Step 4: Test auth
            this.updateStep('test-auth', 'in-progress');
            onProgress?.(this.getStep('test-auth')!);

            const authTest = await this.testAuth();
            this.updateStep('test-auth', authTest ? 'completed' : 'error');
            onProgress?.(this.getStep('test-auth')!);

            // Store credentials
            this.storeCredentials(url, anonKey, connectionResult.projectId || '');

            return {
                success: true,
                projectId: connectionResult.projectId,
                features: {
                    database: dbTest,
                    auth: authTest,
                    edgeFunctions: true, // Assume available
                },
            };

        } catch (error) {
            return {
                success: false,
                projectId: null,
                features: { database: false, auth: false, edgeFunctions: false },
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    }

    /**
     * Test database connection
     */
    private async testDatabase(): Promise<boolean> {
        const client = getSupabaseClient();
        if (!client) return false;

        try {
            // Try to read user_settings table (should exist after migrations)
            const { error } = await client.from('user_settings').select('id').limit(1);

            // Table might not exist yet, but connection works
            return !error || error.code === 'PGRST116' || error.code === '42P01';
        } catch {
            return false;
        }
    }

    /**
     * Test auth configuration
     */
    private async testAuth(): Promise<boolean> {
        const client = getSupabaseClient();
        if (!client) return false;

        try {
            const { error } = await client.auth.getSession();
            return !error;
        } catch {
            return false;
        }
    }

    /**
     * Store credentials in localStorage
     */
    private storeCredentials(url: string, anonKey: string, projectId: string): void {
        const credentials: StoredCredentials = {
            url,
            anonKey,
            projectId,
            connectedAt: new Date().toISOString(),
        };
        localStorage.setItem(CREDENTIALS_KEY, JSON.stringify(credentials));
    }

    /**
     * Load stored credentials
     */
    loadStoredCredentials(): StoredCredentials | null {
        const stored = localStorage.getItem(CREDENTIALS_KEY);
        if (!stored) return null;

        try {
            return JSON.parse(stored);
        } catch {
            return null;
        }
    }

    /**
     * Clear stored credentials
     */
    clearCredentials(): void {
        localStorage.removeItem(CREDENTIALS_KEY);
    }

    /**
     * Auto-connect if credentials are stored
     */
    async autoConnect(): Promise<ConnectionStatus> {
        const credentials = this.loadStoredCredentials();
        if (!credentials) {
            return { connected: false, projectId: null, error: 'No stored credentials' };
        }

        return initializeSupabaseWithCredentials(credentials.url, credentials.anonKey);
    }

    /**
     * Get step by ID
     */
    private getStep(id: string): SetupStep | undefined {
        return this.steps.find(s => s.id === id);
    }

    /**
     * Update step status
     */
    private updateStep(id: string, status: SetupStepStatus, error?: string): void {
        const step = this.getStep(id);
        if (step) {
            step.status = status;
            step.error = error;
        }
    }
}

// Singleton instance
export const setupWizard = new SetupWizardService();
