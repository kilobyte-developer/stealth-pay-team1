import { concat, getAddress, numberToHex, type Address, type Hex } from "viem";

/**
 * x402 configuration shared by the browser and the backend.
 *
 * Everything here is PUBLIC data. Secrets (the announcement relayer key) are
 * read only in `src/lib/x402/server/env.ts`, which never ships to the client.
 *
 * ## Why USDC and not stUSD
 * The x402 `exact` scheme settles ERC-20 payments with EIP-3009
 * `transferWithAuthorization`. The deployed StealthPay test token (stUSD,
 * 0xB114A2B17F1E7b028249cCFec2D98D25a3Bbe9C0) is a plain OpenZeppelin ERC-20:
 * its bytecode contains no `transferWithAuthorization` (0xe3ee160e),
 * `authorizationState` (0xe94a0102) or EIP-712 domain, so it cannot be paid
 * through x402. Circle's USDC on Fuji was verified on-chain to implement
 * EIP-3009 (implementation 0x6f3c4787…d9f4 behind the FiatToken proxy), with
 * EIP-712 domain name "USD Coin" and version "2". The backend re-checks this
 * at runtime before issuing any payment requirement.
 */

/** x402 protocol version used end to end. */
export const X402_VERSION = 2 as const;

/** The only x402 scheme StealthPay uses. Permit2 is deliberately unsupported. */
export const X402_SCHEME = "exact" as const;

/** EIP-3009 is the only accepted asset transfer method. */
export const X402_ASSET_TRANSFER_METHOD = "eip3009" as const;

/** Avalanche Fuji, as a CAIP-2 network id. */
export const X402_FUJI_NETWORK = "eip155:43113" as const;
export const X402_FUJI_CHAIN_ID = 43113 as const;

export interface X402AssetConfig {
  address: Address;
  symbol: string;
  name: string;
  decimals: number;
  /** EIP-712 domain fields the EIP-3009 signature is bound to. */
  eip712: { name: string; version: string };
}

/** Circle USDC on Avalanche Fuji (EIP-3009, verified on-chain). */
const CIRCLE_FUJI_USDC = "0x5425890298aed601595a70AB815c96711a31Bc65";

/**
 * The x402 asset. Circle USDC on Fuji unless NEXT_PUBLIC_FUJI_X402_USDC_ADDRESS
 * overrides it — intended only for a local Hardhat chain running the
 * FiatToken-compatible MockEIP3009Token. Whatever the address, the backend
 * re-verifies at runtime that it implements EIP-3009 with this exact domain
 * before issuing any requirement.
 */
export const FUJI_USDC: X402AssetConfig = {
  address: getAddress(
    process.env.NEXT_PUBLIC_FUJI_X402_USDC_ADDRESS?.trim() || CIRCLE_FUJI_USDC,
  ),
  symbol: "USDC",
  name: "USD Coin (x402 · EIP-3009)",
  decimals: 6,
  eip712: { name: "USD Coin", version: "2" },
};

/**
 * Seconds the sender's EIP-3009 authorization stays valid. Short on purpose:
 * it bounds how long a signed-but-unsettled authorization can float around,
 * and bounds the block range the backend searches when reconciling.
 */
export const X402_MAX_TIMEOUT_SECONDS = 300;

/**
 * An authorization must still have at least this many seconds left when the
 * backend receives it, so settlement is not attempted on one about to expire.
 */
export const X402_MIN_REMAINING_VALIDITY_SECONDS = 30;

/** Upper bound on one payment, in token base units (1,000,000 USDC). */
export const X402_MAX_AMOUNT = 1_000_000n * 10n ** 6n;

/**
 * `transferWithAuthorization(address,address,uint256,uint256,uint256,bytes32,uint8,bytes32,bytes32)`.
 *
 * ERC-5564 metadata bytes 1–4 carry the function identifier of the transfer
 * that actually moved the asset. For x402 payments that is the EIP-3009 call,
 * not the router's `transferFrom`, so the metadata says exactly that.
 */
export const TRANSFER_WITH_AUTHORIZATION_SELECTOR = "0xe3ee160e" as const;

/** Lifecycle states of an x402 stealth payment. */
export type X402PaymentStatus =
  /** Requirement issued; nothing signed yet. */
  | "pending"
  /** Signed EIP-3009 authorization verified locally and by the facilitator. */
  | "authorized"
  /** Transfer confirmed on-chain from the receipt, not the facilitator's word. */
  | "settled"
  /** ERC-5564 announcement confirmed on-chain. */
  | "announced"
  /** Settlement did not happen; a fresh authorization may be submitted. */
  | "failed";

/**
 * ERC-5564 announcement metadata for an x402 (EIP-3009) token payment.
 *
 * Layout (57 bytes): viewTag(1) ‖ 0xe3ee160e(4) ‖ token(20) ‖ amount(32) —
 * the same shape StealthPaymentRouter emits, so the existing scanner layout
 * applies; only the function identifier differs.
 */
export function encodeX402AnnouncementMetadata(
  viewTag: Hex,
  token: Address,
  amount: bigint,
): Hex {
  // Canonical lowercase hex: byte-identical to what the chain returns in logs.
  return concat([
    viewTag,
    TRANSFER_WITH_AUTHORIZATION_SELECTOR,
    getAddress(token),
    numberToHex(amount, { size: 32 }),
  ]).toLowerCase() as Hex;
}

/** Path of the x402-protected resource. */
export const X402_PAYMENTS_PATH = "/api/x402/stealth-payments";
