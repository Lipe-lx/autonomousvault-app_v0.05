-- Migration: Security Fixes and Function Definition
-- Date: 2026-01-01

-- ==============================================================================
-- 1. SECURITY: Tables (RLS and Policies)
-- ==============================================================================

-- Enable Row Level Security (RLS)
ALTER TABLE public.liquidity_pools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.liquidity_pool_snapshots ENABLE ROW LEVEL SECURITY;

-- Policies for 'liquidity_pools'
CREATE POLICY "Public Read Access" ON public.liquidity_pools
FOR SELECT TO public USING (true);

CREATE POLICY "Service Role Full Access" ON public.liquidity_pools
FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Policies for 'liquidity_pool_snapshots'
CREATE POLICY "Public Read Access" ON public.liquidity_pool_snapshots
FOR SELECT TO public USING (true);

CREATE POLICY "Service Role Full Access" ON public.liquidity_pool_snapshots
FOR ALL TO service_role USING (true) WITH CHECK (true);


-- ==============================================================================
-- 2. LOGIC: Function Definition (Preserving your existing code)
-- ==============================================================================

CREATE OR REPLACE FUNCTION calculate_pool_volatility(
    pool_addr TEXT,
    lookback_days INT DEFAULT 7
)
RETURNS TABLE (
    volatility_daily NUMERIC,
    volatility_annualized NUMERIC,
    price_change_24h NUMERIC,
    price_change_7d NUMERIC,
    current_price NUMERIC,
    data_points INT
) AS $$
DECLARE
    v_pool_id UUID;
    v_log_returns NUMERIC[];
    v_mean NUMERIC;
    v_variance NUMERIC;
    v_std_dev NUMERIC;
    v_current_price NUMERIC;
    v_price_24h_ago NUMERIC;
    v_price_7d_ago NUMERIC;
    v_count INT;
BEGIN
    SELECT id INTO v_pool_id FROM liquidity_pools WHERE address = pool_addr;
    
    IF v_pool_id IS NULL THEN
        RETURN QUERY SELECT 0::NUMERIC, 0::NUMERIC, 0::NUMERIC, 0::NUMERIC, 0::NUMERIC, 0;
        RETURN;
    END IF;
    
    SELECT price INTO v_current_price
    FROM liquidity_pool_snapshots WHERE pool_id = v_pool_id
    ORDER BY timestamp DESC LIMIT 1;
    
    SELECT price INTO v_price_24h_ago
    FROM liquidity_pool_snapshots
    WHERE pool_id = v_pool_id AND timestamp <= now() - INTERVAL '24 hours'
    ORDER BY timestamp DESC LIMIT 1;
    
    SELECT price INTO v_price_7d_ago
    FROM liquidity_pool_snapshots
    WHERE pool_id = v_pool_id AND timestamp <= now() - INTERVAL '7 days'
    ORDER BY timestamp DESC LIMIT 1;
    
    WITH ordered_prices AS (
        SELECT price, LAG(price) OVER (ORDER BY timestamp) AS prev_price
        FROM liquidity_pool_snapshots
        WHERE pool_id = v_pool_id
          AND timestamp >= now() - (lookback_days || ' days')::INTERVAL
          AND price > 0
    ),
    log_returns AS (
        SELECT LN(price / prev_price) AS log_return
        FROM ordered_prices WHERE prev_price IS NOT NULL AND prev_price > 0
    )
    SELECT array_agg(log_return) INTO v_log_returns FROM log_returns;
    
    v_count := COALESCE(array_length(v_log_returns, 1), 0);
    
    IF v_count < 2 THEN
        RETURN QUERY SELECT 0::NUMERIC, 0::NUMERIC,
            CASE WHEN v_price_24h_ago > 0 THEN ((v_current_price - v_price_24h_ago) / v_price_24h_ago * 100) ELSE 0 END,
            CASE WHEN v_price_7d_ago > 0 THEN ((v_current_price - v_price_7d_ago) / v_price_7d_ago * 100) ELSE 0 END,
            COALESCE(v_current_price, 0), v_count;
        RETURN;
    END IF;
    
    SELECT AVG(val) INTO v_mean FROM unnest(v_log_returns) AS val;
    SELECT AVG(POWER(val - v_mean, 2)) INTO v_variance FROM unnest(v_log_returns) AS val;
    v_std_dev := SQRT(v_variance);
    
    RETURN QUERY SELECT
        ROUND((v_std_dev * SQRT(288) * 100)::NUMERIC, 2),
        ROUND((v_std_dev * SQRT(288) * SQRT(365) * 100)::NUMERIC, 2),
        ROUND(CASE WHEN v_price_24h_ago > 0 THEN ((v_current_price - v_price_24h_ago) / v_price_24h_ago * 100) ELSE 0 END, 2),
        ROUND(CASE WHEN v_price_7d_ago > 0 THEN ((v_current_price - v_price_7d_ago) / v_price_7d_ago * 100) ELSE 0 END, 2),
        ROUND(v_current_price, 6), v_count;
END;
$$ LANGUAGE plpgsql;

-- Permissions
GRANT EXECUTE ON FUNCTION calculate_pool_volatility TO authenticated, service_role;


-- ==============================================================================
-- 3. SECURITY: Function Fixes (The "Search Path" Patch)
-- ==============================================================================
-- IMPORTANT: This must come AFTER the function definition
ALTER FUNCTION public.get_top_pools_with_delta(INT, INT) SET search_path = public;
ALTER FUNCTION public.calculate_pool_volatility(TEXT, INT) SET search_path = public;
