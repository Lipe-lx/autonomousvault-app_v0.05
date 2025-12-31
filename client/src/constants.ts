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

// ============================================
// METEORA DEVNET
// ============================================
export const METEORA_DLMM_PROGRAM = 'LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo';
export const METEORA_DAMM_PROGRAM = 'cpamdpZCGKUy5JxQXB4dcpGPiikHawvSWAd6mEn1sGG';
export const METEORA_DBC_PROGRAM = 'dbcij3LWUppWqq96dh6gJWwBifmcGfLSB5D4DuSMaqN';
export const METEORA_API = 'https://dlmm-api.meteora.ag';
export const METEORA_DEVNET_URL = 'https://devnet.meteora.ag';

// ============================================
// RAYDIUM DEVNET
// ============================================
export const RAYDIUM_CLMM_PROGRAM_DEVNET = 'DRayAUgENGQBKVaX8owNhgzkEDyoHTGVEGHVJT1E9pfH';
export const RAYDIUM_CPMM_PROGRAM_DEVNET = 'DRaycpLY18LhpbydsBWbVJtxpNv9oXPgjRSfpF2bWpYb';
export const RAYDIUM_AMM_V4_PROGRAM_DEVNET = 'DRaya7Kj3aMWQSy19kSjvmuwq9docCHofyP9kanQGaav';
export const RAYDIUM_STABLE_AMM_DEVNET = 'DRayDdXc1NZQ9C3hRWmoSf8zK4iapgMnjdNZWrfwsP8m';
export const RAYDIUM_ROUTING_DEVNET = 'DRaybByLpbUL57LJARs3j8BitTxVfzBg351EaMr5UTCd';
export const RAYDIUM_API_DEVNET = 'https://api-v3-devnet.raydium.io';

// Pool fee tiers (in basis points)
export const LP_FEE_TIERS = [1, 5, 25, 100, 300, 1000]; // 0.01%, 0.05%, 0.25%, 1%, 3%, 10%