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
      // Price healthy — nothing to do
      return;
    }

    console.warn(`[monitor:depeg] USDC price ${price} below threshold ${DEPEG_THRESHOLD}`);

    const activePositions = positionService
      .getPositions()
      .filter((p) => p.status === "ACTIVE" && p.expiresAt !== null);

    for (const position of activePositions) {
      const product = positionService.getProducts().find((pr) => pr.id === position.productId);
      if (product?.triggerType !== "DEPEG") continue;

      console.info(`[monitor:depeg] initiating depeg claim for position ${position.id}`);
      try {
        const tx = await contractService.initiateDepegClaim(position.id, price);
        positionService.seedHeartbeat(
          position.id,
          "Depeg claim initiated",
          `USDC at ${price} (< ${DEPEG_THRESHOLD}). tx: ${tx}`,
        );
      } catch (err) {
        console.error(`[monitor:depeg] failed to initiate claim for position ${position.id}:`, err);
      }
    }
  }, POLL_INTERVAL_MS);

  return () => clearInterval(timer);
}
