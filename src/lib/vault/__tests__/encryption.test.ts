import { describe, expect, it } from "vitest";
import {
  BACKUP_FORMAT,
  BACKUP_VERSION,
  DEFAULT_KDF_PARAMS,
  VaultError,
  assertValidEnvelope,
  assessPassword,
  decryptEnvelope,
  encryptPayload,
  parseEnvelope,
  serializeEnvelope,
} from "..";
import { makePayload, PASSWORD, WRONG_PASSWORD } from "./fixtures";

describe("Vault encryption — Argon2id + AES-256-GCM", () => {
  it("encrypts an identity under a password", async () => {
    const envelope = await encryptPayload(makePayload(), PASSWORD);

    expect(envelope.format).toBe(BACKUP_FORMAT);
    expect(envelope.version).toBe(BACKUP_VERSION);
    expect(envelope.kdf.algorithm).toBe("argon2id");
    expect(envelope.kdf.memoryKiB).toBe(DEFAULT_KDF_PARAMS.memoryKiB);
    expect(envelope.kdf.iterations).toBe(DEFAULT_KDF_PARAMS.iterations);
    expect(envelope.kdf.parallelism).toBe(DEFAULT_KDF_PARAMS.parallelism);
    expect(envelope.cipher.algorithm).toBe("AES-256-GCM");
    expect(envelope.cipher.tagLength).toBe(128);
    expect(envelope.cipher.nonce).toHaveLength(24); // 12 bytes
    expect(envelope.kdf.salt).toHaveLength(32); // 16 bytes
    expect(() => assertValidEnvelope(envelope)).not.toThrow();
  });

  it("the envelope leaks no plaintext key material", async () => {
    const payload = makePayload();
    const envelope = await encryptPayload(payload, PASSWORD);
    const serialized = serializeEnvelope(envelope);

    for (const secret of [
      payload.spendingPrivateKey,
      payload.viewingPrivateKey,
      payload.spendingPrivateKey.slice(2),
      payload.viewingPrivateKey.slice(2),
    ]) {
      expect(serialized.toLowerCase()).not.toContain(secret.toLowerCase());
    }
    // Public identity is encrypted too, so it must not appear either.
    expect(serialized).not.toContain(payload.stealthMetaAddress);
    expect(serialized).not.toContain(PASSWORD);
  });

  it("decrypts with the correct password", async () => {
    const payload = makePayload();
    const envelope = await encryptPayload(payload, PASSWORD);
    const restored = await decryptEnvelope(envelope, PASSWORD);

    expect(restored.spendingPrivateKey).toBe(payload.spendingPrivateKey);
    expect(restored.viewingPrivateKey).toBe(payload.viewingPrivateKey);
    expect(restored.stealthMetaAddress).toBe(payload.stealthMetaAddress);
    expect(restored.schemeId).toBe(payload.schemeId);
    expect(restored.chainId).toBe(payload.chainId);
    expect(restored.chainFamily).toBe(payload.chainFamily);
  });

  it("rejects a wrong password with a generic message", async () => {
    const envelope = await encryptPayload(makePayload(), PASSWORD);

    await expect(decryptEnvelope(envelope, WRONG_PASSWORD)).rejects.toThrow(
      /may be incorrect or the backup may be corrupted/i,
    );
    await expect(
      decryptEnvelope(envelope, WRONG_PASSWORD),
    ).rejects.toMatchObject({ code: "DECRYPTION_FAILED" });
  });

  it("fails authentication when the ciphertext is modified", async () => {
    const envelope = await encryptPayload(makePayload(), PASSWORD);
    const flipped = envelope.ciphertext.slice(0, -2) +
      (envelope.ciphertext.slice(-2) === "00" ? "01" : "00");

    await expect(
      decryptEnvelope({ ...envelope, ciphertext: flipped }, PASSWORD),
    ).rejects.toMatchObject({ code: "DECRYPTION_FAILED" });
  });

  it("fails when the nonce is modified", async () => {
    const envelope = await encryptPayload(makePayload(), PASSWORD);
    const nonce = envelope.cipher.nonce;
    const tampered = (nonce[0] === "a" ? "b" : "a") + nonce.slice(1);

    await expect(
      decryptEnvelope(
        { ...envelope, cipher: { ...envelope.cipher, nonce: tampered } },
        PASSWORD,
      ),
    ).rejects.toMatchObject({ code: "DECRYPTION_FAILED" });
  });

  it("fails when the salt is swapped", async () => {
    const envelope = await encryptPayload(makePayload(), PASSWORD);
    const salt = envelope.kdf.salt;
    const tampered = (salt[0] === "a" ? "b" : "a") + salt.slice(1);

    await expect(
      decryptEnvelope(
        { ...envelope, kdf: { ...envelope.kdf, salt: tampered } },
        PASSWORD,
      ),
    ).rejects.toMatchObject({ code: "DECRYPTION_FAILED" });
  });

  it("AAD binds the KDF parameters, so downgrading them fails", async () => {
    const envelope = await encryptPayload(makePayload(), PASSWORD);

    // An attacker lowering the work factor to make brute force cheaper must
    // not get a readable file back.
    await expect(
      decryptEnvelope(
        { ...envelope, kdf: { ...envelope.kdf, iterations: 1 } },
        PASSWORD,
      ),
    ).rejects.toMatchObject({ code: "DECRYPTION_FAILED" });

    await expect(
      decryptEnvelope(
        { ...envelope, kdf: { ...envelope.kdf, memoryKiB: 8192 } },
        PASSWORD,
      ),
    ).rejects.toMatchObject({ code: "DECRYPTION_FAILED" });
  });

  it("rejects unsupported format, version and cipher", async () => {
    const envelope = await encryptPayload(makePayload(), PASSWORD);

    expect(() =>
      assertValidEnvelope({ ...envelope, format: "SOMETHING_ELSE" }),
    ).toThrow(VaultError);
    expect(() => assertValidEnvelope({ ...envelope, version: 99 })).toThrow(
      /Unsupported backup version/i,
    );
    expect(() =>
      assertValidEnvelope({
        ...envelope,
        cipher: { ...envelope.cipher, algorithm: "AES-128-CBC" },
      }),
    ).toThrow(/Unsupported cipher/i);
    expect(() =>
      assertValidEnvelope({
        ...envelope,
        kdf: { ...envelope.kdf, algorithm: "pbkdf2" },
      }),
    ).toThrow(/Unsupported key-derivation/i);
  });

  it("rejects malicious KDF parameters before running the KDF", async () => {
    const envelope = await encryptPayload(makePayload(), PASSWORD);

    // 8 GiB of memory would hang or crash the tab.
    expect(() =>
      assertValidEnvelope({
        ...envelope,
        kdf: { ...envelope.kdf, memoryKiB: 8_388_608 },
      }),
    ).toThrow(/outside the permitted range/i);

    expect(() =>
      assertValidEnvelope({
        ...envelope,
        kdf: { ...envelope.kdf, iterations: 1_000_000 },
      }),
    ).toThrow(/outside the permitted range/i);

    expect(() =>
      assertValidEnvelope({
        ...envelope,
        kdf: { ...envelope.kdf, parallelism: 9999 },
      }),
    ).toThrow(/outside the permitted range/i);

    // And the guard holds through the real decrypt entry point.
    await expect(
      decryptEnvelope(
        { ...envelope, kdf: { ...envelope.kdf, memoryKiB: 8_388_608 } },
        PASSWORD,
      ),
    ).rejects.toThrow(VaultError);
  });

  it("uses a fresh salt and nonce on every encryption", async () => {
    const payload = makePayload();
    const a = await encryptPayload(payload, PASSWORD);
    const b = await encryptPayload(payload, PASSWORD);

    expect(a.kdf.salt).not.toBe(b.kdf.salt);
    expect(a.cipher.nonce).not.toBe(b.cipher.nonce);
    // Same plaintext and password must still produce different ciphertext.
    expect(a.ciphertext).not.toBe(b.ciphertext);
  });

  it("round-trips through file serialization", async () => {
    const payload = makePayload();
    const envelope = await encryptPayload(payload, PASSWORD);
    const text = serializeEnvelope(envelope);

    const reparsed = parseEnvelope(text);
    const restored = await decryptEnvelope(reparsed, PASSWORD);
    expect(restored.spendingPrivateKey).toBe(payload.spendingPrivateKey);
  });

  it("rejects non-JSON and structurally invalid files", () => {
    expect(() => parseEnvelope("not json")).toThrow(/not valid JSON/i);
    expect(() => parseEnvelope("{}")).toThrow(VaultError);
    expect(() => parseEnvelope('{"format":"STEALTHPAY_ENCRYPTED_BACKUP"}')).toThrow(
      VaultError,
    );
  });

  it("enforces a minimum password policy", () => {
    expect(assessPassword("short").acceptable).toBe(false);
    expect(assessPassword("aaaaaaaaaaaaaaaa").acceptable).toBe(true);
    expect(assessPassword("correct horse battery staple").score).toBe(4);
    expect(assessPassword("short").label).toBe("Too short");
  });
});
