// Formatting utilities for rich UI display

/**
 * Format large numbers in compact notation
 * Examples:
 *   1234 -> "$1.23K"
 *   1234567 -> "$1.23M"
 *   1234567890 -> "$1.23B"
 */
export function formatCompactNumber(
  value: number | undefined | null, 
  options: {
    prefix?: string;
    suffix?: string;
    decimals?: number;
    showSign?: boolean;
  } = {}
): string {
  if (value === undefined || value === null || isNaN(value)) {
    return 'N/A';
  }

  const { prefix = '$', suffix = '', decimals = 2, showSign = false } = options;
  const absValue = Math.abs(value);
  const sign = showSign && value > 0 ? '+' : (value < 0 ? '-' : '');

  let formatted: string;
  let unit = '';

  if (absValue >= 1_000_000_000) {
    formatted = (absValue / 1_000_000_000).toFixed(decimals);
    unit = 'B';
  } else if (absValue >= 1_000_000) {
    formatted = (absValue / 1_000_000).toFixed(decimals);
    unit = 'M';
  } else if (absValue >= 1_000) {
    formatted = (absValue / 1_000).toFixed(decimals);
    unit = 'K';
  } else if (absValue >= 1) {
    formatted = absValue.toFixed(decimals);
  } else if (absValue > 0) {
    // For small numbers, show more precision
    formatted = absValue.toFixed(Math.max(decimals, 4));
  } else {
    formatted = '0';
  }

  // Remove trailing zeros after decimal point
  formatted = formatted.replace(/\.?0+$/, '');
  
  // Ensure at least one decimal for consistency with unit suffixes
  if (unit && !formatted.includes('.')) {
    formatted += '.0';
  }

  return `${sign}${prefix}${formatted}${unit}${suffix}`;
}

/**
 * Format percentage values
 * Examples:
 *   0.0523 -> "5.23%"
 *   125.456 -> "125.46%" (when isRaw is true)
 */
export function formatPercent(
  value: number | undefined | null,
  options: {
    decimals?: number;
    showSign?: boolean;
    isRaw?: boolean; // true if value is already in percent form (e.g., 125.4)
  } = {}
): string {
  if (value === undefined || value === null || isNaN(value)) {
    return 'N/A';
  }

  const { decimals = 2, showSign = false, isRaw = true } = options;
  const percentValue = isRaw ? value : value * 100;
  const sign = showSign && percentValue > 0 ? '+' : '';

  return `${sign}${percentValue.toFixed(decimals)}%`;
}

/**
 * Format token amount with appropriate decimals
 */
export function formatTokenAmount(
  amount: number | undefined | null,
  options: {
    symbol?: string;
    maxDecimals?: number;
    minDecimals?: number;
  } = {}
): string {
  if (amount === undefined || amount === null || isNaN(amount)) {
    return 'N/A';
  }

  const { symbol = '', maxDecimals = 6, minDecimals = 2 } = options;
  
  let formatted: string;
  
  // Determine appropriate decimals based on value
  if (amount >= 1000) {
    formatted = amount.toLocaleString('en-US', { 
      minimumFractionDigits: 0, 
      maximumFractionDigits: 2 
    });
  } else if (amount >= 1) {
    formatted = amount.toLocaleString('en-US', { 
      minimumFractionDigits: minDecimals, 
      maximumFractionDigits: Math.min(4, maxDecimals) 
    });
  } else if (amount > 0) {
    // Small amounts need more precision
    formatted = amount.toLocaleString('en-US', { 
      minimumFractionDigits: minDecimals, 
      maximumFractionDigits: maxDecimals 
    });
  } else {
    formatted = '0';
  }

  return symbol ? `${formatted} ${symbol}` : formatted;
}

/**
 * Format USD value
 */
export function formatUSD(
  value: number | undefined | null,
  options: {
    compact?: boolean;
    showSign?: boolean;
    decimals?: number;
  } = {}
): string {
  if (value === undefined || value === null || isNaN(value)) {
    return 'N/A';
  }

  const { compact = false, showSign = false, decimals = 2 } = options;
  
  if (compact) {
    return formatCompactNumber(value, { prefix: '$', showSign, decimals });
  }

  const sign = showSign && value > 0 ? '+' : '';
  return `${sign}$${Math.abs(value).toLocaleString('en-US', { 
    minimumFractionDigits: decimals, 
    maximumFractionDigits: decimals 
  })}`;
}

/**
 * Truncate address for display
 * "0x1234567890abcdef" -> "0x1234...cdef"
 */
export function truncateAddress(
  address: string | undefined | null,
  options: {
    startChars?: number;
    endChars?: number;
  } = {}
): string {
  if (!address) return 'N/A';
  
  const { startChars = 6, endChars = 4 } = options;
  
  if (address.length <= startChars + endChars + 3) {
    return address;
  }

  return `${address.slice(0, startChars)}...${address.slice(-endChars)}`;
}

/**
 * Format date/time for display
 */
export function formatDateTime(
  timestamp: number | Date | undefined | null,
  options: {
    format?: 'time' | 'date' | 'datetime' | 'relative';
  } = {}
): string {
  if (!timestamp) return 'N/A';
  
  const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
  const { format = 'datetime' } = options;

  switch (format) {
    case 'time':
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    case 'date':
      return date.toLocaleDateString();
    case 'relative':
      return getRelativeTime(date);
    default:
      return date.toLocaleString();
  }
}

/**
 * Get relative time string (e.g., "2 hours ago")
 */
function getRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSeconds < 60) return 'just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}
