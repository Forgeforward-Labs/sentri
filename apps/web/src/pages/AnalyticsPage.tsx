import { ExternalLink } from 'lucide-react'
import { useAnalytics, useClaims, useParticipants } from '../lib/useTrackerData'
import { formatUsd, formatDate, formatAddress, cn } from '../lib/utils'
import type { ProductStats } from '@sentri/shared-types'

const EXPLORER_BASE = 'https://somnia-testnet.socialscan.io'

// ── Stat card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
      <p className="text-slate-400 text-sm mb-1">{label}</p>
      <p className="text-white font-black text-3xl">{value}</p>
      {sub && <p className="text-slate-500 text-xs mt-1">{sub}</p>}
    </div>
  )
}

// ── Product performance table ────────────────────────────────────────────────

function UtilBar({ pct }: { pct: number }) {
  const width = Math.min(Math.round(pct * 100), 100)
  const color = pct > 0.8 ? 'bg-red-500' : pct > 0.5 ? 'bg-amber-400' : 'bg-brand-400'
  return (
    <div className="flex items-center gap-2 min-w-[100px]">
      <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
        <div className={cn('h-full rounded-full', color)} style={{ width: `${width}%` }} />
      </div>
      <span className="text-xs text-slate-400 w-8 text-right">{width}%</span>
    </div>
  )
}

function ProductTable({ stats }: { stats: ProductStats[] }) {
  if (stats.length === 0) {
    return <p className="text-slate-500 text-sm text-center py-8">No products yet.</p>
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-slate-500 text-xs border-b border-slate-800">
            <th className="text-left py-3 pr-4 font-medium">Product</th>
            <th className="text-right py-3 px-4 font-medium">Active</th>
            <th className="text-right py-3 px-4 font-medium">Total Pos.</th>
            <th className="text-right py-3 px-4 font-medium">Coverage</th>
            <th className="text-right py-3 px-4 font-medium">Premium</th>
            <th className="text-right py-3 px-4 font-medium">Payouts</th>
            <th className="text-right py-3 px-4 font-medium">Claim rate</th>
            <th className="text-left py-3 pl-4 font-medium">Utilization</th>
          </tr>
        </thead>
        <tbody>
          {stats.map((p) => (
            <tr key={p.id} className="border-b border-slate-800/60 last:border-0 hover:bg-slate-800/30 transition-colors">
              <td className="py-3 pr-4">
                <p className="text-white font-medium">{p.name}</p>
                <p className="text-slate-500 text-xs">{p.triggerType} · #{p.id}</p>
              </td>
              <td className="text-right px-4 text-slate-300">{p.activePositions}</td>
              <td className="text-right px-4 text-slate-300">{p.totalPositions}</td>
              <td className="text-right px-4 text-slate-300">{formatUsd(p.totalCoverageUsd)}</td>
              <td className="text-right px-4 text-slate-300">{formatUsd(p.totalPremiumUsd)}</td>
              <td className="text-right px-4 text-emerald-400">{formatUsd(p.totalPayoutsUsd)}</td>
              <td className="text-right px-4">
                <span className={cn(
                  'font-medium',
                  p.claimRate > 0.1 ? 'text-red-400' : p.claimRate > 0 ? 'text-amber-400' : 'text-slate-400'
                )}>
                  {(p.claimRate * 100).toFixed(1)}%
                </span>
              </td>
              <td className="py-3 pl-4">
                <UtilBar pct={p.utilizationPct} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Participants table ───────────────────────────────────────────────────────

function ParticipantsTable() {
  const { data: participants = [], isLoading } = useParticipants()
  const sorted = [...participants].sort((a, b) => b.totalCoverageUsd - a.totalCoverageUsd).slice(0, 20)

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
      <h2 className="text-white font-semibold mb-5">Top Participants</h2>
      {isLoading ? (
        <p className="text-slate-500 text-sm text-center py-8">Loading…</p>
      ) : sorted.length === 0 ? (
        <p className="text-slate-500 text-sm text-center py-8">No participants yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-500 text-xs border-b border-slate-800">
                <th className="text-left py-3 pr-4 font-medium">Address</th>
                <th className="text-right py-3 px-4 font-medium">Coverage</th>
                <th className="text-right py-3 px-4 font-medium">Premium</th>
                <th className="text-right py-3 px-4 font-medium">Positions</th>
                <th className="text-right py-3 pl-4 font-medium">Payouts</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((p) => (
                <tr key={p.address} className="border-b border-slate-800/60 last:border-0 hover:bg-slate-800/30 transition-colors">
                  <td className="py-3 pr-4">
                    <a
                      href={`${EXPLORER_BASE}/address/${p.address}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-brand-400 hover:text-brand-300 text-xs flex items-center gap-1 transition-colors"
                    >
                      {formatAddress(p.address)}
                      <ExternalLink className="w-3 h-3 shrink-0" />
                    </a>
                    <p className="text-slate-500 text-xs mt-0.5">
                      First seen {formatDate(p.firstSeenAt)}
                    </p>
                  </td>
                  <td className="text-right px-4 text-white font-medium">{formatUsd(p.totalCoverageUsd)}</td>
                  <td className="text-right px-4 text-slate-300">{formatUsd(p.totalPremiumUsd)}</td>
                  <td className="text-right px-4">
                    <span className="text-slate-300">{p.activePositions}</span>
                    <span className="text-slate-600"> / {p.totalPositions}</span>
                  </td>
                  <td className="text-right pl-4">
                    {p.totalPayoutUsd > 0
                      ? <span className="text-emerald-400 font-medium">{formatUsd(p.totalPayoutUsd)}</span>
                      : <span className="text-slate-600">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── Claims table ─────────────────────────────────────────────────────────────

function ClaimsTable() {
  const { data: claims = [], isLoading } = useClaims()
  const sorted = [...claims].sort((a, b) => b.claimedAt.localeCompare(a.claimedAt))

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
      <h2 className="text-white font-semibold mb-5">Claims History</h2>
      {isLoading ? (
        <p className="text-slate-500 text-sm text-center py-8">Loading…</p>
      ) : sorted.length === 0 ? (
        <p className="text-slate-500 text-sm text-center py-8">No claims processed yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-500 text-xs border-b border-slate-800">
                <th className="text-left py-3 pr-4 font-medium">Position</th>
                <th className="text-left py-3 px-4 font-medium">Holder</th>
                <th className="text-right py-3 px-4 font-medium">Coverage</th>
                <th className="text-right py-3 px-4 font-medium">Payout</th>
                <th className="text-right py-3 px-4 font-medium">Price</th>
                <th className="text-left py-3 pl-4 font-medium">Date / Tx</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((c) => (
                <tr key={c.positionId} className="border-b border-slate-800/60 last:border-0 hover:bg-slate-800/30 transition-colors">
                  <td className="py-3 pr-4 font-mono text-slate-400 text-xs">#{c.positionId}</td>
                  <td className="px-4">
                    <a
                      href={`${EXPLORER_BASE}/address/${c.holder}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-brand-400 hover:text-brand-300 text-xs transition-colors"
                    >
                      {formatAddress(c.holder)}
                    </a>
                  </td>
                  <td className="text-right px-4 text-slate-300">{formatUsd(c.coverageUsd)}</td>
                  <td className="text-right px-4 text-emerald-400 font-semibold">{formatUsd(c.payoutUsd)}</td>
                  <td className="text-right px-4 text-slate-400 font-mono text-xs">
                    {c.confirmedPrice != null ? `$${c.confirmedPrice.toFixed(4)}` : '—'}
                  </td>
                  <td className="pl-4">
                    <p className="text-slate-400 text-xs">{formatDate(c.claimedAt)}</p>
                    {c.txHash && (
                      <a
                        href={`${EXPLORER_BASE}/tx/${c.txHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono text-xs text-brand-400 hover:text-brand-300 flex items-center gap-1 transition-colors mt-0.5"
                      >
                        <span className="truncate max-w-[120px]">{c.txHash}</span>
                        <ExternalLink className="w-3 h-3 shrink-0" />
                      </a>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const { data: analytics, isLoading } = useAnalytics()

  return (
    <div className="max-w-7xl mx-auto px-6 py-12 min-h-screen">
      <div className="mb-10">
        <h1 className="text-4xl font-black text-white mb-3">Protocol Analytics</h1>
        <p className="text-slate-400 text-lg">Live indexed data from on-chain events.</p>
      </div>

      {/* Summary stats */}
      {isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-slate-900 border border-slate-800 rounded-xl p-6 animate-pulse h-28" />
          ))}
        </div>
      ) : analytics ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
          <StatCard
            label="Active Coverage"
            value={formatUsd(analytics.totalActiveCoverageUsd)}
            sub={`${analytics.activePositions} open positions`}
          />
          <StatCard
            label="Total Payouts"
            value={formatUsd(analytics.totalPayoutsUsd)}
            sub={`${analytics.claimCount} claims processed`}
          />
          <StatCard
            label="Participants"
            value={analytics.totalParticipants.toString()}
            sub={`${analytics.totalPositions} total positions`}
          />
          <StatCard
            label="Claim Rate"
            value={`${(analytics.claimRate * 100).toFixed(1)}%`}
            sub="Protocol-wide"
          />
        </div>
      ) : null}

      {/* Product performance */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 mb-8">
        <h2 className="text-white font-semibold mb-5">Cover Product Performance</h2>
        {isLoading ? (
          <p className="text-slate-500 text-sm text-center py-8">Loading…</p>
        ) : (
          <ProductTable stats={analytics?.productStats ?? []} />
        )}
      </div>

      {/* Participants + Claims */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 mb-8">
        <ParticipantsTable />
        <ClaimsTable />
      </div>
    </div>
  )
}
