import { expect } from "chai";

import { OriginalTroveFactory, Trove } from "../src/types";
import { Contract, ContractReceipt, ContractTransaction } from "ethers";

import { ethers } from "hardhat";
import { before, describe } from "mocha";
import { TroveFactoryTest } from "./utils/TroveFactoryTest";
import { upgradeUUPSContract } from "./utils/helpers";

// Start test block
describe("LiquidatinoProtection", function () {
  this.timeout(60000);
  const sut = new TroveFactoryTest(ethers);

  before(async function () {
    await sut.ready;
  });

  describe("deployment", function () {
    it("can create a TroveFactory contract", async function () {
      expect(await sut.setup()).to.be.true;
    });
  });

  describe("deployed", function () {
    beforeEach(async function () {
      expect(await sut.setup()).to.be.true;
    });

    // Test case
    it("has address 0 as owner", async function () {
      expect((await sut.troveFactory.owner()).toString()).to.equal(sut.accounts[0]);
      expect((await sut.troveFactory.name()).toString()).to.equal("Original Factory");
    });

    it("does not allow a non trove to call insertTrove", async function () {
      await expect(sut.troveFactory.connect(sut.wallets[1]).insertTrove(sut.troveToken.address, sut.accounts[1])).to.be.revertedWith(
        "f9fac the trove has not been created by the factory"
      );
    });

    it("insertTrove with zero-address", async function () {
      await expect(sut.troveFactory.connect(sut.wallets[1]).insertTrove(sut.troveToken.address, ethers.constants.AddressZero)).to.be.revertedWith(
        "f9fac the trove has not been created by the factory"
      );
    });

    it("has a working price feeds list", async function () {
      expect(await sut.tokenToPriceFeed?.tokenPriceFeed(sut.troveToken.address)).to.equal(sut.priceFeed?.address);
    });

    it("deploys a trove and logs the event correctly", async function () {
      const tx: ContractTransaction = await sut.troveFactory.connect(sut.wallets[0]).createTrove(sut.troveToken.address);
      const receipt: ContractReceipt = await tx.wait();
      // @ts-ignore
      const { trove: troveAddress, owner } = receipt.events.filter((x) => {
        return x.event == "NewTrove";
      })[0].args;
      const newMinter = sut.getEventsFromReceipt(sut.mintableTokenOwner.interface, receipt, "MinterAdded")[0].args.newMinter;
      expect(troveAddress).to.not.be.undefined;
      expect(owner).to.equal(sut.accounts[0]);
      expect(newMinter).to.equal(troveAddress);
    });

    it("creates a trove with msg.sender as owner", async function () {
      const trove = await sut.addTrove();
      expect((await trove.owner()).toString()).to.equal(sut.accounts[0]);
      expect(await sut.troveFactory.lastTrove(sut.troveToken.address)).to.equal(trove.address);
      expect(await sut.troveFactory.containsTrove(sut.troveToken.address, trove.address)).to.be.true;
      expect(await trove.factory()).to.equal(sut.troveFactory.address);
    });

    it("can still create troves after the initialise function is called on the troveImplementation", async function () {
      const implementation = (await sut.getContractAt("Trove", await sut.troveFactory.troveImplementation(), sut.wallets[0])) as Trove;
      await implementation.initialize(sut.troveToken.address, sut.accounts[5]);
      await expect(implementation.initialize(sut.troveToken.address, sut.accounts[5])).to.be.revertedWith("Initializable: contract is already initialized");

      const trove = await sut.addTrove();
      expect((await trove.owner()).toString()).to.equal(sut.accounts[0]);
      expect(await sut.troveFactory.lastTrove(sut.troveToken.address)).to.equal(trove.address);
      expect(await sut.troveFactory.containsTrove(sut.troveToken.address, trove.address)).to.be.true;
      expect(await trove.factory()).to.equal(sut.troveFactory.address);
    });

    it("deploys a pre-configured trove and logs the events correctly", async function () {
      // add an empty trove so that insertTrove is called when the preconfigured trove is created
      await sut.addTrove();
      const depositAmount = sut.DECIMAL_PRECISION.mul(10);
      const borrowAmount = sut.DECIMAL_PRECISION;
      await sut.troveToken.connect(sut.wallets[0]).mint(sut.accounts[0], depositAmount);
      await sut.troveToken.connect(sut.wallets[0]).approve(sut.troveFactory.address, depositAmount);
      const tx: ContractTransaction = await sut.troveFactory
        .connect(sut.wallets[0])
        .createTroveAndBorrow(sut.troveToken.address, depositAmount, sut.accounts[0], borrowAmount, ethers.constants.AddressZero);
      const receipt: ContractReceipt = await tx.wait();
      // @ts-ignore
      const troveAddress = receipt.events.filter((x) => {
        return x.event == "NewTrove";
      })[0].args.trove;
      // @ts-ignore
      const owner = receipt.events.filter((x) => {
        return x.event == "NewTrove";
      })[0].args.owner;
      expect(troveAddress).to.not.be.undefined;
      expect(owner).to.equal(sut.accounts[0]);
      const trove = (await sut.getContractAt("Trove", troveAddress)) as Trove;
      expect((await trove.owner()).toString()).to.equal(sut.accounts[0]);
      expect(await sut.troveFactory.firstTrove(sut.troveToken.address)).to.equal(trove.address);
      expect(await sut.troveFactory.containsTrove(sut.troveToken.address, trove.address)).to.be.true;
      expect(await trove.factory()).to.equal(sut.troveFactory.address);

      // @ts-ignore
      const troveCollateralUpdate = receipt.events.filter((x) => {
        return x.event == "TroveCollateralUpdate";
      })[0].args;

      expect(troveCollateralUpdate?.trove).to.equal(troveAddress);
      expect(troveCollateralUpdate?.token).to.equal(sut.troveToken.address);
      expect(troveCollateralUpdate?.newAmount).to.equal(depositAmount);

      // @ts-ignore
      const troveDebtUpdate = receipt.events.filter((x) => {
        return x.event == "TroveDebtUpdate";
      })[0].args;

      expect(troveDebtUpdate?.trove).to.equal(troveAddress);
      expect(troveDebtUpdate?.token).to.equal(sut.troveToken.address);
      expect(troveDebtUpdate?.actor).to.equal(sut.accounts[0]);
      expect(troveDebtUpdate?.newAmount).to.equal(borrowAmount.add(borrowAmount).add(troveDebtUpdate?.feePaid));
    });

    describe("trove management", function () {
      let troves: Trove[];
      const lastTroveIdx = 4;

      async function addTroves(): Promise<Trove[]> {
        const troves: Trove[] = [];
        for (let i = 0; i < lastTroveIdx + 1; i++) {
          troves.push(await sut.addTrove());
        }
        return troves;
      }

      beforeEach(async function () {
        troves = await addTroves();
      });

      it("enables iterating through the troves in the factory", async function () {
        expect(await sut.troveFactory.lastTrove(sut.troveToken.address)).to.equal(troves[lastTroveIdx].address);
        let trove = await sut.troveFactory.firstTrove(sut.troveToken.address);
        for (let i = 0; i <= lastTroveIdx; i++) {
          expect(trove).to.equal(troves[i].address);
          trove = await sut.troveFactory.nextTrove(sut.troveToken.address, trove);
        }

        trove = await sut.troveFactory.lastTrove(sut.troveToken.address);
        for (let i = lastTroveIdx; i >= 0; i--) {
          expect(trove).to.equal(troves[i].address);
          trove = await sut.troveFactory.prevTrove(sut.troveToken.address, trove);
        }
      });

      it("allows the owner to remove their trove", async function () {
        await expect(sut.troveFactory.connect(sut.wallets[0]).removeTrove(sut.troveToken.address, troves[1].address))
          .to.emit(sut.troveFactory, "TroveRemoved")
          .withArgs(troves[1].address);
        expect(await sut.troveFactory.containsTrove(sut.troveToken.address, troves[1].address)).to.be.false;
      });

      it("fails if a non owner tries to remove the trove", async function () {
        await expect(sut.troveFactory.connect(sut.wallets[1]).removeTrove(sut.troveToken.address, troves[1].address)).to.be.revertedWith(
          "173fa only the owner can remove the trove from the list"
        );
      });
    });

    it("trovefactory can be replaced with a new version", async function () {
      const firstTrove = await sut.troveFactory.firstTrove(sut.troveToken.address);

      sut.troveFactory = (await upgradeUUPSContract(sut.troveFactory as Contract, sut.wallets[0], "ReplacementTroveFactory", [])) as OriginalTroveFactory;

      expect((await sut.troveFactory.name()).toString()).to.equal("Replacement Factory");
      expect(firstTrove).to.equal(await sut.troveFactory.firstTrove(sut.troveToken.address));
      await expect(sut.addTrove()).not.to.be.reverted;
    });
  });
});
