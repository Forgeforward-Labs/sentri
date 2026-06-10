/**
 * Demo script — manually triggers a depeg claim for all active positions in a product.
 *
 * Usage:
 *   PRODUCT_ID=1 OBSERVED_PRICE=0.94 npx hardhat run scripts/triggerDepeg.ts --network somniaTestnet
 *
 * PRODUCT_ID    — which product to trigger (default: 1 = USDC Depeg 24h)
 * OBSERVED_PRICE — fake observed price in USD, e.g. 0.94 (must be below product threshold of 0.97)
 */
import dotenv from "dotenv";
import hre from "hardhat";

dotenv.config();

const CORE_ADDRESS = process.env.CORE_ADDRESS;
if (!CORE_ADDRESS) throw new Error("CORE_ADDRESS must be set in .env");

const PRODUCT_ID = Number(process.env.PRODUCT_ID ?? "1");
const OBSERVED_PRICE_USD = parseFloat(process.env.OBSERVED_PRICE ?? "0.94");

async function main() {
  const { ethers } = hre;
  const [signer] = await ethers.getSigners();

  const core = await ethers.getContractAt("InsuranceCore", CORE_ADDRESS!, signer);

  const observedPriceWad = ethers.parseEther(OBSERVED_PRICE_USD.toFixed(18));

  console.log(`Triggering depeg for product #${PRODUCT_ID}`);
  console.log(`  Observed price: $${OBSERVED_PRICE_USD} (${observedPriceWad.toString()} WAD)`);

  const tx = await core.adminInitiateDepeg(PRODUCT_ID, observedPriceWad);
  console.log(`  tx: ${tx.hash}`);
  await tx.wait();
  console.log("  Done — agents are now validating.");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
