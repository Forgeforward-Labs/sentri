import { motion } from 'framer-motion'
import { ExternalLink } from 'lucide-react'
import type { AgentLogEntry } from '@sentri/shared-types'
import { formatDate, cn } from '../lib/utils'

const agentConfig: Record<
  AgentLogEntry['agent'],
  { label: string; dot: string; pill: string }
> = {
  TRACKER: { label: 'Tracker',        dot: 'bg-slate-500',   pill: 'bg-slate-800 text-slate-400'         },
  AGENT_1: { label: 'Agent 1 · API',  dot: 'bg-brand-400',   pill: 'bg-brand-500/10 text-brand-400'      },
  AGENT_2: { label: 'Agent 2 · LLM',  dot: 'bg-indigo-400',  pill: 'bg-indigo-500/10 text-indigo-400'    },
  AGENT_3: { label: 'Agent 3 · Web',  dot: 'bg-emerald-400', pill: 'bg-emerald-500/10 text-emerald-400'  },
}

interface AgentLogTimelineProps {
  logs: AgentLogEntry[]
}

export default function AgentLogTimeline({ logs }: AgentLogTimelineProps) {
  return (
    <div className="space-y-0 overflow-y-auto max-h-[480px] pr-1">
      {logs.map((log, index) => {
        const cfg = agentConfig[log.agent] ?? agentConfig.TRACKER
        return (
          <motion.div
            key={log.id}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.25, delay: Math.min(index * 0.04, 0.4) }}
            className="flex gap-3 group"
          >
            {/* Timeline spine */}
            <div className="flex flex-col items-center shrink-0 w-5">
              <div className={cn('w-2 h-2 rounded-full mt-[18px] shrink-0 ring-2 ring-slate-950', cfg.dot)} />
              {index < logs.length - 1 && (
                <div className="w-px flex-1 bg-slate-800 mt-1" />
              )}
            </div>

            {/* Content */}
            <div className="pb-5 flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-0.5">
                <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full tracking-wide', cfg.pill)}>
                  {cfg.label}
                </span>
                <span className="text-slate-100 font-medium text-sm">{log.action}</span>
              </div>
              <p className="text-slate-400 text-sm leading-relaxed break-words">{log.data}</p>
              <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                <span className="font-mono text-slate-600 text-xs">{formatDate(log.timestamp)}</span>
                {log.txHash && (
                  <a
                    href={`https://somnia-testnet.socialscan.io/tx/${log.txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-mono text-xs text-brand-400 hover:text-brand-300 transition-colors"
                  >
                    <span className="truncate max-w-[160px]">{log.txHash}</span>
                    <ExternalLink className="w-3 h-3 shrink-0" />
                  </a>
                )}
              </div>
            </div>
          </motion.div>
        )
      })}
      {logs.length === 0 && (
        <div className="text-center py-10">
          <p className="text-slate-600 text-sm">No agent activity yet.</p>
        </div>
      )}
    </div>
  )
}
