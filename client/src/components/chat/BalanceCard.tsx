import React from 'react';
import { motion } from 'framer-motion';
import { Wallet, TrendingUp, TrendingDown } from 'lucide-react';
import { BalanceItem, PROTOCOL_INFO, NetworkId } from '../../types/structuredResponseTypes';
import { formatTokenAmount, formatUSD } from '../../utils/formatUtils';
import { cn } from '@/lib/utils';

interface BalanceCardProps {
  data: BalanceItem;
  index?: number;
  className?: string;
}

const NETWORK_ICONS: Record<NetworkId, { color: string; label: string }> = {
  solana: { color: '#9945FF', label: 'Solana' },
  hyperliquid: { color: '#E7FE55', label: 'Hyperliquid' },
  polygon: { color: '#8247E5', label: 'Polygon' }
};

export const BalanceCard: React.FC<BalanceCardProps> = ({
  data,
  index = 0,
  className
}) => {
  const networkInfo = NETWORK_ICONS[data.network];
  const hasPositiveValue = data.valueUsd !== undefined && data.valueUsd > 0;

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
      {/* Header with network indicator */}
      <div className="flex items-center gap-2 mb-3">
        <div 
          className="w-8 h-8 rounded-full flex items-center justify-center"
          style={{ 
            backgroundColor: `${networkInfo.color}15`,
            border: `1px solid ${networkInfo.color}30`
          }}
        >
          <Wallet size={16} style={{ color: networkInfo.color }} />
        </div>
        <div>
          <div className="text-xs font-semibold text-white">{data.token.symbol} Balance</div>
          <div className="text-[10px] text-[#747580]">{networkInfo.label}</div>
        </div>
      </div>

      {/* Amount display */}
      <div className="space-y-1">
        <div className="text-xl font-bold text-white">
          {formatTokenAmount(data.amount, { symbol: data.token.symbol })}
        </div>
        
        {data.valueUsd !== undefined && (
          <div className="flex items-center gap-1 text-sm">
            <span className="text-[#747580]">≈</span>
            <span className={cn(
              'font-medium',
              hasPositiveValue ? 'text-[#34d399]' : 'text-[#747580]'
            )}>
              {formatUSD(data.valueUsd)}
            </span>
          </div>
        )}
      </div>
    </motion.div>
  );
};

// Multiple balances grid
interface BalanceGridProps {
  balances: BalanceItem[];
  className?: string;
}

export const BalanceGrid: React.FC<BalanceGridProps> = ({ balances, className }) => {
  return (
    <div className={cn('grid grid-cols-1 sm:grid-cols-2 gap-3', className)}>
      {balances.map((balance, idx) => (
        <BalanceCard key={`${balance.network}-${balance.token.symbol}-${idx}`} data={balance} index={idx} />
      ))}
    </div>
  );
};
