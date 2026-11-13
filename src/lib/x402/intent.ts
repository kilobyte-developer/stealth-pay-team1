import { getAddress, isAddress, zeroAddress, type Address, type Hex } from "viem";
import { SCHEME_ID_SECP256K1 } from "@/lib/stealth/constants";
import {
  assertValidEphemeralPublicKey,
  assertValidViewTag,
} from "@/lib/stealth/validation";
import { X402_MAX_AMOUNT } from "./config";

/**
 * What the sender's browser asks the backend to charge for.
 *
 * Contains only PUBLIC values: the one-time stealth address and the ephemeral
 * PUBLIC key. The ephemeral private key and the receiver's meta-address never
 * leave the sender's browser; the receiver's private keys never leave theirs.
 */
export interface StealthPaymentIntent {
  network: string;
  asset: Address;
  /** Token base units, as a decimal string. */
  amount: string;
  stealthAddress: Address;
  ephemeralPublicKey: Hex;
  viewTag: Hex;
  schemeId: number;
}

export class IntentValidationError extends Error {
  constructor(
    readonly code:
      | "INVALID_BODY"
      | "WRONG_NETWORK"
      | "UNSUPPORTED_TOKEN"
      | "INVALID_AMOUNT"
      | "INVALID_STEALTH_ADDRESS"
      | "INVALID_EPHEMERAL_PUBLIC_KEY"
      | "INVALID_VIEW_TAG"
      | "UNSUPPORTED_SCHEME",
    message: string,
  ) {
    super(message);
    this.name = "IntentValidationError";
  }
}

/**
 * Parses and validates an untrusted intent against the ONLY network and asset
 * this deployment accepts. Never trusts the caller's values beyond checking
 * that they are well-formed and equal to what is configured.
 */
export function parseStealthPaymentIntent(
  raw: unknown,
  expected: { network: string; asset: Address },
): StealthPaymentIntent {
  if (typeof raw !== "object" || raw === null) {
    throw new IntentValidationError("INVALID_BODY", "Request body must be a JSON object.");
  }
  const body = raw as Record<string, unknown>;

  if (body.network !== expected.network) {
    throw new IntentValidationError(
      "WRONG_NETWORK",
      `Unsupported network ${String(body.network)}. Only ${expected.network} is accepted.`,
    );
  }

  if (
    typeof body.asset !== "string" ||
    !isAddress(body.asset, { strict: false }) ||
    getAddress(body.asset) !== getAddress(expected.asset)
  ) {
    throw new IntentValidationError(
      "UNSUPPORTED_TOKEN",
      `Unsupported token ${String(body.asset)}. Only the EIP-3009 asset ${expected.asset} is accepted.`,
    );
  }

  if (typeof body.amount !== "string" || !/^[1-9][0-9]{0,30}$/.test(body.amount)) {
    throw new IntentValidationError(
      "INVALID_AMOUNT",
      "Amount must be a positive integer string in token base units.",
    );
  }
  if (BigInt(body.amount) > X402_MAX_AMOUNT) {
    throw new IntentValidationError("INVALID_AMOUNT", "Amount exceeds the per-payment limit.");
  }

  if (
    typeof body.stealthAddress !== "string" ||
    !isAddress(body.stealthAddress, { strict: false }) ||
    getAddress(body.stealthAddress) === zeroAddress
  ) {
    throw new IntentValidationError(
      "INVALID_STEALTH_ADDRESS",
      "stealthAddress must be a non-zero EVM address.",
    );
  }

  const schemeId = body.schemeId ?? SCHEME_ID_SECP256K1;
  if (schemeId !== SCHEME_ID_SECP256K1) {
    throw new IntentValidationError(
      "UNSUPPORTED_SCHEME",
      `Only ERC-5564 scheme ${SCHEME_ID_SECP256K1} (SECP256k1) is supported.`,
    );
  }

  const ephemeralPublicKey =
    typeof body.ephemeralPublicKey === "string"
      ? body.ephemeralPublicKey.toLowerCase()
      : body.ephemeralPublicKey;
  try {
    // Length, 02/03 prefix AND on-curve check.
    assertValidEphemeralPublicKey(ephemeralPublicKey);
  } catch {
    throw new IntentValidationError(
      "INVALID_EPHEMERAL_PUBLIC_KEY",
      "ephemeralPublicKey must be a valid 33-byte compressed SECP256k1 point.",
    );
  }

  const viewTag =
    typeof body.viewTag === "string" ? body.viewTag.toLowerCase() : body.viewTag;
  try {
    assertValidViewTag(viewTag);
  } catch {
    throw new IntentValidationError("INVALID_VIEW_TAG", "viewTag must be exactly one byte.");
  }

  return {
    network: expected.network,
    asset: getAddress(expected.asset),
    amount: body.amount,
    stealthAddress: getAddress(body.stealthAddress),
    ephemeralPublicKey: ephemeralPublicKey as Hex,
    viewTag: viewTag as Hex,
    schemeId: SCHEME_ID_SECP256K1,
  };
}
