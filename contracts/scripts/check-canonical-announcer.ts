import { ethers } from "hardhat";
import {
  CANONICAL_ANNOUNCE_SELECTOR,
  CANONICAL_ANNOUNCEMENT_TOPIC0,
  CANONICAL_ANNOUNCER,
  logHeading,
} from "./lib";

/**
 * Determines whether the ERC-5564 canonical Announcer can be reused on the
 * connected network, before anything is deployed.
 *
 * Deploying a second Announcer when a compatible singleton already exists
 * would fragment the announcement set and break scanners, so this check gates
 * the deployment scripts.
 */
async function main() {
  const net = await ethers.provider.getNetwork();
  logHeading(`Canonical Announcer check — chain ${net.chainId}`);

  console.log(`Canonical address: ${CANONICAL_ANNOUNCER}`);

  const code = await ethers.provider.getCode(CANONICAL_ANNOUNCER);
  const deployed = code !== "0x";

  console.log(`eth_getCode:       ${deployed ? `${(code.length - 2) / 2} bytes` : "0x (no code)"}`);
  console.log(`Deployed here:     ${deployed ? "YES" : "NO"}`);

  // Independently recompute the canonical interface hashes.
  const topic0 = ethers.id("Announcement(uint256,address,address,bytes,bytes)");
  const selector = ethers
    .id("announce(uint256,address,bytes,bytes)")
    .slice(0, 10);

  logHeading("Interface hashes");
  console.log(`Announcement topic0: ${topic0}`);
  console.log(`  matches canonical: ${topic0 === CANONICAL_ANNOUNCEMENT_TOPIC0}`);
  console.log(`announce selector:   ${selector}`);
  console.log(`  matches canonical: ${selector === CANONICAL_ANNOUNCE_SELECTOR}`);

  if (deployed) {
    logHeading("Bytecode interface probe");
    const hasSelector = code.includes(selector.slice(2));
    const hasTopic = code.includes(topic0.slice(2));
    console.log(`announce selector present in bytecode: ${hasSelector}`);
    console.log(`Announcement topic0 present in bytecode: ${hasTopic}`);

    if (hasSelector && hasTopic) {
      console.log(
        "\nRESULT: Canonical Announcer is present and ABI-compatible. REUSE IT — do not deploy another.",
      );
    } else {
      console.log(
        "\nRESULT: Code exists at the canonical address but does not expose the expected interface. Investigate before proceeding.",
      );
    }
  } else {
    console.log(
      "\nRESULT: No Announcer at the canonical address on this network.",
    );
    console.log(
      "The ERC does not publish the init code or salt used for its deterministic\n" +
        "deployment, so the canonical address cannot be reproduced here. Deploy the\n" +
        "reference implementation with `npm run deploy:announcer:fuji` and record the\n" +
        "resulting address as a documented deviation.",
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
