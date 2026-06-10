import { useParams, Link } from 'react-router-dom'
import type { AgentLogEntry } from '@sentri/shared-types'
import { usePosition, useProducts, usePositionLogs } from '../lib/useTrackerData'
import { CheckCircle2, XCircle, Minus, Clock, Globe, Brain, Search, ExternalLink, ChevronRight } from 'lucide-react'
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
  { label: 'Agent 1', sublabel: 'JSON API',  agentKey: 'AGENT_1', icon: Globe  },
  { label: 'Agent 2', sublabel: 'LLM',       agentKey: 'AGENT_2', icon: Brain  },
  { label: 'Agent 3', sublabel: 'Web Parse', agentKey: 'AGENT_3', icon: Search },
]

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between items-start gap-4 py-2.5 border-b border-slate-800/60 last:border-0">
      <span className="text-slate-500 text-sm shrink-0">{label}</span>
      <span className="text-slate-200 text-sm text-right min-w-0">{children}</span>
    </div>
  )
}

export default function PositionDetailPage() {
  const { id } = useParams<{ id: string }>()
  const positionId = parseInt(id ?? '', 10)

  const { data: position, isLoading } = usePosition(positionId)
  const { data: products } = useProducts()
  const { data: logs = [] } = usePositionLogs(positionId)
  const product = position ? (products ?? []).find((p) => p.id === position.productId) : null

  if (isLoading) {
    return (
      <div className="page-container flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-brand-500/30 border-t-brand-500 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-500 text-sm">Loading position…</p>
        </div>
      </div>
    )
  }

  if (!position) {
    return (
      <div className="page-container flex items-center justify-center">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-10 max-w-sm w-full text-center mx-4">
          <p className="text-slate-600 text-5xl font-black mb-4">404</p>
          <h2 className="text-white font-bold text-xl mb-2">Position not found</h2>
          <p className="text-slate-500 mb-6">Position #{positionId} does not exist.</p>
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-2 bg-brand-500 hover:bg-brand-400 text-black font-semibold px-6 py-2.5 rounded-xl transition-all text-sm"
          >
            ← Back to Dashboard
          </Link>
        </div>
      </div>
    )
  }

  const isRug = product?.triggerType === 'RUG'

  const agentPassed: Record<string, boolean> = {
    AGENT_1: logs.some((l) => l.agent === 'AGENT_2' && l.action.includes('Step 2')),
    AGENT_2: logs.some((l) => l.agent === 'AGENT_3' && l.action.includes('Step 3')) ||
             logs.some((l) => l.agent === 'AGENT_2' && l.action.includes('Trigger verified')),
    AGENT_3: logs.some((l) => l.agent === 'AGENT_3' && l.action.includes('Trigger verified')),
  }
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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12 min-h-screen">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-xs text-slate-600 mb-6 sm:mb-8">
        <Link to="/dashboard" className="hover:text-slate-400 transition-colors">Dashboard</Link>
        <ChevronRight className="w-3.5 h-3.5" />
        <span className="text-slate-400">Position #{position.id}</span>
      </div>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 mb-8 sm:mb-10">
        <div>
          <p className="text-slate-500 text-sm mb-1">
            {product?.name ?? `Product #${position.productId}`}
            {product && (
              <span className={cn(
                'ml-2 text-xs font-medium',
                product.triggerType === 'DEPEG' ? 'text-brand-400' : 'text-amber-400',
              )}>
                · {product.triggerType === 'DEPEG' ? 'Depeg Insurance' : 'Rug Pull Protection'}
              </span>
            )}
          </p>
          <h1 className="text-3xl sm:text-4xl font-black text-white">Position #{position.id}</h1>
        </div>
        <StatusBadge status={position.status} className="text-sm px-4 py-1.5" />
      </div>

      {/* Agent chain ── horizontal on md+, vertical on mobile */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-6 mb-8">
        <div className="flex items-center justify-between mb-5 sm:mb-6">
          <h2 className="text-white font-semibold">Agent Validation Chain</h2>
          {isRug && (
            <span className="text-xs text-amber-400/80 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-full">
              2-step (rug)
            </span>
          )}
        </div>

        {/* Desktop: horizontal */}
        <div className="hidden sm:flex items-start">
          {agentSteps.map((step, index) => {
            const passed  = agentPassed[step.agentKey]
            const denied  = agentDenied[step.agentKey]
            const skipped = isRug && step.agentKey === 'AGENT_3'
            const Icon = step.icon

            const circleClass = cn(
              'w-14 h-14 rounded-full flex items-center justify-center border-2 transition-all',
              passed  ? 'bg-brand-500/15 border-brand-400 text-brand-400 shadow-lg shadow-brand-500/10' :
              denied  ? 'bg-red-500/15 border-red-400 text-red-400' :
              skipped ? 'bg-slate-800/30 border-slate-800/60 text-slate-700' :
                        'bg-slate-800/60 border-slate-700/60 text-slate-500',
            )
            const nextStep = agentSteps[index + 1]
            const connectorClass = cn(
              'flex-1 h-0.5 mx-3 mt-7',
              denied ? 'bg-red-500/40' :
              passed && nextStep && agentPassed[nextStep.agentKey] ? 'bg-brand-400/60' : 'bg-slate-800',
            )

            return (
              <div key={step.agentKey} className="flex items-start flex-1">
                <div className="flex flex-col items-center flex-1">
                  <div className={circleClass}>
                    {passed ? <CheckCircle2 className="w-6 h-6" /> :
                     denied ? <XCircle className="w-6 h-6" /> :
                     skipped ? <Minus className="w-5 h-5" /> :
                               <Icon className="w-5 h-5" />}
                  </div>
                  <p className={cn(
                    'text-xs font-semibold mt-2',
                    passed ? 'text-brand-400' : denied ? 'text-red-400' : skipped ? 'text-slate-700' : 'text-slate-500',
                  )}>
                    {step.label}
                  </p>
                  <p className={cn(
                    'text-[10px] text-center max-w-[90px] mt-0.5 leading-relaxed',
                    denied ? 'text-red-500/60' : skipped ? 'text-slate-700' : passed ? 'text-slate-500' : 'text-slate-600',
                  )}>
                    {denied ? 'Denied' : skipped ? 'N/A (rug)' : step.sublabel}
                  </p>
                </div>
                {index < agentSteps.length - 1 && <div className={connectorClass} />}
              </div>
            )
          })}
        </div>

        {/* Mobile: vertical steps */}
        <div className="flex sm:hidden flex-col gap-0">
          {agentSteps.map((step, index) => {
            const passed  = agentPassed[step.agentKey]
            const denied  = agentDenied[step.agentKey]
            const skipped = isRug && step.agentKey === 'AGENT_3'
            const Icon = step.icon
            const isLast = index === agentSteps.length - 1

            const circleClass = cn(
              'w-10 h-10 rounded-full flex items-center justify-center border-2 shrink-0 transition-all',
              passed  ? 'bg-brand-500/15 border-brand-400 text-brand-400' :
              denied  ? 'bg-red-500/15 border-red-400 text-red-400' :
              skipped ? 'bg-slate-800/30 border-slate-800/60 text-slate-700' :
                        'bg-slate-800/60 border-slate-700/60 text-slate-500',
            )

            return (
              <div key={step.agentKey} className="flex gap-3">
                {/* Spine */}
                <div className="flex flex-col items-center">
                  <div className={circleClass}>
                    {passed ? <CheckCircle2 className="w-4 h-4" /> :
                     denied ? <XCircle className="w-4 h-4" /> :
                     skipped ? <Minus className="w-4 h-4" /> :
                               <Icon className="w-4 h-4" />}
                  </div>
                  {!isLast && (
                    <div className={cn(
                      'w-0.5 flex-1 min-h-[20px] my-1',
                      denied ? 'bg-red-500/30' :
                      passed ? 'bg-brand-400/40' : 'bg-slate-800',
                    )} />
                  )}
                </div>

                {/* Content */}
                <div className={cn('flex-1', !isLast && 'pb-4')}>
                  <div className="flex items-center gap-2 mt-2.5">
                    <p className={cn(
                      'text-sm font-semibold',
                      passed ? 'text-brand-400' : denied ? 'text-red-400' : skipped ? 'text-slate-600' : 'text-slate-400',
                    )}>
                      {step.label}
                    </p>
                    <p className="text-xs text-slate-600">
                      {denied ? '· Denied' : skipped ? '· N/A (rug)' : `· ${step.sublabel}`}
                    </p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Two-column layout — stacks on mobile */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
        {/* Left: Activity log */}
        <div className="md:col-span-2">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-6">
            <h2 className="text-white font-semibold mb-5">Agent Activity Log</h2>
            <AgentLogTimeline logs={logs} />
            {logs.length === 0 && (
              <div className="flex items-center gap-2 text-slate-600 text-sm py-4 mt-2">
                <Clock className="w-4 h-4" />
                <span>Waiting for agent activity…</span>
              </div>
            )}
          </div>
        </div>

        {/* Right: Details */}
        <div className="flex flex-col gap-5 sm:gap-6">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-6">
            <h2 className="text-white font-semibold mb-4">Position Details</h2>
            <div>
              <DetailRow label="Coverage">
                <span className="text-white font-bold text-base sm:text-lg">
                  {formatUsd(position.coverageAmountUsd)}
                </span>
              </DetailRow>
              <DetailRow label="Premium paid">
                ${position.premiumUsd.toFixed(2)} USDso
              </DetailRow>
              <DetailRow label="Created">
                <span className="text-xs">{formatDate(position.createdAt)}</span>
              </DetailRow>
              <DetailRow label="Expires">
                {position.expiresAt ? (
                  <span className="text-xs">
                    {formatDate(position.expiresAt)}
                    <span className="text-slate-500 ml-1">({timeUntil(position.expiresAt)})</span>
                  </span>
                ) : (
                  <span className="text-slate-400 text-xs">Open-ended (rug cover)</span>
                )}
              </DetailRow>
              <DetailRow label="Status">
                <StatusBadge status={position.status} />
              </DetailRow>
              {position.claimedPrice != null && (
                <DetailRow label="Trigger price">
                  ${position.claimedPrice.toFixed(4)}
                </DetailRow>
              )}
            </div>
          </div>

          {/* Payout receipt */}
          {position.status === 'CLAIMED' && position.claimedPayoutUsd != null && (
            <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-4 sm:p-6">
              <div className="flex items-center gap-2 mb-4">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                <h2 className="text-emerald-400 font-semibold">Payout Received</h2>
              </div>
              <p className="text-emerald-400 font-black text-3xl mb-1 tabular-nums">
                {formatUsd(position.claimedPayoutUsd)}
              </p>
              <p className="text-slate-500 text-xs leading-relaxed">
                Executed automatically after {isRug ? '2-agent' : '3-agent'} on-chain consensus.
              </p>
              {position.claimedPrice != null && (
                <div className="mt-4 pt-4 border-t border-emerald-500/15 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Confirmed price</span>
                    <span className="text-slate-300 tabular-nums">${position.claimedPrice.toFixed(4)}</span>
                  </div>
                </div>
              )}
              {logs.find((l) => l.txHash) && (
                <a
                  href={`${EXPLORER_BASE}/tx/${logs.find((l) => l.txHash)?.txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 mt-4 text-xs text-brand-400 hover:text-brand-300 transition-colors font-medium"
                >
                  View on explorer <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
