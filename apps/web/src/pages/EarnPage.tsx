import { useEffect, useMemo, useState } from 'react'
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract, useReadContracts } from 'wagmi'
import { parseUnits, formatUnits } from 'viem'
import { toast } from 'sonner'
import { formatUsd, cn } from '../lib/utils'
import {
  VAULT_ADDRESS, USDC_ADDRESS,
  USDC_DECIMALS, ERC20_ABI, POLICY_VAULT_ABI,
} from '../lib/contracts'
import { useProducts } from '../lib/useTrackerData'

// shareValue() returns WAD (1e18-based) where 1e18 = 1 USDC/share at par.
// Shares are minted 1:1 with USDC amounts (6-decimal scale).
// positionUsdc (6dec) = shareBalance * shareValue / 1e18
function computePositionUsd(shareBalance: bigint | undefined, shareValue: bigint | undefined): number {
  if (!shareBalance || !shareValue) return 0
  return Number(formatUnits((shareBalance * shareValue) / 10n ** 18n, USDC_DECIMALS))
}

// estimatedShares = depositAmount_6dec * 1e18 / shareValue → display in 6-dec scale
function computeEstimatedShares(depositRaw: bigint, shareValue: bigint | undefined): string {
  if (!shareValue || shareValue === 0n || depositRaw === 0n) return '—'
  const shares = (depositRaw * 10n ** 18n) / shareValue
  return Number(formatUnits(shares, USDC_DECIMALS)).toFixed(4)
}

const tiers = [
  { label: '< 50%',  multiplier: '1x',   color: 'text-emerald-400', bar: 'bg-emerald-500', max: 50  },
  { label: '50–70%', multiplier: '1.5x', color: 'text-amber-400',   bar: 'bg-amber-500',   max: 70  },
  { label: '70–90%', multiplier: '2x',   color: 'text-orange-400',  bar: 'bg-orange-500',  max: 90  },
  { label: '> 90%',  multiplier: '3x',   color: 'text-red-400',     bar: 'bg-red-500',     max: 100 },
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
  const [withdrawAmount, setWithdrawAmount] = useState('')

  // ── On-chain pool stats ────────────────────────────────────────
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

  const utilizationPct  = Number(utilizationBps) / 100
  const totalDepositedUsd = Number(formatUnits(totalDeposited, USDC_DECIMALS))
  const totalLockedUsd    = Number(formatUnits(totalLocked, USDC_DECIMALS))
  const svNum             = Number(shareValue) / 1e18 // USDC per share (display)

  // ── Products for APY calculation ──────────────────────────────
  const { data: products } = useProducts()

  // Weighted avg premium rate (bps) by committed coverage.
  // Falls back to pool-limit weighting when no coverage is sold yet.
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

  // APY = utilization × weighted avg rate × utilization multiplier
  // Multiplier mirrors PolicyVault.utilizationMultiplierBps() tiers
  const utilizationFrac   = Number(utilizationBps) / 10000
  const multiplierFactor  = utilizationPct < 50 ? 1 : utilizationPct < 70 ? 1.5 : utilizationPct < 90 ? 2 : 3
  const apyEstimate       = utilizationFrac * (weightedAvgRateBps / 100) * multiplierFactor

  // ── User balances ──────────────────────────────────────────────
  const { data: shareBalance, refetch: refetchShares } = useReadContract({
    address: VAULT_ADDRESS,
    abi: POLICY_VAULT_ABI,
    functionName: 'balanceOf',
    args: [address ?? '0x'],
    query: { enabled: Boolean(address && VAULT_ADDRESS) },
  })

  const { data: usdcBalance, refetch: refetchUsdc } = useReadContract({
    address: USDC_ADDRESS,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [address ?? '0x'],
    query: { enabled: Boolean(address && USDC_ADDRESS) },
  })

  const positionUsd  = computePositionUsd(shareBalance, shareValue)
  const sharesDisplay = shareBalance ? Number(formatUnits(shareBalance, USDC_DECIMALS)).toFixed(4) : '0.0000'
  const usdcDisplay   = usdcBalance  ? Number(formatUnits(usdcBalance, USDC_DECIMALS)).toFixed(2)  : '0.00'

  // ── USDC allowance for vault ───────────────────────────────────
  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: USDC_ADDRESS,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: [address ?? '0x', VAULT_ADDRESS ?? '0x'],
    query: { enabled: Boolean(address && USDC_ADDRESS && VAULT_ADDRESS) },
  })

  const depositRaw = parseFloat(depositAmount) > 0
    ? parseUnits(parseFloat(depositAmount).toFixed(6), USDC_DECIMALS)
    : 0n
  const needsApproval = allowance !== undefined && depositRaw > 0n && allowance < depositRaw

  // ── Write: approve USDC ────────────────────────────────────────
  const { writeContract: approve, data: approveTxHash, isPending: approvePending } = useWriteContract()
  const { isLoading: approveConfirming, isSuccess: approveSuccess } = useWaitForTransactionReceipt({ hash: approveTxHash })

  useEffect(() => {
    if (approveSuccess) {
      toast.success('USDC approved!')
      void refetchAllowance()
    }
  }, [approveSuccess, refetchAllowance])

  // ── Write: deposit ─────────────────────────────────────────────
  const { writeContract: deposit, data: depositTxHash, isPending: depositPending } = useWriteContract()
  const { isLoading: depositConfirming, isSuccess: depositSuccess } = useWaitForTransactionReceipt({ hash: depositTxHash })

  useEffect(() => {
    if (depositSuccess) {
      toast.success('Deposit confirmed!')
      setDepositAmount('')
      void Promise.all([refetchVault(), refetchShares(), refetchUsdc()])
    }
  }, [depositSuccess, refetchVault, refetchShares, refetchUsdc])

  // ── Write: withdraw ────────────────────────────────────────────
  const { writeContract: withdraw, data: withdrawTxHash, isPending: withdrawPending } = useWriteContract()
  const { isLoading: withdrawConfirming, isSuccess: withdrawSuccess } = useWaitForTransactionReceipt({ hash: withdrawTxHash })

  useEffect(() => {
    if (withdrawSuccess) {
      toast.success('Withdrawal confirmed!')
      setWithdrawAmount('')
      void Promise.all([refetchVault(), refetchShares(), refetchUsdc()])
    }
  }, [withdrawSuccess, refetchVault, refetchShares, refetchUsdc])

  function handleDeposit() {
    if (!VAULT_ADDRESS || !USDC_ADDRESS) { toast.error('Contract not configured'); return }
    if (depositRaw === 0n) { toast.error('Enter a deposit amount'); return }
    if (usdcBalance !== undefined && depositRaw > usdcBalance) {
      toast.error('Insufficient USDC balance'); return
    }

    if (needsApproval) {
      approve(
        { address: USDC_ADDRESS, abi: ERC20_ABI, functionName: 'approve', args: [VAULT_ADDRESS, depositRaw * 10n] },
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
      ? parseUnits(parseFloat(withdrawAmount).toFixed(6), USDC_DECIMALS)
      : 0n
    if (withdrawRaw === 0n) { toast.error('Enter a withdrawal amount'); return }
    if (shareBalance !== undefined && withdrawRaw > shareBalance) {
      toast.error('Insufficient share balance'); return
    }

    withdraw(
      { address: VAULT_ADDRESS, abi: POLICY_VAULT_ABI, functionName: 'withdraw', args: [withdrawRaw] },
      { onError: (e) => toast.error(e.message.split('\n')[0]) },
    )
  }

  const estimatedShares = computeEstimatedShares(depositRaw, shareValue)
  const estimatedUsdc   = parseFloat(withdrawAmount) > 0
    ? formatUsd(parseFloat(withdrawAmount) * svNum)
    : '—'

  const depositBusy  = approvePending || approveConfirming || depositPending || depositConfirming
  const withdrawBusy = withdrawPending || withdrawConfirming

  const depositLabel = approvePending    ? 'Confirm in wallet…'  :
                       approveConfirming ? 'Approving…'           :
                       depositPending    ? 'Confirm in wallet…'  :
                       depositConfirming ? 'Confirming…'          :
                       needsApproval     ? 'Approve USDC'         : 'Deposit'

  const withdrawLabel = withdrawPending    ? 'Confirm in wallet…' :
                        withdrawConfirming ? 'Confirming…'         : 'Withdraw'

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
          <p className="text-white font-bold text-2xl">{formatUsd(totalDepositedUsd)}</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <p className="text-slate-500 text-xs mb-2 uppercase tracking-wider">Locked</p>
          <p className="text-white font-bold text-2xl">{formatUsd(totalLockedUsd)}</p>
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
          <div className="mt-2"><UtilizationBar bps={Number(utilizationBps)} /></div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <p className="text-slate-500 text-xs mb-2 uppercase tracking-wider">APY Estimate</p>
          <p className="text-emerald-400 font-bold text-2xl">{apyEstimate.toFixed(1)}%</p>
        </div>
      </div>

      {/* Multiplier tiers */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 mb-8">
        <h2 className="text-white font-semibold mb-4">Yield Multiplier Tiers</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {tiers.map((tier) => {
            const active =
              tier.max === 50  ? utilizationPct < 50 :
              tier.max === 70  ? utilizationPct >= 50 && utilizationPct < 70 :
              tier.max === 90  ? utilizationPct >= 70 && utilizationPct < 90 :
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
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Deposit */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 flex flex-col gap-5">
          <div className="flex items-center justify-between">
            <h2 className="text-white font-semibold text-lg">Deposit USDC</h2>
            {isConnected && (
              <span className="text-xs text-slate-500">
                Balance: <span className="text-slate-300">${usdcDisplay}</span>
              </span>
            )}
          </div>

          <div>
            <label className="text-xs text-slate-500 mb-1.5 block">Amount</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">$</span>
              <input
                type="number" min={0} step={10}
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                placeholder="0.00"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-7 pr-20 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-brand-500 transition-colors"
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                {isConnected && usdcBalance !== undefined && (
                  <button
                    onClick={() => setDepositAmount(formatUnits(usdcBalance, USDC_DECIMALS))}
                    className="text-xs text-brand-400 hover:text-brand-300 px-1.5 py-0.5 rounded transition-colors"
                  >
                    Max
                  </button>
                )}
                <span className="text-slate-500 text-xs">USDC</span>
              </div>
            </div>
          </div>

          {depositRaw > 0n && (
            <div className="bg-slate-800/60 rounded-lg p-3 text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-500">Estimated shares</span>
                <span className="text-white font-medium">{estimatedShares}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Share price</span>
                <span className="text-white font-medium">${svNum.toFixed(6)}</span>
              </div>
            </div>
          )}

          <button
            onClick={handleDeposit}
            disabled={!isConnected || !VAULT_ADDRESS || depositRaw === 0n || depositBusy}
            className={cn(
              'w-full py-3 rounded-xl font-semibold text-sm transition-colors mt-auto flex items-center justify-center gap-2',
              isConnected && VAULT_ADDRESS && depositRaw > 0n && !depositBusy
                ? 'bg-brand-500 hover:bg-brand-400 text-black'
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
            <h2 className="text-white font-semibold text-lg">Withdraw</h2>
            {isConnected && (
              <span className="text-xs text-slate-500">
                Shares: <span className="text-slate-300">{sharesDisplay}</span>
              </span>
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
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 pr-16 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-brand-500 transition-colors"
              />
              {isConnected && shareBalance !== undefined && (
                <button
                  onClick={() => setWithdrawAmount(formatUnits(shareBalance, USDC_DECIMALS))}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-brand-400 hover:text-brand-300 px-1.5 py-0.5 rounded transition-colors"
                >
                  Max
                </button>
              )}
            </div>
          </div>

          {parseFloat(withdrawAmount) > 0 && (
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
                <span className="text-white">{isConnected ? sharesDisplay : '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Current value</span>
                <span className="text-white">{isConnected ? formatUsd(positionUsd) : '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Share price</span>
                <span className="text-slate-300">${svNum.toFixed(6)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">APY</span>
                <span className="text-emerald-400">{apyEstimate.toFixed(1)}%</span>
              </div>
            </div>
          </div>

          <button
            onClick={handleWithdraw}
            disabled={!isConnected || !VAULT_ADDRESS || !parseFloat(withdrawAmount) || withdrawBusy}
            className={cn(
              'w-full py-3 rounded-xl font-semibold text-sm transition-colors flex items-center justify-center gap-2',
              isConnected && VAULT_ADDRESS && parseFloat(withdrawAmount) > 0 && !withdrawBusy
                ? 'border border-slate-600 hover:border-slate-400 text-slate-200 hover:text-white'
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
