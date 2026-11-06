/**
 * ============================================================================
 * VAULT TEST FIXTURES ONLY.
 *
 * The passwords and scalars here are fixed, public constants so tests are
 * reproducible. They protect nothing. Never reuse them anywhere real.
 * ============================================================================
 */

import {
  DEFAULT_CHAIN_ID,
  buildIdentityFromSecrets,
  importPrivateScalar,
  type StealthIdentityBundle,
} from "@/lib/stealth";
import { identityToPayload } from "../identity-codec";
import type { VaultPayloadV1 } from "../types";

export const PASSWORD = "correct horse battery staple";
export const WRONG_PASSWORD = "incorrect horse battery staple";
export const NEW_PASSWORD = "a different sufficiently long passphrase";

function scalar(byte: number): Uint8Array {
  return new Uint8Array(32).fill(byte);
}

/** A deterministic identity, built through the real Milestone 2 engine. */
export function makeIdentity(
  chainId = DEFAULT_CHAIN_ID,
): StealthIdentityBundle {
  return buildIdentityFromSecrets({
    chainId,
    spendingPrivateKey: importPrivateScalar(scalar(0x11)),
    viewingPrivateKey: importPrivateScalar(scalar(0x22)),
  });
}

/** A second, unrelated identity. */
export function makeOtherIdentity(
  chainId = DEFAULT_CHAIN_ID,
): StealthIdentityBundle {
  return buildIdentityFromSecrets({
    chainId,
    spendingPrivateKey: importPrivateScalar(scalar(0x33)),
    viewingPrivateKey: importPrivateScalar(scalar(0x44)),
  });
}

export function makePayload(chainId = DEFAULT_CHAIN_ID): VaultPayloadV1 {
  const bundle = makeIdentity(chainId);
  const payload = identityToPayload(bundle);
  bundle.secrets.destroy();
  return payload;
}
