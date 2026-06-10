import dotenv from "dotenv";
import hre from "hardhat";

dotenv.config();

// Somnia Agents platform (testnet 50312)
const AGENT_PLATFORM = "0x037Bb9C718F3f7fe5eCBDB0b600D607b52706776";

// Amount of STT to pre-fund the orchestrator with (covers ~10 full 3-agent pipelines)
const ORCHESTRATOR_FUND_STT = hre.ethers.parseEther("2.0");

async function main() {
  const { ethers } = hre;
  const [deployer] = await ethers.getSigners();

  const usdsoAddress = process.env.USDSO_ADDRESS;
  if (!usdsoAddress) throw new Error("USDSO_ADDRESS must be set.");

  console.log("Deploying with account:", deployer.address);
  console.log("Account balance (STT):", ethers.formatEther(await ethers.provider.getBalance(deployer.address)));

  // 1. PolicyVault
  const vaultFactory = await ethers.getContractFactory("PolicyVault");
  const vault = await vaultFactory.deploy(usdsoAddress);
  await vault.waitForDeployment();
  console.log("PolicyVault:", await vault.getAddress());

  // 2. InsuranceCore
  const coreFactory = await ethers.getContractFactory("InsuranceCore");
  const core = await coreFactory.deploy(await vault.getAddress());
  await core.waitForDeployment();
  console.log("InsuranceCore:", await core.getAddress());

  // 3. ClaimProcessor
  const claimFactory = await ethers.getContractFactory("ClaimProcessor");
  const claimProcessor = await claimFactory.deploy(
    await core.getAddress(),
    await vault.getAddress(),
  );
  await claimProcessor.waitForDeployment();
  console.log("ClaimProcessor:", await claimProcessor.getAddress());

  // 4. AgentOrchestrator — takes (platformAddress, coreAddress, claimProcessorAddress)
  const orchestratorFactory = await ethers.getContractFactory("AgentOrchestrator");
  const orchestrator = await orchestratorFactory.deploy(
    AGENT_PLATFORM,
    await core.getAddress(),
    await claimProcessor.getAddress(),
  );
  await orchestrator.waitForDeployment();
  console.log("AgentOrchestrator:", await orchestrator.getAddress());

  // 5. Wire up roles
  await (await vault.setCore(await core.getAddress())).wait();
  await (await vault.setClaimProcessor(await claimProcessor.getAddress())).wait();
  await (await core.setClaimProcessor(await claimProcessor.getAddress())).wait();
  await (await core.setAgentOrchestrator(await orchestrator.getAddress())).wait();
  await (await claimProcessor.setAgentOrchestrator(await orchestrator.getAddress())).wait();
  // Tracker address = deployer (same key used for both in this setup)
  await (await core.setTracker(deployer.address)).wait();
  console.log("Tracker set to:", deployer.address);

  // 6. Fund the orchestrator with STT so it can pay for agent calls
  const fundTx = await deployer.sendTransaction({
    to: await orchestrator.getAddress(),
    value: ORCHESTRATOR_FUND_STT,
  });
  await fundTx.wait();
  console.log(`Funded orchestrator with ${ethers.formatEther(ORCHESTRATOR_FUND_STT)} STT`);

  // 7. NOTE: Set agent IDs after deployment once you have them from agents.somnia.network
  // await orchestrator.setAgentIds(<JSON_API_AGENT_ID>, <LLM_AGENT_ID>);

  // 8. Create demo products
  //
  // Depeg products use PROPORTIONAL payout: coverage × (threshold − price) / threshold
  //   e.g. $5 000 coverage, price drops to $0.90:
  //        payout = 5000 × (0.97 − 0.90) / 0.97 = $360.82
  //   Premium rate is annual; pro-rated over the policy duration.
  //   150 bps p.a. reflects low expected severity (proportional, not full).
  //
  // Rug product uses BINARY full payout — a rug is near-total loss.
  //   800 bps p.a. reflects higher event probability + full payout exposure.

  const DEPEG_THRESHOLD = ethers.parseEther("0.97"); // triggers below $0.97

  // Product 1 — USDC Depeg 30-day
  //   $5 000 max coverage, 400 bps p.a.
  //   LP APY at 50% util / 1.5x: ~3%  |  at 90%+ / 3x: ~10%+
  //   Premium examples: $1 000 → $3.29  |  $5 000 → $16.44
  const depeg30dTx = await core.createDepegProduct(
    "USDC Depeg 30d",
    "0x0000000000000000000000000000000000000000",
    DEPEG_THRESHOLD,
    400,                            // 4.0% p.a.
    86400 * 30,                     // 30 days
    ethers.parseUnits("5000", 13),   // max $5 000 per position
    ethers.parseUnits("200000", 13), // pool limit $200 k
  );
  await depeg30dTx.wait();

  // Product 2 — USDC Depeg 90-day
  //   $10 000 max coverage, 350 bps p.a. (slight discount for longer lock-in)
  //   Premium examples: $1 000 → $8.63  |  $10 000 → $86.30
  const depeg90dTx = await core.createDepegProduct(
    "USDC Depeg 90d",
    "0x0000000000000000000000000000000000000000",
    DEPEG_THRESHOLD,
    350,                            // 3.5% p.a.
    86400 * 90,                     // 90 days
    ethers.parseUnits("10000", 13),  // max $10 000 per position
    ethers.parseUnits("300000", 13), // pool limit $300 k
  );
  await depeg90dTx.wait();

  // Product 3 — Rug Pull Protection 30-day (binary full payout)
  //   Triggers when pool liquidity drops below 50 % of reference TVL.
  //   $3 000 max coverage, 1200 bps p.a. (full payout on trigger warrants higher rate)
  //   Premium examples: $1 000 → $9.86  |  $3 000 → $29.59
  const rugTx = await core.createRugProduct(
    "Rug Pull Protection 30d",
    "0x0000000000000000000000000000000000000001",
    "0x0000000000000000000000000000000000000002",
    5000,                           // trigger when ≤ 50 % liquidity remains
    1200,                           // 12% p.a.
    86400 * 30,                     // 30 days
    ethers.parseUnits("3000", 13),   // max $3 000 per position
    ethers.parseUnits("100000", 13), // pool limit $100 k
    ethers.parseUnits("500000", 13), // reference TVL $500 k
  );
  await rugTx.wait();

  // Product 4 — USDC Depeg 1-hour (demo only — expires quickly for testing expiry flow)
  //   Premium hits the $1 floor regardless of amount (1h is tiny vs 365d).
  const depeg1hTx = await core.createDepegProduct(
    "USDC Depeg 1h (Demo)",
    "0x0000000000000000000000000000000000000000",
    DEPEG_THRESHOLD,
    400,                            // 4.0% p.a. (same as 30d; premium will floor at $1)
    3600,                           // 1 hour
    ethers.parseUnits("5000", 13),   // max $5 000 per position
    ethers.parseUnits("50000", 13),  // pool limit $50 k
  );
  await depeg1hTx.wait();

  console.log("Created 4 demo products");

  // 9. Print final addresses for .env files
  const addresses = {
    PolicyVault:       await vault.getAddress(),
    InsuranceCore:     await core.getAddress(),
    ClaimProcessor:    await claimProcessor.getAddress(),
    AgentOrchestrator: await orchestrator.getAddress(),
  };

  console.log("\n=== Deployed addresses ===");
  console.table(addresses);

  console.log("\n=== Add to apps/tracker/.env ===");
  console.log(`TRACKER_PRIVATE_KEY=${process.env.PRIVATE_KEY}`);
  console.log(`CORE_ADDRESS=${addresses.InsuranceCore}`);
  console.log(`VAULT_ADDRESS=${addresses.PolicyVault}`);
  console.log(`AGENT_ORCHESTRATOR_ADDRESS=${addresses.AgentOrchestrator}`);

  console.log("\n=== Add to apps/web/.env.local ===");
  console.log(`VITE_CORE_ADDRESS=${addresses.InsuranceCore}`);
  console.log(`VITE_VAULT_ADDRESS=${addresses.PolicyVault}`);
  console.log(`VITE_USDSO_ADDRESS=${usdsoAddress}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
