import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAccount } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import {
  AlertTriangle,
  ChevronDown,
  Copy,
  Check,
  Menu,
  X,
  ExternalLink,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "../lib/utils";
import { OWNER_ADDRESS } from "../lib/contracts";

const navLinks = [
  { label: "Cover", to: "/cover" },
  { label: "Earn", to: "/earn" },
  { label: "Positions", to: "/dashboard" },
  { label: "Analytics", to: "/analytics" },
];

// ── Gradient avatar ───────────────────────────────────────────────────────────

function AddressAvatar({
  address,
  size = 5,
}: {
  address: string;
  size?: number;
}) {
  const h1 = parseInt(address.slice(2, 6), 16) % 360;
  const h2 = (h1 + 60) % 360;
  return (
    <div
      className={cn(
        "rounded-full shrink-0 ring-1 ring-white/10",
        `w-${size} h-${size}`,
      )}
      style={{
        background: `linear-gradient(135deg, hsl(${h1},80%,60%), hsl(${h2},80%,50%))`,
      }}
    />
  );
}

// ── Copy address ──────────────────────────────────────────────────────────────

function CopyAddress({ address }: { address: string }) {
  const [copied, setCopied] = useState(false);
  function handleCopy(e: React.MouseEvent) {
    e.stopPropagation();
    void navigator.clipboard.writeText(address).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }
  return (
    <button
      onClick={handleCopy}
      className="p-1.5 rounded-lg text-slate-600 hover:text-slate-400 hover:bg-slate-800 transition-colors"
      title="Copy full address"
    >
      {copied ? (
        <Check className="w-3.5 h-3.5 text-emerald-400" />
      ) : (
        <Copy className="w-3.5 h-3.5" />
      )}
    </button>
  );
}

// ── Desktop wallet button ─────────────────────────────────────────────────────

function WalletButton({ compact = false }: { compact?: boolean }) {
  return (
    <ConnectButton.Custom>
      {({
        account,
        chain,
        openAccountModal,
        openChainModal,
        openConnectModal,
        mounted,
      }) => {
        if (!mounted) return null;
        const connected = account && chain;

        if (!connected) {
          return (
            <button
              onClick={openConnectModal}
              className={cn(
                "bg-brand-500 hover:bg-brand-400 active:scale-[0.97] text-black font-semibold transition-all glow-brand",
                compact
                  ? "text-xs px-3 py-1.5 rounded-lg"
                  : "text-sm px-4 py-2 rounded-lg",
              )}
            >
              Connect Wallet
            </button>
          );
        }

        if (chain.unsupported) {
          return (
            <button
              onClick={openChainModal}
              className="flex items-center gap-1.5 bg-red-500/10 hover:bg-red-500/15 border border-red-500/30 text-red-400 font-semibold text-sm px-3 py-2 rounded-lg transition-all"
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              {!compact && "Wrong Network"}
            </button>
          );
        }

        return (
          <div className="lg:flex items-center gap-1.5 hidden">
            {/* Chain pill — desktop only */}
            {!compact && (
              <button
                onClick={openChainModal}
                className="hidden sm:flex items-center gap-1.5 bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/60 text-slate-400 hover:text-slate-300 text-xs font-medium px-2.5 py-1.5 rounded-lg transition-all"
                title="Switch network"
              >
                {chain.hasIcon && chain.iconUrl ? (
                  <img
                    src={chain.iconUrl}
                    alt={chain.name}
                    className="w-3.5 h-3.5 rounded-full"
                  />
                ) : (
                  <div className="w-3.5 h-3.5 rounded-full bg-brand-400/30" />
                )}
                <span className="max-w-[80px] truncate">{chain.name}</span>
              </button>
            )}

            {/* Account button */}
            <button
              onClick={openAccountModal}
              className={cn(
                "group flex items-center gap-2 bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/60 hover:border-slate-600/80 text-slate-200 font-medium transition-all",
                compact
                  ? "text-xs px-2.5 py-1.5 rounded-lg"
                  : "text-sm px-3 py-1.5 rounded-lg",
              )}
            >
              {account.ensAvatar ? (
                <img
                  src={account.ensAvatar}
                  alt={account.displayName}
                  className="w-5 h-5 rounded-full ring-1 ring-white/10"
                />
              ) : (
                <AddressAvatar address={account.address} />
              )}
              <span className="font-mono text-xs tracking-wide">
                {account.ensName ?? account.displayName}
              </span>

              <ChevronDown className="w-3 h-3 text-slate-500 group-hover:text-slate-400 transition-colors" />
            </button>
          </div>
        );
      }}
    </ConnectButton.Custom>
  );
}

// ── Mobile menu ───────────────────────────────────────────────────────────────

function MobileMenu({
  open,
  pathname,
  isOwner,
  onClose,
}: {
  open: boolean;
  pathname: string;
  isOwner: boolean;
  onClose: () => void;
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="mobile-menu"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
          className="lg:hidden absolute top-full inset-x-0 border-t border-slate-800/60 bg-slate-950 backdrop-blur-xl shadow-2xl shadow-black/80 max-h-[calc(100vh-4rem)] overflow-y-auto"
        >
          {/* Nav links */}
          <div className="px-4 pt-3 pb-2 space-y-0.5">
            {navLinks.map((link) => {
              const active = pathname === link.to;
              return (
                <Link
                  key={link.to}
                  to={link.to}
                  onClick={onClose}
                  className={cn(
                    "flex items-center justify-between px-3 py-3.5 rounded-xl text-sm font-medium transition-all",
                    active
                      ? "bg-brand-500/10 text-brand-400"
                      : "text-slate-400 hover:text-slate-100 hover:bg-slate-800/70",
                  )}
                >
                  {link.label}
                  {active && (
                    <span className="w-1.5 h-1.5 rounded-full bg-brand-400" />
                  )}
                </Link>
              );
            })}
            {isOwner && (
              <Link
                to="/admin"
                onClick={onClose}
                className={cn(
                  "flex items-center justify-between px-3 py-3.5 rounded-xl text-sm font-medium transition-all",
                  pathname === "/admin"
                    ? "bg-amber-500/10 text-amber-400"
                    : "text-amber-600/70 hover:text-amber-400 hover:bg-amber-500/5",
                )}
              >
                Admin
                {pathname === "/admin" && (
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                )}
              </Link>
            )}
          </div>

          {/* Divider */}
          <div className="mx-4 border-t border-slate-800/60" />

          {/* Wallet + chain info */}
          <ConnectButton.Custom>
            {({
              account,
              chain,
              openAccountModal,
              openChainModal,
              openConnectModal,
              mounted,
            }) => {
              if (!mounted) return null;
              const connected = account && chain;

              return (
                <div className="px-4 py-3 space-y-2">
                  {!connected ? (
                    <button
                      onClick={() => {
                        openConnectModal();
                        onClose();
                      }}
                      className="w-full bg-brand-500 hover:bg-brand-400 text-black font-semibold text-sm py-3 rounded-xl transition-all glow-brand"
                    >
                      Connect Wallet
                    </button>
                  ) : chain.unsupported ? (
                    <button
                      onClick={() => {
                        openChainModal();
                        onClose();
                      }}
                      className="w-full flex items-center justify-center gap-2 bg-red-500/10 border border-red-500/30 text-red-400 font-semibold text-sm py-3 rounded-xl"
                    >
                      <AlertTriangle className="w-4 h-4" />
                      Wrong Network — tap to switch
                    </button>
                  ) : (
                    <div className="space-y-2">
                      {/* Address row */}
                      <div className="flex items-center justify-between bg-slate-900 border border-slate-800 rounded-xl px-4 py-3">
                        <div className="flex items-center gap-3">
                          {account.ensAvatar ? (
                            <img
                              src={account.ensAvatar}
                              alt=""
                              className="w-7 h-7 rounded-full"
                            />
                          ) : (
                            <AddressAvatar address={account.address} size={7} />
                          )}
                          <div>
                            <p className="text-white font-medium text-sm">
                              {account.ensName ?? account.displayName}
                            </p>
                            {account.displayBalance && (
                              <p className="text-slate-500 text-xs">
                                {account.displayBalance}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <CopyAddress address={account.address} />
                          <a
                            href={`https://somnia-testnet.socialscan.io/address/${account.address}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 rounded-lg text-slate-600 hover:text-slate-400 hover:bg-slate-800 transition-colors"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        </div>
                      </div>

                      {/* Chain + actions row */}
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            openChainModal();
                            onClose();
                          }}
                          className="flex-1 flex items-center justify-center gap-1.5 bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-400 text-xs font-medium py-2.5 rounded-xl transition-all"
                        >
                          {chain.hasIcon && chain.iconUrl ? (
                            <img
                              src={chain.iconUrl}
                              alt={chain.name}
                              className="w-3.5 h-3.5 rounded-full"
                            />
                          ) : (
                            <div className="w-3.5 h-3.5 rounded-full bg-brand-400/30" />
                          )}
                          {chain.name}
                        </button>
                        <button
                          onClick={() => {
                            openAccountModal();
                            onClose();
                          }}
                          className="flex-1 flex items-center justify-center gap-1.5 bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-400 text-xs font-medium py-2.5 rounded-xl transition-all"
                        >
                          Manage Wallet
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            }}
          </ConnectButton.Custom>

          {/* Footer */}
          <div className="px-4 pb-4 flex items-center justify-center gap-1.5 text-xs text-slate-700">
            Built on{" "}
            <a
              href="https://somnia.network"
              target="_blank"
              rel="noopener noreferrer"
              className="text-slate-500 hover:text-slate-400 transition-colors"
            >
              Somnia
            </a>{" "}
            · Agentathon 2026
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ── Navbar ────────────────────────────────────────────────────────────────────

export default function Navbar() {
  const { pathname } = useLocation();
  const { address } = useAccount();
  const isOwner =
    !!address && address.toLowerCase() === OWNER_ADDRESS.toLowerCase();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close mobile menu on route change
  useEffect(() => setMobileOpen(false), [pathname]);

  // Close on scroll (feels native)
  useEffect(() => {
    if (!mobileOpen) return;
    const handler = () => setMobileOpen(false);
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, [mobileOpen]);

  return (
    <>
      {/* Scrim — dims page content behind the overlay menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            key="scrim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="lg:hidden fixed inset-0 z-40 bg-slate-950/70"
            onClick={() => setMobileOpen(false)}
          />
        )}
      </AnimatePresence>

      <nav className="glass border-b border-slate-800/50 sticky top-0 z-50">
      {/* Main bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2.5 shrink-0 group">
          <span className="font-mono font-bold text-xl sm:text-2xl leading-none select-none">
            <span className="text-slate-600 group-hover:text-slate-500 transition-colors">
              {"{"}
            </span>
            <span className="text-brand-400">SP</span>
            <span className="text-slate-600 group-hover:text-slate-500 transition-colors">
              {"}"}
            </span>
          </span>
          <div className="flex flex-col leading-none">
            <span className="text-white font-semibold text-sm tracking-wide">
              Sentri
            </span>
            <span className="text-slate-600 text-[10px] tracking-widest uppercase">
              Protocol
            </span>
          </div>
        </Link>

        {/* Desktop Nav Links */}
        <div className="hidden lg:flex items-center gap-0.5 flex-1 justify-center min-w-0">
          {navLinks.map((link) => {
            const active = pathname === link.to;
            return (
              <Link
                key={link.to}
                to={link.to}
                className={cn(
                  "relative px-4 py-2 rounded-lg text-sm font-medium transition-all",
                  active
                    ? "text-brand-400"
                    : "text-slate-500 hover:text-slate-200 hover:bg-slate-800/60",
                )}
              >
                {link.label}
                {active && (
                  <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-4 h-0.5 bg-brand-400 rounded-full" />
                )}
              </Link>
            );
          })}
          {isOwner && (
            <Link
              to="/admin"
              className={cn(
                "relative px-4 py-2 rounded-lg text-sm font-medium transition-all",
                pathname === "/admin"
                  ? "text-amber-400"
                  : "text-amber-600/70 hover:text-amber-400 hover:bg-amber-500/5",
              )}
            >
              Admin
              {pathname === "/admin" && (
                <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-4 h-0.5 bg-amber-400 rounded-full" />
              )}
            </Link>
          )}
        </div>

        {/* Right: Desktop wallet + Somnia badge */}
        <div className="hidden lg:flex items-center gap-3 shrink-0 min-w-0">
          <WalletButton />
        </div>

        {/* Mobile: compact wallet + hamburger */}
        <div className="flex lg:hidden items-center gap-2">
          <WalletButton compact />
          <button
            onClick={() => setMobileOpen((v) => !v)}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800/70 transition-all"
            aria-label="Toggle menu"
          >
            {mobileOpen ? (
              <X className="w-5 h-5" />
            ) : (
              <Menu className="w-5 h-5" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile dropdown */}
      <MobileMenu
        open={mobileOpen}
        pathname={pathname}
        isOwner={isOwner}
        onClose={() => setMobileOpen(false)}
      />
    </nav>
    </>
  );
}
