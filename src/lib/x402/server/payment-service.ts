import {
  BaseError,
  getAddress,
  isAddress,
  zeroAddress,
  type Address,
  type Hex,
  type LocalAccount,
  type PublicClient,
} from "viem";
import {
  SettleError,
  VerifyError,
  type PaymentPayload,
  type PaymentRequired,
  type PaymentRequirements,
  type SettleResponse,
  type VerifyResponse,
} from "@x402/core/types";
import {
  X402_ASSET_TRANSFER_METHOD,
  X402_MAX_TIMEOUT_SECONDS,
  X402_SCHEME,
  X402_VERSION,
  type X402AssetConfig,
  type X402PaymentStatus,
} from "../config";
import { parseStealthPaymentIntent, type StealthPaymentIntent } from "../intent";
import { announceSettledPayment } from "./announcement-relayer";
import {
  PaymentRejectedError,
  assertEip3009Token,
  confirmSettlementReceipt,
  eip3009Abi,
  findAuthorizationUsedTx,
  validateEip3009Payment,
} from "./eip3009";
import { KeyedMutex, type PaymentStore, type X402PaymentRecord } from "./store";

/** The two facilitator operations this service uses (HTTPFacilitatorClient satisfies it). */
export interface Facilitator {
  verify(payload: PaymentPayload, requirements: PaymentRequirements): Promise<VerifyResponse>;
  settle(payload: PaymentPayload, requirements: PaymentRequirements): Promise<SettleResponse>;
}

export interface X402ServiceDeps {
  client: PublicClient;
  facilitator: Facilitator;
  relayer: LocalAccount;
  announcer: Address;
  asset: X402AssetConfig;
  network: string;
  chainId: number;
  store: PaymentStore;
  /** Absolute URL of the protected resource, echoed in PaymentRequired. */
  resourceUrl: string;
  receiptTimeoutMs?: number;
  now?: () => number;
}

/** What API responses expose. Public data only. */
export interface X402PaymentView {
  id: Address;
  status: X402PaymentStatus;
  network: string;
  asset: Address;
  amount: string;
  stealthAddress: Address;
  ephemeralPublicKey: Hex;
  viewTag: Hex;
  payer: Address | null;
  settlementTx: Hex | null;
  settlementBlock: string | null;
  announcementTx: Hex | null;
  /** True when settled but the announcement still needs to be (re)published. */
  announcementRetryable: boolean;
  lastError: string | null;
  updatedAt: string;
}

export function toPaymentView(r: X402PaymentRecord): X402PaymentView {
  return {
    id: r.id,
    status: r.status,
    network: r.network,
    asset: r.asset,
    amount: r.amount,
    stealthAddress: r.stealthAddress,
    ephemeralPublicKey: r.ephemeralPublicKey,
    viewTag: r.viewTag,
    payer: r.authorization?.payer ?? null,
    settlementTx: r.settlement?.txHash ?? null,
    settlementBlock: r.settlement?.blockNumber ?? null,
    announcementTx: r.status === "announced" ? (r.announcement?.txHash ?? null) : null,
    announcementRetryable: r.status === "settled",
    lastError: r.lastError ?? null,
    updatedAt: r.updatedAt,
  };
}

/** Startup checks failed: wrong chain, non-EIP-3009 token, missing Announcer, RPC down. */
export class X402NotReadyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "X402NotReadyError";
  }
}

/** Facilitator unreachable before anything was authorized. Safe to retry. */
export class FacilitatorUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FacilitatorUnavailableError";
  }
}

/** Facilitator unreachable / timed out: the outcome is unknown, not failed. */
export class SettlementOutcomeUnknownError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SettlementOutcomeUnknownError";
  }
}

function sameIntent(r: X402PaymentRecord, i: StealthPaymentIntent): boolean {
  return (
    r.asset === i.asset &&
    r.amount === i.amount &&
    r.network === i.network &&
    r.ephemeralPublicKey.toLowerCase() === i.ephemeralPublicKey.toLowerCase() &&
    r.viewTag.toLowerCase() === i.viewTag.toLowerCase() &&
    r.schemeId === i.schemeId
  );
}

function safeMessage(err: unknown): string {
  // viem labels every JSON-RPC -32000 "Missing or invalid parameters" and puts
  // the node's actual reason (e.g. "insufficient funds for gas …") in
  // `details`, AFTER the request body in `message` — so report it directly.
  const msg =
    err instanceof BaseError
      ? err.details
        ? `${err.details} (${err.shortMessage.split("\n")[0]})`
        : err.shortMessage
      : err instanceof Error
        ? err.message
        : String(err);
  // Bound length; facilitator/RPC errors carry no secrets but can be huge.
  return msg.slice(0, 500);
}

/**
 * x402 resource server for StealthPay: charges a sender for a payment to a
 * one-time ERC-5564 stealth address, settles through an x402 facilitator
 * using EIP-3009, confirms settlement on-chain, then announces.
 *
 * State machine per stealth address:
 *   pending ──verify──▶ authorized ──settle+receipt──▶ settled ──announce──▶ announced
 *      ▲                    │ (explicit failure, or expiry unused)
 *      └──── failed ◀───────┘
 */
export class X402StealthPaymentService {
  private readonly paymentLocks = new KeyedMutex();
  /** One relayer account → one nonce sequence → announcements are serialised. */
  private readonly relayerLock = new KeyedMutex();
  private ready: Promise<void> | null = null;

  constructor(private readonly deps: X402ServiceDeps) {}

  private nowSeconds(): bigint {
    return BigInt(Math.floor((this.deps.now?.() ?? Date.now()) / 1000));
  }

  /** Verifies chain id and the token's EIP-3009 support once per process. */
  ensureReady(): Promise<void> {
    if (!this.ready) {
      this.ready = (async () => {
        const chainId = await this.deps.client.getChainId();
        if (chainId !== this.deps.chainId) {
          throw new Error(`RPC is on chain ${chainId}, expected ${this.deps.chainId}.`);
        }
        await assertEip3009Token(this.deps.client, this.deps.asset);
        const code = await this.deps.client.getCode({ address: this.deps.announcer });
        if (!code || code === "0x") throw new Error("Configured ERC-5564 Announcer has no code.");
      })().catch((err) => {
        this.ready = null;
        throw new X402NotReadyError(safeMessage(err));
      });
    }
    return this.ready;
  }

  buildRequirements(intent: StealthPaymentIntent): PaymentRequirements {
    return {
      scheme: X402_SCHEME,
      network: this.deps.network as PaymentRequirements["network"],
      asset: this.deps.asset.address,
      amount: intent.amount,
      // The one-time stealth address — never the receiver's main wallet.
      payTo: intent.stealthAddress,
      maxTimeoutSeconds: X402_MAX_TIMEOUT_SECONDS,
      extra: {
        name: this.deps.asset.eip712.name,
        version: this.deps.asset.eip712.version,
        assetTransferMethod: X402_ASSET_TRANSFER_METHOD,
      },
    };
  }

  buildPaymentRequired(
    record: X402PaymentRecord,
    opts: { error?: string; resourceUrl?: string } = {},
  ): PaymentRequired {
    const { error, resourceUrl } = opts;
    return {
      x402Version: X402_VERSION,
      ...(error ? { error } : {}),
      resource: {
        url: resourceUrl ?? this.deps.resourceUrl,
        description: "StealthPay payment to a one-time ERC-5564 stealth address",
        mimeType: "application/json",
      },
      accepts: [record.requirements],
    };
  }

  /** Step 1: issue (or re-issue, idempotently) the x402 requirement. */
  async requestPayment(
    rawIntent: unknown,
    resourceUrl?: string,
  ): Promise<{ record: X402PaymentRecord; paymentRequired: PaymentRequired }> {
    await this.ensureReady();
    const intent = parseStealthPaymentIntent(rawIntent, {
      network: this.deps.network,
      asset: this.deps.asset.address,
    });

    return this.paymentLocks.run(intent.stealthAddress, async () => {
      let record = await this.deps.store.get(intent.stealthAddress);
      if (record) {
        if (!sameIntent(record, intent)) {
          throw new PaymentRejectedError(
            "intent_conflict",
            "A different payment already exists for this stealth address. Derive a fresh one-time address.",
            409,
          );
        }
        record = await this.reconcile(record);
        if (record.status === "settled" || record.status === "announced") {
          throw new PaymentRejectedError(
            "already_paid",
            "This stealth address has already been paid. Derive a fresh one-time address for a new payment.",
            409,
          );
        }
        if (record.status === "authorized") {
          throw new PaymentRejectedError(
            "payment_in_progress",
            "An authorization for this payment is still pending settlement.",
            409,
          );
        }
        if (record.status === "failed") {
          record = { ...record, status: "pending", updatedAt: new Date().toISOString() };
          await this.deps.store.put(record);
        }
        return { record, paymentRequired: this.buildPaymentRequired(record, { resourceUrl }) };
      }

      const now = new Date().toISOString();
      record = {
        id: intent.stealthAddress,
        status: "pending",
        network: intent.network,
        chainId: this.deps.chainId,
        asset: intent.asset,
        amount: intent.amount,
        stealthAddress: intent.stealthAddress,
        ephemeralPublicKey: intent.ephemeralPublicKey,
        viewTag: intent.viewTag,
        schemeId: intent.schemeId,
        requirements: this.buildRequirements(intent),
        createdAtBlock: (await this.deps.client.getBlockNumber({ cacheTime: 0 })).toString(),
        createdAt: now,
        updatedAt: now,
      };
      await this.deps.store.put(record);
      return { record, paymentRequired: this.buildPaymentRequired(record, { resourceUrl }) };
    });
  }

  /**
   * Step 2: accept a signed EIP-3009 authorization, verify, settle, confirm
   * on-chain, then announce. Announcement failure never undoes a settlement;
   * the payment stays `settled` and the announcement can be retried.
   */
  async submitPayment(
    id: Address,
    payload: PaymentPayload,
  ): Promise<{ record: X402PaymentRecord; settleResponse: SettleResponse }> {
    await this.ensureReady();
    const paymentId = getAddress(id);

    const settled = await this.paymentLocks.run(paymentId, async () => {
      let record = await this.deps.store.get(paymentId);
      if (!record) throw new PaymentRejectedError("unknown_payment", "No payment requirement was issued for this address.", 404);

      record = await this.reconcile(record);
      if (record.status === "settled" || record.status === "announced") {
        throw new PaymentRejectedError("already_paid", "This payment has already been settled.", 409);
      }
      if (record.status === "authorized") {
        throw new PaymentRejectedError(
          "payment_in_progress",
          "A previous authorization may still settle; wait until it expires or completes.",
          409,
        );
      }

      // ---- Local verification (never trust the client) ----
      const { authorization } = await validateEip3009Payment({
        client: this.deps.client,
        payload,
        issued: record.requirements,
        chainId: this.deps.chainId,
        nowSeconds: this.nowSeconds(),
      });

      // ---- Facilitator verification ----
      let verify: VerifyResponse;
      try {
        verify = await this.deps.facilitator.verify(payload, record.requirements);
      } catch (err) {
        // A non-2xx answer carrying a verdict is a rejection, not an outage.
        if (err instanceof VerifyError) {
          verify = { isValid: false, invalidReason: err.invalidReason, invalidMessage: err.invalidMessage };
        } else {
          // Nothing was authorized yet, so the payment simply stays pending.
          throw new FacilitatorUnavailableError(`Facilitator verify failed: ${safeMessage(err)}`);
        }
      }
      if (!verify.isValid) {
        throw new PaymentRejectedError(
          verify.invalidReason ?? "facilitator_rejected",
          verify.invalidMessage ?? "The facilitator rejected the payment.",
        );
      }

      record = {
        ...record,
        status: "authorized",
        authorization: {
          payer: authorization.from,
          nonce: authorization.nonce,
          validBefore: authorization.validBefore.toString(),
        },
        lastError: undefined,
        updatedAt: new Date().toISOString(),
      };
      await this.deps.store.put(record);

      // ---- Settlement ----
      let settle: SettleResponse | null = null;
      let settleError: string | null = null;
      try {
        settle = await this.deps.facilitator.settle(payload, record.requirements);
      } catch (err) {
        if (err instanceof SettleError) {
          // An explicit failure verdict; the chain is still checked below
          // before the payment is marked failed.
          settle = {
            success: false,
            errorReason: err.errorReason,
            errorMessage: err.errorMessage,
            transaction: "",
            network: record.requirements.network,
          };
        } else {
          settleError = safeMessage(err);
        }
      }

      // A success flag is a claim. The receipt is the proof.
      let settlementTx: { txHash: Hex; blockNumber: bigint } | null = null;
      if (settle?.success && settle.transaction) {
        settlementTx = await this.confirmTx(record, settle.transaction as Hex);
      }
      if (!settlementTx) {
        // The facilitator may have broadcast despite an error; check the chain.
        settlementTx = await this.findSettlementOnChain(record);
      }

      if (!settlementTx) {
        if (settle && !settle.success) {
          // Definitive failure reported by the facilitator, and the chain
          // agrees the authorization is unused.
          record = {
            ...record,
            status: "failed",
            lastError: `Settlement failed: ${settle.errorReason ?? "unknown"}${settle.errorMessage ? ` (${settle.errorMessage})` : ""}`,
            updatedAt: new Date().toISOString(),
          };
          await this.deps.store.put(record);
          throw new PaymentRejectedError(settle.errorReason ?? "settlement_failed", record.lastError!);
        }
        // Unknown outcome: keep `authorized` so no second authorization is
        // accepted while this one could still land. Reconcile resolves it.
        record = {
          ...record,
          lastError: `Settlement outcome unknown: ${settleError ?? "transaction not confirmed"}`,
          updatedAt: new Date().toISOString(),
        };
        await this.deps.store.put(record);
        throw new SettlementOutcomeUnknownError(record.lastError!);
      }

      record = {
        ...record,
        status: "settled",
        settlement: {
          txHash: settlementTx.txHash,
          blockNumber: settlementTx.blockNumber.toString(),
        },
        lastError: undefined,
        updatedAt: new Date().toISOString(),
      };
      await this.deps.store.put(record);

      const settleResponse: SettleResponse = {
        success: true,
        transaction: settlementTx.txHash,
        network: record.requirements.network,
        payer: authorization.from,
        amount: record.amount,
      };
      return { record, settleResponse };
    });

    // ---- Announcement: only after confirmed settlement ----
    const record = await this.announce(paymentId);
    return { record, settleResponse: settled.settleResponse };
  }

  /** Publishes (or re-publishes) the announcement of a settled payment. */
  async announce(id: Address): Promise<X402PaymentRecord> {
    await this.ensureReady();
    const paymentId = getAddress(id);
    return this.paymentLocks.run(paymentId, async () => {
      let record = await this.deps.store.get(paymentId);
      if (!record) throw new PaymentRejectedError("unknown_payment", "Unknown payment.", 404);
      record = await this.reconcile(record);
      if (record.status === "announced") return record;
      if (record.status !== "settled") {
        throw new PaymentRejectedError(
          "not_settled",
          "Announcements are only published after confirmed settlement.",
          409,
        );
      }
      const settledRecord = record;
      try {
        return await this.relayerLock.run("relayer", () =>
          announceSettledPayment(
            {
              client: this.deps.client,
              relayer: this.deps.relayer,
              announcer: this.deps.announcer,
              chainId: this.deps.chainId,
              persist: (r) => this.deps.store.put(r),
              receiptTimeoutMs: this.deps.receiptTimeoutMs,
            },
            settledRecord,
          ),
        );
      } catch (err) {
        // Re-read: the relayer may have persisted a signed tx before failing.
        const latest = (await this.deps.store.get(paymentId)) ?? settledRecord;
        const failed: X402PaymentRecord = {
          ...latest,
          status: "settled",
          lastError: `Announcement not confirmed: ${safeMessage(err)}`,
          updatedAt: new Date().toISOString(),
        };
        await this.deps.store.put(failed);
        return failed;
      }
    });
  }

  async getPayment(id: Address): Promise<X402PaymentRecord | null> {
    const paymentId = getAddress(id);
    return this.paymentLocks.run(paymentId, async () => {
      const record = await this.deps.store.get(paymentId);
      return record ? this.reconcile(record) : null;
    });
  }

  /**
   * Relays a receiver's withdrawal out of a stealth address this service paid.
   *
   * The receiver's browser derives the one-time key, signs an EIP-3009
   * authorization from the stealth address to `payTo`, and sends ONLY that
   * signed authorization. The facilitator submits it, so the token-only
   * stealth address needs no gas and the receiver's main wallet never touches
   * it. Restricted to stealth addresses with a settled x402 payment here, so
   * the relay cannot be used as a general-purpose gas faucet.
   */
  async relayWithdrawal(
    payload: PaymentPayload,
  ): Promise<{ record: X402PaymentRecord; txHash: Hex; to: Address; amount: string }> {
    await this.ensureReady();
    const accepted = payload?.accepted;
    const auth = (payload?.payload as { authorization?: { from?: unknown } } | undefined)?.authorization;
    if (
      !accepted ||
      typeof accepted.payTo !== "string" ||
      !isAddress(accepted.payTo, { strict: false }) ||
      typeof accepted.amount !== "string" ||
      !/^[1-9][0-9]{0,30}$/.test(accepted.amount) ||
      typeof auth?.from !== "string" ||
      !isAddress(auth.from, { strict: false })
    ) {
      throw new PaymentRejectedError("invalid_withdrawal", "Malformed withdrawal authorization.", 400);
    }
    const from = getAddress(auth.from);
    const to = getAddress(accepted.payTo);
    if (to === zeroAddress || to === from) {
      throw new PaymentRejectedError("invalid_destination", "Withdrawal destination is invalid.", 400);
    }

    // The ONLY requirement a withdrawal may satisfy: configured network,
    // configured EIP-3009 asset and domain, exact scheme.
    const canonical: PaymentRequirements = {
      scheme: X402_SCHEME,
      network: this.deps.network as PaymentRequirements["network"],
      asset: this.deps.asset.address,
      amount: accepted.amount,
      payTo: to,
      maxTimeoutSeconds: X402_MAX_TIMEOUT_SECONDS,
      extra: {
        name: this.deps.asset.eip712.name,
        version: this.deps.asset.eip712.version,
        assetTransferMethod: X402_ASSET_TRANSFER_METHOD,
      },
    };

    return this.paymentLocks.run(from, async () => {
      let record = await this.deps.store.get(from);
      if (record) record = await this.reconcile(record);
      if (!record || (record.status !== "settled" && record.status !== "announced")) {
        throw new PaymentRejectedError(
          "unknown_stealth_address",
          "Only stealth addresses that received a settled x402 payment through this service can withdraw via the relay.",
          403,
        );
      }

      const { authorization } = await validateEip3009Payment({
        client: this.deps.client,
        payload,
        issued: canonical,
        chainId: this.deps.chainId,
        nowSeconds: this.nowSeconds(),
      });

      let verify: VerifyResponse;
      try {
        verify = await this.deps.facilitator.verify(payload, canonical);
      } catch (err) {
        if (err instanceof VerifyError) {
          verify = { isValid: false, invalidReason: err.invalidReason, invalidMessage: err.invalidMessage };
        } else {
          throw new FacilitatorUnavailableError(`Facilitator verify failed: ${safeMessage(err)}`);
        }
      }
      if (!verify.isValid) {
        throw new PaymentRejectedError(
          verify.invalidReason ?? "facilitator_rejected",
          verify.invalidMessage ?? "The facilitator rejected the withdrawal.",
        );
      }

      const expected = {
        asset: this.deps.asset.address,
        payer: from,
        payTo: to,
        value: authorization.value,
        nonce: authorization.nonce,
      };
      const fromBlock = await this.deps.client.getBlockNumber({ cacheTime: 0 });
      let settle: SettleResponse | null = null;
      let settleError: string | null = null;
      try {
        settle = await this.deps.facilitator.settle(payload, canonical);
      } catch (err) {
        settleError = err instanceof SettleError ? (err.errorReason ?? "settle_failed") : safeMessage(err);
      }

      let confirmed =
        settle?.success && settle.transaction
          ? await this.confirmAuthorizedTransfer(expected, settle.transaction as Hex)
          : null;
      if (!confirmed) confirmed = await this.findAuthorizedTransferOnChain(expected, fromBlock);
      if (!confirmed) {
        if (settle && !settle.success) {
          throw new PaymentRejectedError(settle.errorReason ?? "settlement_failed", "Withdrawal settlement failed.");
        }
        throw new SettlementOutcomeUnknownError(
          `Withdrawal outcome unknown: ${settleError ?? "transaction not confirmed"}`,
        );
      }

      record = {
        ...record,
        withdrawals: [
          ...(record.withdrawals ?? []),
          {
            txHash: confirmed.txHash,
            to,
            amount: authorization.value.toString(),
            blockNumber: confirmed.blockNumber.toString(),
          },
        ],
        updatedAt: new Date().toISOString(),
      };
      await this.deps.store.put(record);
      return { record, txHash: confirmed.txHash, to, amount: authorization.value.toString() };
    });
  }

  /* ------------------------------------------------------------------ */

  /** Confirms from the receipt that exactly this EIP-3009 transfer happened. */
  private async confirmAuthorizedTransfer(
    expected: { asset: Address; payer: Address; payTo: Address; value: bigint; nonce: Hex },
    hash: Hex,
  ): Promise<{ txHash: Hex; blockNumber: bigint } | null> {
    try {
      const receipt = await this.deps.client.waitForTransactionReceipt({
        hash,
        timeout: this.deps.receiptTimeoutMs ?? 90_000,
      });
      return confirmSettlementReceipt(receipt, expected)
        ? { txHash: hash, blockNumber: receipt.blockNumber }
        : null;
    } catch {
      return null;
    }
  }

  /** Finds and confirms the tx that consumed `(payer, nonce)`, if any. */
  private async findAuthorizedTransferOnChain(
    expected: { asset: Address; payer: Address; payTo: Address; value: bigint; nonce: Hex },
    fromBlock: bigint,
  ): Promise<{ txHash: Hex; blockNumber: bigint } | null> {
    const used = await this.deps.client.readContract({
      address: expected.asset,
      abi: eip3009Abi,
      functionName: "authorizationState",
      args: [expected.payer, expected.nonce],
    });
    if (!used) return null;
    const hash = await findAuthorizationUsedTx(this.deps.client, {
      asset: expected.asset,
      payer: expected.payer,
      nonce: expected.nonce,
      fromBlock,
    });
    return hash ? this.confirmAuthorizedTransfer(expected, hash) : null;
  }

  private expectedSettlement(record: X402PaymentRecord) {
    return {
      asset: record.asset,
      payer: record.authorization!.payer,
      payTo: record.stealthAddress,
      value: BigInt(record.amount),
      nonce: record.authorization!.nonce,
    };
  }

  private async confirmTx(
    record: X402PaymentRecord,
    hash: Hex,
  ): Promise<{ txHash: Hex; blockNumber: bigint } | null> {
    if (!record.authorization) return null;
    return this.confirmAuthorizedTransfer(this.expectedSettlement(record), hash);
  }

  private async findSettlementOnChain(
    record: X402PaymentRecord,
  ): Promise<{ txHash: Hex; blockNumber: bigint } | null> {
    if (!record.authorization) return null;
    return this.findAuthorizedTransferOnChain(
      this.expectedSettlement(record),
      BigInt(record.createdAtBlock),
    );
  }

  /**
   * Resolves an `authorized` payment whose outcome was not recorded: settled
   * if the chain shows the authorization consumed, failed if it expired
   * unused, otherwise unchanged.
   */
  private async reconcile(record: X402PaymentRecord): Promise<X402PaymentRecord> {
    if (record.status !== "authorized" || !record.authorization) return record;
    const found = await this.findSettlementOnChain(record);
    if (found) {
      const next: X402PaymentRecord = {
        ...record,
        status: "settled",
        settlement: { txHash: found.txHash, blockNumber: found.blockNumber.toString() },
        lastError: undefined,
        updatedAt: new Date().toISOString(),
      };
      await this.deps.store.put(next);
      return next;
    }
    // Chain time, not server time: the token enforces block.timestamp < validBefore,
    // so only a block at/after validBefore proves the authorization can no longer land.
    const head = await this.deps.client.getBlock({ blockTag: "latest" });
    if (head.timestamp >= BigInt(record.authorization.validBefore)) {
      const next: X402PaymentRecord = {
        ...record,
        status: "failed",
        lastError: "Authorization expired without settling.",
        updatedAt: new Date().toISOString(),
      };
      await this.deps.store.put(next);
      return next;
    }
    return record;
  }
}
