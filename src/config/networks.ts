import { getAddress, isAddress, type Address } from "viem";
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
    explorerApiUrl: "https://api-testnet.snowtrace.io/api",
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
    explorerApiUrl: "https://api.snowtrace.io/api",
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
 * Deployed contract addresses, supplied per network at build time.
 *
 * Reading these from the environment means the app activates on-chain features
 * the moment real addresses exist — no code change, and no hardcoded address
 * that could drift from what is actually deployed. Absent values leave the
 * on-chain features correctly inert.
 */
function readAddress(value: string | undefined): Address | null {
  if (!value) return null;
  const trimmed = value.trim();
  return isAddress(trimmed) ? getAddress(trimmed) : null;
}

export const CONTRACTS: Record<
  NetworkKey,
  { announcer: Address | null; router: Address | null; testToken: Address | null }
> = {
  fuji: {
    announcer: readAddress(process.env.NEXT_PUBLIC_FUJI_ANNOUNCER_ADDRESS),
    router: readAddress(process.env.NEXT_PUBLIC_FUJI_ROUTER_ADDRESS),
    testToken: readAddress(process.env.NEXT_PUBLIC_FUJI_TEST_TOKEN_ADDRESS),
  },
  mainnet: {
    announcer: readAddress(process.env.NEXT_PUBLIC_MAINNET_ANNOUNCER_ADDRESS),
    router: readAddress(process.env.NEXT_PUBLIC_MAINNET_ROUTER_ADDRESS),
    testToken: readAddress(process.env.NEXT_PUBLIC_MAINNET_TEST_TOKEN_ADDRESS),
  },
};

/**
 * Assets surfaced in the UI for a given network.
 *
 * Native AVAX is always present. The ERC-20 test token only appears once a
 * real contract address is configured for that network — there is no
 * `planned`/placeholder entry implying support that is not actually wired up.
 */
export function assetsFor(network: NetworkKey): AssetInfo[] {
  const assets: AssetInfo[] = [
    { symbol: "AVAX", name: "Avalanche", decimals: 18, native: true },
  ];
  const testToken = CONTRACTS[network].testToken;
  if (testToken) {
    assets.push({
      symbol: "stUSD",
      name: "StealthPay Test USD (ERC-20)",
      decimals: 6,
      native: false,
      contract: testToken,
    });
  }
  return assets;
}

/** Block from which to begin scanning announcements, per network. */
export const SCAN_START_BLOCK: Record<NetworkKey, bigint> = {
  fuji: BigInt(process.env.NEXT_PUBLIC_FUJI_SCAN_START_BLOCK ?? "0"),
  mainnet: BigInt(process.env.NEXT_PUBLIC_MAINNET_SCAN_START_BLOCK ?? "0"),
};

export function contractsFor(network: NetworkKey) {
  return CONTRACTS[network];
}

export function isPaymentsConfigured(network: NetworkKey): boolean {
  return CONTRACTS[network].announcer !== null;
}
