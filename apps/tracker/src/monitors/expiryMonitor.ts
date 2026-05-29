import { trackerIntervals } from "@sentri/config";
import { ContractService } from "../services/contractService.js";
import { getUsdcPriceUsd } from "../services/priceService.js";
import { PositionService } from "../services/positionService.js";

export function startExpiryMonitor(
  positionService: PositionService,
  contractService: ContractService,
) {
  const timer = setInterval(async () => {
    const now = Date.now();

    for (const position of positionService.getPositions()) {
      if (position.status !== "ACTIVE" || !position.expiresAt) {
        continue;
      }

      if (new Date(position.expiresAt).getTime() > now) {
        continue;
      }

      const price = await getUsdcPriceUsd();

      if (price !== null && price < 0.97) {
        await contractService.initiateDepegClaim(position.id, price);
        positionService.seedHeartbeat(
          position.id,
          "Depeg claim initiated",
          `Expiry reached with CoinGecko price ${price}.`,
        );
      } else {
        await contractService.expirePosition(position.id);
        positionService.updatePosition({
          ...position,
          status: "EXPIRED",
        });
        positionService.seedHeartbeat(
          position.id,
          "Position expired",
          `Expiry reached with no depeg trigger. Latest price: ${price ?? "unavailable"}.`,
        );
      }
    }
  }, trackerIntervals.expiryMonitorMs);

  return () => clearInterval(timer);
}
