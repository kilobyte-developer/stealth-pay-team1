import { describe, expect, it } from "vitest";
import type { Address, Hex } from "viem";
import type { DetectedPayment } from "@/lib/scanner/announcement-scanner";
import type { LocalActivityEntry } from "@/lib/activity/local-log";
import {
  activityRowFromLocalEntry,
  activityRowFromPayment,
  linkActivityRows,
  toPaymentRow,
} from "../view-model";

const STEALTH = "0x56F838cE0CFaffA6F32d1728D780E8B7bF0626Ed" as Address;
const RECEIVER_WALLET = "0x05ea8dB9c235B86c12c990f811a922D8b8ef1Fd6" as Address;
const SETTLEMENT_TX = "0xec2630b93d581e63e96e58d86a14c315ad4b74482e92c873d908b0aa1099a2e2" as Hex;
const ANNOUNCE_TX = "0x1a682ba550459f7fd1b2cc35927474d1644ae5276392cce11d5767fcac647733" as Hex;
const FORWARD_TX = "0x1ac4dcdfd9f77fc3989c46856018d6996d63f081b1cfc53ad21e2b56460c2156" as Hex;

function detected(overrides: Partial<DetectedPayment> = {}): DetectedPayment {
  return {
    id: `${ANNOUNCE_TX}:0`,
    schemeId: 1,
    stealthAddress: STEALTH,
    announcer: "0x4532Ac24c2ae99F261312b041BF040fE12AcFDF2",
    payerAddress: "0x77c524ABa28e84Bbf2164cD39792Cc3260A019A8",
    ephemeralPublicKey: "0x03bf53bc07c2aa7474eb9dd2e45ecff7622b4e41a47ec04482aa0c94e4efc8b7eb",
    viewTag: "0x3b",
    assetKind: "erc20",
    token: "0x5425890298aed601595a70AB815c96711a31Bc65",
    tokenSymbol: "USDC",
    tokenDecimals: 6,
    announcedAmount: 1000n,
    verifiedBalance: 1000n,
    blockNumber: 61009525n,
    transactionHash: ANNOUNCE_TX,
    logIndex: 0,
    x402SettlementTx: SETTLEMENT_TX,
    x402SettlementBlock: 61008492n,
    ...overrides,
  };
}

const forwardEntry: LocalActivityEntry = {
  id: FORWARD_TX,
  kind: "forward",
  network: "fuji",
  from: STEALTH,
  to: RECEIVER_WALLET,
  assetSymbol: "USDC",
  assetDecimals: 6,
  isNative: false,
  tokenContract: "0x5425890298aed601595a70AB815c96711a31Bc65",
  amount: "0.001",
  txHash: FORWARD_TX,
  blockNumber: "61009715",
  timestamp: "2026-11-13T15:00:00.000Z",
  x402: { status: "settled", paymentId: STEALTH, announcementTx: null },
};

describe("Activity history: incoming → forwarded → still visible", () => {
  it("an emptied x402 payment stays a (non-forwardable) incoming row with its settlement tx and block", () => {
    const before = toPaymentRow(detected());
    const after = toPaymentRow(detected({ verifiedBalance: 0n }));
    expect(before).toMatchObject({ forwarded: false, statusLabel: "x402 · settled & announced" });
    expect(after).toMatchObject({
      forwarded: true,
      spendable: false,
      verifiedAmount: "0",
      declaredAmount: "0.001",
      statusLabel: "x402 · received, then withdrawn",
      blockNumber: 61008492n, // settlement, not the later announcement
    });
    const row = activityRowFromPayment(after);
    // History shows the amount received (0.001), not the current balance (0).
    expect(row).toMatchObject({ direction: "incoming", transactionHash: SETTLEMENT_TX, to: STEALTH, amount: "0.001" });
    expect(activityRowFromPayment(before).amount).toBe("0.001");
  });

  it("an emptied router payment is labelled forwarded, not 'needs gas'", () => {
    const row = toPaymentRow(
      detected({ assetKind: "native", token: null, tokenSymbol: null, x402SettlementTx: null, x402SettlementBlock: null, verifiedBalance: 0n }),
    );
    expect(row).toMatchObject({ forwarded: true, spendable: false, statusLabel: "Received · forwarded (balance now 0)" });
  });

  it("links the forward to the incoming payment and keeps BOTH as separate events", () => {
    const incoming = activityRowFromPayment(toPaymentRow(detected({ verifiedBalance: 0n })));
    const forward = activityRowFromLocalEntry(forwardEntry);
    const linked = linkActivityRows([incoming, forward]);

    expect(linked).toHaveLength(2);
    const [inc, fwd] = linked;
    expect(inc.direction).toBe("incoming");
    expect(inc.linkedTxHash).toBe(FORWARD_TX);
    expect(inc.statusLabel).toMatch(/withdrawn · forwarded in tx 0x1ac4/);
    expect(fwd.direction).toBe("forwarded");
    expect(fwd.linkedTxHash).toBe(SETTLEMENT_TX);
    expect(fwd.statusLabel).toMatch(/of payment to 0x56F8/);
    expect(fwd).toMatchObject({ amount: "0.001", assetLabel: "USDC", blockNumber: 61009715n, transactionHash: FORWARD_TX });
  });

  it("leaves unrelated rows untouched", () => {
    const other = activityRowFromLocalEntry({ ...forwardEntry, id: "0x01" as Hex, txHash: "0x01" as Hex, from: RECEIVER_WALLET });
    const incoming = activityRowFromPayment(toPaymentRow(detected()));
    const [inc, oth] = linkActivityRows([incoming, other]);
    expect(inc.linkedTxHash).toBeNull();
    expect(oth.linkedTxHash).toBeNull();
  });
});
