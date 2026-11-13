import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { getAddress, zeroAddress, type Address } from "viem";
import type { PaymentRequirements } from "@x402/core/types";
import {
  DEFAULT_CHAIN_ID,
  generateOneTimeStealthAddress,
  generateStealthIdentity,
} from "@/lib/stealth";
import { parseAnnouncementMetadata } from "@/lib/scanner/metadata";
import {
  FUJI_USDC,
  X402_FUJI_NETWORK,
  X402_MAX_AMOUNT,
  encodeX402AnnouncementMetadata,
} from "../config";
import { IntentValidationError, parseStealthPaymentIntent } from "../intent";
import { X402ClientError, assertRequirementMatchesIntent } from "../client";
import { FilePaymentStore, KeyedMutex, type X402PaymentRecord } from "../server/store";

const expected = { network: X402_FUJI_NETWORK, asset: FUJI_USDC.address };
const payer = getAddress("0x1111111111111111111111111111111111111111");

function derive() {
  const id = generateStealthIdentity(DEFAULT_CHAIN_ID);
  const d = generateOneTimeStealthAddress({
    metaAddress: id.publicIdentity.stealthMetaAddress,
    chainId: DEFAULT_CHAIN_ID,
  });
  id.secrets.destroy();
  return d;
}

function validBody(overrides: Record<string, unknown> = {}) {
  const d = derive();
  return {
    network: X402_FUJI_NETWORK,
    asset: FUJI_USDC.address,
    amount: "1000000",
    stealthAddress: d.stealthAddress,
    ephemeralPublicKey: d.ephemeralPublicKey,
    viewTag: d.viewTag,
    schemeId: 1,
    ...overrides,
  };
}

function codeOf(fn: () => unknown): string | null {
  try {
    fn();
    return null;
  } catch (e) {
    return e instanceof IntentValidationError ? e.code : "OTHER";
  }
}

describe("parseStealthPaymentIntent", () => {
  it("accepts a well-formed intent and normalises it", () => {
    const body = validBody();
    const intent = parseStealthPaymentIntent(body, expected);
    expect(intent.stealthAddress).toBe(getAddress(body.stealthAddress));
    expect(intent.asset).toBe(FUJI_USDC.address);
  });

  it("rejects wrong network, unsupported token, bad amounts and bad keys", () => {
    expect(codeOf(() => parseStealthPaymentIntent(validBody({ network: "eip155:43114" }), expected))).toBe("WRONG_NETWORK");
    expect(codeOf(() => parseStealthPaymentIntent(validBody({ network: "eip155:84532" }), expected))).toBe("WRONG_NETWORK");
    expect(
      codeOf(() => parseStealthPaymentIntent(validBody({ asset: "0xB114A2B17F1E7b028249cCFec2D98D25a3Bbe9C0" }), expected)),
    ).toBe("UNSUPPORTED_TOKEN");
    for (const amount of ["0", "-1", "1.5", "abc", 1000000, (X402_MAX_AMOUNT + 1n).toString()]) {
      expect(codeOf(() => parseStealthPaymentIntent(validBody({ amount }), expected))).toBe("INVALID_AMOUNT");
    }
    expect(codeOf(() => parseStealthPaymentIntent(validBody({ stealthAddress: zeroAddress }), expected))).toBe(
      "INVALID_STEALTH_ADDRESS",
    );
    // 33 bytes with a valid prefix but NOT on the curve.
    expect(
      codeOf(() => parseStealthPaymentIntent(validBody({ ephemeralPublicKey: `0x02${"00".repeat(32)}` }), expected)),
    ).toBe("INVALID_EPHEMERAL_PUBLIC_KEY");
    expect(codeOf(() => parseStealthPaymentIntent(validBody({ viewTag: "0x1234" }), expected))).toBe("INVALID_VIEW_TAG");
    expect(codeOf(() => parseStealthPaymentIntent(validBody({ schemeId: 2 }), expected))).toBe("UNSUPPORTED_SCHEME");
    expect(codeOf(() => parseStealthPaymentIntent(null, expected))).toBe("INVALID_BODY");
  });
});

describe("x402 announcement metadata", () => {
  it("round-trips through the receiver-side scanner parser as an ERC-20 payment", () => {
    const d = derive();
    const meta = encodeX402AnnouncementMetadata(d.viewTag, FUJI_USDC.address, 12_500_000n);
    expect((meta.length - 2) / 2).toBe(57);
    expect(meta.slice(4, 12)).toBe("e3ee160e");
    expect(parseAnnouncementMetadata(meta)).toEqual({
      viewTag: d.viewTag,
      kind: "erc20",
      selector: "0xe3ee160e",
      token: FUJI_USDC.address,
      amount: 12_500_000n,
    });
  });
});

describe("assertRequirementMatchesIntent (client refuses to sign mismatches)", () => {
  const d = derive();
  const intent = parseStealthPaymentIntent(
    {
      network: X402_FUJI_NETWORK,
      asset: FUJI_USDC.address,
      amount: "5000000",
      stealthAddress: d.stealthAddress,
      ephemeralPublicKey: d.ephemeralPublicKey,
      viewTag: d.viewTag,
    },
    expected,
  );
  const good: PaymentRequirements = {
    scheme: "exact",
    network: X402_FUJI_NETWORK,
    asset: FUJI_USDC.address,
    amount: "5000000",
    payTo: d.stealthAddress,
    maxTimeoutSeconds: 300,
    extra: { name: "USD Coin", version: "2", assetTransferMethod: "eip3009" },
  };

  it("accepts the exact requirement", () => {
    expect(() => assertRequirementMatchesIntent(good, intent, FUJI_USDC, payer)).not.toThrow();
  });

  it.each([
    ["payTo redirected", { payTo: "0x2222222222222222222222222222222222222222" }],
    ["payTo is the payer", { payTo: payer }],
    ["amount changed", { amount: "5000001" }],
    ["asset swapped", { asset: "0xB114A2B17F1E7b028249cCFec2D98D25a3Bbe9C0" }],
    ["network changed", { network: "eip155:43114" }],
    ["scheme changed", { scheme: "upto" }],
    ["Permit2 requested", { extra: { name: "USD Coin", version: "2", assetTransferMethod: "permit2" } }],
    ["domain changed", { extra: { name: "USDC", version: "2" } }],
  ])("rejects: %s", (_label, patch) => {
    const tampered = { ...good, ...patch } as PaymentRequirements;
    expect(() => assertRequirementMatchesIntent(tampered, intent, FUJI_USDC, payer)).toThrow(X402ClientError);
  });
});

describe("KeyedMutex", () => {
  it("serialises work per key and runs different keys concurrently", async () => {
    const m = new KeyedMutex();
    const order: string[] = [];
    const slow = (tag: string, ms: number) => async () => {
      order.push(`${tag}:start`);
      await new Promise((r) => setTimeout(r, ms));
      order.push(`${tag}:end`);
    };
    await Promise.all([m.run("0xAA", slow("a1", 30)), m.run("0xaa", slow("a2", 1)), m.run("0xbb", slow("b", 1))]);
    expect(order.indexOf("a1:end")).toBeLessThan(order.indexOf("a2:start"));
    expect(order.indexOf("b:end")).toBeLessThan(order.indexOf("a1:end"));
  });
});

describe("FilePaymentStore", () => {
  let dir: string | null = null;
  afterEach(async () => {
    if (dir) await rm(dir, { recursive: true, force: true });
    dir = null;
  });

  it("persists records atomically and reloads them in a new instance", async () => {
    dir = await mkdtemp(join(tmpdir(), "x402-store-"));
    const path = join(dir, "nested", "payments.json");
    const id = getAddress("0x3333333333333333333333333333333333333333") as Address;
    const record = { id, status: "pending", amount: "1" } as unknown as X402PaymentRecord;
    await new FilePaymentStore(path).put(record);
    const reloaded = await new FilePaymentStore(path).get(id);
    expect(reloaded).toEqual(record);
    const raw = await readFile(path, "utf8");
    expect(raw).not.toMatch(/privateKey|spending|viewing/i);
  });
});
