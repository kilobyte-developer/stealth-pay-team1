"use client";

import * as React from "react";
import {
  CircleCheck,
  Download,
  Fingerprint,
  LoaderCircle,
  Lock,
  ShieldAlert,
  TriangleAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SectionLabel } from "@/components/ui/section-label";
import { MonoBlock } from "@/components/ui/mono";
import {
  NewPasswordFields,
  newPasswordIsValid,
} from "@/components/vault/password-field";
import { useStealthIdentity } from "@/providers/stealth-identity-provider";
import { downloadTextFile } from "@/lib/download";
import { cn } from "@/lib/utils";

type Step = "password" | "backup" | "done";

const STEPS: { id: Step; label: string }[] = [
  { id: "password", label: "Create vault password" },
  { id: "backup", label: "Download encrypted backup" },
  { id: "done", label: "Recovery ready" },
];

/**
 * First-time identity creation.
 *
 * Generates real SECP256k1 keys, encrypts them with Argon2id + AES-256-GCM,
 * verifies the round trip, persists only ciphertext, then walks the user
 * through taking an off-device backup.
 */
export function IdentitySetup() {
  const {
    createIdentity,
    requestExport,
    confirmBackup,
    publicIdentity,
    vaultStatus,
    busy,
    error,
  } = useStealthIdentity();

  const [step, setStep] = React.useState<Step>("password");
  const [password, setPassword] = React.useState("");
  const [confirmPw, setConfirmPw] = React.useState("");
  const [exportPassword, setExportPassword] = React.useState("");
  const [downloaded, setDownloaded] = React.useState(false);
  const [acknowledged, setAcknowledged] = React.useState(false);

  const valid = newPasswordIsValid(password, confirmPw);

  async function handleCreate() {
    const ok = await createIdentity(password);
    if (ok) {
      // Keep the password only long enough to produce the first backup.
      setExportPassword(password);
      setPassword("");
      setConfirmPw("");
      setStep("backup");
    }
  }

  async function handleDownload() {
    const file = await requestExport(exportPassword);
    if (file) {
      downloadTextFile(file.filename, file.contents);
      setDownloaded(true);
    }
  }

  async function handleFinish() {
    await confirmBackup();
    setExportPassword("");
    setStep("done");
  }

  const activeIndex = STEPS.findIndex((s) => s.id === step);

  return (
    <div className="border-ink shadow-brutal-md border-[3px] bg-white p-6 sm:p-8">
      <span className="border-ink bg-lime grid size-14 place-items-center border-2">
        <Fingerprint className="size-7" aria-hidden="true" />
      </span>

      <SectionLabel className="text-blue mt-5">
        Set up your stealth identity
      </SectionLabel>
      <h2 className="mt-3 text-2xl sm:text-3xl">
        {step === "done" ? "Recovery ready." : "Create and protect your keys."}
      </h2>

      {/* Step rail */}
      <ol className="mt-6 grid gap-2 sm:grid-cols-3">
        {STEPS.map((s, i) => (
          <li
            key={s.id}
            className={cn(
              "border-ink flex items-center gap-2.5 border-2 p-2.5",
              i < activeIndex
                ? "bg-lime"
                : i === activeIndex
                  ? "bg-paper-2 shadow-brutal-xs"
                  : "bg-white",
            )}
          >
            <span className="border-ink font-display grid size-7 shrink-0 place-items-center border-2 bg-white text-xs font-bold">
              {i < activeIndex ? "✓" : i + 1}
            </span>
            <span className="font-display text-[0.7rem] leading-tight font-bold uppercase">
              {s.label}
            </span>
          </li>
        ))}
      </ol>

      {error ? (
        <p
          role="alert"
          className="border-ink bg-coral/25 mt-5 border-2 p-3 text-xs leading-relaxed font-medium"
        >
          {error}
        </p>
      ) : null}

      {/* ---- Step 1: password ---- */}
      {step === "password" ? (
        <div className="mt-6">
          <p className="text-grey max-w-xl text-sm leading-relaxed">
            Two independent SECP256k1 key pairs are generated in your browser,
            then encrypted with <strong>Argon2id + AES-256-GCM</strong> before
            anything is written to disk. Only the ciphertext is stored.
          </p>

          <div className="border-ink bg-coral/25 mt-5 flex items-start gap-2.5 border-2 p-3">
            <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <p className="text-xs leading-relaxed">
              <strong className="font-display">
                There is no password reset.
              </strong>{" "}
              This password is the only thing that can decrypt your keys. If you
              lose both it and your backup file, the identity and any funds
              received through it are gone permanently. No one — including us —
              can recover them.
            </p>
          </div>

          <div className="mt-6 max-w-md">
            <NewPasswordFields
              password={password}
              confirm={confirmPw}
              onPasswordChange={setPassword}
              onConfirmChange={setConfirmPw}
            />
          </div>

          <Button
            variant="primary"
            size="lg"
            className="mt-6"
            disabled={!valid || busy}
            onClick={handleCreate}
          >
            {busy ? (
              <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Lock className="size-4" aria-hidden="true" />
            )}
            {busy ? "Encrypting…" : "Generate & encrypt identity"}
          </Button>
          {busy ? (
            <p className="text-grey mt-2 text-xs">
              Argon2id is intentionally slow — this takes a moment.
            </p>
          ) : null}
        </div>
      ) : null}

      {/* ---- Step 2: backup ---- */}
      {step === "backup" ? (
        <div className="mt-6">
          <Badge tone="lime" size="md">
            <CircleCheck className="size-3" aria-hidden="true" />
            Encrypted vault saved on this device
          </Badge>

          <p className="text-grey mt-4 max-w-xl text-sm leading-relaxed">
            The vault survives a page refresh, but not a cleared browser
            profile, a lost device or a reinstalled OS. Download the encrypted
            backup file and store it somewhere you control.
          </p>

          {publicIdentity ? (
            <div className="mt-5">
              <SectionLabel className="text-grey">
                Your meta-address (public, safe to share)
              </SectionLabel>
              <MonoBlock className="mt-2 text-[0.65rem]">
                {publicIdentity.stealthMetaAddress}
              </MonoBlock>
            </div>
          ) : null}

          <div className="mt-6 flex flex-wrap gap-3">
            <Button
              variant={downloaded ? "secondary" : "primary"}
              size="lg"
              onClick={handleDownload}
              disabled={busy}
            >
              {busy ? (
                <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <Download className="size-4" aria-hidden="true" />
              )}
              {downloaded ? "Download again" : "Download encrypted backup"}
            </Button>
          </div>

          <label className="border-ink bg-paper-2 mt-5 flex max-w-xl cursor-pointer items-start gap-3 border-2 p-3">
            <input
              type="checkbox"
              checked={acknowledged}
              onChange={(e) => setAcknowledged(e.target.checked)}
              disabled={!downloaded}
              className="border-ink accent-lime mt-0.5 size-4 shrink-0 border-2"
            />
            <span className="text-xs leading-relaxed">
              I have saved the backup file somewhere safe, and I understand that
              losing both the file and the password means losing the identity
              permanently.
            </span>
          </label>

          {!downloaded ? (
            <p className="text-grey mt-2 text-xs">
              Download the file first — the checkbox is a claim about where you
              put it, not a substitute for having it.
            </p>
          ) : null}

          <Button
            variant="primary"
            size="lg"
            className="mt-5"
            disabled={!downloaded || !acknowledged || busy}
            onClick={handleFinish}
          >
            Finish setup
          </Button>
        </div>
      ) : null}

      {/* ---- Step 3: done ---- */}
      {step === "done" ? (
        <div className="mt-6">
          <Badge tone="lime" size="md">
            <CircleCheck className="size-3" aria-hidden="true" />
            {vaultStatus?.recoveryStatus === "recovery_verified"
              ? "Recovery verified"
              : "Encrypted vault ready"}
          </Badge>

          <p className="text-grey mt-4 max-w-xl text-sm leading-relaxed">
            Your identity is encrypted on this device and you hold an encrypted
            off-device backup. You can re-export it or change the password at
            any time from Settings.
          </p>

          <div className="border-ink bg-paper-2 mt-5 flex items-start gap-2.5 border-2 p-3">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <p className="text-xs leading-relaxed">
              Encryption at rest protects a stolen disk or browser profile. It
              does not make the app immune to a compromised page while the vault
              is unlocked. Lock the vault when you are done.
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
