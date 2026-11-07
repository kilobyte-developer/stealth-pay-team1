import { ethers, network } from "hardhat";
import {
  assertFuji,
  logHeading,
  readDeployment,
  requireFundedDeployer,
  writeDeployment,
} from "./lib";

/** Minted to the deployer once, in whole tokens — enough for repeated demo payments. */
const INITIAL_FAUCET_WHOLE_TOKENS = 10_000;

async function main() {
  const chainId = await assertFuji();
  const { address: deployer, balance } = await requireFundedDeployer();

  const record = readDeployment(network.name);

  logHeading("Test token deployment");
  console.log(`Network:  ${network.name} (chain ${chainId})`);
  console.log(`Deployer: ${deployer}`);
  console.log(`Balance:  ${ethers.formatEther(balance)} AVAX`);

  const token = await ethers.deployContract("StealthPayTestToken");
  await token.waitForDeployment();
  const address = await token.getAddress();
  const deployReceipt = await token.deploymentTransaction()?.wait();

  const decimals = await token.decimals();
  const faucetAmount = ethers.parseUnits(
    INITIAL_FAUCET_WHOLE_TOKENS.toString(),
    decimals,
  );

  const faucetTx = await token.faucet(faucetAmount);
  const faucetReceipt = await faucetTx.wait();

  const deployerBalance = await token.balanceOf(deployer);

  logHeading("Deployed");
  console.log(`Token:         ${address}`);
  console.log(`Symbol:        ${await token.symbol()} (${decimals} decimals)`);
  console.log(`Deploy tx:     ${deployReceipt?.hash}`);
  console.log(`Faucet tx:     ${faucetReceipt?.hash}`);
  console.log(
    `Deployer balance: ${ethers.formatUnits(deployerBalance, decimals)} stUSD`,
  );
  console.log(`Explorer:      https://testnet.snowtrace.io/address/${address}`);

  writeDeployment({
    ...record,
    network: network.name,
    chainId: chainId.toString(),
    testToken: address,
    deployer,
    deployedAt: new Date().toISOString(),
  });

  console.log(
    "\nSet NEXT_PUBLIC_FUJI_TEST_TOKEN_ADDRESS in the frontend's .env to this address to enable ERC-20 sends in the UI.",
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
