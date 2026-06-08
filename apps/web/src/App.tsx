import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { WagmiProvider } from 'wagmi'
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

export default function App() {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
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
        </BrowserRouter>
      </QueryClientProvider>
    </WagmiProvider>
  )
}
