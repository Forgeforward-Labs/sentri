import { demoProducts } from "@sentri/config";
import { ContractService } from "../services/contractService.js";
import { PositionService } from "../services/positionService.js";

export function startRugMonitor(
  positionService: PositionService,
  _contractService: ContractService,
) {
  const watchedPools = demoProducts.filter((product) => product.triggerType === "RUG");
  console.info(`[monitor:rug] watching ${watchedPools.length} rug pools`);

  const timer = setInterval(() => {
    const activeRugPosition = positionService
      .getPositions()
      .find((position) => position.status === "ACTIVE" && position.productId === 3);

    if (!activeRugPosition) {
      return;
    }

    positionService.seedHeartbeat(
      activeRugPosition.id,
      "Synthetic rug monitor tick",
      "Placeholder for liquidity burn detection and threshold math.",
    );
  }, 60_000);

  return () => clearInterval(timer);
}
