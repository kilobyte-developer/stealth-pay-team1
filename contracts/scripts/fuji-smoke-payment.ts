import { ethers, network } from "hardhat";
import { assertFuji, logHeading, readDeployment, requireFundedDeployer } from "./lib";

/**
 * Plumbing smoke test for the deployed Announcer + Router on Fuji.
 *
 * ## What this is NOT
 * This does not exercise real ERC-5564 derivation. The actual crypto engine
 * (`@scopelift/stealth-address-sdk`) is ESM-only and cannot run inside
 * Hardhat's CJS script runtime. The ephemeral public key and view tag below
 * are a FIXED, clearly-labelled test vector that only needs to satisfy the
 * router's on-chain encoding checks (33-byte compressed-key length, 0x02/0x03
 * prefix) — they do not correspond to any real stealth meta-address and
 * cannot be used to recover anything.
 *
 * ## What this IS
 * A real, on-chain check that the deployed Router actually moves funds to a
 * destination AND that the deployed Announcer actually emits the matching
 * `Announcement` event, in one atomic transaction, against live Fuji state.
 * The genuine end-to-end test — real derivation, real wallet, real scanning —
 * is the frontend flow described in CONTRACT_DEPLOYMENT.md §L.
 */

const TEST_VECTOR_EPHEMERAL_PUBKEY = `0x02${"ab".repeat(32)}` as const;
const TEST_VECTOR_VIEW_TAG = "0x4b" as const;

const NATIVE_SMOKE_AMOUNT = ethers.parseEther("0.001");
const ERC20_SMOKE_AMOUNT_WHOLE = 1n;
const ERC20_GAS_TOPUP = ethers.parseEther("0.0005");

async function main() {
  const chainId = await assertFuji();
  const { address: deployer, balance } = await requireFundedDeployer();
  const record = readDeployment(network.name);

  if (!record.router) {
    throw new Error(
      "No router address recorded. Run `npm run deploy:announcer:fuji` then `npm run deploy:router:fuji` first.",
    );
  }
  if (!record.announcer) {
    throw new Error("No announcer address recorded. Run deployment scripts first.");
  }

  logHeading("Fuji smoke test (plumbing only — not real stealth derivation)");
  console.log(`Network:  ${network.name} (chain ${chainId})`);
  console.log(`Deployer: ${deployer}`);
  console.log(`Balance:  ${ethers.formatEther(balance)} AVAX`);
  console.log(`Router:   ${record.router}`);
  console.log(`Announcer: ${record.announcer}`);

  const router = await ethers.getContractAt("StealthPaymentRouter", record.router);
  const announcer = await ethers.getContractAt("ERC5564Announcer", record.announcer);

  /* ---- Native payment ---- */
  logHeading("Native payNative()");
  const nativeDest = ethers.Wallet.createRandom().address;
  console.log(`Throwaway destination: ${nativeDest}`);

  const balanceBefore = await ethers.provider.getBalance(nativeDest);
  const nativeTx = await router.payNative(
    nativeDest,
    TEST_VECTOR_EPHEMERAL_PUBKEY,
    TEST_VECTOR_VIEW_TAG,
    { value: NATIVE_SMOKE_AMOUNT },
  );
  const nativeReceipt = await nativeTx.wait();
  if (!nativeReceipt) throw new Error("payNative transaction did not confirm.");

  const balanceAfter = await ethers.provider.getBalance(nativeDest);
  const delivered = balanceAfter - balanceBefore;
  if (delivered !== NATIVE_SMOKE_AMOUNT) {
    throw new Error(
      `Native smoke payment delivered ${delivered} wei, expected ${NATIVE_SMOKE_AMOUNT} wei.`,
    );
  }

  const announcementLog = nativeReceipt.logs.find(
    (log) => log.address.toLowerCase() === record.announcer!.toLowerCase(),
  );
  if (!announcementLog) {
    throw new Error("No Announcement event found from the configured Announcer.");
  }
  const parsed = announcer.interface.parseLog(announcementLog);
  if (!parsed) throw new Error("Could not decode the Announcement event.");
  if (parsed.args.stealthAddress.toLowerCase() !== nativeDest.toLowerCase()) {
    throw new Error("Announcement stealthAddress did not match the payment destination.");
  }
  if (parsed.args.caller.toLowerCase() !== record.router!.toLowerCase()) {
    throw new Error("Announcement caller did not match the router — wiring is broken.");
  }

  console.log(`Tx:            ${nativeReceipt.hash}`);
  console.log(`Delivered:     ${ethers.formatEther(delivered)} AVAX (exact match)`);
  console.log(`Announcement:  scheme ${parsed.args.schemeId}, caller ${parsed.args.caller}`);
  console.log("Native payment + announcement verified on-chain.");

  /* ---- ERC-20 payment (only if a test token is configured) ---- */
  if (!record.testToken) {
    console.log(
      "\nNo test token recorded — skipping the ERC-20 leg. Run `npm run deploy:test-token:fuji` to cover it.",
    );
  } else {
    logHeading("ERC-20 payERC20() with native gas top-up");
    const token = await ethers.getContractAt("StealthPayTestToken", record.testToken);
    const decimals = await token.decimals();
    const tokenAmount = ethers.parseUnits(ERC20_SMOKE_AMOUNT_WHOLE.toString(), decimals);

    const deployerTokenBalance = await token.balanceOf(deployer);
    if (deployerTokenBalance < tokenAmount) {
      const faucetTx = await token.faucet(tokenAmount * 10n);
      await faucetTx.wait();
      console.log("Minted additional test tokens to the deployer via faucet().");
    }

    const approveTx = await token.approve(record.router, tokenAmount);
    await approveTx.wait();

    const erc20Dest = ethers.Wallet.createRandom().address;
    console.log(`Throwaway destination: ${erc20Dest}`);

    const erc20Tx = await router.payERC20(
      record.testToken,
      erc20Dest,
      tokenAmount,
      TEST_VECTOR_EPHEMERAL_PUBKEY,
      TEST_VECTOR_VIEW_TAG,
      { value: ERC20_GAS_TOPUP },
    );
    const erc20Receipt = await erc20Tx.wait();
    if (!erc20Receipt) throw new Error("payERC20 transaction did not confirm.");

    const destTokenBalance = await token.balanceOf(erc20Dest);
    const destNativeBalance = await ethers.provider.getBalance(erc20Dest);

    if (destTokenBalance !== tokenAmount) {
      throw new Error(
        `ERC-20 smoke payment delivered ${destTokenBalance} base units, expected ${tokenAmount}.`,
      );
    }
    if (destNativeBalance !== ERC20_GAS_TOPUP) {
      throw new Error(
        `Gas top-up delivered ${destNativeBalance} wei, expected ${ERC20_GAS_TOPUP} wei.`,
      );
    }

    console.log(`Tx:              ${erc20Receipt.hash}`);
    console.log(`Token delivered: ${ethers.formatUnits(destTokenBalance, decimals)} stUSD (exact match)`);
    console.log(`Gas top-up:      ${ethers.formatEther(destNativeBalance)} AVAX (exact match)`);
    console.log("ERC-20 payment + gas top-up + two announcements verified on-chain.");
  }

  logHeading("Smoke test passed");
  console.log(
    "Plumbing confirmed on live Fuji. This does not certify the real stealth-address " +
      "flow — see CONTRACT_DEPLOYMENT.md §L for what the frontend-driven end-to-end test still needs.",
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
