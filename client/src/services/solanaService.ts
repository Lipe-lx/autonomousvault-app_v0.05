import {
    Connection,
    Keypair,
    LAMPORTS_PER_SOL,
    PublicKey,
    SystemProgram,
    Transaction
} from '@solana/web3.js';
import {
    getAssociatedTokenAddress,
    createAssociatedTokenAccountInstruction,
    createTransferInstruction,
    TOKEN_PROGRAM_ID
} from '@solana/spl-token';
import { SOLANA_RPC_DEVNET, TOKENS, RAYDIUM_PROGRAM_ID } from '../constants';
import { Token } from '../types';

export class SolanaService {
    connection: Connection;

    constructor() {
        this.connection = new Connection(SOLANA_RPC_DEVNET, 'confirmed');
    }

    // Create a new random vault keypair
    createVaultKeypair(): Keypair {
        return Keypair.generate();
    }

    getKeypairFromSecretKey(secretKeyString: string): Keypair {
        const secretKey = Uint8Array.from(JSON.parse(secretKeyString));
        return Keypair.fromSecretKey(secretKey);
    }

    async getBalance(publicKey: string): Promise<number> {
        try {
            const balance = await this.connection.getBalance(new PublicKey(publicKey));
            return balance / LAMPORTS_PER_SOL;
        } catch (e) {
            console.error("Error fetching balance:", e);
            return 0;
        }
    }

    async wait(ms: number) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Helper to retry account info fetches on flaky devnet
    async getAccountInfoWithRetry(publicKey: PublicKey, retries = 5) {
        for (let i = 0; i < retries; i++) {
            try {
                return await this.connection.getAccountInfo(publicKey);
            } catch (e: any) {
                console.warn(`Attempt ${i + 1} failed to fetch account info: ${e.message}`);
                if (i === retries - 1) throw e;
                // Exponential backoff: 500ms, 1000ms, 2000ms...
                await this.wait(500 * Math.pow(2, i));
            }
        }
        return null;
    }

    // Helper to retry blockhash fetches on flaky devnet
    async getLatestBlockhashWithRetry(retries = 5) {
        for (let i = 0; i < retries; i++) {
            try {
                return await this.connection.getLatestBlockhash('confirmed');
            } catch (e: any) {
                console.warn(`Attempt ${i + 1} failed to get blockhash: ${e.message}`);
                if (i === retries - 1) throw new Error("Network error: Failed to fetch blockhash. Devnet may be down.");
                await this.wait(500 * Math.pow(2, i));
            }
        }
        throw new Error("Failed to get blockhash");
    }

    async getTokenBalances(walletAddress: string): Promise<Token[]> {
        // In a full implementation, we would fetch parsed token accounts here.
        // For this demo, we mainly track SOL.
        const solBalance = await this.getBalance(walletAddress);
        return TOKENS.map(t => ({
            ...t,
            balance: t.symbol === 'SOL' ? solBalance : 0
        }));
    }

    async airdrop(publicKey: string): Promise<string> {
        try {
            const signature = await this.connection.requestAirdrop(new PublicKey(publicKey), 1 * LAMPORTS_PER_SOL);
            const latestBlockHash = await this.getLatestBlockhashWithRetry();
            await this.connection.confirmTransaction({
                blockhash: latestBlockHash.blockhash,
                lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
                signature: signature,
            });
            return signature;
        } catch (e: any) {
            if (e.message?.includes('429')) {
                throw new Error("Devnet Rate Limit Reached. Please try again later.");
            }
            if (e.message?.includes('limit reached')) {
                throw new Error("Daily Airdrop Limit Reached for this IP.");
            }
            throw e;
        }
    }

    // Connect to external wallet (Phantom/Solflare)
    async connectWallet(): Promise<string> {
        try {
            const { solana } = window as any;
            if (solana && solana.isPhantom) {
                const response = await solana.connect();
                return response.publicKey.toString();
            }
            alert("Solana object not found! Get a Phantom Wallet 👻");
            throw new Error("No wallet found");
        } catch (e) {
            console.error(e);
            throw e;
        }
    }

    // Poll for transaction confirmation using getSignatureStatus (more reliable than WebSocket-based confirmTransaction)
    private async pollForConfirmation(signature: string, maxAttempts = 15, intervalMs = 2000): Promise<boolean> {
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            try {
                const status = await this.connection.getSignatureStatus(signature);

                if (status?.value?.confirmationStatus) {
                    const confirmLevel = status.value.confirmationStatus;
                    // 'processed', 'confirmed', or 'finalized' all mean the transaction was included
                    if (confirmLevel === 'confirmed' || confirmLevel === 'finalized') {
                        console.log(`[Solana] ✅ Transaction confirmed (${confirmLevel}) after ${attempt + 1} attempts`);
                        return true;
                    }
                    if (confirmLevel === 'processed') {
                        console.log(`[Solana] ⏳ Transaction processed, waiting for confirmation...`);
                    }
                }

                // Check for on-chain error
                if (status?.value?.err) {
                    throw new Error(`Transaction failed on-chain: ${JSON.stringify(status.value.err)}`);
                }

                // Wait before next poll
                await this.wait(intervalMs);

            } catch (e: any) {
                // If it's an actual transaction error, rethrow
                if (e.message?.includes('failed on-chain')) throw e;
                // Otherwise, just a network hiccup - continue polling
                console.warn(`[Solana] Poll attempt ${attempt + 1} failed:`, e.message);
                await this.wait(intervalMs);
            }
        }
        return false;
    }

    // Robust Transaction Sender
    private async sendTransactionWithRetry(
        transaction: Transaction,
        signers: Keypair[]
    ): Promise<string> {
        let signature = '';
        try {
            // Robust blockhash retrieval
            const latestBlockHash = await this.getLatestBlockhashWithRetry();
            transaction.recentBlockhash = latestBlockHash.blockhash;
            transaction.lastValidBlockHeight = latestBlockHash.lastValidBlockHeight;

            transaction.sign(...signers);

            signature = await this.connection.sendRawTransaction(transaction.serialize(), {
                skipPreflight: false,
                preflightCommitment: 'confirmed'
            });

            console.log(`[Solana] 📤 Transaction sent: ${signature.slice(0, 16)}...`);

            // Use polling-based confirmation instead of WebSocket-based confirmTransaction
            // This is more reliable on Devnet where WebSocket connections can be unstable
            const confirmed = await this.pollForConfirmation(signature, 15, 2000); // 15 attempts × 2s = 30s max

            if (!confirmed) {
                // Even if we didn't get explicit confirmation, the transaction might have succeeded
                // Return the signature with a warning - user can verify on explorer
                console.warn(`[Solana] ⚠️ Confirmation polling timed out, but transaction may have succeeded: ${signature}`);
                const timeoutError = new Error("Transaction timed out. The network is congested. Please check your wallet history before trying again to avoid double spending.");
                (timeoutError as any).signature = signature;
                (timeoutError as any).isTimeout = true;
                throw timeoutError;
            }

            return signature;

        } catch (e: any) {
            console.warn("Transaction Error:", e.name, e.message);

            if (e.name === 'TransactionExpiredBlockheightExceededError' || e.message?.includes('block height exceeded') || e.message?.includes('timeout') || (e as any).isTimeout) {
                // We intentionally do NOT retry here. Retrying with a new blockhash creates a new transaction 
                // which leads to double-spending if the previous one was just slow (common on Devnet).
                // IMPORTANT: Attach the signature to the error so it can be verified later
                const timeoutError = new Error("Transaction timed out. The network is congested. Please check your wallet history before trying again to avoid double spending.");
                (timeoutError as any).signature = signature;
                (timeoutError as any).isTimeout = true;
                throw timeoutError;
            }
            throw e;
        }
    }

    // Transfer SOL from Vault -> Owner
    async transferSol(vaultKeypair: Keypair, toPublicKey: string, amount: number): Promise<string> {
        try {
            const transaction = new Transaction().add(
                SystemProgram.transfer({
                    fromPubkey: vaultKeypair.publicKey,
                    toPubkey: new PublicKey(toPublicKey),
                    lamports: Math.floor(amount * LAMPORTS_PER_SOL),
                })
            );

            transaction.feePayer = vaultKeypair.publicKey;
            // Uses the safer single-attempt sender
            return await this.sendTransactionWithRetry(transaction, [vaultKeypair]);

        } catch (e: any) {
            console.error("Transfer Error", e);
            throw new Error(`Transfer failed: ${e.message}`);
        }
    }

    // Helper to find a pool for the given token pair on Devnet
    async findPoolKeys(
        inputMintStr: string,
        outputMintStr: string
    ): Promise<any> { // Returning 'any' to avoid strict type issues with complex SDK types in this snippet, but ideally LiquidityPoolKeys
        const { Liquidity, MARKET_STATE_LAYOUT_V3, LIQUIDITY_STATE_LAYOUT_V4, SPL_MINT_LAYOUT } = await import('@raydium-io/raydium-sdk');

        const inputMint = new PublicKey(inputMintStr);
        const outputMint = new PublicKey(outputMintStr);

        // We need to find a pool where (base=input AND quote=output) OR (base=output AND quote=input)
        // We'll use getProgramAccounts with filters for efficiency.

        const programId = new PublicKey(RAYDIUM_PROGRAM_ID);

        // Filter for Base = Input
        const filters1 = [
            { dataSize: LIQUIDITY_STATE_LAYOUT_V4.span },
            { memcmp: { offset: LIQUIDITY_STATE_LAYOUT_V4.offsetOf('baseMint'), bytes: inputMint.toBase58() } },
            { memcmp: { offset: LIQUIDITY_STATE_LAYOUT_V4.offsetOf('quoteMint'), bytes: outputMint.toBase58() } },
        ];

        // Filter for Base = Output (Reverse pair)
        const filters2 = [
            { dataSize: LIQUIDITY_STATE_LAYOUT_V4.span },
            { memcmp: { offset: LIQUIDITY_STATE_LAYOUT_V4.offsetOf('baseMint'), bytes: outputMint.toBase58() } },
            { memcmp: { offset: LIQUIDITY_STATE_LAYOUT_V4.offsetOf('quoteMint'), bytes: inputMint.toBase58() } },
        ];

        let pools = await this.connection.getProgramAccounts(programId, { filters: filters1 });
        if (pools.length === 0) {
            pools = await this.connection.getProgramAccounts(programId, { filters: filters2 });
        }

        if (pools.length === 0) {
            return null;
        }

        const poolAccount = pools[0];
        const poolState = LIQUIDITY_STATE_LAYOUT_V4.decode(poolAccount.account.data);

        // Fetch Market Info
        const marketId = poolState.marketId;
        const marketAccount = await this.connection.getAccountInfo(marketId);
        if (!marketAccount) throw new Error("Failed to fetch market info");

        const marketState = MARKET_STATE_LAYOUT_V3.decode(marketAccount.data);

        const authority = Liquidity.getAssociatedAuthority({ programId: programId }).publicKey;

        return {
            id: poolAccount.pubkey,
            baseMint: poolState.baseMint,
            quoteMint: poolState.quoteMint,
            lpMint: poolState.lpMint,
            baseDecimals: poolState.baseDecimal.toNumber(),
            quoteDecimals: poolState.quoteDecimal.toNumber(),
            lpDecimals: 5, // Usually 5 or 9, but we don't strictly need it for swap
            version: 4,
            programId: programId,
            authority: authority,
            openOrders: poolState.openOrders,
            targetOrders: poolState.targetOrders,
            baseVault: poolState.baseVault,
            quoteVault: poolState.quoteVault,
            withdrawQueue: poolState.withdrawQueue,
            lpVault: poolState.lpVault,
            marketVersion: 3,
            marketProgramId: poolState.marketProgramId,
            marketId: poolState.marketId,
            marketAuthority: Liquidity.getAssociatedAuthority({ programId: poolState.marketProgramId }).publicKey,
            marketBaseVault: marketState.baseVault,
            marketQuoteVault: marketState.quoteVault,
            marketBids: marketState.bids,
            marketAsks: marketState.asks,
            marketEventQueue: marketState.eventQueue,
        };
    }

    // Real Token Swap Execution using Raydium SDK
    async executeSwap(
        vaultKeypair: Keypair,
        inputMintStr: string,
        outputMintStr: string,
        amountIn: number,
        onProgress?: (status: string) => void
    ): Promise<string> {
        const {
            Liquidity,
            Token: RayToken,
            TokenAmount,
            Percent,
            TxVersion
        } = await import('@raydium-io/raydium-sdk');

        try {
            const updateStatus = (msg: string) => {
                console.log(`[Swap Status] ${msg}`);
                if (onProgress) onProgress(msg);
            };

            updateStatus("Initializing Swap Protocol...");

            // Handle SOL mint address normalization
            const SOL_MINT = 'So11111111111111111111111111111111111111112';
            const inputClean = inputMintStr.trim() === 'SOL' ? SOL_MINT : inputMintStr.trim();
            const outputClean = outputMintStr.trim() === 'SOL' ? SOL_MINT : outputMintStr.trim();

            updateStatus("Fetching Pool Keys...");
            const poolKeys = await this.findPoolKeys(inputClean, outputClean);

            if (!poolKeys) {
                throw new Error(`No Liquidity Pool found for ${inputClean} <-> ${outputClean} on Devnet.`);
            }

            updateStatus("Calculating Amount Out...");

            // Determine which is base and which is quote in the pool
            const inputIsBase = inputClean === poolKeys.baseMint.toBase58();

            const { TOKEN_PROGRAM_ID } = await import('@solana/spl-token');

            const inputToken = new RayToken(
                TOKEN_PROGRAM_ID,
                new PublicKey(inputClean),
                inputIsBase ? poolKeys.baseDecimals : poolKeys.quoteDecimals
            );
            const outputToken = new RayToken(
                TOKEN_PROGRAM_ID,
                new PublicKey(outputClean),
                inputIsBase ? poolKeys.quoteDecimals : poolKeys.baseDecimals
            );

            const amountInToken = new TokenAmount(inputToken, amountIn, false); // false = not raw units
            const slippage = new Percent(25, 100); // 25% slippage for Devnet volatility

            // Fetch fresh pool info to calculate accurate amounts
            updateStatus("Fetching Pool Reserves...");
            const poolInfo = await Liquidity.fetchInfo({ connection: this.connection, poolKeys });

            const { amountOut, minAmountOut } = Liquidity.computeAmountOut({
                poolKeys,
                poolInfo,
                amountIn: amountInToken,
                currencyOut: outputToken,
                slippage,
            });

            updateStatus(`Calculated Amount Out: ${amountOut.toFixed()} (Min: ${minAmountOut.toFixed()})`);

            updateStatus("Building Swap Transaction...");

            const userTokenAccounts = await this.getTokenAccountsByOwner(vaultKeypair.publicKey);

            const { innerTransactions } = await Liquidity.makeSwapInstructionSimple({
                connection: this.connection,
                poolKeys,
                userKeys: {
                    tokenAccounts: userTokenAccounts as any,
                    owner: vaultKeypair.publicKey,
                },
                amountIn: amountInToken,
                amountOut: minAmountOut,
                fixedSide: 'in',
                makeTxVersion: TxVersion.V0,
            });

            updateStatus("Sending Transaction to Devnet...");

            const transactions = await Promise.all(innerTransactions.map(async (tx) => {
                const { instructions, signers } = tx;
                const transaction = new Transaction();
                transaction.add(...instructions);
                transaction.feePayer = vaultKeypair.publicKey;
                transaction.recentBlockhash = (await this.connection.getLatestBlockhash()).blockhash;
                transaction.sign(vaultKeypair, ...signers);
                return transaction;
            }));

            let signature = "";
            for (const tx of transactions) {
                // We use our robust sender
                // Note: SDK returns VersionedTransaction, our sender handles Transaction (Legacy).
                // We need to adapt or use connection.sendTransaction directly for Versioned.

                // Simple adaptation for VersionedTransaction:
                const sig = await this.connection.sendRawTransaction(tx.serialize(), {
                    skipPreflight: false,
                    preflightCommitment: 'confirmed',
                    maxRetries: 5
                });

                console.log(`[Swap] 📤 Transaction sent: ${sig.slice(0, 16)}...`);

                // Use polling-based confirmation instead of WebSocket-based confirmTransaction
                const confirmed = await this.pollForConfirmation(sig, 15, 2000); // 15 attempts × 2s = 30s max

                if (!confirmed) {
                    throw new Error('Transaction confirmation timed out - please check explorer for status');
                }

                signature = sig;
            }

            updateStatus("Transaction Confirmed!");
            return signature;

        } catch (e: any) {
            console.error("Swap Error:", e);
            throw new Error(`Swap failed: ${e.message}`);
        }
    }

    // Fetch all assets (Tokens and NFTs)
    async getWalletAssets(publicKey: string): Promise<any[]> {
        const pubkey = new PublicKey(publicKey);
        const solBalance = await this.getBalance(publicKey);

        // Get all SPL tokens
        const tokenAccounts = await this.getTokenAccountsByOwner(pubkey);

        const assets = tokenAccounts.map(t => ({
            mint: t.accountInfo.mint.toBase58(),
            amount: t.accountInfo.amount,
            decimals: t.accountInfo.decimals,
            // We can try to match with known tokens for symbol/name
            symbol: TOKENS.find(k => k.mint === t.accountInfo.mint.toBase58())?.symbol || 'UNKNOWN',
            name: TOKENS.find(k => k.mint === t.accountInfo.mint.toBase58())?.name || 'Unknown Token',
            isNft: t.accountInfo.decimals === 0 && t.accountInfo.amount === '1'
        }));

        // Add SOL as the first asset
        assets.unshift({
            mint: 'So11111111111111111111111111111111111111112',
            amount: (solBalance * LAMPORTS_PER_SOL).toString(),
            decimals: 9,
            symbol: 'SOL',
            name: 'Solana',
            isNft: false
        });

        return assets;
    }

    // Helper to get parsed token accounts for SDK
    private async getTokenAccountsByOwner(owner: PublicKey) {
        const { TOKEN_PROGRAM_ID } = await import('@solana/spl-token');
        const response = await this.connection.getParsedTokenAccountsByOwner(owner, {
            programId: TOKEN_PROGRAM_ID
        });

        return response.value.map(i => ({
            pubkey: i.pubkey,
            programId: i.account.owner,
            accountInfo: {
                mint: new PublicKey(i.account.data.parsed.info.mint),
                amount: i.account.data.parsed.info.tokenAmount.amount,
                decimals: i.account.data.parsed.info.tokenAmount.decimals,
            }
        }));
    }
    // Transfer SPL Token from Vault -> Owner
    async transferToken(
        vaultKeypair: Keypair,
        mintAddress: string,
        destinationAddress: string,
        amount: number,
        decimals: number
    ): Promise<string> {
        // Handle SOL transfers transparently
        if (mintAddress === 'So11111111111111111111111111111111111111112' || mintAddress === 'SOL') {
            return this.transferSol(vaultKeypair, destinationAddress, amount);
        }

        try {
            const mintPubkey = new PublicKey(mintAddress);
            const destPubkey = new PublicKey(destinationAddress);

            // 1. Get Vault's Token Account (Source)
            const sourceATA = await getAssociatedTokenAddress(
                mintPubkey,
                vaultKeypair.publicKey
            );

            // 2. Get Destination Token Account
            const destATA = await getAssociatedTokenAddress(
                mintPubkey,
                destPubkey
            );

            const transaction = new Transaction();

            // 3. Check if Destination ATA exists, if not, create it
            const destAccountInfo = await this.connection.getAccountInfo(destATA);
            if (!destAccountInfo) {
                transaction.add(
                    createAssociatedTokenAccountInstruction(
                        vaultKeypair.publicKey, // Payer
                        destATA,
                        destPubkey,
                        mintPubkey
                    )
                );
            }

            // 4. Create Transfer Instruction
            // For better precision, fetch the actual token balance and use it if transferring full amount
            let rawAmount: bigint;

            // Check if user is trying to transfer their full balance
            const sourceAccountInfo = await this.connection.getAccountInfo(sourceATA);
            if (sourceAccountInfo) {
                const sourceTokenAccount = await this.connection.getTokenAccountBalance(sourceATA);
                const actualBalance = BigInt(sourceTokenAccount.value.amount);

                // Calculate what the user requested in raw units
                const requestedRaw = BigInt(Math.round(amount * Math.pow(10, decimals)));

                // If the requested amount is very close to the actual balance (within 1%), use the actual balance
                // This handles cases like "transfer all" where floating point precision might cause issues
                const diff = actualBalance > requestedRaw ? actualBalance - requestedRaw : requestedRaw - actualBalance;
                const threshold = actualBalance / BigInt(100); // 1% threshold

                if (diff <= threshold) {
                    rawAmount = actualBalance;
                    console.log(`[Transfer] Using actual balance: ${actualBalance} (requested: ${requestedRaw})`);
                } else {
                    rawAmount = requestedRaw;
                }
            } else {
                // Fallback if we can't fetch the account (shouldn't happen)
                rawAmount = BigInt(Math.round(amount * Math.pow(10, decimals)));
            }

            transaction.add(
                createTransferInstruction(
                    sourceATA,
                    destATA,
                    vaultKeypair.publicKey,
                    rawAmount
                )
            );

            transaction.feePayer = vaultKeypair.publicKey;

            return await this.sendTransactionWithRetry(transaction, [vaultKeypair]);

        } catch (e: any) {
            console.error("Token Transfer Error", e);
            throw new Error(`Token Transfer failed: ${e.message}`);
        }
    }
    // Fetch recent transaction history
    async getRecentTransactions(address: string, limit = 20): Promise<any[]> {
        try {
            const pubkey = new PublicKey(address);
            const signatures = await this.connection.getSignaturesForAddress(pubkey, { limit });

            // We could fetch full parsed transactions here for more detail, 
            // but for a lightweight dashboard, signatures + memo/status is a good start.
            // To get balance changes, we would need getParsedTransactions.

            return signatures.map(sig => ({
                signature: sig.signature,
                slot: sig.slot,
                err: sig.err,
                memo: sig.memo,
                blockTime: sig.blockTime,
                status: sig.err ? 'failed' : 'success',
                confirmationStatus: sig.confirmationStatus
            }));
        } catch (error) {
            console.error("Error fetching transactions:", error);
            return [];
        }
    }
}

export const solanaService = new SolanaService();