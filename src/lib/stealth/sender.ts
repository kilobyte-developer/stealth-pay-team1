import { generateStealthAddress } from "@scopelift/stealth-address-sdk";
import { utils } from "@noble/secp256k1";
import {
  AVALANCHE_CHAIN_LABEL,
  SCHEME_ID_SECP256K1,
  STEALTH_URI_SCHEME,
  type SupportedChainId,
} from "./constants";
import { StealthError, toSafeErrorMessage } from "./errors";
import { SecretKeyMaterial } from "./secure-memory";
import { parseStealthMetaAddress } from "./meta-address";
import {
  assertSupportedChainId,
  assertValidAddress,
  assertValidEphemeralPublicKey,
  assertValidPrivateKeyBytes,
  assertValidViewTag,
} from "./validation";
import type {
  OneTimeStealthAddress,
  OneTimeStealthAddressWithSecret,
} from "./types";

/**
 * Derives a fresh one-time stealth address for a payment.
 *
 * A new ephemeral key pair is generated for **every** call. Reusing an
 * ephemeral key across payments would let an observer link those payments to
 * one another, defeating the scheme.
 *
 * The ephemeral private key is deliberately absent from the return value —
 * only the public half (`ephemeralPublicKey`) ever leaves this function, and
 * only that half is published on-chain.
 */
export function generateOneTimeStealthAddress({
  metaAddress,
  chainId,
  schemeId = SCHEME_ID_SECP256K1,
}: {
  metaAddress: string;
  chainId: SupportedChainId;
  schemeId?: number;
}): OneTimeStealthAddress {
  const { ephemeralPrivateKey, ...result } = deriveWithEphemeralKey({
    metaAddress,
    chainId,
    schemeId,
  });
  // The secret is not returned to callers; clear our only reference to it.
  ephemeralPrivateKey.destroy();
  return result;
}

/**
 * Same derivation, but also returns the ephemeral private key.
 *
 * Exists for tests (deterministic fixtures, and verifying that sender and
 * receiver agree). Application code must use
 * {@link generateOneTimeStealthAddress}; nothing in the UI should ever hold an
 * ephemeral private key.
 */
export function deriveWithEphemeralKey({
  metaAddress,
  chainId,
  schemeId = SCHEME_ID_SECP256K1,
  ephemeralPrivateKeyBytes,
}: {
  metaAddress: string;
  chainId: SupportedChainId;
  schemeId?: number;
  /** Test-only override. Must be a valid 32-byte scalar. */
  ephemeralPrivateKeyBytes?: Uint8Array;
}): OneTimeStealthAddressWithSecret {
  assertSupportedChainId(chainId);

  // Validates the chain label, key lengths and curve points before the SDK
  // sees the input. The SDK's own URI parser ignores the chain segment.
  const parsed = parseStealthMetaAddress(metaAddress, { schemeId });

  // The SDK silently falls back to a random key when handed an invalid
  // ephemeral private key (verified in generateStealthAddress v1.0.0-beta.5),
  // which would make a deterministic test quietly non-deterministic. Validate
  // up front so a bad override fails loudly instead.
  let ephemeralBytes: Uint8Array;
  if (ephemeralPrivateKeyBytes) {
    assertValidPrivateKeyBytes(ephemeralPrivateKeyBytes);
    ephemeralBytes = ephemeralPrivateKeyBytes;
  } else {
    ephemeralBytes = utils.randomPrivateKey();
    assertValidPrivateKeyBytes(ephemeralBytes);
  }

  // Rebuilt from validated parts rather than passing the caller's string
  // through, so the SDK only ever sees a canonical URI.
  const canonicalUri = `${STEALTH_URI_SCHEME}:${AVALANCHE_CHAIN_LABEL}:${parsed.stealthMetaAddressRaw}`;

  let sdkResult;
  try {
    sdkResult = generateStealthAddress({
      stealthMetaAddressURI: canonicalUri,
      schemeId: SCHEME_ID_SECP256K1,
      ephemeralPrivateKey: ephemeralBytes,
    });
  } catch (error) {
    throw new StealthError(
      "STEALTH_KEY_DERIVATION_FAILED",
      `Could not derive a stealth address: ${toSafeErrorMessage(error)}`,
    );
  }

  assertValidAddress(sdkResult.stealthAddress);
  assertValidEphemeralPublicKey(sdkResult.ephemeralPublicKey);
  assertValidViewTag(sdkResult.viewTag);

  return {
    schemeId: SCHEME_ID_SECP256K1,
    chainId,
    stealthAddress: sdkResult.stealthAddress,
    ephemeralPublicKey: sdkResult.ephemeralPublicKey,
    viewTag: sdkResult.viewTag,
    ephemeralPrivateKey: SecretKeyMaterial.fromBytes(ephemeralBytes),
  };
}
