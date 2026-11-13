import { describe, expect, it } from "vitest";
import { loadEnvConfig } from "@next/env";
import {
  createPublicClient,
  erc20Abi,
  getAddress,
  http,
  parseEventLogs,
  type Address,
  type Hex,
} from "viem";
import { generatePrivateKey, privateKeyToAccount, privateKeyToAddress } from "viem/accounts";

/*
 * LIVE local-stack smoke test — opt-in, skipped unless LOCAL_STACK_URL is set.
 *
 * Nothing is mocked: it drives the RUNNING `next dev` server over HTTP, which
 * talks to the RUNNING local x402 facilitator (scripts/local-x402-facilitator.mjs)
 * and the RUNNING Hardhat node set up by contracts/scripts/local-x402-setup.ts.
 * Receiver detection uses the app's real scanner against the local RPC.
 *
 * Sender: Hardhat public test account #3 (fund it with local-x402-fund.ts).
 *
 *   LOCAL_STACK_URL=http://localhost:3000 npx vitest run \
 *     --config vitest.integration.config.mts src/test/integration/local-stack.smoke.test.ts
 */
const STACK = process.env.LOCAL_STACK_URL;
const SENDER_KEY = "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6" as const;

describe.runIf(!!STACK)("LIVE local stack: browser-equivalent x402 + ERC-5564 lifecycle", () => {
  it("pays 0.001 USDC, detects it with the real scanner, withdraws gaslessly, and refuses abuse", async () => {
    // Same env `next dev` uses, BEFORE importing modules that read it. Under
    // Vitest NODE_ENV is "test", which would make Next load .env.test* instead
    // of .env.development.local, so load development mode explicitly.
    const env = process.env as Record<string, string | undefined>;
    const priorNodeEnv = env.NODE_ENV;
    env.NODE_ENV = "development";
    loadEnvConfig(process.cwd(), true, { info() {}, error() {} }, true);
    env.NODE_ENV = priorNodeEnv;
    const { FUJI_USDC, X402_FUJI_NETWORK } = await import("@/lib/x402/config");
    const { CONTRACTS, NETWORKS, SCAN_START_BLOCK, IS_LOCAL_DEV_CHAIN } = await import("@/config/networks");
    const { payStealthAddressViaX402, withdrawStealthTokenViaX402, getX402Payment } = await import("@/lib/x402/client");
    const { scanAnnouncements } = await import("@/lib/scanner/announcement-scanner");
    const { ANNOUNCEMENT_EVENT } = await import("@/lib/scanner/announcement-event");
    const stealth = await import("@/lib/stealth");
    const { encodePaymentSignatureHeader } = await import("@x402/core/http");

    expect(IS_LOCAL_DEV_CHAIN, "env must point Fuji at the local node").toBe(true);
    const rpc = NETWORKS.fuji.rpcUrl;
    const client = createPublicClient({ transport: http(rpc) });
    expect(await client.getChainId()).toBe(43113);
    expect(await client.request({ method: "web3_clientVersion" as never })).toMatch(/HardhatNetwork/);

    const announcer = CONTRACTS.fuji.announcer!;
    const usdc = FUJI_USDC.address;
    const bal = (a: Address) => client.readContract({ address: usdc, abi: erc20Abi, functionName: "balanceOf", args: [a] });
    const api = (p: string) => `${STACK}${p}`;
    const sender = privateKeyToAccount(SENDER_KEY);
    const log: Record<string, unknown> = { rpc, announcer, usdc, sender: sender.address };

    // ---- Receiver identity + sender derivation (fresh ephemeral key) ----
    const receiver = stealth.generateStealthIdentity(stealth.DEFAULT_CHAIN_ID);
    const meta = receiver.publicIdentity.stealthMetaAddress;
    const derived = stealth.generateOneTimeStealthAddress({ metaAddress: meta, chainId: stealth.DEFAULT_CHAIN_ID });
    const amount = 1_000n; // 0.001 USDC
    const senderBefore = await bal(sender.address);

    // ---- Pay through the LIVE backend + LIVE facilitator ----
    const stages: string[] = [];
    const paid = await payStealthAddressViaX402({
      derived,
      amount,
      asset: FUJI_USDC,
      network: X402_FUJI_NETWORK,
      signer: sender,
      endpoint: api("/api/x402/stealth-payments"),
      onStage: (s) => stages.push(s),
    });
    expect(stages).toEqual(["requesting", "signing", "settling"]);
    expect(paid.payment.status).toBe("announced");
    const settlementTx = paid.payment.settlementTx!;
    const announcementTx = paid.payment.announcementTx!;
    log.stealthAddress = derived.stealthAddress;
    log.settlementTx = settlementTx;
    log.announcementTx = announcementTx;

    // On-chain proof of settlement: receipt, Transfer, AuthorizationUsed.
    const settleReceipt = await client.getTransactionReceipt({ hash: settlementTx });
    expect(settleReceipt.status).toBe("success");
    const transfers = parseEventLogs({ abi: erc20Abi, eventName: "Transfer", logs: settleReceipt.logs });
    expect(transfers.map((t) => t.args)).toContainEqual({ from: sender.address, to: derived.stealthAddress, value: amount });
    expect(getAddress(settleReceipt.to!)).toBe(usdc); // facilitator called the token directly
    expect(await bal(derived.stealthAddress)).toBe(amount);
    expect(await bal(sender.address)).toBe(senderBefore - amount);
    expect(await client.getBalance({ address: derived.stealthAddress })).toBe(0n); // no gas there
    log.settlementBlock = settleReceipt.blockNumber.toString();
    log.facilitatorSubmitter = settleReceipt.from;

    // On-chain proof of the announcement, AFTER settlement.
    const annReceipt = await client.getTransactionReceipt({ hash: announcementTx });
    const [ann] = parseEventLogs({ abi: [ANNOUNCEMENT_EVENT], logs: annReceipt.logs });
    expect(getAddress(annReceipt.to!)).toBe(announcer);
    expect(annReceipt.blockNumber).toBeGreaterThan(settleReceipt.blockNumber);
    expect(ann.args.schemeId).toBe(1n);
    expect(ann.args.stealthAddress).toBe(derived.stealthAddress);
    expect(ann.args.ephemeralPubKey.toLowerCase()).toBe(derived.ephemeralPublicKey.toLowerCase());
    expect(ann.args.metadata.slice(0, 12)).toBe(`${derived.viewTag}e3ee160e`);
    log.announcementBlock = annReceipt.blockNumber.toString();

    // ---- Receiver: the app's REAL scanner over the local RPC ----
    const scan = await scanAnnouncements({
      network: "fuji",
      announcer,
      fromBlock: SCAN_START_BLOCK.fuji,
      match: (input) =>
        stealth.checkStealthAnnouncement({
          ...input,
          viewingPrivateKey: receiver.secrets.viewingPrivateKey,
          spendingPublicKey: receiver.publicIdentity.spendingPublicKey,
        }),
    });
    const detected = scan.payments.find((p) => p.stealthAddress === derived.stealthAddress);
    expect(detected, "scanner must detect the payment").toBeDefined();
    expect(detected).toMatchObject({
      assetKind: "erc20",
      token: usdc,
      tokenSymbol: "USDC",
      announcedAmount: amount,
      verifiedBalance: amount,
      payerAddress: sender.address, // real payer from the verified Transfer, not the relayer
      x402SettlementTx: settlementTx,
    });

    // ---- Receiver: derive one-time key, withdraw gaslessly ----
    const { privateKey } = stealth.deriveOneTimeSpendingKey({
      ephemeralPublicKey: detected!.ephemeralPublicKey,
      viewingPrivateKey: receiver.secrets.viewingPrivateKey,
      spendingPrivateKey: receiver.secrets.spendingPrivateKey,
      expectedStealthAddress: detected!.stealthAddress,
      schemeId: stealth.SCHEME_ID_SECP256K1,
    });
    const oneTime = privateKeyToAccount(privateKey.toHex());
    expect(oneTime.address).toBe(derived.stealthAddress);
    const receiverWallet = privateKeyToAddress(generatePrivateKey());
    const w = await withdrawStealthTokenViaX402({
      stealthSigner: oneTime,
      to: receiverWallet,
      amount,
      asset: FUJI_USDC,
      network: X402_FUJI_NETWORK,
      endpoint: api("/api/x402/withdrawals"),
    });
    const wReceipt = await client.getTransactionReceipt({ hash: w.txHash });
    expect(wReceipt.status).toBe("success");
    expect(await bal(receiverWallet)).toBe(amount);
    expect(await bal(derived.stealthAddress)).toBe(0n);
    log.withdrawalTx = w.txHash;
    log.receiverWallet = receiverWallet;

    // Withdrawn payment stays visible to the scanner (verified via its Transfer).
    const rescan = await scanAnnouncements({
      network: "fuji",
      announcer,
      fromBlock: SCAN_START_BLOCK.fuji,
      match: (input) =>
        stealth.checkStealthAnnouncement({
          ...input,
          viewingPrivateKey: receiver.secrets.viewingPrivateKey,
          spendingPublicKey: receiver.publicIdentity.spendingPublicKey,
        }),
    });
    expect(rescan.payments.find((p) => p.stealthAddress === derived.stealthAddress)?.verifiedBalance).toBe(0n);

    // ---- Abuse / edge cases against the LIVE API ----
    // Duplicate withdrawal: nothing left.
    await expect(
      withdrawStealthTokenViaX402({
        stealthSigner: oneTime, to: receiverWallet, amount, asset: FUJI_USDC,
        network: X402_FUJI_NETWORK, endpoint: api("/api/x402/withdrawals"),
      }),
    ).rejects.toMatchObject({ code: "insufficient_funds" });
    // Facilitator can't be used for arbitrary addresses.
    await expect(
      withdrawStealthTokenViaX402({
        stealthSigner: sender, to: receiverWallet, amount, asset: FUJI_USDC,
        network: X402_FUJI_NETWORK, endpoint: api("/api/x402/withdrawals"),
      }),
    ).rejects.toMatchObject({ code: "unknown_stealth_address" });
    // Status endpoint agrees.
    expect((await getX402Payment(derived.stealthAddress, (u, i) => fetch(api(String(u)), i))).status).toBe("announced");

    // Duplicate payment to the same stealth address.
    const intent = {
      network: X402_FUJI_NETWORK, asset: usdc, amount: amount.toString(), stealthAddress: derived.stealthAddress,
      ephemeralPublicKey: derived.ephemeralPublicKey, viewTag: derived.viewTag, schemeId: 1,
    };
    const post = (body: unknown, headers: Record<string, string> = {}) =>
      fetch(api("/api/x402/stealth-payments"), {
        method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body),
      });
    const dup = await post(intent);
    expect(dup.status).toBe(409);
    expect((await dup.json()).error).toBe("already_paid");
    // Wrong token / wrong network.
    const d2 = stealth.generateOneTimeStealthAddress({ metaAddress: meta, chainId: stealth.DEFAULT_CHAIN_ID });
    const fresh = { ...intent, stealthAddress: d2.stealthAddress, ephemeralPublicKey: d2.ephemeralPublicKey, viewTag: d2.viewTag };
    expect((await (await post({ ...fresh, asset: CONTRACTS.fuji.testToken })).json()).error).toBe("UNSUPPORTED_TOKEN");
    expect((await (await post({ ...fresh, network: "eip155:43114" })).json()).error).toBe("WRONG_NETWORK");
    // Insufficient funds: a zero-balance signer, rejected before the facilitator.
    const broke = privateKeyToAccount(generatePrivateKey());
    await expect(
      payStealthAddressViaX402({
        derived: d2, amount, asset: FUJI_USDC, network: X402_FUJI_NETWORK, signer: broke,
        endpoint: api("/api/x402/stealth-payments"),
      }),
    ).rejects.toMatchObject({ code: "insufficient_funds" });
    expect(await bal(d2.stealthAddress)).toBe(0n);
    // Invalid signature (signed by someone else for the sender).
    const req402 = await post(fresh);
    const requirements = (await req402.json()).accepts[0];
    const nonce = `0x${Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("hex")}` as Hex;
    const validBefore = BigInt(Math.floor(Date.now() / 1000) + 300);
    const forged = await broke.signTypedData({
      domain: { name: "USD Coin", version: "2", chainId: 43113, verifyingContract: usdc },
      types: { TransferWithAuthorization: [
        { name: "from", type: "address" }, { name: "to", type: "address" }, { name: "value", type: "uint256" },
        { name: "validAfter", type: "uint256" }, { name: "validBefore", type: "uint256" }, { name: "nonce", type: "bytes32" },
      ] },
      primaryType: "TransferWithAuthorization",
      message: { from: sender.address, to: d2.stealthAddress, value: amount, validAfter: 0n, validBefore, nonce },
    });
    const forgedRes = await post(fresh, {
      "PAYMENT-SIGNATURE": encodePaymentSignatureHeader({
        x402Version: 2, accepted: requirements,
        payload: { authorization: { from: sender.address, to: d2.stealthAddress, value: amount.toString(), validAfter: "0", validBefore: validBefore.toString(), nonce }, signature: forged },
      }),
    });
    expect(forgedRes.status).toBe(402);
    expect((await forgedRes.json()).error).toBe("invalid_signature");
    // Invalid receiver meta-address is rejected client-side.
    expect(() => stealth.parseStealthMetaAddress(meta.slice(0, -4))).toThrow();

    privateKey.destroy();
    receiver.secrets.destroy();
    // Public data only (addresses, hashes, blocks) — no keys.
    if (process.env.LOCAL_STACK_EVIDENCE) {
      const { writeFileSync } = await import("node:fs");
      writeFileSync(process.env.LOCAL_STACK_EVIDENCE, JSON.stringify(log, null, 2));
    }
  }, 180_000);
});
