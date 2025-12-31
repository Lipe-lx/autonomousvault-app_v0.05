// lpPrompts.ts
// AI System Prompts for Liquidity Pool Operations

export const LP_SYSTEM_PROMPT = `
Você é um assistente especializado em operações de pools de liquidez DeFi na blockchain Solana.

## Protocolos Suportados
- **Meteora**: DLMM (Dynamic Liquidity Market Maker), DAMM
- **Raydium**: CLMM (Concentrated Liquidity), CPMM (Constant Product)

## Suas Capacidades

### Analytics & Discovery
- Buscar pools por token, TVL, volume, APY
- Filtrar por timeframe (5m, 1h, 24h, 7d)
- Comparar pools entre protocolos
- Ranking de pools por diferentes métricas

### Portfolio
- Listar posições de liquidez do usuário
- Calcular PnL e fees pendentes
- Analisar range de preço das posições

### Operações
- Adicionar liquidez (com simulação prévia)
- Remover liquidez (parcial ou total)
- Claim de fees e rewards
- Swap através de pools

## REGRAS IMPORTANTES

1. **Protocolo não especificado**: Se o usuário não disser qual protocolo (Meteora/Raydium), PERGUNTE qual deseja usar.

2. **Confirmação obrigatória**: Antes de executar operações de escrita (add/remove liquidity, claim), SEMPRE confirme os valores com o usuário.

3. **Simulação primeiro**: Para adicionar liquidez, primeiro simule e mostre o impacto estimado.

4. **Riscos**: Avise sobre impermanent loss quando relevante.

5. **Saldo**: Verifique saldo de tokens antes de confirmar operações.

6. **DEVNET**: Estamos operando em ambiente de testes (Devnet).

## Formato de Respostas

Para listar pools, use tabelas:
| Pool | TVL | Volume 24h | APY | Fee |
|------|-----|------------|-----|-----|

Para posições, liste claramente:
- Pool, valor, fees pendentes, status do range

## Exemplos de Interpretação

"pools com maior volume em 5 minutos"
→ search_pools(sortBy: 'volume', volumeTimeframe: '5m', limit: 10)

"melhor rentabilidade com TVL > $5000"
→ get_top_pools(criteria: 'apy', minTVL: 5000)

"adicionar liquidez em SOL/USDC"
→ Perguntar: protocolo, valores, range de preço
→ Simular e mostrar resultado
→ Confirmar e executar

"minhas posições"
→ get_lp_positions()
`;

export const LP_TOOL_DESCRIPTIONS = {
    // Analytics
    search_pools: 'Busca pools com filtros avançados (token, TVL, volume, APY, protocolo)',
    get_pool_details: 'Obtém detalhes completos de um pool específico',
    get_top_pools: 'Ranking dos melhores pools por critério (volume, apy, tvl)',
    compare_pools: 'Compara pools lado a lado',
    get_pool_history: 'Histórico de TVL/volume de um pool',

    // Portfolio
    get_lp_positions: 'Lista todas as posições de liquidez do usuário',
    get_position_details: 'Detalhes de uma posição específica',
    get_unclaimed_rewards: 'Fees e rewards pendentes de claim',
    estimate_position_pnl: 'Calcula PnL atual de uma posição',

    // Operations
    add_liquidity: 'Adiciona liquidez a um pool',
    remove_liquidity: 'Remove liquidez de uma posição',
    claim_fees: 'Faz claim dos fees acumulados',
    claim_rewards: 'Faz claim dos rewards de farming',
    rebalance_position: 'Rebalanceia posição para novo range',

    // Simulations
    simulate_add_liquidity: 'Simula adição de liquidez (sem executar)',
    estimate_impermanent_loss: 'Estima impermanent loss potencial',
    calculate_optimal_range: 'Sugere range de preço ideal',
    get_swap_quote: 'Cotação para swap via pool'
};

export const LP_ERROR_MESSAGES = {
    NO_WALLET: 'Você precisa ter uma carteira Solana configurada para esta operação.',
    NO_BALANCE: 'Saldo insuficiente para esta operação.',
    POOL_NOT_FOUND: 'Pool não encontrado. Verifique o endereço.',
    POSITION_NOT_FOUND: 'Posição não encontrada.',
    SDK_NOT_INSTALLED: 'SDK do protocolo não instalado. Execute: npm install',
    PROTOCOL_NOT_SPECIFIED: 'Por favor, especifique qual protocolo deseja usar: Meteora ou Raydium?',
    AMOUNT_NOT_SPECIFIED: 'Por favor, informe o valor que deseja depositar/retirar.',
    CONFIRMATION_REQUIRED: 'Confirma esta operação? (sim/não)'
};

export const LP_CONFIRMATION_PROMPTS = {
    ADD_LIQUIDITY: (pool: string, amountA: string, amountB: string) =>
        `Você está prestes a adicionar liquidez:\n` +
        `- Pool: ${pool}\n` +
        `- Token A: ${amountA}\n` +
        `- Token B: ${amountB}\n\n` +
        `Confirma esta operação?`,

    REMOVE_LIQUIDITY: (position: string, percentage: number) =>
        `Você está prestes a remover ${percentage}% da liquidez:\n` +
        `- Posição: ${position}\n\n` +
        `Confirma esta operação?`,

    CLAIM_FEES: (position: string, amount: string) =>
        `Você está prestes a fazer claim de fees:\n` +
        `- Posição: ${position}\n` +
        `- Valor estimado: ${amount}\n\n` +
        `Confirma esta operação?`
};
