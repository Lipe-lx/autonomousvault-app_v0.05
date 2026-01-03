import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { DealerFeedback, DealerFeedbackCategory } from '../../../../core/types/dealer.types';
import { dealerFeedbackService } from '../../services/dealerFeedbackService';
import { Trash2, AlertCircle, Clock, CheckCircle, Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';
import { Badge } from '../ui/badge';

interface DealerFeedbackManagerProps {
    onClose?: () => void;
}

export const DealerFeedbackManager: React.FC<DealerFeedbackManagerProps> = ({ onClose }) => {
    const [feedbacks, setFeedbacks] = useState<DealerFeedback[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const loadFeedbacks = async () => {
        setIsLoading(true);
        const data = await dealerFeedbackService.getActiveFeedbacks();
        setFeedbacks(data);
        setIsLoading(false);
    };

    useEffect(() => {
        loadFeedbacks();
    }, []);

    const handleDelete = async (id: string) => {
        await dealerFeedbackService.deleteFeedback(id);
        await loadFeedbacks();
    };

    const handleClearAll = async () => {
        if (confirm('Clear all feedback history? This will reset AI bias adjustments.')) {
            await dealerFeedbackService.clearAllFeedbacks();
            await loadFeedbacks();
        }
    };

    const getCategoryBadge = (cat: DealerFeedbackCategory) => {
        switch (cat) {
            case 'AGREE': return <Badge variant="success" className="text-[9px]">AGREE</Badge>;
            case 'TOO_BULLISH': return <Badge variant="warning" className="text-[9px]">TOO BULLISH</Badge>;
            case 'TOO_BEARISH': return <Badge variant="warning" className="text-[9px]">TOO BEARISH</Badge>;
            case 'BAD_TIMING': return <Badge variant="outline" className="text-[9px] bg-blue-500/10 text-blue-400 border-blue-500/20">TIMING</Badge>;
            case 'WRONG_COIN': return <Badge variant="destructive" className="text-[9px]">WRONG COIN</Badge>;
            default: return <Badge variant="secondary" className="text-[9px]">{cat}</Badge>;
        }
    };

    return (
        <div className="flex flex-col h-full bg-[#14151a] border-l border-[#232328] w-[300px]">
            <div className="p-4 border-b border-[#232328] flex flex-col gap-1 bg-[#14151a]">
                <div className="flex justify-between items-center">
                    <h3 className="text-xs font-semibold text-white uppercase tracking-wider flex items-center gap-2">
                        <CheckCircle className="h-3 w-3 text-[#E7FE55]" />
                        Decision Review
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Info className="h-3 w-3 text-[#505158] hover:text-[#747580] cursor-help transition-colors" />
                                </TooltipTrigger>
                                <TooltipContent side="bottom" className="max-w-[220px] text-xs">
                                    Rate the dealer's trading decisions to fine-tune its behavior. Your reviews influence the AI's analysis in future cycles.
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    </h3>
                    {feedbacks.length > 0 && (
                        <button 
                            onClick={handleClearAll}
                            className="text-[10px] text-red-400 hover:text-red-300 transition-colors uppercase"
                        >
                            Clear All
                        </button>
                    )}
                </div>

            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-2 bg-[#0f1015]">
                {isLoading ? (
                    <div className="text-center py-8 text-[#747580] text-xs">Loading...</div>
                ) : feedbacks.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-[#747580] gap-2 opacity-60">
                        <CheckCircle className="h-16 w-16 opacity-20" />
                        <p className="text-[16px]">No active reviews</p>
                        <p className="text-[12px] text-center max-w-[180px]">
                            Rate the AI's decisions in the "Thinking" logs to bias future analysis.
                        </p>
                    </div>
                ) : (
                    <AnimatePresence>
                        {feedbacks.map((item) => (
                            <motion.div
                                key={item.id}
                                layout
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                className="bg-[#1a1b21] rounded border border-[#232328] p-3 shadow-sm group"
                            >
                                <div className="flex justify-between items-start mb-2">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-bold text-white">{item.coin}</span>
                                        {getCategoryBadge(item.category)}
                                    </div>
                                    <button
                                        onClick={() => handleDelete(item.id)}
                                        className="text-[#505158] hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                                    >
                                        <Trash2 className="h-3 w-3" />
                                    </button>
                                </div>
                                
                                {item.comment && (
                                    <p className="text-[11px] text-[#a0a1a8] italic mb-2 leading-relaxed border-l-2 border-[#232328] pl-2">
                                        "{item.comment}"
                                    </p>
                                )}

                                <div className="flex items-center gap-1 text-[9px] text-[#505158] font-mono mt-1">
                                    <Clock className="h-2.5 w-2.5" />
                                    {new Date(item.timestamp).toLocaleDateString([], {day: '2-digit', month: 'short'})} {new Date(item.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                </div>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                )}
            </div>
            
            <div className="p-3 bg-[#1a1b21] border-t border-[#232328] text-[11px] text-[#505158] text-center">
                Max 5 active reviews
            </div>
        </div>
    );
};
