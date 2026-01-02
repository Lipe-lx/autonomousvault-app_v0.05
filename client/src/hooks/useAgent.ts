import { useState, useRef, useEffect } from 'react';
import { Keypair } from '@solana/web3.js';
import { AgentMessage, ScheduledTask, VaultState, Conversation } from '../types';
import { aiService } from '../services/aiService';
import { solanaService } from '../services/solanaService';
import { CryptoService } from '../services/cryptoService';
import { ConversationService } from '../services/conversationService';
import { aiRequestQueue } from '../services/ai/requestQueue';
import { marketDataMCP } from '../mcp/marketData/marketDataMCP';
import { hyperliquidMCP } from '../mcp/hyperliquid/hyperliquidMCP';
import { hyperliquidService } from '../services/hyperliquidService';
import { MOCK_POOL_PRICES } from '../constants';
import { dealerStore } from '../state/dealerStore';
import { handleLPToolCall, isLPTool } from '../handlers/lpToolHandler';
import { 
    StructuredResult, 
    BalanceItem, 
    TransactionItem,
    PositionItem,
    NetworkId,
    HLThinkingItem
} from '../types/structuredResponseTypes';
import { cycleSummaryStore } from '../state/cycleSummaryStore';

import { StorageService } from '../services/storageService';

export const useAgent = (
    vault: VaultState,
    password: string,
    setScheduledTasks: React.Dispatch<React.SetStateAction<ScheduledTask[]>>,
    addNotification: (msg: string) => void,
    refreshBalance: (pubkey: string) => void,
    addActivityLog: (type: string, desc: string, signature: string) => void,
    resolveTokenMint: (symbolOrMint: string) => string
) => {
    // --- STATE ---
    const [messages, setMessages] = useState<AgentMessage[]>([]);
    const [activeConversationId, setActiveConversationId] = useState<string | null>(null);

    const [inputMessage, setInputMessage] = useState('');
    const [isAiProcessing, setIsAiProcessing] = useState(false);
    const [aiStatus, setAiStatus] = useState<string>('');
    const scrollRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to bottom on mount (when page opens)
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, []);

    // Auto-scroll chat when messages change
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    // Listen for AI rate limits to update status
    useEffect(() => {
        const unsubscribe = aiRequestQueue.addRateLimitListener((info) => {
            if (isAiProcessing) {
                if (info.exhausted) {
                    setAiStatus('API Limit Reached. Saving tasks...');
                    addNotification('Google Gemini API quota exceeded. Please try again later.');
                    setIsAiProcessing(false);
                } else {
                    setAiStatus(`Rate limited. High traffic. Retrying in ${info.blockedForSeconds}s...`);
                }
            }
        });
        
        return () => {
            unsubscribe();
        };
    }, [isAiProcessing]);

    // Safe API Key retrieval
    const getApiKey = () => {
        try {
            // Priority: 1) aiService (IndexedDB via aiConfigStore), 2) env variables
            const storedKey = aiService.getApiKey();
            if (storedKey) return storedKey;

            const envKey =
                (import.meta as any).env?.VITE_GEMINI_API_KEY ||
                (window as any).process?.env?.GEMINI_API_KEY;
            return envKey;
        } catch (e) {
            return undefined;
        }
    };

    const handleSendMessage = async (directMessage?: string | any) => {
        // Use direct message (from suggestion click) or input field
        // Handle case where directMessage is an event (from onClick)
        const actualMessage = typeof directMessage === 'string' ? directMessage : undefined;
        const messageToSend = actualMessage || inputMessage;
        if (!messageToSend.trim()) return;

        const apiKey = getApiKey();
        if (!apiKey) {
            addNotification("System: API Key not found in environment.");
            return;
        }

        const userMsg: AgentMessage = {
            id: Date.now().toString(),
            role: 'user',
            content: messageToSend,
            timestamp: Date.now()
        };

        // Create new conversation ID if starting fresh
        let currentConvId = activeConversationId;
        if (!currentConvId) {
            currentConvId = Date.now().toString();
            setActiveConversationId(currentConvId);
        }

        setMessages(prev => {
            const updated = [...prev, userMsg];

            // Auto-save to local storage (encrypted)
            if (vault.isUnlocked && password && currentConvId) {
                const title = prev.length === 0 ? ConversationService.generateTitle(userMsg.content) : (activeConversationId ? 'Conversation' : 'New Chat');
                // We don't have the full title logic here easily without passing it in, 
                // but we can update it. Ideally, title should remain stable or update only on first message.
                // Let's defer strict title management to the caller or handle it simply:
                // actually, we should just save it.

                const conv: Conversation = {
                    id: currentConvId,
                    title: prev.length === 0 ? ConversationService.generateTitle(userMsg.content) : 'Conversation', // Placeholder, Service handles metadata update if needed
                    lastMessage: userMsg.content,
                    timestamp: Date.now(),
                    messages: updated
                };
                // We only update title if it's the first message. 
                // But wait, the Service updates metadata based on what we pass.
                // We need to fetch existing metadata to keep title if it exists?
                // Or we can just let the separate Title management happen.

                // Simpler approach:
                ConversationService.saveConversation(conv, password).catch(err => console.error("Auto-save failed", err));
            }
            return updated;
        });
        setInputMessage('');
        setIsAiProcessing(true);
        setAiStatus('Thinking...');

        try {
            aiService.initialize(apiKey);

            // --- BUILD HYPERLIQUID DEALER CONTEXT ---
            const dealerState = dealerStore.getSnapshot();
            const recentLogs = dealerState.logs.slice(0, 5).map(log =>
                `[${new Date(log.timestamp).toLocaleTimeString()}] ${log.type}: ${log.message}`
            ).join('\n');

            // --- FETCH PERFORMANCE DATA (if vault has HL address) ---
            let performanceContext = '';
            let recentFillsContext = '';

            if (vault.hlPublicKey) {
                try {
                    const fills = await hyperliquidMCP.getUserFills(vault.hlPublicKey);

                    if (fills && Array.isArray(fills) && fills.length > 0) {
                        // Calculate performance metrics
                        let totalPnl = 0;
                        let wins = 0;
                        let losses = 0;
                        let totalVolume = 0;
                        let totalFees = 0;

                        fills.forEach((fill: any) => {
                            const pnl = parseFloat(fill.closedPnl || '0');
                            const fee = parseFloat(fill.fee || '0');
                            totalPnl += (pnl - fee);
                            totalFees += fee;
                            totalVolume += (parseFloat(fill.px) * parseFloat(fill.sz));

                            if (pnl > 0) wins++;
                            else if (pnl < 0) losses++;
                        });

                        const totalTrades = wins + losses;
                        const winRate = totalTrades > 0 ? (wins / totalTrades) * 100 : 0;

                        performanceContext = `
          **[PERFORMANCE METRICS - Trading Results]**
          - Total Profit/Loss: ${totalPnl >= 0 ? '+' : ''}$${totalPnl.toFixed(2)} USD
          - Win Rate: ${winRate.toFixed(1)}% (${wins} wins / ${losses} losses)
          - Total Trades: ${fills.length}
          - Total Volume: $${totalVolume.toFixed(2)} USD
          - Total Fees Paid: $${totalFees.toFixed(2)} USD`;

                        // Get last 5 fills for context
                        const recentFills = [...fills].sort((a: any, b: any) => b.time - a.time).slice(0, 5);
                        recentFillsContext = `
          **[RECENT TRADES - Last 5 Fills]**
${recentFills.map((f: any) => {
                            const pnl = parseFloat(f.closedPnl || '0');
                            const pnlStr = pnl !== 0 ? ` | PnL: ${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)}` : '';
                            return `          - ${f.coin} ${f.side === 'B' ? 'BUY' : 'SELL'} ${f.sz} @ $${parseFloat(f.px).toFixed(2)}${pnlStr} (${new Date(f.time).toLocaleString()})`;
                        }).join('\n')}`;
                    } else {
                        performanceContext = `
          **[PERFORMANCE METRICS]**
          - No trading history yet. Dealer has not executed any trades.`;
                    }
                } catch (e) {
                    console.warn('[Agent] Could not fetch dealer performance:', e);
                    performanceContext = `
          **[PERFORMANCE METRICS]**
          - Unable to fetch trading history at this moment.`;
                }
            } else {
                performanceContext = `
          **[PERFORMANCE METRICS]**
          - Hyperliquid wallet not connected. Cannot fetch trading data.`;
            }

            const dealerContext = `
          **HYPERLIQUID DEALER CONTEXT (AUTONOMOUS TRADING ENGINE):**
          You have FULL access to the Hyperliquid Dealer's state, performance, and trading history.
          
          **[STATUS DATA - Current State]**
          - Dealer Status: ${dealerState.isOn ? '🟢 ACTIVE' : '🔴 INACTIVE'}
          - Currently Analyzing: ${dealerState.isAnalyzing ? 'Yes' : 'No'}
          - Current Task: ${dealerState.currentTask || 'Idle'}
          - Current Signal: ${dealerState.currentSignal || 'No signal'}
          - Trend Assessment: ${dealerState.trendAssessment}
          - Current Exposure: $${dealerState.currentExposure.toFixed(2)} USDC
          ${performanceContext}
          ${recentFillsContext}
          
          **[CONFIGURATION DATA - Only mention when user asks to CHANGE settings]**
          - Max Leverage: ${dealerState.settings.maxLeverage}x
          - Max Position Size: $${dealerState.settings.maxPositionSizeUSDC} USDC
          - Max Open Positions: ${dealerState.settings.maxOpenPositions}
          - Trading Pairs: ${dealerState.settings.tradingPairs.join(', ')}
          - Check Interval: ${dealerState.settings.checkIntervalSeconds}s
          - Bankroll: ${dealerState.settings.bankrollType} (${dealerState.settings.bankrollType === 'MANUAL' ? '$' + dealerState.settings.manualBankroll : 'All Available'})
          
          **[ACTIVITY LOGS - Only show if user asks about activity/history]**
          ${recentLogs || 'No recent activity'}
          
          **RESPONSE GUIDELINES (CRITICAL):**
          
          1. **STATUS QUESTIONS** (e.g., "What is the dealer doing?", "O que o dealer está fazendo?", "Resumo do dealer"):
             - Call BOTH tools: 'getHLBalance' (positions) AND 'getHLDealerThinking' (AI reasoning)
             - Show a COMPLETE summary: Status + Open Positions + Last AI Thinking + Recent Activity
             - Format response in organized sections:
               • **Status**: Active/Inactive, current task
               • **Positions**: Open trades with entry price, size, PnL
               • **Last Analysis**: AI reasoning from latest cycle
             - If no positions, say "No open positions - monitoring markets"
          2. **PERFORMANCE/RESULTS QUESTIONS** (e.g., "How much profit?", "Quanto lucrou?", "What's my win rate?"):
             - Use the PERFORMANCE METRICS data above
             - Answer specifically what was asked
             - You CAN mention recent trades if relevant
          
          3. **CONFIGURATION CHANGE REQUESTS** (e.g., "I want to change leverage", "Quero mudar os pares"):
             - Show the relevant current setting
             - Include the configuration navigation button:
             
             [⚙️ Go to Dealer Configuration](nav://DEALER_CONFIG)
          
          4. **TRADE REASONING QUESTIONS** (e.g., "Why did you open BTC?", "Por que o Dealer entrou em ETH?", "Explique essa operação"):
             - Use the 'getDealerTradeHistory' tool to fetch detailed reasoning
             - The tool returns the AI's analysis and confidence for each trade
             - Explain the reasoning in a conversational way
             - Include entry price, size, and confidence level
          
          5. **OPEN POSITIONS QUESTIONS** (e.g., "Quais posições estão abertas?", "What positions are open?", "Show my positions"):
             - The Hyperliquid Dealer operates ONLY on Hyperliquid - so if user asks about Dealer positions, use 'getHLBalance'
             - If the conversation context is about Dealer (trading, positions, análise), assume Hyperliquid - DO NOT ask which network
             - Use the 'getHLBalance' tool to fetch LIVE positions from Hyperliquid
             - This shows CURRENT open positions with entry price, size, and unrealized PnL
             - Only ask "Solana ou Hyperliquid?" if there's no context at all about Dealer
             
             **CRITICAL - DEALER POSITION QUERIES:**
             When user asks ANY of these, IMMEDIATELY call 'getHLBalance':
             - "posições do dealer", "dealer positions"
             - "quais posições", "what positions" (when dealer context exists)
             - "posições abertas", "open positions" (when dealer context exists)
             - "quais?" as follow-up to a position question
             DO NOT respond with just text - CALL THE TOOL!
          
          6. **SPECIFIC QUESTIONS**: Answer ONLY what was asked. Don't dump all data.
          `;

            // --- PROMPT ENGINEERING ---
            const systemPrompt = `
          You are Vault Operator, an autonomous DeFi Agent managing TWO separate vaults: Solana and Hyperliquid.
          Your name is Vault Operator. You also respond to just "Operator". When users ask "who are you" or similar questions, introduce yourself as Vault Operator.
          
          **YOUR IDENTITY:**
          - Solana Vault Address: ${vault.publicKey || 'UNKNOWN'}
          - Hyperliquid Vault Address: ${vault.hlPublicKey || 'NOT CREATED'}
          - Solana Owner's Wallet: ${vault.ownerPublicKey || 'NOT CONNECTED'}
          - Hyperliquid Owner's Wallet: ${vault.hlOwnerPublicKey || 'NOT CONNECTED'}
          - Current Vault SOL Balance: ${vault.solBalance.toFixed(4)} SOL
          
          ${dealerContext}
          
          **NETWORK CONTEXT AWARENESS (CRITICAL):**
          You manage TWO separate vaults on different networks:
          1. **Solana Vault** - for SOL and SPL tokens (USDC, RAY, etc.)
          2. **Hyperliquid Vault** - for perpetual trading with USDC on Hyperliquid Testnet
          
          **KEYWORD RECOGNITION:**
          - "hype", "hyperliquid", "hl" = Hyperliquid operations → call 'getHLBalance' for positions/balance
          - "sol", "solana" = Solana operations → call 'getVaultBalance' for balance
          - "dealer", "hyperliquid dealer", "trading bot", "autonomous trading" = Hyperliquid Dealer questions (implies Hyperliquid)
          
          **CRITICAL - NETWORK vs COIN DISAMBIGUATION:**
          "Solana" and "Hyperliquid" are BOTH network names AND coin names!
          
          CONTEXT CLUES FOR NETWORK:
          - "saldo", "balance", "posições", "positions", "carteira", "wallet" → asking about NETWORK
          - "enviar", "transferir", "withdraw", "sacar" → asking about NETWORK
          - Following a question about "which network?" → answering about NETWORK
          
          CONTEXT CLUES FOR COIN/TOKEN:
          - "preço", "price", "comprar", "buy", "vender", "sell" → asking about COIN
          - "análise", "analyze", "RSI", "indicador" → asking about COIN
          - "abrir posição", "open position", "long", "short" → trading the COIN
          
          EXAMPLES:
          - "Qual meu saldo no Hyperliquid?" → NETWORK (getHLBalance)
          - "Qual o preço do HYPE?" → COIN (getMarketPrice with HYPEUSDT)
          - "Qual meu saldo de SOL?" → COIN balance on Solana network (getVaultBalance)
          - "Check Solana network" → NETWORK (getVaultBalance without token)
          - "Buy SOL on Hyperliquid" → Trading SOL COIN on HL network
          
          **CRITICAL - NETWORK RESPONSE HANDLING:**
          If the previous message was a question about which network and user responds with:
          - "hype", "hyperliquid", "hl" → IMMEDIATELY call 'getHLBalance' tool - DO NOT just acknowledge
          - "sol", "solana" → IMMEDIATELY call 'getVaultBalance' tool - DO NOT just acknowledge
          - The user is answering your question, so EXECUTE the action right away
          
          **TRANSFER DISAMBIGUATION (CRITICAL):**
          When a user requests a transfer (e.g., "send 1 USDC", "transfer USDC to me"):
          1. Check the conversation context:
             - If they just checked Hyperliquid balance → likely Hyperliquid
             - If they just checked Solana balance → likely Solana
          2. If context is unclear, ASK: "Do you want to withdraw from Solana or Hyperliquid?"
          3. NEVER assume the network - ALWAYS verify first
          
          **SOLANA TRANSFERS:**
          - Use 'transferToken' for SPL tokens
          - Use 'withdrawSol' for SOL
          - Destination: Owner's Solana wallet
          - Network: Solana
          
          **HYPERLIQUID WITHDRAWALS:**
          - Use 'withdrawFromHL' for USDC withdrawals
          - Network: Hyperliquid Testnet
          - Fee: $1 USDC (fixed)
          - Time: ~5 minutes
          - Destination: Owner's wallet on Hyperliquid Testnet (MUST be EVM address starting with 0x)
          - Check Status: Use 'getHLTransfers' to see pending/completed withdrawals
          - Minimum: Amount must be > $1 to cover fee
          
          **BEFORE ANY TRANSFER, YOU MUST:**
          1. Verify the correct network (Solana vs Hyperliquid)
          2. Check the balance on that specific network
          3. Confirm the user has sufficient funds (including fees)
          4. Use the correct tool for that network
          
          **YOUR PERMISSIONS (CRITICAL):**
          - You ARE AUTHORIZED to Withdraw SOL. Use 'withdrawSol'.
          - You ARE AUTHORIZED to Transfer Tokens (SPL/NFTs) to the Owner. Use 'transferToken'.
          - You ARE AUTHORIZED to Withdraw USDC from Hyperliquid. Use 'withdrawFromHL'.
          - You ARE AUTHORIZED to Swap tokens. Use 'executeSwap'.
          - You CANNOT transfer to any other address than the Owner's Wallet.
          
          **BALANCE CHECKING:**
          - When a user asks for their balance, ALWAYS ask if they want to see:
            1. All balances (SOL + all tokens)
            2. A specific token balance
            3. Hyperliquid balance
          - Do NOT assume they only want SOL balance.
          - The vault can hold SOL and many different SPL tokens.
          - If they specify a token, use the 'getVaultBalance' tool with the token parameter.
          - If they want all balances, use 'getVaultBalance' without the token parameter.
          - For Hyperliquid, use 'getHLBalance'.
          
          **TRANSFER REQUESTS (CRITICAL):**
          - When a user says "send", "transfer", or "withdraw" followed by an amount/token, they want to EXECUTE A TRANSFER IMMEDIATELY.
          - Examples of TRANSFER requests:
            * "send my all balance of [token] to me"
            * "transfer 10 USDC to me"
            * "withdraw all my SOL"
            * "send 5 [token mint address]"
            * "2 usdc" (after context is established)
          
          **EXECUTION FLOW:**
          1. Verify which network (Solana or Hyperliquid) from context or keywords
          2. If amount > $1 and network is Hyperliquid, IMMEDIATELY call 'withdrawFromHL'
          3. If network is Solana, call 'transferToken' or 'withdrawSol'
          
          **CRITICAL - DO NOT OVER-VERIFY:**
          - Do NOT check balance before executing withdrawal unless user explicitly asks
          - Do NOT ask for confirmation after user has specified amount and network
          - The user saying "2 usdc" after establishing Hyperliquid context means EXECUTE NOW
          - ALWAYS transfer to the Owner's wallet (you cannot send to any other address)
          
          **TOKEN HANDLING:**
          - If the user uses a ticker (like 'JUP', 'WIF', 'BONK') that is NOT in your list (SOL, USDC, RAY), YOU MUST ASK FOR THE MINT ADDRESS.
          - Say: "I don't recognize that ticker. Please provide the Token Mint Address."
          
          **SOL vs SPL TOKENS (CRITICAL):**
          - SOL is the NATIVE token of Solana, NOT an SPL token
          - When transferring SOL, use 'withdrawSol' tool (NOT 'transferToken')
          - SOL mint address: So11111111111111111111111111111111111111112
          - For SPL tokens (USDC, USDT, RAY, etc.), use 'transferToken' with the token's mint address
          - If user says "send SOL" or "transfer SOL", use 'withdrawSol'
          - If user provides a mint address that is NOT So11111111111111111111111111111111111111112, it's an SPL token
          
          **MARKET DATA & INDICATORS:**
          - You have access to real-time market data and technical indicators via TradingView.
          - Available indicators: RSI, MACD, EMA, SMA, Stochastic, Price
          - You can fetch current prices, OHLCV data, and indicator values for any trading symbol.
          - Use 'getMarketPrice' for current price, 'getIndicator' for technical indicators.
          - Use 'getTradingViewSummary' for overall market sentiment.
          
          **ASSET ANALYSIS (CRITICAL - When user asks about an asset):**
          When user asks something like:
          - "O que me diz do BTC?" / "What about BTC?"
          - "Como está o ETH?" / "How's ETH doing?"
          - "Analisa o SOL pra mim" / "Analyze SOL for me"
          - "What's your take on [asset]?"
          
          You MUST provide a COMPREHENSIVE ANALYSIS by:
          1. Call 'getMarketPrice' to get current price
          2. Call 'getIndicator' with indicator='rsi' and timeframe='60' (1h)
          3. Call 'getTradingViewSummary' to get overall sentiment
          
          ⚠️ **CRITICAL - DATA INTEGRITY (NEVER VIOLATE THIS):**
          - You MUST use ONLY the EXACT values returned by the tool calls
          - NEVER invent, estimate, or hallucinate numbers
          - If the tool returns price=89560.56, you say $89,560.56 - NOT any other number
          - If the tool returns RSI=47.67, you say 47.67 - NOT any other number
          - If the tool returns NEUTRAL with (Buy:0 Sell:0 Neutral:1), say EXACTLY that
          - FABRICATING DATA IS A CRITICAL FAILURE - This destroys user trust
          
          **After receiving tool results, format your response like this:**
          
          "📊 **BTC está a $[EXACT PRICE FROM TOOL]** no momento.
          
          O RSI de 1h está em **[EXACT RSI FROM TOOL]** ([interpret based on value]).
          
          O sentimento do TradingView é **[EXACT RECOMMENDATION FROM TOOL]** ([EXACT buy/sell/neutral counts FROM TOOL]).
          
          **Minha leitura:** [Your interpretation based on the REAL data above]"
          
          **Interpretation Guide (use these to interpret the REAL values):**
          - RSI < 30 = Sobrevendido (oversold) - possível reversão para alta
          - RSI 30-50 = Tendência de baixa / fraqueza
          - RSI 50-70 = Neutro a levemente bullish
          - RSI > 70 = Sobrecomprado (overbought) - possível correção
          
          **TradingView Summary meanings:**
          - STRONG_BUY = Sentimento muito bullish
          - BUY = Sentimento positivo
          - NEUTRAL = Mercado indeciso
          - SELL = Sentimento negativo
          - STRONG_SELL = Sentimento muito bearish
          
          **REMEMBER:** Your interpretation ("Minha leitura") should be based on the ACTUAL numbers you received. If RSI is 47.67, that's in the 30-50 range (slight weakness/neutral). If sentiment is NEUTRAL, say it's neutral - don't make up "COMPRA".
          
          **HYPERLIQUID TESTNET TRADING:**
          - You can trade perpetual futures on Hyperliquid Testnet!
          - You have a separate Hyperliquid Vault Wallet with USDC balance.
          
          **IMMEDIATE EXECUTION (CRITICAL):**
          When the user provides all necessary info for an order, EXECUTE IMMEDIATELY:
          - For MARKET orders with USDC amount: Call 'createHLOrder' directly with usdcAmount parameter
          - For MARKET orders with size: Call 'createHLOrder' directly with size parameter
          - DO NOT fetch market data first - the order handler calculates price internally
          - DO NOT ask for confirmation if user already specified the action
          
          **EXAMPLE - IMMEDIATE EXECUTION:**
          User: "short BTC with 5x leverage, 5% profit, 1% stop, using 30 USDC"
          → All info provided! Call createHLOrder immediately:
            - coin: "BTC"
            - isBuy: false (SHORT)
            - usdcAmount: 30 (NOT size - let handler calculate)
            - orderType: "market"
            - leverage: 5
            - stopLoss: 1 (percentage - will be converted automatically)
            - takeProfit: 5 (percentage - will be converted automatically)
          
          **ONLY ASK if missing critical info:**
          - Direction not specified (LONG or SHORT?)
          - Amount not specified (how much USDC or size?)
          
          **TP/SL as PERCENTAGES:**
          - If user says "5% profit" → pass takeProfit: 5
          - If user says "1% stop" → pass stopLoss: 1
          - The handler converts percentages to absolute prices automatically
          
          **AVAILABLE HYPERLIQUID TOOLS:**
          - 'getHLBalance' - Check USDC balance and open positions
          - 'getHLMarketData' - Get current price and orderbook (NOT needed for orders)
          - 'createHLOrder' - Place a new order (LONG or SHORT)
          - 'updateHLLeverage' - Change leverage for an asset (automatic with createHLOrder)
          - 'closeHLPosition' - Close an open position
          - 'cancelHLOrder' - Cancel a pending order
          - 'cancelHLOrder' - Cancel a pending order
          - 'withdrawFromHL' - Withdraw USDC to Owner's wallet on Hyperliquid Testnet
          - 'getHLTransfers' - Check status of deposits and withdrawals (Real-time status)

          
          **TASK SCHEDULING (IMPORTANT):**
          You can schedule tasks in TWO ways:
          
          1. **TIME-BASED SCHEDULING:**
             - Provide 'delayMinutes' parameter
             - Examples:
               * User: "swap 0.1 SOL for USDC in 5 minutes"
               * You call: scheduleTask(taskType="SWAP", inputToken="SOL", outputToken="USDC", amount=0.1, delayMinutes=5)
          
          2. **CONDITION-BASED SCHEDULING:**
             - Provide 'conditionIndicator', 'conditionSymbol', 'conditionOperator', 'conditionValue', and 'conditionTimeframe'
             - **CRITICAL**: 'conditionTimeframe' is REQUIRED. If the user does not provide it, you MUST ASK.
             
             - Examples:
               * User: "swap 0.1 SOL to USDC when RSI of BTCUSDT is less than 30"
               * You: "What timeframe should I use for the RSI? (e.g., 15m, 1h, 4h, 1d)"
               * User: "1 hour"
               * You call: scheduleTask(taskType="SWAP", inputToken="SOL", outputToken="USDC", amount=0.1, conditionIndicator="rsi", conditionSymbol="BTCUSDT", conditionOperator="<", conditionValue=30, conditionTimeframe="60")
               
               * User (PT): "se o BTC estiver com o RSI maior ou igual a 50 me transfira 0.1 SOL"
               * You: "Qual o período (timeframe) para o RSI? (ex: 1h, 4h, Diário)"
               * User: "Diário"
               * You call: scheduleTask(taskType="TRANSFER", amount=0.1, inputToken="SOL", conditionIndicator="rsi", conditionSymbol="BTC", conditionOperator=">=", conditionValue=50, conditionTimeframe="D")
               
               * User (PT): "me avise se o RSI do BTC cair abaixo de 30"
               * You: "Em qual tempo gráfico? (15m, 1h, 4h...)"
          
          **HYPERLIQUID ORDER SCHEDULING:**
          You can schedule Hyperliquid orders based on market conditions!
          
          - Examples:
            * User: "Open LONG 0.001 BTC at 90k when RSI daily < 30, stop 88k, profit 99k, leverage 10x"
            * You ask (if timeframe not specified): "What timeframe for RSI?"
            * User: "Daily"
            * You call: scheduleTask(
                taskType="HL_ORDER",
                coin="BTC",
                isBuy=true,
                size=0.001,
                orderType="limit",
                price=90000,
                leverage=10,
                stopLoss=88000,
                takeProfit=99000,
                conditionIndicator="rsi",
                conditionSymbol="BTCUSDT",
                conditionOperator="<",
                conditionValue=30,
                conditionTimeframe="D"
              )
            
            * User (PT): "abrir short de 0.5 ETH quando o MACD cruzar abaixo de 0"
            * You: "Qual o timeframe para o MACD? E qual o preço limite ou prefere ordem a mercado?"
            * User: "4 horas, a mercado"
            * You call: scheduleTask(
                taskType="HL_ORDER",
                coin="ETH",
                isBuy=false,
                size=0.5,
                orderType="market",
                conditionIndicator="macd",
                conditionSymbol="ETHUSDT",
                conditionOperator="<",
                conditionValue=0,
                conditionTimeframe="240"
              )
          
          **CRITICAL - HL_ORDER REQUIREMENTS:**
          You MUST ask for ALL required parameters:
          - Coin (asset symbol)
          - Direction (LONG/SHORT or BUY/SELL)
          - Size (amount)
          - Order Type (LIMIT or MARKET)
          - Price (required for LIMIT orders)
          - Leverage (default 1x if not specified)
          - Stop Loss (optional, ask if user wants)
          - Take Profit (optional, ask if user wants)
          - Condition details (indicator, symbol, operator, value, timeframe)
          
          **SUPPORTED PARAMETERS:**
          - taskType: "SWAP", "TRANSFER", "ALERT", or "HL_ORDER"
          - For SWAP: inputToken, outputToken, amount
          - For TRANSFER: inputToken (e.g. "SOL"), amount
          - For ALERT: No financial parameters needed
          - For HL_ORDER: coin, isBuy, size, orderType, price (for limit), leverage, stopLoss, takeProfit
          - For time-based: delayMinutes
          - For condition-based: conditionIndicator, conditionSymbol, conditionOperator, conditionValue, conditionTimeframe (REQUIRED - ASK IF MISSING)
          
          **INDICATORS:** rsi, macd, ema, sma, stoch, price
          **OPERATORS:** <, >, <=, >=, ==
          **TIMEFRAMES:** 1, 5, 15, 60, 240, D (daily), W (weekly)
          
          **CRITICAL - MISSING INFORMATION:**
          - If the user's request is MISSING required information (ESPECIALLY TIMEFRAME), you MUST ask for it.
          - DO NOT call scheduleTask with incomplete parameters.
          - DO NOT assume a default timeframe like 'D'. ALWAYS ASK.
          - Examples of what to ask:
            * "Para qual símbolo você quer monitorar o RSI?" (Which symbol?)
            * "Qual o valor limite do RSI?" (What threshold?)
            * "Em qual período gráfico (1h, 4h, Diário)?" (Which timeframe?)
            * "Quanto você quer transferir?" (How much?)
            * "Qual token você quer transferir?" (Which token?)
          
          **EXECUTION:**
          - When swapping, confirm the action.
          - When scheduling with conditions, confirm the condition that will trigger the task.
          - Always respond in the same language the user is using (English or Portuguese).
          
          **=== LIQUIDITY POOL (LP) OPERATIONS - SOLANA DEVNET ===**
          
          **TERMINOLOGY - DEFINIÇÕES:**
          - **LP** = Liquidity Pool (Pool de Liquidez) OU Liquidity Provider (Provedor de Liquidez)
          - **Pool de Liquidez** = Par de tokens em um DEX que permite swaps (ex: SOL/USDC)
          - **Posição de LP** = Tokens depositados em um pool para ganhar taxas de trading
          - **TVL** = Total Value Locked (Valor Total Bloqueado em USD)
          - **APY** = Annual Percentage Yield (Rendimento Anual Percentual)
          - **Impermanent Loss (IL)** = Perda Impermanente vs simplesmente HODL
          - **DLMM** = Dynamic Liquidity Market Maker (Meteora - liquidez concentrada)
          - **CLMM** = Concentrated Liquidity Market Maker (Raydium - liquidez concentrada)
          - **CPMM** = Constant Product Market Maker (Raydium - AMM tradicional)
          
          **PROTOCOLS SUPPORTED:**
          - **Meteora** = DLMM pools com liquidez concentrada
          - **Raydium** = CLMM (concentrado) e CPMM (tradicional) pools
          
          **KEYWORD RECOGNITION - LP (PT/EN):**
          - "pools", "pool de liquidez", "liquidity pool", "LP" → LP operations
          - "liquidez", "liquidity", "fornecer liquidez", "add liquidity" → LP operations
          - "volume", "TVL", "APY", "rendimento", "yield" → Pool analytics
          - "Meteora", "Raydium", "DLMM", "CLMM" → Protocol-specific queries
          - "posições de LP", "LP positions", "minha liquidez", "my liquidity" → getLPPositions
          - "maior volume", "top pools", "melhores pools", "best pools" → getTopLiquidityPools
          - "impermanent loss", "perda impermanente", "IL" → estimateImpermanentLoss
          - "simular", "simulate", "quanto recebo", "how much" → simulateAddLiquidity
          - "comparar", "compare", "qual melhor" → compareLiquidityPools
          - "volatilidade", "volatility", "volátil", "volatile" → getPoolVolatility or getTopVolatilityPools
          - "ranking volatilidade", "volatility ranking", "most volatile", "mais voláteis" → getTopVolatilityPools
          - "faixa ideal", "optimal range", "sugerir faixa", "suggest range", "faixa otimizada" → suggestOptimalRangeByVolatility
          
          **AVAILABLE LP TOOLS - USE THEM!:**
          - 'searchLiquidityPools' - Search pools by token pair, TVL, volume, APY, protocol
          - 'getTopLiquidityPools' - Get ranked pools by 'volume', 'apy', or 'tvl'
          - 'getPoolDetails' - Get details of a specific pool by address
          - 'getLPPositions' - Get user's LP positions across Meteora and Raydium
          - 'getLPPositionDetails' - Get details of a specific LP position
          - 'getUnclaimedLPRewards' - Check unclaimed fees/rewards
          - 'compareLiquidityPools' - Compare Meteora vs Raydium for a token pair
          - 'simulateAddLiquidity' - Simulate adding liquidity before execution
          - 'estimateImpermanentLoss' - Calculate potential IL for price change
          - 'calculateOptimalPriceRange' - Suggest price range for concentrated liquidity
          - 'getLPSwapQuote' - Get swap quote via LP
          - 'getPoolVolatility' - Calculate historical volatility (accepts tokenA/tokenB OR poolAddress)
          - 'getTopVolatilityPools' - Get ranked pools by volatility (highest first)
          - 'suggestOptimalRangeByVolatility' - Suggest price ranges based on volatility (accepts tokenA/tokenB OR poolAddress)
          
          **EXAMPLES - EXEMPLOS (When user says → Call this tool):**
          - "pools com maior volume" / "top pools by volume" → getTopLiquidityPools(criteria='volume')
          - "liste pools" / "list pools" → searchLiquidityPools()
          - "pools SOL/USDC" / "SOL USDC pools" → searchLiquidityPools(tokenA='SOL', tokenB='USDC')
          - "pools no Raydium" / "Raydium pools" → searchLiquidityPools(protocol='raydium')
          - "pools Meteora" → searchLiquidityPools(protocol='meteora')
          - "minhas posições de LP" / "my LP positions" → getLPPositions()
          - "quanto tenho de fees" / "unclaimed fees" → getUnclaimedLPRewards()
          - "compare Meteora e Raydium" / "compare protocols" → compareLiquidityPools(tokenPair='SOL/USDC')
          - "simule impermanent loss" / "estimate IL" → estimateImpermanentLoss(priceChangePercent=20)
          - "pools com APY maior que 50%" → searchLiquidityPools(minAPY=50)
          - "top 10 pools por TVL" → getTopLiquidityPools(criteria='tvl', limit=10)
          - "qual a volatilidade do SOL/USDC?" → getPoolVolatility(tokenA='SOL', tokenB='USDC')
          - "pools mais voláteis" / "most volatile pools" → getTopVolatilityPools(limit=10)
          - "ranking de volatilidade" → getTopVolatilityPools()
          - "volatilidade do pool X" → getPoolVolatility(poolAddress='X')
          - "sugira faixa para SOL/USDC" → suggestOptimalRangeByVolatility(tokenA='SOL', tokenB='USDC')
          - "sugira faixa para esse pool" → suggestOptimalRangeByVolatility(poolAddress='X')
          
          **LP BEHAVIOR RULES:**
          1. If user mentions "pools", "LP", "liquidez", "liquidity" → USE LP TOOLS, NOT just text!
          2. If protocol not specified → ASK: "Meteora ou Raydium?" OR show both
          3. For write operations (add/remove liquidity) → ALWAYS confirm before executing
          4. Show results in table format when listing multiple pools
          5. ALWAYS mention we are on SOLANA DEVNET (not mainnet)
          6. If user asks about "melhores pools" without criteria → ask "By volume, APY, or TVL?"
          7. When user asks about volatility or optimal range, use the volatility tools!
          
          **CRITICAL - DO NOT SAY "I can't do LP operations"!**
          You HAVE the tools listed above. USE THEM when user asks about pools/LP/liquidity!
        `;

            // Send message to AI (uses component-specific provider)
            const response = await aiService.sendOperatorMessage(messages, userMsg.content, systemPrompt);

            // Handle Tool Calls (if any)
            const functionCalls = response.functionCalls;

            let toolResults: any[] = [];

            if (functionCalls && functionCalls.length > 0) {
                for (const call of functionCalls) {
                    const name = call.name;
                    const args = call.args as any;

                    if (name === 'getVaultBalance') {
                        const requestedToken = args.token;

                        if (requestedToken) {
                            // Show specific token balance
                            const tokenMint = resolveTokenMint(requestedToken);

                            // Check if it's SOL
                            if (requestedToken.toUpperCase() === 'SOL' || tokenMint === 'So11111111111111111111111111111111111111112') {
                                const bal = vault.solBalance.toFixed(4);
                                const usdValue = vault.solBalance * MOCK_POOL_PRICES.SOL;
                                
                                const balanceItem: BalanceItem = {
                                    type: 'balance',
                                    network: 'solana',
                                    token: { symbol: 'SOL', mint: 'So11111111111111111111111111111111111111112' },
                                    amount: vault.solBalance,
                                    valueUsd: usdValue
                                };
                                
                                toolResults.push({
                                    type: 'success',
                                    title: 'Balance Check',
                                    details: `SOL Balance: ${bal} SOL (~$${usdValue.toFixed(2)})`,
                                    structuredData: {
                                        resultType: 'balance',
                                        items: [balanceItem],
                                        title: 'SOL Balance'
                                    }
                                });
                            } else {
                                // Find the token in assets
                                const asset = vault.assets?.find((a: any) => a.mint === tokenMint);
                                if (asset) {
                                    const amount = parseFloat(asset.amount) / Math.pow(10, asset.decimals);
                                    const usdValue = asset.symbol !== 'UNKNOWN'
                                        ? amount * (MOCK_POOL_PRICES[asset.symbol] || 0)
                                        : 0;
                                    
                                    const balanceItem: BalanceItem = {
                                        type: 'balance',
                                        network: 'solana',
                                        token: { symbol: asset.symbol, mint: asset.mint },
                                        amount: amount,
                                        valueUsd: usdValue
                                    };
                                    
                                    toolResults.push({
                                        type: 'success',
                                        title: 'Balance Check',
                                        details: `${asset.name} (${asset.symbol}): ${amount.toFixed(4)}${usdValue > 0 ? ` (~$${usdValue.toFixed(2)})` : ''}`,
                                        structuredData: {
                                            resultType: 'balance',
                                            items: [balanceItem],
                                            title: `${asset.symbol} Balance`
                                        }
                                    });
                                } else {
                                    toolResults.push({
                                        type: 'error',
                                        title: 'Token Not Found',
                                        details: `No balance found for token: ${requestedToken}`
                                    });
                                }
                            }
                        } else {
                            // Show all balances
                            const solBal = vault.solBalance.toFixed(4);
                            const solUsd = vault.solBalance * MOCK_POOL_PRICES.SOL;

                            let balanceDetails = `SOL: ${solBal} SOL (~$${solUsd.toFixed(2)})`;
                            
                            // Build structured balance items
                            const balanceItems: BalanceItem[] = [{
                                type: 'balance',
                                network: 'solana',
                                token: { symbol: 'SOL', mint: 'So11111111111111111111111111111111111111112' },
                                amount: vault.solBalance,
                                valueUsd: solUsd
                            }];

                            // Add all tokens
                            const tokens = (vault.assets || []).filter((a: any) => !a.isNft);
                            if (tokens.length > 0) {
                                balanceDetails += '\n\nTokens:';
                                tokens.forEach((token: any) => {
                                    const amount = parseFloat(token.amount) / Math.pow(10, token.decimals);
                                    const usdValue = token.symbol !== 'UNKNOWN'
                                        ? amount * (MOCK_POOL_PRICES[token.symbol] || 0)
                                        : 0;
                                    balanceDetails += `\n• ${token.name} (${token.symbol}): ${amount.toFixed(4)}${usdValue > 0 ? ` (~$${usdValue.toFixed(2)})` : ''}`;
                                    
                                    balanceItems.push({
                                        type: 'balance',
                                        network: 'solana',
                                        token: { symbol: token.symbol, mint: token.mint },
                                        amount: amount,
                                        valueUsd: usdValue
                                    });
                                });
                            }

                            toolResults.push({
                                type: 'success',
                                title: 'Balance Check',
                                details: balanceDetails,
                                structuredData: {
                                    resultType: 'balances',
                                    items: balanceItems,
                                    title: 'Solana Vault Balances',
                                    summary: `${balanceItems.length} asset${balanceItems.length > 1 ? 's' : ''}`
                                }
                            });
                        }

                        if (vault.publicKey) refreshBalance(vault.publicKey);

                    } else if (name === 'withdrawSol') {
                        setAiStatus('Withdrawing Funds...');
                        if (!vault.isUnlocked || !vault.encryptedPrivateKey) {
                            toolResults.push({ type: 'error', title: 'Withdraw Failed', details: 'Vault is locked.' });
                        } else if (!vault.ownerPublicKey) {
                            toolResults.push({ type: 'error', title: 'Withdraw Failed', details: 'No Owner Wallet connected.' });
                        } else {
                            try {
                                // Reconstruct keypair
                                const decryptedStr = await CryptoService.decrypt(vault.encryptedPrivateKey, password);
                                const secretKey = Uint8Array.from(JSON.parse(decryptedStr));
                                const kp = Keypair.fromSecretKey(secretKey);

                                const sig = await solanaService.transferSol(kp, vault.ownerPublicKey, args.amount);
                                addActivityLog('Transfer', `Withdrew ${args.amount} SOL to Owner`, sig);
                                
                                const txItem: TransactionItem = {
                                    type: 'transaction',
                                    network: 'solana',
                                    status: 'success',
                                    title: 'Withdraw Executed',
                                    description: 'SOL transferred to Owner wallet',
                                    txHash: sig,
                                    explorerUrl: `https://solscan.io/tx/${sig}`,
                                    details: {
                                        from: vault.publicKey,
                                        to: vault.ownerPublicKey,
                                        amount: args.amount,
                                        token: 'SOL'
                                    }
                                };
                                
                                toolResults.push({
                                    type: 'success',
                                    title: 'Withdraw Executed',
                                    details: `Sent ${args.amount} SOL to Owner`,
                                    tx: sig,
                                    structuredData: {
                                        resultType: 'transaction',
                                        items: [txItem],
                                        title: 'Withdraw Completed'
                                    }
                                });
                                refreshBalance(vault.publicKey!);
                            } catch (err: any) {
                                toolResults.push({ type: 'error', title: 'Withdraw Error', details: err.message });
                            }
                        }

                    } else if (name === 'transferToken') {
                        setAiStatus('Transferring Token...');
                        if (!vault.isUnlocked || !vault.encryptedPrivateKey) {
                            toolResults.push({ type: 'error', title: 'Transfer Failed', details: 'Vault is locked.' });
                        } else if (!vault.ownerPublicKey) {
                            toolResults.push({ type: 'error', title: 'Transfer Failed', details: 'No Owner Wallet connected.' });
                        } else {
                            try {
                                // Reconstruct keypair
                                const decryptedStr = await CryptoService.decrypt(vault.encryptedPrivateKey, password);
                                const secretKey = Uint8Array.from(JSON.parse(decryptedStr));
                                const kp = Keypair.fromSecretKey(secretKey);

                                const mint = resolveTokenMint(args.tokenMint);
                                // Find decimals for this token
                                const asset = vault.assets?.find((a: any) => a.mint === mint);
                                const decimals = asset ? asset.decimals : 9; // Default to 9 if not found (risky but fallback)
                                const tokenSymbol = asset?.symbol || args.tokenMint;

                                // SECURITY: FORCE DESTINATION TO BE OWNER
                                const sig = await solanaService.transferToken(
                                    kp,
                                    mint,
                                    vault.ownerPublicKey,
                                    args.amount,
                                    decimals
                                );

                                addActivityLog('Transfer', `Sent ${args.amount} ${tokenSymbol} to Owner`, sig);

                                const txItem: TransactionItem = {
                                    type: 'transaction',
                                    network: 'solana',
                                    status: 'success',
                                    title: 'Transfer Executed',
                                    description: `${tokenSymbol} transferred to Owner wallet`,
                                    txHash: sig,
                                    explorerUrl: `https://solscan.io/tx/${sig}`,
                                    details: {
                                        from: vault.publicKey,
                                        to: vault.ownerPublicKey,
                                        amount: args.amount,
                                        token: tokenSymbol
                                    }
                                };

                                toolResults.push({
                                    type: 'success',
                                    title: 'Transfer Executed',
                                    details: `Sent ${args.amount} of ${tokenSymbol} to Owner`,
                                    tx: sig,
                                    structuredData: {
                                        resultType: 'transaction',
                                        items: [txItem],
                                        title: 'Transfer Completed'
                                    }
                                });
                                refreshBalance(vault.publicKey!);
                            } catch (err: any) {
                                toolResults.push({ type: 'error', title: 'Transfer Error', details: err.message });
                            }
                        }

                    } else if (name === 'executeSwap') {
                        if (!vault.isUnlocked || !vault.encryptedPrivateKey) {
                            toolResults.push({ type: 'error', title: 'Swap Failed', details: 'Vault is locked.' });
                        } else {
                            try {
                                // Reconstruct keypair
                                const decryptedStr = await CryptoService.decrypt(vault.encryptedPrivateKey, password);
                                const secretKey = Uint8Array.from(JSON.parse(decryptedStr));
                                const kp = Keypair.fromSecretKey(secretKey);

                                const inMint = resolveTokenMint(args.inputToken);
                                const outMint = resolveTokenMint(args.outputToken);

                                // Pass status callback to capture real-time progress
                                const sig = await solanaService.executeSwap(
                                    kp,
                                    inMint,
                                    outMint,
                                    args.amount as number,
                                    (status) => setAiStatus(status)
                                );

                                addActivityLog('Swap', `Swapped ${args.amount} ${args.inputToken} -> ${args.outputToken}`, sig);

                                const txItem: TransactionItem = {
                                    type: 'transaction',
                                    network: 'solana',
                                    status: 'success',
                                    title: 'Swap Executed',
                                    description: `${args.inputToken} → ${args.outputToken}`,
                                    txHash: sig,
                                    explorerUrl: `https://solscan.io/tx/${sig}`,
                                    details: {
                                        amount: args.amount,
                                        token: `${args.inputToken} → ${args.outputToken}`
                                    }
                                };

                                toolResults.push({
                                    type: 'success',
                                    title: 'Swap Executed',
                                    details: `Swapped ${args.amount} ${args.inputToken} for ${args.outputToken}`,
                                    tx: sig,
                                    structuredData: {
                                        resultType: 'transaction',
                                        items: [txItem],
                                        title: 'Swap Completed'
                                    }
                                });
                                if (vault.publicKey) refreshBalance(vault.publicKey);
                            } catch (err: any) {
                                // Handle timeout errors gracefully
                                if (err.message?.includes('timeout') || err.message?.includes('expired')) {
                                    console.warn(`[Swap] ⚠️  Swap confirmation timeout, but transaction may have succeeded. Check manually.`);
                                    
                                    const txItem: TransactionItem = {
                                        type: 'transaction',
                                        network: 'solana',
                                        status: 'pending',
                                        title: 'Swap Executed (Slow Confirmation)',
                                        description: 'Transaction sent but confirmation is slow'
                                    };
                                    
                                    toolResults.push({
                                        type: 'success', // Mark as success with warning
                                        title: 'Swap Executed (Slow Confirmation)',
                                        details: `Transaction sent but confirmation is slow. Please verify on explorer.`,
                                        tx: 'Check Explorer',
                                        structuredData: {
                                            resultType: 'transaction',
                                            items: [txItem],
                                            title: 'Swap Pending Confirmation'
                                        }
                                    });
                                    refreshBalance(vault.publicKey!);
                                } else {
                                    toolResults.push({ type: 'error', title: 'Swap Failed', details: err.message });
                                }
                            }
                        }

                    } else if (name === 'scheduleTask') {
                        try {
                            console.log('[Scheduler] 📋 Received scheduleTask call with args:', JSON.stringify(args, null, 2));

                            let executeAt: number | undefined = undefined;
                            let condition: any = undefined;

                            // NEW STRUCTURED APPROACH: Use explicit parameters
                            if (args.conditionIndicator && args.conditionSymbol && args.conditionOperator && args.conditionValue !== undefined && args.conditionTimeframe) {
                                // CONDITION-BASED SCHEDULING
                                let indicator = args.conditionIndicator.toLowerCase();
                                let symbol = args.conditionSymbol.toUpperCase();
                                let timeframe = args.conditionTimeframe;
                                let operator = args.conditionOperator;
                                let value = parseFloat(args.conditionValue);

                                // Normalize symbol (BTC -> BTCUSDT)
                                if (symbol === 'BTC') symbol = 'BTCUSDT';
                                else if (symbol === 'SOL') symbol = 'SOLUSDT';
                                else if (symbol === 'ETH') symbol = 'ETHUSDT';
                                else if (!symbol.includes('USDT') && !symbol.includes('USD')) {
                                    symbol = `${symbol}USDT`;
                                }

                                // Normalize operator
                                if (operator === 'menor que' || operator === 'less than') operator = '<';
                                else if (operator === 'maior que' || operator === 'greater than') operator = '>';
                                else if (operator === 'menor ou igual a' || operator === 'less than or equal to') operator = '<=';
                                else if (operator === 'maior ou igual a' || operator === 'greater than or equal to') operator = '>=';
                                else if (operator === 'igual a' || operator === 'equal to' || operator === 'equals') operator = '==';

                                condition = {
                                    symbol,
                                    indicator,
                                    operator,
                                    value,
                                    timeframe
                                };

                                console.log('[Scheduler] ✅ Condition-based task created:', condition);

                            } else if (args.delayMinutes) {
                                // TIME-BASED SCHEDULING
                                executeAt = Date.now() + (args.delayMinutes * 60 * 1000);
                                console.log('[Scheduler] ⏰ Time-based task created: executes in', args.delayMinutes, 'minutes');

                            } else {
                                // MISSING PARAMETERS - This should not happen if LLM follows instructions
                                console.error('[Scheduler] ❌ Missing required parameters for scheduling');
                                toolResults.push({
                                    type: 'error',
                                    title: 'Scheduling Failed',
                                    details: 'Missing required parameters. Please provide either time delay or condition details.'
                                });
                                continue;
                            }

                            // Build task params based on type
                            let params: any = {};
                            if (args.taskType === 'SWAP') {
                                params = {
                                    inputToken: args.inputToken,
                                    outputToken: args.outputToken,
                                    amount: args.amount
                                };
                            } else if (args.taskType === 'TRANSFER') {
                                // Resolve token mint for transfer
                                let tokenMint = args.inputToken;
                                if (tokenMint === 'SOL' || tokenMint === 'sol') {
                                    tokenMint = 'So11111111111111111111111111111111111111112';
                                } else {
                                    tokenMint = resolveTokenMint(tokenMint);
                                }

                                params = {
                                    amount: args.amount,
                                    tokenMint: tokenMint
                                };
                            } else if (args.taskType === 'ALERT') {
                                // No params needed for ALERT
                                params = {};
                            } else if (args.taskType === 'HL_ORDER') {
                                // Hyperliquid Order parameters
                                params = {
                                    coin: args.coin,
                                    side: args.isBuy ? 'B' : 'A', // B = Buy (LONG), A = Ask/Sell (SHORT)
                                    isBuy: args.isBuy, // Also store as boolean for scheduler
                                    size: args.size,
                                    usdcAmount: args.usdcAmount, // Store USDC amount for dynamic size calculation
                                    price: args.price,
                                    orderType: args.orderType || 'limit',
                                    leverage: args.leverage || 1,
                                    stopLoss: args.stopLoss,
                                    takeProfit: args.takeProfit,
                                    reduceOnly: args.reduceOnly || false
                                };
                            }

                            // Create and save the task
                            const newTask = {
                                id: Date.now().toString(),
                                type: args.taskType as ScheduledTask['type'],
                                params: JSON.stringify(params),
                                executeAt,
                                condition,
                                status: 'active' as const,
                                createdAt: Date.now()
                            };

                            setScheduledTasks(prev => {
                                const updated = [...prev, newTask];
                                StorageService.setItem(
                                    StorageService.getUserKey('agent_scheduled_tasks'),
                                    JSON.stringify(updated)
                                );
                                return updated;
                            });

                            // Build confirmation message
                            let confirmMsg = '';
                            if (condition) {
                                confirmMsg = `${args.taskType} scheduled to execute when ${condition.indicator.toUpperCase()} of ${condition.symbol} (${condition.timeframe}) ${condition.operator} ${condition.value}`;
                            } else if (executeAt) {
                                const delaySeconds = Math.round((executeAt - Date.now()) / 1000);
                                confirmMsg = `${args.taskType} scheduled to execute in ${delaySeconds} seconds`;
                            }

                            toolResults.push({
                                type: 'info',
                                title: 'Task Scheduled',
                                details: confirmMsg
                            });

                        } catch (err: any) {
                            console.error('[Scheduler] Error scheduling task:', err);
                            toolResults.push({
                                type: 'error',
                                title: 'Scheduling Failed',
                                details: err.message
                            });
                        }
                    } else if (name === 'getMarketPrice') {
                        try {
                            setAiStatus('Fetching Market Price...');
                            const data = await marketDataMCP.getMarketPrice(args.symbol);
                            toolResults.push({
                                type: 'success',
                                title: 'Market Price',
                                details: `${args.symbol}: ${data.price} (${data.exchange})`
                            });
                        } catch (err: any) {
                            toolResults.push({ type: 'error', title: 'Market Data Error', details: err.message });
                        }
                    } else if (name === 'getOHLCV') {
                        try {
                            setAiStatus('Fetching OHLCV Data...');
                            const data = await marketDataMCP.getOHLCV(args.symbol, args.timeframe);
                            toolResults.push({
                                type: 'success',
                                title: 'OHLCV Data',
                                details: `${args.symbol} [${args.timeframe || '60'}]: O:${data.open} H:${data.high} L:${data.low} C:${data.close} V:${data.volume}`
                            });
                        } catch (err: any) {
                            toolResults.push({ type: 'error', title: 'OHLCV Error', details: err.message });
                        }
                    } else if (name === 'getIndicator') {
                        try {
                            setAiStatus(`Calculating ${args.indicator}...`);
                            const data = await marketDataMCP.getIndicator(args.symbol, args.indicator, args.timeframe);
                            let valueDisplay = data.value;
                            if (typeof data.value === 'object' && data.value !== null) {
                                valueDisplay = JSON.stringify(data.value, null, 2);
                            }
                            toolResults.push({
                                type: 'success',
                                title: 'Technical Indicator',
                                details: `${args.symbol} ${data.indicator.toUpperCase()}: ${valueDisplay}`
                            });
                        } catch (err: any) {
                            toolResults.push({ type: 'error', title: 'Indicator Error', details: err.message });
                        }
                    } else if (name === 'getTradingViewSummary') {
                        try {
                            setAiStatus('Fetching TradingView Summary...');
                            const data = await marketDataMCP.getTradingViewSummary(args.symbol);
                            toolResults.push({
                                type: 'success',
                                title: 'TradingView Summary',
                                details: `${args.symbol}: ${data.recommendation} (Buy:${data.buy} Sell:${data.sell} Neutral:${data.neutral})`
                            });
                        } catch (err: any) {
                            toolResults.push({ type: 'error', title: 'Summary Error', details: err.message });
                        }
                    } else if (name === 'getHLBalance') {
                        try {
                            if (!vault.hlPublicKey) {
                                toolResults.push({ type: 'error', title: 'HL Error', details: 'Hyperliquid Vault not created/unlocked.' });
                            } else {
                                setAiStatus('Fetching HL Balance...');
                                const userState = await hyperliquidMCP.getUserState(vault.hlPublicKey);

                                console.log('[HL Debug] FULL USER STATE:', JSON.stringify(userState, null, 2));

                                const accountValue = parseFloat(userState.marginSummary.accountValue);
                                const withdrawable = parseFloat(userState.withdrawable);
                                const positions = userState.assetPositions.filter((p: any) => parseFloat(p.position.szi) !== 0);

                                // Build text fallback
                                let details = `USDC Account Value: $${accountValue.toFixed(2)}`;
                                details += `\nWithdrawable: $${withdrawable.toFixed(2)}`;
                                if (positions.length > 0) {
                                    details += '\n\nOpen Positions:';
                                    positions.forEach((p: any) => {
                                        details += `\n• ${p.position.coin} ${parseFloat(p.position.szi) > 0 ? 'LONG' : 'SHORT'} ${Math.abs(parseFloat(p.position.szi))} @ ${p.position.entryPx}`;
                                    });
                                } else {
                                    details += '\nNo open positions.';
                                }

                                // Build structured data
                                const balanceItem: BalanceItem = {
                                    type: 'balance',
                                    network: 'hyperliquid',
                                    token: { symbol: 'USDC' },
                                    amount: accountValue,
                                    valueUsd: accountValue
                                };

                                const positionItems: PositionItem[] = positions.map((p: any) => {
                                    const size = parseFloat(p.position.szi);
                                    const entryPrice = parseFloat(p.position.entryPx);
                                    const unrealizedPnl = parseFloat(p.position.unrealizedPnl || 0);
                                    const leverage = parseFloat(p.position.leverage?.value || 1);
                                    const marginUsed = parseFloat(p.position.marginUsed || 0);
                                    const liquidationPx = parseFloat(p.position.liquidationPx || 0);
                                    
                                    return {
                                        type: 'position' as const,
                                        protocol: 'hyperliquid' as const,
                                        coin: p.position.coin,
                                        direction: size > 0 ? 'long' as const : 'short' as const,
                                        size: Math.abs(size),
                                        entryPrice: entryPrice,
                                        valueUsd: Math.abs(size) * entryPrice,
                                        leverage: leverage,
                                        marginUsed: marginUsed,
                                        liquidationPrice: liquidationPx > 0 ? liquidationPx : undefined,
                                        pnl: {
                                            value: unrealizedPnl,
                                            percent: (unrealizedPnl / (marginUsed || 1)) * 100
                                        }
                                    };
                                });

                                toolResults.push({
                                    type: 'success',
                                    title: 'Hyperliquid Balance',
                                    details: details,
                                    structuredData: {
                                        resultType: positions.length > 0 ? 'positions' : 'balance',
                                        items: positions.length > 0 ? [balanceItem, ...positionItems] : [balanceItem],
                                        title: 'Hyperliquid Account',
                                        summary: positions.length > 0 ? `$${accountValue.toFixed(2)} • ${positions.length} position${positions.length > 1 ? 's' : ''}` : `$${accountValue.toFixed(2)}`
                                    }
                                });
                            }
                        } catch (err: any) {
                            toolResults.push({ type: 'error', title: 'HL Balance Error', details: err.message });
                        }
                    } else if (name === 'getHLMarketData') {
                        try {
                            setAiStatus('Fetching HL Market Data...');
                            const data = await hyperliquidMCP.getMarketData(args.coin);
                            // L2 Book structure: { levels: [[px, sz, n], ...], ... }
                            // We just want a summary
                            const bestBid = data.levels[0][0].px;
                            const bestAsk = data.levels[1][0].px;
                            toolResults.push({
                                type: 'success',
                                title: `Hyperliquid ${args.coin}`,
                                details: `Best Bid: ${bestBid}\nBest Ask: ${bestAsk}`
                            });
                        } catch (err: any) {
                            toolResults.push({ type: 'error', title: 'HL Market Data Error', details: err.message });
                        }
                    } else if (name === 'createHLOrder') {
                        if (!vault.isUnlocked || !vault.hlEncryptedPrivateKey) {
                            toolResults.push({ type: 'error', title: 'Order Failed', details: 'Vault is locked.' });
                        } else {
                            try {
                                setAiStatus('Placing HL Order...');
                                const decryptedStr = await CryptoService.decrypt(vault.hlEncryptedPrivateKey, password);
                                const wallet = hyperliquidService.getWalletFromPrivateKey(decryptedStr);

                                // Set leverage if specified
                                if (args.leverage) {
                                    await hyperliquidMCP.updateLeverage(wallet, args.coin, args.leverage, false);
                                }

                                // Handle USDC-based orders AND Market orders
                                let orderSize = args.size;
                                let calculatedPrice: number | undefined = args.price;
                                let finalOrderType = args.orderType || 'limit';
                                let marketBasePrice: number | undefined; // Store for TP/SL calculation

                                // We need price for two cases:
                                // 1. Auto-calc size from USDC amount
                                // 2. Market orders (need to send Limit IOC with slippage)
                                const isMarket = finalOrderType === 'market';
                                const needsPriceFetch = (args.usdcAmount && !args.size) || (isMarket && !args.price);

                                if (needsPriceFetch) {
                                    console.log(`[HL Order] 🔄 Fetching price for ${isMarket ? 'Market Order' : 'USDC Calc'}`);
                                    setAiStatus('Fetching current price...');

                                    const marketData = await hyperliquidMCP.getMarketData(args.coin);
                                    // levels[0] are Bids (Buy orders), levels[1] are Asks (Sell orders)
                                    const bestBid = parseFloat(marketData.levels[0][0].px);
                                    const bestAsk = parseFloat(marketData.levels[1][0].px);

                                    // Base price: Buy = Ask (we buy from sellers), Sell = Bid (we sell to buyers)
                                    const basePrice = args.isBuy ? bestAsk : bestBid;
                                    marketBasePrice = basePrice; // Save for TP/SL

                                    // Calculate size if needed
                                    if (args.usdcAmount && !orderSize) {
                                        // Get asset decimals for correct rounding
                                        console.log(`[HL Order] 🔍 Fetching decimals for ${args.coin}`);
                                        const decimals = await hyperliquidMCP.getAssetDecimals(args.coin);
                                        console.log(`[HL Order] 📏 ${args.coin} decimals: ${decimals}`);

                                        const rawSize = args.usdcAmount / basePrice;
                                        // Round to correct number of decimals
                                        orderSize = parseFloat(rawSize.toFixed(decimals));

                                        console.log(`[HL Order] 💰 USDC: ${args.usdcAmount} / Price: ${basePrice} = Raw Size: ${rawSize} -> Rounded: ${orderSize}`);
                                    }

                                    // Calculate slippage for Market orders
                                    if (isMarket) {
                                        // 5% slippage
                                        const slippage = 0.05;
                                        let rawPrice = args.isBuy
                                            ? basePrice * (1 + slippage)
                                            : basePrice * (1 - slippage);

                                        // Hyperliquid Rule: Max 5 significant figures
                                        // And Max Decimals = 6 - szDecimals (for perps)
                                        console.log(`[HL Order] 🔍 Fetching decimals for price rounding`);
                                        const decimals = await hyperliquidMCP.getAssetDecimals(args.coin);
                                        const maxPriceDecimals = 6 - decimals; // For Perps

                                        // 1. Round to max decimal places first
                                        let roundedPrice = parseFloat(rawPrice.toFixed(maxPriceDecimals));

                                        // 2. Enforce 5 significant figures
                                        // Convert to string to count sig figs
                                        // We use toPrecision(5) which handles sig figs
                                        roundedPrice = parseFloat(roundedPrice.toPrecision(5));

                                        // 3. Ensure we didn't violate max decimals again (toPrecision might add decimals if number is small)
                                        // e.g. 0.00123456 -> toPrecision(5) -> 0.0012346 (ok)
                                        // We just clamp it again to be safe
                                        calculatedPrice = parseFloat(roundedPrice.toFixed(maxPriceDecimals));

                                        // Switch to IOC (Immediate or Cancel) which behaves like Market
                                        finalOrderType = 'ioc';
                                        console.log(`[HL Order] 🚀 Market Order: Base ${basePrice} -> Raw ${rawPrice.toFixed(6)} -> Rounded ${calculatedPrice}`);
                                    }
                                }

                                if (!orderSize) {
                                    throw new Error('Either size or usdcAmount must be provided');
                                }

                                // For limit orders with user-provided price, round to valid tick size
                                if (finalOrderType === 'limit' && calculatedPrice) {
                                    const decimals = await hyperliquidMCP.getAssetDecimals(args.coin);
                                    const maxPriceDecimals = Math.max(0, 6 - decimals);
                                    let roundedPrice = parseFloat(calculatedPrice.toFixed(maxPriceDecimals));
                                    roundedPrice = parseFloat(roundedPrice.toPrecision(5));
                                    calculatedPrice = parseFloat(roundedPrice.toFixed(maxPriceDecimals));
                                    console.log(`[HL Order] 🏷️  Limit price rounded: ${args.price} -> ${calculatedPrice} (maxDecimals=${maxPriceDecimals})`);
                                }

                                if (finalOrderType === 'limit' && !calculatedPrice) {
                                    throw new Error('Price is required for Limit orders');
                                }

                                // Calculate absolute TP/SL prices from percentages
                                // Use market base price (not slippage price) for accurate TP/SL targets
                                let calculatedStopLoss = args.stopLoss;
                                let calculatedTakeProfit = args.takeProfit;

                                // Use marketBasePrice if available (market orders), otherwise use calculatedPrice (limit orders)
                                const priceForTpSl = marketBasePrice || calculatedPrice;

                                if (priceForTpSl) {
                                    // Detect if values are percentages (value < 100 likely means %)
                                    // For SHORT: SL is ABOVE entry, TP is BELOW entry
                                    // For LONG: SL is BELOW entry, TP is ABOVE entry

                                    if (args.stopLoss && args.stopLoss < 100) {
                                        // Treat as percentage
                                        if (args.isBuy) {
                                            // LONG: Stop Loss below entry
                                            calculatedStopLoss = priceForTpSl * (1 - args.stopLoss / 100);
                                        } else {
                                            // SHORT: Stop Loss above entry
                                            calculatedStopLoss = priceForTpSl * (1 + args.stopLoss / 100);
                                        }
                                        console.log(`[HL Order] 📊 SL %: ${args.stopLoss}% -> Absolute: ${calculatedStopLoss?.toFixed(2)} (from base ${priceForTpSl})`);
                                    }

                                    if (args.takeProfit && args.takeProfit < 100) {
                                        // Treat as percentage
                                        if (args.isBuy) {
                                            // LONG: Take Profit above entry
                                            calculatedTakeProfit = priceForTpSl * (1 + args.takeProfit / 100);
                                        } else {
                                            // SHORT: Take Profit below entry
                                            calculatedTakeProfit = priceForTpSl * (1 - args.takeProfit / 100);
                                        }
                                        console.log(`[HL Order] 📊 TP %: ${args.takeProfit}% -> Absolute: ${calculatedTakeProfit?.toFixed(2)} (from base ${priceForTpSl})`);
                                    }
                                }


                                setAiStatus('Placing HL Order...');
                                const result = await hyperliquidMCP.createOrder(
                                    wallet,
                                    args.coin,
                                    args.isBuy,
                                    orderSize,
                                    calculatedPrice,
                                    {
                                        orderType: finalOrderType,
                                        reduceOnly: args.reduceOnly || false,
                                        stopLoss: calculatedStopLoss,
                                        takeProfit: calculatedTakeProfit
                                    }
                                );


                                const orderTypeStr = (args.orderType || 'limit').toUpperCase();
                                const leverageStr = args.leverage ? ` (${args.leverage}x leverage)` : '';
                                const priceStr = calculatedPrice ? ` @ ${calculatedPrice}` : '';
                                const usdcStr = args.usdcAmount ? ` (${args.usdcAmount} USDC)` : '';
                                const tpslStr = (calculatedStopLoss || calculatedTakeProfit)
                                    ? ` [SL: ${calculatedStopLoss ? calculatedStopLoss.toFixed(2) : 'none'}, TP: ${calculatedTakeProfit ? calculatedTakeProfit.toFixed(2) : 'none'}]`
                                    : '';

                                const txItem: TransactionItem = {
                                    type: 'transaction',
                                    network: 'hyperliquid',
                                    status: 'success',
                                    title: 'Order Placed',
                                    description: `${orderTypeStr} ${args.isBuy ? 'LONG' : 'SHORT'} ${args.coin}`,
                                    details: {
                                        amount: orderSize,
                                        token: args.coin
                                    }
                                };

                                toolResults.push({
                                    type: 'success',
                                    title: 'Order Placed',
                                    details: `Placed ${orderTypeStr} ${args.isBuy ? 'LONG' : 'SHORT'} ${orderSize.toFixed(4)} ${args.coin}${usdcStr}${priceStr}${leverageStr}${tpslStr}`,
                                    structuredData: {
                                        resultType: 'transaction',
                                        items: [txItem],
                                        title: 'Order Executed'
                                    }
                                });
                            } catch (err: any) {
                                toolResults.push({ type: 'error', title: 'Order Failed', details: err.message });
                            }
                        }
                    } else if (name === 'updateHLLeverage') {
                        if (!vault.isUnlocked || !vault.hlEncryptedPrivateKey) {
                            toolResults.push({ type: 'error', title: 'Leverage Update Failed', details: 'Vault is locked.' });
                        } else {
                            try {
                                setAiStatus('Updating Leverage...');
                                const decryptedStr = await CryptoService.decrypt(vault.hlEncryptedPrivateKey, password);
                                const wallet = hyperliquidService.getWalletFromPrivateKey(decryptedStr);

                                const result = await hyperliquidMCP.updateLeverage(
                                    wallet,
                                    args.coin,
                                    args.leverage,
                                    args.isCross
                                );

                                toolResults.push({
                                    type: 'success',
                                    title: 'Leverage Updated',
                                    details: `Set ${args.coin} leverage to ${args.leverage}x (${args.isCross ? 'Cross' : 'Isolated'})`,
                                    structuredData: {
                                        resultType: 'transaction',
                                        items: [{
                                            type: 'transaction',
                                            network: 'hyperliquid',
                                            status: 'success',
                                            title: 'Leverage Updated',
                                            description: `${args.coin} leverage set to ${args.leverage}x ${args.isCross ? 'Cross' : 'Isolated'}`
                                        }],
                                        title: 'Leverage Updated'
                                    }
                                });
                            } catch (err: any) {
                                toolResults.push({ type: 'error', title: 'Leverage Update Failed', details: err.message });
                            }
                        }
                    } else if (name === 'closeHLPosition') {
                        if (!vault.isUnlocked || !vault.hlEncryptedPrivateKey) {
                            toolResults.push({ type: 'error', title: 'Close Failed', details: 'Vault is locked.' });
                        } else {
                            try {
                                setAiStatus('Closing Position...');
                                const decryptedStr = await CryptoService.decrypt(vault.hlEncryptedPrivateKey, password);
                                const wallet = hyperliquidService.getWalletFromPrivateKey(decryptedStr);

                                try {
                                    setAiStatus('Closing HL Position...');

                                    try {
                                        // Try closing normally first
                                        const result = await hyperliquidMCP.closePosition(
                                            wallet,
                                            args.coin,
                                            args.size,
                                            args.orderType || 'market',
                                            args.price
                                        );

                                        toolResults.push({
                                            type: 'success',
                                            title: 'Position Closed',
                                            details: `Closed ${args.size ? args.size : 'entire'} ${args.coin} position via ${args.orderType || 'market'} order`,
                                            structuredData: {
                                                resultType: 'transaction',
                                                items: [{
                                                    type: 'transaction',
                                                    network: 'hyperliquid',
                                                    status: 'success',
                                                    title: 'Position Closed',
                                                    description: `Closed ${args.size ? args.size + ' ' : ''}${args.coin} position via ${args.orderType || 'market'} order`,
                                                    details: args.size ? { amount: args.size, token: args.coin } : undefined
                                                }],
                                                title: 'Position Closed'
                                            }
                                        });
                                    } catch (innerErr: any) {
                                        // Handle "Insufficient margin" specifically for Isolated positions
                                        if (innerErr.message && innerErr.message.includes('Insufficient margin')) {
                                            console.log('[HL Close] Insufficient margin detected. Attempting to Add Isolated Margin...');
                                            setAiStatus('Insufficient Margin. Adding Funds...');

                                            // 1. Fetch User State to check available balance
                                            const userState = await hyperliquidMCP.getUserState(wallet.address);
                                            const position = userState.assetPositions.find((p: any) => p.position.coin === args.coin);

                                            if (position) {
                                                const szi = parseFloat(position.position.szi);
                                                const positionIsLong = szi > 0;
                                                const withdrawable = parseFloat(userState.withdrawable);

                                                // 2. Calculate dynamic margin to add
                                                // - Try to add 20 USDC (requested by user)
                                                // - But don't exceed available balance (leave 2 USDC buffer)
                                                let marginToAdd = 20;

                                                if (withdrawable < 25) {
                                                    // If balance is tight, just use what we can (safe max)
                                                    marginToAdd = Math.max(0, withdrawable - 2);
                                                }

                                                if (marginToAdd < 1) {
                                                    throw new Error(`Insufficient margin to close and wallet balance is too low ($${withdrawable.toFixed(2)}) to add more margin.`);
                                                }

                                                console.log(`[HL Close] Wallet Balance: ${withdrawable}, Adding Margin: ${marginToAdd}`);

                                                // 3. Add Margin
                                                await hyperliquidMCP.updateIsolatedMargin(wallet, args.coin, positionIsLong, marginToAdd);

                                                // 4. Retry Close
                                                console.log('[HL Close] Retrying close after adding margin...');
                                                setAiStatus('Retrying Close Position...');

                                                await hyperliquidMCP.closePosition(
                                                    wallet,
                                                    args.coin,
                                                    args.size,
                                                    args.orderType || 'market',
                                                    args.price
                                                );

                                                toolResults.push({
                                                    type: 'success',
                                                    title: 'Position Closed (Recovered)',
                                                    details: `Added ${marginToAdd.toFixed(2)} USDC margin to cover loss and closed ${args.coin} position successfully.`,
                                                    structuredData: {
                                                        resultType: 'transaction',
                                                        items: [{
                                                            type: 'transaction',
                                                            network: 'hyperliquid',
                                                            status: 'success',
                                                            title: 'Position Closed (Recovered)',
                                                            description: `Added ${marginToAdd.toFixed(2)} USDC margin and closed ${args.coin} position`
                                                        }],
                                                        title: 'Position Closed'
                                                    }
                                                });
                                            } else {
                                                throw new Error("Position not found during margin recovery.");
                                            }
                                        } else if (innerErr.message && innerErr.message.includes('Cross margin is not allowed')) {
                                            // Fallback for previous error if it persists
                                            toolResults.push({ type: 'error', title: 'Close Failed', details: 'Cross margin not supported and insufficient isolated margin.' });
                                        } else {
                                            throw innerErr; // Rethrow other errors
                                        }
                                    }

                                } catch (err: any) {
                                    toolResults.push({ type: 'error', title: 'Close Failed', details: err.message });
                                }
                            } catch (err: any) {
                                toolResults.push({ type: 'error', title: 'Close Failed', details: err.message });
                            }
                        }
                    } else if (name === 'cancelHLOrder') {
                        if (!vault.isUnlocked || !vault.hlEncryptedPrivateKey) {
                            toolResults.push({ type: 'error', title: 'Cancel Failed', details: 'Vault is locked.' });
                        } else {
                            try {
                                setAiStatus('Cancelling HL Order...');
                                const decryptedStr = await CryptoService.decrypt(vault.hlEncryptedPrivateKey, password);
                                const wallet = hyperliquidService.getWalletFromPrivateKey(decryptedStr);

                                const result = await hyperliquidMCP.cancelOrder(
                                    wallet,
                                    args.coin,
                                    args.orderId
                                );

                                toolResults.push({
                                    type: 'success',
                                    title: 'Order Cancelled',
                                    details: `Cancelled Order ${args.orderId}. Status: ${result.status}`,
                                    structuredData: {
                                        resultType: 'transaction',
                                        items: [{
                                            type: 'transaction',
                                            network: 'hyperliquid',
                                            status: 'success',
                                            title: 'Order Cancelled',
                                            description: `Order ${args.orderId} for ${args.coin} cancelled`
                                        }],
                                        title: 'Order Cancelled'
                                    }
                                });
                            } catch (err: any) {
                                toolResults.push({ type: 'error', title: 'Cancel Failed', details: err.message });
                            }
                        }
                    } else if (name === 'withdrawFromHL') {
                        if (!vault.isUnlocked || !vault.hlEncryptedPrivateKey) {
                            toolResults.push({
                                type: 'error',
                                title: 'Withdrawal Failed',
                                details: 'Hyperliquid Vault is locked.'
                            });
                        } else if (!vault.hlOwnerPublicKey) {
                            toolResults.push({
                                type: 'error',
                                title: 'Withdrawal Failed',
                                details: 'No Hyperliquid Owner Wallet connected. Please connect your MetaMask wallet first.'
                            });
                        } else if (vault.hlOwnerPublicKey && !vault.hlOwnerPublicKey.startsWith('0x')) {
                             toolResults.push({
                                type: 'error',
                                title: 'Withdrawal Failed',
                                details: `Invalid Hyperliquid Owner Address: ${vault.hlOwnerPublicKey}. It must be an EVM address (start with 0x). You might be trying to send to a Solana wallet.`
                            });
                        } else {
                            try {
                                setAiStatus('Withdrawing from Hyperliquid...');
                                const decryptedStr = await CryptoService.decrypt(vault.hlEncryptedPrivateKey, password);
                                const wallet = hyperliquidService.getWalletFromPrivateKey(decryptedStr);

                                // Withdraw USDC to owner's EVM wallet (hlOwnerPublicKey)
                                const result = await hyperliquidMCP.withdrawUSDC(
                                    wallet,
                                    vault.hlOwnerPublicKey, // Owner's MetaMask wallet address
                                    args.amount
                                );

                                addActivityLog(
                                    'HL Withdrawal',
                                    `Withdrew ${args.amount} USDC from Hyperliquid`,
                                    result.response?.data?.statuses?.[0]?.tx || 'pending'
                                );

                                toolResults.push({
                                    type: 'success',
                                    title: 'Hyperliquid Withdrawal Initiated',
                                    details: `Withdrawing ${args.amount} USDC to ${vault.hlOwnerPublicKey.slice(0, 6)}...${vault.hlOwnerPublicKey.slice(-4)}. Fee: $1 USDC. ETA: ~5 minutes.`,
                                    structuredData: {
                                        resultType: 'transaction',
                                        items: [{
                                            type: 'transaction',
                                            network: 'hyperliquid',
                                            status: 'pending',
                                            title: 'Withdrawal Initiated',
                                            description: `${args.amount} USDC to ${vault.hlOwnerPublicKey.slice(0, 6)}...${vault.hlOwnerPublicKey.slice(-4)}`,
                                            details: { amount: args.amount, token: 'USDC', fee: 1 }
                                        }],
                                        title: 'Withdrawal Pending'
                                    }
                                });
                            } catch (err: any) {
                                // Check for specific error about deposit requirement
                                if (err.message?.includes('Must deposit before performing actions')) {
                                    toolResults.push({
                                        type: 'error',
                                        title: 'Deposit Required',
                                        details: 'Your Hyperliquid account needs an initial deposit before you can perform any actions. Please deposit USDC to your Hyperliquid vault address first.'
                                    });
                                } else {
                                    toolResults.push({
                                        type: 'error',
                                        title: 'Withdrawal Error',
                                        details: err.message
                                    });
                                }
                            }
                        }
                    } else if (name === 'getHLTransfers') {
                        if (!vault.hlPublicKey) {
                            toolResults.push({ type: 'error', title: 'HL Error', details: 'Hyperliquid Vault not created/unlocked.' });
                        } else {
                            try {
                                setAiStatus('Fetching Transfer History...');
                                const updates = await hyperliquidMCP.getUserLedgerUpdates(vault.hlPublicKey);
                                
                                if (updates.length === 0) {
                                    toolResults.push({
                                        type: 'success',
                                        title: 'Transfer History',
                                        details: 'No deposits or withdrawals found.'
                                    });
                                } else {
                                    // Current time for context
                                    const now = Date.now();
                                    
                                    const historyText = updates.slice(0, 10).map((u: any) => {
                                        const date = new Date(u.time);
                                        const type = u.delta.amount > 0 ? 'Deposit' : 'Withdrawal';
                                        const amount = Math.abs(parseFloat(u.delta.amount));
                                        const status = (now - u.time) < 10 * 60 * 1000 ? 'Processing/Recent' : 'Completed'; // Estimate
                                        return `• ${type} $${amount.toFixed(2)} USDC - ${date.toLocaleString()} (${status})`;
                                    }).join('\n');

                                    toolResults.push({
                                        type: 'success',
                                        title: 'Hyperliquid Transfers',
                                        details: `Last 10 updates:\n${historyText}`,
                                        structuredData: {
                                            resultType: 'transaction',
                                            items: updates.map((u: any) => ({
                                                type: 'transaction',
                                                network: 'hyperliquid',
                                                status: 'success',
                                                title: u.delta.amount > 0 ? 'Deposit' : 'Withdrawal',
                                                description: `${u.delta.amount > 0 ? 'Deposit' : 'Withdrawal'} of $${Math.abs(parseFloat(u.delta.amount)).toFixed(2)} USDC`,
                                                details: {
                                                    amount: Math.abs(parseFloat(u.delta.amount)),
                                                    token: 'USDC',
                                                    timestamp: u.time 
                                                }
                                            })),
                                            title: 'Transfer History'
                                        }
                                    });
                                }
                            } catch (err: any) {
                                toolResults.push({ type: 'error', title: 'Transfer History Error', details: err.message });
                            }
                        }
                    } else if (name === 'getDealerTradeHistory') {
                        // Query Dealer operation history for Manager visibility
                        // Works even when Dealer is OFF - shows past operations
                        try {
                            setAiStatus('Querying Dealer history...');
                            const coin = args.coin || undefined;
                            const limit = Math.min(args.limit || 10, 50);
                            const includeReasoning = args.includeReasoning !== false;

                            const currentState = dealerStore.getSnapshot();
                            const history = dealerStore.getTradeHistory(coin, limit, includeReasoning);

                            if (history.operations.length === 0 && history.recentLogs.length === 0) {
                                // Provide contextual empty response
                                let emptyMessage = '';

                                if (coin) {
                                    emptyMessage = `Não há histórico de operações em ${coin}. O Dealer não executou trades nessa moeda.`;
                                } else if (currentState.logs.length === 0) {
                                    // Logs also empty = likely cleared or never used
                                    emptyMessage = 'Sem histórico disponível. O Dealer ainda não executou nenhum trade ou o histórico foi limpo.';
                                } else {
                                    // Has logs but no operations = analyzed but didn't trade
                                    emptyMessage = 'O Dealer analisou o mercado mas não executou nenhum trade ainda. Os sinais recebidos não atingiram o nível de confiança necessário.';
                                }

                                toolResults.push({
                                    type: 'success',
                                    title: 'Dealer History',
                                    details: emptyMessage
                                });
                            } else {
                                let details = '';

                                // Format operations
                                if (history.operations.length > 0) {
                                    details += `📊 **TRADE OPERATIONS** (${history.totalOperations} total)\n\n`;
                                    history.operations.forEach((op: any, idx: number) => {
                                        const pnlStr = op.pnl !== undefined ? ` | PnL: ${op.pnl >= 0 ? '+' : ''}$${op.pnl.toFixed(2)}` : '';
                                        const statusEmoji = op.status === 'OPEN' ? '🟢' : '⚪';
                                        details += `${statusEmoji} **${op.action} ${op.coin}** @ $${op.entryPrice?.toFixed(2) || 'N/A'}${pnlStr}\n`;
                                        details += `   Size: ${op.size} (≈$${op.sizeUSDC?.toFixed(2)}) | Confidence: ${(op.confidence * 100).toFixed(0)}%\n`;
                                        if (includeReasoning && op.fullReasoning) {
                                            details += `   **Reasoning:** ${op.fullReasoning}\n`;
                                        }
                                        details += `   Time: ${new Date(op.timestamp).toLocaleString()}\n\n`;
                                    });
                                }

                                // Format recent logs if no operations but we have logs
                                if (history.operations.length === 0 && history.recentLogs.length > 0) {
                                    details += '📝 **RECENT ANALYSIS LOGS**\n\n';
                                    history.recentLogs.forEach((log: any) => {
                                        details += `• [${log.type}] ${log.message}\n`;
                                        if (log.details?.fullReason) {
                                            details += `  Reasoning: ${log.details.fullReason}\n`;
                                        }
                                    });
                                }

                                toolResults.push({
                                    type: 'success',
                                    title: coin ? `Dealer History: ${coin}` : 'Dealer Trade History',
                                    details: details.trim()
                                });
                            }
                        } catch (err: any) {
                            toolResults.push({ type: 'error', title: 'Dealer History Error', details: err.message });
                        }
                    } else if (name === 'getHLDealerThinking') {
                        // Get Hyperliquid Dealer AI thinking/reasoning from recent cycles
                        try {
                            setAiStatus('🧠 Fetching Hyperliquid Dealer thinking...');
                            
                            const summaryState = cycleSummaryStore.getSnapshot('hyperliquid');
                            const cycleIndex = Math.min(args.cycleIndex || 0, 2); // Max 3 cycles
                            const targetCycle = summaryState.recentCycles[cycleIndex];
                            
                            if (!targetCycle && !summaryState.aiSummary) {
                                toolResults.push({
                                    type: 'success',
                                    title: 'Hyperliquid Dealer Thinking',
                                    details: 'O Hyperliquid Dealer ainda não executou nenhum ciclo de análise. Ative o Dealer e aguarde o primeiro ciclo.'
                                });
                            } else {
                                // Build HLThinkingItem for structured display
                                const thinkingItem: HLThinkingItem = {
                                    type: 'hl-thinking',
                                    cycleTimestamp: targetCycle?.timestamp || Date.now(),
                                    cycleNumber: targetCycle?.cycleNumber,
                                    aiSummary: summaryState.aiSummary || undefined,
                                    decisions: (targetCycle?.decisions || []).map(d => ({
                                        asset: d.asset,
                                        action: d.action as 'BUY' | 'SELL' | 'HOLD' | 'CLOSE',
                                        confidence: d.confidence
                                    })),
                                    assetsAnalyzed: targetCycle?.assetsAnalyzed || []
                                };
                                
                                // Get REASONING logs for additional context
                                const reasoningLogs = dealerStore.getSnapshot().logs
                                    .filter(log => log.type === 'REASONING' || log.type === 'SIGNAL')
                                    .slice(0, 3);
                                
                                let details = `Cycle #${targetCycle?.cycleNumber || 'Latest'}`;
                                if (reasoningLogs.length > 0) {
                                    details += '\n\nRecent signals:\n' + reasoningLogs.map(l => `• ${l.message}`).join('\n');
                                }
                                
                                toolResults.push({
                                    type: 'success',
                                    title: 'Hyperliquid Dealer Thinking',
                                    details,
                                    structuredData: {
                                        resultType: 'hl-thinking',
                                        items: [thinkingItem],
                                        title: 'Hyperliquid Dealer Analysis'
                                    }
                                });
                            }
                        } catch (err: any) {
                            toolResults.push({ type: 'error', title: 'HL Dealer Thinking Error', details: err.message });
                        }
                    }
                    // LP TOOL HANDLERS (Meteora, Raydium, Liquidity Pools)
                    else if (isLPTool(name)) {
                        try {
                            const lpResult = await handleLPToolCall(
                                name,
                                args,
                                vault.publicKey || undefined,
                                (status: string) => setAiStatus(status)
                            );
                            if (lpResult) {
                                toolResults.push(lpResult);
                            }
                        } catch (err: any) {
                            toolResults.push({ type: 'error', title: 'LP Tool Error', details: err.message });
                        }
                    }
                }
            }

            let modelText = "";
            if (response.candidates && response.candidates[0].content && response.candidates[0].content.parts) {
                for (const part of response.candidates[0].content.parts) {
                    if (part.text) {
                        modelText += part.text;
                    }
                }
            }

            // Logic to construct a default response if the model is silent but tools ran
            let defaultText = "I processed your request.";
            if (toolResults.length > 0) {
                const hasErrors = toolResults.some(r => r.type === 'error');
                const hasSuccess = toolResults.some(r => r.type === 'success');

                if (hasErrors && !hasSuccess) {
                    defaultText = "I encountered an issue executing that command.";
                } else if (hasSuccess) {
                    defaultText = "Action completed successfully.";
                } else if (hasErrors && hasSuccess) {
                    defaultText = "Some actions completed, but others failed.";
                }
            }

            const modelMessage: AgentMessage = {
                id: (Date.now() + 1).toString(),
                role: 'model',
                content: modelText || defaultText,
                timestamp: Date.now(),
                toolResults: toolResults
            };

            setMessages(prev => {
                const updated = [...prev, modelMessage];

                // Auto-save conversation after model response (including toolResults)
                // Use currentConvId which was captured at the start of handleSendMessage to avoid stale closure
                if (vault.isUnlocked && password && currentConvId) {
                    const conv: Conversation = {
                        id: currentConvId,
                        title: prev.length > 0 && prev[0].role === 'user' 
                            ? ConversationService.generateTitle(prev[0].content) 
                            : 'Conversation',
                        lastMessage: modelMessage.content.substring(0, 50),
                        timestamp: Date.now(),
                        messages: updated
                    };
                    ConversationService.saveConversation(conv, password).catch(err => 
                        console.error("Auto-save after model response failed", err)
                    );
                }

                return updated;
            });

        } catch (e: any) {
            console.error("AI Error:", e);
            
            const errorMessage: AgentMessage = {
                id: Date.now().toString(),
                role: 'model',
                content: "Sorry, I encountered a system error while processing that request.",
                toolResults: [{ type: 'error', title: 'System Error', details: e.message }],
                timestamp: Date.now()
            };

            setMessages(prev => {
                const updated = [...prev, errorMessage];

                // Auto-save even on error so user sees what happened
                // Use currentConvId which was captured at the start of handleSendMessage to avoid stale closure
                if (vault.isUnlocked && password && currentConvId) {
                    const conv: Conversation = {
                        id: currentConvId,
                        title: prev.length > 0 && prev[0].role === 'user' 
                            ? ConversationService.generateTitle(prev[0].content) 
                            : 'Conversation',
                        lastMessage: errorMessage.content.substring(0, 50),
                        timestamp: Date.now(),
                        messages: updated
                    };
                    ConversationService.saveConversation(conv, password).catch(err => 
                        console.error("Auto-save after error response failed", err)
                    );
                }

                return updated;
            });
        } finally {
            setIsAiProcessing(false);
            setAiStatus('');
        }
    };

    /**
     * Loads a specific conversation into the context
     */
    const loadConversation = (conversation: Conversation) => {
        console.log('[useAgent] Loading conversation:', conversation.id);
        console.log('[useAgent] Messages count:', conversation.messages.length);
        console.log('[useAgent] Messages:', conversation.messages.map(m => ({
            id: m.id,
            role: m.role,
            contentPreview: m.content?.substring(0, 50),
            hasToolResults: !!(m.toolResults && m.toolResults.length > 0)
        })));
        setMessages(conversation.messages);
        setActiveConversationId(conversation.id);
    };

    /**
     * Clears current chat to start fresh
     */
    const startNewConversation = () => {
        setMessages([]);
        setActiveConversationId(null);
        setInputMessage('');
        setIsAiProcessing(false);
        setAiStatus('');
    };

    return {
        messages,
        setMessages, // Expose for custom loading if needed
        activeConversationId,
        loadConversation,
        startNewConversation,

        inputMessage,
        setInputMessage,
        isAiProcessing,
        aiStatus,
        scrollRef,
        handleSendMessage
    };
};
