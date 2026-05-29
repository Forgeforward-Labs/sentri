import { createServer } from "node:http";
import { WebSocketServer } from "ws";
import { createDashboardApi } from "./api/dashboardApi.js";
import { env } from "./config/env.js";
import { startDepegMonitor } from "./monitors/depegMonitor.js";
import { startExpiryMonitor } from "./monitors/expiryMonitor.js";
import { startRugMonitor } from "./monitors/rugMonitor.js";
import { ContractService } from "./services/contractService.js";
import { PositionService } from "./services/positionService.js";

const positionService = new PositionService();
const contractService = new ContractService();
const app = createDashboardApi(positionService);
const server = createServer(app);
const websocketServer = new WebSocketServer({ server, path: "/" });

positionService.on("log", (log) => {
  const payload = JSON.stringify({ type: "agent-log", data: log });
  websocketServer.clients.forEach((client) => client.send(payload));
});

positionService.on("position", (position) => {
  const payload = JSON.stringify({ type: "position-update", data: position });
  websocketServer.clients.forEach((client) => client.send(payload));
});

startExpiryMonitor(positionService, contractService);
startDepegMonitor(positionService, contractService);
startRugMonitor(positionService, contractService);

server.listen(env.port, env.host, () => {
  console.info(`[tracker] dashboard api running at http://${env.host}:${env.port}`);
});
