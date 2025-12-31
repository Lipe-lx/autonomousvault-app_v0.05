-- 1. Tabela de Metadados dos Pools
CREATE TABLE IF NOT EXISTS public.liquidity_pools (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    address TEXT UNIQUE NOT NULL,
    protocol TEXT NOT NULL, -- 'meteora_dlmm', 'raydium_clmm', etc.
    name TEXT NOT NULL,
    token_a_mint TEXT NOT NULL,
    token_b_mint TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Tabela de Snapshots (Série Temporal)
CREATE TABLE IF NOT EXISTS public.liquidity_pool_snapshots (
    id BIGSERIAL PRIMARY KEY,
    pool_id UUID REFERENCES public.liquidity_pools(id) ON DELETE CASCADE,
    timestamp TIMESTAMPTZ DEFAULT now(),
    tvl NUMERIC NOT NULL,
    volume_cumulative NUMERIC NOT NULL,
    volume_24h NUMERIC NOT NULL,
    apy NUMERIC NOT NULL,
    price NUMERIC NOT NULL
);

-- Índices para performance em queries de tempo
CREATE INDEX IF NOT EXISTS idx_snapshots_pool_timestamp ON public.liquidity_pool_snapshots (pool_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_snapshots_timestamp ON public.liquidity_pool_snapshots (timestamp DESC);

-- 3. Função para buscar Top Pools por volume em um período customizado (DELTA)
CREATE OR REPLACE FUNCTION get_top_pools_with_delta(
    timeframe_minutes INT DEFAULT 5,
    rank_limit INT DEFAULT 10
)
RETURNS TABLE (
    pool_address TEXT,
    pool_name TEXT,
    protocol TEXT,
    delta_volume NUMERIC,
    current_tvl NUMERIC,
    current_apy NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    WITH latest_snapshots AS (
        -- Pega o snapshot mais recente de cada pool
        SELECT DISTINCT ON (pool_id) *
        FROM liquidity_pool_snapshots
        ORDER BY pool_id, timestamp DESC
    ),
    past_snapshots AS (
        -- Pega o snapshot mais próximo do tempo T - timeframe
        SELECT DISTINCT ON (pool_id) *
        FROM liquidity_pool_snapshots
        WHERE timestamp <= now() - (timeframe_minutes || ' minutes')::INTERVAL
        ORDER BY pool_id, timestamp DESC
    )
    SELECT 
        p.address,
        p.name,
        p.protocol,
        (ls.volume_cumulative - COALESCE(ps.volume_cumulative, ls.volume_cumulative)) AS delta_volume,
        ls.tvl as current_tvl,
        ls.apy as current_apy
    FROM latest_snapshots ls
    JOIN liquidity_pools p ON ls.pool_id = p.id
    LEFT JOIN past_snapshots ps ON ls.pool_id = ps.pool_id
    ORDER BY delta_volume DESC
    LIMIT rank_limit;
END;
$$ LANGUAGE plpgsql;
