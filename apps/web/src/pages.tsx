import type { ReactNode } from "react";
import {
  dashboardStats,
  demoAgentLogs,
  demoPoolStats,
  demoPositions,
  demoProducts,
} from "@sentri/config";
import { MetricCard } from "./components/MetricCard";
import { PageHeader } from "./components/PageHeader";
import { StatusBadge } from "./components/StatusBadge";

function AppLink({
  className,
  to,
  children,
}: {
  className: string;
  to: string;
  children: ReactNode;
}) {
  return (
    <a
      className={className}
      href={to}
      onClick={(event) => {
        event.preventDefault();
        window.history.pushState({}, "", to);
        window.dispatchEvent(new PopStateEvent("popstate"));
      }}
    >
      {children}
    </a>
  );
}

export function HomePage() {
  return (
    <main className="stack">
      <section className="hero-grid">
        <article className="panel panel-content">
          <div className="eyebrow">Somnia Agentathon Build</div>
          <h1 className="headline">Trustless coverage with an agent-verified claim trail.</h1>
          <p className="subtle page-description">
            This Vite app mirrors the SRD: depeg and rug products, a 24-hour activation
            window, an LP vault, and a position detail page that highlights the
            three-agent validation chain.
          </p>
          <div className="action-row">
            <AppLink className="button button-primary" to="/cover">
              Get Coverage
            </AppLink>
            <AppLink className="button button-secondary" to="/earn">
              Earn Yield
            </AppLink>
          </div>
        </article>
        <article className="panel panel-content stack">
          <div className="eyebrow">Live claim trust signal</div>
          {demoAgentLogs.slice(0, 3).map((log) => (
            <div key={log.id} className="pill split-pill">
              <span>{log.agent}</span>
              <span className="mono">{log.action}</span>
            </div>
          ))}
        </article>
      </section>

      <section className="stats-grid">
        {dashboardStats.map((stat) => (
          <MetricCard key={stat.label} stat={stat} />
        ))}
      </section>

      <section className="cards-grid">
        {demoProducts.map((product) => (
          <article key={product.id} className="panel panel-content stack">
            <div className="row-between">
              <div>
                <div className="eyebrow">{product.triggerType}</div>
                <h2 className="card-title">{product.name}</h2>
              </div>
              <StatusBadge value={product.healthStatus} />
            </div>
            <p className="subtle no-margin">
              Max position ${product.maxPerPositionUsd.toLocaleString()} with pool cap $
              {product.poolLimitUsd.toLocaleString()}.
            </p>
          </article>
        ))}
      </section>
    </main>
  );
}

export function CoverPage() {
  return (
    <main>
      <PageHeader
        eyebrow="Coverage Products"
        title="Protocol-defined products ready for wallet wiring"
        description="The SRD calls for admin-managed products only. This route is scaffolded for the product list, health indicators, and premium calculator flow."
      />
      <section className="cards-grid">
        {demoProducts.map((product) => (
          <article key={product.id} className="panel panel-content stack">
            <div className="row-between">
              <div>
                <div className="eyebrow">{product.triggerType}</div>
                <h2 className="card-title">{product.name}</h2>
              </div>
              <StatusBadge value={product.healthStatus} />
            </div>
            <div className="pill">
              Premium Rate: {(product.premiumRateBps / 100).toFixed(2)}%
            </div>
            <p className="subtle no-margin">
              Duration:{" "}
              {product.durationHours
                ? `${product.durationHours}h`
                : "Indefinite until rug trigger"}
            </p>
            <p className="subtle no-margin">
              Coverage cap per position: ${product.maxPerPositionUsd.toLocaleString()}
            </p>
            <button className="button button-primary" type="button">
              Connect wallet and buy
            </button>
          </article>
        ))}
      </section>
    </main>
  );
}

export function EarnPage() {
  const metrics = [
    ["TVL", `$${demoPoolStats.totalDepositedUsd.toLocaleString()}`],
    ["Locked", `$${demoPoolStats.totalLockedUsd.toLocaleString()}`],
    ["Utilization", `${(demoPoolStats.utilizationBps / 100).toFixed(1)}%`],
    ["APY", `${demoPoolStats.apyEstimate.toFixed(1)}%`],
    ["Share Value", `${demoPoolStats.shareValue.toFixed(3)} sLP`],
  ];

  return (
    <main>
      <PageHeader
        eyebrow="Liquidity Vault"
        title="LP dashboard scaffolded for deposits, withdrawals, and utilization-aware pricing"
        description="This route aligns with the PolicyVault requirements in the SRD and gives the team a home for wallet balance, share value, and vault actions."
      />
      <section className="cards-grid">
        {metrics.map(([label, value]) => (
          <article key={label} className="panel panel-content">
            <div className="eyebrow">{label}</div>
            <h2 className="card-title">{value}</h2>
          </article>
        ))}
      </section>
      <section className="panel panel-content section-gap">
        <div className="action-row">
          <button className="button button-primary" type="button">
            Deposit USDC
          </button>
          <button className="button button-secondary" type="button">
            Withdraw shares
          </button>
        </div>
      </section>
    </main>
  );
}

export function DashboardPage() {
  return (
    <main>
      <PageHeader
        eyebrow="My Positions"
        title="Pending, active, claimed, and expired flows from the SRD"
        description="This route is ready for contract reads and tracker events. For now it uses the shared demo data so the structure is visible immediately."
      />
      <section className="cards-grid">
        {demoPositions.map((position) => {
          const product = demoProducts.find((item) => item.id === position.productId);
          return (
            <article key={position.id} className="panel panel-content stack">
              <div className="row-between">
                <div>
                  <div className="eyebrow">Position #{position.id}</div>
                  <h2 className="card-title">{product?.name ?? "Unknown product"}</h2>
                </div>
                <StatusBadge value={position.status} />
              </div>
              <p className="subtle no-margin">
                Coverage ${position.coverageAmountUsd} for holder{" "}
                <span className="mono">{position.holder}</span>
              </p>
              <AppLink className="button button-primary" to={`/position/${position.id}`}>
                View live log
              </AppLink>
            </article>
          );
        })}
      </section>
    </main>
  );
}

export function PositionDetailPage({ pathname }: { pathname: string }) {
  const positionId = Number(pathname.split("/").pop());
  const position = demoPositions.find((item) => item.id === positionId);

  if (!position) {
    return (
      <main>
        <PageHeader
          eyebrow="Not Found"
          title="Position not found"
          description="This position does not exist in the current demo dataset."
        />
      </main>
    );
  }

  const product = demoProducts.find((item) => item.id === position.productId);
  const logs = demoAgentLogs.filter((item) => item.positionId === position.id);

  return (
    <main className="stack">
      <PageHeader
        eyebrow={`Position #${position.id}`}
        title={product?.name ?? "Position detail"}
        description="The SRD treats the live agent activity log as a primary trust signal. This scaffold gives the frontend an immediate place for those updates."
      />

      <section className="panel panel-content stack">
        <div className="row-between">
          <div>
            <div className="eyebrow">Lifecycle</div>
            <h2 className="card-title">
              Coverage ${position.coverageAmountUsd} with premium ${position.premiumUsd}
            </h2>
          </div>
          <StatusBadge value={position.status} />
        </div>
        <div className="cards-grid">
          <div className="pill">Created: {new Date(position.createdAt).toLocaleString()}</div>
          <div className="pill">
            Expires:{" "}
            {position.expiresAt
              ? new Date(position.expiresAt).toLocaleString()
              : "Rug cover"}
          </div>
        </div>
      </section>

      <section className="panel panel-content stack">
        <div className="eyebrow">Agent Activity Log</div>
        {logs.map((log) => (
          <article key={log.id} className="log-entry">
            <div className="row-between">
              <strong>{log.agent}</strong>
              <span className="mono">{new Date(log.timestamp).toLocaleString()}</span>
            </div>
            <p className="no-margin top-gap-sm">{log.action}</p>
            <p className="subtle no-margin top-gap-sm">{log.data}</p>
            {log.txHash ? <p className="mono">Tx: {log.txHash}</p> : null}
          </article>
        ))}
      </section>
    </main>
  );
}
