import React from 'react';
import { motion } from 'framer-motion';
import { ExternalLink, TrendingUp, Droplets, Percent } from 'lucide-react';
import { PoolItem, getPoolUrl } from '../../types/structuredResponseTypes';
import { formatCompactNumber, formatPercent } from '../../utils/formatUtils';
import { ProtocolBadge } from './ProtocolBadge';
import { cn } from '@/lib/utils';

interface PoolCardProps {
  data: PoolItem;
  index?: number;
  compact?: boolean;
  className?: string;
}

export const PoolCard: React.FC<PoolCardProps> = ({
  data,
  index = 0,
  compact = false,
  className
}) => {
  const poolUrl = data.poolUrl || getPoolUrl(data.protocol, data.poolAddress);

  const handleOpenPool = (e: React.MouseEvent) => {
    e.preventDefault();
    if (poolUrl) {
      window.open(poolUrl, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className={cn(
        'bg-[#1a1b21] border border-[#232328] rounded-lg p-3 group',
        'hover:border-[#E7FE55]/30 transition-all duration-300',
        'relative overflow-hidden',
        className
      )}
    >
      {/* Subtle glow effect on hover */}
      <div className="absolute top-0 right-0 w-16 h-16 bg-[#E7FE55]/5 rounded-full blur-2xl -z-0 opacity-0 group-hover:opacity-100 transition-opacity" />

      {/* Header: Token pair + Badge */}
      <div className="flex items-center justify-between mb-2 relative z-10">
        <div className="flex items-center gap-2">
          <ProtocolBadge protocol={data.protocol} size="sm" />
          <span className="text-sm font-bold text-white">
            {data.tokenA.symbol} / {data.tokenB.symbol}
          </span>
        </div>
        
        {poolUrl && (
          <button
            onClick={handleOpenPool}
            className="p-1.5 rounded hover:bg-[#E7FE55]/10 text-[#747580] hover:text-[#E7FE55] transition-colors"
            title="Open Pool"
          >
            <ExternalLink size={14} />
          </button>
        )}
      </div>

      {/* Metrics */}
      <div className={cn(
        "grid gap-2 text-[11px] relative z-10",
        compact ? "grid-cols-2" : "grid-cols-3"
      )}>
        {/* Volume */}
        {data.volume24h !== undefined && (
          <div className="flex items-center gap-1.5">
            <TrendingUp size={12} className="text-[#60a5fa]" />
            <div>
              <div className="text-[#747580] text-[9px] uppercase tracking-wider">Vol</div>
              <div className="font-semibold text-white">
                {formatCompactNumber(data.volume24h)}
              </div>
            </div>
          </div>
        )}

        {/* TVL */}
        {data.tvl !== undefined && (
          <div className="flex items-center gap-1.5">
            <Droplets size={12} className="text-[#8b5cf6]" />
            <div>
              <div className="text-[#747580] text-[9px] uppercase tracking-wider">TVL</div>
              <div className="font-semibold text-white">
                {formatCompactNumber(data.tvl)}
              </div>
            </div>
          </div>
        )}

        {/* APY */}
        {data.apy !== undefined && (
          <div className="flex items-center gap-1.5">
            <Percent size={12} className="text-[#34d399]" />
            <div>
              <div className="text-[#747580] text-[9px] uppercase tracking-wider">APY</div>
              <div className={cn(
                "font-semibold",
                data.apy > 0 ? "text-[#34d399]" : "text-white"
              )}>
                {formatPercent(data.apy)}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Current Price (if available) */}
      {data.currentPrice !== undefined && !compact && (
        <div className="mt-2 pt-2 border-t border-[#232328] text-[10px] text-[#747580] relative z-10">
          Price: <span className="text-white font-mono">${data.currentPrice.toFixed(4)}</span>
        </div>
      )}
    </motion.div>
  );
};
