import {
  AAD_VERSION,
  BACKUP_FORMAT,
  BACKUP_VERSION,
  CIPHER_ALGORITHM,
  NONCE_BYTES,
  TAG_LENGTH_BITS,
} from "./constants";
import { GENERIC_UNLOCK_FAILURE, VaultError } from "./errors";
import { buildAad } from "./backup-format";
import { deriveVaultKey, freshKdfParams } from "./key-derivation";
import {
  bytesToHex,
  bytesToUtf8,
  getSubtle,
  hexToBytes,
  randomBytes,
  utf8ToBytes,
  wipe,
} from "./bytes";
import type { VaultEnvelopeV1, VaultKdfParams, VaultPayloadV1 } from "./types";

async function importAesKey(raw: Uint8Array): Promise<CryptoKey> {
  // `false` for extractable: the key cannot be read back out of WebCrypto.
  return getSubtle().importKey("raw", raw as BufferSource, "AES-GCM", false, [
    "encrypt",
    "decrypt",
  ]);
}

/**
 * Encrypts a vault payload under a password.
 *
 * A fresh salt AND a fresh nonce are generated on every call. Reusing a
 * (key, nonce) pair with AES-GCM is catastrophic — it leaks the keystream —
 * so neither value is ever carried over from a previous envelope, including
 * when re-encrypting during a password change.
 */
export async function encryptPayload(
  payload: VaultPayloadV1,
  password: string,
  kdfOverride?: VaultKdfParams,
): Promise<VaultEnvelopeV1> {
  const kdf = kdfOverride ?? freshKdfParams();
  const nonce = randomBytes(NONCE_BYTES);

  // Envelope skeleton first: the AAD must cover the exact metadata that will
  // ship with the ciphertext.
  const envelope: VaultEnvelopeV1 = {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    kdf,
    cipher: {
      algorithm: CIPHER_ALGORITHM,
      nonce: bytesToHex(nonce),
      tagLength: TAG_LENGTH_BITS,
    },
    aadVersion: AAD_VERSION,
    ciphertext: "",
    createdAt: new Date().toISOString(),
  };

  let derived: Uint8Array | null = null;
  let plaintext: Uint8Array | null = null;
  try {
    derived = await deriveVaultKey(password, kdf);
    const key = await importAesKey(derived);
    plaintext = utf8ToBytes(JSON.stringify(payload));

    const ciphertext = await getSubtle().encrypt(
      {
        name: "AES-GCM",
        iv: nonce as BufferSource,
        additionalData: buildAad(envelope) as BufferSource,
        tagLength: TAG_LENGTH_BITS,
      },
      key,
      plaintext as BufferSource,
    );

    envelope.ciphertext = bytesToHex(new Uint8Array(ciphertext));
    return envelope;
  } finally {
    // Best effort only — see docs/KEY_RECOVERY.md on zeroization limits.
    wipe(derived);
    wipe(plaintext);
  }
}

/**
 * Decrypts an envelope.
 *
 * Any failure — wrong password, tampered ciphertext, altered nonce, swapped
 * salt, downgraded KDF parameters — surfaces as the same generic error. GCM
 * cannot distinguish these, and reporting which occurred would leak
 * information about the file to whoever holds it.
 */
export async function decryptEnvelope(
  envelope: VaultEnvelopeV1,
  password: string,
): Promise<VaultPayloadV1> {
  let derived: Uint8Array | null = null;
  let plaintext: Uint8Array | null = null;

  try {
    derived = await deriveVaultKey(password, envelope.kdf);
    const key = await importAesKey(derived);

    const decrypted = await getSubtle().decrypt(
      {
        name: "AES-GCM",
        iv: hexToBytes(envelope.cipher.nonce) as BufferSource,
        additionalData: buildAad(envelope) as BufferSource,
        tagLength: envelope.cipher.tagLength,
      },
      key,
      hexToBytes(envelope.ciphertext) as BufferSource,
    );

    plaintext = new Uint8Array(decrypted);
    const parsed = JSON.parse(bytesToUtf8(plaintext)) as unknown;
    return assertValidPayload(parsed);
  } catch (error) {
    // Structural problems found AFTER a successful decrypt are genuine payload
    // errors and are worth distinguishing; everything else collapses.
    if (error instanceof VaultError && error.code === "INVALID_PAYLOAD") {
      throw error;
    }
    throw new VaultError("DECRYPTION_FAILED", GENERIC_UNLOCK_FAILURE);
  } finally {
    wipe(derived);
    wipe(plaintext);
  }
}

function assertValidPayload(value: unknown): VaultPayloadV1 {
  if (typeof value !== "object" || value === null) {
    throw new VaultError("INVALID_PAYLOAD", "Decrypted payload is not an object.");
  }
  const p = value as Record<string, unknown>;

  const requiredStrings = [
    "spendingPrivateKey",
    "viewingPrivateKey",
    "spendingPublicKey",
    "viewingPublicKey",
    "stealthMetaAddress",
    "chainFamily",
    "identityCreatedAt",
  ] as const;

  for (const field of requiredStrings) {
    if (typeof p[field] !== "string" || (p[field] as string).length === 0) {
      throw new VaultError(
        "INVALID_PAYLOAD",
        `Decrypted payload is missing "${field}".`,
      );
    }
  }
  for (const field of ["payloadVersion", "schemeId", "chainId"] as const) {
    if (typeof p[field] !== "number") {
      throw new VaultError(
        "INVALID_PAYLOAD",
        `Decrypted payload is missing "${field}".`,
      );
    }
  }

  return value as VaultPayloadV1;
}
