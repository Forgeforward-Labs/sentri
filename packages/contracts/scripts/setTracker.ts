/**
 * Sets the tracker address on InsuranceCore.
 * Run after deployment if setTracker was not called automatically.
 *
 * Usage:
 *   npx hardhat run scripts/setTracker.ts --network somniaTestnet
 */
import dotenv from "dotenv";
import hre from "hardhat";

dotenv.config();

const CORE_ADDRESS = process.env.CORE_ADDRESS;
const TRACKER_ADDRESS = process.env.TRACKER_ADDRESS ?? process.env.DEPLOYER_ADDRESS;

if (!CORE_ADDRESS) throw new Error("CORE_ADDRESS must be set");
if (!TRACKER_ADDRESS) throw new Error("TRACKER_ADDRESS or DEPLOYER_ADDRESS must be set");

async function main() {
  const { ethers } = hre;
  const [signer] = await ethers.getSigners();
  const core = await ethers.getContractAt("InsuranceCore", CORE_ADDRESS!, signer);

  console.log(`Setting tracker to ${TRACKER_ADDRESS} on ${CORE_ADDRESS}`);
  const tx = await core.setTracker(TRACKER_ADDRESS);
  await tx.wait();
  console.log("Done.", tx.hash);
}

main().catch((err) => { console.error(err); process.exitCode = 1; });
