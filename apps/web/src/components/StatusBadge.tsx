import type { PositionStatus, Product } from "@sentri/shared-types";

type StatusValue = PositionStatus | Product["healthStatus"];

export function StatusBadge({ value }: { value: StatusValue }) {
  const normalized = value.toLowerCase();
  return <span className={`status status-${normalized}`}>{value}</span>;
}
