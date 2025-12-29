import { useState, useEffect, useMemo, useSyncExternalStore } from 'react';
import { VaultState } from '../types';
import { marketDataMCP } from '../mcp/marketData/marketDataMCP';
import { polymarketStore, PolymarketState } from '../state/polymarketStore';
import { balanceHistoryStore } from '../state/balanceHistoryStore';

// Gradient color scale based on #E7FE55 (new accent color)
const ACCENT_GRADIENT_COLORS = [
    '#E7FE55', // Base accent color (brightest)
    '#D4EB4C', // Slightly darker
    '#C1D843', // Medium
    '#AEC53A', // Darker
    '#9BB231', // Even darker
    '#889F28', // Dark
    '#758C1F', // Darker still
    '#627916', // Very dark
    '#4F660D', // Almost olive
    '#3C5304', // Darkest
];

// --- Mock Data ---
export const MOCK_HISTORY_DATA = Array.from({ length: 30 }, (_, i) => ({
    date: new Date(Date.now() - (29 - i) * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    value: 100 + Math.random() * 50 + (i * 2), // Upward trend with volatility
}));

export const useMarketData = (vault: VaultState) => {
    const [portfolioHistoryDaily, setPortfolioHistoryDaily] = useState<any[]>([]);
    const [portfolioHistoryLongTerm, setPortfolioHistoryLongTerm] = useState<any[]>([]);
    const [assetPrices, setAssetPrices] = useState<Record<string, number>>({});

    const pmState = useSyncExternalStore(
        polymarketStore.subscribe.bind(polymarketStore),
        polymarketStore.getSnapshot.bind(polymarketStore)
    ) as PolymarketState;

    // Fetch Asset Prices
    useEffect(() => {
        const fetchPrices = async () => {
            const prices: Record<string, number> = {};

            // Fetch SOL Price
            try {
                const solData = await marketDataMCP.getMarketPrice('SOLUSDT');
                prices['SOL'] = solData.price;
            } catch (e) {
                console.error("Failed to fetch SOL price", e);
            }

            // Fetch Token Prices
            for (const asset of vault.assets || []) {
                if (!asset.symbol || asset.symbol === 'UNKNOWN') continue;
                try {
                    const symbol = asset.symbol.toUpperCase();
                    if (prices[symbol]) continue;

                    const data = await marketDataMCP.getMarketPrice(`${symbol}USDT`);
                    prices[symbol] = data.price;
                } catch (e) {
                    console.warn(`Failed to fetch price for ${asset.symbol}`, e);
                }
            }

            // USDC is always $1
            prices['USDC'] = 1;

            setAssetPrices(prev => ({ ...prev, ...prices }));
        };

        if (vault.isUnlocked) {
            fetchPrices();
            const interval = setInterval(fetchPrices, 60000);
            return () => clearInterval(interval);
        }
    }, [vault.isUnlocked, vault.assets]);

    // Subscribe to balance history store
    const balanceHistory = useSyncExternalStore(
        balanceHistoryStore.subscribe.bind(balanceHistoryStore),
        balanceHistoryStore.getSnapshot.bind(balanceHistoryStore)
    );

    // Record balance snapshot when values change
    useEffect(() => {
        if (!vault.isUnlocked) return;

        const solPrice = assetPrices['SOL'] || 0;
        const solValue = vault.solBalance * solPrice;
        const hlValue = vault.hlBalance || 0;
        const pmValue = (pmState.portfolioValue || 0) + (pmState.currentExposure || 0);

        // Only record if we have valid data
        if (solValue > 0 || hlValue > 0 || pmValue > 0) {
            balanceHistoryStore.recordSnapshot(solValue, hlValue, pmValue);
        }
    }, [vault.isUnlocked, vault.solBalance, assetPrices, vault.hlBalance, pmState.portfolioValue, pmState.currentExposure]);

    // Record snapshot every 15 minutes automatically (even if balance doesn't change)
    useEffect(() => {
        if (!vault.isUnlocked) return;

        const recordPeriodicSnapshot = () => {
            const solPrice = assetPrices['SOL'] || 0;
            const solValue = vault.solBalance * solPrice;
            const hlValue = vault.hlBalance || 0;
            const pmValue = (pmState.portfolioValue || 0) + (pmState.currentExposure || 0);

            if (solValue > 0 || hlValue > 0 || pmValue > 0) {
                balanceHistoryStore.recordSnapshot(solValue, hlValue, pmValue);
                console.log('[useMarketData] ⏰ Periodic 15-min snapshot recorded');
            }
        };

        // Record immediately on mount
        recordPeriodicSnapshot();

        // Then record every 15 minutes
        const FIFTEEN_MINUTES = 15 * 60 * 1000;
        const interval = setInterval(recordPeriodicSnapshot, FIFTEEN_MINUTES);

        return () => clearInterval(interval);
    }, [vault.isUnlocked]);

    // Get portfolio history from the balance history store
    useEffect(() => {
        if (balanceHistoryStore.hasHistory()) {
            // Get 15-minute intraday data for 1D view
            const intradayData = balanceHistoryStore.getHistoryForChart(1);
            setPortfolioHistoryDaily(intradayData);

            // Get long-term daily data for 1W, 1M, 1Y views
            const longTermData = balanceHistoryStore.getHistoryForChart(365);
            setPortfolioHistoryLongTerm(longTermData);
        }
    }, [balanceHistory]);

    // Prepare Asset Allocation Data (includes both Solana and Hyperliquid assets)
    const assetAllocationData = useMemo(() => {
        const data = [];
        let totalValue = 0;
        let tokensWithoutPrice = 0;

        // Add SOL
        const solPrice = assetPrices['SOL'] || 0;
        const solValue = vault.solBalance * solPrice;
        if (vault.solBalance > 0) {
            data.push({
                name: 'Solana',
                symbol: 'SOL',
                value: solValue,
                amount: vault.solBalance,
                price: solPrice,
                color: ACCENT_GRADIENT_COLORS[0], // Brightest
                hasPrice: solPrice > 0,
                network: 'solana'
            });
            if (solPrice > 0) {
                totalValue += solValue;
            } else {
                tokensWithoutPrice++;
            }
        }

        // Add Hyperliquid USDC Balance
        const hlBalance = vault.hlBalance || 0;
        if (hlBalance > 0) {
            data.push({
                name: 'USDC (Hyperliquid)',
                symbol: 'USDC',
                value: hlBalance, // USDC = $1
                amount: hlBalance,
                price: 1,
                color: ACCENT_GRADIENT_COLORS[1], // Second in gradient
                hasPrice: true,
                network: 'hyperliquid'
            });
            totalValue += hlBalance;
        }

        // Add Hyperliquid Positions (if any)
        if (vault.hlPositions && vault.hlPositions.length > 0) {
            vault.hlPositions.forEach((pos, index) => {
                const position = pos.position;
                const size = parseFloat(position.szi);
                const entryPx = parseFloat(position.entryPx);
                const unrealizedPnl = parseFloat(position.unrealizedPnl);
                const positionValue = Math.abs(size * entryPx) + unrealizedPnl;

                if (positionValue > 0) {
                    data.push({
                        name: `${position.coin} ${size >= 0 ? 'Long' : 'Short'}`,
                        symbol: position.coin,
                        value: positionValue,
                        amount: Math.abs(size),
                        price: entryPx,
                        color: ACCENT_GRADIENT_COLORS[(index + 2) % ACCENT_GRADIENT_COLORS.length],
                        hasPrice: true,
                        network: 'hyperliquid',
                        pnl: unrealizedPnl
                    });
                    totalValue += positionValue;
                }
            });
        }

        // Add Polymarket USDC Balance
        const pmBalance = pmState.portfolioValue || 0;
        if (pmBalance > 0) {
            data.push({
                name: 'USDC (Polymarket)',
                symbol: 'USDC',
                value: pmBalance,
                amount: pmBalance,
                price: 1,
                color: ACCENT_GRADIENT_COLORS[2], // Third in gradient
                hasPrice: true,
                network: 'polymarket'
            });
            totalValue += pmBalance;
        }

        // Add Polymarket Positions
        if (pmState.activePositions && pmState.activePositions.length > 0) {
            pmState.activePositions.forEach((pos, index) => {
                if (pos.currentValue > 0) {
                    data.push({
                        name: `${pos.question}`,
                        symbol: pos.outcome,
                        value: pos.currentValue,
                        amount: pos.shares,
                        price: pos.currentPrice,
                        color: ACCENT_GRADIENT_COLORS[(index + 4) % ACCENT_GRADIENT_COLORS.length],
                        hasPrice: true,
                        network: 'polymarket',
                        pnl: pos.unrealizedPnl
                    });
                    totalValue += pos.currentValue;
                }
            });
        }

        // Add Solana Tokens (excluding SOL since we already added it)
        (vault.assets || []).forEach((asset, index) => {
            if (asset.isNft) return;
            if (asset.symbol?.toUpperCase() === 'SOL') return;

            const amount = parseFloat(asset.amount) / Math.pow(10, asset.decimals);

            if (amount > 0) {
                const price = assetPrices[asset.symbol] || 0;
                const value = amount * price;

                data.push({
                    name: asset.name || asset.symbol,
                    symbol: asset.symbol,
                    value: value,
                    amount: amount,
                    price: price,
                    color: ACCENT_GRADIENT_COLORS[(index + 3) % ACCENT_GRADIENT_COLORS.length],
                    hasPrice: price > 0,
                    network: 'solana'
                });

                if (price > 0) {
                    totalValue += value;
                } else {
                    tokensWithoutPrice++;
                }
            }
        });

        // Assign default price for tokens without price
        if (tokensWithoutPrice > 0) {
            data.forEach(item => {
                if (!item.hasPrice) {
                    item.value = item.amount * 1;
                    item.price = 1;
                    totalValue += item.value;
                }
            });
        }

        return {
            data: data.sort((a, b) => b.value - a.value),
            totalValue
        };
    }, [vault.solBalance, vault.hlBalance, vault.hlPositions, vault.assets, assetPrices, pmState.portfolioValue, pmState.currentExposure, pmState.activePositions]);

    return {
        portfolioHistoryDaily,
        portfolioHistoryLongTerm,
        assetPrices,
        assetAllocationData
    };
};
