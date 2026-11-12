# StealthPay — Dev-Only Debug Transaction Log

> **This table is not a source of truth.** It exists purely to help the team
> inspect and debug transactions while developing StealthPay — which wallet
> sent what, to which address, during a dev/test session. It does **not**
> store any transaction record for the product itself, and must never be
> treated as proof that a payment happened. Every real transaction already
> lives on-chain; use the **"View on explorer"** link (stored on every row,
> and already shown throughout the app) to independently verify it there —
> never this table.

## What gets logged, and from where

Two call sites, both **after** a transaction has already confirmed on-chain
(the log call cannot affect whether a payment succeeds, since it fires after
success is already known):

| Flow | File | Call site |
|---|---|---|
| Send | [`src/hooks/use-send-payment.ts`](../src/hooks/use-send-payment.ts) | right after `recordLocalActivity(...)`, inside `receipt.status === "success"` |
| Forward | [`src/providers/stealth-identity-provider.tsx`](../src/providers/stealth-identity-provider.tsx) | right after `recordLocalActivity(...)`, before returning `{ ok: true }` |

Both call [`logTransactionForDebug()`](../src/lib/supabase/log-transaction-for-debug.ts),
a **fire-and-forget** POST to `/api/debug-log`
([`src/app/api/debug-log/route.ts`](../src/app/api/debug-log/route.ts)). It is
never awaited, never throws into the caller, and silently no-ops if Supabase
isn't configured — a failed or skipped log has zero effect on the real
payment flow.

The write happens server-side only, using the Supabase **service role key**
([`src/lib/supabase/debug-log-client.ts`](../src/lib/supabase/debug-log-client.ts)).
That key is never sent to the browser.

## Setup

1. Create a free project at [supabase.com](https://supabase.com).
2. In the SQL Editor, run the schema below once.
3. In `Project Settings → API`, copy the **Project URL** and the **service
   role key** (not the anon key) into the root `.env` (see `.env.example`):
   ```bash
   SUPABASE_URL=
   SUPABASE_SERVICE_ROLE_KEY=
   ```
4. Restart the dev server. Logging activates automatically — no other code
   change is needed. Leaving these blank is a normal, supported state; the
   app behaves exactly as before.

## Schema

```sql
-- StealthPay debug transaction log.
-- DEV-ONLY: exists purely to help the team inspect and debug transactions
-- during development (which wallet sent what, to which address). It is NOT
-- a record of truth for any payment — every real transaction is already
-- verifiable on-chain via the explorer_url stored on each row (the same
-- "View on explorer" link shown throughout the app). Do not rely on this
-- table to prove a payment happened.
create table if not exists debug_transaction_log (
  id bigint generated always as identity primary key,
  tx_hash text not null,
  kind text not null check (kind in ('send', 'forward')),
  network text not null check (network in ('fuji', 'mainnet')),
  from_address text not null,
  to_address text not null,
  asset_symbol text not null,
  is_native boolean not null,
  token_contract text,
  amount text not null,
  block_number text not null,
  explorer_url text not null,
  created_at timestamptz not null default now()
);

create index if not exists debug_transaction_log_tx_hash_idx
  on debug_transaction_log (tx_hash);

-- Row Level Security: locked down. Only the service role (server-side only,
-- used exclusively by src/app/api/debug-log/route.ts) can write, and no
-- policy grants the public anon key any access. Inspect rows via the
-- Supabase dashboard's Table Editor, not via a client-side query.
alter table debug_transaction_log enable row level security;
```

## Verifying a transaction

Every row stores `explorer_url`, built from the same
[`explorerTxUrl()`](../src/lib/format.ts) helper used by the "View on
explorer" buttons already present in the Send/Forward confirmation UI
(e.g. [`forward-payment-dialog.tsx`](../src/components/payments/forward-payment-dialog.tsx)).
To verify any logged transaction actually happened, open that URL — the
on-chain explorer, not this table, is the source of truth.
