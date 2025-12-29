import { hyperliquidService, OrderOptions } from '../../services/hyperliquidService';
import { ethers } from 'ethers';

export const hyperliquidMCP = {
    async getMarketData(coin: string) {
        return await hyperliquidService.getMarketData(coin);
    },

    async getPositions(address: string) {
        const state = await hyperliquidService.getUserState(address);
        return state.assetPositions;
    },

    async getOpenOrders(address: string) {
        return await hyperliquidService.getOpenOrders(address);
    },

    async getUserFills(address: string) {
        return await hyperliquidService.getUserFills(address);
    },

    async createOrder(
        wallet: ethers.Wallet,
        coin: string,
        isBuy: boolean,
        size: number,
        price?: number,
        options?: OrderOptions
    ) {
        return await hyperliquidService.placeOrder(wallet, coin, isBuy, size, price, options);
    },

    async cancelOrder(wallet: ethers.Wallet, coin: string, orderId: number) {
        return await hyperliquidService.cancelOrder(wallet, coin, orderId);
    },

    async getUserState(address: string) {
        return await hyperliquidService.getUserState(address);
    },

    async updateLeverage(wallet: any, coin: string, leverage: number, isCross: boolean) {
        return await hyperliquidService.updateLeverage(wallet, coin, leverage, isCross);
    },

    async updateIsolatedMargin(wallet: any, coin: string, isBuy: boolean, ntli: number) {
        return await hyperliquidService.updateIsolatedMargin(wallet, coin, isBuy, ntli);
    },

    async closePosition(wallet: any, coin: string, size?: number, orderType: 'market' | 'limit' = 'market', price?: number) {
        return await hyperliquidService.closePosition(wallet, coin, size, orderType, price);
    },

    async withdrawUSDC(
        wallet: ethers.Wallet,
        destinationAddress: string,
        amount: number
    ) {
        return await hyperliquidService.withdrawUSDC(wallet, destinationAddress, amount);
    },

    async getAvailableAssets() {
        return await hyperliquidService.getAllAvailableAssets();
    },

    async getAssetDecimals(coin: string) {
        return await hyperliquidService.getAssetDecimals(coin);
    },

    async validateAsset(coin: string) {
        return await hyperliquidService.isValidAsset(coin);
    },

    // ==========================================
    // Trading Costs & Funding Methods
    // ==========================================

    /**
     * Get all perpetual asset contexts (funding rates, prices, etc.)
     */
    async getAssetContexts() {
        return await hyperliquidService.getAssetContexts();
    },

    /**
     * Get funding rate for a specific coin
     */
    async getFundingRate(coin: string) {
        return await hyperliquidService.getFundingRate(coin);
    },

    /**
     * Get user's fee tier and rates
     */
    async getUserFees(address: string) {
        return await hyperliquidService.getUserFees(address);
    },

    /**
     * Get user's funding payment history
     */
    async getUserFundingHistory(address: string, startTime?: number, endTime?: number) {
        return await hyperliquidService.getUserFundingHistory(address, startTime, endTime);
    },

    /**
     * Calculate breakeven price including all trading costs
     */
    calculateBreakevenPrice(
        entryPrice: number,
        leverage: number,
        isBuy: boolean,
        makerFee?: number,
        takerFee?: number,
        fundingRate?: number,
        holdingHours?: number
    ) {
        return hyperliquidService.calculateBreakevenPrice(
            entryPrice,
            leverage,
            isBuy,
            makerFee,
            takerFee,
            fundingRate,
            holdingHours
        );
    }
};
