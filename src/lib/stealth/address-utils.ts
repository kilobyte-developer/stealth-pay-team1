import { getPublicKey } from "@noble/secp256k1";
import { bytesToHex, getAddress } from "viem";
import { publicKeyToAddress } from "viem/accounts";
import { StealthError } from "./errors";
import type { Address, CompressedPublicKey, Hex } from "./types";
import { SecretKeyMaterial } from "./secure-memory";

/** Derives the SEC1 compressed public key for a private scalar. */
export function compressedPublicKeyFrom(
  secret: SecretKeyMaterial,
): CompressedPublicKey {
  return bytesToHex(getPublicKey(secret.bytes(), true));
}

/** Derives the SEC1 uncompressed public key for a private scalar. */
export function uncompressedPublicKeyFrom(secret: SecretKeyMaterial): Hex {
  return bytesToHex(getPublicKey(secret.bytes(), false));
}

/**
 * Derives the checksummed EVM address for a private scalar.
 *
 * Uses viem's `publicKeyToAddress`, which performs the canonical steps:
 * take the uncompressed key, drop the `0x04` prefix, keccak-256 it, keep the
 * last 20 bytes, and apply EIP-55 checksum casing. This is the same helper the
 * ScopeLift SDK uses, so sender and receiver cannot diverge on address format.
 */
export function addressFromPrivateKey(secret: SecretKeyMaterial): Address {
  try {
    return publicKeyToAddress(uncompressedPublicKeyFrom(secret));
  } catch {
    throw new StealthError(
      "DERIVED_ADDRESS_VALIDATION_FAILED",
      "Could not derive an address from the private key.",
    );
  }
}

/** Case-insensitive address comparison, normalised through EIP-55 checksums. */
export function addressesEqual(a: string, b: string): boolean {
  try {
    return getAddress(a) === getAddress(b);
  } catch {
    return a.toLowerCase() === b.toLowerCase();
  }
}
