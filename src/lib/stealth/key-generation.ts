import { utils } from "@noble/secp256k1";
import { SCHEME_ID_SECP256K1, type SupportedChainId } from "./constants";
import { StealthError } from "./errors";
import { SecretKeyMaterial } from "./secure-memory";
import { compressedPublicKeyFrom } from "./address-utils";
import { buildStealthMetaAddress } from "./meta-address";
import {
  assertSupportedChainId,
  assertValidCompressedPublicKey,
  assertValidPrivateKeyBytes,
} from "./validation";
import type { StealthIdentityBundle, StealthIdentitySecrets } from "./types";

/**
 * Generates a fresh 32-byte private scalar.
 *
 * Randomness comes from `@noble/secp256k1`'s `utils.randomPrivateKey()`, which
 * draws from the platform CSPRNG (`crypto.getRandomValues` in the browser,
 * `node:crypto` under Node) and rejects out-of-range values. Never replace this
 * with `Math.random`, a timestamp, a UUID or any derived/predictable seed.
 */
function generatePrivateScalar(): SecretKeyMaterial {
  const bytes = utils.randomPrivateKey();
  assertValidPrivateKeyBytes(bytes);
  return SecretKeyMaterial.fromBytes(bytes);
}

/**
 * Wraps an existing 32-byte scalar as key material.
 *
 * Intended for tests and for a future, separately designed import/recovery
 * flow. Production identity creation must use {@link generateStealthIdentity}.
 */
export function importPrivateScalar(bytes: Uint8Array): SecretKeyMaterial {
  assertValidPrivateKeyBytes(bytes);
  return SecretKeyMaterial.fromBytes(bytes);
}

function makeSecrets(
  spendingPrivateKey: SecretKeyMaterial,
  viewingPrivateKey: SecretKeyMaterial,
): StealthIdentitySecrets {
  return {
    spendingPrivateKey,
    viewingPrivateKey,
    destroy() {
      spendingPrivateKey.destroy();
      viewingPrivateKey.destroy();
    },
  };
}

/**
 * Creates a complete receiver identity: two independent SECP256k1 key pairs
 * plus the publishable stealth meta-address.
 *
 * The returned bundle separates `publicIdentity` (safe to share, render and
 * store) from `secrets` (must stay in memory on the receiver's device).
 *
 * The viewing and spending keys are generated independently — neither is
 * derived from the other, and neither is derived from the connected wallet.
 * StealthPay's stealth keys are a separate key system from the MetaMask/Core
 * account, by design.
 */
export function generateStealthIdentity(
  chainId: SupportedChainId,
): StealthIdentityBundle {
  assertSupportedChainId(chainId);

  const spendingPrivateKey = generatePrivateScalar();
  const viewingPrivateKey = generatePrivateScalar();

  return buildIdentityFromSecrets({
    chainId,
    spendingPrivateKey,
    viewingPrivateKey,
  });
}

/**
 * Assembles an identity from already-created scalars.
 *
 * Exported so deterministic test fixtures can exercise the same code path as
 * production without the production path ever accepting caller-supplied keys.
 */
export function buildIdentityFromSecrets({
  chainId,
  spendingPrivateKey,
  viewingPrivateKey,
}: {
  chainId: SupportedChainId;
  spendingPrivateKey: SecretKeyMaterial;
  viewingPrivateKey: SecretKeyMaterial;
}): StealthIdentityBundle {
  assertSupportedChainId(chainId);

  const spendingPublicKey = compressedPublicKeyFrom(spendingPrivateKey);
  const viewingPublicKey = compressedPublicKeyFrom(viewingPrivateKey);

  assertValidCompressedPublicKey(spendingPublicKey);
  assertValidCompressedPublicKey(viewingPublicKey);

  if (spendingPublicKey === viewingPublicKey) {
    // Would collapse the two-key scheme into one key, letting anyone who can
    // scan also spend.
    throw new StealthError(
      "INVALID_PRIVATE_KEY",
      "Spending and viewing keys must be independent.",
    );
  }

  const { uri, raw } = buildStealthMetaAddress({
    spendingPublicKey,
    viewingPublicKey,
  });

  return {
    publicIdentity: {
      schemeId: SCHEME_ID_SECP256K1,
      chainId,
      spendingPublicKey,
      viewingPublicKey,
      stealthMetaAddress: uri,
      stealthMetaAddressRaw: raw,
    },
    secrets: makeSecrets(spendingPrivateKey, viewingPrivateKey),
  };
}
