import {
  SecretKeyMaterial,
  addressesEqual,
  buildIdentityFromSecrets,
  buildStealthMetaAddress,
  compressedPublicKeyFrom,
  importPrivateScalar,
  isSupportedChainId,
  parseStealthMetaAddress,
  type StealthIdentityBundle,
  type SupportedChainId,
} from "@/lib/stealth";
import { PAYLOAD_VERSION } from "./constants";
import { VaultError } from "./errors";
import { hexToBytes } from "./bytes";
import type { VaultPayloadV1 } from "./types";

/**
 * Converts a live identity into the plaintext payload that gets encrypted.
 *
 * This reads the private scalars out of `SecretKeyMaterial` as hex, which is
 * unavoidable for serialization. The resulting object is a secret and must go
 * straight into `encryptPayload` and nowhere else.
 */
export function identityToPayload(
  bundle: StealthIdentityBundle,
): VaultPayloadV1 {
  const { publicIdentity, secrets } = bundle;
  const parsed = parseStealthMetaAddress(publicIdentity.stealthMetaAddress);

  return {
    payloadVersion: PAYLOAD_VERSION,
    schemeId: publicIdentity.schemeId,
    chainFamily: parsed.chainLabel ?? "avax",
    chainId: publicIdentity.chainId,
    spendingPrivateKey: secrets.spendingPrivateKey.toHex(),
    viewingPrivateKey: secrets.viewingPrivateKey.toHex(),
    spendingPublicKey: publicIdentity.spendingPublicKey,
    viewingPublicKey: publicIdentity.viewingPublicKey,
    stealthMetaAddress: publicIdentity.stealthMetaAddress,
    identityCreatedAt: new Date().toISOString(),
  };
}

/**
 * Rebuilds a live identity from a decrypted payload, verifying every
 * relationship before returning it.
 *
 * The payload's public keys are treated as UNTRUSTED. Public keys are
 * recomputed from the private scalars and compared, and the meta-address is
 * rebuilt and compared. A backup whose public half disagrees with its private
 * half is rejected outright rather than partially restored — otherwise a
 * tampered file could point the user at an identity they cannot actually spend
 * from.
 */
export function payloadToIdentity(
  payload: VaultPayloadV1,
): StealthIdentityBundle {
  if (payload.payloadVersion !== PAYLOAD_VERSION) {
    throw new VaultError(
      "UNSUPPORTED_VERSION",
      `Unsupported payload version ${payload.payloadVersion}.`,
    );
  }
  if (!isSupportedChainId(payload.chainId)) {
    throw new VaultError(
      "IDENTITY_VERIFICATION_FAILED",
      `Backup references unsupported chain id ${payload.chainId}.`,
    );
  }

  let spending: SecretKeyMaterial;
  let viewing: SecretKeyMaterial;
  try {
    // Range-validates both scalars (non-zero, below the curve order).
    spending = importPrivateScalar(hexToBytes(payload.spendingPrivateKey));
    viewing = importPrivateScalar(hexToBytes(payload.viewingPrivateKey));
  } catch {
    throw new VaultError(
      "IDENTITY_VERIFICATION_FAILED",
      "Backup contains an invalid private key.",
    );
  }

  try {
    // 1. Recompute public keys from the private scalars.
    const recomputedSpendingPub = compressedPublicKeyFrom(spending);
    const recomputedViewingPub = compressedPublicKeyFrom(viewing);

    if (
      recomputedSpendingPub.toLowerCase() !==
      payload.spendingPublicKey.toLowerCase()
    ) {
      throw new VaultError(
        "IDENTITY_VERIFICATION_FAILED",
        "Backup public spending key does not match its private key.",
      );
    }
    if (
      recomputedViewingPub.toLowerCase() !==
      payload.viewingPublicKey.toLowerCase()
    ) {
      throw new VaultError(
        "IDENTITY_VERIFICATION_FAILED",
        "Backup public viewing key does not match its private key.",
      );
    }

    // 2. Rebuild the meta-address and compare with the stored one.
    const { uri } = buildStealthMetaAddress({
      spendingPublicKey: recomputedSpendingPub,
      viewingPublicKey: recomputedViewingPub,
    });
    if (uri !== payload.stealthMetaAddress) {
      throw new VaultError(
        "IDENTITY_VERIFICATION_FAILED",
        "Backup stealth meta-address does not match its keys.",
      );
    }

    // 3. Re-derive the identity through the normal engine path, which
    //    re-validates the keys and the scheme.
    const bundle = buildIdentityFromSecrets({
      chainId: payload.chainId as SupportedChainId,
      spendingPrivateKey: spending,
      viewingPrivateKey: viewing,
    });

    if (bundle.publicIdentity.schemeId !== payload.schemeId) {
      throw new VaultError(
        "IDENTITY_VERIFICATION_FAILED",
        "Backup scheme id does not match this build.",
      );
    }
    if (
      bundle.publicIdentity.stealthMetaAddress !== payload.stealthMetaAddress
    ) {
      throw new VaultError(
        "IDENTITY_VERIFICATION_FAILED",
        "Reconstructed identity does not match the backup.",
      );
    }

    return bundle;
  } catch (error) {
    // Never leave usable key material behind on a rejected restore.
    spending.destroy();
    viewing.destroy();
    throw error;
  }
}

/** Confirms two identities are the same, for round-trip verification. */
export function sameIdentity(
  a: StealthIdentityBundle,
  b: StealthIdentityBundle,
): boolean {
  return (
    a.publicIdentity.stealthMetaAddress === b.publicIdentity.stealthMetaAddress &&
    a.publicIdentity.spendingPublicKey === b.publicIdentity.spendingPublicKey &&
    a.publicIdentity.viewingPublicKey === b.publicIdentity.viewingPublicKey &&
    a.publicIdentity.schemeId === b.publicIdentity.schemeId &&
    a.publicIdentity.chainId === b.publicIdentity.chainId
  );
}

export { addressesEqual };
