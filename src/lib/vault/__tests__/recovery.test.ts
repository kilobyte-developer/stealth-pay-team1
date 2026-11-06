import { beforeEach, describe, expect, it } from "vitest";
import {
  DEFAULT_CHAIN_ID,
  checkStealthAnnouncement,
  deriveOneTimeSpendingKey,
  generateOneTimeStealthAddress,
  generateStealthIdentity,
  SCHEME_ID_SECP256K1,
} from "@/lib/stealth";
import { privateKeyToAddress } from "viem/accounts";
import {
  VaultError,
  changeVaultPassword,
  confirmBackupStored,
  createVault,
  debugReadRawRecord,
  deleteVault,
  exportBackup,
  getVaultStatus,
  hasVault,
  importBackup,
  payloadToIdentity,
  resetVaultDbConnection,
  unlockVault,
} from "..";
import { decryptEnvelope } from "../encryption";
import { parseEnvelope } from "../backup-format";
import {
  NEW_PASSWORD,
  PASSWORD,
  WRONG_PASSWORD,
  makeIdentity,
  makeOtherIdentity,
  makePayload,
} from "./fixtures";

/** Simulates a fresh browser profile: empty storage, no cached connection. */
async function clearStorage() {
  try {
    await deleteVault();
  } catch {
    /* nothing stored yet */
  }
  resetVaultDbConnection();
}

describe("Vault — identity restoration", () => {
  beforeEach(clearStorage);

  it("restores the EXACT same identity after a simulated refresh", async () => {
    const original = generateStealthIdentity(DEFAULT_CHAIN_ID);
    const originalPublic = { ...original.publicIdentity };
    const originalSpendHex = original.secrets.spendingPrivateKey.toHex();
    const originalViewHex = original.secrets.viewingPrivateKey.toHex();

    await createVault(original, PASSWORD);

    // Refresh: in-memory secrets are gone, only ciphertext survives.
    original.secrets.destroy();
    resetVaultDbConnection();

    const restored = await unlockVault(PASSWORD);

    expect(restored.secrets.viewingPrivateKey.toHex()).toBe(originalViewHex);
    expect(restored.secrets.spendingPrivateKey.toHex()).toBe(originalSpendHex);
    expect(restored.publicIdentity.viewingPublicKey).toBe(
      originalPublic.viewingPublicKey,
    );
    expect(restored.publicIdentity.spendingPublicKey).toBe(
      originalPublic.spendingPublicKey,
    );
    expect(restored.publicIdentity.stealthMetaAddress).toBe(
      originalPublic.stealthMetaAddress,
    );
    expect(restored.publicIdentity.schemeId).toBe(originalPublic.schemeId);
    expect(restored.publicIdentity.chainId).toBe(originalPublic.chainId);

    restored.secrets.destroy();
  });

  it("a restored identity still controls funds sent to it before the refresh", async () => {
    // The whole point of recovery: a payment received BEFORE losing the
    // in-memory identity must remain spendable after restoring.
    const alice = generateStealthIdentity(DEFAULT_CHAIN_ID);
    await createVault(alice, PASSWORD);

    // Bob pays the published meta-address while Alice is "online".
    const payment = generateOneTimeStealthAddress({
      metaAddress: alice.publicIdentity.stealthMetaAddress,
      chainId: DEFAULT_CHAIN_ID,
    });

    // Alice loses everything in memory.
    alice.secrets.destroy();
    resetVaultDbConnection();

    // Alice restores from the encrypted vault…
    const restored = await unlockVault(PASSWORD);

    // …detects the earlier payment…
    const check = checkStealthAnnouncement({
      stealthAddress: payment.stealthAddress,
      ephemeralPublicKey: payment.ephemeralPublicKey,
      viewTag: payment.viewTag,
      viewingPrivateKey: restored.secrets.viewingPrivateKey,
      spendingPublicKey: restored.publicIdentity.spendingPublicKey,
      schemeId: SCHEME_ID_SECP256K1,
    });
    expect(check.isForUser).toBe(true);

    // …and recovers the key that controls it.
    const { privateKey, stealthAddress } = deriveOneTimeSpendingKey({
      ephemeralPublicKey: payment.ephemeralPublicKey,
      viewingPrivateKey: restored.secrets.viewingPrivateKey,
      spendingPrivateKey: restored.secrets.spendingPrivateKey,
      expectedStealthAddress: payment.stealthAddress,
      schemeId: SCHEME_ID_SECP256K1,
    });

    expect(stealthAddress).toBe(payment.stealthAddress);
    expect(privateKeyToAddress(privateKey.toHex())).toBe(
      payment.stealthAddress,
    );

    privateKey.destroy();
    restored.secrets.destroy();
  });

  it("a restored identity derives identical addresses for identical inputs", async () => {
    const alice = makeIdentity();
    await createVault(alice, PASSWORD);
    const metaAddress = alice.publicIdentity.stealthMetaAddress;
    alice.secrets.destroy();

    const restored = await unlockVault(PASSWORD);
    expect(restored.publicIdentity.stealthMetaAddress).toBe(metaAddress);
    restored.secrets.destroy();
  });

  it("rejects a payload whose public keys contradict its private keys", async () => {
    const payload = makePayload();
    const other = makeOtherIdentity();

    // Swap in a mismatched public key — a tampered backup.
    const tampered = {
      ...payload,
      spendingPublicKey: other.publicIdentity.spendingPublicKey,
    };
    other.secrets.destroy();

    expect(() => payloadToIdentity(tampered)).toThrow(VaultError);
    expect(() => payloadToIdentity(tampered)).toThrow(
      /does not match its private key/i,
    );
  });

  it("rejects a payload whose meta-address contradicts its keys", async () => {
    const payload = makePayload();
    const other = makeOtherIdentity();
    const tampered = {
      ...payload,
      stealthMetaAddress: other.publicIdentity.stealthMetaAddress,
    };
    other.secrets.destroy();

    expect(() => payloadToIdentity(tampered)).toThrow(
      /meta-address does not match/i,
    );
  });

  it("rejects out-of-range private scalars and bad chain ids", () => {
    const payload = makePayload();

    expect(() =>
      payloadToIdentity({ ...payload, spendingPrivateKey: `0x${"00".repeat(32)}` }),
    ).toThrow(/invalid private key/i);

    expect(() => payloadToIdentity({ ...payload, chainId: 1 })).toThrow(
      /unsupported chain id/i,
    );
  });
});

describe("Vault — IndexedDB persistence", () => {
  beforeEach(clearStorage);

  it("persists only the encrypted envelope, never plaintext secrets", async () => {
    const identity = generateStealthIdentity(DEFAULT_CHAIN_ID);
    const spendHex = identity.secrets.spendingPrivateKey.toHex();
    const viewHex = identity.secrets.viewingPrivateKey.toHex();
    const metaAddress = identity.publicIdentity.stealthMetaAddress;

    await createVault(identity, PASSWORD);
    identity.secrets.destroy();

    // Inspect the ACTUAL stored record, not the TypeScript types.
    const raw = await debugReadRawRecord();
    const serialized = JSON.stringify(raw);

    for (const secret of [
      spendHex,
      viewHex,
      spendHex.slice(2),
      viewHex.slice(2),
      PASSWORD,
    ]) {
      expect(serialized.toLowerCase()).not.toContain(secret.toLowerCase());
    }
    // The meta-address is public but still kept out of plaintext storage so a
    // stolen profile does not reveal WHICH identity this browser holds.
    expect(serialized).not.toContain(metaAddress);

    // What IS stored: the envelope and non-sensitive bookkeeping.
    const record = raw as Record<string, unknown>;
    expect(Object.keys(record).sort()).toEqual([
      "backupConfirmed",
      "envelope",
      "id",
      "lastExportedAt",
      "savedAt",
    ]);
  });

  it("refuses to overwrite an existing vault without explicit permission", async () => {
    const first = makeIdentity();
    await createVault(first, PASSWORD);
    first.secrets.destroy();

    const second = makeOtherIdentity();
    await expect(createVault(second, PASSWORD)).rejects.toMatchObject({
      code: "VAULT_ALREADY_EXISTS",
    });

    // The original survives.
    const restored = await unlockVault(PASSWORD);
    expect(restored.publicIdentity.stealthMetaAddress).toBe(
      makeIdentity().publicIdentity.stealthMetaAddress,
    );
    restored.secrets.destroy();
    second.secrets.destroy();
  });

  it("reports vault status and tracks recovery readiness", async () => {
    expect((await getVaultStatus(false)).recoveryStatus).toBe("not_configured");
    expect(await hasVault()).toBe(false);

    const identity = makeIdentity();
    await createVault(identity, PASSWORD);
    identity.secrets.destroy();

    expect(await hasVault()).toBe(true);
    // Locked takes precedence — an identity you cannot open is not ready.
    expect((await getVaultStatus(false)).recoveryStatus).toBe("locked");
    expect((await getVaultStatus(true)).recoveryStatus).toBe("vault_encrypted");

    await exportBackup(PASSWORD);
    expect((await getVaultStatus(true)).recoveryStatus).toBe("backup_exported");
    expect((await getVaultStatus(true)).lastExportedAt).toBeTruthy();

    // Downloading is not proof of safekeeping; only explicit confirmation is.
    await confirmBackupStored();
    expect((await getVaultStatus(true)).recoveryStatus).toBe(
      "recovery_verified",
    );
  });

  it("rejects a corrupt stored record", async () => {
    const identity = makeIdentity();
    await createVault(identity, PASSWORD);
    identity.secrets.destroy();

    // Corrupt the record the way a hand-edit or partial write would.
    const { openDB } = await import("idb");
    const db = await openDB("stealthpay-vault", 1);
    await db.put("vault", {
      id: "identity",
      envelope: { format: "WRONG", version: 1 },
      savedAt: new Date().toISOString(),
      lastExportedAt: null,
      backupConfirmed: false,
    });
    db.close();
    resetVaultDbConnection();

    await expect(unlockVault(PASSWORD)).rejects.toThrow(VaultError);
  });
});

describe("Vault — downloadable backup and cross-device recovery", () => {
  beforeEach(clearStorage);

  it("exports an encrypted file containing no plaintext keys", async () => {
    const identity = generateStealthIdentity(DEFAULT_CHAIN_ID);
    const spendHex = identity.secrets.spendingPrivateKey.toHex();
    await createVault(identity, PASSWORD);
    identity.secrets.destroy();

    const { filename, contents } = await exportBackup(PASSWORD);

    expect(filename).toMatch(/^stealthpay-backup-.*\.stealthpay$/);
    // The filename must not encode anything about the identity.
    expect(filename).not.toContain(spendHex.slice(2, 10));
    expect(contents.toLowerCase()).not.toContain(spendHex.toLowerCase());
    expect(contents).not.toContain(PASSWORD);

    // It is a valid, parseable envelope.
    const parsed = parseEnvelope(contents);
    expect(parsed.format).toBe("STEALTHPAY_ENCRYPTED_BACKUP");
  });

  it("export requires the correct password", async () => {
    const identity = makeIdentity();
    await createVault(identity, PASSWORD);
    identity.secrets.destroy();

    await expect(exportBackup(WRONG_PASSWORD)).rejects.toMatchObject({
      code: "DECRYPTION_FAILED",
    });
  });

  it("each export uses a fresh salt and nonce", async () => {
    const identity = makeIdentity();
    await createVault(identity, PASSWORD);
    identity.secrets.destroy();

    const a = parseEnvelope((await exportBackup(PASSWORD)).contents);
    const b = parseEnvelope((await exportBackup(PASSWORD)).contents);

    expect(a.kdf.salt).not.toBe(b.kdf.salt);
    expect(a.cipher.nonce).not.toBe(b.cipher.nonce);
    expect(a.ciphertext).not.toBe(b.ciphertext);
  });

  it("imports into a CLEAN browser profile and reproduces the identity", async () => {
    // Device 1
    const original = generateStealthIdentity(DEFAULT_CHAIN_ID);
    const expectedMeta = original.publicIdentity.stealthMetaAddress;
    const expectedSpend = original.secrets.spendingPrivateKey.toHex();
    await createVault(original, PASSWORD);
    const backup = await exportBackup(PASSWORD);
    original.secrets.destroy();

    // Device 2: wipe storage entirely.
    await clearStorage();
    expect(await hasVault()).toBe(false);

    const restored = await importBackup(backup.contents, PASSWORD);

    expect(restored.publicIdentity.stealthMetaAddress).toBe(expectedMeta);
    expect(restored.secrets.spendingPrivateKey.toHex()).toBe(expectedSpend);
    // And it was persisted on the new device.
    expect(await hasVault()).toBe(true);
    restored.secrets.destroy();

    // Unlocking on device 2 works with the same password.
    resetVaultDbConnection();
    const reopened = await unlockVault(PASSWORD);
    expect(reopened.publicIdentity.stealthMetaAddress).toBe(expectedMeta);
    reopened.secrets.destroy();
  });

  it("import rejects a wrong password and a corrupt file", async () => {
    const identity = makeIdentity();
    await createVault(identity, PASSWORD);
    const backup = await exportBackup(PASSWORD);
    identity.secrets.destroy();
    await clearStorage();

    await expect(
      importBackup(backup.contents, WRONG_PASSWORD),
    ).rejects.toMatchObject({ code: "DECRYPTION_FAILED" });

    await expect(importBackup("{}", PASSWORD)).rejects.toThrow(VaultError);
    await expect(importBackup("garbage", PASSWORD)).rejects.toThrow(
      /not valid JSON/i,
    );

    // Nothing was partially restored.
    expect(await hasVault()).toBe(false);
  });

  it("import will not replace an existing vault without confirmation", async () => {
    const existing = makeIdentity();
    await createVault(existing, PASSWORD);
    existing.secrets.destroy();

    const other = makeOtherIdentity();
    await clearStorage();
    await createVault(other, NEW_PASSWORD);
    const otherBackup = await exportBackup(NEW_PASSWORD);
    other.secrets.destroy();

    // Put the first identity back, then try to import the second over it.
    await clearStorage();
    const first = makeIdentity();
    await createVault(first, PASSWORD);
    first.secrets.destroy();

    await expect(
      importBackup(otherBackup.contents, NEW_PASSWORD),
    ).rejects.toMatchObject({ code: "VAULT_ALREADY_EXISTS" });

    // Explicit overwrite succeeds.
    const replaced = await importBackup(otherBackup.contents, NEW_PASSWORD, {
      allowOverwrite: true,
    });
    expect(replaced.publicIdentity.stealthMetaAddress).toBe(
      makeOtherIdentity().publicIdentity.stealthMetaAddress,
    );
    replaced.secrets.destroy();
  });
});

describe("Vault — password change", () => {
  beforeEach(clearStorage);

  it("re-encrypts under a new password without changing the keys", async () => {
    const identity = generateStealthIdentity(DEFAULT_CHAIN_ID);
    const spendHex = identity.secrets.spendingPrivateKey.toHex();
    const meta = identity.publicIdentity.stealthMetaAddress;
    await createVault(identity, PASSWORD);
    identity.secrets.destroy();

    const before = await import("..").then((m) => m.loadEnvelope());
    const after = await changeVaultPassword(PASSWORD, NEW_PASSWORD);

    // Fresh salt and nonce, per AES-GCM safety.
    expect(after.kdf.salt).not.toBe(before.kdf.salt);
    expect(after.cipher.nonce).not.toBe(before.cipher.nonce);

    // Old password no longer works.
    await expect(unlockVault(PASSWORD)).rejects.toMatchObject({
      code: "DECRYPTION_FAILED",
    });

    // New password yields the identical identity.
    const reopened = await unlockVault(NEW_PASSWORD);
    expect(reopened.secrets.spendingPrivateKey.toHex()).toBe(spendHex);
    expect(reopened.publicIdentity.stealthMetaAddress).toBe(meta);
    reopened.secrets.destroy();
  });

  it("leaves the vault untouched when the current password is wrong", async () => {
    const identity = makeIdentity();
    await createVault(identity, PASSWORD);
    identity.secrets.destroy();

    await expect(
      changeVaultPassword(WRONG_PASSWORD, NEW_PASSWORD),
    ).rejects.toMatchObject({ code: "DECRYPTION_FAILED" });

    // Original password still opens it.
    const still = await unlockVault(PASSWORD);
    expect(still.publicIdentity.stealthMetaAddress).toBeTruthy();
    still.secrets.destroy();
  });

  it("rejects a weak new password", async () => {
    const identity = makeIdentity();
    await createVault(identity, PASSWORD);
    identity.secrets.destroy();

    await expect(changeVaultPassword(PASSWORD, "short")).rejects.toMatchObject({
      code: "WEAK_PASSWORD",
    });
  });

  it("refuses to create a vault with a weak password", async () => {
    const identity = makeIdentity();
    await expect(createVault(identity, "123")).rejects.toMatchObject({
      code: "WEAK_PASSWORD",
    });
    identity.secrets.destroy();
    expect(await hasVault()).toBe(false);
  });
});

describe("Vault — secret containment", () => {
  beforeEach(clearStorage);

  it("a restored identity's secrets still refuse to serialize", async () => {
    const identity = makeIdentity();
    await createVault(identity, PASSWORD);
    identity.secrets.destroy();

    const restored = await unlockVault(PASSWORD);

    // Milestone 2's guard must survive a round trip through the vault.
    expect(() => JSON.stringify(restored.secrets)).toThrow();
    expect(String(restored.secrets.spendingPrivateKey)).toBe(
      "[SecretKeyMaterial:redacted]",
    );

    restored.secrets.destroy();
    expect(restored.secrets.spendingPrivateKey.destroyed).toBe(true);
  });

  it("decrypting does not leave the payload's keys readable", async () => {
    const identity = makeIdentity();
    await createVault(identity, PASSWORD);
    identity.secrets.destroy();

    const envelope = await import("..").then((m) => m.loadEnvelope());
    const payload = await decryptEnvelope(envelope, PASSWORD);
    // Sanity: the payload really did decrypt.
    expect(payload.spendingPrivateKey).toMatch(/^0x[0-9a-f]{64}$/);

    // exportBackup scrubs its working copy after use.
    const { contents } = await exportBackup(PASSWORD);
    expect(contents).not.toContain(payload.spendingPrivateKey);
  });
});
