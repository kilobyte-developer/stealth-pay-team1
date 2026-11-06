import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    // The crypto engine and vault are pure TypeScript with no DOM dependency.
    environment: "node",
    include: ["src/**/*.test.ts"],
    // Chain integration spawns a Hardhat node and must not compete with the
    // unit suite for CPU/memory. Run it via `npm run test:integration`.
    exclude: ["src/test/integration/**"],
    setupFiles: ["./src/test/setup-vault.ts"],
    // Argon2id at the OWASP work factor is intentionally slow.
    testTimeout: 30_000,
    server: {
      deps: {
        // @scopelift/stealth-address-sdk@1.0.0-beta.5 ships ESM with
        // extensionless directory imports (e.g. `from './utils/crypto'`),
        // which Node's ESM resolver rejects. Inlining routes it through
        // Vite's bundler-style resolver, matching how Turbopack handles it
        // in the Next.js build.
        inline: ["@scopelift/stealth-address-sdk"],
      },
    },
  },
});
