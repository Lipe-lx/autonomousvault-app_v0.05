import React from 'react';
import { motion } from 'framer-motion';
import { BarChart3, TrendingUp, TrendingDown, Activity, AlertTriangle, ArrowRight } from 'lucide-react';
import { VolatilityItem, RangeSuggestion, PROTOCOL_INFO } from '../../types/structuredResponseTypes';
import { formatPercent, formatCompactNumber } from '../../utils/formatUtils';
import { ProtocolBadge } from './ProtocolBadge';
import { cn } from '@/lib/utils';

interface VolatilityCardProps {
  data: VolatilityItem;
  rangeSuggestions?: RangeSuggestion[];
  index?: number;
  className?: string;
  onSendMessage?: (message: string) => void;
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
  className,
  onSendMessage
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

      {/* Volatility & Volume Metrics - 2x2 Grid */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        {/* Row 1: Volume 24h */}
        <div className="bg-[#0f1015] rounded-lg p-4">
          <div className="text-[9px] text-[#747580] uppercase tracking-wider mb-1">Volume 24h</div>
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold text-[#f59e0b]">
              {formatCompactNumber(data.volume24h || 0)}
            </span>
            {data.volumeChange24h !== undefined && (
              <div className={cn(
                "text-xs flex items-center gap-0.5",
                data.volumeChange24h >= 0 ? "text-[#34d399]" : "text-[#ef4444]"
              )}>
                {data.volumeChange24h >= 0 ? (
                  <TrendingUp size={12} />
                ) : (
                  <TrendingDown size={12} />
                )}
                {formatPercent(Math.abs(data.volumeChange24h))}
              </div>
            )}
          </div>
        </div>
        {/* Row 1: APY */}
        <div className="bg-[#0f1015] rounded-lg p-4">
          <div className="text-[9px] text-[#747580] uppercase tracking-wider mb-1">APY</div>
          <div className={cn(
            "text-lg font-bold",
            (data.apy || 0) > 0 ? "text-[#34d399]" : "text-[#747580]"
          )}>
            {formatPercent(data.apy || 0)}
          </div>
        </div>
        {/* Row 2: Daily Volatility */}
        <div className="bg-[#0f1015] rounded-lg p-4">
          <div className="text-[9px] text-[#747580] uppercase tracking-wider mb-1">Daily Volatility</div>
          <div className="text-lg font-bold text-[#60a5fa]">
            {formatPercent(data.volatilityDaily)}
          </div>
        </div>
        {/* Row 2: Monthly Volatility */}
        <div className="bg-[#0f1015] rounded-lg p-4">
          <div className="text-[9px] text-[#747580] uppercase tracking-wider mb-1">Monthly Volatility</div>
          <div className="text-lg font-bold text-[#8b5cf6]">
            {formatPercent(data.volatilityAnnualized / Math.sqrt(12))}
          </div>
        </div>
      </div>

      {/* TVL + Price Changes - Single Line */}
      <div className="flex items-center gap-4 text-xs mb-4">
        {data.tvl !== undefined && (
          <div className="text-[#747580]">
            TVL: <span className="text-white font-medium">{formatCompactNumber(data.tvl)}</span>
          </div>
        )}
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

      {/* Range Suggestions */}
      {rangeSuggestions && rangeSuggestions.length > 0 && (
        <div className="mt-4 pt-4 border-t border-[#232328]">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-1.5 h-1.5 rounded-full bg-[#E7FE55]" />
            <span className="text-[10px] text-[#747580] uppercase tracking-wider font-medium">
              Suggested Ranges
            </span>
          </div>
          <div className="space-y-2">
            {rangeSuggestions.map((range, idx) => {
              const strategy = STRATEGY_CONFIG[range.strategy];
              return (
                <div 
                  key={idx}
                  className="group/range p-3 rounded-lg border transition-all duration-300 hover:scale-[1.01]"
                  style={{ 
                    backgroundColor: strategy.bgColor,
                    borderColor: `${strategy.color}20`
                  }}
                >
                  {/* Strategy Header */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span 
                        className="text-sm font-bold uppercase tracking-wide"
                        style={{ color: strategy.color }}
                      >
                        {strategy.emoji} {range.strategy}
                      </span>
                      <span 
                        className="text-[9px] px-1.5 py-0.5 rounded-full font-mono"
                        style={{ 
                          backgroundColor: `${strategy.color}20`,
                          color: strategy.color 
                        }}
                      >
                        ±{range.sigmaMultiple}σ
                      </span>
                    </div>
                    <span className="text-[10px] text-[#747580] font-medium">
                      {range.widthPercent.toFixed(1)}% width
                    </span>
                  </div>
                  
                  {/* Price Range */}
                  <div className="bg-[#0f1015]/60 rounded-md px-3 py-2 mb-2">
                    <div className="flex items-center justify-between">
                      <div className="text-[9px] text-[#747580] uppercase">Min</div>
                      <div className="text-[9px] text-[#747580] uppercase">Max</div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-sm text-white font-semibold">
                        ${range.priceMin.toFixed(4)}
                      </span>
                      <div className="flex-1 mx-3 h-px bg-gradient-to-r from-transparent via-[#747580]/30 to-transparent" />
                      <span className="font-mono text-sm text-white font-semibold">
                        ${range.priceMax.toFixed(4)}
                      </span>
                    </div>
                  </div>
                  
                  {/* Time in Range + Action Button */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-[10px] text-[#a0a0a8]">
                      <Activity size={10} className="text-[#747580]" />
                      <span>{range.estimatedTimeInRange}</span>
                    </div>
                    {onSendMessage && (
                      <button
                        onClick={() => {
                          const poolName = data.poolName || data.poolAddress.slice(0, 8);
                          const message = `Adicionar liquidez na pool ${poolName} com range ${range.strategy}: min $${range.priceMin.toFixed(4)}, max $${range.priceMax.toFixed(4)}`;
                          onSendMessage(message);
                        }}
                        className="flex items-center gap-1 px-2 py-1 rounded text-[9px] font-medium transition-all duration-200 hover:scale-105"
                        style={{
                          backgroundColor: `${strategy.color}20`,
                          color: strategy.color,
                          border: `1px solid ${strategy.color}40`
                        }}
                      >
                        <span>Use Range</span>
                        <ArrowRight size={10} />
                      </button>
                    )}
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
