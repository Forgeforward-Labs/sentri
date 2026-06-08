import dotenv from "dotenv";
import hre from "hardhat";

dotenv.config();

// ── Fill these in from https://agents.somnia.network ──────────────────────────
const JSON_API_AGENT_ID = 0n;   // e.g. 3n
const LLM_AGENT_ID      = 0n;   // e.g. 7n
// ──────────────────────────────────────────────────────────────────────────────

// Updated after redeploy — also set in packages/contracts/.env via AGENT_ORCHESTRATOR_ADDRESS
const ORCHESTRATOR_ADDRESS = process.env.AGENT_ORCHESTRATOR_ADDRESS ?? "0x549Ff84A34828A3F798fC818BA41dB8D2bE13DBb";

async function main() {
  if (!ORCHESTRATOR_ADDRESS) throw new Error("AGENT_ORCHESTRATOR_ADDRESS not set in .env");
  if (JSON_API_AGENT_ID === 0n || LLM_AGENT_ID === 0n) {
    throw new Error("Fill in JSON_API_AGENT_ID and LLM_AGENT_ID before running");
  }

  const { ethers } = hre;
  const [deployer] = await ethers.getSigners();
  console.log("Caller:", deployer.address);

  const abi = ["function setAgentIds(uint256 jsonApiAgentId, uint256 llmAgentId) external"];
  const orchestrator = new ethers.Contract(ORCHESTRATOR_ADDRESS, abi, deployer);

  const tx = await orchestrator.setAgentIds(JSON_API_AGENT_ID, LLM_AGENT_ID);
  await tx.wait();

  console.log(`✓ Agent IDs set — JSON API: ${JSON_API_AGENT_ID}, LLM: ${LLM_AGENT_ID}`);
  console.log("tx:", tx.hash);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
