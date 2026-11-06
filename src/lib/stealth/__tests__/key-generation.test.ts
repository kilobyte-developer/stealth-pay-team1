import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { getPublicKey } from "@noble/secp256k1";
import { bytesToHex } from "viem";
import {
  DEFAULT_CHAIN_ID,
  LENGTHS,
  SCHEME_ID_SECP256K1,
} from "../constants";
import { StealthError } from "../errors";
import {
  generateStealthIdentity,
  importPrivateScalar,
} from "../key-generation";
import { SecretKeyMaterial } from "../secure-memory";
import { CURVE_ORDER, bytesToBigInt } from "../validation";
import { scalarOf } from "./fixtures";

describe("Group A — key generation", () => {
  it("generates a valid viewing private key", () => {
    const { secrets } = generateStealthIdentity(DEFAULT_CHAIN_ID);
    const bytes = secrets.viewingPrivateKey.bytes();

    expect(bytes.length).toBe(LENGTHS.privateKeyBytes);
    const scalar = bytesToBigInt(bytes);
    expect(scalar).toBeGreaterThan(0n);
    expect(scalar).toBeLessThan(CURVE_ORDER);
    secrets.destroy();
  });

  it("generates a valid spending private key", () => {
    const { secrets } = generateStealthIdentity(DEFAULT_CHAIN_ID);
    const bytes = secrets.spendingPrivateKey.bytes();

    expect(bytes.length).toBe(LENGTHS.privateKeyBytes);
    const scalar = bytesToBigInt(bytes);
    expect(scalar).toBeGreaterThan(0n);
    expect(scalar).toBeLessThan(CURVE_ORDER);
    secrets.destroy();
  });

  it("derives public keys that correspond to the private keys", () => {
    const { publicIdentity, secrets } = generateStealthIdentity(DEFAULT_CHAIN_ID);

    expect(publicIdentity.spendingPublicKey).toBe(
      bytesToHex(getPublicKey(secrets.spendingPrivateKey.bytes(), true)),
    );
    expect(publicIdentity.viewingPublicKey).toBe(
      bytesToHex(getPublicKey(secrets.viewingPrivateKey.bytes(), true)),
    );
    expect(publicIdentity.schemeId).toBe(SCHEME_ID_SECP256K1);
    expect(publicIdentity.chainId).toBe(DEFAULT_CHAIN_ID);
    secrets.destroy();
  });

  it("produces two independent key pairs", () => {
    const { publicIdentity, secrets } = generateStealthIdentity(DEFAULT_CHAIN_ID);

    expect(publicIdentity.spendingPublicKey).not.toBe(
      publicIdentity.viewingPublicKey,
    );
    expect(secrets.spendingPrivateKey.toHex()).not.toBe(
      secrets.viewingPrivateKey.toHex(),
    );
    secrets.destroy();
  });

  it("produces different keys on every call", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 8; i++) {
      const { publicIdentity, secrets } = generateStealthIdentity(DEFAULT_CHAIN_ID);
      seen.add(publicIdentity.stealthMetaAddressRaw);
      secrets.destroy();
    }
    expect(seen.size).toBe(8);
  });

  it("rejects zero and out-of-range scalars", () => {
    expect(() => importPrivateScalar(scalarOf(0))).toThrow(StealthError);

    // Exactly the curve order — invalid, must be strictly below n.
    const order = new Uint8Array(32);
    let n = CURVE_ORDER;
    for (let i = 31; i >= 0; i--) {
      order[i] = Number(n & 0xffn);
      n >>= 8n;
    }
    expect(() => importPrivateScalar(order)).toThrow(StealthError);

    // Wrong length.
    expect(() => importPrivateScalar(new Uint8Array(31).fill(1))).toThrow(
      StealthError,
    );
  });

  it("rejects unsupported chain ids", () => {
    // @ts-expect-error — deliberately passing an unsupported chain id.
    expect(() => generateStealthIdentity(1)).toThrow(StealthError);
    try {
      // @ts-expect-error — deliberately passing an unsupported chain id.
      generateStealthIdentity(1);
    } catch (error) {
      expect((error as StealthError).code).toBe("UNSUPPORTED_CHAIN");
    }
  });

  it("contains no hardcoded private scalars in production modules", () => {
    // Guards against a fixture or debugging key leaking into shipped code.
    const dir = join(import.meta.dirname, "..");
    const files = readdirSync(dir).filter((f) => f.endsWith(".ts"));
    expect(files.length).toBeGreaterThan(5);

    const suspicious: string[] = [];
    for (const file of files) {
      const source = readFileSync(join(dir, file), "utf8");
      // A 64-hex-char literal is the shape of a private scalar.
      const matches = source.match(/0x[0-9a-fA-F]{64}/g);
      if (matches) suspicious.push(`${file}: ${matches.join(", ")}`);
    }
    expect(suspicious).toEqual([]);
  });

  it("wraps secrets so they cannot be serialized or stringified", () => {
    const secret = SecretKeyMaterial.fromBytes(scalarOf(0x5a));

    expect(() => JSON.stringify({ secret })).toThrow(StealthError);
    expect(String(secret)).not.toContain("5a5a");
    expect(`${secret}`).toBe("[SecretKeyMaterial:redacted]");

    secret.destroy();
    expect(secret.destroyed).toBe(true);
    expect(() => secret.bytes()).toThrow(StealthError);
  });
});
