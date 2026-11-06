/**
 * StealthPay cryptographic engine — ERC-5564 scheme 1 (SECP256k1).
 *
 * Standards compatibility is provided by `@scopelift/stealth-address-sdk`
 * (pinned at 1.0.0-beta.5). This module wraps it with input validation, chain
 * binding, secret containment and typed errors. See docs/CRYPTO_ENGINE.md.
 *
 * NOT INDEPENDENTLY AUDITED. Fuji testnet only.
 */

export {
  AVALANCHE_CHAIN_LABEL,
  DEFAULT_CHAIN_ID,
  LENGTHS,
  SCHEME_ID_SECP256K1,
  SUPPORTED_CHAIN_IDS,
  SUPPORTED_SCHEME_ID,
  isSupportedChainId,
  type SupportedChainId,
} from "./constants";

export {
  STEALTH_ERROR_CODES,
  StealthError,
  isStealthError,
  toSafeErrorMessage,
  type StealthErrorCode,
} from "./errors";

export { SecretKeyMaterial } from "./secure-memory";

export {
  buildIdentityFromSecrets,
  generateStealthIdentity,
  importPrivateScalar,
} from "./key-generation";

export { buildStealthMetaAddress, parseStealthMetaAddress } from "./meta-address";

export { deriveWithEphemeralKey, generateOneTimeStealthAddress } from "./sender";

export { checkStealthAnnouncement } from "./receiver";

export {
  deriveOneTimeSpendingKey,
  verifyPaymentDerivation,
} from "./key-derivation";

export {
  addressFromPrivateKey,
  addressesEqual,
  compressedPublicKeyFrom,
} from "./address-utils";

export type {
  Address,
  CheckStealthAnnouncementParams,
  CompressedPublicKey,
  DeriveOneTimeSpendingKeyParams,
  Hex,
  OneTimeSpendingKey,
  OneTimeStealthAddress,
  OneTimeStealthAddressWithSecret,
  ParsedStealthMetaAddress,
  StealthAnnouncement,
  StealthCheckReason,
  StealthCheckResult,
  StealthIdentityBundle,
  StealthIdentityPublic,
  StealthIdentitySecrets,
  ViewTag,
} from "./types";
