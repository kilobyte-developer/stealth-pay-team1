"use client";

import * as React from "react";
import {
  Download,
  KeyRound,
  LoaderCircle,
  Lock,
  ShieldAlert,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { SectionLabel } from "@/components/ui/section-label";
import {
  NewPasswordFields,
  PasswordInput,
  newPasswordIsValid,
} from "@/components/vault/password-field";
import { ImportBackupPanel } from "@/components/vault/import-backup";
import {
  RecoveryStatusBadge,
  RecoveryStatusDetail,
} from "@/components/vault/recovery-status";
import { useStealthIdentity } from "@/providers/stealth-identity-provider";
import { downloadTextFile } from "@/lib/download";
import { formatDateTime } from "@/lib/format";

type Panel = "none" | "export" | "change" | "import";

/** Settings → Security & Backup. */
export function SecuritySettings() {
  const {
    vaultExists,
    isLocked,
    vaultStatus,
    publicIdentity,
    requestExport,
    changePassword,
    confirmBackup,
    lock,
    busy,
    error,
    clearError,
  } = useStealthIdentity();

  const [panel, setPanel] = React.useState<Panel>("none");
  const [exportPw, setExportPw] = React.useState("");
  const [currentPw, setCurrentPw] = React.useState("");
  const [nextPw, setNextPw] = React.useState("");
  const [confirmPw, setConfirmPw] = React.useState("");
  const [note, setNote] = React.useState<string | null>(null);

  function openPanel(next: Panel) {
    clearError();
    setNote(null);
    setPanel((p) => (p === next ? "none" : next));
  }

  async function handleExport() {
    const file = await requestExport(exportPw);
    if (file) {
      downloadTextFile(file.filename, file.contents);
      setExportPw("");
      setNote(`Downloaded ${file.filename}`);
      await confirmBackup();
      setPanel("none");
    }
  }

  async function handleChange() {
    const ok = await changePassword(currentPw, nextPw);
    if (ok) {
      setCurrentPw("");
      setNextPw("");
      setConfirmPw("");
      setNote("Vault password changed. Your keys are unchanged.");
      setPanel("none");
    }
  }

  const status = vaultStatus?.recoveryStatus ?? "not_configured";

  return (
    <section
      aria-labelledby="security-backup-heading"
      className="border-ink shadow-brutal border-2 bg-white"
    >
      <div className="border-ink bg-paper-2 flex items-center gap-3 border-b-2 p-4">
        <span className="border-ink grid size-9 shrink-0 place-items-center border-2 bg-white">
          <ShieldAlert className="size-4" aria-hidden="true" />
        </span>
        <SectionLabel id="security-backup-heading">
          Security &amp; backup
        </SectionLabel>
      </div>

      <div className="divide-ink/12 divide-y-2">
        {/* ---- Status ---- */}
        <div className="p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="font-display text-sm font-bold">Vault status</p>
              <RecoveryStatusDetail status={status} />
            </div>
            <RecoveryStatusBadge status={status} />
          </div>

          <dl className="mt-4 grid gap-3 sm:grid-cols-3">
            {[
              {
                k: "Encryption",
                v: "Argon2id → AES-256-GCM",
              },
              {
                k: "Vault saved",
                v: vaultStatus?.savedAt
                  ? formatDateTime(vaultStatus.savedAt)
                  : "—",
              },
              {
                k: "Last backup export",
                v: vaultStatus?.lastExportedAt
                  ? formatDateTime(vaultStatus.lastExportedAt)
                  : "Never",
              },
            ].map((row) => (
              <div key={row.k} className="border-ink border-2 p-3">
                <dt className="font-display text-[0.6rem] font-bold tracking-[0.14em] uppercase">
                  {row.k}
                </dt>
                <dd className="mt-1 text-xs leading-relaxed">{row.v}</dd>
              </div>
            ))}
          </dl>

          <p className="border-ink bg-paper-2 mt-4 border-2 p-3 text-xs leading-relaxed">
            Storage is local only. There is no cloud backup, no server-side copy
            of your keys, and no password reset. Encryption at rest protects a
            stolen device or browser profile — it does not protect an unlocked
            session on a compromised page.
          </p>
        </div>

        {/* ---- Actions ---- */}
        <div className="p-4">
          <p className="font-display text-sm font-bold">Actions</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={!vaultExists || isLocked}
              onClick={() => openPanel("export")}
            >
              <Download className="size-3.5" aria-hidden="true" />
              Export backup
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => openPanel("import")}
            >
              <Upload className="size-3.5" aria-hidden="true" />
              Import backup
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!vaultExists || isLocked}
              onClick={() => openPanel("change")}
            >
              <KeyRound className="size-3.5" aria-hidden="true" />
              Change password
            </Button>
            <Button
              variant="coral"
              size="sm"
              disabled={!publicIdentity}
              onClick={lock}
            >
              <Lock className="size-3.5" aria-hidden="true" />
              Lock identity
            </Button>
          </div>

          {note ? (
            <p className="border-ink bg-lime mt-4 border-2 p-3 text-xs font-medium">
              {note}
            </p>
          ) : null}
          {error ? (
            <p
              role="alert"
              className="border-ink bg-coral/25 mt-4 border-2 p-3 text-xs leading-relaxed font-medium"
            >
              {error}
            </p>
          ) : null}

          {/* Export */}
          {panel === "export" ? (
            <div className="border-ink mt-4 border-2 p-4">
              <SectionLabel className="text-grey">
                Export encrypted backup
              </SectionLabel>
              <p className="text-grey mt-2 text-xs leading-relaxed">
                Re-encrypts your keys with a fresh salt and nonce, then
                downloads the file. Confirm your password to continue.
              </p>
              <div className="mt-4 max-w-sm">
                <Field label="Vault password" htmlFor="export-password" required>
                  <PasswordInput
                    id="export-password"
                    value={exportPw}
                    onChange={setExportPw}
                    autoComplete="current-password"
                  />
                </Field>
              </div>
              <Button
                variant="primary"
                size="md"
                className="mt-4"
                disabled={exportPw.length === 0 || busy}
                onClick={handleExport}
              >
                {busy ? (
                  <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Download className="size-4" aria-hidden="true" />
                )}
                Download
              </Button>
            </div>
          ) : null}

          {/* Change password */}
          {panel === "change" ? (
            <div className="border-ink mt-4 border-2 p-4">
              <SectionLabel className="text-grey">
                Change vault password
              </SectionLabel>
              <p className="text-grey mt-2 text-xs leading-relaxed">
                Your private keys do not change — only the encryption around
                them. Previously exported backup files keep their old password,
                so export a fresh one afterwards.
              </p>
              <div className="mt-4 max-w-sm space-y-4">
                <Field
                  label="Current password"
                  htmlFor="current-password"
                  required
                >
                  <PasswordInput
                    id="current-password"
                    value={currentPw}
                    onChange={setCurrentPw}
                    autoComplete="current-password"
                  />
                </Field>
                <NewPasswordFields
                  idPrefix="change"
                  password={nextPw}
                  confirm={confirmPw}
                  onPasswordChange={setNextPw}
                  onConfirmChange={setConfirmPw}
                />
              </div>
              <Button
                variant="primary"
                size="md"
                className="mt-4"
                disabled={
                  currentPw.length === 0 ||
                  !newPasswordIsValid(nextPw, confirmPw) ||
                  busy
                }
                onClick={handleChange}
              >
                {busy ? (
                  <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <KeyRound className="size-4" aria-hidden="true" />
                )}
                Change password
              </Button>
            </div>
          ) : null}

          {/* Import */}
          {panel === "import" ? (
            <div className="mt-4">
              <ImportBackupPanel onRestored={() => setPanel("none")} />
            </div>
          ) : null}
        </div>

        {/* ---- Recovery instructions ---- */}
        <div className="p-4">
          <p className="font-display text-sm font-bold">
            If you lose this device
          </p>
          <ol className="mt-3 space-y-2">
            {[
              "Install StealthPay on the new device.",
              "Choose “Import an encrypted backup” on the unlock screen.",
              "Select your .stealthpay file and enter its password.",
              "The app recomputes your public keys from the decrypted private keys and rebuilds your meta-address — if anything disagrees, the restore is rejected rather than partially applied.",
            ].map((line, i) => (
              <li key={line} className="flex gap-2.5 text-xs leading-relaxed">
                <span className="border-ink font-display grid size-5 shrink-0 place-items-center border-2 bg-white text-[0.6rem] font-bold">
                  {i + 1}
                </span>
                {line}
              </li>
            ))}
          </ol>
          <p className="border-ink bg-coral/25 mt-4 border-2 p-3 text-xs leading-relaxed">
            <strong className="font-display">Both are required.</strong> The
            file alone is useless without the password, and the password is
            useless without the file. Store them separately, and never put the
            password in the same place as the backup.
          </p>
        </div>
      </div>
    </section>
  );
}
