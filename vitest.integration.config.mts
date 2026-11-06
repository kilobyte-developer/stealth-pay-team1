import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

/**
 * Chain integration tests.
 *
 * Separate from the unit config because these spawn a real Hardhat node and
 * talk to it over JSON-RPC. Running them alongside the unit suite starves the
 * node of CPU during startup, so they get their own single-threaded run.
 *
 * Requires `contracts/artifacts` to exist — run `npm --prefix contracts run compile` first.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/test/integration/**/*.test.ts"],
    setupFiles: ["./src/test/setup-vault.ts"],
    // One file at a time: only one Hardhat node may own the port.
    fileParallelism: false,
    testTimeout: 120_000,
    hookTimeout: 180_000,
    server: {
      deps: {
        inline: ["@scopelift/stealth-address-sdk"],
      },
    },
  },
});
