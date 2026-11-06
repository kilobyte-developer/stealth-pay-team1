import { describe, expect, it } from "vitest";
import { AVALANCHE_CHAIN_LABEL, LENGTHS } from "../constants";
import { StealthError, type StealthErrorCode } from "../errors";
import {
  buildStealthMetaAddress,
  parseStealthMetaAddress,
} from "../meta-address";
import {
  OFF_CURVE_PUBLIC_KEY,
  SHORT_META_ADDRESS,
  makeAliceIdentity,
} from "./fixtures";

function expectCode(fn: () => unknown, code: StealthErrorCode) {
  try {
    fn();
    throw new Error(`Expected ${code} but nothing was thrown.`);
  } catch (error) {
    expect(error).toBeInstanceOf(StealthError);
    expect((error as StealthError).code).toBe(code);
  }
}

describe("Group B — stealth meta-address", () => {
  const { publicIdentity, secrets } = makeAliceIdentity();
  secrets.destroy();

  it("produces a well-formed meta-address URI", () => {
    expect(publicIdentity.stealthMetaAddress).toBe(
      `st:${AVALANCHE_CHAIN_LABEL}:${publicIdentity.stealthMetaAddressRaw}`,
    );
    expect(publicIdentity.stealthMetaAddressRaw.slice(2).length).toBe(
      LENGTHS.metaAddressBodyHexChars,
    );
  });

  it("orders the spending key before the viewing key", () => {
    const raw = publicIdentity.stealthMetaAddressRaw.slice(2);
    expect(`0x${raw.slice(0, 66)}`).toBe(publicIdentity.spendingPublicKey);
    expect(`0x${raw.slice(66)}`).toBe(publicIdentity.viewingPublicKey);
  });

  it("round-trips back to the original public keys", () => {
    const parsed = parseStealthMetaAddress(publicIdentity.stealthMetaAddress);
    expect(parsed.spendingPublicKey).toBe(publicIdentity.spendingPublicKey);
    expect(parsed.viewingPublicKey).toBe(publicIdentity.viewingPublicKey);
    expect(parsed.chainLabel).toBe(AVALANCHE_CHAIN_LABEL);
  });

  it("accepts a bare 0x key concatenation with no chain label", () => {
    const parsed = parseStealthMetaAddress(
      publicIdentity.stealthMetaAddressRaw,
    );
    expect(parsed.chainLabel).toBeNull();
    expect(parsed.spendingPublicKey).toBe(publicIdentity.spendingPublicKey);
  });

  it("uses 33-byte compressed keys", () => {
    expect(publicIdentity.spendingPublicKey.length).toBe(
      LENGTHS.compressedPublicKeyHex,
    );
    expect(publicIdentity.viewingPublicKey.length).toBe(
      LENGTHS.compressedPublicKeyHex,
    );
    expect(["02", "03"]).toContain(publicIdentity.spendingPublicKey.slice(2, 4));
  });

  it("rejects malformed hex", () => {
    expectCode(
      () => parseStealthMetaAddress(`st:avax:0x${"zz".repeat(66)}`),
      "INVALID_META_ADDRESS",
    );
    expectCode(() => parseStealthMetaAddress(""), "INVALID_META_ADDRESS");
    expectCode(
      () => parseStealthMetaAddress(SHORT_META_ADDRESS),
      "INVALID_META_ADDRESS",
    );
  });

  it("rejects public keys that are not on the curve", () => {
    const bad = `st:avax:0x${OFF_CURVE_PUBLIC_KEY.slice(2)}${publicIdentity.viewingPublicKey.slice(2)}`;
    expectCode(() => parseStealthMetaAddress(bad), "INVALID_PUBLIC_KEY");
  });

  it("rejects unsupported schemes", () => {
    expectCode(
      () =>
        parseStealthMetaAddress(publicIdentity.stealthMetaAddress, {
          schemeId: 2,
        }),
      "UNSUPPORTED_SCHEME",
    );
  });

  it("validates the chain label, unlike the SDK's own parser", () => {
    expectCode(
      () =>
        parseStealthMetaAddress(
          `st:eth:${publicIdentity.stealthMetaAddressRaw}`,
        ),
      "UNSUPPORTED_CHAIN",
    );
    expectCode(
      () => parseStealthMetaAddress(`xx:avax:${publicIdentity.stealthMetaAddressRaw}`),
      "INVALID_META_ADDRESS",
    );
    expectCode(
      () => parseStealthMetaAddress(`st:avax`),
      "INVALID_META_ADDRESS",
    );
  });

  it("rejects the single-key form that collapses scan/spend separation", () => {
    // The SDK tolerates a 66-char meta-address by reusing one key for both
    // roles. StealthPay refuses it: it would let anyone who can scan also spend.
    expectCode(
      () =>
        parseStealthMetaAddress(
          `st:avax:${publicIdentity.spendingPublicKey}`,
        ),
      "INVALID_META_ADDRESS",
    );
  });

  it("rejects building a meta-address from an invalid key", () => {
    expectCode(
      () =>
        buildStealthMetaAddress({
          spendingPublicKey: OFF_CURVE_PUBLIC_KEY,
          viewingPublicKey: publicIdentity.viewingPublicKey,
        }),
      "INVALID_PUBLIC_KEY",
    );
  });
});
