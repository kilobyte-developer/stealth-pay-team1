import type { Address, Hex } from "viem";
import type { SupportedChainId } from "./constants";
import type { SecretKeyMaterial } from "./secure-memory";

export type { Address, Hex };

/** `0x` + 66 hex chars — a SEC1 compressed SECP256k1 point. */
export type CompressedPublicKey = Hex;

/** `0x` + 2 hex chars — the single-byte ERC-5564 view tag. */
export type ViewTag = Hex;

/** Public half of a receiver's stealth identity. Safe to publish. */
export interface StealthIdentityPublic {
  schemeId: number;
  chainId: SupportedChainId;
  spendingPublicKey: CompressedPublicKey;
  viewingPublicKey: CompressedPublicKey;
  /** `st:avax:0x<spendingPubKey><viewingPubKey>` */
  stealthMetaAddress: string;
  /** The raw `0x`-prefixed key concatenation, without the URI prefix. */
  stealthMetaAddressRaw: Hex;
}

/**
 * Private half. Never serialize, persist, transmit or log this.
 * `SecretKeyMaterial.toJSON()` throws specifically to enforce that.
 */
export interface StealthIdentitySecrets {
  spendingPrivateKey: SecretKeyMaterial;
  viewingPrivateKey: SecretKeyMaterial;
  /** Best-effort clearing of both scalars. */
  destroy(): void;
}

export interface StealthIdentityBundle {
  publicIdentity: StealthIdentityPublic;
  secrets: StealthIdentitySecrets;
}

/** Result of parsing a stealth meta-address URI. */
export interface ParsedStealthMetaAddress {
  schemeId: number;
  spendingPublicKey: CompressedPublicKey;
  viewingPublicKey: CompressedPublicKey;
  /** Chain label found in the URI, or null when a bare `0x…` was supplied. */
  chainLabel: string | null;
  stealthMetaAddressRaw: Hex;
}

/**
 * Sender-side output. Deliberately excludes the ephemeral *private* key — see
 * `OneTimeStealthAddressWithSecret` for the test-only variant.
 */
export interface OneTimeStealthAddress {
  schemeId: number;
  chainId: SupportedChainId;
  stealthAddress: Address;
  ephemeralPublicKey: CompressedPublicKey;
  viewTag: ViewTag;
}

/**
 * Internal/test-only shape that also carries the ephemeral private key.
 * Never returned by the public sender API and never rendered in the UI.
 */
export interface OneTimeStealthAddressWithSecret
  extends OneTimeStealthAddress {
  ephemeralPrivateKey: SecretKeyMaterial;
}

export interface CheckStealthAnnouncementParams {
  stealthAddress: Address;
  ephemeralPublicKey: CompressedPublicKey;
  viewTag: ViewTag;
  viewingPrivateKey: SecretKeyMaterial;
  spendingPublicKey: CompressedPublicKey;
  schemeId: number;
}

export type StealthCheckReason =
  | "match"
  | "view-tag-mismatch"
  | "address-mismatch";

/** Strongly typed outcome so callers can distinguish *why* a check failed. */
export interface StealthCheckResult {
  isForUser: boolean;
  reason: StealthCheckReason;
  /** Address re-derived from the receiver's keys; present unless the view tag filtered first. */
  derivedStealthAddress: Address | null;
}

export interface DeriveOneTimeSpendingKeyParams {
  ephemeralPublicKey: CompressedPublicKey;
  viewingPrivateKey: SecretKeyMaterial;
  spendingPrivateKey: SecretKeyMaterial;
  /** The announced address; derivation is rejected if it does not match. */
  expectedStealthAddress: Address;
  schemeId: number;
}

export interface OneTimeSpendingKey {
  /** The scalar controlling exactly one stealth account. */
  privateKey: SecretKeyMaterial;
  /** Address independently derived from `privateKey` and verified to match. */
  stealthAddress: Address;
}

/**
 * Shape of an ERC-5564 `Announcement` event, for the future scanner and
 * contract layers. Not produced by this milestone — no chain reads happen yet.
 *
 * Per ERC-5564 the view tag is the FIRST byte of the announcement metadata.
 */
export interface StealthAnnouncement {
  schemeId: number;
  stealthAddress: Address;
  caller: Address;
  ephemeralPublicKey: CompressedPublicKey;
  viewTag: ViewTag;
  /** Full metadata blob; byte 0 is the view tag. */
  metadata?: Hex;
  transactionHash?: Hex;
  blockNumber?: bigint;
}
