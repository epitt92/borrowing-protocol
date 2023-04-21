// noinspection JSPotentiallyInvalidUsageOfThis

import { expect, use } from "chai";
import { solidity } from "ethereum-waffle";
import { BigNumber, Contract, Signer } from "ethers";
import TroveContract from "../artifacts/contracts/trove.sol/Trove.json";
import { ArbitragePoolUniswap, BONQStaking, ILiquidationPool, MaliciousArbitrageToken, TestMintableToken, TestPriceFeed, TestRouter, Trove } from "../src/types";
import { addressZero, DECIMAL_PRECISION, deployUUPSContract, LIQUIDATION_RESERVE, toBN } from "./utils/helpers";
import { before, describe } from "mocha";

import { ethers } from "hardhat";
import { TroveFactoryArbitrageTest } from "./utils/TroveFactoryArbitrageTest";
import { LiquidatedEvent } from "../src/types/Trove";
import { TransferEvent } from "../src/types/ERC20";

use(solidity);

// Start test block
describe("Trove Operations with Arbitrage Participation", function () {
  this.timeout(50000);

  let OWNER_ROLE: string;

  const sut = new TroveFactoryArbitrageTest(ethers);

  before(async function () {
    await sut.ready;
  });

  beforeEach(async function () {
    expect(await sut.setup()).to.be.true;
  });

  it("creates a trove with msg.sender as owner and a positive collateral balance with proper decimals", async function () {
    const trove = await sut.addTrove();
    OWNER_ROLE = await trove.OWNER_ROLE();
    expect(await trove.hasRole(OWNER_ROLE, await sut.wallets[0].getAddress())).to.equal(true);
    expect(await sut.troveFactory.lastTrove(sut.troveToken.address)).to.equal(trove.address);
    expect(await sut.troveFactory.containsTrove(sut.troveToken.address, trove.address)).to.be.true;
    expect(await trove.factory()).to.equal(sut.troveFactory.address);
    expect(await trove.DECIMAL_PRECISION()).to.equal(toBN(10).pow(await sut.troveToken.decimals()));
    await expect(sut.mintableTokenOwner.connect(sut.wallets[0]).mint(trove.address, "100000000000000000000"))
      .to.emit(sut.stableCoin, "Transfer")
      .withArgs(addressZero, trove.address, "100000000000000000000");
  });

  const totalCollateral = "1000000000000000000";
  const amount = "1000000000000000000";

  describe("single trove", async function () {
    let trove: Trove;

    beforeEach(async function () {
      trove = await sut.addTrove();
      OWNER_ROLE = await trove.OWNER_ROLE();
      await sut.mintableTokenOwner.mint(await sut.wallets[1].getAddress(), toBN(amount).mul(10));
    });

    it("when the trove owner transfers ownership, they lose access to the trove", async function () {
      const owner = await sut.wallets[0].getAddress();
      const newOwner = await sut.wallets[2].getAddress();
      await expect(trove.connect(sut.wallets[0]).transferOwnership(newOwner)).to.emit(trove, "OwnershipTransferred").withArgs(owner, newOwner);
      expect(await trove.hasRole(OWNER_ROLE, newOwner)).to.be.true;
      expect(await trove.hasRole(OWNER_ROLE, owner)).to.be.false;
    });

    it("the trove can be funded by transferring tokens directly to it", async function () {
      await sut.troveToken.mint(await sut.wallets[2].getAddress(), amount);
      await sut.troveToken.connect(sut.wallets[2]).transfer(trove.address, toBN(amount).div("2"));
      const increase = toBN(amount).div("2");

      const totalCollateral = await sut.troveFactory.totalCollateral(sut.troveToken.address);
      await expect(trove.connect(sut.wallets[3]).increaseCollateral(0, trove.address))
        .to.emit(sut.troveFactory, "CollateralUpdate")
        .withArgs(sut.troveToken.address, totalCollateral.add(increase));
    });

    it("the trove owner can transfer some of the tokens from the trove to an arbitrary address", async function () {
      const apTokenBalance = await sut.apToken.balanceOf(trove.address);
      const apTokenPrice = await sut.arbitragePool.getAPtokenPrice(sut.troveToken.address);
      expect(await trove.collateral()).to.equal(apTokenBalance.mul(apTokenPrice).div(DECIMAL_PRECISION));
      const totalCollateral = await sut.troveFactory.totalCollateral(sut.troveToken.address);
      const wlt1 = await sut.wallets[1].getAddress();
      await expect(trove.connect(sut.wallets[0]).decreaseCollateral(wlt1, amount, addressZero))
        .to.emit(sut.troveToken, "Transfer")
        .withArgs(trove.address, wlt1, amount)
        .and.to.emit(sut.troveFactory, "CollateralUpdate")
        .withArgs(sut.troveToken.address, totalCollateral.sub(amount));
    });

    it("the trove owner can transfer the entire balance of a token which is not the collateral token to an arbitrary address", async function () {
      const wrongToken = (await sut.deployContract(sut.wallets[0], "TestMintableToken", ["Just a token", "JAT"])) as TestMintableToken;
      await wrongToken.mint(trove.address, amount);
      await expect(trove.connect(sut.wallets[0]).transferToken(wrongToken.address, await sut.wallets[1].getAddress()))
        .to.emit(wrongToken, "Transfer")
        .withArgs(trove.address, await sut.wallets[1].getAddress(), amount);
      expect(await wrongToken.balanceOf(await sut.wallets[1].getAddress())).to.equal(amount);
    });

    it("the trove refuses to send the collateral if not called by the owner", async function () {
      await expect(trove.connect(sut.wallets[1]).decreaseCollateral(await sut.wallets[1].getAddress(), amount, addressZero)).to.be.revertedWith(
        "cfa3b address is missing OWNER_ROLE"
      );
    });

    it("the trove refuses to send the collateral token with transfertoken", async function () {
      await expect(trove.connect(sut.wallets[0]).transferToken(sut.troveToken.address, await sut.wallets[1].getAddress())).to.be.revertedWith("7a810 can't transfer collateral");
    });

    it("the trove refuses to send the stable coin with transfertoken", async function () {
      await expect(trove.connect(sut.wallets[0]).transferToken(sut.stableCoin.address, await sut.wallets[1].getAddress())).to.be.revertedWith("7a810 can't transfer stable coin");
    });

    it("the trove refuses to send the collateral token with transfertoken", async function () {
      await expect(trove.connect(sut.wallets[0]).transferToken(sut.troveToken.address, await sut.wallets[1].getAddress())).to.be.revertedWith("7a810 can't transfer collateral");
    });

    it("the trove owner can take out a loan ", async function () {
      await expect(trove.connect(sut.wallets[0]).borrow(await sut.wallets[2].getAddress(), amount, trove.address))
        .to.emit(sut.stableCoin, "Transfer")
        .withArgs("0x0000000000000000000000000000000000000000", trove.address, toBN(LIQUIDATION_RESERVE).add(toBN(amount).mul("1005").div("1000")))
        .and.to.emit(sut.stableCoin, "Transfer")
        .withArgs(trove.address, await sut.wallets[2].getAddress(), amount)
        .and.to.emit(sut.stableCoin, "Transfer")
        .withArgs(trove.address, sut.testFeeRecipient.address, toBN(amount).mul("5").div("1000"));
      expect(await sut.stableCoin.balanceOf(await sut.wallets[2].getAddress())).to.equal(amount);
      expect(await sut.stableCoin.balanceOf(sut.testFeeRecipient.address)).to.equal(toBN(amount).mul("5").div("1000"));
      expect(await trove.debt()).to.equal(toBN(LIQUIDATION_RESERVE).add(toBN(amount).mul("1005").div("1000")));
    });

    it("the trove owner can not take a loan of less than 1 Coin", async function () {
      await expect(trove.connect(sut.wallets[0]).borrow(await sut.wallets[1].getAddress(), toBN(DECIMAL_PRECISION).sub(1), trove.address)).to.be.revertedWith(
        "cb29c amount must be gt 1 token"
      );
    });

    it("the trove refuses to borrow for non owners", async function () {
      await expect(trove.connect(sut.wallets[1]).borrow(await sut.wallets[1].getAddress(), amount, trove.address)).to.be.revertedWith("cfa3b address is missing OWNER_ROLE");
    });

    it("the trove owner can not take out a loan that would lead to undercollateralisation", async function () {
      await expect(trove.connect(sut.wallets[0]).borrow(await sut.wallets[1].getAddress(), toBN(totalCollateral).mul(9), trove.address)).to.be.revertedWith(
        "41670 TCR must be > MCR"
      );
    });

    it("anyone can repay parts of a loan by allowing the trove to transfer from the user balance", async function () {
      await trove.connect(sut.wallets[0]).borrow(await sut.wallets[1].getAddress(), amount, trove.address);
      await sut.stableCoin.connect(sut.wallets[1]).approve(trove.address, amount);
      const debt = await trove.debt();
      const repayAmount = toBN(amount).div(2);
      await expect(trove.connect(sut.wallets[1]).repay(repayAmount, trove.address))
        .to.emit(sut.stableCoin, "Transfer")
        .withArgs(await sut.wallets[1].getAddress(), trove.address, toBN(amount).div(2))
        .and.to.emit(sut.stableCoin, "Transfer")
        .withArgs(trove.address, "0x0000000000000000000000000000000000000000", toBN(amount).div(2));
      expect(await trove.debt()).to.equal(debt.sub(repayAmount));
    });

    it("anyone can repay entirety of a loan ", async function () {
      await trove.connect(sut.wallets[0]).borrow(await sut.wallets[1].getAddress(), amount, trove.address);
      const repayAmount = toBN(amount).mul(1005).div(1000);
      await sut.stableCoin.connect(sut.wallets[1]).approve(trove.address, repayAmount);
      await expect(trove.connect(sut.wallets[1]).repay(repayAmount, trove.address))
        .to.emit(sut.stableCoin, "Transfer")
        .withArgs(await sut.wallets[1].getAddress(), trove.address, repayAmount)
        .and.to.emit(sut.stableCoin, "Transfer")
        .withArgs(trove.address, "0x0000000000000000000000000000000000000000", repayAmount)
        .and.to.emit(sut.stableCoin, "Transfer")
        .withArgs(trove.address, "0x0000000000000000000000000000000000000000", LIQUIDATION_RESERVE);
      expect(await trove.debt()).to.equal("0");
    });

    describe("use WETH as collateral", function () {
      beforeEach(async function () {
        trove = await sut.addTrove(sut.wallets[1], sut.WETH.address, false);
      });

      it("the trove can be funded by WETH through sut.troveFactory", async function () {
        const owner = sut.wallets[1];
        await expect(sut.troveFactory.connect(owner).increaseCollateralNative(trove.address, trove.address, { value: amount }))
          .to.emit(sut.troveFactory, "CollateralUpdate")
          .withArgs(sut.WETH.address, amount);
      });

      it("the trove can be funded with WETH by transferring them directly", async function () {
        const owner = sut.wallets[1];
        await owner.sendTransaction({ to: sut.WETH.address, value: toBN(amount) });
        await sut.WETH.connect(owner).transfer(trove.address, toBN(amount));
        await expect(trove.connect(owner).increaseCollateral(0, trove.address)).to.emit(sut.troveFactory, "CollateralUpdate").withArgs(sut.WETH.address, amount);
      });

      it("the trove can be funded with WETH and increased through sut.troveFactory", async function () {
        await sut.WETH.connect(sut.wallets[2]).deposit({ value: amount });
        await sut.WETH.connect(sut.wallets[2]).transfer(trove.address, toBN(amount).div("2"));
        const increase = toBN(amount).div("2");

        const totalCollateral = await sut.troveFactory.totalCollateral(sut.troveToken.address);
        await expect(sut.troveFactory.connect(sut.wallets[3]).increaseCollateralNative(trove.address, trove.address, { value: toBN(amount) }))
          .to.emit(sut.troveFactory, "CollateralUpdate")
          .withArgs(sut.WETH.address, totalCollateral.add(increase));
      });
    });

    describe("add bot as owner", function () {
      it("the trove owner can add an additional owner", async function () {
        await trove.connect(sut.wallets[0]).addOwner(await sut.wallets[3].getAddress());
        expect(await trove.hasRole(OWNER_ROLE, await sut.wallets[3].getAddress())).to.equal(true);
      });

      describe("bot operates trove", function () {
        let bot: Signer;
        beforeEach(async function () {
          bot = sut.wallets[3];
          await trove.connect(sut.wallets[0]).addOwner(await bot.getAddress());
        });

        it("the bot can take out a loan ", async function () {
          await expect(trove.connect(bot).borrow(await sut.wallets[2].getAddress(), amount, trove.address))
            .to.emit(sut.stableCoin, "Transfer")
            .withArgs("0x0000000000000000000000000000000000000000", trove.address, toBN(LIQUIDATION_RESERVE).add(toBN(amount).mul("1005").div("1000")))
            .and.to.emit(sut.stableCoin, "Transfer")
            .withArgs(trove.address, await sut.wallets[2].getAddress(), amount)
            .and.to.emit(sut.stableCoin, "Transfer")
            .withArgs(trove.address, sut.testFeeRecipient.address, toBN(amount).mul("5").div("1000"));
          expect(await sut.stableCoin.balanceOf(await sut.wallets[2].getAddress())).to.equal(amount);
          expect(await sut.stableCoin.balanceOf(sut.testFeeRecipient.address)).to.equal(toBN(amount).mul("5").div("1000"));
          expect(await trove.debt()).to.equal(toBN(LIQUIDATION_RESERVE).add(toBN(amount).mul("1005").div("1000")));
        });

        it("the trove owner can transfer some of the tokens from the trove to an arbitrary address", async function () {
          const apTokenBalance = await sut.apToken.balanceOf(trove.address);
          const apTokenPrice = await sut.arbitragePool.getAPtokenPrice(sut.troveToken.address);
          expect(await trove.collateral()).to.equal(apTokenBalance.mul(apTokenPrice).div(DECIMAL_PRECISION));
          const totalCollateral = await sut.troveFactory.totalCollateral(sut.troveToken.address);

          await expect(trove.connect(bot).decreaseCollateral(await sut.wallets[1].getAddress(), amount, addressZero))
            .to.emit(sut.troveToken, "Transfer")
            .withArgs(trove.address, await sut.wallets[1].getAddress(), amount)
            .and.to.emit(sut.troveFactory, "CollateralUpdate")
            .withArgs(sut.troveToken.address, totalCollateral.sub(amount));
        });

        it("the bot can not borrow in excess of MCR", async function () {
          await expect(trove.connect(bot).borrow(await bot.getAddress(), toBN(totalCollateral).mul(9), trove.address)).to.be.revertedWith("41670 TCR must be > MCR");
        });

        it("the bot can transfer the entire balance of a token which is not the collateral token to an arbitrary address", async function () {
          const wrongToken = (await sut.deployContract(sut.wallets[0], "TestMintableToken", ["Just a token", "JAT"])) as TestMintableToken;
          await wrongToken.mint(trove.address, amount);
          await expect(trove.connect(bot).transferToken(wrongToken.address, await sut.wallets[1].getAddress()))
            .to.emit(wrongToken, "Transfer")
            .withArgs(trove.address, await sut.wallets[1].getAddress(), amount);
          expect(await wrongToken.balanceOf(await sut.wallets[1].getAddress())).to.equal(amount);
        });
      });
    });
  });

  describe("multiple troves - sorting", async function () {
    let troves: Trove[];
    const lastTroveIdx = 5;

    beforeEach(async function () {
      troves = await addTroves();
    });

    async function addTroves(): Promise<Trove[]> {
      // when the addTroves functionality resides in beforeEach, the tests fail
      const troves: Trove[] = [];
      for (let i = 0; i <= lastTroveIdx; i++) {
        const trove: Trove = await sut.addTrove(sut.wallets[i + 1]);
        troves.push(trove);
        await sut.mintableTokenOwner.mint(await sut.wallets[i + 1].getAddress(), amount);
      }
      return troves;
    }

    async function checkTroveList() {
      let trove = await sut.troveFactory.firstTrove(sut.troveToken.address);
      let prevCollateralisation = toBN("10");
      while (trove != (await sut.troveFactory.nextTrove(sut.troveToken.address, trove))) {
        const troveContract = new Contract(trove, TroveContract.abi, sut.eth.provider) as Trove;
        expect(prevCollateralisation.lte(await troveContract.collateralization())).to.be.true;
        prevCollateralisation = await troveContract.collateralization();
        trove = await sut.troveFactory.nextTrove(sut.troveToken.address, trove);
      }
    }

    it("can borrow 10% more for each trove", async function () {
      let i = 10;
      for (const trove of troves) {
        expect(sut.troveFactory.address).to.equal(await trove.factory());
        const owner = await trove.owner();
        const ownerWallet = sut.eth.provider.getSigner(owner);
        const firstTrove = await sut.troveFactory.firstTrove(sut.troveToken.address);
        await trove.connect(ownerWallet).borrow(
          owner,
          toBN(amount)
            .mul(i++)
            .div(10),
          firstTrove
        );
        await checkTroveList();
      }
    });

    it("can borrow 10% less for each trove", async function () {
      let i = 10;
      await sut.priceFeed.setPrice(toBN(DECIMAL_PRECISION).mul(100));
      for (const trove of troves) {
        const owner = await trove.owner();
        const ownerWallet = sut.eth.provider.getSigner(owner);
        const lastTrove = await sut.troveFactory.lastTrove(sut.troveToken.address);
        await trove.connect(ownerWallet).borrow(owner, toBN(amount).mul(i--), lastTrove);
        await checkTroveList();
      }

      await checkTroveList();
    });

    it("can borrow the same amount for each trove", async function () {
      for (const trove of troves) {
        const owner = await trove.owner();
        const ownerWallet = sut.eth.provider.getSigner(owner);
        const lastTrove = await sut.troveFactory.lastTrove(sut.troveToken.address);
        await trove.connect(ownerWallet).borrow(owner, amount, lastTrove);
        await checkTroveList();
      }
    });

    it("keeps a list of troves in order", async function () {
      this.timeout(1200000);

      await sut.mintableTokenOwner.mint(sut.accounts[0], toBN(amount).mul(1000000));

      const troves: Trove[] = [];
      // create troves with debt
      for (let i = 0; i <= toBN(process.env.LONG_LIST_SIZE).toNumber(); i++) {
        const ownerWallet = sut.wallets[i % sut.wallets.length];
        const trove = await sut.addTrove(ownerWallet);
        const randPct = toBN(100).add(randBetween(200, 400));
        await trove.connect(ownerWallet).borrow(await trove.owner(), toBN(amount).mul(randPct).div(100), trove.address);
        await sut.stableCoin.connect(sut.wallets[0]).approve(trove.address, await trove.MAX_INT());
        troves.push(trove);
      }

      //repay some of the debt
      for (const trove of troves) {
        const debt = await trove.debt();
        let amount = debt;
        if (randBetween(1, 10) != 5) {
          amount = debt.mul(toBN(randBetween(25, 75))).div(100);
        }
        await trove.connect(sut.wallets[0]).repay(amount, trove.address);
      }

      await checkTroveList();
    });

    describe("trove liquidation", function () {
      let troveToken1: TestMintableToken,
        troveToken2: TestMintableToken,
        troveToken3: TestMintableToken,
        priceFeed1: TestPriceFeed,
        priceFeed2: TestPriceFeed,
        priceFeed3: TestPriceFeed,
        communityLiquidationPool1: ILiquidationPool,
        communityLiquidationPool2: ILiquidationPool,
        communityLiquidationPool3: ILiquidationPool,
        trove1: Trove,
        trove11: Trove,
        trove2: Trove,
        trove21: Trove,
        trove3: Trove;

      beforeEach(async () => {
        troveToken1 = (await sut.deployContract(sut.wallets[0], "TestMintableToken", ["TroveToken1", "TT1"])) as TestMintableToken;
        troveToken2 = (await sut.deployContract(sut.wallets[0], "TestMintableToken", ["TroveToken2", "TT2"])) as TestMintableToken;
        troveToken3 = (await sut.deployContract(sut.wallets[0], "TestMintableToken", ["TroveToken3", "TT3"])) as TestMintableToken;
        await sut.arbitragePool.addToken(troveToken1.address);
        await sut.arbitragePool.addToken(troveToken2.address);
        await sut.arbitragePool.addToken(troveToken3.address);

        priceFeed1 = (await sut.deployContract(sut.wallets[0], "TestPriceFeed", [troveToken1.address])) as TestPriceFeed;
        priceFeed2 = (await sut.deployContract(sut.wallets[0], "TestPriceFeed", [troveToken2.address])) as TestPriceFeed;
        priceFeed3 = (await sut.deployContract(sut.wallets[0], "TestPriceFeed", [troveToken3.address])) as TestPriceFeed;

        await sut.tokenToPriceFeed.setTokenPriceFeed(troveToken1.address, priceFeed1.address, 120, 250);
        await sut.tokenToPriceFeed.setTokenPriceFeed(troveToken2.address, priceFeed2.address, 120, 250);
        await sut.tokenToPriceFeed.setTokenPriceFeed(troveToken3.address, priceFeed3.address, 120, 250);

        communityLiquidationPool1 = (await sut.deployContract(sut.wallets[0], "CommunityLiquidationPool", [sut.troveFactory.address, troveToken1.address])) as ILiquidationPool;
        communityLiquidationPool2 = (await sut.deployContract(sut.wallets[0], "CommunityLiquidationPool", [sut.troveFactory.address, troveToken2.address])) as ILiquidationPool;
        communityLiquidationPool3 = (await sut.deployContract(sut.wallets[0], "CommunityLiquidationPool", [sut.troveFactory.address, troveToken3.address])) as ILiquidationPool;

        await sut.troveFactory.setLiquidationPool(troveToken1.address, communityLiquidationPool1.address);
        await sut.troveFactory.setLiquidationPool(troveToken2.address, communityLiquidationPool2.address);
        await sut.troveFactory.setLiquidationPool(troveToken3.address, communityLiquidationPool3.address);

        await sut.addTrove(sut.wallets[0], troveToken1.address);
        await sut.addTrove(sut.wallets[0], troveToken2.address);
        await sut.addTrove(sut.wallets[0], troveToken3.address);

        trove1 = await sut.addTrove(sut.wallets[0], troveToken1.address);
        trove11 = await sut.addTrove(sut.wallets[0], troveToken1.address);
        trove2 = await sut.addTrove(sut.wallets[0], troveToken2.address);
        trove21 = await sut.addTrove(sut.wallets[0], troveToken2.address);
        trove3 = await sut.addTrove(sut.wallets[0], troveToken3.address);
        await trove1.connect(sut.wallets[0]).borrow(sut.accounts[0], toBN(DECIMAL_PRECISION).mul(5), trove11.address);
        await trove11.connect(sut.wallets[0]).borrow(sut.accounts[0], toBN(DECIMAL_PRECISION).mul(5), trove1.address);
        await trove2.connect(sut.wallets[0]).borrow(sut.accounts[0], toBN(DECIMAL_PRECISION).mul(5), trove2.address);
        await trove21.connect(sut.wallets[0]).borrow(sut.accounts[0], toBN(DECIMAL_PRECISION).mul(5), trove21.address);
        await trove3.connect(sut.wallets[0]).borrow(sut.accounts[0], DECIMAL_PRECISION, trove3.address);

        await priceFeed1.setPrice(toBN(DECIMAL_PRECISION).mul("5025").div(1000));
        await priceFeed2.setPrice(toBN(DECIMAL_PRECISION).mul("5025").div(1000));
      });

      it("can not liquidate a trove with below MCR collateral directly", async function () {
        const troves: Trove[] = await addTroves();
        const ownerWallet = sut.wallets[1];
        const owner = sut.accounts[1];
        const trove = troves[0];

        await troves[1].connect(sut.wallets[2]).borrow(owner, amount, trove.address);
        await trove.connect(ownerWallet).borrow(owner, amount, trove.address);
        const liquidationPrice = (await trove.netDebt()).mul(await trove.mcr()).div(await trove.collateral());
        await sut.priceFeed.setPrice(liquidationPrice.mul(100).div(101));

        const debt = await trove.debt();
        const collateral = await trove.collateral();
        await expect(trove.connect(sut.wallets[2]).liquidate()).to.be.revertedWith("cfa3b address is missing OWNER_ROLE");
      });

      it("can liquidate a trove through factory with below MCR collateral", async function () {
        const troves: Trove[] = await addTroves();
        const ownerWallet = sut.wallets[1];
        const owner = sut.accounts[1];
        const trove = troves[0];

        await troves[1].connect(sut.wallets[2]).borrow(owner, amount, trove.address);
        await trove.connect(ownerWallet).borrow(owner, amount, trove.address);
        const liquidationPrice = (await trove.debt()).mul(await trove.mcr()).div(await trove.collateral());
        await sut.priceFeed.setPrice(liquidationPrice.mul(100).div(101));

        const debt = await trove.debt();
        const collateral = await trove.collateral();
        await expect(sut.troveFactory.connect(sut.wallets[2]).liquidateTrove(trove.address, await trove.token()), "liquidation")
          .to.emit(trove, "Liquidated")
          .withArgs(trove.address, debt.sub(DECIMAL_PRECISION), collateral)
          .and.to.emit(sut.troveToken, "Transfer")
          .withArgs(trove.address, sut.liquidationPool.address, collateral)
          .and.to.emit(sut.stableCoin, "Transfer")
          .withArgs(trove.address, sut.accounts[2], DECIMAL_PRECISION)
          .and.to.emit(sut.stableCoin, "Approval")
          .withArgs(trove.address, sut.troveFactory.address, DECIMAL_PRECISION);

        expect(await sut.troveToken.balanceOf(sut.liquidationPool.address)).to.equal(collateral);
        expect(await trove.debt()).to.equal("0");
        expect(await trove.collateral()).to.equal("0");
      });

      it("can liquidate multiple troves with below MCR collateral", async function () {
        const ownerWallet = sut.wallets[0];
        const owner = sut.accounts[0];
        const troves = [trove11, trove1, trove2, trove21];

        for (const trove of troves) {
          const _troveToken: TestMintableToken = (await sut.getContractAt("TestMintableToken", await trove.token())) as TestMintableToken;
          const debt = await trove.debt();
          const collateral = await trove.collateral();
          const liquidationPrice = (await trove.debt()).mul(await trove.mcr()).div(await trove.collateral());
          const priceFeed: TestPriceFeed = await ethers.getContractAt("TestPriceFeed", await sut.tokenToPriceFeed.tokenPriceFeed(await trove.token()), sut.wallets[2]);
          await priceFeed.setPrice(liquidationPrice.mul(100).div(101));
          const liquidationPool = await ethers.getContractAt("CommunityLiquidationPool", await sut.troveFactory.liquidationPool(await trove.token()));
          const tx = await (await sut.troveFactory.connect(sut.wallets[2]).liquidateTrove(trove.address, await trove.token())).wait();
          const liquidationEvent: LiquidatedEvent = sut.getEventsFromReceipt(trove.interface, tx, "Liquidated")[0] as unknown as LiquidatedEvent;
          expect(liquidationEvent.args.trove).to.equal(trove.address);
          expect(liquidationEvent.args.debt).to.equal(debt.sub(DECIMAL_PRECISION));
          expect(liquidationEvent.args.collateral).to.equal(collateral);

          const transfers: TransferEvent[] = sut.getEventsFromReceipt(sut.troveToken.interface, tx, "Transfer") as unknown as TransferEvent[];
          console.log("transfers", transfers.length);
          expect(transfers.filter((tr) => tr.args.from === trove.address && tr.args.to === sut.arbitragePool.address)).to.not.be.undefined;
          expect(transfers.filter((tr) => tr.args.to === trove.address && tr.args.from === sut.arbitragePool.address)).to.not.be.undefined;
          expect(transfers.filter((tr) => tr.args.from === trove.address && tr.args.to === liquidationPool.address)).to.not.be.undefined;
          expect(transfers.filter((tr) => tr.args.from === trove.address && tr.args.to === addressZero)).to.not.be.undefined;
          expect(transfers.filter((tr) => tr.args.from === trove.address && tr.args.to === sut.accounts[2])).to.not.be.undefined;

          // .to.emit(trove, "Liquidated")
          // .withArgs(trove.address, debt.sub(DECIMAL_PRECISION), collateral)
          // .and.to.emit(sut.troveToken, "Transfer")
          // .withArgs(trove.address, sut.liquidationPool.address, collateral)
          // .and.to.emit(sut.stableCoin, "Transfer")
          // .withArgs(trove.address, sut.accounts[2], DECIMAL_PRECISION)
          // .and.to.emit(sut.stableCoin, "Approval")
          // .withArgs(trove.address, sut.troveFactory.address, DECIMAL_PRECISION);

          expect(await trove.debt()).to.equal("0");
          expect(await trove.collateral()).to.equal("0");
        }
        for (const trove of troves) {
          expect(await trove.debt()).to.equal("0");
          expect(await trove.collateral()).to.equal("0");
        }
        // check that the remaining troves have all the collateral 3 tokens and all the debt 12.05 BEUR = 2*5*1.005 + 2 LiqRes
        const tokens = [troveToken1, troveToken2];
        for (const token of tokens) {
          let trove: Trove = {} as Trove;
          do {
            if (!trove.address) {
              trove = (await sut.getContractAt("Trove", await sut.troveFactory.firstTrove(token.address))) as Trove;
            } else {
              trove = (await sut.getContractAt("Trove", await sut.troveFactory.nextTrove(token.address, trove.address))) as Trove;
            }
            expect(await trove.collateral()).to.equal(sut.DECIMAL_PRECISION.mul(3));
            expect(await trove.debt()).to.equal(sut.DECIMAL_PRECISION.mul(1205).div(100));
          } while (trove.address != (await sut.troveFactory.nextTrove(token.address, trove.address)));
        }
      });

      it("can not liquidate the last trove", async function () {
        const troves: Trove[] = [];
        {
          let trove: Trove = (await sut.getContractAt("Trove", await sut.troveFactory.firstTrove(troveToken1.address))) as Trove;
          troves.push(trove);
          trove = (await sut.getContractAt("Trove", await sut.troveFactory.nextTrove(troveToken1.address, trove.address))) as Trove;
          troves.push(trove);
          trove = (await sut.getContractAt("Trove", await sut.troveFactory.nextTrove(troveToken1.address, trove.address))) as Trove;
          troves.push(trove);
        }

        await expect(troves[0].connect(sut.wallets[0]).liquidate()).to.not.be.reverted;
        await expect(trove11.connect(sut.wallets[0]).liquidate()).to.not.be.reverted;

        const trove: Trove = (await sut.getContractAt("Trove", await sut.troveFactory.lastTrove(troveToken1.address))) as Trove;
        const liquidationPrice = (await trove.netDebt()).mul(await trove.mcr()).div(await trove.collateral());
        await priceFeed1.setPrice(liquidationPrice.mul(100).div(101));
        await expect(trove.connect(sut.wallets[0]).liquidate()).to.be.revertedWith("c0e35 the last trove can not be liquidated");
      });
    });

    describe("trove redemption", function () {
      let troveToken1: TestMintableToken, priceFeed1: TestPriceFeed, communityLiquidationPool1: ILiquidationPool, trove1: Trove, trove11: Trove, trove12: Trove;

      const get_sorted_troves = async function () {
        const trove_token = troveToken1.address;
        const result = [] as string[];
        result.push(await sut.troveFactory.firstTrove(trove_token));
        const last_trove = await sut.troveFactory.lastTrove(trove_token);
        let next_trove = await sut.troveFactory.nextTrove(trove_token, result[0]);
        while (next_trove != last_trove) {
          result.push(next_trove);
          try {
            next_trove = await sut.troveFactory.nextTrove(trove_token, next_trove);
          } catch {
            break;
          }
        }
        result.push(last_trove);
        return result;
      };

      beforeEach(async () => {
        troveToken1 = (await sut.deployContract(sut.wallets[0], "TestMintableToken", ["TroveToken1", "TT1"])) as TestMintableToken;
        await sut.arbitragePool.addToken(troveToken1.address);
        priceFeed1 = (await sut.deployContract(sut.wallets[0], "TestPriceFeed", [troveToken1.address])) as TestPriceFeed;

        await sut.tokenToPriceFeed.setTokenPriceFeed(troveToken1.address, priceFeed1.address, 120, 250);

        communityLiquidationPool1 = (await sut.deployContract(sut.wallets[0], "CommunityLiquidationPool", [sut.troveFactory.address, troveToken1.address])) as ILiquidationPool;

        await sut.troveFactory.setLiquidationPool(troveToken1.address, communityLiquidationPool1.address);

        trove1 = await sut.addTrove(sut.wallets[0], troveToken1.address);
        trove11 = await sut.addTrove(sut.wallets[0], troveToken1.address);
        trove12 = await sut.addTrove(sut.wallets[1], troveToken1.address);
        await priceFeed1.setPrice(DECIMAL_PRECISION.mul(4)); // TCR = ~200% as the debt is 1BEUR + 1BEUR liquidation reserve
        await trove1.connect(sut.wallets[0]).borrow(sut.accounts[0], toBN(amount), trove11.address);
        await trove11.connect(sut.wallets[0]).borrow(sut.accounts[0], toBN(amount), trove12.address);
        await trove12.connect(sut.wallets[1]).borrow(sut.accounts[0], toBN(amount), trove11.address);
      });

      it("can not redeem with bad TCR or bad fee rate", async function () {
        const redemptionAmount1 = toBN(amount); // '1000000000000000000'
        await sut.mintableTokenOwner.mint(await sut.wallets[4].getAddress(), redemptionAmount1.mul(2));
        const maxRate = toBN(DECIMAL_PRECISION).div(20); // 5%
        const lastTroveTCR = await trove11.collateralization();
        const lastTroveHint = trove12.address;

        try {
          await sut.troveFactory.connect(sut.wallets[4]).redeemStableCoinForCollateral(troveToken1.address, redemptionAmount1, maxRate, lastTroveTCR, lastTroveHint);
        } catch (err: any) {
          expect(err.message).to.contain("a7f99 StableCoin is not approved for factory");
        }

        await sut.stableCoin.connect(sut.wallets[4]).approve(sut.troveFactory.address, ethers.constants.MaxInt256);
        await expect(sut.troveFactory.connect(sut.wallets[4]).redeemStableCoinForCollateral(troveToken1.address, redemptionAmount1, maxRate.div(50), lastTroveTCR, lastTroveHint))
          .to.not.be.reverted;

        const liquidationPrice = toBN(DECIMAL_PRECISION).mul(1).div(5); // 0.2
        await priceFeed1.setPrice(liquidationPrice);

        await expect(
          sut.troveFactory.connect(sut.wallets[4]).redeemStableCoinForCollateral(troveToken1.address, redemptionAmount1, maxRate, lastTroveTCR, lastTroveHint)
        ).to.be.revertedWith("a7f99 first trove is undercollateralised and must be liquidated");
      });

      it("redeems from few troves with normal amount to price", async function () {
        const bonqStaking = (await deployUUPSContract(sut.wallets[0], "BONQStaking", [sut.bonqToken.address], [])) as BONQStaking;

        await bonqStaking.setFactory(sut.troveFactory.address);
        await bonqStaking.setInitialLastFee(0);
        await sut.troveFactory.setFeeRecipient(bonqStaking.address);

        const initialPrice = toBN(DECIMAL_PRECISION).mul(3); // 149% < TCR < 150%
        await priceFeed1.setPrice(initialPrice);
        const redemptionAmount1 = toBN(amount).mul(3);
        await sut.mintableTokenOwner.mint(await sut.wallets[4].getAddress(), redemptionAmount1.mul(2));
        const initalBeurBalance = await sut.stableCoin.balanceOf(sut.accounts[4]);
        const initalColBalance = await troveToken1.balanceOf(sut.accounts[4]);
        const maxRate = toBN(DECIMAL_PRECISION).div(20); // 5%
        const lastTroveTCR = await trove11.collateralization();
        const lastTroveHint = trove11.address;
        await sut.stableCoin.connect(sut.wallets[4]).approve(sut.troveFactory.address, ethers.constants.MaxInt256);

        const startBaseRate = await bonqStaking.baseRate();
        const expectedStableCoinRedeemed = BigNumber.from("2967079917929751316");
        const baseRateIncrease = expectedStableCoinRedeemed
          .mul(DECIMAL_PRECISION)
          .div((await sut.stableCoin.totalSupply()).sub(expectedStableCoinRedeemed).sub(DECIMAL_PRECISION.mul(2)));
        const calculatedFinishBaseRate = startBaseRate.add(baseRateIncrease);

        expect(await sut.troveFactory.connect(sut.wallets[4]).redeemStableCoinForCollateral(troveToken1.address, redemptionAmount1, maxRate, lastTroveTCR, lastTroveHint))
          .to.emit(sut.troveFactory, "Redemption")
          .withArgs(
            troveToken1.address,
            expectedStableCoinRedeemed,
            // collateral amount = stable coin amount divided by collateral price
            expectedStableCoinRedeemed.div(3),
            1,
            startBaseRate,
            calculatedFinishBaseRate,
            lastTroveHint
          );

        const beurBalance1 = await sut.stableCoin.balanceOf(sut.accounts[4]);
        const colBalance1 = await troveToken1.balanceOf(sut.accounts[4]);
        const idealSwap = colBalance1.sub(initalColBalance).mul(initialPrice).div(DECIMAL_PRECISION);

        expect(initalBeurBalance.sub(beurBalance1)).to.be.closeTo(idealSwap, DECIMAL_PRECISION.div(8));
        expect(idealSwap).to.be.below(redemptionAmount1);
      });

      it("fees are decayed, paid, and with right order", async function () {
        const initialPrice = toBN(DECIMAL_PRECISION).mul(3);
        await priceFeed1.setPrice(initialPrice);

        const collateralisation1_1 = await trove1.collateralization();
        const collateralisation11_1 = await trove11.collateralization();
        const collateralisation12_1 = await trove12.collateralization();

        const bonqStaking = (await deployUUPSContract(sut.wallets[0], "BONQStaking", [sut.bonqToken.address], [])) as BONQStaking;

        await bonqStaking.setFactory(sut.troveFactory.address);
        await bonqStaking.setInitialLastFee(0);
        await sut.troveFactory.setFeeRecipient(bonqStaking.address);

        const redemptionAmount1 = toBN(amount); // '1000000000000000000'
        await sut.mintableTokenOwner.mint(await sut.wallets[4].getAddress(), redemptionAmount1.mul(2));
        const initalBeurBalance = await sut.stableCoin.balanceOf(sut.accounts[4]);
        const initalColBalance = await troveToken1.balanceOf(sut.accounts[4]);
        const maxRate = toBN(DECIMAL_PRECISION); // 5%
        const lastTroveTCR = await trove11.collateralization();
        const lastTroveHint = trove12.address;
        await sut.stableCoin.connect(sut.wallets[4]).approve(sut.troveFactory.address, ethers.constants.MaxInt256);

        const first_trove_order = await get_sorted_troves();

        let baseRate = await bonqStaking.baseRate();

        const realRedemptionAmount1 = await sut.troveFactory.getRedemptionAmount(await sut.troveFactory.getRedemptionFeeRatio(trove11.address), redemptionAmount1.div(500));
        const feeAmount1 = await sut.troveFactory.getRedemptionFee(await sut.troveFactory.getRedemptionFeeRatio(trove11.address), realRedemptionAmount1);
        expect(baseRate).to.equal(0);

        await sut.troveFactory.connect(sut.wallets[4]).redeemStableCoinForCollateral(troveToken1.address, redemptionAmount1.div(500), maxRate, lastTroveTCR, lastTroveHint);
        expect(await sut.stableCoin.balanceOf(bonqStaking.address)).to.be.closeTo(feeAmount1, feeAmount1.div(20)); // +-5%
        const baseRate2 = await bonqStaking.baseRate();
        expect(baseRate2).to.be.gt(baseRate);

        const trove_order2 = await get_sorted_troves();
        expect(first_trove_order[0]).to.be.equal(trove_order2[trove_order2.length - 1]);

        await expect(sut.troveFactory.connect(sut.wallets[4]).redeemStableCoinForCollateral(troveToken1.address, redemptionAmount1.div(200), maxRate, lastTroveTCR, lastTroveHint))
          .to.not.be.reverted;

        const baseRate3 = await bonqStaking.baseRate();
        expect(baseRate3).to.be.gt(baseRate2);

        const trove_order3 = await get_sorted_troves();
        expect(trove_order2[0]).to.be.equal(trove_order3[trove_order3.length - 1]);
        expect(first_trove_order[0]).to.be.equal(trove_order3[trove_order3.length - 2]);

        await expect(sut.troveFactory.connect(sut.wallets[4]).redeemStableCoinForCollateral(troveToken1.address, redemptionAmount1, maxRate, lastTroveTCR, lastTroveHint)).to.not.be
          .reverted;

        baseRate = await bonqStaking.baseRate();
        const decayed1 = await bonqStaking.calcDecayedBaseRate(baseRate);
        await sut.eth.provider.send("evm_increaseTime", [2048 * 4 * 60]); // 1 (but time shift when totalDeposits = 0 must be missed)
        await sut.eth.provider.send("evm_mine", []); // to create new block
        expect(await bonqStaking.calcDecayedBaseRate(baseRate)).to.be.lt(decayed1);
        const beurBalance1 = await sut.stableCoin.balanceOf(sut.accounts[4]);
        const colBalance1 = await troveToken1.balanceOf(sut.accounts[4]);
        const idealSwap = colBalance1.sub(initalColBalance).mul(initialPrice).div(DECIMAL_PRECISION);

        expect(initalBeurBalance.sub(beurBalance1)).to.be.closeTo(idealSwap, maxRate);
        const collateralisation1_2 = await trove1.collateralization();
        const collateralisation11_2 = await trove11.collateralization();
        const collateralisation12_2 = await trove12.collateralization();
        expect(collateralisation1_2).to.be.gt(collateralisation1_1);
        expect(collateralisation11_2).to.be.gt(collateralisation11_1);
        expect(collateralisation12_2).to.be.gt(collateralisation12_1);
      });

      after(async function () {
        await sut.troveFactory.setFeeRecipient(sut.testFeeRecipient.address);
      });
    });

    describe("redemption fee checking for beta=25 and alpha=0.056", function () {
      let troveToken1: TestMintableToken, priceFeed1: TestPriceFeed, communityLiquidationPool1: ILiquidationPool, bonqStaking: BONQStaking, trove1: Trove, trove11: Trove;

      beforeEach(async () => {
        troveToken1 = (await sut.deployContract(sut.wallets[0], "TestMintableToken", ["TroveToken1", "TT1"])) as TestMintableToken;
        await sut.arbitragePool.addToken(troveToken1.address);
        priceFeed1 = (await sut.deployContract(sut.wallets[0], "TestPriceFeed", [troveToken1.address])) as TestPriceFeed;

        await sut.tokenToPriceFeed.setTokenPriceFeed(troveToken1.address, priceFeed1.address, 120, 5000);

        communityLiquidationPool1 = (await sut.deployContract(sut.wallets[0], "CommunityLiquidationPool", [sut.troveFactory.address, troveToken1.address])) as ILiquidationPool;

        await sut.troveFactory.setLiquidationPool(troveToken1.address, communityLiquidationPool1.address);

        bonqStaking = (await deployUUPSContract(sut.wallets[0], "BONQStaking", [sut.bonqToken.address], [])) as BONQStaking;

        await bonqStaking.setFactory(sut.troveFactory.address);
        await bonqStaking.setInitialLastFee(0);
        await sut.troveFactory.setFeeRecipient(bonqStaking.address);

        trove1 = await sut.addTrove(sut.wallets[0], troveToken1.address);
        trove11 = await sut.addTrove(sut.wallets[0], troveToken1.address);
        // await priceFeed1.setPrice(DECIMAL_PRECISION.mul(2));
        // await trove1.connect(sut.wallets[0]).borrow(sut.accounts[0], toBN(amount), trove11.address);
        // await trove11.connect(sut.wallets[0]).borrow(sut.accounts[0], toBN(amount), trove12.address);
        // await trove12.connect(sut.wallets[1]).borrow(sut.accounts[0], toBN(amount), trove11.address);
      });

      it("Compound redemption with full redemptions:  ", async function () {
        const lastTroveHint = trove11.address;
        const redemptionAmount = DECIMAL_PRECISION.mul(6);
        const maxRate = DECIMAL_PRECISION.div(4); // 25% enough

        const borrowAmount1 = DECIMAL_PRECISION.mul(3);
        const redemptionAmount1 = DECIMAL_PRECISION.mul(3);
        const idealRate1 = DECIMAL_PRECISION.mul(113).div(10000); // 1.13%
        const idealFee1 = redemptionAmount1.mul(idealRate1).div(DECIMAL_PRECISION); // 0.5% enough

        const borrowAmount2 = DECIMAL_PRECISION.mul(3);
        const redemptionAmount2 = DECIMAL_PRECISION.mul(24 - 11).div(11);
        const idealRate2 = DECIMAL_PRECISION.mul(1709).div(10000); // 17.09$
        const idealFee2 = redemptionAmount2.mul(idealRate2).div(DECIMAL_PRECISION);

        const idealFee = idealFee1.add(idealFee2);

        await sut.stableCoin.approve(trove1.address, ethers.constants.MaxInt256);
        await sut.stableCoin.approve(trove11.address, ethers.constants.MaxInt256);

        // borrow and then repay the fee to have a round number
        await trove1.connect(sut.wallets[0]).borrow(sut.accounts[0], borrowAmount1, trove1.address);
        await trove1.repay((await trove1.debt()).sub(DECIMAL_PRECISION.mul(4)), trove1.address);

        // borrow and then repay the fee to have a round number
        await trove11.connect(sut.wallets[0]).borrow(sut.accounts[0], borrowAmount2, trove1.address);
        await trove11.repay((await trove11.debt()).sub(DECIMAL_PRECISION.mul(24).div(11)), trove11.address);

        await priceFeed1.setPrice(DECIMAL_PRECISION.mul(6)); // price = 6
        // TCR after => +- 1.5 and 2.75
        expect(await trove1.collateralization(), "150% CR").to.be.equal(DECIMAL_PRECISION.mul(150).div(100));
        expect(await trove11.collateralization(), "275% CR").to.be.equal(DECIMAL_PRECISION.mul(275).div(100));

        await sut.mintableTokenOwner.mint(await sut.wallets[4].getAddress(), DECIMAL_PRECISION.mul(10));
        await sut.stableCoin.connect(sut.wallets[4]).approve(sut.troveFactory.address, ethers.constants.MaxInt256);

        const TCR = await trove11.collateralization();
        const bonqStakingBal1 = await sut.stableCoin.balanceOf(bonqStaking.address);

        await sut.troveFactory.connect(sut.wallets[4]).redeemStableCoinForCollateral(troveToken1.address, redemptionAmount, maxRate, TCR, lastTroveHint);

        const bonqStakingBal2 = await sut.stableCoin.balanceOf(bonqStaking.address);
        expect(bonqStakingBal2.sub(bonqStakingBal1)).to.be.closeTo(idealFee, idealFee.div(100));
      });

      after(async function () {
        await sut.troveFactory.setFeeRecipient(sut.testFeeRecipient.address);
      });
    });

    it("can borrow the same amount for each trove", async function () {
      const troves: Trove[] = await addTroves();
      for (const trove of troves) {
        const owner = await trove.owner();
        const ownerWallet = sut.eth.provider.getSigner(owner);
        const lastTrove = await sut.troveFactory.lastTrove(sut.troveToken.address);
        await trove.connect(ownerWallet).borrow(owner, amount, lastTrove);
        await checkTroveList();
      }
    });

    function randBetween(min: number, max: number) {
      // min and max included
      return Math.floor(Math.random() * (max - min + 1) + min);
    }

    it("keeps a list of troves in order", async function () {
      this.timeout(1200000);

      await sut.mintableTokenOwner.mint(sut.accounts[0], toBN(amount).mul(1000000));

      const troves: Trove[] = [];
      // create troves with debt
      for (let i = 0; i <= toBN(process.env.LONG_LIST_SIZE).toNumber(); i++) {
        const ownerWallet = sut.wallets[i % sut.wallets.length];
        const trove = await sut.addTrove(ownerWallet);
        const randPct = toBN(100).add(randBetween(200, 400));
        await trove.connect(ownerWallet).borrow(await trove.owner(), toBN(amount).mul(randPct).div(100), trove.address);
        await sut.stableCoin.connect(sut.wallets[0]).approve(trove.address, await trove.MAX_INT());
        troves.push(trove);
      }

      //repay some of the debt
      for (const trove of troves) {
        const debt = await trove.debt();
        let amount = debt;
        if (randBetween(1, 10) != 5) {
          amount = debt.mul(toBN(randBetween(25, 75))).div(100);
        }
        await trove.connect(sut.wallets[0]).repay(amount, trove.address);
      }

      await checkTroveList();
    });
  });

  describe("reentrancy guard", function () {
    let arbitrageToken: MaliciousArbitrageToken;
    let arbitragePath: string[];
    let feesPath: number[];
    let testRouter: TestRouter;

    it.skip("prevents an attacker from manipulating the arbitrage pool balance", async function () {
      testRouter = (await sut.deployContract(sut.wallets[0], "TestRouter", [])) as TestRouter;
      arbitrageToken = (await sut.deployContract(sut.wallets[0], "MaliciousArbitrageToken", ["Malicious Arbitrage Token for Test", "MATFT"])) as MaliciousArbitrageToken;
      await (await sut.troveToken.mint(testRouter.address, sut.DECIMAL_PRECISION.mul("1000"))).wait();
      await (await arbitrageToken.mint(testRouter.address, sut.DECIMAL_PRECISION.mul("1000"))).wait();
      await sut.mintableTokenOwner.mint(testRouter.address, sut.DECIMAL_PRECISION.mul("1000"));

      arbitragePath = [sut.troveToken.address, sut.stableCoin.address, arbitrageToken.address, sut.troveToken.address];
      feesPath = [3000, 3000, 3000];

      sut.arbitragePool = (await deployUUPSContract(sut.wallets[0], "ArbitragePoolUniswap", [], [sut.troveFactory.address, testRouter.address])) as ArbitragePoolUniswap;
      await sut.troveFactory.setArbitragePool(sut.arbitragePool.address);
      await sut.arbitragePool.addToken(sut.troveToken.address);

      await (await arbitrageToken.setArbitrage(sut.arbitragePool.address, sut.troveToken.address, sut.apToken.address)).wait();

      expect(await sut.apToken.balanceOf(arbitrageToken.address)).to.equal("0");
      await expect(sut.arbitragePool.arbitrage(amount, arbitragePath, feesPath, 0)).to.be.revertedWith("ReentrancyGuard: reentrant call");
      expect(await sut.apToken.balanceOf(arbitrageToken.address)).to.equal("0");
    });
  });

  describe.skip("big arbitrage", function () {
    const base = sut.DECIMAL_PRECISION.mul("10000000"); // 10 Mio
    let arbitrageToken: TestMintableToken;
    let arbitragePath: string[];
    let feesPath: number[];

    beforeEach(async function () {
      arbitrageToken = (await sut.deployContract(sut.wallets[0], "TestMintableToken", ["Arbitrage Token for Test", "ATFT"])) as TestMintableToken;

      await sut.stableCoin.approve(sut.router.address, base.mul("1000"));
      await sut.troveToken.approve(sut.router.address, base.mul("1000"));
      await arbitrageToken.approve(sut.router.address, base.mul("1000"));

      await sut.mintableTokenOwner.mint(sut.accounts[0], base.mul("100"));
      await sut.mintableTokenOwner.mint(sut.accounts[1], base.mul("100"));
      await sut.mintableTokenOwner.mint(sut.accounts[2], base.mul("100"));
      await sut.mintableTokenOwner.mint(sut.accounts[3], base.mul("100"));
      await sut.mintableTokenOwner.mint(sut.accounts[4], base.mul("100"));
      await sut.troveToken.mint(sut.accounts[0], base.mul("150"));
      await sut.troveToken.mint(sut.accounts[1], base.mul("100"));
      await arbitrageToken.mint(sut.accounts[0], base.mul("100"));

      await sut.createPool(sut.troveToken, sut.stableCoin, toBN("5000000"));
      // make the arbitrageToken 2% cheaper than the stableCoin token when compared to troveToken
      await sut.createPool(sut.troveToken, arbitrageToken, toBN("250000").mul(1020).div(1000));
      await sut.createPool(sut.stableCoin, arbitrageToken, toBN("50000"));
      arbitragePath = [sut.troveToken.address, sut.stableCoin.address, arbitrageToken.address, sut.troveToken.address];
      feesPath = [3000, 3000, 3000];

      await sut.arbitragePool.batchApproveRouter([sut.troveToken.address]);
    });

    it.skip("2 users, 3 deposits, 3 rewards, 1 transfers, 1 withdraws", async function () {
      const troves_0 = await sut.addTrove(sut.wallets[0], sut.troveToken.address, false);
      const troves_1 = await sut.addTrove(sut.wallets[1], sut.troveToken.address, false);
      await sut.troveToken.connect(sut.wallets[0]).approve(troves_0.address, sut.DECIMAL_PRECISION.mul("100"));
      await troves_0.connect(sut.wallets[0]).increaseCollateral(sut.DECIMAL_PRECISION.mul("100"), troves_1.address);
      await sut.troveToken.connect(sut.wallets[1]).approve(troves_1.address, sut.DECIMAL_PRECISION.mul("100"));
      await troves_1.connect(sut.wallets[1]).increaseCollateral(sut.DECIMAL_PRECISION.mul("100"), troves_1.address);

      expect(await sut.troveToken.balanceOf(sut.arbitragePool.address)).to.be.equal(sut.DECIMAL_PRECISION.mul("200"));
      const arbitragePoolBalance = sut.DECIMAL_PRECISION.mul("200");
      expect((await sut.apToken.balanceOf(troves_0.address)).add(await sut.apToken.balanceOf(troves_1.address))).to.be.equal(sut.DECIMAL_PRECISION.mul("200"));
      // const amount = sut.DECIMAL_PRECISION.mul("10000");
      // const startBalance = await troveToken.balanceOf(sut.arbitragePool.address);
      await expect(sut.arbitragePool.arbitrage(sut.DECIMAL_PRECISION.mul("120"), arbitragePath, feesPath, 0))
        .to.emit(sut.arbitragePool, "Arbitrage")
        .withArgs(sut.troveToken.address, arbitragePath, sut.DECIMAL_PRECISION.mul("120"), "2017197824973862500");

      expect(await sut.troveToken.balanceOf(sut.arbitragePool.address)).to.be.equal(arbitragePoolBalance.add(BigNumber.from("2017197824973862500")));
      await troves_0.connect(sut.wallets[0]).decreaseCollateral(
        troves_1.address,
        sut.DECIMAL_PRECISION.mul("50")
          .mul(await sut.arbitragePool.getAPtokenPrice(sut.troveToken.address))
          .div(sut.DECIMAL_PRECISION),
        troves_1.address
      );
      // await sut.apToken.connect(sut.wallets[0]).transfer(accounts[1], sut.DECIMAL_PRECISION.mul("50"));
      expect(await sut.apToken.balanceOf(troves_0.address)).to.be.closeTo(sut.DECIMAL_PRECISION.mul("50"), 10);
      await troves_1.increaseCollateral(0, troves_0.address);
      expect(await sut.apToken.balanceOf(troves_1.address)).to.be.closeTo(sut.DECIMAL_PRECISION.mul("150"), 10);

      await expect(sut.arbitragePool.arbitrage(sut.DECIMAL_PRECISION.mul("185"), arbitragePath, feesPath, 0))
        .to.emit(sut.arbitragePool, "Arbitrage")
        .withArgs(sut.troveToken.address, arbitragePath, sut.DECIMAL_PRECISION.mul("185"), "3047268867106173665");

      expect(await sut.troveToken.balanceOf(sut.arbitragePool.address)).to.be.equal(
        arbitragePoolBalance.add(BigNumber.from("2017197824973862500")).add(BigNumber.from("3047268867106173665"))
      );

      const expectedPrice = sut.DECIMAL_PRECISION.mul("10253").div("10000"); // 1.253 +- 0.1%
      const actualPrice = await sut.arbitragePool.getAPtokenPrice(sut.troveToken.address);

      expect(actualPrice).to.be.closeTo(expectedPrice, expectedPrice.div(1000)); // 0.1% delta

      await expect(troves_1.decreaseCollateral(sut.accounts[1], actualPrice.mul(20), troves_0.address))
        .to.emit(sut.arbitragePool, "Withdraw")
        .withArgs(sut.troveToken.address, troves_1.address, actualPrice.mul(20), sut.DECIMAL_PRECISION.mul("20"));

      expect(await sut.arbitragePool.getAPtokenPrice(sut.troveToken.address)).to.be.closeTo(expectedPrice, expectedPrice.div(1000)); // 0.1% delta

      await sut.troveToken.connect(sut.wallets[0]).approve(troves_0.address, sut.DECIMAL_PRECISION.mul("50"));
      await troves_0.connect(sut.wallets[0]).increaseCollateral(sut.DECIMAL_PRECISION.mul("50"), troves_1.address);
      // await depositSPStake(0, sut.troveToken, sut.DECIMAL_PRECISION.mul("50"));

      expect(await sut.arbitragePool.getAPtokenPrice(sut.troveToken.address)).to.be.closeTo(expectedPrice, expectedPrice.div(1000)); // 0.1% delta

      await expect(sut.arbitragePool.arbitrage(sut.DECIMAL_PRECISION.mul("150"), arbitragePath, feesPath, 0))
        .to.emit(sut.arbitragePool, "Arbitrage")
        .withArgs(sut.troveToken.address, arbitragePath, sut.DECIMAL_PRECISION.mul("150"), "2415047912604767863");

      expect(await sut.troveToken.balanceOf(sut.arbitragePool.address)).to.be.equal(
        arbitragePoolBalance
          .sub(actualPrice.mul("20"))
          .add(sut.DECIMAL_PRECISION.mul("50"))
          .add(BigNumber.from("2017197824973862500"))
          .add(BigNumber.from("3047268867106173665"))
          .add(BigNumber.from("2415047912604767863"))
      );

      expect(await sut.apToken.balanceOf(troves_0.address)).to.be.equal(BigNumber.from("98765152545983327362")); // 98.7654..

      const endBalance = await sut.troveToken.balanceOf(sut.arbitragePool.address);
      const apTokenSupplyValue = (await sut.apToken.totalSupply()).mul(await sut.arbitragePool.getAPtokenPrice(sut.troveToken.address)).div(sut.DECIMAL_PRECISION);

      expect(endBalance).to.be.closeTo(apTokenSupplyValue, 1000); //  delta = 1000/(10^18)
    });
  });
});
