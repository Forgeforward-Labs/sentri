import { useEffect, useState } from 'react'
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { parseUnits } from 'viem'
import { toast } from 'sonner'
import {
  CORE_ADDRESS,
  ORCHESTRATOR_ADDRESS,
  OWNER_ADDRESS,
  USDC_DECIMALS,
  INSURANCE_CORE_ADMIN_ABI,
  ORCHESTRATOR_ADMIN_ABI,
} from '../lib/contracts'
import { useProducts } from '../lib/useTrackerData'
import StatusBadge from '../components/StatusBadge'
import { formatUsd } from '../lib/utils'

// ── helpers ──────────────────────────────────────────────────────────────────

function Field({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
  placeholder?: string
}) {
  return (
    <div>
      <label className="block text-xs text-slate-400 mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-brand-500"
      />
    </div>
  )
}

function TxButton({
  label,
  onClick,
  walletPending,
  confirming,
}: {
  label: string
  onClick: () => void
  walletPending: boolean
  confirming: boolean
}) {
  const busy = walletPending || confirming
  const busyLabel = walletPending ? 'Confirm in wallet…' : 'Confirming on-chain…'

  return (
    <button
      onClick={onClick}
      disabled={busy}
      className="bg-brand-500 hover:bg-brand-400 disabled:opacity-50 disabled:cursor-not-allowed text-black font-semibold text-sm px-5 py-2 rounded-lg transition-colors flex items-center gap-2"
    >
      {busy && (
        <span className="w-3.5 h-3.5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
      )}
      {busy ? busyLabel : label}
    </button>
  )
}

// ── Section: Create Depeg Product ────────────────────────────────────────────

function CreateDepegSection() {
  const [name, setName] = useState('')
  const [pool, setPool] = useState('')
  const [threshold, setThreshold] = useState('97')
  const [premiumBps, setPremiumBps] = useState('100')
  const [durationHours, setDurationHours] = useState('720')
  const [maxPosUsd, setMaxPosUsd] = useState('10000')
  const [poolLimitUsd, setPoolLimitUsd] = useState('100000')

  const { writeContract, data: hash, isPending } = useWriteContract()
  const { isLoading: confirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  useEffect(() => {
    if (isSuccess) {
      toast.success('Depeg product created!')
      setName('')
      setPool('')
    }
  }, [isSuccess])

  function submit() {
    if (!CORE_ADDRESS) { toast.error('Contract address not configured'); return }
    if (!name.trim()) { toast.error('Product name is required'); return }
    if (!pool.startsWith('0x')) { toast.error('Invalid pool address'); return }

    writeContract(
      {
        address: CORE_ADDRESS,
        abi: INSURANCE_CORE_ADMIN_ABI,
        functionName: 'createDepegProduct',
        args: [
          name,
          pool as `0x${string}`,
          BigInt(Math.round((parseFloat(threshold) / 100) * 1e18)),
          BigInt(premiumBps),
          BigInt(Math.round(parseFloat(durationHours) * 3600)),
          parseUnits(maxPosUsd, USDC_DECIMALS),
          parseUnits(poolLimitUsd, USDC_DECIMALS),
        ],
      },
      { onError: (err) => toast.error(err.message.split('\n')[0]) },
    )
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
      <h2 className="text-white font-semibold mb-4">Create Depeg Product</h2>
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="col-span-2">
          <Field label="Product Name" value={name} onChange={setName} placeholder="USDC Depeg Cover" />
        </div>
        <div className="col-span-2">
          <Field label="Pool Address (Curve/Uniswap)" value={pool} onChange={setPool} placeholder="0x…" />
        </div>
        <Field label="Depeg Threshold (%)" value={threshold} onChange={setThreshold} type="number" placeholder="97" />
        <Field label="Premium Rate (bps)" value={premiumBps} onChange={setPremiumBps} type="number" placeholder="100" />
        <Field label="Duration (hours)" value={durationHours} onChange={setDurationHours} type="number" placeholder="720" />
        <Field label="Max Per Position (USDC)" value={maxPosUsd} onChange={setMaxPosUsd} type="number" placeholder="10000" />
        <div className="col-span-2">
          <Field label="Pool Limit (USDC)" value={poolLimitUsd} onChange={setPoolLimitUsd} type="number" placeholder="100000" />
        </div>
      </div>
      <TxButton label="Create Depeg Product" onClick={submit} walletPending={isPending} confirming={confirming} />
    </div>
  )
}

// ── Section: Create Rug Product ───────────────────────────────────────────────

function CreateRugSection() {
  const [name, setName] = useState('')
  const [token, setToken] = useState('')
  const [pool, setPool] = useState('')
  const [liquidityThreshold, setLiquidityThreshold] = useState('20')
  const [premiumBps, setPremiumBps] = useState('200')
  const [maxPosUsd, setMaxPosUsd] = useState('5000')
  const [poolLimitUsd, setPoolLimitUsd] = useState('50000')
  const [referenceTvlUsd, setReferenceTvlUsd] = useState('1000000')

  const { writeContract, data: hash, isPending } = useWriteContract()
  const { isLoading: confirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  useEffect(() => {
    if (isSuccess) {
      toast.success('Rug protection product created!')
      setName('')
      setToken('')
      setPool('')
    }
  }, [isSuccess])

  function submit() {
    if (!CORE_ADDRESS) { toast.error('Contract address not configured'); return }
    if (!name.trim()) { toast.error('Product name is required'); return }
    if (!token.startsWith('0x')) { toast.error('Invalid token address'); return }
    if (!pool.startsWith('0x')) { toast.error('Invalid pool address'); return }

    writeContract(
      {
        address: CORE_ADDRESS,
        abi: INSURANCE_CORE_ADMIN_ABI,
        functionName: 'createRugProduct',
        args: [
          name,
          token as `0x${string}`,
          pool as `0x${string}`,
          BigInt(Math.round(parseFloat(liquidityThreshold) * 100)),
          BigInt(premiumBps),
          parseUnits(maxPosUsd, USDC_DECIMALS),
          parseUnits(poolLimitUsd, USDC_DECIMALS),
          parseUnits(referenceTvlUsd, USDC_DECIMALS),
        ],
      },
      { onError: (err) => toast.error(err.message.split('\n')[0]) },
    )
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
      <h2 className="text-white font-semibold mb-4">Create Rug Protection Product</h2>
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="col-span-2">
          <Field label="Product Name" value={name} onChange={setName} placeholder="Token Rug Protection" />
        </div>
        <div className="col-span-2">
          <Field label="Token Address" value={token} onChange={setToken} placeholder="0x… (protected token)" />
        </div>
        <div className="col-span-2">
          <Field label="Pool Address" value={pool} onChange={setPool} placeholder="0x… (liquidity pool)" />
        </div>
        <Field label="Liquidity Threshold (%)" value={liquidityThreshold} onChange={setLiquidityThreshold} type="number" placeholder="20" />
        <Field label="Premium Rate (bps)" value={premiumBps} onChange={setPremiumBps} type="number" placeholder="200" />
        <Field label="Max Per Position (USDC)" value={maxPosUsd} onChange={setMaxPosUsd} type="number" placeholder="5000" />
        <Field label="Pool Limit (USDC)" value={poolLimitUsd} onChange={setPoolLimitUsd} type="number" placeholder="50000" />
        <div className="col-span-2">
          <Field label="Reference TVL (USDC)" value={referenceTvlUsd} onChange={setReferenceTvlUsd} type="number" placeholder="1000000" />
        </div>
      </div>
      <TxButton label="Create Rug Product" onClick={submit} walletPending={isPending} confirming={confirming} />
    </div>
  )
}

// ── Section: Agent Config ─────────────────────────────────────────────────────

function AgentConfigSection() {
  const [jsonAgentId, setJsonAgentId] = useState('')
  const [llmAgentId, setLlmAgentId] = useState('')
  const [fundAmount, setFundAmount] = useState('1')

  const { data: currentJsonId } = useReadContract({
    address: ORCHESTRATOR_ADDRESS,
    abi: ORCHESTRATOR_ADMIN_ABI,
    functionName: 'jsonApiAgentId',
    query: { enabled: !!ORCHESTRATOR_ADDRESS },
  })
  const { data: currentLlmId } = useReadContract({
    address: ORCHESTRATOR_ADDRESS,
    abi: ORCHESTRATOR_ADMIN_ABI,
    functionName: 'llmAgentId',
    query: { enabled: !!ORCHESTRATOR_ADDRESS },
  })

  const { writeContract: writeSetAgents, data: setAgentsHash, isPending: settingAgents } = useWriteContract()
  const { isLoading: confirmingAgents, isSuccess: agentsSet } = useWaitForTransactionReceipt({ hash: setAgentsHash })

  const { writeContract: writeFund, data: fundHash, isPending: funding } = useWriteContract()
  const { isLoading: confirmingFund, isSuccess: funded } = useWaitForTransactionReceipt({ hash: fundHash })

  useEffect(() => { if (agentsSet) toast.success('Agent IDs updated!') }, [agentsSet])
  useEffect(() => { if (funded) toast.success('Orchestrator funded!') }, [funded])

  function submitSetAgents() {
    if (!ORCHESTRATOR_ADDRESS) { toast.error('Orchestrator address not configured'); return }
    if (!jsonAgentId || !llmAgentId) { toast.error('Both agent IDs are required'); return }

    writeSetAgents(
      {
        address: ORCHESTRATOR_ADDRESS,
        abi: ORCHESTRATOR_ADMIN_ABI,
        functionName: 'setAgentIds',
        args: [BigInt(jsonAgentId), BigInt(llmAgentId)],
      },
      { onError: (err) => toast.error(err.message.split('\n')[0]) },
    )
  }

  function submitFund() {
    if (!ORCHESTRATOR_ADDRESS) { toast.error('Orchestrator address not configured'); return }
    const amount = parseFloat(fundAmount)
    if (!amount || amount <= 0) { toast.error('Enter a valid STT amount'); return }

    writeFund(
      {
        address: ORCHESTRATOR_ADDRESS,
        abi: ORCHESTRATOR_ADMIN_ABI,
        functionName: 'fund',
        value: parseUnits(fundAmount, 18),
      },
      { onError: (err) => toast.error(err.message.split('\n')[0]) },
    )
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
      <h2 className="text-white font-semibold mb-4">Agent Configuration</h2>

      <div className="mb-4 p-3 bg-slate-800/50 rounded-lg text-xs text-slate-400 space-y-1">
        <p>JSON API Agent ID: <span className="text-slate-200 font-mono">{currentJsonId?.toString() ?? '…'}</span></p>
        <p>LLM Agent ID: <span className="text-slate-200 font-mono">{currentLlmId?.toString() ?? '…'}</span></p>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <Field label="JSON API Agent ID" value={jsonAgentId} onChange={setJsonAgentId} type="number" placeholder="e.g. 1" />
        <Field label="LLM Agent ID" value={llmAgentId} onChange={setLlmAgentId} type="number" placeholder="e.g. 2" />
      </div>
      <TxButton label="Set Agent IDs" onClick={submitSetAgents} walletPending={settingAgents} confirming={confirmingAgents} />

      <div className="mt-6 pt-6 border-t border-slate-800">
        <h3 className="text-white font-medium mb-3">Fund Orchestrator (STT)</h3>
        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <Field label="Amount (STT)" value={fundAmount} onChange={setFundAmount} type="number" placeholder="1.0" />
          </div>
          <TxButton label="Send STT" onClick={submitFund} walletPending={funding} confirming={confirmingFund} />
        </div>
        <p className="text-xs text-slate-500 mt-2">
          Each claim cycle costs ~0.3 STT (3 × JSON API @ 0.03 + 6 × LLM @ 0.07).
        </p>
      </div>
    </div>
  )
}

// ── Section: Products List ────────────────────────────────────────────────────

function ProductsSection() {
  const { data: products = [], refetch } = useProducts()
  const [pendingId, setPendingId] = useState<number | null>(null)

  const { writeContract, data: hash, isPending } = useWriteContract()
  const { isSuccess } = useWaitForTransactionReceipt({ hash })

  useEffect(() => {
    if (isSuccess) {
      toast.success('Product updated!')
      setPendingId(null)
      void refetch()
    }
  }, [isSuccess, refetch])

  function pause(id: number) {
    if (!CORE_ADDRESS) { toast.error('Contract address not configured'); return }
    setPendingId(id)
    writeContract(
      {
        address: CORE_ADDRESS,
        abi: INSURANCE_CORE_ADMIN_ABI,
        functionName: 'pauseProduct',
        args: [BigInt(id), 'Admin pause'],
      },
      { onError: (err) => { toast.error(err.message.split('\n')[0]); setPendingId(null) } },
    )
  }

  function unpause(id: number) {
    if (!CORE_ADDRESS) { toast.error('Contract address not configured'); return }
    setPendingId(id)
    writeContract(
      {
        address: CORE_ADDRESS,
        abi: INSURANCE_CORE_ADMIN_ABI,
        functionName: 'unpauseProduct',
        args: [BigInt(id)],
      },
      { onError: (err) => { toast.error(err.message.split('\n')[0]); setPendingId(null) } },
    )
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
      <h2 className="text-white font-semibold mb-4">Products ({products.length})</h2>
      {products.length === 0 ? (
        <p className="text-slate-500 text-sm">No products yet. Create one above.</p>
      ) : (
        <div className="space-y-3">
          {products.map((p) => {
            const isThisPending = isPending && pendingId === p.id
            return (
              <div key={p.id} className="flex items-center justify-between gap-4 py-3 border-b border-slate-800 last:border-0">
                <div className="min-w-0">
                  <p className="text-white text-sm font-medium truncate">{p.name}</p>
                  <p className="text-slate-500 text-xs mt-0.5">
                    ID #{p.id} · {p.triggerType} · {formatUsd(p.maxPerPositionUsd)} max
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <StatusBadge status={p.active ? 'ACTIVE' : 'EXPIRED'} />
                  {p.active ? (
                    <button
                      onClick={() => pause(p.id)}
                      disabled={isPending}
                      className="text-xs text-red-400 hover:text-red-300 border border-red-500/20 hover:border-red-400/40 px-3 py-1 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1.5"
                    >
                      {isThisPending && <span className="w-2.5 h-2.5 border border-red-400/50 border-t-red-400 rounded-full animate-spin" />}
                      Pause
                    </button>
                  ) : (
                    <button
                      onClick={() => unpause(p.id)}
                      disabled={isPending}
                      className="text-xs text-emerald-400 hover:text-emerald-300 border border-emerald-500/20 hover:border-emerald-400/40 px-3 py-1 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1.5"
                    >
                      {isThisPending && <span className="w-2.5 h-2.5 border border-emerald-400/50 border-t-emerald-400 rounded-full animate-spin" />}
                      Unpause
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const { address } = useAccount()

  if (!address) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-24 text-center min-h-screen">
        <p className="text-slate-400">Connect your wallet to access the admin panel.</p>
      </div>
    )
  }

  if (address.toLowerCase() !== OWNER_ADDRESS.toLowerCase()) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-24 text-center min-h-screen">
        <div className="bg-slate-900 border border-red-500/20 rounded-2xl p-12 max-w-md mx-auto">
          <p className="text-red-400 text-4xl mb-4">403</p>
          <h2 className="text-white font-bold text-xl mb-2">Access Denied</h2>
          <p className="text-slate-500 text-sm">This page is only accessible to the protocol owner.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-12 min-h-screen">
      <div className="mb-10">
        <h1 className="text-4xl font-black text-white mb-2">Admin Panel</h1>
        <p className="text-slate-400">Manage insurance products and agent configuration.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <CreateDepegSection />
        <CreateRugSection />
        <AgentConfigSection />
        <ProductsSection />
      </div>
    </div>
  )
}
