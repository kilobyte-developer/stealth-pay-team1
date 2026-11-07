import { ethers, network } from "hardhat";
import {
  CANONICAL_ANNOUNCEMENT_TOPIC0,
  CANONICAL_ANNOUNCE_SELECTOR,
  assertFuji,
  envOverride,
  logHeading,
  readDeployment,
} from "./lib";

/**
 * Post-deployment verification.
 *
 * Checks the chain, that both contracts have code, that the router's immutable
 * Announcer wiring is correct, that the announcement interface is canonical,
 * and that the router has no admin surface or retained balance.
 *
 * Read-only: broadcasts nothing.
 */
async function main() {
  const chainId = await assertFuji();
  const record = readDeployment(network.name);

  const announcer = envOverride(process.env.FUJI_ANNOUNCER_ADDRESS) ?? record.announcer;
  const router = envOverride(process.env.FUJI_PAYMENT_ROUTER_ADDRESS) ?? record.router;

  logHeading(`Verifying deployment on ${network.name} (chain ${chainId})`);

  if (!announcer || !router) {
    throw new Error(
      "Missing addresses. Deploy first, or set FUJI_ANNOUNCER_ADDRESS and FUJI_PAYMENT_ROUTER_ADDRESS.",
    );
  }

  let failures = 0;
  const check = (label: string, ok: boolean, detail = "") => {
    console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
    if (!ok) failures += 1;
  };

  // 1. Bytecode present.
  const announcerCode = await ethers.provider.getCode(announcer);
  const routerCode = await ethers.provider.getCode(router);
  check("Announcer has bytecode", announcerCode !== "0x", `${(announcerCode.length - 2) / 2} bytes`);
  check("Router has bytecode", routerCode !== "0x", `${(routerCode.length - 2) / 2} bytes`);

  // 2. Router wiring.
  const routerContract = await ethers.getContractAt(
    "StealthPaymentRouter",
    router,
  );
  const wired: string = await routerContract.announcer();
  check(
    "Router points at the expected Announcer",
    wired.toLowerCase() === announcer.toLowerCase(),
    wired,
  );

  // 3. Constants.
  check("Router SCHEME_ID is 1", (await routerContract.SCHEME_ID()) === 1n);
  check(
    "Native sentinel is the ERC-5564 value",
    (await routerContract.NATIVE_TOKEN_SENTINEL()).toLowerCase() ===
      "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
  );
  check(
    "Native selector is 0xeeeeeeee",
    (await routerContract.NATIVE_VALUE_SELECTOR()) === "0xeeeeeeee",
  );
  check(
    "ERC-20 metadata selector is transferFrom (0x23b872dd)",
    (await routerContract.ERC20_TRANSFER_FROM_SELECTOR()) === "0x23b872dd",
  );

  // 4. Canonical announcement interface.
  const announcerContract = await ethers.getContractAt(
    "ERC5564Announcer",
    announcer,
  );
  check(
    "announce selector is canonical",
    announcerContract.interface.getFunction("announce")!.selector ===
      CANONICAL_ANNOUNCE_SELECTOR,
  );
  check(
    "Announcement topic0 is canonical",
    ethers.id("Announcement(uint256,address,address,bytes,bytes)") ===
      CANONICAL_ANNOUNCEMENT_TOPIC0,
  );
  check(
    "Announcer bytecode exposes the canonical selector",
    announcerCode.includes(CANONICAL_ANNOUNCE_SELECTOR.slice(2)),
  );

  // 5. No admin surface, no retained funds.
  const fnNames = routerContract.interface.fragments
    .filter((f) => f.type === "function")
    .map((f) => (f as unknown as { name: string }).name.toLowerCase());
  check(
    "Router exposes no owner/pause/upgrade/withdraw",
    !["owner", "pause", "upgradeto", "withdraw", "sweep", "rescue"].some((n) =>
      fnNames.includes(n),
    ),
  );
  const routerBalance = await ethers.provider.getBalance(router);
  check("Router holds no AVAX", routerBalance === 0n, `${routerBalance} wei`);

  logHeading(failures === 0 ? "All checks passed" : `${failures} check(s) FAILED`);
  console.log(`Announcer: https://testnet.snowtrace.io/address/${announcer}`);
  console.log(`Router:    https://testnet.snowtrace.io/address/${router}`);

  if (failures > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
