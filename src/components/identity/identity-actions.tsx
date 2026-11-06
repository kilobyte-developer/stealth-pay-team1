"use client";

import * as React from "react";
import {
  Download,
  LoaderCircle,
  RefreshCw,
  ShieldAlert,
  TriangleAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SectionLabel } from "@/components/ui/section-label";
import {
  NewPasswordFields,
  PasswordInput,
  newPasswordIsValid,
} from "@/components/vault/password-field";
import { useStealthIdentity } from "@/providers/stealth-identity-provider";
import { downloadTextFile } from "@/lib/download";

/**
 * Identity management: encrypted backup export and full identity replacement.
 *
 * Both perform real work against the vault. Regeneration is gated behind an
 * explicit acknowledgement because it is destructive in a way that is easy to
 * misunderstand: it does not move funds.
 */
export function IdentityActions() {
  const { requestExport, createIdentity, busy, error, clearError } =
    useStealthIdentity();

  const [exportOpen, setExportOpen] = React.useState(false);
  const [regenOpen, setRegenOpen] = React.useState(false);
  const [exportPw, setExportPw] = React.useState("");
  const [newPw, setNewPw] = React.useState("");
  const [confirmPw, setConfirmPw] = React.useState("");
  const [ack, setAck] = React.useState(false);
  const [note, setNote] = React.useState<string | null>(null);

  function reset() {
    setExportPw("");
    setNewPw("");
    setConfirmPw("");
    setAck(false);
    clearError();
  }

  async function handleExport() {
    const file = await requestExport(exportPw);
    if (file) {
      downloadTextFile(file.filename, file.contents);
      setNote(`Downloaded ${file.filename}`);
      setExportOpen(false);
      reset();
    }
  }

  async function handleRegenerate() {
    // Replaces the vault outright — only reachable after acknowledgement.
    const ok = await createIdentity(newPw, undefined, { allowOverwrite: true });
    if (ok) {
      setNote("A new identity was generated. Export a fresh backup now.");
      setRegenOpen(false);
      reset();
    }
  }

  return (
    <div className="border-ink shadow-brutal border-2 bg-white p-5 sm:p-6">
      <SectionLabel className="text-grey">Identity management</SectionLabel>
      <p className="text-grey mt-2 text-sm leading-relaxed">
        These operations touch the material that controls your funds.
      </p>

      <div className="mt-5 flex flex-wrap gap-3">
        <Button
          variant="secondary"
          size="md"
          onClick={() => {
            reset();
            setExportOpen(true);
          }}
        >
          <Download className="size-4" aria-hidden="true" />
          Back up keys
        </Button>
        <Button
          variant="coral"
          size="md"
          onClick={() => {
            reset();
            setRegenOpen(true);
          }}
        >
          <RefreshCw className="size-4" aria-hidden="true" />
          Regenerate identity
        </Button>
      </div>

      {note ? (
        <p className="border-ink bg-lime mt-4 border-2 p-3 text-xs font-medium">
          {note}
        </p>
      ) : null}

      {/* ---- Backup ---- */}
      <Dialog
        open={exportOpen}
        onOpenChange={(o) => {
          setExportOpen(o);
          if (!o) reset();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <div className="border-ink bg-coral mb-4 inline-flex size-11 items-center justify-center border-2">
              <ShieldAlert className="size-5" aria-hidden="true" />
            </div>
            <DialogTitle>Back up your stealth keys</DialogTitle>
            <DialogDescription>
              Produces an encrypted file. It is useless to anyone without your
              vault password.
            </DialogDescription>
          </DialogHeader>

          <ul className="space-y-2.5">
            {[
              "Anyone who obtains your private spending key can move every payment ever sent to your meta-address.",
              "Anyone who obtains your private viewing key can see all of your incoming payments, permanently.",
              "Store the file and the password separately. Never put them in the same place.",
              "The file never leaves your browser — it is written locally, not uploaded.",
            ].map((w) => (
              <li key={w} className="flex gap-2.5">
                <TriangleAlert
                  className="text-coral-deep mt-0.5 size-4 shrink-0"
                  aria-hidden="true"
                />
                <span className="text-xs leading-relaxed">{w}</span>
              </li>
            ))}
          </ul>

          <div className="mt-5">
            <Field label="Vault password" htmlFor="identity-export-pw" required>
              <PasswordInput
                id="identity-export-pw"
                value={exportPw}
                onChange={setExportPw}
                autoComplete="current-password"
              />
            </Field>
          </div>

          {error ? (
            <p
              role="alert"
              className="border-ink bg-coral/25 mt-4 border-2 p-3 text-xs leading-relaxed font-medium"
            >
              {error}
            </p>
          ) : null}

          <DialogFooter>
            <Button variant="outline" onClick={() => setExportOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              disabled={exportPw.length === 0 || busy}
              onClick={handleExport}
            >
              {busy ? (
                <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <Download className="size-4" aria-hidden="true" />
              )}
              Download backup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---- Regenerate ---- */}
      <Dialog
        open={regenOpen}
        onOpenChange={(o) => {
          setRegenOpen(o);
          if (!o) reset();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <div className="border-ink bg-coral mb-4 inline-flex size-11 items-center justify-center border-2">
              <TriangleAlert className="size-5" aria-hidden="true" />
            </div>
            <DialogTitle>Regenerate your stealth identity?</DialogTitle>
            <DialogDescription>
              This creates a completely new, unrelated identity and replaces the
              one on this device. It is not a rotation.
            </DialogDescription>
          </DialogHeader>

          <ul className="space-y-2.5">
            {[
              "Funds already received do NOT move. They stay at their existing one-time addresses, spendable only with the OLD spending key.",
              "You must already hold a backup of the current identity, or anything it received becomes unreachable.",
              "Your current meta-address stops being the one to share. Anyone still holding it pays into the old identity.",
              "Payments sent to the old meta-address afterwards will not appear under the new identity.",
            ].map((w) => (
              <li key={w} className="flex gap-2.5">
                <span
                  className="bg-coral border-ink mt-1.5 size-2.5 shrink-0 border-2"
                  aria-hidden="true"
                />
                <span className="text-xs leading-relaxed">{w}</span>
              </li>
            ))}
          </ul>

          <label className="border-ink bg-paper-2 mt-5 flex cursor-pointer items-start gap-3 border-2 p-3">
            <input
              type="checkbox"
              checked={ack}
              onChange={(e) => setAck(e.target.checked)}
              className="border-ink accent-lime mt-0.5 size-4 shrink-0 border-2"
            />
            <span className="text-xs leading-relaxed">
              I have a backup of my current identity, and I understand a new one
              does not migrate existing funds.
            </span>
          </label>

          {ack ? (
            <div className="mt-5">
              <NewPasswordFields
                idPrefix="regen"
                password={newPw}
                confirm={confirmPw}
                onPasswordChange={setNewPw}
                onConfirmChange={setConfirmPw}
              />
            </div>
          ) : null}

          {error ? (
            <p
              role="alert"
              className="border-ink bg-coral/25 mt-4 border-2 p-3 text-xs leading-relaxed font-medium"
            >
              {error}
            </p>
          ) : null}

          <DialogFooter>
            <Button variant="outline" onClick={() => setRegenOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="coral"
              disabled={!ack || !newPasswordIsValid(newPw, confirmPw) || busy}
              onClick={handleRegenerate}
            >
              {busy ? (
                <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <RefreshCw className="size-4" aria-hidden="true" />
              )}
              Replace identity
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
