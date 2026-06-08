import { useState } from "react";
import type { Product } from "@sentri/shared-types";
import {
  useAccount,
  useWriteContract,
  useWaitForTransactionReceipt,
  useReadContract,
} from "wagmi";
import { parseUnits, formatUnits } from "viem";
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
      <div className="w-full py-3 rounded-xl font-semibold text-sm text-center bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
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
        "w-full py-3 rounded-xl font-semibold text-sm transition-colors mt-1",
        !disabled && parsedAmount > 0 && !loading
          ? "bg-brand-500 hover:bg-brand-400 text-black"
          : "bg-slate-800 text-slate-500 cursor-not-allowed",
      )}
    >
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
  const vaultAvailableUsd =
    availLiqRaw !== undefined
      ? Number(formatUnits(availLiqRaw as bigint, USDC_DECIMALS))
      : null;

  const parsedAmount = parseFloat(amount) || 0;

  // Mirror InsuranceCore.calculatePremium exactly:
  // 1. base = amount × premiumRateBps / 10_000
  // 2. if duration > 1 day, multiply by (duration / 1 day)
  // 3. minimum $1
  const durationMultiplier =
    product.durationHours && product.durationHours > 24
      ? product.durationHours / 24
      : 1;
  const rawPremium =
    ((product.premiumRateBps * parsedAmount) / 10000) * durationMultiplier;
  const premium = Math.max(rawPremium, parsedAmount > 0 ? 1 : 0);

  const utilPct = product.totalCommittedUsd / product.poolLimitUsd;
  const multiplier =
    utilPct > 0.9 ? 3 : utilPct > 0.7 ? 2 : utilPct > 0.5 ? 1.5 : 1;

  const exceedsVault =
    vaultAvailableUsd !== null && parsedAmount > vaultAvailableUsd;
  const exceedsMax = parsedAmount > product.maxPerPositionUsd;

  return (
    <div className="space-y-3">
      <div>
        <label className="text-xs text-slate-500 mb-1.5 block">
          Coverage Amount (USD)
        </label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">
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
            className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-7 pr-4 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-brand-500 transition-colors"
          />
        </div>
        {exceedsMax && (
          <p className="text-red-400 text-xs mt-1">
            Max per position: {formatUsd(product.maxPerPositionUsd)}
          </p>
        )}
        {!exceedsMax && exceedsVault && (
          <p className="text-amber-400 text-xs mt-1">
            Vault only has {formatUsd(vaultAvailableUsd!)} available — deposit
            more via Earn
          </p>
        )}
      </div>

      {parsedAmount > 0 && (
        <div className="bg-slate-800/60 rounded-lg p-3 space-y-1.5 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-500">Premium</span>
            <span className="text-white font-medium">
              ${premium.toFixed(2)} USDC
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Utilization multiplier</span>
            <span
              className={cn(
                "font-medium",
                multiplier === 1
                  ? "text-emerald-400"
                  : multiplier === 1.5
                    ? "text-amber-400"
                    : multiplier === 2
                      ? "text-orange-400"
                      : "text-red-400",
              )}
            >
              {multiplier}x
            </span>
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
    <div className="max-w-7xl mx-auto px-6 py-12 min-h-screen">
      <div className="mb-10">
        <h1 className="text-4xl font-black text-white mb-3">Get Coverage</h1>
        <p className="text-slate-400 text-lg max-w-xl">
          Parametric protection against depeg events and rug pulls. Pay a
          premium, get covered — instantly.
        </p>
      </div>

      <div className="flex gap-1 p-1 bg-slate-900 border border-slate-800 rounded-xl w-fit mb-8">
        {(["DEPEG", "RUG"] as TabType[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "px-5 py-2 rounded-lg text-sm font-medium transition-all",
              activeTab === tab
                ? "bg-brand-500 text-black shadow"
                : "text-slate-400 hover:text-slate-200",
            )}
          >
            {tab === "DEPEG" ? "Depeg Insurance" : "Rug Pull Protection"}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {filteredProducts.map((product) => {
          const utilPct = Math.round(
            (product.totalCommittedUsd / product.poolLimitUsd) * 100,
          );
          return (
            <div
              key={product.id}
              className="bg-slate-900 border border-slate-800 rounded-xl p-6 flex flex-col gap-5"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-medium text-brand-400 uppercase tracking-wider mb-1">
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

              <div className="grid grid-cols-3 gap-3">
                <div className="bg-slate-800/60 rounded-lg p-3">
                  <p className="text-slate-500 text-xs mb-1">Max Coverage</p>
                  <p className="text-white font-semibold text-sm">
                    {formatUsd(product.maxPerPositionUsd)}
                  </p>
                </div>
                <div className="bg-slate-800/60 rounded-lg p-3">
                  <p className="text-slate-500 text-xs mb-1">Premium Rate</p>
                  <p className="text-white font-semibold text-sm">
                    {(product.premiumRateBps / 100).toFixed(2)}%
                  </p>
                </div>
                <div className="bg-slate-800/60 rounded-lg p-3">
                  <p className="text-slate-500 text-xs mb-1">Duration</p>
                  <p className="text-white font-semibold text-sm">
                    {product.durationHours
                      ? `${product.durationHours}h`
                      : "Open-ended"}
                  </p>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs text-slate-500 mb-1.5">
                  <span>Pool Utilization</span>
                  <span>{utilPct}%</span>
                </div>
                <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all",
                      utilPct < 50
                        ? "bg-emerald-500"
                        : utilPct < 70
                          ? "bg-amber-500"
                          : utilPct < 90
                            ? "bg-orange-500"
                            : "bg-red-500",
                    )}
                    style={{ width: `${utilPct}%` }}
                  />
                </div>
                <p className="text-slate-600 text-xs mt-1">
                  {formatUsd(product.totalCommittedUsd)} committed of{" "}
                  {formatUsd(product.poolLimitUsd)} limit
                </p>
              </div>

              <PremiumCalculator product={product} />
            </div>
          );
        })}

        {isLoading && filteredProducts.length === 0 && (
          <div className="col-span-2 text-center py-16 text-slate-500 text-sm">
            Loading products…
          </div>
        )}
        {!isLoading && filteredProducts.length === 0 && (
          <div className="col-span-2 text-center py-16 text-slate-500">
            No {activeTab === "DEPEG" ? "depeg" : "rug pull"} products
            available.
          </div>
        )}
      </div>
    </div>
  );
}
