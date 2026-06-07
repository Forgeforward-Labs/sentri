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

  const usdcAddress = process.env.USDC_ADDRESS;
  if (!usdcAddress) throw new Error("USDC_ADDRESS must be set.");

  console.log("Deploying with account:", deployer.address);
  console.log("Account balance (STT):", ethers.formatEther(await ethers.provider.getBalance(deployer.address)));

  // 1. PolicyVault
  const vaultFactory = await ethers.getContractFactory("PolicyVault");
  const vault = await vaultFactory.deploy(usdcAddress);
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

  // 6. Fund the orchestrator with STT so it can pay for agent calls
  const fundTx = await deployer.sendTransaction({
    to: await orchestrator.getAddress(),
    value: ORCHESTRATOR_FUND_STT,
  });
  await fundTx.wait();
  console.log(`Funded orchestrator with ${ethers.formatEther(ORCHESTRATOR_FUND_STT)} STT`);

  // 7. NOTE: Set agent IDs after deployment once you have them from agents.somnia.network
  // await orchestrator.setAgentIds(<JSON_API_AGENT_ID>, <LLM_AGENT_ID>);

  // 8. Create demo products (owner = deployer, tracker not set yet)
  //    threshold: 0.97e18 for depeg (18-decimal WAD)
  const DEPEG_THRESHOLD = ethers.parseEther("0.97");

  const depeg24hTx = await core.createDepegProduct(
    "USDC Depeg 24h",
    "0x0000000000000000000000000000000000000000", // pool address (demo)
    DEPEG_THRESHOLD,
    15,                          // 0.15% premium rate bps
    86400,                       // 1 day in seconds
    ethers.parseUnits("1000", 6), // max $1000 per position (USDC 6-decimal)
    ethers.parseUnits("100000", 6), // pool limit $100k
  );
  await depeg24hTx.wait();

  const depeg7dTx = await core.createDepegProduct(
    "USDC Depeg 7d",
    "0x0000000000000000000000000000000000000000",
    DEPEG_THRESHOLD,
    105,
    86400 * 7,
    ethers.parseUnits("5000", 6),
    ethers.parseUnits("150000", 6),
  );
  await depeg7dTx.wait();

  const rugTx = await core.createRugProduct(
    "TOKEN_X Rug Protection",
    "0x0000000000000000000000000000000000000001", // token
    "0x0000000000000000000000000000000000000002", // pool
    5000, // 50% liquidity threshold in bps
    500,  // 5% premium rate bps
    ethers.parseUnits("3000", 6),
    ethers.parseUnits("90000", 6),
    ethers.parseUnits("500000", 6), // reference TVL
  );
  await rugTx.wait();

  console.log("Created 3 demo products");

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
  console.log(`VITE_USDC_ADDRESS=${usdcAddress}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
