import express from "express";
import type { Request, Response, NextFunction } from "express";
import { DatabaseService } from "../services/databaseService.js";
import { PositionService } from "../services/positionService.js";

export function createDashboardApi(
  positionService: PositionService,
  databaseService: DatabaseService,
) {
  const app = express();

  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    if (_req.method === "OPTIONS") { res.sendStatus(204); return; }
    next();
  });

  app.get("/health", (_request, response) => {
    response.json({ ok: true, service: "sentri-tracker" });
  });

  app.get("/status", async (_request, response) => {
    const lastIndexedBlock = await databaseService.getLastIndexedBlock();
    response.json({
      lastIndexedBlock: lastIndexedBlock?.toString() ?? null,
      productCount: positionService.getProducts().length,
      positionCount: positionService.getPositions().length,
    });
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

  app.get("/logs", (request, response) => {
    const limit = request.query.limit ? Number(request.query.limit) : undefined;
    const logs = positionService.getAgentLogs();
    response.json(limit ? logs.slice(0, limit) : logs);
  });

  app.get("/pool-stats", (_request, response) => {
    response.json(positionService.getPoolStats());
  });

  app.get("/pool-snapshots", async (_request, response) => {
    const snapshots = await positionService.getPoolSnapshots(48);
    response.json(snapshots);
  });

  // ── Analytics ──────────────────────────────────────────────────

  app.get("/analytics", (_request, response) => {
    response.json(positionService.getAnalytics());
  });

  app.get("/claims", (_request, response) => {
    response.json(positionService.getClaims());
  });

  app.get("/participants", (_request, response) => {
    response.json(positionService.getParticipants());
  });

  app.get("/participants/:address", (request, response) => {
    const participant = positionService.getParticipant(request.params.address);
    if (!participant) {
      response.status(404).json({ error: "Participant not found" });
      return;
    }
    response.json(participant);
  });

  return app;
}
