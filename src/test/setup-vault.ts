/**
 * Vitest setup.
 *
 * Provides an in-memory IndexedDB so the vault's real storage layer can be
 * exercised — the tests then inspect the ACTUAL persisted records rather than
 * trusting that the TypeScript looks correct.
 *
 * Web Crypto (`crypto.subtle`) is already a global in Node 18+, so AES-GCM
 * runs natively here with no shim.
 */
import "fake-indexeddb/auto";

if (!globalThis.crypto?.subtle) {
  throw new Error(
    "Web Crypto SubtleCrypto is unavailable; vault tests cannot run.",
  );
}
