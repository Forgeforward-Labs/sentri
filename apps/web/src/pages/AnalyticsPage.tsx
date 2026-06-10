import { ExternalLink, Activity, DollarSign, Users, Percent } from 'lucide-react'
import { useAnalytics, useClaims, useParticipants } from '../lib/useTrackerData'
import { formatUsd, formatDate, formatAddress, cn } from '../lib/utils'
import type { ProductStats } from '@sentri/shared-types'

const EXPLORER_BASE = 'https://somnia-testnet.socialscan.io'

// ── Stat card ────────────────────────────────────────────────────

interface StatCardProps {
  label: string; value: string; sub?: string
  icon: React.ElementType; accent: string; iconBg: string
}
function StatCard({ label, value, sub, icon: Icon, accent, iconBg }: StatCardProps) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-6 card-hover">
      <div className="flex items-center gap-2 mb-2 sm:mb-3">
        <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center shrink-0', iconBg)}>
          <Icon className={cn('w-3.5 h-3.5', accent)} />
        </div>
        <p className="text-slate-400 text-xs sm:text-sm truncate">{label}</p>
      </div>
      <p className={cn('font-black text-2xl sm:text-3xl tabular-nums truncate', accent)}>{value}</p>
      {sub && <p className="text-slate-500 text-xs mt-1">{sub}</p>}
    </div>
  )
}

// ── Util bar ─────────────────────────────────────────────────────

function UtilBar({ pct }: { pct: number }) {
  const width = Math.min(Math.round(pct * 100), 100)
  const color = pct > 0.8 ? 'bg-red-500' : pct > 0.5 ? 'bg-amber-400' : 'bg-brand-400'
  return (
    <div className="flex items-center gap-2 min-w-[80px]">
      <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
        <div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${width}%` }} />
      </div>
      <span className={cn(
        'text-xs w-7 text-right font-medium shrink-0',
        pct > 0.8 ? 'text-red-400' : pct > 0.5 ? 'text-amber-400' : 'text-slate-400',
      )}>
        {width}%
      </span>
    </div>
  )
}

// ── Product table — desktop full / mobile cards ───────────────────

function ProductTable({ stats }: { stats: ProductStats[] }) {
  if (stats.length === 0) {
    return <p className="text-slate-500 text-sm text-center py-10">No products deployed yet.</p>
  }
  return (
    <>
      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-slate-500 text-xs border-b border-slate-800">
              <th className="text-left py-3 pr-4 font-medium">Product</th>
              <th className="text-right py-3 px-3 font-medium">Active</th>
              <th className="text-right py-3 px-3 font-medium">Total</th>
              <th className="text-right py-3 px-3 font-medium">Coverage</th>
              <th className="text-right py-3 px-3 font-medium">Premiums</th>
              <th className="text-right py-3 px-3 font-medium">Payouts</th>
              <th className="text-right py-3 px-3 font-medium">Claim %</th>
              <th className="text-left py-3 pl-3 font-medium">Utilization</th>
            </tr>
          </thead>
          <tbody>
            {stats.map((p) => (
              <tr key={p.id} className="border-b border-slate-800/40 last:border-0 hover:bg-slate-800/20 transition-colors">
                <td className="py-3.5 pr-4">
                  <p className="text-white font-medium">{p.name}</p>
                  <p className="text-slate-500 text-xs mt-0.5">
                    <span className={cn('font-medium', p.triggerType === 'DEPEG' ? 'text-brand-400/70' : 'text-amber-400/70')}>
                      {p.triggerType}
                    </span>
                    {' '}· #{p.id}
                  </p>
                </td>
                <td className="text-right px-3 text-slate-300 tabular-nums">{p.activePositions}</td>
                <td className="text-right px-3 text-slate-500 tabular-nums">{p.totalPositions}</td>
                <td className="text-right px-3 text-slate-300 tabular-nums">{formatUsd(p.totalCoverageUsd)}</td>
                <td className="text-right px-3 text-slate-300 tabular-nums">{formatUsd(p.totalPremiumUsd)}</td>
                <td className="text-right px-3 text-emerald-400 font-medium tabular-nums">{formatUsd(p.totalPayoutsUsd)}</td>
                <td className="text-right px-3">
                  <span className={cn('font-medium tabular-nums',
                    p.claimRate > 0.1 ? 'text-red-400' : p.claimRate > 0 ? 'text-amber-400' : 'text-slate-500',
                  )}>
                    {(p.claimRate * 100).toFixed(1)}%
                  </span>
                </td>
                <td className="py-3.5 pl-3"><UtilBar pct={p.utilizationPct} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {stats.map((p) => (
          <div key={p.id} className="bg-slate-800/40 rounded-xl p-4 border border-slate-700/40">
            <div className="flex items-start justify-between gap-2 mb-3">
              <div>
                <p className="text-white font-medium text-sm">{p.name}</p>
                <p className={cn('text-xs font-medium mt-0.5', p.triggerType === 'DEPEG' ? 'text-brand-400' : 'text-amber-400')}>
                  {p.triggerType} · #{p.id}
                </p>
              </div>
              <UtilBar pct={p.utilizationPct} />
            </div>
            <div className="grid grid-cols-3 gap-2 text-xs">
              {[
                { label: 'Active', value: String(p.activePositions) },
                { label: 'Coverage', value: formatUsd(p.totalCoverageUsd) },
                { label: 'Premiums', value: formatUsd(p.totalPremiumUsd) },
                { label: 'Payouts', value: formatUsd(p.totalPayoutsUsd), accent: 'text-emerald-400' },
                { label: 'Claim rate', value: `${(p.claimRate * 100).toFixed(1)}%`, accent: p.claimRate > 0.1 ? 'text-red-400' : p.claimRate > 0 ? 'text-amber-400' : undefined },
                { label: 'Total pos.', value: String(p.totalPositions) },
              ].map(({ label, value, accent }) => (
                <div key={label} className="bg-slate-900/60 rounded-lg p-2">
                  <p className="text-slate-600 text-[10px] mb-0.5">{label}</p>
                  <p className={cn('font-semibold', accent ?? 'text-slate-300')}>{value}</p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  )
}

// ── Participants table ────────────────────────────────────────────

function ParticipantsTable() {
  const { data: participants = [], isLoading } = useParticipants()
  const sorted = [...participants].sort((a, b) => b.totalCoverageUsd - a.totalCoverageUsd).slice(0, 20)

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-6">
      <h2 className="text-white font-semibold mb-5">Top Participants</h2>
      {isLoading ? (
        <div className="space-y-3">{[1,2,3].map((i) => <div key={i} className="h-10 bg-slate-800/60 rounded-lg animate-pulse" />)}</div>
      ) : sorted.length === 0 ? (
        <p className="text-slate-500 text-sm text-center py-10">No participants yet.</p>
      ) : (
        <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0">
          <div className="min-w-[480px]">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-slate-500 text-xs border-b border-slate-800">
                  <th className="text-left py-3 pr-4 font-medium">Address</th>
                  <th className="text-right py-3 px-3 font-medium">Coverage</th>
                  <th className="text-right py-3 px-3 font-medium">Premium</th>
                  <th className="text-right py-3 px-3 font-medium">Pos.</th>
                  <th className="text-right py-3 pl-3 font-medium">Payouts</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((p) => (
                  <tr key={p.address} className="border-b border-slate-800/40 last:border-0 hover:bg-slate-800/20 transition-colors">
                    <td className="py-3 pr-4">
                      <a href={`${EXPLORER_BASE}/address/${p.address}`} target="_blank" rel="noopener noreferrer"
                        className="font-mono text-brand-400 hover:text-brand-300 text-xs flex items-center gap-1 transition-colors group">
                        {formatAddress(p.address)}
                        <ExternalLink className="w-3 h-3 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </a>
                      <p className="text-slate-600 text-xs mt-0.5">Since {formatDate(p.firstSeenAt)}</p>
                    </td>
                    <td className="text-right px-3 text-white font-medium tabular-nums">{formatUsd(p.totalCoverageUsd)}</td>
                    <td className="text-right px-3 text-slate-400 tabular-nums">{formatUsd(p.totalPremiumUsd)}</td>
                    <td className="text-right px-3">
                      <span className="text-slate-300 tabular-nums">{p.activePositions}</span>
                      <span className="text-slate-700"> / {p.totalPositions}</span>
                    </td>
                    <td className="text-right pl-3 tabular-nums">
                      {p.totalPayoutUsd > 0
                        ? <span className="text-emerald-400 font-medium">{formatUsd(p.totalPayoutUsd)}</span>
                        : <span className="text-slate-700">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Claims table ──────────────────────────────────────────────────

function ClaimsTable() {
  const { data: claims = [], isLoading } = useClaims()
  const sorted = [...claims].sort((a, b) => b.claimedAt.localeCompare(a.claimedAt))

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-6">
      <h2 className="text-white font-semibold mb-5">Claims History</h2>
      {isLoading ? (
        <div className="space-y-3">{[1,2,3].map((i) => <div key={i} className="h-10 bg-slate-800/60 rounded-lg animate-pulse" />)}</div>
      ) : sorted.length === 0 ? (
        <p className="text-slate-500 text-sm text-center py-10">No claims processed yet.</p>
      ) : (
        <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0">
          <div className="min-w-[460px]">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-slate-500 text-xs border-b border-slate-800">
                  <th className="text-left py-3 pr-3 font-medium">Pos.</th>
                  <th className="text-left py-3 px-3 font-medium">Holder</th>
                  <th className="text-right py-3 px-3 font-medium">Payout</th>
                  <th className="text-right py-3 px-3 font-medium">Price</th>
                  <th className="text-left py-3 pl-3 font-medium">Date</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((c) => (
                  <tr key={c.positionId} className="border-b border-slate-800/40 last:border-0 hover:bg-slate-800/20 transition-colors">
                    <td className="py-3 pr-3 font-mono text-slate-500 text-xs">#{c.positionId}</td>
                    <td className="px-3">
                      <a href={`${EXPLORER_BASE}/address/${c.holder}`} target="_blank" rel="noopener noreferrer"
                        className="font-mono text-brand-400 hover:text-brand-300 text-xs transition-colors">
                        {formatAddress(c.holder)}
                      </a>
                    </td>
                    <td className="text-right px-3 text-emerald-400 font-semibold tabular-nums">{formatUsd(c.payoutUsd)}</td>
                    <td className="text-right px-3 text-slate-400 font-mono text-xs tabular-nums">
                      {c.confirmedPrice != null ? `$${c.confirmedPrice.toFixed(4)}` : '—'}
                    </td>
                    <td className="pl-3">
                      <p className="text-slate-400 text-xs">{formatDate(c.claimedAt)}</p>
                      {c.txHash && (
                        <a href={`${EXPLORER_BASE}/tx/${c.txHash}`} target="_blank" rel="noopener noreferrer"
                          className="font-mono text-xs text-brand-400 hover:text-brand-300 flex items-center gap-1 transition-colors mt-0.5 group">
                          <span className="truncate max-w-[100px]">{c.txHash}</span>
                          <ExternalLink className="w-3 h-3 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const { data: analytics, isLoading } = useAnalytics()

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12 min-h-screen">
      <div className="mb-8 sm:mb-10">
        <p className="text-slate-500 text-sm font-medium uppercase tracking-wider mb-2">Protocol</p>
        <h1 className="text-3xl sm:text-4xl font-black text-white mb-2">Analytics</h1>
        <p className="text-slate-400">Live indexed data from on-chain events.</p>
      </div>

      {/* Summary stats — 2×2 on mobile, 4-col on lg */}
      {isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-6 animate-pulse h-24 sm:h-32" />
          ))}
        </div>
      ) : analytics ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
          <StatCard icon={Activity} label="Active Coverage"
            value={formatUsd(analytics.totalActiveCoverageUsd)}
            sub={`${analytics.activePositions} open positions`}
            accent="text-brand-400" iconBg="bg-brand-500/10" />
          <StatCard icon={DollarSign} label="Total Payouts"
            value={formatUsd(analytics.totalPayoutsUsd)}
            sub={`${analytics.claimCount} claims`}
            accent="text-emerald-400" iconBg="bg-emerald-500/10" />
          <StatCard icon={Users} label="Participants"
            value={analytics.totalParticipants.toString()}
            sub={`${analytics.totalPositions} positions`}
            accent="text-indigo-400" iconBg="bg-indigo-500/10" />
          <StatCard icon={Percent} label="Claim Rate"
            value={`${(analytics.claimRate * 100).toFixed(1)}%`}
            sub="Protocol-wide"
            accent={analytics.claimRate > 0.1 ? 'text-red-400' : analytics.claimRate > 0 ? 'text-amber-400' : 'text-slate-300'}
            iconBg={analytics.claimRate > 0.1 ? 'bg-red-500/10' : 'bg-slate-800'} />
        </div>
      ) : null}

      {/* Product performance */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-6 mb-6 sm:mb-8">
        <h2 className="text-white font-semibold mb-5">Coverage Product Performance</h2>
        {isLoading ? (
          <div className="space-y-3">{[1,2,3].map((i) => <div key={i} className="h-12 bg-slate-800/60 rounded-lg animate-pulse" />)}</div>
        ) : (
          <ProductTable stats={analytics?.productStats ?? []} />
        )}
      </div>

      {/* Participants + Claims — stack on mobile */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 sm:gap-8">
        <ParticipantsTable />
        <ClaimsTable />
      </div>
    </div>
  )
}
