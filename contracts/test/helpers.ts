import { ethers } from "hardhat";

/**
 * Fixed, valid-shaped SEC1 compressed public keys for contract tests.
 *
 * The router only validates ENCODING (33 bytes, 0x02/0x03 prefix) — on-curve
 * validation belongs client-side where the curve maths lives. These are
 * therefore shape-correct constants, not keys that control anything.
 */
export const EPHEMERAL_PUBKEY =
  "0x0273f5c2b1e9a84d6f3c05b7e1284ad9f6c4b830e5a71d9c2f68b04e3d7a51c9b8";
export const EPHEMERAL_PUBKEY_ODD =
  "0x03a1d84f70b6c25e9138fa4c7d05e82b6914c3af58d7206be4195cd83f6a2e7d14";

export const VIEW_TAG = "0x4b";

export const SCHEME_ID = 1n;
export const NATIVE_SENTINEL = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";
export const NATIVE_SELECTOR = "eeeeeeee";
export const TRANSFER_FROM_SELECTOR = "23b872dd";

/** Canonical ERC-5564 Announcement topic0, verified against the live mainnet deployment. */
export const CANONICAL_ANNOUNCEMENT_TOPIC0 =
  "0x5f0eab8057630ba7676c49b4f21a0231414e79474595be8e4c432fbf6bf0f4e7";

/** Canonical `announce(uint256,address,bytes,bytes)` selector. */
export const CANONICAL_ANNOUNCE_SELECTOR = "0x4d1f9583";

function hex(value: string): string {
  return value.startsWith("0x") ? value.slice(2).toLowerCase() : value.toLowerCase();
}

/**
 * Builds the expected ERC-5564 native metadata and asserts the exact byte
 * layout: viewTag(1) ‖ 0xeeeeeeee(4) ‖ sentinel(20) ‖ amount(32) = 57 bytes.
 */
export function expectedNativeMetadata(viewTag: string, amount: bigint): string {
  const amountHex = amount.toString(16).padStart(64, "0");
  return (
    "0x" +
    hex(viewTag) +
    NATIVE_SELECTOR +
    hex(NATIVE_SENTINEL) +
    amountHex
  );
}

/**
 * viewTag(1) ‖ 0x23b872dd(4) ‖ token(20) ‖ amount(32) = 57 bytes.
 */
export function expectedERC20Metadata(
  viewTag: string,
  token: string,
  amount: bigint,
): string {
  const amountHex = amount.toString(16).padStart(64, "0");
  return (
    "0x" +
    hex(viewTag) +
    TRANSFER_FROM_SELECTOR +
    hex(token) +
    amountHex
  );
}

export async function deployAnnouncerAndRouter() {
  const announcer = await ethers.deployContract("ERC5564Announcer");
  await announcer.waitForDeployment();
  const router = await ethers.deployContract("StealthPaymentRouter", [
    await announcer.getAddress(),
  ]);
  await router.waitForDeployment();
  return { announcer, router };
}

export async function deployToken(decimals = 18) {
  const token = await ethers.deployContract("MockERC20", [
    "Mock USD",
    "mUSD",
    decimals,
  ]);
  await token.waitForDeployment();
  return token;
}

/** A fresh address with no code, standing in for a derived stealth address. */
export function randomStealthAddress(): string {
  return ethers.Wallet.createRandom().address;
}
