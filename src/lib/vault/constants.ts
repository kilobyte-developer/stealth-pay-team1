/** Magic string identifying a StealthPay encrypted backup. */
export const BACKUP_FORMAT = "STEALTHPAY_ENCRYPTED_BACKUP" as const;

/** Envelope format version. Bump only for breaking envelope changes. */
export const BACKUP_VERSION = 1 as const;

/** Version of the additional-authenticated-data construction. */
export const AAD_VERSION = 1 as const;

/** Version of the encrypted payload schema. */
export const PAYLOAD_VERSION = 1 as const;

export const KDF_ALGORITHM = "argon2id" as const;
export const CIPHER_ALGORITHM = "AES-256-GCM" as const;

/**
 * Argon2 version. hash-wasm implements Argon2 v1.3 (0x13 = 19) and exposes no
 * way to select another, so this is recorded for forward compatibility and
 * validated on import rather than configured.
 */
export const ARGON2_VERSION = 19 as const;

/**
 * Default Argon2id work factors.
 *
 * These are the OWASP Password Storage Cheat Sheet minimum for Argon2id
 * (19 MiB memory, 2 iterations, 1 degree of parallelism):
 * https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html
 *
 * Do not lower these to make unlocking feel faster. Raising them is safe for
 * new backups — the parameters travel inside each envelope, so old backups
 * keep decrypting with the values they were created with.
 */
export const DEFAULT_KDF_PARAMS = {
  memoryKiB: 19_456,
  iterations: 2,
  parallelism: 1,
} as const;

/**
 * Hard bounds applied to KDF parameters read from an imported file.
 *
 * An attacker-supplied envelope could otherwise request gigabytes of memory or
 * thousands of iterations and hang or crash the tab, so parameters are range-
 * checked BEFORE the KDF runs.
 */
export const KDF_BOUNDS = {
  memoryKiB: { min: 8_192, max: 262_144 }, // 8 MiB … 256 MiB
  iterations: { min: 1, max: 10 },
  parallelism: { min: 1, max: 4 },
} as const;

/** Derived AES key length in bytes (AES-256). */
export const DERIVED_KEY_BYTES = 32;

/** Argon2id salt length in bytes. */
export const SALT_BYTES = 16;

/** AES-GCM nonce length in bytes (96 bits, the recommended size). */
export const NONCE_BYTES = 12;

/** AES-GCM authentication tag length in bits. */
export const TAG_LENGTH_BITS = 128;

/** File extension for downloadable backups. */
export const BACKUP_FILE_EXTENSION = ".stealthpay";

/** Default inactivity timeout before the vault auto-locks. */
export const DEFAULT_AUTO_LOCK_MS = 15 * 60 * 1000;

/** Minimum vault password length accepted. */
export const MIN_PASSWORD_LENGTH = 12;

/** Length we actively encourage in the UI. */
export const RECOMMENDED_PASSWORD_LENGTH = 16;
