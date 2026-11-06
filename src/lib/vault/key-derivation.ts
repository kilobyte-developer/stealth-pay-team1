import { argon2id } from "hash-wasm";
import {
  ARGON2_VERSION,
  DEFAULT_KDF_PARAMS,
  DERIVED_KEY_BYTES,
  KDF_ALGORITHM,
  KDF_BOUNDS,
  MIN_PASSWORD_LENGTH,
  RECOMMENDED_PASSWORD_LENGTH,
  SALT_BYTES,
} from "./constants";
import { VaultError } from "./errors";
import type { PasswordStrength, VaultKdfParams } from "./types";
import { bytesToHex, hexToBytes, randomBytes } from "./bytes";

/**
 * Validates KDF parameters from an untrusted envelope BEFORE running the KDF.
 *
 * Without this, a malicious backup file could request an enormous memory cost
 * and hang or crash the tab the moment the user tried to import it.
 */
export function assertValidKdfParams(kdf: unknown): asserts kdf is VaultKdfParams {
  if (typeof kdf !== "object" || kdf === null) {
    throw new VaultError("INVALID_KDF_PARAMS", "Missing KDF parameters.");
  }
  const k = kdf as Record<string, unknown>;

  if (k.algorithm !== KDF_ALGORITHM) {
    throw new VaultError(
      "UNSUPPORTED_KDF",
      `Unsupported key-derivation function. Expected ${KDF_ALGORITHM}.`,
    );
  }
  if (k.version !== ARGON2_VERSION) {
    throw new VaultError(
      "UNSUPPORTED_KDF",
      `Unsupported Argon2 version. Expected ${ARGON2_VERSION}.`,
    );
  }

  const numeric: [keyof typeof KDF_BOUNDS, unknown][] = [
    ["memoryKiB", k.memoryKiB],
    ["iterations", k.iterations],
    ["parallelism", k.parallelism],
  ];

  for (const [name, raw] of numeric) {
    if (typeof raw !== "number" || !Number.isInteger(raw)) {
      throw new VaultError(
        "INVALID_KDF_PARAMS",
        `KDF parameter "${name}" must be an integer.`,
      );
    }
    const { min, max } = KDF_BOUNDS[name];
    if (raw < min || raw > max) {
      throw new VaultError(
        "INVALID_KDF_PARAMS",
        `KDF parameter "${name}" is outside the permitted range (${min}–${max}).`,
      );
    }
  }

  if (typeof k.salt !== "string" || !/^[0-9a-fA-F]+$/.test(k.salt)) {
    throw new VaultError("INVALID_KDF_PARAMS", "KDF salt must be hex.");
  }
  const saltBytes = k.salt.length / 2;
  if (k.salt.length % 2 !== 0 || saltBytes < 16 || saltBytes > 64) {
    throw new VaultError(
      "INVALID_KDF_PARAMS",
      "KDF salt must be between 16 and 64 bytes.",
    );
  }
}

/** Fresh KDF parameters with a brand-new random salt. */
export function freshKdfParams(): VaultKdfParams {
  return {
    algorithm: KDF_ALGORITHM,
    version: ARGON2_VERSION,
    memoryKiB: DEFAULT_KDF_PARAMS.memoryKiB,
    iterations: DEFAULT_KDF_PARAMS.iterations,
    parallelism: DEFAULT_KDF_PARAMS.parallelism,
    salt: bytesToHex(randomBytes(SALT_BYTES)),
  };
}

/**
 * Derives the 256-bit AES key from the vault password with Argon2id.
 *
 * The password string itself is never retained here. It cannot be wiped —
 * JavaScript strings are immutable — which is why it is passed in, used once,
 * and the caller is expected to drop its reference immediately.
 */
export async function deriveVaultKey(
  password: string,
  kdf: VaultKdfParams,
): Promise<Uint8Array> {
  assertValidKdfParams(kdf);

  return argon2id({
    password,
    salt: hexToBytes(kdf.salt),
    iterations: kdf.iterations,
    parallelism: kdf.parallelism,
    memorySize: kdf.memoryKiB,
    hashLength: DERIVED_KEY_BYTES,
    outputType: "binary",
  });
}

/**
 * Password policy feedback for the setup UI.
 *
 * Deliberately simple and local: no dictionary is shipped, and the password is
 * never sent anywhere to be scored.
 */
export function assessPassword(password: string): PasswordStrength {
  const suggestions: string[] = [];
  const length = password.length;

  if (length < MIN_PASSWORD_LENGTH) {
    return {
      score: 0,
      label: "Too short",
      acceptable: false,
      suggestions: [
        `Use at least ${MIN_PASSWORD_LENGTH} characters — ${RECOMMENDED_PASSWORD_LENGTH}+ or a multi-word passphrase is better.`,
      ],
    };
  }

  let score = 1;
  const words = password.trim().split(/\s+/).filter(Boolean).length;

  if (length >= RECOMMENDED_PASSWORD_LENGTH) score += 1;
  if (length >= 24 || words >= 4) score += 1;

  const classes = [
    /[a-z]/.test(password),
    /[A-Z]/.test(password),
    /[0-9]/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ].filter(Boolean).length;

  if (classes >= 3 || words >= 4) score += 1;

  if (length < RECOMMENDED_PASSWORD_LENGTH) {
    suggestions.push(
      `${RECOMMENDED_PASSWORD_LENGTH}+ characters is meaningfully stronger.`,
    );
  }
  if (words < 4 && classes < 3) {
    suggestions.push(
      "Mix character types, or use four or more unrelated words.",
    );
  }
  if (/^(.)\1+$/.test(password)) {
    suggestions.push("Avoid a single repeated character.");
    score = 1;
  }

  const clamped = Math.min(4, Math.max(1, score)) as 1 | 2 | 3 | 4;
  const label = (
    { 1: "Weak", 2: "Fair", 3: "Good", 4: "Strong" } as const
  )[clamped];

  return { score: clamped, label, acceptable: true, suggestions };
}

/** Throws unless the password clears the minimum policy. */
export function assertAcceptablePassword(password: string): void {
  const { acceptable } = assessPassword(password);
  if (!acceptable) {
    throw new VaultError(
      "WEAK_PASSWORD",
      `Vault password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
    );
  }
}
