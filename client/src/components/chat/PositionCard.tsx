import React from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, AlertTriangle, DollarSign } from 'lucide-react';
import { PositionItem, PROTOCOL_INFO } from '../../types/structuredResponseTypes';
import { formatCompactNumber, formatPercent, formatUSD } from '../../utils/formatUtils';
import { ProtocolBadge } from './ProtocolBadge';
import { cn } from '@/lib/utils';

interface PositionCardProps {
  data: PositionItem;
  index?: number;
  className?: string;
}

export const PositionCard: React.FC<PositionCardProps> = ({
  data,
  index = 0,
  className
}) => {
  const isLong = data.direction === 'long';
  const hasPnl = data.pnl !== undefined;
  const isProfitable = hasPnl && data.pnl!.value >= 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className={cn(
        'bg-[#1a1b21] border rounded-lg p-4 group',
        'hover:border-[#E7FE55]/30 transition-all duration-300',
        isLong ? 'border-[#34d399]/30' : 'border-[#ef4444]/30',
        className
      )}
    >
      {/* Header: Coin + Direction */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <ProtocolBadge protocol={data.protocol} size="sm" />
          <span className="text-base font-bold text-white">{data.coin}</span>
          <span className={cn(
            'text-xs font-bold px-2 py-0.5 rounded',
            isLong 
              ? 'bg-[#34d399]/20 text-[#34d399]' 
              : 'bg-[#ef4444]/20 text-[#ef4444]'
          )}>
            {isLong ? '↑ LONG' : '↓ SHORT'}
          </span>
        </div>
        {data.leverage && (
          <span className="text-xs text-[#747580]">{data.leverage}x</span>
        )}
      </div>

      {/* Size and Entry */}
      <div className="grid grid-cols-2 gap-3 mb-3 text-xs">
        <div>
          <div className="text-[#747580] text-[9px] uppercase tracking-wider mb-1">Size</div>
          <div className="font-semibold text-white">
            {data.size?.toFixed(4)} {data.coin}
          </div>
        </div>
        <div>
          <div className="text-[#747580] text-[9px] uppercase tracking-wider mb-1">Entry</div>
          <div className="font-mono text-white">
            ${data.entryPrice?.toFixed(2)}
          </div>
        </div>
      </div>

      {/* Value and PnL */}
      <div className="grid grid-cols-2 gap-3 text-xs">
        <div>
          <div className="text-[#747580] text-[9px] uppercase tracking-wider mb-1">Value</div>
          <div className="font-bold text-white">
            {formatUSD(data.valueUsd)}
          </div>
        </div>
        {hasPnl && (
          <div>
            <div className="text-[#747580] text-[9px] uppercase tracking-wider mb-1">Unrealized PnL</div>
            <div className={cn(
              'flex items-center gap-1 font-bold',
              isProfitable ? 'text-[#34d399]' : 'text-[#ef4444]'
            )}>
              {isProfitable ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
              {formatUSD(data.pnl!.value, { showSign: true })}
              <span className="text-[10px] opacity-70">
                ({formatPercent(data.pnl!.percent, { showSign: true })})
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Liquidation Warning */}
      {data.liquidationPrice && data.liquidationPrice > 0 && (
        <div className="mt-3 pt-3 border-t border-[#232328] flex items-center gap-2 text-[10px] text-[#fbbf24]">
          <AlertTriangle size={12} />
          <span>Liq. Price: ${data.liquidationPrice.toFixed(2)}</span>
        </div>
      )}
    </motion.div>
  );
};

// Grid for multiple positions
interface PositionGridProps {
  positions: PositionItem[];
  className?: string;
}

export const PositionGrid: React.FC<PositionGridProps> = ({ positions, className }) => {
  return (
    <div className={cn('grid grid-cols-1 sm:grid-cols-2 gap-3', className)}>
      {positions.map((pos, idx) => (
        <PositionCard key={`${pos.protocol}-${pos.coin}-${idx}`} data={pos} index={idx} />
      ))}
    </div>
  );
};
