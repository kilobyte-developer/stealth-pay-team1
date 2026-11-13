import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createWalletClient,
  erc20Abi,
  getAddress,
  http,
  parseEventLogs,
  parseUnits,
  publicActions,
  slice,
  toHex,
  type Address,
  type Hex,
  type LocalAccount,
} from "viem";
import { generatePrivateKey, privateKeyToAccount, privateKeyToAddress } from "viem/accounts";
import { encodePaymentSignatureHeader } from "@x402/core/http";
import { x402Facilitator } from "@x402/core/facilitator";
import type { PaymentPayload, PaymentRequirements } from "@x402/core/types";
import { toFacilitatorEvmSigner } from "@x402/evm";
import { ExactEvmScheme as ExactEvmFacilitatorScheme } from "@x402/evm/exact/facilitator";
import {
  DEFAULT_CHAIN_ID,
  checkStealthAnnouncement,
  deriveOneTimeSpendingKey,
  generateOneTimeStealthAddress,
  generateStealthIdentity,
  parseStealthMetaAddress,
  SCHEME_ID_SECP256K1,
  type OneTimeStealthAddress,
} from "@/lib/stealth";
import { ANNOUNCEMENT_EVENT } from "@/lib/scanner/announcement-event";
import { parseAnnouncementMetadata } from "@/lib/scanner/metadata";
import {
  X402_FUJI_NETWORK,
  encodeX402AnnouncementMetadata,
  type X402AssetConfig,
} from "@/lib/x402/config";
import {
  payStealthAddressViaX402,
  withdrawStealthTokenViaX402,
  X402ClientError,
} from "@/lib/x402/client";
import {
  X402StealthPaymentService,
  type Facilitator,
} from "@/lib/x402/server/payment-service";
import {
  handleGetPayment,
  handlePaymentRequest,
  handleRetryAnnouncement,
  handleWithdrawal,
} from "@/lib/x402/server/http-handlers";
import { MemoryPaymentStore, type X402PaymentRecord } from "@/lib/x402/server/store";
import { transferWithAuthorizationTypes } from "@/lib/x402/server/eip3009";
import {
  RPC_URL,
  deploy,
  loadArtifact,
  localChain,
  startHardhatNode,
  type NodeHandle,
} from "./hardhat-node";

/*
 * Full x402 + EIP-3009 + ERC-5564 lifecycle on a local chain (chainId 43113).
 *
 * Real components: the StealthPay crypto engine, the ERC-5564 Announcer, the
 * x402 client (@x402/core + @x402/evm exact client), the StealthPay x402
 * backend (HTTP handlers + service), and a REAL x402 facilitator
 * (@x402/core x402Facilitator + @x402/evm exact facilitator scheme) that
 * verifies and settles by calling transferWithAuthorization on-chain.
 *
 * Stand-in: the token is MockEIP3009Token (FiatToken-compatible EIP-3009)
 * instead of Circle USDC, and the facilitator runs in-process instead of at
 * PayAI. Fault-injection wrappers are used ONLY in the failure tests.
 */

// Well-known Hardhat test-mnemonic accounts #1–#3. Worthless outside a local node.
const FACILITATOR_KEY = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d" as const;
const RELAYER_KEY = "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a" as const;
const SENDER_KEY = "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6" as const;

const RESOURCE = "http://localhost/api/x402/stealth-payments";

const announcerArtifact = loadArtifact("ERC5564Announcer.sol", "ERC5564Announcer");
const eip3009Artifact = loadArtifact("mocks/MockEIP3009Token.sol", "MockEIP3009Token");
const plainTokenArtifact = loadArtifact("mocks/TestTokens.sol", "MockERC20");

let node: NodeHandle | null = null;
let announcer: Address;
let token: Address;
let plainToken: Address;
let asset: X402AssetConfig;
let realFacilitator: Facilitator;
const sender = privateKeyToAccount(SENDER_KEY);
const relayer = privateKeyToAccount(RELAYER_KEY);

beforeAll(async () => {
  node = await startHardhatNode();
  if (!node) return;
  announcer = await deploy(node, announcerArtifact);
  token = await deploy(node, eip3009Artifact, ["USD Coin", "USDC", "2", 6]);
  plainToken = await deploy(node, plainTokenArtifact, ["StealthPay Test USD", "stUSD", 6]);
  asset = {
    address: token,
    symbol: "USDC",
    name: "USD Coin",
    decimals: 6,
    eip712: { name: "USD Coin", version: "2" },
  };

  const facilitatorAccount = privateKeyToAccount(FACILITATOR_KEY);
  const facilitatorClient = createWalletClient({
    account: facilitatorAccount,
    chain: localChain,
    transport: http(RPC_URL),
  }).extend(publicActions);
  const signer = toFacilitatorEvmSigner(
    Object.assign(facilitatorClient, { address: facilitatorAccount.address }) as never,
  );
  realFacilitator = new x402Facilitator().register(
    X402_FUJI_NETWORK,
    new ExactEvmFacilitatorScheme(signer),
  );

  await mint(sender.address, parseUnits("1000", 6));
}, 180_000);

afterAll(() => {
  node?.stop();
});

/* ------------------------------- helpers ------------------------------- */

async function mint(to: Address, amount: bigint) {
  const hash = await node!.walletClient.writeContract({
    address: token,
    abi: eip3009Artifact.abi,
    functionName: "mint",
    args: [to, amount],
    account: node!.account,
    chain: localChain,
  });
  await node!.publicClient.waitForTransactionReceipt({ hash });
}

function balanceOf(addr: Address) {
  return node!.publicClient.readContract({ address: token, abi: erc20Abi, functionName: "balanceOf", args: [addr] });
}

function makeService(opts: { facilitator?: Facilitator; relayer?: LocalAccount; store?: MemoryPaymentStore } = {}) {
  return new X402StealthPaymentService({
    client: node!.publicClient,
    facilitator: opts.facilitator ?? realFacilitator,
    relayer: opts.relayer ?? relayer,
    announcer,
    asset,
    network: X402_FUJI_NETWORK,
    chainId: 43113,
    store: opts.store ?? new MemoryPaymentStore(),
    resourceUrl: RESOURCE,
    receiptTimeoutMs: 20_000,
  });
}

/** Routes the browser client's fetch() straight into the real HTTP handlers. */
function fetchVia(service: X402StealthPaymentService): typeof fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), "http://localhost");
    const req = new Request(url, init);
    if (url.pathname.endsWith("/api/x402/withdrawals")) return handleWithdrawal(req, () => service);
    const announceMatch = url.pathname.match(/\/stealth-payments\/(0x[0-9a-fA-F]{40})\/announce$/);
    if (announceMatch) return handleRetryAnnouncement(announceMatch[1], () => service);
    const getMatch = url.pathname.match(/\/stealth-payments\/(0x[0-9a-fA-F]{40})$/);
    if (getMatch) return handleGetPayment(getMatch[1], () => service);
    return handlePaymentRequest(req, () => service);
  }) as typeof fetch;
}

function receiverAndPayment() {
  const receiver = generateStealthIdentity(DEFAULT_CHAIN_ID);
  const derived = generateOneTimeStealthAddress({
    metaAddress: receiver.publicIdentity.stealthMetaAddress,
    chainId: DEFAULT_CHAIN_ID,
  });
  return { receiver, derived };
}

function intentBody(derived: OneTimeStealthAddress, amount: bigint, overrides: Record<string, unknown> = {}) {
  return JSON.stringify({
    network: X402_FUJI_NETWORK,
    asset: token,
    amount: amount.toString(),
    stealthAddress: derived.stealthAddress,
    ephemeralPublicKey: derived.ephemeralPublicKey,
    viewTag: derived.viewTag,
    schemeId: 1,
    ...overrides,
  });
}

async function post(service: X402StealthPaymentService, body: string, header?: string) {
  const res = await handlePaymentRequest(
    new Request(RESOURCE, {
      method: "POST",
      headers: { "content-type": "application/json", ...(header ? { "PAYMENT-SIGNATURE": header } : {}) },
      body,
    }),
    () => service,
  );
  return { status: res.status, body: (await res.json()) as Record<string, unknown>, headers: res.headers };
}

/** Issues the requirement, then signs a hand-built EIP-3009 authorization. */
async function signedPayload(
  service: X402StealthPaymentService,
  derived: OneTimeStealthAddress,
  amount: bigint,
  opts: { signer?: LocalAccount; from?: Address; to?: Address; value?: bigint; validBefore?: bigint } = {},
) {
  const issued = await post(service, intentBody(derived, amount));
  expect(issued.status).toBe(402);
  const requirements = (issued.body.accepts as PaymentRequirements[])[0];
  const signer = opts.signer ?? sender;
  const now = BigInt(Math.floor(Date.now() / 1000));
  const authorization = {
    from: opts.from ?? signer.address,
    to: opts.to ?? getAddress(requirements.payTo),
    value: opts.value ?? BigInt(requirements.amount),
    validAfter: 0n,
    validBefore: opts.validBefore ?? now + 300n,
    nonce: toHex(crypto.getRandomValues(new Uint8Array(32))),
  };
  const signature = await signer.signTypedData({
    domain: { name: "USD Coin", version: "2", chainId: 43113, verifyingContract: token },
    types: transferWithAuthorizationTypes,
    primaryType: "TransferWithAuthorization",
    message: authorization,
  });
  const payload: PaymentPayload = {
    x402Version: 2,
    resource: { url: RESOURCE, description: "", mimeType: "application/json" },
    accepted: requirements,
    payload: {
      authorization: {
        from: authorization.from,
        to: authorization.to,
        value: authorization.value.toString(),
        validAfter: "0",
        validBefore: authorization.validBefore.toString(),
        nonce: authorization.nonce,
      },
      signature,
    },
  };
  return { header: encodePaymentSignatureHeader(payload), payload, requirements };
}

async function announcementsFor(stealthAddress: Address) {
  const logs = await node!.publicClient.getLogs({
    address: announcer,
    event: ANNOUNCEMENT_EVENT,
    args: { stealthAddress },
    fromBlock: 0n,
  });
  return logs;
}

/* -------------------------------- tests -------------------------------- */

describe.runIf(process.env.SKIP_CHAIN_INTEGRATION !== "1")("x402 + EIP-3009 + ERC-5564 lifecycle", () => {
  it("boots a local chain with an EIP-3009 token and the Announcer", () => {
    expect(node, "Hardhat node failed to start — results are NOT verified").not.toBeNull();
    expect(announcer).toMatch(/^0x[0-9a-fA-F]{40}$/);
  });

  it("full lifecycle: derive → 402 → EIP-3009 sign → facilitator settle → announce → scan → derive key → spend", async () => {
    const service = makeService();
    // 1. Receiver creates a stealth meta-address.
    const receiver = generateStealthIdentity(DEFAULT_CHAIN_ID);
    const metaAddress = receiver.publicIdentity.stealthMetaAddress;
    expect(() => parseStealthMetaAddress(metaAddress)).not.toThrow();

    // 5–6. Fresh ephemeral key + unique stealth address per payment.
    const derived = generateOneTimeStealthAddress({ metaAddress, chainId: DEFAULT_CHAIN_ID });
    const other = generateOneTimeStealthAddress({ metaAddress, chainId: DEFAULT_CHAIN_ID });
    expect(derived.ephemeralPublicKey).not.toBe(other.ephemeralPublicKey);
    expect(derived.stealthAddress).not.toBe(other.stealthAddress);

    const amount = parseUnits("12.5", 6);
    const senderBefore = await balanceOf(sender.address);
    expect(await balanceOf(derived.stealthAddress)).toBe(0n);

    // 7–10. Browser x402 client ↔ real backend handlers ↔ real facilitator.
    const stages: string[] = [];
    const result = await payStealthAddressViaX402({
      derived,
      amount,
      asset,
      network: X402_FUJI_NETWORK,
      signer: sender,
      endpoint: RESOURCE,
      fetchImpl: fetchVia(service),
      onStage: (s) => stages.push(s),
    });
    expect(stages).toEqual(["requesting", "signing", "settling"]);
    expect(result.payment.status).toBe("announced");
    expect(result.payment.payer).toBe(sender.address);
    expect(result.settlement?.success).toBe(true);
    expect(result.settlement?.transaction).toBe(result.payment.settlementTx);

    // Settlement verified on-chain: exact amount moved sender → stealth address.
    expect(await balanceOf(derived.stealthAddress)).toBe(amount);
    expect(await balanceOf(sender.address)).toBe(senderBefore - amount);
    const settleReceipt = await node!.publicClient.getTransactionReceipt({ hash: result.payment.settlementTx! });
    const transfers = parseEventLogs({ abi: erc20Abi, eventName: "Transfer", logs: settleReceipt.logs });
    expect(transfers).toHaveLength(1);
    expect(transfers[0].args).toMatchObject({ from: sender.address, to: derived.stealthAddress, value: amount });

    // Announcement published only after settlement, in a later block.
    const anns = await announcementsFor(derived.stealthAddress);
    expect(anns).toHaveLength(1);
    const ann = anns[0];
    expect(ann.transactionHash).toBe(result.payment.announcementTx);
    expect(ann.blockNumber).toBeGreaterThan(settleReceipt.blockNumber);
    expect(ann.args.caller).toBe(relayer.address);
    expect(ann.args.schemeId).toBe(1n);
    expect(ann.args.metadata).toBe(encodeX402AnnouncementMetadata(derived.viewTag, token, amount));

    // 11–12. Receiver scans with the private viewing key and identifies it.
    const parsed = parseAnnouncementMetadata(ann.args.metadata!);
    expect(parsed).toMatchObject({ kind: "erc20", token, amount, viewTag: derived.viewTag });
    const check = checkStealthAnnouncement({
      stealthAddress: ann.args.stealthAddress!,
      ephemeralPublicKey: ann.args.ephemeralPubKey!,
      viewTag: slice(ann.args.metadata!, 0, 1),
      viewingPrivateKey: receiver.secrets.viewingPrivateKey,
      spendingPublicKey: receiver.publicIdentity.spendingPublicKey,
      schemeId: 1,
    });
    expect(check.isForUser).toBe(true);

    // 13. Receiver derives the one-time spending key.
    const { privateKey, stealthAddress } = deriveOneTimeSpendingKey({
      ephemeralPublicKey: ann.args.ephemeralPubKey!,
      viewingPrivateKey: receiver.secrets.viewingPrivateKey,
      spendingPrivateKey: receiver.secrets.spendingPrivateKey,
      expectedStealthAddress: ann.args.stealthAddress!,
      schemeId: SCHEME_ID_SECP256K1,
    });
    expect(stealthAddress).toBe(derived.stealthAddress);

    // 14. Receiver accesses the funds: the derived key signs an EIP-3009
    // transfer out of the stealth address (any account can submit it, so the
    // token-only stealth address needs no gas of its own).
    const stealthAccount = privateKeyToAccount(privateKey.toHex());
    expect(stealthAccount.address).toBe(derived.stealthAddress);
    const thirdParty = privateKeyToAddress(generatePrivateKey());
    const nonce = toHex(crypto.getRandomValues(new Uint8Array(32)));
    const validBefore = BigInt(Math.floor(Date.now() / 1000) + 300);
    const sig = await stealthAccount.signTypedData({
      domain: { name: "USD Coin", version: "2", chainId: 43113, verifyingContract: token },
      types: transferWithAuthorizationTypes,
      primaryType: "TransferWithAuthorization",
      message: { from: stealthAccount.address, to: thirdParty, value: amount, validAfter: 0n, validBefore, nonce },
    });
    const spendHash = await node!.walletClient.writeContract({
      address: token,
      abi: eip3009Artifact.abi,
      functionName: "transferWithAuthorization",
      args: [stealthAccount.address, thirdParty, amount, 0n, validBefore, nonce, sig],
      account: node!.account,
      chain: localChain,
    });
    await node!.publicClient.waitForTransactionReceipt({ hash: spendHash });
    expect(await balanceOf(thirdParty)).toBe(amount);
    expect(await balanceOf(derived.stealthAddress)).toBe(0n);

    privateKey.destroy();
    receiver.secrets.destroy();
  });

  it("duplicate payment attempts: re-submitting, re-requesting and concurrent submits never pay twice", async () => {
    const service = makeService();
    const { derived } = receiverAndPayment();
    const amount = parseUnits("3", 6);
    const before = await balanceOf(sender.address);
    const { header } = await signedPayload(service, derived, amount);

    const [a, b] = await Promise.all([
      post(service, intentBody(derived, amount), header),
      post(service, intentBody(derived, amount), header),
    ]);
    const statuses = [a.status, b.status].sort();
    expect(statuses).toEqual([200, 409]);

    // Replaying the same signed authorization after success.
    const replay = await post(service, intentBody(derived, amount), header);
    expect(replay.status).toBe(409);
    expect(replay.body.error).toBe("already_paid");

    // A fresh authorization for the already-paid stealth address.
    const again = await post(service, intentBody(derived, amount));
    expect(again.status).toBe(409);

    // Same stealth address with different parameters.
    const conflict = await post(service, intentBody(derived, amount + 1n));
    expect(conflict.status).toBe(409);
    expect(conflict.body.error).toBe("intent_conflict");

    expect(await balanceOf(sender.address)).toBe(before - amount);
    expect(await balanceOf(derived.stealthAddress)).toBe(amount);
    expect(await announcementsFor(derived.stealthAddress)).toHaveLength(1);
  });

  it("rejects an invalid signature (signed by someone other than `from`)", async () => {
    const service = makeService();
    const { derived } = receiverAndPayment();
    const impostor = privateKeyToAccount(generatePrivateKey());
    const before = await balanceOf(sender.address);
    const { header } = await signedPayload(service, derived, 1_000_000n, { signer: impostor, from: sender.address });
    const res = await post(service, intentBody(derived, 1_000_000n), header);
    expect(res.status).toBe(402);
    expect(res.body.error).toBe("invalid_signature");
    expect(res.headers.get("PAYMENT-REQUIRED")).toBeTruthy();
    expect(await balanceOf(sender.address)).toBe(before);
    expect((res.body.payment as { status: string }).status).toBe("pending");
  });

  it("rejects insufficient token balance before reaching the facilitator", async () => {
    const service = makeService();
    const { derived } = receiverAndPayment();
    const broke = privateKeyToAccount(generatePrivateKey());
    const { header } = await signedPayload(service, derived, 5_000_000n, { signer: broke });
    const res = await post(service, intentBody(derived, 5_000_000n), header);
    expect(res.status).toBe(402);
    expect(res.body.error).toBe("insufficient_funds");
    expect(await balanceOf(derived.stealthAddress)).toBe(0n);
  });

  it("rejects an unsupported token (non-EIP-3009 stUSD-style ERC-20)", async () => {
    const service = makeService();
    const { derived } = receiverAndPayment();
    const res = await post(service, intentBody(derived, 1n, { asset: plainToken }));
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("UNSUPPORTED_TOKEN");
  });

  it("rejects the wrong network", async () => {
    const service = makeService();
    const { derived } = receiverAndPayment();
    const res = await post(service, intentBody(derived, 1n, { network: "eip155:43114" }));
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("WRONG_NETWORK");
  });

  it("rejects an expired (or nearly expired) authorization", async () => {
    const service = makeService();
    const { derived } = receiverAndPayment();
    const now = BigInt(Math.floor(Date.now() / 1000));
    const { header } = await signedPayload(service, derived, 1_000_000n, { validBefore: now + 5n });
    const res = await post(service, intentBody(derived, 1_000_000n), header);
    expect(res.status).toBe(402);
    expect(res.body.error).toBe("authorization_expired");
  });

  it("rejects an authorization paying a different destination or amount than the stealth requirement", async () => {
    const service = makeService();
    const { derived } = receiverAndPayment();
    const mainWallet = privateKeyToAddress(generatePrivateKey());
    const wrongTo = await signedPayload(service, derived, 1_000_000n, { to: mainWallet });
    const r1 = await post(service, intentBody(derived, 1_000_000n), wrongTo.header);
    expect(r1.status).toBe(402);
    expect(r1.body.error).toBe("invalid_destination");

    const wrongValue = await signedPayload(service, derived, 1_000_000n, { value: 1n });
    const r2 = await post(service, intentBody(derived, 1_000_000n), wrongValue.header);
    expect(r2.status).toBe(402);
    expect(r2.body.error).toBe("invalid_amount");
    expect(await balanceOf(mainWallet)).toBe(0n);
  });

  it("failed settlement (facilitator reports failure) leaves the payment failed and retryable", async () => {
    const failing: Facilitator = {
      verify: (p, r) => realFacilitator.verify(p, r),
      settle: async (_p, r) => ({ success: false, errorReason: "simulated_settlement_failure", transaction: "", network: r.network }),
    };
    const service = makeService({ facilitator: failing });
    const { derived } = receiverAndPayment();
    const before = await balanceOf(sender.address);
    const { header } = await signedPayload(service, derived, 2_000_000n);
    const res = await post(service, intentBody(derived, 2_000_000n), header);
    expect(res.status).toBe(402);
    expect(res.body.error).toBe("simulated_settlement_failure");
    expect((res.body.payment as { status: string }).status).toBe("failed");
    expect(await balanceOf(sender.address)).toBe(before);
    expect(await announcementsFor(derived.stealthAddress)).toHaveLength(0);

    // Announcements are refused for an unsettled payment.
    const ann = await handleRetryAnnouncement(derived.stealthAddress, () => service);
    expect(ann.status).toBe(409);

    // A failed payment can be retried with a fresh authorization.
    const again = await post(service, intentBody(derived, 2_000_000n));
    expect(again.status).toBe(402);
    expect((again.body.payment as { status: string }).status).toBe("pending");
  });

  it("facilitator broadcasts but its response is lost: settlement is recovered from the chain", async () => {
    const lossy: Facilitator = {
      verify: (p, r) => realFacilitator.verify(p, r),
      settle: async (p, r) => {
        const real = await realFacilitator.settle(p, r);
        expect(real.success, JSON.stringify(real)).toBe(true); // it DID settle
        throw new Error("socket hang up");
      },
    };
    const service = makeService({ facilitator: lossy });
    const { derived } = receiverAndPayment();
    const { header } = await signedPayload(service, derived, 4_000_000n);
    const res = await post(service, intentBody(derived, 4_000_000n), header);
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    const payment = res.body.payment as { status: string; settlementTx: Hex };
    expect(payment.status).toBe("announced");
    expect(payment.settlementTx).toMatch(/^0x[0-9a-f]{64}$/);
    expect(await balanceOf(derived.stealthAddress)).toBe(4_000_000n);
  });

  it("failed announcement publication is retried idempotently (one announcement, settlement untouched)", async () => {
    const unfunded = privateKeyToAccount(generatePrivateKey());
    const store = new MemoryPaymentStore();
    const service = makeService({ relayer: unfunded, store });
    const { derived } = receiverAndPayment();
    const { header } = await signedPayload(service, derived, 6_000_000n);

    const res = await post(service, intentBody(derived, 6_000_000n), header);
    expect(res.status).toBe(200); // payment DID settle
    const p = res.body.payment as { status: string; announcementRetryable: boolean; lastError: string };
    expect(p.status).toBe("settled");
    expect(p.announcementRetryable).toBe(true);
    expect(p.lastError).toMatch(/Announcement not confirmed/);
    // Actionable: names the relayer and the shortfall instead of a generic RPC error.
    expect(p.lastError).toContain(unfunded.address);
    expect(p.lastError).toMatch(/has 0 AVAX but needs at least/);
    expect(await balanceOf(derived.stealthAddress)).toBe(6_000_000n);
    expect(await announcementsFor(derived.stealthAddress)).toHaveLength(0);

    // Fund the relayer, then retry via the API.
    const fund = await node!.walletClient.sendTransaction({
      to: unfunded.address,
      value: 10n ** 18n,
      account: node!.account,
      chain: localChain,
    });
    await node!.publicClient.waitForTransactionReceipt({ hash: fund });

    const retry = await handleRetryAnnouncement(derived.stealthAddress, () => service);
    expect(retry.status).toBe(200);
    const retried = ((await retry.json()) as { payment: { status: string; announcementTx: Hex } }).payment;
    expect(retried.status).toBe("announced");

    const retry2 = await handleRetryAnnouncement(derived.stealthAddress, () => service);
    const retried2 = ((await retry2.json()) as { payment: { announcementTx: Hex } }).payment;
    expect(retried2.announcementTx).toBe(retried.announcementTx);
    expect(await announcementsFor(derived.stealthAddress)).toHaveLength(1);
    expect(await balanceOf(derived.stealthAddress)).toBe(6_000_000n);
  });

  it("crash after signing but before broadcasting the announcement: retry rebroadcasts the SAME tx", async () => {
    const inner = new MemoryPaymentStore();
    let crashed = false;
    const crashingStore = {
      get: (id: Address) => inner.get(id),
      put: async (r: X402PaymentRecord) => {
        await inner.put(r);
        if (!crashed && r.announcement && !r.announcement.blockNumber && r.status === "settled") {
          crashed = true;
          throw new Error("simulated crash before broadcast");
        }
      },
    };
    const service = makeService({ store: crashingStore as unknown as MemoryPaymentStore });
    const { derived } = receiverAndPayment();
    const { header } = await signedPayload(service, derived, 7_000_000n);
    const res = await post(service, intentBody(derived, 7_000_000n), header);
    expect(res.status).toBe(200);
    expect((res.body.payment as { status: string }).status).toBe("settled");
    const pendingHash = (await inner.get(derived.stealthAddress))!.announcement!.txHash;
    expect(await announcementsFor(derived.stealthAddress)).toHaveLength(0);

    const retry = await handleRetryAnnouncement(derived.stealthAddress, () => service);
    const view = ((await retry.json()) as { payment: { status: string; announcementTx: Hex } }).payment;
    expect(view.status).toBe("announced");
    expect(view.announcementTx).toBe(pendingHash);
    expect(await announcementsFor(derived.stealthAddress)).toHaveLength(1);
  });

  /**
   * The app's scanner + view-model, pointed at THIS local node. Imported
   * lazily so the RPC override is in place before config modules load.
   */
  async function appScanner() {
    process.env.NEXT_PUBLIC_FUJI_RPC_URL = RPC_URL;
    const scanner = await import("@/lib/scanner/announcement-scanner");
    const vm = await import("@/lib/payments/view-model");
    return { ...scanner, ...vm };
  }

  async function scanFor(
    receiver: ReturnType<typeof generateStealthIdentity>,
    stealthAddress: Address,
    router?: Address,
  ) {
    const { scanAnnouncements } = await appScanner();
    const result = await scanAnnouncements({
      network: "fuji",
      announcer,
      fromBlock: 0n,
      router,
      match: (input) =>
        checkStealthAnnouncement({
          ...input,
          viewingPrivateKey: receiver.secrets.viewingPrivateKey,
          spendingPublicKey: receiver.publicIdentity.spendingPublicKey,
        }),
    });
    return result.payments.find((p) => p.stealthAddress === stealthAddress) ?? null;
  }

  it("Activity history: x402 announced >99 blocks after settlement, withdrawn, is STILL detected and linked", async () => {
    // Reproduces the Fuji case: announcement retried long after settlement.
    const unfunded = privateKeyToAccount(generatePrivateKey());
    const service = makeService({ relayer: unfunded });
    const { receiver, derived } = receiverAndPayment();
    const amount = 1_000n; // 0.001 USDC
    const { header } = await signedPayload(service, derived, amount);
    const paid = await post(service, intentBody(derived, amount), header);
    const settlementTx = (paid.body.payment as { settlementTx: Hex }).settlementTx;
    expect((paid.body.payment as { status: string }).status).toBe("settled");

    await node!.publicClient.request({ method: "hardhat_mine" as never, params: ["0x96"] as never }); // +150 blocks
    const fund = await node!.walletClient.sendTransaction({ to: unfunded.address, value: 10n ** 18n, account: node!.account, chain: localChain });
    await node!.publicClient.waitForTransactionReceipt({ hash: fund });
    const retried = await handleRetryAnnouncement(derived.stealthAddress, () => service);
    expect(((await retried.json()) as { payment: { status: string } }).payment.status).toBe("announced");
    const [ann] = await announcementsFor(derived.stealthAddress);
    const settleBlock = (await node!.publicClient.getTransactionReceipt({ hash: settlementTx })).blockNumber;
    expect(ann.blockNumber - settleBlock).toBeGreaterThan(99n);

    // Detected while funded.
    const before = await scanFor(receiver, derived.stealthAddress);
    expect(before).toMatchObject({ verifiedBalance: amount, x402SettlementTx: settlementTx, payerAddress: sender.address });

    // Receiver withdraws everything.
    const { privateKey } = deriveOneTimeSpendingKey({
      ephemeralPublicKey: derived.ephemeralPublicKey,
      viewingPrivateKey: receiver.secrets.viewingPrivateKey,
      spendingPrivateKey: receiver.secrets.spendingPrivateKey,
      expectedStealthAddress: derived.stealthAddress,
      schemeId: SCHEME_ID_SECP256K1,
    });
    const wallet = privateKeyToAddress(generatePrivateKey());
    const w = await withdrawStealthTokenViaX402({
      stealthSigner: privateKeyToAccount(privateKey.toHex()),
      to: wallet,
      amount,
      asset,
      network: X402_FUJI_NETWORK,
      endpoint: "http://localhost/api/x402/withdrawals",
      fetchImpl: fetchVia(service),
    });
    privateKey.destroy();
    expect(await balanceOf(derived.stealthAddress)).toBe(0n);

    // Still detected after forwarding — proven by the settlement Transfer, not the balance.
    const after = await scanFor(receiver, derived.stealthAddress);
    expect(after).toMatchObject({
      verifiedBalance: 0n,
      announcedAmount: amount,
      x402SettlementTx: settlementTx,
      x402SettlementBlock: settleBlock,
      payerAddress: sender.address,
    });

    // Activity: incoming row kept, forward kept as a separate linked event.
    const { toPaymentRow, activityRowFromPayment, activityRowFromLocalEntry, linkActivityRows } = await appScanner();
    const rows = linkActivityRows([
      activityRowFromPayment(toPaymentRow(after!)),
      activityRowFromLocalEntry({
        id: w.txHash, kind: "forward", network: "fuji", from: derived.stealthAddress, to: wallet,
        assetSymbol: "USDC", assetDecimals: 6, isNative: false, tokenContract: token, amount: "0.001",
        txHash: w.txHash, blockNumber: "1", timestamp: new Date().toISOString(),
        x402: { status: "settled", paymentId: derived.stealthAddress, announcementTx: null },
      }),
    ]);
    expect(rows.map((r) => r.direction)).toEqual(["incoming", "forwarded"]);
    expect(rows[0]).toMatchObject({ transactionHash: settlementTx, linkedTxHash: w.txHash, spendable: false });
    expect(rows[1]).toMatchObject({ transactionHash: w.txHash, linkedTxHash: settlementTx });
    receiver.secrets.destroy();
  });

  it("Activity history: a router AVAX payment forwarded to empty stays listed (only via the configured router)", async () => {
    const routerArtifact = loadArtifact("StealthPaymentRouter.sol", "StealthPaymentRouter");
    const router = await deploy(node!, routerArtifact, [announcer]);
    const { receiver, derived } = receiverAndPayment();
    const amount = 10n ** 17n;
    const payHash = await node!.walletClient.writeContract({
      address: router, abi: routerArtifact.abi, functionName: "payNative",
      args: [derived.stealthAddress, derived.ephemeralPublicKey, derived.viewTag],
      value: amount, account: node!.account, chain: localChain,
    });
    await node!.publicClient.waitForTransactionReceipt({ hash: payHash });

    // Forward the full balance with the one-time key (legacy tx: exact fee, leaves 0).
    const { privateKey } = deriveOneTimeSpendingKey({
      ephemeralPublicKey: derived.ephemeralPublicKey,
      viewingPrivateKey: receiver.secrets.viewingPrivateKey,
      spendingPrivateKey: receiver.secrets.spendingPrivateKey,
      expectedStealthAddress: derived.stealthAddress,
      schemeId: SCHEME_ID_SECP256K1,
    });
    const oneTime = createWalletClient({ account: privateKeyToAccount(privateKey.toHex()), chain: localChain, transport: http(RPC_URL) });
    privateKey.destroy();
    const gasPrice = (await node!.publicClient.getGasPrice()) * 2n;
    const fwd = await oneTime.sendTransaction({
      to: privateKeyToAddress(generatePrivateKey()), value: amount - gasPrice * 21_000n, gas: 21_000n, gasPrice, type: "legacy",
    });
    await node!.publicClient.waitForTransactionReceipt({ hash: fwd });
    expect(await node!.publicClient.getBalance({ address: derived.stealthAddress })).toBe(0n);

    // Without the configured router: the old balance-only rule hides it (spam protection unchanged).
    expect(await scanFor(receiver, derived.stealthAddress)).toBeNull();
    // With it: still listed, as a forwarded native payment.
    const kept = await scanFor(receiver, derived.stealthAddress, router);
    expect(kept).toMatchObject({ assetKind: "native", verifiedBalance: 0n, announcedAmount: amount, transactionHash: payHash });
    const { toPaymentRow } = await appScanner();
    expect(toPaymentRow(kept!)).toMatchObject({ forwarded: true, spendable: false });
    receiver.secrets.destroy();
  });

  it("stored announcement whose fee cap fell below the base fee is re-signed at the SAME nonce (one announcement)", async () => {
    const inner = new MemoryPaymentStore();
    let crashed = false;
    const crashingStore = {
      get: (id: Address) => inner.get(id),
      put: async (r: X402PaymentRecord) => {
        await inner.put(r);
        if (!crashed && r.announcement && !r.announcement.blockNumber && r.status === "settled") {
          crashed = true;
          throw new Error("simulated crash before broadcast");
        }
      },
    };
    const service = makeService({ store: crashingStore as unknown as MemoryPaymentStore });
    const { derived } = receiverAndPayment();
    const { header } = await signedPayload(service, derived, 7_500_000n);
    expect((await post(service, intentBody(derived, 7_500_000n), header)).status).toBe(200);
    const stale = (await inner.get(derived.stealthAddress))!.announcement!;

    // Base fee jumps far above the stored tx's cap: those bytes can never be mined.
    await node!.publicClient.request({ method: "hardhat_setNextBlockBaseFeePerGas" as never, params: ["0xe8d4a51000"] as never }); // 1000 gwei
    await node!.publicClient.request({ method: "evm_mine" as never, params: [] as never });

    const retry = await handleRetryAnnouncement(derived.stealthAddress, () => service);
    const view = ((await retry.json()) as { payment: { status: string; announcementTx: Hex; lastError: string | null } }).payment;
    expect(view.status, view.lastError ?? "").toBe("announced");
    expect(view.announcementTx).not.toBe(stale.txHash); // replacement signature
    const replacement = await node!.publicClient.getTransaction({ hash: view.announcementTx });
    expect(replacement.nonce).toBe(stale.nonce); // same nonce → cannot duplicate
    expect(await announcementsFor(derived.stealthAddress)).toHaveLength(1);
  });

  it("incorrect receiver meta-address: malformed is rejected; another receiver's keys do not detect it", async () => {
    const alice = generateStealthIdentity(DEFAULT_CHAIN_ID);
    const bob = generateStealthIdentity(DEFAULT_CHAIN_ID);
    const meta = alice.publicIdentity.stealthMetaAddress;
    expect(() => parseStealthMetaAddress(meta.slice(0, -2))).toThrow();
    expect(() => parseStealthMetaAddress(meta.replace("st:avax:", "st:eth:"))).toThrow();

    const service = makeService();
    const derived = generateOneTimeStealthAddress({ metaAddress: meta, chainId: DEFAULT_CHAIN_ID });
    const result = await payStealthAddressViaX402({
      derived,
      amount: 1_500_000n,
      asset,
      network: X402_FUJI_NETWORK,
      signer: sender,
      endpoint: RESOURCE,
      fetchImpl: fetchVia(service),
    });
    expect(result.payment.status).toBe("announced");
    const [ann] = await announcementsFor(derived.stealthAddress);
    const bobCheck = checkStealthAnnouncement({
      stealthAddress: ann.args.stealthAddress!,
      ephemeralPublicKey: ann.args.ephemeralPubKey!,
      viewTag: slice(ann.args.metadata!, 0, 1),
      viewingPrivateKey: bob.secrets.viewingPrivateKey,
      spendingPublicKey: bob.publicIdentity.spendingPublicKey,
      schemeId: 1,
    });
    expect(bobCheck.isForUser).toBe(false);
    expect(() =>
      deriveOneTimeSpendingKey({
        ephemeralPublicKey: ann.args.ephemeralPubKey!,
        viewingPrivateKey: bob.secrets.viewingPrivateKey,
        spendingPrivateKey: bob.secrets.spendingPrivateKey,
        expectedStealthAddress: ann.args.stealthAddress!,
        schemeId: SCHEME_ID_SECP256K1,
      }),
    ).toThrow();
    alice.secrets.destroy();
    bob.secrets.destroy();
  });

  it("client refuses to sign when the server's requirement does not pay the derived stealth address", async () => {
    const service = makeService();
    const { derived } = receiverAndPayment();
    const attacker = privateKeyToAddress(generatePrivateKey());
    const tampering: typeof fetch = async (input, init) => {
      const res = await fetchVia(service)(input, init);
      if (res.status !== 402) return res;
      const header = res.headers.get("PAYMENT-REQUIRED")!;
      const decoded = JSON.parse(atob(header));
      decoded.accepts[0].payTo = attacker;
      return new Response(null, { status: 402, headers: { "PAYMENT-REQUIRED": btoa(JSON.stringify(decoded)) } });
    };
    let signed = false;
    const spySigner = {
      address: sender.address,
      signTypedData: async (args: Parameters<typeof sender.signTypedData>[0]) => {
        signed = true;
        return sender.signTypedData(args);
      },
    };
    await expect(
      payStealthAddressViaX402({
        derived,
        amount: 1_000_000n,
        asset,
        network: X402_FUJI_NETWORK,
        signer: spySigner as never,
        endpoint: RESOURCE,
        fetchImpl: tampering,
      }),
    ).rejects.toBeInstanceOf(X402ClientError);
    expect(signed).toBe(false);
  });

  it("receiver withdraws USDC gaslessly via the relay; unpaid addresses and replays are refused", async () => {
    const service = makeService();
    const { receiver, derived } = receiverAndPayment();
    const amount = 9_000_000n;
    const paid = await payStealthAddressViaX402({
      derived,
      amount,
      asset,
      network: X402_FUJI_NETWORK,
      signer: sender,
      endpoint: RESOURCE,
      fetchImpl: fetchVia(service),
    });
    expect(paid.payment.status).toBe("announced");

    const { privateKey } = deriveOneTimeSpendingKey({
      ephemeralPublicKey: derived.ephemeralPublicKey,
      viewingPrivateKey: receiver.secrets.viewingPrivateKey,
      spendingPrivateKey: receiver.secrets.spendingPrivateKey,
      expectedStealthAddress: derived.stealthAddress,
      schemeId: SCHEME_ID_SECP256K1,
    });
    const stealthAccount = privateKeyToAccount(privateKey.toHex());
    // The stealth address holds USDC but no native gas at all.
    expect(await node!.publicClient.getBalance({ address: stealthAccount.address })).toBe(0n);

    const destination = privateKeyToAddress(generatePrivateKey());
    const w = await withdrawStealthTokenViaX402({
      stealthSigner: stealthAccount,
      to: destination,
      amount,
      asset,
      network: X402_FUJI_NETWORK,
      endpoint: "http://localhost/api/x402/withdrawals",
      fetchImpl: fetchVia(service),
    });
    const receipt = await node!.publicClient.getTransactionReceipt({ hash: w.txHash });
    expect(receipt.status).toBe("success");
    expect(await balanceOf(destination)).toBe(amount);
    expect(await balanceOf(stealthAccount.address)).toBe(0n);

    // Nothing left: a second withdrawal is refused before reaching the facilitator.
    await expect(
      withdrawStealthTokenViaX402({
        stealthSigner: stealthAccount,
        to: destination,
        amount,
        asset,
        network: X402_FUJI_NETWORK,
        endpoint: "http://localhost/api/x402/withdrawals",
        fetchImpl: fetchVia(service),
      }),
    ).rejects.toMatchObject({ code: "insufficient_funds" });

    // An address this service never paid cannot use the relay.
    const stranger = privateKeyToAccount(generatePrivateKey());
    await mint(stranger.address, 1_000_000n);
    await expect(
      withdrawStealthTokenViaX402({
        stealthSigner: stranger,
        to: destination,
        amount: 1_000_000n,
        asset,
        network: X402_FUJI_NETWORK,
        endpoint: "http://localhost/api/x402/withdrawals",
        fetchImpl: fetchVia(service),
      }),
    ).rejects.toMatchObject({ code: "unknown_stealth_address" });

    privateKey.destroy();
    receiver.secrets.destroy();
  });

  // Runs LAST: advances chain time.
  it("facilitator outage with unknown outcome blocks a second authorization until the first expires unused", async () => {
    const down: Facilitator = {
      verify: (p, r) => realFacilitator.verify(p, r),
      settle: async () => {
        throw new Error("facilitator timeout");
      },
    };
    const service = makeService({ facilitator: down });
    const { derived } = receiverAndPayment();
    const before = await balanceOf(sender.address);
    const { header } = await signedPayload(service, derived, 8_000_000n);
    const res = await post(service, intentBody(derived, 8_000_000n), header);
    expect(res.status).toBe(502);
    expect(res.body.error).toBe("settlement_outcome_unknown");

    // While the first authorization could still land, nothing new is accepted.
    const second = await post(service, intentBody(derived, 8_000_000n));
    expect(second.status).toBe(409);
    expect(second.body.error).toBe("payment_in_progress");
    const resubmit = await post(service, intentBody(derived, 8_000_000n), header);
    expect(resubmit.status).toBe(409);
    const status = await handleGetPayment(derived.stealthAddress, () => service);
    expect(((await status.json()) as { payment: { status: string } }).payment.status).toBe("authorized");

    // Chain time passes validBefore; the authorization can no longer settle.
    await node!.publicClient.request({ method: "evm_increaseTime" as never, params: [400] as never });
    await node!.publicClient.request({ method: "evm_mine" as never, params: [] as never });
    const after = await handleGetPayment(derived.stealthAddress, () => service);
    expect(((await after.json()) as { payment: { status: string } }).payment.status).toBe("failed");
    expect(await balanceOf(sender.address)).toBe(before);

    const reissue = await post(service, intentBody(derived, 8_000_000n));
    expect(reissue.status).toBe(402);
  });
});
