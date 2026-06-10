import { getDefaultConfig } from '@rainbow-me/rainbowkit'
import { http } from 'wagmi'

const somniaTestnet = {
  id: 50312,
  name: 'Somnia Testnet',
  nativeCurrency: { name: 'STT', symbol: 'STT', decimals: 18 },
  rpcUrls: { default: { http: ['https://dream-rpc.somnia.network'] } },
  blockExplorers: {
    default: { name: 'Somnia Explorer', url: 'https://somnia-testnet.socialscan.io' },
  },
  testnet: true,
} as const

export const wagmiConfig = getDefaultConfig({
  appName: 'Sentri Protocol',
  projectId: import.meta.env.VITE_WC_PROJECT_ID || 'demo',
  chains: [somniaTestnet],
  transports: { [somniaTestnet.id]: http() },
  ssr: false,
})

export { somniaTestnet }
