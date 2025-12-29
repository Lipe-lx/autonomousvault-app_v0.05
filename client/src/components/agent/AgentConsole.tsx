import React, { useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Bot, Send, User, Sparkles, CheckCircle, AlertTriangle, Clock, Info, Lock, Unlock, Settings, ArrowRight } from 'lucide-react';
import { AgentMessage, AppTab } from '../../types';
import { ActionSummaryPanel } from './ActionSummaryPanel';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { cn } from '@/lib/utils';

interface AgentConsoleProps {
    messages: AgentMessage[];
    inputMessage: string;
    setInputMessage: (msg: string) => void;
    handleSendMessage: () => void;
    isAiProcessing: boolean;
    aiStatus: string;
    scrollRef: React.RefObject<HTMLDivElement>;
    isVaultUnlocked: boolean;
    password: string;
    setPassword: (pwd: string) => void;
    unlockVault: () => void;
    hasVault: boolean;
    onNavigate?: (tab: AppTab) => void;
}

export const AgentConsole: React.FC<AgentConsoleProps> = ({
    messages,
    inputMessage,
    setInputMessage,
    handleSendMessage,
    isAiProcessing,
    aiStatus,
    scrollRef,
    isVaultUnlocked,
    password,
    setPassword,
    unlockVault,
    hasVault,
    onNavigate
}) => {
    const inputRef = useRef<HTMLInputElement>(null);

    const hasActions = useMemo(() => {
        return messages.some(msg =>
            msg.role === 'model' &&
            msg.toolResults &&
            msg.toolResults.length > 0 &&
            msg.toolResults.some(r => r.type !== 'error')
        );
    }, [messages]);

    useEffect(() => {
        if (!isAiProcessing && isVaultUnlocked && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isAiProcessing, isVaultUnlocked]);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, scrollRef]);

    // Vault locked state
    if (!isVaultUnlocked && hasVault) {
        return (
            <motion.div
                className="flex flex-col h-[calc(100vh-8rem)] items-center justify-center"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
            >
                <div className="max-w-md w-full mx-auto space-y-6 p-8">
                    <div className="text-center">
                        <motion.div
                            className="w-16 h-16 bg-[#1a1b21] rounded-full flex items-center justify-center mx-auto mb-4 border border-[#232328]"
                            animate={{ scale: [1, 1.05, 1] }}
                            transition={{ duration: 2, repeat: Infinity }}
                        >
                            <Lock size={32} className="text-[#E7FE55]" />
                        </motion.div>
                        <h2 className="text-xl font-semibold text-white tracking-tight">Unlock Vault Operator</h2>
                        <p className="text-[#747580] mt-2 text-sm">Enter your password to start using Vault Operator.</p>
                    </div>

                    <Card className="p-6 space-y-4">
                        <div>
                            <label className="block text-[10px] font-semibold text-[#747580] uppercase tracking-[0.1em] mb-2">Password</label>
                            <Input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Enter password..."
                                onKeyDown={(e) => e.key === 'Enter' && unlockVault()}
                                className="focus-visible:ring-[#E7FE55]/20 focus-visible:border-[#E7FE55]/30"
                                autoFocus
                            />
                        </div>
                        <Button onClick={unlockVault} className="w-full" size="lg">
                            <Unlock size={18} /> Unlock Vault Operator
                        </Button>
                    </Card>

                    <p className="text-center text-[11px] text-[#747580]">
                        This is the same password used to unlock your Vault.
                    </p>
                </div>
            </motion.div>
        );
    }

    // No vault state
    if (!hasVault) {
        return (
            <motion.div
                className="flex flex-col h-[calc(100vh-8rem)] items-center justify-center"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
            >
                <div className="max-w-md w-full mx-auto space-y-6 p-8 text-center">
                    <div className="w-16 h-16 bg-[#1a1b21] rounded-full flex items-center justify-center mx-auto mb-4 border border-[#232328]">
                        <Bot size={32} className="text-[#747580]" />
                    </div>
                    <h2 className="text-xl font-semibold text-white tracking-tight">Create a Vault First</h2>
                    <p className="text-[#747580] text-sm">
                        You need to create a vault before using Vault Operator.
                        Go to the <span className="text-[#E7FE55]">Vault</span> page to set up your wallets.
                    </p>
                </div>
            </motion.div>
        );
    }

    return (
        <div className="flex h-[calc(100vh-9rem)] gap-6">
            {/* Left Column: Chat Area + Input */}
            <div className={cn(
                "flex-1 flex flex-col bg-transparent rounded overflow-hidden relative min-w-0",
                hasActions && "lg:pr-2"
            )}>
                {/* Messages List */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6" ref={scrollRef}>
                    <AnimatePresence>
                        {messages.length === 0 && (
                            <motion.div
                                className="flex flex-col items-center justify-center h-full text-[#747580] opacity-60"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 0.6 }}
                            >
                                <Bot size={48} className="mb-4 text-[#E7FE55]" />
                                <p className="text-sm font-semibold text-white">Vault Operator Ready</p>
                                <p className="text-[11px] text-[#747580]">Ask me to check balances, swap tokens, or schedule automations.</p>
                            </motion.div>
                        )}

                        {messages.map((msg, index) => (
                            <motion.div
                                key={msg.id}
                                className={cn("flex", msg.role === 'user' ? 'justify-end' : 'justify-start')}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.05 }}
                            >
                                <div className={cn(
                                    "flex gap-4",
                                    hasActions ? "max-w-[85%]" : "max-w-[90%]",
                                    msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'
                                )}>
                                    {/* Avatar */}
                                    <div className={cn(
                                        "w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 border",
                                        msg.role === 'user' ? 'bg-[#9b87f5]/10 border-[#9b87f5]/20' : 'bg-[#E7FE55]/10 border-[#E7FE55]/20'
                                    )}>
                                        {msg.role === 'user' ? <User size={18} className="text-[#9b87f5]" /> : <Bot size={18} className="text-[#E7FE55]" />}
                                    </div>

                                    {/* Message Bubble */}
                                    <div className={cn("flex flex-col", msg.role === 'user' ? 'items-end' : 'items-start')}>
                                        <div className={cn(
                                            "px-4 py-3 rounded-lg bg-[#1a1b21] text-[#e4e5e9] border border-[#232328]",
                                            msg.role === 'user' ? 'rounded-tr-sm' : 'rounded-tl-sm'
                                        )}>
                                            {/* Tool Results */}
                                            {msg.toolResults && msg.toolResults.length > 0 && (
                                                <div className="mb-4 space-y-3 w-full">
                                                    {msg.toolResults.map((result, idx) => (
                                                        <div key={idx} className={cn(
                                                            "text-[11px] p-3 rounded border",
                                                            result.type === 'success' ? 'bg-[#34d399]/10 border-[#34d399]/30 text-[#34d399]' :
                                                                result.type === 'error' ? 'bg-red-500/10 border-red-500/30 text-red-400' :
                                                                    'bg-[#60a5fa]/10 border-[#60a5fa]/30 text-[#60a5fa]'
                                                        )}>
                                                            <div className="flex items-center gap-2 font-bold mb-1">
                                                                {result.type === 'success' ? <CheckCircle size={14} /> :
                                                                    result.type === 'error' ? <AlertTriangle size={14} /> :
                                                                        <Info size={14} />}
                                                                {result.title}
                                                            </div>
                                                            <div className="whitespace-pre-wrap font-mono opacity-90">{result.details}</div>
                                                            {result.tx && (
                                                                <div className="mt-2 pt-2 border-t border-white/10 text-[10px] font-mono opacity-70 truncate">
                                                                    TX: {result.tx}
                                                                </div>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}

                                            {/* Text Content */}
                                            <div className="prose prose-invert prose-sm max-w-none">
                                                <ReactMarkdown
                                                    remarkPlugins={[remarkGfm]}
                                                    components={{
                                                        a: ({ href, children }) => {
                                                            if (href?.startsWith('nav://')) {
                                                                const navTarget = href.replace('nav://', '');
                                                                const tabMap: Record<string, AppTab> = {
                                                                    'DEALER_CONFIG': AppTab.DEALER_CONFIG,
                                                                    'DEALER_DASHBOARD': AppTab.DEALER_DASHBOARD,
                                                                    'DEALER_THINKING': AppTab.DEALER_THINKING,
                                                                    'VAULT_DEALER': AppTab.VAULT_DEALER,
                                                                    'DASHBOARD': AppTab.DASHBOARD,
                                                                    'VAULT': AppTab.VAULT,
                                                                    'SCHEDULER': AppTab.SCHEDULER,
                                                                };
                                                                const targetTab = tabMap[navTarget];
                                                                if (targetTab && onNavigate) {
                                                                    return (
                                                                        <Button
                                                                            onClick={(e) => {
                                                                                e.preventDefault();
                                                                                e.stopPropagation();
                                                                                onNavigate(targetTab);
                                                                            }}
                                                                            className="mt-3 inline-flex"
                                                                        >
                                                                            <Settings size={16} />
                                                                            <span>{children}</span>
                                                                            <ArrowRight size={14} />
                                                                        </Button>
                                                                    );
                                                                }
                                                                return <span className="text-indigo-400">{children}</span>;
                                                            }
                                                            return <a href={href} target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:text-indigo-300 underline">{children}</a>;
                                                        },
                                                        pre: ({ children }) => (
                                                            <pre className="overflow-x-auto overflow-y-auto max-h-[400px] custom-scrollbar bg-[#0f1015] rounded border border-[#232328] p-4 my-4">
                                                                {children}
                                                            </pre>
                                                        ),
                                                        code: ({ node, inline, className, children, ...props }: any) => {
                                                            return !inline ? (
                                                                <code className={`${className} text-sm`} {...props}>{children}</code>
                                                            ) : (
                                                                <code className="bg-[#1a1b21] px-1.5 py-0.5 rounded text-sm text-[#E7FE55] font-mono border border-[#232328]" {...props}>{children}</code>
                                                            );
                                                        }
                                                    }}
                                                >
                                                    {msg.content}
                                                </ReactMarkdown>
                                            </div>
                                        </div>
                                        <span className="text-[10px] text-[#747580] mt-1.5 px-1">
                                            {new Date(msg.timestamp).toLocaleTimeString()}
                                        </span>
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </AnimatePresence>

                    {/* Processing indicator */}
                    <AnimatePresence>
                        {isAiProcessing && (
                            <motion.div
                                className="flex justify-start"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0 }}
                            >
                                <div className="flex gap-4 max-w-[80%]">
                                    <motion.div
                                        className="w-9 h-9 rounded-full bg-[#E7FE55]/10 border border-[#E7FE55]/20 flex items-center justify-center flex-shrink-0"
                                        animate={{ scale: [1, 1.1, 1] }}
                                        transition={{ duration: 1, repeat: Infinity }}
                                    >
                                        <Bot size={18} className="text-[#E7FE55]" />
                                    </motion.div>
                                    <div className="bg-[#1a1b21] px-4 py-3 rounded-lg rounded-tl-sm border border-[#232328] flex items-center gap-3">
                                        <div className="flex space-x-1">
                                            <motion.div className="w-1.5 h-1.5 bg-[#E7FE55] rounded-full" animate={{ y: [0, -6, 0] }} transition={{ duration: 0.5, repeat: Infinity, delay: 0 }} />
                                            <motion.div className="w-1.5 h-1.5 bg-[#E7FE55] rounded-full" animate={{ y: [0, -6, 0] }} transition={{ duration: 0.5, repeat: Infinity, delay: 0.15 }} />
                                            <motion.div className="w-1.5 h-1.5 bg-[#E7FE55] rounded-full" animate={{ y: [0, -6, 0] }} transition={{ duration: 0.5, repeat: Infinity, delay: 0.3 }} />
                                        </div>
                                        <span className="text-[11px] text-[#E7FE55] font-medium">{aiStatus}</span>
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Input Area */}
                <div className="p-4 bg-transparent z-10 box-border">
                    <div className="relative">
                        <Input
                            ref={inputRef}
                            type="text"
                            value={inputMessage}
                            onChange={(e) => setInputMessage(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && !isAiProcessing && isVaultUnlocked && handleSendMessage()}
                            placeholder="Ask Vault Operator to swap tokens, check prices, or schedule a task..."
                            className="pl-5 pr-14 py-5 text-sm bg-[#1a1b21] border-[#232328] focus-visible:ring-1 focus-visible:ring-[#E7FE55]/20 focus-visible:border-[#E7FE55]/30 placeholder:text-[#747580]"
                            disabled={isAiProcessing}
                        />
                        <Button
                            onClick={handleSendMessage}
                            disabled={!inputMessage.trim() || isAiProcessing}
                            size="icon"
                            className="absolute right-2 top-2 bottom-2 h-auto bg-[#E7FE55] hover:bg-[#f0ff7a] text-black"
                        >
                            {isAiProcessing ? <Clock size={18} className="animate-spin" /> : <Send size={18} />}
                        </Button>
                    </div>
                    <p className="text-center mt-3 text-[10px] text-[#747580] tracking-wide">
                        Vault Operator can make mistakes. Always verify transactions.
                    </p>
                </div>
            </div>

            {/* Right Column: Action Summary Panel */}
            <AnimatePresence>
                {hasActions && (
                    <motion.div
                        className="hidden lg:block w-64 xl:w-72 h-full flex-shrink-0"
                        initial={{ opacity: 0, x: 50 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 50 }}
                    >
                        <ActionSummaryPanel messages={messages} />
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};
