import { computeStealthKey } from "@scopelift/stealth-address-sdk";
import { hexToBytes } from "viem";
import { SCHEME_ID_SECP256K1 } from "./constants";
import { StealthError, toSafeErrorMessage } from "./errors";
import { SecretKeyMaterial } from "./secure-memory";
import { addressFromPrivateKey, addressesEqual } from "./address-utils";
import {
  assertSupportedScheme,
  assertValidAddress,
  assertValidEphemeralPublicKey,
  assertValidPrivateKeyBytes,
} from "./validation";
import type {
  DeriveOneTimeSpendingKeyParams,
  OneTimeSpendingKey,
} from "./types";

/**
 * Derives the private key controlling a single one-time stealth address:
 *
 *   x = (b + H(a · R)) mod n
 *
 * The result is verified before being returned: the address is re-derived from
 * the scalar via an independent path (scalar → public key → EVM address) and
 * compared against the announced address. That path does not reuse the point
 * addition used to *generate* the address, so a mismatch surfaces a real
 * disagreement rather than echoing the same computation back.
 *
 * Derivation is rejected outright on mismatch — a key that does not control the
 * expected account is never handed back to the caller.
 *
 * The returned key is wrapped in {@link SecretKeyMaterial}, which refuses to
 * serialize or stringify. It must stay on the receiver's device: never log it,
 * never send it to an API, never persist it.
 */
export function deriveOneTimeSpendingKey({
  ephemeralPublicKey,
  viewingPrivateKey,
  spendingPrivateKey,
  expectedStealthAddress,
  schemeId,
}: DeriveOneTimeSpendingKeyParams): OneTimeSpendingKey {
  assertSupportedScheme(schemeId);
  assertValidEphemeralPublicKey(ephemeralPublicKey);
  assertValidAddress(expectedStealthAddress);

  let stealthPrivateKeyHex: `0x${string}`;
  try {
    stealthPrivateKeyHex = computeStealthKey({
      ephemeralPublicKey,
      schemeId: SCHEME_ID_SECP256K1,
      // The SDK's API takes hex. These strings are short-lived and are not
      // retained beyond this call.
      spendingPrivateKey: spendingPrivateKey.toHex(),
      viewingPrivateKey: viewingPrivateKey.toHex(),
    });
  } catch (error) {
    throw new StealthError(
      "STEALTH_KEY_DERIVATION_FAILED",
      `Could not derive the stealth private key: ${toSafeErrorMessage(error)}`,
    );
  }

  let derivedBytes: Uint8Array;
  try {
    derivedBytes = hexToBytes(stealthPrivateKeyHex);
  } catch {
    throw new StealthError(
      "STEALTH_KEY_DERIVATION_FAILED",
      "Derived stealth private key was not valid hex.",
    );
  }

  // The SDK reduces (b + s_h) mod n but does not reject a zero result. A zero
  // or out-of-range scalar is not a usable key, so validate it here.
  assertValidPrivateKeyBytes(derivedBytes, "STEALTH_KEY_DERIVATION_FAILED");

  const privateKey = SecretKeyMaterial.fromBytes(derivedBytes);
  derivedBytes.fill(0);

  const derivedAddress = addressFromPrivateKey(privateKey);

  if (!addressesEqual(derivedAddress, expectedStealthAddress)) {
    privateKey.destroy();
    throw new StealthError(
      "STEALTH_ADDRESS_MISMATCH",
      "The derived private key does not control the expected stealth address. Derivation rejected.",
    );
  }

  return { privateKey, stealthAddress: derivedAddress };
}

/**
 * Test and diagnostic helper: confirms that sender-side generation and
 * receiver-side recovery agree on the same account.
 *
 * Returns the comparison outcome rather than throwing, so tests can assert on
 * the detail. Does not expose the derived key.
 */
export function verifyPaymentDerivation({
  ephemeralPublicKey,
  viewingPrivateKey,
  spendingPrivateKey,
  senderStealthAddress,
  schemeId = SCHEME_ID_SECP256K1,
}: {
  ephemeralPublicKey: `0x${string}`;
  viewingPrivateKey: SecretKeyMaterial;
  spendingPrivateKey: SecretKeyMaterial;
  senderStealthAddress: string;
  schemeId?: number;
}): { matches: boolean; recoveredAddress: string | null; error?: string } {
  try {
    assertValidAddress(senderStealthAddress);
    const { privateKey, stealthAddress } = deriveOneTimeSpendingKey({
      ephemeralPublicKey,
      viewingPrivateKey,
      spendingPrivateKey,
      expectedStealthAddress: senderStealthAddress,
      schemeId,
    });
    privateKey.destroy();
    return {
      matches: addressesEqual(stealthAddress, senderStealthAddress),
      recoveredAddress: stealthAddress,
    };
  } catch (error) {
    return {
      matches: false,
      recoveredAddress: null,
      error: toSafeErrorMessage(error),
    };
  }
}
