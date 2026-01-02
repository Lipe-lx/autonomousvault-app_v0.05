// Feedback Service for Supabase
// Handles general feedback and message rating storage

import { getSupabaseClient } from './client';

// --- Types ---

export type FeedbackCategory = 'suggestion' | 'bug' | 'other';
export type MessageRating = 'positive' | 'negative';

export interface GeneralFeedbackPayload {
    category: FeedbackCategory;
    message: string;
    metadata?: Record<string, any>;
}

export interface MessageRatingPayload {
    messageId: string;
    conversationId: string;
    rating: MessageRating;
    feedback?: string; // Optional explanation for negative ratings
}

interface FeedbackResult {
    success: boolean;
    error?: string;
}

// --- Service ---

class FeedbackService {
    /**
     * Submit general feedback (suggestions, bugs, etc.)
     */
    async submitGeneralFeedback(payload: GeneralFeedbackPayload): Promise<FeedbackResult> {
        const supabase = getSupabaseClient();
        if (!supabase) {
            console.error('[FeedbackService] Supabase client not initialized');
            return { success: false, error: 'Supabase not connected' };
        }

        try {
            // Get current user
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                return { success: false, error: 'User not authenticated' };
            }

            const { error } = await supabase.from('feedback').insert({
                user_id: user.id,
                type: 'general',
                category: payload.category,
                message: payload.message,
                metadata: payload.metadata || {}
            });

            if (error) {
                console.error('[FeedbackService] Insert error:', error);
                return { success: false, error: error.message };
            }

            console.log('[FeedbackService] General feedback submitted successfully');
            return { success: true };
        } catch (err) {
            console.error('[FeedbackService] Unexpected error:', err);
            return { success: false, error: 'Failed to submit feedback' };
        }
    }

    /**
     * Submit message rating (thumbs up/down for AI responses)
     */
    async submitMessageRating(payload: MessageRatingPayload): Promise<FeedbackResult> {
        const supabase = getSupabaseClient();
        if (!supabase) {
            console.error('[FeedbackService] Supabase client not initialized');
            return { success: false, error: 'Supabase not connected' };
        }

        try {
            // Get current user
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                return { success: false, error: 'User not authenticated' };
            }

            const { error } = await supabase.from('feedback').insert({
                user_id: user.id,
                type: 'message_rating',
                rating: payload.rating,
                message: payload.feedback || null,
                message_id: payload.messageId,
                conversation_id: payload.conversationId,
                metadata: {}
            });

            if (error) {
                console.error('[FeedbackService] Insert error:', error);
                return { success: false, error: error.message };
            }

            console.log('[FeedbackService] Message rating submitted:', payload.rating);
            return { success: true };
        } catch (err) {
            console.error('[FeedbackService] Unexpected error:', err);
            return { success: false, error: 'Failed to submit rating' };
        }
    }

    /**
     * Get SQL for creating the feedback table
     * User should run this in their Supabase SQL editor
     */
    getSetupSQL(): string {
        return `
-- Feedback table for storing all user feedback
CREATE TABLE IF NOT EXISTS public.feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('general', 'message_rating')),
  category TEXT, -- For general: 'suggestion', 'bug', 'other'
  rating TEXT, -- For message_rating: 'positive', 'negative'
  message TEXT,
  message_id TEXT, -- For message_rating
  conversation_id TEXT, -- For message_rating
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to insert their own feedback
CREATE POLICY "Users can insert own feedback" ON public.feedback
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Allow users to view their own feedback
CREATE POLICY "Users can view own feedback" ON public.feedback
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
`;
    }
}

// Singleton export
export const feedbackService = new FeedbackService();
