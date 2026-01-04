import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  History, 
  TrendingUp, 
  TrendingDown, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  ChevronDown, 
  ChevronUp,
  BrainCircuit,
  Activity
} from 'lucide-react';
import { DealerHistoryItem, DealerHistoryOperation } from '../../types/structuredResponseTypes';
import { cn } from '@/lib/utils';

interface DealerHistoryCardProps {
  data: DealerHistoryItem;
  className?: string;
}

export const DealerHistoryCard: React.FC<DealerHistoryCardProps> = ({
  data,
  className
}) => {
  const hasOperations = data.operations && data.operations.length > 0;
  
  return (
    <div className={cn(
      'bg-[#1a1b21] border border-[#232328] rounded-xl overflow-hidden w-full max-w-md shadow-lg',
      className
    )}>
      {/* Header */}
      <div className="bg-[#232328]/50 px-4 py-3 border-b border-[#232328] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-md bg-[#E7FE55]/10 text-[#E7FE55]">
            <History size={16} />
          </div>
          <span className="font-semibold text-white text-sm">Dealer History</span>
        </div>
        <div className="text-xs text-[#747580] bg-[#2a2b36] px-2 py-0.5 rounded-full border border-[#343541]">
          {data.totalOperations} Ops
        </div>
      </div>

      <div className="p-0">
        {hasOperations ? (
          <div className="divide-y divide-[#232328]">
            {data.operations.map((op, idx) => (
              <OperationItem key={op.id || idx} operation={op} index={idx} />
            ))}
          </div>
        ) : (
          <div className="p-4 space-y-4">
            <div className="text-center py-4 bg-[#232328]/30 rounded-lg border border-[#232328] border-dashed">
              <Activity className="mx-auto text-[#747580] mb-2 opacity-50" size={24} />
              <div className="text-[#e4e5e9] text-sm font-medium">No Trades Executed</div>
              <div className="text-[#747580] text-xs mt-1 px-4">
                The dealer hasn't executed any trades matching your criteria yet.
              </div>
            </div>
            
            {/* Show recent logs if available */}
            {data.recentLogs && data.recentLogs.length > 0 && (
              <div className="space-y-2 mt-4">
                <div className="text-[10px] uppercase tracking-wider text-[#747580] font-semibold pl-1">
                  Recent Activity
                </div>
                {data.recentLogs.map((log, idx) => (
                  <motion.div 
                    key={idx}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className="flex gap-3 text-xs p-2 rounded hover:bg-[#232328]/50 transition-colors"
                  >
                    <div className="mt-0.5 min-w-[14px]">
                      {log.type === 'ERROR' ? <AlertCircle size={14} className="text-red-400" /> :
                       log.type === 'WARNING' ? <AlertCircle size={14} className="text-orange-400" /> :
                       <CheckCircle2 size={14} className="text-[#747580]" />}
                    </div>
                    <div>
                      <div className="text-[#e4e5e9]">{log.message}</div>
                      <div className="text-[#565866] text-[10px] mt-0.5 flex items-center gap-1">
                        <Clock size={8} />
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* Footer */}
      {hasOperations && (
        <div className="bg-[#1e1f26] px-4 py-2 text-[10px] text-[#747580] border-t border-[#232328] flex justify-between">
          <span>Last updated: {new Date().toLocaleTimeString()}</span>
          <span>Showing {data.operations.length} most recent</span>
        </div>
      )}
    </div>
  );
};

const OperationItem: React.FC<{ operation: DealerHistoryOperation; index: number }> = ({ operation, index }) => {
  const [expanded, setExpanded] = useState(false);
  const isProfit = (operation.pnl || 0) >= 0;
  const isBuy = operation.action === 'BUY';
  const isClose = operation.action === 'CLOSE';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="group"
    >
      <div 
        className="p-3 hover:bg-[#232328]/40 transition-colors cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-2">
            <span className={cn(
              "text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wider",
              isClose 
                ? "bg-slate-500/10 text-slate-400 border-slate-500/20" 
                : isBuy
                  ? "bg-[#34d399]/10 text-[#34d399] border-[#34d399]/20"
                  : "bg-red-400/10 text-red-400 border-red-400/20"
            )}>
              {operation.action}
            </span>
            <span className="font-bold text-white text-sm">{operation.coin}</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-[#747580]">
            <Clock size={10} />
            <span>{new Date(operation.timestamp).toLocaleDateString()} {new Date(operation.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex gap-4 text-xs">
            <div>
              <span className="text-[#747580] mr-1">Price:</span>
              <span className="text-[#e4e5e9] font-mono">${operation.price?.toFixed(4) || '0.00'}</span>
            </div>
            <div>
              <span className="text-[#747580] mr-1">Size:</span>
              <span className="text-[#e4e5e9] font-mono">{operation.size}</span>
            </div>
          </div>
          
          {operation.pnl !== undefined && (
            <div className={cn(
              "font-mono font-medium text-xs flex items-center gap-1",
              isProfit ? "text-[#34d399]" : "text-red-400"
            )}>
              {isProfit ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
              {isProfit ? '+' : ''}${operation.pnl.toFixed(2)}
            </div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden bg-[#1e1f26]"
          >
            <div className="p-3 border-t border-[#232328] border-dashed mx-3 mb-2">
              <div className="flex items-center gap-2 mb-2">
                <BrainCircuit size={12} className="text-[#E7FE55]" />
                <span className="text-[10px] text-[#E7FE55] font-semibold uppercase tracking-wider">AI Reasoning</span>
                <span className="text-[10px] text-[#747580] bg-[#2a2b36] px-1.5 rounded border border-[#343541]">
                  Confidence: {Math.round(operation.confidence * 100)}%
                </span>
              </div>
              <p className="text-xs text-[#a1a1aa] leading-relaxed">
                {operation.reasoning || "No detailed reasoning available for this operation."}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
