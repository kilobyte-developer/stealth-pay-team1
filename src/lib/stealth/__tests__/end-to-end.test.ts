import { describe, expect, it } from "vitest";
import { privateKeyToAddress } from "viem/accounts";
import { DEFAULT_CHAIN_ID, SCHEME_ID_SECP256K1 } from "../constants";
import { generateStealthIdentity } from "../key-generation";
import { parseStealthMetaAddress } from "../meta-address";
import { generateOneTimeStealthAddress } from "../sender";
import { checkStealthAnnouncement } from "../receiver";
import {
  deriveOneTimeSpendingKey,
  verifyPaymentDerivation,
} from "../key-derivation";
import { makeOtherIdentity } from "./fixtures";

/**
 * Group F — the round trip that the whole product depends on.
 *
 * Alice (receiver) publishes a meta-address. Bob (sender) derives a one-time
 * address from it. Alice independently finds that address with her viewing key
 * and recovers the private key that controls it.
 */
describe("Group F — full cryptographic round trip", () => {
  it("Alice → Bob → Alice recovers control of the exact address", () => {
    // --- Alice creates an identity (real CSPRNG, not a fixture) ---
    const alice = generateStealthIdentity(DEFAULT_CHAIN_ID);

    // --- Bob receives only the public meta-address ---
    const parsed = parseStealthMetaAddress(
      alice.publicIdentity.stealthMetaAddress,
    );
    expect(parsed.spendingPublicKey).toBe(
      alice.publicIdentity.spendingPublicKey,
    );
    expect(parsed.viewingPublicKey).toBe(alice.publicIdentity.viewingPublicKey);

    // --- Bob derives a one-time address with a fresh ephemeral key ---
    const payment = generateOneTimeStealthAddress({
      metaAddress: alice.publicIdentity.stealthMetaAddress,
      chainId: DEFAULT_CHAIN_ID,
    });

    // --- Alice scans the announcement ---
    const check = checkStealthAnnouncement({
      stealthAddress: payment.stealthAddress,
      ephemeralPublicKey: payment.ephemeralPublicKey,
      viewTag: payment.viewTag,
      viewingPrivateKey: alice.secrets.viewingPrivateKey,
      spendingPublicKey: alice.publicIdentity.spendingPublicKey,
      schemeId: SCHEME_ID_SECP256K1,
    });

    expect(check.isForUser).toBe(true);
    expect(check.derivedStealthAddress).toBe(payment.stealthAddress);

    // --- Alice recovers the one-time spending key ---
    const { privateKey, stealthAddress } = deriveOneTimeSpendingKey({
      ephemeralPublicKey: payment.ephemeralPublicKey,
      viewingPrivateKey: alice.secrets.viewingPrivateKey,
      spendingPrivateKey: alice.secrets.spendingPrivateKey,
      expectedStealthAddress: payment.stealthAddress,
      schemeId: SCHEME_ID_SECP256K1,
    });

    // --- The decisive assertion ---
    expect(privateKeyToAddress(privateKey.toHex())).toBe(
      payment.stealthAddress,
    );
    expect(stealthAddress).toBe(payment.stealthAddress);

    privateKey.destroy();
    alice.secrets.destroy();
  });

  it("handles many independent payments to one identity", () => {
    const alice = generateStealthIdentity(DEFAULT_CHAIN_ID);
    const seen = new Set<string>();

    for (let i = 0; i < 10; i++) {
      const payment = generateOneTimeStealthAddress({
        metaAddress: alice.publicIdentity.stealthMetaAddress,
        chainId: DEFAULT_CHAIN_ID,
      });

      // Every payment must land on a brand-new address.
      expect(seen.has(payment.stealthAddress)).toBe(false);
      seen.add(payment.stealthAddress);

      expect(
        checkStealthAnnouncement({
          stealthAddress: payment.stealthAddress,
          ephemeralPublicKey: payment.ephemeralPublicKey,
          viewTag: payment.viewTag,
          viewingPrivateKey: alice.secrets.viewingPrivateKey,
          spendingPublicKey: alice.publicIdentity.spendingPublicKey,
          schemeId: SCHEME_ID_SECP256K1,
        }).isForUser,
      ).toBe(true);

      const verification = verifyPaymentDerivation({
        ephemeralPublicKey: payment.ephemeralPublicKey,
        viewingPrivateKey: alice.secrets.viewingPrivateKey,
        spendingPrivateKey: alice.secrets.spendingPrivateKey,
        senderStealthAddress: payment.stealthAddress,
      });

      expect(verification.matches).toBe(true);
      expect(verification.recoveredAddress).toBe(payment.stealthAddress);
    }

    expect(seen.size).toBe(10);
    alice.secrets.destroy();
  });

  it("a different receiver cannot detect or spend Alice's payment", () => {
    const alice = generateStealthIdentity(DEFAULT_CHAIN_ID);
    const mallory = makeOtherIdentity();

    const payment = generateOneTimeStealthAddress({
      metaAddress: alice.publicIdentity.stealthMetaAddress,
      chainId: DEFAULT_CHAIN_ID,
    });

    // Mallory's own keys must not match the announcement.
    const check = checkStealthAnnouncement({
      stealthAddress: payment.stealthAddress,
      ephemeralPublicKey: payment.ephemeralPublicKey,
      viewTag: payment.viewTag,
      viewingPrivateKey: mallory.secrets.viewingPrivateKey,
      spendingPublicKey: mallory.publicIdentity.spendingPublicKey,
      schemeId: SCHEME_ID_SECP256K1,
    });
    expect(check.isForUser).toBe(false);

    // And she cannot recover a key for it.
    const attempt = verifyPaymentDerivation({
      ephemeralPublicKey: payment.ephemeralPublicKey,
      viewingPrivateKey: mallory.secrets.viewingPrivateKey,
      spendingPrivateKey: mallory.secrets.spendingPrivateKey,
      senderStealthAddress: payment.stealthAddress,
    });
    expect(attempt.matches).toBe(false);
    expect(attempt.recoveredAddress).toBeNull();

    alice.secrets.destroy();
    mallory.secrets.destroy();
  });

  it("works identically on mainnet chain context", () => {
    // Derivation is chain-agnostic; only the bound chainId differs.
    const alice = generateStealthIdentity(43114);
    const payment = generateOneTimeStealthAddress({
      metaAddress: alice.publicIdentity.stealthMetaAddress,
      chainId: 43114,
    });

    expect(payment.chainId).toBe(43114);
    expect(
      verifyPaymentDerivation({
        ephemeralPublicKey: payment.ephemeralPublicKey,
        viewingPrivateKey: alice.secrets.viewingPrivateKey,
        spendingPrivateKey: alice.secrets.spendingPrivateKey,
        senderStealthAddress: payment.stealthAddress,
      }).matches,
    ).toBe(true);

    alice.secrets.destroy();
  });
});
