import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Copy, RefreshCw, Download, Upload, Key, Lock, Unlock, Plus, Trash2, TrendingUp, ShieldCheck, BarChart2, DollarSign, ChevronLeft, PieChart, ArrowRight } from 'lucide-react';
import { PieChart as RechartsPieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { StatCard } from '../shared/StatCard';
import { TOKENS, MOCK_POOL_PRICES } from '../../constants';
import { VaultState, AppTab, VaultTab } from '../../types';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { cn } from '@/lib/utils';


interface VaultProps {
    vault: VaultState;
    password: string;
    setPassword: (pwd: string) => void;
    withdrawAmount: string;
    setWithdrawAmount: (amount: string) => void;
    withdrawNetwork: 'SOL' | 'HYPE' | 'POLY';
    setWithdrawNetwork: (network: 'SOL' | 'HYPE' | 'POLY') => void;
    isImporting: boolean;
    setIsImporting: (isImporting: boolean) => void;
    importKey: string;
    setImportKey: (key: string) => void;
    createVault: () => void;
    unlockVault: () => void;
    requestAirdrop: () => void;
    handleWithdraw: () => void;
    handleWithdrawHL: () => void;
    handleWithdrawPM: () => void;
    importVault: () => void;
    addNotification: (msg: string) => void;
    showBackupModal: boolean;
    showHLBackupModal: boolean;
    showPMBackupModal: boolean;
    // Individual Wallet Props
    isImportingSolana: boolean;
    setIsImportingSolana: (val: boolean) => void;
    isImportingHyperliquid: boolean;
    setIsImportingHyperliquid: (val: boolean) => void;
    isImportingPolymarket: boolean;
    setIsImportingPolymarket: (val: boolean) => void;
    solanaPassword: string;
    setSolanaPassword: (pwd: string) => void;
    hyperliquidPassword: string;
    setHyperliquidPassword: (pwd: string) => void;
    polymarketPassword: string;
    setPolymarketPassword: (pwd: string) => void;
    solanaImportKey: string;
    setSolanaImportKey: (key: string) => void;
    hlImportKey: string;
    setHLImportKey: (key: string) => void;
    pmImportKey: string;
    setPMImportKey: (key: string) => void;
    createSolanaVault: () => void;
    createHyperliquidVault: () => void;
    createPolymarketVault: () => void;
    importSolanaVault: () => void;
    importHyperliquidVault: () => void;
    importPolymarketVault: () => void;
    setActiveTab: (tab: AppTab) => void;
    activeVaultTab: VaultTab;
    setActiveVaultTab: (tab: VaultTab) => void;
    hasCompletedInitialSetup: boolean;
    setHasCompletedInitialSetup: (completed: boolean) => void;
    // Owner Wallet Connection (external wallets for withdrawals)
    connectOwnerWallet: () => void;
    disconnectOwnerWallet: () => void;
    connectHLOwnerWallet: () => void;
    disconnectHLOwnerWallet: () => void;
    connectPMOwnerWallet: () => void;
    disconnectPMOwnerWallet: () => void;
}


export const Vault: React.FC<VaultProps> = ({
    vault,
    password,
    setPassword,
    withdrawAmount,
    setWithdrawAmount,
    withdrawNetwork,
    setWithdrawNetwork,
    isImporting,
    setIsImporting,
    importKey,
    setImportKey,
    createVault,
    unlockVault,
    requestAirdrop,
    handleWithdraw,
    handleWithdrawHL,
    handleWithdrawPM,
    importVault,
    addNotification,
    showBackupModal,
    showHLBackupModal,
    showPMBackupModal,
    isImportingSolana,
    setIsImportingSolana,
    isImportingHyperliquid,
    setIsImportingHyperliquid,
    isImportingPolymarket,
    setIsImportingPolymarket,
    solanaPassword,
    setSolanaPassword,
    hyperliquidPassword,
    setHyperliquidPassword,
    polymarketPassword,
    setPolymarketPassword,
    solanaImportKey,
    setSolanaImportKey,
    hlImportKey,
    setHLImportKey,
    pmImportKey,
    setPMImportKey,
    createSolanaVault,
    createHyperliquidVault,
    createPolymarketVault,
    importSolanaVault,
    importHyperliquidVault,
    importPolymarketVault,
    setActiveTab,
    activeVaultTab,
    setActiveVaultTab,
    hasCompletedInitialSetup,
    setHasCompletedInitialSetup,
    connectOwnerWallet,
    disconnectOwnerWallet,
    connectHLOwnerWallet,
    disconnectHLOwnerWallet,
    connectPMOwnerWallet,
    disconnectPMOwnerWallet
}) => {
    // Tab state managed by App.tsx now
    
    // Handle unlock and redirect
    const handleUnlockAttempt = async () => {
        // We need to cast the result because the prop type might return void in the interface but the implementation returns Promise<boolean>
        // However, since we updated useVault, the actual function returns Promise<boolean>.
        // We should treat it as such. 
        // Note: The VaultProps interface might need updating if we were being strict, but at runtime this works.
        // Let's assume unlockVault returns any or we await it.
        const success = await (unlockVault as any)();
        if (success) {
            setActiveTab(AppTab.DASHBOARD);
        }
    };

    // Calculate total net worth for the top bar
    // Local state for password confirmation
    const [confirmSolanaPass, setConfirmSolanaPass] = useState('');
    const [confirmHyperliquidPass, setConfirmHyperliquidPass] = useState('');
    const [confirmPolymarketPass, setConfirmPolymarketPass] = useState('');

    const handleCreateSolana = () => {
        if (!vault.isUnlocked && solanaPassword !== confirmSolanaPass) {
            addNotification("Passwords do not match");
            return;
        }
        createSolanaVault();
        setConfirmSolanaPass('');
    };

    const handleCreateHyperliquid = () => {
        if (!vault.isUnlocked && hyperliquidPassword !== confirmHyperliquidPass) {
            addNotification("Passwords do not match");
            return;
        }
        createHyperliquidVault();
        setConfirmHyperliquidPass('');
    };

    const handleCreatePolymarket = () => {
        if (!vault.isUnlocked && polymarketPassword !== confirmPolymarketPass) {
            addNotification("Passwords do not match");
            return;
        }
        createPolymarketVault();
        setConfirmPolymarketPass('');
    };

    // Calculate total net worth for the top bar
    const totalNetWorth = useMemo(() => {
        const solVal = (vault.solBalance || 0) * (MOCK_POOL_PRICES.SOL || 0);
        const hlVal = vault.hlBalance || 0;
        const pmVal = vault.pmBalance || 0;
        return solVal + hlVal + pmVal;
    }, [vault.solBalance, vault.hlBalance, vault.pmBalance]);

    // Calculate individual values for pie chart
    const networkValues = useMemo(() => {
        const solVal = (vault.solBalance || 0) * (MOCK_POOL_PRICES.SOL || 0);
        const hlVal = vault.hlBalance || 0;
        const pmVal = vault.pmBalance || 0;
        const total = solVal + hlVal + pmVal;
        return {
            solana: { value: solVal, percent: total > 0 ? (solVal / total) * 100 : 0 },
            hyperliquid: { value: hlVal, percent: total > 0 ? (hlVal / total) * 100 : 0 },
            polymarket: { value: pmVal, percent: total > 0 ? (pmVal / total) * 100 : 0 },
            total
        };
    }, [vault.solBalance, vault.hlBalance, vault.pmBalance]);

    const isLockedOrEmpty = !vault.publicKey && !vault.hlPublicKey || !vault.isUnlocked;

    // Colors for the chart
    const CHART_COLORS = {
        solana: '#E7FE55',
        hyperliquid: '#E7FE55',
        polymarket: '#60a5fa'
    };

    // Interactive Pie Chart using Recharts
    const PieChartComponent = () => {
        const { solana, hyperliquid, polymarket, total } = networkValues;
        const [activeIndex, setActiveIndex] = useState<number | undefined>(undefined);

        // Prepare data for Recharts
        const chartData = useMemo(() => {
            if (total === 0) return [];
            return [
                { name: 'Solana', value: solana.value, percent: solana.percent, color: CHART_COLORS.solana },
                { name: 'Hyperliquid', value: hyperliquid.value, percent: hyperliquid.percent, color: CHART_COLORS.hyperliquid },
                { name: 'Polymarket', value: polymarket.value, percent: polymarket.percent, color: CHART_COLORS.polymarket }
            ].filter(item => item.value > 0);
        }, [solana, hyperliquid, polymarket, total]);

        if (total === 0) {
            return (
                <div className="flex flex-col items-center justify-center h-full">
                    <div className="w-32 h-32 rounded-full bg-[#1a1b21] border-2 border-dashed border-[#232328] flex items-center justify-center">
                        <PieChart size={32} className="text-[#747580]" />
                    </div>
                    <p className="text-[#747580] text-xs mt-4">No assets</p>
                </div>
            );
        }

        const onPieEnter = (_: any, index: number) => {
            setActiveIndex(index);
        };

        const onPieLeave = () => {
            setActiveIndex(undefined);
        };

        return (
            <div className="flex flex-col items-center justify-center h-full w-full gap-4">
                <div className="w-full h-[180px] relative">
                    <ResponsiveContainer width="100%" height="100%">
                        <RechartsPieChart>
                            <defs>
                                {/* Gradient definitions for premium look */}
                                <linearGradient id="solanaGradient" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#E7FE55" stopOpacity={0.8} />
                                    <stop offset="100%" stopColor="#E7FE55" stopOpacity={0.4} />
                                </linearGradient>
                                <linearGradient id="hyperliquidGradient" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#f3ffad" />
                                    <stop offset="100%" stopColor="#E7FE55" />
                                </linearGradient>
                                <linearGradient id="polymarketGradient" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#7db4fb" />
                                    <stop offset="100%" stopColor="#60a5fa" />
                                </linearGradient>
                            </defs>
                            <Pie
                                data={chartData}
                                cx="50%"
                                cy="50%"
                                innerRadius={45}
                                outerRadius={activeIndex !== undefined ? 65 : 70}
                                paddingAngle={3}
                                dataKey="value"
                                onMouseEnter={onPieEnter}
                                onMouseLeave={onPieLeave}
                                animationBegin={0}
                                animationDuration={800}
                                animationEasing="ease-out"
                            >
                                {chartData.map((entry, index) => (
                                    <Cell
                                        key={`cell-${index}`}
                                        fill={entry.color}
                                        stroke={activeIndex === index ? entry.color : 'transparent'}
                                        strokeWidth={activeIndex === index ? 3 : 0}
                                        style={{
                                            cursor: 'pointer',
                                            transition: 'all 0.2s ease-out',
                                            filter: activeIndex === index ? `brightness(1.2) drop-shadow(0 0 8px ${entry.color})` : 'brightness(1)',
                                            transform: activeIndex === index ? 'scale(1.05)' : 'scale(1)',
                                            transformOrigin: 'center'
                                        }}
                                    />
                                ))}
                            </Pie>
                            {/* Center text when hovering */}
                            {activeIndex !== undefined && chartData[activeIndex] && (
                                <g>
                                    <text x="50%" y="45%" textAnchor="middle" fill="#fff" fontSize={13} fontWeight="bold">
                                        {chartData[activeIndex].name}
                                    </text>
                                    <text x="50%" y="55%" textAnchor="middle" fill={chartData[activeIndex].color} fontSize={16} fontWeight="bold" fontFamily="monospace">
                                        ${chartData[activeIndex].value.toFixed(2)}
                                    </text>
                                    <text x="50%" y="65%" textAnchor="middle" fill="#747580" fontSize={10}>
                                        {chartData[activeIndex].percent.toFixed(1)}%
                                    </text>
                                </g>
                            )}
                        </RechartsPieChart>
                    </ResponsiveContainer>
                </div>

                {/* Legend with hover interaction */}
                <div className="flex flex-col gap-2 w-full">
                    {chartData.map((item, index) => (
                        <div
                            key={item.name}
                            className={`flex items-center justify-between p-2 rounded-lg transition-all cursor-pointer ${activeIndex === index
                                ? 'bg-[#232328]'
                                : 'hover:bg-[#1a1b21]'
                                }`}
                            onMouseEnter={() => setActiveIndex(index)}
                            onMouseLeave={() => setActiveIndex(undefined)}
                        >
                            <div className="flex items-center gap-2">
                                <div
                                    className="w-3 h-3 rounded-full transition-transform"
                                    style={{
                                        backgroundColor: item.color,
                                        transform: activeIndex === index ? 'scale(1.3)' : 'scale(1)',
                                        boxShadow: activeIndex === index ? `0 0 8px ${item.color}` : 'none'
                                    }}
                                />
                                <span className={`text-xs transition-colors ${activeIndex === index ? 'text-white' : 'text-[#747580]'
                                    }`}>
                                    {item.name}
                                </span>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className={`text-xs font-mono transition-colors ${activeIndex === index ? 'text-white' : 'text-[#747580]'
                                    }`}>
                                    ${item.value.toFixed(2)}
                                </span>
                                <span
                                    className="text-xs font-mono font-semibold"
                                    style={{ color: item.color }}
                                >
                                    {item.percent.toFixed(1)}%
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    // Fast Withdraw JSX
    const fastWithdrawContent = (
        <div className="glass-panel p-4 flex flex-col h-full">
            <div className="flex items-center gap-2 swiss-label text-[#E7FE55] mb-3">
                <Upload size={14} />
                Fast Withdraw
            </div>

            <div className="flex gap-1 mb-3 bg-[#0f1015] p-1 rounded">
                <button
                    onClick={() => setWithdrawNetwork('SOL')}
                    className={`flex-1 py-1.5 text-[10px] font-semibold uppercase tracking-wider rounded transition-all ${withdrawNetwork === 'SOL' ? 'bg-[#E7FE55] text-black' : 'text-[#747580] hover:text-white'}`}
                >
                    SOL
                </button>
                <button
                    onClick={() => setWithdrawNetwork('HYPE')}
                    className={`flex-1 py-1.5 text-[10px] font-semibold uppercase tracking-wider rounded transition-all ${withdrawNetwork === 'HYPE' ? 'bg-[#E7FE55] text-black' : 'text-[#747580] hover:text-white'}`}
                >
                    HYPE
                </button>
                <button
                    onClick={() => setWithdrawNetwork('POLY')}
                    className={`flex-1 py-1.5 text-[10px] font-semibold uppercase tracking-wider rounded transition-all ${withdrawNetwork === 'POLY' ? 'bg-[#E7FE55] text-black' : 'text-[#747580] hover:text-white'}`}
                >
                    POLY
                </button>
            </div>

            <div className="flex-1 flex flex-col justify-end space-y-3">
                <div>
                    <label className="swiss-label block mb-1.5">Amount</label>
                    <div className="flex items-center relative">
                        <input
                            type="number"
                            value={withdrawAmount}
                            onChange={(e) => setWithdrawAmount(e.target.value)}
                            className={`w-full bg-[#0f1015] border border-[#232328] rounded pl-3 pr-12 py-2.5 text-sm text-white focus:ring-1 outline-none transition-all focus:ring-[#E7FE55]`}
                            placeholder="0.00"
                        />
                        <button
                            onClick={() => {
                                if (withdrawNetwork === 'SOL') setWithdrawAmount(Math.max(0, vault.solBalance - 0.005).toFixed(4));
                                else if (withdrawNetwork === 'HYPE') setWithdrawAmount(Math.max(0, (vault.hlBalance || 0) - 1).toFixed(2));
                                else setWithdrawAmount(Math.max(0, (vault.pmBalance || 0)).toFixed(2));
                            }}
                            className={`absolute right-2 text-[9px] font-semibold px-1.5 py-0.5 rounded bg-[#E7FE55]/20 text-[#E7FE55]`}
                        >
                            MAX
                        </button>
                    </div>
                </div>

                <button
                    onClick={
                        withdrawNetwork === 'SOL' ? handleWithdraw :
                            withdrawNetwork === 'HYPE' ? handleWithdrawHL :
                                handleWithdrawPM
                    }
                    disabled={
                        (withdrawNetwork === 'SOL' && !vault.publicKey) ||
                        (withdrawNetwork === 'HYPE' && !vault.hlPublicKey) ||
                        (withdrawNetwork === 'POLY' && !vault.pmPublicKey)
                    }
                    className={`w-full font-semibold py-2.5 rounded transition-all flex items-center justify-center gap-2 text-xs ${(withdrawNetwork === 'SOL' && vault.publicKey) || (withdrawNetwork === 'HYPE' && vault.hlPublicKey) || (withdrawNetwork === 'POLY' && vault.pmPublicKey) ? 'bg-[#E7FE55] hover:brightness-110 text-black' :
                        'bg-[#1a1b21] text-[#747580] cursor-not-allowed'
                        }`}
                >
                    <Upload size={14} />
                    {withdrawNetwork === 'SOL' ? 'Withdraw SOL' : 'Withdraw USDC'}
                </button>
            </div>
        </div>
    );

    // Solana View JSX
    const solanaViewContent = (
        <div className="flex flex-col gap-6 flex-1">
            {/* Solana Wallet Card */}
            <div className="glass-panel glass-panel-solana p-4">
                <div className="flex items-center gap-2 swiss-label text-[#9b87f5] mb-3">
                    <img src={TOKENS[0].logoURI} alt="SOL" className="w-4 h-4 rounded-full" />
                    Solana Vault
                </div>

                {!vault.publicKey ? (
                    <div className="space-y-3 p-3 bg-[#0f1015] rounded border border-[#232328]">
                        <p className="text-xs text-[#747580]">No Solana wallet found.</p>
                        <input type="password" value={solanaPassword} onChange={(e) => setSolanaPassword(e.target.value)} className="w-full bg-[#14151a] border border-[#232328] rounded px-2 py-1.5 text-xs text-white focus:ring-1 focus:ring-[#9b87f5] outline-none" placeholder="Password..." />
                        {isImportingSolana && (<input type="password" value={solanaImportKey} onChange={(e) => setSolanaImportKey(e.target.value)} className="w-full bg-[#14151a] border border-[#232328] rounded px-2 py-1.5 text-xs text-white focus:ring-1 focus:ring-[#9b87f5] outline-none font-mono" placeholder="Private Key..." />)}
                        <div className="flex gap-2">
                            {isImportingSolana ? (<><button onClick={importSolanaVault} className="flex-1 bg-[#9b87f5] hover:bg-[#a896f7] text-white text-xs font-semibold py-1.5 rounded">Confirm</button><button onClick={() => setIsImportingSolana(false)} className="px-2 py-1.5 text-[#747580] text-xs hover:text-white">Cancel</button></>) : (<><button onClick={createSolanaVault} className="flex-1 bg-[#9b87f5] hover:bg-[#a896f7] text-white text-xs font-semibold py-1.5 rounded flex items-center justify-center gap-1"><Plus size={12} /> New</button><button onClick={() => setIsImportingSolana(true)} className="flex-1 bg-[#1a1b21] hover:bg-[#232328] text-white text-xs font-semibold py-1.5 rounded flex items-center justify-center gap-1 border border-[#232328]"><Download size={12} /> Import</button></>)}
                        </div>
                    </div>
                ) : (
                    <div className="space-y-3">
                        <div className="bg-[#0f1015] p-2 rounded border border-[#232328] flex items-center justify-between">
                            <code className="text-[10px] text-[#747580] font-mono truncate max-w-[200px]">{vault.publicKey}</code>
                            <button onClick={() => { navigator.clipboard.writeText(vault.publicKey!); addNotification("Copied!"); }} className="text-[#747580] hover:text-white"><Copy size={12} /></button>
                        </div>
                        <div className="flex justify-between items-end">
                            <div>
                                <div className="swiss-label">Balance</div>
                                <div className="text-xl font-bold text-white leading-none mt-1">{vault.solBalance.toFixed(4)} <span className="text-xs text-[#747580]">SOL</span></div>
                            </div>
                            <div className="text-xs text-[#9b87f5] font-mono">
                                ≈ ${(vault.solBalance * MOCK_POOL_PRICES.SOL).toFixed(2)}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Solana Assets Table */}
            {vault.publicKey && (
                <div className="glass-panel glass-panel-solana flex flex-col overflow-hidden flex-1">
                    <div className="px-4 py-3 border-b border-[#232328] flex items-center justify-between bg-[#0f1015]/50">
                        <div className="flex items-center gap-2 swiss-label text-[#9b87f5]">
                            <RefreshCw size={12} /> Solana Assets
                        </div>
                        <span className="text-[10px] text-[#747580] font-mono">
                            {vault.assets?.filter(a => !a.isNft && a.symbol !== 'SOL').length || 0} Assets
                        </span>
                    </div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar">
                        <table className="swiss-table w-full">
                            <thead className="sticky top-0 bg-[#0f1015]/90 backdrop-blur-sm">
                                <tr>
                                    <th className="px-4">Asset</th>
                                    <th className="px-4 text-right">Balance</th>
                                    <th className="px-4 text-right">Value</th>
                                </tr>
                            </thead>
                            <tbody>
                                {/* SOL Row */}
                                <tr>
                                    <td className="px-4">
                                        <div className="flex items-center gap-2">
                                            <div className="w-6 h-6 rounded bg-[#1a1b21] flex items-center justify-center">
                                                <img src={TOKENS[0].logoURI} alt="SOL" className="w-4 h-4 rounded-full" />
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-xs font-semibold text-white leading-none">SOL</span>
                                                <span className="text-[9px] text-[#747580]">Native</span>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-4 text-right font-mono text-xs text-slate-300">
                                        {vault.solBalance.toFixed(4)}
                                    </td>
                                    <td className="px-4 text-right font-mono text-xs text-[#9b87f5]">
                                        ${(vault.solBalance * MOCK_POOL_PRICES.SOL).toFixed(2)}
                                    </td>
                                </tr>
                                {/* Other Assets */}
                                {vault.assets && vault.assets.filter(a => !a.isNft && a.symbol !== 'SOL').length > 0 ? (
                                    vault.assets.filter(a => !a.isNft && a.symbol !== 'SOL').map((token, i) => (
                                        <tr key={i}>
                                            <td className="px-4">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-6 h-6 rounded bg-[#1a1b21] flex items-center justify-center text-[10px] font-bold text-[#747580] border border-[#232328]">
                                                        {token.symbol[0]}
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <span className="text-xs font-semibold text-white leading-none">{token.symbol}</span>
                                                        <span className="text-[9px] text-[#747580] truncate max-w-[60px]">{token.name}</span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 text-right font-mono text-xs text-slate-300">
                                                {(parseFloat(token.amount) / Math.pow(10, token.decimals)).toFixed(4)}
                                            </td>
                                            <td className="px-4 text-right font-mono text-xs text-[#34d399]">
                                                {token.symbol !== 'UNKNOWN'
                                                    ? `$${((parseFloat(token.amount) / Math.pow(10, token.decimals)) * (MOCK_POOL_PRICES[token.symbol] || 0)).toFixed(2)}`
                                                    : '-'}
                                            </td>
                                        </tr>
                                    ))
                                ) : null}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );

    // Hyperliquid View JSX
    const hyperliquidViewContent = (
        <div className="flex flex-col gap-6 flex-1">
            {/* Hyperliquid Wallet Card */}
            <div className="glass-panel glass-panel-hyperliquid p-4">
                <div className="flex items-center gap-2 swiss-label text-[#34d399] mb-3">
                    <TrendingUp size={14} />
                    Hyperliquid Vault
                </div>

                {!vault.hlPublicKey ? (
                    <div className="space-y-3 p-3 bg-[#0f1015] rounded border border-[#232328]">
                        <p className="text-xs text-[#747580]">No Hyperliquid wallet found.</p>
                        <input type="password" value={hyperliquidPassword} onChange={(e) => setHyperliquidPassword(e.target.value)} className="w-full bg-[#14151a] border border-[#232328] rounded px-2 py-1.5 text-xs text-white focus:ring-1 focus:ring-[#E7FE55] outline-none" placeholder="Password..." />
                        {isImportingHyperliquid && (<input type="password" value={hlImportKey} onChange={(e) => setHLImportKey(e.target.value)} className="w-full bg-[#14151a] border border-[#232328] rounded px-2 py-1.5 text-xs text-white focus:ring-1 focus:ring-[#E7FE55] outline-none font-mono" placeholder="PrivKey (0x...)..." />)}
                        <div className="flex gap-2">
                            {isImportingHyperliquid ? (<><button onClick={importHyperliquidVault} className="flex-1 bg-[#E7FE55] hover:brightness-110 text-black text-xs font-semibold py-1.5 rounded">Confirm</button><button onClick={() => setIsImportingHyperliquid(false)} className="px-2 py-1.5 text-[#747580] text-xs hover:text-white">Cancel</button></>) : (<><button onClick={createHyperliquidVault} className="flex-1 bg-[#E7FE55] hover:brightness-110 text-black text-xs font-semibold py-1.5 rounded flex items-center justify-center gap-1"><Plus size={12} /> New</button><button onClick={() => setIsImportingHyperliquid(true)} className="flex-1 bg-[#1a1b21] hover:bg-[#232328] text-white text-xs font-semibold py-1.5 rounded flex items-center justify-center gap-1 border border-[#232328]"><Download size={12} /> Import</button></>)}
                        </div>
                    </div>
                ) : (
                    <div className="space-y-3">
                        <div className="bg-[#0f1015] p-2 rounded border border-[#232328] flex items-center justify-between">
                            <code className="text-[10px] text-[#747580] font-mono truncate max-w-[200px]">{vault.hlPublicKey}</code>
                            <button onClick={() => { if (vault.hlPublicKey) { navigator.clipboard.writeText(vault.hlPublicKey); addNotification("Copied!"); } }} className="text-[#747580] hover:text-white"><Copy size={12} /></button>
                        </div>
                        <div className="flex justify-between items-end">
                            <div>
                                <div className="swiss-label">Balance</div>
                                <div className="text-xl font-bold text-white leading-none mt-1">{vault.hlBalance?.toFixed(2) || '0.00'} <span className="text-xs text-[#747580]">USDC</span></div>
                            </div>
                            <div className="text-xs text-[#E7FE55] font-mono">Testnet</div>
                        </div>
                    </div>
                )}
            </div>

            {/* Hyperliquid Positions Table */}
            {vault.hlPublicKey && (
                <div className="glass-panel glass-panel-hyperliquid flex flex-col overflow-hidden flex-1">
                    <div className="px-4 py-3 border-b border-[#232328] flex items-center justify-between bg-[#0f1015]/50">
                        <div className="flex items-center gap-2 swiss-label text-[#34d399]">
                            <TrendingUp size={12} /> Active Positions
                        </div>
                        <div className="flex items-center gap-3">
                            <span className="text-[10px] text-[#747580] font-mono">
                                {vault.hlPositions?.filter(pos => parseFloat(pos.position.szi) !== 0).length || 0} Open
                            </span>
                            <button
                                onClick={() => setActiveTab(AppTab.HYPERLIQUID)}
                                className="text-[10px] bg-[#E7FE55]/15 hover:bg-[#E7FE55]/25 text-[#E7FE55] border border-[#E7FE55]/30 px-2 py-1 rounded transition-colors flex items-center gap-1"
                            >
                                <TrendingUp size={10} />
                                Details
                            </button>
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar">
                        <table className="swiss-table w-full">
                            <thead className="sticky top-0 bg-[#0f1015]/90 backdrop-blur-sm">
                                <tr>
                                    <th className="px-3">Ticker</th>
                                    <th className="px-3">Side</th>
                                    <th className="px-3 text-right">Size</th>
                                    <th className="px-3 text-right">PnL</th>
                                </tr>
                            </thead>
                            <tbody>
                                {vault.hlPositions && vault.hlPositions.filter(pos => parseFloat(pos.position.szi) !== 0).length > 0 ? (
                                    vault.hlPositions.filter(pos => parseFloat(pos.position.szi) !== 0).map((pos, i) => {
                                        const size = parseFloat(pos.position.szi);
                                        const isLong = size > 0;
                                        const pnl = parseFloat(pos.position.unrealizedPnl || '0');
                                        return (
                                            <tr key={`hl-${i}`}>
                                                <td className="px-3">
                                                    <span className="text-xs font-semibold text-white">{pos.position.coin}</span>
                                                </td>
                                                <td className="px-3">
                                                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${isLong ? 'bg-[#34d399]/15 text-[#34d399]' : 'bg-red-500/15 text-red-400'}`}>
                                                        {isLong ? 'LONG' : 'SHORT'}
                                                    </span>
                                                </td>
                                                <td className="px-3 text-right font-mono text-xs text-slate-300">
                                                    {Math.abs(size).toFixed(4)}
                                                </td>
                                                <td className={`px-3 text-right font-mono text-xs font-semibold ${pnl >= 0 ? 'text-[#34d399]' : 'text-red-400'}`}>
                                                    {pnl >= 0 ? '+' : ''}{pnl.toFixed(2)}
                                                </td>
                                            </tr>
                                        );
                                    })
                                ) : (
                                    <tr>
                                        <td colSpan={4} className="px-4 py-8 text-center text-[#747580] text-xs italic">
                                            No active positions.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );

    // Polymarket View JSX
    const polymarketViewContent = (
        <div className="flex flex-col gap-6 flex-1">
            {/* Polymarket Wallet Card */}
            <div className="glass-panel glass-panel-polymarket p-4">
                <div className="flex items-center gap-2 swiss-label text-[#60a5fa] mb-3">
                    <BarChart2 size={14} />
                    Polymarket Vault
                </div>

                {!vault.pmPublicKey ? (
                    <div className="space-y-3 p-3 bg-[#0f1015] rounded border border-[#232328]">
                        <p className="text-xs text-[#747580]">No Polymarket wallet found.</p>
                        <input type="password" value={polymarketPassword} onChange={(e) => setPolymarketPassword(e.target.value)} className="w-full bg-[#14151a] border border-[#232328] rounded px-2 py-1.5 text-xs text-white focus:ring-1 focus:ring-[#60a5fa] outline-none" placeholder="Password..." />
                        {isImportingPolymarket && (<input type="password" value={pmImportKey} onChange={(e) => setPMImportKey(e.target.value)} className="w-full bg-[#14151a] border border-[#232328] rounded px-2 py-1.5 text-xs text-white focus:ring-1 focus:ring-[#60a5fa] outline-none font-mono" placeholder="PrivKey (0x...)..." />)}
                        <div className="flex gap-2">
                            {isImportingPolymarket ? (<><button onClick={importPolymarketVault} className="flex-1 bg-[#60a5fa] hover:bg-[#7db4fb] text-white text-xs font-semibold py-1.5 rounded">Confirm</button><button onClick={() => setIsImportingPolymarket(false)} className="px-2 py-1.5 text-[#747580] text-xs hover:text-white">Cancel</button></>) : (<><button onClick={createPolymarketVault} className="flex-1 bg-[#60a5fa] hover:bg-[#7db4fb] text-white text-xs font-semibold py-1.5 rounded flex items-center justify-center gap-1"><Plus size={12} /> New</button><button onClick={() => setIsImportingPolymarket(true)} className="flex-1 bg-[#1a1b21] hover:bg-[#232328] text-white text-xs font-semibold py-1.5 rounded flex items-center justify-center gap-1 border border-[#232328]"><Download size={12} /> Import</button></>)}
                        </div>
                    </div>
                ) : (
                    <div className="space-y-3">
                        <div className="bg-[#0f1015] p-2 rounded border border-[#232328] flex items-center justify-between">
                            <code className="text-[10px] text-[#747580] font-mono truncate max-w-[200px]">{vault.pmPublicKey}</code>
                            <button onClick={() => { if (vault.pmPublicKey) { navigator.clipboard.writeText(vault.pmPublicKey); addNotification("Copied!"); } }} className="text-[#747580] hover:text-white"><Copy size={12} /></button>
                        </div>
                        <div className="flex justify-between items-end">
                            <div>
                                <div className="swiss-label">Balance</div>
                                <div className="text-xl font-bold text-white leading-none mt-1">{vault.pmBalance?.toFixed(2) || '0.00'} <span className="text-xs text-[#747580]">USDC</span></div>
                            </div>
                            <div className="text-xs text-[#60a5fa] font-mono">Polygon</div>
                        </div>
                    </div>
                )}
            </div>

            {/* Polymarket Info Card */}
            {vault.pmPublicKey && (
                <div className="glass-panel glass-panel-polymarket flex flex-col overflow-hidden flex-1">
                    <div className="px-4 py-3 border-b border-[#232328] flex items-center justify-between bg-[#0f1015]/50">
                        <div className="flex items-center gap-2 swiss-label text-[#60a5fa]">
                            <BarChart2 size={12} /> Market Positions
                        </div>
                        <button
                            onClick={() => setActiveTab(AppTab.POLYMARKET_DASHBOARD)}
                            className="text-[10px] bg-[#60a5fa]/15 hover:bg-[#60a5fa]/25 text-[#60a5fa] border border-[#60a5fa]/30 px-2 py-1 rounded transition-colors flex items-center gap-1"
                        >
                            <BarChart2 size={10} />
                            Details
                        </button>
                    </div>
                    <div className="flex-1 flex items-center justify-center p-8">
                        <p className="text-xs text-[#747580] text-center">
                            View your Polymarket positions in the Polymarket Dealer dashboard.
                        </p>
                    </div>
                </div>
            )}
        </div>
    );

    // Main View JSX
    const mainViewContent = (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 flex-1">
            {/* Asset Allocation Pie Chart */}
            <div className="glass-panel p-4 flex flex-col">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2 swiss-label text-white">
                        <PieChart size={14} />
                        Asset Allocation
                    </div>
                    <div className="text-right">
                        <div className="text-[10px] text-[#747580] uppercase tracking-wider">Net Worth</div>
                        <div className="text-lg font-bold font-mono text-white">
                            ${totalNetWorth.toFixed(2)}
                        </div>
                    </div>
                </div>
                <div className="flex-1 flex items-center justify-center min-h-[200px]">
                    <PieChartComponent />
                </div>
            </div>

            {/* Fast Withdraw */}
            {fastWithdrawContent}
        </div>
    );

    return (
        <div className="h-full flex flex-col gap-6 overflow-y-auto custom-scrollbar p-1">


            {/* Main Content Area */}
            {/* Show configuration view if:
                1. User hasn't completed initial setup, OR
                2. Backup modals are open, OR
                3. No wallets exist at all (fixes bug where Vault Locked appears before wallet creation)
            */}
            {!hasCompletedInitialSetup || showBackupModal || showHLBackupModal || showPMBackupModal || (!vault.publicKey && !vault.hlPublicKey && !vault.pmPublicKey) ? (
                // --- CREATE / IMPORT VIEW - INDEPENDENT WALLETS ---
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                    className="max-w-6xl mx-auto relative z-10 flex flex-col items-center justify-center flex-1 py-8"
                >
                    {/* Header with Icon and Title */}
                    <motion.div
                        initial={{ scale: 0.8 }}
                        animate={{ scale: 1 }}
                        transition={{ type: "spring", stiffness: 200, damping: 20 }}
                        className="w-20 h-20 rounded-full flex items-center justify-center mb-6 border border-slate-700/50 bg-[#0f172a]/50 backdrop-blur-sm relative group"
                    >
                        <div className="absolute inset-0 bg-[#E7FE55]/5 rounded-full blur-xl group-hover:bg-[#E7FE55]/10 transition-colors" />
                        <ShieldCheck size={36} className="text-[#E7FE55] relative z-10" />
                    </motion.div>
                    
                    <h2 className="text-4xl font-bold text-white mb-3 text-center tracking-tight">Configure Your Vault</h2>
                    <p className="text-slate-400 text-center mb-10 text-base max-w-2xl">
                        Set up your non-custodial wallets across multiple networks. Your keys, your control.
                    </p>

                    {/* Progress Indicator */}
                    <div className="w-full max-w-4xl mb-8 glass-panel rounded p-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-[#E7FE55]/10 border border-[#E7FE55]/30 flex items-center justify-center">
                                    <span className="text-[#E7FE55] font-bold text-sm">
                                        {(vault.publicKey ? 1 : 0) + (vault.hlPublicKey ? 1 : 0) + (vault.pmPublicKey ? 1 : 0)}/3
                                    </span>
                                </div>
                                <div>
                                    <p className="text-white font-semibold text-sm">Networks Configured</p>
                                    <p className="text-slate-500 text-xs">
                                        {vault.publicKey || vault.hlPublicKey || vault.pmPublicKey 
                                            ? "Add more networks or continue to app" 
                                            : "Start by configuring at least one network"}
                                    </p>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                {vault.publicKey && <div className="w-2 h-2 rounded-full bg-[#9b87f5]" title="Solana" />}
                                {vault.hlPublicKey && <div className="w-2 h-2 rounded-full bg-[#34d399]" title="Hyperliquid" />}
                                {vault.pmPublicKey && <div className="w-2 h-2 rounded-full bg-[#60a5fa]" title="Polymarket" />}
                            </div>
                        </div>
                    </div>

                    {/* Network Cards Grid */}
                    <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                        {/* Solana Card */}
                        <div className={cn(
                            "glass-panel-solana p-6 space-y-4 transition-all duration-300 rounded",
                            vault.publicKey && "ring-2 ring-[#9b87f5]/30"
                        )}>
                            {/* Status Badge */}
                            {vault.publicKey && (
                                <div className="absolute top-3 right-3 w-6 h-6 rounded-full bg-[#E7FE55] flex items-center justify-center">
                                    <svg className="w-4 h-4 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                    </svg>
                                </div>
                            )}

                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-12 h-12 bg-[#9b87f5]/10 rounded-lg flex items-center justify-center border border-[#9b87f5]/20">
                                    <img src={TOKENS[0].logoURI} alt="SOL" className="w-6 h-6 rounded-full" />
                                </div>
                                <div>
                                    <h3 className="text-white font-bold text-lg">Solana</h3>
                                    <span className="text-[10px] text-[#9b87f5] uppercase tracking-wider font-semibold">Devnet</span>
                                </div>
                            </div>

                            {vault.publicKey ? (
                                <div className="space-y-3">
                                    <div className="bg-[#0f1015]/50 border border-slate-700/30 rounded-lg p-3">
                                        <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Vault Address</p>
                                        <code className="text-xs text-slate-300 font-mono">
                                            {vault.publicKey.slice(0, 8)}...{vault.publicKey.slice(-8)}
                                        </code>
                                    </div>
                                    
                                    {/* Owner Wallet Section */}
                                    <div className="bg-[#0f1015]/50 border border-slate-700/30 rounded-lg p-3">
                                        <div className="flex items-center justify-between mb-2">
                                            <p className="text-[10px] text-slate-500 uppercase tracking-wider">Owner Wallet</p>
                                        </div>
                                        {vault.ownerPublicKey ? (
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-[#E7FE55]" />
                                                    <code className="text-xs text-slate-300 font-mono">
                                                        {vault.ownerPublicKey.slice(0, 4)}...{vault.ownerPublicKey.slice(-4)}
                                                    </code>
                                                </div>
                                                <button
                                                    onClick={disconnectOwnerWallet}
                                                    className="px-2 py-1 text-[10px] font-medium text-[#747580] hover:text-[#E7FE55] bg-transparent hover:bg-[#E7FE55]/10 rounded border border-[#232328] hover:border-[#E7FE55]/30 transition-colors"
                                                >
                                                    Disconnect
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="flex items-center justify-between">
                                                <span className="text-[10px] text-[#747580] italic">Not connected</span>
                                                <button
                                                    onClick={connectOwnerWallet}
                                                    className="px-2 py-1 text-[10px] font-medium text-[#E7FE55] hover:text-[#f0ff85] bg-[#E7FE55]/10 hover:bg-[#E7FE55]/20 rounded border border-[#E7FE55]/20 transition-colors"
                                                >
                                                    Connect
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex items-center gap-2 text-[#9b87f5] text-sm">
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                        <span className="text-xs font-medium">Configured</span>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    {vault.isUnlocked ? (
                                        <div className="bg-[#0f1015]/80 border border-[#232328] rounded-lg px-4 py-3 flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <Lock size={14} className="text-[#9b87f5]" />
                                                <span className="text-sm text-slate-400 italic">Using main vault password</span>
                                            </div>
                                            <div className="w-2 h-2 rounded-full bg-[#9b87f5] animate-pulse" />
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            <input
                                                type="password"
                                                value={solanaPassword}
                                                onChange={(e) => setSolanaPassword(e.target.value)}
                                                className="w-full bg-[#0f1015]/80 border border-[#232328] rounded-lg px-4 py-3 text-white text-sm focus:ring-2 focus:ring-[#9b87f5]/50 focus:border-[#9b87f5]/50 outline-none transition-all placeholder:text-slate-500"
                                                placeholder="Enter password"
                                            />
                                            <input
                                                type="password"
                                                value={confirmSolanaPass}
                                                onChange={(e) => setConfirmSolanaPass(e.target.value)}
                                                className="w-full bg-[#0f1015]/80 border border-[#232328] rounded-lg px-4 py-3 text-white text-sm focus:ring-2 focus:ring-[#9b87f5]/50 focus:border-[#9b87f5]/50 outline-none transition-all placeholder:text-slate-500"
                                                placeholder="Confirm password"
                                            />
                                        </div>
                                    )}
                                    <p className="text-[10px] text-slate-500 text-center px-1">
                                        For security consistency, all wallets in this vault must share the same password.
                                    </p>

                                    {isImportingSolana && (
                                        <input
                                            type="password"
                                            value={solanaImportKey}
                                            onChange={(e) => setSolanaImportKey(e.target.value)}
                                            className="w-full bg-[#0f1015]/80 border border-[#232328] rounded-lg px-4 py-3 text-white text-sm focus:ring-2 focus:ring-[#9b87f5]/50 focus:border-[#9b87f5]/50 outline-none transition-all font-mono placeholder:text-slate-500"
                                            placeholder="Private key (Base58)"
                                        />
                                    )}

                                    <div className="flex gap-2">
                                        {isImportingSolana ? (
                                            <>
                                                <button onClick={importSolanaVault} className="flex-1 bg-[#9b87f5] hover:bg-[#a896f7] text-white font-bold py-3 rounded-lg transition-all flex items-center justify-center gap-2 text-xs uppercase tracking-wider shadow-lg shadow-[#9b87f5]/20">
                                                    <Download size={16} /> Import
                                                </button>
                                                <button onClick={() => setIsImportingSolana(false)} className="px-4 py-3 text-slate-400 hover:text-white text-xs font-semibold transition-colors">
                                                    Cancel
                                                </button>
                                            </>
                                        ) : (
                                            <>
                                                <button onClick={handleCreateSolana} className="flex-1 bg-[#9b87f5] hover:bg-[#a896f7] text-white font-bold py-3 rounded-lg transition-all flex items-center justify-center gap-2 text-xs uppercase tracking-wider shadow-lg shadow-[#9b87f5]/20">
                                                    <Plus size={16} /> Create
                                                </button>
                                                <button onClick={() => setIsImportingSolana(true)} className="flex-1 bg-[#1a1b21] hover:bg-[#232328] text-white font-bold py-3 rounded-lg transition-all flex items-center justify-center gap-2 text-xs uppercase tracking-wider border border-[#232328]">
                                                    <Download size={16} /> Import
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Hyperliquid Card */}
                        <div className={cn(
                            "glass-panel-hyperliquid p-6 space-y-4 transition-all duration-300 rounded",
                            vault.hlPublicKey && "ring-2 ring-[#34d399]/30"
                        )}>
                            {/* Status Badge */}
                            {vault.hlPublicKey && (
                                <div className="absolute top-3 right-3 w-6 h-6 rounded-full bg-[#E7FE55] flex items-center justify-center">
                                    <svg className="w-4 h-4 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                    </svg>
                                </div>
                            )}

                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-12 h-12 bg-[#34d399]/10 rounded-lg flex items-center justify-center border border-[#34d399]/20">
                                    <TrendingUp size={24} className="text-[#34d399]" />
                                </div>
                                <div>
                                    <h3 className="text-white font-bold text-lg">Hyperliquid</h3>
                                    <span className="text-[10px] text-[#34d399] uppercase tracking-wider font-semibold">Testnet</span>
                                </div>
                            </div>

                            {vault.hlPublicKey ? (
                                <div className="space-y-3">
                                    <div className="bg-[#0f1015]/50 border border-slate-700/30 rounded-lg p-3">
                                        <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Vault Address</p>
                                        <code className="text-xs text-slate-300 font-mono">
                                            {vault.hlPublicKey.slice(0, 8)}...{vault.hlPublicKey.slice(-8)}
                                        </code>
                                    </div>
                                    
                                    {/* Owner Wallet Section */}
                                    <div className="bg-[#0f1015]/50 border border-slate-700/30 rounded-lg p-3">
                                        <div className="flex items-center justify-between mb-2">
                                            <p className="text-[10px] text-slate-500 uppercase tracking-wider">Owner Wallet</p>
                                        </div>
                                        {vault.hlOwnerPublicKey ? (
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-[#E7FE55]" />
                                                    <code className="text-xs text-slate-300 font-mono">
                                                        {vault.hlOwnerPublicKey.slice(0, 4)}...{vault.hlOwnerPublicKey.slice(-4)}
                                                    </code>
                                                </div>
                                                <button
                                                    onClick={disconnectHLOwnerWallet}
                                                    className="px-2 py-1 text-[10px] font-medium text-[#747580] hover:text-[#E7FE55] bg-transparent hover:bg-[#E7FE55]/10 rounded border border-[#232328] hover:border-[#E7FE55]/30 transition-colors"
                                                >
                                                    Disconnect
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="flex items-center justify-between">
                                                <span className="text-[10px] text-[#747580] italic">Not connected</span>
                                                <button
                                                    onClick={connectHLOwnerWallet}
                                                    className="px-2 py-1 text-[10px] font-medium text-[#E7FE55] hover:text-[#f0ff85] bg-[#E7FE55]/10 hover:bg-[#E7FE55]/20 rounded border border-[#E7FE55]/20 transition-colors"
                                                >
                                                    Connect
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex items-center gap-2 text-[#34d399] text-sm">
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                        <span className="text-xs font-medium">Configured</span>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    {vault.isUnlocked ? (
                                        <div className="bg-[#0f1015]/80 border border-[#232328] rounded-lg px-4 py-3 flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <Lock size={14} className="text-[#34d399]" />
                                                <span className="text-sm text-slate-400 italic">Using main vault password</span>
                                            </div>
                                            <div className="w-2 h-2 rounded-full bg-[#34d399] animate-pulse" />
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            <input
                                                type="password"
                                                value={hyperliquidPassword}
                                                onChange={(e) => setHyperliquidPassword(e.target.value)}
                                                className="w-full bg-[#0f1015]/80 border border-[#232328] rounded-lg px-4 py-3 text-white text-sm focus:ring-2 focus:ring-[#34d399]/50 focus:border-[#34d399]/50 outline-none transition-all placeholder:text-slate-500"
                                                placeholder="Enter password"
                                            />
                                            <input
                                                type="password"
                                                value={confirmHyperliquidPass}
                                                onChange={(e) => setConfirmHyperliquidPass(e.target.value)}
                                                className="w-full bg-[#0f1015]/80 border border-[#232328] rounded-lg px-4 py-3 text-white text-sm focus:ring-2 focus:ring-[#34d399]/50 focus:border-[#34d399]/50 outline-none transition-all placeholder:text-slate-500"
                                                placeholder="Confirm password"
                                            />
                                        </div>
                                    )}
                                    <p className="text-[10px] text-slate-500 text-center px-1">
                                        For security consistency, all wallets in this vault must share the same password.
                                    </p>

                                    {isImportingHyperliquid && (
                                        <input
                                            type="password"
                                            value={hlImportKey}
                                            onChange={(e) => setHLImportKey(e.target.value)}
                                            className="w-full bg-[#0f1015]/80 border border-[#232328] rounded-lg px-4 py-3 text-white text-sm focus:ring-2 focus:ring-[#34d399]/50 focus:border-[#34d399]/50 outline-none transition-all font-mono placeholder:text-slate-500"
                                            placeholder="Private key (0x...)"
                                        />
                                    )}

                                    <div className="flex gap-2">
                                        {isImportingHyperliquid ? (
                                            <>
                                                <button onClick={importHyperliquidVault} className="flex-1 bg-[#34d399] hover:bg-[#4ade80] text-white font-bold py-3 rounded-lg transition-all flex items-center justify-center gap-2 text-xs uppercase tracking-wider shadow-lg shadow-[#34d399]/20">
                                                    <Download size={16} /> Import
                                                </button>
                                                <button onClick={() => setIsImportingHyperliquid(false)} className="px-4 py-3 text-slate-400 hover:text-white text-xs font-semibold transition-colors">
                                                    Cancel
                                                </button>
                                            </>
                                        ) : (
                                            <>
                                                <button onClick={handleCreateHyperliquid} className="flex-1 bg-[#34d399] hover:bg-[#4ade80] text-white font-bold py-3 rounded-lg transition-all flex items-center justify-center gap-2 text-xs uppercase tracking-wider shadow-lg shadow-[#34d399]/20">
                                                    <Plus size={16} /> Create
                                                </button>
                                                <button onClick={() => setIsImportingHyperliquid(true)} className="flex-1 bg-[#1a1b21] hover:bg-[#232328] text-white font-bold py-3 rounded-lg transition-all flex items-center justify-center gap-2 text-xs uppercase tracking-wider border border-[#232328]">
                                                    <Download size={16} /> Import
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Polymarket Card */}
                        <div className={cn(
                            "glass-panel-polymarket p-6 space-y-4 transition-all duration-300 rounded",
                            vault.pmPublicKey && "ring-2 ring-[#60a5fa]/30"
                        )}>
                            {/* Status Badge */}
                            {vault.pmPublicKey && (
                                <div className="absolute top-3 right-3 w-6 h-6 rounded-full bg-[#E7FE55] flex items-center justify-center">
                                    <svg className="w-4 h-4 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                    </svg>
                                </div>
                            )}

                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-12 h-12 bg-[#60a5fa]/10 rounded-lg flex items-center justify-center border border-[#60a5fa]/20">
                                    <BarChart2 size={24} className="text-[#60a5fa]" />
                                </div>
                                <div>
                                    <h3 className="text-white font-bold text-lg">Polymarket</h3>
                                    <span className="text-[10px] text-[#60a5fa] uppercase tracking-wider font-semibold">Polygon</span>
                                </div>
                            </div>

                            {vault.pmPublicKey ? (
                                <div className="space-y-3">
                                    <div className="bg-[#0f1015]/50 border border-slate-700/30 rounded-lg p-3">
                                        <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Vault Address</p>
                                        <code className="text-xs text-slate-300 font-mono">
                                            {vault.pmPublicKey.slice(0, 8)}...{vault.pmPublicKey.slice(-8)}
                                        </code>
                                    </div>
                                    
                                    {/* Owner Wallet Section */}
                                    <div className="bg-[#0f1015]/50 border border-slate-700/30 rounded-lg p-3">
                                        <div className="flex items-center justify-between mb-2">
                                            <p className="text-[10px] text-slate-500 uppercase tracking-wider">Owner Wallet</p>
                                        </div>
                                        {vault.pmOwnerPublicKey ? (
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-[#E7FE55]" />
                                                    <code className="text-xs text-slate-300 font-mono">
                                                        {vault.pmOwnerPublicKey.slice(0, 4)}...{vault.pmOwnerPublicKey.slice(-4)}
                                                    </code>
                                                </div>
                                                <button
                                                    onClick={disconnectPMOwnerWallet}
                                                    className="px-2 py-1 text-[10px] font-medium text-[#747580] hover:text-[#E7FE55] bg-transparent hover:bg-[#E7FE55]/10 rounded border border-[#232328] hover:border-[#E7FE55]/30 transition-colors"
                                                >
                                                    Disconnect
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="flex items-center justify-between">
                                                <span className="text-[10px] text-[#747580] italic">Not connected</span>
                                                <button
                                                    onClick={connectPMOwnerWallet}
                                                    className="px-2 py-1 text-[10px] font-medium text-[#E7FE55] hover:text-[#f0ff85] bg-[#E7FE55]/10 hover:bg-[#E7FE55]/20 rounded border border-[#E7FE55]/20 transition-colors"
                                                >
                                                    Connect
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex items-center gap-2 text-[#60a5fa] text-sm">
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                        <span className="text-xs font-medium">Configured</span>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    {vault.isUnlocked ? (
                                        <div className="bg-[#0f1015]/80 border border-[#232328] rounded-lg px-4 py-3 flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <Lock size={14} className="text-[#60a5fa]" />
                                                <span className="text-sm text-slate-400 italic">Using main vault password</span>
                                            </div>
                                            <div className="w-2 h-2 rounded-full bg-[#60a5fa] animate-pulse" />
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            <input
                                                type="password"
                                                value={polymarketPassword}
                                                onChange={(e) => setPolymarketPassword(e.target.value)}
                                                className="w-full bg-[#0f1015]/80 border border-[#232328] rounded-lg px-4 py-3 text-white text-sm focus:ring-2 focus:ring-[#60a5fa]/50 focus:border-[#60a5fa]/50 outline-none transition-all placeholder:text-slate-500"
                                                placeholder="Enter password"
                                            />
                                            <input
                                                type="password"
                                                value={confirmPolymarketPass}
                                                onChange={(e) => setConfirmPolymarketPass(e.target.value)}
                                                className="w-full bg-[#0f1015]/80 border border-[#232328] rounded-lg px-4 py-3 text-white text-sm focus:ring-2 focus:ring-[#60a5fa]/50 focus:border-[#60a5fa]/50 outline-none transition-all placeholder:text-slate-500"
                                                placeholder="Confirm password"
                                            />
                                        </div>
                                    )}
                                    <p className="text-[10px] text-slate-500 text-center px-1">
                                        For security consistency, all wallets in this vault must share the same password.
                                    </p>

                                    {isImportingPolymarket && (
                                        <input
                                            type="password"
                                            value={pmImportKey}
                                            onChange={(e) => setPMImportKey(e.target.value)}
                                            className="w-full bg-[#0f1015]/80 border border-[#232328] rounded-lg px-4 py-3 text-white text-sm focus:ring-2 focus:ring-[#60a5fa]/50 focus:border-[#60a5fa]/50 outline-none transition-all font-mono placeholder:text-slate-500"
                                            placeholder="Private key (0x...)"
                                        />
                                    )}

                                    <div className="flex gap-2">
                                        {isImportingPolymarket ? (
                                            <>
                                                <button onClick={importPolymarketVault} className="flex-1 bg-[#60a5fa] hover:bg-[#7db4fb] text-white font-bold py-3 rounded-lg transition-all flex items-center justify-center gap-2 text-xs uppercase tracking-wider shadow-lg shadow-[#60a5fa]/20">
                                                    <Download size={16} /> Import
                                                </button>
                                                <button onClick={() => setIsImportingPolymarket(false)} className="px-4 py-3 text-slate-400 hover:text-white text-xs font-semibold transition-colors">
                                                    Cancel
                                                </button>
                                            </>
                                        ) : (
                                            <>
                                                <button onClick={handleCreatePolymarket} className="flex-1 bg-[#60a5fa] hover:bg-[#7db4fb] text-white font-bold py-3 rounded-lg transition-all flex items-center justify-center gap-2 text-xs uppercase tracking-wider shadow-lg shadow-[#60a5fa]/20">
                                                    <Plus size={16} /> Create
                                                </button>
                                                <button onClick={() => setIsImportingPolymarket(true)} className="flex-1 bg-[#1a1b21] hover:bg-[#232328] text-white font-bold py-3 rounded-lg transition-all flex items-center justify-center gap-2 text-xs uppercase tracking-wider border border-[#232328]">
                                                    <Download size={16} /> Import
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Footer Section */}
                    <div className="w-full max-w-4xl space-y-4">
                        {/* Go to App Button - Only show when at least one wallet is configured */}
                        {(vault.publicKey || vault.hlPublicKey || vault.pmPublicKey) && (
                            <motion.button
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.2 }}
                                onClick={() => {
                                    setHasCompletedInitialSetup(true);
                                    setActiveTab(AppTab.AGENT);
                                }}
                                className="w-full bg-[#E7FE55] hover:brightness-110 active:scale-[0.98] text-black font-bold py-4 rounded transition-all flex items-center justify-center gap-3 text-sm uppercase tracking-widest shadow-xl shadow-[#E7FE55]/20"
                            >
                                <ArrowRight size={20} />
                                Go to App
                            </motion.button>
                        )}

                        {/* Owner Wallet Disclaimer */}
                        <div className="glass-panel p-4 border border-[#E7FE55]/20 bg-gradient-to-br from-[#E7FE55]/5 to-transparent">
                            <div className="flex items-start gap-3">
                                <div className="w-6 h-6 rounded-lg bg-[#E7FE55]/10 border border-[#E7FE55]/30 flex items-center justify-center flex-shrink-0">
                                    <Key size={14} className="text-[#E7FE55]" />
                                </div>
                                <p className="text-slate-400 text-xs leading-relaxed">
                                    <span className="text-white font-semibold">Only the connected Owner Wallet</span> can receive automated withdrawals from the vault. Connect your external wallet (Phantom/MetaMask) after creating the vault.
                                </p>
                            </div>
                        </div>
                        
                        {/* Security Notice */}
                        <div className="bg-amber-500/5 border border-amber-500/20 rounded p-4">
                            <div className="flex items-start gap-3">
                                <div className="w-5 h-5 rounded-full bg-amber-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                                    <svg className="w-3 h-3 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                    </svg>
                                </div>
                                <div>
                                    <p className="text-amber-200 font-semibold text-sm mb-1">Security Notice</p>
                                    <p className="text-amber-200/70 text-xs leading-relaxed">
                                        Your wallets are encrypted and stored locally on your device. Never share your private keys or passwords with anyone. You are solely responsible for keeping your credentials secure.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </motion.div>
            ) : !vault.isUnlocked ? (
                // --- LOCKED VIEW ---
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.4 }}
                    className="max-w-md mx-auto relative z-10 flex flex-col items-center justify-center min-h-[calc(100vh-120px)] w-full"
                >
                    <motion.div
                        animate={{
                            rotate: [0, -10, 10, -10, 10, 0],
                        }}
                        transition={{
                            delay: 0.5,
                            duration: 0.5,
                            ease: "easeInOut"
                        }}
                        className="w-24 h-24 glass-panel rounded-full flex items-center justify-center mb-8 border-[#E7FE55]/30 relative"
                    >
                        <div className="absolute inset-0 bg-[#E7FE55]/10 rounded-full blur-2xl animate-pulse" />
                        <Lock size={40} className="text-[#E7FE55] relative z-10" />
                    </motion.div>

                    <h2 className="text-3xl font-bold text-white mb-2 text-center tracking-tight">Vault Locked</h2>
                    <p className="text-[#747580] text-center mb-10 text-sm">Authentication required to access your assets.</p>

                    <div className="w-full glass-panel p-8 space-y-6 border-[#E7FE55]/10 shadow-2xl">
                        <div className="space-y-2">
                            <label className="swiss-label px-1">Security Password</label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full bg-[#0f1015]/80 border border-[#232328] rounded-md px-4 py-4 text-white focus:ring-1 focus:ring-[#E7FE55]/50 outline-none transition-all placeholder:text-[#333540] text-lg font-mono"
                                placeholder="••••••••"
                                onKeyDown={(e) => e.key === 'Enter' && handleUnlockAttempt()}
                            />
                        </div>

                        <button
                            onClick={handleUnlockAttempt}
                            className="w-full bg-[#E7FE55] hover:brightness-110 active:scale-[0.98] text-black font-bold py-4 rounded-md transition-all flex items-center justify-center gap-2 text-sm uppercase tracking-widest"
                        >
                            <Unlock size={18} /> Unlock Vault
                        </button>

                    </div>
                </motion.div>
            ) : (
                // --- UNLOCKED / DASHBOARD VIEW ---
                <div className="flex flex-col gap-6 flex-1">
                    {activeVaultTab === 'main' && mainViewContent}
                    {activeVaultTab === 'solana' && solanaViewContent}
                    {activeVaultTab === 'hyperliquid' && hyperliquidViewContent}
                    {activeVaultTab === 'polymarket' && polymarketViewContent}
                </div>
            )}
        </div>
    );
};
