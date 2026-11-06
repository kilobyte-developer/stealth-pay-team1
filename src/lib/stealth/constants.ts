import { VALID_SCHEME_ID } from "@scopelift/stealth-address-sdk";

/**
 * ERC-5564 scheme identifier for the SECP256k1 scheme.
 * This is the only scheme StealthPay implements.
 */
export const SCHEME_ID_SECP256K1 = VALID_SCHEME_ID.SCHEME_ID_1;

/** Numeric form of the supported scheme id, for comparison against announcements. */
export const SUPPORTED_SCHEME_ID = 1 as const;

/** Stealth meta-address URI scheme prefix, per ERC-5564 (`st:<chain>:<keys>`). */
export const STEALTH_URI_SCHEME = "st";

/**
 * Chain label used in the meta-address URI.
 *
 * ERC-5564's example URI is `st:eth:0x<spendingPubKey><viewingPubKey>`. The ERC
 * does not register a label for Avalanche, and the ScopeLift SDK does not
 * validate this segment at all (verified against
 * `parseStealthMetaAddressURI` in v1.0.0-beta.5 — it only checks that the URI
 * splits into three parts beginning with `st`).
 *
 * StealthPay therefore uses a single chain-*family* label for both Avalanche
 * networks and carries the precise `chainId` as separate metadata rather than
 * inventing a per-network URI label. Stealth keys and derived addresses are
 * chain-agnostic; only the payment context is chain-specific.
 */
export const AVALANCHE_CHAIN_LABEL = "avax";

/** Byte and hex-character lengths for scheme 1 key material. */
export const LENGTHS = {
  /** 32-byte private scalar. */
  privateKeyBytes: 32,
  /** `0x` + 64 hex characters. */
  privateKeyHex: 66,
  /** 33-byte SEC1 compressed point. */
  compressedPublicKeyBytes: 33,
  /** `0x` + 66 hex characters. */
  compressedPublicKeyHex: 68,
  /** 65-byte SEC1 uncompressed point (0x04 prefix). */
  uncompressedPublicKeyBytes: 65,
  /** Two concatenated compressed keys, without the `0x` prefix. */
  metaAddressBodyHexChars: 132,
  /** Single compressed key, without the `0x` prefix. */
  publicKeyBodyHexChars: 66,
  /** `0x` + 2 hex characters (one byte). */
  viewTagHex: 4,
} as const;

/** Avalanche chain ids StealthPay binds identities and payments to. */
export const SUPPORTED_CHAIN_IDS = [43113, 43114] as const;

/** Fuji — the default development and demonstration network. */
export const DEFAULT_CHAIN_ID = 43113 as const;

export type SupportedChainId = (typeof SUPPORTED_CHAIN_IDS)[number];

export function isSupportedChainId(
  chainId: number,
): chainId is SupportedChainId {
  return (SUPPORTED_CHAIN_IDS as readonly number[]).includes(chainId);
}
