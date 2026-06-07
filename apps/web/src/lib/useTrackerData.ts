import { useQuery } from "@tanstack/react-query";
import { demoPoolStats } from "@sentri/config";
import type { AgentLogEntry, PoolStats, Position, Product } from "@sentri/shared-types";
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

export function usePoolStats() {
  return useQuery<PoolStats>({
    queryKey: ["pool-stats"],
    queryFn: () => fetchJson<PoolStats>("/pool-stats"),
    initialData: demoPoolStats,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}
