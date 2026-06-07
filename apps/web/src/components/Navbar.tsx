import { Link, useLocation } from 'react-router-dom'
import { useAccount, useConnect, useDisconnect } from 'wagmi'
import { injected } from 'wagmi/connectors'
import { cn, formatAddress } from '../lib/utils'
import { OWNER_ADDRESS } from '../lib/contracts'

const navLinks = [
  { label: 'Cover', to: '/cover' },
  { label: 'Earn', to: '/earn' },
  { label: 'Positions', to: '/dashboard' },
]

function WalletButton() {
  const { address, isConnected } = useAccount()
  const { connect } = useConnect()
  const { disconnect } = useDisconnect()

  if (isConnected && address) {
    return (
      <div className="flex items-center gap-2">
        <span className="font-mono text-sm text-slate-300 bg-slate-800 px-3 py-1.5 rounded-lg">
          {formatAddress(address)}
        </span>
        <button
          onClick={() => disconnect()}
          className="text-xs text-slate-400 hover:text-red-400 transition-colors px-2 py-1.5"
        >
          Disconnect
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={() => connect({ connector: injected() })}
      className="bg-brand-500 hover:bg-brand-400 text-black font-semibold text-sm px-4 py-2 rounded-lg transition-colors"
    >
      Connect Wallet
    </button>
  )
}

export default function Navbar() {
  const { pathname } = useLocation()
  const { address } = useAccount()
  const isOwner = !!address && address.toLowerCase() === OWNER_ADDRESS.toLowerCase()

  return (
    <nav className="glass border-b border-slate-800/50 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2">
          <span className="font-mono font-bold text-brand-400 text-lg tracking-widest">
            SENTRI
          </span>
          <span className="text-slate-400 text-sm font-medium tracking-wider">
            PROTOCOL
          </span>
        </Link>

        {/* Nav Links */}
        <div className="hidden md:flex items-center gap-1">
          {navLinks.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className={cn(
                'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                pathname === link.to
                  ? 'text-brand-400 bg-brand-500/10'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'
              )}
            >
              {link.label}
            </Link>
          ))}
          {isOwner && (
            <Link
              to="/admin"
              className={cn(
                'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                pathname === '/admin'
                  ? 'text-amber-400 bg-amber-500/10'
                  : 'text-amber-500/70 hover:text-amber-400 hover:bg-amber-500/10'
              )}
            >
              Admin
            </Link>
          )}
        </div>

        {/* Wallet */}
        <WalletButton />
      </div>
    </nav>
  )
}
