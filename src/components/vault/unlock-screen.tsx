"use client";

import * as React from "react";
import {
  CircleHelp,
  LoaderCircle,
  LockKeyhole,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { SectionLabel } from "@/components/ui/section-label";
import { StealthMark } from "@/components/shared/logo";
import { PasswordInput } from "@/components/vault/password-field";
import { ImportBackupPanel } from "@/components/vault/import-backup";
import { useStealthIdentity } from "@/providers/stealth-identity-provider";

/**
 * Shown when an encrypted vault exists on this device but is not unlocked.
 *
 * Never renders key material. A failed unlock reports one generic message —
 * AES-GCM cannot distinguish a wrong password from a damaged file, and saying
 * which it was would leak information about the vault.
 */
export function UnlockScreen() {
  const { unlock, busy, error, clearError, vaultStatus } = useStealthIdentity();
  const [password, setPassword] = React.useState("");
  const [showImport, setShowImport] = React.useState(false);
  const [showHelp, setShowHelp] = React.useState(false);

  async function handleUnlock(e: React.FormEvent) {
    e.preventDefault();
    const ok = await unlock(password);
    if (ok) setPassword("");
  }

  if (showImport) {
    return (
      <div className="space-y-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setShowImport(false);
            clearError();
          }}
        >
          ← Back to unlock
        </Button>
        <ImportBackupPanel />
      </div>
    );
  }

  return (
    <div className="border-ink shadow-brutal-md mx-auto max-w-xl border-[3px] bg-white p-6 sm:p-8">
      <div className="flex items-center gap-3">
        <span className="border-ink bg-lime grid size-11 place-items-center border-2">
          <StealthMark className="size-6" />
        </span>
        <div>
          <SectionLabel className="text-blue">StealthPay</SectionLabel>
          <p className="font-display mt-1 text-sm font-bold">
            Identity locked
          </p>
        </div>
      </div>

      <h2 className="mt-5 text-2xl sm:text-3xl">Unlock your identity.</h2>
      <p className="text-grey mt-3 text-sm leading-relaxed">
        Your keys are encrypted on this device. Enter your vault password to
        decrypt them locally — the password is never sent anywhere.
      </p>

      <form onSubmit={handleUnlock} className="mt-6">
        <Field label="Vault password" htmlFor="unlock-password" required>
          <PasswordInput
            id="unlock-password"
            value={password}
            onChange={(next) => {
              setPassword(next);
              if (error) clearError();
            }}
            placeholder="Your vault password"
            autoComplete="current-password"
            autoFocus
          />
        </Field>

        {error ? (
          <p
            role="alert"
            className="border-ink bg-coral/25 mt-4 border-2 p-3 text-xs leading-relaxed font-medium"
          >
            {error}
          </p>
        ) : null}

        <Button
          type="submit"
          variant="primary"
          size="lg"
          className="mt-5 w-full"
          disabled={password.length === 0 || busy}
        >
          {busy ? (
            <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <LockKeyhole className="size-4" aria-hidden="true" />
          )}
          {busy ? "Decrypting…" : "Unlock identity"}
        </Button>
      </form>

      <div className="border-ink/15 mt-6 space-y-3 border-t-2 pt-5">
        <Button
          variant="outline"
          size="md"
          className="w-full"
          onClick={() => setShowImport(true)}
        >
          <Upload className="size-4" aria-hidden="true" />
          Import an encrypted backup instead
        </Button>

        <button
          type="button"
          onClick={() => setShowHelp((s) => !s)}
          className="font-display text-grey hover:text-ink inline-flex items-center gap-1.5 text-[0.7rem] font-bold tracking-wide uppercase"
          aria-expanded={showHelp}
        >
          <CircleHelp className="size-3.5" aria-hidden="true" />
          Forgot your password?
        </button>

        {showHelp ? (
          <div className="border-ink bg-paper-2 border-2 p-3.5">
            <p className="text-xs leading-relaxed">
              <strong className="font-display">
                There is no password reset.
              </strong>{" "}
              Your password is the only key to this ciphertext. StealthPay holds
              no copy of it and no copy of your keys — there is no server-side
              custody and no administrator override, by design.
            </p>
            <p className="mt-2 text-xs leading-relaxed">
              If you still have an encrypted backup file <em>and</em> remember
              its password, import it above. If both are lost, the identity and
              anything received through it cannot be recovered by anyone.
            </p>
          </div>
        ) : null}

        {vaultStatus?.savedAt ? (
          <p className="text-grey text-[0.7rem]">
            Encrypted vault saved {new Date(vaultStatus.savedAt).toUTCString()}.
          </p>
        ) : null}
      </div>
    </div>
  );
}
