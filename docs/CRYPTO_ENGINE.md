# StealthPay Cryptographic Engine

> **Not independently audited.** This engine has unit tests and an internal
> round-trip proof, nothing more. It is pinned to a **beta** dependency, targets
> **Avalanche Fuji testnet**, and must not be used to custody value on mainnet.

Milestone 2 implements the ERC-5564 **scheme 1 (SECP256k1)** stealth address
scheme: a sender derives a fresh one-time address from a receiver's published
meta-address, and only that receiver can detect the payment and recover the key
controlling it.

- Specification: <https://ercs.ethereum.org/ERCS/erc-5564>
- Reference implementation: `@scopelift/stealth-address-sdk@1.0.0-beta.5`

---

## 1. Module architecture

Everything lives under [`src/lib/stealth/`](../src/lib/stealth/). One concern
per file.

| Module | Responsibility |
|---|---|
| `constants.ts` | Scheme id, key/byte lengths, chain labels, supported chain ids |
| `errors.ts` | `StealthError` + the closed set of error codes |
| `types.ts` | Strict public/secret type separation, announcement shape |
| `secure-memory.ts` | `SecretKeyMaterial` — containment wrapper for private scalars |
| `validation.ts` | Hex, scalar-range, on-curve point, address, scheme and chain checks |
| `address-utils.ts` | Public-key and EVM address derivation, checksum-safe comparison |
| `key-generation.ts` | `generateStealthIdentity` — two independent key pairs |
| `meta-address.ts` | Build and parse `st:avax:0x<B><A>` |
| `sender.ts` | `generateOneTimeStealthAddress` — fresh ephemeral key per payment |
| `receiver.ts` | `checkStealthAnnouncement` — view-tag filter then address derivation |
| `key-derivation.ts` | `deriveOneTimeSpendingKey` + `verifyPaymentDerivation` |
| `index.ts` | Public barrel |

The UI never imports the SDK directly — only this barrel.

---

## 2. Verified scheme-1 conventions

These were **read out of the SDK source and then asserted in tests**, not
assumed. `interop.test.ts > pins the scheme-1 conventions this engine depends
on` fails loudly if a dependency upgrade changes any of them.

| Step | Convention |
|---|---|
| ECDH shared secret | `getSharedSecret(priv, pub)` → **33-byte SEC1 compressed point** (includes the 02/03 parity prefix) |
| Hash | **keccak-256** over those exact 33 bytes (⚠️ *not* SHA-256) |
| Scalar use | The 32-byte hash is used **directly** as a scalar, with no mod-`n` reduction |
| View tag | **Most-significant byte** of the hash → `0x<2 hex chars>` |
| Stealth public key | `P = B + H(s)·G`, returned **uncompressed** (65 bytes, `0x04` prefix) |
| Address | viem `publicKeyToAddress`: drop `0x04`, keccak-256, last 20 bytes, EIP-55 checksum |
| Spending key | `x = (b + H(s')) mod n` |
| Key encoding | All public keys are 33-byte compressed; private scalars are 32 bytes |
| Meta-address | `st:avax:0x<spendingPubKey><viewingPubKey>` — **spending key first** |

### Cryptographic flow

```
Receiver (Alice)                        Sender (Bob)
----------------                        ------------
a  (viewing priv)                       r  (ephemeral priv, fresh per payment)
A = a·G                                 R = r·G
b  (spending priv)
B = b·G
Meta-Address = (B, A)  ──────────────▶  s   = r·A
                                        s_h = keccak256(s)
                                        tag = s_h[0]
                                        P   = B + s_h·G  →  stealth address
                       ◀──────────────  publish (address, R, tag)
s'   = a·R   ( = r·A by ECDH )
s_h' = keccak256(s')
tag match?  →  P' = B + s_h'·G
P' == announced address?  →  payment is mine
x = (b + s_h') mod n   →  controls that one address
```

---

## 3. Public API

```ts
generateStealthIdentity(chainId): StealthIdentityBundle
parseStealthMetaAddress(metaAddress, { schemeId? }): ParsedStealthMetaAddress
generateOneTimeStealthAddress({ metaAddress, chainId, schemeId? }): OneTimeStealthAddress
checkStealthAnnouncement({ stealthAddress, ephemeralPublicKey, viewTag,
                           viewingPrivateKey, spendingPublicKey, schemeId }): StealthCheckResult
deriveOneTimeSpendingKey({ ephemeralPublicKey, viewingPrivateKey, spendingPrivateKey,
                           expectedStealthAddress, schemeId }): OneTimeSpendingKey
verifyPaymentDerivation({ ... }): { matches, recoveredAddress, error? }
```

Notable behaviours:

- `StealthIdentityBundle` splits `publicIdentity` (safe to render, copy, store)
  from `secrets` (two `SecretKeyMaterial` scalars + `destroy()`).
- `generateOneTimeStealthAddress` **never returns the ephemeral private key**.
  The test-only `deriveWithEphemeralKey` does, for deterministic fixtures.
- `checkStealthAnnouncement` returns a typed reason — `match`,
  `view-tag-mismatch` or `address-mismatch` — and only *throws* on malformed
  input. `derivedStealthAddress` is `null` when the view tag filtered first,
  which proves the expensive derivation was skipped.
- `deriveOneTimeSpendingKey` re-derives the address from the recovered scalar
  and **rejects on mismatch**, so a key that does not control the expected
  account is never returned.

---

## 4. Secret containment

`SecretKeyMaterial` holds a `Uint8Array` and actively resists leaking:

- `toJSON()` **throws** — an accidental `JSON.stringify` of app state fails
  loudly instead of silently shipping a key to an API or analytics sink.
- `toString()` and Node's `util.inspect` both return
  `[SecretKeyMaterial:redacted]`.
- `destroy()` zero-fills the buffer and makes further use throw.
- `toHex()` exists only because the SDK's API takes hex strings. It creates an
  immutable string that **cannot** be wiped; it is called as late as possible
  and the result is never retained.

### Where secrets live

[`src/providers/stealth-identity-provider.tsx`](../src/providers/stealth-identity-provider.tsx)
keeps the full bundle in a **ref inside the provider closure**. It is never put
into React state, never passed as a prop, and never exposed through context.
Components call operations (`checkAnnouncement`, `proveSpendControl`) and get
back results — never key material.

`proveSpendControl` derives the one-time key, verifies it, destroys it, and
returns only the address it controls.

### Honest limitations

- **No memory zeroization guarantee.** JavaScript may have copied the bytes
  during GC, JIT or hex conversion. `destroy()` is best-effort.
- **No persistence, and therefore no recovery.** Nothing is written to
  `localStorage`, `sessionStorage`, cookies, IndexedDB, an API route or
  Supabase. A refresh, tab close or *Lock & destroy* loses the identity
  permanently. A backup mechanism must be designed separately.
- **Stealth keys are unrelated to the connected wallet.** They are not derived
  from a MetaMask/Core signature. This is deliberate (the wallet key system
  stays separate) and is the reason there is no deterministic recovery path.

---

## 5. SDK findings and divergences

Issues found in `@scopelift/stealth-address-sdk@1.0.0-beta.5` while verifying
it, and what this engine does about each.

| Finding | Impact | Our handling |
|---|---|---|
| Compiled ESM uses **extensionless directory imports** (`from './utils/crypto'`) | Node's ESM resolver rejects it; plain `node` and un-inlined Vitest both fail | Vitest inlines the package (`test.server.deps.inline`); Turbopack resolves it natively, so the Next build is unaffected |
| `parseStealthMetaAddressURI` **ignores the chain segment** — `st:eth:` and `st:avax:` behave identically | A meta-address from another ecosystem would be silently accepted | `parseStealthMetaAddress` validates the label and throws `UNSUPPORTED_CHAIN` |
| `generatePrivateKey` **silently substitutes a random key** when given an invalid ephemeral scalar | A "deterministic" test would quietly become non-deterministic | We validate the scalar before the SDK sees it and throw `INVALID_PRIVATE_KEY` |
| Accepts a **66-char single-key** meta-address, reusing one key for both roles | Collapses scan/spend separation — anyone who can scan could also spend | Rejected with `INVALID_META_ADDRESS` |
| `computeStealthKey` reduces mod `n` but **does not reject a zero result** | A zero scalar is not a usable key | Derived scalar is range-validated before being wrapped |
| Package is **`1.0.0-beta.5`** | Pre-1.0 API/behaviour may change | Pinned exactly; convention assertions in `interop.test.ts` break on drift |

Chain binding is the main deliberate divergence. Because the SDK ignores chain
context, StealthPay uses a single chain-*family* label (`avax`) in the URI and
carries the precise `chainId` as separate metadata on the identity and payment.
Keys and addresses are chain-agnostic; only the payment context is not.

---

## 6. Test strategy

`npm test` → **7 files, 53 tests** (Vitest, node environment).

| Group | File | Covers |
|---|---|---|
| A | `key-generation.test.ts` | Valid scalars, corresponding public keys, independence, uniqueness, zero/out-of-range rejection, chain validation, a static scan proving **no hardcoded 64-hex scalars in production modules**, secret-containment guards |
| B | `meta-address.test.ts` | URI form, key ordering, round trip, bare `0x` form, compressed lengths, malformed hex, off-curve points, bad scheme, chain-label validation, single-key rejection |
| C | `sender.test.ts` | Fresh ephemeral key and view tag per payment, uniqueness across payments, no ephemeral secret in the result, determinism under a fixed key, invalid-key rejection, safe failure |
| D | `receiver.test.ts` | Correct detection, multiple payments, wrong viewing key, wrong spending key, view-tag short-circuit, tampered address, malformed points, bad scheme, destroyed key |
| E | `key-derivation.test.ts` | Correct key, independent address check, wrong-key rejection, malformed inputs, non-serializability, distinct key per payment |
| F | `end-to-end.test.ts` | **The round trip**, 10 independent payments, a third party failing to detect or spend, mainnet chain context |
| G | `interop.test.ts` | Wrapper vs raw SDK agreement, `computeStealthKey` agreement, **pinned conventions**, scheme-id rejection |

### What counts as independent verification

`receiver.ts` is composed from the SDK's own primitives, so comparing it to
`sdkCheckStealthAddress` tests **internal consistency**, not independence — the
test says so in its name.

The meaningful check is the **scalar path**: recover `x` via `computeStealthKey`,
then derive its address with viem's `privateKeyToAddress`. That never touches
the point-addition code used to *produce* the address, so agreement is real
evidence. This is the assertion the Group F round trip turns on.

These tests do **not** demonstrate interoperability with any other vendor's
ERC-5564 implementation. Cross-checking against the ScopeLift contracts or a
second independent library remains open work.

---

## 7. Where the engine is wired in

| Surface | Behaviour |
|---|---|
| Receive | Generates a real identity in-browser; renders real public keys and meta-address; **QR encodes the real URI** |
| Send | Validates a pasted meta-address with the real parser; derives a **real** one-time address, ephemeral public key, view tag and scheme id on an explicit action (one fresh ephemeral key per derivation). Still **never broadcasts** and never fabricates a transaction hash |
| Stealth Identity | Real public identity, scheme/curve/chain context, private halves shown only as `••••` with a "never displayed" status |
| Scanner | `AnnouncementChecker` runs real view-tag + address matching against the session viewing key, and can prove spend control. The event feed remains an explicitly labelled **simulation** — no RPC log scanning |
| Dashboard | Identity status card with a real empty state; mock identity details removed. Balances and transaction history are still demo data |

---

## 8. Out of scope for this milestone

Not implemented, by instruction: Solidity contracts, the ERC-5564 Announcer
deployment, `StealthPaymentRouter`, AVAX/ERC-20 transfers, transaction
broadcasting, gas sponsorship, live blockchain scanning, backend or Supabase key
handling, and mainnet use.

`StealthAnnouncement` in `types.ts` is the typed shape the future scanner and
contract layers will consume. Per ERC-5564 the view tag is the **first byte of
the announcement metadata**; the type documents that so the parsing stays
consistent when real announcements arrive.
