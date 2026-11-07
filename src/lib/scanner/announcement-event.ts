import { parseAbiItem } from "viem";

/**
 * The canonical ERC-5564 Announcement event, written out rather than imported
 * from generated artifacts so the scanner stays usable against ANY compliant
 * Announcer, not only the one this repo deploys.
 *
 * Kept in its own module (not `announcement-scanner.ts`) because both the
 * RPC-based scanner and the explorer-API path need it, and those two import
 * from each other's module otherwise — a circular import.
 */
export const ANNOUNCEMENT_EVENT = parseAbiItem(
  "event Announcement(uint256 indexed schemeId, address indexed stealthAddress, address indexed caller, bytes ephemeralPubKey, bytes metadata)",
);
