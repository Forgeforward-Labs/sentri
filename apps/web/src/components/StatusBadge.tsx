import { cn } from '../lib/utils'
import type { PositionStatus, Product } from '@sentri/shared-types'

type StatusValue = PositionStatus | Product['healthStatus']

interface StatusBadgeProps {
  status: StatusValue
  className?: string
}

const statusConfig: Record<
  StatusValue,
  { style: string; dot: string; label: string; pulse?: boolean }
> = {
  ACTIVE:    { style: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25', dot: 'bg-emerald-400', label: 'Active',    pulse: true  },
  CLAIMED:   { style: 'bg-brand-500/10 text-brand-400 border-brand-500/25',       dot: 'bg-brand-400',   label: 'Claimed'                },
  EXPIRED:   { style: 'bg-slate-800 text-slate-400 border-slate-700/60',          dot: 'bg-slate-500',   label: 'Expired'                },
  CANCELLED: { style: 'bg-red-500/10 text-red-400 border-red-500/25',             dot: 'bg-red-400',     label: 'Cancelled'              },
  HEALTHY:   { style: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25', dot: 'bg-emerald-400', label: 'Healthy',  pulse: true  },
  WATCH:     { style: 'bg-amber-500/10 text-amber-400 border-amber-500/25',       dot: 'bg-amber-400',   label: 'Watch'                  },
  PAUSED:    { style: 'bg-red-500/10 text-red-400 border-red-500/25',             dot: 'bg-red-400',     label: 'Paused'                 },
}

export default function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status] ?? statusConfig.EXPIRED
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border whitespace-nowrap',
        config.style,
        className,
      )}
    >
      <span className="relative flex h-1.5 w-1.5 shrink-0">
        {config.pulse && (
          <span
            className={cn(
              'animate-ping absolute inline-flex h-full w-full rounded-full opacity-60',
              config.dot,
            )}
          />
        )}
        <span className={cn('relative inline-flex rounded-full h-1.5 w-1.5', config.dot)} />
      </span>
      {config.label}
    </span>
  )
}
