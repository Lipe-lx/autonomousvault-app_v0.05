// Structured Response Types for Rich Chat UI
// These types enable rendering data as interactive cards instead of plain text

// Protocol identifiers for styling/branding
export type ProtocolId = 'meteora' | 'raydium' | 'hyperliquid' | 'solana' | 'polymarket';

// Network identifiers
export type NetworkId = 'solana' | 'hyperliquid' | 'polygon';

// Card types for visual differentiation
export type CardType = 
  | 'pool'        // Liquidity pool cards
  | 'pools'       // Multiple pools grid
  | 'balance'     // Balance display
  | 'balances'    // Multiple balances
  | 'transaction' // Tx results
  | 'position'    // LP or HL positions
  | 'positions'   // Multiple positions
  | 'analysis'    // Market analysis
  | 'volatility'  // Volatility data
  | 'list'        // Generic list of items
  | 'error'       // Error state
  | 'hl-thinking' // Hyperliquid Dealer AI thinking
  | 'market-price' // Market price from exchanges
  | 'ohlcv'        // OHLCV candlestick data
  | 'indicator'    // Technical indicator
  | 'trading-summary' // TradingView summary
  | 'scheduler'   // Scheduled task
  | 'dealer-history'; // Dealer trade history

// Action that can be performed from a card
export interface CardAction {
  label: string;
  icon?: 'external' | 'copy' | 'trade' | 'navigate' | 'info';
  url?: string;
  actionType: 'external' | 'copy' | 'navigate' | 'callback';
  target?: string; // For navigation or copy
}

// Base item interface
export interface BaseItem {
  type: CardType;
}

// Pool item for liquidity pool cards
export interface PoolItem extends BaseItem {
  type: 'pool';
  protocol: ProtocolId;
  name: string;
  tokenA: TokenInfo;
  tokenB: TokenInfo;
  volume24h?: number;
  tvl?: number;
  apy?: number;
  feeBps?: number;
  poolAddress: string;
  poolUrl?: string;
  currentPrice?: number;
}

// Token information
export interface TokenInfo {
  symbol: string;
  mint?: string;
  logoUrl?: string;
  decimals?: number;
}

// Balance item for balance cards
export interface BalanceItem extends BaseItem {
  type: 'balance';
  network: NetworkId;
  token: TokenInfo;
  amount: number;
  valueUsd?: number;
}

// Transaction result item
export interface TransactionItem extends BaseItem {
  type: 'transaction';
  network: NetworkId;
  status: 'success' | 'pending' | 'failed';
  title: string;
  description?: string;
  txHash?: string;
  explorerUrl?: string;
  details?: {
    from?: string;
    to?: string;
    amount?: number;
    token?: string;
    fee?: number;
  };
}

// Position item (LP or trading)
export interface PositionItem extends BaseItem {
  type: 'position';
  protocol: ProtocolId;
  poolName?: string;
  poolAddress?: string;
  valueUsd: number;
  unclaimedFeesUsd?: number;
  tokenA?: { symbol: string; amount: number };
  tokenB?: { symbol: string; amount: number };
  priceRange?: {
    min: number;
    max: number;
    current?: number;
    inRange: boolean;
  };
  pnl?: {
    value: number;
    percent: number;
  };
  // Hyperliquid trading position fields
  coin?: string;
  direction?: 'long' | 'short';
  size?: number;
  entryPrice?: number;
  currentPrice?: number;
  leverage?: number;
  marginUsed?: number;
  liquidationPrice?: number;
}

// Volatility analysis item
export interface VolatilityItem extends BaseItem {
  type: 'volatility';
  poolName?: string;
  poolAddress: string;
  protocol: ProtocolId;
  currentPrice: number;
  volatilityDaily: number;
  volatilityAnnualized: number;
  priceChange24h?: number;
  priceChange7d?: number;
  tvl?: number;
  apy?: number;
  volume24h?: number;
  volumeChange24h?: number;  // % change in volume (positive = up, negative = down)
  confidence: 'high' | 'medium' | 'low';
  dataPoints: number;
}

// Range suggestion item
export interface RangeSuggestion {
  strategy: 'conservative' | 'moderate' | 'aggressive';
  priceMin: number;
  priceMax: number;
  widthPercent: number;
  sigmaMultiple: number;
  estimatedTimeInRange: string;
}

// Hyperliquid Dealer AI Thinking item
export interface HLThinkingItem extends BaseItem {
  type: 'hl-thinking';
  cycleTimestamp: number;
  cycleNumber?: number;
  aiSummary?: string;
  decisions: {
    asset: string;
    action: 'BUY' | 'SELL' | 'HOLD' | 'CLOSE';
    confidence: number;
  }[];
  assetsAnalyzed: string[];
}

// Market Price item (from Hyperliquid, Binance, etc.)
export interface MarketPriceItem extends BaseItem {
  type: 'market-price';
  symbol: string;
  price: number;
  exchange: string; // 'hyperliquid' | 'binance' | etc
  change24h?: number;
  change24hPercent?: number;
  bid?: number;  // Best bid price (for orderbook data)
  ask?: number;  // Best ask price (for orderbook data)
}

// OHLCV candle data item
export interface OHLCVItem extends BaseItem {
  type: 'ohlcv';
  symbol: string;
  timeframe: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  timestamp?: number;
}

// Technical indicator item
export interface IndicatorItem extends BaseItem {
  type: 'indicator';
  symbol: string;
  indicator: string; // RSI, MACD, EMA, etc.
  timeframe: string;
  value: number | Record<string, number>;
}

// TradingView summary item
export interface TradingViewSummaryItem extends BaseItem {
  type: 'trading-summary';
  symbol: string;
  recommendation: string; // BUY, SELL, NEUTRAL, STRONG_BUY, STRONG_SELL
  buy: number;
  sell: number;
  neutral: number;
}

// Scheduled task item
export interface SchedulerItem extends BaseItem {
  type: 'scheduler';
  taskType: string; // SWAP, TRANSFER, ALERT, HL_ORDER
  taskId: string;
  executeAt?: number;
  condition?: {
    symbol: string;
    indicator: string;
    operator: string;
    value: number;
    timeframe: string;
  };
  status: 'active' | 'pending' | 'executed';
}

// Union of all structured items
export type StructuredItem = 
  | PoolItem 
  | BalanceItem 
  | TransactionItem 
  | PositionItem 
  | VolatilityItem
  | HLThinkingItem
  | MarketPriceItem
  | OHLCVItem
  | IndicatorItem
  | TradingViewSummaryItem
  | SchedulerItem
  | DealerHistoryItem;

export interface DealerHistoryOperation {
  id: string;
  coin: string;
  action: 'BUY' | 'SELL' | 'CLOSE';
  timestamp: number;
  price: number;
  size: number;
  pnl?: number;
  confidence: number;
  reasoning?: string;
}

export interface DealerHistoryLog {
  timestamp: number;
  message: string;
  type: string;
}

export interface DealerHistoryItem extends BaseItem {
  type: 'dealer-history';
  operations: DealerHistoryOperation[];
  recentLogs: DealerHistoryLog[];
  totalOperations: number;
}

// Main structured result container
export interface StructuredResult {
  resultType: CardType;
  items: StructuredItem[];
  summary?: string;
  title?: string;
  actions?: CardAction[];
  // For volatility range suggestions
  rangeSuggestions?: RangeSuggestion[];
}

// Protocol display info for badges and styling
export const PROTOCOL_INFO: Record<ProtocolId, { 
  label: string; 
  shortLabel: string;
  color: string; 
  bgColor: string;
  borderColor: string;
}> = {
  meteora: {
    label: 'Meteora',
    shortLabel: 'MET',
    color: '#8B5CF6',
    bgColor: 'rgba(139, 92, 246, 0.15)',
    borderColor: 'rgba(139, 92, 246, 0.3)'
  },
  raydium: {
    label: 'Raydium',
    shortLabel: 'RAY',
    color: '#14B8A6',
    bgColor: 'rgba(20, 184, 166, 0.15)',
    borderColor: 'rgba(20, 184, 166, 0.3)'
  },
  hyperliquid: {
    label: 'Hyperliquid',
    shortLabel: 'HL',
    color: '#E7FE55',
    bgColor: 'rgba(231, 254, 85, 0.15)',
    borderColor: 'rgba(231, 254, 85, 0.3)'
  },
  solana: {
    label: 'Solana',
    shortLabel: 'SOL',
    color: '#9945FF',
    bgColor: 'rgba(153, 69, 255, 0.15)',
    borderColor: 'rgba(153, 69, 255, 0.3)'
  },
  polymarket: {
    label: 'Polymarket',
    shortLabel: 'PM',
    color: '#2563EB',
    bgColor: 'rgba(37, 99, 235, 0.15)',
    borderColor: 'rgba(37, 99, 235, 0.3)'
  }
};

// Exchange display info for market price badges
export type ExchangeId = 'hyperliquid' | 'binance' | 'tradingview' | 'unknown';

export const EXCHANGE_INFO: Record<ExchangeId, {
  label: string;
  shortLabel: string;
  color: string;
  bgColor: string;
  borderColor: string;
}> = {
  hyperliquid: {
    label: 'Hyperliquid',
    shortLabel: 'HL',
    color: '#E7FE55',
    bgColor: 'rgba(231, 254, 85, 0.15)',
    borderColor: 'rgba(231, 254, 85, 0.3)'
  },
  binance: {
    label: 'Binance',
    shortLabel: 'BIN',
    color: '#F0B90B',
    bgColor: 'rgba(240, 185, 11, 0.15)',
    borderColor: 'rgba(240, 185, 11, 0.3)'
  },
  tradingview: {
    label: 'TradingView',
    shortLabel: 'TV',
    color: '#2962FF',
    bgColor: 'rgba(41, 98, 255, 0.15)',
    borderColor: 'rgba(41, 98, 255, 0.3)'
  },
  unknown: {
    label: 'Exchange',
    shortLabel: 'EX',
    color: '#747580',
    bgColor: 'rgba(116, 117, 128, 0.15)',
    borderColor: 'rgba(116, 117, 128, 0.3)'
  }
};

// Helper to get pool URL based on protocol
export function getPoolUrl(protocol: ProtocolId, poolAddress: string): string {
  switch (protocol) {
    case 'meteora':
      return `https://app.meteora.ag/pools/${poolAddress}`;
    case 'raydium':
      return `https://raydium.io/liquidity-v2/?mode=add&pool_id=${poolAddress}`;
    default:
      return '';
  }
}

// Helper to get explorer URL for transactions
export function getExplorerUrl(network: NetworkId, txHash: string): string {
  switch (network) {
    case 'solana':
      return `https://solscan.io/tx/${txHash}`;
    case 'hyperliquid':
      return `https://app.hyperliquid.xyz/explorer/tx/${txHash}`;
    case 'polygon':
      return `https://polygonscan.com/tx/${txHash}`;
    default:
      return '';
  }
}
