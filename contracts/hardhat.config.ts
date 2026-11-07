import { type HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";

dotenv.config();

const FUJI_RPC_URL =
  process.env.FUJI_RPC_URL ?? "https://api.avax-test.network/ext/bc/C/rpc";

/**
 * Deployer key for Fuji only. Never a mainnet key, never committed.
 * Absent by default so `hardhat compile` / `hardhat test` work without secrets.
 */
const DEPLOYER_PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY;

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.28",
    settings: {
      optimizer: { enabled: true, runs: 200 },
      /**
       * Avalanche C-Chain is at the Cancun EVM level. Verified empirically
       * rather than assumed: Fuji block headers carry `blobGasUsed`,
       * `excessBlobGas` and `parentBeaconBlockRoot` (Cancun) and lack
       * `requestsHash` (Prague). See docs/DEPLOYMENT.md.
       *
       * These contracts need no Cancun-specific opcodes; the target simply
       * matches the chain so the compiler is not artificially constrained.
       */
      evmVersion: "cancun",
    },
  },
  networks: {
    hardhat: {
      // Match the production target so local tests exercise the same EVM rules.
      hardfork: "cancun",
      chainId: 43113,
    },
    fuji: {
      url: FUJI_RPC_URL,
      chainId: 43113,
      accounts: DEPLOYER_PRIVATE_KEY ? [DEPLOYER_PRIVATE_KEY] : [],
    },
    // Deliberately no `mainnet` entry. Avalanche mainnet deployment is out of
    // scope for this milestone and must not be reachable by accident.
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
  mocha: { timeout: 120_000 },
  /**
   * Source-code verification on Snowtrace (Fuji).
   *
   * No real API key is required: confirmed against Avalanche's own official
   * Hardhat verification guide (https://build.avax.network/docs/primary-network/verify-contract/hardhat),
   * which configures `etherscan: {}` with no key. `hardhat-verify@2.1.3`
   * (the version installed here) still requires the `apiKey` field to be
   * present for an unlisted chain, so a placeholder string is supplied below —
   * it is not a secret and is never checked by the explorer.
   *
   * If `https://api-testnet.snowtrace.io/api` ever stops responding, Routescan
   * (which now powers Snowtrace) also serves an Etherscan-compatible endpoint
   * at `https://api.routescan.io/v2/network/testnet/evm/43113/etherscan/api` —
   * documented here as a fallback, not yet needed.
   */
  etherscan: {
    apiKey: {
      fuji: "snowtrace-no-key-required",
    },
    customChains: [
      {
        network: "fuji",
        chainId: 43113,
        urls: {
          apiURL: "https://api-testnet.snowtrace.io/api",
          browserURL: "https://testnet.snowtrace.io",
        },
      },
    ],
  },
};

export default config;
