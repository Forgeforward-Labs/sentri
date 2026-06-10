import { useParams, Link } from 'react-router-dom'
import type { AgentLogEntry } from '@sentri/shared-types'
import { usePosition, useProducts, usePositionLogs } from '../lib/useTrackerData'
import { CheckCircle, XCircle, Minus, Clock, Globe, Brain, Search } from 'lucide-react'
import StatusBadge from '../components/StatusBadge'
import AgentLogTimeline from '../components/AgentLogTimeline'
import { formatUsd, formatDate, timeUntil, cn } from '../lib/utils'

const EXPLORER_BASE = 'https://somnia-testnet.socialscan.io'

interface AgentStep {
  label: string
  sublabel: string
  agentKey: AgentLogEntry['agent']
  icon: React.ElementType
}

const agentSteps: AgentStep[] = [
  {
    label: 'JSON API',
    sublabel: 'CoinGecko price confirmation',
    agentKey: 'AGENT_1',
    icon: Globe,
  },
  {
    label: 'LLM Inference',
    sublabel: 'Plausibility check',
    agentKey: 'AGENT_2',
    icon: Brain,
  },
  {
    label: 'Web Parse',
    sublabel: 'News & social confirmation',
    agentKey: 'AGENT_3',
    icon: Search,
  },
]

export default function PositionDetailPage() {
  const { id } = useParams<{ id: string }>()
  const positionId = parseInt(id ?? '', 10)

  const { data: position, isLoading } = usePosition(positionId)
  const { data: products } = useProducts()
  const { data: logs = [] } = usePositionLogs(positionId)
  const product = position ? (products ?? []).find((p) => p.id === position.productId) : null

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-24 text-center min-h-screen">
        <p className="text-slate-500 text-sm">Loading position…</p>
      </div>
    )
  }

  if (!position) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-24 text-center min-h-screen">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 max-w-md mx-auto">
          <p className="text-slate-400 text-4xl mb-4">404</p>
          <h2 className="text-white font-bold text-xl mb-2">Position not found</h2>
          <p className="text-slate-500 mb-6">Position #{positionId} does not exist.</p>
          <Link
            to="/dashboard"
            className="inline-block bg-brand-500 hover:bg-brand-400 text-black font-semibold px-6 py-2.5 rounded-xl transition-colors text-sm"
          >
            ← Back to Dashboard
          </Link>
        </div>
      </div>
    )
  }

  const isRug = product?.triggerType === 'RUG'

  // Derive per-agent outcome from log entries.
  // "Step N advanced" is logged on the NEXT agent's key, so AGENT_1 passing appears as AGENT_2's log.
  const agentPassed: Record<string, boolean> = {
    AGENT_1: logs.some((l) => l.agent === 'AGENT_2' && l.action.includes('Step 2')),
    AGENT_2: logs.some((l) => l.agent === 'AGENT_3' && l.action.includes('Step 3')) ||
             logs.some((l) => l.agent === 'AGENT_2' && l.action.includes('Trigger verified')),
    AGENT_3: logs.some((l) => l.agent === 'AGENT_3' && l.action.includes('Trigger verified')),
  }
  // For rugs AGENT_2 payout is verified directly — no step 3 log exists
  if (isRug) {
    agentPassed.AGENT_2 = logs.some((l) => l.agent === 'AGENT_2' && l.action.includes('Trigger verified')) ||
                          logs.some((l) => l.agent === 'AGENT_3' && l.action.includes('Trigger verified')) ||
                          agentPassed.AGENT_2
  }

  const agentDenied: Record<string, boolean> = {
    AGENT_1: logs.some((l) => l.agent === 'AGENT_1' && l.action.toLowerCase().includes('denied')),
    AGENT_2: logs.some((l) => l.agent === 'AGENT_2' && l.action.toLowerCase().includes('denied')),
    AGENT_3: logs.some((l) => l.agent === 'AGENT_3' && l.action.toLowerCase().includes('denied')),
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-12 min-h-screen">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-slate-500 mb-6">
        <Link to="/dashboard" className="hover:text-slate-300 transition-colors">Dashboard</Link>
        <span>/</span>
        <span className="text-slate-300">Position #{position.id}</span>
      </div>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-10">
        <div>
          <h1 className="text-4xl font-black text-white mb-2">
            Position #{position.id}
          </h1>
          <p className="text-slate-400 text-lg">{product?.name ?? `Product #${position.productId}`}</p>
        </div>
        <StatusBadge status={position.status} className="text-sm px-4 py-1.5" />
      </div>

      {/* Agent chain progress */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 mb-8">
        <h2 className="text-white font-semibold mb-6">Agent Validation Chain</h2>
        <div className="flex items-center gap-0">
          {agentSteps.map((step, index) => {
            const passed  = agentPassed[step.agentKey]
            const denied  = agentDenied[step.agentKey]
            const skipped = isRug && step.agentKey === 'AGENT_3'
            const Icon = step.icon

            const circleClass = cn(
              'w-12 h-12 rounded-full flex items-center justify-center border-2 transition-all',
              passed  ? 'bg-brand-500/20 border-brand-400 text-brand-400' :
              denied  ? 'bg-red-500/20 border-red-400 text-red-400' :
              skipped ? 'bg-slate-800/40 border-slate-800 text-slate-700' :
                        'bg-slate-800 border-slate-700 text-slate-600'
            )
            const labelClass = cn(
              'text-xs font-semibold mt-2',
              passed  ? 'text-brand-400' :
              denied  ? 'text-red-400' :
              skipped ? 'text-slate-700' :
                        'text-slate-600'
            )

            // Connector after this step: green if both sides passed, red if this side denied, else grey
            const nextStep = agentSteps[index + 1]
            const connectorClass = cn(
              'flex-1 h-0.5 max-w-[60px] mx-2 -mt-8',
              denied                                       ? 'bg-red-500/50' :
              passed && nextStep && agentPassed[nextStep.agentKey] ? 'bg-brand-400' :
                                                            'bg-slate-800'
            )

            return (
              <div key={step.agentKey} className="flex items-center flex-1">
                <div className="flex flex-col items-center flex-1">
                  <div className={circleClass}>
                    {passed  ? <CheckCircle className="w-5 h-5" /> :
                     denied  ? <XCircle className="w-5 h-5" /> :
                     skipped ? <Minus className="w-5 h-5" /> :
                               <Icon className="w-5 h-5" />}
                  </div>
                  <p className={labelClass}>{step.label}</p>
                  <p className={cn(
                    'text-xs text-center max-w-[100px]',
                    denied ? 'text-red-500/70' : skipped ? 'text-slate-700' : 'text-slate-600'
                  )}>
                    {denied ? 'Denied' : skipped ? 'N/A (rug)' : step.sublabel}
                  </p>
                </div>
                {index < agentSteps.length - 1 && (
                  <div className={connectorClass} />
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Left: Activity log (2/3) */}
        <div className="md:col-span-2">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
            <h2 className="text-white font-semibold mb-5">Agent Activity Log</h2>
            <AgentLogTimeline logs={logs} />
            {logs.length === 0 && (
              <div className="flex items-center gap-2 text-slate-500 text-sm py-4">
                <Clock className="w-4 h-4" />
                <span>Waiting for agent activity…</span>
              </div>
            )}
          </div>
        </div>

        {/* Right: Details (1/3) */}
        <div className="flex flex-col gap-6">
          {/* Position details card */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
            <h2 className="text-white font-semibold mb-4">Position Details</h2>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between items-start gap-2">
                <span className="text-slate-500">Coverage</span>
                <span className="text-white font-bold text-lg text-right">
                  {formatUsd(position.coverageAmountUsd)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Premium paid</span>
                <span className="text-slate-300">${position.premiumUsd.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Created</span>
                <span className="text-slate-300 text-right text-xs">{formatDate(position.createdAt)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Expires</span>
                <span className="text-slate-300 text-right text-xs">
                  {position.expiresAt
                    ? `${formatDate(position.expiresAt)} (${timeUntil(position.expiresAt)})`
                    : 'Rug cover — open-ended'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Status</span>
                <StatusBadge status={position.status} />
              </div>
              {position.claimedPrice != null && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Trigger price</span>
                  <span className="text-slate-300">${position.claimedPrice.toFixed(4)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Payout receipt card (if claimed) */}
          {position.status === 'CLAIMED' && position.claimedPayoutUsd != null && (
            <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-6">
              <div className="flex items-center gap-2 mb-4">
                <CheckCircle className="w-5 h-5 text-emerald-400" />
                <h2 className="text-emerald-400 font-semibold">Payout Received</h2>
              </div>
              <p className="text-emerald-400 font-bold text-3xl mb-1">
                {formatUsd(position.claimedPayoutUsd)}
              </p>
              <p className="text-slate-500 text-xs">
                Executed automatically on-chain after {isRug ? '2-agent' : '3-agent'} consensus.
              </p>
              {position.claimedPrice != null && (
                <div className="mt-4 pt-4 border-t border-emerald-500/20 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Confirmed price</span>
                    <span className="text-slate-300">${position.claimedPrice.toFixed(4)}</span>
                  </div>
                </div>
              )}
              {logs.find((l) => l.txHash) && (
                <a
                  href={`${EXPLORER_BASE}/tx/${logs.find((l) => l.txHash)?.txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 mt-3 text-xs text-brand-400 hover:text-brand-300 transition-colors"
                >
                  View on explorer ↗
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
