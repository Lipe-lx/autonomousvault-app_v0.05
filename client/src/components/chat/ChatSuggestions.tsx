import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    Droplets, 
    TrendingUp, 
    Wallet, 
    ArrowDownToLine,
    ChevronRight,
    Activity,
    Clock,
    BarChart3
} from 'lucide-react';

interface SuggestionCategory {
    id: string;
    label: string;
    icon: React.ReactNode;
    color: string;
    suggestions: string[];
}

interface ChatSuggestionsProps {
    onSuggestionClick: (suggestion: string) => void;
}

const categories: SuggestionCategory[] = [
    {
        id: 'pools',
        label: 'Liquidity Pools',
        icon: <Droplets size={14} />,
        color: '#9b87f5',
        suggestions: [
            'Show top pools by volatility',
            'Find SOL/USDC pools',
            'What is the best APY pool?',
            'Suggest optimal range for SOL/USDC'
        ]
    },
    {
        id: 'hyperliquid',
        label: 'Hyperliquid',
        icon: <TrendingUp size={14} />,
        color: '#34d399',
        suggestions: [
            'Check my HL balance',
            'Show my open positions',
            'Analyze market for BTC',
            'Is BTC trending up?'
        ]
    },
    {
        id: 'dealer',
        label: 'Vault Dealer',
        icon: <Activity size={14} />,
        color: '#E7FE55',
        suggestions: [
            'Explain dealer latest decision',
            'Show dealer trade history',
            'What is the dealer thinking?',
            'Show recent dealer logs'
        ]
    },
    {
        id: 'analysis',
        label: 'Market Analysis',
        icon: <BarChart3 size={14} />,
        color: '#60a5fa',
        suggestions: [
            'Show RSI analysis for SOL on 4h',
            'Show BTC price and indicators',
            'What is the MACD for ETH?',
            'Show candlestick chart for BTC'
        ]
    },
    {
        id: 'automations',
        label: 'Automations',
        icon: <Clock size={14} />,
        color: '#fbbf24',
        suggestions: [
            'Swap SOL to USDC in 5 minutes',
            'Alert me when BTC RSI < 30 on 1h',
            'Buy BTC on HL when price hits 95k',
            'Show my scheduled tasks'
        ]
    },
    {
        id: 'solana',
        label: 'Solana',
        icon: <Wallet size={14} />,
        color: '#9b87f5',
        suggestions: [
            'Check my wallet balance',
            'Show SOL price',
            'List my token holdings',
            'Transfer 1 SOL'
        ]
    },
    {
        id: 'withdrawals',
        label: 'Withdrawals',
        icon: <ArrowDownToLine size={14} />,
        color: '#60a5fa',
        suggestions: [
            'Withdraw 100 USDC from HL',
            'Show pending withdrawals',
            'Check withdrawal status'
        ]
    }
];

export const ChatSuggestions: React.FC<ChatSuggestionsProps> = ({ onSuggestionClick }) => {
    const [hoveredCategory, setHoveredCategory] = useState<string | null>(null);

    return (
        <div className="w-full max-w-2xl mx-auto mt-6">
            <p className="text-[10px] uppercase tracking-[0.15em] text-[#747580] text-center mb-4 font-medium">
                Try asking about
            </p>
            
            <div className="flex flex-wrap justify-center gap-2">
                {categories.map((category) => (
                    <div
                        key={category.id}
                        className="relative"
                        onMouseEnter={() => setHoveredCategory(category.id)}
                        onMouseLeave={() => setHoveredCategory(null)}
                    >
                        {/* Category Pill */}
                        <motion.button
                            className="flex items-center gap-2 px-3 py-1.5 rounded text-[11px] font-medium transition-all border"
                            style={{
                                backgroundColor: hoveredCategory === category.id ? `${category.color}15` : 'transparent',
                                borderColor: hoveredCategory === category.id ? `${category.color}40` : '#232328',
                                color: hoveredCategory === category.id ? category.color : '#747580'
                            }}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                        >
                            {category.icon}
                            {category.label}
                            <ChevronRight 
                                size={12} 
                                className="transition-transform"
                                style={{ 
                                    transform: hoveredCategory === category.id ? 'rotate(90deg)' : 'rotate(0deg)',
                                    opacity: hoveredCategory === category.id ? 1 : 0.5
                                }}
                            />
                        </motion.button>

                        {/* Dropdown */}
                        <AnimatePresence>
                            {hoveredCategory === category.id && (
                                <motion.div
                                    className="absolute top-full left-0 mt-1 z-50 min-w-[200px]"
                                    initial={{ opacity: 0, y: -5 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -5 }}
                                    transition={{ duration: 0.15 }}
                                >
                                    <div 
                                        className="bg-[#14151a] border border-[#232328] rounded p-1 shadow-lg"
                                        style={{ borderColor: `${category.color}30` }}
                                    >
                                        {category.suggestions.map((suggestion, idx) => (
                                            <motion.button
                                                key={idx}
                                                className="w-full text-left px-3 py-2 text-[11px] text-[#e4e5e9] hover:bg-[#1a1b21] rounded transition-colors"
                                                onClick={() => onSuggestionClick(suggestion)}
                                                whileHover={{ x: 2 }}
                                            >
                                                {suggestion}
                                            </motion.button>
                                        ))}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                ))}
            </div>
        </div>
    );
};
