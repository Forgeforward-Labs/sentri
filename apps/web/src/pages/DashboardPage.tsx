import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAccount } from 'wagmi'
import type { Position } from '@sentri/shared-types'
import StatusBadge from '../components/StatusBadge'
import { formatUsd, formatDate, timeUntil, cn } from '../lib/utils'
import { usePositions, useProducts } from '../lib/useTrackerData'

type TabType = 'active' | 'history'

function PositionCard({ position, products }: { position: Position; products: ReturnType<typeof useProducts>['data'] }) {
  const product = (products ?? []).find((p) => p.id === position.productId)

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 flex flex-col gap-4">
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-slate-500 text-xs mb-1 font-mono">#{position.id}</p>
          <p className="text-white font-semibold">{product?.name ?? `Product #${position.productId}`}</p>
        </div>
        <StatusBadge status={position.status} />
      </div>

      {/* Coverage amount */}
      <div>
        <p className="text-slate-500 text-xs mb-1">Coverage</p>
        <p className="text-white font-bold text-2xl">{formatUsd(position.coverageAmountUsd)}</p>
      </div>

      {/* Details */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <span className="text-slate-500">Premium paid</span>
        <span className="text-slate-300 text-right">${position.premiumUsd.toFixed(2)}</span>

        <span className="text-slate-500">Created</span>
        <span className="text-slate-300 text-right">{formatDate(position.createdAt)}</span>

        {position.status === 'ACTIVE' && position.expiresAt && (
          <>
            <span className="text-slate-500">Expires in</span>
            <span className="text-amber-400 font-medium text-right">{timeUntil(position.expiresAt)}</span>
          </>
        )}

        {position.status === 'ACTIVE' && !position.expiresAt && (
          <>
            <span className="text-slate-500">Coverage type</span>
            <span className="text-slate-300 text-right">Open-ended</span>
          </>
        )}

        {position.status === 'CLAIMED' && position.claimedPayoutUsd != null && (
          <>
            <span className="text-slate-500">Payout received</span>
            <span className="text-emerald-400 font-semibold text-right">
              {formatUsd(position.claimedPayoutUsd)}
            </span>
          </>
        )}
      </div>

      {/* Footer */}
      <div className="pt-2 border-t border-slate-800">
        <Link
          to={`/position/${position.id}`}
          className="text-sm text-brand-400 hover:text-brand-300 transition-colors font-medium"
        >
          View Details →
        </Link>
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState<TabType>('active')
  const { address } = useAccount()
  const { data: allPositions } = usePositions()
  const { data: products } = useProducts()

  // Show positions belonging to connected wallet (or all if not connected)
  const myPositions = (allPositions ?? []).filter((p) =>
    !address || p.holder.toLowerCase() === address.toLowerCase()
  )

  const filtered = myPositions.filter((p) =>
    activeTab === 'active'
      ? p.status === 'ACTIVE'
      : ['CLAIMED', 'EXPIRED', 'CANCELLED'].includes(p.status)
  )

  return (
    <div className="max-w-7xl mx-auto px-6 py-12 min-h-screen">
      {/* Header */}
      <div className="mb-10">
        <h1 className="text-4xl font-black text-white mb-3">My Positions</h1>
        <p className="text-slate-400 text-lg">Track and manage your coverage positions.</p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 p-1 bg-slate-900 border border-slate-800 rounded-xl w-fit mb-8">
        {(['active', 'history'] as TabType[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              'px-5 py-2 rounded-lg text-sm font-medium capitalize transition-all',
              activeTab === tab
                ? 'bg-brand-500 text-black shadow'
                : 'text-slate-400 hover:text-slate-200'
            )}
          >
            {tab === 'active' ? 'Active' : 'History'}
          </button>
        ))}
      </div>

      {/* Position grid */}
      {filtered.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((position) => (
            <PositionCard key={position.id} position={position} products={products} />
          ))}
        </div>
      ) : (
        <div className="text-center py-20 text-slate-500">
          <p className="text-lg mb-2">No positions found.</p>
          <p className="text-sm">
            {activeTab === 'active' ? (
              <>
                Get started by{' '}
                <Link to="/cover" className="text-brand-400 hover:text-brand-300">
                  buying coverage
                </Link>
                .
              </>
            ) : (
              'Your completed positions will appear here.'
            )}
          </p>
        </div>
      )}
    </div>
  )
}
