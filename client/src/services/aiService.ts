import { GoogleGenAI, FunctionDeclaration, Type, Tool } from '@google/genai';
import { AgentMessage } from '../types';
import { tokenUsageStore } from '../state/tokenUsageStore';
import { providerFactory, AIComponentType, AIProviderType, PROVIDER_MODELS } from './ai';
import { aiConfigStore } from '../state/aiConfigStore';

/**
 * Rate Limiter for Gemini API
 * Uses a token bucket approach with dynamic delay adjustment
 * Prevents 429 (Too Many Requests) errors by throttling API calls
 * 
 * IMPORTANT: gemini-3-flash has a limit of 5 RPM (requests per minute)
 * So we need at least 12 seconds between requests (60s / 5 = 12s)
 */
import { aiRequestQueue } from './ai/requestQueue';

export class AIService {
  private client: GoogleGenAI | null = null;
  private modelName: string = 'gemini-2.5-flash';

  constructor() {
    // Auto-initialize with aiConfigStore key or env variable
    this.initFromConfig();
  }

  private initFromConfig() {
    const storedApiKey = aiConfigStore.getApiKey('gemini');
    const envApiKey = (import.meta as any).env?.VITE_GEMINI_API_KEY || (window as any).process?.env?.GEMINI_API_KEY;
    const apiKey = storedApiKey || envApiKey;
    if (apiKey) {
      this.initialize(apiKey);
    }
  }

  initialize(apiKey: string) {
    this.client = new GoogleGenAI({ apiKey });
  }

  setModel(model: string) {
    this.modelName = model;
    // Model selection now managed by component configs in aiConfigStore
  }

  getModel(): string {
    return this.modelName;
  }

  setApiKey(apiKey: string) {
    // Delegate to aiConfigStore
    aiConfigStore.setApiKey('gemini', apiKey);
    this.initialize(apiKey);
  }

  getApiKey(): string {
    return aiConfigStore.getApiKey('gemini');
  }

  clearApiKey() {
    aiConfigStore.clearApiKey('gemini');
    this.client = null;
  }

  isInitialized(): boolean {
    return this.client !== null;
  }

  getTools(): Tool[] {
    const getBalanceTool: FunctionDeclaration = {
      name: 'getVaultBalance',
      description: 'Get the balance of the internal Vault Wallet. Can show all balances or a specific token balance. If no token is specified, ask the user if they want to see all balances or a specific token.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          token: { type: Type.STRING, description: 'Optional: Symbol (e.g., SOL, USDC) or Mint Address of specific token to check. If not provided, show all balances.' },
        },
      },
    };

    const swapTool: FunctionDeclaration = {
      name: 'executeSwap',
      description: 'Execute a token swap on Raydium Devnet. If the token symbol is not known (not SOL/USDC/RAY), you MUST ask the user for the Mint Address.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          inputToken: { type: Type.STRING, description: 'Symbol (e.g., SOL) or Mint Address of token to sell' },
          outputToken: { type: Type.STRING, description: 'Symbol (e.g., RAY) or Mint Address of token to buy' },
          amount: { type: Type.NUMBER, description: 'Amount of input token to swap' },
        },
        required: ['inputToken', 'outputToken', 'amount'],
      },
    };

    const withdrawTool: FunctionDeclaration = {
      name: 'withdrawSol',
      description: 'Transfer SOL from the internal Vault to the connected Owner Wallet.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          amount: { type: Type.NUMBER, description: 'Amount of SOL to transfer' },
        },
        required: ['amount'],
      },
    };

    const scheduleTool: FunctionDeclaration = {
      name: 'scheduleTask',
      description: `Schedule a task (swap, transfer, alert, or Hyperliquid order) to execute either at a specific time OR when a market condition is met.
      
      CRITICAL: You MUST provide ALL required parameters. If ANY information is missing, ask the user for it instead of calling this tool.
      
      For TIME-BASED tasks: provide 'delayMinutes'
      For CONDITION-BASED tasks: provide 'conditionIndicator', 'conditionSymbol', 'conditionOperator', 'conditionValue', and 'conditionTimeframe'.
      
      IMPORTANT: 'conditionTimeframe' is REQUIRED for condition-based tasks. If the user does not specify it (e.g., "1h", "4h", "1d"), you MUST ASK them for it. DO NOT DEFAULT TO 'D'.

      Examples:
      - Time-based: delayMinutes=5
      - Condition (SWAP): taskType="SWAP", inputToken="SOL", outputToken="USDC", amount=0.1, conditionIndicator="rsi", conditionSymbol="BTCUSDT", conditionOperator="<", conditionValue=30, conditionTimeframe="D"
      - Condition (HL_ORDER): taskType="HL_ORDER", coin="BTC", isBuy=true, size=0.001, orderType="limit", price=90000, leverage=10, stopLoss=88000, takeProfit=99000, conditionIndicator="rsi", conditionSymbol="BTCUSDT", conditionOperator="<", conditionValue=30, conditionTimeframe="D"`,
      parameters: {
        type: Type.OBJECT,
        properties: {
          taskType: {
            type: Type.STRING,
            description: 'Type of task: SWAP, TRANSFER, ALERT, or HL_ORDER (Hyperliquid order)'
          },

          // For SWAP and TRANSFER tasks
          inputToken: {
            type: Type.STRING,
            description: 'For SWAP: Input token symbol or mint address. For TRANSFER: Token to transfer. Not used for ALERT or HL_ORDER.'
          },
          outputToken: {
            type: Type.STRING,
            description: 'For SWAP: Output token symbol or mint address. Not used for other task types.'
          },
          amount: {
            type: Type.NUMBER,
            description: 'Amount to swap or transfer. Not used for ALERT or HL_ORDER.'
          },

          // For HL_ORDER tasks
          coin: {
            type: Type.STRING,
            description: 'For HL_ORDER: Asset symbol (e.g., "BTC", "ETH", "SOL"). Required for HL_ORDER.'
          },
          isBuy: {
            type: Type.BOOLEAN,
            description: 'For HL_ORDER: True for LONG/BUY, False for SHORT/SELL. Required for HL_ORDER.'
          },
          size: {
            type: Type.NUMBER,
            description: 'For HL_ORDER: Size of the order. Required for HL_ORDER.'
          },
          orderType: {
            type: Type.STRING,
            description: 'For HL_ORDER: Order type ("limit", "market", "ioc", "alo"). Ask user if not specified.'
          },
          price: {
            type: Type.NUMBER,
            description: 'For HL_ORDER: Limit price. Required for LIMIT orders, ignored for MARKET.'
          },
          leverage: {
            type: Type.NUMBER,
            description: 'For HL_ORDER: Leverage multiplier (1-50). Ask user, default 1x if not specified.'
          },
          stopLoss: {
            type: Type.NUMBER,
            description: 'For HL_ORDER: Optional stop loss price. Ask user if they want to set one.'
          },
          takeProfit: {
            type: Type.NUMBER,
            description: 'For HL_ORDER: Optional take profit price. Ask user if they want to set one.'
          },
          reduceOnly: {
            type: Type.BOOLEAN,
            description: 'For HL_ORDER: True to only reduce existing position. Default false.'
          },

          // For time-based scheduling
          delayMinutes: {
            type: Type.NUMBER,
            description: 'For time-based: Number of minutes to wait before executing. Leave empty for condition-based.'
          },

          // For condition-based scheduling
          conditionIndicator: {
            type: Type.STRING,
            description: 'For condition-based: Indicator name (rsi, macd, ema, sma, stoch, price). Required for condition-based tasks.'
          },
          conditionSymbol: {
            type: Type.STRING,
            description: 'For condition-based: Trading symbol (e.g., BTCUSDT, SOLUSDT). Required for condition-based tasks.'
          },
          conditionOperator: {
            type: Type.STRING,
            description: 'For condition-based: Comparison operator (<, >, <=, >=, ==). Required for condition-based tasks.'
          },
          conditionValue: {
            type: Type.NUMBER,
            description: 'For condition-based: Threshold value to compare against. Required for condition-based tasks.'
          },
          conditionTimeframe: {
            type: Type.STRING,
            description: 'For condition-based: Timeframe (1, 5, 15, 60, 240, D, W). REQUIRED. If missing, ask user.'
          }
        },
        required: ['taskType']
      }
    };

    const transferTokenTool: FunctionDeclaration = {
      name: 'transferToken',
      description: 'Transfer SPL tokens or NFTs from the Vault to the Owner Wallet. You can ONLY send to the Owner, not to any other address.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          tokenMint: { type: Type.STRING, description: 'Mint address of the token to transfer' },
          amount: { type: Type.NUMBER, description: 'Amount of tokens to transfer (in human-readable units, not raw)' }
        },
        required: ['tokenMint', 'amount']
      }
    };

    const getMarketPriceTool: FunctionDeclaration = {
      name: 'getMarketPrice',
      description: 'Get the current market price, exchange, and last update time for a given symbol.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          symbol: { type: Type.STRING, description: 'Trading symbol (e.g., "BTCUSDT", "SOLUSDT")' },
        },
        required: ['symbol'],
      },
    };

    const getOHLCVTool: FunctionDeclaration = {
      name: 'getOHLCV',
      description: 'Get OHLCV (Open, High, Low, Close, Volume) candlestick data for a symbol.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          symbol: { type: Type.STRING, description: 'Trading symbol (e.g., "BTCUSDT", "SOLUSDT")' },
          timeframe: { type: Type.STRING, description: 'Timeframe (e.g., "1", "5", "15", "60", "240", "D"). Default is "60".' },
        },
        required: ['symbol'],
      },
    };

    const getIndicatorTool: FunctionDeclaration = {
      name: 'getIndicator',
      description: 'Get a specific technical indicator value for a symbol.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          symbol: { type: Type.STRING, description: 'Trading symbol (e.g., "BTCUSDT", "SOLUSDT")' },
          indicator: { type: Type.STRING, description: 'Indicator name: "rsi", "macd", "ema", "sma", "stoch"' },
          timeframe: { type: Type.STRING, description: 'Timeframe (e.g., "1", "5", "15", "60", "240", "D"). Default is "60".' },
        },
        required: ['symbol', 'indicator'],
      },
    };

    const getTradingViewSummaryTool: FunctionDeclaration = {
      name: 'getTradingViewSummary',
      description: 'Get the TradingView buy/sell/neutral recommendation summary for a symbol.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          symbol: { type: Type.STRING, description: 'Trading symbol (e.g., "BTCUSDT", "SOLUSDT")' },
        },
        required: ['symbol'],
      },
    };

    const getHLBalanceTool: FunctionDeclaration = {
      name: 'getHLBalance',
      description: 'Get the balance of the Hyperliquid Vault (USDC) and positions.',
      parameters: {
        type: Type.OBJECT,
        properties: {},
      },
    };

    const getHLPositionsTool: FunctionDeclaration = {
      name: 'getHLPositions',
      description: 'Get open positions in the Hyperliquid Vault.',
      parameters: {
        type: Type.OBJECT,
        properties: {},
      },
    };

    const getHLMarketDataTool: FunctionDeclaration = {
      name: 'getHLMarketData',
      description: 'Get market data (price, orderbook) for a Hyperliquid asset.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          coin: { type: Type.STRING, description: 'Asset symbol (e.g., "BTC", "ETH", "SOL")' },
        },
        required: ['coin'],
      },
    };

    const createHLOrderTool: FunctionDeclaration = {
      name: 'createHLOrder',
      description: `Place an order on Hyperliquid Testnet. 
      
      **USDC-BASED ORDERS:**
      If user says "comprar X USDC de COIN", provide usdcAmount=X and the system will automatically calculate the size.
      
      CRITICAL: You MUST ask the user for ALL required information before calling this tool:
      1. Coin (asset symbol)
      2. Direction (LONG/BUY or SHORT/SELL)
      3. Size (amount) OR usdcAmount (USDC to spend)
      4. Order Type (LIMIT or MARKET)
      5. Price (required for LIMIT orders)
      6. Leverage (1-50x, default 1x if not specified)
      7. Stop Loss (optional)
      8. Take Profit (optional)
      
      Minimum order value: $10 USD`,
      parameters: {
        type: Type.OBJECT,
        properties: {
          coin: { type: Type.STRING, description: 'Asset symbol (e.g., "BTC", "ETH", "SOL", "HYPE")' },
          isBuy: { type: Type.BOOLEAN, description: 'True for LONG/BUY, False for SHORT/SELL' },
          size: { type: Type.NUMBER, description: 'Size of the order in token units. Leave empty if usdcAmount is provided.' },
          usdcAmount: { type: Type.NUMBER, description: 'Amount in USDC to spend (for buys) or receive (for sells). If provided, size will be auto-calculated.' },
          orderType: {
            type: Type.STRING,
            description: 'Order type: "limit", "market", "ioc", "alo". Ask user if not specified.'
          },
          price: {
            type: Type.NUMBER,
            description: 'Limit price. Required for LIMIT orders, ignored for MARKET.'
          },
          leverage: {
            type: Type.NUMBER,
            description: 'Leverage multiplier (1-50). Ask user, default 1x if not specified.'
          },
          stopLoss: {
            type: Type.NUMBER,
            description: 'Optional stop loss price. Ask user if they want to set one.'
          },
          takeProfit: {
            type: Type.NUMBER,
            description: 'Optional take profit price. Ask user if they want to set one.'
          },
          reduceOnly: {
            type: Type.BOOLEAN,
            description: 'True to only reduce existing position. Default false.'
          }
        },
        required: ['coin', 'isBuy', 'orderType'],
      },
    };

    const cancelHLOrderTool: FunctionDeclaration = {
      name: 'cancelHLOrder',
      description: 'Cancel a specific order on Hyperliquid.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          coin: { type: Type.STRING, description: 'Asset symbol' },
          orderId: { type: Type.NUMBER, description: 'Order ID to cancel' },
        },
        required: ['coin', 'orderId'],
      },
    };

    const updateHLLeverageTool: FunctionDeclaration = {
      name: 'updateHLLeverage',
      description: 'Update leverage for a specific asset on Hyperliquid.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          coin: { type: Type.STRING, description: 'Asset symbol' },
          leverage: { type: Type.NUMBER, description: 'New leverage (1-50)' },
          isCross: { type: Type.BOOLEAN, description: 'True for cross margin, false for isolated' }
        },
        required: ['coin', 'leverage', 'isCross'],
      },
    };

    const closeHLPositionTool: FunctionDeclaration = {
      name: 'closeHLPosition',
      description: 'Close an open position on Hyperliquid.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          coin: { type: Type.STRING, description: 'Asset symbol' },
          size: { type: Type.NUMBER, description: 'Optional: partial close size. If not provided, closes entire position.' },
          orderType: { type: Type.STRING, description: 'Order type: "market" (immediate) or "limit"' },
          price: { type: Type.NUMBER, description: 'Price for limit orders' }
        },
        required: ['coin', 'orderType'],
      },
    };

    const withdrawFromHLTool: FunctionDeclaration = {
      name: 'withdrawFromHL',
      description: `Execute a USDC withdrawal from Hyperliquid Testnet Vault to the Owner's wallet.
      
      This tool EXECUTES the withdrawal immediately. Only call this when the user explicitly wants to withdraw/send/transfer USDC from Hyperliquid.
      
      Requirements:
      - Amount must be > $1 (to cover the $1 USDC withdrawal fee)
      - Vault must be unlocked
      - Owner wallet must be connected
      
      Network: Hyperliquid Testnet
      Fee: $1 USDC (deducted from withdrawal amount)
      Processing time: ~5 minutes`,
      parameters: {
        type: Type.OBJECT,
        properties: {
          amount: {
            type: Type.NUMBER,
            description: 'Amount of USDC to withdraw (must be > $1 to cover fee)'
          }
        },
        required: ['amount']
      }
    };
    const getDealerTradeHistoryTool: FunctionDeclaration = {
      name: 'getDealerTradeHistory',
      description: `Query the Hyperliquid Dealer's trade operation history and AI reasoning.
      
      Use this tool when users ask about:
      - Why a specific position was opened/closed
      - The reasoning behind Dealer trades
      - Details about past or current operations
      - What the Dealer did or is doing
      
      Returns:
      - Operation records with coin, action, price, size, PnL
      - Full AI reasoning and confidence for each trade
      - Recent activity logs`,
      parameters: {
        type: Type.OBJECT,
        properties: {
          coin: {
            type: Type.STRING,
            description: 'Optional: Filter by specific coin (e.g., "BTC", "ETH"). If not provided, returns all operations.'
          },
          limit: {
            type: Type.NUMBER,
            description: 'Optional: Maximum number of records to return (default 10, max 50)'
          },
          includeReasoning: {
            type: Type.BOOLEAN,
            description: 'Optional: Whether to include full AI reasoning (default true). Set to false for basic info only.'
          }
        }
      }
    };

    return [{ functionDeclarations: [getBalanceTool, swapTool, withdrawTool, transferTokenTool, scheduleTool, getMarketPriceTool, getOHLCVTool, getIndicatorTool, getTradingViewSummaryTool, getHLBalanceTool, getHLPositionsTool, getHLMarketDataTool, createHLOrderTool, cancelHLOrderTool, updateHLLeverageTool, closeHLPositionTool, withdrawFromHLTool, getDealerTradeHistoryTool] }];
  }

  async sendMessage(
    history: AgentMessage[],
    newMessage: string,
    systemInstruction: string
  ): Promise<any> {
    if (!this.client) throw new Error("AI Agent not initialized. Please set API Key.");

    const client = this.client;
    const modelName = this.modelName;
    const getTools = () => this.getTools();
    const saveTokenUsage = (result: any) => {
      if (result.usageMetadata) {
        tokenUsageStore.addRecord({
          source: 'MANAGER',
          operation: 'QUERY',
          inputTokens: result.usageMetadata.promptTokenCount || 0,
          outputTokens: result.usageMetadata.candidatesTokenCount || 0,
          model: modelName
        });
      }
    };

    // Use global queue for rate limiting
    return aiRequestQueue.enqueue({
      priority: 'HIGH',
      source: 'operator',
      provider: 'gemini',
      execute: async () => {
        const chatHistory = history.map(h => ({
          role: h.role === 'model' ? 'model' : 'user',
          parts: [{ text: h.content }],
        }));

        const chat = client.chats.create({
          model: modelName,
          config: {
            systemInstruction: systemInstruction,
            tools: getTools(),
          },
          history: chatHistory
        });

        const result = await chat.sendMessage({
          message: newMessage
        });

        saveTokenUsage(result);
        return result;
      }
    });
  }

  /**
   * Specialized method for Hyperliquid Dealer analysis.
   * This forces the AI to output a structured JSON decision based on provided market context.
   */
  async getDealerAnalysis(
    marketData: any,
    strategyPrompt: string
  ): Promise<any> {
    if (!this.client) throw new Error("AI Agent not initialized.");

    const client = this.client;
    const modelName = this.modelName;

    // Construct a focused system instruction for the Dealer
    const dealerSystemInstruction = `
      You are Hyperliquid Dealer, an autonomous crypto trading engine.
      Your goal is to analyze provided market data and output a TRADING DECISION based strictly on the user's Strategy and Portfolio Constraints.

      You will receive:
      1. Market Data (Prices, Indicators, Orderbook)
      2. Portfolio Context (Current Balance, Open Positions, PnL, Risk Limits)
      3. TRADING COSTS (Maker/Taker Fees, Funding Rate, Breakeven Prices)

      You must return valid JSON with this schema:
      {
        "action": "BUY" | "SELL" | "HOLD" | "CLOSE",
        "confidence": number (0.0 to 1.0),
        "reason": "Detailed explanation citing technicals, fees, and costs. Include Entry Price, Stop Loss, and Take Profit values if applicable. (Max 600 characters)",
        "coin": "Symbol analyzed",
        "suggestedLeverage": number (1-50, optional, MUST NOT exceed portfolio.settings.maxLeverage),
        "sizeUSDC": number (optional, calculate based on bankroll settings),
        "orderType": "limit" | "market",
        "price": number (for limit orders, optional),
        "stopLoss": number (optional),
        "takeProfit": number (optional)
      }

      CRITICAL RULES:
      1. ONLY output the JSON decision. No markdown blocks, no fluff.
      2. If data is insufficient or unclear, action="HOLD".
      3. CHECK PORTFOLIO LIMITS: Do not buy if 'maxPositions' is reached.
      4. CLOSE POSITIONS: If an open position hits target or stop loss criteria in your analysis, output "CLOSE".
      5. BANKROLL: Using 'manualBankroll' or 'availableBalance' from context, suggest a safe 'sizeUSDC' for new trades.
      6. REASONING FORMAT: Start 'reason' with action: "LONG:", "SHORT:", "CLOSE:", or "WAIT:".
      7. LEVERAGE CONSTRAINT: If suggesting leverage, 'suggestedLeverage' MUST NOT exceed 'portfolio.settings.maxLeverage'. This is a hard limit set by the user.
      
      TRADING COSTS AWARENESS (CRITICAL FOR PROFIT CALCULATION):
      8. FEE CONSIDERATION: Context includes 'tradingCosts.makerFee' and 'tradingCosts.takerFee' (as decimals, e.g., 0.0005 = 0.05%).
         - Total round-trip cost = (takerFee * 2) for market orders or (makerFee * 2) for limit orders.
         - Only enter trades where expected price movement > total round-trip cost.
      9. FUNDING RATE: Context includes 'tradingCosts.fundingRate' (8h rate) and 'estimatedDailyHoldingCost'.
         - Positive funding: Longs pay shorts.
         - Negative funding: Shorts pay longs.
         - Factor funding into holding decisions for swing trades.
      10. BREAKEVEN PRICES: If 'portfolio.positionBreakevens' exists, it contains:
         - breakevenPrice: Price needed to cover entry/exit fees
         - minProfitPrice: Price needed for 1% profit after costs
         - Use these to decide when to CLOSE positions profitably.
      11. PROFIT THRESHOLD: Only suggest trades where expected move > 2x trading costs (to be safe).
    `;

    // Use global queue for rate limiting
    return aiRequestQueue.enqueue({
      priority: 'HIGH',
      source: 'hyperliquidDealer',
      provider: 'gemini',
      execute: async () => {
        const chat = client.chats.create({
          model: modelName,
          config: {
            systemInstruction: dealerSystemInstruction,
            responseMimeType: 'application/json'
          }
        });

        const contextMessage = `
            [USER STRATEGY]
            ${strategyPrompt}

            [MARKET CONTEXT]
            ${JSON.stringify(marketData)}
        `;

        const result = await chat.sendMessage({
          message: contextMessage
        });

        // Basic parsing of the JSON response
        let text = '';
        if (result.candidates && result.candidates[0]?.content?.parts) {
          for (const part of result.candidates[0].content.parts) {
            if (part.text) text += part.text;
          }
        }

        try {
          // Remove any markdown fencing if present
          const jsonText = text.replace(/```json/g, '').replace(/```/g, '').trim();
          return JSON.parse(jsonText);
        } catch (e) {
          console.error("Failed to parse Dealer JSON response:", text);
          return { action: "HOLD", reason: "Failed to parse AI response" };
        }
      }
    });
  }

  /**
   * BATCH ANALYSIS METHOD
   * Analyzes multiple coins in a single prompt to save tokens.
   * Includes Retry, Timeout (handled by client config ideally, or wrapper), and strict Schema Validation.
   */
  async getBatchDealerAnalysis(
    mergedMarketContext: any,
    strategyPrompt: string
  ): Promise<any[]> {
    // 1. Self-Healing Initialization
    if (!this.client) {
      console.warn("[AIService] Client not initialized. Attempting lazy init...");
      const storedApiKey = aiConfigStore.getApiKey('gemini');
      const envApiKey = (import.meta as any).env?.VITE_GEMINI_API_KEY || (window as any).process?.env?.GEMINI_API_KEY;
      const apiKey = storedApiKey || envApiKey;
      if (apiKey) {
        this.initialize(apiKey);
        console.log("[AIService] Lazy init successful.");
      } else {
        throw new Error("AI Agent not initialized and no API Key found. Please configure your API key in Settings.");
      }
    }

    const client = this.client;
    const modelName = this.modelName;

    const dealerSystemInstruction = `
      You are Hyperliquid Dealer, an autonomous crypto trading engine.
      Your goal is to analyze specific assets and output a TRADING DECISION for EACH one.

      You will receive:
      1. A JSON Object containing an array of 'coins' with their Market Data (Price, Indicators) AND HISTORICAL SERIES.
      2. Portfolio Context (Balance, Open Positions, Risk Limits, userFees with makerFee/takerFee).
      3. PRE-CALCULATED DIVERGENCE SIGNALS: Each coin includes a 'divergences' array with detected divergence patterns.

      DATA STRUCTURE NOTES:
      - 'portfolio.userFees' contains global makerFee and takerFee (applies to all coins).
      - Each coin's 'tradingCosts' contains only fundingRate and dailyHoldingCost (unique per coin).
      - The keys in each coin's 'indicators' object tell you which indicators are active (e.g., {rsi: ..., macd: ...}).
      - 'ts' is a Unix timestamp (seconds since epoch).

      INDICATOR WEIGHTING SYSTEM:
      - Each indicator includes a 'weight' field (0.5 to 2.0, default 1.0).
      - Each indicator includes a 'category' field (trend, momentum, volume, volatility).
      - weight > 1.0: User considers this indicator MORE important (prioritize its signals)
      - weight < 1.0: User considers this indicator LESS important (lower priority)
      - weight = 1.0: Standard importance
      - When indicators conflict, prefer higher-weighted signals.
      - Give each category's signals equal base weight, then apply individual indicator weights.

      INDICATOR CATEGORIES (do NOT stack similar signals from same category):
      - TREND (EMA, SMA, ADX, Ichimoku): Direction of market
      - MOMENTUM (RSI, MACD, Stochastic): Timing of entry/exit
      - VOLUME (OBV, VWAP): Confirmation of moves
      - VOLATILITY (ATR, Bollinger): Risk context

      AUTONOMOUS MODE (when 'autonomousMode' is true in context):
      - The context includes 'availablePresets' with preset configurations.
      - You MUST analyze market conditions first and choose the best preset.
      - Add a 'chosenPreset' field to your JSON response (outside the decisions array) with one of:
        - 'balanced': For uncertain/mixed signals (default fallback)
        - 'scalp': For high volatility with quick reversals
        - 'trendFollowing': For strong directional trends (ADX > 25)
        - 'meanReversion': For ranging/sideways markets
        - 'volumeConfirm': For breakout scenarios or unusual volume
      - Add a 'presetReason' field explaining why you chose that preset.
      - Focus your analysis on the indicators most relevant to your chosen preset.

      RESPONSE FORMAT:
      - For NORMAL mode: Return JSON array of decisions directly.
      - For AUTONOMOUS mode: Return { "chosenPreset": "...", "presetReason": "...", "decisions": [...] }

      You must return valid JSON with this EXACT schema for each decision:
      {
        "coin": "Symbol analyzed",
        "action": "BUY" | "SELL" | "HOLD" | "CLOSE",
        "confidence": number (0.0 to 1.0),
        "reason": "Format: [ACTION] Position Status + Explanation. POSITION STATUS RULES: If NO open position, say 'No position.' If HAVE open position, say 'In LONG/SHORT at $X, PnL: $Y'. ENTRY/SL/TP RULES: Only include Entry/SL/TP values for BUY or SELL actions. For HOLD/CLOSE, do NOT include Entry/SL/TP. Examples: HOLD='WAIT: No position. RSI neutral.' BUY='LONG: No position. RSI divergence. Entry: $95000, SL: $93100, TP: $98800' CLOSE='CLOSE: In LONG at $95000, PnL: +$150. TP reached.'. Max 600 chars.",
        "suggestedLeverage": number (1-50, optional, MUST NOT exceed portfolio.settings.maxLeverage),
        "sizeUSDC": number (optional, calculate based on bankroll settings),
        "orderType": "limit" | "market",
        "price": number (for limit orders, optional),
        "stopLoss": number (optional),
        "takeProfit": number (optional)
      }

      CRITICAL RULES:
      1. ONLY output valid JSON.
      2. Must return one decision object per coin provided in the input.
      3. CHECK PORTFOLIO LIMITS: Do not suggest BUY if 'portfolio.maxPositions' is reached.
      4. CLOSE POSITIONS: Prioritize checking existing positions for exit signals.
      5. PROFITABILITY: Consider 'portfolio.userFees' and coin's 'tradingCosts'. Only trade if potential > costs.
      6. LEVERAGE CONSTRAINT: If suggesting leverage, 'suggestedLeverage' MUST NOT exceed 'portfolio.settings.maxLeverage'. This is a hard limit set by the user.
      
      7. RISK PROTECTION (CRITICAL - MANDATORY JSON FIELDS):
         - Check 'portfolio.settings.stopLossEnabled' and 'portfolio.settings.takeProfitEnabled'.
         - If 'stopLossEnabled' is true AND 'stopLossPercent' is null: You MUST include the numeric field "stopLoss" in your JSON response (not just in reason text). Example: "stopLoss": 93100.50
         - If 'takeProfitEnabled' is true AND 'takeProfitPercent' is null: You MUST include the numeric field "takeProfit" in your JSON response (not just in reason text). Example: "takeProfit": 98800.00
         - These are SEPARATE JSON FIELDS, not just mentions in the "reason" string.
         - For BUY/LONG: stopLoss should be BELOW entry price, takeProfit should be ABOVE entry price.
         - For SELL/SHORT: stopLoss should be ABOVE entry price, takeProfit should be BELOW entry price.
      
      8. DIVERGENCE SIGNALS (HIGH PRIORITY): Each coin includes a 'divergences' array with pre-calculated signals:
         - BULLISH: Price lower low + RSI/MACD higher low → potential reversal UP
         - BEARISH: Price higher high + RSI/MACD lower high → potential reversal DOWN
         - HIDDEN_BULLISH: Trend continuation signal UP
         - HIDDEN_BEARISH: Trend continuation signal DOWN
         - Strength: WEAK, MODERATE, STRONG (prioritize MODERATE and STRONG signals)
         - Use these divergences with HIGH PRIORITY - they are algorithmically detected and reliable.
       8. REASONING FORMAT (CRITICAL - MUST FOLLOW):
          - Start with action: "LONG:", "SHORT:", "CLOSE:", or "WAIT:".
          - POSITION STATUS (MANDATORY - ALWAYS INCLUDE):
            - Check each coin's 'openPosition.hasPosition' field.
            - If hasPosition === false: MUST say "No position." at the START of your reason.
            - If hasPosition === true: MUST say "In [side] at $[entryPx], PnL: $[unrealizedPnl]" at the START.
          - ENTRY/SL/TP VALUES:
            - ONLY include Entry, SL, TP values for BUY or SELL actions (new trades).
            - For HOLD or CLOSE actions, do NOT include Entry/SL/TP values.
          - CRITICAL: Use ONLY the openPosition data from each coin's context. NEVER invent or guess PnL values.
          - CRITICAL: If hasPosition is false, DO NOT report SL/TP values - there is no position to have SL/TP.
          - MANDATORY: If divergences are present, mention them in your reasoning.
          - RECOMMENDED: Mention indicator weights if they influenced your decision.
         - RECOMMENDED: If 'macro' data is present, mention macro alignment in your reasoning.

      MACRO TIMEFRAME CONFIRMATION (CRITICAL FOR ACCURACY):
      - Each coin MAY include a 'macro' object with indicator values from a HIGHER timeframe.
      - 'macro.timeframe' tells you the macro timeframe (e.g., '240' = 4H, 'D' = Daily, 'W' = Weekly).
      - 'macro.indicators' contains current values only (no history).
      
      MACRO ALIGNMENT RULES:
      - If main timeframe shows OVERBOUGHT but macro shows OVERSOLD: Consider HOLD or reduce confidence by 20-30%.
      - If main timeframe shows OVERSOLD but macro shows OVERBOUGHT: Consider HOLD or reduce confidence by 20-30%.
      - If main and macro ALIGN (both overbought or both oversold): Full confidence trade.
      - If conflicting signals: MENTION THE CONFLICT in your reasoning (e.g., "Main RSI=75 but Macro RSI=30 - conflicting").
      
      EXAMPLES:
      - Main RSI=25 (oversold) + Macro RSI=35 (neutral-oversold) = ALIGNED = Full confidence BUY.
      - Main RSI=75 (overbought) + Macro RSI=30 (oversold) = CONFLICTING = HOLD or reduce size.
      - Use macro as a FILTER to avoid trading against the higher timeframe trend.
    `;

    return aiRequestQueue.enqueue({
      priority: 'NORMAL',
      source: 'hyperliquidDealer',
      provider: 'gemini',
      execute: async () => {
        const chat = client.chats.create({
          model: modelName,
          config: {
            systemInstruction: dealerSystemInstruction,
            responseMimeType: 'application/json'
          }
        });

        const contextMessage = `
          [USER STRATEGY]
          ${strategyPrompt}

          [BATCH MARKET DATA]
          ${JSON.stringify(mergedMarketContext)}

          Analyze all assets in the batch. Return a JSON Array of decisions.
        `;

        const result = await chat.sendMessage({ message: contextMessage });

        if (result.usageMetadata) {
          tokenUsageStore.addRecord({
            source: 'DEALER',
            operation: 'BATCH_ANALYSIS',
            inputTokens: result.usageMetadata.promptTokenCount || 0,
            outputTokens: result.usageMetadata.candidatesTokenCount || 0,
            model: modelName,
            metadata: { coinsAnalyzed: mergedMarketContext?.coins?.length || 0 }
          });
        }

        let text = '';
        if (result.candidates && result.candidates[0]?.content?.parts) {
          for (const part of result.candidates[0].content.parts) {
            if (part.text) {
              text += part.text;
            }
          }
        }

        if (!text) {
          console.warn(`[AIService] Empty response from Batch Dealer Analysis`);
          return [];
        }

        const jsonText = text.replace(/```json/g, '').replace(/```/g, '').trim();

        let parsed;
        try {
          parsed = JSON.parse(jsonText);
        } catch (parseError) {
          console.warn(`[AIService] JSON Parse Error:`, parseError);
          return [];
        }

        let decisions: any[] = [];
        if (Array.isArray(parsed)) {
          decisions = parsed;
        } else if (typeof parsed === 'object') {
          decisions = [parsed];
        } else {
          return [];
        }

        const normalizedDecisions = decisions.map(d => {
          if (d.action === 'LONG') {
            return { ...d, action: 'BUY' };
          } else if (d.action === 'SHORT') {
            return { ...d, action: 'SELL' };
          } else if (d.action === 'WAIT') {
            return { ...d, action: 'HOLD' };
          }
          return d;
        });

        const validDecisions = normalizedDecisions.filter(d => {
          const hasCoin = typeof d.coin === 'string' && d.coin.length > 0;
          const hasAction = ['BUY', 'SELL', 'HOLD', 'CLOSE'].includes(d.action);
          if (!hasCoin || !hasAction) {
            return false;
          }
          return true;
        });

        const ACTION_PRIORITY: Record<string, number> = {
          'CLOSE': 3,
          'BUY': 2,
          'SELL': 2,
          'HOLD': 1
        };

        const coinDecisionMap = new Map<string, any>();
        for (const decision of validDecisions) {
          const coin = decision.coin.toUpperCase();
          const existing = coinDecisionMap.get(coin);

          if (!existing) {
            coinDecisionMap.set(coin, decision);
          } else {
            const existingPriority = ACTION_PRIORITY[existing.action] || 0;
            const newPriority = ACTION_PRIORITY[decision.action] || 0;

            if (newPriority > existingPriority) {
              coinDecisionMap.set(coin, decision);
            } else if (newPriority === existingPriority) {
              const existingConf = existing.confidence || 0;
              const newConf = decision.confidence || 0;
              if (newConf > existingConf) {
                coinDecisionMap.set(coin, decision);
              }
            }
          }
        }

        return Array.from(coinDecisionMap.values());
      }
    });
  }

  /**
   * Polymarket Dealer Analysis
   * Analyzes prediction markets and returns trading decisions
   */
  async analyzePolymarket(prompt: string): Promise<string | null> {
    if (!this.client) {
      console.warn("[AIService] Client not initialized for Polymarket analysis");
      return null;
    }

    const client = this.client;
    const modelName = this.modelName;

    const polymarketSystemInstruction = `
      You are a Polymarket prediction market analyst.
      Your goal is to analyze prediction markets and identify trading opportunities.

      You will receive market data including:
      - Market questions and current YES/NO prices
      - Time to resolution
      - Volume and liquidity data
      - Current portfolio positions

      Respond with a JSON object containing your analysis:
      {
        "decisions": [
          {
            "action": "BUY_YES" | "BUY_NO" | "SELL_YES" | "SELL_NO" | "HOLD",
            "marketId": "string",
            "question": "string",
            "confidence": 0-100,
            "reason": "explanation",
            "suggestedSize": number (USDC),
            "suggestedPrice": number (0-1)
          }
        ],
        "marketOverview": "Brief overall assessment",
        "riskAssessment": "Brief risk commentary"
      }

      RULES:
      1. Only suggest trades with confidence >= 60
      2. Consider time to resolution (avoid markets expiring soon without clear edge)
      3. Factor in liquidity - avoid illiquid markets
      4. Look for mispriced probabilities based on news/fundamentals
      5. Diversify across different categories when possible
    `;

    return aiRequestQueue.enqueue({
      priority: 'NORMAL',
      source: 'polymarketDealer',
      provider: 'gemini',
      execute: async () => {
        const chat = client.chats.create({
          model: modelName,
          config: {
            systemInstruction: polymarketSystemInstruction,
            responseMimeType: 'application/json'
          }
        });

        const result = await chat.sendMessage({ message: prompt });

        if (result.usageMetadata) {
          tokenUsageStore.addRecord({
            source: 'POLYMARKET_DEALER',
            operation: 'ANALYSIS',
            inputTokens: result.usageMetadata.promptTokenCount || 0,
            outputTokens: result.usageMetadata.candidatesTokenCount || 0,
            model: modelName
          });
        }

        let text = '';
        if (result.candidates && result.candidates[0]?.content?.parts) {
          for (const part of result.candidates[0].content.parts) {
            if (part.text) {
              text += part.text;
            }
          }
        }

        return text || null;
      }
    });
  }

  // ============================================
  // Multi-Provider Support Methods
  // ============================================

  /**
   * Get the provider factory for advanced use cases
   */
  getProviderFactory() {
    return providerFactory;
  }

  /**
   * Get the config store for managing provider settings
   */
  getConfigStore() {
    return aiConfigStore;
  }

  /**
   * Get available providers list
   */
  getAvailableProviders(): AIProviderType[] {
    return ['gemini', 'openai', 'claude'];
  }

  /**
   * Get models for a specific provider
   */
  getModelsForProvider(provider: AIProviderType) {
    return PROVIDER_MODELS[provider] || [];
  }

  /**
   * Send message using component-specific provider
   */
  async sendOperatorMessage(
    history: AgentMessage[],
    newMessage: string,
    systemInstruction: string
  ): Promise<any> {
    const provider = providerFactory.getProviderForComponent('operator');

    if (!provider) {
      // Fallback to legacy Gemini
      console.log('[AIService] Falling back to legacy Gemini for operator');
      return this.sendMessage(history, newMessage, systemInstruction);
    }

    try {
      const response = await provider.sendMessage(
        history,
        newMessage,
        systemInstruction,
        (provider as any).getTools?.() || this.getTools()
      );

      // Track token usage
      if (response.usageMetadata) {
        const config = aiConfigStore.getComponentConfig('operator');
        tokenUsageStore.addRecord({
          source: 'MANAGER',
          operation: 'QUERY',
          inputTokens: response.usageMetadata.promptTokenCount || 0,
          outputTokens: response.usageMetadata.candidatesTokenCount || 0,
          model: config.modelId
        });
      }

      // Convert to legacy format for compatibility
      return {
        text: response.text,
        functionCalls: response.functionCalls,
        usageMetadata: response.usageMetadata,
        candidates: [{
          content: {
            parts: [{ text: response.text }]
          }
        }]
      };
    } catch (error) {
      console.error('[AIService] Operator provider error:', error);
      // Fallback to legacy Gemini
      return this.sendMessage(history, newMessage, systemInstruction);
    }
  }

  /**
   * Get batch dealer analysis using component-specific provider
   */
  async getDealerBatchAnalysis(
    mergedMarketContext: any,
    strategyPrompt: string,
    abortSignal?: AbortSignal
  ): Promise<{ decisions: any[], cycleSummary?: string }> {
    const provider = providerFactory.getProviderForComponent('hyperliquidDealer');

    if (!provider) {
      // Fallback to legacy method - wrap result in expected format
      console.log('[AIService] Falling back to legacy batch analysis');
      const decisions = await this.getBatchDealerAnalysis(mergedMarketContext, strategyPrompt);
      return { decisions };
    }

    try {
      const result = await provider.sendBatchAnalysis(mergedMarketContext, strategyPrompt, abortSignal);

      // Track token usage (estimated since batch doesn't return per-call usage)
      const config = aiConfigStore.getComponentConfig('hyperliquidDealer');
      tokenUsageStore.addRecord({
        source: 'DEALER',
        operation: 'BATCH_ANALYSIS',
        inputTokens: Math.round(JSON.stringify(mergedMarketContext).length / 4), // Rough estimate
        outputTokens: Math.round(JSON.stringify(result).length / 4),
        model: config.modelId,
        metadata: { coinsAnalyzed: mergedMarketContext?.coins?.length || 0 }
      });

      return result;
    } catch (error: any) {
      // If aborted, re-throw instead of falling back
      if (error?.name === 'AbortError') {
        console.log('[AIService] Dealer analysis aborted');
        throw error;
      }

      console.error('[AIService] Dealer provider error:', error);
      // Fallback to legacy method - wrap result in expected format
      const decisions = await this.getBatchDealerAnalysis(mergedMarketContext, strategyPrompt);
      return { decisions };
    }
  }

  /**
   * Get Polymarket analysis using component-specific provider
   */
  async getPolymarketAnalysis(prompt: string): Promise<string | null> {
    const provider = providerFactory.getProviderForComponent('polymarketDealer');

    if (!provider) {
      // Fallback to legacy method
      console.log('[AIService] Falling back to legacy Polymarket analysis');
      return this.analyzePolymarket(prompt);
    }

    const systemInstruction = `
      You are a Polymarket prediction market analyst.
      Your goal is to analyze prediction markets and identify trading opportunities.

      Respond with a JSON object containing your analysis:
      {
        "decisions": [
          {
            "action": "BUY_YES" | "BUY_NO" | "SELL_YES" | "SELL_NO" | "HOLD",
            "marketId": "string",
            "question": "string",
            "confidence": 0-100,
            "reason": "explanation",
            "suggestedSize": number (USDC),
            "suggestedPrice": number (0-1)
          }
        ],
        "marketOverview": "Brief overall assessment",
        "riskAssessment": "Brief risk commentary"
      }

      RULES:
      1. Only suggest trades with confidence >= 60
      2. Consider time to resolution
      3. Factor in liquidity
      4. Look for mispriced probabilities
      5. Diversify when possible
    `;

    try {
      const result = await provider.sendJsonAnalysis(prompt, systemInstruction);

      // Track token usage
      if (result) {
        const config = aiConfigStore.getComponentConfig('polymarketDealer');
        tokenUsageStore.addRecord({
          source: 'POLYMARKET_DEALER',
          operation: 'ANALYSIS',
          inputTokens: Math.round(prompt.length / 4),
          outputTokens: Math.round(result.length / 4),
          model: config.modelId
        });
      }

      return result;
    } catch (error) {
      console.error('[AIService] Polymarket provider error:', error);
      // Fallback to legacy method
      return this.analyzePolymarket(prompt);
    }
  }

  /**
   * Check if a component has a valid provider configured
   */
  isComponentReady(component: AIComponentType): boolean {
    return providerFactory.isComponentReady(component);
  }

  /**
   * Get current provider info for a component
   */
  getComponentProviderInfo(component: AIComponentType) {
    const config = aiConfigStore.getComponentConfig(component);
    const models = PROVIDER_MODELS[config.providerType];
    const model = models.find(m => m.id === config.modelId);

    return {
      provider: config.providerType,
      model: config.modelId,
      modelName: model?.name || config.modelId,
      isReady: providerFactory.isComponentReady(component)
    };
  }

  /**
   * Generate a contextual summary of recent dealer cycles
   * Used to provide AI with memory across trading cycles
   * @param cycles Array of recent cycle records
   * @param dealerType 'hyperliquid' or 'polymarket'
   * @returns Compact summary string (~150-200 tokens)
   */
  async generateCycleSummary(
    cycles: { timestamp: number; decisions: { asset: string; action: string; confidence: number }[]; assetsAnalyzed: string[] }[],
    dealerType: 'hyperliquid' | 'polymarket'
  ): Promise<string> {
    if (!this.client) {
      console.warn('[AIService] Client not initialized for cycle summary');
      return '';
    }

    if (cycles.length === 0) {
      return '';
    }

    const client = this.client;
    const modelName = this.modelName;

    const dealerContext = dealerType === 'hyperliquid'
      ? 'crypto perpetual futures trading on Hyperliquid'
      : 'prediction market trading on Polymarket';

    const systemPrompt = `You are a trading analyst summarizing recent trading activity.
Generate a CONCISE contextual summary for an AI trader about to analyze ${dealerContext}.

The summary should help the AI understand:
1. Recent market sentiment and patterns observed
2. Actions taken in previous cycles (buys, sells, holds)
3. Key assets/markets being monitored
4. Any notable patterns or trends

CRITICAL RULES:
- Output ONLY plain text, max 300 characters
- Be extremely concise - every word must add value
- Focus on actionable context for the next analysis
- No JSON, no markdown, no formatting`;

    // Format cycles into compact representation
    const cycleData = cycles.map(c => ({
      time: new Date(c.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      actions: c.decisions.map(d => `${d.asset}:${d.action}(${Math.round(d.confidence * 100)}%)`).join(', '),
      assets: c.assetsAnalyzed.length
    }));

    const prompt = `Recent ${dealerType} trading cycles (newest first):
${cycleData.map((c, i) => `Cycle ${cycles.length - i}: ${c.time} - Analyzed ${c.assets} assets. Actions: ${c.actions || 'None'}`).join('\n')}

Generate a brief contextual summary for the next analysis cycle.`;

    return aiRequestQueue.enqueue({
      priority: 'LOW',
      source: dealerType === 'hyperliquid' ? 'hyperliquidDealer' : 'polymarketDealer',
      provider: 'gemini',
      execute: async () => {
        try {
          const chat = client.chats.create({
            model: modelName,
            config: {
              systemInstruction: systemPrompt
            }
          });

          const result = await chat.sendMessage({ message: prompt });

          // Track token usage
          if (result.usageMetadata) {
            tokenUsageStore.addRecord({
              source: dealerType === 'hyperliquid' ? 'DEALER' : 'POLYMARKET_DEALER',
              operation: 'CYCLE_SUMMARY',
              inputTokens: result.usageMetadata.promptTokenCount || 0,
              outputTokens: result.usageMetadata.candidatesTokenCount || 0,
              model: modelName
            });
          }

          let text = '';
          if (result.candidates && result.candidates[0]?.content?.parts) {
            for (const part of result.candidates[0].content.parts) {
              if (part.text) text += part.text;
            }
          }

          // Ensure we don't exceed character limit
          return text.trim().slice(0, 350);
        } catch (error) {
          console.error('[AIService] Cycle summary generation failed:', error);
          return '';
        }
      }
    });
  }
}

export const aiService = new AIService();