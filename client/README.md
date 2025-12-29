# Client-Only Files

This directory documents files that MUST remain client-only for non-custodial guarantees.

## Critical Client-Only Components

These files handle secrets and MUST NEVER be moved server-side:

### Encryption Service
**Original:** `services/cryptoService.ts`

Handles AES-GCM encryption using user's password. The password is never sent to the server.

### Vault Hook
**Original:** `src/hooks/useVault.ts`

Manages:
- Wallet creation
- Key decryption  
- Signing trigger injection
- Password handling

### Dealer Hook
**Original:** `src/hooks/useDealer.ts`

Injects the executor function that has access to the decrypted wallet for signing.

### Hyperliquid Signing
**Original:** `services/hyperliquidService.ts` (signing methods)

The `signL1Action` method (lines 683-764) performs EIP-712 signing with the private key.

## Non-Custodial Guarantees

These client-only files ensure:

1. **Keys encrypted client-side** - AES-GCM with user's password
2. **Signing in-memory only** - Wallet received as parameter
3. **No key persistence** - Decrypted keys never stored
4. **User password never leaves client** - Server cannot decrypt
5. **No admin override** - Product owner has zero access

## Server-Side Execution (Optional)

If a user opts in to server-side execution (Edge Functions), they must:

1. Send their **encrypted** private key
2. Provide an **execution password** (separate from account password)
3. Understand decryption happens in-memory on Edge Function
4. Accept that keys are cleared immediately after signing

The user's main password is NEVER used for server-side execution.
This separation ensures the product owner cannot access funds even with database access.
