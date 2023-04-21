import { expect } from "chai";
import { before, describe } from "mocha";
import { BigNumber, ContractReceipt, ContractTransaction } from "ethers";
import { ethers } from "hardhat";
import { ServiceFeeGenerator, Trove } from "../src/types";
import { TroveFactoryTest } from "./utils/TroveFactoryTest";

// Start test block
describe("ServiceFeeGenerator", function () {
  this.timeout(10000);
  const sut = new TroveFactoryTest(ethers);

  before(async function () {
    await sut.ready;
  });

  describe("configuration of TroveFactory with serviceFeeImplementation", function () {
    it("can create a TroveFactory and setServiceFeeImplementation", async function () {
      expect(await sut.setup()).to.be.true;
      const serviceFeeImplementation = (await sut.deployContract(sut.wallets[0], "ServiceFeeGenerator", [sut.troveFactory.address])) as Trove;
      await expect(sut.troveFactory.setServiceFeeImplementation(serviceFeeImplementation.address))
        .to.emit(sut.troveFactory, "ServiceFeeImplementationSet")
        .withArgs(ethers.constants.AddressZero, serviceFeeImplementation.address);
      expect(await sut.troveFactory.serviceFeeImplementation()).to.equal(serviceFeeImplementation.address);
    });
  });

  describe("with implementation set and trove created", function () {
    let serviceFeeImplementation: ServiceFeeGenerator, trove: Trove;

    const createAndBorrowWithSUT = async (sutParam: TroveFactoryTest, depositAmount: BigNumber, borrowAmount: BigNumber): Promise<Trove> => {
      await sutParam.troveToken.connect(sutParam.wallets[0]).mint(sutParam.accounts[0], depositAmount);
      await sutParam.troveToken.connect(sutParam.wallets[0]).approve(sutParam.troveFactory.address, depositAmount);
      const tx: ContractTransaction = await sutParam.troveFactory
        .connect(sutParam.wallets[0])
        .createTroveAndBorrow(sutParam.troveToken.address, depositAmount, sutParam.accounts[0], borrowAmount, ethers.constants.AddressZero);
      const receipt: ContractReceipt = await tx.wait();
      // @ts-ignore
      const troveAddress = receipt.events.filter((x) => {
        return x.event == "NewTrove";
      })[0].args.trove;

      const trove = (await sutParam.getContractAt("Trove", troveAddress)) as Trove;
      return trove;
    };

    beforeEach(async function () {
      expect(await sut.setup()).to.be.true;
      serviceFeeImplementation = (await sut.deployContract(sut.wallets[0], "ServiceFeeGenerator", [sut.troveFactory.address])) as ServiceFeeGenerator;
      await sut.troveFactory.setServiceFeeImplementation(serviceFeeImplementation.address);

      expect(await sut.troveFactory.serviceFeeImplementation()).to.equal(serviceFeeImplementation.address);
      // creating trove with CR = 49875311720698254364
      await sut.addTrove();
      const depositAmount = sut.DECIMAL_PRECISION.mul(10);
      const borrowAmount = sut.DECIMAL_PRECISION;
      trove = await createAndBorrowWithSUT(sut, depositAmount, borrowAmount);
    });

    it("reverts creating serviceFee with invalid trove/signer", async function () {
      const feeAmount = sut.DECIMAL_PRECISION;
      const feeInterval = 60 * 60 * 1; // 1h

      // reverts without factory ownership
      await trove.removeOwner(sut.troveFactory.address);
      await expect(sut.troveFactory.connect(sut.wallets[0]).createNewServiceFee(trove.address, feeAmount, feeInterval)).to.be.revertedWith("cfa3b address is missing OWNER_ROLE");

      // fake the troveFactory
      const fakeSUT = new TroveFactoryTest(ethers);
      await fakeSUT.ready;
      expect(await fakeSUT.setup()).to.be.true;
      await fakeSUT.troveFactory.setServiceFeeImplementation(serviceFeeImplementation.address);
      await fakeSUT.addTrove();

      // crating trove from fakeFactory
      const depositAmount = sut.DECIMAL_PRECISION.mul(10);
      const borrowAmount = sut.DECIMAL_PRECISION;
      const fakeTrove = await createAndBorrowWithSUT(fakeSUT, depositAmount, borrowAmount);

      await expect(sut.troveFactory.connect(sut.wallets[0]).createNewServiceFee(fakeTrove.address, feeAmount, feeInterval)).to.be.revertedWith("daa708 not a valid trove");

      // reverts without signer ownership
      await expect(sut.troveFactory.connect(sut.wallets[1]).createNewServiceFee(trove.address, feeAmount, feeInterval)).to.be.revertedWith("daa708 msg.sender must be trove owner");
    });

    it("trove owner can create a serviceFee with valid args", async function () {
      const feeAmount = sut.DECIMAL_PRECISION;
      const feeInterval = 60 * 60 * 1; // 1h

      const tx: ContractTransaction = await sut.troveFactory.connect(sut.wallets[0]).createNewServiceFee(trove.address, feeAmount, feeInterval);
      const receipt: ContractReceipt = await tx.wait();

      const serviceFeeAddress = sut.getEventsFromReceipt(sut.troveFactory.interface, receipt, "NewServiceFee")[0].args.serviceFee;

      const serviceFee = (await sut.getContractAt("ServiceFeeGenerator", serviceFeeAddress)) as ServiceFeeGenerator;
      expect(await serviceFee.initialized()).to.be.true;
      expect(await serviceFee.feeRecipient()).to.equal(sut.testFeeRecipient.address);
      expect(await serviceFee.feeAmount()).to.equal(feeAmount);
      expect(await serviceFee.feeInterval()).to.equal(feeInterval);
      expect(await serviceFee.trove()).to.equal(trove.address);
      expect(await sut.stableCoin.allowance(serviceFee.address, sut.testFeeRecipient.address)).to.equal(sut.eth.constants.MaxUint256);
    });

    it("reject on fee less then minimal borrow", async function () {
      const feeAmount = sut.DECIMAL_PRECISION.sub(1);
      const feeInterval = 60 * 60 * 1; // 1h

      await expect(sut.troveFactory.connect(sut.wallets[0]).createNewServiceFee(trove.address, feeAmount, feeInterval)).to.be.revertedWith("da69e0 fee amount must be gte 1 BEUR");
    });

    describe("with serviceFee deployed", function () {
      const feeAmount = sut.DECIMAL_PRECISION;
      const feeInterval = 60 * 60 * 1; // 1h
      let serviceFee: ServiceFeeGenerator;
      let serviceFeeBlock = 0;
      let startTime = 0;

      beforeEach(async function () {
        const tx: ContractTransaction = await sut.troveFactory.connect(sut.wallets[0]).createNewServiceFee(trove.address, feeAmount, feeInterval);
        const receipt: ContractReceipt = await tx.wait();
        serviceFeeBlock = tx.blockNumber || 0;
        // @ts-ignore
        const serviceFeeAddress = receipt.events.filter((x) => {
          return x.event == "NewServiceFee";
        })[0].args.serviceFee;

        serviceFee = (await sut.getContractAt("ServiceFeeGenerator", serviceFeeAddress)) as ServiceFeeGenerator;
        startTime = (await serviceFee.lastPayTime()).toNumber();
      });

      it("serviceFee can not be reinitialized", async function () {
        await expect(serviceFee.initialize(trove.address, feeAmount, feeInterval)).to.be.revertedWith("");
      });

      it("the fee set is taken only one time per interval", async function () {
        const feeRecipientBalance = await sut.stableCoin.balanceOf(sut.testFeeRecipient.address);

        expect(await serviceFee.lastPayTime()).to.equal(startTime);
        expect(await serviceFee.isPaid()).to.be.false;

        // check event emitting
        await expect(serviceFee.withdrawFee(sut.eth.constants.AddressZero))
          .to.emit(serviceFee, "FeeCollected")
          .withArgs(startTime, startTime + feeInterval);

        // check fee balance change
        const feeRecipientBalance1 = await sut.stableCoin.balanceOf(sut.testFeeRecipient.address);
        expect(feeRecipientBalance1).to.be.equal(feeRecipientBalance.add(feeAmount.mul(1005).div(1000)));

        const payTime1 = (await sut.eth.provider.getBlock(await sut.eth.provider.getBlockNumber())).timestamp;
        expect(await serviceFee.lastPayTime()).to.be.within(startTime, payTime1);
        expect(await serviceFee.isPaid()).to.be.true;
        await expect(serviceFee.withdrawFee(sut.eth.constants.AddressZero)).to.be.revertedWith("c93e1f fee is paid for current period");

        await sut.increaseTime(feeInterval / 2);

        expect(await serviceFee.lastPayTime()).to.be.within(startTime, payTime1);
        expect(await serviceFee.isPaid()).to.be.true;
        await expect(serviceFee.withdrawFee(sut.eth.constants.AddressZero)).to.be.revertedWith("c93e1f fee is paid for current period");

        await sut.increaseTime(feeInterval / 2);

        expect(await serviceFee.lastPayTime()).to.be.within(startTime, payTime1);
        expect(await serviceFee.isPaid()).to.be.false;
        await expect(serviceFee.withdrawFee(sut.eth.constants.AddressZero)).to.emit(serviceFee, "FeeCollected");

        // check fee balance change
        const feeRecipientBalance2 = await sut.stableCoin.balanceOf(sut.testFeeRecipient.address);
        expect(feeRecipientBalance2).to.be.closeTo(
          feeRecipientBalance1.add(feeAmount),
          feeAmount.div(20) // 5% to skip borrow fee
        );
        const lpTime = await serviceFee.lastPayTime();
        expect(lpTime).to.be.within(payTime1, payTime1 + feeInterval);
        expect(await serviceFee.isPaid()).to.be.true;
        await expect(serviceFee.withdrawFee(sut.eth.constants.AddressZero)).to.be.revertedWith("c93e1f fee is paid for current period");
        await sut.increaseTime(3 * feeInterval);
        // now need to pay three times to have getPaid true
        expect(await serviceFee.lastPayTime()).to.equal(lpTime);
        expect(await serviceFee.isPaid()).to.be.false;
        await expect(serviceFee.withdrawFee(sut.eth.constants.AddressZero)).to.emit(serviceFee, "FeeCollected");

        expect(await serviceFee.lastPayTime()).to.equal(lpTime.add(feeInterval));
        expect(await serviceFee.isPaid()).to.be.false;

        await expect(serviceFee.withdrawFee(sut.eth.constants.AddressZero)).to.emit(serviceFee, "FeeCollected");
        expect(await serviceFee.lastPayTime()).to.equal(lpTime.add(feeInterval).add(feeInterval));
        expect(await serviceFee.isPaid()).to.be.false;

        await expect(serviceFee.withdrawFee(sut.eth.constants.AddressZero)).to.emit(serviceFee, "FeeCollected");
        expect(await serviceFee.lastPayTime()).to.be.equal(lpTime.add(feeInterval).add(feeInterval).add(feeInterval));
        expect(await serviceFee.isPaid()).to.be.true;

        const feeRecipientBalance3 = await sut.stableCoin.balanceOf(sut.testFeeRecipient.address);
        expect(feeRecipientBalance3).to.be.closeTo(
          feeRecipientBalance2.add(feeAmount.mul(3)),
          feeAmount.mul(3).div(20) // 5% to skip borrow fee
        );

        await expect(serviceFee.withdrawFee(sut.eth.constants.AddressZero)).to.be.revertedWith("c93e1f fee is paid for current period");
      });

      it("troveOwner can deactivate serviceFee by revoking the role", async function () {
        await trove.removeOwner(serviceFee.address);

        await expect(serviceFee.withdrawFee(sut.eth.constants.AddressZero)).to.be.revertedWith("cfa3b address is missing OWNER_ROLE");
      });
    });
  });
});
