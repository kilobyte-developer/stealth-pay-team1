export const VAULT_ERROR_CODES = [
  "UNSUPPORTED_FORMAT",
  "UNSUPPORTED_VERSION",
  "UNSUPPORTED_KDF",
  "UNSUPPORTED_CIPHER",
  "INVALID_ENVELOPE",
  "INVALID_KDF_PARAMS",
  "DECRYPTION_FAILED",
  "INVALID_PAYLOAD",
  "IDENTITY_VERIFICATION_FAILED",
  "WEAK_PASSWORD",
  "VAULT_NOT_FOUND",
  "VAULT_ALREADY_EXISTS",
  "VAULT_LOCKED",
  "STORAGE_UNAVAILABLE",
] as const;

export type VaultErrorCode = (typeof VAULT_ERROR_CODES)[number];

/**
 * Error type for vault operations.
 *
 * Messages never contain key material, password text, or decrypted payload
 * fragments. Anything that could help an attacker distinguish *why* a decrypt
 * failed is deliberately collapsed into one generic message — see
 * {@link GENERIC_UNLOCK_FAILURE}.
 */
export class VaultError extends Error {
  readonly code: VaultErrorCode;

  constructor(code: VaultErrorCode, message: string) {
    super(message);
    this.name = "VaultError";
    this.code = code;
    Object.setPrototypeOf(this, VaultError.prototype);
  }
}

export function isVaultError(error: unknown): error is VaultError {
  return error instanceof VaultError;
}

/**
 * The single message shown for any failed unlock.
 *
 * A wrong password and a tampered ciphertext are indistinguishable to the
 * user on purpose: AES-GCM authentication failure cannot tell them apart, and
 * reporting which one occurred would leak information about the file.
 */
export const GENERIC_UNLOCK_FAILURE =
  "Unable to unlock this backup. The password may be incorrect or the backup may be corrupted.";

export function toSafeVaultMessage(error: unknown): string {
  if (isVaultError(error)) return error.message;
  return "The vault operation could not be completed.";
}
