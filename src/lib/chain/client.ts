import { createPublicClient, defineChain, http, type PublicClient } from "viem";
import { NETWORKS } from "@/config/networks";
import type { NetworkKey } from "@/types";

/**
 * Read-only viem clients for the Avalanche networks.
 *
 * These talk to the public RPC and need no wallet, so balances and logs can be
 * read before (or without) a wallet connection. Clients are memoised per
 * network because each one keeps its own request cache.
 */
const chains = {
  fuji: defineChain({
    id: NETWORKS.fuji.chainId,
    name: NETWORKS.fuji.name,
    nativeCurrency: { name: "Avalanche", symbol: "AVAX", decimals: 18 },
    rpcUrls: { default: { http: [NETWORKS.fuji.rpcUrl] } },
    blockExplorers: {
      default: {
        name: NETWORKS.fuji.explorerName,
        url: NETWORKS.fuji.explorerUrl,
      },
    },
    testnet: true,
  }),
  mainnet: defineChain({
    id: NETWORKS.mainnet.chainId,
    name: NETWORKS.mainnet.name,
    nativeCurrency: { name: "Avalanche", symbol: "AVAX", decimals: 18 },
    rpcUrls: { default: { http: [NETWORKS.mainnet.rpcUrl] } },
    blockExplorers: {
      default: {
        name: NETWORKS.mainnet.explorerName,
        url: NETWORKS.mainnet.explorerUrl,
      },
    },
    testnet: false,
  }),
} as const;

const cache = new Map<NetworkKey, PublicClient>();

export function getPublicClient(network: NetworkKey): PublicClient {
  const existing = cache.get(network);
  if (existing) return existing;

  const client = createPublicClient({
    chain: chains[network],
    transport: http(NETWORKS[network].rpcUrl, {
      // Public endpoints rate-limit; batching keeps log scans within budget.
      batch: true,
      retryCount: 2,
    }),
  }) as PublicClient;

  cache.set(network, client);
  return client;
}

export function getChain(network: NetworkKey) {
  return chains[network];
}
