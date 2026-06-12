# Sentri — Parametric Insurance on Somnia

Sentri is an on-chain parametric insurance protocol built on the [Somnia Network](https://somnia.network). It lets users buy instant, trustless coverage against DeFi risks — stablecoin depegs and rug pulls — and pays out automatically when autonomous Somnia AI agents reach consensus that a trigger event occurred. No claim forms, no adjusters, no waiting period.

**Live demo:** [sentriweb-production.up.railway.app](https://sentriweb-production.up.railway.app) · Somnia Testnet
**Video demo:** [Watch on Google Drive](https://drive.google.com/file/d/19K7cmBaYHCqpHk3qs1r85MnhK7d3Qjqj/view?usp=sharing)
**Architecture:** [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)

---

## How It Works

```
User buys coverage
        │
        ▼
   InsuranceCore records position + locks funds in PolicyVault
        │
        ▼
   Tracker service monitors prices / liquidity (60–90 s polls)
        │
   ─ trigger detected ─
        │
        ▼
   AgentOrchestrator initiates 3-step validation pipeline
        │
   Step 1 ─ JSON API Agent   → fetches on-chain price / liquidity
   Step 2 ─ LLM Agent        → plausibility check ("is this a real event?")
   Step 3 ─ LLM News Agent   → news / social confirmation (depeg only)
        │
   ─ agents reach consensus ─
        │
        ▼
   ClaimProcessor executes payout from PolicyVault → holder's wallet
```

**Depeg coverage** — proportional payout. If a stablecoin trades at $0.90 against a $0.97 threshold, a $5,000 position pays out `5000 × (0.97 − 0.90) / 0.97 ≈ $361`. Requires all 3 agent steps.

**Rug pull coverage** — binary full payout. Triggered when pool liquidity drops below the product threshold. Requires 2 agent steps (price is objective — news step is skipped).

---

## Agent Validation Pipeline

All claim validation runs through [Somnia Agents](https://agents.somnia.network) — the protocol's native AI agent platform. Every step is an on-chain request; callback handlers enforce `msg.sender == platform`.

| Step | Agent Type | What it checks | Products |
|------|-----------|----------------|---------|
| 1 | `JsonApiAgent` | Fetches current price or liquidity from a public API | Both |
| 2 | `LlmAgent` | Plausibility — "Is this a genuine depeg/rug, not a transient glitch?" | Both |
| 3 | `LlmAgent` | News / social confirmation — corroborates with real-world signals | Depeg only |

A denial at any step (agent failure, timeout, or `NO` answer) cancels the batch — positions stay active and no payout is issued.

---

## Smart Contracts

All contracts are deployed and verified on **Somnia Testnet (chain ID 50312)**.

| Contract | Address | Role |
|----------|---------|------|
| `PolicyVault` | [`0x4f6D51B207F1eA053bF224b72316c4DAF170A40A`](https://shannon-explorer.somnia.network/address/0x4f6D51B207F1eA053bF224b72316c4DAF170A40A#code) | USDso liquidity pool; mints `sLP` shares to LPs |
| `InsuranceCore` | [`0x5603426365FC334E3eaF8c31c59BDA8ED223A127`](https://shannon-explorer.somnia.network/address/0x5603426365FC334E3eaF8c31c59BDA8ED223A127#code) | Products, positions, trigger initiation |
| `ClaimProcessor` | [`0x81066a0d13e6C359360954516Ad63F6B1aFd638E`](https://shannon-explorer.somnia.network/address/0x81066a0d13e6C359360954516Ad63F6B1aFd638E#code) | Receives agent consensus; executes payouts |
| `AgentOrchestrator` | [`0xA50F7Fd25DdC86546202f7501873EB7E66175BD3`](https://shannon-explorer.somnia.network/address/0xA50F7Fd25DdC86546202f7501873EB7E66175BD3#code) | Routes requests to Somnia Agent Platform |
| `USDso` (testnet) | [`0x9c32F3827A1a99f0cf9B213de8b53eC3d57bb171`](https://shannon-explorer.somnia.network/address/0x9c32F3827A1a99f0cf9B213de8b53eC3d57bb171) | Testnet payment token — 1 USDso = 100,000 USDso coverage value, so small amounts suffice for testing |

**Deployer / owner:** `0xD7Fd52209711c94A3Fcc4f3aeB3668d2Df829254`

**Somnia Agent Platform (testnet):** `0x037Bb9C718F3f7fe5eCBDB0b600D607b52706776`

---

## Monorepo Layout

```
.
├── apps/
│   ├── web/          # Vite + React frontend (RainbowKit wallet, live contract reads)
│   └── tracker/      # Node.js off-chain monitor + REST/WebSocket API
├── packages/
│   ├── contracts/    # Hardhat — Solidity contracts + deploy scripts
│   ├── shared-types/ # Domain types shared across apps
│   └── config/       # Chain constants, ABIs, demo seed data
├── turbo.json
└── package.json
```

### `apps/web`
React SPA built with Vite, Wagmi v2, and RainbowKit. Pages:

- **Home** — protocol overview, live TVL / position counts, 3D agent network scene
- **Cover** — browse depeg / rug products, set coverage amount, buy on-chain
- **Earn** — deposit USDso as LP, view utilization tier, withdraw sLP shares
- **Dashboard** — live position list with agent log timeline per position
- **Analytics** — protocol-wide stats (TVL, paid claims, active products)

### `apps/tracker`
Node.js service that watches the chain and triggers agent validation batches:

| Monitor | Interval | What it does |
|---------|----------|-------------|
| `depegMonitor` | 60 s | Polls stablecoin price; calls `startDepegValidationBatch` when price < 0.97 |
| `rugMonitor` | 90 s | Polls pool liquidity; calls `startRugValidationBatch` when below threshold |
| `expiryMonitor` | 5 min | Cancels expired positions on-chain |
| `pendingMonitor` | 2 min | Retries stuck pending positions |

The tracker also exposes a REST + WebSocket API used by the frontend for live position data and agent log events.

### `packages/contracts`
Hardhat workspace. Key contracts:

- **`PolicyVault.sol`** — ERC-20 LP shares (`sLP`); dynamic yield multiplier (1×–3×) based on utilization
- **`InsuranceCore.sol`** — product registry, position lifecycle, trigger initiation
- **`ClaimProcessor.sol`** — permissioned by `AgentOrchestrator`; writes claim + calls vault payout
- **`AgentOrchestrator.sol`** — 3-step pipeline implementation; callback handlers for each agent type

---

## Local Development

### Prerequisites

- Node.js ≥ 18, Yarn 4.x (Berry)
- An RPC endpoint for Somnia Testnet (`https://api.infra.testnet.somnia.network`)
- A funded testnet wallet (STT for gas, testnet USDso)

### Install

```bash
yarn install
```

### Environment

**`packages/contracts/.env`**
```
PRIVATE_KEY=0x...
SOMNIA_TESTNET_RPC_URL=https://api.infra.testnet.somnia.network
USDSO_ADDRESS=0x9c32F3827A1a99f0cf9B213de8b53eC3d57bb171
```

**`apps/tracker/.env`**
```
TRACKER_PRIVATE_KEY=0x...
SOMNIA_HTTP_RPC_URL=https://api.infra.testnet.somnia.network
SOMNIA_WS_RPC_URL=wss://api.infra.testnet.somnia.network/ws
DATABASE_URL=postgresql://user:password@localhost:5432/sentri
CORE_ADDRESS=0x5603426365FC334E3eaF8c31c59BDA8ED223A127
VAULT_ADDRESS=0x4f6D51B207F1eA053bF224b72316c4DAF170A40A
AGENT_ORCHESTRATOR_ADDRESS=0xA50F7Fd25DdC86546202f7501873EB7E66175BD3
DEPLOY_BLOCK=405829190
PORT=4000
```

**`apps/web/.env.local`**
```
VITE_CORE_ADDRESS=0x5603426365FC334E3eaF8c31c59BDA8ED223A127
VITE_VAULT_ADDRESS=0x4f6D51B207F1eA053bF224b72316c4DAF170A40A
VITE_USDSO_ADDRESS=0x9c32F3827A1a99f0cf9B213de8b53eC3d57bb171
VITE_ORCHESTRATOR_ADDRESS=0xA50F7Fd25DdC86546202f7501873EB7E66175BD3
VITE_TRACKER_URL=http://localhost:4000
```

### Run

```bash
# Frontend (http://localhost:5173)
yarn web:dev

# Tracker service (http://localhost:4000)
yarn tracker:dev
```

### Compile & deploy contracts

```bash
# Compile
yarn contracts:compile

# Deploy to Somnia testnet (already deployed — only needed for fresh deploys)
yarn workspace @sentri/contracts hardhat run scripts/deploy.ts --network somniaTestnet
```

### Set agent IDs (post-deploy)

After obtaining agent IDs from [agents.somnia.network](https://agents.somnia.network), wire them into the orchestrator:

```bash
yarn workspace @sentri/contracts hardhat run scripts/setAgentIds.ts --network somniaTestnet
```

Or call `AgentOrchestrator.setAgentIds(jsonApiAgentId, llmAgentId)` directly.

### Verify contracts (post-deploy)

Add `EXPLORER_API_KEY` to `packages/contracts/.env`, then run one command per contract:

```bash
cd packages/contracts

npx hardhat verify --network somniaTestnet \
  <POLICY_VAULT_ADDRESS> "<USDSO_ADDRESS>"

npx hardhat verify --network somniaTestnet \
  <INSURANCE_CORE_ADDRESS> "<POLICY_VAULT_ADDRESS>"

npx hardhat verify --network somniaTestnet \
  <CLAIM_PROCESSOR_ADDRESS> "<INSURANCE_CORE_ADDRESS>" "<POLICY_VAULT_ADDRESS>"

npx hardhat verify --network somniaTestnet \
  <AGENT_ORCHESTRATOR_ADDRESS> "0x037Bb9C718F3f7fe5eCBDB0b600D607b52706776" "<INSURANCE_CORE_ADDRESS>" "<CLAIM_PROCESSOR_ADDRESS>"
```

---

## LP Yield Model

LPs earn premiums dynamically scaled by pool utilization:

| Utilization | Multiplier |
|-------------|-----------|
| < 50 % | 1× |
| 50 – 70 % | 1.5× |
| 70 – 90 % | 2× |
| > 90 % | 3× |

Higher utilization means more capital at risk, so the protocol rewards LPs accordingly. The multiplier is applied at deposit time and stored in `PolicyVault.utilizationMultiplierBps`.

---

## Payout Logic

**Depeg (proportional):**
```
payout = coverage × (threshold − triggerPrice) / threshold
```
Example: $5,000 coverage, threshold $0.97, price at $0.90 → payout ≈ $360

**Rug pull (binary):**
```
payout = coverage (full)
```
A confirmed rug is near-total loss; proportional payouts would be meaningless.

---

## Tech Stack

| Layer | Stack |
|-------|-------|
| Smart contracts | Solidity 0.8.24, Hardhat, OpenZeppelin |
| Agent platform | Somnia Agents (JSON API + LLM inference agents) |
| Frontend | React 18, Vite, Wagmi v2, RainbowKit, Framer Motion |
| Tracker | Node.js, TypeScript, viem |
| Monorepo | Yarn Workspaces, Turborepo |
| Deployment | Railway (web + tracker), Somnia Testnet |
