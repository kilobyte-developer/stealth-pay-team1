import {
  getAddress,
  isAddress,
  isHex,
  parseEventLogs,
  zeroHash,
  type Address,
  type Hex,
  type PublicClient,
  type TransactionReceipt,
} from "viem";
import type { PaymentPayload, PaymentRequirements } from "@x402/core/types";
import {
  X402_ASSET_TRANSFER_METHOD,
  X402_MIN_REMAINING_VALIDITY_SECONDS,
  X402_SCHEME,
  X402_VERSION,
  type X402AssetConfig,
} from "../config";

/** The EIP-3009 surface StealthPay relies on, plus the events it confirms. */
export const eip3009Abi = [
  {
    type: "function",
    name: "authorizationState",
    stateMutability: "view",
    inputs: [
      { name: "authorizer", type: "address" },
      { name: "nonce", type: "bytes32" },
    ],
    outputs: [{ type: "bool" }],
  },
  { type: "function", name: "name", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  { type: "function", name: "version", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "event",
    name: "Transfer",
    inputs: [
      { name: "from", type: "address", indexed: true },
      { name: "to", type: "address", indexed: true },
      { name: "value", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "AuthorizationUsed",
    inputs: [
      { name: "authorizer", type: "address", indexed: true },
      { name: "nonce", type: "bytes32", indexed: true },
    ],
  },
] as const;

const AUTHORIZATION_USED_EVENT = eip3009Abi.find(
  (item): item is Extract<(typeof eip3009Abi)[number], { name: "AuthorizationUsed" }> =>
    item.type === "event" && item.name === "AuthorizationUsed",
)!;

/** EIP-3009 `TransferWithAuthorization` typed-data definition. */
export const transferWithAuthorizationTypes = {
  TransferWithAuthorization: [
    { name: "from", type: "address" },
    { name: "to", type: "address" },
    { name: "value", type: "uint256" },
    { name: "validAfter", type: "uint256" },
    { name: "validBefore", type: "uint256" },
    { name: "nonce", type: "bytes32" },
  ],
} as const;

/** A payment the backend refuses, with the HTTP status to report it under. */
export class PaymentRejectedError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly httpStatus: number = 402,
  ) {
    super(message);
    this.name = "PaymentRejectedError";
  }
}

/**
 * Confirms, against the live chain, that `asset` really implements EIP-3009
 * with the EIP-712 domain the requirements will advertise. Called before any
 * requirement is issued so a misconfigured or non-EIP-3009 token fails loudly
 * instead of producing signatures that can never settle.
 */
export async function assertEip3009Token(
  client: PublicClient,
  asset: X402AssetConfig,
): Promise<void> {
  const code = await client.getCode({ address: asset.address });
  if (!code || code === "0x") {
    throw new Error(`x402 asset ${asset.address} has no contract code on this chain.`);
  }
  let name: string;
  let version: string;
  try {
    [name, version] = await Promise.all([
      client.readContract({ address: asset.address, abi: eip3009Abi, functionName: "name" }),
      client.readContract({ address: asset.address, abi: eip3009Abi, functionName: "version" }),
      // Reverts on a token without EIP-3009.
      client.readContract({
        address: asset.address,
        abi: eip3009Abi,
        functionName: "authorizationState",
        args: [asset.address, zeroHash],
      }),
    ]);
  } catch {
    throw new Error(
      `x402 asset ${asset.address} does not expose the EIP-3009 interface (authorizationState/name/version).`,
    );
  }
  if (name !== asset.eip712.name || version !== asset.eip712.version) {
    throw new Error(
      `x402 asset ${asset.address} EIP-712 domain is "${name}"/"${version}", expected "${asset.eip712.name}"/"${asset.eip712.version}".`,
    );
  }
}

export type Eip3009Authorization = {
  from: Address;
  to: Address;
  value: bigint;
  validAfter: bigint;
  validBefore: bigint;
  nonce: Hex;
};

function isUintString(v: unknown): v is string {
  return typeof v === "string" && /^[0-9]{1,78}$/.test(v);
}

/** Field-by-field equality of what the client accepted vs what we issued. */
function requirementsMatch(a: PaymentRequirements, b: PaymentRequirements): boolean {
  return (
    a.scheme === b.scheme &&
    a.network === b.network &&
    isAddress(a.asset, { strict: false }) &&
    getAddress(a.asset) === getAddress(b.asset) &&
    a.amount === b.amount &&
    isAddress(a.payTo, { strict: false }) &&
    getAddress(a.payTo) === getAddress(b.payTo) &&
    a.maxTimeoutSeconds === b.maxTimeoutSeconds &&
    a.extra?.name === b.extra?.name &&
    a.extra?.version === b.extra?.version &&
    (a.extra?.assetTransferMethod ?? X402_ASSET_TRANSFER_METHOD) === X402_ASSET_TRANSFER_METHOD
  );
}

/**
 * Validates a submitted x402 payment payload against the requirement the
 * backend itself issued, then checks the EIP-3009 signature, the payer's
 * balance and that the nonce is unused — all against the chain, before the
 * facilitator is involved. Never trusts any value the client chose.
 */
export async function validateEip3009Payment({
  client,
  payload,
  issued,
  chainId,
  nowSeconds = BigInt(Math.floor(Date.now() / 1000)),
}: {
  client: PublicClient;
  payload: PaymentPayload;
  issued: PaymentRequirements;
  chainId: number;
  nowSeconds?: bigint;
}): Promise<{ authorization: Eip3009Authorization; signature: Hex }> {
  if (payload.x402Version !== X402_VERSION) {
    throw new PaymentRejectedError("invalid_x402_version", `Only x402 v${X402_VERSION} is accepted.`);
  }
  if (!payload.accepted || !requirementsMatch(payload.accepted, issued)) {
    throw new PaymentRejectedError(
      "requirements_mismatch",
      "The payment does not match the issued requirement (scheme, network, asset, amount, payTo or domain differ).",
    );
  }
  if (issued.scheme !== X402_SCHEME) {
    throw new PaymentRejectedError("unsupported_scheme", "Only the x402 exact scheme is supported.");
  }

  const inner = payload.payload as {
    authorization?: Record<string, unknown>;
    signature?: unknown;
    permit2Authorization?: unknown;
  };
  if (inner.permit2Authorization !== undefined) {
    throw new PaymentRejectedError("unsupported_transfer_method", "Permit2 payments are not accepted; use EIP-3009.");
  }
  const auth = inner.authorization;
  if (
    !auth ||
    typeof auth.from !== "string" ||
    !isAddress(auth.from, { strict: false }) ||
    typeof auth.to !== "string" ||
    !isAddress(auth.to, { strict: false }) ||
    !isUintString(auth.value) ||
    !isUintString(auth.validAfter) ||
    !isUintString(auth.validBefore) ||
    typeof auth.nonce !== "string" ||
    !isHex(auth.nonce) ||
    auth.nonce.length !== 66 ||
    typeof inner.signature !== "string" ||
    !isHex(inner.signature)
  ) {
    throw new PaymentRejectedError("invalid_payload", "Malformed EIP-3009 authorization payload.");
  }

  const authorization: Eip3009Authorization = {
    from: getAddress(auth.from),
    to: getAddress(auth.to),
    value: BigInt(auth.value),
    validAfter: BigInt(auth.validAfter),
    validBefore: BigInt(auth.validBefore),
    nonce: auth.nonce as Hex,
  };
  const signature = inner.signature as Hex;

  // ---- Destination and amount: must be exactly what was issued ----
  if (authorization.to !== getAddress(issued.payTo)) {
    throw new PaymentRejectedError("invalid_destination", "Authorization pays a different address than the stealth address.");
  }
  if (authorization.value !== BigInt(issued.amount)) {
    throw new PaymentRejectedError("invalid_amount", "Authorization value does not equal the required amount.");
  }
  if (authorization.from === authorization.to) {
    throw new PaymentRejectedError("invalid_destination", "Payer and stealth address must differ.");
  }

  // ---- Validity window ----
  if (authorization.validAfter > nowSeconds) {
    throw new PaymentRejectedError("authorization_not_yet_valid", "Authorization is not valid yet.");
  }
  if (authorization.validBefore <= nowSeconds + BigInt(X402_MIN_REMAINING_VALIDITY_SECONDS)) {
    throw new PaymentRejectedError("authorization_expired", "Authorization has expired or is about to expire.");
  }
  if (authorization.validBefore > nowSeconds + BigInt(issued.maxTimeoutSeconds) + 60n) {
    throw new PaymentRejectedError("authorization_window_too_long", "Authorization validity exceeds the allowed timeout.");
  }

  // ---- Chain checks: signature, replay, balance ----
  const asset = getAddress(issued.asset);
  const signatureValid = await client.verifyTypedData({
    address: authorization.from,
    domain: {
      name: issued.extra.name as string,
      version: issued.extra.version as string,
      chainId,
      verifyingContract: asset,
    },
    types: transferWithAuthorizationTypes,
    primaryType: "TransferWithAuthorization",
    message: authorization,
    signature,
  });
  if (!signatureValid) {
    throw new PaymentRejectedError("invalid_signature", "EIP-3009 signature does not verify for the payer.");
  }

  const [nonceUsed, balance] = await Promise.all([
    client.readContract({
      address: asset,
      abi: eip3009Abi,
      functionName: "authorizationState",
      args: [authorization.from, authorization.nonce],
    }),
    client.readContract({
      address: asset,
      abi: eip3009Abi,
      functionName: "balanceOf",
      args: [authorization.from],
    }),
  ]);
  if (nonceUsed) {
    throw new PaymentRejectedError("authorization_replayed", "This authorization nonce has already been used.", 409);
  }
  if (balance < authorization.value) {
    throw new PaymentRejectedError("insufficient_funds", "Payer's token balance is below the required amount.");
  }

  return { authorization, signature };
}

/**
 * Confirms from a mined receipt — not from the facilitator's response — that
 * the token contract consumed this exact authorization and moved exactly
 * `value` from the payer to the stealth address.
 */
export function confirmSettlementReceipt(
  receipt: TransactionReceipt,
  expected: { asset: Address; payer: Address; payTo: Address; value: bigint; nonce: Hex },
): boolean {
  if (receipt.status !== "success") return false;
  const assetLogs = receipt.logs.filter(
    (l) => getAddress(l.address) === getAddress(expected.asset),
  );
  const events = parseEventLogs({ abi: eip3009Abi, logs: assetLogs, strict: false });

  const authUsed = events.some(
    (e) =>
      e.eventName === "AuthorizationUsed" &&
      e.args.authorizer !== undefined &&
      getAddress(e.args.authorizer) === expected.payer &&
      e.args.nonce?.toLowerCase() === expected.nonce.toLowerCase(),
  );
  const transferred = events.some(
    (e) =>
      e.eventName === "Transfer" &&
      e.args.from !== undefined &&
      e.args.to !== undefined &&
      getAddress(e.args.from) === expected.payer &&
      getAddress(e.args.to) === expected.payTo &&
      e.args.value === expected.value,
  );
  return authUsed && transferred;
}

/**
 * Finds the transaction that consumed `(payer, nonce)`, if any. Used to
 * recover when settlement happened but its result was lost (facilitator
 * timeout, server crash). Searches forward from `fromBlock` in chunks that
 * shrink if the RPC rejects the range.
 */
export async function findAuthorizationUsedTx(
  client: PublicClient,
  { asset, payer, nonce, fromBlock }: { asset: Address; payer: Address; nonce: Hex; fromBlock: bigint },
): Promise<Hex | null> {
  // cacheTime 0: a cached (stale) head would end the search before the
  // settlement block and wrongly report "not settled".
  const head = await client.getBlockNumber({ cacheTime: 0 });
  // Avalanche's public RPC caps eth_getLogs at 100 blocks; start there and
  // still shrink if a different RPC enforces less.
  let chunk = 100n;
  let cursor = fromBlock;
  while (cursor <= head) {
    const to = cursor + chunk - 1n > head ? head : cursor + chunk - 1n;
    try {
      const logs = await client.getLogs({
        address: asset,
        event: AUTHORIZATION_USED_EVENT,
        args: { authorizer: payer, nonce },
        fromBlock: cursor,
        toBlock: to,
      });
      if (logs.length > 0) return logs[0].transactionHash;
      cursor = to + 1n;
    } catch (err) {
      if (chunk <= 32n) throw err;
      chunk = chunk / 4n;
    }
  }
  return null;
}
