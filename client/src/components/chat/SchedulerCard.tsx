import React from 'react';
import { motion } from 'framer-motion';
import { Clock, Calendar, Zap, ArrowRightLeft, Send, Bell, TrendingUp } from 'lucide-react';
import { SchedulerItem } from '../../types/structuredResponseTypes';
import { cn } from '@/lib/utils';

interface SchedulerCardProps {
  data: SchedulerItem;
  index?: number;
  className?: string;
}

// Get task type icon and color
const getTaskTypeInfo = (taskType: string): {
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  borderColor: string;
  label: string;
} => {
  const type = taskType.toUpperCase();
  
  switch (type) {
    case 'SWAP':
      return {
        icon: <ArrowRightLeft size={14} />,
        color: '#8b5cf6',
        bgColor: 'rgba(139, 92, 246, 0.15)',
        borderColor: 'rgba(139, 92, 246, 0.3)',
        label: 'Swap'
      };
    case 'TRANSFER':
      return {
        icon: <Send size={14} />,
        color: '#60a5fa',
        bgColor: 'rgba(96, 165, 250, 0.15)',
        borderColor: 'rgba(96, 165, 250, 0.3)',
        label: 'Transfer'
      };
    case 'HL_ORDER':
      return {
        icon: <TrendingUp size={14} />,
        color: '#E7FE55',
        bgColor: 'rgba(231, 254, 85, 0.15)',
        borderColor: 'rgba(231, 254, 85, 0.3)',
        label: 'HL Order'
      };
    case 'ALERT':
    default:
      return {
        icon: <Bell size={14} />,
        color: '#fbbf24',
        bgColor: 'rgba(251, 191, 36, 0.15)',
        borderColor: 'rgba(251, 191, 36, 0.3)',
        label: 'Alert'
      };
  }
};

// Get status info
const getStatusInfo = (status: string): { color: string; label: string } => {
  switch (status) {
    case 'active':
      return { color: '#34d399', label: 'Active' };
    case 'executed':
      return { color: '#60a5fa', label: 'Executed' };
    case 'pending':
    default:
      return { color: '#fbbf24', label: 'Pending' };
  }
};

export const SchedulerCard: React.FC<SchedulerCardProps> = ({
  data,
  index = 0,
  className
}) => {
  const taskInfo = getTaskTypeInfo(data.taskType);
  const statusInfo = getStatusInfo(data.status);
  const isConditionBased = !!data.condition;

  // Format execution time
  const formatExecutionTime = (timestamp: number): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = timestamp - now.getTime();
    
    if (diffMs <= 0) return 'Now';
    
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    
    if (diffHours >= 24) {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    }
    if (diffHours >= 1) {
      return `in ${diffHours}h ${diffMins % 60}m`;
    }
    if (diffMins >= 1) {
      return `in ${diffMins}m`;
    }
    return `in ${diffSecs}s`;
  };

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
      {/* Header: Task type badge + Status */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {/* Task Type Badge */}
          <span 
            className="flex items-center gap-1 text-[9px] px-2 py-0.5 rounded font-bold uppercase tracking-wide"
            style={{
              color: taskInfo.color,
              backgroundColor: taskInfo.bgColor,
              border: `1px solid ${taskInfo.borderColor}`
            }}
          >
            {taskInfo.icon}
            {taskInfo.label}
          </span>
          <span className="text-sm font-medium text-white">
            Task Scheduled
          </span>
        </div>
        
        {/* Status indicator */}
        <div className="flex items-center gap-1">
          <div 
            className="w-2 h-2 rounded-full animate-pulse"
            style={{ backgroundColor: statusInfo.color }}
          />
          <span className="text-[10px]" style={{ color: statusInfo.color }}>
            {statusInfo.label}
          </span>
        </div>
      </div>

      {/* Execution Info */}
      <div className="bg-[#0f1015] rounded p-3">
        {isConditionBased ? (
          // Condition-based execution
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-[10px] text-[#747580]">
              <Zap size={12} className="text-[#E7FE55]" />
              <span>Executes when condition is met</span>
            </div>
            <div className="text-xs text-white">
              <span className="text-[#60a5fa]">{data.condition!.indicator.toUpperCase()}</span>
              {' of '}
              <span className="text-[#E7FE55] font-bold">{data.condition!.symbol}</span>
              {' '}
              <span className="text-[#747580]">({data.condition!.timeframe})</span>
              {' '}
              <span className="text-white">{data.condition!.operator}</span>
              {' '}
              <span className="text-[#34d399] font-bold">{data.condition!.value}</span>
            </div>
          </div>
        ) : data.executeAt ? (
          // Time-based execution
          <div className="flex items-center gap-2">
            <div 
              className="w-8 h-8 rounded-full flex items-center justify-center"
              style={{ backgroundColor: 'rgba(96, 165, 250, 0.15)' }}
            >
              <Clock size={16} className="text-[#60a5fa]" />
            </div>
            <div>
              <div className="text-[10px] text-[#747580] uppercase tracking-wider">Executes</div>
              <div className="text-sm font-medium text-white">
                {formatExecutionTime(data.executeAt)}
              </div>
            </div>
          </div>
        ) : (
          <div className="text-[10px] text-[#747580]">
            No execution time set
          </div>
        )}
      </div>

      {/* Task ID */}
      <div className="mt-2 text-[10px] text-[#747580]">
        ID: <span className="font-mono">{data.taskId}</span>
      </div>
    </motion.div>
  );
};
