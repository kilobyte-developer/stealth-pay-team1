import { expect } from "chai";
import { ethers } from "hardhat";
import {
  EPHEMERAL_PUBKEY,
  SCHEME_ID,
  VIEW_TAG,
  deployAnnouncerAndRouter,
  deployToken,
  randomStealthAddress,
} from "./helpers";

describe("StealthPaymentRouter — security", () => {
  it("has no admin surface: no owner, pause, upgrade or withdraw", async () => {
    const { router } = await deployAnnouncerAndRouter();
    const names = router.interface.fragments
      .filter((f) => f.type === "function")
      .map((f) => (f as { name: string }).name.toLowerCase());

    for (const forbidden of [
      "owner",
      "transferownership",
      "renounceownership",
      "pause",
      "unpause",
      "upgradeto",
      "withdraw",
      "sweep",
      "rescue",
      "setannouncer",
      "selfdestruct",
    ]) {
      expect(names).to.not.include(forbidden);
    }
  });

  it("pins the Announcer immutably at construction", async () => {
    const { announcer, router } = await deployAnnouncerAndRouter();
    expect(await router.announcer()).to.equal(await announcer.getAddress());

    // No setter exists to repoint it.
    expect(
      router.interface.fragments.some(
        (f) => f.type === "function" && /announcer/i.test((f as { name: string }).name) && (f as { name: string }).name !== "announcer",
      ),
    ).to.equal(false);
  });

  it("rejects a zero Announcer at construction", async () => {
    const factory = await ethers.getContractFactory("StealthPaymentRouter");
    await expect(
      factory.deploy(ethers.ZeroAddress),
    ).to.be.revertedWithCustomError(factory, "AnnouncerAddressZero");
  });

  it("hard-codes scheme 1 so an unsupported scheme cannot be announced", async () => {
    const { announcer, router } = await deployAnnouncerAndRouter();
    expect(await router.SCHEME_ID()).to.equal(SCHEME_ID);

    // There is no schemeId parameter on either entry point.
    for (const fn of ["payNative", "payERC20"]) {
      const inputs = router.interface
        .getFunction(fn)!
        .inputs.map((i) => i.name.toLowerCase());
      expect(inputs).to.not.include("schemeid");
    }

    const tx = await router.payNative(
      randomStealthAddress(),
      EPHEMERAL_PUBKEY,
      VIEW_TAG,
      { value: ethers.parseEther("1") },
    );
    const receipt = await tx.wait();
    const ev = receipt!.logs
      .map((l) => {
        try {
          return announcer.interface.parseLog(l);
        } catch {
          return null;
        }
      })
      .find((l) => l?.name === "Announcement");
    expect(ev!.args.schemeId).to.equal(1n);
  });

  it("blocks reentrancy from a malicious token's transferFrom", async () => {
    const { router } = await deployAnnouncerAndRouter();
    const routerAddress = await router.getAddress();
    const evil = await ethers.deployContract("ReentrantToken");
    await evil.waitForDeployment();

    const [payer] = await ethers.getSigners();
    await evil.mint(payer.address, 1000n);
    await evil.approve(routerAddress, 1000n);

    // Re-enter payNative from inside transferFrom.
    const payload = router.interface.encodeFunctionData("payNative", [
      randomStealthAddress(),
      EPHEMERAL_PUBKEY,
      VIEW_TAG,
    ]);
    await evil.setAttack(routerAddress, payload);

    await expect(
      router.payERC20(
        await evil.getAddress(),
        randomStealthAddress(),
        100n,
        EPHEMERAL_PUBKEY,
        VIEW_TAG,
      ),
    ).to.be.revertedWithCustomError(router, "ReentrancyGuardReentrantCall");
  });

  it("blocks reentrancy from a malicious native recipient", async () => {
    const { announcer, router } = await deployAnnouncerAndRouter();
    const routerAddress = await router.getAddress();
    const evil = await ethers.deployContract("ReentrantNativeReceiver");
    await evil.waitForDeployment();

    const payload = router.interface.encodeFunctionData("payNative", [
      randomStealthAddress(),
      EPHEMERAL_PUBKEY,
      VIEW_TAG,
    ]);
    await evil.setAttack(routerAddress, payload);

    const tx = await router.payNative(
      await evil.getAddress(),
      EPHEMERAL_PUBKEY,
      VIEW_TAG,
      { value: ethers.parseEther("1") },
    );
    const receipt = await tx.wait();

    // The re-entrant call was attempted and was rejected by the guard.
    expect(await evil.innerCalled()).to.equal(true);
    expect(await evil.innerFailed()).to.equal(true);
    const guardSelector = router.interface.getError(
      "ReentrancyGuardReentrantCall",
    )!.selector;
    expect(await evil.innerRevertData()).to.equal(guardSelector);

    // And crucially, only ONE payment was announced — no double spend.
    const announcements = receipt!.logs.filter((l) => {
      try {
        return announcer.interface.parseLog(l)?.name === "Announcement";
      } catch {
        return false;
      }
    });
    expect(announcements).to.have.lengthOf(1);
    expect(await ethers.provider.getBalance(routerAddress)).to.equal(0n);
  });

  it("rejects fee-on-transfer tokens rather than under-delivering", async () => {
    const { router } = await deployAnnouncerAndRouter();
    const fot = await ethers.deployContract("FeeOnTransferToken", [500]); // 5%
    await fot.waitForDeployment();

    const [payer] = await ethers.getSigners();
    await fot.mint(payer.address, 1_000_000n);
    await fot.approve(await router.getAddress(), 1_000_000n);

    const stealthAddress = randomStealthAddress();
    await expect(
      router.payERC20(
        await fot.getAddress(),
        stealthAddress,
        100_000n,
        EPHEMERAL_PUBKEY,
        VIEW_TAG,
      ),
    ).to.be.revertedWithCustomError(router, "UnexpectedTokenAmountReceived");

    expect(await fot.balanceOf(stealthAddress)).to.equal(0n);
  });

  it("rejects tokens that return false instead of reverting", async () => {
    const { router } = await deployAnnouncerAndRouter();
    const liar = await ethers.deployContract("FalseReturningToken");
    await liar.waitForDeployment();

    const [payer] = await ethers.getSigners();
    await liar.mint(payer.address, 1000n);
    await liar.approve(await router.getAddress(), 1000n);

    // SafeERC20 turns the false return into a revert. The error is declared by
    // the library the ROUTER links, so it surfaces on the router's ABI.
    await expect(
      router.payERC20(
        await liar.getAddress(),
        randomStealthAddress(),
        100n,
        EPHEMERAL_PUBKEY,
        VIEW_TAG,
      ),
    ).to.be.revertedWithCustomError(router, "SafeERC20FailedOperation");
  });

  it("documents that a token misreporting balanceOf defeats the delta check", async () => {
    // Honest limitation: the exact-amount guard depends on the token telling
    // the truth about balances. A token that always reports 0 is detected here
    // only because the delta then mismatches — but a token engineered to
    // report a consistent lie cannot be caught on-chain at all.
    const { router } = await deployAnnouncerAndRouter();
    const liar = await ethers.deployContract("LyingBalanceToken");
    await liar.waitForDeployment();

    const [payer] = await ethers.getSigners();
    await liar.mint(payer.address, 1000n);
    await liar.approve(await router.getAddress(), 1000n);

    await expect(
      router.payERC20(
        await liar.getAddress(),
        randomStealthAddress(),
        100n,
        EPHEMERAL_PUBKEY,
        VIEW_TAG,
      ),
    ).to.be.revertedWithCustomError(router, "UnexpectedTokenAmountReceived");
  });

  it("retains no balance of either asset across many payments", async () => {
    const { router } = await deployAnnouncerAndRouter();
    const routerAddress = await router.getAddress();
    const token = await deployToken(18);
    const [payer] = await ethers.getSigners();

    await token.mint(payer.address, ethers.parseEther("1000"));
    await token.approve(routerAddress, ethers.parseEther("1000"));

    for (let i = 0; i < 5; i++) {
      await router.payNative(
        randomStealthAddress(),
        EPHEMERAL_PUBKEY,
        VIEW_TAG,
        { value: ethers.parseEther("1") },
      );
      await router.payERC20(
        await token.getAddress(),
        randomStealthAddress(),
        ethers.parseEther("10"),
        EPHEMERAL_PUBKEY,
        VIEW_TAG,
        { value: ethers.parseEther("0.01") },
      );
    }

    expect(await ethers.provider.getBalance(routerAddress)).to.equal(0n);
    expect(await token.balanceOf(routerAddress)).to.equal(0n);
  });

  it("accepts any view tag byte without interpreting it", async () => {
    const { announcer, router } = await deployAnnouncerAndRouter();
    // The view tag is an opaque filter hint, not an authentication mechanism.
    for (const tag of ["0x00", "0xff", "0x7f"]) {
      await expect(
        router.payNative(randomStealthAddress(), EPHEMERAL_PUBKEY, tag, {
          value: ethers.parseEther("0.1"),
        }),
      ).to.emit(announcer, "Announcement");
    }
  });
});
