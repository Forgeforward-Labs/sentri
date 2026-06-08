import {
  createPublicClient,
  createWalletClient,
  http,
  parseAbiItem,
  type AbiEvent,
  type Hash,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { env } from "../config/env.js";

export const somniaTestnet = {
  id: 50312,
  name: "Somnia Testnet",
  nativeCurrency: { name: "STT", symbol: "STT", decimals: 18 },
  rpcUrls: {
    default: { http: [env.somniaHttpRpcUrl] },
  },
} as const;

// ─────────────────────────────────────────────────────────────────
//  ABIs
// ─────────────────────────────────────────────────────────────────

const INSURANCE_CORE_ABI = [
  // Write
  { name: "expirePosition",    type: "function", stateMutability: "nonpayable",
    inputs: [{ name: "positionId", type: "uint256" }], outputs: [] },
  { name: "initiateDepegClaim", type: "function", stateMutability: "nonpayable",
    inputs: [{ name: "positionId", type: "uint256" }, { name: "observedPrice", type: "uint256" }], outputs: [] },
  { name: "initiateDepegClaimBatch", type: "function", stateMutability: "nonpayable",
    inputs: [{ name: "positionIds", type: "uint256[]" }, { name: "observedPrice", type: "uint256" }], outputs: [] },
  { name: "initiateRugClaim",  type: "function", stateMutability: "nonpayable",
    inputs: [{ name: "positionId", type: "uint256" }, { name: "observedLiquidityPct", type: "uint256" }], outputs: [] },
  { name: "initiateRugClaimBatch", type: "function", stateMutability: "nonpayable",
    inputs: [{ name: "positionIds", type: "uint256[]" }, { name: "observedLiquidityPct", type: "uint256" }], outputs: [] },
  { name: "pauseProduct",      type: "function", stateMutability: "nonpayable",
    inputs: [{ name: "productId", type: "uint256" }, { name: "reason", type: "string" }], outputs: [] },
  // Read
  { name: "productCount",  type: "function", stateMutability: "view",
    inputs: [], outputs: [{ type: "uint256" }] },
  { name: "positionCount", type: "function", stateMutability: "view",
    inputs: [], outputs: [{ type: "uint256" }] },
  { name: "products", type: "function", stateMutability: "view",
    inputs: [{ name: "id", type: "uint256" }],
    outputs: [{
      type: "tuple",
      components: [
        { name: "id",               type: "uint256" },
        { name: "name",             type: "string"  },
        { name: "triggerType",      type: "uint8"   },
        { name: "triggerParams",    type: "bytes"   },
        { name: "premiumRateBps",   type: "uint256" },
        { name: "duration",         type: "uint256" },
        { name: "maxPerPosition",   type: "uint256" },
        { name: "poolLimit",        type: "uint256" },
        { name: "totalCommitted",   type: "uint256" },
        { name: "referenceTVL",     type: "uint256" },
        { name: "active",           type: "bool"    },
      ],
    }],
  },
  { name: "positions", type: "function", stateMutability: "view",
    inputs: [{ name: "id", type: "uint256" }],
    outputs: [{
      type: "tuple",
      components: [
        { name: "id",               type: "uint256" },
        { name: "productId",        type: "uint256" },
        { name: "holder",           type: "address" },
        { name: "coverageAmount",   type: "uint256" },
        { name: "premium",          type: "uint256" },
        { name: "createdAt",        type: "uint256" },
        { name: "expiresAt",        type: "uint256" },
        { name: "status",           type: "uint8"   },
        { name: "claimedPrice",     type: "uint256" },
        { name: "claimedPayout",    type: "uint256" },
      ],
    }],
  },
  // Events
  { name: "ProductCreated", type: "event",
    inputs: [
      { name: "id",          type: "uint256", indexed: true  },
      { name: "name",        type: "string",  indexed: false },
      { name: "triggerType", type: "uint8",   indexed: false },
    ],
  },
  { name: "PositionCreated", type: "event",
    inputs: [
      { name: "id",             type: "uint256", indexed: true  },
      { name: "holder",         type: "address", indexed: true  },
      { name: "productId",      type: "uint256", indexed: true  },
      { name: "coverageAmount", type: "uint256", indexed: false },
    ],
  },
  { name: "PositionExpired", type: "event",
    inputs: [{ name: "id", type: "uint256", indexed: true }] },
  { name: "PositionClaimed", type: "event",
    inputs: [
      { name: "id",             type: "uint256", indexed: true  },
      { name: "payout",         type: "uint256", indexed: false },
      { name: "confirmedPrice", type: "uint256", indexed: false },
    ],
  },
] as const;

const POLICY_VAULT_ABI = [
  { name: "totalDeposited", type: "function", stateMutability: "view",
    inputs: [], outputs: [{ type: "uint256" }] },
  { name: "totalLocked",    type: "function", stateMutability: "view",
    inputs: [], outputs: [{ type: "uint256" }] },
  { name: "utilizationRate", type: "function", stateMutability: "view",
    inputs: [], outputs: [{ type: "uint256" }] },
  { name: "shareValue",     type: "function", stateMutability: "view",
    inputs: [], outputs: [{ type: "uint256" }] },
] as const;

const ORCHESTRATOR_ABI = [
  // Agent pipeline events — updated for batch contract
  { name: "BatchValidationStarted", type: "event",
    inputs: [
      { name: "firstPositionId", type: "uint256", indexed: true  },
      { name: "batchSize",       type: "uint256", indexed: false },
      { name: "requestId",       type: "uint256", indexed: true  },
    ],
  },
  { name: "StepAdvanced", type: "event",
    inputs: [
      { name: "firstPositionId", type: "uint256", indexed: true  },
      { name: "step",            type: "uint8",   indexed: false },
      { name: "requestId",       type: "uint256", indexed: true  },
    ],
  },
  { name: "TriggerVerified", type: "event",
    inputs: [
      { name: "positionId",     type: "uint256", indexed: true  },
      { name: "confirmedPrice", type: "uint256", indexed: false },
      { name: "payoutAmount",   type: "uint256", indexed: false },
    ],
  },
  { name: "TriggerDenied", type: "event",
    inputs: [
      { name: "firstPositionId", type: "uint256", indexed: true  },
      { name: "reason",          type: "string",  indexed: false },
      { name: "step",            type: "uint8",   indexed: false },
    ],
  },
] as const;

// ─────────────────────────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────────
//  Types returned by readPosition / readProduct
// ─────────────────────────────────────────────────────────────────

export type ChainProduct = {
  id: number;
  name: string;
  triggerType: 0 | 1; // 0=DEPEG, 1=RUG
  triggerParams: `0x${string}`;
  premiumRateBps: bigint;
  duration: bigint;
  maxPerPosition: bigint;
  poolLimit: bigint;
  totalCommitted: bigint;
  referenceTVL: bigint;
  active: boolean;
};

export type ChainPosition = {
  id: number;
  productId: number;
  holder: string;
  coverageAmount: bigint;
  premium: bigint;
  createdAt: bigint;
  expiresAt: bigint;
  status: 0 | 1 | 2 | 3; // ACTIVE=0, CLAIMED=1, CANCELLED=2, EXPIRED=3
  claimedPrice: bigint;
  claimedPayout: bigint;
};

export type ChainPoolStats = {
  totalDeposited: bigint;
  totalLocked: bigint;
  utilizationBps: bigint;
  shareValue: bigint;
};

// ─────────────────────────────────────────────────────────────────
//  ContractService
// ─────────────────────────────────────────────────────────────────

export class ContractService {
  private readonly publicClient;
  private readonly walletClient;

  constructor() {
    this.publicClient = createPublicClient({
      chain: somniaTestnet,
      transport: http(env.somniaHttpRpcUrl),
    });

    if (env.trackerPrivateKey) {
      const account = privateKeyToAccount(env.trackerPrivateKey as `0x${string}`);
      this.walletClient = createWalletClient({
        account,
        chain: somniaTestnet,
        transport: http(env.somniaHttpRpcUrl),
      });
    } else {
      this.walletClient = null;
    }
  }

  // ── Helpers ─────────────────────────────────────────────────────

  async getBlockNumber(): Promise<bigint> {
    return this.publicClient.getBlockNumber();
  }

  /**
   * Fetches all logs for a single event over an arbitrary block range by
   * splitting it into 999-block chunks (Somnia RPC limit).
   * Chunks are fetched sequentially to avoid overwhelming the RPC.
   */
  private async getLogsChunked(
    address: `0x${string}`,
    event: AbiEvent,
    fromBlock: bigint,
    toBlock: bigint,
  ): Promise<Array<{ args: Record<string, unknown> }>> {
    const CHUNK = 999n;
    const all: Array<{ args: Record<string, unknown> }> = [];

    let chunkCount = 0;
    for (let from = fromBlock; from <= toBlock; from += CHUNK + 1n) {
      const to = from + CHUNK > toBlock ? toBlock : from + CHUNK;
      const logs = await withRetry(() =>
        this.publicClient.getLogs({ address, event, fromBlock: from, toBlock: to }),
      );
      all.push(...(logs as Array<{ args: Record<string, unknown> }>));
      chunkCount++;
    }

    if (chunkCount > 1) {
      console.info(`[contract] getLogs chunked: ${chunkCount} chunks, ${all.length} total logs`);
    }

    return all;
  }

  /** Returns unique product IDs emitted in [fromBlock, toBlock]. */
  async getProductIdsInRange(fromBlock: bigint, toBlock: bigint): Promise<number[]> {
    if (!env.coreAddress) return [];
    const event = parseAbiItem(
      "event ProductCreated(uint256 indexed id, string name, uint8 triggerType)",
    ) as AbiEvent;
    const logs = await this.getLogsChunked(env.coreAddress as `0x${string}`, event, fromBlock, toBlock);
    return [...new Set(logs.map((l) => Number(l.args.id as bigint)))];
  }

  /** Returns unique position IDs emitted in [fromBlock, toBlock]. */
  async getPositionIdsInRange(fromBlock: bigint, toBlock: bigint): Promise<number[]> {
    if (!env.coreAddress) return [];
    const event = parseAbiItem(
      "event PositionCreated(uint256 indexed id, address indexed holder, uint256 indexed productId, uint256 coverageAmount)",
    ) as AbiEvent;
    const logs = await this.getLogsChunked(env.coreAddress as `0x${string}`, event, fromBlock, toBlock);
    return [...new Set(logs.map((l) => Number(l.args.id as bigint)))];
  }

  // ── Reads ───────────────────────────────────────────────────────

  async getProductCount(): Promise<number> {
    if (!env.coreAddress) return 0;
    const count = await this.publicClient.readContract({
      address: env.coreAddress as `0x${string}`,
      abi: INSURANCE_CORE_ABI,
      functionName: "productCount",
    });
    return Number(count);
  }

  async getPositionCount(): Promise<number> {
    if (!env.coreAddress) return 0;
    const count = await this.publicClient.readContract({
      address: env.coreAddress as `0x${string}`,
      abi: INSURANCE_CORE_ABI,
      functionName: "positionCount",
    });
    return Number(count);
  }

  async getProduct(id: number): Promise<ChainProduct> {
    const raw = await this.publicClient.readContract({
      address: env.coreAddress as `0x${string}`,
      abi: INSURANCE_CORE_ABI,
      functionName: "products",
      args: [BigInt(id)],
    });
    return {
      id,
      name:           raw.name,
      triggerType:    raw.triggerType as 0 | 1,
      triggerParams:  raw.triggerParams,
      premiumRateBps: raw.premiumRateBps,
      duration:       raw.duration,
      maxPerPosition: raw.maxPerPosition,
      poolLimit:      raw.poolLimit,
      totalCommitted: raw.totalCommitted,
      referenceTVL:   raw.referenceTVL,
      active:         raw.active,
    };
  }

  async getAllProducts(): Promise<ChainProduct[]> {
    const count = await this.getProductCount();
    const ids = Array.from({ length: count }, (_, i) => i + 1);
    const results = await Promise.all(ids.map((id) => this.getProduct(id).catch(() => null)));
    return results.filter((p): p is ChainProduct => p !== null);
  }

  async getPosition(id: number): Promise<ChainPosition> {
    const raw = await this.publicClient.readContract({
      address: env.coreAddress as `0x${string}`,
      abi: INSURANCE_CORE_ABI,
      functionName: "positions",
      args: [BigInt(id)],
    });
    return {
      id,
      productId:      Number(raw.productId),
      holder:         raw.holder,
      coverageAmount: raw.coverageAmount,
      premium:        raw.premium,
      createdAt:      raw.createdAt,
      expiresAt:      raw.expiresAt,
      status:         raw.status as 0 | 1 | 2 | 3,
      claimedPrice:   raw.claimedPrice,
      claimedPayout:  raw.claimedPayout,
    };
  }

  async getAllPositions(): Promise<ChainPosition[]> {
    const count = await this.getPositionCount();
    const ids = Array.from({ length: count }, (_, i) => i + 1);
    const results = await Promise.all(ids.map((id) => this.getPosition(id).catch(() => null)));
    return results.filter((p): p is ChainPosition => p !== null);
  }

  async getPoolStats(): Promise<ChainPoolStats> {
    if (!env.vaultAddress) {
      return { totalDeposited: 0n, totalLocked: 0n, utilizationBps: 0n, shareValue: BigInt(1e18) };
    }
    const [totalDeposited, totalLocked, utilizationBps, shareValue] = await Promise.all([
      this.publicClient.readContract({ address: env.vaultAddress as `0x${string}`, abi: POLICY_VAULT_ABI, functionName: "totalDeposited" }),
      this.publicClient.readContract({ address: env.vaultAddress as `0x${string}`, abi: POLICY_VAULT_ABI, functionName: "totalLocked"    }),
      this.publicClient.readContract({ address: env.vaultAddress as `0x${string}`, abi: POLICY_VAULT_ABI, functionName: "utilizationRate" }),
      this.publicClient.readContract({ address: env.vaultAddress as `0x${string}`, abi: POLICY_VAULT_ABI, functionName: "shareValue"     }),
    ]);
    return { totalDeposited, totalLocked, utilizationBps, shareValue };
  }

  // ── Event subscriptions ─────────────────────────────────────────

  watchProductCreated(onLog: (productId: number) => void) {
    if (!env.coreAddress) return () => {};
    return this.publicClient.watchContractEvent({
      address: env.coreAddress as `0x${string}`,
      abi: INSURANCE_CORE_ABI,
      eventName: "ProductCreated",
      onLogs: (logs) => { for (const l of logs) onLog(Number(l.args.id)); },
    });
  }

  watchPositionCreated(
    onLog: (positionId: number, holder: string, productId: number) => void,
  ) {
    if (!env.coreAddress) return () => {};
    return this.publicClient.watchContractEvent({
      address: env.coreAddress as `0x${string}`,
      abi: INSURANCE_CORE_ABI,
      eventName: "PositionCreated",
      onLogs: (logs) => {
        for (const log of logs) {
          onLog(Number(log.args.id), log.args.holder!, Number(log.args.productId));
        }
      },
    });
  }

  watchPositionStatusChange(
    onExpired: (positionId: number) => void,
    onClaimed: (positionId: number, payout: bigint) => void,
  ) {
    if (!env.coreAddress) return () => {};

    const unsubExpired = this.publicClient.watchContractEvent({
      address: env.coreAddress as `0x${string}`,
      abi: INSURANCE_CORE_ABI,
      eventName: "PositionExpired",
      onLogs: (logs) => { for (const l of logs) onExpired(Number(l.args.id)); },
    });

    const unsubClaimed = this.publicClient.watchContractEvent({
      address: env.coreAddress as `0x${string}`,
      abi: INSURANCE_CORE_ABI,
      eventName: "PositionClaimed",
      onLogs: (logs) => { for (const l of logs) onClaimed(Number(l.args.id), l.args.payout!); },
    });

    return () => { unsubExpired(); unsubClaimed(); };
  }

  watchOrchestratorEvents(handlers: {
    onBatchStart?:   (firstPositionId: number, batchSize: number, requestId: bigint) => void;
    onStep?:         (firstPositionId: number, step: number, requestId: bigint) => void;
    onVerified?:     (positionId: number, confirmedPrice: bigint, payout: bigint, txHash: string | null) => void;
    onDenied?:       (firstPositionId: number, reason: string, step: number) => void;
  }) {
    if (!env.agentOrchestratorAddress) return () => {};
    const addr = env.agentOrchestratorAddress as `0x${string}`;

    const unsubs = [
      this.publicClient.watchContractEvent({
        address: addr, abi: ORCHESTRATOR_ABI, eventName: "BatchValidationStarted",
        onLogs: (logs) => {
          for (const l of logs) handlers.onBatchStart?.(
            Number(l.args.firstPositionId), Number(l.args.batchSize), l.args.requestId!,
          );
        },
      }),
      this.publicClient.watchContractEvent({
        address: addr, abi: ORCHESTRATOR_ABI, eventName: "StepAdvanced",
        onLogs: (logs) => {
          for (const l of logs) handlers.onStep?.(
            Number(l.args.firstPositionId), Number(l.args.step as bigint | number), l.args.requestId!,
          );
        },
      }),
      this.publicClient.watchContractEvent({
        address: addr, abi: ORCHESTRATOR_ABI, eventName: "TriggerVerified",
        onLogs: (logs) => {
          for (const l of logs) handlers.onVerified?.(
            Number(l.args.positionId), l.args.confirmedPrice!, l.args.payoutAmount!,
            l.transactionHash ?? null,
          );
        },
      }),
      this.publicClient.watchContractEvent({
        address: addr, abi: ORCHESTRATOR_ABI, eventName: "TriggerDenied",
        onLogs: (logs) => {
          for (const l of logs) handlers.onDenied?.(
            Number(l.args.firstPositionId), l.args.reason!, l.args.step!,
          );
        },
      }),
    ];

    return () => unsubs.forEach((u) => u());
  }

  // ── Writes ──────────────────────────────────────────────────────

  private requireWallet() {
    if (!this.walletClient) throw new Error("TRACKER_PRIVATE_KEY not set — cannot send transactions");
    return this.walletClient;
  }

  async expirePosition(positionId: number): Promise<Hash> {
    console.info(`[contract] expirePosition(${positionId})`);
    const wallet = this.requireWallet();
    return withRetry(() =>
      wallet.writeContract({
        address: env.coreAddress as `0x${string}`,
        abi: INSURANCE_CORE_ABI,
        functionName: "expirePosition",
        args: [BigInt(positionId)],
      }),
    );
  }

  async initiateDepegClaim(positionId: number, priceUsd: number): Promise<Hash> {
    const observedPrice = BigInt(Math.round(priceUsd * 1e18));
    console.info(`[contract] initiateDepegClaim(${positionId}, ${priceUsd})`);
    const wallet = this.requireWallet();
    return withRetry(() =>
      wallet.writeContract({
        address: env.coreAddress as `0x${string}`,
        abi: INSURANCE_CORE_ABI,
        functionName: "initiateDepegClaim",
        args: [BigInt(positionId), observedPrice],
      }),
    );
  }

  async initiateDepegClaimBatch(positionIds: number[], priceUsd: number): Promise<Hash> {
    const observedPrice = BigInt(Math.round(priceUsd * 1e18));
    console.info(`[contract] initiateDepegClaimBatch([${positionIds.join(",")}], ${priceUsd})`);
    const wallet = this.requireWallet();
    return withRetry(() =>
      wallet.writeContract({
        address: env.coreAddress as `0x${string}`,
        abi: INSURANCE_CORE_ABI,
        functionName: "initiateDepegClaimBatch",
        args: [positionIds.map(BigInt), observedPrice],
      }),
    );
  }

  async initiateRugClaim(positionId: number, liquidityPctBps: number): Promise<Hash> {
    console.info(`[contract] initiateRugClaim(${positionId}, ${liquidityPctBps}bps)`);
    const wallet = this.requireWallet();
    return withRetry(() =>
      wallet.writeContract({
        address: env.coreAddress as `0x${string}`,
        abi: INSURANCE_CORE_ABI,
        functionName: "initiateRugClaim",
        args: [BigInt(positionId), BigInt(liquidityPctBps)],
      }),
    );
  }

  async initiateRugClaimBatch(positionIds: number[], liquidityPctBps: number): Promise<Hash> {
    console.info(`[contract] initiateRugClaimBatch([${positionIds.join(",")}], ${liquidityPctBps}bps)`);
    const wallet = this.requireWallet();
    return withRetry(() =>
      wallet.writeContract({
        address: env.coreAddress as `0x${string}`,
        abi: INSURANCE_CORE_ABI,
        functionName: "initiateRugClaimBatch",
        args: [positionIds.map(BigInt), BigInt(liquidityPctBps)],
      }),
    );
  }

  async pauseProduct(productId: number, reason: string): Promise<Hash> {
    console.info(`[contract] pauseProduct(${productId}, "${reason}")`);
    const wallet = this.requireWallet();
    return withRetry(() =>
      wallet.writeContract({
        address: env.coreAddress as `0x${string}`,
        abi: INSURANCE_CORE_ABI,
        functionName: "pauseProduct",
        args: [BigInt(productId), reason],
      }),
    );
  }
}
