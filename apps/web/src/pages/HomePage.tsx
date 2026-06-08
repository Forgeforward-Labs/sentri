import { lazy, Suspense } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Shield, Network, Zap } from "lucide-react";
import StatusBadge from "../components/StatusBadge";
import { formatUsd, cn } from "../lib/utils";
import { useProducts, usePoolStats, useAnalytics } from "../lib/useTrackerData";

const AgentNetworkScene = lazy(
  () => import("../components/scene/AgentNetworkScene"),
);

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.12 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } },
};

const steps = [
  {
    num: "01",
    icon: Shield,
    title: "Buy Coverage",
    description:
      "Choose a parametric coverage product. Set your coverage amount and pay the premium. No credit checks, no paperwork.",
  },
  {
    num: "02",
    icon: Network,
    title: "Agents Validate",
    description:
      "Three autonomous agents cross-verify the trigger event: CoinGecko price data, LLM inference, and web/social parsing.",
  },
  {
    num: "03",
    icon: Zap,
    title: "Instant Payout",
    description:
      "When consensus is reached on-chain, your payout executes automatically. No claim form, no human arbitration.",
  },
];

export default function HomePage() {
  const { data: poolStats } = usePoolStats();
  const { data: analytics } = useAnalytics();
  const { data: products, isLoading: productsLoading } = useProducts();

  const tvl = poolStats?.totalDepositedUsd ?? null;
  const positionCount = analytics?.totalPositions ?? null;
  const productCount = analytics?.productStats?.length ?? null;

  const previewProducts = (products ?? []).slice(0, 3);

  return (
    <div className="min-h-screen">
      {/* 3D backdrop */}
      <div className="fixed inset-0 -z-10">
        <Suspense fallback={null}>
          <AgentNetworkScene />
        </Suspense>
      </div>
      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-slate-950/20 via-transparent to-slate-950 pointer-events-none -z-10" />

      {/* Hero */}
      <section className="min-h-screen flex flex-col items-center justify-center text-center px-6 pt-16">
        <motion.div
          variants={stagger}
          initial="hidden"
          animate="show"
          className="flex flex-col items-center gap-6 max-w-3xl"
        >
          <motion.div variants={fadeUp}>
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-brand-400/30 bg-brand-400/10 text-brand-400 text-sm font-medium">
              Somnia Agentathon 2026
            </span>
          </motion.div>

          <motion.h1
            variants={fadeUp}
            className="text-5xl md:text-7xl font-black tracking-tight leading-none"
          >
            <span className="text-white">Trustless Coverage.</span>
            <br />
            <span className="text-brand-400">Verified by Agents.</span>
          </motion.h1>

          <motion.p
            variants={fadeUp}
            className="text-slate-400 text-lg max-w-xl leading-relaxed"
          >
            DeFi insurance powered by a three-agent consensus chain. No claims
            forms. No human arbitration. Your payout executes the moment the
            trigger is confirmed on-chain.
          </motion.p>

          <motion.div
            variants={fadeUp}
            className="flex flex-wrap gap-4 justify-center"
          >
            <Link
              to="/cover"
              className="bg-brand-500 hover:bg-brand-400 text-black font-semibold px-8 py-3.5 rounded-xl transition-colors text-base"
            >
              Get Coverage
            </Link>
            <Link
              to="/earn"
              className="border border-slate-700 hover:border-slate-500 text-slate-200 hover:text-white font-semibold px-8 py-3.5 rounded-xl transition-colors text-base bg-slate-900/60"
            >
              Earn Yield
            </Link>
          </motion.div>
        </motion.div>
      </section>

      {/* Stats bar — live from chain */}
      <section className="bg-slate-900/50 glass border-y border-slate-800">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-slate-800">
            <div className="flex flex-col items-center py-4 md:py-0">
              <span className="text-white font-bold text-2xl">
                {tvl !== null ? formatUsd(tvl) : "—"}
              </span>
              <span className="text-slate-500 text-sm mt-1">
                Total Value Locked
              </span>
            </div>
            <div className="flex flex-col items-center py-4 md:py-0">
              <span className="text-white font-bold text-2xl">
                {positionCount !== null ? positionCount?.toString() : "—"}
              </span>
              <span className="text-slate-500 text-sm mt-1">
                Positions Created
              </span>
            </div>
            <div className="flex flex-col items-center py-4 md:py-0">
              <span className="text-white font-bold text-2xl">
                {productCount !== null ? productCount?.toString() : "—"}
              </span>
              <span className="text-slate-500 text-sm mt-1">
                Coverage Products
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="max-w-7xl mx-auto px-6 py-24">
        <div className="text-center mb-14">
          <h2 className="text-3xl font-bold text-white mb-3">How It Works</h2>
          <p className="text-slate-400 max-w-lg mx-auto">
            From purchase to payout in seconds — fully autonomous.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {steps.map((step) => {
            const Icon = step.icon;
            return (
              <div
                key={step.num}
                className="bg-slate-900 border border-slate-800 rounded-2xl p-8 flex flex-col gap-4"
              >
                <div className="flex items-center gap-3">
                  <span className="font-mono text-brand-400/60 text-sm font-bold">
                    {step.num}
                  </span>
                  <div className="w-10 h-10 rounded-xl bg-brand-500/10 flex items-center justify-center">
                    <Icon className="w-5 h-5 text-brand-400" />
                  </div>
                </div>
                <h3 className="text-white font-semibold text-lg">
                  {step.title}
                </h3>
                <p className="text-slate-400 text-sm leading-relaxed">
                  {step.description}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Products preview — live from chain */}
      <section className="max-w-7xl mx-auto px-6 pb-24">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-bold text-white">
            Available Coverage Products
          </h2>
          <Link
            to="/cover"
            className="text-brand-400 hover:text-brand-300 text-sm font-medium transition-colors"
          >
            View all →
          </Link>
        </div>

        {productsLoading && previewProducts.length === 0 ? (
          <div className="text-center py-16 text-slate-500 text-sm">
            Loading products…
          </div>
        ) : !productsLoading && previewProducts.length === 0 ? (
          <div className="text-center py-16 text-slate-500 text-sm">
            No products deployed yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {previewProducts.map((product) => {
              const utilPct =
                product.poolLimitUsd > 0
                  ? Math.round(
                      (product.totalCommittedUsd / product.poolLimitUsd) * 100,
                    )
                  : 0;
              return (
                <div
                  key={product.id}
                  className="bg-slate-900 border border-slate-800 rounded-xl p-6 flex flex-col gap-4"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-white font-semibold">{product.name}</h3>
                    <StatusBadge status={product.healthStatus} />
                  </div>
                  <span
                    className={cn(
                      "text-xs font-medium uppercase tracking-wider",
                      product.triggerType === "DEPEG"
                        ? "text-brand-400"
                        : "text-amber-400",
                    )}
                  >
                    {product.triggerType === "DEPEG"
                      ? "Depeg Insurance"
                      : "Rug Pull Protection"}
                  </span>
                  <div className="grid grid-cols-2 gap-y-2 text-sm">
                    <span className="text-slate-500">Max Coverage</span>
                    <span className="text-slate-200 text-right">
                      {formatUsd(product.maxPerPositionUsd)}
                    </span>
                    <span className="text-slate-500">Premium Rate</span>
                    <span className="text-slate-200 text-right">
                      {(product.premiumRateBps / 100).toFixed(2)}%
                    </span>
                    <span className="text-slate-500">Duration</span>
                    <span className="text-slate-200 text-right">
                      {product.durationHours
                        ? `${product.durationHours}h`
                        : "Open-ended"}
                    </span>
                  </div>
                  <div>
                    <div className="flex justify-between text-xs text-slate-500 mb-1">
                      <span>Pool Utilization</span>
                      <span>{utilPct}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-brand-500 rounded-full transition-all"
                        style={{ width: `${utilPct}%` }}
                      />
                    </div>
                  </div>
                  <Link
                    to="/cover"
                    className="mt-2 text-center text-sm font-medium text-brand-400 hover:text-brand-300 transition-colors"
                  >
                    Get covered →
                  </Link>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
