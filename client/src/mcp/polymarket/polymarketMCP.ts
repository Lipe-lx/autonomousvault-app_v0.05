// mcp/polymarket/polymarketMCP.ts
// Market Context Provider for Polymarket Dealer - follows dealerMCP.ts pattern

import { polymarketService } from '../../services/polymarketService';
import { PolymarketMarket, PolymarketPosition, PolymarketCategory } from '../../types';

// ============================================
// TYPES
// ============================================

// Dealer intent for AI decisions
export interface PolymarketDealerIntent {
    action: 'BUY_YES' | 'BUY_NO' | 'SELL_YES' | 'SELL_NO' | 'HOLD';
    confidence: number; // 0-100
    marketId: string;
    question: string;
    reason: string;
    tokenId?: string; // Token ID for order execution
    suggestedSize?: number; // USDC amount
    suggestedPrice?: number; // Limit price
}

// Market context for AI analysis
export interface PolymarketMarketContext {
    market: PolymarketMarket;
    priceHistory?: { timestamp: number; priceYes: number }[];
    volumeHistory?: { timestamp: number; volume: number }[];
    timeToResolution: number; // Days
    priceChange24h?: number;
    volumeChange24h?: number;
    sentiment?: 'bullish' | 'bearish' | 'neutral';
    ts: number;
    error?: string;
}

// Batch context for multi-market analysis
export interface PolymarketBatchContext {
    markets: PolymarketMarketContext[];
    portfolio: {
        balance: number;
        positions: PolymarketPosition[];
        totalExposure: number;
        unrealizedPnl: number;
    };
    settings: {
        maxPositionSizeUSDC: number;
        maxOpenPositions: number;
        minLiquidity: number;
        minVolume24h: number;
        allowedCategories: PolymarketCategory[];
    };
    ts: number;
}

// ============================================
// MCP CLASS
// ============================================

class PolymarketMCP {
    // Get market context for a single market
    public async getMarketContext(market: PolymarketMarket): Promise<PolymarketMarketContext> {
        try {
            // Calculate time to resolution
            const endDate = new Date(market.endDate);
            const now = new Date();
            const timeToResolution = Math.max(0, Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));

            // Determine sentiment based on price
            let sentiment: 'bullish' | 'bearish' | 'neutral' = 'neutral';
            if (market.priceYes > 0.6) sentiment = 'bullish';
            else if (market.priceYes < 0.4) sentiment = 'bearish';

            return {
                market,
                timeToResolution,
                sentiment,
                ts: Date.now()
            };
        } catch (error) {
            console.error('[PolymarketMCP] Failed to get market context:', error);
            return {
                market,
                timeToResolution: 0,
                ts: Date.now(),
                error: (error as Error).message
            };
        }
    }

    // Get batch context for multiple markets
    public async getBatchContext(
        categories: PolymarketCategory[],
        positions: PolymarketPosition[],
        balance: number,
        settings: PolymarketBatchContext['settings'],
        limit: number = 20
    ): Promise<PolymarketBatchContext> {
        const marketContexts: PolymarketMarketContext[] = [];

        try {
            // Fetch markets by category
            for (const category of categories) {
                const markets = await polymarketService.getActiveMarkets(category, Math.ceil(limit / categories.length));

                // Filter by liquidity and volume requirements
                const filteredMarkets = markets.filter(m =>
                    m.liquidity >= settings.minLiquidity &&
                    m.volume24h >= settings.minVolume24h &&
                    m.active &&
                    !m.resolved
                );

                // Get context for each market
                for (const market of filteredMarkets) {
                    const context = await this.getMarketContext(market);
                    marketContexts.push(context);
                }
            }

            // Calculate portfolio metrics
            const totalExposure = positions.reduce((sum, pos) => sum + pos.currentValue, 0);
            const unrealizedPnl = positions.reduce((sum, pos) => sum + pos.unrealizedPnl, 0);

            return {
                markets: marketContexts.slice(0, limit),
                portfolio: {
                    balance,
                    positions,
                    totalExposure,
                    unrealizedPnl
                },
                settings,
                ts: Date.now()
            };
        } catch (error) {
            console.error('[PolymarketMCP] Failed to get batch context:', error);
            return {
                markets: [],
                portfolio: {
                    balance,
                    positions,
                    totalExposure: 0,
                    unrealizedPnl: 0
                },
                settings,
                ts: Date.now()
            };
        }
    }

    // Calculate position PnL for all positions
    public calculatePositionsPnL(positions: PolymarketPosition[]): {
        totalCostBasis: number;
        totalValue: number;
        totalPnl: number;
        totalPnlPercent: number;
        byMarket: {
            marketId: string;
            question: string;
            outcome: 'YES' | 'NO';
            pnl: number;
            pnlPercent: number;
        }[];
    } {
        const totalCostBasis = positions.reduce((sum, pos) => sum + pos.costBasis, 0);
        const totalValue = positions.reduce((sum, pos) => sum + pos.currentValue, 0);
        const totalPnl = totalValue - totalCostBasis;
        const totalPnlPercent = totalCostBasis > 0 ? (totalPnl / totalCostBasis) * 100 : 0;

        const byMarket = positions.map(pos => ({
            marketId: pos.marketId,
            question: pos.question,
            outcome: pos.outcome,
            pnl: pos.unrealizedPnl,
            pnlPercent: pos.unrealizedPnlPercent
        }));

        return {
            totalCostBasis,
            totalValue,
            totalPnl,
            totalPnlPercent,
            byMarket
        };
    }

    // Build prompt context for AI analysis
    public buildAnalysisPrompt(batchContext: PolymarketBatchContext, strategyPrompt: string, cycleSummary?: string | null): string {
        const { markets, portfolio, settings } = batchContext;

        // Build market summaries with tokenIds for AI
        const marketSummaries = markets.map(ctx => {
            const m = ctx.market;
            return `- "${m.question}" [${m.category}]
  ID: ${m.id} | TokenYES: ${m.tokenIdYes} | TokenNO: ${m.tokenIdNo}
  YES: ${(m.priceYes * 100).toFixed(1)}% | Volume24h: $${m.volume24h.toLocaleString()} | Liquidity: $${m.liquidity.toLocaleString()}
  Days to Resolution: ${ctx.timeToResolution} | Sentiment: ${ctx.sentiment || 'neutral'}`;
        }).join('\n');

        // Build position summaries
        const positionSummaries = portfolio.positions.length > 0
            ? portfolio.positions.map(pos =>
                `- "${pos.question.slice(0, 50)}..." ${pos.outcome}: ${pos.shares.toFixed(2)} shares @ ${(pos.avgPrice * 100).toFixed(1)}% (PnL: $${pos.unrealizedPnl.toFixed(2)})`
            ).join('\n')
            : 'No open positions';

        // Build cycle summary section if available
        const cycleSummarySection = cycleSummary
            ? `\n=== RECENT ACTIVITY CONTEXT ===\n${cycleSummary}\n`
            : '';

        return `
POLYMARKET DEALER ANALYSIS
${cycleSummarySection}
=== STRATEGY ===
${strategyPrompt}

=== PORTFOLIO STATUS ===
Balance: $${portfolio.balance.toFixed(2)} USDC
Total Exposure: $${portfolio.totalExposure.toFixed(2)}
Unrealized PnL: $${portfolio.unrealizedPnl.toFixed(2)}
Open Positions: ${portfolio.positions.length} / ${settings.maxOpenPositions}

=== CURRENT POSITIONS ===
${positionSummaries}

=== AVAILABLE MARKETS (${markets.length}) ===
${marketSummaries}

=== CONSTRAINTS ===
- Max Position Size: $${settings.maxPositionSizeUSDC}
- Max Open Positions: ${settings.maxOpenPositions}
- Min Market Liquidity: $${settings.minLiquidity.toLocaleString()}
- Allowed Categories: ${settings.allowedCategories.join(', ')}

=== INSTRUCTIONS ===
Analyze each market and provide trading decisions.
For each decision include:
1. Action: BUY_YES, BUY_NO, SELL_YES, SELL_NO, or HOLD
2. Market ID (use the ID provided)
3. Token ID (use TokenYES for BUY_YES/SELL_YES, TokenNO for BUY_NO/SELL_NO)
4. Confidence (0-100)
5. Reasoning
6. Suggested size in USDC (if applicable)
7. Suggested limit price (if applicable)

Respond in JSON format:
{
  "decisions": [
    {
      "action": "BUY_YES",
      "marketId": "...",
      "question": "...",
      "tokenId": "...",
      "confidence": 75,
      "reason": "...",
      "suggestedSize": 25,
      "suggestedPrice": 0.45
    }
  ],
  "marketOverview": "Brief overall market assessment",
  "riskAssessment": "Brief risk commentary",
  "cycleSummary": "Brief 1-2 sentence summary of this analysis for context in next cycle. Include key observations and actions. Max 300 chars."
}
`;
    }

    // Parse AI response to dealer intents
    public parseAIResponse(response: string): PolymarketDealerIntent[] {
        try {
            // Extract JSON from response
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                console.error('[PolymarketMCP] No JSON found in AI response');
                return [];
            }

            const parsed = JSON.parse(jsonMatch[0]);

            if (!parsed.decisions || !Array.isArray(parsed.decisions)) {
                return [];
            }

            return parsed.decisions.map((d: any) => ({
                action: d.action || 'HOLD',
                marketId: d.marketId || '',
                question: d.question || '',
                tokenId: d.tokenId || '',
                confidence: d.confidence || 0,
                reason: d.reason || '',
                suggestedSize: d.suggestedSize,
                suggestedPrice: d.suggestedPrice
            })).filter((intent: PolymarketDealerIntent) =>
                intent.action !== 'HOLD' && intent.confidence >= 60
            );
        } catch (error) {
            console.error('[PolymarketMCP] Failed to parse AI response:', error);
            return [];
        }
    }
}

export const polymarketMCP = new PolymarketMCP();
