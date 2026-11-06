import { describe, expect, it } from "vitest";
import { privateKeyToAddress } from "viem/accounts";
import { DEFAULT_CHAIN_ID, SCHEME_ID_SECP256K1 } from "../constants";
import { StealthError, type StealthErrorCode } from "../errors";
import { deriveOneTimeSpendingKey } from "../key-derivation";
import { deriveWithEphemeralKey } from "../sender";
import {
  OFF_CURVE_PUBLIC_KEY,
  TEST_SCALARS,
  makeAliceIdentity,
  makeOtherIdentity,
} from "./fixtures";

const alice = makeAliceIdentity();
const other = makeOtherIdentity();

function paymentToAlice(ephemeral: Uint8Array) {
  const sent = deriveWithEphemeralKey({
    metaAddress: alice.publicIdentity.stealthMetaAddress,
    chainId: DEFAULT_CHAIN_ID,
    ephemeralPrivateKeyBytes: ephemeral,
  });
  sent.ephemeralPrivateKey.destroy();
  return sent;
}

function expectCode(fn: () => unknown, code: StealthErrorCode) {
  try {
    fn();
    throw new Error(`Expected ${code} but nothing was thrown.`);
  } catch (error) {
    expect(error).toBeInstanceOf(StealthError);
    expect((error as StealthError).code).toBe(code);
  }
}

describe("Group E — one-time spending key derivation", () => {
  it("derives a key that controls the announced address", () => {
    const sent = paymentToAlice(TEST_SCALARS.ephemeralA);

    const { privateKey, stealthAddress } = deriveOneTimeSpendingKey({
      ephemeralPublicKey: sent.ephemeralPublicKey,
      viewingPrivateKey: alice.secrets.viewingPrivateKey,
      spendingPrivateKey: alice.secrets.spendingPrivateKey,
      expectedStealthAddress: sent.stealthAddress,
      schemeId: SCHEME_ID_SECP256K1,
    });

    expect(stealthAddress).toBe(sent.stealthAddress);
    expect(privateKey.bytes().length).toBe(32);
    privateKey.destroy();
  });

  it("derived key independently produces the same EVM address", () => {
    const sent = paymentToAlice(TEST_SCALARS.ephemeralB);

    const { privateKey } = deriveOneTimeSpendingKey({
      ephemeralPublicKey: sent.ephemeralPublicKey,
      viewingPrivateKey: alice.secrets.viewingPrivateKey,
      spendingPrivateKey: alice.secrets.spendingPrivateKey,
      expectedStealthAddress: sent.stealthAddress,
      schemeId: SCHEME_ID_SECP256K1,
    });

    // viem's scalar -> address path, which does not reuse the point addition
    // used to generate the address in the first place.
    expect(privateKeyToAddress(privateKey.toHex())).toBe(sent.stealthAddress);
    privateKey.destroy();
  });

  it("rejects derivation with the wrong spending key", () => {
    const sent = paymentToAlice(TEST_SCALARS.ephemeralA);

    expectCode(
      () =>
        deriveOneTimeSpendingKey({
          ephemeralPublicKey: sent.ephemeralPublicKey,
          viewingPrivateKey: alice.secrets.viewingPrivateKey,
          spendingPrivateKey: other.secrets.spendingPrivateKey,
          expectedStealthAddress: sent.stealthAddress,
          schemeId: SCHEME_ID_SECP256K1,
        }),
      "STEALTH_ADDRESS_MISMATCH",
    );
  });

  it("rejects derivation with the wrong viewing key", () => {
    const sent = paymentToAlice(TEST_SCALARS.ephemeralA);

    expectCode(
      () =>
        deriveOneTimeSpendingKey({
          ephemeralPublicKey: sent.ephemeralPublicKey,
          viewingPrivateKey: other.secrets.viewingPrivateKey,
          spendingPrivateKey: alice.secrets.spendingPrivateKey,
          expectedStealthAddress: sent.stealthAddress,
          schemeId: SCHEME_ID_SECP256K1,
        }),
      "STEALTH_ADDRESS_MISMATCH",
    );
  });

  it("rejects malformed announcement inputs", () => {
    const sent = paymentToAlice(TEST_SCALARS.ephemeralA);
    const base = {
      viewingPrivateKey: alice.secrets.viewingPrivateKey,
      spendingPrivateKey: alice.secrets.spendingPrivateKey,
      expectedStealthAddress: sent.stealthAddress,
      schemeId: SCHEME_ID_SECP256K1,
    };

    expectCode(
      () =>
        deriveOneTimeSpendingKey({
          ...base,
          ephemeralPublicKey: OFF_CURVE_PUBLIC_KEY,
        }),
      "INVALID_EPHEMERAL_PUBLIC_KEY",
    );

    expectCode(
      () =>
        deriveOneTimeSpendingKey({
          ...base,
          ephemeralPublicKey: sent.ephemeralPublicKey,
          expectedStealthAddress: "0xnope" as `0x${string}`,
        }),
      "INVALID_STEALTH_ADDRESS",
    );

    expectCode(
      () =>
        deriveOneTimeSpendingKey({
          ...base,
          ephemeralPublicKey: sent.ephemeralPublicKey,
          schemeId: 3,
        }),
      "UNSUPPORTED_SCHEME",
    );
  });

  it("keeps the derived key out of serialized output", () => {
    const sent = paymentToAlice(TEST_SCALARS.ephemeralC);

    const result = deriveOneTimeSpendingKey({
      ephemeralPublicKey: sent.ephemeralPublicKey,
      viewingPrivateKey: alice.secrets.viewingPrivateKey,
      spendingPrivateKey: alice.secrets.spendingPrivateKey,
      expectedStealthAddress: sent.stealthAddress,
      schemeId: SCHEME_ID_SECP256K1,
    });

    // Any attempt to serialize the result fails loudly rather than leaking.
    expect(() => JSON.stringify(result)).toThrow(StealthError);
    expect(String(result.privateKey)).toBe("[SecretKeyMaterial:redacted]");

    result.privateKey.destroy();
    expect(result.privateKey.destroyed).toBe(true);
  });

  it("produces a distinct key per payment", () => {
    const keys = new Set<string>();

    for (const eph of [
      TEST_SCALARS.ephemeralA,
      TEST_SCALARS.ephemeralB,
      TEST_SCALARS.ephemeralC,
    ]) {
      const sent = paymentToAlice(eph);
      const { privateKey } = deriveOneTimeSpendingKey({
        ephemeralPublicKey: sent.ephemeralPublicKey,
        viewingPrivateKey: alice.secrets.viewingPrivateKey,
        spendingPrivateKey: alice.secrets.spendingPrivateKey,
        expectedStealthAddress: sent.stealthAddress,
        schemeId: SCHEME_ID_SECP256K1,
      });
      keys.add(privateKey.toHex());
      privateKey.destroy();
    }

    expect(keys.size).toBe(3);
  });
});
