import { useEffect, useMemo, useState } from 'react'
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract, useReadContracts } from 'wagmi'
import { parseUnits, formatUnits } from 'viem'
import { toast } from 'sonner'
import { TrendingUp, Lock, BarChart2, Percent } from 'lucide-react'
import { formatUsd, cn } from '../lib/utils'
import {
  VAULT_ADDRESS, USDSO_ADDRESS,
  USDSO_DECIMALS, ERC20_ABI, POLICY_VAULT_ABI,
} from '../lib/contracts'
import { useProducts } from '../lib/useTrackerData'

function computePositionUsd(shareBalance: bigint | undefined, shareValue: bigint | undefined): number {
  if (!shareBalance || !shareValue) return 0
  return Number(formatUnits((shareBalance * shareValue) / 10n ** 18n, USDSO_DECIMALS))
}

function computeEstimatedShares(depositRaw: bigint, shareValue: bigint | undefined): string {
  if (!shareValue || shareValue === 0n || depositRaw === 0n) return '—'
  const shares = (depositRaw * 10n ** 18n) / shareValue
  return Number(formatUnits(shares, USDSO_DECIMALS)).toFixed(4)
}

const tiers = [
  { label: '< 50%',  multiplier: '1x',   color: 'text-emerald-400', dot: 'bg-emerald-500', border: 'border-emerald-500/20', max: 50  },
  { label: '50–70%', multiplier: '1.5x', color: 'text-amber-400',   dot: 'bg-amber-500',   border: 'border-amber-500/20',   max: 70  },
  { label: '70–90%', multiplier: '2x',   color: 'text-orange-400',  dot: 'bg-orange-500',  border: 'border-orange-500/20',  max: 90  },
  { label: '> 90%',  multiplier: '3x',   color: 'text-red-400',     dot: 'bg-red-500',     border: 'border-red-500/20',     max: 100 },
]

function UtilizationBar({ bps }: { bps: number }) {
  const pct = bps / 100
  return (
    <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden flex">
      <div className="bg-emerald-500 h-full transition-all" style={{ width: `${Math.min(pct, 50)}%` }} />
      {pct > 50 && <div className="bg-amber-500 h-full transition-all"  style={{ width: `${Math.min(pct - 50, 20)}%` }} />}
      {pct > 70 && <div className="bg-orange-500 h-full transition-all" style={{ width: `${Math.min(pct - 70, 20)}%` }} />}
      {pct > 90 && <div className="bg-red-500 h-full transition-all"    style={{ width: `${Math.min(pct - 90, 10)}%` }} />}
    </div>
  )
}

export default function EarnPage() {
  const { address, isConnected } = useAccount()
  const [depositAmount, setDepositAmount] = useState('')
  const [withdrawAmount, setWithdrawAmount] = useState('')

  const { data: vaultData, refetch: refetchVault } = useReadContracts({
    contracts: [
      { address: VAULT_ADDRESS, abi: POLICY_VAULT_ABI, functionName: 'totalDeposited' },
      { address: VAULT_ADDRESS, abi: POLICY_VAULT_ABI, functionName: 'totalLocked' },
      { address: VAULT_ADDRESS, abi: POLICY_VAULT_ABI, functionName: 'utilizationRate' },
      { address: VAULT_ADDRESS, abi: POLICY_VAULT_ABI, functionName: 'shareValue' },
    ],
    query: { enabled: !!VAULT_ADDRESS, refetchInterval: 15_000 },
  })

  const totalDeposited  = vaultData?.[0].result ?? 0n
  const totalLocked     = vaultData?.[1].result ?? 0n
  const utilizationBps  = vaultData?.[2].result ?? 0n
  const shareValue      = vaultData?.[3].result ?? 10n ** 18n

  const utilizationPct    = Number(utilizationBps) / 100
  const totalDepositedUsd = Number(formatUnits(totalDeposited, USDSO_DECIMALS))
  const totalLockedUsd    = Number(formatUnits(totalLocked, USDSO_DECIMALS))
  const svNum             = Number(shareValue) / 1e18

  const { data: products } = useProducts()

  const weightedAvgRateBps = useMemo(() => {
    if (!products || products.length === 0) return 300
    const totalCommitted = products.reduce((s, p) => s + p.totalCommittedUsd, 0)
    if (totalCommitted === 0) {
      const totalLimit = products.reduce((s, p) => s + p.poolLimitUsd, 0)
      if (totalLimit === 0) return 300
      return products.reduce((s, p) => s + p.premiumRateBps * p.poolLimitUsd, 0) / totalLimit
    }
    return products.reduce((s, p) => s + p.premiumRateBps * p.totalCommittedUsd, 0) / totalCommitted
  }, [products])

  const utilizationFrac  = Number(utilizationBps) / 10000
  const multiplierFactor = utilizationPct < 50 ? 1 : utilizationPct < 70 ? 1.5 : utilizationPct < 90 ? 2 : 3
  const apyEstimate      = utilizationFrac * (weightedAvgRateBps / 100) * multiplierFactor

  const { data: shareBalance, refetch: refetchShares } = useReadContract({
    address: VAULT_ADDRESS,
    abi: POLICY_VAULT_ABI,
    functionName: 'balanceOf',
    args: [address ?? '0x'],
    query: { enabled: Boolean(address && VAULT_ADDRESS) },
  })

  const { data: usdsoBalance, refetch: refetchUsdso } = useReadContract({
    address: USDSO_ADDRESS,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [address ?? '0x'],
    query: { enabled: Boolean(address && USDSO_ADDRESS) },
  })

  const positionUsd   = computePositionUsd(shareBalance, shareValue)
  const sharesDisplay = shareBalance ? Number(formatUnits(shareBalance, USDSO_DECIMALS)).toFixed(4) : '0.0000'
  const usdsoDisplay   = usdsoBalance  ? Number(formatUnits(usdsoBalance, USDSO_DECIMALS)).toFixed(2)  : '0.00'

  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: USDSO_ADDRESS,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: [address ?? '0x', VAULT_ADDRESS ?? '0x'],
    query: { enabled: Boolean(address && USDSO_ADDRESS && VAULT_ADDRESS) },
  })

  const depositRaw = parseFloat(depositAmount) > 0
    ? parseUnits(parseFloat(depositAmount).toFixed(6), USDSO_DECIMALS)
    : 0n
  const needsApproval = allowance !== undefined && depositRaw > 0n && allowance < depositRaw

  const { writeContract: approve, data: approveTxHash, isPending: approvePending } = useWriteContract()
  const { isLoading: approveConfirming, isSuccess: approveSuccess } = useWaitForTransactionReceipt({ hash: approveTxHash })

  useEffect(() => {
    if (approveSuccess) { toast.success('USDso approved!'); void refetchAllowance() }
  }, [approveSuccess, refetchAllowance])

  const { writeContract: deposit, data: depositTxHash, isPending: depositPending } = useWriteContract()
  const { isLoading: depositConfirming, isSuccess: depositSuccess } = useWaitForTransactionReceipt({ hash: depositTxHash })

  useEffect(() => {
    if (depositSuccess) {
      toast.success('Deposit confirmed!')
      setDepositAmount('')
      void Promise.all([refetchVault(), refetchShares(), refetchUsdso()])
    }
  }, [depositSuccess, refetchVault, refetchShares, refetchUsdso])

  const { writeContract: withdraw, data: withdrawTxHash, isPending: withdrawPending } = useWriteContract()
  const { isLoading: withdrawConfirming, isSuccess: withdrawSuccess } = useWaitForTransactionReceipt({ hash: withdrawTxHash })

  useEffect(() => {
    if (withdrawSuccess) {
      toast.success('Withdrawal confirmed!')
      setWithdrawAmount('')
      void Promise.all([refetchVault(), refetchShares(), refetchUsdso()])
    }
  }, [withdrawSuccess, refetchVault, refetchShares, refetchUsdso])

  function handleDeposit() {
    if (!VAULT_ADDRESS || !USDSO_ADDRESS) { toast.error('Contract not configured'); return }
    if (depositRaw === 0n) { toast.error('Enter a deposit amount'); return }
    if (usdsoBalance !== undefined && depositRaw > usdsoBalance) { toast.error('Insufficient USDso balance'); return }

    if (needsApproval) {
      approve(
        { address: USDSO_ADDRESS, abi: ERC20_ABI, functionName: 'approve', args: [VAULT_ADDRESS, depositRaw * 10n] },
        { onError: (e) => toast.error(e.message.split('\n')[0]) },
      )
    } else {
      deposit(
        { address: VAULT_ADDRESS, abi: POLICY_VAULT_ABI, functionName: 'deposit', args: [depositRaw] },
        { onError: (e) => toast.error(e.message.split('\n')[0]) },
      )
    }
  }

  function handleWithdraw() {
    if (!VAULT_ADDRESS) { toast.error('Contract not configured'); return }
    const withdrawRaw = parseFloat(withdrawAmount) > 0
      ? parseUnits(parseFloat(withdrawAmount).toFixed(6), USDSO_DECIMALS)
      : 0n
    if (withdrawRaw === 0n) { toast.error('Enter a withdrawal amount'); return }
    if (shareBalance !== undefined && withdrawRaw > shareBalance) { toast.error('Insufficient share balance'); return }

    withdraw(
      { address: VAULT_ADDRESS, abi: POLICY_VAULT_ABI, functionName: 'withdraw', args: [withdrawRaw] },
      { onError: (e) => toast.error(e.message.split('\n')[0]) },
    )
  }

  const estimatedShares = computeEstimatedShares(depositRaw, shareValue)
  const estimatedUsdso  = parseFloat(withdrawAmount) > 0
    ? formatUsd(parseFloat(withdrawAmount) * svNum)
    : '—'

  const depositBusy  = approvePending || approveConfirming || depositPending || depositConfirming
  const withdrawBusy = withdrawPending || withdrawConfirming

  const depositLabel = approvePending    ? 'Confirm in wallet…'  :
                       approveConfirming ? 'Approving…'           :
                       depositPending    ? 'Confirm in wallet…'  :
                       depositConfirming ? 'Confirming…'          :
                       needsApproval     ? 'Approve USDso'        : 'Deposit'

  const withdrawLabel = withdrawPending    ? 'Confirm in wallet…' :
                        withdrawConfirming ? 'Confirming…'         : 'Withdraw'

  const metricCards = [
    {
      icon: TrendingUp,
      label: 'TVL',
      value: formatUsd(totalDepositedUsd),
      accent: 'text-brand-400',
      iconBg: 'bg-brand-500/10',
    },
    {
      icon: Lock,
      label: 'Locked',
      value: formatUsd(totalLockedUsd),
      accent: 'text-slate-200',
      iconBg: 'bg-slate-700/50',
    },
    {
      icon: BarChart2,
      label: 'Utilization',
      value: `${utilizationPct.toFixed(1)}%`,
      accent: utilizationPct < 50 ? 'text-emerald-400' : utilizationPct < 70 ? 'text-amber-400' : utilizationPct < 90 ? 'text-orange-400' : 'text-red-400',
      iconBg: 'bg-slate-700/50',
      sub: <div className="mt-2"><UtilizationBar bps={Number(utilizationBps)} /></div>,
    },
    {
      icon: Percent,
      label: 'APY Estimate',
      value: `${apyEstimate.toFixed(1)}%`,
      accent: 'text-emerald-400',
      iconBg: 'bg-emerald-500/10',
    },
  ]

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12 min-h-screen">
      <div className="mb-8 sm:mb-10">
        <p className="text-emerald-400 text-sm font-medium uppercase tracking-wider mb-2">
          Liquidity
        </p>
        <h1 className="text-3xl sm:text-4xl font-black text-white mb-3">Earn Yield</h1>
        <p className="text-slate-400 text-base sm:text-lg max-w-xl">
          Provide liquidity and earn premiums from coverage buyers. Yield scales
          with pool utilization.
        </p>
      </div>

      {/* Metric cards — 2×2 on mobile, 4-col on md+ */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
        {metricCards.map(({ icon: Icon, label, value, accent, iconBg, sub }) => (
          <div key={label} className="bg-slate-900 border border-slate-800 rounded-xl p-5 card-hover">
            <div className="flex items-center gap-2 mb-3">
              <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center', iconBg)}>
                <Icon className={cn('w-3.5 h-3.5', accent)} />
              </div>
              <p className="text-slate-500 text-xs uppercase tracking-wider">{label}</p>
            </div>
            <p className={cn('font-black text-2xl tabular-nums', accent)}>{value}</p>
            {sub}
          </div>
        ))}
      </div>

      {/* Multiplier tiers */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-white font-semibold">Yield Multiplier Tiers</h2>
          <span className="text-slate-500 text-xs">Higher utilization = higher yield</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {tiers.map((tier) => {
            const active =
              tier.max === 50  ? utilizationPct < 50 :
              tier.max === 70  ? utilizationPct >= 50 && utilizationPct < 70 :
              tier.max === 90  ? utilizationPct >= 70 && utilizationPct < 90 :
                                 utilizationPct >= 90
            return (
              <div key={tier.label} className={cn(
                'rounded-xl p-4 border transition-all',
                active
                  ? cn('bg-slate-800/80 shadow-lg', tier.border)
                  : 'bg-slate-800/30 border-slate-800',
              )}>
                <div className={cn('w-2 h-2 rounded-full mb-3', tier.dot)} />
                <p className={cn('font-black text-2xl mb-1', tier.color)}>{tier.multiplier}</p>
                <p className="text-slate-500 text-xs">{tier.label} utilization</p>
                {active && (
                  <span className={cn('text-[10px] font-semibold uppercase tracking-wider mt-2 block', tier.color)}>
                    ← Current
                  </span>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Action panels */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Deposit */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 flex flex-col gap-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-brand-400 text-xs font-semibold uppercase tracking-wider mb-0.5">Deposit</p>
              <h2 className="text-white font-semibold text-lg">Add Liquidity</h2>
            </div>
            {isConnected && (
              <div className="text-right">
                <p className="text-slate-600 text-[10px] uppercase tracking-wider">Balance</p>
                <p className="text-slate-300 text-sm font-medium">${usdsoDisplay}</p>
              </div>
            )}
          </div>

          <div>
            <label className="text-xs text-slate-500 mb-1.5 block">Amount (USDso)</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm select-none">$</span>
              <input
                type="number" min={0} step={10}
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                placeholder="0.00"
                className="input-base pl-7 pr-20 py-3"
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                {isConnected && usdsoBalance !== undefined && (
                  <button
                    onClick={() => setDepositAmount(formatUnits(usdsoBalance, USDSO_DECIMALS))}
                    className="text-xs text-brand-400 hover:text-brand-300 px-2 py-0.5 rounded-md hover:bg-brand-500/10 transition-colors font-medium"
                  >
                    Max
                  </button>
                )}
                <span className="text-slate-500 text-xs">USDso</span>
              </div>
            </div>
          </div>

          {depositRaw > 0n && (
            <div className="bg-slate-800/50 rounded-xl p-3.5 text-sm space-y-2 border border-slate-700/40">
              <div className="flex justify-between">
                <span className="text-slate-400">Estimated shares</span>
                <span className="text-white font-medium tabular-nums">{estimatedShares}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Share price</span>
                <span className="text-white font-medium tabular-nums">${svNum.toFixed(6)}</span>
              </div>
            </div>
          )}

          <button
            onClick={handleDeposit}
            disabled={!isConnected || !VAULT_ADDRESS || depositRaw === 0n || depositBusy}
            className={cn(
              'w-full py-3 rounded-xl font-semibold text-sm transition-all mt-auto flex items-center justify-center gap-2',
              isConnected && VAULT_ADDRESS && depositRaw > 0n && !depositBusy
                ? 'bg-brand-500 hover:bg-brand-400 text-black glow-brand hover:scale-[1.01] active:scale-[0.99]'
                : 'bg-slate-800 text-slate-500 cursor-not-allowed',
            )}
          >
            {depositBusy && <span className="w-3.5 h-3.5 border-2 border-current/30 border-t-current rounded-full animate-spin" />}
            {!isConnected ? 'Connect Wallet' : depositLabel}
          </button>
        </div>

        {/* Withdraw */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 flex flex-col gap-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-0.5">Withdraw</p>
              <h2 className="text-white font-semibold text-lg">Remove Liquidity</h2>
            </div>
            {isConnected && (
              <div className="text-right">
                <p className="text-slate-600 text-[10px] uppercase tracking-wider">Shares</p>
                <p className="text-slate-300 text-sm font-medium tabular-nums">{sharesDisplay}</p>
              </div>
            )}
          </div>

          <div>
            <label className="text-xs text-slate-500 mb-1.5 block">Shares to redeem</label>
            <div className="relative">
              <input
                type="number" min={0} step={1}
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
                placeholder="0.00"
                className="input-base px-4 pr-16 py-3"
              />
              {isConnected && shareBalance !== undefined && (
                <button
                  onClick={() => setWithdrawAmount(formatUnits(shareBalance, USDSO_DECIMALS))}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-brand-400 hover:text-brand-300 px-2 py-0.5 rounded-md hover:bg-brand-500/10 transition-colors font-medium"
                >
                  Max
                </button>
              )}
            </div>
          </div>

          {parseFloat(withdrawAmount) > 0 && (
            <div className="bg-slate-800/50 rounded-xl p-3.5 text-sm border border-slate-700/40">
              <div className="flex justify-between">
                <span className="text-slate-400">Estimated USDso</span>
                <span className="text-white font-medium tabular-nums">{estimatedUsdso}</span>
              </div>
            </div>
          )}

          {/* Your position */}
          <div className="bg-slate-800/40 rounded-xl p-4 border border-slate-700/30">
            <p className="text-slate-500 text-[10px] uppercase tracking-wider mb-3">Your Position</p>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Share balance</span>
                <span className="text-white tabular-nums">{isConnected ? sharesDisplay : '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Current value</span>
                <span className="text-white tabular-nums">{isConnected ? formatUsd(positionUsd) : '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Share price</span>
                <span className="text-slate-300 tabular-nums">${svNum.toFixed(6)}</span>
              </div>
              <div className="flex justify-between border-t border-slate-700/40 pt-2 mt-1">
                <span className="text-slate-500">APY (est.)</span>
                <span className="text-emerald-400 font-semibold">{apyEstimate.toFixed(1)}%</span>
              </div>
            </div>
          </div>

          <button
            onClick={handleWithdraw}
            disabled={!isConnected || !VAULT_ADDRESS || !parseFloat(withdrawAmount) || withdrawBusy}
            className={cn(
              'w-full py-3 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2',
              isConnected && VAULT_ADDRESS && parseFloat(withdrawAmount) > 0 && !withdrawBusy
                ? 'border border-slate-600 hover:border-slate-400 text-slate-200 hover:text-white hover:bg-slate-800/60'
                : 'bg-slate-800 text-slate-500 cursor-not-allowed',
            )}
          >
            {withdrawBusy && <span className="w-3.5 h-3.5 border-2 border-current/30 border-t-current rounded-full animate-spin" />}
            {!isConnected ? 'Connect Wallet' : withdrawLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
