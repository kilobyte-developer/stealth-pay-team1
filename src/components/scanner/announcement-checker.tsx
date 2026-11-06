"use client";

import * as React from "react";
import {
  CircleCheck,
  CircleSlash,
  CircleX,
  KeyRound,
  Radar,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Field, Input } from "@/components/ui/field";
import { SectionLabel } from "@/components/ui/section-label";
import { DataList, DataRow } from "@/components/ui/mono";
import { useStealthIdentity } from "@/providers/stealth-identity-provider";
import { useActiveNetwork } from "@/providers/wallet-provider";
import { NETWORKS } from "@/config/networks";
import {
  generateOneTimeStealthAddress,
  toSafeErrorMessage,
  type StealthCheckResult,
  type SupportedChainId,
} from "@/lib/stealth";
import type { Address, Hex } from "viem";

const REASON_META: Record<
  StealthCheckResult["reason"],
  { label: string; tone: "lime" | "coral" | "muted"; Icon: typeof CircleCheck }
> = {
  match: { label: "Belongs to you", tone: "lime", Icon: CircleCheck },
  "view-tag-mismatch": {
    label: "Filtered by view tag",
    tone: "muted",
    Icon: CircleSlash,
  },
  "address-mismatch": {
    label: "Not for you",
    tone: "coral",
    Icon: CircleX,
  },
};

/**
 * Evaluates a supplied ERC-5564 announcement against the session identity's
 * viewing key using the real crypto engine.
 *
 * This is not live chain scanning — announcements are entered by hand or
 * generated locally. Reading real announcements from Avalanche arrives with the
 * contract and scanner milestone.
 */
export function AnnouncementChecker() {
  const { publicIdentity, checkAnnouncement, proveSpendControl } =
    useStealthIdentity();
  const networkKey = useActiveNetwork();
  const chainId = NETWORKS[networkKey].chainId as SupportedChainId;

  const [stealthAddress, setStealthAddress] = React.useState("");
  const [ephemeralPublicKey, setEphemeralPublicKey] = React.useState("");
  const [viewTag, setViewTag] = React.useState("");
  const [result, setResult] = React.useState<StealthCheckResult | null>(null);
  const [proof, setProof] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  function clearOutputs() {
    setResult(null);
    setProof(null);
    setError(null);
  }

  function fillWithSelfTest() {
    if (!publicIdentity) return;
    clearOutputs();
    try {
      const payment = generateOneTimeStealthAddress({
        metaAddress: publicIdentity.stealthMetaAddress,
        chainId,
      });
      setStealthAddress(payment.stealthAddress);
      setEphemeralPublicKey(payment.ephemeralPublicKey);
      setViewTag(payment.viewTag);
    } catch (err) {
      setError(toSafeErrorMessage(err));
    }
  }

  function runCheck() {
    clearOutputs();
    try {
      const outcome = checkAnnouncement({
        stealthAddress: stealthAddress as Address,
        ephemeralPublicKey: ephemeralPublicKey as Hex,
        viewTag: viewTag as Hex,
      });
      if (!outcome) {
        setError("No identity in this session.");
        return;
      }
      setResult(outcome);
    } catch (err) {
      setError(toSafeErrorMessage(err));
    }
  }

  function runProof() {
    setProof(null);
    setError(null);
    const outcome = proveSpendControl({
      stealthAddress: stealthAddress as Address,
      ephemeralPublicKey: ephemeralPublicKey as Hex,
      viewTag: viewTag as Hex,
    });
    if (outcome.ok && outcome.stealthAddress) {
      setProof(outcome.stealthAddress);
    } else {
      setError(outcome.error ?? "Could not prove control of that address.");
    }
  }

  if (!publicIdentity) {
    return (
      <div className="border-ink border-2 border-dashed bg-white p-6 text-center">
        <Radar className="text-grey mx-auto size-7" aria-hidden="true" />
        <p className="font-display mt-3 text-sm font-bold">
          No identity in this session
        </p>
        <p className="text-grey mx-auto mt-1.5 max-w-sm text-xs leading-relaxed">
          Create a stealth identity on the Receive or Stealth Identity page to
          check announcements against a real viewing key.
        </p>
      </div>
    );
  }

  const ready = stealthAddress && ephemeralPublicKey && viewTag;

  return (
    <div className="border-ink shadow-brutal border-2 bg-white p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <SectionLabel className="text-blue">
            Check an announcement
          </SectionLabel>
          <p className="text-grey mt-2 max-w-xl text-sm leading-relaxed">
            Runs the real ERC-5564 check against this session&apos;s private
            viewing key: view tag first, then full address derivation.
          </p>
        </div>
        <Badge tone="lime" size="md">
          Real crypto
        </Badge>
      </div>

      <div className="mt-5 grid gap-4">
        <Field
          label="Stealth address"
          htmlFor="check-address"
          hint="The one-time address published in the announcement."
        >
          <Input
            id="check-address"
            spellCheck={false}
            placeholder="0x…"
            value={stealthAddress}
            onChange={(e) => {
              setStealthAddress(e.target.value.trim());
              clearOutputs();
            }}
          />
        </Field>

        <Field
          label="Ephemeral public key (R)"
          htmlFor="check-ephemeral"
          hint="33-byte compressed key from the announcement."
        >
          <Input
            id="check-ephemeral"
            spellCheck={false}
            placeholder="0x02…"
            value={ephemeralPublicKey}
            onChange={(e) => {
              setEphemeralPublicKey(e.target.value.trim());
              clearOutputs();
            }}
          />
        </Field>

        <Field
          label="View tag"
          htmlFor="check-viewtag"
          hint="First metadata byte, e.g. 0x4b."
        >
          <Input
            id="check-viewtag"
            spellCheck={false}
            placeholder="0x4b"
            value={viewTag}
            onChange={(e) => {
              setViewTag(e.target.value.trim());
              clearOutputs();
            }}
          />
        </Field>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <Button variant="primary" size="md" disabled={!ready} onClick={runCheck}>
          <Radar className="size-4" aria-hidden="true" />
          Check announcement
        </Button>
        <Button variant="secondary" size="md" onClick={fillWithSelfTest}>
          <Sparkles className="size-4" aria-hidden="true" />
          Generate one to myself
        </Button>
        {result?.isForUser ? (
          <Button variant="dark" size="md" onClick={runProof}>
            <KeyRound className="size-4" aria-hidden="true" />
            Prove spend control
          </Button>
        ) : null}
      </div>

      {error ? (
        <p
          role="alert"
          className="border-ink bg-coral/25 mt-4 border-2 p-3 text-xs leading-relaxed font-medium"
        >
          {error}
        </p>
      ) : null}

      {result ? (
        <div className="border-ink mt-5 border-2 p-4">
          {(() => {
            const meta = REASON_META[result.reason];
            return (
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={meta.tone} size="md">
                  <meta.Icon className="size-3" aria-hidden="true" />
                  {meta.label}
                </Badge>
                <span className="text-grey font-mono text-[0.7rem]">
                  {result.reason}
                </span>
              </div>
            );
          })()}

          <DataList className="mt-3">
            <DataRow label="Derived address">
              {result.derivedStealthAddress ? (
                <span className="break-all">
                  {result.derivedStealthAddress}
                </span>
              ) : (
                <span className="font-sans text-grey text-xs">
                  Not derived — the view tag filtered this announcement first,
                  which is exactly the optimisation it exists for.
                </span>
              )}
            </DataRow>
          </DataList>
        </div>
      ) : null}

      {proof ? (
        <div className="border-ink bg-lime mt-4 border-2 p-4">
          <SectionLabel>Spend control proven</SectionLabel>
          <p className="mt-2 text-xs leading-relaxed">
            The one-time private key was derived, verified to control the
            address below, and then destroyed. It was never displayed, logged or
            transmitted.
          </p>
          <p className="mt-2 font-mono text-xs break-all">{proof}</p>
        </div>
      ) : null}
    </div>
  );
}
