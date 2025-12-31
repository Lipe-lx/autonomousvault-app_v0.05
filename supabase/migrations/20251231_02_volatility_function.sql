-- Migration: Add volatility calculation function
-- Calculates pool volatility directly in the database for efficiency

-- Function to calculate pool volatility from price snapshots
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
    -- Get pool ID
    SELECT id INTO v_pool_id FROM liquidity_pools WHERE address = pool_addr;
    
    IF v_pool_id IS NULL THEN
        RETURN QUERY SELECT 0::NUMERIC, 0::NUMERIC, 0::NUMERIC, 0::NUMERIC, 0::NUMERIC, 0;
        RETURN;
    END IF;
    
    -- Get current price (most recent)
    SELECT price INTO v_current_price
    FROM liquidity_pool_snapshots
    WHERE pool_id = v_pool_id
    ORDER BY timestamp DESC
    LIMIT 1;
    
    -- Get price 24h ago
    SELECT price INTO v_price_24h_ago
    FROM liquidity_pool_snapshots
    WHERE pool_id = v_pool_id
      AND timestamp <= now() - INTERVAL '24 hours'
    ORDER BY timestamp DESC
    LIMIT 1;
    
    -- Get price 7d ago
    SELECT price INTO v_price_7d_ago
    FROM liquidity_pool_snapshots
    WHERE pool_id = v_pool_id
      AND timestamp <= now() - INTERVAL '7 days'
    ORDER BY timestamp DESC
    LIMIT 1;
    
    -- Calculate log returns from consecutive price snapshots
    WITH ordered_prices AS (
        SELECT 
            price,
            LAG(price) OVER (ORDER BY timestamp) AS prev_price
        FROM liquidity_pool_snapshots
        WHERE pool_id = v_pool_id
          AND timestamp >= now() - (lookback_days || ' days')::INTERVAL
          AND price > 0
        ORDER BY timestamp
    ),
    log_returns AS (
        SELECT LN(price / prev_price) AS log_return
        FROM ordered_prices
        WHERE prev_price IS NOT NULL AND prev_price > 0
    )
    SELECT 
        array_agg(log_return) INTO v_log_returns
    FROM log_returns;
    
    v_count := COALESCE(array_length(v_log_returns, 1), 0);
    
    IF v_count < 2 THEN
        RETURN QUERY SELECT 
            0::NUMERIC, 
            0::NUMERIC,
            CASE WHEN v_price_24h_ago > 0 THEN ((v_current_price - v_price_24h_ago) / v_price_24h_ago * 100) ELSE 0 END,
            CASE WHEN v_price_7d_ago > 0 THEN ((v_current_price - v_price_7d_ago) / v_price_7d_ago * 100) ELSE 0 END,
            COALESCE(v_current_price, 0),
            v_count;
        RETURN;
    END IF;
    
    -- Calculate mean
    SELECT AVG(val) INTO v_mean FROM unnest(v_log_returns) AS val;
    
    -- Calculate variance
    SELECT AVG(POWER(val - v_mean, 2)) INTO v_variance FROM unnest(v_log_returns) AS val;
    
    -- Calculate standard deviation
    v_std_dev := SQRT(v_variance);
    
    -- Daily volatility = std_dev * sqrt(288) * 100 (288 = 5-min intervals per day)
    -- Annualized = daily * sqrt(365)
    RETURN QUERY SELECT
        ROUND((v_std_dev * SQRT(288) * 100)::NUMERIC, 2) AS volatility_daily,
        ROUND((v_std_dev * SQRT(288) * SQRT(365) * 100)::NUMERIC, 2) AS volatility_annualized,
        ROUND(CASE WHEN v_price_24h_ago > 0 THEN ((v_current_price - v_price_24h_ago) / v_price_24h_ago * 100) ELSE 0 END, 2) AS price_change_24h,
        ROUND(CASE WHEN v_price_7d_ago > 0 THEN ((v_current_price - v_price_7d_ago) / v_price_7d_ago * 100) ELSE 0 END, 2) AS price_change_7d,
        ROUND(v_current_price, 6) AS current_price,
        v_count AS data_points;
END;
$$ LANGUAGE plpgsql;

-- Grant access to authenticated users
GRANT EXECUTE ON FUNCTION calculate_pool_volatility TO authenticated;
GRANT EXECUTE ON FUNCTION calculate_pool_volatility TO service_role;
