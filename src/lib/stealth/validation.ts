import { CURVE, ProjectivePoint } from "@noble/secp256k1";
import { isAddress } from "viem";
import { LENGTHS, SUPPORTED_SCHEME_ID, isSupportedChainId } from "./constants";
import { StealthError, type StealthErrorCode } from "./errors";
import type {
  Address,
  CompressedPublicKey,
  Hex,
  ViewTag,
} from "./types";
import type { SupportedChainId } from "./constants";

const HEX_BODY = /^[0-9a-fA-F]*$/;

export const CURVE_ORDER: bigint = CURVE.n;

/** True for `0x`-prefixed strings whose body is valid hex of `expectedLength`. */
export function isHexOfLength(
  value: unknown,
  expectedLength: number,
): value is Hex {
  return (
    typeof value === "string" &&
    value.startsWith("0x") &&
    value.length === expectedLength &&
    HEX_BODY.test(value.slice(2))
  );
}

/** Validates `1 <= scalar < n`. Rejects zero and out-of-range values. */
export function isValidScalar(scalar: bigint): boolean {
  return scalar > 0n && scalar < CURVE_ORDER;
}

export function bytesToBigInt(bytes: Uint8Array): bigint {
  let out = 0n;
  for (const byte of bytes) out = (out << 8n) | BigInt(byte);
  return out;
}

export function assertValidPrivateKeyBytes(
  bytes: Uint8Array,
  code: StealthErrorCode = "INVALID_PRIVATE_KEY",
): void {
  if (bytes.length !== LENGTHS.privateKeyBytes) {
    throw new StealthError(
      code,
      `Private key must be ${LENGTHS.privateKeyBytes} bytes.`,
    );
  }
  if (!isValidScalar(bytesToBigInt(bytes))) {
    throw new StealthError(
      code,
      "Private key is not a valid SECP256k1 scalar (must be non-zero and below the curve order).",
    );
  }
}

/**
 * Validates a compressed public key: correct length, `02`/`03` prefix, and —
 * critically — that the point actually lies on the curve. A length/prefix check
 * alone would accept invalid curve points.
 */
export function assertValidCompressedPublicKey(
  value: unknown,
  code: StealthErrorCode = "INVALID_PUBLIC_KEY",
): asserts value is CompressedPublicKey {
  if (!isHexOfLength(value, LENGTHS.compressedPublicKeyHex)) {
    throw new StealthError(
      code,
      `Public key must be 0x-prefixed with ${LENGTHS.publicKeyBodyHexChars} hex characters (33-byte compressed point).`,
    );
  }
  const prefix = value.slice(2, 4);
  if (prefix !== "02" && prefix !== "03") {
    throw new StealthError(
      code,
      "Compressed public key must begin with 02 or 03.",
    );
  }
  try {
    ProjectivePoint.fromHex(value.slice(2)).assertValidity();
  } catch {
    throw new StealthError(
      code,
      "Public key is not a valid point on the SECP256k1 curve.",
    );
  }
}

export function assertValidViewTag(value: unknown): asserts value is ViewTag {
  if (!isHexOfLength(value, LENGTHS.viewTagHex)) {
    throw new StealthError(
      "INVALID_VIEW_TAG",
      "View tag must be 0x-prefixed with exactly 2 hex characters (one byte).",
    );
  }
}

export function assertValidAddress(
  value: unknown,
  code: StealthErrorCode = "INVALID_STEALTH_ADDRESS",
): asserts value is Address {
  if (typeof value !== "string" || !isAddress(value, { strict: false })) {
    throw new StealthError(code, "Value is not a valid EVM address.");
  }
}

export function assertSupportedScheme(schemeId: number): void {
  if (schemeId !== SUPPORTED_SCHEME_ID) {
    throw new StealthError(
      "UNSUPPORTED_SCHEME",
      `Unsupported ERC-5564 scheme id ${schemeId}. Only scheme ${SUPPORTED_SCHEME_ID} (SECP256k1) is supported.`,
    );
  }
}

export function assertSupportedChainId(
  chainId: number,
): asserts chainId is SupportedChainId {
  if (!isSupportedChainId(chainId)) {
    throw new StealthError(
      "UNSUPPORTED_CHAIN",
      `Unsupported chain id ${chainId}. StealthPay supports Avalanche Fuji (43113) and C-Chain (43114).`,
    );
  }
}

/**
 * Validates an ephemeral public key from an announcement. Same checks as any
 * compressed key, but reported under its own code so callers can tell a
 * malformed announcement apart from a malformed local identity.
 */
export function assertValidEphemeralPublicKey(
  value: unknown,
): asserts value is CompressedPublicKey {
  assertValidCompressedPublicKey(value, "INVALID_EPHEMERAL_PUBLIC_KEY");
}
