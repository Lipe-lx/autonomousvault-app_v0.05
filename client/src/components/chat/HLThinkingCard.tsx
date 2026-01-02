import React from 'react';
import { HLThinkingItem, PROTOCOL_INFO } from '../../types/structuredResponseTypes';
import { Brain, TrendingUp, TrendingDown, Minus, Clock, BarChart3 } from 'lucide-react';

interface HLThinkingCardProps {
  data: HLThinkingItem;
  index?: number;
}

/**
 * Card component for displaying Hyperliquid Dealer AI thinking/reasoning
 * Shows cycle analysis, decisions with confidence levels, and AI summary
 */
export const HLThinkingCard: React.FC<HLThinkingCardProps> = ({ data, index = 0 }) => {
  const protocolInfo = PROTOCOL_INFO.hyperliquid;
  
  const getActionIcon = (action: string) => {
    switch (action) {
      case 'BUY': return <TrendingUp className="w-3.5 h-3.5 text-[#34d399]" />;
      case 'SELL': return <TrendingDown className="w-3.5 h-3.5 text-[#f87171]" />;
      case 'CLOSE': return <Minus className="w-3.5 h-3.5 text-[#fbbf24]" />;
      default: return <Minus className="w-3.5 h-3.5 text-[#747580]" />;
    }
  };
  
  const getActionColor = (action: string) => {
    switch (action) {
      case 'BUY': return { text: 'text-[#34d399]', bg: 'bg-[#34d399]/10' };
      case 'SELL': return { text: 'text-[#f87171]', bg: 'bg-[#f87171]/10' };
      case 'CLOSE': return { text: 'text-[#fbbf24]', bg: 'bg-[#fbbf24]/10' };
      default: return { text: 'text-[#747580]', bg: 'bg-[#747580]/10' };
    }
  };
  
  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.7) return '#34d399';
    if (confidence >= 0.4) return '#fbbf24';
    return '#f87171';
  };

  return (
    <div 
      className="bg-[#1a1b21] border rounded-lg overflow-hidden"
      style={{ borderColor: protocolInfo.borderColor }}
    >
      {/* Header */}
      <div 
        className="flex items-center justify-between px-4 py-3 border-b"
        style={{ 
          backgroundColor: protocolInfo.bgColor,
          borderColor: protocolInfo.borderColor 
        }}
      >
        <div className="flex items-center gap-2">
          <Brain className="w-4 h-4" style={{ color: protocolInfo.color }} />
          <span className="font-semibold text-white text-sm">Hyperliquid Dealer Thinking</span>
          {data.cycleNumber && (
            <span className="text-[#747580] text-xs">Cycle #{data.cycleNumber}</span>
          )}
        </div>
        <span 
          className="text-[9px] px-1.5 py-0.5 rounded font-bold uppercase"
          style={{ color: protocolInfo.color, backgroundColor: 'rgba(231,254,85,0.2)' }}
        >
          {protocolInfo.shortLabel}
        </span>
      </div>
      
      <div className="p-4 space-y-4">
        {/* AI Summary */}
        {data.aiSummary && (
          <div 
            className="bg-[#0d0e12] rounded-lg p-3 border-l-2"
            style={{ borderColor: protocolInfo.color }}
          >
            <div className="flex items-center gap-1.5 mb-2">
              <BarChart3 className="w-3 h-3" style={{ color: protocolInfo.color }} />
              <span className="text-[10px] uppercase tracking-wider font-medium" style={{ color: protocolInfo.color }}>
                AI Analysis
              </span>
            </div>
            <p className="text-[#a0a0a8] text-xs leading-relaxed">{data.aiSummary}</p>
          </div>
        )}
        
        {/* Decisions */}
        {data.decisions.length > 0 && (
          <div>
            <div className="text-[#747580] text-[10px] uppercase tracking-wider mb-2 font-medium">
              Decisions ({data.decisions.length})
            </div>
            <div className="space-y-1.5">
              {data.decisions.map((decision, idx) => {
                const actionStyle = getActionColor(decision.action);
                return (
                  <div 
                    key={`${decision.asset}-${idx}`}
                    className="flex items-center justify-between bg-[#0d0e12] rounded-lg px-3 py-2.5"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className={`p-1 rounded ${actionStyle.bg}`}>
                        {getActionIcon(decision.action)}
                      </div>
                      <span className="font-medium text-white text-xs">{decision.asset}</span>
                      <span className={`text-xs font-bold ${actionStyle.text}`}>
                        {decision.action}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[#747580] text-[10px]">Confidence</span>
                      <div 
                        className="text-xs font-bold px-1.5 py-0.5 rounded"
                        style={{ 
                          color: getConfidenceColor(decision.confidence),
                          backgroundColor: `${getConfidenceColor(decision.confidence)}15`
                        }}
                      >
                        {(decision.confidence * 100).toFixed(0)}%
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        
        {/* No decisions message */}
        {data.decisions.length === 0 && !data.aiSummary && (
          <div className="text-center py-4 text-[#747580] text-xs">
            No decisions recorded for this cycle
          </div>
        )}
      </div>
      
      {/* Footer */}
      <div 
        className="flex items-center justify-between px-4 py-2.5 border-t text-[10px]"
        style={{ borderColor: protocolInfo.borderColor }}
      >
        <div className="flex items-center gap-1.5 text-[#747580]">
          <Clock className="w-3 h-3" />
          <span>{new Date(data.cycleTimestamp).toLocaleString()}</span>
        </div>
        {data.assetsAnalyzed.length > 0 && (
          <span className="text-[#747580]">
            {data.assetsAnalyzed.length} assets: {data.assetsAnalyzed.slice(0, 3).join(', ')}
            {data.assetsAnalyzed.length > 3 && ` +${data.assetsAnalyzed.length - 3}`}
          </span>
        )}
      </div>
    </div>
  );
};
