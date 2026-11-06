import { getSharedSecret } from "@noble/secp256k1";
import {
  getHashedSharedSecret,
  getStealthPublicKey,
  getViewTag,
  publicKeyToAddress,
} from "@scopelift/stealth-address-sdk";
import { hexToBytes } from "viem";
import { SCHEME_ID_SECP256K1 } from "./constants";
import { StealthError, toSafeErrorMessage } from "./errors";
import { addressesEqual } from "./address-utils";
import {
  assertSupportedScheme,
  assertValidAddress,
  assertValidCompressedPublicKey,
  assertValidEphemeralPublicKey,
  assertValidViewTag,
} from "./validation";
import type {
  CheckStealthAnnouncementParams,
  StealthCheckResult,
} from "./types";

/**
 * Determines whether an announcement is addressed to this receiver.
 *
 * Mirrors the ScopeLift SDK's `checkStealthAddress`, but built from the SDK's
 * own exported primitives so the outcome can distinguish *why* a check failed:
 * a view-tag miss (the cheap filter, which rules out ~255/256 of unrelated
 * announcements) versus a full address mismatch.
 *
 * Returns a result object for valid-but-unrelated announcements, and throws a
 * {@link StealthError} only for malformed input.
 *
 * A match means the announcement *addresses* this receiver. It is not proof
 * that funds arrived — the on-chain transfer must still be verified separately.
 */
export function checkStealthAnnouncement({
  stealthAddress,
  ephemeralPublicKey,
  viewTag,
  viewingPrivateKey,
  spendingPublicKey,
  schemeId,
}: CheckStealthAnnouncementParams): StealthCheckResult {
  assertSupportedScheme(schemeId);
  assertValidAddress(stealthAddress);
  assertValidEphemeralPublicKey(ephemeralPublicKey);
  assertValidViewTag(viewTag);
  assertValidCompressedPublicKey(spendingPublicKey);

  let hashedSharedSecret: `0x${string}`;
  try {
    // ECDH from the receiver's side: s' = a · R.
    const sharedSecret = getSharedSecret(
      viewingPrivateKey.bytes(),
      hexToBytes(ephemeralPublicKey),
    );
    hashedSharedSecret = getHashedSharedSecret({
      sharedSecret,
      schemeId: SCHEME_ID_SECP256K1,
    });
  } catch (error) {
    throw new StealthError(
      "INVALID_EPHEMERAL_PUBLIC_KEY",
      `Could not compute the shared secret: ${toSafeErrorMessage(error)}`,
    );
  }

  // Cheap filter first — this is the whole point of the view tag.
  const computedViewTag = getViewTag({
    hashedSharedSecret,
    schemeId: SCHEME_ID_SECP256K1,
  });

  if (computedViewTag.toLowerCase() !== viewTag.toLowerCase()) {
    return {
      isForUser: false,
      reason: "view-tag-mismatch",
      derivedStealthAddress: null,
    };
  }

  let derivedStealthAddress: string;
  try {
    const stealthPublicKey = getStealthPublicKey({
      spendingPublicKey: hexToBytes(spendingPublicKey),
      hashedSharedSecret,
      schemeId: SCHEME_ID_SECP256K1,
    });
    derivedStealthAddress = publicKeyToAddress({
      publicKey: stealthPublicKey,
      schemeId: SCHEME_ID_SECP256K1,
    });
  } catch (error) {
    throw new StealthError(
      "STEALTH_KEY_DERIVATION_FAILED",
      `Could not derive the candidate stealth address: ${toSafeErrorMessage(error)}`,
    );
  }

  assertValidAddress(derivedStealthAddress);

  const matches = addressesEqual(derivedStealthAddress, stealthAddress);

  return {
    isForUser: matches,
    reason: matches ? "match" : "address-mismatch",
    derivedStealthAddress,
  };
}
