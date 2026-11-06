import type { Hex, StealthTransaction } from "@/types";
import { PARTICIPANTS } from "@/data/mock/identity";

/* ============================================================================
   DEMO DATA — NOT REAL TRANSACTIONS.
   Hashes, addresses and block numbers below are fabricated placeholders for
   frontend development. Nothing here was broadcast to Fuji or any other
   network, and none of these hashes resolve on Snowtrace.
   ========================================================================== */

export const MOCK_TRANSACTIONS: StealthTransaction[] = [
  {
    id: "tx-001",
    direction: "incoming",
    status: "confirmed",
    assetSymbol: "AVAX",
    amount: "10",
    stealthAddress: "0x7Ae4C9b2F13d6E058a1B4c7D29e63F8a0C5d41Be",
    counterparty: PARTICIPANTS.sender.address,
    counterpartyLabel: "Bob",
    txHash:
      "0x8f2a41c7b9035e6d18a4f72c05b9e3d8641a7c20f58b93e47d1c06a85f2b74e9",
    blockNumber: 38_412_907,
    timestamp: "2026-11-05T14:32:00.000Z",
    confirmations: 184,
    ephemeralPubKey:
      "0x025c91a7d30f28b6e471a9c05d83e2f47b19d6c8a04f3b7e25a0c74d91f86b23e5",
    viewTag: "0x4b",
    schemeId: 1,
    note: "Invoice #1042",
  },
  {
    id: "tx-002",
    direction: "incoming",
    status: "confirmed",
    assetSymbol: "AVAX",
    amount: "2.5",
    stealthAddress: "0x3F19d8A2c7B4e06513aD9c82F4e7B10d65C3a9E7",
    counterparty: "0xC37d92A1f8B5604e23aC71d9E04b86F5a1D273cB",
    txHash:
      "0x3c94e07a2f1b85d6a7c40392e5f8b1640d29a7c3f1e46b8592c7d0a4f36b18e5",
    blockNumber: 38_409_144,
    timestamp: "2026-11-05T09:06:00.000Z",
    confirmations: 3_947,
    ephemeralPubKey:
      "0x03b4e82d07a9c15f3648c2e1b7d05a93f62d71c9a8e403b5f76c05d2a7f91b38e4",
    viewTag: "0xa7",
    schemeId: 1,
  },
  {
    id: "tx-003",
    direction: "outgoing",
    status: "confirmed",
    assetSymbol: "AVAX",
    amount: "3",
    stealthAddress: "0x7Ae4C9b2F13d6E058a1B4c7D29e63F8a0C5d41Be",
    counterparty: PARTICIPANTS.thirdParty.address,
    counterpartyLabel: "John",
    txHash:
      "0xb51d8a3f0c927e4615a8d2c7f093b4e186c0a5d34f72b9e8207c6f1a94d5b3e0",
    blockNumber: 38_413_002,
    timestamp: "2026-11-05T15:58:00.000Z",
    confirmations: 97,
    note: "Forwarded from one-time address",
  },
  {
    id: "tx-004",
    direction: "incoming",
    status: "pending",
    assetSymbol: "AVAX",
    amount: "0.75",
    stealthAddress: "0xB62f14D9a05C73e8126bF4A9d38E750c91Ad6F23",
    counterparty: "0xE41b7C92a5D306f84B19c7e2A0d5461F38b9C72a",
    counterpartyLabel: "Bob",
    txHash:
      "0x6e08b7d1a5c34f92c80e5a2d71f6b4933a9d04c8e125f7b641e8c20a7d93b5f1",
    blockNumber: 38_413_118,
    timestamp: "2026-11-05T16:41:00.000Z",
    confirmations: 2,
    ephemeralPubKey:
      "0x02a71c4e9d05b826f397d0c5a2e18f4b765e3a9c01d7f2b648c84e1b7a0d395f62",
    viewTag: "0x19",
    schemeId: 1,
  },
  {
    id: "tx-005",
    direction: "incoming",
    status: "confirmed",
    assetSymbol: "USDC",
    amount: "250",
    stealthAddress: "0x24c7E1b93A6d05F871e2C48b9D7a30465fB1c8E9",
    counterparty: "0xC37d92A1f8B5604e23aC71d9E04b86F5a1D273cB",
    txHash:
      "0xd73a0c81e49b2f6572b1e8d04a3c96f70c58a9d2b471e63095f2c7a81d46b0e9",
    blockNumber: 38_401_776,
    timestamp: "2026-11-04T11:20:00.000Z",
    confirmations: 11_331,
    ephemeralPubKey:
      "0x033d08c5a1f7b249e60b85d7c2a139f4e876c1a0d4e85b2f931a4c87e0d526b9f3",
    viewTag: "0xe2",
    schemeId: 1,
    assetContract: "0x5425890298aed601595a70AB815c96711a31Bc65",
    note: "ERC-20 detection is a planned capability",
  },
  {
    id: "tx-006",
    direction: "outgoing",
    status: "failed",
    assetSymbol: "AVAX",
    amount: "1.2",
    stealthAddress: "0x9D53a7F2041cB6e87a3F19d2C65b4E708a2d91Cf",
    counterparty: PARTICIPANTS.thirdParty.address,
    counterpartyLabel: "John",
    txHash:
      "0x1f6c92a40d83b7e5e4d07b1a68c25f93b920c4d7a10e5f8637c1a9e05b2d84f6",
    blockNumber: 38_398_210,
    timestamp: "2026-11-04T07:02:00.000Z",
    confirmations: 0,
    note: "Insufficient native AVAX at the one-time address to cover gas",
  },
];

/** Stealth addresses that currently hold a detected balance (demo values). */
export const MOCK_STEALTH_ACCOUNTS: {
  address: Hex;
  assetSymbol: string;
  balance: string;
  detectedAt: string;
}[] = [
  {
    address: "0x7Ae4C9b2F13d6E058a1B4c7D29e63F8a0C5d41Be",
    assetSymbol: "AVAX",
    balance: "7",
    detectedAt: "2026-11-05T14:32:00.000Z",
  },
  {
    address: "0x3F19d8A2c7B4e06513aD9c82F4e7B10d65C3a9E7",
    assetSymbol: "AVAX",
    balance: "2.5",
    detectedAt: "2026-11-05T09:06:00.000Z",
  },
  {
    address: "0xB62f14D9a05C73e8126bF4A9d38E750c91Ad6F23",
    assetSymbol: "AVAX",
    balance: "0.75",
    detectedAt: "2026-11-05T16:41:00.000Z",
  },
  {
    address: "0x9D53a7F2041cB6e87a3F19d2C65b4E708a2d91Cf",
    assetSymbol: "AVAX",
    balance: "2.2",
    detectedAt: "2026-11-03T18:12:00.000Z",
  },
];

export const MOCK_SUMMARY = {
  /** Sum of MOCK_STEALTH_ACCOUNTS AVAX balances. */
  totalAvax: "12.45",
  stealthAddressCount: MOCK_STEALTH_ACCOUNTS.length,
  pendingCount: MOCK_TRANSACTIONS.filter((t) => t.status === "pending").length,
  receivedThisMonth: "13.25",
};
