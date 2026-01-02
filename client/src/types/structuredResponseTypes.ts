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
  | 'error';      // Error state

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

// Union of all structured items
export type StructuredItem = 
  | PoolItem 
  | BalanceItem 
  | TransactionItem 
  | PositionItem 
  | VolatilityItem;

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
