import React from 'react';
import { ProtocolId, PROTOCOL_INFO } from '../../types/structuredResponseTypes';
import { cn } from '@/lib/utils';

interface ProtocolBadgeProps {
  protocol: ProtocolId;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
}

export const ProtocolBadge: React.FC<ProtocolBadgeProps> = ({
  protocol,
  size = 'sm',
  showLabel = false,
  className
}) => {
  const info = PROTOCOL_INFO[protocol];
  
  if (!info) return null;

  const sizeClasses = {
    sm: 'text-[9px] px-1.5 py-0.5',
    md: 'text-[10px] px-2 py-1',
    lg: 'text-xs px-2.5 py-1'
  };

  return (
    <span
      className={cn(
        'inline-flex items-center font-bold uppercase tracking-wider rounded',
        sizeClasses[size],
        className
      )}
      style={{
        color: info.color,
        backgroundColor: info.bgColor,
        border: `1px solid ${info.borderColor}`
      }}
    >
      {showLabel ? info.label : info.shortLabel}
    </span>
  );
};
