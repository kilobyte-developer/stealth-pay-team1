# x402 × ERC-5564 integration

StealthPay can take a payment through **x402** (`exact` scheme, **EIP-3009** authorization) whose
`payTo` is a fresh **ERC-5564 one-time stealth address**. The backend publishes the ERC-5564
announcement **only after** the transfer is confirmed on-chain.

This is an additional payment rail. Native AVAX and stUSD still go through the deployed
`StealthPaymentRouter` exactly as before.

> Privacy scope: this hides the link between a payment and the receiver's reusable identity.
> It is **not** transaction anonymity. Payer, amount, timing and the stealth address are public,
> and the StealthPay backend (as the x402 resource server) sees the payer and the stealth address
> of each payment it processes.

## Why USDC, not stUSD

The deployed stUSD (`0xB114A2B17F1E7b028249cCFec2D98D25a3Bbe9C0`) is a plain OpenZeppelin ERC-20.
Its bytecode has no `transferWithAuthorization`, no `authorizationState` and no EIP-712 domain, so
x402 `exact` cannot settle it. Circle **USDC on Fuji** (`0x5425890298aed601595a70AB815c96711a31Bc65`)
was verified on-chain to implement EIP-3009 (EIP-712 domain `"USD Coin"` / `"2"`). The backend
re-checks this at startup and refuses to issue requirements if it ever stops being true.
Permit2 is never used. Both client and server reject any requirement or payload that asks for it.

## Flow

```
Sender browser                       StealthPay backend                  Facilitator (PayAI)     Fuji
──────────────                       ──────────────────                  ───────────────────     ────
derive stealth addr (fresh r,R)
POST intent {stealthAddr,R,viewTag,
  amount, USDC, eip155:43113}  ───▶  validate (network, token, amount,
                                     key on-curve) → record "pending"
                               ◀───  402 + PAYMENT-REQUIRED {exact, payTo=stealthAddr, EIP-3009}
check payTo/amount/asset/network
  == what it derived; sign EIP-3009
  TransferWithAuthorization (MetaMask)
POST + PAYMENT-SIGNATURE       ───▶  match accepted == issued; check to,
                                     value, validity window, signature,
                                     nonce unused, balance (on-chain)
                                     ───── /verify ─────────────────────▶
                                     "authorized"
                                     ───── /settle ─────────────────────▶  transferWithAuthorization ─▶
                                     confirm receipt: AuthorizationUsed + Transfer(payer→stealth, value)
                                     "settled"
                                     relayer: Announcer.announce(1, stealth, R,
                                       viewTag‖0xe3ee160e‖USDC‖amount) ─────────────────────────────▶
                                     "announced"
                               ◀───  200 + PAYMENT-RESPONSE
Receiver: existing scanner reads the Announcement, matches it with the viewing key, verifies the
USDC balance, and derives the one-time spending key locally.
```

### States and retries

| State | Meaning |
|---|---|
| `pending` | Requirement issued. Nothing signed. |
| `authorized` | Authorization verified locally and by the facilitator. Settlement in flight or outcome unknown. |
| `settled` | Transfer confirmed **from the receipt**, never from the facilitator's word alone. |
| `announced` | Announcement confirmed on-chain. |
| `failed` | Facilitator reported failure and the chain agrees, or the authorization expired unused. A new authorization may be submitted. |

- **Duplicate payments:** one record per stealth address, serialised by a per-address lock. A settled address returns `409 already_paid`. While an earlier authorization could still land, a new one returns `409 payment_in_progress`, and that only ends when the chain shows it consumed or **chain time** passes its `validBefore`. EIP-3009 nonces block on-chain replay.
- **Lost facilitator responses:** the backend checks `authorizationState(payer, nonce)` and finds the `AuthorizationUsed` log, so a settlement whose response was lost is still recovered.
- **Announcement failures** never undo a settlement. The payment stays `settled` and `POST /api/x402/stealth-payments/:id/announce` retries it. The relayer's signed transaction is persisted **before** broadcast, so a retry rebroadcasts the identical transaction (same nonce and hash). The relayer also searches for an existing announcement before signing a new one.

## API

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/x402/stealth-payments` | x402 resource: no header → `402`; `PAYMENT-SIGNATURE` → verify/settle/announce → `200` |
| `GET` | `/api/x402/stealth-payments/:stealthAddress` | Status, reconciled with the chain |
| `POST` | `/api/x402/stealth-payments/:stealthAddress/announce` | Idempotent announcement retry |
| `POST` | `/api/x402/withdrawals` | Gasless receiver withdrawal (EIP-3009 signed by the one-time key) |

Only public data crosses the API: no private, viewing, spending or ephemeral private key and no meta-address.

## First-time setup (public Avalanche Fuji)

Everything runs on **Avalanche Fuji testnet** (chain ID `43113`) against the contracts that are
already deployed. Nothing needs deploying, and no real funds are involved.

### 1. Install and create your env file

```bash
npm install
cp .env.example .env.local
```

`.env.example` already holds the public Fuji values: contract addresses, scan start block and
the PayAI facilitator URL. The only value you **must** add is the relayer key (step 2).
`.env.local` is gitignored; never commit it.

### 2. Create a dedicated Fuji relayer wallet

The backend publishes each ERC-5564 announcement from its own "relayer" account after the
payment is confirmed on-chain. That account needs a little AVAX for gas and nothing else.
Use a **brand-new key that has never held real funds**: not your MetaMask account, and not the
public Hardhat test keys.

This command generates a key, writes it into `.env.local` without showing it, and prints
only its address:

```bash
node -e "const fs=require('fs');const {generatePrivateKey,privateKeyToAddress}=require('viem/accounts');const p='.env.local';const t=fs.readFileSync(p,'utf8');if(/^STEALTHPAY_RELAYER_PRIVATE_KEY=0x/m.test(t))throw new Error('already set');const k=generatePrivateKey();fs.writeFileSync(p,t.replace(/^STEALTHPAY_RELAYER_PRIVATE_KEY=.*$/m,'STEALTHPAY_RELAYER_PRIVATE_KEY='+k));console.log('Relayer address - fund with ~0.1 Fuji AVAX:',privateKeyToAddress(k))"
```

There is no separate "relayer address" variable; the app derives it from the key. To see
it again later:

```bash
node -e "const t=require('fs').readFileSync('.env.local','utf8');const k=t.match(/^STEALTHPAY_RELAYER_PRIVATE_KEY=(0x[0-9a-fA-F]{64})/m)[1];console.log(require('viem/accounts').privateKeyToAddress(k))"
```

### 3. Fund the relayer with Fuji AVAX

Send about **0.05–0.1 Fuji AVAX** to the printed relayer address, from the
[Core testnet faucet](https://core.app/tools/testnet-faucet/) (it may ask for a coupon code or
a small mainnet balance) or from another Fuji wallet. At current Fuji fees one announcement
costs a few millionths of an AVAX. If the relayer runs dry, payments still settle. The
announcement then fails with a clear "relayer … has 0 AVAX" message and can be retried after
funding, without charging the sender again.

### 4. Start the app

```bash
npm run dev          # http://localhost:3000
```

Quick server check, with no wallet needed. An empty body should return
`400 WRONG_NETWORK`. If it returns `503 x402_not_configured`, the relayer key is missing.

```bash
curl -s -X POST -H "content-type: application/json" --data "{}" http://localhost:3000/api/x402/stealth-payments
```

### 5. Test an x402 payment

1. **MetaMask:** add **Avalanche Fuji C-Chain**: RPC `https://api.avax-test.network/ext/bc/C/rpc`,
   chain ID `43113`, symbol `AVAX`, explorer `https://testnet.snowtrace.io`. Use two test accounts,
   one for the sender and one for the receiver.
2. **Fund the sender with test USDC** from the [Circle faucet](https://faucet.circle.com) (choose
   Avalanche Fuji). Optionally import the token `0x5425890298aed601595a70AB815c96711a31Bc65` in
   MetaMask to see the balance. The sender needs **no AVAX** for x402, because they only sign.
   The receiver needs nothing.
3. **Receiver:** on **Receive**, connect, create a stealth identity, and copy the meta-address (`st:avax:0x…`).
4. **Sender:** on **Send**, paste the meta-address and choose **USDC**, then:
   1. Enter `0.001`.
   2. Click **Derive one-time address**, then **Review & Send**, then **Confirm & send**.
   3. MetaMask shows a `TransferWithAuthorization` signature, with no gas fee and no approval. Sign it.
5. Expect "Payment sent" with Announcement **Published**, and both transactions on Snowtrace.
6. **Receiver:** **Rescan**. The payment appears, and **Forward** sends it to your normal wallet
   gaslessly. **Activity** on both sides shows the history.

### Environment variable reference

All names below are exactly what the code reads. "Public" values end up in the browser
bundle; "server-only" values are read by API routes only.

| Variable | Scope | Required? | Purpose / where to get it |
|---|---|---|---|
| `NEXT_PUBLIC_FUJI_ANNOUNCER_ADDRESS` | public | required to receive | ERC-5564 Announcer `0x576c…1342` (`contracts/deployments/fuji.json`) |
| `NEXT_PUBLIC_FUJI_ROUTER_ADDRESS` | public | required for AVAX/stUSD sends | StealthPaymentRouter `0xB14D…09cB` (same file) |
| `NEXT_PUBLIC_FUJI_TEST_TOKEN_ADDRESS` | public | optional | stUSD `0xB114…e9C0`. Blank hides stUSD. Not x402-capable (no EIP-3009). |
| `NEXT_PUBLIC_FUJI_SCAN_START_BLOCK` | public | recommended | `60645095`, the Announcer's deployment block. Blank/`0` scans from genesis. |
| `NEXT_PUBLIC_FUJI_X402_ENABLED` | public | required for x402 | `true` shows **USDC (x402)** in Send |
| `NEXT_PUBLIC_FUJI_X402_USDC_ADDRESS` | public | optional | Leave blank: Circle Fuji USDC `0x5425…Bc65`. Local Hardhat only. |
| `NEXT_PUBLIC_FUJI_RPC_URL` | public | optional | Leave blank: public Fuji RPC. A loopback URL enables local Hardhat mode. |
| `NEXT_PUBLIC_FUJI_EXPLORER_API_URL` | public | optional | Leave **unset**: Snowtrace API. An empty value disables fast scanning. |
| `NEXT_PUBLIC_MAINNET_*` (4 vars) | public | not used | Mainnet is out of scope. Leave blank. |
| `X402_FACILITATOR_URL` | server-only | required for x402 | `https://facilitator.payai.network` (no API key). Local Hardhat: `http://127.0.0.1:4022`. |
| `STEALTHPAY_RELAYER_PRIVATE_KEY` | server-only, **SECRET** | required for x402 | Dedicated Fuji relayer key (steps 2–3) |
| `X402_FUJI_RPC_URL` | server-only | optional | Backend RPC override. Blank: same as the app. |
| `STEALTHPAY_X402_STORE_PATH` | server-only | optional | Payment-state file. Blank: `.stealthpay/x402-payments.json` (gitignored, public data only). |
| `SUPABASE_URL` | server-only | optional | Dev-only debug log, see [DEBUG_LOG.md](./DEBUG_LOG.md). Blank: disabled. |
| `SUPABASE_SERVICE_ROLE_KEY` | server-only, **SECRET** | optional | Service-role key for the debug log. Never `NEXT_PUBLIC_`. |

Not in `.env.local`:
- **Deploying contracts** uses `contracts/.env` (`DEPLOYER_PRIVATE_KEY`, `FUJI_RPC_URL`,
  `FUJI_ANNOUNCER_ADDRESS`, `FUJI_PAYMENT_ROUTER_ADDRESS`); see `contracts/.env.example`.
  You don't need it to run or test the app.
- **Local Hardhat testing** writes its own `.env.development.local`. Its helper scripts take
  one-off command-line variables (`LOCAL_SENDER_ADDRESS`, `LOCAL_FUND_ADDRESS`, `LOCAL_FUND_USDC`,
  `LOCAL_RPC_URL`, `LOCAL_FACILITATOR_PORT`, `LOCAL_FACILITATOR_PRIVATE_KEY`); see
  [Local browser testing](#local-browser-testing-hardhat-no-real-funds).
- **Tests** take `LOCAL_STACK_URL`, `LOCAL_STACK_EVIDENCE` and `SKIP_CHAIN_INTEGRATION`, set on the command line.

**Sensitive:** `STEALTHPAY_RELAYER_PRIVATE_KEY`, `SUPABASE_SERVICE_ROLE_KEY` and
`contracts/.env`'s `DEPLOYER_PRIVATE_KEY`. Keep them only in local, gitignored files or a
host's secret store. Everything else is public, on-chain or URL data.

Payment state is a JSON file for a single Node process. Multi-instance or serverless deployments
need a database-backed `PaymentStore` (`src/lib/x402/server/store.ts`).

## Receiver notes

x402 announcements use function identifier `0xe3ee160e` (`transferWithAuthorization`). The scanner
treats them as ERC-20 payments and verifies the USDC balance. Their announcement transaction is sent
by the relayer, so the scanner reports the payer as unknown instead of mislabelling the relayer.
A USDC-only stealth address has no AVAX for gas. The existing Forward dialog sweeps native balances
only, but the derived one-time key can sign an EIP-3009 transfer that any account submits (exercised
in `src/test/integration/x402-stealth-payment.test.ts`).

## Local browser testing (Hardhat, no real funds)

Hosted facilitators (PayAI) cannot reach a local node, so local testing runs the same
`@x402/core` + `@x402/evm` facilitator code as a small local server. The local Hardhat chain uses
**chainId 43113** (the repo's existing Hardhat config), and the app's "Fuji" network is pointed at it
through `.env.development.local`. `next dev` loads that file; `next build` ignores it.

```bash
cd contracts && npx hardhat node                                                  # 1. chain on :8545
npx hardhat run scripts/local-x402-setup.ts --network localhost                  # 2. deploy + write env
LOCAL_FUND_ADDRESS=0xYourPublicAddress npx hardhat run scripts/local-x402-fund.ts --network localhost
cd .. && node scripts/local-x402-facilitator.mjs                                  # 3. facilitator on :4022
npm run dev                                                                       # 4. app on :3000
```

To switch back to public Fuji without losing the local setup, rename `.env.development.local`
to `.env.development.local.hardhat` (Next does not load that name) and restart `next dev`. Rename it
back to return to local Hardhat. The Fuji server settings live in `.env.local`. Note that the public
Fuji RPC caps `eth_getLogs` at 100 blocks; the backend's recovery searches use 100-block windows.

Safety: the setup, fund and facilitator scripts all refuse to run unless the RPC is a loopback
Hardhat node on chainId 43113. In local mode (`NEXT_PUBLIC_FUJI_RPC_URL` on loopback) the app labels
the network "Local Hardhat (43113)", disables the Snowtrace shortcut, and compares the wallet's genesis
block with the app's node. Real Fuji also reports 43113, so a wallet still on public Fuji is blocked
from sending AVAX, stUSD or x402.

MetaMask: add or select an RPC `http://127.0.0.1:8545` for chain ID `43113`. After restarting the
Hardhat node, re-run setup (new chain, new addresses), restart `next dev`, and in MetaMask use
*Settings → Advanced → Clear activity tab data* so it forgets the old local nonces.

Live smoke test against the running stack (sender = Hardhat test account #3, funded with the fund script):

```bash
LOCAL_STACK_URL=http://localhost:3000 npx vitest run --config vitest.integration.config.mts src/test/integration/local-stack.smoke.test.ts
```

## Receiver withdrawal (gasless)

`POST /api/x402/withdrawals` relays an EIP-3009 authorization signed **in the browser** by the
derived one-time key. Only the signature is sent. The facilitator submits it, so the stealth
address needs no AVAX and the receiver's main wallet never touches it. It applies the same
signature, nonce, balance and window checks as payments, and confirms the transfer from the receipt.
It only serves stealth addresses that received a settled x402 payment through this service, so it
cannot be used as a general gas faucet. Privacy note: the backend learns stealth address → destination.

## Tests

- `src/lib/x402/__tests__/x402-unit.test.ts`: intent validation, metadata round-trip, client-side requirement tampering, lock, store.
- `src/test/integration/x402-stealth-payment.test.ts` (`npm run test:integration`): full lifecycle on Hardhat with the **real** `@x402/evm` facilitator and a test-only FiatToken-compatible `MockEIP3009Token`, plus all failure and retry cases.
