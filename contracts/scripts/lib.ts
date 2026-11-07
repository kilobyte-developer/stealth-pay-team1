import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ethers, network } from "hardhat";

export const FUJI_CHAIN_ID = 43113n;
export const AVALANCHE_MAINNET_CHAIN_ID = 43114n;

/** The canonical ERC-5564 Announcer address from the specification. */
export const CANONICAL_ANNOUNCER =
  "0x55649E01B5Df198D18D95b5cc5051630cfD45564";

export const CANONICAL_ANNOUNCEMENT_TOPIC0 =
  "0x5f0eab8057630ba7676c49b4f21a0231414e79474595be8e4c432fbf6bf0f4e7";
export const CANONICAL_ANNOUNCE_SELECTOR = "0x4d1f9583";

export interface DeploymentRecord {
  network: string;
  chainId: string;
  announcer: string | null;
  announcerSource: "canonical-reused" | "deployed-reference" | null;
  router: string | null;
  testToken: string | null;
  deployer: string | null;
  deployedAt: string | null;
  notes?: string;
}

const DEPLOYMENTS_DIR = join(__dirname, "..", "deployments");

export function deploymentPath(networkName: string): string {
  return join(DEPLOYMENTS_DIR, `${networkName}.json`);
}

export function readDeployment(networkName: string): DeploymentRecord {
  const path = deploymentPath(networkName);
  if (!existsSync(path)) {
    return {
      network: networkName,
      chainId: "",
      announcer: null,
      announcerSource: null,
      router: null,
      testToken: null,
      deployer: null,
      deployedAt: null,
    };
  }
  return JSON.parse(readFileSync(path, "utf8")) as DeploymentRecord;
}

export function writeDeployment(record: DeploymentRecord): void {
  if (!existsSync(DEPLOYMENTS_DIR)) mkdirSync(DEPLOYMENTS_DIR, { recursive: true });
  writeFileSync(
    deploymentPath(record.network),
    `${JSON.stringify(record, null, 2)}\n`,
    "utf8",
  );
}

/**
 * Refuses to run against anything but the intended testnet.
 *
 * Mainnet deployment is out of scope for this milestone, so this is a hard
 * stop rather than a warning.
 */
export async function assertFuji(): Promise<bigint> {
  const net = await ethers.provider.getNetwork();
  if (net.chainId === AVALANCHE_MAINNET_CHAIN_ID) {
    throw new Error(
      "Refusing to run: connected to Avalanche MAINNET (43114). This milestone is testnet-only.",
    );
  }
  if (net.chainId !== FUJI_CHAIN_ID) {
    throw new Error(
      `Expected Avalanche Fuji (43113) but connected to chain ${net.chainId}.`,
    );
  }
  return net.chainId;
}

/** Validates that a deployer key is configured and funded before proceeding. */
export async function requireFundedDeployer(): Promise<{
  address: string;
  balance: bigint;
}> {
  if (!process.env.DEPLOYER_PRIVATE_KEY) {
    throw new Error(
      "DEPLOYER_PRIVATE_KEY is not set. Create contracts/.env from .env.example " +
        "with a DEDICATED Fuji testnet key. Never use a mainnet key.",
    );
  }

  const signers = await ethers.getSigners();
  if (signers.length === 0) {
    throw new Error("No signer available for this network.");
  }
  const deployer = signers[0];
  const balance = await ethers.provider.getBalance(deployer.address);

  if (balance === 0n) {
    throw new Error(
      `Deployer ${deployer.address} has 0 AVAX on ${network.name}. ` +
        "Fund it from the Fuji faucet: https://core.app/tools/testnet-faucet/",
    );
  }

  return { address: deployer.address, balance };
}

/**
 * Reads an env-var override, treating a blank/whitespace-only value as
 * absent. `.env` files commonly have `KEY=` placeholders for optional
 * overrides; a plain `??` against `process.env.KEY` would treat that empty
 * string as "set" and never fall through to the real default.
 */
export function envOverride(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function logHeading(text: string): void {
  console.log(`\n=== ${text} ===`);
}
