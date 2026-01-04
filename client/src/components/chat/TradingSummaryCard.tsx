import React from 'react';
import { motion } from 'framer-motion';
import { BarChart2, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { TradingViewSummaryItem, EXCHANGE_INFO } from '../../types/structuredResponseTypes';
import { cn } from '@/lib/utils';

interface TradingSummaryCardProps {
  data: TradingViewSummaryItem;
  index?: number;
  className?: string;
}

// Get recommendation color and icon
const getRecommendationInfo = (recommendation: string): { 
  color: string; 
  bgColor: string; 
  borderColor: string;
  icon: React.ReactNode;
  label: string;
} => {
  const rec = recommendation.toUpperCase().replace('_', ' ');
  
  if (rec.includes('STRONG BUY') || rec === 'STRONG_BUY') {
    return {
      color: '#34d399',
      bgColor: 'rgba(52, 211, 153, 0.15)',
      borderColor: 'rgba(52, 211, 153, 0.3)',
      icon: <TrendingUp size={14} />,
      label: 'Strong Buy'
    };
  }
  if (rec.includes('BUY')) {
    return {
      color: '#6ee7b7',
      bgColor: 'rgba(110, 231, 183, 0.15)',
      borderColor: 'rgba(110, 231, 183, 0.3)',
      icon: <TrendingUp size={14} />,
      label: 'Buy'
    };
  }
  if (rec.includes('STRONG SELL') || rec === 'STRONG_SELL') {
    return {
      color: '#f87171',
      bgColor: 'rgba(248, 113, 113, 0.15)',
      borderColor: 'rgba(248, 113, 113, 0.3)',
      icon: <TrendingDown size={14} />,
      label: 'Strong Sell'
    };
  }
  if (rec.includes('SELL')) {
    return {
      color: '#fca5a5',
      bgColor: 'rgba(252, 165, 165, 0.15)',
      borderColor: 'rgba(252, 165, 165, 0.3)',
      icon: <TrendingDown size={14} />,
      label: 'Sell'
    };
  }
  // Neutral
  return {
    color: '#747580',
    bgColor: 'rgba(116, 117, 128, 0.15)',
    borderColor: 'rgba(116, 117, 128, 0.3)',
    icon: <Minus size={14} />,
    label: 'Neutral'
  };
};

export const TradingSummaryCard: React.FC<TradingSummaryCardProps> = ({
  data,
  index = 0,
  className
}) => {
  const recInfo = getRecommendationInfo(data.recommendation);
  const total = data.buy + data.sell + data.neutral;
  const tvInfo = EXCHANGE_INFO.tradingview;

  // Calculate percentages for bars
  const buyPercent = total > 0 ? (data.buy / total) * 100 : 0;
  const sellPercent = total > 0 ? (data.sell / total) * 100 : 0;
  const neutralPercent = total > 0 ? (data.neutral / total) * 100 : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className={cn(
        'bg-[#1a1b21] border border-[#232328] rounded-lg p-4 group',
        'hover:border-[#E7FE55]/30 transition-all duration-300',
        className
      )}
    >
      {/* Header: TradingView badge + Symbol */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {/* TradingView Badge */}
          <span 
            className="text-[9px] px-2 py-0.5 rounded font-bold uppercase tracking-wide"
            style={{
              color: tvInfo.color,
              backgroundColor: tvInfo.bgColor,
              border: `1px solid ${tvInfo.borderColor}`
            }}
          >
            {tvInfo.shortLabel}
          </span>
          <span className="text-sm font-bold text-white">
            {data.symbol}
          </span>
        </div>
        
        {/* Recommendation Badge */}
        <span 
          className="flex items-center gap-1 text-[10px] px-2 py-1 rounded font-bold"
          style={{
            color: recInfo.color,
            backgroundColor: recInfo.bgColor,
            border: `1px solid ${recInfo.borderColor}`
          }}
        >
          {recInfo.icon}
          {recInfo.label}
        </span>
      </div>

      {/* Indicator Bars */}
      <div className="space-y-2">
        {/* Buy Bar */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-[#747580] w-12">Buy</span>
          <div className="flex-1 h-2 bg-[#0f1015] rounded-full overflow-hidden">
            <motion.div 
              className="h-full bg-[#34d399] rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${buyPercent}%` }}
              transition={{ duration: 0.5, delay: 0.1 }}
            />
          </div>
          <span className="text-[10px] text-[#34d399] font-medium w-8 text-right">{data.buy}</span>
        </div>
        
        {/* Neutral Bar */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-[#747580] w-12">Neutral</span>
          <div className="flex-1 h-2 bg-[#0f1015] rounded-full overflow-hidden">
            <motion.div 
              className="h-full bg-[#747580] rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${neutralPercent}%` }}
              transition={{ duration: 0.5, delay: 0.2 }}
            />
          </div>
          <span className="text-[10px] text-[#747580] font-medium w-8 text-right">{data.neutral}</span>
        </div>
        
        {/* Sell Bar */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-[#747580] w-12">Sell</span>
          <div className="flex-1 h-2 bg-[#0f1015] rounded-full overflow-hidden">
            <motion.div 
              className="h-full bg-red-400 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${sellPercent}%` }}
              transition={{ duration: 0.5, delay: 0.3 }}
            />
          </div>
          <span className="text-[10px] text-red-400 font-medium w-8 text-right">{data.sell}</span>
        </div>
      </div>
    </motion.div>
  );
};
