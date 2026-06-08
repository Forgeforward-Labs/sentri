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

// ── Analytics types ──────────────────────────────────────────────

export interface Participant {
  address: string;
  totalCoverageUsd: number;
  totalPremiumUsd: number;
  activePositions: number;
  totalPositions: number;
  claimedCount: number;
  totalPayoutUsd: number;
  firstSeenAt: string;
  lastSeenAt: string;
}

/** A claimed position enriched with event metadata. */
export interface Claim {
  positionId: number;
  productId: number;
  holder: string;
  coverageUsd: number;
  payoutUsd: number;
  confirmedPrice: number | null;
  claimedAt: string;
  txHash: string | null;
}

export interface ProductStats {
  id: number;
  name: string;
  triggerType: TriggerType;
  activePositions: number;
  totalPositions: number;
  totalCoverageUsd: number;
  totalPremiumUsd: number;
  totalPayoutsUsd: number;
  claimCount: number;
  /** Fraction of positions that resulted in a claim (0–1). */
  claimRate: number;
  /** Committed / pool limit (0–1). */
  utilizationPct: number;
}

export interface AnalyticsSummary {
  totalActiveCoverageUsd: number;
  totalLockedPremiumUsd: number;
  totalPayoutsUsd: number;
  totalParticipants: number;
  totalPositions: number;
  activePositions: number;
  claimCount: number;
  /** Protocol-wide claim rate (0–1). */
  claimRate: number;
  productStats: ProductStats[];
}

export interface PoolSnapshot {
  timestamp: string;
  totalDepositedUsd: number;
  totalLockedUsd: number;
  utilizationBps: number;
}
