import { getAddress, isAddress, size, slice, type Address, type Hex } from "viem";

/**
 * ERC-5564 announcement metadata parsing.
 *
 * The standard fixes only one thing: the FIRST byte is the view tag. The rest
 * follows the recommended layout StealthPay's router emits:
 *
 *   viewTag(1) ‖ selector(4) ‖ asset(20) ‖ amount(32)   = 57 bytes
 *
 * Announcements are permissionless, so metadata from an arbitrary caller may be
 * any length or shape. Everything past byte 0 is therefore optional and parsed
 * defensively — a malformed tail must never throw or be trusted.
 */

/** ERC-5564 function identifier marking a native-token transfer. */
export const NATIVE_VALUE_SELECTOR = "0xeeeeeeee";

/** ERC-5564 sentinel address representing the native token. */
export const NATIVE_TOKEN_SENTINEL = getAddress(
  "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
);

/** `transferFrom(address,address,uint256)` — what the router uses for ERC-20. */
export const ERC20_TRANSFER_FROM_SELECTOR = "0x23b872dd";

export type AnnouncedAssetKind = "native" | "erc20" | "unknown";

export interface ParsedAnnouncementMetadata {
  /** Always present: byte 0, per the standard. */
  viewTag: Hex;
  kind: AnnouncedAssetKind;
  selector: Hex | null;
  /** Token contract for ERC-20; null for native or unparseable metadata. */
  token: Address | null;
  /** Declared amount in the asset's base units, or null if absent. */
  amount: bigint | null;
}

/**
 * Parses metadata, extracting whatever is reliably present.
 *
 * Returns `null` only when the metadata is empty — in which case there is no
 * view tag and the announcement cannot be matched at all.
 *
 * Note the declared amount is a CLAIM by whoever announced. It is used to label
 * the payment, never as proof; the actual balance is verified separately.
 */
export function parseAnnouncementMetadata(
  metadata: Hex,
): ParsedAnnouncementMetadata | null {
  let length: number;
  try {
    length = size(metadata);
  } catch {
    return null;
  }
  if (length < 1) return null;

  const viewTag = slice(metadata, 0, 1);

  if (length < 57) {
    // Byte 0 is still usable for matching; the rest is not present.
    return { viewTag, kind: "unknown", selector: null, token: null, amount: null };
  }

  const selector = slice(metadata, 1, 5);
  const assetRaw = slice(metadata, 5, 25);
  const amountRaw = slice(metadata, 25, 57);

  let amount: bigint | null = null;
  try {
    amount = BigInt(amountRaw);
  } catch {
    amount = null;
  }

  const asset = isAddress(assetRaw, { strict: false })
    ? getAddress(assetRaw)
    : null;

  if (selector.toLowerCase() === NATIVE_VALUE_SELECTOR) {
    return { viewTag, kind: "native", selector, token: null, amount };
  }

  if (
    selector.toLowerCase() === ERC20_TRANSFER_FROM_SELECTOR &&
    asset !== null &&
    asset !== NATIVE_TOKEN_SENTINEL
  ) {
    return { viewTag, kind: "erc20", selector, token: asset, amount };
  }

  return { viewTag, kind: "unknown", selector, token: asset, amount };
}
