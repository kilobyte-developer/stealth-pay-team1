import { VaultError } from "./errors";

/**
 * Byte/hex helpers for the vault.
 *
 * Kept separate from the stealth engine's helpers because these operate on
 * arbitrary-length buffers (ciphertext, salts, nonces) rather than fixed-size
 * curve scalars.
 */

/** Cryptographically secure random bytes from the platform CSPRNG. */
export function randomBytes(length: number): Uint8Array {
  const out = new Uint8Array(length);
  getCrypto().getRandomValues(out);
  return out;
}

export function getCrypto(): Crypto {
  const c = globalThis.crypto;
  if (!c || typeof c.getRandomValues !== "function") {
    throw new VaultError(
      "STORAGE_UNAVAILABLE",
      "Web Crypto is unavailable in this environment.",
    );
  }
  return c;
}

export function getSubtle(): SubtleCrypto {
  const subtle = getCrypto().subtle;
  if (!subtle) {
    throw new VaultError(
      "STORAGE_UNAVAILABLE",
      "Web Crypto SubtleCrypto is unavailable. A secure context (HTTPS or localhost) is required.",
    );
  }
  return subtle;
}

export function bytesToHex(bytes: Uint8Array): string {
  let out = "";
  for (const b of bytes) out += b.toString(16).padStart(2, "0");
  return out;
}

export function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  if (clean.length % 2 !== 0 || !/^[0-9a-fA-F]*$/.test(clean)) {
    throw new VaultError("INVALID_ENVELOPE", "Malformed hex value.");
  }
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = Number.parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

export function utf8ToBytes(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

export function bytesToUtf8(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}

/** Best-effort overwrite. JavaScript offers no zeroization guarantee. */
export function wipe(bytes: Uint8Array | null | undefined): void {
  if (bytes) bytes.fill(0);
}
