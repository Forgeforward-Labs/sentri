import '@rainbow-me/rainbowkit/styles.css'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { WagmiProvider } from 'wagmi'
import { RainbowKitProvider, darkTheme } from '@rainbow-me/rainbowkit'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import { wagmiConfig } from './lib/wagmi'
import Navbar from './components/Navbar'
import HomePage from './pages/HomePage'
import CoverPage from './pages/CoverPage'
import EarnPage from './pages/EarnPage'
import DashboardPage from './pages/DashboardPage'
import PositionDetailPage from './pages/PositionDetailPage'
import AdminPage from './pages/AdminPage'
import AnalyticsPage from './pages/AnalyticsPage'

const queryClient = new QueryClient()

const rkTheme = darkTheme({
  accentColor: '#22d3ee',       // brand-400
  accentColorForeground: '#000000',
  borderRadius: 'large',
  overlayBlur: 'small',
  fontStack: 'system',
})

// Override modal background to match the app's slate-950 palette
Object.assign(rkTheme.colors, {
  modalBackground:         '#0a0f1e',
  modalBorder:             '#1e293b',
  menuItemBackground:      '#0f172a',
  profileForeground:       '#0f172a',
  generalBorder:           '#1e293b',
  generalBorderDim:        '#0f172a',
  actionButtonBorder:      '#1e293b',
  actionButtonSecondaryBackground: '#0f172a',
  closeButtonBackground:   '#1e293b',
  connectButtonBackground: '#0f172a',
  connectButtonInnerBackground: '#1e293b',
})

export default function App() {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={rkTheme} modalSize="compact">
          <Toaster position="bottom-right" theme="dark" richColors />
          <BrowserRouter>
            <Navbar />
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/cover" element={<CoverPage />} />
              <Route path="/earn" element={<EarnPage />} />
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/position/:id" element={<PositionDetailPage />} />
              <Route path="/admin" element={<AdminPage />} />
              <Route path="/analytics" element={<AnalyticsPage />} />
            </Routes>
            <footer className="border-t border-slate-800/50 bg-slate-950/80">
              <div className="max-w-7xl mx-auto px-6 py-5 flex flex-col md:flex-row items-center justify-between gap-3 text-xs text-slate-600">
                <div className="flex items-center gap-2.5">
                  <span className="font-mono">
                    <span className="text-slate-700">{'{'}</span>
                    <span className="text-brand-400 font-semibold">SP</span>
                    <span className="text-slate-700">{'}'}</span>
                  </span>
                  <span>Sentri Protocol</span>
                  <span className="text-slate-800">·</span>
                  <span>Parametric DeFi Insurance</span>
                </div>
                <span>
                  Built on{' '}
                  <a
                    href="https://somnia.network"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-slate-500 hover:text-slate-300 transition-colors"
                  >
                    Somnia
                  </a>
                  {' '}· Agentathon 2026
                </span>
              </div>
            </footer>
          </BrowserRouter>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  )
}
