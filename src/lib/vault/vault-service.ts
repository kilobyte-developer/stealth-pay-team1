import type { StealthIdentityBundle } from "@/lib/stealth";
import { VaultError } from "./errors";
import { decryptEnvelope, encryptPayload } from "./encryption";
import { identityToPayload, payloadToIdentity, sameIdentity } from "./identity-codec";
import { assertAcceptablePassword } from "./key-derivation";
import {
  parseEnvelope,
  serializeEnvelope,
  suggestedBackupFilename,
} from "./backup-format";
import {
  loadEnvelope,
  markBackupConfirmed,
  markExported,
  saveEnvelope,
} from "./storage";
import type { VaultEnvelopeV1, VaultPayloadV1 } from "./types";

/**
 * High-level vault operations.
 *
 * Every function here takes the password as a short-lived argument and never
 * stores it. None of them return a payload containing private keys to the
 * caller except `unlock`/`importBackup`, which return a
 * {@link StealthIdentityBundle} whose secrets are wrapped in
 * `SecretKeyMaterial` (non-serializable by design).
 */

/**
 * Encrypts a freshly generated identity, persists it, and proves the round
 * trip before reporting success.
 *
 * The verification decrypt is not ceremony: without it, a user could be told
 * their identity is safely encrypted when in fact the envelope is unreadable,
 * and they would discover it only after losing the in-memory copy.
 */
export async function createVault(
  bundle: StealthIdentityBundle,
  password: string,
  options: { allowOverwrite?: boolean } = {},
): Promise<VaultEnvelopeV1> {
  assertAcceptablePassword(password);

  const payload = identityToPayload(bundle);
  const envelope = await encryptPayload(payload, password);

  // Round-trip check BEFORE persisting anything.
  const restored = await decryptEnvelope(envelope, password);
  const restoredBundle = payloadToIdentity(restored);
  const matches = sameIdentity(bundle, restoredBundle);
  restoredBundle.secrets.destroy();

  if (!matches) {
    throw new VaultError(
      "IDENTITY_VERIFICATION_FAILED",
      "Encryption round trip did not reproduce the identity. Nothing was saved.",
    );
  }

  await saveEnvelope(envelope, {
    allowOverwrite: options.allowOverwrite,
    lastExportedAt: null,
    backupConfirmed: false,
  });

  return envelope;
}

/** Decrypts the stored vault and rebuilds the identity. */
export async function unlockVault(
  password: string,
): Promise<StealthIdentityBundle> {
  const envelope = await loadEnvelope();
  const payload = await decryptEnvelope(envelope, password);
  return payloadToIdentity(payload);
}

/**
 * Produces a downloadable backup.
 *
 * A FRESH envelope is generated — new salt, new nonce — rather than re-serving
 * the stored one. That keeps every exported artifact independent, so one
 * leaked file reveals nothing about another.
 */
export async function exportBackup(
  password: string,
): Promise<{ filename: string; contents: string }> {
  const stored = await loadEnvelope();

  // Proves the supplied password actually opens this vault before exporting.
  const payload = await decryptEnvelope(stored, password);

  let fresh: VaultEnvelopeV1;
  try {
    fresh = await encryptPayload(payload, password);
    // Confirm the new envelope is readable before handing it to the user.
    const check = await decryptEnvelope(fresh, password);
    const bundle = payloadToIdentity(check);
    bundle.secrets.destroy();
  } finally {
    scrubPayload(payload);
  }

  await markExported();

  return {
    filename: suggestedBackupFilename(),
    contents: serializeEnvelope(fresh),
  };
}

/**
 * Restores an identity from a backup file.
 *
 * Validation order matters: envelope structure and KDF bounds are checked
 * before the KDF runs, then decryption, then full identity verification. Only
 * after all of that does anything get written to storage — a partial restore
 * is never persisted.
 */
export async function importBackup(
  fileContents: string,
  password: string,
  options: { allowOverwrite?: boolean } = {},
): Promise<StealthIdentityBundle> {
  const envelope = parseEnvelope(fileContents);
  const payload = await decryptEnvelope(envelope, password);
  const bundle = payloadToIdentity(payload);

  try {
    await saveEnvelope(envelope, {
      allowOverwrite: options.allowOverwrite,
      lastExportedAt: null,
      backupConfirmed: false,
    });
  } catch (error) {
    bundle.secrets.destroy();
    throw error;
  } finally {
    scrubPayload(payload);
  }

  return bundle;
}

/**
 * Re-encrypts the vault under a new password.
 *
 * The private keys are unchanged — only the encryption around them. A fresh
 * salt and nonce are generated, and the new envelope is verified before it
 * replaces the old one.
 */
export async function changeVaultPassword(
  currentPassword: string,
  newPassword: string,
): Promise<VaultEnvelopeV1> {
  assertAcceptablePassword(newPassword);

  const stored = await loadEnvelope();
  const payload = await decryptEnvelope(stored, currentPassword);

  try {
    const next = await encryptPayload(payload, newPassword);

    // Verify under the NEW password before overwriting.
    const check = await decryptEnvelope(next, newPassword);
    const rebuilt = payloadToIdentity(check);
    const ok =
      rebuilt.publicIdentity.stealthMetaAddress === payload.stealthMetaAddress;
    rebuilt.secrets.destroy();

    if (!ok) {
      throw new VaultError(
        "IDENTITY_VERIFICATION_FAILED",
        "Re-encryption did not reproduce the identity. The existing vault was left untouched.",
      );
    }

    // Single `put` replaces the envelope; export/confirm history is preserved
    // because the keys did not change.
    await saveEnvelope(next, { allowOverwrite: true });
    return next;
  } finally {
    scrubPayload(payload);
  }
}

/** Records that the user confirmed they stored a backup safely. */
export async function confirmBackupStored(): Promise<void> {
  await markBackupConfirmed();
}

/**
 * Best-effort scrub of a decrypted payload's secret fields.
 *
 * These are JavaScript strings, which cannot actually be wiped — overwriting
 * the property only drops the reference. Included so the object cannot be
 * re-read after use, not as a memory guarantee.
 */
function scrubPayload(payload: VaultPayloadV1): void {
  const mutable = payload as unknown as Record<string, unknown>;
  mutable.spendingPrivateKey = "";
  mutable.viewingPrivateKey = "";
}
