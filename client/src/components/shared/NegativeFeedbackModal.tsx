import React, { useState } from 'react';
import { ThumbsDown, Send } from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter
} from '../ui/dialog';
import { Button } from '../ui/button';

interface NegativeFeedbackModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (feedback: string) => void;
}

export const NegativeFeedbackModal: React.FC<NegativeFeedbackModalProps> = ({
    isOpen,
    onClose,
    onSubmit
}) => {
    const [feedback, setFeedback] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (includeFeedback: boolean) => {
        setIsSubmitting(true);
        await onSubmit(includeFeedback ? feedback.trim() : '');
        setIsSubmitting(false);
        handleClose();
    };

    const handleClose = () => {
        setFeedback('');
        onClose();
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
            <DialogContent className="sm:max-w-[400px] bg-[#14151a] border-[#232328]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-white">
                        <ThumbsDown size={18} className="text-[#747580]" />
                        What went wrong?
                    </DialogTitle>
                    <DialogDescription className="text-[#747580]">
                        Help us understand - your feedback is optional but appreciated.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-2 mt-2">
                    <textarea
                        value={feedback}
                        onChange={(e) => setFeedback(e.target.value)}
                        placeholder="What could have been better? (optional)"
                        className="w-full h-24 px-4 py-3 rounded-lg bg-[#1a1b21] border border-[#232328] text-white text-sm placeholder:text-[#747580] resize-none focus:outline-none focus:border-[#E7FE55]/30 focus:ring-1 focus:ring-[#E7FE55]/20"
                        autoFocus
                    />
                </div>

                <DialogFooter className="mt-4 gap-2">
                    <Button
                        variant="outline"
                        onClick={() => handleSubmit(false)}
                        disabled={isSubmitting}
                        className="border-[#232328] text-[#a0a1a8] hover:text-white hover:bg-[#1a1b21]"
                    >
                        Skip
                    </Button>
                    <Button
                        onClick={() => handleSubmit(true)}
                        disabled={isSubmitting}
                        className="bg-[#E7FE55] hover:bg-[#f0ff7a] text-black"
                    >
                        {isSubmitting ? 'Sending...' : 'Submit'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
