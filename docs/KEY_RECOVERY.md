# StealthPay Key Recovery

> **Not independently audited.** This design has unit and integration tests,
> including a proof that a vault-recovered identity still controls funds sent to
> it before the device was lost. That is not a security review. Fuji testnet
> only.

## 1. Why this exists

Milestone 2 held the stealth identity in memory only. A page refresh destroyed
it. That is a **loss-of-funds bug**, not an inconvenience: once a payment has
landed on a one-time stealth address, the *only* thing that can move it is the
spending key derived from `b`. Lose `b`, and the funds are permanently
inaccessible — there is no recovery path through the chain, the router, or the
announcement.

Milestone 3 fixes that with an encrypted local vault plus a downloadable
encrypted backup.

## 2. What is encrypted

The existing ERC-5564 key generation is **unchanged**. No mnemonic replaces it,
no key is re-derived. The same two random SECP256k1 scalars produced by
`generateStealthIdentity` are what get encrypted.

Encrypted payload (`VaultPayloadV1`):

| Field | Why |
|---|---|
| `viewingPrivateKey`, `spendingPrivateKey` | The actual secrets |
| `viewingPublicKey`, `spendingPublicKey` | Verified against the private keys on restore |
| `stealthMetaAddress` | Rebuilt and compared on restore |
| `schemeId`, `chainFamily`, `chainId` | Scheme and chain context must survive |
| `payloadVersion`, `identityCreatedAt` | Forward compatibility |

Public identity material is encrypted too. It is not secret, but keeping it
inside the ciphertext means a stolen backup file reveals nothing — not even
*which* identity it holds.

## 3. Cryptography

### Key derivation — Argon2id

| Parameter | Value |
|---|---|
| Algorithm | Argon2id (v1.3 / `0x13`) |
| Memory | 19,456 KiB (19 MiB) |
| Iterations | 2 |
| Parallelism | 1 |
| Output | 32 bytes |
| Salt | 16 random bytes, fresh per encryption |

These are the [OWASP Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)
minimum for Argon2id. Implementation: `hash-wasm@4.12.0`, which runs Argon2 in
WebAssembly in the browser. hash-wasm exposes no version selector — it is
always v1.3 — so `19` is recorded for forward compatibility and validated on
import rather than configured.

Parameters travel **inside each envelope**, so raising the defaults later does
not break existing backups: each one decrypts with the values it was created
with.

### Encryption — AES-256-GCM

| Parameter | Value |
|---|---|
| Algorithm | AES-256-GCM via Web Crypto `SubtleCrypto` |
| Key | 256-bit, derived by Argon2id, imported non-extractable |
| Nonce | 96 bits, fresh per encryption |
| Tag | 128 bits |
| AAD | Format version, KDF parameters, cipher metadata |

No AES is implemented locally — it is the platform primitive.

A **fresh salt and fresh nonce** are generated on every encryption, including
every export and every password change. Reusing a (key, nonce) pair under
AES-GCM leaks the keystream, so no value is ever carried over from a previous
envelope.

### Why AAD matters

The AAD binds the ciphertext to the exact metadata it shipped with:

```
STEALTHPAY_ENCRYPTED_BACKUP|v1|aad1|argon2id|19|19456|2|1|<salt>|AES-256-GCM|128|<nonce>
```

Without this, an attacker holding a backup file could rewrite `memoryKiB` to
`8192` and `iterations` to `1`, making an offline brute-force attempt
dramatically cheaper, and the file would still decrypt for the real owner.
Because those values are authenticated, any such edit fails the GCM tag check
and decryption is refused. This is covered by a test.

It is a fixed-order delimited string rather than JSON so it cannot shift with
object key ordering across runtimes.

## 4. Backup file format

Suggested name: `stealthpay-backup-<timestamp>.stealthpay`. The filename
carries **no identity information** — filenames are user-visible and often
synced by the OS.

```json
{
  "format": "STEALTHPAY_ENCRYPTED_BACKUP",
  "version": 1,
  "kdf": {
    "algorithm": "argon2id",
    "version": 19,
    "memoryKiB": 19456,
    "iterations": 2,
    "parallelism": 1,
    "salt": "<32 hex chars>"
  },
  "cipher": {
    "algorithm": "AES-256-GCM",
    "nonce": "<24 hex chars>",
    "tagLength": 128
  },
  "aadVersion": 1,
  "ciphertext": "<hex, GCM tag appended>",
  "createdAt": "<ISO 8601>"
}
```

The envelope contains only what is needed to attempt decryption. Everything
else is inside `ciphertext`.

### Import hardening

Untrusted KDF parameters are **bounds-checked before the KDF runs**, because a
malicious file could otherwise request gigabytes of memory and hang the tab:

| Parameter | Accepted range |
|---|---|
| `memoryKiB` | 8,192 – 262,144 (8 MiB – 256 MiB) |
| `iterations` | 1 – 10 |
| `parallelism` | 1 – 4 |
| `salt` | 16 – 64 bytes of hex |

Unsupported `format`, `version`, `aadVersion`, KDF algorithm, cipher algorithm
or tag length are rejected outright.

## 5. Local storage

IndexedDB, database `stealthpay-vault`, store `vault`, one record.

**Stored:** the encrypted envelope, plus `savedAt`, `lastExportedAt` and
`backupConfirmed`.

**Never stored:** any plaintext key, the password, the Argon2-derived AES key,
or the stealth meta-address. The meta-address is public information, but
persisting it in plaintext would tell anyone inspecting the profile which
identity this browser holds.

Not used at all: `localStorage`, `sessionStorage`, cookies, service-worker
caches.

A test reads the **actual persisted record** and asserts that none of the
private keys, the password, or the meta-address appear anywhere in it.

## 6. Flows

### Create
1. Generate the identity (real CSPRNG, unchanged from Milestone 2).
2. Collect and strength-check a vault password.
3. Argon2id → AES-256-GCM.
4. **Decrypt the result and verify it reproduces the identity — before saving.**
5. Persist ciphertext.
6. Offer the encrypted download.
7. Require explicit confirmation that the backup was stored.

Step 4 is not ceremony. Without it the user could be told their keys are safely
encrypted when the envelope is in fact unreadable, and they would discover it
only after losing the in-memory copy.

### Unlock (after refresh)
Detect vault → prompt for password → Argon2id with the **stored** parameters →
decrypt → rebuild and verify the identity → unlock in memory.

### Restore (new device)
Parse envelope → bounds-check KDF → decrypt → **verify** (below) → persist →
unlock. Nothing is written unless every step passes; a partial restore is never
persisted.

### Verification on restore
The backup's public half is treated as untrusted:
1. Range-validate both private scalars (non-zero, below the curve order).
2. Recompute both public keys from the private scalars and compare.
3. Rebuild the meta-address and compare.
4. Re-derive the identity through the normal engine path.
5. Compare scheme id.

Any mismatch rejects the restore and destroys the partially-built key material.
This prevents a tampered file from pointing a user at an identity they cannot
actually spend from.

### Password change
Unlock with the old password → fresh salt → fresh nonce → re-encrypt →
**verify under the new password** → atomically replace the record. The private
keys do not change. Previously exported files keep their old password, so a
fresh export afterwards is recommended.

## 7. Recovery status

```ts
type RecoveryStatus =
  | "not_configured"   // no vault; an identity now would be lost on refresh
  | "vault_encrypted"  // survives refresh, not a cleared profile
  | "backup_exported"  // a file was produced
  | "recovery_verified"// user confirmed off-device storage
  | "locked";          // vault exists, not unlocked
```

`backup_exported` means a file was generated — **not** that it was stored
safely. Clicking download is not proof. Only `recovery_verified` records a user
claim, and even that is a claim.

Future real-payment functionality must gate on `recovery_verified` before
presenting an identity as ready for real funds.

## 8. Password rules

The vault password is **not** an Ethereum private key. It only encrypts the
backup.

- Minimum 12 characters; 16+ or four unrelated words encouraged.
- Strength assessed **locally** — never transmitted to be scored.
- Never stored, logged, sent to an API or Supabase, or included in analytics.
- No hardcoded recovery password. No administrator override. No backdoor.

**There is no password reset.** If both the backup file and the password are
lost, the identity and anything received through it are unrecoverable by anyone,
including us. Server-side custody would "solve" this by removing the property
the product exists to provide, so it is not offered.

## 9. Threat model

### Protects against
- **Lost or stolen device / browser profile.** Keys at rest are ciphertext; an
  attacker needs the password.
- **Cleared browser storage, OS reinstall, dead hardware.** The exported
  encrypted backup restores the identity elsewhere.
- **Tampered backup file.** AAD + GCM tag detect edits; identity verification
  catches substituted key material.
- **Offline brute force.** Argon2id at the OWASP work factor makes guessing
  expensive; parameter downgrade is blocked by AAD.

### Does NOT protect against
- **XSS or a compromised page while the vault is unlocked.** The decrypted
  identity is in memory and script in the page can reach it. Encryption at rest
  is not an XSS defence, and IndexedDB encryption does not make the app
  XSS-proof.
- **A malicious or backdoored browser extension**, which can read page memory.
- **Keyloggers / compromised OS**, which can capture the password.
- **A weak password.** Argon2id raises the cost per guess; it cannot rescue a
  guessable passphrase.
- **Losing both the file and the password.** Unrecoverable by design.
- **Memory disclosure.** See below.

### Memory zeroization — honest limits
`SecretKeyMaterial.destroy()` and the vault's `wipe()` overwrite backing
`Uint8Array`s. This is **best effort only**. JavaScript gives no zeroization
guarantee: the engine may have copied bytes during GC, JIT or hex conversion,
and strings are immutable so a hex key or a password string cannot be wiped at
all. Every place this matters is commented as such. Do not treat `destroy()` as
erasure.

## 10. Secret containment

Milestone 2's guards survive the round trip — a vault-restored identity still
has `SecretKeyMaterial` that throws on `toJSON()` and redacts in `toString()`.
There is a test for exactly that.

`StealthIdentityProvider` keeps the full bundle in a **ref inside its closure**.
It is never in React state, never a prop, never returned from context, and
there is no getter that returns raw private keys. Components call narrow
operations (`checkAnnouncement`, `proveSpendControl`, `requestExport`) and get
results back.

The provider also auto-locks after 15 minutes of inactivity.

## 11. Test coverage

36 vault tests across two files, all passing:

- **Encryption (14):** correct-password round trip, wrong password, modified
  ciphertext / nonce / salt, AAD-bound KDF downgrade, unsupported
  format/version/cipher/KDF, malicious KDF parameters, fresh salt+nonce per
  encryption, file round trip, password policy, no plaintext in the envelope.
- **Recovery (22):** exact identity restoration after refresh; a restored
  identity still claims a payment received earlier; mismatched public key /
  meta-address / scalar / chain rejected; IndexedDB holds no plaintext
  (inspecting the real record); overwrite protection; recovery status
  transitions; corrupt record rejected; export produces a valid encrypted file
  with no plaintext; export requires the password; fresh salt per export;
  **import into a wiped profile reproduces the identity**; wrong password and
  corrupt file rejected with nothing persisted; password change preserves keys
  and invalidates the old password; weak passwords refused; secret containment
  survives the round trip.

Plus one cross-layer integration test: a vault-recovered identity detects an
announcement that was emitted on-chain **before** the device was wiped, and
recovers the key controlling the funded stealth address.
