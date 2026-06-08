import { env } from "../config/env.js";
import { ContractService } from "../services/contractService.js";
import { PositionService } from "../services/positionService.js";
import { getUsdcPriceUsd } from "../services/priceService.js";

const DEPEG_THRESHOLD = 0.97;
const POLL_INTERVAL_MS = 60_000;

export function startDepegMonitor(
  positionService: PositionService,
  contractService: ContractService,
) {
  if (!env.hasContracts) {
    console.info("[monitor:depeg] no contract addresses — skipping live monitor");
    return () => {};
  }

  console.info("[monitor:depeg] starting — polling USDC price every 60s");

  const timer = setInterval(async () => {
    const price = await getUsdcPriceUsd();

    if (price === null) {
      console.warn("[monitor:depeg] could not fetch USDC price");
      return;
    }

    if (price >= DEPEG_THRESHOLD) {
      return;
    }

    console.warn(`[monitor:depeg] USDC price ${price} below threshold ${DEPEG_THRESHOLD}`);

    // Group active DEPEG positions by productId — one agent run per product
    const byProduct = new Map<number, number[]>();
    for (const position of positionService.getPositions()) {
      if (position.status !== "ACTIVE") continue;
      const product = positionService.getProducts().find((pr) => pr.id === position.productId);
      if (product?.triggerType !== "DEPEG") continue;

      const ids = byProduct.get(position.productId) ?? [];
      ids.push(position.id);
      byProduct.set(position.productId, ids);
    }

    for (const [productId, positionIds] of byProduct) {
      console.info(`[monitor:depeg] initiating batch depeg claim for product ${productId} (${positionIds.length} positions)`);
      try {
        const tx = await contractService.initiateDepegClaimBatch(positionIds, price);
        for (const id of positionIds) {
          positionService.seedHeartbeat(
            id,
            "Depeg batch claim initiated",
            `USDC at ${price} (< ${DEPEG_THRESHOLD}). Batch size: ${positionIds.length}. tx: ${tx}`,
          );
        }
      } catch (err) {
        console.error(`[monitor:depeg] failed batch claim for product ${productId}:`, err);
      }
    }
  }, POLL_INTERVAL_MS);

  return () => clearInterval(timer);
}
