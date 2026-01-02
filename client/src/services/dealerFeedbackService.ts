import { StorageService } from './storageService';
import { DealerFeedback, DealerFeedbackCategory, TradeAction } from '../../core/types/dealer.types';
import { dealerStore } from '../state/dealerStore';

// Key for IndexedDB
const FEEDBACK_STORAGE_KEY = 'dealer_feedbacks';

class DealerFeedbackService {
    
    /**
     * Submit feedback for a specific dealer action
     */
    async submitFeedback(payload: {
        logId: string;
        coin: string;
        action: TradeAction;
        category: DealerFeedbackCategory;
        comment?: string;
        context: any; // Full context from log
    }): Promise<DealerFeedback> {
        const id = crypto.randomUUID();
        const timestamp = Date.now();
        const expiresAt = timestamp + (24 * 60 * 60 * 1000); // 24 hours from now

        // Create condensed summary for AI
        const contextSummary = this.generateContextSummary(payload.context);
        
        // Extract key indicators snapshot
        const indicatorSnapshot: Record<string, number> = {};
        if (payload.context?.indicators) {
            Object.entries(payload.context.indicators).forEach(([key, val]: [string, any]) => {
                if (typeof val === 'number') {
                    indicatorSnapshot[key] = val;
                } else if (val?.value) {
                    indicatorSnapshot[key] = val.value;
                }
            });
        }

        const feedback: DealerFeedback = {
            id,
            logId: payload.logId,
            coin: payload.coin,
            action: payload.action,
            category: payload.category,
            comment: payload.comment?.slice(0, 100), // Enforce limit
            contextSummary,
            indicatorSnapshot,
            timestamp,
            expiresAt
        };

        // Save to storage
        await this.saveFeedback(feedback);
        
        console.log(`[DealerFeedback] Submitted feedback for ${payload.coin}: ${payload.category}`);
        return feedback;
    }

    /**
     * Get all active (non-expired) feedbacks
     */
    async getActiveFeedbacks(): Promise<DealerFeedback[]> {
        const rawData = await StorageService.getItem(StorageService.getUserKey(FEEDBACK_STORAGE_KEY));
        if (!rawData) return [];

        try {
            const allFeedbacks: DealerFeedback[] = JSON.parse(rawData);
            const now = Date.now();
            
            // Filter expired
            const active = allFeedbacks.filter(f => f.expiresAt > now);
            
            // If we filtered out expired items, update storage to clean up
            if (active.length < allFeedbacks.length) {
                await StorageService.setItem(
                    StorageService.getUserKey(FEEDBACK_STORAGE_KEY), 
                    JSON.stringify(active)
                );
            }
            
            return active.sort((a, b) => b.timestamp - a.timestamp); // Newest first
        } catch (e) {
            console.error('[DealerFeedback] Failed to parse feedbacks:', e);
            return [];
        }
    }

    /**
     * Delete a specific feedback
     */
    async deleteFeedback(id: string): Promise<void> {
        const feedbacks = await this.getActiveFeedbacks();
        const updated = feedbacks.filter(f => f.id !== id);
        await StorageService.setItem(
            StorageService.getUserKey(FEEDBACK_STORAGE_KEY), 
            JSON.stringify(updated)
        );
    }

    /**
     * Clear all feedbacks
     */
    async clearAllFeedbacks(): Promise<void> {
        await StorageService.removeItem(StorageService.getUserKey(FEEDBACK_STORAGE_KEY));
    }

    /**
     * Get formatted context string for AI injection
     */
    async getContextForAI(): Promise<string> {
        const feedbacks = await this.getActiveFeedbacks();
        if (feedbacks.length === 0) return "";

        // Take top 5 most recent feedbacks
        const recent = feedbacks.slice(0, 5);
        
        let contextString = "### USER FEEDBACK (LAST 24H) - LEARN FROM THIS:\n";
        
        for (const f of recent) {
            const timeAgo = Math.round((Date.now() - f.timestamp) / (1000 * 60 * 60));
            const timeStr = timeAgo === 0 ? "< 1h ago" : `${timeAgo}h ago`;
            
            contextString += `- 📊 ${f.coin} (${timeStr}): ${this.getCategoryEmoji(f.category)} ${f.category}\n`;
            if (f.comment) {
                contextString += `  User Note: "${f.comment}"\n`;
            }
            contextString += `  Context: ${f.contextSummary}\n\n`;
        }

        return contextString;
    }

    // --- Helpers ---

    private async saveFeedback(feedback: DealerFeedback): Promise<void> {
        const existing = await this.getActiveFeedbacks();
        const updated = [feedback, ...existing];
        await StorageService.setItem(
            StorageService.getUserKey(FEEDBACK_STORAGE_KEY), 
            JSON.stringify(updated)
        );
    }

    private getCategoryEmoji(category: DealerFeedbackCategory): string {
        switch (category) {
            case 'TOO_BULLISH': return '⚠️';
            case 'TOO_BEARISH': return '⚠️';
            case 'BAD_TIMING': return '⏱️';
            case 'WRONG_COIN': return '❌';
            case 'AGREE': return '✅';
            default: return '📝';
        }
    }

    private generateContextSummary(context: any): string {
        try {
            const parts = [];
            
            // Price
            if (context.currentPrice) {
                parts.push(`Price=$${context.currentPrice}`);
            }
            
            // Key Indicators
            if (context.indicators) {
                if (context.indicators.rsi) parts.push(`RSI=${this.fmt(context.indicators.rsi)}`);
                if (context.indicators.macd) {
                    const macd = context.indicators.macd;
                    const val = typeof macd === 'number' ? macd : macd.histogram || macd.value;
                    parts.push(`MACD=${this.fmt(val)}`);
                }
            }
            
            // Macro mismatch if any
            if (context.macro) {
                parts.push(`Macro=${context.macro.timeframe}`);
            }
            
            return parts.join(', ');
        } catch (e) {
            return "Context unavailable";
        }
    }

    private fmt(val: any): string {
        if (typeof val === 'number') return val.toFixed(2);
        if (val?.value) return Number(val.value).toFixed(2);
        return '?';
    }
}

export const dealerFeedbackService = new DealerFeedbackService();
