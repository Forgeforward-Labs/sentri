import { createWalletClient, http, type Hash } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { env } from "../config/env.js";

const somniaTestnet = {
  id: 50312,
  name: "Somnia Testnet",
  nativeCurrency: { name: "STT", symbol: "STT", decimals: 18 },
  rpcUrls: {
    default: { http: [env.somniaHttpRpcUrl] },
  },
} as const;

const INSURANCE_CORE_ABI = [
  {
    name: "expirePosition",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "positionId", type: "uint256" }],
    outputs: [],
  },
  {
    name: "initiateDepegClaim",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "positionId", type: "uint256" },
      { name: "observedPrice", type: "uint256" },
    ],
    outputs: [],
  },
  {
    name: "initiateRugClaim",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "positionId", type: "uint256" },
      { name: "observedLiquidityPct", type: "uint256" },
    ],
    outputs: [],
  },
  {
    name: "pauseProduct",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "productId", type: "uint256" },
      { name: "reason", type: "string" },
    ],
    outputs: [],
  },
] as const;

async function withRetry<T>(fn: () => Promise<T>, maxAttempts = 3): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt < maxAttempts - 1) {
        await new Promise((resolve) => setTimeout(resolve, 1000 * 2 ** attempt));
      }
    }
  }
  throw lastError;
}

export class ContractService {
  private readonly walletClient;

  constructor() {
    const account = privateKeyToAccount(env.trackerPrivateKey as `0x${string}`);
    this.walletClient = createWalletClient({
      account,
      chain: somniaTestnet,
      transport: http(env.somniaHttpRpcUrl),
    });
  }

  async expirePosition(positionId: number): Promise<Hash> {
    console.info(`[contract] expirePosition(${positionId})`);
    return withRetry(() =>
      this.walletClient.writeContract({
        address: env.coreAddress as `0x${string}`,
        abi: INSURANCE_CORE_ABI,
        functionName: "expirePosition",
        args: [BigInt(positionId)],
      }),
    );
  }

  async initiateDepegClaim(positionId: number, priceUsd: number): Promise<Hash> {
    // Contract expects 18-decimal fixed-point price
    const observedPrice = BigInt(Math.round(priceUsd * 1e18));
    console.info(`[contract] initiateDepegClaim(${positionId}, ${priceUsd} -> ${observedPrice})`);
    return withRetry(() =>
      this.walletClient.writeContract({
        address: env.coreAddress as `0x${string}`,
        abi: INSURANCE_CORE_ABI,
        functionName: "initiateDepegClaim",
        args: [BigInt(positionId), observedPrice],
      }),
    );
  }

  async initiateRugClaim(positionId: number, liquidityPctBps: number): Promise<Hash> {
    console.info(`[contract] initiateRugClaim(${positionId}, ${liquidityPctBps}bps)`);
    return withRetry(() =>
      this.walletClient.writeContract({
        address: env.coreAddress as `0x${string}`,
        abi: INSURANCE_CORE_ABI,
        functionName: "initiateRugClaim",
        args: [BigInt(positionId), BigInt(liquidityPctBps)],
      }),
    );
  }

  async pauseProduct(productId: number, reason: string): Promise<Hash> {
    console.info(`[contract] pauseProduct(${productId}, "${reason}")`);
    return withRetry(() =>
      this.walletClient.writeContract({
        address: env.coreAddress as `0x${string}`,
        abi: INSURANCE_CORE_ABI,
        functionName: "pauseProduct",
        args: [BigInt(productId), reason],
      }),
    );
  }
}
