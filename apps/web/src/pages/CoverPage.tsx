import { useState } from "react";
import type { DepegParams, Product } from "@sentri/shared-types";
import {
  useAccount,
  useWriteContract,
  useWaitForTransactionReceipt,
  useReadContract,
} from "wagmi";
import { parseUnits, formatUnits } from "viem";
import { CheckCircle2, Info } from "lucide-react";
import StatusBadge from "../components/StatusBadge";
import { formatUsd, cn } from "../lib/utils";
import {
  CORE_ADDRESS,
  VAULT_ADDRESS,
  USDC_DECIMALS,
  INSURANCE_CORE_ABI,
  POLICY_VAULT_ABI,
} from "../lib/contracts";
import { useProducts } from "../lib/useTrackerData";

type TabType = "DEPEG" | "RUG";

// ─────────────────────────────────────────────────────────────────

function BuyCoverageButton({
  product,
  coverageAmount,
  disabled,
}: {
  product: Product;
  coverageAmount: string;
  disabled: boolean;
}) {
  const parsedAmount = parseFloat(coverageAmount) || 0;
  const amountRaw = parseUnits(parsedAmount?.toString(), USDC_DECIMALS);

  const {
    writeContract: buy,
    data: buyTxHash,
    isPending: buying,
  } = useWriteContract();
  const { isLoading: confirming, isSuccess } = useWaitForTransactionReceipt({
    hash: buyTxHash,
  });

  function handleClick() {
    if (!CORE_ADDRESS) return;
    buy({
      address: CORE_ADDRESS,
      abi: INSURANCE_CORE_ABI,
      functionName: "buyPosition",
      args: [BigInt(product.id), amountRaw],
    });
  }

  if (isSuccess) {
    return (
      <div className="w-full py-3 rounded-xl font-semibold text-sm text-center bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 flex items-center justify-center gap-2">
        <CheckCircle2 className="w-4 h-4" />
        Coverage purchased!
      </div>
    );
  }

  const loading = buying || confirming;
  const label = loading
    ? confirming
      ? "Confirming…"
      : "Buying…"
    : "Buy Coverage";

  return (
    <button
      onClick={handleClick}
      disabled={disabled || loading || parsedAmount === 0}
      className={cn(
        "w-full py-3 rounded-xl font-semibold text-sm transition-all mt-1 flex items-center justify-center gap-2",
        !disabled && parsedAmount > 0 && !loading
          ? "bg-brand-500 hover:bg-brand-400 text-black glow-brand hover:scale-[1.01] active:scale-[0.99]"
          : "bg-slate-800 text-slate-500 cursor-not-allowed",
      )}
    >
      {loading && (
        <span className="w-3.5 h-3.5 border-2 border-current/30 border-t-current rounded-full animate-spin" />
      )}
      {label}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────

function PremiumCalculator({ product }: { product: Product }) {
  const [amount, setAmount] = useState("");
  const { isConnected } = useAccount();

  const { data: availLiqRaw } = useReadContract({
    address: VAULT_ADDRESS,
    abi: POLICY_VAULT_ABI,
    functionName: "availableLiquidity",
    query: { enabled: !!VAULT_ADDRESS, refetchInterval: 15_000 },
  });
  const { data: multiplierBpsRaw } = useReadContract({
    address: VAULT_ADDRESS,
    abi: POLICY_VAULT_ABI,
    functionName: "utilizationMultiplierBps",
    query: { enabled: !!VAULT_ADDRESS, refetchInterval: 15_000 },
  });

  const vaultAvailableUsd =
    availLiqRaw !== undefined
      ? Number(formatUnits(availLiqRaw as bigint, USDC_DECIMALS))
      : null;
  const multiplier = multiplierBpsRaw !== undefined ? Number(multiplierBpsRaw) / 10000 : 1;

  const parsedAmount = parseFloat(amount) || 0;
  const durationYears = (product.durationHours ?? 0) / (365 * 24);
  const rawPremium = (product.premiumRateBps * parsedAmount * durationYears * multiplier) / 10000;
  const premium = Math.max(rawPremium, parsedAmount > 0 ? 1 : 0);

  const isDepeg = product.triggerType === "DEPEG";
  const threshold = isDepeg
    ? (product.triggerParams as DepegParams).threshold
    : null;

  const depegScenarios = threshold
    ? [
        { price: +(threshold - 0.02).toFixed(2), label: "Minor" },
        { price: +(threshold - 0.07).toFixed(2), label: "Moderate" },
        { price: +(threshold - 0.15).toFixed(2), label: "Severe" },
      ].map(({ price, label }) => ({
        price,
        label,
        payout: parsedAmount > 0 ? (parsedAmount * (threshold - price)) / threshold : 0,
        pct: ((threshold - price) / threshold) * 100,
      }))
    : [];

  const exceedsVault = vaultAvailableUsd !== null && parsedAmount > vaultAvailableUsd;
  const exceedsMax = parsedAmount > product.maxPerPositionUsd;

  return (
    <div className="space-y-3 pt-2 border-t border-slate-800">
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
        Calculate Premium
      </p>
      <div>
        <label className="text-xs text-slate-500 mb-1.5 block">
          Coverage Amount (USDC)
        </label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm select-none">
            $
          </span>
          <input
            type="number"
            min={0}
            max={product.maxPerPositionUsd}
            step={10}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Enter amount"
            className="input-base pl-7 pr-4 py-2.5"
          />
        </div>
        {exceedsMax && (
          <p className="text-red-400 text-xs mt-1 flex items-center gap-1">
            <Info className="w-3 h-3" />
            Max per position: {formatUsd(product.maxPerPositionUsd)}
          </p>
        )}
        {!exceedsMax && exceedsVault && (
          <p className="text-amber-400 text-xs mt-1 flex items-center gap-1">
            <Info className="w-3 h-3" />
            Only {formatUsd(vaultAvailableUsd!)} available in vault
          </p>
        )}
      </div>

      {parsedAmount > 0 && (
        <div className="bg-slate-800/50 rounded-xl p-3.5 space-y-3 text-sm border border-slate-700/40">
          <div className="flex justify-between items-center">
            <span className="text-slate-400">Premium</span>
            <span className="text-white font-semibold">
              ${premium.toFixed(2)} USDC
              {multiplier > 1 && (
                <span className="text-amber-400 text-xs ml-1.5 font-normal">
                  ({multiplier}× util)
                </span>
              )}
            </span>
          </div>

          <div className="border-t border-slate-700/50 pt-2.5">
            {isDepeg ? (
              <>
                <p className="text-slate-500 text-xs mb-2 leading-relaxed">
                  Proportional payout — scales with depeg depth
                </p>
                {depegScenarios.map(({ price, label, payout, pct }) => (
                  <div key={price} className="flex justify-between text-xs py-1">
                    <span className="text-slate-400">
                      {label} — USDC at ${price.toFixed(2)}
                    </span>
                    <span className="text-amber-400 font-medium tabular-nums">
                      ${payout.toFixed(2)}{" "}
                      <span className="text-slate-600">({pct.toFixed(1)}%)</span>
                    </span>
                  </div>
                ))}
              </>
            ) : (
              <>
                <p className="text-slate-500 text-xs mb-2">
                  Full payout on rug trigger (2-agent consensus)
                </p>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Pool liquidity drops ≤50%</span>
                  <span className="text-emerald-400 font-medium tabular-nums">
                    ${parsedAmount.toFixed(2)}{" "}
                    <span className="text-slate-600">(100%)</span>
                  </span>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <BuyCoverageButton
        product={product}
        coverageAmount={amount}
        disabled={!isConnected || !CORE_ADDRESS || exceedsVault || exceedsMax}
      />

      {!CORE_ADDRESS && (
        <p className="text-xs text-slate-600 text-center">
          Contract not deployed yet
        </p>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────

export default function CoverPage() {
  const [activeTab, setActiveTab] = useState<TabType>("DEPEG");
  const { data: products, isLoading } = useProducts();

  const filteredProducts = (products ?? []).filter((p) => p.triggerType === activeTab);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12 min-h-screen">
      <div className="mb-8 sm:mb-10">
        <p className="text-brand-400 text-sm font-medium uppercase tracking-wider mb-2">
          Coverage
        </p>
        <h1 className="text-3xl sm:text-4xl font-black text-white mb-3">Get Coverage</h1>
        <p className="text-slate-400 text-base sm:text-lg max-w-xl">
          Parametric protection against depeg events and rug pulls. Pay a
          premium, get covered — no underwriting, no delays.
        </p>
      </div>

      {/* Tab bar — full width on mobile */}
      <div className="flex gap-1 p-1 bg-slate-900 border border-slate-800 rounded-xl mb-6 sm:mb-8">
        {(["DEPEG", "RUG"] as TabType[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "flex-1 px-3 sm:px-6 py-2.5 rounded-lg text-sm font-medium transition-all",
              activeTab === tab
                ? "bg-brand-500 text-black shadow-lg"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60",
            )}
          >
            {tab === "DEPEG" ? "Depeg Insurance" : "Rug Pull Protection"}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6">
        {filteredProducts.map((product) => {
          const utilPct = product.poolLimitUsd > 0
            ? Math.round((product.totalCommittedUsd / product.poolLimitUsd) * 100)
            : 0;
          const utilColor =
            utilPct < 50 ? "bg-emerald-500" :
            utilPct < 70 ? "bg-amber-500" :
            utilPct < 90 ? "bg-orange-500" : "bg-red-500";
          const utilTextColor =
            utilPct < 50 ? "text-emerald-400" :
            utilPct < 70 ? "text-amber-400" :
            utilPct < 90 ? "text-orange-400" : "text-red-400";

          return (
            <div
              key={product.id}
              className="bg-slate-900 border border-slate-800 rounded-xl p-6 flex flex-col gap-5 card-hover"
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className={cn(
                    "text-[10px] font-semibold uppercase tracking-widest mb-1.5",
                    product.triggerType === "DEPEG" ? "text-brand-400" : "text-amber-400"
                  )}>
                    {product.triggerType === "DEPEG"
                      ? "Depeg Insurance"
                      : "Rug Pull Protection"}
                  </p>
                  <h3 className="text-white font-semibold text-lg">
                    {product.name}
                  </h3>
                </div>
                <StatusBadge status={product.healthStatus} />
              </div>

              {/* Stats grid */}
              <div className="grid grid-cols-3 gap-2.5">
                <div className="bg-slate-800/60 rounded-lg p-3">
                  <p className="text-slate-500 text-[10px] mb-1 uppercase tracking-wider">Max Cover</p>
                  <p className="text-white font-semibold text-sm">
                    {formatUsd(product.maxPerPositionUsd)}
                  </p>
                </div>
                <div className="bg-slate-800/60 rounded-lg p-3">
                  <p className="text-slate-500 text-[10px] mb-1 uppercase tracking-wider">Annual Rate</p>
                  <p className="text-white font-semibold text-sm">
                    {(product.premiumRateBps / 100).toFixed(2)}%
                  </p>
                </div>
                <div className="bg-slate-800/60 rounded-lg p-3">
                  <p className="text-slate-500 text-[10px] mb-1 uppercase tracking-wider">Duration</p>
                  <p className="text-white font-semibold text-sm">
                    {product.durationHours
                      ? product.durationHours % 24 === 0
                        ? `${product.durationHours / 24}d`
                        : `${product.durationHours}h`
                      : "Open-ended"}
                  </p>
                </div>
              </div>

              {/* Pool utilization */}
              <div>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="text-slate-500">Pool Utilization</span>
                  <span className={utilTextColor}>{utilPct}%</span>
                </div>
                <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className={cn("h-full rounded-full transition-all", utilColor)}
                    style={{ width: `${utilPct}%` }}
                  />
                </div>
                <p className="text-slate-600 text-xs mt-1.5">
                  {formatUsd(product.totalCommittedUsd)} committed of{" "}
                  {formatUsd(product.poolLimitUsd)} limit
                </p>
              </div>

              <PremiumCalculator product={product} />
            </div>
          );
        })}

        {isLoading && filteredProducts.length === 0 && (
          <>
            {[1, 2].map((i) => (
              <div key={i} className="bg-slate-900 border border-slate-800 rounded-xl p-6 h-72 animate-pulse" />
            ))}
          </>
        )}
        {!isLoading && filteredProducts.length === 0 && (
          <div className="col-span-2 text-center py-16 sm:py-20 text-slate-500 border border-slate-800/50 rounded-xl bg-slate-900/30">
            <p className="text-base sm:text-lg mb-1">No products available</p>
            <p className="text-sm text-slate-600">
              No {activeTab === "DEPEG" ? "depeg" : "rug pull"} products deployed yet.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
