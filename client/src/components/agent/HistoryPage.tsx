import React, { useEffect, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { motion, AnimatePresence } from 'framer-motion';
import { ConversationMetadata, ConversationService } from '../../services/conversationService';
import { Trash2, Sparkles, CalendarClock, ChevronRight, Search } from 'lucide-react';
import { Card } from '../ui/card';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { cn } from '@/lib/utils';

interface HistoryPageProps {
    onSelectConversation: (id: string) => void;
}

export const HistoryPage: React.FC<HistoryPageProps> = ({ onSelectConversation }) => {
    const [history, setHistory] = useState<ConversationMetadata[]>([]);
    const [searchQuery, setSearchQuery] = useState('');

    const { user } = useAuth();

    useEffect(() => {
        if (user?.uid) {
            loadHistory();
        }
    }, [user?.uid]);

    const loadHistory = async () => {
        const data = await ConversationService.getHistory();
        setHistory(Array.isArray(data) ? data : []);
    };

    const handleDelete = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        if (window.confirm('Delete this conversation?')) {
            await ConversationService.deleteConversation(id);
            loadHistory();
        }
    };

    const filteredHistory = history.filter(chat =>
        chat.title.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const groupedHistory = filteredHistory.reduce((acc, chat) => {
        const date = new Date(chat.timestamp);
        const now = new Date();
        const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

        let label = 'Older';
        if (diffDays === 0) label = 'Today';
        else if (diffDays === 1) label = 'Yesterday';
        else if (diffDays < 7) label = 'Previous 7 Days';
        else if (diffDays < 30) label = 'Previous 30 Days';

        if (!acc[label]) acc[label] = [];
        acc[label].push(chat);
        return acc;
    }, {} as Record<string, ConversationMetadata[]>);

    const groupOrder = ['Today', 'Yesterday', 'Previous 7 Days', 'Previous 30 Days', 'Older'];

    return (
        <motion.div
            className="h-full flex flex-col p-8 max-w-7xl mx-auto w-full"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
        >
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-white tracking-tight mb-2">Conversation History</h1>
                    <p className="text-slate-400">Manage and revisit your past interactions with the Vault Operator.</p>
                </div>

                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                    <Input
                        type="text"
                        placeholder="Search conversations..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10 w-64 focus-visible:ring-[#E7FE55]/20 focus-visible:border-[#E7FE55]/30"
                    />
                </div>
            </div>

            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                {filteredHistory.length === 0 ? (
                    <motion.div
                        className="flex flex-col items-center justify-center h-64 text-slate-500"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                    >
                        <Sparkles size={48} className="mb-4 opacity-20" />
                        <p>No conversations found.</p>
                    </motion.div>
                ) : (
                    <div className="space-y-8">
                        {groupOrder.map(label => {
                            const chats = groupedHistory[label];
                            if (!chats || chats.length === 0) return null;

                            return (
                                <motion.div
                                    key={label}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                >
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="h-px bg-slate-800 flex-1" />
                                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{label}</span>
                                        <div className="h-px bg-slate-800 flex-1" />
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        <AnimatePresence>
                                            {chats.map((chat, idx) => (
                                                <motion.div
                                                    key={chat.id}
                                                    onClick={() => onSelectConversation(chat.id)}
                                                    className="group"
                                                    initial={{ opacity: 0, scale: 0.95 }}
                                                    animate={{ opacity: 1, scale: 1 }}
                                                    transition={{ delay: idx * 0.05 }}
                                                    whileHover={{ scale: 1.02 }}
                                                >
                                                    <Card className="p-4 cursor-pointer hover:border-[#E7FE55]/30 hover:shadow-xl hover:shadow-[#E7FE55]/5 relative overflow-hidden h-full">
                                                        <div className="absolute top-0 right-0 p-3 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                onClick={(e) => handleDelete(e, chat.id)}
                                                                className="h-7 w-7 text-slate-400 hover:text-red-400 hover:bg-red-500/20"
                                                            >
                                                                <Trash2 size={14} />
                                                            </Button>
                                                        </div>

                                                        <div className="flex flex-col h-full justify-between">
                                                            <div>
                                                                <div className="flex items-center gap-2 mb-3 text-[#E7FE55]">
                                                                    <Sparkles size={16} />
                                                                    <span className="text-xs font-mono opacity-70">
                                                                        ID: {chat.id.slice(0, 8)}...
                                                                    </span>
                                                                </div>
                                                                <h3 className="text-base font-semibold text-slate-200 group-hover:text-white line-clamp-2 mb-2 transition-colors">
                                                                    {chat.title}
                                                                </h3>
                                                            </div>

                                                            <div className="flex items-center justify-between text-xs text-slate-500 mt-4 pt-4 border-t border-slate-700/30">
                                                                <div className="flex items-center gap-1.5">
                                                                    <CalendarClock size={12} />
                                                                    <span>
                                                                        {new Date(chat.timestamp).toLocaleDateString(undefined, {
                                                                            month: 'short',
                                                                            day: 'numeric',
                                                                            hour: '2-digit',
                                                                            minute: '2-digit'
                                                                        })}
                                                                    </span>
                                                                </div>
                                                                <div className="group-hover:translate-x-1 transition-transform text-[#E7FE55]/50 group-hover:text-[#E7FE55]">
                                                                    <ChevronRight size={14} />
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </Card>
                                                </motion.div>
                                            ))}
                                        </AnimatePresence>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </div>
                )}
            </div>
        </motion.div>
    );
};
