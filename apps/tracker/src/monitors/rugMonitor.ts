import { env } from "../config/env.js";
import { ContractService } from "../services/contractService.js";
import { PositionService } from "../services/positionService.js";

/**
 * Rug monitor — polls on-chain liquidity data and triggers rug claims
 * when liquidity drops below a product's threshold.
 *
 * Replace getPoolLiquidityPctBps() with a real liquidity API call
 * (e.g. DeFiLlama /protocol/:slug → tvl comparison).
 */

const POLL_INTERVAL_MS = 90_000;

async function getPoolLiquidityPctBps(_poolAddress: string): Promise<number | null> {
  // TODO: Replace with real liquidity API call for the specific pool address.
  // Return current liquidity as basis points (e.g. 3000 = 30%).
  // Returning null means data unavailable.
  return null;
}

export function startRugMonitor(
  positionService: PositionService,
  contractService: ContractService,
) {
  if (!env.hasContracts) {
    console.info("[monitor:rug] no contract addresses — skipping live monitor");
    return () => {};
  }

  console.info("[monitor:rug] starting — polling pool liquidity every 90s");

  const timer = setInterval(async () => {
    // Group active RUG positions by productId — one agent run per product
    const byProduct = new Map<number, { positionIds: number[]; pool: string; threshold: number }>();

    for (const position of positionService.getPositions()) {
      if (position.status !== "ACTIVE") continue;
      const product = positionService.getProducts().find((pr) => pr.id === position.productId);
      if (product?.triggerType !== "RUG") continue;

      const params = product.triggerParams as { pool: string; liquidityThresholdBps: number };
      const entry = byProduct.get(position.productId) ?? {
        positionIds: [],
        pool: params.pool,
        threshold: params.liquidityThresholdBps,
      };
      entry.positionIds.push(position.id);
      byProduct.set(position.productId, entry);
    }

    for (const [productId, { positionIds, pool, threshold }] of byProduct) {
      const liquidityPct = await getPoolLiquidityPctBps(pool);
      if (liquidityPct === null) continue;
      if (liquidityPct >= threshold) continue;

      console.warn(`[monitor:rug] pool ${pool} liquidity ${liquidityPct}bps < threshold ${threshold}bps`);
      console.info(`[monitor:rug] initiating batch rug claim for product ${productId} (${positionIds.length} positions)`);

      try {
        const tx = await contractService.initiateRugClaimBatch(positionIds, liquidityPct);
        for (const id of positionIds) {
          positionService.seedHeartbeat(
            id,
            "Rug batch claim initiated",
            `Pool liquidity ${liquidityPct}bps below threshold ${threshold}bps. Batch size: ${positionIds.length}. tx: ${tx}`,
          );
        }
      } catch (err) {
        console.error(`[monitor:rug] failed batch claim for product ${productId}:`, err);
      }
    }
  }, POLL_INTERVAL_MS);

  return () => clearInterval(timer);
}
