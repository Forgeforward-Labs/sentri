import { env } from "../config/env.js";
import { ContractService } from "../services/contractService.js";
import { PositionService } from "../services/positionService.js";

/**
 * Rug monitor — polls on-chain liquidity data and triggers rug claims
 * when liquidity drops below a product's threshold.
 *
 * For the demo, this uses a synthetic liquidity reading.
 * In production, replace getPoolLiquidityPctBps() with a real API call
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
    const activeRugPositions = positionService
      .getPositions()
      .filter((p) => p.status === "ACTIVE");

    for (const position of activeRugPositions) {
      const product = positionService.getProducts().find((pr) => pr.id === position.productId);
      if (product?.triggerType !== "RUG") continue;

      const params = product.triggerParams as { pool: string; liquidityThresholdBps: number };
      const liquidityPct = await getPoolLiquidityPctBps(params.pool);

      if (liquidityPct === null) continue;

      if (liquidityPct < params.liquidityThresholdBps) {
        console.warn(`[monitor:rug] pool ${params.pool} liquidity ${liquidityPct}bps < threshold ${params.liquidityThresholdBps}bps`);
        try {
          const tx = await contractService.initiateRugClaim(position.id, liquidityPct);
          positionService.seedHeartbeat(
            position.id,
            "Rug claim initiated",
            `Pool liquidity ${liquidityPct}bps below threshold ${params.liquidityThresholdBps}bps. tx: ${tx}`,
          );
        } catch (err) {
          console.error(`[monitor:rug] failed to initiate claim for position ${position.id}:`, err);
        }
      }
    }
  }, POLL_INTERVAL_MS);

  return () => clearInterval(timer);
}
