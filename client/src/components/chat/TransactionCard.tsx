import React from 'react';
import { motion } from 'framer-motion';
import { CheckCircle, Clock, XCircle, ExternalLink, ArrowRight } from 'lucide-react';
import { TransactionItem, getExplorerUrl } from '../../types/structuredResponseTypes';
import { formatTokenAmount, truncateAddress } from '../../utils/formatUtils';
import { cn } from '@/lib/utils';

interface TransactionCardProps {
  data: TransactionItem;
  index?: number;
  className?: string;
}

const STATUS_CONFIG = {
  success: {
    icon: CheckCircle,
    color: '#34d399',
    bgColor: 'rgba(52, 211, 153, 0.1)',
    borderColor: 'rgba(52, 211, 153, 0.3)',
    label: 'Success'
  },
  pending: {
    icon: Clock,
    color: '#fbbf24',
    bgColor: 'rgba(251, 191, 36, 0.1)',
    borderColor: 'rgba(251, 191, 36, 0.3)',
    label: 'Pending'
  },
  failed: {
    icon: XCircle,
    color: '#ef4444',
    bgColor: 'rgba(239, 68, 68, 0.1)',
    borderColor: 'rgba(239, 68, 68, 0.3)',
    label: 'Failed'
  }
};

export const TransactionCard: React.FC<TransactionCardProps> = ({
  data,
  index = 0,
  className
}) => {
  const status = STATUS_CONFIG[data.status];
  const StatusIcon = status.icon;
  const explorerUrl = data.explorerUrl || (data.txHash ? getExplorerUrl(data.network, data.txHash) : null);

  const handleViewTx = (e: React.MouseEvent) => {
    e.preventDefault();
    if (explorerUrl) {
      window.open(explorerUrl, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className={cn(
        'bg-[#1a1b21] border rounded-lg p-4 group',
        'transition-all duration-300',
        className
      )}
      style={{
        borderColor: status.borderColor
      }}
    >
      {/* Header with status icon */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div 
            className="w-8 h-8 rounded-full flex items-center justify-center"
            style={{ backgroundColor: status.bgColor }}
          >
            <StatusIcon size={16} style={{ color: status.color }} />
          </div>
          <div>
            <div className="text-sm font-semibold text-white">{data.title}</div>
            <div className="text-[10px]" style={{ color: status.color }}>{status.label}</div>
          </div>
        </div>
      </div>

      {/* Transaction details */}
      {data.details && (
        <div 
          className="p-3 rounded-lg mb-3 text-sm"
          style={{ backgroundColor: status.bgColor }}
        >
          {data.details.amount !== undefined && data.details.token && (
            <div className="flex items-center gap-2 text-white font-medium">
              <span>{formatTokenAmount(data.details.amount, { symbol: data.details.token })}</span>
              {data.details.from && data.details.to && (
                <>
                  <ArrowRight size={14} className="text-[#747580]" />
                  <span className="text-[#747580] text-xs font-mono">
                    {truncateAddress(data.details.to)}
                  </span>
                </>
              )}
            </div>
          )}
          
          {data.details.fee !== undefined && (
            <div className="text-[10px] text-[#747580] mt-1">
              Fee: ${data.details.fee.toFixed(2)}
            </div>
          )}
        </div>
      )}

      {/* Description */}
      {data.description && (
        <p className="text-xs text-[#a0a0a8] mb-3">{data.description}</p>
      )}

      {/* View transaction link */}
      {explorerUrl && (
        <button
          onClick={handleViewTx}
          className="flex items-center gap-1.5 text-[11px] text-[#60a5fa] hover:text-[#93c5fd] transition-colors group/link"
        >
          View Transaction
          <ExternalLink size={12} className="group-hover/link:translate-x-0.5 group-hover/link:-translate-y-0.5 transition-transform" />
        </button>
      )}

      {/* TX Hash display */}
      {data.txHash && (
        <div className="mt-2 pt-2 border-t border-[#232328] text-[9px] font-mono text-[#747580]">
          TX: {truncateAddress(data.txHash, { startChars: 10, endChars: 8 })}
        </div>
      )}
    </motion.div>
  );
};
