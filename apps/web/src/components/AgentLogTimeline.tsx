import { motion } from 'framer-motion'
import { ExternalLink } from 'lucide-react'
import type { AgentLogEntry } from '@sentri/shared-types'
import { formatDate, cn } from '../lib/utils'

const agentDotColors: Record<AgentLogEntry['agent'], string> = {
  TRACKER: 'bg-slate-500',
  AGENT_1: 'bg-brand-400',
  AGENT_2: 'bg-indigo-400',
  AGENT_3: 'bg-emerald-400',
}

const agentPillColors: Record<AgentLogEntry['agent'], string> = {
  TRACKER: 'bg-slate-800 text-slate-400',
  AGENT_1: 'bg-brand-500/10 text-brand-400',
  AGENT_2: 'bg-indigo-500/10 text-indigo-400',
  AGENT_3: 'bg-emerald-500/10 text-emerald-400',
}

interface AgentLogTimelineProps {
  logs: AgentLogEntry[]
}

export default function AgentLogTimeline({ logs }: AgentLogTimelineProps) {
  return (
    <div className="space-y-4 overflow-y-auto max-h-96 pr-1">
      {logs.map((log, index) => (
        <motion.div
          key={log.id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: index * 0.05 }}
          className="flex gap-3"
        >
          {/* Left dot + line */}
          <div className="flex flex-col items-center gap-1 pt-1">
            <div className={cn('w-2.5 h-2.5 rounded-full flex-shrink-0', agentDotColors[log.agent])} />
            {index < logs.length - 1 && (
              <div className="w-px flex-1 bg-slate-800 min-h-[1rem]" />
            )}
          </div>

          {/* Content */}
          <div className="pb-4 flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full', agentPillColors[log.agent])}>
                {log.agent}
              </span>
              <span className="text-slate-100 font-medium text-sm">{log.action}</span>
            </div>
            <p className="text-slate-400 text-sm leading-relaxed">{log.data}</p>
            <div className="flex items-center gap-3 mt-1.5">
              <span className="font-mono text-slate-500 text-xs">{formatDate(log.timestamp)}</span>
              {log.txHash && (
                <a
                  href={`https://somnia-testnet.socialscan.io/tx/${log.txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-mono text-xs text-brand-400 hover:text-brand-300 transition-colors"
                >
                  <span className="truncate max-w-[140px]">{log.txHash}</span>
                  <ExternalLink className="w-3 h-3 flex-shrink-0" />
                </a>
              )}
            </div>
          </div>
        </motion.div>
      ))}
      {logs.length === 0 && (
        <p className="text-slate-500 text-sm text-center py-8">No agent activity yet.</p>
      )}
    </div>
  )
}
