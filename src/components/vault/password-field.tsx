"use client";

import * as React from "react";
import { Eye, EyeOff } from "lucide-react";
import { Field, Input } from "@/components/ui/field";
import { SectionLabel } from "@/components/ui/section-label";
import { assessPassword, RECOMMENDED_PASSWORD_LENGTH } from "@/lib/vault";
import { cn } from "@/lib/utils";

const BAR_TONE = ["bg-paper-3", "bg-coral", "bg-coral", "bg-lime", "bg-lime"];

/** Password input with a reveal toggle. */
export function PasswordInput({
  id,
  value,
  onChange,
  placeholder,
  autoComplete = "new-password",
  autoFocus,
}: {
  id: string;
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  autoComplete?: string;
  autoFocus?: boolean;
}) {
  const [shown, setShown] = React.useState(false);

  return (
    <div className="relative">
      <Input
        id={id}
        type={shown ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        autoFocus={autoFocus}
        spellCheck={false}
        className="pr-12 font-sans"
      />
      <button
        type="button"
        onClick={() => setShown((s) => !s)}
        aria-label={shown ? "Hide password" : "Show password"}
        className="border-ink hover:bg-lime absolute top-1/2 right-1.5 grid size-9 -translate-y-1/2 place-items-center border-2 bg-white"
      >
        {shown ? (
          <EyeOff className="size-4" aria-hidden="true" />
        ) : (
          <Eye className="size-4" aria-hidden="true" />
        )}
      </button>
    </div>
  );
}

/** Local strength meter. The password is never sent anywhere to be scored. */
export function PasswordStrengthMeter({ password }: { password: string }) {
  const assessment = assessPassword(password);
  if (!password) return null;

  return (
    <div className="mt-2">
      <div className="flex items-center justify-between gap-2">
        <SectionLabel className="text-grey">Strength</SectionLabel>
        <span className="font-display text-[0.7rem] font-bold uppercase">
          {assessment.label}
        </span>
      </div>
      <div className="border-ink mt-1.5 flex gap-1 border-2 bg-white p-1">
        {[1, 2, 3, 4].map((step) => (
          <span
            key={step}
            className={cn(
              "h-2 flex-1",
              step <= assessment.score ? BAR_TONE[assessment.score] : "bg-paper-2",
            )}
          />
        ))}
      </div>
      {assessment.suggestions.length > 0 ? (
        <ul className="text-grey mt-1.5 space-y-0.5 text-[0.7rem] leading-relaxed">
          {assessment.suggestions.map((s) => (
            <li key={s}>· {s}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/**
 * Create-and-confirm password pair.
 *
 * Reports validity upward; never stores or transmits the value.
 */
export function NewPasswordFields({
  password,
  confirm,
  onPasswordChange,
  onConfirmChange,
  idPrefix = "vault",
}: {
  password: string;
  confirm: string;
  onPasswordChange: (next: string) => void;
  onConfirmChange: (next: string) => void;
  idPrefix?: string;
}) {
  const assessment = assessPassword(password);
  const mismatch = confirm.length > 0 && confirm !== password;

  return (
    <div className="space-y-4">
      <Field
        label="Vault password"
        htmlFor={`${idPrefix}-password`}
        required
        hint={`Encrypts your keys on this device. ${RECOMMENDED_PASSWORD_LENGTH}+ characters, or four unrelated words.`}
        error={
          password.length > 0 && !assessment.acceptable
            ? assessment.suggestions[0]
            : null
        }
      >
        <PasswordInput
          id={`${idPrefix}-password`}
          value={password}
          onChange={onPasswordChange}
          placeholder="A long passphrase you will remember"
          autoFocus
        />
      </Field>

      <PasswordStrengthMeter password={password} />

      <Field
        label="Confirm password"
        htmlFor={`${idPrefix}-confirm`}
        required
        error={mismatch ? "Passwords do not match." : null}
      >
        <PasswordInput
          id={`${idPrefix}-confirm`}
          value={confirm}
          onChange={onConfirmChange}
          placeholder="Type it again"
        />
      </Field>
    </div>
  );
}

export function newPasswordIsValid(password: string, confirm: string): boolean {
  return assessPassword(password).acceptable && password === confirm;
}
