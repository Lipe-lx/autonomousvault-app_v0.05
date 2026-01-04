import React from 'react';
import { 
  StructuredResult, 
  PoolItem, 
  BalanceItem, 
  TransactionItem, 
  VolatilityItem,
  PositionItem,
  HLThinkingItem,
  MarketPriceItem,
  OHLCVItem,
  IndicatorItem,
  TradingViewSummaryItem,
  SchedulerItem,
  DealerHistoryItem
} from '../../types/structuredResponseTypes';
import { PoolCard } from './PoolCard';
import { BalanceCard, BalanceGrid } from './BalanceCard';
import { TransactionCard } from './TransactionCard';
import { VolatilityCard } from './VolatilityCard';
import { PositionCard } from './PositionCard';
import { HLThinkingCard } from './HLThinkingCard';
import { CardGrid } from './CardGrid';
import { MarketPriceCard } from './MarketPriceCard';
import { OHLCVCard } from './OHLCVCard';
import { IndicatorCard } from './IndicatorCard';
import { TradingSummaryCard } from './TradingSummaryCard';
import { SchedulerCard } from './SchedulerCard';
import { DealerHistoryCard } from './DealerHistoryCard';

interface StructuredResultRendererProps {
  data: StructuredResult;
  onSendMessage?: (message: string) => void;
}

/**
 * Main renderer component that switches between different card types
 * based on the structured result type
 */
export const StructuredResultRenderer: React.FC<StructuredResultRendererProps> = ({ data, onSendMessage }) => {
  // Summary header if provided
  const renderSummary = () => {
    if (!data.summary && !data.title) return null;
    
    return (
      <div className="mb-3">
        {data.title && (
          <h4 className="text-sm font-semibold text-white mb-1">{data.title}</h4>
        )}
        {data.summary && (
          <p className="text-xs text-[#a0a0a8]">{data.summary}</p>
        )}
      </div>
    );
  };

  // Render based on result type
  switch (data.resultType) {
    case 'pool':
    case 'pools': {
      const pools = data.items.filter((item): item is PoolItem => item.type === 'pool');
      if (pools.length === 0) return null;
      
      // Single pool gets full width, multiple get grid
      if (pools.length === 1) {
        return (
          <div>
            {renderSummary()}
            <PoolCard data={pools[0]} />
          </div>
        );
      }
      
      return (
        <div>
          {renderSummary()}
          <CardGrid columns={2}>
            {pools.map((pool, idx) => (
              <PoolCard 
                key={pool.poolAddress || idx} 
                data={pool} 
                index={idx}
                compact={pools.length > 4}
              />
            ))}
          </CardGrid>
        </div>
      );
    }

    case 'balance':
    case 'balances': {
      const balances = data.items.filter((item): item is BalanceItem => item.type === 'balance');
      if (balances.length === 0) return null;
      
      if (balances.length === 1) {
        return (
          <div>
            {renderSummary()}
            <BalanceCard data={balances[0]} />
          </div>
        );
      }
      
      return (
        <div>
          {renderSummary()}
          <BalanceGrid balances={balances} />
        </div>
      );
    }

    case 'transaction': {
      const transactions = data.items.filter((item): item is TransactionItem => item.type === 'transaction');
      if (transactions.length === 0) return null;
      
      return (
        <div>
          {renderSummary()}
          <div className="space-y-3">
            {transactions.map((tx, idx) => (
              <TransactionCard key={tx.txHash || idx} data={tx} index={idx} />
            ))}
          </div>
        </div>
      );
    }

    case 'volatility': {
      const volatilityItems = data.items.filter((item): item is VolatilityItem => item.type === 'volatility');
      if (volatilityItems.length === 0) return null;
      
      // If multiple pools, use a table-like view
      if (volatilityItems.length > 1) {
        return (
          <div>
            {renderSummary()}
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-[#747580] border-b border-[#232328]">
                    <th className="pb-2 pr-2">Pool</th>
                    <th className="pb-2 px-2">Protocol</th>
                    <th className="pb-2 px-2">TVL</th>
                    <th className="pb-2 px-2">Daily Vol</th>
                    <th className="pb-2 px-2">Ann. Vol</th>
                    <th className="pb-2 pl-2">Price</th>
                  </tr>
                </thead>
                <tbody>
                  {volatilityItems.map((item, idx) => (
                    <tr key={item.poolAddress} className="border-b border-[#232328]/50">
                      <td className="py-2 pr-2 text-white font-medium">
                        {item.poolName?.slice(0, 15) || item.poolAddress.slice(0, 8) + '...'}
                      </td>
                      <td className="py-2 px-2">
                        <span 
                          className="text-[9px] px-1.5 py-0.5 rounded font-bold uppercase"
                          style={{
                            color: item.protocol === 'meteora' ? '#8B5CF6' : '#14B8A6',
                            backgroundColor: item.protocol === 'meteora' ? 'rgba(139, 92, 246, 0.15)' : 'rgba(20, 184, 166, 0.15)'
                          }}
                        >
                          {item.protocol === 'meteora' ? 'MET' : 'RAY'}
                        </span>
                      </td>
                      <td className="py-2 px-2 text-white">
                        {item.tvl ? `$${(item.tvl / 1000).toFixed(1)}K` : 'N/A'}
                      </td>
                      <td className="py-2 px-2 text-[#60a5fa]">
                        {item.volatilityDaily.toFixed(2)}%
                      </td>
                      <td className="py-2 px-2 text-[#8b5cf6]">
                        {item.volatilityAnnualized.toFixed(1)}%
                      </td>
                      <td className="py-2 pl-2 text-white font-mono">
                        ${item.currentPrice.toFixed(4)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      }
      
      // Single volatility item with potential range suggestions
      return (
        <div>
          {renderSummary()}
          <VolatilityCard 
            data={volatilityItems[0]} 
            rangeSuggestions={data.rangeSuggestions}
            onSendMessage={onSendMessage}
          />
        </div>
      );
    }

    case 'position':
    case 'positions': {
      // Get all balances and positions
      const balances = data.items.filter((item): item is BalanceItem => item.type === 'balance');
      const positions = data.items.filter((item): item is PositionItem => item.type === 'position');
      
      // For Hyperliquid trading positions, use dedicated PositionCard
      const hlPositions = positions.filter(p => p.protocol === 'hyperliquid' && p.coin);
      
      if (hlPositions.length > 0) {
        return (
          <div>
            {renderSummary()}
            {/* Show balance if present */}
            {balances.length > 0 && (
              <div className="mb-3">
                <BalanceCard data={balances[0]} />
              </div>
            )}
            {/* Show HL positions */}
            <div className="space-y-3">
              {hlPositions.map((pos, idx) => (
                <PositionCard key={`${pos.coin}-${idx}`} data={pos} index={idx} />
              ))}
            </div>
          </div>
        );
      }
      
      // Fallback: LP positions in simple list format
      return (
        <div>
          {renderSummary()}
          <div className="space-y-2">
            {positions.map((pos, idx) => (
              <div 
                key={pos.poolAddress || idx}
                className="bg-[#1a1b21] border border-[#232328] rounded-lg p-3 text-xs"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-white">{pos.poolName || 'Position'}</span>
                  <span className="text-[#34d399] font-bold">${pos.valueUsd.toLocaleString()}</span>
                </div>
                {pos.tokenA && pos.tokenB && (
                  <div className="text-[#747580]">
                    {pos.tokenA.amount.toFixed(4)} {pos.tokenA.symbol} / {pos.tokenB.amount.toFixed(4)} {pos.tokenB.symbol}
                  </div>
                )}
                {pos.unclaimedFeesUsd !== undefined && pos.unclaimedFeesUsd > 0 && (
                  <div className="text-[#E7FE55] mt-1">
                    Unclaimed: ${pos.unclaimedFeesUsd.toFixed(2)}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      );
    }

    case 'hl-thinking': {
      const thinkingItems = data.items.filter(
        (item): item is HLThinkingItem => item.type === 'hl-thinking'
      );
      if (thinkingItems.length === 0) return null;
      
      return (
        <div>
          {renderSummary()}
          <div className="space-y-3">
            {thinkingItems.map((item, idx) => (
              <HLThinkingCard key={item.cycleTimestamp || idx} data={item} index={idx} />
            ))}
          </div>
        </div>
      );
    }

    case 'market-price': {
      const priceItems = data.items.filter(
        (item): item is MarketPriceItem => item.type === 'market-price'
      );
      if (priceItems.length === 0) return null;
      
      return (
        <div>
          {renderSummary()}
          <div className="space-y-3">
            {priceItems.map((item, idx) => (
              <MarketPriceCard key={`${item.symbol}-${item.exchange}-${idx}`} data={item} index={idx} />
            ))}
          </div>
        </div>
      );
    }

    case 'ohlcv': {
      const ohlcvItems = data.items.filter(
        (item): item is OHLCVItem => item.type === 'ohlcv'
      );
      if (ohlcvItems.length === 0) return null;
      
      return (
        <div>
          {renderSummary()}
          <div className="space-y-3">
            {ohlcvItems.map((item, idx) => (
              <OHLCVCard key={`${item.symbol}-${item.timeframe}-${idx}`} data={item} index={idx} />
            ))}
          </div>
        </div>
      );
    }

    case 'indicator': {
      const indicatorItems = data.items.filter(
        (item): item is IndicatorItem => item.type === 'indicator'
      );
      if (indicatorItems.length === 0) return null;
      
      return (
        <div>
          {renderSummary()}
          <div className="space-y-3">
            {indicatorItems.map((item, idx) => (
              <IndicatorCard key={`${item.symbol}-${item.indicator}-${idx}`} data={item} index={idx} />
            ))}
          </div>
        </div>
      );
    }

    case 'trading-summary': {
      const summaryItems = data.items.filter(
        (item): item is TradingViewSummaryItem => item.type === 'trading-summary'
      );
      if (summaryItems.length === 0) return null;
      
      return (
        <div>
          {renderSummary()}
          <div className="space-y-3">
            {summaryItems.map((item, idx) => (
              <TradingSummaryCard key={`${item.symbol}-${idx}`} data={item} index={idx} />
            ))}
          </div>
        </div>
      );
    }

    case 'scheduler': {
      const schedulerItems = data.items.filter(
        (item): item is SchedulerItem => item.type === 'scheduler'
      );
      if (schedulerItems.length === 0) return null;
      
      return (
        <div>
          {renderSummary()}
          <div className="space-y-3">
            {schedulerItems.map((item, idx) => (
              <SchedulerCard key={item.taskId || idx} data={item} index={idx} />
            ))}
          </div>
        </div>
      );
    }

    case 'dealer-history': {
      const historyItems = data.items.filter(
        (item): item is DealerHistoryItem => item.type === 'dealer-history'
      );
      if (historyItems.length === 0) return null;

      return (
        <div>
           {renderSummary()}
           <DealerHistoryCard data={historyItems[0]} className="animate-in fade-in slide-in-from-bottom-4 duration-500" />
        </div>
      );
    }

    default:
      // For unknown types, return null - will fall back to text rendering
      return null;
  }
};
