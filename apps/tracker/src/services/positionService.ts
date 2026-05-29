import { demoAgentLogs, demoPositions, demoProducts, demoPoolStats } from "@sentri/config";
import type { AgentLogEntry, PoolStats, Position, Product } from "@sentri/shared-types";
import { EventEmitter } from "node:events";

type TrackerEvents = {
  log: [AgentLogEntry];
  position: [Position];
};

export class PositionService extends EventEmitter<TrackerEvents> {
  private positions = [...demoPositions];
  private logs = [...demoAgentLogs];
  private products = [...demoProducts];
  private poolStats: PoolStats = { ...demoPoolStats };

  getProducts() {
    return this.products;
  }

  getPositions() {
    return this.positions;
  }

  getPosition(positionId: number) {
    return this.positions.find((position) => position.id === positionId) ?? null;
  }

  getAgentLogs(positionId?: number) {
    if (typeof positionId === "number") {
      return this.logs.filter((log) => log.positionId === positionId);
    }

    return this.logs;
  }

  getPoolStats() {
    return this.poolStats;
  }

  updatePosition(nextPosition: Position) {
    const index = this.positions.findIndex((position) => position.id === nextPosition.id);

    if (index === -1) {
      this.positions.unshift(nextPosition);
    } else {
      this.positions[index] = nextPosition;
    }

    this.emit("position", nextPosition);
  }

  recordLog(entry: AgentLogEntry) {
    this.logs.unshift(entry);
    this.emit("log", entry);
  }

  seedHeartbeat(positionId: number, action: string, data: string) {
    this.recordLog({
      id: `heartbeat-${Date.now()}`,
      positionId,
      timestamp: new Date().toISOString(),
      agent: "TRACKER",
      action,
      data,
      txHash: null,
    });
  }
}
