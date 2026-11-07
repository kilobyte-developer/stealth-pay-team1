import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createWalletClient,
  http,
  parseEventLogs,
  parseEther,
  slice,
  type Address,
  type Hex,
} from "viem";
import { generatePrivateKey, privateKeyToAccount, privateKeyToAddress } from "viem/accounts";
import {
  DEFAULT_CHAIN_ID,
  SCHEME_ID_SECP256K1,
  checkStealthAnnouncement,
  deriveOneTimeSpendingKey,
  generateOneTimeStealthAddress,
  generateStealthIdentity,
} from "@/lib/stealth";
import { createVault, deleteVault, exportBackup, importBackup, resetVaultDbConnection, unlockVault } from "@/lib/vault";
import {
  RPC_URL,
  deploy,
  loadArtifact,
  localChain,
  startHardhatNode,
  type NodeHandle,
} from "./hardhat-node";

const VAULT_PASSWORD = "integration test vault passphrase";

let node: NodeHandle | null = null;
let announcer: Address;
let router: Address;
let token: Address;

const announcerArtifact = loadArtifact(
  "ERC5564Announcer.sol",
  "ERC5564Announcer",
);
const routerArtifact = loadArtifact(
  "StealthPaymentRouter.sol",
  "StealthPaymentRouter",
);
const tokenArtifact = loadArtifact("mocks/TestTokens.sol", "MockERC20");

beforeAll(async () => {
  node = await startHardhatNode();
  if (!node) return;

  announcer = await deploy(node, announcerArtifact);
  router = await deploy(node, routerArtifact, [announcer]);
  token = await deploy(node, tokenArtifact, ["Mock USD", "mUSD", 6]);
}, 180_000);

afterAll(() => {
  node?.stop();
});

/** Pulls the ERC-5564 Announcement events out of a receipt. */
async function announcementsFrom(hash: Hex) {
  const receipt = await node!.publicClient.waitForTransactionReceipt({ hash });
  expect(receipt.status).toBe("success");
  return {
    receipt,
    events: parseEventLogs({
      abi: announcerArtifact.abi,
      eventName: "Announcement",
      logs: receipt.logs,
    }) as unknown as {
      args: {
        schemeId: bigint;
        stealthAddress: Address;
        caller: Address;
        ephemeralPubKey: Hex;
        metadata: Hex;
      };
    }[],
  };
}

describe.runIf(process.env.SKIP_CHAIN_INTEGRATION !== "1")(
  "End-to-end: crypto engine ↔ Avalanche contracts",
  () => {
    it("boots a local chain and deploys the contracts", () => {
      // If this fails, every test below is meaningless, so assert it loudly
      // rather than letting the suite silently skip.
      expect(
        node,
        "Hardhat node failed to start — integration results are NOT verified",
      ).not.toBeNull();
      expect(announcer).toMatch(/^0x[0-9a-fA-F]{40}$/);
      expect(router).toMatch(/^0x[0-9a-fA-F]{40}$/);
    });

    it("native AVAX: Bob pays, Alice detects and recovers control", async () => {
      // ---- 1. Alice creates a real identity ----
      const alice = generateStealthIdentity(DEFAULT_CHAIN_ID);

      // ---- 2. Bob derives a one-time address from her public meta-address ----
      const payment = generateOneTimeStealthAddress({
        metaAddress: alice.publicIdentity.stealthMetaAddress,
        chainId: DEFAULT_CHAIN_ID,
      });

      const before = await node!.publicClient.getBalance({
        address: payment.stealthAddress,
      });
      expect(before).toBe(0n);

      // ---- 3. Bob pays through the router ----
      const amount = parseEther("1.5");
      const hash = await node!.walletClient.writeContract({
        address: router,
        abi: routerArtifact.abi,
        functionName: "payNative",
        args: [payment.stealthAddress, payment.ephemeralPublicKey, payment.viewTag],
        value: amount,
        account: node!.account,
        chain: localChain,
      });

      // ---- 4. The stealth account actually received the funds ----
      const { events } = await announcementsFrom(hash);
      expect(
        await node!.publicClient.getBalance({
          address: payment.stealthAddress,
        }),
      ).toBe(amount);

      // ---- 5. The announcement matches what the engine produced ----
      expect(events).toHaveLength(1);
      const ev = events[0].args;
      expect(ev.schemeId).toBe(1n);
      expect(ev.stealthAddress).toBe(payment.stealthAddress);
      expect(ev.caller).toBe(router); // the router, not Bob's EOA
      expect(ev.ephemeralPubKey.toLowerCase()).toBe(
        payment.ephemeralPublicKey.toLowerCase(),
      );
      // ERC-5564: the first metadata byte is the view tag.
      expect(slice(ev.metadata, 0, 1).toLowerCase()).toBe(
        payment.viewTag.toLowerCase(),
      );

      // ---- 6. Alice scans the announcement straight off the chain ----
      const check = checkStealthAnnouncement({
        stealthAddress: ev.stealthAddress,
        ephemeralPublicKey: ev.ephemeralPubKey,
        viewTag: slice(ev.metadata, 0, 1),
        viewingPrivateKey: alice.secrets.viewingPrivateKey,
        spendingPublicKey: alice.publicIdentity.spendingPublicKey,
        schemeId: Number(ev.schemeId),
      });
      expect(check.isForUser).toBe(true);
      expect(check.derivedStealthAddress).toBe(payment.stealthAddress);

      // ---- 7. Alice recovers the key controlling the funded account ----
      const { privateKey, stealthAddress } = deriveOneTimeSpendingKey({
        ephemeralPublicKey: ev.ephemeralPubKey,
        viewingPrivateKey: alice.secrets.viewingPrivateKey,
        spendingPrivateKey: alice.secrets.spendingPrivateKey,
        expectedStealthAddress: ev.stealthAddress,
        schemeId: SCHEME_ID_SECP256K1,
      });

      // The decisive assertion: the recovered key controls the address that
      // actually holds the AVAX on chain.
      expect(stealthAddress).toBe(payment.stealthAddress);
      expect(privateKeyToAddress(privateKey.toHex())).toBe(
        payment.stealthAddress,
      );
      expect(
        await node!.publicClient.getBalance({ address: stealthAddress }),
      ).toBe(amount);

      privateKey.destroy();
      alice.secrets.destroy();
    });

    it("Alice forwards (sweeps) a received native payment using only the derived one-time key", async () => {
      // Mirrors `forwardPayment` in src/providers/stealth-identity-provider.tsx
      // exactly: derive the one-time key, sign locally with it (never via a
      // "connected wallet", which never holds this key), and sweep the full
      // balance minus a precisely-known legacy-transaction fee.
      const alice = generateStealthIdentity(DEFAULT_CHAIN_ID);
      const payment = generateOneTimeStealthAddress({
        metaAddress: alice.publicIdentity.stealthMetaAddress,
        chainId: DEFAULT_CHAIN_ID,
      });

      const amount = parseEther("0.3");
      const payHash = await node!.walletClient.writeContract({
        address: router,
        abi: routerArtifact.abi,
        functionName: "payNative",
        args: [payment.stealthAddress, payment.ephemeralPublicKey, payment.viewTag],
        value: amount,
        account: node!.account,
        chain: localChain,
      });
      await announcementsFrom(payHash);

      const { privateKey, stealthAddress } = deriveOneTimeSpendingKey({
        ephemeralPublicKey: payment.ephemeralPublicKey,
        viewingPrivateKey: alice.secrets.viewingPrivateKey,
        spendingPrivateKey: alice.secrets.spendingPrivateKey,
        expectedStealthAddress: payment.stealthAddress,
        schemeId: SCHEME_ID_SECP256K1,
      });

      const forwardingClient = createWalletClient({
        account: privateKeyToAccount(privateKey.toHex()),
        chain: localChain,
        transport: http(RPC_URL),
      });
      // An unrelated throwaway destination — not Alice, not Bob, not the
      // stealth address itself.
      const destination = privateKeyToAccount(generatePrivateKey()).address;

      const balanceBefore = await node!.publicClient.getBalance({
        address: stealthAddress,
      });
      expect(balanceBefore).toBe(amount);

      const gasLimit = 21_000n;
      const gasPrice =
        ((await node!.publicClient.getGasPrice()) * 120n) / 100n;
      const fee = gasPrice * gasLimit;
      const sweepValue = balanceBefore - fee;

      const forwardHash = await forwardingClient.sendTransaction({
        to: destination,
        value: sweepValue,
        gas: gasLimit,
        gasPrice,
        chain: localChain,
      });
      const forwardReceipt = await node!.publicClient.waitForTransactionReceipt({
        hash: forwardHash,
      });
      expect(forwardReceipt.status).toBe("success");

      // The full swept amount actually arrived at the unrelated destination.
      expect(
        await node!.publicClient.getBalance({ address: destination }),
      ).toBe(sweepValue);
      // A plain transfer costs exactly 21,000 gas, so the fee was exact and
      // the stealth address is left at precisely zero — nothing stranded.
      expect(
        await node!.publicClient.getBalance({ address: stealthAddress }),
      ).toBe(0n);

      privateKey.destroy();
      alice.secrets.destroy();
    });

    it("ERC-20 + AVAX gas top-up: both assets land and both announce", async () => {
      const alice = generateStealthIdentity(DEFAULT_CHAIN_ID);
      const payment = generateOneTimeStealthAddress({
        metaAddress: alice.publicIdentity.stealthMetaAddress,
        chainId: DEFAULT_CHAIN_ID,
      });

      const tokenAmount = 250_000_000n; // 250 mUSD @ 6dp
      const topUp = parseEther("0.05");

      // Fund and approve.
      await node!.publicClient.waitForTransactionReceipt({
        hash: await node!.walletClient.writeContract({
          address: token,
          abi: tokenArtifact.abi,
          functionName: "mint",
          args: [node!.account.address, tokenAmount],
          account: node!.account,
          chain: localChain,
        }),
      });
      await node!.publicClient.waitForTransactionReceipt({
        hash: await node!.walletClient.writeContract({
          address: token,
          abi: tokenArtifact.abi,
          functionName: "approve",
          args: [router, tokenAmount],
          account: node!.account,
          chain: localChain,
        }),
      });

      const hash = await node!.walletClient.writeContract({
        address: router,
        abi: routerArtifact.abi,
        functionName: "payERC20",
        args: [
          token,
          payment.stealthAddress,
          tokenAmount,
          payment.ephemeralPublicKey,
          payment.viewTag,
        ],
        value: topUp,
        account: node!.account,
        chain: localChain,
      });

      const { events } = await announcementsFrom(hash);

      // Two independently parseable announcements for one destination.
      expect(events).toHaveLength(2);
      const [tokenEv, gasEv] = events.map((e) => e.args);

      expect(slice(tokenEv.metadata, 1, 5)).toBe("0x23b872dd");
      expect(slice(gasEv.metadata, 1, 5)).toBe("0xeeeeeeee");
      for (const ev of [tokenEv, gasEv]) {
        expect(ev.stealthAddress).toBe(payment.stealthAddress);
        expect(slice(ev.metadata, 0, 1).toLowerCase()).toBe(
          payment.viewTag.toLowerCase(),
        );
      }

      // Both balances really moved.
      const tokenBalance = await node!.publicClient.readContract({
        address: token,
        abi: tokenArtifact.abi,
        functionName: "balanceOf",
        args: [payment.stealthAddress],
      });
      expect(tokenBalance).toBe(tokenAmount);
      expect(
        await node!.publicClient.getBalance({
          address: payment.stealthAddress,
        }),
      ).toBe(topUp);

      // Alice detects from the token announcement and recovers the key, which
      // controls the account holding BOTH assets.
      const check = checkStealthAnnouncement({
        stealthAddress: tokenEv.stealthAddress,
        ephemeralPublicKey: tokenEv.ephemeralPubKey,
        viewTag: slice(tokenEv.metadata, 0, 1),
        viewingPrivateKey: alice.secrets.viewingPrivateKey,
        spendingPublicKey: alice.publicIdentity.spendingPublicKey,
        schemeId: Number(tokenEv.schemeId),
      });
      expect(check.isForUser).toBe(true);

      const { privateKey } = deriveOneTimeSpendingKey({
        ephemeralPublicKey: tokenEv.ephemeralPubKey,
        viewingPrivateKey: alice.secrets.viewingPrivateKey,
        spendingPrivateKey: alice.secrets.spendingPrivateKey,
        expectedStealthAddress: tokenEv.stealthAddress,
        schemeId: SCHEME_ID_SECP256K1,
      });
      expect(privateKeyToAddress(privateKey.toHex())).toBe(
        payment.stealthAddress,
      );

      // The gas top-up is what makes those tokens actually spendable.
      expect(topUp).toBeGreaterThan(0n);

      privateKey.destroy();
      alice.secrets.destroy();
    });

    it("an unrelated receiver cannot detect the on-chain payment", async () => {
      const alice = generateStealthIdentity(DEFAULT_CHAIN_ID);
      const mallory = generateStealthIdentity(DEFAULT_CHAIN_ID);

      const payment = generateOneTimeStealthAddress({
        metaAddress: alice.publicIdentity.stealthMetaAddress,
        chainId: DEFAULT_CHAIN_ID,
      });

      const hash = await node!.walletClient.writeContract({
        address: router,
        abi: routerArtifact.abi,
        functionName: "payNative",
        args: [payment.stealthAddress, payment.ephemeralPublicKey, payment.viewTag],
        value: parseEther("0.2"),
        account: node!.account,
        chain: localChain,
      });
      const { events } = await announcementsFrom(hash);
      const ev = events[0].args;

      expect(
        checkStealthAnnouncement({
          stealthAddress: ev.stealthAddress,
          ephemeralPublicKey: ev.ephemeralPubKey,
          viewTag: slice(ev.metadata, 0, 1),
          viewingPrivateKey: mallory.secrets.viewingPrivateKey,
          spendingPublicKey: mallory.publicIdentity.spendingPublicKey,
          schemeId: Number(ev.schemeId),
        }).isForUser,
      ).toBe(false);

      alice.secrets.destroy();
      mallory.secrets.destroy();
    });

    it("a vault-recovered identity can still claim an on-chain payment", async () => {
      // The combined objective of this milestone: funds received before a
      // device is lost must remain spendable after restoring from a backup.
      await deleteVault().catch(() => {});
      resetVaultDbConnection();

      const alice = generateStealthIdentity(DEFAULT_CHAIN_ID);
      await createVault(alice, VAULT_PASSWORD);
      const backup = await exportBackup(VAULT_PASSWORD);

      // Bob pays while Alice is still "online".
      const payment = generateOneTimeStealthAddress({
        metaAddress: alice.publicIdentity.stealthMetaAddress,
        chainId: DEFAULT_CHAIN_ID,
      });
      const amount = parseEther("0.75");
      const hash = await node!.walletClient.writeContract({
        address: router,
        abi: routerArtifact.abi,
        functionName: "payNative",
        args: [payment.stealthAddress, payment.ephemeralPublicKey, payment.viewTag],
        value: amount,
        account: node!.account,
        chain: localChain,
      });
      const { events } = await announcementsFrom(hash);
      const ev = events[0].args;

      // Alice's device is destroyed: in-memory keys gone, storage wiped.
      alice.secrets.destroy();
      await deleteVault();
      resetVaultDbConnection();

      // New device: restore from the encrypted backup file alone.
      const restored = await importBackup(backup.contents, VAULT_PASSWORD);
      resetVaultDbConnection();
      const reopened = await unlockVault(VAULT_PASSWORD);

      const check = checkStealthAnnouncement({
        stealthAddress: ev.stealthAddress,
        ephemeralPublicKey: ev.ephemeralPubKey,
        viewTag: slice(ev.metadata, 0, 1),
        viewingPrivateKey: reopened.secrets.viewingPrivateKey,
        spendingPublicKey: reopened.publicIdentity.spendingPublicKey,
        schemeId: Number(ev.schemeId),
      });
      expect(check.isForUser).toBe(true);

      const { privateKey } = deriveOneTimeSpendingKey({
        ephemeralPublicKey: ev.ephemeralPubKey,
        viewingPrivateKey: reopened.secrets.viewingPrivateKey,
        spendingPrivateKey: reopened.secrets.spendingPrivateKey,
        expectedStealthAddress: ev.stealthAddress,
        schemeId: SCHEME_ID_SECP256K1,
      });

      expect(privateKeyToAddress(privateKey.toHex())).toBe(
        payment.stealthAddress,
      );
      expect(
        await node!.publicClient.getBalance({ address: payment.stealthAddress }),
      ).toBe(amount);

      privateKey.destroy();
      restored.secrets.destroy();
      reopened.secrets.destroy();
      await deleteVault();
      resetVaultDbConnection();
    });
  },
);
