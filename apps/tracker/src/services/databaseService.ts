import { desc, eq } from "drizzle-orm";
import type { AgentLogEntry, PoolSnapshot, Position, Product } from "@sentri/shared-types";
import { db } from "../db/index.js";
import { agentLogs, indexerState, poolSnapshots, positions, products } from "../db/schema.js";

export class DatabaseService {
  // ── Products ──────────────────────────────────────────────────────

  async upsertProduct(p: Product) {
    await db
      .insert(products)
      .values({
        id:                p.id,
        name:              p.name,
        triggerType:       p.triggerType,
        premiumRateBps:    p.premiumRateBps,
        durationHours:     p.durationHours ?? null,
        maxPerPositionUsd: p.maxPerPositionUsd,
        poolLimitUsd:      p.poolLimitUsd,
        totalCommittedUsd: p.totalCommittedUsd,
        active:            p.active,
        healthStatus:      p.healthStatus,
      })
      .onConflictDoUpdate({
        target: products.id,
        set: {
          name:              p.name,
          premiumRateBps:    p.premiumRateBps,
          totalCommittedUsd: p.totalCommittedUsd,
          active:            p.active,
          healthStatus:      p.healthStatus,
        },
      });
  }

  async getAllProducts(): Promise<Product[]> {
    const rows = await db.select().from(products).orderBy(products.id);
    return rows.map(rowToProduct);
  }

  // ── Positions ─────────────────────────────────────────────────────

  async upsertPosition(p: Position) {
    await db
      .insert(positions)
      .values({
        id:                p.id,
        productId:         p.productId,
        holder:            p.holder,
        coverageAmountUsd: p.coverageAmountUsd,
        premiumUsd:        p.premiumUsd,
        createdAt:         p.createdAt,
        expiresAt:         p.expiresAt ?? null,
        status:            p.status,
        claimedPrice:      p.claimedPrice ?? null,
        claimedPayoutUsd:  p.claimedPayoutUsd ?? null,
      })
      .onConflictDoUpdate({
        target: positions.id,
        set: {
          status:           p.status,
          claimedPrice:     p.claimedPrice ?? null,
          claimedPayoutUsd: p.claimedPayoutUsd ?? null,
        },
      });
  }

  async getAllPositions(): Promise<Position[]> {
    const rows = await db.select().from(positions).orderBy(positions.id);
    return rows.map(rowToPosition);
  }

  // ── Agent logs ────────────────────────────────────────────────────

  async insertLog(entry: AgentLogEntry) {
    await db
      .insert(agentLogs)
      .values({
        id:         entry.id,
        positionId: entry.positionId,
        timestamp:  entry.timestamp,
        agent:      entry.agent,
        action:     entry.action,
        data:       entry.data,
        txHash:     entry.txHash ?? null,
      })
      .onConflictDoNothing();
  }

  async getLogsForPosition(positionId: number): Promise<AgentLogEntry[]> {
    const rows = await db
      .select()
      .from(agentLogs)
      .where(eq(agentLogs.positionId, positionId))
      .orderBy(agentLogs.timestamp);
    return rows.map(rowToLog);
  }

  async getAllLogs(): Promise<AgentLogEntry[]> {
    const rows = await db.select().from(agentLogs).orderBy(agentLogs.timestamp);
    return rows.map(rowToLog);
  }

  // ── Pool snapshots ────────────────────────────────────────────────

  async insertPoolSnapshot(s: {
    totalDepositedUsd: number;
    totalLockedUsd: number;
    utilizationBps: number;
  }): Promise<void> {
    await db.insert(poolSnapshots).values({
      timestamp:        new Date().toISOString(),
      totalDepositedUsd: s.totalDepositedUsd,
      totalLockedUsd:   s.totalLockedUsd,
      utilizationBps:   s.utilizationBps,
    });
  }

  async getPoolSnapshots(limit = 48): Promise<PoolSnapshot[]> {
    const rows = await db
      .select()
      .from(poolSnapshots)
      .orderBy(desc(poolSnapshots.id))
      .limit(limit);
    return rows.reverse().map((r) => ({
      timestamp:        r.timestamp,
      totalDepositedUsd: r.totalDepositedUsd,
      totalLockedUsd:   r.totalLockedUsd,
      utilizationBps:   r.utilizationBps,
    }));
  }

  // ── Indexer state ─────────────────────────────────────────────────

  async getLastIndexedBlock(): Promise<bigint | null> {
    const rows = await db
      .select()
      .from(indexerState)
      .where(eq(indexerState.key, "lastBlock"))
      .limit(1);
    return rows[0] ? BigInt(rows[0].value) : null;
  }

  async setLastIndexedBlock(block: bigint): Promise<void> {
    await db
      .insert(indexerState)
      .values({ key: "lastBlock", value: block.toString() })
      .onConflictDoUpdate({
        target: indexerState.key,
        set: { value: block.toString() },
      });
  }
}

// ── Row mappers ───────────────────────────────────────────────────

function rowToProduct(r: typeof products.$inferSelect): Product {
  return {
    id:                r.id,
    name:              r.name,
    triggerType:       r.triggerType as "DEPEG" | "RUG",
    triggerParams:     r.triggerType === "DEPEG"
      ? { pool: "on-chain", threshold: 0.97 }
      : { token: "on-chain", pool: "on-chain", liquidityThresholdBps: 5000 },
    premiumRateBps:    r.premiumRateBps,
    durationHours:     r.durationHours ?? null,
    maxPerPositionUsd: r.maxPerPositionUsd,
    poolLimitUsd:      r.poolLimitUsd,
    totalCommittedUsd: r.totalCommittedUsd,
    active:            r.active,
    healthStatus:      r.healthStatus as Product["healthStatus"],
  };
}

function rowToPosition(r: typeof positions.$inferSelect): Position {
  return {
    id:                r.id,
    productId:         r.productId,
    holder:            r.holder,
    coverageAmountUsd: r.coverageAmountUsd,
    premiumUsd:        r.premiumUsd,
    createdAt:         r.createdAt,
    expiresAt:         r.expiresAt ?? null,
    status:            r.status as Position["status"],
    claimedPrice:      r.claimedPrice ?? null,
    claimedPayoutUsd:  r.claimedPayoutUsd ?? null,
  };
}

function rowToLog(r: typeof agentLogs.$inferSelect): AgentLogEntry {
  return {
    id:         r.id,
    positionId: r.positionId,
    timestamp:  r.timestamp,
    agent:      r.agent as AgentLogEntry["agent"],
    action:     r.action,
    data:       r.data,
    txHash:     r.txHash ?? null,
  };
}
