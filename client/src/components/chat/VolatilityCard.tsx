import React from 'react';
import { motion } from 'framer-motion';
import { BarChart3, TrendingUp, TrendingDown, Activity, AlertTriangle } from 'lucide-react';
import { VolatilityItem, RangeSuggestion, PROTOCOL_INFO } from '../../types/structuredResponseTypes';
import { formatPercent, formatCompactNumber } from '../../utils/formatUtils';
import { ProtocolBadge } from './ProtocolBadge';
import { cn } from '@/lib/utils';

interface VolatilityCardProps {
  data: VolatilityItem;
  rangeSuggestions?: RangeSuggestion[];
  index?: number;
  className?: string;
}

const CONFIDENCE_CONFIG = {
  high: { color: '#34d399', label: 'High', emoji: '🟢' },
  medium: { color: '#fbbf24', label: 'Medium', emoji: '🟡' },
  low: { color: '#ef4444', label: 'Low', emoji: '🔴' }
};

const STRATEGY_CONFIG = {
  conservative: { color: '#34d399', bgColor: 'rgba(52, 211, 153, 0.1)', emoji: '🟢' },
  moderate: { color: '#fbbf24', bgColor: 'rgba(251, 191, 36, 0.1)', emoji: '🟡' },
  aggressive: { color: '#ef4444', bgColor: 'rgba(239, 68, 68, 0.1)', emoji: '🔴' }
};

export const VolatilityCard: React.FC<VolatilityCardProps> = ({
  data,
  rangeSuggestions,
  index = 0,
  className
}) => {
  const confidence = CONFIDENCE_CONFIG[data.confidence];
  const priceUp24h = data.priceChange24h !== undefined && data.priceChange24h >= 0;
  const priceUp7d = data.priceChange7d !== undefined && data.priceChange7d >= 0;

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
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-[#60a5fa]/10 border border-[#60a5fa]/30 flex items-center justify-center">
            <BarChart3 size={16} className="text-[#60a5fa]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-white">
                {data.poolName || `Pool ${data.poolAddress.slice(0, 8)}...`}
              </span>
              <ProtocolBadge protocol={data.protocol} size="sm" />
            </div>
            <div className="text-[10px] text-[#747580]">Volatility Analysis</div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs font-mono text-white">${data.currentPrice.toFixed(4)}</div>
          <div className="text-[9px] text-[#747580]">Current Price</div>
        </div>
      </div>

      {/* Volatility Metrics */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-[#0f1015] rounded-lg p-3">
          <div className="text-[9px] text-[#747580] uppercase tracking-wider mb-1">Daily Vol</div>
          <div className="text-lg font-bold text-[#60a5fa]">
            {formatPercent(data.volatilityDaily)}
          </div>
        </div>
        <div className="bg-[#0f1015] rounded-lg p-3">
          <div className="text-[9px] text-[#747580] uppercase tracking-wider mb-1">Annual Vol</div>
          <div className="text-lg font-bold text-[#8b5cf6]">
            {formatPercent(data.volatilityAnnualized)}
          </div>
        </div>
      </div>

      {/* Price Changes */}
      {(data.priceChange24h !== undefined || data.priceChange7d !== undefined) && (
        <div className="flex gap-4 mb-4 text-xs">
          {data.priceChange24h !== undefined && (
            <div className="flex items-center gap-1">
              {priceUp24h ? (
                <TrendingUp size={12} className="text-[#34d399]" />
              ) : (
                <TrendingDown size={12} className="text-[#ef4444]" />
              )}
              <span className={priceUp24h ? 'text-[#34d399]' : 'text-[#ef4444]'}>
                {formatPercent(data.priceChange24h, { showSign: true })}
              </span>
              <span className="text-[#747580]">24h</span>
            </div>
          )}
          {data.priceChange7d !== undefined && (
            <div className="flex items-center gap-1">
              {priceUp7d ? (
                <TrendingUp size={12} className="text-[#34d399]" />
              ) : (
                <TrendingDown size={12} className="text-[#ef4444]" />
              )}
              <span className={priceUp7d ? 'text-[#34d399]' : 'text-[#ef4444]'}>
                {formatPercent(data.priceChange7d, { showSign: true })}
              </span>
              <span className="text-[#747580]">7d</span>
            </div>
          )}
        </div>
      )}

      {/* TVL if available */}
      {data.tvl !== undefined && (
        <div className="text-xs text-[#747580] mb-3">
          TVL: <span className="text-white font-medium">{formatCompactNumber(data.tvl)}</span>
        </div>
      )}

      {/* Range Suggestions */}
      {rangeSuggestions && rangeSuggestions.length > 0 && (
        <div className="mt-4 pt-4 border-t border-[#232328]">
          <div className="text-[10px] text-[#747580] uppercase tracking-wider mb-3">
            Suggested Ranges
          </div>
          <div className="space-y-2">
            {rangeSuggestions.map((range, idx) => {
              const strategy = STRATEGY_CONFIG[range.strategy];
              return (
                <div 
                  key={idx}
                  className="p-2 rounded-lg text-xs"
                  style={{ backgroundColor: strategy.bgColor }}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold capitalize" style={{ color: strategy.color }}>
                      {strategy.emoji} {range.strategy} (±{range.sigmaMultiple}σ)
                    </span>
                    <span className="text-[#747580]">{range.widthPercent.toFixed(1)}% width</span>
                  </div>
                  <div className="font-mono text-[11px] text-white">
                    ${range.priceMin.toFixed(4)} - ${range.priceMax.toFixed(4)}
                  </div>
                  <div className="text-[9px] text-[#747580] mt-1">
                    {range.estimatedTimeInRange}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Confidence footer */}
      <div className="mt-3 pt-3 border-t border-[#232328] flex items-center justify-between text-[10px]">
        <span className="text-[#747580]">
          {data.dataPoints} data points
        </span>
        <span style={{ color: confidence.color }}>
          {confidence.emoji} {confidence.label} Confidence
        </span>
      </div>

      {/* Low confidence warning */}
      {data.confidence === 'low' && (
        <div className="mt-2 flex items-center gap-1.5 text-[10px] text-[#fbbf24] bg-[#fbbf24]/10 p-2 rounded">
          <AlertTriangle size={12} />
          <span>Ranges based on estimated volatility due to limited data</span>
        </div>
      )}
    </motion.div>
  );
};
