import { demoAgentLogs, demoPoolStats, demoPositions, demoProducts } from "@sentri/config";
import type { AgentLogEntry, PoolStats, Position, Product } from "@sentri/shared-types";
import { EventEmitter } from "node:events";
import type { ChainPoolStats, ChainPosition, ChainProduct } from "./contractService.js";

type TrackerEvents = {
  log:      [AgentLogEntry];
  position: [Position];
};

const STATUS_MAP: Record<0 | 1 | 2 | 3, Position["status"]> = {
  0: "ACTIVE",
  1: "CLAIMED",
  2: "CANCELLED",
  3: "EXPIRED",
};

const USDC_DECIMALS = 6;
const toUsd = (raw: bigint) => Number(raw) / 10 ** USDC_DECIMALS;
const wadToNumber = (raw: bigint) => Number(raw) / 1e18;

function chainProductToProduct(p: ChainProduct): Product {
  const triggerType = p.triggerType === 0 ? ("DEPEG" as const) : ("RUG" as const);

  // Decode trigger params for display
  let triggerParams: Product["triggerParams"];
  if (triggerType === "DEPEG") {
    triggerParams = { pool: "on-chain", threshold: 0.97 };
  } else {
    triggerParams = { token: "on-chain", pool: "on-chain", liquidityThresholdBps: 5000 };
  }

  const poolLimitUsd = toUsd(p.poolLimit);
  const totalCommittedUsd = toUsd(p.totalCommitted);
  const utilizationPct = poolLimitUsd > 0 ? totalCommittedUsd / poolLimitUsd : 0;
  const healthStatus: Product["healthStatus"] =
    !p.active ? "PAUSED" : utilizationPct > 0.8 ? "WATCH" : "HEALTHY";

  return {
    id: p.id,
    name: p.name,
    triggerType,
    triggerParams,
    premiumRateBps: Number(p.premiumRateBps),
    durationHours: p.duration > 0n ? Number(p.duration) / 3600 : null,
    maxPerPositionUsd: toUsd(p.maxPerPosition),
    poolLimitUsd,
    totalCommittedUsd,
    active: p.active,
    healthStatus,
  };
}

function chainPositionToPosition(p: ChainPosition): Position {
  return {
    id: p.id,
    productId: p.productId,
    holder: p.holder,
    coverageAmountUsd: toUsd(p.coverageAmount),
    premiumUsd: toUsd(p.premium),
    createdAt: new Date(Number(p.createdAt) * 1000).toISOString(),
    expiresAt: p.expiresAt > 0n ? new Date(Number(p.expiresAt) * 1000).toISOString() : null,
    status: STATUS_MAP[p.status],
    claimedPrice: p.claimedPrice > 0n ? wadToNumber(p.claimedPrice) : null,
    claimedPayoutUsd: p.claimedPayout > 0n ? toUsd(p.claimedPayout) : null,
  };
}

function chainStatsToPoolStats(s: ChainPoolStats): PoolStats {
  const totalDepositedUsd = toUsd(s.totalDeposited);
  const totalLockedUsd    = toUsd(s.totalLocked);
  const utilizationBps    = Number(s.utilizationBps);
  const shareValue        = Number(s.shareValue) / 1e18;
  // Rough APY estimate: (utilization / 10000) * avg_premium_rate * multiplier
  const utilizationPct = utilizationBps / 10000;
  const apyEstimate = Math.min(utilizationPct * 60, 80); // simple heuristic, capped 80%

  return { totalDepositedUsd, totalLockedUsd, utilizationBps, apyEstimate, shareValue };
}

export class PositionService extends EventEmitter<TrackerEvents> {
  private positions: Position[] = [];
  private logs: AgentLogEntry[] = [];
  private products: Product[] = [];
  private poolStats: PoolStats = { ...demoPoolStats };
  private synced = false;

  // ── Called once on startup with chain data ───────────────────────

  async initFromChain(
    chainProducts: ChainProduct[],
    chainPositions: ChainPosition[],
    chainStats: ChainPoolStats,
  ) {
    this.products  = chainProducts.map(chainProductToProduct);
    this.positions = chainPositions.map(chainPositionToPosition);
    this.poolStats = chainStatsToPoolStats(chainStats);
    this.synced    = true;
    console.info(`[position-service] synced ${this.products.length} products, ${this.positions.length} positions from chain`);
  }

  // Fall back to demo data if contracts aren't configured
  useDemoData() {
    if (!this.synced) {
      this.products  = [...demoProducts];
      this.positions = [...demoPositions];
      this.poolStats = { ...demoPoolStats };
      this.logs      = [...demoAgentLogs];
      console.info("[position-service] using demo data (no contract addresses configured)");
    }
  }

  // ── Apply individual updates from chain events ───────────────────

  applyChainProduct(p: ChainProduct) {
    const converted = chainProductToProduct(p);
    const idx = this.products.findIndex((x) => x.id === p.id);
    if (idx === -1) this.products.unshift(converted);
    else this.products[idx] = converted;
  }

  applyChainPosition(p: ChainPosition) {
    const converted = chainPositionToPosition(p);
    this.updatePosition(converted);
  }

  applyChainStats(s: ChainPoolStats) {
    this.poolStats = chainStatsToPoolStats(s);
  }

  // ── Accessors ────────────────────────────────────────────────────

  getProducts()  { return this.products; }
  getPositions() { return this.positions; }

  getPosition(positionId: number) {
    return this.positions.find((p) => p.id === positionId) ?? null;
  }

  getAgentLogs(positionId?: number) {
    if (typeof positionId === "number") {
      return this.logs.filter((l) => l.positionId === positionId);
    }
    return this.logs;
  }

  getPoolStats() { return this.poolStats; }

  // ── Mutations ────────────────────────────────────────────────────

  updatePosition(next: Position) {
    const idx = this.positions.findIndex((p) => p.id === next.id);
    if (idx === -1) this.positions.unshift(next);
    else this.positions[idx] = next;
    this.emit("position", next);
  }

  recordLog(entry: AgentLogEntry) {
    this.logs.unshift(entry);
    this.emit("log", entry);
  }

  seedHeartbeat(positionId: number, action: string, data: string) {
    this.recordLog({
      id:        `heartbeat-${Date.now()}`,
      positionId,
      timestamp: new Date().toISOString(),
      agent:     "TRACKER",
      action,
      data,
      txHash:    null,
    });
  }
}
