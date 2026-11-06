import { describe, expect, it } from "vitest";
import { DEFAULT_CHAIN_ID, SCHEME_ID_SECP256K1 } from "../constants";
import { StealthError } from "../errors";
import { checkStealthAnnouncement } from "../receiver";
import { deriveWithEphemeralKey } from "../sender";
import { importPrivateScalar } from "../key-generation";
import {
  OFF_CURVE_PUBLIC_KEY,
  TEST_SCALARS,
  makeAliceIdentity,
  makeOtherIdentity,
  scalarOf,
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

describe("Group D — receiver scanning", () => {
  it("detects an announcement addressed to the receiver", () => {
    const sent = paymentToAlice(TEST_SCALARS.ephemeralA);

    const result = checkStealthAnnouncement({
      stealthAddress: sent.stealthAddress,
      ephemeralPublicKey: sent.ephemeralPublicKey,
      viewTag: sent.viewTag,
      viewingPrivateKey: alice.secrets.viewingPrivateKey,
      spendingPublicKey: alice.publicIdentity.spendingPublicKey,
      schemeId: SCHEME_ID_SECP256K1,
    });

    expect(result.isForUser).toBe(true);
    expect(result.reason).toBe("match");
    expect(result.derivedStealthAddress).toBe(sent.stealthAddress);
  });

  it("detects multiple independent payments to the same identity", () => {
    for (const eph of [
      TEST_SCALARS.ephemeralA,
      TEST_SCALARS.ephemeralB,
      TEST_SCALARS.ephemeralC,
    ]) {
      const sent = paymentToAlice(eph);
      const result = checkStealthAnnouncement({
        stealthAddress: sent.stealthAddress,
        ephemeralPublicKey: sent.ephemeralPublicKey,
        viewTag: sent.viewTag,
        viewingPrivateKey: alice.secrets.viewingPrivateKey,
        spendingPublicKey: alice.publicIdentity.spendingPublicKey,
        schemeId: SCHEME_ID_SECP256K1,
      });
      expect(result.isForUser).toBe(true);
    }
  });

  it("does not match with the wrong viewing private key", () => {
    const sent = paymentToAlice(TEST_SCALARS.ephemeralA);

    const result = checkStealthAnnouncement({
      stealthAddress: sent.stealthAddress,
      ephemeralPublicKey: sent.ephemeralPublicKey,
      viewTag: sent.viewTag,
      viewingPrivateKey: other.secrets.viewingPrivateKey,
      spendingPublicKey: alice.publicIdentity.spendingPublicKey,
      schemeId: SCHEME_ID_SECP256K1,
    });

    expect(result.isForUser).toBe(false);
  });

  it("does not match with the wrong spending public key", () => {
    const sent = paymentToAlice(TEST_SCALARS.ephemeralA);

    const result = checkStealthAnnouncement({
      stealthAddress: sent.stealthAddress,
      ephemeralPublicKey: sent.ephemeralPublicKey,
      viewTag: sent.viewTag,
      viewingPrivateKey: alice.secrets.viewingPrivateKey,
      spendingPublicKey: other.publicIdentity.spendingPublicKey,
      schemeId: SCHEME_ID_SECP256K1,
    });

    // Correct viewing key, so the view tag still matches; the address does not.
    expect(result.isForUser).toBe(false);
    expect(result.reason).toBe("address-mismatch");
    expect(result.derivedStealthAddress).not.toBe(sent.stealthAddress);
  });

  it("rejects a mismatched view tag before deriving an address", () => {
    const sent = paymentToAlice(TEST_SCALARS.ephemeralA);
    const wrongTag = sent.viewTag === "0x00" ? "0x01" : "0x00";

    const result = checkStealthAnnouncement({
      stealthAddress: sent.stealthAddress,
      ephemeralPublicKey: sent.ephemeralPublicKey,
      viewTag: wrongTag,
      viewingPrivateKey: alice.secrets.viewingPrivateKey,
      spendingPublicKey: alice.publicIdentity.spendingPublicKey,
      schemeId: SCHEME_ID_SECP256K1,
    });

    expect(result.isForUser).toBe(false);
    expect(result.reason).toBe("view-tag-mismatch");
    // Proves the expensive derivation was skipped.
    expect(result.derivedStealthAddress).toBeNull();
  });

  it("rejects an announcement whose stealth address was tampered with", () => {
    const sent = paymentToAlice(TEST_SCALARS.ephemeralA);

    const result = checkStealthAnnouncement({
      stealthAddress: other.publicIdentity.spendingPublicKey.slice(
        0,
        42,
      ) as `0x${string}`,
      ephemeralPublicKey: sent.ephemeralPublicKey,
      viewTag: sent.viewTag,
      viewingPrivateKey: alice.secrets.viewingPrivateKey,
      spendingPublicKey: alice.publicIdentity.spendingPublicKey,
      schemeId: SCHEME_ID_SECP256K1,
    });

    expect(result.isForUser).toBe(false);
    expect(result.reason).toBe("address-mismatch");
  });

  it("fails safely on malformed ephemeral points", () => {
    const sent = paymentToAlice(TEST_SCALARS.ephemeralA);

    for (const bad of [OFF_CURVE_PUBLIC_KEY, "0x1234", "not-hex"]) {
      expect(() =>
        checkStealthAnnouncement({
          stealthAddress: sent.stealthAddress,
          ephemeralPublicKey: bad as `0x${string}`,
          viewTag: sent.viewTag,
          viewingPrivateKey: alice.secrets.viewingPrivateKey,
          spendingPublicKey: alice.publicIdentity.spendingPublicKey,
          schemeId: SCHEME_ID_SECP256K1,
        }),
      ).toThrow(StealthError);
    }
  });

  it("rejects unsupported scheme ids and malformed view tags", () => {
    const sent = paymentToAlice(TEST_SCALARS.ephemeralA);
    const base = {
      stealthAddress: sent.stealthAddress,
      ephemeralPublicKey: sent.ephemeralPublicKey,
      viewTag: sent.viewTag,
      viewingPrivateKey: alice.secrets.viewingPrivateKey,
      spendingPublicKey: alice.publicIdentity.spendingPublicKey,
    };

    expect(() =>
      checkStealthAnnouncement({ ...base, schemeId: 2 }),
    ).toThrow(StealthError);

    expect(() =>
      checkStealthAnnouncement({
        ...base,
        viewTag: "0xabcd",
        schemeId: SCHEME_ID_SECP256K1,
      }),
    ).toThrow(StealthError);
  });

  it("throws when the viewing key has been destroyed", () => {
    const sent = paymentToAlice(TEST_SCALARS.ephemeralA);
    const throwaway = importPrivateScalar(scalarOf(0x5c));
    throwaway.destroy();

    expect(() =>
      checkStealthAnnouncement({
        stealthAddress: sent.stealthAddress,
        ephemeralPublicKey: sent.ephemeralPublicKey,
        viewTag: sent.viewTag,
        viewingPrivateKey: throwaway,
        spendingPublicKey: alice.publicIdentity.spendingPublicKey,
        schemeId: SCHEME_ID_SECP256K1,
      }),
    ).toThrow(StealthError);
  });
});
