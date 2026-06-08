import { createConfig, http } from 'wagmi'
import { injected, walletConnect } from 'wagmi/connectors'

const somniaTestnet = {
  id: 50312,
  name: 'Somnia Testnet',
  nativeCurrency: { name: 'STT', symbol: 'STT', decimals: 18 },
  rpcUrls: { default: { http: ['https://dream-rpc.somnia.network'] } },
  blockExplorers: { default: { name: 'Somnia Explorer', url: 'https://somnia-testnet.socialscan.io' } },
} as const

export const wagmiConfig = createConfig({
  chains: [somniaTestnet],
  connectors: [
    injected(),
    walletConnect({ projectId: import.meta.env.VITE_WC_PROJECT_ID ?? 'demo' }),
  ],
  transports: { [somniaTestnet.id]: http() },
})

export { somniaTestnet }
