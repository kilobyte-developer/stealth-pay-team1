# StealthPay Contract Deployment

> **Fuji testnet only.** There is deliberately no `mainnet` entry in
> `hardhat.config.ts`, and the deployment scripts abort if they detect chain
> 43114. Contracts are **not audited**.

## 1. Status

| Item | Status |
|---|---|
| Contracts written | ✅ `ERC5564Announcer`, `StealthPaymentRouter` |
| Compiled | ✅ solc 0.8.28, `evmVersion: cancun`, optimizer 200 runs |
| Local tests | ✅ 39 passing |
| Cross-layer integration | ✅ 5 passing (real crypto engine ↔ real contracts) |
| **Deployed to Fuji** | ❌ **Not deployed** — no funded deployer key available |
| Deployed to mainnet | ❌ Out of scope, blocked in config |

**No contract addresses exist yet.** Nothing in this repository claims
otherwise. The deployment scripts refuse to run without a funded key rather
than producing a placeholder.

## 2. Avalanche EVM target — determined empirically

The Avalanche docs we could reach do not state a hardfork level, so it was
probed directly from Fuji:

```
eth_getBlockByNumber("latest") on https://api.avax-test.network/ext/bc/C/rpc
  baseFeePerGas          PRESENT  (London)
  blobGasUsed            PRESENT  (Cancun)
  excessBlobGas          PRESENT  (Cancun)
  parentBeaconBlockRoot  PRESENT  (Cancun)
  requestsHash           absent   (Prague)
```

Conclusion: **Fuji C-Chain is at the Cancun EVM level**, so
`evmVersion: "cancun"` is correct. `withdrawalsRoot` is absent because
Avalanche has no beacon-chain withdrawals — expected for a non-Ethereum chain,
not evidence of a pre-Shanghai EVM.

The local Hardhat network is configured with `hardfork: "cancun"` and
`chainId: 43113` so tests exercise the same rules as the deployment target.

These contracts use no Cancun-specific opcodes; the target simply avoids
constraining the compiler unnecessarily.

## 3. The canonical Announcer on Fuji

ERC-5564 names a canonical Announcer at
`0x55649E01B5Df198D18D95b5cc5051630cfD45564`. We checked it rather than
assuming:

| Network | `eth_getCode` | Conclusion |
|---|---|---|
| Avalanche **mainnet** (43114) | 709 bytes | Deployed |
| Avalanche **Fuji** (43113) | `0x` | **Not deployed** |

Run the check yourself:

```bash
cd contracts && npm run check:announcer
```

### Interface verification

The canonical interface was verified against the live mainnet bytecode:

| Item | Value | In mainnet bytecode |
|---|---|---|
| `announce(uint256,address,bytes,bytes)` selector | `0x4d1f9583` | ✅ |
| `Announcement(uint256,address,address,bytes,bytes)` topic0 | `0x5f0eab8057630ba7676c49b4f21a0231414e79474595be8e4c432fbf6bf0f4e7` | ✅ |

Our `ERC5564Announcer` produces **exactly these** — asserted in
`contracts/test/Announcer.test.ts`, so any standards-compatible scanner works
unmodified.

### Documented deviation

Because the canonical address has no code on Fuji, it cannot be reused there.
Reproducing the address would require the original deterministic-deployment
init code and salt, which the ERC does **not** publish — so the address is not
reproducible from the specification alone.

**Decision:** deploy the reference implementation once on Fuji and record the
resulting address. The deployment script refuses to deploy a duplicate if it
finds code at the canonical address, so this deviation self-corrects if the
singleton ever appears on Fuji.

Our compiled runtime bytecode is **518 bytes** vs the canonical **709** — not
byte-identical, because the canonical deployment used different compiler
settings/version and metadata. What matters for interoperability is the event
topic and ABI, which match exactly.

## 4. Architecture

```
Sender wallet
     │  payNative{value} / payERC20{value?}
     ▼
StealthPaymentRouter  ──── transfers ────▶  One-time stealth address
     │                                        (AVAX and/or ERC-20)
     └── announce() ──▶ ERC5564Announcer ──▶ Announcement event
```

- The router is **immutable**: no owner, no pause, no upgrade, no setter for
  the Announcer, no withdraw.
- The router has **no `receive`/`fallback`**, so AVAX cannot enter except
  through the payment functions, which forward it in full. That is why no
  rescue function exists — nothing can be stranded.
- `SCHEME_ID = 1` is a constant, not a parameter, so an unsupported scheme
  cannot be announced through it.
- All derivation happens off-chain. No private key, shared secret or scalar
  touches Solidity.

### Announcement `caller` semantics

The Announcer records `msg.sender`. When the router announces, that is **the
router**, not the payer's EOA. Scanners must not read `caller` as the payer.
The payer remains visible as the transaction's `from`, as it would anyway.
Asserted in `Announcer.test.ts`.

### Metadata layouts

Both are 57 bytes, and the **first byte is always the view tag** per ERC-5564.

Native AVAX:
```
viewTag(1) ‖ 0xeeeeeeee(4) ‖ 0xEeee…EEeE(20) ‖ amount(32)
```

ERC-20:
```
viewTag(1) ‖ 0x23b872dd(4) ‖ token(20) ‖ amount(32)
```

`0x23b872dd` is `transferFrom(address,address,uint256)` — the operation the
router actually performs, pulling from the payer straight to the stealth
address. Exact byte layouts are asserted in tests.

### Gas funding for token payments

A stealth address holding only ERC-20 tokens cannot pay its own gas, so it
cannot move them. `payERC20` accepts an optional `msg.value` which is forwarded
to the same stealth address and announced separately — producing two
independently parseable announcements for one destination (token receipt, gas
receipt).

Funding is **sender-provided on purpose**. Topping the address up later from
the receiver's own wallet would create exactly the public link to the
receiver's identity that stealth addresses exist to avoid.

If no top-up is included the token payment still succeeds, but the destination
needs AVAX from somewhere before it can spend. The UI must say so rather than
implying immediate spendability.

## 5. Deploying to Fuji

### Prerequisites
- A **dedicated** Fuji wallet. Never a mainnet key.
- Test AVAX from <https://core.app/tools/testnet-faucet/>.

```bash
cd contracts
cp .env.example .env     # then fill in DEPLOYER_PRIVATE_KEY
npm install
npm run compile
npm test
```

`.env` is gitignored. The deployer key is server-side only and is never read by
the Next.js app.

### Sequence

```bash
npm run check:announcer      # is the canonical singleton present?
npm run deploy:announcer:fuji
npm run deploy:router:fuji
npm run verify:fuji
npm run export:abi           # refresh src/config/abi for the frontend
```

Addresses are written to `contracts/deployments/fuji.json`, including whether
the Announcer was reused or deployed.

### Guards
- `assertFuji()` aborts on chain 43114 and on any chain that is not 43113.
- `requireFundedDeployer()` aborts when the key is missing or the balance is 0.
- `deploy-announcer` reuses the canonical address if code appears there.
- `deploy-router` refuses if the configured Announcer has no code, and
  re-reads `router.announcer()` afterwards to confirm the immutable wiring.

Verified behaviour with no key configured:

```
$ npm run deploy:announcer:fuji
DEPLOYER_PRIVATE_KEY is not set. Create contracts/.env from .env.example
with a DEDICATED Fuji testnet key. Never use a mainnet key.
```

### `verify-deployment` checks
Chain id · Announcer bytecode · router bytecode · `router.announcer()` wiring ·
`SCHEME_ID == 1` · native sentinel · native selector · `transferFrom` selector ·
canonical selector and topic0 · no admin surface · router holds 0 AVAX.

Read-only; broadcasts nothing.

## 6. Post-deployment checklist

Once a funded key is available, fill this in with **real** values only:

| Item | Value |
|---|---|
| Announcer address | _not deployed_ |
| Router address | _not deployed_ |
| Announcer explorer | _pending_ |
| Router explorer | _pending_ |
| Native test payment tx | _pending_ |
| ERC-20 test payment tx | _pending_ |
| ERC-20 + gas top-up tx | _pending_ |
| Deployer address | _pending_ |

Then:
1. `npm run verify:fuji` — all checks must pass.
2. Small native payment; confirm the destination balance and the Announcement log.
3. Small ERC-20 payment; confirm balance and metadata.
4. ERC-20 with gas top-up; confirm **two** announcements and both balances.
5. `npm run export:abi` and set the frontend contract addresses.

Do not populate the frontend contract config until `verify:fuji` passes.

## 7. Frontend wiring

`src/config/networks.ts` exposes `CONTRACTS` with `announcer` and `router` per
network, both `null` today. ABIs are generated into `src/config/abi/` by
`npm run export:abi`.

Only ABIs cross the boundary — never bytecode, never deployment keys. The
Next.js app has no reason to compile or deploy contracts, and
`contracts/` is a separate npm project so Hardhat never enters the Next build.

## 8. What is still missing before mainnet

- Smart-contract security audit.
- Cryptographic / key-management review.
- Live event scanner with chain-reorganisation handling.
- A supported-token policy (fee-on-transfer and rebasing tokens are rejected,
  but a token that misreports `balanceOf` can still defeat the delta check).
- External ERC-5564 interoperability testing against another implementation.
- Operational monitoring and incident response.

**StealthPay is not mainnet-ready after this milestone.**
