import express from "express";
import { PositionService } from "../services/positionService.js";

export function createDashboardApi(positionService: PositionService) {
  const app = express();

  app.get("/health", (_request, response) => {
    response.json({ ok: true, service: "sentri-tracker" });
  });

  app.get("/products", (_request, response) => {
    response.json(positionService.getProducts());
  });

  app.get("/positions", (_request, response) => {
    response.json(positionService.getPositions());
  });

  app.get("/positions/:id", (request, response) => {
    const position = positionService.getPosition(Number(request.params.id));

    if (!position) {
      response.status(404).json({ error: "Position not found" });
      return;
    }

    response.json(position);
  });

  app.get("/positions/:id/logs", (request, response) => {
    response.json(positionService.getAgentLogs(Number(request.params.id)));
  });

  app.get("/pool-stats", (_request, response) => {
    response.json(positionService.getPoolStats());
  });

  return app;
}
