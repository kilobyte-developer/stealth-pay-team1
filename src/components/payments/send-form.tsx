"use client";

import * as React from "react";
import {
  ArrowRight,
  CircleCheck,
  ExternalLink,
  Info,
  KeyRound,
  LoaderCircle,
  RefreshCw,
  Send,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";
import { SectionLabel } from "@/components/ui/section-label";
import { MonoBlock, DataList, DataRow } from "@/components/ui/mono";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { assetsFor, NETWORKS } from "@/config/networks";
import { useActiveNetwork } from "@/providers/wallet-provider";
import { useStealthIdentity } from "@/providers/stealth-identity-provider";
import { explorerTxUrl, formatAmount } from "@/lib/format";
import { describeSendBlock, useSendPayment } from "@/hooks/use-send-payment";
import {
  generateOneTimeStealthAddress,
  parseStealthMetaAddress,
  toSafeErrorMessage,
  type OneTimeStealthAddress,
  type SupportedChainId,
} from "@/lib/stealth";

export function SendForm() {
  const [metaAddress, setMetaAddress] = React.useState("");
  const [asset, setAsset] = React.useState("AVAX");
  const [amount, setAmount] = React.useState("");
  const [note, setNote] = React.useState("");
  const [gasTopUpAvax, setGasTopUpAvax] = React.useState("");
  const [touched, setTouched] = React.useState({ meta: false, amount: false });
  /**
   * A derivation is bound to the meta-address it came from. Rather than
   * clearing it from an effect when the input changes, the binding is stored
   * alongside the result and staleness is derived during render.
   */
  const [derivation, setDerivation] = React.useState<{
    forMetaAddress: string;
    result: OneTimeStealthAddress | null;
    error: string | null;
  } | null>(null);
  const [confirmOpen, setConfirmOpen] = React.useState(false);

  const networkKey = useActiveNetwork();
  const network = NETWORKS[networkKey];
  const chainId = network.chainId as SupportedChainId;
  const { publicIdentity } = useStealthIdentity();
  const { toast } = useToast();
  const sendState = useSendPayment();

  const assets = React.useMemo(() => assetsFor(networkKey), [networkKey]);
  const selectedAsset = assets.find((a) => a.symbol === asset);

  /* ---- Real meta-address validation ---- */
  const metaError = React.useMemo(() => {
    if (!metaAddress) return "Enter the recipient's stealth meta-address.";
    try {
      parseStealthMetaAddress(metaAddress);
      return null;
    } catch (error) {
      return toSafeErrorMessage(error);
    }
  }, [metaAddress]);

  const amountError = React.useMemo(() => {
    if (!amount) return "Enter an amount.";
    const n = Number(amount);
    if (!Number.isFinite(n)) return "Enter a valid number.";
    if (n <= 0) return "Amount must be greater than zero.";
    return null;
  }, [amount]);

  const gasTopUpError = React.useMemo(() => {
    if (selectedAsset?.native || !gasTopUpAvax) return null;
    const n = Number(gasTopUpAvax);
    if (!Number.isFinite(n)) return "Enter a valid number.";
    if (n < 0) return "Top-up cannot be negative.";
    return null;
  }, [gasTopUpAvax, selectedAsset]);

  const canDerive = !metaError && !amountError && !gasTopUpError;

  // Only honour a derivation that belongs to the meta-address currently typed.
  const active =
    derivation?.forMetaAddress === metaAddress ? derivation : null;
  const derived = active?.result ?? null;
  const deriveError = active?.error ?? null;

  function derive() {
    try {
      // Generates a fresh ephemeral key pair for this payment. The ephemeral
      // private key is never returned here and never leaves the engine.
      const result = generateOneTimeStealthAddress({ metaAddress, chainId });
      setDerivation({ forMetaAddress: metaAddress, result, error: null });
      toast({
        tone: "success",
        title: "One-time address derived",
        description: "Fresh ephemeral key generated for this payment.",
      });
    } catch (error) {
      setDerivation({
        forMetaAddress: metaAddress,
        result: null,
        error: toSafeErrorMessage(error),
      });
    }
  }

  function reset() {
    setMetaAddress("");
    setAsset("AVAX");
    setAmount("");
    setNote("");
    setGasTopUpAvax("");
    setTouched({ meta: false, amount: false });
    setDerivation(null);
  }

  async function handleConfirm() {
    if (!derived) return;
    await sendState.send({
      derived,
      amount,
      token: selectedAsset?.contract ?? null,
      tokenDecimals: selectedAsset?.decimals,
      assetSymbol: asset,
      gasTopUpAvax:
        !selectedAsset?.native && gasTopUpAvax ? gasTopUpAvax : undefined,
    });
    setConfirmOpen(false);
  }

  if (sendState.stage === "confirmed" && derived) {
    return (
      <div className="border-ink shadow-brutal-md border-[3px] bg-white p-5 sm:p-7">
        <div className="flex flex-wrap items-center gap-2">
          <span className="border-ink bg-lime grid size-10 place-items-center border-2">
            <CircleCheck className="size-5" aria-hidden="true" />
          </span>
          <div>
            <SectionLabel className="text-grey">Payment sent</SectionLabel>
            <p className="font-display mt-1 text-lg font-bold">
              Confirmed on {network.shortName}
            </p>
          </div>
        </div>

        <DataList className="mt-5">
          <DataRow label="Amount" mono={false}>
            <span className="font-display font-bold">
              {formatAmount(amount)} {asset}
            </span>
          </DataRow>
          <DataRow label="Stealth address">
            <span className="break-all">{derived.stealthAddress}</span>
          </DataRow>
          <DataRow label="Transaction">
            <span className="break-all">{sendState.txHash}</span>
          </DataRow>
          <DataRow label="View tag" mono>
            {derived.viewTag}
          </DataRow>
        </DataList>

        <p className="text-grey mt-4 text-xs leading-relaxed">
          The router transferred the funds and emitted the ERC-5564 announcement
          in the same transaction, so the recipient can detect it.
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          {sendState.txHash ? (
            <a
              href={explorerTxUrl(networkKey, sendState.txHash)}
              target="_blank"
              rel="noreferrer noopener"
              className="brutal-press border-ink shadow-brutal-xs hover:shadow-brutal-sm font-display inline-flex items-center gap-1.5 border-2 bg-white px-3 py-2 text-xs font-bold uppercase"
            >
              View on {network.explorerName}
              <ExternalLink className="size-3.5" aria-hidden="true" />
            </a>
          ) : null}
          <Button
            variant="primary"
            size="md"
            onClick={() => {
              sendState.reset();
              reset();
            }}
          >
            <RefreshCw className="size-4" aria-hidden="true" />
            Send another
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.25fr_1fr] lg:items-start">
      {/* ---- Recipient details ---- */}
      <div className="border-ink shadow-brutal border-2 bg-white p-5 sm:p-6">
        <SectionLabel className="text-grey">Recipient details</SectionLabel>

        <div className="mt-5 space-y-4">
          <Field
            label="Recipient stealth meta-address"
            htmlFor="send-meta"
            required
            error={touched.meta ? metaError : null}
            hint="The public (B, A) pair the recipient published. Never a wallet address."
          >
            <Textarea
              id="send-meta"
              rows={3}
              spellCheck={false}
              placeholder="st:avax:0x…"
              value={metaAddress}
              onChange={(e) => setMetaAddress(e.target.value.trim())}
              onBlur={() => setTouched((t) => ({ ...t, meta: true }))}
              aria-invalid={touched.meta && metaError ? true : undefined}
            />
          </Field>

          {publicIdentity ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setMetaAddress(publicIdentity.stealthMetaAddress);
                setTouched((t) => ({ ...t, meta: true }));
              }}
            >
              <Sparkles className="size-3.5" aria-hidden="true" />
              Use my own meta-address (self-test)
            </Button>
          ) : (
            <p className="text-grey text-xs leading-relaxed">
              Tip: create an identity on the Receive page to paste your own
              meta-address here and watch the full round trip.
            </p>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Asset" htmlFor="send-asset" required>
              <Select
                id="send-asset"
                value={asset}
                onChange={(e) => setAsset(e.target.value)}
              >
                {assets.map((a) => (
                  <option key={a.symbol} value={a.symbol}>
                    {a.symbol}
                  </option>
                ))}
              </Select>
            </Field>

            <Field
              label="Amount"
              htmlFor="send-amount"
              required
              error={touched.amount ? amountError : null}
            >
              <Input
                id="send-amount"
                inputMode="decimal"
                placeholder="10.0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                onBlur={() => setTouched((t) => ({ ...t, amount: true }))}
                aria-invalid={touched.amount && amountError ? true : undefined}
              />
            </Field>
          </div>

          {!selectedAsset?.native ? (
            <Field
              label="Native gas top-up (optional)"
              htmlFor="send-gas-topup"
              error={gasTopUpError}
              hint={`Sends extra AVAX to the recipient's one-time address so it can pay gas to move the ${asset} later.`}
            >
              <Input
                id="send-gas-topup"
                inputMode="decimal"
                placeholder="0.01"
                value={gasTopUpAvax}
                onChange={(e) => setGasTopUpAvax(e.target.value)}
                aria-invalid={gasTopUpError ? true : undefined}
              />
            </Field>
          ) : null}

          <Field
            label="Note (optional)"
            htmlFor="send-note"
            hint="Held in this form only. Never written on-chain."
          >
            <Input
              id="send-note"
              maxLength={120}
              placeholder="Retainer payment"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </Field>
        </div>

        {!selectedAsset?.native ? (
          <p className="border-ink bg-paper-2 mt-5 flex items-start gap-2 border-2 p-3 text-xs leading-relaxed">
            <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span>
              {asset} requires your wallet to approve the router before the
              transfer. You will see two signature prompts: one approval, then
              the payment itself.
            </span>
          </p>
        ) : null}

        <Button
          variant="primary"
          size="lg"
          className="mt-5 w-full"
          disabled={!canDerive}
          onClick={derive}
        >
          <KeyRound className="size-4" aria-hidden="true" />
          {derived ? "Re-derive with a new ephemeral key" : "Derive one-time address"}
        </Button>

        {deriveError ? (
          <p role="alert" className="text-coral-deep mt-3 text-sm font-bold">
            {deriveError}
          </p>
        ) : null}
      </div>

      {/* ---- Preview ---- */}
      <div className="space-y-4">
        <div className="border-ink shadow-brutal border-2 bg-white p-5">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <SectionLabel className="text-grey">Derived destination</SectionLabel>
            {derived ? (
              <Badge tone="lime" size="sm">
                Real ERC-5564 output
              </Badge>
            ) : null}
          </div>

          {derived ? (
            <>
              <DataList className="mt-4">
                <DataRow label="Asset" mono={false}>
                  <span className="font-display font-bold">{asset}</span>
                </DataRow>
                <DataRow label="Amount" mono={false}>
                  <span className="font-display font-bold">
                    {formatAmount(amount)} {asset}
                  </span>
                </DataRow>
              </DataList>

              <div className="mt-4 space-y-3">
                <div>
                  <p className="font-display text-[0.65rem] font-bold tracking-[0.16em] uppercase">
                    Derived one-time address
                  </p>
                  <MonoBlock className="mt-1.5 text-[0.65rem]">
                    {derived.stealthAddress}
                  </MonoBlock>
                </div>
                <div>
                  <p className="font-display text-[0.65rem] font-bold tracking-[0.16em] uppercase">
                    Ephemeral public key (R)
                  </p>
                  <MonoBlock className="mt-1.5 text-[0.65rem]">
                    {derived.ephemeralPublicKey}
                  </MonoBlock>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="font-display text-[0.65rem] font-bold tracking-[0.16em] uppercase">
                      View tag
                    </p>
                    <MonoBlock className="mt-1.5">{derived.viewTag}</MonoBlock>
                  </div>
                  <div>
                    <p className="font-display text-[0.65rem] font-bold tracking-[0.16em] uppercase">
                      Scheme ID
                    </p>
                    <MonoBlock className="mt-1.5">{derived.schemeId}</MonoBlock>
                  </div>
                </div>
                <div>
                  <p className="font-display text-[0.65rem] font-bold tracking-[0.16em] uppercase">
                    Est. network fee
                  </p>
                  <MonoBlock className="mt-1.5">— not estimated</MonoBlock>
                </div>
              </div>

              <p className="border-ink bg-paper-2 mt-4 flex items-start gap-2 border-2 p-3 text-[0.7rem] leading-relaxed">
                <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                <span>
                  Derived with ERC-5564 scheme 1. The ephemeral <em>private</em>
                  key was used once and discarded — only its public half is
                  published on-chain. Your wallet will show the exact network fee
                  before you sign.
                </span>
              </p>

              {sendState.blocked ? (
                <p className="border-ink bg-coral/25 mt-5 flex items-start gap-2 border-2 p-3 text-xs leading-relaxed">
                  <TriangleAlert
                    className="mt-0.5 size-4 shrink-0"
                    aria-hidden="true"
                  />
                  {describeSendBlock(sendState.blocked, networkKey)}
                </p>
              ) : null}

              {sendState.error ? (
                <p
                  role="alert"
                  className="border-ink bg-coral/25 mt-4 border-2 p-3 text-xs leading-relaxed font-medium"
                >
                  {sendState.error}
                </p>
              ) : null}

              <Button
                variant="primary"
                size="lg"
                className="mt-5 w-full"
                disabled={sendState.blocked !== null}
                onClick={() => setConfirmOpen(true)}
              >
                <Send className="size-4" aria-hidden="true" />
                Review &amp; Send
              </Button>
            </>
          ) : (
            <div className="border-ink mt-4 border-2 border-dashed p-6 text-center">
              <ArrowRight
                className="text-grey mx-auto size-6"
                aria-hidden="true"
              />
              <p className="font-display mt-3 text-sm font-bold">
                Preview appears here
              </p>
              <p className="text-grey mt-1.5 text-xs leading-relaxed">
                Enter a valid meta-address and amount, then derive the one-time
                address.
              </p>
            </div>
          )}
        </div>

        <div className="border-ink bg-ink text-paper border-2 p-4">
          <SectionLabel className="text-lime">Why this is safe</SectionLabel>
          <p className="text-paper/75 mt-2.5 text-xs leading-relaxed">
            A sender only ever holds public key material. The ephemeral private
            key is generated locally, used once, and never published — only its
            public half travels on-chain in the announcement.
          </p>
        </div>
      </div>

      {/* ---- Confirmation ---- */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm payment details</DialogTitle>
            <DialogDescription>
              Review before continuing. This step does not broadcast a
              transaction.
            </DialogDescription>
          </DialogHeader>

          <DataList>
            <DataRow label="Recipient">
              <span className="break-all">{metaAddress}</span>
            </DataRow>
            <DataRow label="Destination">
              <span className="break-all">{derived?.stealthAddress}</span>
            </DataRow>
            <DataRow label="Asset" mono={false}>
              {asset}
            </DataRow>
            <DataRow label="Amount" mono={false}>
              <span className="font-display font-bold">
                {formatAmount(amount)} {asset}
              </span>
            </DataRow>
            {!selectedAsset?.native && gasTopUpAvax && !gasTopUpError ? (
              <DataRow label="Gas top-up" mono={false}>
                {formatAmount(gasTopUpAvax)} AVAX
              </DataRow>
            ) : null}
            <DataRow label="Network" mono={false}>
              {network.name} · chain {network.chainId}
            </DataRow>
            <DataRow label="Network fee" mono={false}>
              Shown by your wallet before signing
            </DataRow>
          </DataList>

          <p className="border-ink bg-paper-2 mt-5 border-2 p-3 text-xs leading-relaxed">
            Confirming opens your wallet to sign a real transaction on{" "}
            {network.shortName}. The router transfers the funds and emits the
            announcement atomically.
          </p>

          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              disabled={
                sendState.stage === "approving" ||
                sendState.stage === "signing" ||
                sendState.stage === "pending"
              }
              onClick={handleConfirm}
            >
              {sendState.stage === "approving" ||
              sendState.stage === "signing" ||
              sendState.stage === "pending" ? (
                <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <Send className="size-4" aria-hidden="true" />
              )}
              {sendState.stage === "approving"
                ? "Approve in your wallet"
                : sendState.stage === "signing"
                  ? "Check your wallet"
                  : sendState.stage === "pending"
                    ? "Confirming"
                    : "Confirm & send"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
