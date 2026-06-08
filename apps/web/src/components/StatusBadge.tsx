import { cn } from '../lib/utils'
import type { PositionStatus, Product } from '@sentri/shared-types'

type StatusValue = PositionStatus | Product['healthStatus']

interface StatusBadgeProps {
  status: StatusValue
  className?: string
}

const statusStyles: Record<StatusValue, string> = {
  ACTIVE: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  CLAIMED: 'bg-brand-500/10 text-brand-400 border-brand-500/20',
  EXPIRED: 'bg-slate-800 text-slate-400 border-slate-700',
  CANCELLED: 'bg-red-500/10 text-red-400 border-red-500/20',
  HEALTHY: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  WATCH: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  PAUSED: 'bg-red-500/10 text-red-400 border-red-500/20',
}

export default function StatusBadge({ status, className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border',
        statusStyles[status],
        className
      )}
    >
      ● {status}
    </span>
  )
}
