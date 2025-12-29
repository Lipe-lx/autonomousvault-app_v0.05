/**
 * SecurityService - Client-side security measures against DevTools manipulation
 * 
 * This service provides defense-in-depth protections including:
 * - Session password hash validation
 * - DevTools detection with event-based triggers
 * - Console output sanitization in production
 * - Global namespace protection
 * 
 * NOTE: Client-side security cannot fully prevent determined attackers,
 * but these measures add friction and protect against casual manipulation.
 */

export class SecurityService {
    // Session validation
    private static sessionHash: string | null = null;
    private static sessionTimestamp: number = 0;

    // DevTools detection state
    private static devToolsDetected: boolean = false;
    private static detectionInterval: ReturnType<typeof setInterval> | null = null;

    // Security event callbacks
    private static securityListeners: Set<() => void> = new Set();

    // Original console methods (for restoration if needed)
    private static originalConsole = {
        log: console.log,
        warn: console.warn,
        error: console.error,
        info: console.info,
        debug: console.debug
    };

    // ============================================
    // SESSION VALIDATION
    // ============================================

    /**
     * Set session hash when vault is unlocked
     * Uses a salted hash of the password + timestamp for session validation
     */
    static async setSessionHash(password: string): Promise<void> {
        try {
            const timestamp = Date.now();
            const encoder = new TextEncoder();
            const salt = crypto.getRandomValues(new Uint8Array(16));
            const data = encoder.encode(password + timestamp.toString());

            // Combine salt and password data
            const combined = new Uint8Array(salt.length + data.length);
            combined.set(salt);
            combined.set(data, salt.length);

            const hashBuffer = await crypto.subtle.digest('SHA-256', combined);
            const hashArray = new Uint8Array(hashBuffer);

            // Store as base64
            this.sessionHash = btoa(String.fromCharCode(...hashArray));
            this.sessionTimestamp = timestamp;
        } catch (e) {
            console.error('[SecurityService] Failed to set session hash');
        }
    }

    /**
     * Check if a valid session exists
     */
    static hasValidSession(): boolean {
        return this.sessionHash !== null && this.sessionTimestamp > 0;
    }

    /**
     * Get session timestamp for timeout checks
     */
    static getSessionTimestamp(): number {
        return this.sessionTimestamp;
    }

    /**
     * Clear session on logout/lock
     */
    static clearSession(): void {
        this.sessionHash = null;
        this.sessionTimestamp = 0;
    }

    // ============================================
    // DEVTOOLS DETECTION
    // ============================================

    /**
     * Initialize DevTools detection
     * Only active in production mode
     */
    static initializeDevToolsDetection(): void {
        // Skip in development
        if (import.meta.env.DEV) return;

        // Prevent multiple initializations
        if (this.detectionInterval) return;

        // Method 1: Window size detection
        const checkWindowSize = () => {
            const widthThreshold = window.outerWidth - window.innerWidth > 160;
            const heightThreshold = window.outerHeight - window.innerHeight > 160;
            if ((widthThreshold || heightThreshold) && !this.devToolsDetected) {
                this.handleDevToolsDetected();
            }
        };

        // Method 2: Console property access detection
        const element = new Image();
        let devToolsOpen = false;

        Object.defineProperty(element, 'id', {
            get: function () {
                devToolsOpen = true;
                return '';
            }
        });

        // Periodic check
        this.detectionInterval = setInterval(() => {
            devToolsOpen = false;
            console.log(element);
            console.clear();
            if (devToolsOpen && !this.devToolsDetected) {
                this.handleDevToolsDetected();
            }
            checkWindowSize();
        }, 2000);

        // Also check on resize
        window.addEventListener('resize', checkWindowSize);
    }

    /**
     * Handle DevTools detection event
     */
    private static handleDevToolsDetected(): void {
        if (this.devToolsDetected) return;
        this.devToolsDetected = true;

        // Clear console and show warning
        console.clear();
        console.warn(
            '%c⚠️ SECURITY NOTICE ⚠️',
            'color: #ff4444; font-size: 28px; font-weight: bold; text-shadow: 2px 2px 4px rgba(0,0,0,0.3);'
        );
        console.warn(
            '%cDeveloper tools detected.',
            'color: #ff8800; font-size: 16px;'
        );
        console.warn(
            '%cFor your security, sensitive operations may be restricted.',
            'color: #ffaa00; font-size: 14px;'
        );
        console.warn(
            '%cIf you are not a developer, please close this panel immediately.',
            'color: #ffffff; font-size: 12px;'
        );

        // Notify all registered listeners
        this.securityListeners.forEach(listener => {
            try {
                listener();
            } catch (e) {
                // Ignore listener errors
            }
        });
    }

    /**
     * Check if DevTools has been detected
     */
    static isDevToolsDetected(): boolean {
        return this.devToolsDetected;
    }

    /**
     * Register a callback for security breach events
     * @returns Unsubscribe function
     */
    static onSecurityBreach(callback: () => void): () => void {
        this.securityListeners.add(callback);
        return () => this.securityListeners.delete(callback);
    }

    // ============================================
    // CONSOLE PROTECTION
    // ============================================

    /**
     * Initialize production console protection
     * Sanitizes sensitive data from console output
     */
    static initializeConsoleSanitization(): void {
        // Only sanitize in production
        if (import.meta.env.DEV) return;

        const sensitivePatterns = [
            // Ethereum/EVM private keys (64 hex chars with 0x prefix)
            /0x[a-fA-F0-9]{64}/g,
            // Solana private keys (base58, 87-88 chars)
            /[1-9A-HJ-NP-Za-km-z]{87,88}/g,
            // Long hex strings (potential keys)
            /0x[a-fA-F0-9]{40,}/g,
            // Encrypted data patterns
            /[A-Za-z0-9+/]{100,}={0,2}/g,
        ];

        const sanitize = (args: any[]): any[] => {
            return args.map(arg => {
                if (typeof arg === 'string') {
                    let sanitized = arg;
                    for (const pattern of sensitivePatterns) {
                        sanitized = sanitized.replace(pattern, '[REDACTED]');
                    }
                    return sanitized;
                }
                if (typeof arg === 'object' && arg !== null) {
                    // Don't deep-sanitize objects, just stringify and check
                    try {
                        const str = JSON.stringify(arg);
                        let hasKey = false;
                        for (const pattern of sensitivePatterns) {
                            if (pattern.test(str)) {
                                hasKey = true;
                                break;
                            }
                        }
                        if (hasKey) {
                            return '[Object with sensitive data]';
                        }
                    } catch {
                        // Circular reference or other error, pass through
                    }
                }
                return arg;
            });
        };

        // Override console methods
        console.log = (...args) => {
            this.originalConsole.log.apply(console, sanitize(args));
        };

        console.warn = (...args) => {
            this.originalConsole.warn.apply(console, sanitize(args));
        };

        console.info = (...args) => {
            this.originalConsole.info.apply(console, sanitize(args));
        };

        console.debug = (...args) => {
            this.originalConsole.debug.apply(console, sanitize(args));
        };

        // Keep errors intact for debugging
        // console.error is not overridden
    }

    // ============================================
    // GLOBAL NAMESPACE PROTECTION
    // ============================================

    /**
     * Protect global namespace from tampering
     * Removes exposed services and protects critical objects
     */
    static protectGlobalNamespace(): void {
        // Only protect in production
        if (import.meta.env.DEV) return;

        if (typeof window === 'undefined') return;

        const globalWindow = window as any;

        // Clean up any exposed internal services
        const exposedKeys = [
            '__dealerService',
            '__polymarketDealerService',
            '__backgroundTimer'
        ];

        for (const key of exposedKeys) {
            try {
                if (globalWindow[key]) {
                    delete globalWindow[key];
                }
                // Define as non-writable to prevent re-assignment
                Object.defineProperty(globalWindow, key, {
                    value: undefined,
                    writable: false,
                    configurable: false
                });
            } catch {
                // Property might already be protected
            }
        }

        // Optionally disable React DevTools in production (uncomment if desired)
        // This prevents component inspection but doesn't break the app
        /*
        try {
            Object.defineProperty(window, '__REACT_DEVTOOLS_GLOBAL_HOOK__', {
                get() { return { isDisabled: true }; },
                set() {},
                configurable: false
            });
        } catch {
            // Already defined
        }
        */
    }

    // ============================================
    // INITIALIZATION
    // ============================================

    /**
     * Initialize all production security measures
     * Should be called once at app startup
     */
    static initializeProductionSecurity(): void {
        if (import.meta.env.DEV) {
            console.log('[SecurityService] Development mode - security measures disabled');
            return;
        }

        console.log('[SecurityService] Initializing production security...');

        this.initializeConsoleSanitization();
        this.initializeDevToolsDetection();
        this.protectGlobalNamespace();

        console.log('[SecurityService] Production security initialized');
    }

    /**
     * Cleanup security service (for HMR support)
     */
    static cleanup(): void {
        if (this.detectionInterval) {
            clearInterval(this.detectionInterval);
            this.detectionInterval = null;
        }
        this.securityListeners.clear();
        this.devToolsDetected = false;
        this.clearSession();
    }
}

// Export singleton-like access
export const securityService = SecurityService;
