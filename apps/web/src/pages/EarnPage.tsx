import { useState } from 'react'
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract } from 'wagmi'
import { parseUnits, formatUnits } from 'viem'
import { formatUsd, cn } from '../lib/utils'
import {
  VAULT_ADDRESS, USDC_ADDRESS,
  USDC_DECIMALS, ERC20_ABI, POLICY_VAULT_ABI,
} from '../lib/contracts'
import { usePoolStats } from '../lib/useTrackerData'

const tiers = [
  { label: '< 50%',   multiplier: '1x',   color: 'text-emerald-400', bar: 'bg-emerald-500', threshold: 50  },
  { label: '50–70%',  multiplier: '1.5x',  color: 'text-amber-400',   bar: 'bg-amber-500',   threshold: 70  },
  { label: '70–90%',  multiplier: '2x',   color: 'text-orange-400',  bar: 'bg-orange-500',  threshold: 90  },
  { label: '> 90%',   multiplier: '3x',   color: 'text-red-400',     bar: 'bg-red-500',     threshold: 100 },
]

function UtilizationBar({ bps }: { bps: number }) {
  const pct = bps / 100
  return (
    <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden flex">
      <div className="bg-emerald-500 h-full" style={{ width: `${Math.min(pct, 50)}%` }} />
      {pct > 50 && <div className="bg-amber-500 h-full"  style={{ width: `${Math.min(pct - 50, 20)}%` }} />}
      {pct > 70 && <div className="bg-orange-500 h-full" style={{ width: `${Math.min(pct - 70, 20)}%` }} />}
      {pct > 90 && <div className="bg-red-500 h-full"    style={{ width: `${Math.min(pct - 90, 10)}%` }} />}
    </div>
  )
}

export default function EarnPage() {
  const { address, isConnected } = useAccount()
  const [depositAmount, setDepositAmount] = useState('')
  const [withdrawShares, setWithdrawShares] = useState('')

  const { data: stats } = usePoolStats()
  const utilizationPct = (stats?.utilizationBps ?? 0) / 100

  // ── Shares balance ────────────────────────────────────────────
  const { data: shareBalance } = useReadContract({
    address: VAULT_ADDRESS,
    abi: POLICY_VAULT_ABI,
    functionName: 'balanceOf',
    args: [address ?? '0x'],
    query: { enabled: Boolean(address && VAULT_ADDRESS) },
  })

  const { data: shareValue } = useReadContract({
    address: VAULT_ADDRESS,
    abi: POLICY_VAULT_ABI,
    functionName: 'shareValue',
    query: { enabled: Boolean(VAULT_ADDRESS) },
  })

  const sharesNum   = shareBalance ? Number(formatUnits(shareBalance, USDC_DECIMALS)) : 0
  const svNum       = shareValue   ? Number(shareValue) / 1e18 : (stats?.shareValue ?? 1)
  const positionUsd = sharesNum * svNum

  // ── USDC allowance ─────────────────────────────────────────────
  const { data: allowance } = useReadContract({
    address: USDC_ADDRESS,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: [address ?? '0x', VAULT_ADDRESS ?? '0x'],
    query: { enabled: Boolean(address && USDC_ADDRESS && VAULT_ADDRESS) },
  })

  const depositAmountRaw = parseFloat(depositAmount) > 0
    ? parseUnits(parseFloat(depositAmount).toString(), USDC_DECIMALS)
    : 0n
  const needsApproval = allowance !== undefined && depositAmountRaw > 0n && allowance < depositAmountRaw

  // ── Write: approve ─────────────────────────────────────────────
  const { writeContract: approve, data: approveTxHash } = useWriteContract()
  const { isLoading: approving } = useWaitForTransactionReceipt({ hash: approveTxHash })

  // ── Write: deposit ─────────────────────────────────────────────
  const { writeContract: deposit, data: depositTxHash, isPending: depositing } = useWriteContract()
  const { isLoading: depositConfirming, isSuccess: depositDone } = useWaitForTransactionReceipt({ hash: depositTxHash })

  // ── Write: withdraw ────────────────────────────────────────────
  const { writeContract: withdraw, data: withdrawTxHash, isPending: withdrawing } = useWriteContract()
  const { isLoading: withdrawConfirming, isSuccess: withdrawDone } = useWaitForTransactionReceipt({ hash: withdrawTxHash })

  function handleDeposit() {
    if (!VAULT_ADDRESS || !USDC_ADDRESS) return
    if (needsApproval) {
      approve({ address: USDC_ADDRESS, abi: ERC20_ABI, functionName: 'approve',
        args: [VAULT_ADDRESS, depositAmountRaw * 10n] })
    } else {
      deposit({ address: VAULT_ADDRESS, abi: POLICY_VAULT_ABI, functionName: 'deposit',
        args: [depositAmountRaw] })
    }
  }

  function handleWithdraw() {
    if (!VAULT_ADDRESS) return
    const sharesRaw = parseFloat(withdrawShares) > 0
      ? parseUnits(parseFloat(withdrawShares).toString(), USDC_DECIMALS)
      : 0n
    if (sharesRaw === 0n) return
    withdraw({ address: VAULT_ADDRESS, abi: POLICY_VAULT_ABI, functionName: 'withdraw',
      args: [sharesRaw] })
  }

  const estimatedShares =
    parseFloat(depositAmount) > 0
      ? (parseFloat(depositAmount) / svNum).toFixed(4)
      : '—'

  const estimatedUsdc =
    parseFloat(withdrawShares) > 0
      ? formatUsd(parseFloat(withdrawShares) * svNum)
      : '—'

  return (
    <div className="max-w-7xl mx-auto px-6 py-12 min-h-screen">
      <div className="mb-10">
        <h1 className="text-4xl font-black text-white mb-3">Earn Yield</h1>
        <p className="text-slate-400 text-lg max-w-xl">
          Provide liquidity and earn premiums from coverage buyers. Yield scales with pool utilization.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <p className="text-slate-500 text-xs mb-2 uppercase tracking-wider">TVL</p>
          <p className="text-white font-bold text-2xl">{formatUsd(stats?.totalDepositedUsd ?? 0)}</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <p className="text-slate-500 text-xs mb-2 uppercase tracking-wider">Locked</p>
          <p className="text-white font-bold text-2xl">{formatUsd(stats?.totalLockedUsd ?? 0)}</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <p className="text-slate-500 text-xs mb-2 uppercase tracking-wider">Utilization</p>
          <p className={cn(
            'font-bold text-2xl',
            utilizationPct < 50 ? 'text-emerald-400' :
            utilizationPct < 70 ? 'text-amber-400'   :
            utilizationPct < 90 ? 'text-orange-400'  : 'text-red-400',
          )}>
            {utilizationPct.toFixed(1)}%
          </p>
          <div className="mt-2"><UtilizationBar bps={stats?.utilizationBps ?? 0} /></div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <p className="text-slate-500 text-xs mb-2 uppercase tracking-wider">APY Estimate</p>
          <p className="text-emerald-400 font-bold text-2xl">{(stats?.apyEstimate ?? 0).toFixed(1)}%</p>
        </div>
      </div>

      {/* Multiplier tiers */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 mb-8">
        <h2 className="text-white font-semibold mb-4">Yield Multiplier Tiers</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {tiers.map((tier) => {
            const active =
              tier.threshold === 50  ? utilizationPct < 50 :
              tier.threshold === 70  ? utilizationPct >= 50 && utilizationPct < 70 :
              tier.threshold === 90  ? utilizationPct >= 70 && utilizationPct < 90 :
                                       utilizationPct >= 90
            return (
              <div key={tier.label} className={cn(
                'rounded-lg p-4 border transition-all',
                active ? 'bg-slate-800 border-slate-600' : 'bg-slate-800/40 border-slate-800',
              )}>
                <div className={cn('w-2 h-2 rounded-full mb-2', tier.bar)} />
                <p className="text-slate-400 text-xs mb-1">{tier.label}</p>
                <p className={cn('font-bold text-xl', tier.color)}>{tier.multiplier}</p>
                {active && <span className="text-xs text-slate-500 mt-1 block">Current</span>}
              </div>
            )
          })}
        </div>
      </div>

      {/* Action panels */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {/* Deposit */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 flex flex-col gap-5">
          <h2 className="text-white font-semibold text-lg">Deposit USDC</h2>

          <div>
            <label className="text-xs text-slate-500 mb-1.5 block">Amount</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">$</span>
              <input
                type="number" min={0} step={10}
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                placeholder="0.00"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-7 pr-16 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-brand-500 transition-colors"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs">USDC</span>
            </div>
          </div>

          {parseFloat(depositAmount) > 0 && (
            <div className="bg-slate-800/60 rounded-lg p-3 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Estimated shares</span>
                <span className="text-white font-medium">{estimatedShares}</span>
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-slate-500">Share price</span>
                <span className="text-white font-medium">${svNum.toFixed(4)}</span>
              </div>
            </div>
          )}

          {depositDone ? (
            <div className="w-full py-3 rounded-xl text-sm text-center bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              Deposit confirmed!
            </div>
          ) : (
            <button
              onClick={handleDeposit}
              disabled={!isConnected || !VAULT_ADDRESS || !parseFloat(depositAmount) || approving || depositing || depositConfirming}
              className={cn(
                'w-full py-3 rounded-xl font-semibold text-sm transition-colors mt-auto',
                isConnected && VAULT_ADDRESS && parseFloat(depositAmount) > 0 && !approving && !depositing && !depositConfirming
                  ? 'bg-brand-500 hover:bg-brand-400 text-black'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed',
              )}
            >
              {!isConnected ? 'Connect Wallet' :
               approving ? 'Approving…' :
               depositing || depositConfirming ? 'Depositing…' :
               needsApproval ? 'Approve USDC' : 'Deposit'}
            </button>
          )}
        </div>

        {/* Withdraw */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 flex flex-col gap-5">
          <h2 className="text-white font-semibold text-lg">Withdraw</h2>

          <div>
            <label className="text-xs text-slate-500 mb-1.5 block">Shares to redeem</label>
            <input
              type="number" min={0} step={1}
              value={withdrawShares}
              onChange={(e) => setWithdrawShares(e.target.value)}
              placeholder="0"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-brand-500 transition-colors"
            />
          </div>

          {parseFloat(withdrawShares) > 0 && (
            <div className="bg-slate-800/60 rounded-lg p-3 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Estimated USDC</span>
                <span className="text-white font-medium">{estimatedUsdc}</span>
              </div>
            </div>
          )}

          {/* Your position */}
          <div className="bg-slate-800/60 rounded-lg p-4">
            <p className="text-slate-500 text-xs mb-3 uppercase tracking-wider">Your Position</p>
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Share balance</span>
                <span className="text-white">{isConnected ? sharesNum.toFixed(4) : '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Current value</span>
                <span className="text-white">{isConnected ? formatUsd(positionUsd) : '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">APY</span>
                <span className="text-emerald-400">{(stats?.apyEstimate ?? 0).toFixed(1)}%</span>
              </div>
            </div>
          </div>

          {withdrawDone ? (
            <div className="w-full py-3 rounded-xl text-sm text-center bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              Withdrawal confirmed!
            </div>
          ) : (
            <button
              onClick={handleWithdraw}
              disabled={!isConnected || !VAULT_ADDRESS || !parseFloat(withdrawShares) || withdrawing || withdrawConfirming}
              className={cn(
                'w-full py-3 rounded-xl font-semibold text-sm transition-colors',
                isConnected && VAULT_ADDRESS && parseFloat(withdrawShares) > 0 && !withdrawing && !withdrawConfirming
                  ? 'border border-slate-600 hover:border-slate-400 text-slate-200 hover:text-white'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed',
              )}
            >
              {!isConnected ? 'Connect Wallet' :
               withdrawing || withdrawConfirming ? 'Withdrawing…' : 'Withdraw'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
