/**
 * Error codes raised by the stealth crypto engine.
 *
 * These are deliberately coarse: an error must describe *what kind* of input
 * was wrong without echoing the input itself, because inputs may be secret
 * key material.
 */
export const STEALTH_ERROR_CODES = [
  "INVALID_PRIVATE_KEY",
  "INVALID_PUBLIC_KEY",
  "INVALID_META_ADDRESS",
  "UNSUPPORTED_CHAIN",
  "UNSUPPORTED_SCHEME",
  "INVALID_EPHEMERAL_PUBLIC_KEY",
  "INVALID_VIEW_TAG",
  "INVALID_STEALTH_ADDRESS",
  "VIEW_TAG_MISMATCH",
  "STEALTH_ADDRESS_MISMATCH",
  "STEALTH_KEY_DERIVATION_FAILED",
  "DERIVED_ADDRESS_VALIDATION_FAILED",
  "SECRET_DESTROYED",
  "SECRET_NOT_SERIALIZABLE",
] as const;

export type StealthErrorCode = (typeof STEALTH_ERROR_CODES)[number];

/**
 * Error type for every failure in the stealth engine.
 *
 * `message` must never contain private key material, a shared secret, or a
 * derived scalar. Callers may surface `code` and `message` to the UI safely.
 */
export class StealthError extends Error {
  readonly code: StealthErrorCode;

  constructor(code: StealthErrorCode, message: string) {
    super(message);
    this.name = "StealthError";
    this.code = code;
    // Keeps `instanceof` working when compiled down to ES5-era targets.
    Object.setPrototypeOf(this, StealthError.prototype);
  }
}

export function isStealthError(error: unknown): error is StealthError {
  return error instanceof StealthError;
}

/** Narrows an unknown thrown value to a safe, non-secret message. */
export function toSafeErrorMessage(error: unknown): string {
  if (isStealthError(error)) return error.message;
  // Third-party crypto libraries can include input fragments in messages, so
  // their text is never forwarded verbatim.
  return "Cryptographic operation failed.";
}
