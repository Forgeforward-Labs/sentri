export type TriggerType = "DEPEG" | "RUG";

export type PositionStatus =
  | "ACTIVE"
  | "CLAIMED"
  | "CANCELLED"
  | "EXPIRED";

export interface DepegParams {
  pool: string;
  threshold: number;
}

export interface RugParams {
  token: string;
  pool: string;
  liquidityThresholdBps: number;
}

export type TriggerParams = DepegParams | RugParams;

export interface Product {
  id: number;
  name: string;
  triggerType: TriggerType;
  triggerParams: TriggerParams;
  premiumRateBps: number;
  durationHours: number | null;
  maxPerPositionUsd: number;
  poolLimitUsd: number;
  totalCommittedUsd: number;
  active: boolean;
  healthStatus: "HEALTHY" | "WATCH" | "PAUSED";
}

export interface Position {
  id: number;
  productId: number;
  holder: string;
  coverageAmountUsd: number;
  premiumUsd: number;
  createdAt: string;
  expiresAt: string | null;
  status: PositionStatus;
  claimedPrice: number | null;
  claimedPayoutUsd: number | null;
}

export interface AgentLogEntry {
  id: string;
  positionId: number;
  timestamp: string;
  agent: "TRACKER" | "AGENT_1" | "AGENT_2" | "AGENT_3";
  action: string;
  data: string;
  txHash: string | null;
}

export interface PoolStats {
  totalDepositedUsd: number;
  totalLockedUsd: number;
  utilizationBps: number;
  apyEstimate: number;
  shareValue: number;
}

export interface DashboardStat {
  label: string;
  value: string;
  detail: string;
}
