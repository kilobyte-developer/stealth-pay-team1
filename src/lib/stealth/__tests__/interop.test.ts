import { describe, expect, it } from "vitest";
import {
  VALID_SCHEME_ID,
  checkStealthAddress as sdkCheckStealthAddress,
  computeStealthKey as sdkComputeStealthKey,
  generateStealthAddress as sdkGenerateStealthAddress,
} from "@scopelift/stealth-address-sdk";
import { getSharedSecret } from "@noble/secp256k1";
import { keccak256 } from "viem";
import { privateKeyToAddress } from "viem/accounts";
import { DEFAULT_CHAIN_ID, SCHEME_ID_SECP256K1 } from "../constants";
import { deriveWithEphemeralKey } from "../sender";
import { checkStealthAnnouncement } from "../receiver";
import { deriveOneTimeSpendingKey } from "../key-derivation";
import { TEST_SCALARS, makeAliceIdentity } from "./fixtures";

/**
 * Group G — interoperability and convention pinning.
 *
 * ## Interoperability reference
 * `@scopelift/stealth-address-sdk@1.0.0-beta.5` is the reference
 * implementation for ERC-5564 scheme 1 here. StealthPay's `receiver.ts` is
 * composed from the SDK's own exported primitives (so it can report *why* a
 * check failed), which means comparing it to `sdkCheckStealthAddress` tests
 * internal consistency, not independence — it is asserted below on that basis
 * and labelled as such.
 *
 * The genuinely independent check is the scalar path: recover x via
 * `computeStealthKey`, then derive its address with viem's
 * `privateKeyToAddress`. That never touches the point-addition code used to
 * produce the address, so agreement is meaningful evidence of correctness.
 *
 * These tests do NOT demonstrate interoperability with any other vendor's
 * ERC-5564 implementation, and nothing here constitutes an audit.
 */
describe("Group G — SDK interoperability and pinned conventions", () => {
  const alice = makeAliceIdentity();
  const META = alice.publicIdentity.stealthMetaAddress;

  it("our wrapper and the raw SDK derive identical values", () => {
    const ours = deriveWithEphemeralKey({
      metaAddress: META,
      chainId: DEFAULT_CHAIN_ID,
      ephemeralPrivateKeyBytes: TEST_SCALARS.ephemeralA,
    });
    ours.ephemeralPrivateKey.destroy();

    const theirs = sdkGenerateStealthAddress({
      stealthMetaAddressURI: META,
      schemeId: VALID_SCHEME_ID.SCHEME_ID_1,
      ephemeralPrivateKey: TEST_SCALARS.ephemeralA,
    });

    expect(ours.stealthAddress).toBe(theirs.stealthAddress);
    expect(ours.ephemeralPublicKey).toBe(theirs.ephemeralPublicKey);
    expect(ours.viewTag).toBe(theirs.viewTag);
  });

  it("our checker agrees with the SDK checker (internal consistency)", () => {
    const sent = deriveWithEphemeralKey({
      metaAddress: META,
      chainId: DEFAULT_CHAIN_ID,
      ephemeralPrivateKeyBytes: TEST_SCALARS.ephemeralB,
    });
    sent.ephemeralPrivateKey.destroy();

    const ours = checkStealthAnnouncement({
      stealthAddress: sent.stealthAddress,
      ephemeralPublicKey: sent.ephemeralPublicKey,
      viewTag: sent.viewTag,
      viewingPrivateKey: alice.secrets.viewingPrivateKey,
      spendingPublicKey: alice.publicIdentity.spendingPublicKey,
      schemeId: SCHEME_ID_SECP256K1,
    });

    const theirs = sdkCheckStealthAddress({
      userStealthAddress: sent.stealthAddress,
      ephemeralPublicKey: sent.ephemeralPublicKey,
      viewTag: sent.viewTag,
      viewingPrivateKey: alice.secrets.viewingPrivateKey.toHex(),
      spendingPublicKey: alice.publicIdentity.spendingPublicKey,
      schemeId: VALID_SCHEME_ID.SCHEME_ID_1,
    });

    expect(ours.isForUser).toBe(theirs);
    expect(theirs).toBe(true);
  });

  it("our spending key matches the SDK's computeStealthKey", () => {
    const sent = deriveWithEphemeralKey({
      metaAddress: META,
      chainId: DEFAULT_CHAIN_ID,
      ephemeralPrivateKeyBytes: TEST_SCALARS.ephemeralC,
    });
    sent.ephemeralPrivateKey.destroy();

    const { privateKey } = deriveOneTimeSpendingKey({
      ephemeralPublicKey: sent.ephemeralPublicKey,
      viewingPrivateKey: alice.secrets.viewingPrivateKey,
      spendingPrivateKey: alice.secrets.spendingPrivateKey,
      expectedStealthAddress: sent.stealthAddress,
      schemeId: SCHEME_ID_SECP256K1,
    });

    const sdkKey = sdkComputeStealthKey({
      ephemeralPublicKey: sent.ephemeralPublicKey,
      viewingPrivateKey: alice.secrets.viewingPrivateKey.toHex(),
      spendingPrivateKey: alice.secrets.spendingPrivateKey.toHex(),
      schemeId: VALID_SCHEME_ID.SCHEME_ID_1,
    });

    expect(privateKey.toHex()).toBe(sdkKey);
    // Independent path: scalar -> address, bypassing point addition entirely.
    expect(privateKeyToAddress(sdkKey)).toBe(sent.stealthAddress);
    privateKey.destroy();
  });

  it("pins the scheme-1 conventions this engine depends on", () => {
    // Verified against the SDK source, then asserted here so a dependency
    // upgrade that changes any of these fails loudly.
    const viewPub = alice.publicIdentity.viewingPublicKey;
    const shared = getSharedSecret(
      TEST_SCALARS.ephemeralA,
      viewPub.slice(2),
    );

    // 1. The ECDH output is the 33-byte COMPRESSED point (not 32 or 65 bytes).
    expect(shared.length).toBe(33);

    // 2. The hash is keccak-256 over those exact bytes.
    const hashed = keccak256(shared);
    expect(hashed).toMatch(/^0x[0-9a-f]{64}$/);

    // 3. The view tag is the most-significant byte of that hash.
    const expectedViewTag = `0x${hashed.slice(2, 4)}`;
    const sent = deriveWithEphemeralKey({
      metaAddress: META,
      chainId: DEFAULT_CHAIN_ID,
      ephemeralPrivateKeyBytes: TEST_SCALARS.ephemeralA,
    });
    sent.ephemeralPrivateKey.destroy();
    expect(sent.viewTag).toBe(expectedViewTag);
  });

  it("rejects every scheme id other than 1", () => {
    for (const bad of [0, 2, 3, 255]) {
      expect(() =>
        deriveWithEphemeralKey({
          metaAddress: META,
          chainId: DEFAULT_CHAIN_ID,
          schemeId: bad,
          ephemeralPrivateKeyBytes: TEST_SCALARS.ephemeralA,
        }),
      ).toThrow();
    }
    expect(VALID_SCHEME_ID.SCHEME_ID_1).toBe(1);
    expect(SCHEME_ID_SECP256K1).toBe(1);
  });
});
