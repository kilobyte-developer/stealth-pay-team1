/**
 * LOCAL DEVELOPMENT ONLY — funds a PUBLIC address on the local Hardhat node
 * with test USDC (MockEIP3009Token), test stUSD and test AVAX, using the
 * contracts recorded in ../.env.development.local by local-x402-setup.ts.
 *
 * Refuses to run against anything but `--network localhost` on chainId 43113.
 *
 * Usage:
 *   cd contracts
 *   LOCAL_FUND_ADDRESS=0xPublicAddress [LOCAL_FUND_USDC=1000] \
 *     npx hardhat run scripts/local-x402-fund.ts --network localhost
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ethers, network } from "hardhat";

const ENV_PATH = join(__dirname, "..", "..", ".env.development.local");

function envValue(text: string, key: string): string {
  const line = text.split(/\r?\n/).find((l) => l.startsWith(`${key}=`));
  const value = line?.slice(key.length + 1).trim();
  if (!value || !ethers.isAddress(value)) {
    throw new Error(`${key} missing in ${ENV_PATH}. Run local-x402-setup.ts first.`);
  }
  return ethers.getAddress(value);
}

async function main() {
  const { chainId } = await ethers.provider.getNetwork();
  const clientVersion: string = await ethers.provider.send("web3_clientVersion", []);
  if (network.name !== "localhost" || chainId !== 43113n || !clientVersion.includes("HardhatNetwork")) {
    throw new Error("Refusing to run: needs --network localhost on a Hardhat node with chainId 43113.");
  }
  const raw = process.env.LOCAL_FUND_ADDRESS?.trim();
  if (!raw || !ethers.isAddress(raw)) throw new Error("Set LOCAL_FUND_ADDRESS to a public 0x address.");
  const to = ethers.getAddress(raw);
  const whole = BigInt(process.env.LOCAL_FUND_USDC ?? "1000");

  const env = readFileSync(ENV_PATH, "utf8");
  const usdcAddress = envValue(env, "NEXT_PUBLIC_FUJI_X402_USDC_ADDRESS");
  const stUsdAddress = envValue(env, "NEXT_PUBLIC_FUJI_TEST_TOKEN_ADDRESS");
  for (const a of [usdcAddress, stUsdAddress]) {
    if ((await ethers.provider.getCode(a)) === "0x") {
      throw new Error(`No contract at ${a}. The node was restarted? Re-run local-x402-setup.ts.`);
    }
  }

  const [deployer] = await ethers.getSigners();
  const usdc = await ethers.getContractAt("MockEIP3009Token", usdcAddress);
  const stUsd = await ethers.getContractAt("StealthPayTestToken", stUsdAddress);
  const units = whole * 10n ** 6n;
  await (await usdc.mint(to, units)).wait();
  await (await stUsd.faucet(units)).wait();
  await (await stUsd.transfer(to, units)).wait();
  await (await deployer.sendTransaction({ to, value: ethers.parseEther("10") })).wait();

  console.log(`Funded ${to} on local Hardhat (43113):`);
  console.log(`  USDC  ${ethers.formatUnits(await usdc.balanceOf(to), 6)}`);
  console.log(`  stUSD ${ethers.formatUnits(await stUsd.balanceOf(to), 6)}`);
  console.log(`  AVAX  ${ethers.formatEther(await ethers.provider.getBalance(to))}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
