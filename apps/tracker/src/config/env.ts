import dotenv from "dotenv";

dotenv.config();

const parsePort = (value: string | undefined) => {
  const port = Number(value ?? "4000");

  if (!Number.isFinite(port)) {
    throw new Error("PORT must be a number.");
  }

  return port;
};

export const env = {
  host: process.env.HOST ?? "0.0.0.0",
  port: parsePort(process.env.PORT),
  somniaHttpRpcUrl: process.env.SOMNIA_HTTP_RPC_URL ?? "https://dream-rpc.somnia.network",
  somniaWsRpcUrl: process.env.SOMNIA_WS_RPC_URL ?? "wss://dream-rpc.somnia.network/ws",
  coingeckoBaseUrl: process.env.COINGECKO_BASE_URL ?? "https://api.coingecko.com/api/v3",
  trackerPrivateKey: process.env.TRACKER_PRIVATE_KEY ?? "",
  coreAddress: process.env.CORE_ADDRESS ?? "",
  vaultAddress: process.env.VAULT_ADDRESS ?? "",
  agentOrchestratorAddress: process.env.AGENT_ORCHESTRATOR_ADDRESS ?? "",

  databaseUrl: process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/sentri",

  deployBlock: process.env.DEPLOY_BLOCK ? BigInt(process.env.DEPLOY_BLOCK) : undefined,

  get hasContracts() {
    return Boolean(this.coreAddress && this.vaultAddress);
  },
};
