import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";

const METEORA_API = "https://dlmm-api.meteora.ag";
const RAYDIUM_API = "https://api-v3.raydium.io";

serve(async (req) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    console.log("Starting LP Sync...");

    // 1. Fetch Meteora Pools (Lightweight curated list)
    const meteoraResp = await fetch(`${METEORA_API}/pair/all_by_groups`);
    const meteoraData = await meteoraResp.json();
    const meteoraPools = meteoraData.groups?.flatMap((g: any) => g.pairs) || [];

    // 2. Fetch Raydium Pools (Top 50)
    const raydiumResp = await fetch(`${RAYDIUM_API}/pools/info/list?poolType=all&poolSortField=default&sortType=desc&pageSize=50&page=1`);
    const raydiumData = await raydiumResp.json();
    const raydiumPools = raydiumData.data?.data || [];

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
        name: p.poolName || `${p.mintA?.symbol}-${p.mintB?.symbol}`,
        token_a_mint: p.mintA?.address,
        token_b_mint: p.mintB?.address,
        tvl: p.tvl || 0,
        volume_cumulative: p.cumulativeVolume || 0, // Raydium might use different field
        volume_24h: p.day?.volume || 0,
        apy: p.day?.apr || 0,
        price: p.price || 0
      }))
    ];

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

      if (poolError) continue;

      // Insert Snapshot
      await supabase.from("liquidity_pool_snapshots").insert({
        pool_id: poolRow.id,
        tvl: pool.tvl,
        volume_cumulative: pool.volume_cumulative,
        volume_24h: pool.volume_24h,
        apy: pool.apy,
        price: pool.price
      });
    }

    return new Response(JSON.stringify({ success: true, count: allPools.length }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
