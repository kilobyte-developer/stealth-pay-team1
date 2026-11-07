"use client";

import * as React from "react";
import Link from "next/link";
import {
  CircleCheck,
  CircleX,
  ExternalLink,
  Info,
  LoaderCircle,
  Lock,
  Palette,
  Power,
  ShieldCheck,
  Snowflake,
  Wallet,
} from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SectionLabel } from "@/components/ui/section-label";
import { CopyButton } from "@/components/ui/copy-button";
import { ConnectDialog } from "@/components/wallet/connect-dialog";
import { SecuritySettings } from "@/components/vault/security-settings";
import { useRpcStatus } from "@/hooks/use-rpc-status";
import { useActiveNetwork, useWallet } from "@/providers/wallet-provider";
import { CONTRACTS, NETWORKS, SUPPORTED_NETWORKS } from "@/config/networks";
import { APP_VERSION, LINKS, SITE } from "@/config/site";
import { formatBlock, truncateMiddle } from "@/lib/format";
import { cn } from "@/lib/utils";

function SettingsSection({
  id,
  title,
  icon: Icon,
  children,
}: {
  id: string;
  title: string;
  icon: typeof Wallet;
  children: React.ReactNode;
}) {
  return (
    <section
      aria-labelledby={`${id}-heading`}
      className="border-ink shadow-brutal border-2 bg-white"
    >
      <div className="border-ink bg-paper-2 flex items-center gap-3 border-b-2 p-4">
        <span className="border-ink grid size-9 shrink-0 place-items-center border-2 bg-white">
          <Icon className="size-4" aria-hidden="true" />
        </span>
        <SectionLabel id={`${id}-heading`}>{title}</SectionLabel>
      </div>
      <div className="divide-ink/12 divide-y-2">{children}</div>
    </section>
  );
}

function Row({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
      <div className="min-w-0">
        <p className="font-display text-sm font-bold">{label}</p>
        {hint ? (
          <p className="text-grey mt-1 text-xs leading-relaxed">{hint}</p>
        ) : null}
      </div>
      {children ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {children}
        </div>
      ) : null}
    </div>
  );
}

export function SettingsView() {
  const { status, address, walletName, disconnect, switchNetwork } =
    useWallet();
  const networkKey = useActiveNetwork();
  const rpc = useRpcStatus(networkKey, 45_000);
  const [connectOpen, setConnectOpen] = React.useState(false);
  const connected = status === "connected" || status === "switching";
  const announcerConfigured = CONTRACTS[networkKey].announcer !== null;
  const deployedNetworkNames = (["fuji", "mainnet"] as const)
    .filter((key) => CONTRACTS[key].announcer && CONTRACTS[key].router)
    .map((key) => NETWORKS[key].shortName);

  return (
    <div className="space-y-6">
      {/* ---------- General ---------- */}
      <SettingsSection id="general" title="General" icon={Wallet}>
        <Row
          label="Wallet connection"
          hint={
            connected
              ? `Connected with ${walletName ?? "an injected wallet"}.`
              : "Not connected. Receiving works without a wallet; sending and network switching need one."
          }
        >
          {connected && address ? (
            <>
              <span className="font-mono text-xs">
                {truncateMiddle(address, 8, 6)}
              </span>
              <CopyButton
                value={address}
                what="Address"
                iconOnly
                variant="outline"
              />
              <Button variant="outline" size="sm" onClick={disconnect}>
                <Power className="size-3.5" aria-hidden="true" />
                Disconnect
              </Button>
            </>
          ) : (
            <Button
              variant="dark"
              size="sm"
              onClick={() => setConnectOpen(true)}
            >
              <Wallet className="size-3.5" aria-hidden="true" />
              Connect
            </Button>
          )}
        </Row>

        <Row
          label="Network preference"
          hint="Fuji is the default. Switching requires a connected wallet."
        >
          {SUPPORTED_NETWORKS.map((n) => (
            <Button
              key={n.key}
              variant={n.key === networkKey ? "primary" : "outline"}
              size="sm"
              disabled={!connected}
              onClick={() => void switchNetwork(n.key)}
            >
              {n.shortName}
            </Button>
          ))}
        </Row>

        <Row
          label="Theme"
          hint="StealthPay ships a single high-contrast light theme. A dark variant is not part of this build."
        >
          <Badge tone="white" size="md">
            <Palette className="size-3" aria-hidden="true" />
            Warm paper (fixed)
          </Badge>
        </Row>
      </SettingsSection>

      {/* ---------- Security & backup (encrypted vault) ---------- */}
      <SecuritySettings />

      {/* ---------- Security posture ---------- */}
      <SettingsSection id="security" title="Security" icon={ShieldCheck}>
        <Row
          label="Private key handling"
          hint="Viewing and spending keys are generated and used client-side only. They are never sent to a backend API, never logged, and never stored in the database."
        >
          <Badge tone="lime" size="md">
            <Lock className="size-3" aria-hidden="true" />
            Client-side only
          </Badge>
        </Row>

        <Row
          label="Key backup"
          hint="Export an encrypted backup, import one, or change your vault password in Security & backup above."
        >
          <Link
            href="/identity"
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            Open identity
          </Link>
        </Row>

        <Row
          label="Session management"
          hint="No server session exists. The only values kept in this browser are which wallet you last connected and your encrypted vault."
        >
          <Badge tone="white" size="md">
            No server session
          </Badge>
        </Row>

        <Row
          label="Never share a private key"
          hint="No sender, support process or StealthPay feature will ever ask for one. Any such request is an attack."
        >
          <Badge tone="coral" size="md">
            Rule
          </Badge>
        </Row>
      </SettingsSection>

      {/* ---------- Network ---------- */}
      <SettingsSection id="network" title="Network" icon={Snowflake}>
        {SUPPORTED_NETWORKS.map((n) => (
          <Row
            key={n.key}
            label={n.name}
            hint={
              <>
                Chain ID {n.chainId} · {n.currencySymbol} ·{" "}
                <span className="font-mono">{n.rpcUrl}</span>
              </>
            }
          >
            <Badge tone={n.testnet ? "lime" : "muted"} size="md">
              {n.testnet ? "Default" : "Future production"}
            </Badge>
            <a
              href={n.explorerUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="brutal-press border-ink shadow-brutal-xs hover:shadow-brutal-sm font-display inline-flex items-center gap-1.5 border-2 bg-white px-2.5 py-1.5 text-[0.7rem] font-bold uppercase"
            >
              {n.explorerName}
              <ExternalLink className="size-3" aria-hidden="true" />
            </a>
          </Row>
        ))}

        <Row
          label={`RPC status — ${NETWORKS[networkKey].shortName}`}
          hint="A live reading from the public Avalanche RPC endpoint."
        >
          {rpc.state === "checking" ? (
            <Badge tone="white" size="md">
              <LoaderCircle className="size-3 animate-spin" aria-hidden="true" />
              Checking
            </Badge>
          ) : rpc.state === "ok" ? (
            <>
              <Badge tone="lime" size="md">
                <CircleCheck className="size-3" aria-hidden="true" />
                Reachable
              </Badge>
              <span className="font-mono text-xs">
                block {formatBlock(rpc.blockNumber ?? 0)} · {rpc.latencyMs}ms
              </span>
            </>
          ) : (
            <>
              <Badge tone="coral" size="md">
                <CircleX className="size-3" aria-hidden="true" />
                Unreachable
              </Badge>
              <span className="text-grey text-xs">{rpc.error}</span>
            </>
          )}
        </Row>

        <Row
          label="Contract configuration"
          hint={
            deployedNetworkNames.length > 0
              ? `The ERC-5564 announcer and StealthPay payment router are live on ${deployedNetworkNames.join(" and ")}.`
              : "The ERC-5564 announcer and StealthPay payment router have not been deployed yet. No addresses are configured on any network."
          }
        >
          {(["fuji", "mainnet"] as const).map((key) => {
            const c = CONTRACTS[key];
            const deployed = Boolean(c.announcer && c.router);
            return (
              <Badge
                key={key}
                tone={deployed ? "lime" : "muted"}
                size="md"
                className={cn(!deployed && "border-dashed")}
              >
                {NETWORKS[key].shortName}: {deployed ? "configured" : "not deployed"}
              </Badge>
            );
          })}
        </Row>
      </SettingsSection>

      {/* ---------- About ---------- */}
      <SettingsSection id="about" title="About" icon={Info}>
        <Row label={SITE.name} hint={SITE.description}>
          <Badge tone="white" size="md">
            v{APP_VERSION}
          </Badge>
        </Row>

        <Row
          label="Payment detection"
          hint="Scanning reads ERC-5564 Announcement logs with your private viewing key, in this browser."
        >
          <Badge tone={announcerConfigured ? "lime" : "muted"} size="md">
            {announcerConfigured ? "Active" : "Awaiting Announcer address"}
          </Badge>
        </Row>

        <Row label="Programme" hint={SITE.program}>
          <a
            href={LINKS.speedrun}
            target="_blank"
            rel="noreferrer noopener"
            className="brutal-press border-ink shadow-brutal-xs hover:shadow-brutal-sm font-display inline-flex items-center gap-1.5 border-2 bg-white px-2.5 py-1.5 text-[0.7rem] font-bold uppercase"
          >
            Event details
            <ExternalLink className="size-3" aria-hidden="true" />
          </a>
        </Row>

        <Row label="References" hint="Specifications and documentation this build follows.">
          {[
            { label: "ERC-5564", href: LINKS.erc5564 },
            { label: "Avalanche docs", href: LINKS.avalancheDocs },
            { label: "C-Chain RPC", href: LINKS.avalancheRpc },
          ].map((l) => (
            <a
              key={l.href}
              href={l.href}
              target="_blank"
              rel="noreferrer noopener"
              className="brutal-press border-ink shadow-brutal-xs hover:shadow-brutal-sm font-display inline-flex items-center gap-1.5 border-2 bg-white px-2.5 py-1.5 text-[0.7rem] font-bold uppercase"
            >
              {l.label}
              <ExternalLink className="size-3" aria-hidden="true" />
            </a>
          ))}
        </Row>

        <Row
          label="Source code"
          hint="The repository link will be published with the submission."
        >
          <Badge tone="muted" size="md">
            GitHub — link pending
          </Badge>
        </Row>
      </SettingsSection>

      <ConnectDialog open={connectOpen} onOpenChange={setConnectOpen} />
    </div>
  );
}
