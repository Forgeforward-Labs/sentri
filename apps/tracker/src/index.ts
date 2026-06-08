import { createServer } from "node:http";
import { WebSocketServer } from "ws";
import { createDashboardApi } from "./api/dashboardApi.js";
import { env } from "./config/env.js";
import { startDepegMonitor } from "./monitors/depegMonitor.js";
import { startExpiryMonitor } from "./monitors/expiryMonitor.js";
import { startRugMonitor } from "./monitors/rugMonitor.js";
import { ContractService } from "./services/contractService.js";
import { DatabaseService } from "./services/databaseService.js";
import { PositionService } from "./services/positionService.js";

const positionService = new PositionService();
const contractService = new ContractService();
const databaseService = new DatabaseService();

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
      // Phase 1 — restore from DB (instant, no chain calls)
      await positionService.initFromDb();

      // Phase 2 — sync new events from chain
      const chainStats = await contractService.getPoolStats();

      if (env.deployBlock !== undefined) {
        // Event-based indexing: chunk getLogs into 999-block batches
        const lastIndexed = await databaseService.getLastIndexedBlock();
        const fromBlock = lastIndexed !== null ? lastIndexed + 1n : env.deployBlock;
        const toBlock = await contractService.getBlockNumber();

        if (fromBlock <= toBlock) {
          console.info(`[tracker] indexing events from block ${fromBlock} to ${toBlock}...`);

          const [newProductIds, newPositionIds] = await Promise.all([
            contractService.getProductIdsInRange(fromBlock, toBlock),
            contractService.getPositionIdsInRange(fromBlock, toBlock),
          ]);

          const [newProducts, newPositions] = await Promise.all([
            Promise.all(newProductIds.map((id) => contractService.getProduct(id).catch(() => null))),
            Promise.all(newPositionIds.map((id) => contractService.getPosition(id).catch(() => null))),
          ]);

          await positionService.initFromChain(
            newProducts.filter((p): p is Awaited<ReturnType<typeof contractService.getProduct>> => p !== null),
            newPositions.filter((p): p is Awaited<ReturnType<typeof contractService.getPosition>> => p !== null),
            chainStats,
          );

          await databaseService.setLastIndexedBlock(toBlock);
          console.info(`[tracker] indexed up to block ${toBlock}`);
        } else {
          positionService.applyChainStats(chainStats);
          console.info(`[tracker] already up to date at block ${lastIndexed}`);
        }
      } else {
        // Fallback: count-based parallel reads (no DEPLOY_BLOCK configured)
        const [chainProducts, chainPositions] = await Promise.all([
          contractService.getAllProducts(),
          contractService.getAllPositions(),
        ]);
        await positionService.initFromChain(chainProducts, chainPositions, chainStats);
      }

      // ── Live event poller ─────────────────────────────────────────
      // Polls every 15 s using getLogsChunked (proven reliable) instead of
      // watchContractEvent which silently drops events on RPC errors.
      if (env.deployBlock !== undefined) {
        let isPolling = false;

        const poll = async () => {
          if (isPolling) return;
          isPolling = true;
          try {
            const lastIndexed = await databaseService.getLastIndexedBlock();
            if (lastIndexed === null) return; // startup indexing not yet done

            const fromBlock = lastIndexed + 1n;
            const toBlock = await contractService.getBlockNumber();
            if (fromBlock > toBlock) return;

            const [newProductIds, newPositionIds, changedPositionIds, chainStats] =
              await Promise.all([
                contractService.getProductIdsInRange(fromBlock, toBlock),
                contractService.getPositionIdsInRange(fromBlock, toBlock),
                contractService.getPositionStatusChangesInRange(fromBlock, toBlock),
                contractService.getPoolStats(),
              ]);

            const allPositionIds = [
              ...new Set([...newPositionIds, ...changedPositionIds]),
            ];

            const [newProducts, updatedPositions] = await Promise.all([
              Promise.all(
                newProductIds.map((id) => contractService.getProduct(id).catch(() => null)),
              ),
              Promise.all(
                allPositionIds.map((id) => contractService.getPosition(id).catch(() => null)),
              ),
            ]);

            for (const p of newProducts) if (p) positionService.applyChainProduct(p);
            for (const p of updatedPositions) if (p) positionService.applyChainPosition(p);
            positionService.applyChainStats(chainStats);

            await databaseService.setLastIndexedBlock(toBlock);

            if (newProductIds.length > 0 || allPositionIds.length > 0) {
              console.info(
                `[tracker] polled blocks ${fromBlock}–${toBlock}: ` +
                `${newProductIds.length} new products, ${allPositionIds.length} position updates`,
              );
            }
          } catch (err) {
            console.error("[tracker] poll error:", err);
          } finally {
            isPolling = false;
          }
        };

        setInterval(poll, 15_000);
      }

      // Watch orchestrator for real agent logs
      contractService.watchOrchestratorEvents({
        onBatchStart: (firstPositionId, batchSize, requestId) => {
          positionService.recordLog({
            id: `batch-start-${requestId}`,
            positionId: firstPositionId,
            timestamp: new Date().toISOString(),
            agent: "TRACKER",
            action: "Batch validation started",
            data: `Agent 1 (JSON API) requested. Batch size: ${batchSize}. requestId: ${requestId}`,
            txHash: null,
          });
        },
        onStep: (firstPositionId, step, requestId) => {
          const agentNames: Record<number, string> = {
            2: "Agent 2 (LLM inference)",
            3: "Agent 3 (News verification)",
          };
          positionService.recordLog({
            id: `step-${step}-${requestId}`,
            positionId: firstPositionId,
            timestamp: new Date().toISOString(),
            agent: step === 2 ? "AGENT_2" : "AGENT_3",
            action: `Step ${step} advanced`,
            data: `${agentNames[step] ?? `Step ${step}`} requested. requestId: ${requestId}`,
            txHash: null,
          });
        },
        onVerified: (positionId, confirmedPrice, payout, txHash) => {
          positionService.recordLog({
            id: `verified-${positionId}-${Date.now()}`,
            positionId,
            timestamp: new Date().toISOString(),
            agent: "AGENT_3",
            action: "Trigger verified — payout initiated",
            data: `Confirmed price: ${Number(confirmedPrice) / 1e18} | Payout: $${Number(payout) / 1e6}`,
            txHash: txHash ?? null,
          });
          // Refresh position status
          contractService
            .getPosition(positionId)
            .then((pos) => {
              positionService.applyChainPosition(pos);
            })
            .catch(() => {});
        },
        onDenied: (firstPositionId, reason, step) => {
          positionService.recordLog({
            id: `denied-${firstPositionId}-${Date.now()}`,
            positionId: firstPositionId,
            timestamp: new Date().toISOString(),
            agent: step === 1 ? "AGENT_1" : step === 2 ? "AGENT_2" : "AGENT_3",
            action: `Trigger denied at step ${step}`,
            data: reason,
            txHash: null,
          });
        },
      });
    } catch (err) {
      console.error("[tracker] chain sync failed — running with empty state:", err);
    }
  } else {
    console.warn("[tracker] no contract addresses configured — running with empty state");
  }

  // ── Monitors ────────────────────────────────────────────────────
  startExpiryMonitor(positionService, contractService);
  startDepegMonitor(positionService, contractService);
  startRugMonitor(positionService, contractService);

  // ── Listen ──────────────────────────────────────────────────────
  server.listen(env.port, env.host, () => {
    console.info(
      `[tracker] dashboard api running at http://${env.host}:${env.port}`,
    );
  });
}

bootstrap().catch((err) => {
  console.error("[tracker] bootstrap error:", err);
  process.exit(1);
});
