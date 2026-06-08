import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useReadContract, useReadContracts } from "wagmi";
import { formatUnits } from "viem";
import type {
  AgentLogEntry,
  AnalyticsSummary,
  Claim,
  Participant,
  PoolSnapshot,
  PoolStats,
  Position,
  Product,
} from "@sentri/shared-types";
import { TRACKER_URL, CORE_ADDRESS, USDC_DECIMALS, INSURANCE_CORE_ADMIN_ABI } from "./contracts.js";

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(`${TRACKER_URL}${path}`);
  if (!res.ok) throw new Error(`${path} → ${res.status}`);
  return res.json() as Promise<T>;
}

export function useProducts() {
  return useQuery<Product[]>({
    queryKey: ["products"],
    queryFn: () => fetchJson<Product[]>("/products"),
    staleTime: 30_000,
  });
}

export function usePositions() {
  return useQuery<Position[]>({
    queryKey: ["positions"],
    queryFn: () => fetchJson<Position[]>("/positions"),
    staleTime: 15_000,
  });
}

export function usePosition(id: number) {
  return useQuery<Position>({
    queryKey: ["position", id],
    queryFn: () => fetchJson<Position>(`/positions/${id}`),
    staleTime: 10_000,
  });
}

export function usePositionLogs(id: number) {
  return useQuery<AgentLogEntry[]>({
    queryKey: ["position-logs", id],
    queryFn: () => fetchJson<AgentLogEntry[]>(`/positions/${id}/logs`),
    staleTime: 10_000,
    refetchInterval: 10_000,
  });
}

export function useAgentLogs(limit?: number) {
  return useQuery<AgentLogEntry[]>({
    queryKey: ["agent-logs", limit],
    queryFn: () => fetchJson<AgentLogEntry[]>(`/logs${limit ? `?limit=${limit}` : ""}`),
    staleTime: 5_000,
    refetchInterval: 10_000,
  });
}

export function useAnalytics() {
  return useQuery<AnalyticsSummary>({
    queryKey: ["analytics"],
    queryFn: () => fetchJson<AnalyticsSummary>("/analytics"),
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
}

export function useClaims() {
  return useQuery<Claim[]>({
    queryKey: ["claims"],
    queryFn: () => fetchJson<Claim[]>("/claims"),
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
}

export function useParticipants() {
  return useQuery<Participant[]>({
    queryKey: ["participants"],
    queryFn: () => fetchJson<Participant[]>("/participants"),
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
}

export function useParticipant(address: string | undefined) {
  return useQuery<Participant>({
    queryKey: ["participant", address],
    queryFn: () => fetchJson<Participant>(`/participants/${address}`),
    enabled: !!address,
    staleTime: 15_000,
  });
}

export function usePoolSnapshots() {
  return useQuery<PoolSnapshot[]>({
    queryKey: ["pool-snapshots"],
    queryFn: () => fetchJson<PoolSnapshot[]>("/pool-snapshots"),
    staleTime: 60_000,
    refetchInterval: 60_000,
  });
}

export function usePoolStats() {
  return useQuery<PoolStats>({
    queryKey: ["pool-stats"],
    queryFn: () => fetchJson<PoolStats>("/pool-stats"),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

// ── Direct on-chain product reader ──────────────────────────────────────────

// Flat multiple-output returns from viem: result is an array that also has named properties
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toProduct(p: any): Product {
  const id             = (p.id             ?? p[0])  as bigint;
  const name           = (p.name           ?? p[1])  as string;
  const triggerType    = Number(p.triggerType    ?? p[2]);
  const premiumRateBps = (p.premiumRateBps ?? p[4])  as bigint;
  const duration       = (p.duration       ?? p[5])  as bigint;
  const maxPerPosition = (p.maxPerPosition ?? p[6])  as bigint;
  const poolLimit      = (p.poolLimit      ?? p[7])  as bigint;
  const totalCommitted = (p.totalCommitted ?? p[8])  as bigint;
  const active         = Boolean(p.active  ?? p[10]);

  const utilPct = poolLimit > 0n
    ? Number(totalCommitted) / Number(poolLimit)
    : 0;
  const healthStatus: Product["healthStatus"] = !active
    ? "PAUSED"
    : utilPct > 0.9 ? "WATCH" : "HEALTHY";

  return {
    id:               Number(id),
    name,
    triggerType:      triggerType === 0 ? "DEPEG" : "RUG",
    triggerParams:    triggerType === 0
      ? { pool: "0x", threshold: 0.97 }
      : { token: "0x", pool: "0x", liquidityThresholdBps: 2000 },
    premiumRateBps:    Number(premiumRateBps),
    durationHours:     duration === 0n ? null : Number(duration) / 3600,
    maxPerPositionUsd: Number(formatUnits(maxPerPosition, USDC_DECIMALS)),
    poolLimitUsd:      Number(formatUnits(poolLimit, USDC_DECIMALS)),
    totalCommittedUsd: Number(formatUnits(totalCommitted, USDC_DECIMALS)),
    active,
    healthStatus,
  };
}

/**
 * Reads all products directly from InsuranceCore on-chain.
 * Polls every 30 seconds.
 */
export function useChainProducts(): { data: Product[]; isLoading: boolean } {
  const { data: count, isLoading: countLoading } = useReadContract({
    address: CORE_ADDRESS,
    abi: INSURANCE_CORE_ADMIN_ABI,
    functionName: "productCount",
    query: { enabled: !!CORE_ADDRESS, refetchInterval: 30_000 },
  });

  const total = Number(count ?? 0);

  const contracts = useMemo(
    () =>
      Array.from({ length: total }, (_, i) => ({
        address: CORE_ADDRESS!,
        abi: INSURANCE_CORE_ADMIN_ABI,
        functionName: "products" as const,
        args: [BigInt(i + 1)] as [bigint],
      })),
    [total],
  );

  const { data: results, isLoading: resultsLoading } = useReadContracts({
    contracts,
    query: { enabled: total > 0 && !!CORE_ADDRESS, refetchInterval: 30_000 },
  });

  const products = (results ?? [])
    .map((r) => (r.status === "success" && r.result ? toProduct(r.result) : null))
    .filter((p): p is Product => p !== null && p.id > 0);

  return { data: products, isLoading: countLoading || (total > 0 && resultsLoading) };
}

// ── Direct on-chain position reader ─────────────────────────────────────────

// Matches PositionStatus enum in InsuranceCore.sol: ACTIVE=0, CLAIMED=1, CANCELLED=2, EXPIRED=3
const STATUS_MAP = ["ACTIVE", "CLAIMED", "CANCELLED", "EXPIRED"] as const;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toPosition(p: any): Position {
  const id             = (p.id             ?? p[0]) as bigint;
  const productId      = (p.productId      ?? p[1]) as bigint;
  const holder         = (p.holder         ?? p[2]) as `0x${string}`;
  const coverageAmount = (p.coverageAmount ?? p[3]) as bigint;
  const premium        = (p.premium        ?? p[4]) as bigint;
  const createdAt      = (p.createdAt      ?? p[5]) as bigint;
  const expiresAt      = (p.expiresAt      ?? p[6]) as bigint;
  const status         = Number(p.status   ?? p[7]);
  const claimedPrice   = (p.claimedPrice   ?? p[8]) as bigint;
  const claimedPayout  = (p.claimedPayout  ?? p[9]) as bigint;

  return {
    id:               Number(id),
    productId:        Number(productId),
    holder,
    coverageAmountUsd: Number(formatUnits(coverageAmount, USDC_DECIMALS)),
    premiumUsd:        Number(formatUnits(premium, USDC_DECIMALS)),
    createdAt:         new Date(Number(createdAt) * 1000).toISOString(),
    expiresAt:         expiresAt === 0n ? null : new Date(Number(expiresAt) * 1000).toISOString(),
    status:            STATUS_MAP[status] ?? "ACTIVE",
    claimedPrice:      claimedPrice === 0n ? null : Number(claimedPrice) / 1e8,
    claimedPayoutUsd:  claimedPayout === 0n ? null : Number(formatUnits(claimedPayout, USDC_DECIMALS)),
  };
}

/**
 * Reads all positions directly from InsuranceCore on-chain.
 * When `holder` is provided, only returns positions for that address.
 * Polls every 8 seconds so new positions appear quickly without page refresh.
 */
export function useChainPositions(holder?: string): { data: Position[]; isLoading: boolean } {
  const { data: count, isLoading: countLoading } = useReadContract({
    address: CORE_ADDRESS,
    abi: INSURANCE_CORE_ADMIN_ABI,
    functionName: "positionCount",
    query: { enabled: !!CORE_ADDRESS, refetchInterval: 8_000 },
  });

  const total = Number(count ?? 0);

  const contracts = useMemo(
    () =>
      Array.from({ length: total }, (_, i) => ({
        address: CORE_ADDRESS!,
        abi: INSURANCE_CORE_ADMIN_ABI,
        functionName: "positions" as const,
        args: [BigInt(i + 1)] as [bigint],
      })),
    [total],
  );

  const { data: results, isLoading: resultsLoading } = useReadContracts({
    contracts,
    query: { enabled: total > 0 && !!CORE_ADDRESS, refetchInterval: 8_000 },
  });

  const positions = (results ?? [])
    .map((r) => (r.status === "success" && r.result ? toPosition(r.result) : null))
    .filter((p): p is Position =>
      p !== null &&
      p.id > 0 &&
      (!holder || p.holder.toLowerCase() === holder.toLowerCase())
    );

  return { data: positions, isLoading: countLoading || (total > 0 && resultsLoading) };
}

/**
 * Reads a single position directly from InsuranceCore on-chain.
 */
export function useChainPosition(id: number): { data: Position | null; isLoading: boolean } {
  const { data: result, isLoading } = useReadContract({
    address: CORE_ADDRESS,
    abi: INSURANCE_CORE_ADMIN_ABI,
    functionName: "positions",
    args: [BigInt(id)],
    query: { enabled: !!CORE_ADDRESS && id > 0, refetchInterval: 10_000 },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const raw = result as any;
  const position = raw ? toPosition(raw) : null;

  // A position with id=0 means it doesn't exist on-chain
  const exists = position !== null && position.id > 0;

  return { data: exists ? position : null, isLoading };
}
