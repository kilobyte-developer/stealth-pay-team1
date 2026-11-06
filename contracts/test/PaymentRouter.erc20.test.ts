import { expect } from "chai";
import { ethers } from "hardhat";
import {
  EPHEMERAL_PUBKEY,
  SCHEME_ID,
  VIEW_TAG,
  deployAnnouncerAndRouter,
  deployToken,
  expectedERC20Metadata,
  expectedNativeMetadata,
  randomStealthAddress,
} from "./helpers";

const TOKEN_AMOUNT = 250_000_000n; // 250 mUSD at 6 decimals

describe("StealthPaymentRouter — ERC-20", () => {
  async function setup(decimals = 6) {
    const { announcer, router } = await deployAnnouncerAndRouter();
    const token = await deployToken(decimals);
    const [payer] = await ethers.getSigners();
    await token.mint(payer.address, TOKEN_AMOUNT * 10n);
    await token.approve(await router.getAddress(), TOKEN_AMOUNT * 10n);
    return { announcer, router, token, payer };
  }

  it("transfers tokens straight to the stealth address", async () => {
    const { router, token } = await setup();
    const stealthAddress = randomStealthAddress();

    await router.payERC20(
      await token.getAddress(),
      stealthAddress,
      TOKEN_AMOUNT,
      EPHEMERAL_PUBKEY,
      VIEW_TAG,
    );

    expect(await token.balanceOf(stealthAddress)).to.equal(TOKEN_AMOUNT);
    // The router never custodies the tokens.
    expect(await token.balanceOf(await router.getAddress())).to.equal(0n);
  });

  it("emits an Announcement with the exact ERC-20 metadata layout", async () => {
    const { announcer, router, token } = await setup();
    const stealthAddress = randomStealthAddress();
    const tokenAddress = await token.getAddress();

    await expect(
      router.payERC20(
        tokenAddress,
        stealthAddress,
        TOKEN_AMOUNT,
        EPHEMERAL_PUBKEY,
        VIEW_TAG,
      ),
    )
      .to.emit(announcer, "Announcement")
      .withArgs(
        SCHEME_ID,
        stealthAddress,
        await router.getAddress(),
        EPHEMERAL_PUBKEY,
        expectedERC20Metadata(VIEW_TAG, tokenAddress, TOKEN_AMOUNT),
      );
  });

  it("encodes ERC-20 metadata as viewTag ‖ 0x23b872dd ‖ token ‖ amount (57 bytes)", async () => {
    const { router, token } = await setup();
    const tokenAddress = await token.getAddress();

    const metadata: string = await router.encodeERC20Metadata(
      VIEW_TAG,
      tokenAddress,
      TOKEN_AMOUNT,
    );

    expect(ethers.dataLength(metadata)).to.equal(57);
    expect(ethers.dataSlice(metadata, 0, 1)).to.equal(VIEW_TAG);
    // The router moves tokens with transferFrom, so the metadata names that.
    expect(ethers.dataSlice(metadata, 1, 5)).to.equal("0x23b872dd");
    expect(ethers.getAddress(ethers.dataSlice(metadata, 5, 25))).to.equal(
      tokenAddress,
    );
    expect(BigInt(ethers.dataSlice(metadata, 25, 57))).to.equal(TOKEN_AMOUNT);
  });

  it("rejects zero amount, zero address and non-contract tokens", async () => {
    const { router, token } = await setup();
    const tokenAddress = await token.getAddress();

    await expect(
      router.payERC20(
        tokenAddress,
        randomStealthAddress(),
        0n,
        EPHEMERAL_PUBKEY,
        VIEW_TAG,
      ),
    ).to.be.revertedWithCustomError(router, "ZeroAmount");

    await expect(
      router.payERC20(
        tokenAddress,
        ethers.ZeroAddress,
        TOKEN_AMOUNT,
        EPHEMERAL_PUBKEY,
        VIEW_TAG,
      ),
    ).to.be.revertedWithCustomError(router, "StealthAddressZero");

    // An EOA is not a token contract.
    await expect(
      router.payERC20(
        randomStealthAddress(),
        randomStealthAddress(),
        TOKEN_AMOUNT,
        EPHEMERAL_PUBKEY,
        VIEW_TAG,
      ),
    ).to.be.revertedWithCustomError(router, "TokenNotContract");
  });

  it("rejects insufficient allowance and insufficient balance", async () => {
    const { router, token, payer } = await setup();
    const tokenAddress = await token.getAddress();
    const routerAddress = await router.getAddress();

    await token.approve(routerAddress, 0n);
    await expect(
      router.payERC20(
        tokenAddress,
        randomStealthAddress(),
        TOKEN_AMOUNT,
        EPHEMERAL_PUBKEY,
        VIEW_TAG,
      ),
    ).to.be.revertedWithCustomError(token, "ERC20InsufficientAllowance");

    // Approve plenty, but spend more than held.
    const held = await token.balanceOf(payer.address);
    await token.approve(routerAddress, held * 2n);
    await expect(
      router.payERC20(
        tokenAddress,
        randomStealthAddress(),
        held + 1n,
        EPHEMERAL_PUBKEY,
        VIEW_TAG,
      ),
    ).to.be.revertedWithCustomError(token, "ERC20InsufficientBalance");
  });

  it("rejects malformed ephemeral public keys", async () => {
    const { router, token } = await setup();
    await expect(
      router.payERC20(
        await token.getAddress(),
        randomStealthAddress(),
        TOKEN_AMOUNT,
        "0x05" + "22".repeat(32),
        VIEW_TAG,
      ),
    ).to.be.revertedWithCustomError(router, "InvalidEphemeralPubKeyPrefix");
  });

  it("reverts the token transfer when the Announcer fails", async () => {
    const badAnnouncer = await ethers.deployContract("RevertingAnnouncer");
    await badAnnouncer.waitForDeployment();
    const router = await ethers.deployContract("StealthPaymentRouter", [
      await badAnnouncer.getAddress(),
    ]);
    await router.waitForDeployment();

    const token = await deployToken(6);
    const [payer] = await ethers.getSigners();
    await token.mint(payer.address, TOKEN_AMOUNT);
    await token.approve(await router.getAddress(), TOKEN_AMOUNT);

    const stealthAddress = randomStealthAddress();
    await expect(
      router.payERC20(
        await token.getAddress(),
        stealthAddress,
        TOKEN_AMOUNT,
        EPHEMERAL_PUBKEY,
        VIEW_TAG,
      ),
    ).to.be.revertedWithCustomError(badAnnouncer, "AnnouncerFailed");

    expect(await token.balanceOf(stealthAddress)).to.equal(0n);
    expect(await token.balanceOf(payer.address)).to.equal(TOKEN_AMOUNT);
  });

  /* ---------------------------------------------------------------- */
  /*                    Native AVAX gas top-up                        */
  /* ---------------------------------------------------------------- */

  describe("with native AVAX gas top-up", () => {
    const TOP_UP = ethers.parseEther("0.05");

    it("delivers both assets to the same stealth address", async () => {
      const { router, token } = await setup();
      const stealthAddress = randomStealthAddress();

      await router.payERC20(
        await token.getAddress(),
        stealthAddress,
        TOKEN_AMOUNT,
        EPHEMERAL_PUBKEY,
        VIEW_TAG,
        { value: TOP_UP },
      );

      expect(await token.balanceOf(stealthAddress)).to.equal(TOKEN_AMOUNT);
      expect(await ethers.provider.getBalance(stealthAddress)).to.equal(TOP_UP);
      // Nothing retained by the router on either leg.
      expect(
        await ethers.provider.getBalance(await router.getAddress()),
      ).to.equal(0n);
    });

    it("emits two independently parseable announcements", async () => {
      const { announcer, router, token } = await setup();
      const stealthAddress = randomStealthAddress();
      const tokenAddress = await token.getAddress();

      const tx = await router.payERC20(
        tokenAddress,
        stealthAddress,
        TOKEN_AMOUNT,
        EPHEMERAL_PUBKEY,
        VIEW_TAG,
        { value: TOP_UP },
      );
      const receipt = await tx.wait();

      const events = receipt!.logs
        .map((l) => {
          try {
            return announcer.interface.parseLog(l);
          } catch {
            return null;
          }
        })
        .filter((l) => l?.name === "Announcement");

      expect(events).to.have.lengthOf(2);

      // Both carry the same ephemeral key, view tag and destination.
      for (const ev of events) {
        expect(ev!.args.schemeId).to.equal(SCHEME_ID);
        expect(ev!.args.stealthAddress).to.equal(stealthAddress);
        expect(ev!.args.ephemeralPubKey).to.equal(EPHEMERAL_PUBKEY);
        expect(ethers.dataSlice(ev!.args.metadata, 0, 1)).to.equal(VIEW_TAG);
      }

      // First the token receipt, then the gas receipt — distinguishable by
      // their metadata selector and asset field.
      expect(events[0]!.args.metadata).to.equal(
        expectedERC20Metadata(VIEW_TAG, tokenAddress, TOKEN_AMOUNT),
      );
      expect(events[1]!.args.metadata).to.equal(
        expectedNativeMetadata(VIEW_TAG, TOP_UP),
      );
      expect(ethers.dataSlice(events[0]!.args.metadata, 1, 5)).to.equal(
        "0x23b872dd",
      );
      expect(ethers.dataSlice(events[1]!.args.metadata, 1, 5)).to.equal(
        "0xeeeeeeee",
      );
    });

    it("emits only the token announcement when no top-up is sent", async () => {
      const { announcer, router, token } = await setup();

      const tx = await router.payERC20(
        await token.getAddress(),
        randomStealthAddress(),
        TOKEN_AMOUNT,
        EPHEMERAL_PUBKEY,
        VIEW_TAG,
      );
      const receipt = await tx.wait();

      const count = receipt!.logs.filter((l) => {
        try {
          return announcer.interface.parseLog(l)?.name === "Announcement";
        } catch {
          return false;
        }
      }).length;

      expect(count).to.equal(1);
    });

    it("reverts the AVAX leg when the token transfer fails", async () => {
      const { router, token, payer } = await setup();
      const stealthAddress = randomStealthAddress();
      await token.approve(await router.getAddress(), 0n);

      const balanceBefore = await ethers.provider.getBalance(stealthAddress);
      await expect(
        router.payERC20(
          await token.getAddress(),
          stealthAddress,
          TOKEN_AMOUNT,
          EPHEMERAL_PUBKEY,
          VIEW_TAG,
          { value: TOP_UP },
        ),
      ).to.be.revertedWithCustomError(token, "ERC20InsufficientAllowance");

      expect(await ethers.provider.getBalance(stealthAddress)).to.equal(
        balanceBefore,
      );
      expect(await token.balanceOf(stealthAddress)).to.equal(0n);
      void payer;
    });

    it("reverts both legs when the SECOND (native) announcement fails", async () => {
      // Proves atomicity across the full two-asset path, not just the first leg.
      const announcer = await ethers.deployContract("FailOnNthAnnouncer", [2]);
      await announcer.waitForDeployment();
      const router = await ethers.deployContract("StealthPaymentRouter", [
        await announcer.getAddress(),
      ]);
      await router.waitForDeployment();

      const token = await deployToken(6);
      const [payer] = await ethers.getSigners();
      await token.mint(payer.address, TOKEN_AMOUNT);
      await token.approve(await router.getAddress(), TOKEN_AMOUNT);

      const stealthAddress = randomStealthAddress();
      await expect(
        router.payERC20(
          await token.getAddress(),
          stealthAddress,
          TOKEN_AMOUNT,
          EPHEMERAL_PUBKEY,
          VIEW_TAG,
          { value: TOP_UP },
        ),
      ).to.be.revertedWithCustomError(announcer, "AnnouncerFailedOnCall");

      // Token leg AND gas leg both rolled back.
      expect(await token.balanceOf(stealthAddress)).to.equal(0n);
      expect(await ethers.provider.getBalance(stealthAddress)).to.equal(0n);
      expect(await token.balanceOf(payer.address)).to.equal(TOKEN_AMOUNT);
    });
  });
});
