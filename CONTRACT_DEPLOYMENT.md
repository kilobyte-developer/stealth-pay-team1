# StealthPay — Contract Deployment Registry

> **This is the permanent, factual record of StealthPay's on-chain deployment
> state.** Every address, hash, and block number here is either verified
> on-chain or explicitly marked `Pending` / `Not started` / `Not deployed`.
> Nothing in this document is invented. See [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md)
> for deployment procedure and rationale; this file tracks actual results.

---

## A. Project Deployment Overview

| Field | Value |
|---|---|
| Project | StealthPay |
| Program | Team1 India – Speedrun 2026 |
| Deployment environment | Avalanche Fuji Testnet **only** |
| Network name | Avalanche Fuji C-Chain |
| Chain ID | `43113` |
| RPC endpoint | `https://api.avax-test.network/ext/bc/C/rpc` |
| Native currency | AVAX (testnet — no real-world value) |
| Explorer | https://testnet.snowtrace.io (also reachable via https://build.avax.network/explorer/fuji/c-chain) |
| **Deployment status** | **LIVE on Fuji.** Announcer, Router, and the ERC-20 test token are all deployed, verified on Snowtrace, and confirmed working together by a real on-chain smoke test. See §B–§H for details. |
| Mainnet deployment | **Explicitly out of scope and blocked.** `contracts/hardhat.config.ts` defines no `mainnet` network entry; `assertFuji()` in every script throws if chain id is `43114`. |
| Last updated | 2026-11-07 — live Fuji deployment of all three contracts, Snowtrace verification, frontend wiring, and the live smoke test (see §G, §H, §K). |

---

## B. Contract Deployment Registry

| Contract Name | Solidity File | Network | Chain ID | Deployed Address | Deployment Status |
|---|---|---|---|---|---|
| ERC5564Announcer | `contracts/ERC5564Announcer.sol` | Fuji | 43113 | `0x576c07eba9A19e2c31da9359193b7f3F70a21342` | **Deployed & verified** |
| StealthPaymentRouter | `contracts/StealthPaymentRouter.sol` | Fuji | 43113 | `0xB14D5665f5BF628e8D297E252b0f09C4B42009cB` | **Deployed & verified** |
| StealthPayTestToken | `contracts/StealthPayTestToken.sol` | Fuji | 43113 | `0xB114A2B17F1E7b028249cCFec2D98D25a3Bbe9C0` | **Deployed & verified** |

Every address above was confirmed via `eth_getCode` returning non-`0x` bytecode at that exact address (see §K's `verify:fuji` run), and each contract's source is independently verified on Snowtrace (see §D and §C.2/§C.3).

---

## C. Deployment Details Per Contract

### C.1 ERC5564Announcer

| Field | Value |
|---|---|
| Contract name | `ERC5564Announcer` |
| Source file | `contracts/contracts/ERC5564Announcer.sol` |
| Solidity version | `0.8.28` (pragma-pinned, exact) |
| Compiler (solc) | `0.8.28` per `contracts/hardhat.config.ts`; exact long-version string not yet extracted from `build-info` (will be recorded at deployment time) |
| Optimizer | enabled, `runs: 200` |
| EVM target | `cancun` — determined empirically from live Fuji block headers (see [docs/DEPLOYMENT.md §2](./docs/DEPLOYMENT.md)), not assumed from documentation |
| Constructor arguments | none |
| Compiled runtime bytecode size | 518 bytes (local artifact, verified via `node` against `contracts/artifacts/contracts/ERC5564Announcer.sol/ERC5564Announcer.json`) |
| Network | Fuji (43113) |
| Deployed address | `0x576c07eba9A19e2c31da9359193b7f3F70a21342` |
| Deployment tx hash | `0x90c6ca6902ed4f590d860712701b207c3fa9faab049075124b5ff3b2f29e6f1e` |
| Deployment block | `60645095` |
| Deployer address | `0x180A8E81f50ed8Ca5C39D8F7316605bEbB72B283` |
| Gas used | `165,307` (exact match to the local pre-deployment estimate in §L.2) |
| Effective gas price | `160` wei |
| Deployment timestamp | 2026-11-06T20:15:34.000Z (block timestamp) |
| Explorer URL | https://testnet.snowtrace.io/address/0x576c07eba9A19e2c31da9359193b7f3F70a21342 |
| Verification status | **Verified** — source matches `contracts/ERC5564Announcer.sol:ERC5564Announcer` exactly. First `hardhat verify` call reported "already verified": Snowtrace/Routescan had auto-matched our byte-identical bytecode to a DIFFERENT, unrelated project's already-verified source (`StealthAddressAnnouncer`, licensed CC0-1.0, pragma `^0.8.20` — confirmed by querying the Snowtrace API directly). Re-ran with `--force` to submit our own source, confirmed afterward via the same API query that it now shows `contracts/ERC5564Announcer.sol`, MIT license, pragma `0.8.28`. |
| Bytecode verification (`eth_getCode`) | **Confirmed present**, 518 bytes, via `npm run verify:fuji` (§K) |

### C.2 StealthPaymentRouter

| Field | Value |
|---|---|
| Contract name | `StealthPaymentRouter` |
| Source file | `contracts/contracts/StealthPaymentRouter.sol` |
| Solidity version | `0.8.28` |
| Compiler (solc) | `0.8.28`, optimizer `runs: 200` |
| EVM target | `cancun` |
| Constructor arguments | `announcer_` = `0x576c07eba9A19e2c31da9359193b7f3F70a21342` (the deployed Announcer from C.1) |
| Compiled runtime bytecode size | 3,057 bytes (local artifact) |
| Network | Fuji (43113) |
| Deployed address | `0xB14D5665f5BF628e8D297E252b0f09C4B42009cB` |
| Deployment tx hash | `0x1788dae3e3723f4de5f4cfaf93c24dae86098f477a0f2b39932e970502ba2539` |
| Deployment block | `60646870` |
| Deployer address | `0x180A8E81f50ed8Ca5C39D8F7316605bEbB72B283` |
| Gas used | `738,649` (exact match to the local pre-deployment estimate in §L.2) |
| Effective gas price | `160` wei |
| Deployment timestamp | 2026-11-06T21:00:22.000Z (block timestamp) |
| Explorer URL | https://testnet.snowtrace.io/address/0xB14D5665f5BF628e8D297E252b0f09C4B42009cB |
| Verification status | **Verified** on first attempt — source matches `contracts/StealthPaymentRouter.sol:StealthPaymentRouter` exactly, compiler `v0.8.28+commit.7893614a` |
| Configured Announcer address (immutable) | Read back from `router.announcer()` on-chain: `0x576c07eba9A19e2c31da9359193b7f3F70a21342` — **confirmed to exactly match C.1** |
| Scheme ID | `1` (hard-coded `constant`, not configurable — read back on-chain as `1`, confirmed in 39 passing contract tests) |
| Verified immutable configuration | **Confirmed on-chain** via `npm run verify:fuji` — all 12 checks passed (§K): Announcer wiring, `SCHEME_ID`, native sentinel/selector, ERC-20 selector, canonical interface match, no admin surface, zero retained balance |

### C.3 StealthPayTestToken

| Field | Value |
|---|---|
| Contract name | `StealthPayTestToken` |
| Source file | `contracts/contracts/StealthPayTestToken.sol` |
| Solidity version | `0.8.28` |
| Constructor arguments | none |
| Network | Fuji (43113) |
| Deployed address | `0xB114A2B17F1E7b028249cCFec2D98D25a3Bbe9C0` |
| Deployment tx hash | `0xbda4e371eb64d173bb2aefd155f661a18c42135c855d196a299fb871521a8b95` |
| Deployment block | `60646887` |
| Deployer address | `0x180A8E81f50ed8Ca5C39D8F7316605bEbB72B283` |
| Gas used | `591,803` |
| Effective gas price | `160` wei |
| Deployment timestamp | 2026-11-06T21:00:42.000Z (block timestamp) |
| Initial faucet mint | `10,000 stUSD` to the deployer, tx `0xfe08436137aab578c5593673943e10bd732078e3688b21866a97d812dd1caf76` (block `60646891`, gas `68,395`, confirmed success) |
| Explorer URL | https://testnet.snowtrace.io/address/0xB114A2B17F1E7b028249cCFec2D98D25a3Bbe9C0 |
| Verification status | **Verified** on first attempt — source matches `contracts/StealthPayTestToken.sol:StealthPayTestToken` exactly, compiler `v0.8.28+commit.7893614a` |

---

## D. Announcer Verification

| Check | Result |
|---|---|
| Canonical ERC-5564 address | `0x55649E01B5Df198D18D95b5cc5051630cfD45564` |
| `eth_getCode` on Fuji (43113) | `0x` — **no code present**, re-confirmed live immediately before deployment via `npm run check:announcer` (2026-11-07) |
| `eth_getCode` on Avalanche mainnet (43114) | 709 bytes — code **is** present there (verified during Milestone 3; mainnet is not our deployment target, checked only for interface reference) |
| Canonical deterministic deployer | `0x4e59b44847b379578588920ca78fbf26c0b4956c` — present on Fuji (confirmed in §L.1), but canonical CREATE2 reproduction was not pursued (see below) |
| Canonical CREATE2 salt | `0xd0103a290d760f027c9ca72675f5121d725397fb2f618f05b6c44958b25b4447` (per this milestone's brief) — **reproduction not attempted**; deploying the reference implementation directly was simpler and equally standards-compliant |
| Deployed instance type | `deployed-reference` — our own `ERC5564Announcer.sol`, deployed fresh to a new Fuji address (not a reuse of the canonical singleton, which has no code on Fuji) |
| Actual deployed address | `0x576c07eba9A19e2c31da9359193b7f3F70a21342` |
| Event signature | `Announcement(uint256 indexed schemeId, address indexed stealthAddress, address indexed caller, bytes ephemeralPubKey, bytes metadata)` |
| Event topic0 | `0x5f0eab8057630ba7676c49b4f21a0231414e79474595be8e4c432fbf6bf0f4e7` — independently recomputed via `ethers.id(...)` in `contracts/test/Announcer.test.ts` and matched against the live mainnet bytecode (Milestone 3) |
| `announce()` selector | `0x4d1f9583` — same verification method |
| ABI compatibility | Confirmed structurally equivalent to the canonical interface (identical event topic0 + function selector, both present in the canonical mainnet bytecode). **Not** byte-identical bytecode (ours: 518 bytes vs. canonical mainnet: 709 bytes) — different compiler version/settings/metadata produce different bytecode for an equivalent interface. This distinction is deliberately preserved rather than glossed over. |
| Reference implementation source | `contracts/contracts/ERC5564Announcer.sol` + `contracts/contracts/interfaces/IERC5564Announcer.sol` (StealthPay's own implementation of the published ERC-5564 interface — not a copy-pasted third-party reference, written to match the spec and verified against live mainnet bytecode) |

**Important distinction, maintained now that deployment has happened:** `0x576c07eba9A19e2c31da9359193b7f3F70a21342` is **compatible with**, but is **NOT**, the canonical ERC-5564 singleton address (`0x55649E...45564`). This document never describes it as "the canonical Announcer" — only as "a Fuji-deployed, interface-compatible Announcer."

---

## E. PaymentRouter Configuration

| Property | Value |
|---|---|
| Announcer dependency | Immutable (`IERC5564Announcer public immutable announcer`), set once at construction, no setter exists |
| Native payment function | `payNative(address stealthAddress, bytes calldata ephemeralPubKey, bytes1 viewTag) external payable` |
| ERC-20 payment function | `payERC20(address token, address stealthAddress, uint256 amount, bytes calldata ephemeralPubKey, bytes1 viewTag) external payable` |
| Gas top-up support | Yes — `payERC20`'s optional `msg.value` is forwarded to the same stealth address and announced as a separate native-asset `Announcement` |
| Scheme ID | `1`, hard-coded `constant`, not a parameter |
| Atomic transfer behavior | Transfer + announcement occur in one transaction; any failure (including Announcer revert) reverts the whole transaction. Verified by dedicated atomicity tests in `contracts/test/PaymentRouter.native.test.ts` and `PaymentRouter.erc20.test.ts` (39 passing contract tests total). |
| Supported token policy | Standard ERC-20 only. Fee-on-transfer and rebasing tokens are **rejected** (exact-delta balance check). A token that misreports its own `balanceOf` can still defeat this check — documented as an inherent limitation, not fixed by this contract. |
| Admin surface | None — no owner, no pause, no upgrade, no withdraw/sweep/rescue function (verified by `verify-deployment.ts` and by a dedicated security test) |
| Fund custody | None — no `receive`/`fallback`; AVAX can only enter through `payNative`/`payERC20`, which forward it in full within the same transaction |

---

## F. Frontend Integration

| Field | Value |
|---|---|
| Environment variable — Fuji Announcer | `NEXT_PUBLIC_FUJI_ANNOUNCER_ADDRESS` (defined in root `.env.example`, consumed by `src/config/networks.ts`) |
| Environment variable — Fuji Router | `NEXT_PUBLIC_FUJI_ROUTER_ADDRESS` |
| Environment variable — Mainnet Announcer | `NEXT_PUBLIC_MAINNET_ANNOUNCER_ADDRESS` (present for symmetry; mainnet is out of scope and will remain unset) |
| Environment variable — Mainnet Router | `NEXT_PUBLIC_MAINNET_ROUTER_ADDRESS` |
| Environment variable — Fuji test token | `NEXT_PUBLIC_FUJI_TEST_TOKEN_ADDRESS` (added 2026-11-07; consumed by `assetsFor()` in `src/config/networks.ts` to decide whether the ERC-20 asset appears in the Send/Receive UI at all) |
| Environment variable — Mainnet test token | `NEXT_PUBLIC_MAINNET_TEST_TOKEN_ADDRESS` |
| Scan start block | `NEXT_PUBLIC_FUJI_SCAN_START_BLOCK` — set to `60645095`, the Announcer's deployment block, so the scanner does not walk the entire chain history |
| Current value in root `.env` | `NEXT_PUBLIC_FUJI_ANNOUNCER_ADDRESS=0x576c07eba9A19e2c31da9359193b7f3F70a21342`, `NEXT_PUBLIC_FUJI_ROUTER_ADDRESS=0xB14D5665f5BF628e8D297E252b0f09C4B42009cB`, `NEXT_PUBLIC_FUJI_TEST_TOKEN_ADDRESS=0xB114A2B17F1E7b028249cCFec2D98D25a3Bbe9C0`. Mainnet variables remain empty (out of scope). |
| Configured chain ID | `43113` (Fuji), hard-coded in `src/config/networks.ts`, not an env var |
| ABI files | `src/config/abi/ERC5564Announcer.ts`, `src/config/abi/StealthPaymentRouter.ts`, `src/config/abi/index.ts` — re-exported via `npm run export:abi` after deployment (2026-11-07); diffed against the pre-deployment export and found byte-identical, since the contract source never changed, only its address. `StealthPayTestToken` needs no dedicated ABI export — the frontend talks to it with viem's standard `erc20Abi`. |
| Integration status | **Live.** `isPaymentsConfigured()` now returns `true` for Fuji; confirmed in a running browser session (`/settings` shows "Fuji Testnet: configured", and a stale hardcoded sentence that used to contradict that badge was fixed in the same pass — see §J.5). `assetsFor()` now surfaces a real `stUSD` option in the Send form, confirmed in-browser. |
| Verification date | 2026-11-07 — confirmed via a real browser session against a freshly restarted dev server (see §K's post-deployment re-run) |

No secret environment variable (deployer private key, vault password, user private key) is recorded in this document, per Rule 4.

---

## G. Deployment Transaction History

| Date | Operation | Contract | Transaction Hash | Block | Status |
|---|---|---|---|---|---|
| 2026-11-06 | Deploy | ERC5564Announcer | `0x90c6ca6902ed4f590d860712701b207c3fa9faab049075124b5ff3b2f29e6f1e` | 60645095 | Success |
| 2026-11-06 | Deploy | StealthPaymentRouter | `0x1788dae3e3723f4de5f4cfaf93c24dae86098f477a0f2b39932e970502ba2539` | 60646870 | Success |
| 2026-11-06 | Deploy | StealthPayTestToken | `0xbda4e371eb64d173bb2aefd155f661a18c42135c855d196a299fb871521a8b95` | 60646887 | Success |
| 2026-11-06 | Faucet mint (10,000 stUSD to deployer) | StealthPayTestToken | `0xfe08436137aab578c5593673943e10bd732078e3688b21866a97d812dd1caf76` | 60646891 | Success |

This table is appended to, never rewritten, as real deployments happen.

---

## H. Test Transaction Registry

All three rows below are from `npm run smoke:fuji` (plumbing-only — fixed test-vector ephemeral key/view tag, not real ERC-5564 derivation; see the script's own header and §L.3). The real stealth-derivation end-to-end test via the frontend is still pending (§I).

| Test | Asset | Sender | Stealth Destination | Amount | Transaction Hash | Status |
|---|---|---|---|---|---|---|
| Native payment | AVAX | `0x180A8E81f50ed8Ca5C39D8F7316605bEbB72B283` | `0x92C24C5504355e2a41E1A95E2c31B245f4C6c0f1` (throwaway) | 0.001 AVAX | `0x4b55a88c3264f09a9340800e089be145cea6ef26a3df3dff115891c6b7dc777d` | Success — delivered amount verified exact, Announcement decoded and checked |
| ERC-20 payment | stUSD | `0x180A8E81f50ed8Ca5C39D8F7316605bEbB72B283` | `0x409710B4D28F363e2491e51ecFceebDbE4d78F50` (throwaway) | 1.0 stUSD | `0x742420bc97190576cfe15f66be354e20f34124e6da53a2b45140ffa29dd7d52b` | Success — token balance delivered exact |
| AVAX gas top-up | AVAX | `0x180A8E81f50ed8Ca5C39D8F7316605bEbB72B283` | `0x409710B4D28F363e2491e51ecFceebDbE4d78F50` (same tx as above) | 0.0005 AVAX | `0x742420bc97190576cfe15f66be354e20f34124e6da53a2b45140ffa29dd7d52b` | Success — two independent Announcements decoded from the one transaction, both verified |

### Real user-driven E2E test (in progress, 2026-11-07)

Not the smoke test — this is the actual frontend-driven flow with real ERC-5564 derivation, done by the user through a real browser wallet (Trust Wallet, address `0x180a8e81f5...72b283`).

| Leg | Asset | Amount | Stealth destination | Transaction Hash | Status |
|---|---|---|---|---|---|
| Send (via `/send`, real stealth derivation) | AVAX | 0.1 | `0x266EC28c7dDE701D749c6189fEd59dDc15799a4e` | `0x70c48146b336fc9c4ad7ee0d781c4166a5d91e0884057fcb713ae15a1fe727d2` | **Success** — confirmed on Fuji, UI showed the real tx hash, view tag `0xc3` |
| Detect (via `/receive` → Incoming Payments scanner) | — | — | — | — | **Was failing** with two real bugs on first attempts (§J.9, §J.10), both fixed in code. **Not yet re-confirmed working** by the user against this real payment. |

---

## I. Final Deployment Status

| Milestone item | Status |
|---|---|
| Dedicated Fuji deployer wallet created | **Done** — user-provided, address `0x180A8E81f50ed8Ca5C39D8F7316605bEbB72B283` |
| Deployer funded | **Done** — confirmed `1.2 AVAX` prior to deployment, `~1.1999 AVAX` remaining after all deployments and the smoke test |
| Environment configured (`contracts/.env`) | **Done** — created by the user; deployer key format verified (length/prefix/hex-only) without ever being displayed |
| Announcer deployment | **Done** — `0x576c07eba9A19e2c31da9359193b7f3F70a21342` (§C.1) |
| Router deployment | **Done** — `0xB14D5665f5BF628e8D297E252b0f09C4B42009cB` (§C.2) |
| Test token deployment | **Done** — `0xB114A2B17F1E7b028249cCFec2D98D25a3Bbe9C0` (§C.3) |
| Contract verification (source/explorer) | **Done** — all three verified on Snowtrace with matching source (§C.1–§C.3). One real snag hit and fixed: the Announcer's bytecode was initially auto-matched by Routescan to an unrelated project's source; `--force` re-submission corrected it to our own `ERC5564Announcer.sol`. |
| Frontend configuration | **Done** — root `.env` updated with all three addresses and the real scan-start block (§F) |
| Native AVAX transaction | **Done, both ways.** Plumbing smoke test passed (§H). **Separately, the real frontend-driven send also succeeded** — the user sent 0.1 AVAX through `/send` with real ERC-5564 derivation via Trust Wallet, confirmed on Snowtrace (§H's "Real user-driven E2E test" table). |
| ERC-20 transaction | **Done (plumbing-only)** — smoke test, §H. Not yet exercised through the frontend by the user. |
| Scanner detection | **Three real bugs hit by the user on real use, all fixed (§J.9, §J.10, §J.11), with the root cause fixed properly, not patched around.** §J.9: hardcoded chunk size wider than the RPC's cap. §J.10: an unretried transient network failure. §J.11, the real underlying problem: the RPC-chunked approach could take 15+ minutes for a from-scratch scan, which is why the user kept reporting "not working" even after J.9/J.10 — switched to Snowtrace's indexer API as the primary path, confirmed live: the same real scan that didn't finish in 10 minutes completed in **1.72 seconds** and found the user's real payment. **Not yet re-confirmed by the user in their own browser** — that's the next thing to try, but there is now direct evidence it will work and work fast. |
| Full end-to-end test | **Send leg done, with a real result** (§H). Scan/detect leg: code fixed, verified live via a direct scanner run that found the user's real payment in 1.72s — not yet re-confirmed in the user's own browser session. Forward leg: implemented, proven on a local test chain, not yet exercised on Fuji. |
| Spending/forwarding from a detected stealth address | **Implemented in code, proven against a real local Hardhat node** (`src/test/integration/payment-round-trip.test.ts` — destination receives the exact swept amount, source left at exactly zero). **Not yet exercised against live Fuji**, which falls under the full end-to-end test above. |

---

## J. Phase 0 Audit Findings

Recorded here because Rule 6 (honest reporting) requires surfacing discrepancies, not silently working around them.

1. ~~**`package.json` references a script that does not exist.**~~ **Resolved 2026-11-07.** `contracts/scripts/fuji-smoke-payment.ts` now exists (plumbing-only smoke test — it deliberately does NOT use real ERC-5564 derivation, since the ESM-only crypto engine cannot run inside Hardhat's CJS script runtime; it uses a fixed, clearly-labelled test vector for the ephemeral key/view tag and verifies the real on-chain transfer + Announcement wiring instead). `contracts/scripts/deploy-test-token.ts` was also added, deploying `StealthPayTestToken.sol`. Neither has been run against live Fuji yet — both require Phase 1+ (funded deployer, deployed Announcer/Router) to execute.
2. **Git working tree is clean**, 1 local commit ahead of `origin/main` (not pushed — no action taken, not in scope for this milestone).
3. **ABIs are already exported** from a prior session (`src/config/abi/`), but will be re-exported after real deployment per the existing `docs/DEPLOYMENT.md` procedure, since the current export was generated before any address existed and must be treated as potentially stale.
4. ~~**No `contracts/deployments/` directory exists yet**~~ — superseded; `contracts/deployments/fuji.json` now exists and is the live deployment record backing §C.
5. **Deployer-key format mismatch, caught before it could cause harm.** The user's first attempt to fill `contracts/.env`'s `DEPLOYER_PRIVATE_KEY` produced a value shaped like a CryptoJS/OpenSSL encrypted blob (`Salted__` base64 signature), not a raw hex key, and it first landed in the TRACKED `contracts/.env.example` template rather than the gitignored `contracts/.env` (caught via `git status` before anything was staged or committed — no secret ever reached git history). A second attempt produced valid-looking hex but one character short (63 instead of 64). All three issues were caught via format-only checks (length, prefix, hex-ness) that never printed the actual value, and the user corrected each by re-copying directly from Trust Wallet's "Show Private Key" screen. Final key verified working by deriving its address with Hardhat and confirming it matched the address the user had given earlier, with a live, correct balance.
6. **`deploy-router.ts` and `verify-deployment.ts` had a real, pre-existing bug**, found only by actually running them: both used `process.env.FUJI_ANNOUNCER_ADDRESS ?? record.announcer`. Because `.env.example`'s template (and the user's copied `.env`) defines `FUJI_ANNOUNCER_ADDRESS=` as an explicit empty string, `??` never fell through to the recorded address (`??` only falls back on `null`/`undefined`, not `""`), so `deploy-router.ts` failed with "No Announcer address known" immediately after a successful Announcer deployment. Fixed by adding `envOverride()` to `contracts/scripts/lib.ts` (treats a blank/whitespace-only env value as absent) and using it at both call sites. Not a workaround — the real bug was in the override-resolution logic, not the deployment flow.
7. **A long-running dev server (4+ hours, surviving many structural refactors via Turbopack HMR) was serving stale module state** by the time deployment finished — `/send` intermittently logged a wrapped "Could not validate `instant`" render error with no corresponding source in this codebase. A full `next build` was clean throughout, confirming the issue was dev-server-only. Restarting the dev server from scratch resolved it; the first few seconds of the restart replayed OLD cached error logs from mid-session edits (e.g. a self-caught `rescan` duplicate-parameter typo, reverted before it was ever run) that had nothing to do with current file contents, which could otherwise be mistaken for a live regression.
8. **Stale hardcoded copy on the Settings page, found by checking the live UI rather than trusting the build.** `src/components/settings/settings-view.tsx`'s "Contract configuration" row had a hardcoded hint — "have not been deployed yet... No addresses are configured on any network" — written during an earlier milestone before anything was deployed. After deployment it sat directly above a badge correctly reading "Fuji Testnet: configured", visibly contradicting it. Fixed by computing the hint from the same `CONTRACTS` data the badge already reads, confirmed in a live browser session afterward.
9. **Real bug, reported directly by the user: the receiver-side scanner crashed with "Could not scan announcements."** Root cause: `src/lib/scanner/announcement-scanner.ts` requested `eth_getLogs` in 2,000-block chunks (`DEFAULT_CHUNK`), but the public Fuji RPC (`api.avax-test.network`) caps `eth_getLogs` at 100 blocks per call and errors with "block range too large... exceeds the maximum of 100 blocks." This was never hit in earlier testing because no identity had scanned a live range wide enough to trigger it before now. **Fixed** by making the scan loop adaptive: on a range-too-large error it parses the provider's stated limit out of the error message (or halves the window if none is stated) and retries the same cursor position with the smaller window, remembering the smaller size for the rest of the scan — no hardcoded "100" that could be wrong for a different RPC. Verified against the live deployed Announcer: the fixed scanner correctly found all 3 real smoke-test announcements with zero errors.
   - **Secondary finding while verifying the fix:** the public Fuji RPC is also severely, intermittently rate-limited — a live test scanning ~9,200 blocks at the required 100-block chunk size hit two stalls of roughly 60 seconds each within the first 21 requests (fast otherwise, ~250ms/request). This is the RPC's behavior, not a bug in this codebase — the fix above makes the scan *correct*, but this specific free public endpoint will still make it feel slow, and that slowness will grow as more blocks pass since the Announcer's deployment block. **Recommendation, tying back to the still-unanswered "custom RPC" question from the original readiness audit:** a free-tier dedicated RPC (Infura, Alchemy, Ankr, QuickNode, etc. all support Avalanche Fuji) would very likely both raise the 100-block cap and remove the rate-limit stalls. If the user provides one, it is a one-line change (`FUJI_RPC_URL` in both `.env` files).
   - **Also fixed in the same pass:** `scanAnnouncements` now sorts its returned `payments` newest-block-first before returning. Previously it returned them in ascending (oldest-first) scan order, and `src/components/dashboard/dashboard-overview.tsx`'s "Recent payments" panel does an unsorted `.slice(0, 5)` — meaning it was silently showing the 5 *oldest* detected payments, not the 5 most recent. `ActivityView` was unaffected since it already sorts independently.
10. **Second real scanner failure, hit by the user moments after §J.9 was fixed and deployed: "Failed to fetch."** This happened while the user had just completed a real send through the frontend (0.1 AVAX, real stealth derivation, confirmed on Snowtrace — see §H's new "Real user-driven E2E test" table) and was trying to detect it on the receiver side. Investigated rather than assumed: confirmed directly against the live RPC that (a) it was responding normally seconds later, (b) it sends a correct `access-control-allow-origin` header for `http://localhost:3000`, ruling out a structural CORS block — so this was a transient connection failure, consistent with the same RPC flakiness already documented in §J.9's secondary finding, just manifesting as a hard failure instead of a slow response this time. **Fixed** by adding a bounded retry-with-backoff (3 attempts, 500ms/1.5s/4s) around each chunk's `eth_getLogs` call for any transient failure, separate from the range-too-large handling in §J.9 (which needs a smaller window, not a retry of the same one). Previously, any single blip anywhere in a scan — and on this RPC, over a long scan, a blip is likely — forced the user to manually restart the *entire* scan from the configured start block via "Try again."
11. **Root cause of the user's "I still don't see my payment" report, found by measuring rather than guessing.** First, fetched the user's actual send transaction's receipt directly and decoded its Announcement event: it was perfectly correct on-chain (stealth address, view tag, amount all matched what the Send UI showed). So the problem was purely about whether the receiver's scan had reached that block yet. Ran the actual scanner code live, with full progress logging, against the real range: **after 10 full minutes it had covered barely 60% of the ~9,600-block range** — the public Fuji RPC's 100-block-per-call cap combined with its intermittent multi-minute stalls (§J.9) made a from-scratch scan take potentially 15+ minutes, which for a user checking "did my payment arrive" is indistinguishable from broken. **Fixed properly, not patched:** the scanner now tries Snowtrace's Etherscan-compatible indexer API (`module=logs&action=getLogs`) first — a single request answers the entire range, since an indexer has no raw-node block-range cap — and only falls back to the existing chunked `eth_getLogs` walk if that request fails for any reason (confirmed CORS-safe for browser use: `access-control-allow-origin: *`). Verified live, end to end: the exact same scan that didn't finish in 10 minutes via the RPC path **completed in 1.72 seconds** via the explorer API and found all real announcements including the user's real payment. One real data-quality issue handled along the way: this API's `logIndex` field is unreliable (always the empty string `"0x"`), which would have collided the IDs of two announcements from the same transaction (e.g. an ERC-20 leg and its native top-up leg) — fixed by assigning a synthetic per-transaction sequential index from the result's own emission order instead of trusting the field.
12. **Also fixed in the same pass:** `NEXT_PUBLIC_FUJI_SCAN_START_BLOCK` was set to the *Announcer's* deployment block, but no payment announcement can exist before the *Router* (which is what actually calls `announce()`) was deployed, ~1,775 blocks later. Moved the configured start block forward to the Router's deployment block (`60646870`), trimming dead range off every scan — small next to the explorer-API fix above, but free and correct.

---

## K. Quality Gate Results

### Phase 0 (2026-11-06)

All commands below were executed during the Phase 0 audit, on the current `main` branch, with no code changes made.

| Gate | Command | Result |
|---|---|---|
| TypeScript typecheck | `npm run typecheck` | ✅ PASS — 0 errors |
| ESLint | `npm run lint` | ✅ PASS — 0 errors, 0 warnings |
| Unit tests (Vitest) | `npm test` | ✅ PASS — 101/101 tests, 10/10 files |
| Contract tests (Hardhat) | `npm run test:contracts` | ✅ PASS — 39/39 tests |
| Cross-layer integration tests | `npm run test:integration` | ✅ PASS — 5/5 tests (real crypto engine against a local Hardhat node) |
| Production build | `npm run build` | ✅ PASS — compiled, typechecked, 9/9 routes prerendered |

No test was skipped, mocked around, or assumed. All six gates ran to completion with real exit codes captured.

### Post-implementation re-run (2026-11-07)

Re-run after implementing the full set of gaps identified in §L: ERC-20 availability driven by real config (no `planned` placeholder assets), the ERC-20 `approve()` flow, the gas-top-up UI control, `forwardPayment()` (real local-signing spend/forward), `StealthPayTestToken.sol`, `deploy-test-token.ts`, `fuji-smoke-payment.ts`, and the Snowtrace verification config.

| Gate | Command | Result |
|---|---|---|
| TypeScript typecheck | `npm run typecheck` | ✅ PASS — 0 errors |
| ESLint | `npm run lint` | ✅ PASS — 0 errors, 0 warnings |
| Unit tests (Vitest) | `npm test` | ✅ PASS — 101/101 tests, 10/10 files (unchanged — the new logic is chain-facing and covered below, not with mocks) |
| Contract tests (Hardhat) | `npm run test:contracts` | ✅ PASS — 39/39 tests (unchanged; `StealthPayTestToken` is additive and untested by this suite — it is exercised by `fuji-smoke-payment.ts` instead) |
| Cross-layer integration tests | `npm run test:integration` | ✅ PASS — 6/6 tests (real crypto engine against a local Hardhat node). New: a forward/sweep test that derives the one-time key, signs locally with `privateKeyToAccount`, and sweeps a real native payment to an unrelated throwaway address, asserting the destination receives the exact swept amount and the source is left at exactly zero. |
| Production build | `npm run build` | ✅ PASS — compiled, typechecked, 9/9 routes prerendered |
| Contract compile | `npx hardhat compile` (in `contracts/`) | ✅ PASS — `StealthPayTestToken.sol` compiles cleanly alongside the existing contracts |

Neither `fuji-smoke-payment.ts` nor `deploy-test-token.ts` had been run against live Fuji at this point — both required a funded deployer and `contracts/.env`, which did not exist yet.

### Live Fuji deployment (2026-11-06 → 2026-11-07)

Once `contracts/.env` was created and verified (§J.5), the actual deployment proceeded. All of the following are real on-chain results, not estimates — see §C, §G, §H for the underlying addresses/hashes.

| Step | Command | Result |
|---|---|---|
| Canonical Announcer re-check | `npm run check:announcer` | ✅ Confirmed still absent on Fuji immediately before deploying our own |
| Announcer deployment | `npm run deploy:announcer:fuji` | ✅ Deployed, gas used matched the local pre-deployment estimate exactly (165,307) |
| Router deployment | `npm run deploy:router:fuji` | ❌ then ✅ — first attempt failed on the real bug in §J.6; fixed, then succeeded, gas used matched the local estimate exactly (738,649) |
| Test token deployment | `npm run deploy:test-token:fuji` | ✅ Deployed + 10,000 stUSD faucet-minted to the deployer |
| On-chain wiring verification | `npm run verify:fuji` | ✅ All 12 checks passed |
| Source verification (Snowtrace) | `npx hardhat verify --network fuji ...` ×3 | ✅ Router and TestToken verified on the first attempt; Announcer required a `--force` re-submission after being auto-matched to an unrelated project's source (§C.1, §J.5) |
| ABI re-export | `npm run export:abi` | ✅ Ran; diffed against the pre-deployment export and found byte-identical (expected — only addresses changed, not source) |
| Frontend wiring | manual edit of root `.env` | ✅ All three addresses + real scan-start block written in |
| Live smoke test | `npm run smoke:fuji` | ✅ Both legs (native + ERC-20-with-top-up) passed against the live deployed contracts — see §H |
| Frontend re-verification | `npx tsc --noEmit`, `npx eslint`, `npx next build` | ✅ All clean with real addresses embedded |
| Live browser verification | manual navigation via Playwright against a real (restarted) dev server | ✅ `/settings` shows "configured"; `/send` offers a real `stUSD` option with correct approve/gas-top-up copy; `/receive` loads clean. Found and fixed the stale-copy bug in §J.8 in the process. |

---

## L. Full End-to-End Readiness Audit (pre-Phase 1)

Performed in response to a request to identify every input, credential, manual
action, and missing feature required before deployment begins. Nothing below
is a deployment action — all checks are read-only (`eth_getCode`, local gas
estimation, static code inspection).

### L.1 Live Fuji state, re-verified this session

| Check | Result |
|---|---|
| Canonical Announcer (`0x55649E...45564`) `eth_getCode` | `0x` — still absent on Fuji |
| Deterministic CREATE2 deployer (`0x4e59b44847b379578588920ca78fbf26c0b4956c`) `eth_getCode` | **Present** — standard deployment-proxy bytecode confirmed live on Fuji |
| Current Fuji block height (at check time) | `0x39d4cda` (60,614,874) |
| Live Fuji gas price (at check time) | `0xa0` = 160 wei — point-in-time reading, not a funding guarantee |

**New lead for Phase 3:** the deterministic deployer existing on Fuji means canonical CREATE2 deployment is *theoretically* reachable, but reproducing the canonical address requires the ERC-5564 reference's exact **init-code** bytecode hash (not the runtime bytecode already captured in §D) plus the published salt. That init code has not yet been obtained or hash-matched. This remains a documented possibility to investigate in Phase 3, not a resolved path.

### L.2 Measured deployment gas cost (local Hardhat network, real compiled artifacts)

| Contract | Gas units (measured, not estimated by guess) |
|---|---|
| `ERC5564Announcer` | 165,307 |
| `StealthPaymentRouter` | 738,649 |
| **Total** | **903,956** |

At the live Fuji gas price captured above (160 wei), total cost would be negligible (~0.00000014 AVAX). Gas price fluctuates, so a safety margin is recommended rather than funding to the exact measured minimum — see the funding recommendation in the chat response accompanying this audit.

### L.3 Confirmed missing scripts (static inspection) — all three resolved 2026-11-07

| Item | Status |
|---|---|
| `contracts/scripts/fuji-smoke-payment.ts` | **Written.** Plumbing-only: real on-chain `payNative`/`payERC20` calls against the deployed Router, with a fixed test-vector ephemeral key/view tag (not real ERC-5564 derivation — see the script's own header comment for why). Not yet run against Fuji (needs Phase 1+ first). |
| Fuji test-ERC20 deploy/mint script | **Written** as `contracts/scripts/deploy-test-token.ts`, deploying the new `StealthPayTestToken.sol` (not the test-only `MockERC20` mock) and minting an initial balance to the deployer via its public `faucet()`. Not yet run against Fuji. |
| Source-code verification config | **Done.** `contracts/hardhat.config.ts` now has an `etherscan`/`customChains` block for Snowtrace. No real API key needed — confirmed against Avalanche's own verification docs and cross-checked against `hardhat-verify`'s own built-in `avalancheFujiTestnet` entry, which targets the identical URL. Not yet exercised (nothing is deployed to verify). |

### L.4 Confirmed missing frontend functionality (static inspection, not opinion) — all four resolved 2026-11-07

| Gap | Resolution |
|---|---|
| **ERC-20 payments unreachable from the UI** | `src/config/networks.ts` no longer has a static `ASSETS` array with a `planned` flag. `assetsFor(network)` now returns native AVAX plus — only when `NEXT_PUBLIC_{FUJI,MAINNET}_TEST_TOKEN_ADDRESS` holds a real configured address — a real `stUSD` entry with a real `contract`. `send-form.tsx` and `payment-request-form.tsx` were updated to call `assetsFor()` and no longer reference `.planned`. Until a test token address is configured, only AVAX appears — no placeholder, no fabricated availability. |
| **No ERC-20 `approve()` step existed anywhere** | `use-send-payment.ts`'s `send()` now reads the payer's current allowance via `getPublicClient(network).readContract(...allowance...)` and, only if it's insufficient, submits a real `approve()` transaction and awaits its receipt (new `"approving"` stage) before calling `payERC20`. |
| **No gas-top-up UI control** | `send-form.tsx` now shows a "Native gas top-up" field whenever a non-native asset is selected, wired straight through to `useSendPayment().send()`'s existing `gasTopUpAvax` parameter, and shown in the confirmation dialog when set. |
| **Spending/forwarding from a detected stealth address was entirely unimplemented** | `forwardPayment()` added to `src/providers/stealth-identity-provider.tsx`: derives the one-time key, signs locally via `privateKeyToAccount` + a local `createWalletClient` (the connected wallet is never involved — it does not and cannot hold this key), sweeps the full native balance minus a precisely-computed legacy-transaction fee to a caller-supplied address, and destroys the key in a `finally` block regardless of outcome. UI: a new "Forward funds" button in `PaymentDetailDialog` (shown only when `payment.spendable`) opens `ForwardPaymentDialog`, which collects the destination address and reports the resulting transaction hash. Proven against a real local Hardhat node in `src/test/integration/payment-round-trip.test.ts`. The Router is now deployed on Fuji (§C.2), so the remaining gap is narrower than when this was written: a real browser-driven forward of a real received payment, which is part of the one outstanding item in §I (full end-to-end test). Still scoped to native AVAX only, matching `payment.spendable`'s existing definition. |
| Scan-start block left at genesis | **Resolved 2026-11-07.** `NEXT_PUBLIC_FUJI_SCAN_START_BLOCK` is now `60645095`, the Announcer's real deployment block (§C.1), instead of the `0` default. |

### L.5 What is already real and does not need rebuilding

Confirmed by code inspection, not assumed from memory: wallet connection (EIP-6963 + legacy `window.ethereum` fallback, no WalletConnect/project ID dependency), the encrypted vault (Argon2id + AES-256-GCM + IndexedDB, 36 passing tests), the announcement scanner (real `getLogs` + on-chain balance verification, no mock data), native-AVAX sending via `use-send-payment.ts` → `StealthPaymentRouter.payNative` (mechanically complete, blocked only on a deployed router address), and all six deployment/verification scripts in `contracts/scripts/` (safe, chain-gated, funds-gated, no fabrication).

No Supabase, no backend API, no WalletConnect project ID, and no analytics/monitoring credentials exist anywhere in the codebase — none are required for this milestone.

---

## Document Maintenance

This file is updated **progressively**, immediately after each verified deployment step — never retroactively batched at the end. Entries move from `Pending`/`Not started` to real values only when backed by an on-chain observation (`eth_getCode`, a transaction receipt, or an explorer lookup). Failed attempts are recorded, not erased.

Last updated: 2026-11-07 — **live deployment completed; the user then began real end-to-end usage, and the receiver-side scanner's real root cause was found and fixed.** All three contracts deployed to Fuji, verified on Snowtrace, confirmed working by a real on-chain smoke test, wired into the frontend (§C, §G, §H, §K). The user sent a REAL payment through `/send` with real stealth derivation via Trust Wallet — confirmed on Snowtrace (§H) — the send half of the "full end-to-end test" this document has been waiting on. Detecting it on the receiver side went through three rounds: §J.9 (hardcoded chunk size vs. the RPC's 100-block cap) and §J.10 (an unretried transient network failure) were real bugs, fixed, but the user still couldn't see their payment — because the actual root cause was that a from-scratch scan via the public RPC could take 15+ minutes (measured directly: 10 minutes covered barely 60% of the range). §J.11 fixes this properly: the scanner now uses Snowtrace's indexer API as its primary path, with the RPC-chunked approach kept as an automatic fallback. Verified live: the same scan that didn't finish in 10 minutes completed in 1.72 seconds and found the user's real payment. Seven real bugs found and fixed in total this stretch (§J.6, §J.8, §J.9, §J.10, §J.11, §J.12, plus the ordering bug inside §J.9) — none worked around, each root-caused with live evidence. **Not yet confirmed:** whether the user's own browser session now detects their real payment — that's the immediate next step.
