// services/keepAlive.ts
// Uses silent Web Audio to prevent browser from throttling the tab
// Browsers exempt tabs playing audio from aggressive background throttling
//
// How it works:
// 1. Creates an inaudible oscillator (gain = 0.001)
// 2. Browser sees the tab as "playing audio"
// 3. Tab is exempt from timer throttling
// 4. Web Worker postMessage and callbacks execute at full speed

class KeepAliveService {
    private audioContext: AudioContext | null = null;
    private oscillator: OscillatorNode | null = null;
    private gainNode: GainNode | null = null;
    private isActive = false;
    private checkInterval: ReturnType<typeof setInterval> | null = null;
    private visibilityHandler: (() => void) | null = null;
    private userInteractionHandler: (() => void) | null = null;

    /**
     * Start the silent audio to keep the tab active
     * MUST be called after a user interaction (click, keypress, etc.)
     */
    start(): boolean {
        if (this.isActive && this.audioContext?.state === 'running') {
            console.log('[KeepAlive] Already active and running');
            return true;
        }

        try {
            // Clean up any existing audio context first
            if (this.audioContext && this.audioContext.state !== 'closed') {
                this.cleanupAudio();
            }

            // Create AudioContext (requires user interaction in most browsers)
            this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();

            // Create oscillator (generates sound wave)
            this.oscillator = this.audioContext.createOscillator();
            this.oscillator.type = 'sine';
            this.oscillator.frequency.setValueAtTime(1, this.audioContext.currentTime); // Very low frequency

            // Create gain node to make it silent
            this.gainNode = this.audioContext.createGain();
            this.gainNode.gain.setValueAtTime(0.001, this.audioContext.currentTime); // Nearly silent

            // Connect: oscillator -> gain -> speakers
            this.oscillator.connect(this.gainNode);
            this.gainNode.connect(this.audioContext.destination);

            // Start the oscillator
            this.oscillator.start();

            this.isActive = true;
            console.log('[KeepAlive] ✅ Silent audio started - tab will stay active in background');

            // Set up listeners and interval to maintain audio
            this.setupMaintenance();

            return true;
        } catch (err) {
            console.error('[KeepAlive] ❌ Failed to start silent audio:', err);
            return false;
        }
    }

    /**
     * Setup maintenance systems to keep AudioContext running
     */
    private setupMaintenance(): void {
        // Clean up existing handlers first
        this.cleanupMaintenance();

        // 1. Visibility change handler - resume when tab becomes visible
        this.visibilityHandler = () => {
            if (document.visibilityState === 'visible' && this.isActive) {
                console.log('[KeepAlive] 👁️ Tab became visible, checking audio...');
                this.ensureRunning();
            }
        };
        document.addEventListener('visibilitychange', this.visibilityHandler);

        // 2. User interaction handler - resume on any user interaction
        this.userInteractionHandler = () => {
            if (this.isActive && this.audioContext?.state === 'suspended') {
                console.log('[KeepAlive] 👆 User interaction detected, resuming audio...');
                this.resume();
            }
        };
        // Listen to various user interaction events
        ['click', 'keydown', 'touchstart', 'mousedown'].forEach(event => {
            document.addEventListener(event, this.userInteractionHandler!, { passive: true });
        });

        // 3. Periodic check - ensure audio is running every 5 seconds
        this.checkInterval = setInterval(() => {
            if (this.isActive) {
                this.ensureRunning();
            }
        }, 5000);
    }

    /**
     * Ensure the audio is running, restart if needed
     */
    private async ensureRunning(): Promise<void> {
        if (!this.isActive) return;

        const state = this.audioContext?.state;

        if (state === 'suspended') {
            console.log('[KeepAlive] ⚠️ AudioContext suspended, attempting resume...');
            await this.resume();
        } else if (state === 'closed' || !this.audioContext) {
            console.log('[KeepAlive] ⚠️ AudioContext closed, restarting...');
            this.isActive = false; // Reset flag to allow restart
            this.start();
        }
    }

    /**
     * Clean up maintenance handlers
     */
    private cleanupMaintenance(): void {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
        }

        if (this.visibilityHandler) {
            document.removeEventListener('visibilitychange', this.visibilityHandler);
            this.visibilityHandler = null;
        }

        if (this.userInteractionHandler) {
            ['click', 'keydown', 'touchstart', 'mousedown'].forEach(event => {
                document.removeEventListener(event, this.userInteractionHandler!);
            });
            this.userInteractionHandler = null;
        }
    }

    /**
     * Clean up audio nodes
     */
    private cleanupAudio(): void {
        try {
            if (this.oscillator) {
                this.oscillator.stop();
                this.oscillator.disconnect();
                this.oscillator = null;
            }

            if (this.gainNode) {
                this.gainNode.disconnect();
                this.gainNode = null;
            }

            if (this.audioContext && this.audioContext.state !== 'closed') {
                this.audioContext.close();
            }
            this.audioContext = null;
        } catch (err) {
            // Ignore cleanup errors
        }
    }

    /**
     * Stop the silent audio
     */
    stop(): void {
        if (!this.isActive) return;

        try {
            this.cleanupMaintenance();
            this.cleanupAudio();

            this.isActive = false;
            console.log('[KeepAlive] 🛑 Silent audio stopped');
        } catch (err) {
            console.error('[KeepAlive] Error stopping:', err);
        }
    }

    /**
     * Resume audio context if suspended (required after user interaction)
     */
    async resume(): Promise<boolean> {
        if (!this.audioContext) {
            return this.start();
        }

        if (this.audioContext.state === 'suspended') {
            try {
                await this.audioContext.resume();
                console.log('[KeepAlive] ▶️ AudioContext resumed');
                return true;
            } catch (err) {
                console.error('[KeepAlive] Failed to resume:', err);
                // Try to restart completely
                this.isActive = false;
                return this.start();
            }
        }

        return true;
    }

    /**
     * Check if keep-alive is currently active
     */
    getIsActive(): boolean {
        return this.isActive && this.audioContext?.state === 'running';
    }

    /**
     * Get the current state of the AudioContext
     */
    getState(): string {
        return this.audioContext?.state || 'not-initialized';
    }
}

// Singleton instance
export const keepAlive = new KeepAliveService();
