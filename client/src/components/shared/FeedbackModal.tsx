import React, { useState } from 'react';
import { MessageSquarePlus, Bug, Lightbulb, HelpCircle, Send, X } from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter
} from '../ui/dialog';
import { Button } from '../ui/button';
import { feedbackService, FeedbackCategory } from '../../services/supabase/feedbackService';

interface FeedbackModalProps {
    isOpen: boolean;
    onClose: () => void;
}

type FeedbackType = {
    id: FeedbackCategory;
    label: string;
    icon: React.ReactNode;
    description: string;
};

const feedbackTypes: FeedbackType[] = [
    {
        id: 'suggestion',
        label: 'Suggestion',
        icon: <Lightbulb size={20} />,
        description: 'Share ideas to improve AutonomousVault'
    },
    {
        id: 'bug',
        label: 'Bug Report',
        icon: <Bug size={20} />,
        description: 'Report something that isn\'t working'
    },
    {
        id: 'other',
        label: 'Other',
        icon: <HelpCircle size={20} />,
        description: 'General feedback or questions'
    }
];

export const FeedbackModal: React.FC<FeedbackModalProps> = ({ isOpen, onClose }) => {
    const [selectedType, setSelectedType] = useState<FeedbackCategory>('suggestion');
    const [message, setMessage] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);

    const handleSubmit = async () => {
        if (!message.trim()) return;

        setIsSubmitting(true);
        const result = await feedbackService.submitGeneralFeedback({
            category: selectedType,
            message: message.trim()
        });

        setIsSubmitting(false);

        if (result.success) {
            setSubmitted(true);
            setTimeout(() => {
                handleClose();
            }, 1500);
        }
    };

    const handleClose = () => {
        setSelectedType('suggestion');
        setMessage('');
        setSubmitted(false);
        onClose();
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
            <DialogContent className="sm:max-w-[480px] bg-[#14151a] border-[#232328]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-white">
                        <MessageSquarePlus size={20} className="text-[#E7FE55]" />
                        Send Feedback
                    </DialogTitle>
                    <DialogDescription className="text-[#747580]">
                        Help us improve AutonomousVault with your feedback.
                    </DialogDescription>
                </DialogHeader>

                {submitted ? (
                    <div className="py-8 text-center">
                        <div className="w-12 h-12 rounded-full bg-[#E7FE55]/10 flex items-center justify-center mx-auto mb-3">
                            <Send size={24} className="text-[#E7FE55]" />
                        </div>
                        <p className="text-white font-medium">Thank you for your feedback!</p>
                        <p className="text-[#747580] text-sm mt-1">We appreciate your input.</p>
                    </div>
                ) : (
                    <>
                        {/* Feedback Type Selection */}
                        <div className="space-y-3 mt-2">
                            <label className="text-[10px] font-semibold text-[#747580] uppercase tracking-[0.1em]">
                                Feedback Type
                            </label>
                            <div className="grid grid-cols-3 gap-2">
                                {feedbackTypes.map((type) => (
                                    <button
                                        key={type.id}
                                        onClick={() => setSelectedType(type.id)}
                                        className={`flex flex-col items-center gap-2 p-3 rounded-lg border transition-all ${
                                            selectedType === type.id
                                                ? 'bg-[#E7FE55]/10 border-[#E7FE55]/30 text-[#E7FE55]'
                                                : 'bg-[#1a1b21] border-[#232328] text-[#747580] hover:text-white hover:border-[#3a3b43]'
                                        }`}
                                    >
                                        {type.icon}
                                        <span className="text-[11px] font-medium">{type.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Message Input */}
                        <div className="space-y-2 mt-4">
                            <label className="text-[10px] font-semibold text-[#747580] uppercase tracking-[0.1em]">
                                Your Message
                            </label>
                            <textarea
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                                placeholder={`Describe your ${selectedType === 'bug' ? 'issue' : selectedType === 'suggestion' ? 'idea' : 'feedback'}...`}
                                className="w-full h-32 px-4 py-3 rounded-lg bg-[#1a1b21] border border-[#232328] text-white text-sm placeholder:text-[#747580] resize-none focus:outline-none focus:border-[#E7FE55]/30 focus:ring-1 focus:ring-[#E7FE55]/20"
                            />
                        </div>

                        <DialogFooter className="mt-4 gap-2">
                            <Button
                                variant="outline"
                                onClick={handleClose}
                                className="border-[#232328] text-[#a0a1a8] hover:text-white hover:bg-[#1a1b21]"
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={handleSubmit}
                                disabled={!message.trim() || isSubmitting}
                                className="bg-[#E7FE55] hover:bg-[#f0ff7a] text-black"
                            >
                                {isSubmitting ? 'Sending...' : 'Send Feedback'}
                            </Button>
                        </DialogFooter>
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
};
