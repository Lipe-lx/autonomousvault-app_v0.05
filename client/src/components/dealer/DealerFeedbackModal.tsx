import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import { Button } from '../ui/button';
import { DealerFeedbackCategory, TradeAction } from '../../../../core/types/dealer.types';
import { MessageSquarePlus, AlertTriangle, Clock, XCircle, CheckCircle, HelpCircle } from 'lucide-react';

interface DealerFeedbackModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (category: DealerFeedbackCategory, comment: string) => void;
    context: {
        coin: string;
        action: string;
        price?: number;
    };
    initialCategory?: DealerFeedbackCategory;
}

export const DealerFeedbackModal: React.FC<DealerFeedbackModalProps> = ({
    isOpen,
    onClose,
    onSubmit,
    context,
    initialCategory = 'AGREE'
}) => {
    const [category, setCategory] = useState<DealerFeedbackCategory>(initialCategory);
    const [comment, setComment] = useState('');

    const handleSubmit = () => {
        onSubmit(category, comment);
        setComment('');
        onClose();
    };

    const categories: { id: DealerFeedbackCategory; label: string; icon: any; color: string }[] = [
        { id: 'AGREE', label: 'Good Decision', icon: CheckCircle, color: 'text-green-400' },
        { id: 'TOO_BULLISH', label: 'Too Bullish', icon: AlertTriangle, color: 'text-amber-400' },
        { id: 'TOO_BEARISH', label: 'Too Bearish', icon: AlertTriangle, color: 'text-amber-400' },
        { id: 'BAD_TIMING', label: 'Bad Timing', icon: Clock, color: 'text-blue-400' },
        { id: 'WRONG_COIN', label: 'Wrong Coin', icon: XCircle, color: 'text-red-400' },
    ];

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-[400px] bg-[#14151a] border-[#232328]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-white text-sm uppercase tracking-wider">
                        <MessageSquarePlus className="h-4 w-4 text-[#E7FE55]" />
                        Feedback: {context.action} {context.coin}
                    </DialogTitle>
                </DialogHeader>

                <div className="py-4 space-y-4">
                    {/* Category Selection */}
                    <div className="grid grid-cols-2 gap-2">
                        {categories.map((cat) => (
                            <button
                                key={cat.id}
                                onClick={() => setCategory(cat.id)}
                                className={`flex items-center gap-2 p-2 rounded border transition-colors text-xs font-medium ${
                                    category === cat.id
                                        ? 'bg-[#E7FE55]/10 border-[#E7FE55]/50 text-white'
                                        : 'bg-[#1a1b21] border-[#232328] text-[#747580] hover:bg-[#232328] hover:text-[#a0a1a8]'
                                }`}
                            >
                                <cat.icon className={`h-3 w-3 ${category === cat.id ? 'text-[#E7FE55]' : cat.color}`} />
                                {cat.label}
                            </button>
                        ))}
                    </div>

                    {/* Context Preview */}
                    <div className="bg-[#0f1015] p-2 rounded border border-[#232328] text-[10px] text-[#747580] font-mono">
                         At ${context.price?.toFixed(2) || '???'} • This feedback will adjust future AI bias.
                    </div>

                    {/* Comment Input */}
                    <div className="space-y-2">
                        <label className="text-[10px] font-semibold text-[#747580] uppercase tracking-wider">
                            Comment (Optional)
                        </label>
                        <textarea
                            value={comment}
                            onChange={(e) => setComment(e.target.value)}
                            maxLength={100}
                            placeholder="Why do you think this?"
                            className="w-full h-20 bg-[#0f1015] border border-[#232328] rounded p-2 text-xs text-white placeholder:text-[#505158] focus:outline-none focus:border-[#E7FE55]/50 resize-none font-sans"
                        />
                        <div className="text-[9px] text-[#505158] text-right">
                            {comment.length}/100
                        </div>
                    </div>
                </div>

                <DialogFooter>
                    <div className="flex w-full gap-2">
                        <Button
                            variant="outline"
                            onClick={onClose}
                            className="flex-1 border-[#232328] text-[#a0a1a8] hover:text-white hover:bg-[#1a1b21] h-8 text-xs uppercase"
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleSubmit}
                            className="flex-1 bg-[#E7FE55] hover:bg-[#d6ec4e] text-black h-8 text-xs uppercase font-semibold"
                        >
                            Submit Feedback
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
