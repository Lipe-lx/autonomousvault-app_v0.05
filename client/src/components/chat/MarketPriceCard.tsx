import React from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, DollarSign } from 'lucide-react';
import { MarketPriceItem, EXCHANGE_INFO, ExchangeId } from '../../types/structuredResponseTypes';
import { cn } from '@/lib/utils';

interface MarketPriceCardProps {
  data: MarketPriceItem;
  index?: number;
  className?: string;
}

export const MarketPriceCard: React.FC<MarketPriceCardProps> = ({
  data,
  index = 0,
  className
}) => {
  // Normalize exchange to known type
  const exchangeKey = (data.exchange?.toLowerCase() || 'unknown') as ExchangeId;
  const exchangeInfo = EXCHANGE_INFO[exchangeKey] || EXCHANGE_INFO.unknown;
  
  const hasChange = data.change24hPercent !== undefined;
  const isPositive = (data.change24hPercent ?? 0) >= 0;

  // Format price with appropriate decimals
  const formatPrice = (price: number): string => {
    if (price >= 1000) return price.toLocaleString('en-US', { maximumFractionDigits: 2 });
    if (price >= 1) return price.toFixed(4);
    return price.toFixed(6);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className={cn(
        'bg-[#1a1b21] border border-[#232328] rounded-lg p-4 group',
        'hover:border-[#E7FE55]/30 transition-all duration-300',
        'relative overflow-hidden',
        className
      )}
    >
      {/* Subtle glow effect on hover */}
      <div className="absolute top-0 right-0 w-16 h-16 bg-[#E7FE55]/5 rounded-full blur-2xl -z-0 opacity-0 group-hover:opacity-100 transition-opacity" />

      {/* Header: Exchange badge + Symbol */}
      <div className="flex items-center justify-between mb-3 relative z-10">
        <div className="flex items-center gap-2">
          {/* Exchange Badge */}
          <span 
            className="text-[9px] px-2 py-0.5 rounded font-bold uppercase tracking-wide"
            style={{
              color: exchangeInfo.color,
              backgroundColor: exchangeInfo.bgColor,
              border: `1px solid ${exchangeInfo.borderColor}`
            }}
          >
            {exchangeInfo.shortLabel}
          </span>
          <span className="text-sm font-bold text-white">
            {data.symbol}
          </span>
        </div>
        
        {/* Price change indicator */}
        {hasChange && (
          <div className={cn(
            "flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded",
            isPositive 
              ? "text-[#34d399] bg-[#34d399]/10" 
              : "text-red-400 bg-red-400/10"
          )}>
            {isPositive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            <span>{isPositive ? '+' : ''}{data.change24hPercent?.toFixed(2)}%</span>
          </div>
        )}
      </div>

      {/* Main Price Display */}
      <div className="flex items-center gap-2 relative z-10">
        <div 
          className="w-10 h-10 rounded-full flex items-center justify-center"
          style={{ 
            backgroundColor: exchangeInfo.bgColor,
            border: `1px solid ${exchangeInfo.borderColor}`
          }}
        >
          <DollarSign size={20} style={{ color: exchangeInfo.color }} />
        </div>
        <div>
          <div className="text-[10px] text-[#747580] uppercase tracking-wider">Market Price</div>
          <div className="text-xl font-bold text-white font-mono">
            ${formatPrice(data.price)}
          </div>
        </div>
      </div>

      {/* 24h Change Value (if available) */}
      {data.change24h !== undefined && (
        <div className="mt-2 pt-2 border-t border-[#232328] text-[10px] text-[#747580] relative z-10">
          24h: <span className={cn(
            "font-medium",
            isPositive ? "text-[#34d399]" : "text-red-400"
          )}>
            {isPositive ? '+' : ''}${data.change24h.toFixed(2)}
          </span>
        </div>
      )}

      {/* Bid/Ask spread (for orderbook data) */}
      {(data.bid !== undefined || data.ask !== undefined) && (
        <div className="mt-2 pt-2 border-t border-[#232328] grid grid-cols-2 gap-2 text-[10px] relative z-10">
          {data.bid !== undefined && (
            <div>
              <div className="text-[#747580] uppercase tracking-wider mb-0.5">Bid</div>
              <div className="text-[#34d399] font-mono font-medium">${formatPrice(data.bid)}</div>
            </div>
          )}
          {data.ask !== undefined && (
            <div>
              <div className="text-[#747580] uppercase tracking-wider mb-0.5">Ask</div>
              <div className="text-red-400 font-mono font-medium">${formatPrice(data.ask)}</div>
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
};
