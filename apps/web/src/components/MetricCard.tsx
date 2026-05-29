import type { DashboardStat } from "@sentri/shared-types";

export function MetricCard({ stat }: { stat: DashboardStat }) {
  return (
    <article className="panel panel-content">
      <div className="eyebrow">{stat.label}</div>
      <h3 className="metric-value">{stat.value}</h3>
      <p className="subtle no-margin">{stat.detail}</p>
    </article>
  );
}
