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

// ── HTTP + WebSocket server ──────────────────────────────────────

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

// ── Bootstrap ────────────────────────────────────────────────────

async function bootstrap() {
  if (env.hasContracts) {
    try {
      const [chainProducts, chainPositions, chainStats] = await Promise.all([
        contractService.getAllProducts(),
        contractService.getAllPositions(),
        contractService.getPoolStats(),
      ]);
      await positionService.initFromChain(chainProducts, chainPositions, chainStats);

      // Refresh pool stats every minute
      setInterval(async () => {
        try {
          const stats = await contractService.getPoolStats();
          positionService.applyChainStats(stats);
        } catch { /* ignore */ }
      }, 60_000);

      // Watch for new / updated positions
      contractService.watchPositionCreated(async (positionId) => {
        try {
          const pos = await contractService.getPosition(positionId);
          positionService.applyChainPosition(pos);
        } catch { /* ignore */ }
      });

      contractService.watchPositionStatusChange(
        async (positionId) => {
          try {
            const pos = await contractService.getPosition(positionId);
            positionService.applyChainPosition(pos);
          } catch { /* ignore */ }
        },
        async (positionId) => {
          try {
            const pos = await contractService.getPosition(positionId);
            positionService.applyChainPosition(pos);
          } catch { /* ignore */ }
        },
      );

      // Watch orchestrator for real agent logs
      contractService.watchOrchestratorEvents({
        onDepegStart: (positionId, requestId) => {
          positionService.recordLog({
            id:        `depeg-start-${requestId}`,
            positionId,
            timestamp: new Date().toISOString(),
            agent:     "TRACKER",
            action:    "Depeg validation started",
            data:      `Agent 1 (JSON API) requested. requestId: ${requestId}`,
            txHash:    null,
          });
        },
        onRugStart: (positionId, requestId) => {
          positionService.recordLog({
            id:        `rug-start-${requestId}`,
            positionId,
            timestamp: new Date().toISOString(),
            agent:     "TRACKER",
            action:    "Rug validation started",
            data:      `Agent 1 (JSON API) requested. requestId: ${requestId}`,
            txHash:    null,
          });
        },
        onStep: (positionId, step, requestId) => {
          const agentNames: Record<number, string> = {
            2: "Agent 2 (LLM inference)",
            3: "Agent 3 (News verification)",
          };
          positionService.recordLog({
            id:        `step-${step}-${requestId}`,
            positionId,
            timestamp: new Date().toISOString(),
            agent:     step === 2 ? "AGENT_2" : "AGENT_3",
            action:    `Step ${step} advanced`,
            data:      `${agentNames[step] ?? `Step ${step}`} requested. requestId: ${requestId}`,
            txHash:    null,
          });
        },
        onVerified: (positionId, confirmedPrice, payout) => {
          positionService.recordLog({
            id:        `verified-${positionId}-${Date.now()}`,
            positionId,
            timestamp: new Date().toISOString(),
            agent:     "AGENT_3",
            action:    "Trigger verified — payout initiated",
            data:      `Confirmed price: ${Number(confirmedPrice) / 1e18} | Payout: $${Number(payout) / 1e6}`,
            txHash:    null,
          });
          // Refresh position status
          contractService.getPosition(positionId).then((pos) => {
            positionService.applyChainPosition(pos);
          }).catch(() => {});
        },
        onDenied: (positionId, reason, step) => {
          positionService.recordLog({
            id:        `denied-${positionId}-${Date.now()}`,
            positionId,
            timestamp: new Date().toISOString(),
            agent:     step === 1 ? "AGENT_1" : step === 2 ? "AGENT_2" : "AGENT_3",
            action:    `Trigger denied at step ${step}`,
            data:      reason,
            txHash:    null,
          });
        },
      });

    } catch (err) {
      console.error("[tracker] chain sync failed, falling back to demo data:", err);
      positionService.useDemoData();
    }
  } else {
    console.warn("[tracker] no contract addresses configured — using demo data");
    positionService.useDemoData();
  }

  // ── Monitors ────────────────────────────────────────────────────
  startExpiryMonitor(positionService, contractService);
  startDepegMonitor(positionService, contractService);
  startRugMonitor(positionService, contractService);

  // ── Listen ──────────────────────────────────────────────────────
  server.listen(env.port, env.host, () => {
    console.info(`[tracker] dashboard api running at http://${env.host}:${env.port}`);
  });
}

bootstrap().catch((err) => {
  console.error("[tracker] bootstrap error:", err);
  process.exit(1);
});
