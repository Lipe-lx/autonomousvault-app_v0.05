import { Token } from './types';

export const SOLANA_RPC_DEVNET = "https://api.devnet.solana.com";

// Raydium Program ID (Devnet V4)
// Using a confirmed valid Devnet address to prevent "Invalid public key input" errors
export const RAYDIUM_PROGRAM_ID = "HWy1jotHpo6UqeQxx49dpYYdQB8wj9Qk9MdxwjLvDHB8";

export const TOKENS: Token[] = [
  {
    symbol: 'SOL',
    name: 'Solana',
    mint: 'So11111111111111111111111111111111111111112',
    decimals: 9,
    logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png'
  },
  {
    symbol: 'USDC',
    name: 'USD Coin (Devnet)',
    mint: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
    decimals: 6,
    logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png'
  },
  {
    symbol: 'RAY',
    name: 'Raydium',
    mint: '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R', // Valid RAY Mint
    decimals: 6,
    logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R/logo.png'
  }
];

export const MOCK_POOL_PRICES: Record<string, number> = {
  'SOL': 145.50,
  'USDC': 1.00,
  'RAY': 1.85
};

export const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444'];