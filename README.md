# Sentri Protocol Monorepo

This Yarn workspaces monorepo is scaffolded directly from the `Sentri Protocol` SRD and mirrors the four main delivery layers described in the document:

- `apps/web`: Vite + React frontend for landing, coverage, LP dashboard, and position detail flows.
- `apps/tracker`: Node.js tracker service with the monitor modules named in the SRD and a small dashboard API/WebSocket server.
- `packages/contracts`: Hardhat workspace with Solidity stubs for `InsuranceCore`, `PolicyVault`, `AgentOrchestrator`, and `ClaimProcessor`.
- `packages/shared-types`: Cross-workspace domain types for products, positions, logs, and pool stats.
- `packages/config`: Shared constants and demo seed data used by the web and tracker apps.

## Workspace Layout

```text
.
├── apps
│   ├── tracker
│   └── web
├── packages
│   ├── config
│   ├── contracts
│   └── shared-types
├── package.json
└── tsconfig.base.json
```

## Quick Start

1. Install dependencies:

   ```bash
   yarn install
   ```

2. Start the web app:

   ```bash
   yarn web:dev
   ```

3. Start the tracker service:

   ```bash
   yarn tracker:dev
   ```

4. Compile contracts:

   ```bash
   yarn contracts:compile
   ```

## SRD-to-Code Mapping

- **Frontend routes** from section 8.1 are scaffolded under `apps/web/app`.
- **Tracker modules** from section 5.2 are scaffolded under `apps/tracker/src/monitors` and `apps/tracker/src/services`.
- **Contracts** from section 4 are scaffolded in `packages/contracts/contracts`.
- **Domain models and demo data** are centralized in `packages/shared-types` and `packages/config` so each workspace starts from the same protocol vocabulary.

## Next Steps

1. Replace the demo data in `packages/config` with live reads from the deployed contracts and tracker database.
2. Flesh out the Solidity stubs into production contract logic and add the full Hardhat test suite described in the SRD.
3. Swap the tracker's in-memory state for PostgreSQL persistence and wire in Somnia WebSocket subscriptions.
4. Add shadcn/ui components and the live wallet flow to the frontend.
