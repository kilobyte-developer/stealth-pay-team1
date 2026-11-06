import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { GithubMark, StealthMark } from "@/components/shared/logo";
import { Badge } from "@/components/ui/badge";
import { SectionLabel } from "@/components/ui/section-label";
import { LINKS, SITE } from "@/config/site";

const PRODUCT_LINKS = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Receive", href: "/receive" },
  { label: "Send", href: "/send" },
  { label: "Stealth Identity", href: "/identity" },
  { label: "Scanner", href: "/scanner" },
];

const REFERENCE_LINKS = [
  { label: "ERC-5564 Specification", href: LINKS.erc5564 },
  { label: "Avalanche C-Chain Docs", href: LINKS.avalancheDocs },
  { label: "Avalanche C-Chain RPC", href: LINKS.avalancheRpc },
  { label: "Fuji Explorer (Snowtrace)", href: LINKS.fujiExplorer },
  { label: "Team1 India – Speedrun", href: LINKS.speedrun },
];

export function SiteFooter() {
  return (
    <footer className="border-ink bg-ink text-paper mt-auto border-t-[3px]">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-2.5">
              <span className="border-paper bg-lime text-ink grid size-9 shrink-0 place-items-center border-2">
                <StealthMark />
              </span>
              <span className="font-display text-lg font-bold tracking-tight">
                Stealth<span className="text-lime">Pay</span>
              </span>
            </div>
            <p className="text-paper/70 mt-4 max-w-xs text-sm leading-relaxed">
              {SITE.supportingTagline} Privacy-preserving payments on Avalanche
              using ERC-5564 stealth addresses.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Badge tone="lime" size="sm">
                Avalanche Fuji
              </Badge>
              <Badge tone="white" size="sm">
                ERC-5564
              </Badge>
            </div>
          </div>

          {/* Product */}
          <div>
            <SectionLabel className="text-lime">Product</SectionLabel>
            <ul className="mt-4 space-y-2.5">
              {PRODUCT_LINKS.map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    className="text-paper/75 hover:text-lime text-sm underline-offset-4 transition-colors hover:underline"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Documentation */}
          <div>
            <SectionLabel className="text-lime">Documentation</SectionLabel>
            <ul className="mt-4 space-y-2.5">
              <li>
                <span className="text-paper/75 text-sm">PROJECT_FLOW.md</span>
              </li>
              <li>
                <span className="text-paper/75 text-sm">TECH_STACK.md</span>
              </li>
              <li>
                <span className="text-paper/75 text-sm">README.md</span>
              </li>
              <li className="pt-1">
                {LINKS.github ? (
                  <a
                    href={LINKS.github}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="text-paper/75 hover:text-lime inline-flex items-center gap-1.5 text-sm"
                  >
                    <GithubMark />
                    GitHub
                  </a>
                ) : (
                  <span className="text-paper/45 inline-flex items-center gap-1.5 text-sm">
                    <GithubMark />
                    GitHub — link pending
                  </span>
                )}
              </li>
            </ul>
          </div>

          {/* References */}
          <div>
            <SectionLabel className="text-lime">References</SectionLabel>
            <ul className="mt-4 space-y-2.5">
              {REFERENCE_LINKS.map((l) => (
                <li key={l.href}>
                  <a
                    href={l.href}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="text-paper/75 hover:text-lime inline-flex items-start gap-1.5 text-sm"
                  >
                    <span>{l.label}</span>
                    <ExternalLink
                      className="mt-0.5 size-3 shrink-0"
                      aria-hidden="true"
                    />
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Disclaimer */}
        <div className="border-paper/25 mt-12 border-t-2 pt-6">
          <div className="bg-paper/10 border-paper/25 border-2 p-4">
            <SectionLabel className="text-coral">
              Privacy scope — read this
            </SectionLabel>
            <p className="text-paper/75 mt-2 text-xs leading-relaxed">
              StealthPay provides <strong className="text-paper">recipient
              identity unlinkability</strong>, not complete transaction
              anonymity. Sender addresses, destination stealth addresses,
              transaction amounts, timing and any onward transfers all remain
              publicly visible on Avalanche. StealthPay is not a mixer, does not
              provide confidential balances, and does not use zero-knowledge
              proofs.
            </p>
          </div>

          <div className="text-paper/55 mt-6 flex flex-col gap-2 text-xs sm:flex-row sm:items-center sm:justify-between">
            <p>
              {SITE.name} — built for {SITE.program}.
            </p>
            <p>Avalanche Fuji testnet only. Never use real assets.</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
