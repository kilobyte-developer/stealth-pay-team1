"use client";

import * as React from "react";
import {
  CircleCheck,
  FileUp,
  LoaderCircle,
  TriangleAlert,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";
import { SectionLabel } from "@/components/ui/section-label";
import { PasswordInput } from "@/components/vault/password-field";
import { useStealthIdentity } from "@/providers/stealth-identity-provider";
import { readTextFile } from "@/lib/download";
import { BACKUP_FILE_EXTENSION } from "@/lib/vault";

/**
 * Recovery from a `.stealthpay` backup file.
 *
 * Validation runs in order — envelope structure, then KDF parameter bounds,
 * then decryption, then full identity verification (public keys recomputed
 * from the private scalars, meta-address rebuilt). Nothing is persisted unless
 * every step passes, so a tampered file cannot half-restore an identity.
 */
export function ImportBackupPanel({
  onRestored,
}: {
  onRestored?: () => void;
}) {
  const { requestImport, vaultExists, busy, error, clearError } =
    useStealthIdentity();

  const [fileName, setFileName] = React.useState<string | null>(null);
  const [contents, setContents] = React.useState<string | null>(null);
  const [password, setPassword] = React.useState("");
  const [allowOverwrite, setAllowOverwrite] = React.useState(false);
  const [restored, setRestored] = React.useState(false);
  const [readError, setReadError] = React.useState<string | null>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    clearError();
    setReadError(null);
    setRestored(false);
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await readTextFile(file);
      setFileName(file.name);
      setContents(text);
    } catch {
      setReadError("Could not read that file.");
      setContents(null);
      setFileName(null);
    }
  }

  async function handleImport() {
    if (!contents) return;
    const ok = await requestImport(contents, password, { allowOverwrite });
    if (ok) {
      setRestored(true);
      setPassword("");
      setContents(null);
      onRestored?.();
    }
  }

  const blockedByExisting = vaultExists && !allowOverwrite;

  if (restored) {
    return (
      <div className="border-ink shadow-brutal border-2 bg-white p-5 sm:p-6">
        <Badge tone="lime" size="md">
          <CircleCheck className="size-3" aria-hidden="true" />
          Identity restored
        </Badge>
        <p className="mt-4 text-sm leading-relaxed">
          The backup decrypted and every key relationship verified. Your keys
          are re-encrypted on this device and the identity is unlocked.
        </p>
      </div>
    );
  }

  return (
    <div className="border-ink shadow-brutal border-2 bg-white p-5 sm:p-6">
      <SectionLabel className="text-blue">
        Restore from encrypted backup
      </SectionLabel>
      <p className="text-grey mt-2 max-w-xl text-sm leading-relaxed">
        Select a <code className="font-mono">{BACKUP_FILE_EXTENSION}</code> file
        and enter the password it was encrypted with. Everything happens in your
        browser — the file is never uploaded.
      </p>

      <div className="mt-5 space-y-4">
        <div className="space-y-2">
          <label
            htmlFor="backup-file"
            className="font-display text-[0.7rem] font-bold tracking-[0.16em] uppercase"
          >
            Backup file
          </label>
          <label
            htmlFor="backup-file"
            className="brutal-press border-ink shadow-brutal-xs hover:shadow-brutal-sm flex cursor-pointer items-center gap-3 border-2 border-dashed bg-white p-4"
          >
            <span className="border-ink bg-paper-2 grid size-9 shrink-0 place-items-center border-2">
              <FileUp className="size-4" aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="font-display block text-sm font-bold">
                {fileName ?? "Choose a backup file"}
              </span>
              <span className="text-grey block text-xs">
                {contents ? "Loaded — enter the password below" : "No file selected"}
              </span>
            </span>
          </label>
          <input
            id="backup-file"
            type="file"
            accept=".stealthpay,application/json"
            onChange={handleFile}
            className="sr-only"
          />
        </div>

        <Field label="Backup password" htmlFor="import-password" required>
          <PasswordInput
            id="import-password"
            value={password}
            onChange={(next) => {
              setPassword(next);
              if (error) clearError();
            }}
            placeholder="The password for this backup"
            autoComplete="current-password"
          />
        </Field>

        {vaultExists ? (
          <label className="border-ink bg-coral/25 flex cursor-pointer items-start gap-3 border-2 p-3">
            <input
              type="checkbox"
              checked={allowOverwrite}
              onChange={(e) => setAllowOverwrite(e.target.checked)}
              className="border-ink accent-lime mt-0.5 size-4 shrink-0 border-2"
            />
            <span className="text-xs leading-relaxed">
              <strong className="font-display">
                This device already holds an identity.
              </strong>{" "}
              Importing replaces it. If you do not have a backup of the current
              one, it will be unrecoverable. Tick to confirm you want to replace
              it.
            </span>
          </label>
        ) : null}
      </div>

      {readError ?? error ? (
        <p
          role="alert"
          className="border-ink bg-coral/25 mt-4 flex items-start gap-2 border-2 p-3 text-xs leading-relaxed font-medium"
        >
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {readError ?? error}
        </p>
      ) : null}

      <Button
        variant="primary"
        size="lg"
        className="mt-5"
        disabled={!contents || password.length === 0 || busy || blockedByExisting}
        onClick={handleImport}
      >
        {busy ? (
          <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
        ) : (
          <Upload className="size-4" aria-hidden="true" />
        )}
        {busy ? "Verifying…" : "Restore identity"}
      </Button>
    </div>
  );
}
