import React from 'react';
import { motion } from 'framer-motion';
import { Activity, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { IndicatorItem } from '../../types/structuredResponseTypes';
import { cn } from '@/lib/utils';

interface IndicatorCardProps {
  data: IndicatorItem;
  index?: number;
  className?: string;
}

// Indicator-specific color logic
const getIndicatorColor = (indicator: string, value: number | Record<string, number>): { color: string; status: string } => {
  const upperIndicator = indicator.toUpperCase();
  
  if (typeof value === 'number') {
    // RSI zones
    if (upperIndicator === 'RSI') {
      if (value >= 70) return { color: 'text-red-400', status: 'Overbought' };
      if (value <= 30) return { color: 'text-[#34d399]', status: 'Oversold' };
      return { color: 'text-[#60a5fa]', status: 'Neutral' };
    }
    
    // Stochastic
    if (upperIndicator === 'STOCH' || upperIndicator === 'STOCHASTIC') {
      if (value >= 80) return { color: 'text-red-400', status: 'Overbought' };
      if (value <= 20) return { color: 'text-[#34d399]', status: 'Oversold' };
      return { color: 'text-[#60a5fa]', status: 'Neutral' };
    }
    
    // ADX
    if (upperIndicator === 'ADX') {
      if (value >= 50) return { color: 'text-[#E7FE55]', status: 'Strong Trend' };
      if (value >= 25) return { color: 'text-[#60a5fa]', status: 'Trending' };
      return { color: 'text-[#747580]', status: 'Weak/No Trend' };
    }
  }
  
  // Default
  return { color: 'text-white', status: '' };
};

// Get indicator badge color
const getIndicatorBadgeColor = (indicator: string): { bg: string; text: string; border: string } => {
  const upperIndicator = indicator.toUpperCase();
  
  switch (upperIndicator) {
    case 'RSI':
      return { bg: 'rgba(96, 165, 250, 0.15)', text: '#60a5fa', border: 'rgba(96, 165, 250, 0.3)' };
    case 'MACD':
      return { bg: 'rgba(139, 92, 246, 0.15)', text: '#8b5cf6', border: 'rgba(139, 92, 246, 0.3)' };
    case 'EMA':
    case 'SMA':
      return { bg: 'rgba(52, 211, 153, 0.15)', text: '#34d399', border: 'rgba(52, 211, 153, 0.3)' };
    case 'BBANDS':
    case 'BOLLINGER':
      return { bg: 'rgba(244, 114, 182, 0.15)', text: '#f472b6', border: 'rgba(244, 114, 182, 0.3)' };
    case 'ADX':
      return { bg: 'rgba(251, 191, 36, 0.15)', text: '#fbbf24', border: 'rgba(251, 191, 36, 0.3)' };
    default:
      return { bg: 'rgba(231, 254, 85, 0.15)', text: '#E7FE55', border: 'rgba(231, 254, 85, 0.3)' };
  }
};

export const IndicatorCard: React.FC<IndicatorCardProps> = ({
  data,
  index = 0,
  className
}) => {
  const { color, status } = getIndicatorColor(data.indicator, data.value);
  const badgeColors = getIndicatorBadgeColor(data.indicator);
  const isMultiValue = typeof data.value === 'object';

  // Format value display
  const formatValue = (val: number): string => {
    if (Math.abs(val) >= 1000) return val.toLocaleString('en-US', { maximumFractionDigits: 2 });
    return val.toFixed(4);
  };

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
      {/* Header: Indicator badge + Symbol */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {/* Indicator Badge */}
          <span 
            className="text-[9px] px-2 py-0.5 rounded font-bold uppercase tracking-wide"
            style={{
              color: badgeColors.text,
              backgroundColor: badgeColors.bg,
              border: `1px solid ${badgeColors.border}`
            }}
          >
            {data.indicator.toUpperCase()}
          </span>
          <span className="text-sm font-bold text-white">
            {data.symbol}
          </span>
        </div>
        
        <span className="text-[10px] text-[#747580]">{data.timeframe}</span>
      </div>

      {/* Value Display */}
      {isMultiValue ? (
        // Multi-value indicator (like MACD)
        <div className="grid grid-cols-2 gap-2 text-[11px]">
          {Object.entries(data.value as Record<string, number>).map(([key, val]) => (
            <div key={key} className="bg-[#0f1015] rounded p-2">
              <div className="text-[#747580] text-[9px] uppercase tracking-wider mb-1">{key}</div>
              <div className={cn(
                "font-mono font-medium",
                val >= 0 ? "text-[#34d399]" : "text-red-400"
              )}>{formatValue(val)}</div>
            </div>
          ))}
        </div>
      ) : (
        // Single value indicator
        <div className="flex items-center gap-3">
          <div 
            className="w-10 h-10 rounded-full flex items-center justify-center"
            style={{ 
              backgroundColor: badgeColors.bg,
              border: `1px solid ${badgeColors.border}`
            }}
          >
            <Activity size={20} style={{ color: badgeColors.text }} />
          </div>
          <div>
            <div className={cn("text-2xl font-bold font-mono", color)}>
              {formatValue(data.value as number)}
            </div>
            {status && (
              <div className="text-[10px] text-[#747580]">{status}</div>
            )}
          </div>
        </div>
      )}
    </motion.div>
  );
};
