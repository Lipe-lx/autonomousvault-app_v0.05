import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";

const METEORA_API = "https://dlmm-api.meteora.ag";
const RAYDIUM_API = "https://api-v3.raydium.io";

serve(async (req) => {
  try {
    console.log("Starting LP Sync...");
    
    const url = Deno.env.get("SUPABASE_URL");
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    console.log(`Env Check - URL: ${url ? 'Set' : 'MISSING'}, Key: ${key ? 'Set (' + key.substring(0,10) + '...)' : 'MISSING'}`);

    if (!url || !key) {
        throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    }

    const supabase = createClient(url, key);

    // Debug: Check Auth with simpler query
    console.log("Testing DB connection...");
    const { data: testData, error: testError } = await supabase.from('liquidity_pools').select('id').limit(1);
    
    if (testError) {
        console.error("DB Connection/Auth Error:", JSON.stringify(testError));
        throw new Error(`DB Auth failed: ${JSON.stringify(testError)}`);
    }
    console.log("DB connection OK");

    // 1. Fetch Meteora Pools (Lightweight curated list)
    console.log("Fetching Meteora...");
    const meteoraResp = await fetch(`${METEORA_API}/pair/all_by_groups`);
    const meteoraData = await meteoraResp.json();
    const meteoraPools = meteoraData.groups?.flatMap((g: any) => g.pairs) || [];
    console.log(`Fetched ${meteoraPools.length} Meteora pools`);

    // 2. Fetch Raydium Pools (Top 50)
    console.log("Fetching Raydium...");
    const raydiumResp = await fetch(`${RAYDIUM_API}/pools/info/list?poolType=all&poolSortField=default&sortType=desc&pageSize=50&page=1`);
    const raydiumData = await raydiumResp.json();
    const raydiumPools = raydiumData.data?.data || [];
    console.log(`Fetched ${raydiumPools.length} Raydium pools`);

    const allPools = [
      ...meteoraPools.map((p: any) => ({
        address: p.address,
        protocol: "meteora_dlmm",
        name: p.name,
        token_a_mint: p.mint_x,
        token_b_mint: p.mint_y,
        tvl: parseFloat(p.liquidity) || 0,
        volume_cumulative: parseFloat(p.cumulative_trade_volume) || 0,
        volume_24h: p.trade_volume_24h || 0,
        apy: p.apy || 0,
        price: p.current_price || 0
      })),
      ...raydiumPools.map((p: any) => ({
        address: p.id,
        protocol: p.type === "Concentrated" ? "raydium_clmm" : "raydium_cpmm",
        name: p.poolName || `${p.mintA?.symbol || 'Unknown'}-${p.mintB?.symbol || 'Unknown'}`,
        token_a_mint: p.mintA?.address,
        token_b_mint: p.mintB?.address,
        tvl: p.tvl || 0,
        volume_cumulative: 0, // Raydium doesn't provide cumulative
        volume_24h: p.day?.volume || p.volume24h || 0,
        apy: (p.day?.apr || p.apr24h || 0) * 100, // Convert to percentage if needed
        price: p.price || p.lpPrice || (p.mintA?.price ? p.mintB?.price / p.mintA?.price : 0) || 0
      }))
    ];

    console.log(`Total pools to process: ${allPools.length}`);

    let successCount = 0;
    let errorCount = 0;

    for (const pool of allPools) {
      // Upsert Metadata
      const { data: poolRow, error: poolError } = await supabase
        .from("liquidity_pools")
        .upsert({
          address: pool.address,
          protocol: pool.protocol,
          name: pool.name,
          token_a_mint: pool.token_a_mint,
          token_b_mint: pool.token_b_mint
        }, { onConflict: "address" })
        .select()
        .single();

      if (poolError) {
        console.error(`Error upserting pool ${pool.name}:`, poolError);
        errorCount++;
        continue;
      }

      // Insert Snapshot
      const { error: snapError } = await supabase.from("liquidity_pool_snapshots").insert({
        pool_id: poolRow.id,
        tvl: pool.tvl,
        volume_cumulative: pool.volume_cumulative,
        volume_24h: pool.volume_24h,
        apy: pool.apy,
        price: pool.price
      });

      if (snapError) {
          console.error(`Error inserting snapshot for ${pool.name}:`, snapError);
      } else {
          successCount++;
      }
    }

    console.log(`Sync completed. Success: ${successCount}, Errors: ${errorCount}`);

    return new Response(JSON.stringify({ success: true, count: allPools.length, inserted: successCount }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
