import React from 'react';
import { motion } from 'framer-motion';
import { BarChart3, TrendingUp, TrendingDown, Clock } from 'lucide-react';
import { OHLCVItem } from '../../types/structuredResponseTypes';
import { cn } from '@/lib/utils';

interface OHLCVCardProps {
  data: OHLCVItem;
  index?: number;
  className?: string;
}

export const OHLCVCard: React.FC<OHLCVCardProps> = ({
  data,
  index = 0,
  className
}) => {
  const isPositive = data.close >= data.open;
  const changePercent = ((data.close - data.open) / data.open) * 100;

  // Format price with appropriate decimals
  const formatPrice = (price: number): string => {
    if (price >= 1000) return price.toLocaleString('en-US', { maximumFractionDigits: 2 });
    if (price >= 1) return price.toFixed(4);
    return price.toFixed(6);
  };

  // Format volume
  const formatVolume = (vol: number): string => {
    if (vol >= 1e9) return `${(vol / 1e9).toFixed(2)}B`;
    if (vol >= 1e6) return `${(vol / 1e6).toFixed(2)}M`;
    if (vol >= 1e3) return `${(vol / 1e3).toFixed(2)}K`;
    return vol.toFixed(2);
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
      {/* Header: Symbol + Timeframe */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={cn(
            "w-8 h-8 rounded-full flex items-center justify-center",
            isPositive ? "bg-[#34d399]/10" : "bg-red-400/10"
          )}>
            <BarChart3 size={16} className={isPositive ? "text-[#34d399]" : "text-red-400"} />
          </div>
          <div>
            <div className="text-sm font-bold text-white">{data.symbol}</div>
            <div className="flex items-center gap-1 text-[10px] text-[#747580]">
              <Clock size={10} />
              <span>{data.timeframe}</span>
            </div>
          </div>
        </div>
        
        {/* Change indicator */}
        <div className={cn(
          "flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded",
          isPositive 
            ? "text-[#34d399] bg-[#34d399]/10" 
            : "text-red-400 bg-red-400/10"
        )}>
          {isPositive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
          <span>{isPositive ? '+' : ''}{changePercent.toFixed(2)}%</span>
        </div>
      </div>

      {/* OHLC Grid */}
      <div className="grid grid-cols-4 gap-2 text-[11px]">
        <div className="bg-[#0f1015] rounded p-2">
          <div className="text-[#747580] text-[9px] uppercase tracking-wider mb-1">Open</div>
          <div className="text-white font-mono font-medium">{formatPrice(data.open)}</div>
        </div>
        <div className="bg-[#0f1015] rounded p-2">
          <div className="text-[#747580] text-[9px] uppercase tracking-wider mb-1">High</div>
          <div className="text-[#34d399] font-mono font-medium">{formatPrice(data.high)}</div>
        </div>
        <div className="bg-[#0f1015] rounded p-2">
          <div className="text-[#747580] text-[9px] uppercase tracking-wider mb-1">Low</div>
          <div className="text-red-400 font-mono font-medium">{formatPrice(data.low)}</div>
        </div>
        <div className="bg-[#0f1015] rounded p-2">
          <div className="text-[#747580] text-[9px] uppercase tracking-wider mb-1">Close</div>
          <div className={cn(
            "font-mono font-medium",
            isPositive ? "text-[#34d399]" : "text-red-400"
          )}>{formatPrice(data.close)}</div>
        </div>
      </div>

      {/* Volume */}
      <div className="mt-2 pt-2 border-t border-[#232328] flex items-center justify-between text-[10px]">
        <span className="text-[#747580]">Volume</span>
        <span className="text-white font-mono">{formatVolume(data.volume)}</span>
      </div>
    </motion.div>
  );
};
