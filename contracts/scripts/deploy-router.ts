import { ethers, network } from "hardhat";
import {
  assertFuji,
  envOverride,
  logHeading,
  readDeployment,
  requireFundedDeployer,
  writeDeployment,
} from "./lib";

async function main() {
  const chainId = await assertFuji();
  const { address: deployer, balance } = await requireFundedDeployer();

  const record = readDeployment(network.name);
  const announcer = envOverride(process.env.FUJI_ANNOUNCER_ADDRESS) ?? record.announcer;

  if (!announcer) {
    throw new Error(
      "No Announcer address known. Run `npm run deploy:announcer:fuji` first, " +
        "or set FUJI_ANNOUNCER_ADDRESS.",
    );
  }

  // The router pins the Announcer immutably, so a wrong address here is
  // unfixable without redeploying. Verify it has code first.
  const code = await ethers.provider.getCode(announcer);
  if (code === "0x") {
    throw new Error(
      `Configured Announcer ${announcer} has no code on chain ${chainId}. Refusing to deploy.`,
    );
  }

  logHeading("Router deployment");
  console.log(`Network:   ${network.name} (chain ${chainId})`);
  console.log(`Deployer:  ${deployer}`);
  console.log(`Balance:   ${ethers.formatEther(balance)} AVAX`);
  console.log(`Announcer: ${announcer} (${(code.length - 2) / 2} bytes)`);

  const router = await ethers.deployContract("StealthPaymentRouter", [
    announcer,
  ]);
  await router.waitForDeployment();
  const address = await router.getAddress();
  const receipt = await router.deploymentTransaction()?.wait();

  // Confirm the immutable wiring actually took.
  const wired = await router.announcer();
  if (wired.toLowerCase() !== announcer.toLowerCase()) {
    throw new Error(
      `Router reports announcer ${wired}, expected ${announcer}. Do not use this deployment.`,
    );
  }

  logHeading("Deployed");
  console.log(`Router:   ${address}`);
  console.log(`Tx:       ${receipt?.hash}`);
  console.log(`Explorer: https://testnet.snowtrace.io/address/${address}`);

  writeDeployment({
    ...record,
    network: network.name,
    chainId: chainId.toString(),
    announcer,
    announcerSource: record.announcerSource ?? "deployed-reference",
    router: address,
    deployer,
    deployedAt: new Date().toISOString(),
  });
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
