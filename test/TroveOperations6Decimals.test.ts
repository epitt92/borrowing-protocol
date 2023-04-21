// noinspection JSPotentiallyInvalidUsageOfThis

import { expect, use } from "chai";
import { solidity } from "ethereum-waffle";
import { BONQStaking, ILiquidationPool, MintableToken, TestMintableToken, TestPriceFeed, Trove, WETH } from "../src/types";
import { addressZero, DECIMAL_PRECISION, deployUUPSContract, getEventsFromReceipt, LIQUIDATION_RESERVE, toBN } from "./utils/helpers";
import { before, describe } from "mocha";

import { ethers } from "hardhat";
import { TroveFactoryTest } from "./utils/TroveFactoryTest";
import { BigNumber, Signer } from "ethers";
import JSON = Mocha.reporters.JSON;

use(solidity);

// Start test block
describe("Trove Operation", function () {
  this.timeout(50000);

  let OWNER_ROLE: string;
  let WETH: WETH;

  const sut = new TroveFactoryTest(ethers, 6);

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
    expect(await trove.TOKEN_PRECISION()).to.equal(toBN(10).pow(await sut.troveToken.decimals()));
    await expect(sut.mintableTokenOwner.connect(sut.wallets[0]).mint(trove.address, "100000000000000000000"))
      .to.emit(sut.stableCoin, "Transfer")
      .withArgs(addressZero, trove.address, "100000000000000000000");
  });

  describe("single trove", async function () {
    let trove: Trove;
    beforeEach(async function () {
      const amount = "1000000000000000000";
      await sut.mintableTokenOwner.mint(await sut.wallets[1].getAddress(), toBN(amount).mul(10));
    });

    describe("unfunded trove", async function () {
      beforeEach(async function () {
        trove = await sut.addTrove(sut.wallets[0], sut.troveToken.address, false);
        OWNER_ROLE = await trove.OWNER_ROLE();
      });

      it("when the trove owner transfers ownership, they lose access to the trove", async function () {
        const owner = await sut.wallets[0].getAddress();
        const newOwner = await sut.wallets[2].getAddress();
        await expect(trove.connect(sut.wallets[0]).transferOwnership(newOwner)).to.emit(trove, "OwnershipTransferred").withArgs(owner, newOwner);
        expect(await trove.hasRole(OWNER_ROLE, newOwner)).to.be.true;
        expect(await trove.hasRole(OWNER_ROLE, owner)).to.be.false;
      });

      it("when the trove owner transfers ownership, all owners except factory loose roles", async function () {
        const owner = await sut.wallets[0].getAddress();
        const newOwner = await sut.wallets[2].getAddress();

        const ownered_1 = await sut.wallets[3].getAddress();
        const ownered_2 = await sut.wallets[4].getAddress();
        const ownered_3 = await sut.wallets[5].getAddress();

        const owner_role_accs = [ownered_1, ownered_2, ownered_3];
        const OWNER_ROLE = await trove.OWNER_ROLE();
        for (const acc of owner_role_accs) {
          await expect(trove.connect(sut.wallets[0]).addOwner(acc)).to.emit(trove, "RoleGranted").withArgs(OWNER_ROLE, acc, owner);
        }
        expect(await trove.hasRole(OWNER_ROLE, newOwner)).to.be.false;
        expect(await trove.hasRole(OWNER_ROLE, owner)).to.be.true;
        expect(await trove.hasRole(OWNER_ROLE, sut.troveFactory.address)).to.be.true;
        for (const acc of owner_role_accs) {
          expect(await trove.hasRole(OWNER_ROLE, acc)).to.be.true;
        }

        await expect(trove.connect(sut.wallets[0]).transferOwnership(newOwner)).to.emit(trove, "OwnershipTransferred").withArgs(owner, newOwner);

        expect(await trove.hasRole(OWNER_ROLE, newOwner)).to.be.true;
        expect(await trove.hasRole(OWNER_ROLE, owner)).to.be.false;
        expect(await trove.hasRole(OWNER_ROLE, sut.troveFactory.address)).to.be.true;
        for (const acc of owner_role_accs) {
          expect(await trove.hasRole(OWNER_ROLE, acc)).to.be.false;
        }
      });

      it("the trove can be funded by transferring tokens directly to it", async function () {
        const collateralAmount = sut.defaultCollateral;
        await sut.troveToken.mint(await sut.wallets[2].getAddress(), collateralAmount);
        const increase = collateralAmount.div("2");
        {
          //trove collateral zero
          await sut.troveToken.connect(sut.wallets[2]).transfer(trove.address, increase);

          const troveCollateral = await trove.recordedCollateral();
          await expect(trove.connect(sut.wallets[3]).increaseCollateral(0, trove.address))
            .to.emit(sut.troveFactory, "CollateralUpdate")
            .withArgs(sut.troveToken.address, troveCollateral.add(increase));
        }
        {
          //increasing existing collateral
          await sut.troveToken.connect(sut.wallets[2]).transfer(trove.address, increase);

          const troveCollateral = await trove.recordedCollateral();
          await expect(trove.connect(sut.wallets[3]).increaseCollateral(0, trove.address))
            .to.emit(sut.troveFactory, "CollateralUpdate")
            .withArgs(sut.troveToken.address, troveCollateral.add(increase));
        }
      });
    });

    describe("funded trove", async function () {
      beforeEach(async function () {
        trove = await sut.addTrove();
        await trove.increaseCollateral("0", addressZero);
        OWNER_ROLE = await trove.OWNER_ROLE();
      });

      it("increased collateral in beforeeach", async function () {
        expect(await sut.troveFactory.totalCollateral(sut.troveToken.address)).to.equal(sut.defaultCollateral);
      });

      it("the trove owner can transfer some of the tokens from the trove to an arbitrary address", async function () {
        const amount = sut.defaultCollateral.div(2);
        expect(await trove.collateral()).to.equal(await sut.troveToken.balanceOf(trove.address));
        const totalCollateral = await sut.troveFactory.totalCollateral(sut.troveToken.address);

        await expect(trove.decreaseCollateral(await sut.wallets[1].getAddress(), amount, addressZero))
          .to.emit(sut.troveToken, "Transfer")
          .withArgs(trove.address, await sut.wallets[1].getAddress(), amount)
          .and.to.emit(sut.troveFactory, "CollateralUpdate")
          .withArgs(sut.troveToken.address, totalCollateral.sub(amount));
      });

      it("the trove owner can transfer the entire balance of a token which is not the collateral token to an arbitrary address", async function () {
        const amount = DECIMAL_PRECISION;
        const wrongToken = (await sut.deployContract(sut.wallets[0], "MintableToken", ["Just a token", "JAT"])) as MintableToken;
        await wrongToken.mint(trove.address, amount);
        await expect(trove.connect(sut.wallets[0]).transferToken(wrongToken.address, await sut.wallets[1].getAddress()))
          .to.emit(wrongToken, "Transfer")
          .withArgs(trove.address, await sut.wallets[1].getAddress(), amount);
        expect(await wrongToken.balanceOf(await sut.wallets[1].getAddress())).to.equal(amount);
      });

      it("the trove refuses to send the collateral if not called by the owner", async function () {
        const amount = sut.ONE;
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
        const amount = DECIMAL_PRECISION;
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
        const amount = DECIMAL_PRECISION;
        await expect(trove.connect(sut.wallets[1]).borrow(await sut.wallets[1].getAddress(), amount, trove.address)).to.be.revertedWith("cfa3b address is missing OWNER_ROLE");
      });

      it("the trove owner can not take out a loan that would lead to undercollateralisation", async function () {
        await expect(trove.connect(sut.wallets[0]).borrow(await sut.wallets[1].getAddress(), sut.ONE.mul(9), trove.address)).to.be.revertedWith("41670 TCR must be > MCR");
      });

      it("anyone can repay parts of a loan by allowing the trove to transfer from the user balance", async function () {
        const amount = DECIMAL_PRECISION;
        await trove.connect(sut.wallets[0]).borrow(await sut.wallets[1].getAddress(), amount, trove.address);
        await sut.stableCoin.connect(sut.wallets[1]).approve(trove.address, amount);
        const debt = await trove.debt();
        const repayAmount = amount.div(2);
        await expect(trove.connect(sut.wallets[1]).repay(repayAmount, trove.address))
          .to.emit(sut.stableCoin, "Transfer")
          .withArgs(await sut.wallets[1].getAddress(), trove.address, amount.div(2))
          .and.to.emit(sut.stableCoin, "Transfer")
          .withArgs(trove.address, "0x0000000000000000000000000000000000000000", amount.div(2));
        expect(await trove.debt()).to.equal(debt.sub(repayAmount));
      });

      it("anyone can repay entirety of a loan ", async function () {
        const amount = DECIMAL_PRECISION;
        await (await trove.connect(sut.wallets[0]).borrow(await sut.wallets[1].getAddress(), amount, trove.address)).wait();
        //trying to repay the liquidation reserve on purpose
        const repayAmount = amount.mul(1005).div(1000);
        await (await sut.stableCoin.connect(sut.wallets[1]).approve(trove.address, repayAmount)).wait();
        const tx = await ethers.provider.getTransactionReceipt((await trove.connect(sut.wallets[1]).repay(repayAmount, trove.address)).hash);
        const transfers = sut.getEventsFromReceipt(sut.stableCoin.interface, tx, "Transfer");
        expect(sut.findTransferEvent(transfers, trove.address, addressZero, repayAmount)).to.not.be.undefined;
        expect(sut.findTransferEvent(transfers, trove.address, addressZero, LIQUIDATION_RESERVE)).to.not.be.undefined;
        expect(sut.findTransferEvent(transfers, sut.accounts[1], trove.address, repayAmount)).to.not.be.undefined;
        expect(await trove.debt()).to.equal("0");
      });

      it("a loan is never repaid in excess of what is owed ", async function () {
        const amount = DECIMAL_PRECISION;
        await (await trove.connect(sut.wallets[0]).borrow(await sut.wallets[1].getAddress(), amount, trove.address)).wait();
        //trying to repay the liquidation reserve on purpose
        const repayAmount = await trove.debt();
        await (await sut.stableCoin.connect(sut.wallets[1]).approve(trove.address, repayAmount)).wait();
        const tx = await ethers.provider.getTransactionReceipt((await trove.connect(sut.wallets[1]).repay(repayAmount, trove.address)).hash);
        const transfers = sut.getEventsFromReceipt(sut.stableCoin.interface, tx, "Transfer");
        expect(sut.findTransferEvent(transfers, trove.address, addressZero, amount.mul(1005).div(1000))).to.not.be.undefined;
        expect(sut.findTransferEvent(transfers, trove.address, addressZero, LIQUIDATION_RESERVE)).to.not.be.undefined;
        expect(sut.findTransferEvent(transfers, sut.accounts[1], trove.address, amount.mul(1005).div(1000))).to.not.be.undefined;
        expect(await trove.debt()).to.equal("0");
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
            const amount = DECIMAL_PRECISION;
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

          it("the trove owner can transfer all of the tokens from the trove to an arbitrary address", async function () {
            const amount = await trove.collateral();
            expect(amount).to.equal(await sut.troveToken.balanceOf(trove.address));
            const totalCollateral = await sut.troveFactory.totalCollateral(sut.troveToken.address);

            await expect(trove.connect(bot).decreaseCollateral(await sut.wallets[1].getAddress(), amount, addressZero))
              .to.emit(sut.troveToken, "Transfer")
              .withArgs(trove.address, await sut.wallets[1].getAddress(), amount)
              .and.to.emit(sut.troveFactory, "CollateralUpdate")
              .withArgs(sut.troveToken.address, totalCollateral.sub(amount));
          });

          it("the bot can not borrow in excess of MCR", async function () {
            await expect(trove.connect(bot).borrow(await bot.getAddress(), sut.ONE.mul(9), trove.address)).to.be.revertedWith("41670 TCR must be > MCR");
          });

          it("the bot can transfer the entire balance of a token which is not the collateral token to an arbitrary address", async function () {
            const amount = DECIMAL_PRECISION;
            const wrongToken = (await sut.deployContract(sut.wallets[0], "MintableToken", ["Just a token", "JAT"])) as MintableToken;
            await wrongToken.mint(trove.address, amount);
            await expect(trove.connect(bot).transferToken(wrongToken.address, await sut.wallets[1].getAddress()))
              .to.emit(wrongToken, "Transfer")
              .withArgs(trove.address, await sut.wallets[1].getAddress(), amount);
            expect(await wrongToken.balanceOf(await sut.wallets[1].getAddress())).to.equal(amount);
          });
        });
      });
    });
  });

  describe("multiple troves - sorting", async function () {
    let troves: Trove[];
    const lastTroveIdx = 5;

    async function addTroves(): Promise<Trove[]> {
      // when the addTroves functionality resides in beforeEach, the tests fail
      const troves: Trove[] = [];
      for (let i = 0; i <= lastTroveIdx; i++) {
        const trove: Trove = await sut.addTrove(sut.wallets[i + 1]);
        troves.push(trove);
        await sut.mintableTokenOwner.mint(await sut.wallets[i + 1].getAddress(), DECIMAL_PRECISION);
      }
      return troves;
    }

    beforeEach(async function () {
      troves = await addTroves();
    });

    async function checkTroveList() {
      let trove = await sut.troveFactory.firstTrove(sut.troveToken.address);
      let prevCollateralisation = toBN("10");
      while (trove != (await sut.troveFactory.nextTrove(sut.troveToken.address, trove))) {
        const troveContract = (await sut.getContractAt("Trove", trove)) as Trove;
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
        await trove.connect(ownerWallet).borrow(owner, DECIMAL_PRECISION.mul(i++).div(10), firstTrove);
        await checkTroveList();
      }
    });

    it("can borrow 10% less for each trove", async function () {
      const amount = DECIMAL_PRECISION;
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
        await trove.connect(ownerWallet).borrow(owner, DECIMAL_PRECISION, lastTrove);
        await checkTroveList();
      }
    });

    it("keeps a list of troves in order", async function () {
      this.timeout(1200000);
      const amount = DECIMAL_PRECISION;

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
        trove1: Trove,
        trove11: Trove,
        trove2: Trove,
        trove21: Trove,
        trove3: Trove;

      beforeEach(async () => {
        [troveToken1, priceFeed1] = await sut.addTroveToken();
        [troveToken2, priceFeed2] = await sut.addTroveToken();
        [troveToken3, priceFeed3] = await sut.addTroveToken();

        await sut.addTrove(sut.wallets[0], troveToken1.address);
        await sut.addTrove(sut.wallets[0], troveToken2.address);
        await sut.addTrove(sut.wallets[0], troveToken3.address);

        trove1 = await sut.addTrove(sut.wallets[0], troveToken1.address);
        trove11 = await sut.addTrove(sut.wallets[0], troveToken1.address);
        trove2 = await sut.addTrove(sut.wallets[0], troveToken2.address);
        trove21 = await sut.addTrove(sut.wallets[0], troveToken2.address);
        trove3 = await sut.addTrove(sut.wallets[0], troveToken3.address);

        await trove1.connect(sut.wallets[0]).borrow(sut.accounts[0], DECIMAL_PRECISION.mul(5), trove11.address);
        await trove11.connect(sut.wallets[0]).borrow(sut.accounts[0], DECIMAL_PRECISION.mul(5), trove1.address);
        await trove2.connect(sut.wallets[0]).borrow(sut.accounts[0], DECIMAL_PRECISION.mul(5), trove2.address);
        await trove21.connect(sut.wallets[0]).borrow(sut.accounts[0], DECIMAL_PRECISION.mul(5), trove21.address);
        await trove3.connect(sut.wallets[0]).borrow(sut.accounts[0], DECIMAL_PRECISION.mul(5), trove3.address);

        await sut.stableCoin.connect(sut.wallets[0]).approve(trove1.address, await trove1.MAX_INT());
        await sut.stableCoin.connect(sut.wallets[0]).approve(trove11.address, await trove11.MAX_INT());
        await sut.stableCoin.connect(sut.wallets[0]).approve(trove2.address, await trove2.MAX_INT());
        await sut.stableCoin.connect(sut.wallets[0]).approve(trove21.address, await trove21.MAX_INT());
        await sut.stableCoin.connect(sut.wallets[0]).approve(trove3.address, await trove3.MAX_INT());
        await trove1.connect(sut.wallets[0]).repay(DECIMAL_PRECISION, addressZero);
        await trove11.connect(sut.wallets[0]).repay(DECIMAL_PRECISION, addressZero);
        await trove2.connect(sut.wallets[0]).repay(DECIMAL_PRECISION, addressZero);
        await trove21.connect(sut.wallets[0]).repay(DECIMAL_PRECISION, addressZero);
        await trove3.connect(sut.wallets[0]).repay(DECIMAL_PRECISION.mul(1025).div(1000), addressZero);

        await priceFeed1.setPrice(DECIMAL_PRECISION.mul("5025").div(1000));
        await priceFeed2.setPrice(DECIMAL_PRECISION.mul("5025").div(1000));
      });

      it("collateralisation of troves is correct", async function () {
        expect(await trove1.collateralization()).to.equal(DECIMAL_PRECISION);
        expect(await trove11.collateralization()).to.equal(DECIMAL_PRECISION);
        expect(await trove2.collateralization()).to.equal(DECIMAL_PRECISION);
        expect(await trove21.collateralization()).to.equal(DECIMAL_PRECISION);
        expect(await trove3.collateralization()).to.equal(DECIMAL_PRECISION.mul(2));
      });

      it("can liquidate a trove with below MCR collateral", async function () {
        const troves: Trove[] = await addTroves();
        const ownerWallet = sut.wallets[1];
        const owner = sut.accounts[1];
        const trove = troves[0];

        const amount = DECIMAL_PRECISION;
        await troves[1].connect(sut.wallets[2]).borrow(owner, amount, trove.address);
        await trove.connect(ownerWallet).borrow(owner, amount, trove.address);
        const liquidationPrice = (await trove.debt()).mul(await trove.mcr()).div((await trove.collateral()).mul(DECIMAL_PRECISION).div(sut.precision));
        await sut.priceFeed.setPrice(liquidationPrice.mul(100).div(101));

        const debt = await trove.debt();
        const collateral = await trove.collateral();
        await expect(trove.connect(ownerWallet).liquidate())
          .to.emit(trove, "Liquidated")
          .withArgs(trove.address, debt.sub(DECIMAL_PRECISION), collateral)
          .and.to.emit(sut.troveToken, "Transfer")
          .withArgs(trove.address, sut.liquidationPool.address, collateral)
          .and.to.emit(sut.stableCoin, "Approval")
          .withArgs(trove.address, owner, DECIMAL_PRECISION);

        await expect(sut.stableCoin.connect(ownerWallet).transferFrom(trove.address, owner, DECIMAL_PRECISION))
          .to.emit(sut.stableCoin, "Transfer")
          .withArgs(trove.address, owner, DECIMAL_PRECISION);

        expect(await sut.troveToken.balanceOf(sut.liquidationPool.address)).to.equal(collateral);
        expect(await trove.debt()).to.equal("0");
        expect(await trove.collateral()).to.equal("0");
      });

      it("can liquidate multiple troves with below MCR collateral", async function () {
        const ownerWallet = sut.wallets[0];
        const owner = sut.accounts[0];
        const troves = [trove11, trove1, trove2, trove21];
        let index = 0;

        for (const trove of troves) {
          const _troveToken: MintableToken = (await sut.getContractAt("MintableToken", await trove.token())) as MintableToken;
          const liquidationPool: string = await sut.troveFactory.liquidationPool(_troveToken.address);
          const debt = await trove.debt();
          const collateral = await trove.collateral();

          await expect(trove.connect(ownerWallet).liquidate())
            .to.emit(trove, "Liquidated")
            .withArgs(trove.address, debt.sub(DECIMAL_PRECISION), collateral)
            .and.to.emit(_troveToken, "Transfer")
            .withArgs(trove.address, liquidationPool, collateral)
            .and.to.emit(sut.stableCoin, "Approval")
            .withArgs(trove.address, owner, DECIMAL_PRECISION);

          // await checkTroves(await trove.token())

          await expect(sut.stableCoin.connect(ownerWallet).transferFrom(trove.address, owner, DECIMAL_PRECISION))
            .to.emit(sut.stableCoin, "Transfer")
            .withArgs(trove.address, owner, DECIMAL_PRECISION);

          // the balance of the liquidation pool does not increase because the trove to be liquidated has withdrawn
          // expect(await _sut.troveToken.balanceOf(liquidationPool)).to.equal(collateral)
          expect(await trove.debt()).to.equal("0");
          expect(await trove.collateral()).to.equal("0");
          index += 1;
        }
        for (const trove of troves) {
          expect(await trove.debt()).to.equal("0");
          expect(await trove.collateral()).to.equal("0");
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
        const liquidationPrice = (await trove.debt()).mul(await trove.mcr()).div((await trove.collateral()).mul(DECIMAL_PRECISION).div(sut.precision));
        await priceFeed1.setPrice(liquidationPrice.mul(100).div(101));
        await expect(trove.connect(sut.wallets[0]).liquidate()).to.be.revertedWith("c0e35 the last trove can not be liquidated");
      });
    });

    describe("trove redemption", function () {
      let troveToken1: TestMintableToken, priceFeed1: TestPriceFeed, trove1: Trove, trove11: Trove, trove12: Trove;

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
        const amount = DECIMAL_PRECISION;

        [troveToken1, priceFeed1] = await sut.addTroveToken();

        trove1 = await sut.addTrove(sut.wallets[0], troveToken1.address);
        trove11 = await sut.addTrove(sut.wallets[0], troveToken1.address);
        trove12 = await sut.addTrove(sut.wallets[1], troveToken1.address);
        await priceFeed1.setPrice(DECIMAL_PRECISION.mul(4)); // TCR = ~200% as the debt is 1BEUR + 1BEUR liquidation reserve
        await trove1.connect(sut.wallets[0]).borrow(sut.accounts[0], toBN(amount), trove11.address);
        await trove11.connect(sut.wallets[0]).borrow(sut.accounts[0], toBN(amount), trove12.address);
        await trove12.connect(sut.wallets[1]).borrow(sut.accounts[0], toBN(amount), trove11.address);
      });

      it("can not redeem with bad TCR or bad fee rate", async function () {
        const redemptionAmount1 = DECIMAL_PRECISION;
        await sut.mintableTokenOwner.mint(await sut.wallets[4].getAddress(), redemptionAmount1.mul(2));
        const maxRate = toBN(DECIMAL_PRECISION).div(20); // 5%
        const lastTroveTCR = await trove11.collateralization();
        const lastTroveHint = trove12.address;

        await expect(
          sut.troveFactory.connect(sut.wallets[4]).redeemStableCoinForCollateral(troveToken1.address, redemptionAmount1, maxRate, lastTroveTCR, lastTroveHint)
        ).to.be.revertedWith("a7f99 StableCoin is not approved for factory");

        await sut.stableCoin.connect(sut.wallets[4]).approve(sut.troveFactory.address, ethers.constants.MaxInt256);
        await expect(sut.troveFactory.connect(sut.wallets[4]).redeemStableCoinForCollateral(troveToken1.address, redemptionAmount1, maxRate.div(50), lastTroveTCR, lastTroveHint))
          .to.not.be.reverted;

        const bonqStaking = (await deployUUPSContract(sut.wallets[0], "BONQStaking", [sut.bonqToken.address], [])) as BONQStaking;

        await bonqStaking.setFactory(sut.troveFactory.address);
        await bonqStaking.setInitialLastFee(0);
        await sut.troveFactory.setFeeRecipient(bonqStaking.address);

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
        const redemptionAmount1 = DECIMAL_PRECISION.mul(3);
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
        const tx = await (
          await sut.troveFactory.connect(sut.wallets[4]).redeemStableCoinForCollateral(troveToken1.address, redemptionAmount1, maxRate, lastTroveTCR, lastTroveHint)
        ).wait();
        const redemption = getEventsFromReceipt(sut.troveFactory.interface, tx, "Redemption")[0];
        expect(redemption.args.token).to.equal(troveToken1.address);
        expect(redemption.args.stableAmount).to.equal(expectedStableCoinRedeemed);
        expect(redemption.args.tokenAmount).to.equal(expectedStableCoinRedeemed.div(3).mul(sut.precision).div(DECIMAL_PRECISION));
        expect(redemption.args.stableUnspent).to.equal(1);
        expect(redemption.args.startBaseRate).to.equal(startBaseRate);
        expect(redemption.args.finishBaseRate).to.equal(calculatedFinishBaseRate);
        expect(redemption.args.lastTroveRedeemed).to.equal(lastTroveHint);

        const beurBalance1 = await sut.stableCoin.balanceOf(sut.accounts[4]);
        const colBalance1 = await troveToken1.balanceOf(sut.accounts[4]);
        const idealSwap = colBalance1.sub(initalColBalance).mul(initialPrice).div(sut.precision);

        expect(initalBeurBalance.sub(beurBalance1)).to.be.closeTo(idealSwap, DECIMAL_PRECISION.div(8));
        expect(idealSwap).to.be.below(redemptionAmount1);
      });

      it("fees are decayed, paid, and with right order", async function () {
        const amount = DECIMAL_PRECISION;
        const initialPrice = toBN(DECIMAL_PRECISION).mul(3);
        await priceFeed1.setPrice(initialPrice);

        const collateralisation1_1 = await trove1.collateralization();
        const collateralisation11_1 = await trove11.collateralization();
        const collateralisation12_1 = await trove12.collateralization();

        const bonqStaking = (await deployUUPSContract(sut.wallets[0], "BONQStaking", [sut.bonqToken.address], [])) as BONQStaking;

        await bonqStaking.setFactory(sut.troveFactory.address);
        await bonqStaking.setInitialLastFee(0);
        await sut.troveFactory.setFeeRecipient(bonqStaking.address);

        const redemptionAmount1 = amount;
        await sut.mintableTokenOwner.mint(await sut.wallets[4].getAddress(), redemptionAmount1.mul(2));
        const initalBeurBalance = await sut.stableCoin.balanceOf(sut.accounts[4]);
        const initalColBalance = await troveToken1.balanceOf(sut.accounts[4]);
        const maxRate = toBN(DECIMAL_PRECISION); // 5%
        const lastTroveTCR = await trove11.collateralization();
        const lastTroveHint = trove12.address;
        await sut.stableCoin.connect(sut.wallets[4]).approve(sut.troveFactory.address, ethers.constants.MaxInt256);

        const first_trove_order = await get_sorted_troves();

        let baseRate = await bonqStaking.baseRate();

        const CR1 = await trove11.collateralization();

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
        const idealSwap = colBalance1.sub(initalColBalance).mul(initialPrice).div(sut.precision);

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
      let troveToken1: TestMintableToken, priceFeed1: TestPriceFeed, bonqStaking: BONQStaking, trove1: Trove, trove11: Trove, trove12: Trove;

      beforeEach(async () => {
        [troveToken1, priceFeed1] = await sut.addTroveToken();

        bonqStaking = (await deployUUPSContract(sut.wallets[0], "BONQStaking", [sut.bonqToken.address], [])) as BONQStaking;

        await bonqStaking.setFactory(sut.troveFactory.address);
        await bonqStaking.setInitialLastFee(0);
        await sut.troveFactory.setFeeRecipient(bonqStaking.address);

        trove1 = await sut.addTrove(sut.wallets[0], troveToken1.address);
        // await trove1.decreaseCollateral(sut.accounts[9], sut.defaultCollateral.sub(DECIMAL_PRECISION), addressZero);
        trove11 = await sut.addTrove(sut.wallets[0], troveToken1.address);
        // await trove11.decreaseCollateral(sut.accounts[9], sut.defaultCollateral.sub(DECIMAL_PRECISION), addressZero);
        trove12 = await sut.addTrove(sut.wallets[1], troveToken1.address);
        // await trove12.decreaseCollateral(sut.accounts[9], sut.defaultCollateral.sub(DECIMAL_PRECISION), addressZero);

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
        const idealRate2 = DECIMAL_PRECISION.mul(1709).div(10000); // 17.09%
        const idealFee2 = redemptionAmount2.mul(idealRate2).div(DECIMAL_PRECISION);

        const idealFee = idealFee1.add(idealFee2);
        await sut.stableCoin.approve(trove1.address, ethers.constants.MaxInt256);
        await sut.stableCoin.approve(trove11.address, ethers.constants.MaxInt256);

        // borrow and then repay the fee to have a round number
        await trove1.borrow(sut.accounts[0], borrowAmount1, trove1.address);
        await trove1.repay((await trove1.debt()).sub(DECIMAL_PRECISION.mul(4)), trove1.address);

        // borrow and then repay the fee to have a round number
        await trove11.borrow(sut.accounts[0], borrowAmount2, trove1.address);
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

    function randBetween(min: number, max: number) {
      // min and max included
      return Math.floor(Math.random() * (max - min + 1) + min);
    }

    it("keeps a list of troves in order", async function () {
      this.timeout(1200000);
      const amount = DECIMAL_PRECISION;

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
});
