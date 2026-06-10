import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAccount } from 'wagmi'
import type { Position } from '@sentri/shared-types'
import { ShieldOff, History, ArrowRight } from 'lucide-react'
import StatusBadge from '../components/StatusBadge'
import AgentLogTimeline from '../components/AgentLogTimeline'
import { formatUsd, formatDate, timeUntil, cn } from '../lib/utils'
import { usePositions, useProducts, useAgentLogs } from '../lib/useTrackerData'

type TabType = 'active' | 'history' | 'activity'

function PositionCard({
  position,
  products,
}: {
  position: Position
  products: ReturnType<typeof useProducts>['data']
}) {
  const product = (products ?? []).find((p) => p.id === position.productId)
  const isClaimed = position.status === 'CLAIMED'

  return (
    <div className={cn(
      'border rounded-xl p-6 flex flex-col gap-4 card-hover transition-all',
      isClaimed
        ? 'bg-emerald-500/5 border-emerald-500/15'
        : 'bg-slate-900 border-slate-800',
    )}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-slate-500 text-xs mb-0.5 font-mono">#{position.id}</p>
          <p className="text-white font-semibold truncate">
            {product?.name ?? `Product #${position.productId}`}
          </p>
        </div>
        <StatusBadge status={position.status} />
      </div>

      {/* Coverage amount */}
      <div>
        <p className="text-slate-500 text-xs mb-1">Coverage</p>
        <p className={cn(
          'font-black text-2xl tabular-nums',
          isClaimed ? 'text-emerald-400' : 'text-white'
        )}>
          {formatUsd(position.coverageAmountUsd)}
        </p>
      </div>

      {/* Details */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <span className="text-slate-500">Premium paid</span>
        <span className="text-slate-300 text-right tabular-nums">
          ${position.premiumUsd.toFixed(2)}
        </span>

        <span className="text-slate-500">Created</span>
        <span className="text-slate-300 text-right text-xs">{formatDate(position.createdAt)}</span>

        {position.status === 'ACTIVE' && position.expiresAt && (
          <>
            <span className="text-slate-500">Expires in</span>
            <span className="text-amber-400 font-medium text-right">{timeUntil(position.expiresAt)}</span>
          </>
        )}

        {position.status === 'ACTIVE' && !position.expiresAt && (
          <>
            <span className="text-slate-500">Type</span>
            <span className="text-slate-300 text-right">Open-ended</span>
          </>
        )}

        {isClaimed && position.claimedPayoutUsd != null && (
          <>
            <span className="text-slate-500">Payout received</span>
            <span className="text-emerald-400 font-semibold text-right tabular-nums">
              {formatUsd(position.claimedPayoutUsd)}
            </span>
          </>
        )}
      </div>

      {/* Footer */}
      <div className="pt-2 border-t border-slate-800/60 mt-auto">
        <Link
          to={`/position/${position.id}`}
          className="group inline-flex items-center gap-1 text-sm text-brand-400 hover:text-brand-300 transition-colors font-medium"
        >
          View Details
          <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>
    </div>
  )
}

const TAB_LABELS: Record<TabType, string> = {
  active: 'Active',
  history: 'History',
  activity: 'Agent Activity',
}

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState<TabType>('active')
  const { address } = useAccount()
  const { data: allPositions = [], isLoading } = usePositions()
  const myPositions = address
    ? allPositions.filter((p) => p.holder.toLowerCase() === address.toLowerCase())
    : []
  const { data: products } = useProducts()
  const { data: agentLogs = [], isLoading: logsLoading } = useAgentLogs(100)

  const filtered = myPositions.filter((p) =>
    activeTab === 'active'
      ? p.status === 'ACTIVE'
      : ['CLAIMED', 'EXPIRED', 'CANCELLED'].includes(p.status),
  )

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12 min-h-screen">
      {/* Header */}
      <div className="mb-8 sm:mb-10">
        <p className="text-slate-500 text-sm font-medium uppercase tracking-wider mb-2">
          Portfolio
        </p>
        <h1 className="text-3xl sm:text-4xl font-black text-white mb-3">My Positions</h1>
        <p className="text-slate-400 text-base sm:text-lg max-w-xl">Track and manage your coverage positions.</p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 p-1 bg-slate-900 border border-slate-800 rounded-xl mb-6 sm:mb-8">
        {(Object.keys(TAB_LABELS) as TabType[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              'flex-1 px-3 sm:px-5 py-2.5 rounded-lg text-sm font-medium transition-all',
              activeTab === tab
                ? 'bg-brand-500 text-black shadow-lg'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60',
            )}
          >
            {TAB_LABELS[tab]}
            {tab === 'activity' && agentLogs.length > 0 && (
              <span className="ml-2 bg-brand-500/15 text-brand-400 text-xs px-1.5 py-0.5 rounded-full">
                {agentLogs.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Activity tab */}
      {activeTab === 'activity' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 max-w-3xl">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-white font-semibold">Agent Activity</h2>
            <span className="text-slate-600 text-xs">Refreshes every 10s</span>
          </div>
          {logsLoading ? (
            <p className="text-slate-500 text-sm text-center py-8">Loading activity…</p>
          ) : (
            <AgentLogTimeline logs={agentLogs} />
          )}
        </div>
      )}

      {/* Position grid */}
      {activeTab !== 'activity' && (
        isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-slate-900 border border-slate-800 rounded-xl h-64 animate-pulse" />
            ))}
          </div>
        ) : filtered.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((position) => (
              <PositionCard key={position.id} position={position} products={products} />
            ))}
          </div>
        ) : (
          <div className="text-center py-24 border border-slate-800/50 rounded-xl bg-slate-900/30">
            {activeTab === 'active' ? (
              <>
                <ShieldOff className="w-10 h-10 text-slate-700 mx-auto mb-4" />
                <p className="text-slate-400 font-medium mb-1">No active positions</p>
                <p className="text-slate-600 text-sm mb-6">
                  You don't have any open coverage right now.
                </p>
                <Link
                  to="/cover"
                  className="inline-flex items-center gap-2 bg-brand-500 hover:bg-brand-400 text-black font-semibold px-5 py-2.5 rounded-xl transition-all text-sm"
                >
                  <ShieldOff className="w-4 h-4" />
                  Get Coverage
                </Link>
              </>
            ) : (
              <>
                <History className="w-10 h-10 text-slate-700 mx-auto mb-4" />
                <p className="text-slate-400 font-medium mb-1">No position history</p>
                <p className="text-slate-600 text-sm">
                  Your completed positions will appear here.
                </p>
              </>
            )}
          </div>
        )
      )}
    </div>
  )
}
