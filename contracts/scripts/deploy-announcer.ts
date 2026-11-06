import { ethers, network } from "hardhat";
import {
  CANONICAL_ANNOUNCER,
  assertFuji,
  logHeading,
  readDeployment,
  requireFundedDeployer,
  writeDeployment,
} from "./lib";

/**
 * Deploys the ERC-5564 reference Announcer — but only if the canonical
 * singleton is genuinely absent on this network.
 */
async function main() {
  const chainId = await assertFuji();
  const { address: deployer, balance } = await requireFundedDeployer();

  logHeading("Announcer deployment");
  console.log(`Network:  ${network.name} (chain ${chainId})`);
  console.log(`Deployer: ${deployer}`);
  console.log(`Balance:  ${ethers.formatEther(balance)} AVAX`);

  // Never deploy a duplicate over a working canonical singleton.
  const canonicalCode = await ethers.provider.getCode(CANONICAL_ANNOUNCER);
  if (canonicalCode !== "0x") {
    logHeading("Canonical Announcer already present — reusing");
    console.log(`Address: ${CANONICAL_ANNOUNCER}`);
    writeDeployment({
      ...readDeployment(network.name),
      network: network.name,
      chainId: chainId.toString(),
      announcer: CANONICAL_ANNOUNCER,
      announcerSource: "canonical-reused",
      deployer,
      deployedAt: new Date().toISOString(),
      notes: "Canonical ERC-5564 Announcer found on-chain and reused.",
    });
    return;
  }

  const existing = readDeployment(network.name);
  if (existing.announcer) {
    const code = await ethers.provider.getCode(existing.announcer);
    if (code !== "0x") {
      logHeading("Announcer already deployed by this project — reusing");
      console.log(`Address: ${existing.announcer}`);
      return;
    }
  }

  const announcer = await ethers.deployContract("ERC5564Announcer");
  await announcer.waitForDeployment();
  const address = await announcer.getAddress();
  const receipt = await announcer.deploymentTransaction()?.wait();

  logHeading("Deployed");
  console.log(`Announcer: ${address}`);
  console.log(`Tx:        ${receipt?.hash}`);
  console.log(`Explorer:  https://testnet.snowtrace.io/address/${address}`);

  writeDeployment({
    ...existing,
    network: network.name,
    chainId: chainId.toString(),
    announcer: address,
    announcerSource: "deployed-reference",
    deployer,
    deployedAt: new Date().toISOString(),
    notes:
      "Canonical address 0x55649E...45564 has no code on Fuji and its deterministic " +
      "init code/salt are not published by the ERC, so the reference implementation " +
      "was deployed here instead. Event signature is byte-identical to canonical.",
  });
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
