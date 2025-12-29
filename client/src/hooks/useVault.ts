import { useState, useEffect, useRef, useCallback } from 'react';
import { Keypair } from '@solana/web3.js';
import { encode, decode } from 'bs58';
import { VaultState } from '../types';
import { TOKENS } from '../constants';
import { solanaService } from '../services/solanaService';
import { hyperliquidService } from '../services/hyperliquidService';
import { CryptoService } from '../services/cryptoService';
import { SecurityService } from '../services/securityService';

import { StorageService } from '../services/storageService';
import { balanceHistoryStore } from '../state/balanceHistoryStore';
import { dealerStore } from '../state/dealerStore';


export const useVault = (addNotification: (msg: string) => void, userId: string | null) => {
    // Vault State
    const [isLoading, setIsLoading] = useState(true);
    const [vault, setVault] = useState<VaultState>({
        publicKey: null,
        encryptedPrivateKey: null,
        solBalance: 0,
        tokens: TOKENS,
        assets: [],
        isUnlocked: false,
        ownerPublicKey: null,
        hlPublicKey: null,
        hlEncryptedPrivateKey: null,
        hlBalance: 0,
        hlOwnerPublicKey: null,
        hlPositions: [],
        // Polymarket fields
        pmPublicKey: null,
        pmEncryptedPrivateKey: null,
        pmBalance: 0,
        pmOwnerPublicKey: null
    });

    const [password, setPassword] = useState('');
    const [withdrawAmount, setWithdrawAmount] = useState('');
    const [withdrawNetwork, setWithdrawNetwork] = useState<'SOL' | 'HYPE' | 'POLY'>('SOL');

    // Store the keypair in state (caution: sensitive data in memory)
    const [tempKeypair, setTempKeypair] = useState<Keypair | null>(null);

    // Backup State
    const [showBackupModal, setShowBackupModal] = useState(false);
    const [backupKey, setBackupKey] = useState('');

    // Hyperliquid Backup State
    const [showHLBackupModal, setShowHLBackupModal] = useState(false);
    const [hlBackupKey, setHLBackupKey] = useState('');

    // Polymarket Backup State
    const [showPMBackupModal, setShowPMBackupModal] = useState(false);
    const [pmBackupKey, setPMBackupKey] = useState('');

    // Import State (Legacy - for initial vault creation)
    const [isImporting, setIsImporting] = useState(false);
    const [importKey, setImportKey] = useState('');

    // Individual Wallet Import State
    const [isImportingSolana, setIsImportingSolana] = useState(false);
    const [isImportingHyperliquid, setIsImportingHyperliquid] = useState(false);
    const [isImportingPolymarket, setIsImportingPolymarket] = useState(false);
    const [solanaPassword, setSolanaPassword] = useState('');
    const [hyperliquidPassword, setHyperliquidPassword] = useState('');
    const [polymarketPassword, setPolymarketPassword] = useState('');
    const [solanaImportKey, setSolanaImportKey] = useState('');
    const [hlImportKey, setHLImportKey] = useState('');
    const [pmImportKey, setPMImportKey] = useState('');

    // Security breach handler - auto-lock vault when DevTools manipulation detected
    useEffect(() => {
        const unsubscribe = SecurityService.onSecurityBreach(() => {
            if (vault.isUnlocked) {
                console.warn('[useVault] Security breach detected - locking vault');
                setVault(prev => ({ ...prev, isUnlocked: false }));
                setPassword('');
                setTempKeypair(null);
                SecurityService.clearSession();
                addNotification('Security alert: Vault locked for protection');
            }
        });
        return () => unsubscribe();
    }, [vault.isUnlocked, addNotification]);



    // Initial Load & Migration - ONLY run when userId is available
    useEffect(() => {
        // Wait for userId to be set before loading vault data
        if (!userId) {
            console.log('[useVault] Waiting for userId before loading vault data...');
            setIsLoading(true);
            // Reset user-scoped stores
            balanceHistoryStore.reset();
            dealerStore.reset();
            return;
        }

        const initVault = async () => {
            setIsLoading(true);
            try {
                // Determine if we need to set user context on stores?
                // StorageService.setUserId is already called in AuthContext usually, but here useVault just reacts to userId.
                // We assume StorageService.currentUserId is already set by AuthContext or we should ensure it.
                // In App.tsx: 
                // const { user } = useAuth();
                // useVault(..., user?.uid)

                // Note: AuthContext calls StorageService.setUserId(user.uid).
                // So when userId is present here, StorageService is ready.

                // Reload stores with new user context
                await balanceHistoryStore.reloadFromStorage();
                await dealerStore.reloadFromStorage();

                // Run migration once on mount
                await StorageService.migrateFromLocalStorage();

                console.log('[useVault] Loading vault data for user:', userId.substring(0, 8) + '...');

                // Load data from IndexedDB (user-scoped)
                const savedVault = await StorageService.getItem(StorageService.getUserKey('agent_vault_pubkey'));
                const savedEncrypted = await StorageService.getItem(StorageService.getUserKey('agent_vault_enc'));
                const savedOwner = await StorageService.getItem(StorageService.getUserKey('agent_owner_pubkey'));

                const savedHLVault = await StorageService.getItem(StorageService.getUserKey('agent_hl_vault_pubkey'));
                const savedHLEncrypted = await StorageService.getItem(StorageService.getUserKey('agent_hl_vault_enc'));
                const savedHLOwner = await StorageService.getItem(StorageService.getUserKey('agent_hl_owner_pubkey'));

                const savedPMVault = await StorageService.getItem(StorageService.getUserKey('agent_pm_vault_pubkey'));
                const savedPMEncrypted = await StorageService.getItem(StorageService.getUserKey('agent_pm_vault_enc'));
                const savedPMOwner = await StorageService.getItem(StorageService.getUserKey('agent_pm_owner_pubkey'));

                console.log('[useVault] Loaded keys:', {
                    solana: savedVault ? savedVault.substring(0, 8) + '...' : null,
                    hyperliquid: savedHLVault ? savedHLVault.substring(0, 8) + '...' : null,
                    polymarket: savedPMVault ? savedPMVault.substring(0, 8) + '...' : null
                });

                if (savedVault && savedEncrypted) {
                    setVault(prev => ({
                        ...prev,
                        publicKey: savedVault,
                        encryptedPrivateKey: savedEncrypted,
                        ownerPublicKey: savedOwner,
                        hlPublicKey: savedHLVault,
                        hlEncryptedPrivateKey: savedHLEncrypted,
                        hlOwnerPublicKey: savedHLOwner,
                        pmPublicKey: savedPMVault,
                        pmEncryptedPrivateKey: savedPMEncrypted,
                        pmOwnerPublicKey: savedPMOwner
                    }));
                    refreshBalance(savedVault);
                    if (savedHLVault) refreshHLBalance(savedHLVault);
                    if (savedPMVault) refreshPMBalance(savedPMVault);
                } else if (savedHLVault && savedHLEncrypted) {
                    // User only has HL vault
                    setVault(prev => ({
                        ...prev,
                        hlPublicKey: savedHLVault,
                        hlEncryptedPrivateKey: savedHLEncrypted,
                        hlOwnerPublicKey: savedHLOwner,
                        pmPublicKey: savedPMVault,
                        pmEncryptedPrivateKey: savedPMEncrypted,
                        pmOwnerPublicKey: savedPMOwner
                    }));
                    refreshHLBalance(savedHLVault);
                    if (savedPMVault) refreshPMBalance(savedPMVault);
                } else if (savedPMVault && savedPMEncrypted) {
                    // User only has PM vault
                    setVault(prev => ({
                        ...prev,
                        pmPublicKey: savedPMVault,
                        pmEncryptedPrivateKey: savedPMEncrypted,
                        pmOwnerPublicKey: savedPMOwner
                    }));
                    refreshPMBalance(savedPMVault);
                }
            } catch (e) {
                console.error("[useVault] Failed to load vault from storage", e);
            } finally {
                setIsLoading(false);
            }
        };

        initVault();
    }, [userId]);




    const refreshHLBalance = async (address: string) => {
        try {
            const state = await hyperliquidService.getUserState(address);
            const marginSummary = state.marginSummary;
            const balance = marginSummary ? parseFloat(marginSummary.accountValue) : 0;
            const positions = state.assetPositions || [];

            setVault(prev => ({
                ...prev,
                hlBalance: balance,
                hlPositions: positions
            }));
        } catch (e) {
            console.error("Failed to refresh HL balance", e);
        }
    };

    const refreshPMBalance = async (address: string) => {
        try {
            // Polymarket uses USDC on Polygon
            const { ethers } = await import('ethers');
            const provider = new ethers.JsonRpcProvider('https://polygon-rpc.com');
            const USDC_ADDRESS = '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174'; // USDC on Polygon
            const balanceAbi = ['function balanceOf(address) view returns (uint256)'];
            const usdc = new ethers.Contract(USDC_ADDRESS, balanceAbi, provider);
            const balance = await usdc.balanceOf(address);
            const balanceFormatted = parseFloat(ethers.formatUnits(balance, 6));

            setVault(prev => ({
                ...prev,
                pmBalance: balanceFormatted
            }));
        } catch (e) {
            console.error("Failed to refresh Polymarket balance", e);
        }
    };

    const refreshBalance = async (pubkey: string) => {
        try {
            const bal = await solanaService.getBalance(pubkey);
            const assets = await solanaService.getWalletAssets(pubkey);
            setVault(prev => ({ ...prev, solBalance: bal, assets: assets }));
        } catch (e) {
            console.error("Failed to refresh balance", e);
        }
    };

    const connectOwnerWallet = async () => {
        try {
            const pubkey = await solanaService.connectWallet();
            setVault(prev => ({ ...prev, ownerPublicKey: pubkey }));
            await StorageService.setItem(StorageService.getUserKey('agent_owner_pubkey'), pubkey);
            addNotification("Solana Owner Wallet Connected: " + pubkey.slice(0, 6) + "...");
        } catch (e) {
            addNotification("Failed to connect Solana wallet.");
        }
    };

    const connectHLOwnerWallet = async () => {
        try {
            // Check for Ethereum provider (MetaMask, etc.)
            const { ethereum } = window as any;
            if (ethereum) {
                const accounts = await ethereum.request({ method: 'eth_requestAccounts' });
                const account = accounts[0];
                setVault(prev => ({ ...prev, hlOwnerPublicKey: account }));
                await StorageService.setItem(StorageService.getUserKey('agent_hl_owner_pubkey'), account);
                addNotification("Hyperliquid Owner Wallet Connected: " + account.slice(0, 6) + "...");
            } else {
                addNotification("No Ethereum wallet found! Install MetaMask.");
            }
        } catch (e) {
            addNotification("Failed to connect EVM wallet.");
        }
    };

    const disconnectOwnerWallet = async () => {
        setVault(prev => ({ ...prev, ownerPublicKey: null }));
        await StorageService.removeItem(StorageService.getUserKey('agent_owner_pubkey'));
        addNotification("Solana Owner Wallet Disconnected");
    };

    const disconnectHLOwnerWallet = async () => {
        setVault(prev => ({ ...prev, hlOwnerPublicKey: null }));
        await StorageService.removeItem(StorageService.getUserKey('agent_hl_owner_pubkey'));
        addNotification("Hyperliquid Owner Wallet Disconnected");
    };

    const connectPMOwnerWallet = async () => {
        try {
            // Use Ethereum provider (MetaMask, etc.) for Polygon connection
            const { ethereum } = window as any;
            if (ethereum) {
                const accounts = await ethereum.request({ method: 'eth_requestAccounts' });
                const account = accounts[0];
                setVault(prev => ({ ...prev, pmOwnerPublicKey: account }));
                await StorageService.setItem(StorageService.getUserKey('agent_pm_owner_pubkey'), account);
                addNotification("Polymarket Owner Wallet Connected: " + account.slice(0, 6) + "...");
            } else {
                addNotification("No Ethereum wallet found! Install MetaMask.");
            }
        } catch (e) {
            addNotification("Failed to connect EVM wallet.");
        }
    };

    const disconnectPMOwnerWallet = async () => {
        setVault(prev => ({ ...prev, pmOwnerPublicKey: null }));
        await StorageService.removeItem(StorageService.getUserKey('agent_pm_owner_pubkey'));
        addNotification("Polymarket Owner Wallet Disconnected");
    };

    const createVault = async () => {
        if (!password) {
            addNotification('Password is required');
            return;
        }
        try {
            // 1. Solana Vault
            const kp = solanaService.createVaultKeypair();
            const secretKeyArray = Array.from(kp.secretKey);
            const encrypted = await CryptoService.encrypt(JSON.stringify(secretKeyArray), password);

            // 2. Hyperliquid Vault
            const hlWallet = hyperliquidService.createVaultWallet();
            const hlEncrypted = await CryptoService.encrypt(hlWallet.privateKey, password);

            // Save to secure storage (user-scoped)
            await StorageService.setItem(StorageService.getUserKey('agent_vault_pubkey'), kp.publicKey.toBase58());
            await StorageService.setItem(StorageService.getUserKey('agent_vault_enc'), encrypted);

            await StorageService.setItem(StorageService.getUserKey('agent_hl_vault_pubkey'), hlWallet.address);
            await StorageService.setItem(StorageService.getUserKey('agent_hl_vault_enc'), hlEncrypted);

            // Update state
            setVault(prev => ({
                ...prev,
                isUnlocked: true,
                publicKey: kp.publicKey.toBase58(),
                encryptedPrivateKey: encrypted,
                hlPublicKey: hlWallet.address,
                hlEncryptedPrivateKey: hlEncrypted
            }));

            // Show backup modals sequentially: Solana first, then Hyperliquid
            // Store Hyperliquid private key for the second modal
            setHLBackupKey(hlWallet.privateKey);

            // Show Solana backup modal first
            setBackupKey(encode(kp.secretKey));
            setShowBackupModal(true);

            addNotification('Vaults created successfully');
        } catch (error) {
            console.error('Vault creation failed', error);
            addNotification('Failed to create vault');
        }
    };

    const unlockVault = async () => {
        if (!password) {
            addNotification('Password is required');
            return;
        }
        try {
            const encrypted = await StorageService.getItem(StorageService.getUserKey('agent_vault_enc'));
            const pubkey = await StorageService.getItem(StorageService.getUserKey('agent_vault_pubkey'));

            const hlEncrypted = await StorageService.getItem(StorageService.getUserKey('agent_hl_vault_enc'));
            const hlPubkey = await StorageService.getItem(StorageService.getUserKey('agent_hl_vault_pubkey'));

            if ((!encrypted || !pubkey) && (!hlEncrypted || !hlPubkey)) {
                addNotification('No vault found. Please create one.');
                return;
            }

            let solanaKeypair: Keypair | null = null;
            let hlWalletAddress: string | null = null;
            let hlWalletEncrypted: string | null = null;

            // 1. Try to unlock Solana Vault
            if (encrypted && pubkey) {
                try {
                    const decryptedStr = await CryptoService.decrypt(encrypted, password);
                    const secretKey = Uint8Array.from(JSON.parse(decryptedStr));
                    solanaKeypair = Keypair.fromSecretKey(secretKey);

                    if (solanaKeypair.publicKey.toBase58() !== pubkey) {
                        throw new Error('Keypair mismatch');
                    }
                    setTempKeypair(solanaKeypair);
                } catch (e) {
                    console.error("Solana unlock failed", e);
                    throw new Error("Incorrect password for Solana Vault");
                }
            }

            // 2. Try to unlock Hyperliquid Vault
            if (hlEncrypted && hlPubkey) {
                try {
                    // Just verify we can decrypt it
                    const decryptedHlKey = await CryptoService.decrypt(hlEncrypted, password);

                    // VALIDATION: Ensure the decrypted key matches the stored address
                    const { ethers } = await import('ethers');
                    const tempWallet = new ethers.Wallet(decryptedHlKey);

                    if (tempWallet.address.toLowerCase() !== hlPubkey.toLowerCase()) {
                        console.error(`[Vault] ⚠️ HL Address Mismatch! Stored: ${hlPubkey}, Derived: ${tempWallet.address}`);
                        // We should probably trust the derived one, or warn the user.
                        // For now, let's update the local variable to the derived one to ensure transactions work
                        // but keep the stored one in state to show the mismatch in debug panel if needed.
                        // Actually, better to fail or warn. Let's warn and use the derived one.
                        hlWalletAddress = tempWallet.address;
                        addNotification("Warning: Stored HL address mismatch. Using derived address.");
                    } else {
                        hlWalletAddress = hlPubkey;
                    }

                    hlWalletEncrypted = hlEncrypted;
                } catch (e) {
                    console.error("Hyperliquid unlock failed", e);
                    // If Solana unlocked but HL failed, we might have a password sync issue
                    // But for now, fail the whole unlock if password is wrong
                    throw new Error("Incorrect password for Hyperliquid Vault");
                }
            }

            setVault(prev => ({
                ...prev,
                isUnlocked: true,
                publicKey: solanaKeypair ? solanaKeypair.publicKey.toBase58() : null,
                encryptedPrivateKey: encrypted || null,
                hlPublicKey: hlWalletAddress || null,
                hlEncryptedPrivateKey: hlWalletEncrypted || null
            }));

            if (hlWalletAddress) refreshHLBalance(hlWalletAddress);
            if (solanaKeypair) refreshBalance(solanaKeypair.publicKey.toBase58());

            // Set session hash for security validation
            await SecurityService.setSessionHash(password);

            addNotification('Vault unlocked');
        } catch (error: any) {
            console.error('Unlock failed', error);
            addNotification(error.message || 'Incorrect password or corrupted vault');
        }
    };

    const requestAirdrop = async () => {
        if (!vault.publicKey) return;
        try {
            addNotification("Requesting 1 SOL Airdrop...");
            await solanaService.airdrop(vault.publicKey);
            addNotification("Airdrop Successful!");
            setTimeout(() => refreshBalance(vault.publicKey!), 2000);
        } catch (e: any) {
            console.error("Airdrop failed", e);
            addNotification(`Airdrop Failed: ${e.message}`);
            alert(e.message);
        }
    };

    const handleWithdraw = async () => {
        if (!vault.isUnlocked) { // Removed tempKeypair check as we might reconstruct it or use it from state if we decided to keep it there. 
            // In App.tsx it checked tempKeypair, but unlockVault sets it.
            // However, other functions reconstruct it. Let's stick to App.tsx logic for now but ensure tempKeypair is set in unlockVault.
            if (!tempKeypair) {
                alert("Vault is locked or keypair missing");
                return;
            }
        }

        if (!vault.isUnlocked || !tempKeypair) {
            alert("Vault is locked");
            return;
        }

        if (!vault.ownerPublicKey) {
            alert("Connect Owner Wallet first");
            return;
        }

        const amount = parseFloat(withdrawAmount);
        if (isNaN(amount) || amount <= 0) {
            alert("Invalid amount");
            return;
        }
        if (amount > vault.solBalance) {
            alert("Insufficient balance");
            return;
        }

        try {
            addNotification(`Sending ${amount} SOL to Owner...`);
            const sig = await solanaService.transferSol(tempKeypair, vault.ownerPublicKey, amount);
            addNotification(`Withdrawal Success! Sig: ${sig.slice(0, 8)}...`);
            setWithdrawAmount('');
            refreshBalance(vault.publicKey!);
        } catch (e: any) {
            console.error(e);
            addNotification(`Withdrawal Failed: ${e.message}`);
        }
    };

    const handleWithdrawHL = async () => {
        if (!vault.isUnlocked) {
            alert("Vault is locked");
            return;
        }

        if (!vault.hlOwnerPublicKey) {
            alert("Connect Hyperliquid Owner Wallet first");
            return;
        }

        if (!vault.hlEncryptedPrivateKey) {
            alert("Hyperliquid vault not found");
            return;
        }

        const amount = parseFloat(withdrawAmount);
        if (isNaN(amount) || amount <= 1) {
            alert("Amount must be greater than $1 (withdrawal fee)");
            return;
        }
        if (amount > (vault.hlBalance || 0)) {
            alert("Insufficient USDC balance");
            return;
        }

        try {
            // Decrypt Hyperliquid private key
            const decryptedKey = await CryptoService.decrypt(vault.hlEncryptedPrivateKey, password);
            const hlWallet = hyperliquidService.getWalletFromPrivateKey(decryptedKey);

            addNotification(`Withdrawing ${amount} USDC to Hyperliquid Owner...`);
            const result = await hyperliquidService.withdrawUSDC(
                hlWallet,
                vault.hlOwnerPublicKey,
                amount
            );
            addNotification(`Withdrawal Success! Status: ${result.status}`);
            setWithdrawAmount('');

            // Refresh balance after withdrawal
            if (vault.hlPublicKey) {
                setTimeout(() => refreshHLBalance(vault.hlPublicKey!), 2000);
            }
        } catch (e: any) {
            console.error(e);
            addNotification(`Withdrawal Failed: ${e.message}`);
        }
    };

    const handleWithdrawPM = async () => {
        if (!vault.isUnlocked) {
            alert("Vault is locked");
            return;
        }

        if (!vault.pmOwnerPublicKey) {
            alert("Connect Polymarket Owner Wallet first");
            return;
        }

        if (!vault.pmEncryptedPrivateKey) {
            alert("Polymarket vault not found");
            return;
        }

        const amount = parseFloat(withdrawAmount);
        if (isNaN(amount) || amount <= 0) {
            alert("Amount must be greater than 0");
            return;
        }
        if (amount > (vault.pmBalance || 0)) {
            alert("Insufficient USDC balance");
            return;
        }

        try {
            // Decrypt Polymarket private key
            const decryptedKey = await CryptoService.decrypt(vault.pmEncryptedPrivateKey, password);

            // Import ethers for transaction
            const { ethers } = await import('ethers');

            // Connect to Polygon mainnet
            const provider = new ethers.JsonRpcProvider('https://polygon-rpc.com');
            const wallet = new ethers.Wallet(decryptedKey, provider);

            // USDC contract on Polygon
            const USDC_ADDRESS = '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174';
            const usdcAbi = [
                'function transfer(address to, uint256 amount) returns (bool)',
                'function balanceOf(address) view returns (uint256)'
            ];
            const usdc = new ethers.Contract(USDC_ADDRESS, usdcAbi, wallet);

            // Convert amount to 6 decimals (USDC)
            const amountWei = ethers.parseUnits(amount.toString(), 6);

            addNotification(`Withdrawing ${amount} USDC to Polymarket Owner...`);

            // Execute transfer
            const tx = await usdc.transfer(vault.pmOwnerPublicKey, amountWei);
            await tx.wait();

            addNotification(`Withdrawal Success! Tx: ${tx.hash.slice(0, 10)}...`);
            setWithdrawAmount('');

            // Refresh balance after withdrawal
            if (vault.pmPublicKey) {
                setTimeout(() => refreshPMBalance(vault.pmPublicKey!), 2000);
            }
        } catch (e: any) {
            console.error(e);
            addNotification(`Withdrawal Failed: ${e.message}`);
        }
    };

    const importVault = async () => {
        if (!password || !importKey) {
            addNotification('Password and Private Key are required');
            return;
        }
        try {
            // Validate and decode key
            const secretKey = decode(importKey);
            const kp = Keypair.fromSecretKey(secretKey);

            // Encrypt secret key
            const secretKeyArray = Array.from(kp.secretKey);
            const encrypted = await CryptoService.encrypt(JSON.stringify(secretKeyArray), password);

            // Save to user-scoped storage
            await StorageService.setItem(StorageService.getUserKey('agent_vault_pubkey'), kp.publicKey.toBase58());
            await StorageService.setItem(StorageService.getUserKey('agent_vault_enc'), encrypted);

            // Update state
            setVault(prev => ({
                ...prev,
                isUnlocked: true,
                publicKey: kp.publicKey.toBase58(),
                encryptedPrivateKey: encrypted
            }));

            addNotification('Vault imported successfully');
            setIsImporting(false);
            setImportKey('');
        } catch (error) {
            console.error('Vault import failed', error);
            addNotification('Invalid Private Key or Import Failed');
        }
    };

    // Individual Wallet Creation Functions
    const createSolanaVault = async () => {
        if (!solanaPassword) {
            addNotification('Password is required');
            return;
        }
        try {
            const kp = solanaService.createVaultKeypair();
            const secretKeyArray = Array.from(kp.secretKey);
            const encrypted = await CryptoService.encrypt(JSON.stringify(secretKeyArray), solanaPassword);

            // Save to user-scoped storage
            await StorageService.setItem(StorageService.getUserKey('agent_vault_pubkey'), kp.publicKey.toBase58());
            await StorageService.setItem(StorageService.getUserKey('agent_vault_enc'), encrypted);

            // Update state
            setVault(prev => ({
                ...prev,
                isUnlocked: true,
                publicKey: kp.publicKey.toBase58(),
                encryptedPrivateKey: encrypted
            }));

            setTempKeypair(kp);

            // Show backup modal
            setBackupKey(encode(kp.secretKey));
            setShowBackupModal(true);

            addNotification('Solana Vault created successfully');
            setSolanaPassword('');
        } catch (error) {
            console.error('Solana vault creation failed', error);
            addNotification('Failed to create Solana vault');
        }
    };

    const createHyperliquidVault = async () => {
        if (!hyperliquidPassword) {
            addNotification('Password is required');
            return;
        }
        try {
            const hlWallet = hyperliquidService.createVaultWallet();
            const hlEncrypted = await CryptoService.encrypt(hlWallet.privateKey, hyperliquidPassword);

            // Save to user-scoped storage
            await StorageService.setItem(StorageService.getUserKey('agent_hl_vault_pubkey'), hlWallet.address);
            await StorageService.setItem(StorageService.getUserKey('agent_hl_vault_enc'), hlEncrypted);

            // Update state
            setVault(prev => ({
                ...prev,
                hlPublicKey: hlWallet.address,
                hlEncryptedPrivateKey: hlEncrypted
            }));

            // Show backup modal
            setHLBackupKey(hlWallet.privateKey);
            setShowHLBackupModal(true);

            addNotification('Hyperliquid Vault created successfully');
            setHyperliquidPassword('');
            refreshHLBalance(hlWallet.address);
        } catch (error) {
            console.error('Hyperliquid vault creation failed', error);
            addNotification('Failed to create Hyperliquid vault');
        }
    };

    const importSolanaVault = async () => {
        if (!solanaPassword || !solanaImportKey) {
            addNotification('Password and Private Key are required');
            return;
        }
        try {
            // Validate and decode key
            const secretKey = decode(solanaImportKey);
            const kp = Keypair.fromSecretKey(secretKey);

            // Encrypt secret key
            const secretKeyArray = Array.from(kp.secretKey);
            const encrypted = await CryptoService.encrypt(JSON.stringify(secretKeyArray), solanaPassword);

            // Save to user-scoped storage
            await StorageService.setItem(StorageService.getUserKey('agent_vault_pubkey'), kp.publicKey.toBase58());
            await StorageService.setItem(StorageService.getUserKey('agent_vault_enc'), encrypted);

            // Update state
            setVault(prev => ({
                ...prev,
                isUnlocked: true,
                publicKey: kp.publicKey.toBase58(),
                encryptedPrivateKey: encrypted
            }));

            setTempKeypair(kp);

            addNotification('Solana Vault imported successfully');
            setIsImportingSolana(false);
            setSolanaImportKey('');
            setSolanaPassword('');
            refreshBalance(kp.publicKey.toBase58());
        } catch (error) {
            console.error('Solana vault import failed', error);
            addNotification('Invalid Private Key or Import Failed');
        }
    };

    const importHyperliquidVault = async () => {
        if (!hyperliquidPassword || !hlImportKey) {
            addNotification('Password and Private Key are required');
            return;
        }
        try {
            // Validate hex private key (should start with 0x)
            let privateKey = hlImportKey.trim();
            if (!privateKey.startsWith('0x')) {
                privateKey = '0x' + privateKey;
            }

            // Create wallet from private key to validate and get address
            const { ethers } = await import('ethers');
            const wallet = new ethers.Wallet(privateKey);

            // Encrypt private key
            const hlEncrypted = await CryptoService.encrypt(privateKey, hyperliquidPassword);

            // Save to user-scoped storage
            await StorageService.setItem(StorageService.getUserKey('agent_hl_vault_pubkey'), wallet.address);
            await StorageService.setItem(StorageService.getUserKey('agent_hl_vault_enc'), hlEncrypted);

            // Update state
            setVault(prev => ({
                ...prev,
                hlPublicKey: wallet.address,
                hlEncryptedPrivateKey: hlEncrypted
            }));

            addNotification('Hyperliquid Vault imported successfully');
            setIsImportingHyperliquid(false);
            setHLImportKey('');
            setHyperliquidPassword('');
            refreshHLBalance(wallet.address);
        } catch (error) {
            console.error('Hyperliquid vault import failed', error);
            addNotification('Invalid Private Key or Import Failed');
        }
    };

    // ============================================
    // POLYMARKET VAULT FUNCTIONS
    // ============================================

    const createPolymarketVault = async () => {
        if (!polymarketPassword) {
            addNotification('Password is required');
            return;
        }
        try {
            // Create EVM wallet for Polymarket (Polygon network)
            const { ethers } = await import('ethers');
            const wallet = ethers.Wallet.createRandom();
            const pmEncrypted = await CryptoService.encrypt(wallet.privateKey, polymarketPassword);

            // Save to user-scoped storage
            await StorageService.setItem(StorageService.getUserKey('agent_pm_vault_pubkey'), wallet.address);
            await StorageService.setItem(StorageService.getUserKey('agent_pm_vault_enc'), pmEncrypted);

            // Update state
            setVault(prev => ({
                ...prev,
                pmPublicKey: wallet.address,
                pmEncryptedPrivateKey: pmEncrypted
            }));

            // Show backup modal
            setPMBackupKey(wallet.privateKey);
            setShowPMBackupModal(true);

            addNotification('Polymarket Vault created successfully');
            setPolymarketPassword('');
            refreshPMBalance(wallet.address);
        } catch (error) {
            console.error('Polymarket vault creation failed', error);
            addNotification('Failed to create Polymarket vault');
        }
    };

    const importPolymarketVault = async () => {
        if (!polymarketPassword || !pmImportKey) {
            addNotification('Password and Private Key are required');
            return;
        }
        try {
            // Validate hex private key (should start with 0x)
            let privateKey = pmImportKey.trim();
            if (!privateKey.startsWith('0x')) {
                privateKey = '0x' + privateKey;
            }

            // Create wallet from private key to validate and get address
            const { ethers } = await import('ethers');
            const wallet = new ethers.Wallet(privateKey);

            // Encrypt private key
            const pmEncrypted = await CryptoService.encrypt(privateKey, polymarketPassword);

            // Save to user-scoped storage
            await StorageService.setItem(StorageService.getUserKey('agent_pm_vault_pubkey'), wallet.address);
            await StorageService.setItem(StorageService.getUserKey('agent_pm_vault_enc'), pmEncrypted);

            // Update state
            setVault(prev => ({
                ...prev,
                pmPublicKey: wallet.address,
                pmEncryptedPrivateKey: pmEncrypted
            }));

            addNotification('Polymarket Vault imported successfully');
            setIsImportingPolymarket(false);
            setPMImportKey('');
            setPolymarketPassword('');
            refreshPMBalance(wallet.address);
        } catch (error) {
            console.error('Polymarket vault import failed', error);
            addNotification('Invalid Private Key or Import Failed');
        }
    };


    const resolveTokenMint = (symbolOrMint: string) => {
        const cleanInput = symbolOrMint.trim();
        // Check if it's a known symbol
        const knownToken = TOKENS.find(t => t.symbol.toUpperCase() === cleanInput.toUpperCase());
        if (knownToken) return knownToken.mint;
        // Otherwise assume it's a Mint Address
        return cleanInput;
    };

    return {
        vault,
        setVault,
        password,
        setPassword,
        withdrawAmount,
        setWithdrawAmount,
        withdrawNetwork,
        setWithdrawNetwork,
        showBackupModal,
        setShowBackupModal,
        backupKey,
        setBackupKey,
        showHLBackupModal,
        setShowHLBackupModal,
        hlBackupKey,
        setHLBackupKey,
        isImporting,
        setIsImporting,
        importKey,
        setImportKey,
        refreshBalance,
        connectOwnerWallet,
        disconnectOwnerWallet,
        connectHLOwnerWallet,
        disconnectHLOwnerWallet,
        createVault,
        unlockVault,
        requestAirdrop,
        handleWithdraw,
        handleWithdrawHL,
        handleWithdrawPM,
        importVault,
        resolveTokenMint,
        refreshHLBalance,
        // Individual Wallet Props
        isImportingSolana,
        setIsImportingSolana,
        isImportingHyperliquid,
        setIsImportingHyperliquid,
        solanaPassword,
        setSolanaPassword,
        hyperliquidPassword,
        setHyperliquidPassword,
        solanaImportKey,
        setSolanaImportKey,
        hlImportKey,
        setHLImportKey,
        createSolanaVault,
        createHyperliquidVault,
        importSolanaVault,
        importHyperliquidVault,
        // Polymarket Vault Props
        isImportingPolymarket,
        setIsImportingPolymarket,
        polymarketPassword,
        setPolymarketPassword,
        pmImportKey,
        setPMImportKey,
        createPolymarketVault,
        importPolymarketVault,
        connectPMOwnerWallet,
        disconnectPMOwnerWallet,
        refreshPMBalance,
        showPMBackupModal,
        setShowPMBackupModal,
        pmBackupKey,
        setPMBackupKey,
        deleteAccount: async () => {
            try {
                await StorageService.clear();
                // Optional: Also sign out of firebase?
                // await firebase.auth().signOut();
                window.location.reload();
            } catch (e) {
                console.error(e);
            }
        }
    };
};
