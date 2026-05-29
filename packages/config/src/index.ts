import type {
  AgentLogEntry,
  DashboardStat,
  PoolStats,
  Position,
  Product,
} from "@sentri/shared-types";

export const appNavigation = [
  { href: "/", label: "Overview" },
  { href: "/cover", label: "Get Coverage" },
  { href: "/earn", label: "Earn Yield" },
  { href: "/dashboard", label: "My Positions" },
];

export const dashboardStats: DashboardStat[] = [
  {
    label: "Total Protected",
    value: "$245k",
    detail: "Seeded from SRD demo products and sample positions.",
  },
  {
    label: "Payouts Made",
    value: "$18.4k",
    detail: "Shows the proportional depeg and full rug payout model.",
  },
  {
    label: "Active Positions",
    value: "42",
    detail: "Mix of ACTIVE, CLAIMED, and EXPIRED lifecycle examples.",
  },
];

export const demoProducts: Product[] = [
  {
    id: 1,
    name: "USDC Depeg 24h",
    triggerType: "DEPEG",
    triggerParams: { pool: "0xQuickSwapPool", threshold: 0.97 },
    premiumRateBps: 15,
    durationHours: 24,
    maxPerPositionUsd: 1000,
    poolLimitUsd: 100000,
    totalCommittedUsd: 22000,
    active: true,
    healthStatus: "HEALTHY",
  },
  {
    id: 2,
    name: "USDC Depeg 7d",
    triggerType: "DEPEG",
    triggerParams: { pool: "0xQuickSwapPool", threshold: 0.97 },
    premiumRateBps: 105,
    durationHours: 24 * 7,
    maxPerPositionUsd: 5000,
    poolLimitUsd: 150000,
    totalCommittedUsd: 64000,
    active: true,
    healthStatus: "WATCH",
  },
  {
    id: 3,
    name: "TOKEN_X Rug Protection",
    triggerType: "RUG",
    triggerParams: {
      token: "0xTokenX",
      pool: "0xTokenXPool",
      liquidityThresholdBps: 5000,
    },
    premiumRateBps: 500,
    durationHours: null,
    maxPerPositionUsd: 3000,
    poolLimitUsd: 90000,
    totalCommittedUsd: 18000,
    active: true,
    healthStatus: "HEALTHY",
  },
];

export const demoPositions: Position[] = [
  {
    id: 101,
    productId: 2,
    holder: "0x3e1F...A42b",
    coverageAmountUsd: 500,
    premiumUsd: 5.25,
    createdAt: "2026-05-27T10:00:00.000Z",
    expiresAt: "2026-06-04T10:00:00.000Z",
    status: "ACTIVE",
    claimedPrice: null,
    claimedPayoutUsd: null,
  },
  {
    id: 102,
    productId: 1,
    holder: "0x91ce...77B3",
    coverageAmountUsd: 1200,
    premiumUsd: 1.8,
    createdAt: "2026-05-25T08:00:00.000Z",
    expiresAt: "2026-05-27T08:00:00.000Z",
    status: "CLAIMED",
    claimedPrice: 0.94,
    claimedPayoutUsd: 72,
  },
  {
    id: 103,
    productId: 3,
    holder: "0x8bc2...002f",
    coverageAmountUsd: 300,
    premiumUsd: 15,
    createdAt: "2026-05-20T12:00:00.000Z",
    expiresAt: null,
    status: "ACTIVE",
    claimedPrice: null,
    claimedPayoutUsd: null,
  },
];

export const demoPoolStats: PoolStats = {
  totalDepositedUsd: 325000,
  totalLockedUsd: 104000,
  utilizationBps: 3200,
  apyEstimate: 18.6,
  shareValue: 1.084,
};

export const demoAgentLogs: AgentLogEntry[] = [
  {
    id: "log-1",
    positionId: 102,
    timestamp: "2026-05-27T08:00:04.000Z",
    agent: "TRACKER",
    action: "Expiry check triggered",
    data: "Tracker saw expiry and queued depeg validation.",
    txHash: "0xabc001",
  },
  {
    id: "log-2",
    positionId: 102,
    timestamp: "2026-05-27T08:00:18.000Z",
    agent: "AGENT_1",
    action: "CoinGecko confirmation",
    data: "Confirmed USDC at 0.94 versus threshold 0.97.",
    txHash: "0xabc002",
  },
  {
    id: "log-3",
    positionId: 102,
    timestamp: "2026-05-27T08:00:29.000Z",
    agent: "AGENT_2",
    action: "LLM inference",
    data: "Event classified as VALID depeg with sustained deviation.",
    txHash: "0xabc003",
  },
  {
    id: "log-4",
    positionId: 102,
    timestamp: "2026-05-27T08:00:44.000Z",
    agent: "AGENT_3",
    action: "News and socials parse",
    data: "Found corroborating depeg reports across news feeds.",
    txHash: "0xabc004",
  },
];

export const trackerIntervals = {
  expiryMonitorMs: 60_000,
  syntheticDemoLogMs: 45_000,
};
