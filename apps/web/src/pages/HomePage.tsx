import { lazy, Suspense } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Shield, Network, Zap, TrendingUp, Users, Package } from "lucide-react";
import StatusBadge from "../components/StatusBadge";
import { formatUsd, cn } from "../lib/utils";
import { useProducts, usePoolStats, useAnalytics } from "../lib/useTrackerData";

const AgentNetworkScene = lazy(
  () => import("../components/scene/AgentNetworkScene"),
);

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.1 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: "easeOut" } },
};

const steps = [
  {
    num: "01",
    icon: Shield,
    title: "Buy Coverage",
    description:
      "Choose a parametric product, set your amount, pay the premium. No credit checks, no paperwork — coverage is live on-chain instantly.",
  },
  {
    num: "02",
    icon: Network,
    title: "Agents Validate",
    description:
      "Autonomous Somnia agents cross-verify the trigger: on-chain price data, LLM plausibility check, and news confirmation. Rug events settle in 2 steps; depeg events require all 3.",
  },
  {
    num: "03",
    icon: Zap,
    title: "Instant Payout",
    description:
      "When agent consensus is reached on-chain, your payout executes automatically. No claim form, no adjuster, no waiting period.",
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
      <div className="absolute inset-0 bg-gradient-to-b from-slate-950/10 via-transparent to-slate-950 pointer-events-none -z-10" />

      {/* Hero */}
      <section className="min-h-screen flex flex-col items-center justify-center text-center px-4 sm:px-6 pt-16">
        <motion.div
          variants={stagger}
          initial="hidden"
          animate="show"
          className="flex flex-col items-center gap-7 max-w-3xl"
        >
          <motion.div variants={fadeUp}>
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-brand-400/30 bg-brand-400/10 text-brand-400 text-sm font-medium">
              Somnia Agentathon 2026
            </span>
          </motion.div>

          <motion.h1
            variants={fadeUp}
            className="text-4xl sm:text-5xl md:text-7xl font-black tracking-tight leading-[1.05]"
          >
            <span className="text-white">Trustless Coverage.</span>
            <br />
            <span className="text-gradient">Verified by Agents.</span>
          </motion.h1>

          <motion.p
            variants={fadeUp}
            className="text-slate-400 text-lg max-w-lg leading-relaxed"
          >
            DeFi insurance powered by a three-agent consensus chain. No claim
            forms. No human arbitration. Your payout executes the moment the
            trigger is confirmed on-chain.
          </motion.p>

          <motion.div
            variants={fadeUp}
            className="flex flex-wrap gap-3 justify-center"
          >
            <Link
              to="/cover"
              className="bg-brand-500 hover:bg-brand-400 text-black font-semibold px-8 py-3.5 rounded-xl transition-all glow-brand text-base hover:scale-[1.02] active:scale-[0.98]"
            >
              Get Coverage
            </Link>
            <Link
              to="/earn"
              className="border border-slate-700 hover:border-slate-500 text-slate-200 hover:text-white font-semibold px-8 py-3.5 rounded-xl transition-all text-base bg-slate-900/60 hover:bg-slate-800/80"
            >
              Earn Yield
            </Link>
          </motion.div>

          <motion.p variants={fadeUp} className="text-slate-700 text-xs tracking-widest uppercase">
            Powered by{" "}
            <span className="text-slate-500 font-medium">Somnia Agents</span>
            {" "}·{" "}Autonomous{" "}·{" "}On-chain{" "}·{" "}Trustless
          </motion.p>
        </motion.div>
      </section>

      {/* Stats bar */}
      <section className="bg-slate-900/60 glass border-y border-slate-800/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
          <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-slate-800">
            <div className="flex flex-col items-center py-5 md:py-0 gap-1 group">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="w-4 h-4 text-brand-400/60 group-hover:text-brand-400 transition-colors" />
                <span className="text-slate-500 text-xs uppercase tracking-wider">Total Value Locked</span>
              </div>
              <span className="text-white font-black text-3xl tabular-nums">
                {tvl !== null ? formatUsd(tvl) : "—"}
              </span>
            </div>
            <div className="flex flex-col items-center py-5 md:py-0 gap-1 group">
              <div className="flex items-center gap-2 mb-1">
                <Users className="w-4 h-4 text-brand-400/60 group-hover:text-brand-400 transition-colors" />
                <span className="text-slate-500 text-xs uppercase tracking-wider">Positions Created</span>
              </div>
              <span className="text-white font-black text-3xl tabular-nums">
                {positionCount !== null ? positionCount.toString() : "—"}
              </span>
            </div>
            <div className="flex flex-col items-center py-5 md:py-0 gap-1 group">
              <div className="flex items-center gap-2 mb-1">
                <Package className="w-4 h-4 text-brand-400/60 group-hover:text-brand-400 transition-colors" />
                <span className="text-slate-500 text-xs uppercase tracking-wider">Coverage Products</span>
              </div>
              <span className="text-white font-black text-3xl tabular-nums">
                {productCount !== null ? productCount.toString() : "—"}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-16 sm:py-24">
        <div className="text-center mb-10 sm:mb-14">
          <h2 className="text-2xl sm:text-3xl font-black text-white mb-3">How It Works</h2>
          <p className="text-slate-400 max-w-md mx-auto">
            From purchase to payout in seconds — fully autonomous.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {steps.map((step, i) => {
            const Icon = step.icon;
            return (
              <motion.div
                key={step.num}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.1 }}
                className="bg-slate-900/80 border border-slate-800 rounded-2xl p-8 flex flex-col gap-4 card-hover"
              >
                <div className="flex items-center gap-3">
                  <span className="font-mono text-brand-400/50 text-sm font-bold tracking-wider">
                    {step.num}
                  </span>
                  <div className="w-10 h-10 rounded-xl bg-brand-500/10 border border-brand-500/10 flex items-center justify-center">
                    <Icon className="w-5 h-5 text-brand-400" />
                  </div>
                </div>
                <h3 className="text-white font-semibold text-lg">
                  {step.title}
                </h3>
                <p className="text-slate-400 text-sm leading-relaxed">
                  {step.description}
                </p>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* Products preview */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 pb-16 sm:pb-24">
        <div className="flex items-center justify-between mb-6 sm:mb-8">
          <h2 className="text-xl sm:text-2xl font-bold text-white">
            Available Coverage Products
          </h2>
          <Link
            to="/cover"
            className="text-brand-400 hover:text-brand-300 text-sm font-medium transition-colors flex items-center gap-1"
          >
            View all →
          </Link>
        </div>

        {productsLoading && previewProducts.length === 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-slate-900 border border-slate-800 rounded-xl p-6 h-64 animate-pulse" />
            ))}
          </div>
        ) : !productsLoading && previewProducts.length === 0 ? (
          <div className="text-center py-16 text-slate-500 text-sm border border-slate-800/60 rounded-xl bg-slate-900/40">
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
                  className="bg-slate-900/80 border border-slate-800 rounded-xl p-6 flex flex-col gap-4 card-hover group"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span
                        className={cn(
                          "text-[10px] font-semibold uppercase tracking-widest mb-1.5 block",
                          product.triggerType === "DEPEG"
                            ? "text-brand-400"
                            : "text-amber-400",
                        )}
                      >
                        {product.triggerType === "DEPEG"
                          ? "Depeg Insurance"
                          : "Rug Pull Protection"}
                      </span>
                      <h3 className="text-white font-semibold">{product.name}</h3>
                    </div>
                    <StatusBadge status={product.healthStatus} />
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { label: "Max Coverage", value: formatUsd(product.maxPerPositionUsd) },
                      { label: "Annual Rate",  value: `${(product.premiumRateBps / 100).toFixed(2)}%` },
                      {
                        label: "Duration",
                        value: product.durationHours
                          ? product.durationHours % 24 === 0
                            ? `${product.durationHours / 24}d`
                            : `${product.durationHours}h`
                          : "Open",
                      },
                    ].map(({ label, value }) => (
                      <div key={label} className="bg-slate-800/60 rounded-lg p-2.5">
                        <p className="text-slate-500 text-[10px] mb-0.5">{label}</p>
                        <p className="text-slate-200 font-semibold text-xs">{value}</p>
                      </div>
                    ))}
                  </div>

                  <div>
                    <div className="flex justify-between text-xs text-slate-500 mb-1.5">
                      <span>Pool Utilization</span>
                      <span className={cn(
                        "font-medium",
                        utilPct < 50 ? "text-emerald-400" :
                        utilPct < 80 ? "text-amber-400" : "text-red-400"
                      )}>{utilPct}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all",
                          utilPct < 50 ? "bg-emerald-500" :
                          utilPct < 80 ? "bg-amber-500" : "bg-red-500"
                        )}
                        style={{ width: `${utilPct}%` }}
                      />
                    </div>
                  </div>

                  <Link
                    to="/cover"
                    className="mt-auto text-center text-sm font-medium text-brand-400 hover:text-brand-300 transition-colors py-2 rounded-lg hover:bg-brand-500/5"
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
