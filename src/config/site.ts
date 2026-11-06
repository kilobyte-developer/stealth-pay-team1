export const SITE = {
  name: "StealthPay",
  tagline: "Your wallet. Your privacy. Your control.",
  supportingTagline: "Receive privately. Spend directly. Stay unlinkable.",
  description:
    "StealthPay is a privacy-preserving payment application on Avalanche. Receive cryptocurrency through unique one-time stealth addresses without publishing your reusable wallet identity.",
  program: "Team1 India – Speedrun 2026",
} as const;

/**
 * External references. Placeholders stay empty rather than pointing at
 * invented URLs — the UI renders them as "not published yet".
 */
export const LINKS = {
  erc5564: "https://ercs.ethereum.org/ERCS/erc-5564",
  avalancheDocs: "https://build.avax.network/docs/primary-network",
  avalancheRpc: "https://build.avax.network/docs/rpcs/c-chain",
  fujiExplorer: "https://testnet.snowtrace.io",
  speedrun:
    "https://docs.avax.network/events/3f8d455d-1eb5-425b-b859-4261a0ff8ad6",
  github: "",
  demoVideo: "",
  pitchDeck: "",
} as const;

export const APP_VERSION = "0.1.0-ui-preview";
