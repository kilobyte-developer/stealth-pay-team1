import type {
  AAD_VERSION,
  BACKUP_FORMAT,
  BACKUP_VERSION,
  CIPHER_ALGORITHM,
  KDF_ALGORITHM,
  PAYLOAD_VERSION,
} from "./constants";
import type { Hex } from "@/lib/stealth";

/** Argon2id parameters, carried inside every envelope. */
export interface VaultKdfParams {
  algorithm: typeof KDF_ALGORITHM;
  /** Argon2 version constant (0x13 = 19). */
  version: number;
  memoryKiB: number;
  iterations: number;
  parallelism: number;
  /** Hex-encoded random salt, unique per encryption. */
  salt: string;
}

export interface VaultCipherParams {
  algorithm: typeof CIPHER_ALGORITHM;
  /** Hex-encoded 96-bit nonce, unique per encryption. */
  nonce: string;
  tagLength: number;
}

/**
 * The on-disk / in-IndexedDB backup envelope.
 *
 * Everything here is PUBLIC: it contains only what is needed to attempt a
 * decryption, plus a creation timestamp. All secrets live inside
 * `ciphertext`, and `kdf`/`cipher` are authenticated via AAD so they cannot be
 * downgraded or tampered with without failing the GCM tag check.
 */
export interface VaultEnvelopeV1 {
  format: typeof BACKUP_FORMAT;
  version: typeof BACKUP_VERSION;
  kdf: VaultKdfParams;
  cipher: VaultCipherParams;
  aadVersion: typeof AAD_VERSION;
  /** Hex-encoded AES-256-GCM ciphertext with the auth tag appended. */
  ciphertext: string;
  /** ISO timestamp this envelope was produced. Not secret. */
  createdAt: string;
}

/**
 * The decrypted contents.
 *
 * Both private scalars are here in hex. An instance of this type is a SECRET
 * — never log it, never put it in React state, never serialize it anywhere
 * except back into a ciphertext.
 */
export interface VaultPayloadV1 {
  payloadVersion: typeof PAYLOAD_VERSION;
  schemeId: number;
  /** Chain family label from the meta-address URI, e.g. "avax". */
  chainFamily: string;
  /** Precise chain id the identity was created against (43113 / 43114). */
  chainId: number;
  spendingPrivateKey: Hex;
  viewingPrivateKey: Hex;
  spendingPublicKey: Hex;
  viewingPublicKey: Hex;
  stealthMetaAddress: string;
  /** ISO timestamp the identity itself was created. */
  identityCreatedAt: string;
}

/**
 * How recoverable the current identity is.
 *
 * `backup_exported` means a file was generated — NOT that the user actually
 * stored it safely. Only `recovery_verified` records an explicit user
 * confirmation, and even that is a claim by the user.
 */
export type RecoveryStatus =
  | "not_configured"
  | "vault_encrypted"
  | "backup_exported"
  | "recovery_verified"
  | "locked";

/** Non-sensitive row stored alongside the ciphertext in IndexedDB. */
export interface VaultRecord {
  id: string;
  envelope: VaultEnvelopeV1;
  /** ISO timestamp the vault record was written. */
  savedAt: string;
  /** ISO timestamp of the last successful backup export, if any. */
  lastExportedAt: string | null;
  /** Whether the user has confirmed they stored a backup safely. */
  backupConfirmed: boolean;
}

/** Summary safe to render in the UI. Contains no secrets. */
export interface VaultStatus {
  exists: boolean;
  recoveryStatus: RecoveryStatus;
  savedAt: string | null;
  lastExportedAt: string | null;
  backupConfirmed: boolean;
}

export interface PasswordStrength {
  /** 0–4, in the style of a strength meter. */
  score: 0 | 1 | 2 | 3 | 4;
  label: "Too short" | "Weak" | "Fair" | "Good" | "Strong";
  /** True when the password clears the minimum policy. */
  acceptable: boolean;
  suggestions: string[];
}
