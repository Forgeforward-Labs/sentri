/**
 * Verifies all deployed contracts on Somnia Testnet (Blockscout explorer).
 * Uses Standard JSON Input directly — bypasses hardhat-verify's Blockscout incompatibility.
 *
 * Usage:
 *   npx ts-node --esm scripts/verify-blockscout.ts
 *   OR
 *   npx hardhat run scripts/verify-blockscout.ts --network somniaTestnet
 */

import { ethers } from "ethers";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const EXPLORER_API = "https://shannon-explorer.somnia.network/api";
const COMPILER_VERSION = "v0.8.24+commit.e11b9ed9";

// ── Deployed addresses ────────────────────────────────────────────
const USDSO_ADDRESS         = "0x9c32F3827A1a99f0cf9B213de8b53eC3d57bb171";
const POLICY_VAULT          = "0x4f6D51B207F1eA053bF224b72316c4DAF170A40A";
const INSURANCE_CORE        = "0x5603426365FC334E3eaF8c31c59BDA8ED223A127";
const CLAIM_PROCESSOR       = "0x81066a0d13e6C359360954516Ad63F6B1aFd638E";
const AGENT_ORCHESTRATOR    = "0xA50F7Fd25DdC86546202f7501873EB7E66175BD3";
const AGENT_PLATFORM        = "0x037Bb9C718F3f7fe5eCBDB0b600D607b52706776";

// ── Helpers ───────────────────────────────────────────────────────

function encodeAddress(addr: string): string {
  return ethers.zeroPadValue(addr, 32).slice(2); // 32-byte ABI-encoded address, no 0x
}

/** Reads the Standard JSON Input from the build-info file that contains all 4 contracts. */
function getStandardJsonInput(): string {
  const buildInfoDir = path.join(__dirname, "../artifacts/build-info");
  const files = fs.readdirSync(buildInfoDir);

  for (const file of files) {
    const raw = fs.readFileSync(path.join(buildInfoDir, file), "utf8");
    const info = JSON.parse(raw);
    const sources = Object.keys(info.input?.sources ?? {});
    if (
      sources.some((s) => s.includes("PolicyVault")) &&
      sources.some((s) => s.includes("InsuranceCore")) &&
      sources.some((s) => s.includes("AgentOrchestrator"))
    ) {
      return JSON.stringify(info.input);
    }
  }
  throw new Error("Could not find build-info with all 4 contracts. Run `hardhat compile` first.");
}

async function verifyContract(params: {
  address: string;
  contractName: string;       // e.g. "PolicyVault"
  contractFile: string;       // e.g. "contracts/PolicyVault.sol"
  constructorArgsHex: string; // ABI-encoded args, no 0x prefix
  sourceInput: string;
}) {
  const { address, contractName, contractFile, constructorArgsHex, sourceInput } = params;

  console.log(`\n▶ Verifying ${contractName} at ${address}…`);

  const body = new URLSearchParams({
    apikey:                  "abc",
    contractaddress:         address,
    contractname:            `${contractFile}:${contractName}`,
    compilerversion:         COMPILER_VERSION,
    codeformat:              "solidity-standard-json-input",
    sourceCode:              sourceInput,
    constructorArguements:   constructorArgsHex, // Etherscan API typo preserved
    optimizationUsed:        "1",
    runs:                    "200",
  });

  const res = await fetch(
    `${EXPLORER_API}?module=contract&action=verifysourcecode`,
    {
      method:  "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body:    body.toString(),
    },
  );

  const json = await res.json() as { status: string; message: string; result?: string };
  console.log("  →", json);

  if (json.status !== "1" && json.message !== "OK") {
    // Blockscout may queue verification; check status with the returned GUID
    if (json.result && json.result.length === 32) {
      console.log("  ↻ Verification queued, GUID:", json.result);
      await pollVerification(json.result);
    } else {
      console.error("  ✗ Verification failed:", json.message, json.result ?? "");
    }
  } else {
    console.log(`  ✓ ${contractName} submitted for verification`);
  }
}

async function pollVerification(guid: string, attempts = 8) {
  for (let i = 0; i < attempts; i++) {
    await new Promise((r) => setTimeout(r, 5000));
    const res = await fetch(
      `${EXPLORER_API}?module=contract&action=checkverifystatus&guid=${guid}`,
    );
    const json = await res.json() as { status: string; message: string; result?: string };
    console.log("  ↻ Poll:", json.result ?? json.message);
    if (json.result === "Pass - Verified") {
      console.log("  ✓ Verified!");
      return;
    }
    if (json.result?.startsWith("Fail")) {
      console.error("  ✗ Verification failed:", json.result);
      return;
    }
  }
  console.warn("  ⚠ Timed out waiting for verification. Check the explorer manually.");
}

// ── Main ──────────────────────────────────────────────────────────

async function main() {
  const sourceInput = getStandardJsonInput();
  console.log("Using Standard JSON Input from build-info");

  await verifyContract({
    address:             POLICY_VAULT,
    contractName:        "PolicyVault",
    contractFile:        "contracts/PolicyVault.sol",
    constructorArgsHex:  encodeAddress(USDSO_ADDRESS),
    sourceInput,
  });

  await verifyContract({
    address:             INSURANCE_CORE,
    contractName:        "InsuranceCore",
    contractFile:        "contracts/InsuranceCore.sol",
    constructorArgsHex:  encodeAddress(POLICY_VAULT),
    sourceInput,
  });

  await verifyContract({
    address:             CLAIM_PROCESSOR,
    contractName:        "ClaimProcessor",
    contractFile:        "contracts/ClaimProcessor.sol",
    constructorArgsHex:  encodeAddress(INSURANCE_CORE) + encodeAddress(POLICY_VAULT),
    sourceInput,
  });

  await verifyContract({
    address:             AGENT_ORCHESTRATOR,
    contractName:        "AgentOrchestrator",
    contractFile:        "contracts/AgentOrchestrator.sol",
    constructorArgsHex:  encodeAddress(AGENT_PLATFORM) + encodeAddress(INSURANCE_CORE) + encodeAddress(CLAIM_PROCESSOR),
    sourceInput,
  });

  console.log("\nDone. Visit https://shannon-explorer.somnia.network to confirm verification.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
