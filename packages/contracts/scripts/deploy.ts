import dotenv from "dotenv";
import hre from "hardhat";

dotenv.config();

async function main() {
  const { ethers } = hre;
  const usdcAddress = process.env.USDC_ADDRESS;
  const somniaAgentsAddress = process.env.SOMNIA_AGENTS_ADDRESS;

  if (!usdcAddress || !somniaAgentsAddress) {
    throw new Error("USDC_ADDRESS and SOMNIA_AGENTS_ADDRESS must be set.");
  }

  const policyVaultFactory = await ethers.getContractFactory("PolicyVault");
  const policyVault = await policyVaultFactory.deploy(usdcAddress);
  await policyVault.waitForDeployment();

  const insuranceCoreFactory = await ethers.getContractFactory("InsuranceCore");
  const insuranceCore = await insuranceCoreFactory.deploy(await policyVault.getAddress());
  await insuranceCore.waitForDeployment();

  const claimProcessorFactory = await ethers.getContractFactory("ClaimProcessor");
  const claimProcessor = await claimProcessorFactory.deploy(
    await insuranceCore.getAddress(),
    await policyVault.getAddress(),
  );
  await claimProcessor.waitForDeployment();

  const orchestratorFactory = await ethers.getContractFactory("AgentOrchestrator");
  const orchestrator = await orchestratorFactory.deploy(
    await insuranceCore.getAddress(),
    await claimProcessor.getAddress(),
    somniaAgentsAddress,
  );
  await orchestrator.waitForDeployment();

  await (await policyVault.setCore(await insuranceCore.getAddress())).wait();
  await (await policyVault.setClaimProcessor(await claimProcessor.getAddress())).wait();
  await (await insuranceCore.setClaimProcessor(await claimProcessor.getAddress())).wait();
  await (await insuranceCore.setTracker(ethers.ZeroAddress)).wait();
  await (await insuranceCore.setAgentOrchestrator(await orchestrator.getAddress())).wait();
  await (await claimProcessor.setAgentOrchestrator(await orchestrator.getAddress())).wait();

  console.table({
    PolicyVault: await policyVault.getAddress(),
    InsuranceCore: await insuranceCore.getAddress(),
    ClaimProcessor: await claimProcessor.getAddress(),
    AgentOrchestrator: await orchestrator.getAddress(),
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
