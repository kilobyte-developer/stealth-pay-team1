import { decodeEventLog, toEventSelector, type Address, type Hex } from "viem";
import { ANNOUNCEMENT_EVENT } from "./announcement-event";
// Type-only: erased at compile time, so this cannot create a circular
// *runtime* import even though announcement-scanner.ts imports values from
// this file.
import type { AnnouncementLog } from "./announcement-scanner";

/**
 * Snowtrace's Etherscan-compatible `getLogs` endpoint, backed by an indexer
 * rather than a raw node — so unlike `eth_getLogs` it has no small per-call
 * block-range cap and answers a multi-thousand-block query in about a
 * second instead of minutes. Used as the scanner's primary path, with the
 * existing chunked `eth_getLogs` walk kept as the fallback if this fails for
 * any reason (network error, API change, no `explorerApiUrl` configured).
 *
 * Docs: https://docs.routescan.io/ (Routescan is what powers Snowtrace).
 */

const ANNOUNCEMENT_TOPIC0 = toEventSelector(ANNOUNCEMENT_EVENT);

interface RawExplorerLog {
  address: string;
  topics: string[];
  data: string;
  blockNumber: string;
  blockHash: string;
  transactionHash: string;
}

/**
 * Fetches every Announcement log for `announcer` in one request. Throws on
 * any failure (network error, non-OK status, unexpected response shape) —
 * callers are expected to fall back to the chunked RPC path, not to retry
 * this themselves.
 */
export async function fetchAnnouncementsViaExplorerApi({
  apiUrl,
  announcer,
  fromBlock,
  toBlock,
  signal,
}: {
  apiUrl: string;
  announcer: Address;
  fromBlock: bigint;
  toBlock: bigint;
  signal?: AbortSignal;
}): Promise<RawExplorerLog[]> {
  const url = new URL(apiUrl);
  url.searchParams.set("module", "logs");
  url.searchParams.set("action", "getLogs");
  url.searchParams.set("address", announcer);
  url.searchParams.set("topic0", ANNOUNCEMENT_TOPIC0);
  url.searchParams.set("fromBlock", fromBlock.toString());
  url.searchParams.set("toBlock", toBlock.toString());

  const response = await fetch(url, { signal });
  if (!response.ok) {
    throw new Error(`Explorer API responded ${response.status}`);
  }

  const body = (await response.json()) as {
    status: string;
    message: string;
    result: RawExplorerLog[] | string;
  };

  // Etherscan-family APIs report "no results" as status "0", not an error.
  if (body.status === "0") {
    if (/no records found/i.test(body.message)) return [];
    throw new Error(`Explorer API error: ${body.message}`);
  }
  if (!Array.isArray(body.result)) {
    throw new Error("Explorer API returned an unexpected response shape.");
  }
  return body.result;
}

/**
 * Decodes one raw explorer log into the same shape viem's `getLogs({ event })`
 * produces. `logIndex` from this particular API is unreliable (observed as
 * the literal string `"0x"` for every entry — Routescan returning an empty
 * value rather than a real index), which would collide the IDs of two
 * announcements from the same transaction (e.g. an ERC-20 payment's token
 * leg and its native gas top-up). `assignedLogIndex` is a synthetic,
 * per-transaction sequential index assigned by the caller from the result
 * array's own order instead, which is emission order and therefore correct.
 */
export function decodeExplorerLog(
  raw: RawExplorerLog,
  assignedLogIndex: number,
): AnnouncementLog | null {
  try {
    const decoded = decodeEventLog({
      abi: [ANNOUNCEMENT_EVENT],
      topics: raw.topics as [Hex, ...Hex[]],
      data: raw.data as Hex,
    });
    return {
      address: raw.address as Address,
      args: decoded.args,
      eventName: decoded.eventName,
      data: raw.data as Hex,
      blockNumber: BigInt(raw.blockNumber),
      blockHash: raw.blockHash as Hex,
      transactionHash: raw.transactionHash as Hex,
      logIndex: assignedLogIndex,
      // This API's own `transactionIndex` is unreliable (the empty string
      // "0x", same issue as `logIndex` above). Downstream processing never
      // reads it, so a placeholder here is honest rather than fabricated.
      transactionIndex: 0,
      removed: false,
    } as AnnouncementLog;
  } catch {
    return null;
  }
}
