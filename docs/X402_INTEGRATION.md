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

## Configuration

Frontend (`.env`, public):

| Variable | |
|---|---|
| `NEXT_PUBLIC_FUJI_X402_ENABLED=true` | Shows **USDC** (x402) in the Send asset list |
| `NEXT_PUBLIC_FUJI_ANNOUNCER_ADDRESS` | Existing; also used by the backend |

Backend (`.env.local` or the host's secret store. **Never** `NEXT_PUBLIC_`):

| Variable | |
|---|---|
| `X402_FACILITATOR_URL` | e.g. `https://facilitator.payai.network` (lists `exact` on `eip155:43113`) |
| `STEALTHPAY_RELAYER_PRIVATE_KEY` | Dedicated Fuji account with a little AVAX. It only calls `announce()` and never holds tokens. |
| `X402_FUJI_RPC_URL` | Optional; defaults to the public Fuji RPC |
| `STEALTHPAY_X402_STORE_PATH` | Optional; defaults to `.stealthpay/x402-payments.json` (gitignored) |

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
