import {
  AAD_VERSION,
  BACKUP_FORMAT,
  BACKUP_VERSION,
  CIPHER_ALGORITHM,
  NONCE_BYTES,
  TAG_LENGTH_BITS,
} from "./constants";
import { VaultError } from "./errors";
import { assertValidKdfParams } from "./key-derivation";
import { utf8ToBytes } from "./bytes";
import type { VaultEnvelopeV1 } from "./types";

/**
 * Builds the additional authenticated data for AES-GCM.
 *
 * This binds the ciphertext to the exact format version, KDF parameters and
 * cipher metadata it was produced with. If any of those are altered in the
 * file — for example downgrading `memoryKiB` to make brute-forcing cheaper, or
 * claiming a different format version — the GCM tag check fails and decryption
 * is refused rather than silently proceeding under attacker-chosen parameters.
 *
 * The layout is a fixed-order delimited string rather than JSON, so it cannot
 * shift with object key ordering between runtimes.
 */
export function buildAad(envelope: VaultEnvelopeV1): Uint8Array {
  const parts = [
    envelope.format,
    `v${envelope.version}`,
    `aad${envelope.aadVersion}`,
    envelope.kdf.algorithm,
    String(envelope.kdf.version),
    String(envelope.kdf.memoryKiB),
    String(envelope.kdf.iterations),
    String(envelope.kdf.parallelism),
    envelope.kdf.salt.toLowerCase(),
    envelope.cipher.algorithm,
    String(envelope.cipher.tagLength),
    envelope.cipher.nonce.toLowerCase(),
  ];
  return utf8ToBytes(parts.join("|"));
}

/**
 * Validates an untrusted object as a v1 envelope.
 *
 * Runs before any KDF or decryption work so malformed input is rejected
 * cheaply, and so KDF parameters are bounds-checked before they are used.
 */
export function assertValidEnvelope(
  value: unknown,
): asserts value is VaultEnvelopeV1 {
  if (typeof value !== "object" || value === null) {
    throw new VaultError("INVALID_ENVELOPE", "Backup is not an object.");
  }
  const e = value as Record<string, unknown>;

  if (e.format !== BACKUP_FORMAT) {
    throw new VaultError(
      "UNSUPPORTED_FORMAT",
      "This file is not a StealthPay encrypted backup.",
    );
  }
  if (e.version !== BACKUP_VERSION) {
    throw new VaultError(
      "UNSUPPORTED_VERSION",
      `Unsupported backup version. This build understands version ${BACKUP_VERSION}.`,
    );
  }
  if (e.aadVersion !== AAD_VERSION) {
    throw new VaultError(
      "UNSUPPORTED_VERSION",
      `Unsupported AAD version. This build understands version ${AAD_VERSION}.`,
    );
  }

  assertValidKdfParams(e.kdf);

  if (typeof e.cipher !== "object" || e.cipher === null) {
    throw new VaultError("INVALID_ENVELOPE", "Missing cipher parameters.");
  }
  const c = e.cipher as Record<string, unknown>;
  if (c.algorithm !== CIPHER_ALGORITHM) {
    throw new VaultError(
      "UNSUPPORTED_CIPHER",
      `Unsupported cipher. Expected ${CIPHER_ALGORITHM}.`,
    );
  }
  if (c.tagLength !== TAG_LENGTH_BITS) {
    throw new VaultError(
      "UNSUPPORTED_CIPHER",
      `Unsupported authentication tag length. Expected ${TAG_LENGTH_BITS} bits.`,
    );
  }
  if (
    typeof c.nonce !== "string" ||
    !/^[0-9a-fA-F]+$/.test(c.nonce) ||
    c.nonce.length !== NONCE_BYTES * 2
  ) {
    throw new VaultError(
      "INVALID_ENVELOPE",
      `Cipher nonce must be ${NONCE_BYTES} bytes of hex.`,
    );
  }

  if (
    typeof e.ciphertext !== "string" ||
    e.ciphertext.length === 0 ||
    !/^[0-9a-fA-F]+$/.test(e.ciphertext) ||
    e.ciphertext.length % 2 !== 0
  ) {
    throw new VaultError("INVALID_ENVELOPE", "Ciphertext must be hex.");
  }
  // Ciphertext always carries the appended GCM tag, so it cannot be shorter.
  if (e.ciphertext.length / 2 <= TAG_LENGTH_BITS / 8) {
    throw new VaultError("INVALID_ENVELOPE", "Ciphertext is too short.");
  }

  if (typeof e.createdAt !== "string" || Number.isNaN(Date.parse(e.createdAt))) {
    throw new VaultError("INVALID_ENVELOPE", "Missing or invalid createdAt.");
  }
}

/** Serializes an envelope for download. Pretty-printed for inspectability. */
export function serializeEnvelope(envelope: VaultEnvelopeV1): string {
  return `${JSON.stringify(envelope, null, 2)}\n`;
}

/** Parses and validates backup file text. */
export function parseEnvelope(text: string): VaultEnvelopeV1 {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new VaultError(
      "INVALID_ENVELOPE",
      "Backup file is not valid JSON.",
    );
  }
  assertValidEnvelope(parsed);
  return parsed;
}

/**
 * Suggested download filename.
 *
 * Carries no identity information: the file name is user-visible and often
 * synced or backed up by the OS, so it must not reveal which identity it holds.
 */
export function suggestedBackupFilename(now = new Date()): string {
  const stamp = now.toISOString().slice(0, 19).replace(/[:T]/g, "-");
  return `stealthpay-backup-${stamp}.stealthpay`;
}
