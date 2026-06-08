import { useQuery } from "@tanstack/react-query";
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
import { TRACKER_URL } from "./contracts.js";

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

