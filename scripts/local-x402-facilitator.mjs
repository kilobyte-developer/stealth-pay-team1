// LOCAL DEVELOPMENT ONLY — an x402 facilitator for a local Hardhat chain.
//
// PayAI (and every hosted facilitator) settles on real networks only and can
// never reach a node on 127.0.0.1, so local browser testing needs a facilitator
// that can. This runs the SAME facilitator implementation StealthPay relies on
// (@x402/core x402Facilitator + @x402/evm exact scheme), behind the same HTTP
// API (POST /verify, POST /settle, GET /supported) that HTTPFacilitatorClient
// speaks — so the StealthPay backend is unchanged; only X402_FACILITATOR_URL
// points here.
//
// Refuses to start unless the RPC is a loopback Hardhat node on chainId 43113.
// Its signer defaults to Hardhat's public test account #1, which holds
// nothing on any real network.
//
// Usage (from the repo root, with `npx hardhat node` running in contracts/):
//   node scripts/local-x402-facilitator.mjs

import { createServer } from "node:http";
import { createWalletClient, defineChain, http, publicActions } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { x402Facilitator } from "@x402/core/facilitator";
import { toFacilitatorEvmSigner } from "@x402/evm";
import { ExactEvmScheme } from "@x402/evm/exact/facilitator";

const RPC_URL = process.env.LOCAL_RPC_URL ?? "http://127.0.0.1:8545";
const PORT = Number(process.env.LOCAL_FACILITATOR_PORT ?? 4022);
// Hardhat test-mnemonic account #1 (public; worthless outside a local node).
const HARDHAT_ACCOUNT_1 = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d";
const KEY = process.env.LOCAL_FACILITATOR_PRIVATE_KEY ?? HARDHAT_ACCOUNT_1;
const NETWORK = "eip155:43113";

async function rpc(method) {
  const res = await fetch(RPC_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params: [] }),
  });
  return (await res.json()).result;
}

// ---- Safety: local Hardhat only ----
const host = new URL(RPC_URL).hostname;
if (!["127.0.0.1", "localhost", "::1"].includes(host)) {
  console.error(`Refusing to run: ${RPC_URL} is not a loopback RPC.`);
  process.exit(1);
}
let clientVersion, chainId;
try {
  [clientVersion, chainId] = await Promise.all([rpc("web3_clientVersion"), rpc("eth_chainId")]);
} catch {
  console.error(`Cannot reach ${RPC_URL}. Start it first: cd contracts && npx hardhat node`);
  process.exit(1);
}
if (!String(clientVersion).includes("HardhatNetwork") || Number.parseInt(chainId, 16) !== 43113) {
  console.error(`Refusing to run: expected a Hardhat node on chainId 43113, got "${clientVersion}" / ${chainId}.`);
  process.exit(1);
}

const chain = defineChain({
  id: 43113,
  name: "Hardhat (Fuji chainId)",
  nativeCurrency: { name: "Avalanche", symbol: "AVAX", decimals: 18 },
  rpcUrls: { default: { http: [RPC_URL] } },
});
const account = privateKeyToAccount(KEY);
const client = createWalletClient({ account, chain, transport: http(RPC_URL) }).extend(publicActions);
const facilitator = new x402Facilitator().register(
  NETWORK,
  new ExactEvmScheme(toFacilitatorEvmSigner(Object.assign(client, { address: account.address }))),
);

function send(res, status, body) {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body, (_k, v) => (typeof v === "bigint" ? v.toString() : v)));
}

async function readBody(req) {
  let raw = "";
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 1_000_000) throw new Error("body too large");
  }
  return JSON.parse(raw);
}

const server = createServer(async (req, res) => {
  try {
    if (req.method === "GET" && req.url === "/supported") {
      return send(res, 200, facilitator.getSupported());
    }
    if (req.method === "POST" && (req.url === "/verify" || req.url === "/settle")) {
      const { paymentPayload, paymentRequirements } = await readBody(req);
      const auth = paymentPayload?.payload?.authorization ?? {};
      if (req.url === "/verify") {
        const result = await facilitator.verify(paymentPayload, paymentRequirements);
        console.log(
          `[verify] ${auth.from} -> ${auth.to} value=${auth.value} valid=${result.isValid}${result.invalidReason ? ` reason=${result.invalidReason}` : ""}`,
        );
        return send(res, 200, result);
      }
      const result = await facilitator.settle(paymentPayload, paymentRequirements);
      console.log(
        `[settle] ${auth.from} -> ${auth.to} value=${auth.value} success=${result.success} tx=${result.transaction || "-"}${result.errorReason ? ` reason=${result.errorReason}` : ""}`,
      );
      return send(res, 200, result);
    }
    send(res, 404, { error: "not_found" });
  } catch (err) {
    console.error("[facilitator] error:", err instanceof Error ? err.message : String(err));
    send(res, 500, { error: "facilitator_error" });
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`Local x402 facilitator on http://127.0.0.1:${PORT}  (chain 43113 @ ${RPC_URL}, signer ${account.address})`);
});
