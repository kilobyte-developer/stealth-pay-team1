import { describe, expect, it } from "vitest";
import { isAddress } from "viem";
import { DEFAULT_CHAIN_ID, LENGTHS, SCHEME_ID_SECP256K1 } from "../constants";
import { StealthError } from "../errors";
import {
  deriveWithEphemeralKey,
  generateOneTimeStealthAddress,
} from "../sender";
import { TEST_SCALARS, makeAliceIdentity, scalarOf } from "./fixtures";

const { publicIdentity, secrets } = makeAliceIdentity();
secrets.destroy();
const META = publicIdentity.stealthMetaAddress;

describe("Group C — sender derivation", () => {
  it("accepts a valid meta-address and returns a complete result", () => {
    const result = generateOneTimeStealthAddress({
      metaAddress: META,
      chainId: DEFAULT_CHAIN_ID,
    });

    expect(isAddress(result.stealthAddress)).toBe(true);
    expect(result.schemeId).toBe(SCHEME_ID_SECP256K1);
    expect(result.chainId).toBe(DEFAULT_CHAIN_ID);
  });

  it("produces a fresh compressed ephemeral public key", () => {
    const result = generateOneTimeStealthAddress({
      metaAddress: META,
      chainId: DEFAULT_CHAIN_ID,
    });

    expect(result.ephemeralPublicKey.length).toBe(
      LENGTHS.compressedPublicKeyHex,
    );
    expect(["02", "03"]).toContain(result.ephemeralPublicKey.slice(2, 4));
  });

  it("produces a single-byte view tag", () => {
    const result = generateOneTimeStealthAddress({
      metaAddress: META,
      chainId: DEFAULT_CHAIN_ID,
    });

    expect(result.viewTag.length).toBe(LENGTHS.viewTagHex);
    expect(/^0x[0-9a-f]{2}$/i.test(result.viewTag)).toBe(true);
  });

  it("produces a different stealth address for every payment", () => {
    const addresses = new Set<string>();
    const ephemerals = new Set<string>();

    for (let i = 0; i < 6; i++) {
      const r = generateOneTimeStealthAddress({
        metaAddress: META,
        chainId: DEFAULT_CHAIN_ID,
      });
      addresses.add(r.stealthAddress);
      ephemerals.add(r.ephemeralPublicKey);
    }

    expect(addresses.size).toBe(6);
    expect(ephemerals.size).toBe(6);
  });

  it("never exposes the ephemeral private key in the public result", () => {
    const result = generateOneTimeStealthAddress({
      metaAddress: META,
      chainId: DEFAULT_CHAIN_ID,
    });

    expect(Object.keys(result)).toEqual(
      expect.not.arrayContaining(["ephemeralPrivateKey"]),
    );
    // Safe to serialize: the public result carries no secret.
    expect(() => JSON.stringify(result)).not.toThrow();
  });

  it("is deterministic when given a fixed ephemeral key", () => {
    const a = deriveWithEphemeralKey({
      metaAddress: META,
      chainId: DEFAULT_CHAIN_ID,
      ephemeralPrivateKeyBytes: TEST_SCALARS.ephemeralA,
    });
    const b = deriveWithEphemeralKey({
      metaAddress: META,
      chainId: DEFAULT_CHAIN_ID,
      ephemeralPrivateKeyBytes: TEST_SCALARS.ephemeralA,
    });

    expect(a.stealthAddress).toBe(b.stealthAddress);
    expect(a.ephemeralPublicKey).toBe(b.ephemeralPublicKey);
    expect(a.viewTag).toBe(b.viewTag);
    a.ephemeralPrivateKey.destroy();
    b.ephemeralPrivateKey.destroy();
  });

  it("rejects an invalid ephemeral key instead of silently randomising", () => {
    // The SDK falls back to a random key when handed an invalid scalar, which
    // would make a 'deterministic' test quietly non-deterministic.
    expect(() =>
      deriveWithEphemeralKey({
        metaAddress: META,
        chainId: DEFAULT_CHAIN_ID,
        ephemeralPrivateKeyBytes: scalarOf(0),
      }),
    ).toThrow(StealthError);
  });

  it("fails safely on invalid meta-addresses and chains", () => {
    expect(() =>
      generateOneTimeStealthAddress({
        metaAddress: "not-a-meta-address",
        chainId: DEFAULT_CHAIN_ID,
      }),
    ).toThrow(StealthError);

    expect(() =>
      generateOneTimeStealthAddress({
        metaAddress: `st:eth:${publicIdentity.stealthMetaAddressRaw}`,
        chainId: DEFAULT_CHAIN_ID,
      }),
    ).toThrow(StealthError);

    expect(() =>
      generateOneTimeStealthAddress({
        metaAddress: META,
        // @ts-expect-error — unsupported chain id on purpose.
        chainId: 1,
      }),
    ).toThrow(StealthError);

    expect(() =>
      generateOneTimeStealthAddress({
        metaAddress: META,
        chainId: DEFAULT_CHAIN_ID,
        schemeId: 7,
      }),
    ).toThrow(StealthError);
  });
});
