/**
 * Contract addresses and ABIs for the Sentri web app.
 * Addresses are loaded from Vite env vars (set in .env.local after deployment).
 */

export const CORE_ADDRESS          = import.meta.env.VITE_CORE_ADDRESS          as `0x${string}` | undefined;
export const VAULT_ADDRESS         = import.meta.env.VITE_VAULT_ADDRESS         as `0x${string}` | undefined;
export const USDSO_ADDRESS         = import.meta.env.VITE_USDSO_ADDRESS         as `0x${string}` | undefined;
export const ORCHESTRATOR_ADDRESS  = import.meta.env.VITE_ORCHESTRATOR_ADDRESS  as `0x${string}` | undefined;
export const TRACKER_URL           = import.meta.env.VITE_TRACKER_URL           ?? "http://localhost:4000";
// Deployer / owner of all contracts
export const OWNER_ADDRESS         = "0xD7Fd52209711c94A3Fcc4f3aeB3668d2Df829254" as `0x${string}`;

export const USDSO_DECIMALS = 13; // use 13 of token's 18 decimals → 1 USDso = $100 000
export const WAD             = BigInt(1e18);

// ── ABIs ────────────────────────────────────────────────────────

export const ERC20_ABI = [
  {
    name: "approve",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount",  type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
  },
  {
    name: "allowance",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "owner",   type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ type: "uint256" }],
  },
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
] as const;

export const INSURANCE_CORE_ABI = [
  {
    name: "buyPosition",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "productId",      type: "uint256" },
      { name: "coverageAmount", type: "uint256" },
    ],
    outputs: [{ name: "positionId", type: "uint256" }],
  },
  {
    name: "calculatePremium",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "productId", type: "uint256" },
      { name: "amount",    type: "uint256" },
    ],
    outputs: [{ type: "uint256" }],
  },
] as const;

export const POLICY_VAULT_ABI = [
  {
    name: "deposit",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "amount", type: "uint256" }],
    outputs: [{ name: "shares", type: "uint256" }],
  },
  {
    name: "withdraw",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "shares", type: "uint256" }],
    outputs: [{ name: "amount", type: "uint256" }],
  },
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    name: "shareValue",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    name: "totalDeposited",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    name: "totalLocked",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    name: "utilizationRate",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    name: "availableLiquidity",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    name: "utilizationMultiplierBps",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
] as const;

// ── Admin ABIs ───────────────────────────────────────────────────

export const INSURANCE_CORE_ADMIN_ABI = [
  {
    name: "productCount",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    name: "positionCount",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    name: "positions",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "id", type: "uint256" }],
    outputs: [
      { name: "id",             type: "uint256" },
      { name: "productId",      type: "uint256" },
      { name: "holder",         type: "address" },
      { name: "coverageAmount", type: "uint256" },
      { name: "premium",        type: "uint256" },
      { name: "createdAt",      type: "uint256" },
      { name: "expiresAt",      type: "uint256" },
      { name: "status",         type: "uint8"   },
      { name: "claimedPrice",   type: "uint256" },
      { name: "claimedPayout",  type: "uint256" },
    ],
  },
  {
    name: "products",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "id", type: "uint256" }],
    outputs: [
      { name: "id",             type: "uint256" },
      { name: "name",           type: "string"  },
      { name: "triggerType",    type: "uint8"   },
      { name: "triggerParams",  type: "bytes"   },
      { name: "premiumRateBps", type: "uint256" },
      { name: "duration",       type: "uint256" },
      { name: "maxPerPosition", type: "uint256" },
      { name: "poolLimit",      type: "uint256" },
      { name: "totalCommitted", type: "uint256" },
      { name: "referenceTVL",   type: "uint256" },
      { name: "active",         type: "bool"    },
    ],
  },
  {
    name: "createDepegProduct",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "name",           type: "string"  },
      { name: "pool",           type: "address" },
      { name: "threshold",      type: "uint256" },
      { name: "premiumRateBps", type: "uint256" },
      { name: "duration",       type: "uint256" },
      { name: "maxPerPosition", type: "uint256" },
      { name: "poolLimit",      type: "uint256" },
    ],
    outputs: [{ name: "productId", type: "uint256" }],
  },
  {
    name: "createRugProduct",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "name",               type: "string"  },
      { name: "token",              type: "address" },
      { name: "pool",               type: "address" },
      { name: "liquidityThreshold", type: "uint256" },
      { name: "premiumRateBps",     type: "uint256" },
      { name: "duration",           type: "uint256" },
      { name: "maxPerPosition",     type: "uint256" },
      { name: "poolLimit",          type: "uint256" },
      { name: "referenceTVL",       type: "uint256" },
    ],
    outputs: [{ name: "productId", type: "uint256" }],
  },
  {
    name: "pauseProduct",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "productId", type: "uint256" },
      { name: "reason",    type: "string"  },
    ],
    outputs: [],
  },
  {
    name: "unpauseProduct",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "productId", type: "uint256" }],
    outputs: [],
  },
] as const;

export const ORCHESTRATOR_ADMIN_ABI = [
  {
    name: "setAgentIds",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "_jsonApiAgentId", type: "uint256" },
      { name: "_llmAgentId",     type: "uint256" },
    ],
    outputs: [],
  },
  {
    name: "jsonApiAgentId",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    name: "llmAgentId",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    name: "fund",
    type: "function",
    stateMutability: "payable",
    inputs: [],
    outputs: [],
  },
] as const;
