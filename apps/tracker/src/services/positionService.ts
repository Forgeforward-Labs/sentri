import type {
  AgentLogEntry,
  AnalyticsSummary,
  Claim,
  Participant,
  PoolSnapshot,
  PoolStats,
  Position,
  Product,
  ProductStats,
} from "@sentri/shared-types";
import { EventEmitter } from "node:events";
import type { ChainPoolStats, ChainPosition, ChainProduct } from "./contractService.js";
import { DatabaseService } from "./databaseService.js";

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
  private poolStats: PoolStats = {
    totalDepositedUsd: 0,
    totalLockedUsd: 0,
    utilizationBps: 0,
    apyEstimate: 0,
    shareValue: 1,
  };
  private readonly db = new DatabaseService();

  // ── Called first on startup: restore from DB ────────────────────

  async initFromDb() {
    const [dbProducts, dbPositions, dbLogs] = await Promise.all([
      this.db.getAllProducts(),
      this.db.getAllPositions(),
      this.db.getAllLogs(),
    ]);
    this.products  = dbProducts;
    this.positions = dbPositions;
    this.logs      = dbLogs;
    if (dbProducts.length > 0 || dbPositions.length > 0) {
        console.info(
        `[position-service] restored ${dbProducts.length} products, ${dbPositions.length} positions from DB`,
      );
    }
  }

  // ── Called after initFromDb to apply new chain data ─────────────

  async initFromChain(
    chainProducts: ChainProduct[],
    chainPositions: ChainPosition[],
    chainStats: ChainPoolStats,
  ) {
    // Incremental upsert on top of DB-restored state
    for (const p of chainProducts) this.applyChainProduct(p);
    for (const p of chainPositions) this.applyChainPosition(p);
    this.applyChainStats(chainStats);

    console.info(
      `[position-service] applied ${chainProducts.length} products, ${chainPositions.length} positions from chain`,
    );
  }

  // ── Apply individual updates from chain events ───────────────────

  applyChainProduct(p: ChainProduct) {
    const converted = chainProductToProduct(p);
    const idx = this.products.findIndex((x) => x.id === p.id);
    if (idx === -1) this.products.unshift(converted);
    else this.products[idx] = converted;
    this.db.upsertProduct(converted).catch((err) =>
      console.error("[db] upsertProduct failed:", err),
    );
  }

  applyChainPosition(p: ChainPosition) {
    const converted = chainPositionToPosition(p);
    this.updatePosition(converted);
  }

  applyChainStats(s: ChainPoolStats) {
    this.poolStats = chainStatsToPoolStats(s);
    this.db.insertPoolSnapshot({
      totalDepositedUsd: this.poolStats.totalDepositedUsd,
      totalLockedUsd:    this.poolStats.totalLockedUsd,
      utilizationBps:    this.poolStats.utilizationBps,
    }).catch(() => {});
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

  // ── Analytics ────────────────────────────────────────────────────

  /**
   * Derives claims from positions that have status=CLAIMED.
   * Uses agent_logs to find the txHash and claimedAt timestamp.
   */
  getClaims(): Claim[] {
    return this.positions
      .filter((p) => p.status === "CLAIMED")
      .map((p) => {
        const log = this.logs.find(
          (l) => l.positionId === p.id && l.agent === "AGENT_3" && l.txHash,
        );
        return {
          positionId:     p.id,
          productId:      p.productId,
          holder:         p.holder,
          coverageUsd:    p.coverageAmountUsd,
          payoutUsd:      p.claimedPayoutUsd ?? 0,
          confirmedPrice: p.claimedPrice,
          claimedAt:      log?.timestamp ?? p.createdAt,
          txHash:         log?.txHash ?? null,
        };
      });
  }

  /** Aggregates per-address stats from all positions. */
  getParticipants(): Participant[] {
    const map = new Map<string, Position[]>();
    for (const pos of this.positions) {
      const key = pos.holder.toLowerCase();
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(pos);
    }
    return Array.from(map.entries()).map(([address, posns]) => {
      const active  = posns.filter((p) => p.status === "ACTIVE");
      const claimed = posns.filter((p) => p.status === "CLAIMED");
      const sorted  = [...posns].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      return {
        address,
        totalCoverageUsd: posns.reduce((s, p) => s + p.coverageAmountUsd, 0),
        totalPremiumUsd:  posns.reduce((s, p) => s + p.premiumUsd, 0),
        activePositions:  active.length,
        totalPositions:   posns.length,
        claimedCount:     claimed.length,
        totalPayoutUsd:   claimed.reduce((s, p) => s + (p.claimedPayoutUsd ?? 0), 0),
        firstSeenAt:      sorted[0].createdAt,
        lastSeenAt:       sorted[sorted.length - 1].createdAt,
      };
    });
  }

  getParticipant(address: string): Participant | null {
    const participants = this.getParticipants();
    return participants.find((p) => p.address === address.toLowerCase()) ?? null;
  }

  getAnalytics(): AnalyticsSummary {
    const active  = this.positions.filter((p) => p.status === "ACTIVE");
    const claimed = this.positions.filter((p) => p.status === "CLAIMED");

    const productStats: ProductStats[] = this.products.map((product) => {
      const posns        = this.positions.filter((p) => p.productId === product.id);
      const productActive = posns.filter((p) => p.status === "ACTIVE");
      const productClaimed = posns.filter((p) => p.status === "CLAIMED");
      return {
        id:               product.id,
        name:             product.name,
        triggerType:      product.triggerType,
        activePositions:  productActive.length,
        totalPositions:   posns.length,
        totalCoverageUsd: posns.reduce((s, p) => s + p.coverageAmountUsd, 0),
        totalPremiumUsd:  posns.reduce((s, p) => s + p.premiumUsd, 0),
        totalPayoutsUsd:  productClaimed.reduce((s, p) => s + (p.claimedPayoutUsd ?? 0), 0),
        claimCount:       productClaimed.length,
        claimRate:        posns.length > 0 ? productClaimed.length / posns.length : 0,
        utilizationPct:   product.poolLimitUsd > 0
          ? product.totalCommittedUsd / product.poolLimitUsd
          : 0,
      };
    });

    const participants = new Set(this.positions.map((p) => p.holder.toLowerCase())).size;

    return {
      totalActiveCoverageUsd: active.reduce((s, p) => s + p.coverageAmountUsd, 0),
      totalLockedPremiumUsd:  active.reduce((s, p) => s + p.premiumUsd, 0),
      totalPayoutsUsd:        claimed.reduce((s, p) => s + (p.claimedPayoutUsd ?? 0), 0),
      totalParticipants:      participants,
      totalPositions:         this.positions.length,
      activePositions:        active.length,
      claimCount:             claimed.length,
      claimRate:              this.positions.length > 0 ? claimed.length / this.positions.length : 0,
      productStats,
    };
  }

  async getPoolSnapshots(limit?: number): Promise<PoolSnapshot[]> {
    return this.db.getPoolSnapshots(limit);
  }

  // ── Mutations ────────────────────────────────────────────────────

  updatePosition(next: Position) {
    const idx = this.positions.findIndex((p) => p.id === next.id);
    if (idx === -1) this.positions.unshift(next);
    else this.positions[idx] = next;
    this.db.upsertPosition(next).catch((err) =>
      console.error("[db] upsertPosition failed:", err),
    );
    this.emit("position", next);
  }

  recordLog(entry: AgentLogEntry) {
    this.logs.unshift(entry);
    this.db.insertLog(entry).catch((err) =>
      console.error("[db] insertLog failed:", err),
    );
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
