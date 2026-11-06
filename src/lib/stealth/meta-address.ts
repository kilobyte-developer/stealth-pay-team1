import {
  AVALANCHE_CHAIN_LABEL,
  LENGTHS,
  SCHEME_ID_SECP256K1,
  STEALTH_URI_SCHEME,
} from "./constants";
import { StealthError } from "./errors";
import {
  assertSupportedScheme,
  assertValidCompressedPublicKey,
  isHexOfLength,
} from "./validation";
import type {
  CompressedPublicKey,
  Hex,
  ParsedStealthMetaAddress,
} from "./types";

/**
 * Builds a stealth meta-address from two compressed public keys.
 *
 * Key order is **spending key first, viewing key second**, matching ERC-5564's
 * canonical example URI (`st:eth:0x<spendingPubKey><viewingPubKey>`) and the
 * order the ScopeLift SDK parses in `parseKeysFromStealthMetaAddress`.
 */
export function buildStealthMetaAddress({
  spendingPublicKey,
  viewingPublicKey,
  chainLabel = AVALANCHE_CHAIN_LABEL,
}: {
  spendingPublicKey: CompressedPublicKey;
  viewingPublicKey: CompressedPublicKey;
  chainLabel?: string;
}): { uri: string; raw: Hex } {
  assertValidCompressedPublicKey(spendingPublicKey);
  assertValidCompressedPublicKey(viewingPublicKey);

  const raw = `0x${spendingPublicKey.slice(2)}${viewingPublicKey.slice(2)}` as Hex;
  return {
    uri: `${STEALTH_URI_SCHEME}:${chainLabel}:${raw}`,
    raw,
  };
}

/**
 * Parses and fully validates a stealth meta-address.
 *
 * Accepts either the URI form (`st:avax:0x…`) or a bare `0x…` key
 * concatenation. Unlike the SDK — whose `parseStealthMetaAddressURI` ignores
 * the chain segment entirely — this rejects unknown chain labels, so a
 * meta-address intended for another ecosystem cannot be silently used here.
 *
 * Also rejects the SDK-tolerated single-key form (66 hex chars, where one key
 * serves as both spending and viewing key). That collapses the scheme's
 * security separation: anyone able to scan would also be able to spend.
 */
export function parseStealthMetaAddress(
  metaAddress: string,
  { schemeId = SCHEME_ID_SECP256K1 }: { schemeId?: number } = {},
): ParsedStealthMetaAddress {
  assertSupportedScheme(schemeId);

  if (typeof metaAddress !== "string" || metaAddress.trim() === "") {
    throw new StealthError(
      "INVALID_META_ADDRESS",
      "Stealth meta-address is empty.",
    );
  }

  const input = metaAddress.trim();
  let chainLabel: string | null = null;
  let body: string;

  if (input.startsWith("0x")) {
    body = input;
  } else {
    const parts = input.split(":");
    if (parts.length !== 3) {
      throw new StealthError(
        "INVALID_META_ADDRESS",
        `Expected the form ${STEALTH_URI_SCHEME}:<chain>:0x<keys>.`,
      );
    }
    const [scheme, label, keys] = parts;
    if (scheme !== STEALTH_URI_SCHEME) {
      throw new StealthError(
        "INVALID_META_ADDRESS",
        `Stealth meta-address must begin with "${STEALTH_URI_SCHEME}:".`,
      );
    }
    if (label !== AVALANCHE_CHAIN_LABEL) {
      throw new StealthError(
        "UNSUPPORTED_CHAIN",
        `Unsupported chain label "${label}". StealthPay expects "${AVALANCHE_CHAIN_LABEL}".`,
      );
    }
    chainLabel = label;
    body = keys;
  }

  if (!body.startsWith("0x")) {
    throw new StealthError(
      "INVALID_META_ADDRESS",
      "Stealth meta-address keys must be 0x-prefixed.",
    );
  }

  const keyBody = body.slice(2);

  if (keyBody.length === LENGTHS.publicKeyBodyHexChars) {
    throw new StealthError(
      "INVALID_META_ADDRESS",
      "Single-key stealth meta-addresses are not supported. StealthPay requires independent spending and viewing keys.",
    );
  }

  if (!isHexOfLength(body, LENGTHS.metaAddressBodyHexChars + 2)) {
    throw new StealthError(
      "INVALID_META_ADDRESS",
      `Stealth meta-address must contain exactly ${LENGTHS.metaAddressBodyHexChars} hex characters (two 33-byte compressed keys).`,
    );
  }

  const spendingPublicKey =
    `0x${keyBody.slice(0, LENGTHS.publicKeyBodyHexChars)}` as CompressedPublicKey;
  const viewingPublicKey =
    `0x${keyBody.slice(LENGTHS.publicKeyBodyHexChars)}` as CompressedPublicKey;

  // Rejects malformed prefixes and off-curve points.
  assertValidCompressedPublicKey(spendingPublicKey);
  assertValidCompressedPublicKey(viewingPublicKey);

  return {
    schemeId,
    spendingPublicKey,
    viewingPublicKey,
    chainLabel,
    stealthMetaAddressRaw: body as Hex,
  };
}
