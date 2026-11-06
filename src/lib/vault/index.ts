/**
 * StealthPay encrypted vault — Argon2id + AES-256-GCM, persisted as ciphertext
 * in IndexedDB, with a downloadable encrypted backup for cross-device recovery.
 *
 * See docs/KEY_RECOVERY.md for the threat model and limitations.
 *
 * NOT INDEPENDENTLY AUDITED.
 */

export {
  AAD_VERSION,
  BACKUP_FILE_EXTENSION,
  BACKUP_FORMAT,
  BACKUP_VERSION,
  CIPHER_ALGORITHM,
  DEFAULT_AUTO_LOCK_MS,
  DEFAULT_KDF_PARAMS,
  KDF_ALGORITHM,
  KDF_BOUNDS,
  MIN_PASSWORD_LENGTH,
  PAYLOAD_VERSION,
  RECOMMENDED_PASSWORD_LENGTH,
} from "./constants";

export {
  GENERIC_UNLOCK_FAILURE,
  VAULT_ERROR_CODES,
  VaultError,
  isVaultError,
  toSafeVaultMessage,
  type VaultErrorCode,
} from "./errors";

export {
  assessPassword,
  assertAcceptablePassword,
  assertValidKdfParams,
  deriveVaultKey,
  freshKdfParams,
} from "./key-derivation";

export { decryptEnvelope, encryptPayload } from "./encryption";

export {
  assertValidEnvelope,
  buildAad,
  parseEnvelope,
  serializeEnvelope,
  suggestedBackupFilename,
} from "./backup-format";

export {
  identityToPayload,
  payloadToIdentity,
  sameIdentity,
} from "./identity-codec";

export {
  debugReadRawRecord,
  deleteVault,
  getVaultStatus,
  hasVault,
  loadEnvelope,
  markBackupConfirmed,
  markExported,
  resetVaultDbConnection,
  saveEnvelope,
} from "./storage";

export {
  changeVaultPassword,
  confirmBackupStored,
  createVault,
  exportBackup,
  importBackup,
  unlockVault,
} from "./vault-service";

export type {
  PasswordStrength,
  RecoveryStatus,
  VaultCipherParams,
  VaultEnvelopeV1,
  VaultKdfParams,
  VaultPayloadV1,
  VaultRecord,
  VaultStatus,
} from "./types";
