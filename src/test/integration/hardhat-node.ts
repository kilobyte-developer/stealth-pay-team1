import {
  spawn,
  spawnSync,
  type ChildProcessWithoutNullStreams,
} from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  createPublicClient,
  createWalletClient,
  defineChain,
  getAddress,
  http,
  type Abi,
  type Address,
  type Hex,
  type PublicClient,
  type WalletClient,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

const CONTRACTS_DIR = join(process.cwd(), "contracts");
const PORT = 8546;
export const RPC_URL = `http://127.0.0.1:${PORT}`;

/**
 * Hardhat's first default account. This is the universally-known test mnemonic
 * ("test test … junk") account — it holds nothing on any real network and must
 * never be used outside a local node.
 */
const TEST_ACCOUNT_KEY =
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" as const;

/** Matches the chainId configured for the local Hardhat network. */
export const localChain = defineChain({
  id: 43113,
  name: "Hardhat (Fuji chainId)",
  nativeCurrency: { name: "Avalanche", symbol: "AVAX", decimals: 18 },
  rpcUrls: { default: { http: [RPC_URL] } },
});

export interface Artifact {
  abi: Abi;
  bytecode: Hex;
}

export function loadArtifact(contractFile: string, name: string): Artifact {
  const path = join(
    CONTRACTS_DIR,
    "artifacts",
    "contracts",
    contractFile,
    `${name}.json`,
  );
  const json = JSON.parse(readFileSync(path, "utf8")) as {
    abi: Abi;
    bytecode: Hex;
  };
  return { abi: json.abi, bytecode: json.bytecode };
}

export interface NodeHandle {
  proc: ChildProcessWithoutNullStreams;
  publicClient: PublicClient;
  walletClient: WalletClient;
  account: ReturnType<typeof privateKeyToAccount>;
  stop: () => void;
}

async function waitForRpc(timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(RPC_URL, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "eth_chainId",
          params: [],
        }),
      });
      if (res.ok) return true;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  return false;
}

/**
 * Boots a local Hardhat node for integration testing.
 *
 * The contracts live in their own npm workspace with a CommonJS toolchain,
 * while the crypto engine is ESM-only (the ScopeLift SDK and @noble/secp256k1
 * both ship `"type": "module"`). They therefore cannot share one test process.
 * Running the chain as a separate node and talking to it over JSON-RPC with
 * viem lets the REAL engine drive the REAL contracts.
 */
export async function startHardhatNode(
  timeoutMs = 90_000,
): Promise<NodeHandle | null> {
  /*
   * Spawned through the shell because Node on Windows refuses to exec a `.cmd`
   * without one (EINVAL), and Hardhat's own bootstrap entry point does not
   * stay resident when invoked directly. Every argument below is a hardcoded
   * constant — no caller input reaches this command line — so the usual
   * shell-escaping concern does not apply.
   */
  const proc = spawn(
    process.platform === "win32" ? "npx.cmd" : "npx",
    ["hardhat", "node", "--port", String(PORT)],
    {
      cwd: CONTRACTS_DIR,
      shell: true,
      // Own process group on POSIX so the whole tree can be signalled.
      detached: process.platform !== "win32",
    },
  ) as ChildProcessWithoutNullStreams;

  // Surface startup failures instead of hanging silently.
  let stderr = "";
  proc.stderr?.on("data", (d: Buffer) => {
    stderr += d.toString();
  });
  proc.stdout?.on("data", () => {});

  const ready = await waitForRpc(timeoutMs);
  if (!ready) {
    killTree(proc);
    console.error(
      `Hardhat node did not start within ${timeoutMs}ms.\n${stderr.slice(0, 800)}`,
    );
    return null;
  }

  const account = privateKeyToAccount(TEST_ACCOUNT_KEY);
  const publicClient = createPublicClient({
    chain: localChain,
    transport: http(RPC_URL),
  }) as PublicClient;
  const walletClient = createWalletClient({
    account,
    chain: localChain,
    transport: http(RPC_URL),
  });

  return {
    proc,
    publicClient,
    walletClient,
    account,
    stop: () => killTree(proc),
  };
}

/**
 * Kills the node AND its children.
 *
 * Because the process is launched through a shell, `proc.kill()` only
 * terminates the shell — the actual Hardhat node is a grandchild and survives,
 * holding the port and leaking a process per test run. On Windows `taskkill /T`
 * walks the tree; elsewhere the process group is signalled.
 */
function killTree(proc: ChildProcessWithoutNullStreams): void {
  if (proc.pid === undefined || proc.killed) return;

  if (process.platform === "win32") {
    try {
      spawnSync("taskkill", ["/PID", String(proc.pid), "/T", "/F"], {
        stdio: "ignore",
      });
    } catch {
      proc.kill();
    }
    return;
  }

  try {
    process.kill(-proc.pid, "SIGTERM");
  } catch {
    proc.kill("SIGTERM");
  }
}

export async function deploy(
  node: NodeHandle,
  artifact: Artifact,
  args: readonly unknown[] = [],
): Promise<Address> {
  const hash = await node.walletClient.deployContract({
    abi: artifact.abi,
    bytecode: artifact.bytecode,
    args: args as never,
    account: node.account,
    chain: localChain,
  });
  const receipt = await node.publicClient.waitForTransactionReceipt({ hash });
  if (!receipt.contractAddress) {
    throw new Error("Deployment produced no contract address");
  }
  // Receipts return lowercase; event args are EIP-55 checksummed. Normalising
  // here keeps address comparisons in tests exact rather than case-insensitive.
  return getAddress(receipt.contractAddress);
}
