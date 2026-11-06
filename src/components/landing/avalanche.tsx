import { Blocks, FileCode2, Snowflake, Zap } from "lucide-react";
import { Section, SectionHeading } from "@/components/landing/section";
import { SectionLabel } from "@/components/ui/section-label";
import { Badge } from "@/components/ui/badge";
import { SUPPORTED_NETWORKS } from "@/config/networks";

const REASONS = [
  {
    icon: Zap,
    title: "EVM compatibility",
    body: "The C-Chain runs EVM bytecode, so stealth addresses derived on SECP256k1 are ordinary, valid Avalanche addresses. No bridging, wrapping or custom account model.",
  },
  {
    icon: FileCode2,
    title: "Solidity contracts",
    body: "The announcer and payment router are plain Solidity, deployed with Hardhat. The on-chain layer stays deliberately thin — it moves funds and emits events, nothing more.",
  },
  {
    icon: Blocks,
    title: "ERC-5564 integration",
    body: "The standard announcement interface is used as-is, so StealthPay interoperates with other compliant stealth-address tooling rather than inventing a private scheme.",
  },
  {
    icon: Snowflake,
    title: "Fuji testing environment",
    body: "Fuji is the default network for all development and the demo. Real assets are never used during testing.",
  },
];

export function AvalancheSection() {
  return (
    <Section id="avalanche">
      <SectionHeading
        eyebrow="Avalanche"
        title="WHY THE AVALANCHE C-CHAIN."
        lead="StealthPay needs an EVM chain where derived addresses are first-class accounts and standard contracts just work. The C-Chain provides exactly that — and the project uses it as infrastructure, not as a label."
      />

      <div className="mt-12 grid gap-5 sm:grid-cols-2">
        {REASONS.map((r) => {
          const Icon = r.icon;
          return (
            <div
              key={r.title}
              className="border-ink shadow-brutal-sm border-2 bg-white p-5 sm:p-6"
            >
              <span className="border-ink bg-coral grid size-11 place-items-center border-2">
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <p className="font-display mt-4 text-lg font-bold">{r.title}</p>
              <p className="text-grey mt-2 text-sm leading-relaxed">{r.body}</p>
            </div>
          );
        })}
      </div>

      {/* Network table */}
      <div className="border-ink shadow-brutal mt-8 overflow-hidden border-[3px] bg-white">
        <div className="border-ink bg-ink text-paper border-b-[3px] p-4">
          <SectionLabel className="text-lime">Network support</SectionLabel>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[42rem] text-left">
            <thead className="border-ink bg-paper-2 border-b-2">
              <tr className="font-display text-[0.7rem] tracking-[0.14em] uppercase">
                <th scope="col" className="p-3.5 font-bold">
                  Network
                </th>
                <th scope="col" className="p-3.5 font-bold">
                  Chain ID
                </th>
                <th scope="col" className="p-3.5 font-bold">
                  Currency
                </th>
                <th scope="col" className="p-3.5 font-bold">
                  Role
                </th>
              </tr>
            </thead>
            <tbody>
              {SUPPORTED_NETWORKS.map((n) => (
                <tr key={n.key} className="border-ink/12 border-b-2 last:border-b-0">
                  <td className="p-3.5">
                    <p className="font-display text-sm font-bold">{n.name}</p>
                    <p className="text-grey mt-0.5 font-mono text-[0.7rem] break-all">
                      {n.rpcUrl}
                    </p>
                  </td>
                  <td className="p-3.5 font-mono text-sm">{n.chainId}</td>
                  <td className="p-3.5 font-mono text-sm">
                    {n.currencySymbol}
                  </td>
                  <td className="p-3.5">
                    <Badge tone={n.testnet ? "lime" : "muted"} size="sm">
                      {n.testnet ? "Default — dev & demo" : "Future production"}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="border-ink bg-paper-2 mt-6 border-2 p-4 text-sm leading-relaxed">
        <strong className="font-display">Scope note:</strong> Avalanche-specific
        primitives such as eERC, ICM and ICTT are optional for this build and
        are intentionally not used — they do not serve the stealth-address
        privacy problem, and adding them would inflate the stack without
        improving the product.
      </p>
    </Section>
  );
}
