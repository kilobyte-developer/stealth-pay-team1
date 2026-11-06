/**
 * ============================================================================
 * TEST FIXTURES ONLY — DETERMINISTIC KEYS.
 *
 * Every scalar here is a fixed, publicly-known value chosen so that tests are
 * reproducible. They control nothing and must never appear outside test code.
 * Production identity creation always uses the platform CSPRNG via
 * `generateStealthIdentity`, which accepts no caller-supplied key material.
 * ============================================================================
 */

import { DEFAULT_CHAIN_ID } from "../constants";
import { buildIdentityFromSecrets, importPrivateScalar } from "../key-generation";
import type { StealthIdentityBundle } from "../types";

/** Builds a 32-byte scalar from a repeated byte value. */
export function scalarOf(byte: number): Uint8Array {
  return new Uint8Array(32).fill(byte);
}

export const TEST_SCALARS = {
  aliceSpending: scalarOf(0x11),
  aliceViewing: scalarOf(0x22),
  malloySpending: scalarOf(0x33),
  malloyViewing: scalarOf(0x44),
  ephemeralA: scalarOf(0x07),
  ephemeralB: scalarOf(0x09),
  ephemeralC: scalarOf(0x0d),
} as const;

/** Alice — the receiver in the worked example. */
export function makeAliceIdentity(
  chainId = DEFAULT_CHAIN_ID,
): StealthIdentityBundle {
  return buildIdentityFromSecrets({
    chainId,
    spendingPrivateKey: importPrivateScalar(TEST_SCALARS.aliceSpending),
    viewingPrivateKey: importPrivateScalar(TEST_SCALARS.aliceViewing),
  });
}

/** An unrelated receiver, used to prove announcements do not cross-match. */
export function makeOtherIdentity(
  chainId = DEFAULT_CHAIN_ID,
): StealthIdentityBundle {
  return buildIdentityFromSecrets({
    chainId,
    spendingPrivateKey: importPrivateScalar(TEST_SCALARS.malloySpending),
    viewingPrivateKey: importPrivateScalar(TEST_SCALARS.malloyViewing),
  });
}

/** A syntactically valid compressed key that is NOT on the curve. */
export const OFF_CURVE_PUBLIC_KEY = `0x02${"11".repeat(32)}` as const;

/** A valid-looking but structurally wrong meta-address (too short). */
export const SHORT_META_ADDRESS = `0x02${"ab".repeat(20)}` as const;
