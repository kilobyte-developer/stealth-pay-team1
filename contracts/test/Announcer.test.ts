import { expect } from "chai";
import { ethers } from "hardhat";
import {
  CANONICAL_ANNOUNCEMENT_TOPIC0,
  CANONICAL_ANNOUNCE_SELECTOR,
  EPHEMERAL_PUBKEY,
  SCHEME_ID,
  VIEW_TAG,
  randomStealthAddress,
} from "./helpers";

describe("ERC5564Announcer", () => {
  async function deploy() {
    const announcer = await ethers.deployContract("ERC5564Announcer");
    await announcer.waitForDeployment();
    return announcer;
  }

  it("matches the canonical ERC-5564 event signature and selector", async () => {
    const announcer = await deploy();

    // topic0 must be byte-identical to the canonical deployment, or no
    // standards-compatible scanner will find our announcements.
    const topic0 = ethers.id(
      "Announcement(uint256,address,address,bytes,bytes)",
    );
    expect(topic0).to.equal(CANONICAL_ANNOUNCEMENT_TOPIC0);

    const selector = ethers
      .id("announce(uint256,address,bytes,bytes)")
      .slice(0, 10);
    expect(selector).to.equal(CANONICAL_ANNOUNCE_SELECTOR);

    // And the deployed ABI actually exposes that exact function.
    expect(announcer.interface.getFunction("announce")!.selector).to.equal(
      CANONICAL_ANNOUNCE_SELECTOR,
    );
  });

  it("emits Announcement with the correct indexed parameters", async () => {
    const announcer = await deploy();
    const [caller] = await ethers.getSigners();
    const stealthAddress = randomStealthAddress();
    const metadata = "0x4b1234";

    await expect(
      announcer.announce(SCHEME_ID, stealthAddress, EPHEMERAL_PUBKEY, metadata),
    )
      .to.emit(announcer, "Announcement")
      .withArgs(
        SCHEME_ID,
        stealthAddress,
        caller.address,
        EPHEMERAL_PUBKEY,
        metadata,
      );
  });

  it("indexes schemeId, stealthAddress and caller (3 topics + topic0)", async () => {
    const announcer = await deploy();
    const [caller] = await ethers.getSigners();
    const stealthAddress = randomStealthAddress();

    const tx = await announcer.announce(
      SCHEME_ID,
      stealthAddress,
      EPHEMERAL_PUBKEY,
      "0x4b",
    );
    const receipt = await tx.wait();
    const log = receipt!.logs[0];

    expect(log.topics).to.have.lengthOf(4);
    expect(log.topics[0]).to.equal(CANONICAL_ANNOUNCEMENT_TOPIC0);
    expect(BigInt(log.topics[1])).to.equal(SCHEME_ID);
    expect(ethers.getAddress("0x" + log.topics[2].slice(26))).to.equal(
      stealthAddress,
    );
    expect(ethers.getAddress("0x" + log.topics[3].slice(26))).to.equal(
      caller.address,
    );
  });

  it("records the immediate caller, which is the router when a router announces", async () => {
    const announcer = await deploy();
    const announcerAddress = await announcer.getAddress();
    const router = await ethers.deployContract("StealthPaymentRouter", [
      announcerAddress,
    ]);
    await router.waitForDeployment();

    const [payer] = await ethers.getSigners();
    const stealthAddress = randomStealthAddress();

    const tx = await router.payNative(
      stealthAddress,
      EPHEMERAL_PUBKEY,
      VIEW_TAG,
      { value: ethers.parseEther("1") },
    );
    const receipt = await tx.wait();

    const parsed = receipt!.logs
      .map((l) => {
        try {
          return announcer.interface.parseLog(l);
        } catch {
          return null;
        }
      })
      .find((l) => l?.name === "Announcement");

    // Documented semantics: `caller` is the ROUTER, not the payer's EOA.
    expect(parsed!.args.caller).to.equal(await router.getAddress());
    expect(parsed!.args.caller).to.not.equal(payer.address);
  });

  it("is permissionless, so an announcement alone proves nothing", async () => {
    const announcer = await deploy();
    const [, stranger] = await ethers.getSigners();

    // Anyone can claim any address received anything. This is why receivers
    // must verify the actual transfer, never trust the announcement.
    await expect(
      announcer
        .connect(stranger)
        .announce(SCHEME_ID, randomStealthAddress(), EPHEMERAL_PUBKEY, "0xff"),
    ).to.emit(announcer, "Announcement");
  });
});
