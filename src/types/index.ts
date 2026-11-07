export type Hex = `0x${string}`;

export type NetworkKey = "fuji" | "mainnet";

export interface NetworkConfig {
  key: NetworkKey;
  chainId: number;
  name: string;
  shortName: string;
  rpcUrl: string;
  explorerUrl: string;
  explorerName: string;
  currencySymbol: string;
  testnet: boolean;
  /**
   * Snowtrace's Etherscan-compatible REST API, used by the announcement
   * scanner to fetch historical logs from an indexer instead of paginating
   * `eth_getLogs` against the raw node — see `src/lib/scanner/explorer-api.ts`.
   */
  explorerApiUrl: string;
}

export interface AssetInfo {
  symbol: string;
  name: string;
  decimals: number;
  /** True for the chain's native gas currency (AVAX). */
  native: boolean;
  /** Only present for ERC-20 assets, and only once a real contract is configured. */
  contract?: Hex;
}

export type TxDirection = "incoming" | "outgoing";
export type TxStatus = "confirmed" | "pending" | "failed";

export interface StealthTransaction {
  id: string;
  direction: TxDirection;
  status: TxStatus;
  assetSymbol: string;
  /** Decimal string, kept as text to avoid float rounding on balances. */
  amount: string;
  /** The one-time address funds were sent to. */
  stealthAddress: Hex;
  /** Sender for incoming payments, destination for outgoing ones. */
  counterparty: Hex;
  counterpartyLabel?: string;
  txHash: Hex;
  blockNumber: number;
  /** ISO 8601 timestamp. */
  timestamp: string;
  confirmations: number;
  /** ERC-5564 announcement data, present on detected incoming payments. */
  ephemeralPubKey?: Hex;
  viewTag?: string;
  schemeId?: number;
  assetContract?: Hex;
  note?: string;
}

export type ScannerStage =
  | "announcement"
  | "ephemeral"
  | "view-tag"
  | "derive"
  | "match"
  | "verify";

export type ScannerOutcome = "info" | "skipped" | "match";

export interface ScannerEvent {
  id: string;
  stage: ScannerStage;
  outcome: ScannerOutcome;
  message: string;
  detail: string;
  blockNumber: number;
  /** ISO 8601 timestamp. */
  timestamp: string;
}

export interface ScannerState {
  running: boolean;
  lastScannedBlock: number;
  chainHeadBlock: number;
  announcementsProcessed: number;
  viewTagMatches: number;
  paymentsDetected: number;
  lastScanAt: string | null;
}

/**
 * Public half of a receiver's stealth identity. Private viewing and spending
 * keys are never represented in UI-facing types — see PROJECT_FLOW.md §21.
 */
export interface StealthIdentity {
  label: string;
  viewingPublicKey: Hex;
  spendingPublicKey: Hex;
  /** ERC-5564 style meta-address URI: st:avax:0x<spendingPubKey><viewingPubKey> */
  metaAddress: string;
  schemeId: number;
  createdAt: string;
}

export type KeyCustodyState = "held-locally" | "not-generated";
