import type { AssetInfo, NetworkConfig, NetworkKey } from "@/types";

/**
 * Avalanche network configuration.
 * Values mirror README.md §Network Support. Fuji is the default for all
 * development and demo activity — real assets are never used.
 */
export const NETWORKS: Record<NetworkKey, NetworkConfig> = {
  fuji: {
    key: "fuji",
    chainId: 43113,
    name: "Avalanche Fuji C-Chain",
    shortName: "Fuji Testnet",
    rpcUrl: "https://api.avax-test.network/ext/bc/C/rpc",
    explorerUrl: "https://testnet.snowtrace.io",
    explorerName: "Snowtrace Testnet",
    currencySymbol: "AVAX",
    testnet: true,
  },
  mainnet: {
    key: "mainnet",
    chainId: 43114,
    name: "Avalanche C-Chain",
    shortName: "Avalanche Mainnet",
    rpcUrl: "https://api.avax.network/ext/bc/C/rpc",
    explorerUrl: "https://snowtrace.io",
    explorerName: "Snowtrace",
    currencySymbol: "AVAX",
    testnet: false,
  },
};

export const DEFAULT_NETWORK: NetworkKey = "fuji";

export const SUPPORTED_NETWORKS = [NETWORKS.fuji, NETWORKS.mainnet];

export function networkByChainId(chainId: number): NetworkConfig | undefined {
  return SUPPORTED_NETWORKS.find((n) => n.chainId === chainId);
}

/** Hex chain id string used by EIP-1193 `wallet_switchEthereumChain`. */
export function toHexChainId(chainId: number): `0x${string}` {
  return `0x${chainId.toString(16)}`;
}

/**
 * Assets surfaced in the UI. Native AVAX is the MVP scope; ERC-20 entries are
 * marked `planned` so the interface never implies they already work.
 */
export const ASSETS: AssetInfo[] = [
  { symbol: "AVAX", name: "Avalanche", decimals: 18, native: true },
  { symbol: "USDC", name: "USD Coin (ERC-20)", decimals: 6, native: false, planned: true },
  { symbol: "WAVAX", name: "Wrapped AVAX (ERC-20)", decimals: 18, native: false, planned: true },
];

export const NATIVE_ASSET = ASSETS[0];

/**
 * Indicative AVAX→USD rate used only to render "estimated value" on demo data.
 * This is a fixed placeholder, NOT a live price feed.
 */
export const DEMO_AVAX_USD_RATE = 27.4;

/**
 * Contract addresses are intentionally empty: nothing has been deployed yet.
 * See README.md §Smart Contract Deployment.
 */
export const CONTRACTS: Record<
  NetworkKey,
  { announcer: string | null; router: string | null }
> = {
  fuji: { announcer: null, router: null },
  mainnet: { announcer: null, router: null },
};
