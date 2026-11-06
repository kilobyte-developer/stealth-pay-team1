import { openDB, type IDBPDatabase } from "idb";
import { VaultError } from "./errors";
import { assertValidEnvelope } from "./backup-format";
import type {
  RecoveryStatus,
  VaultEnvelopeV1,
  VaultRecord,
  VaultStatus,
} from "./types";

const DB_NAME = "stealthpay-vault";
const DB_VERSION = 1;
const STORE = "vault";
const RECORD_ID = "identity";

/**
 * IndexedDB persistence for the encrypted vault.
 *
 * ## What is stored
 * Only the encrypted envelope plus non-sensitive bookkeeping (when it was
 * saved, when a backup was last exported, whether the user confirmed storing
 * one). The envelope's `ciphertext` is the only place key material exists, and
 * it is useless without the password.
 *
 * Deliberately NOT stored: any plaintext key, the password, the Argon2-derived
 * AES key, or the stealth meta-address. The meta-address is public information
 * but would reveal *which* identity this browser profile holds, so it is kept
 * out of plaintext storage too.
 *
 * ## What this does not protect against
 * IndexedDB is same-origin storage, not a secure enclave. If the page is
 * compromised by XSS while the vault is UNLOCKED, the attacker can read the
 * in-memory identity regardless of how the data is stored at rest. Encryption
 * at rest protects a stolen disk or browser profile — it does not make the app
 * XSS-proof.
 */

type VaultDb = IDBPDatabase<unknown>;

let dbPromise: Promise<VaultDb> | null = null;

function getDb(): Promise<VaultDb> {
  if (typeof indexedDB === "undefined") {
    throw new VaultError(
      "STORAGE_UNAVAILABLE",
      "IndexedDB is unavailable in this environment.",
    );
  }
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: "id" });
        }
      },
    });
  }
  return dbPromise;
}

/** Test hook: drops the cached connection so a fresh DB can be opened. */
export function resetVaultDbConnection(): void {
  dbPromise = null;
}

async function readRecord(): Promise<VaultRecord | null> {
  const db = await getDb();
  const raw = (await db.get(STORE, RECORD_ID)) as VaultRecord | undefined;
  if (!raw) return null;

  // A corrupt or hand-edited record must not be trusted.
  try {
    assertValidEnvelope(raw.envelope);
  } catch {
    throw new VaultError(
      "INVALID_ENVELOPE",
      "The stored vault record is corrupt. Restore from a backup file.",
    );
  }
  return raw;
}

export async function hasVault(): Promise<boolean> {
  const db = await getDb();
  const raw = await db.get(STORE, RECORD_ID);
  return raw !== undefined;
}

export async function loadEnvelope(): Promise<VaultEnvelopeV1> {
  const record = await readRecord();
  if (!record) {
    throw new VaultError("VAULT_NOT_FOUND", "No encrypted vault on this device.");
  }
  return record.envelope;
}

/**
 * Writes the encrypted envelope.
 *
 * Refuses to replace an existing vault unless `allowOverwrite` is set, so an
 * import cannot silently destroy an identity the user still needs. The caller
 * is responsible for obtaining explicit confirmation first.
 */
export async function saveEnvelope(
  envelope: VaultEnvelopeV1,
  options: {
    allowOverwrite?: boolean;
    lastExportedAt?: string | null;
    backupConfirmed?: boolean;
  } = {},
): Promise<VaultRecord> {
  assertValidEnvelope(envelope);
  const db = await getDb();

  const existing = (await db.get(STORE, RECORD_ID)) as VaultRecord | undefined;
  if (existing && !options.allowOverwrite) {
    throw new VaultError(
      "VAULT_ALREADY_EXISTS",
      "A vault already exists on this device. Confirm before replacing it.",
    );
  }

  const record: VaultRecord = {
    id: RECORD_ID,
    envelope,
    savedAt: new Date().toISOString(),
    lastExportedAt:
      options.lastExportedAt !== undefined
        ? options.lastExportedAt
        : (existing?.lastExportedAt ?? null),
    backupConfirmed:
      options.backupConfirmed !== undefined
        ? options.backupConfirmed
        : (existing?.backupConfirmed ?? false),
  };

  // `put` within a single transaction — a password change replaces the
  // envelope atomically rather than deleting then re-adding.
  await db.put(STORE, record);
  return record;
}

export async function markExported(at = new Date().toISOString()): Promise<void> {
  const record = await readRecord();
  if (!record) {
    throw new VaultError("VAULT_NOT_FOUND", "No encrypted vault on this device.");
  }
  const db = await getDb();
  await db.put(STORE, { ...record, lastExportedAt: at });
}

export async function markBackupConfirmed(): Promise<void> {
  const record = await readRecord();
  if (!record) {
    throw new VaultError("VAULT_NOT_FOUND", "No encrypted vault on this device.");
  }
  const db = await getDb();
  await db.put(STORE, { ...record, backupConfirmed: true });
}

/** Removes the vault record. Irreversible without a backup file. */
export async function deleteVault(): Promise<void> {
  const db = await getDb();
  await db.delete(STORE, RECORD_ID);
}

/**
 * Status summary for the UI.
 *
 * `unlocked` is supplied by the caller because this module has no knowledge of
 * in-memory session state — it only sees ciphertext at rest.
 */
export async function getVaultStatus(unlocked: boolean): Promise<VaultStatus> {
  const db = await getDb();
  const raw = (await db.get(STORE, RECORD_ID)) as VaultRecord | undefined;

  if (!raw) {
    return {
      exists: false,
      recoveryStatus: "not_configured",
      savedAt: null,
      lastExportedAt: null,
      backupConfirmed: false,
    };
  }

  let recoveryStatus: RecoveryStatus;
  if (!unlocked) {
    recoveryStatus = "locked";
  } else if (raw.backupConfirmed) {
    recoveryStatus = "recovery_verified";
  } else if (raw.lastExportedAt) {
    recoveryStatus = "backup_exported";
  } else {
    recoveryStatus = "vault_encrypted";
  }

  return {
    exists: true,
    recoveryStatus,
    savedAt: raw.savedAt,
    lastExportedAt: raw.lastExportedAt,
    backupConfirmed: raw.backupConfirmed,
  };
}

/** Test/diagnostic helper: the raw stored row, exactly as persisted. */
export async function debugReadRawRecord(): Promise<unknown> {
  const db = await getDb();
  return db.get(STORE, RECORD_ID);
}
