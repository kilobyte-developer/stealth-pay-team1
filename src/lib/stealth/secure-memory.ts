import { StealthError } from "./errors";

const REDACTED = "[SecretKeyMaterial:redacted]";

/**
 * Wrapper around a 32-byte private scalar.
 *
 * Purpose is containment, not cryptographic protection. It makes accidental
 * leakage hard by refusing to serialize, log or stringify its contents, and it
 * supports best-effort clearing.
 *
 * ## Honest limitations
 * - JavaScript gives no guarantee of memory zeroization. `destroy()` overwrites
 *   the backing `Uint8Array`, but the engine may have copied the bytes during
 *   GC, JIT or when converting to a hex string. Do not treat this as erasure.
 * - Calling `toHex()` necessarily creates an immutable string that cannot be
 *   wiped. It exists because the ScopeLift SDK's API takes `0x`-prefixed hex.
 *   Call it as late as possible and never retain the result.
 */
export class SecretKeyMaterial {
  #bytes: Uint8Array | null;

  private constructor(bytes: Uint8Array) {
    // Copy so callers cannot mutate our backing store out from under us.
    this.#bytes = Uint8Array.from(bytes);
  }

  static fromBytes(bytes: Uint8Array): SecretKeyMaterial {
    return new SecretKeyMaterial(bytes);
  }

  get destroyed(): boolean {
    return this.#bytes === null;
  }

  /** Raw bytes, for passing directly into curve operations. */
  bytes(): Uint8Array {
    if (this.#bytes === null) {
      throw new StealthError(
        "SECRET_DESTROYED",
        "This secret key material has been destroyed.",
      );
    }
    return this.#bytes;
  }

  /**
   * `0x`-prefixed hex. Produces an unwipeable string — see class notes.
   */
  toHex(): `0x${string}` {
    const bytes = this.bytes();
    let out = "";
    for (const byte of bytes) out += byte.toString(16).padStart(2, "0");
    return `0x${out}`;
  }

  /** Best-effort overwrite. Not guaranteed erasure. */
  destroy(): void {
    if (this.#bytes === null) return;
    this.#bytes.fill(0);
    this.#bytes = null;
  }

  /* ---- Leak guards ---------------------------------------------------- */

  /**
   * Throws rather than redacting, so an accidental `JSON.stringify` of app
   * state fails loudly instead of silently shipping a secret somewhere.
   */
  toJSON(): never {
    throw new StealthError(
      "SECRET_NOT_SERIALIZABLE",
      "Secret key material cannot be serialized. This is a safety guard — remove the secret from whatever object is being serialized.",
    );
  }

  toString(): string {
    return REDACTED;
  }

  get [Symbol.toStringTag](): string {
    return "SecretKeyMaterial";
  }

  /** Redacts in `console.log` under Node (util.inspect). */
  [Symbol.for("nodejs.util.inspect.custom")](): string {
    return REDACTED;
  }
}
