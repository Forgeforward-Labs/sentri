import { demoProducts } from "@sentri/config";
import { ContractService } from "../services/contractService.js";
import { PositionService } from "../services/positionService.js";

export function startDepegMonitor(
  positionService: PositionService,
  _contractService: ContractService,
) {
  const watchedProducts = demoProducts.filter((product) => product.triggerType === "DEPEG");
  console.info(`[monitor:depeg] watching ${watchedProducts.length} depeg products`);

  const timer = setInterval(() => {
    const activePosition = positionService.getPositions().find((position) => position.status === "ACTIVE");

    if (!activePosition) {
      return;
    }

    positionService.seedHeartbeat(
      activePosition.id,
      "Synthetic depeg monitor tick",
      "Placeholder for Somnia WebSocket swap event processing.",
    );
  }, 45_000);

  return () => clearInterval(timer);
}
