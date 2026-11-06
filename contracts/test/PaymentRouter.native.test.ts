import { expect } from "chai";
import { ethers } from "hardhat";
import {
  EPHEMERAL_PUBKEY,
  EPHEMERAL_PUBKEY_ODD,
  SCHEME_ID,
  VIEW_TAG,
  deployAnnouncerAndRouter,
  expectedNativeMetadata,
  randomStealthAddress,
} from "./helpers";

describe("StealthPaymentRouter — native AVAX", () => {
  it("delivers the full value to the stealth address", async () => {
    const { router } = await deployAnnouncerAndRouter();
    const stealthAddress = randomStealthAddress();
    const amount = ethers.parseEther("10");

    expect(await ethers.provider.getBalance(stealthAddress)).to.equal(0n);

    await router.payNative(stealthAddress, EPHEMERAL_PUBKEY, VIEW_TAG, {
      value: amount,
    });

    expect(await ethers.provider.getBalance(stealthAddress)).to.equal(amount);
  });

  it("leaves no AVAX in the router", async () => {
    const { router } = await deployAnnouncerAndRouter();
    const routerAddress = await router.getAddress();

    await router.payNative(randomStealthAddress(), EPHEMERAL_PUBKEY, VIEW_TAG, {
      value: ethers.parseEther("3"),
    });

    expect(await ethers.provider.getBalance(routerAddress)).to.equal(0n);
  });

  it("emits an Announcement with scheme 1 and the exact native metadata layout", async () => {
    const { announcer, router } = await deployAnnouncerAndRouter();
    const stealthAddress = randomStealthAddress();
    const amount = ethers.parseEther("2.5");

    await expect(
      router.payNative(stealthAddress, EPHEMERAL_PUBKEY, VIEW_TAG, {
        value: amount,
      }),
    )
      .to.emit(announcer, "Announcement")
      .withArgs(
        SCHEME_ID,
        stealthAddress,
        await router.getAddress(),
        EPHEMERAL_PUBKEY,
        expectedNativeMetadata(VIEW_TAG, amount),
      );
  });

  it("encodes native metadata as viewTag ‖ 0xeeeeeeee ‖ sentinel ‖ amount (57 bytes)", async () => {
    const { router } = await deployAnnouncerAndRouter();
    const amount = ethers.parseEther("1.234");

    const metadata: string = await router.encodeNativeMetadata(VIEW_TAG, amount);
    expect(ethers.dataLength(metadata)).to.equal(57);

    // Byte 0 MUST be the view tag, per ERC-5564.
    expect(ethers.dataSlice(metadata, 0, 1)).to.equal(VIEW_TAG);
    expect(ethers.dataSlice(metadata, 1, 5)).to.equal("0xeeeeeeee");
    expect(ethers.getAddress(ethers.dataSlice(metadata, 5, 25))).to.equal(
      "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
    );
    expect(BigInt(ethers.dataSlice(metadata, 25, 57))).to.equal(amount);
    expect(metadata).to.equal(expectedNativeMetadata(VIEW_TAG, amount));
  });

  it("accepts both 02 and 03 compressed key prefixes", async () => {
    const { router } = await deployAnnouncerAndRouter();
    for (const key of [EPHEMERAL_PUBKEY, EPHEMERAL_PUBKEY_ODD]) {
      await expect(
        router.payNative(randomStealthAddress(), key, VIEW_TAG, {
          value: ethers.parseEther("1"),
        }),
      ).to.not.be.reverted;
    }
  });

  it("rejects a zero-value payment", async () => {
    const { router } = await deployAnnouncerAndRouter();
    await expect(
      router.payNative(randomStealthAddress(), EPHEMERAL_PUBKEY, VIEW_TAG, {
        value: 0,
      }),
    ).to.be.revertedWithCustomError(router, "ZeroAmount");
  });

  it("rejects the zero stealth address", async () => {
    const { router } = await deployAnnouncerAndRouter();
    await expect(
      router.payNative(ethers.ZeroAddress, EPHEMERAL_PUBKEY, VIEW_TAG, {
        value: ethers.parseEther("1"),
      }),
    ).to.be.revertedWithCustomError(router, "StealthAddressZero");
  });

  it("rejects malformed ephemeral public keys", async () => {
    const { router } = await deployAnnouncerAndRouter();
    const value = ethers.parseEther("1");

    // Wrong length (32 bytes instead of 33).
    await expect(
      router.payNative(
        randomStealthAddress(),
        "0x" + "11".repeat(32),
        VIEW_TAG,
        { value },
      ),
    ).to.be.revertedWithCustomError(router, "InvalidEphemeralPubKeyLength");

    // Uncompressed (65 bytes).
    await expect(
      router.payNative(
        randomStealthAddress(),
        "0x04" + "11".repeat(64),
        VIEW_TAG,
        { value },
      ),
    ).to.be.revertedWithCustomError(router, "InvalidEphemeralPubKeyLength");

    // Right length, wrong prefix.
    await expect(
      router.payNative(
        randomStealthAddress(),
        "0x05" + "11".repeat(32),
        VIEW_TAG,
        { value },
      ),
    ).to.be.revertedWithCustomError(router, "InvalidEphemeralPubKeyPrefix");

    // Empty.
    await expect(
      router.payNative(randomStealthAddress(), "0x", VIEW_TAG, { value }),
    ).to.be.revertedWithCustomError(router, "InvalidEphemeralPubKeyLength");
  });

  it("reverts the whole payment when the Announcer fails", async () => {
    const badAnnouncer = await ethers.deployContract("RevertingAnnouncer");
    await badAnnouncer.waitForDeployment();
    const router = await ethers.deployContract("StealthPaymentRouter", [
      await badAnnouncer.getAddress(),
    ]);
    await router.waitForDeployment();

    const stealthAddress = randomStealthAddress();
    await expect(
      router.payNative(stealthAddress, EPHEMERAL_PUBKEY, VIEW_TAG, {
        value: ethers.parseEther("5"),
      }),
    ).to.be.revertedWithCustomError(badAnnouncer, "AnnouncerFailed");

    // Atomicity: the transfer did not survive the failed announcement.
    expect(await ethers.provider.getBalance(stealthAddress)).to.equal(0n);
  });

  it("reverts when the destination rejects native value", async () => {
    const { router } = await deployAnnouncerAndRouter();
    const rejector = await ethers.deployContract("NativeRejector");
    await rejector.waitForDeployment();

    await expect(
      router.payNative(
        await rejector.getAddress(),
        EPHEMERAL_PUBKEY,
        VIEW_TAG,
        { value: ethers.parseEther("1") },
      ),
    ).to.be.revertedWithCustomError(router, "NativeTransferFailed");
  });

  it("cannot receive AVAX outside the payment functions", async () => {
    const { router } = await deployAnnouncerAndRouter();
    const [sender] = await ethers.getSigners();

    // No receive()/fallback() exists, so a bare transfer must fail. This is
    // why the router needs no rescue/withdraw function.
    await expect(
      sender.sendTransaction({
        to: await router.getAddress(),
        value: ethers.parseEther("1"),
      }),
    ).to.be.reverted;
  });
});
