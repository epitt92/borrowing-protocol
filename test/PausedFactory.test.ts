// noinspection JSPotentiallyInvalidUsageOfThis

import { expect, use } from "chai";
import { solidity } from "ethereum-waffle";
import { constants, ContractReceipt, ContractTransaction, providers, Signer } from "ethers";
import {
  ILiquidationPool,
  MintableToken,
  MintableTokenOwner,
  TestPriceFeed,
  TestFeeRecipient,
  TokenToPriceFeed,
  Trove,
  OriginalTroveFactory,
  StabilityPoolBase,
  BONQStaking
} from "../src/types";
import { addressZero, DECIMAL_PRECISION, deployContract, deployUUPSContract, toBN } from "./utils/helpers";
import { describe } from "mocha";

import { ethers } from "hardhat";

use(solidity);

// Start test block
describe("Paused Factory Trove Operation", function () {
  this.timeout(50000);

  const wallets: Signer[] = [];
  let accounts: string[];
  let OWNER_ROLE: string;
  let troveFactory: OriginalTroveFactory;
  let provider: providers.JsonRpcProvider;
  let mintableTokenOwner: MintableTokenOwner;
  let troveToken: MintableToken;
  let stableCoin: MintableToken;
  let bonqToken: MintableToken;
  let stabilityPool: StabilityPoolBase;
  let tokenToPriceFeed: TokenToPriceFeed;
  let priceFeed: TestPriceFeed;
  let liquidationPool: ILiquidationPool;

  beforeEach(async function () {
    provider = ethers.provider;
    accounts = await provider.listAccounts();
    for (const account of accounts) {
      wallets.push(provider.getSigner(account));
    }

    troveToken = (await deployContract(wallets[0], "MintableToken", ["Mintable Token for Test", "MTT"])) as MintableToken;

    stableCoin = (await deployContract(wallets[0], "MintableToken", ["Mintable Stable Coin for Test", "MSC"])) as MintableToken;
  });

  it("can create paused factory", async function () {
    tokenToPriceFeed = (await deployContract(wallets[0], "TokenToPriceFeed")) as TokenToPriceFeed;
    await tokenToPriceFeed.deployed();

    priceFeed = (await deployContract(wallets[0], "TestPriceFeed", [troveToken.address])) as TestPriceFeed;
    await priceFeed.deployed();

    await tokenToPriceFeed.setTokenPriceFeed(troveToken.address, priceFeed.address, 120, 250);
    expect(await tokenToPriceFeed.tokenPrice(troveToken.address)).to.equal("10000000000000000000");

    const testFeeRecipient: TestFeeRecipient = (await deployContract(wallets[0], "TestFeeRecipient", [stableCoin.address])) as TestFeeRecipient;
    await testFeeRecipient.deployed();

    troveFactory = (await deployUUPSContract(wallets[0], "OriginalTroveFactory", [stableCoin.address, testFeeRecipient.address], [])) as OriginalTroveFactory;

    await (await troveFactory.togglePause()).wait();
    expect(await troveFactory.paused()).to.be.true;

    await troveFactory.setTokenPriceFeed(tokenToPriceFeed.address);

    mintableTokenOwner = (await deployContract(wallets[0], "MintableTokenOwner", [stableCoin.address])) as MintableTokenOwner;
    await mintableTokenOwner.deployed();
    await mintableTokenOwner.addMinter(await wallets[0].getAddress());
    await stableCoin.transferOwnership(mintableTokenOwner.address);
    await expect(mintableTokenOwner.transferOwnership(troveFactory.address))
      .to.emit(mintableTokenOwner, "OwnershipTransferred")
      .withArgs(await wallets[0].getAddress(), troveFactory.address);
    await troveFactory.setTokenOwner();
    expect(await troveFactory.tokenOwner()).to.equal(mintableTokenOwner.address);

    liquidationPool = await deployContract(wallets[0], "CommunityLiquidationPool", [troveFactory.address, troveToken.address]);
    await troveFactory.setLiquidationPool(troveToken.address, liquidationPool.address);
    bonqToken = (await deployContract(wallets[0], "MintableToken", ["BONQ Token for Test", "BONQ"])) as MintableToken;
    stabilityPool = (await deployUUPSContract(wallets[0], "StabilityPoolBase", [], [troveFactory.address, bonqToken.address])) as StabilityPoolBase;
    await troveFactory.setStabilityPool(stabilityPool.address);
  });

  describe("with Trove Factory as Pausable", function () {
    let testFeeRecipient: TestFeeRecipient;

    const addTrove = async function (owner: Signer = wallets[0], tokenAddress = troveToken.address, mint = true): Promise<Trove> {
      const tx: ContractTransaction = await troveFactory.connect(owner).createTrove(tokenAddress);
      const receipt: ContractReceipt = await tx.wait();
      // @ts-ignore
      const troveAddress = receipt.events.filter((x) => {
        return x.event == "NewTrove";
      })[0].args.trove;
      if (mint) {
        const token = await ethers.getContractAt("MintableToken", tokenAddress);
        await token.mint(troveAddress, totalCollateral);
      }
      const trove: Trove = (await ethers.getContractAt("Trove", troveAddress)) as Trove;
      await trove.connect(owner).increaseCollateral(0, trove.address);
      return trove;
    };

    beforeEach(async function () {
      mintableTokenOwner = (await deployContract(wallets[0], "MintableTokenOwner", [stableCoin.address])) as MintableTokenOwner;
      await mintableTokenOwner.addMinter(await wallets[0].getAddress());
      await stableCoin.transferOwnership(mintableTokenOwner.address);

      tokenToPriceFeed = (await deployContract(wallets[0], "TokenToPriceFeed")) as TokenToPriceFeed;

      priceFeed = (await deployContract(wallets[0], "TestPriceFeed", [troveToken.address])) as TestPriceFeed;

      await tokenToPriceFeed.setTokenPriceFeed(troveToken.address, priceFeed.address, 120, 250);

      testFeeRecipient = (await deployContract(wallets[0], "TestFeeRecipient", [stableCoin.address])) as TestFeeRecipient;

      troveFactory = (await deployUUPSContract(wallets[0], "OriginalTroveFactory", [stableCoin.address, testFeeRecipient.address], [])) as OriginalTroveFactory;

      await (await troveFactory.togglePause()).wait();
      expect(await troveFactory.paused()).to.be.true;

      const troveImplementation = (await deployContract(wallets[0], "Trove", [troveFactory.address])) as Trove;

      await (await troveFactory.setTroveImplementation(troveImplementation.address)).wait();
      await troveFactory.setTokenPriceFeed(tokenToPriceFeed.address);
      await mintableTokenOwner.transferOwnership(troveFactory.address);
      await troveFactory.setTokenOwner();
      liquidationPool = await deployContract(wallets[0], "CommunityLiquidationPool", [troveFactory.address, troveToken.address]);
      await troveFactory.setLiquidationPool(troveToken.address, liquidationPool.address);
      bonqToken = (await deployContract(wallets[0], "MintableToken", ["BONQ Token for Test", "BONQ"])) as MintableToken;
      stabilityPool = (await deployUUPSContract(wallets[0], "StabilityPoolBase", [], [troveFactory.address, bonqToken.address])) as StabilityPoolBase;

      await troveFactory.setStabilityPool(stabilityPool.address);
    });

    it("creates a trove with msg.sender as owner and a positive collateral balance with proper decimals", async function () {
      const trove = await addTrove();
      OWNER_ROLE = await trove.OWNER_ROLE();
      expect(await trove.hasRole(OWNER_ROLE, await wallets[0].getAddress())).to.equal(true);
      expect(await troveFactory.lastTrove(troveToken.address)).to.equal(trove.address);
      expect(await troveFactory.containsTrove(troveToken.address, trove.address)).to.be.true;
      expect(await trove.factory()).to.equal(troveFactory.address);
      expect(await trove.DECIMAL_PRECISION()).to.equal(toBN(10).pow(await troveToken.decimals()));
      await expect(mintableTokenOwner.connect(wallets[0]).mint(trove.address, "100000000000000000000"))
        .to.emit(stableCoin, "Transfer")
        .withArgs(addressZero, trove.address, "100000000000000000000");

      await expect(trove.increaseCollateral(0, constants.AddressZero)).to.not.be.reverted;
    });

    const totalCollateral = "1000000000000000000";
    const amount = "1000000000000000000";

    describe("when factory paused", async function () {
      let trove: Trove;

      beforeEach(async function () {
        trove = await addTrove(wallets[1]);
      });

      it("can not borrow", async function () {
        expect(troveFactory.address).to.equal(await trove.factory());
        const owner = await trove.owner();
        const ownerWallet = provider.getSigner(owner);
        const firstTrove = await troveFactory.firstTrove(troveToken.address);
        await expect(trove.connect(ownerWallet).borrow(owner, toBN(amount), firstTrove)).to.be.revertedWith("cfa4b Trove Factory is paused");
      });

      describe("trove liquidation skips stabilityPool", function () {
        let troveToken1: MintableToken, priceFeed1: TestPriceFeed, communityLiquidationPool1: ILiquidationPool, trove1: Trove, trove11: Trove;

        beforeEach(async () => {
          troveToken1 = await deployContract(wallets[0], "MintableToken", ["TroveToken1", "TT1"]);

          priceFeed1 = await deployContract(wallets[0], "TestPriceFeed", [troveToken1.address]);

          await tokenToPriceFeed.setTokenPriceFeed(troveToken1.address, priceFeed1.address, 120, 250);

          communityLiquidationPool1 = await deployContract(wallets[0], "CommunityLiquidationPool", [troveFactory.address, troveToken1.address]);
          await troveFactory.setLiquidationPool(troveToken1.address, communityLiquidationPool1.address);

          await addTrove(wallets[0], troveToken1.address);

          trove1 = await addTrove(wallets[0], troveToken1.address);
          trove11 = await addTrove(wallets[0], troveToken1.address);

          expect(await troveFactory.paused()).to.be.true;
          await troveFactory.togglePause();
          expect(await troveFactory.paused()).to.be.false;
          await trove1.connect(wallets[0]).borrow(accounts[0], toBN(DECIMAL_PRECISION).mul(5), trove11.address);
          await trove11.connect(wallets[0]).borrow(accounts[0], toBN(DECIMAL_PRECISION).mul(5), trove1.address);
          await troveFactory.togglePause();
          expect(await troveFactory.paused()).to.be.true;

          await priceFeed1.setPrice(toBN(DECIMAL_PRECISION).mul("5025").div(1000));
        });

        it("can liquidate a trove with below MCR collateral, but with liquidationPool", async function () {
          const ownerWallet = wallets[1];
          const owner = accounts[1];
          // const trove = trove;

          expect(await troveFactory.paused()).to.be.true;
          await troveFactory.togglePause();
          expect(await troveFactory.paused()).to.be.false;
          await (await addTrove(wallets[1])).connect(ownerWallet).borrow(owner, amount, trove.address);
          await trove.connect(ownerWallet).borrow(owner, amount, trove.address);
          await troveFactory.togglePause();
          expect(await troveFactory.paused()).to.be.true;

          const liquidationPrice = (await trove.debt()).mul(await trove.mcr()).div(await trove.collateral());
          await priceFeed.setPrice(liquidationPrice.mul(100).div(101));

          const debt = await trove.debt();
          const collateral = await trove.collateral();

          await mintableTokenOwner.mint(accounts[2], debt.mul(3));
          await stableCoin.connect(wallets[2]).approve(stabilityPool.address, debt.mul(3));
          await stabilityPool.connect(wallets[2]).deposit(debt.mul(3));

          await expect(trove.connect(ownerWallet).liquidate())
            .to.emit(trove, "Liquidated")
            .withArgs(trove.address, debt.sub(DECIMAL_PRECISION), collateral)
            .and.to.emit(troveToken, "Transfer")
            .withArgs(trove.address, liquidationPool.address, collateral)
            .and.to.emit(stableCoin, "Approval")
            .withArgs(trove.address, owner, DECIMAL_PRECISION)
            .to.emit(troveFactory, "TroveLiquidated")
            .withArgs(trove.address, troveToken.address, await priceFeed.price(), addressZero, collateral);

          await expect(stableCoin.connect(ownerWallet).transferFrom(trove.address, owner, DECIMAL_PRECISION))
            .to.emit(stableCoin, "Transfer")
            .withArgs(trove.address, owner, DECIMAL_PRECISION);

          expect(await troveToken.balanceOf(liquidationPool.address)).to.equal(collateral);
          expect(await trove.debt()).to.equal("0");
          expect(await trove.collateral()).to.equal("0");
        });
      });

      describe("trove redemption", function () {
        let troveToken1: MintableToken, priceFeed1: TestPriceFeed, communityLiquidationPool1: ILiquidationPool, trove1: Trove, trove11: Trove, trove12: Trove;

        beforeEach(async () => {
          troveToken1 = await deployContract(wallets[0], "MintableToken", ["TroveToken1", "TT1"]);

          priceFeed1 = await deployContract(wallets[0], "TestPriceFeed", [troveToken1.address]);

          await tokenToPriceFeed.setTokenPriceFeed(troveToken1.address, priceFeed1.address, 120, 250);

          communityLiquidationPool1 = await deployContract(wallets[0], "CommunityLiquidationPool", [troveFactory.address, troveToken1.address]);

          await troveFactory.setLiquidationPool(troveToken1.address, communityLiquidationPool1.address);

          trove1 = await addTrove(wallets[0], troveToken1.address);
          trove11 = await addTrove(wallets[0], troveToken1.address);
          trove12 = await addTrove(wallets[1], troveToken1.address);
          await priceFeed1.setPrice(DECIMAL_PRECISION.mul(4)); // TCR = ~200% as the debt is 1BEUR + 1BEUR liquidation reserve
          expect(await troveFactory.paused()).to.be.true;
          await troveFactory.togglePause();
          expect(await troveFactory.paused()).to.be.false;
          await trove1.connect(wallets[0]).borrow(accounts[0], toBN(amount), trove11.address);
          await trove11.connect(wallets[0]).borrow(accounts[0], toBN(amount), trove12.address);
          await trove12.connect(wallets[1]).borrow(accounts[0], toBN(amount), trove11.address);
          await troveFactory.togglePause();
          expect(await troveFactory.paused()).to.be.true;
        });

        it("still redeems from few troves with normal amount to price", async function () {
          const bonqStaking = (await deployUUPSContract(wallets[0], "BONQStaking", [bonqToken.address], [])) as BONQStaking;

          await bonqStaking.setFactory(troveFactory.address);
          await bonqStaking.setInitialLastFee(0);
          await troveFactory.setFeeRecipient(bonqStaking.address);

          const initialPrice = toBN(DECIMAL_PRECISION).mul(3); // 149% < TCR < 150%
          await priceFeed1.setPrice(initialPrice);
          const redemptionAmount1 = toBN(amount).mul(3);
          await mintableTokenOwner.mint(await wallets[4].getAddress(), redemptionAmount1.mul(2));
          const maxRate = toBN(DECIMAL_PRECISION).div(20); // 5%
          const lastTroveTCR = await trove11.collateralization();
          const lastTroveHint = trove11.address;
          await stableCoin.connect(wallets[4]).approve(troveFactory.address, ethers.constants.MaxInt256);

          await expect(troveFactory.connect(wallets[4]).redeemStableCoinForCollateral(troveToken1.address, redemptionAmount1, maxRate, lastTroveTCR, lastTroveHint)).to.not.be
            .reverted;
        });
      });
    });

    describe("when factory is unpaused back", async function () {
      let trove: Trove;

      beforeEach(async function () {
        trove = await addTrove(wallets[1]);

        expect(await troveFactory.paused()).to.be.true;
        await troveFactory.togglePause();
        expect(await troveFactory.paused()).to.be.false;
      });

      describe("trove liquidation skips stabilityPool", function () {
        let troveToken1: MintableToken, priceFeed1: TestPriceFeed, communityLiquidationPool1: ILiquidationPool, trove1: Trove, trove11: Trove;

        beforeEach(async () => {
          troveToken1 = await deployContract(wallets[0], "MintableToken", ["TroveToken1", "TT1"]);

          priceFeed1 = await deployContract(wallets[0], "TestPriceFeed", [troveToken1.address]);

          await tokenToPriceFeed.setTokenPriceFeed(troveToken1.address, priceFeed1.address, 120, 250);

          communityLiquidationPool1 = await deployContract(wallets[0], "CommunityLiquidationPool", [troveFactory.address, troveToken1.address]);
          await troveFactory.setLiquidationPool(troveToken1.address, communityLiquidationPool1.address);

          await addTrove(wallets[0], troveToken1.address);
          trove1 = await addTrove(wallets[0], troveToken1.address);
          trove11 = await addTrove(wallets[0], troveToken1.address);
          await trove1.connect(wallets[0]).borrow(accounts[0], toBN(DECIMAL_PRECISION).mul(5), trove11.address);
          await trove11.connect(wallets[0]).borrow(accounts[0], toBN(DECIMAL_PRECISION).mul(5), trove1.address);

          await priceFeed1.setPrice(toBN(DECIMAL_PRECISION).mul("5025").div(1000));
        });

        it("can liquidate a trove with below MCR collateral, but with stabilityPool", async function () {
          const ownerWallet = wallets[1];
          const owner = accounts[1];
          // const trove = trove;

          await (await addTrove(wallets[1])).connect(ownerWallet).borrow(owner, amount, trove.address);
          await trove.connect(ownerWallet).borrow(owner, amount, trove.address);

          const liquidationPrice = (await trove.debt()).mul(await trove.mcr()).div(await trove.collateral());
          await priceFeed.setPrice(liquidationPrice.mul(100).div(101));

          const debt = await trove.debt();
          const collateral = await trove.collateral();

          await mintableTokenOwner.mint(accounts[2], debt.mul(3));
          await stableCoin.connect(wallets[2]).approve(stabilityPool.address, debt.mul(3));
          await stabilityPool.connect(wallets[2]).deposit(debt.mul(3));

          await expect(trove.connect(ownerWallet).liquidate())
            .to.emit(trove, "Liquidated")
            .withArgs(trove.address, debt.sub(DECIMAL_PRECISION), collateral)
            .and.to.emit(troveToken, "Transfer")
            .withArgs(trove.address, stabilityPool.address, collateral)
            .and.to.emit(stableCoin, "Approval")
            .withArgs(trove.address, owner, DECIMAL_PRECISION)
            .to.emit(troveFactory, "TroveLiquidated")
            .withArgs(trove.address, troveToken.address, await priceFeed.price(), stabilityPool.address, collateral);

          await expect(stableCoin.connect(ownerWallet).transferFrom(trove.address, owner, DECIMAL_PRECISION))
            .to.emit(stableCoin, "Transfer")
            .withArgs(trove.address, owner, DECIMAL_PRECISION);

          expect(await trove.debt()).to.equal("0");
          expect(await trove.collateral()).to.equal("0");
        });
      });
    });
  });
});
