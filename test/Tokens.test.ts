import { FixSupplyToken, MintableToken, MintableTokenOwner } from "../src/types";
import { expect, use } from "chai";
import { solidity } from "ethereum-waffle";
import { addressZero, DECIMAL_PRECISION, deployContract, getEventsFromReceipt } from "./utils/helpers";
import { before, describe } from "mocha";
import { ethers } from "hardhat";
import { SystemUnderTest } from "./utils/SystemUnderTest";
import { BigNumber } from "ethers";

use(solidity);

// Start test block
describe("Tokens", function () {
  this.timeout(10000);

  const sut = new SystemUnderTest(ethers);
  let mintableToken: MintableToken;
  let mintableTokenOwner: MintableTokenOwner;

  function findTransferEvent(events: any[], fromAddress: string, toAddress: string, amount: BigNumber): any {
    return events.find((t) => {
      return t.args.from == fromAddress && t.args.to == toAddress && (amount.eq(t.args.value) || amount.lt(0));
    });
  }

  before(async function () {
    await sut.ready;
  });

  beforeEach(async function () {
    mintableToken = (await deployContract(sut.wallets[0], "MintableToken", ["Mintable Token for Test", "MTT"])) as MintableToken;
    await mintableToken.deployed();
  });

  // Test case
  it("owner can mint new mintable tokens", async function () {
    await expect(mintableToken.connect(sut.wallets[0]).mint(sut.accounts[1], "1000000000000000000000"))
      .to.emit(mintableToken, "Transfer")
      .withArgs("0x0000000000000000000000000000000000000000", sut.accounts[1], "1000000000000000000000");
  });

  it("anyone can burn mintable tokens", async function () {
    await mintableToken.connect(sut.wallets[0]).mint(sut.accounts[1], "100000000000000000");
    await expect(mintableToken.connect(sut.wallets[1]).burn("100000000000000000"))
      .to.emit(mintableToken, "Transfer")
      .withArgs(sut.accounts[1], "0x0000000000000000000000000000000000000000", "100000000000000000");
  });

  it("forbids non owner from minting", async function () {
    await expect(mintableToken.connect(sut.wallets[1]).mint(sut.accounts[1], "1000000000000000000000")).to.be.revertedWith("Ownable: caller is not the owner");
  });

  it("sent all the fixed supply tokens to address 0", async function () {
    const fixSupplyToken: FixSupplyToken = (await deployContract(sut.wallets[0], "FixSupplyToken", [
      "Fix Supply Token for Test",
      "FST",
      [sut.accounts[0]],
      [DECIMAL_PRECISION.mul(1e9)]
    ])) as FixSupplyToken;
    expect(await fixSupplyToken.balanceOf(sut.accounts[0])).to.equal(DECIMAL_PRECISION.mul(1e9));
    expect(await fixSupplyToken.totalSupply()).to.equal(DECIMAL_PRECISION.mul(1e9));
  });

  it("deploys a token contract and mints all the tokens into multiple accounts", async function () {
    const fixSupplyToken: FixSupplyToken = (await deployContract(sut.wallets[0], "FixSupplyToken", [
      "Billion Token for Test",
      "BTT",
      [sut.accounts[0], sut.accounts[1], sut.accounts[2], sut.accounts[3], sut.accounts[4]],
      [DECIMAL_PRECISION.mul(2e8), DECIMAL_PRECISION.mul(2e8), DECIMAL_PRECISION.mul(2e8), DECIMAL_PRECISION.mul(2e8), DECIMAL_PRECISION.mul(2e8)]
    ])) as FixSupplyToken;
    await fixSupplyToken.deployed();
    const tx = await ethers.provider.getTransactionReceipt(fixSupplyToken.deployTransaction.hash);
    const transfers = getEventsFromReceipt(fixSupplyToken.interface, tx, "Transfer");
    expect(findTransferEvent(transfers, addressZero, sut.accounts[0], DECIMAL_PRECISION.mul(2e8))).to.not.be.undefined;
    expect(findTransferEvent(transfers, addressZero, sut.accounts[1], DECIMAL_PRECISION.mul(2e8))).to.not.be.undefined;
    expect(findTransferEvent(transfers, addressZero, sut.accounts[2], DECIMAL_PRECISION.mul(2e8))).to.not.be.undefined;
    expect(findTransferEvent(transfers, addressZero, sut.accounts[3], DECIMAL_PRECISION.mul(2e8))).to.not.be.undefined;
    expect(findTransferEvent(transfers, addressZero, sut.accounts[4], DECIMAL_PRECISION.mul(2e8))).to.not.be.undefined;

    expect(await fixSupplyToken.balanceOf(sut.accounts[0])).to.equal(DECIMAL_PRECISION.mul(2e8));
    expect(await fixSupplyToken.balanceOf(sut.accounts[1])).to.equal(DECIMAL_PRECISION.mul(2e8));
    expect(await fixSupplyToken.balanceOf(sut.accounts[2])).to.equal(DECIMAL_PRECISION.mul(2e8));
    expect(await fixSupplyToken.balanceOf(sut.accounts[3])).to.equal(DECIMAL_PRECISION.mul(2e8));
    expect(await fixSupplyToken.balanceOf(sut.accounts[4])).to.equal(DECIMAL_PRECISION.mul(2e8));

    expect(await fixSupplyToken.totalSupply()).to.equal(DECIMAL_PRECISION.mul(1e9));
  });

  it("throws an error if the arrays are not of equal length", async function () {
    try {
      const fixSupplyToken = (await deployContract(sut.wallets[0], "FixSupplyToken", [
        "Billion Token for Test",
        "BTT",
        [sut.accounts[0], sut.accounts[1], sut.accounts[2], sut.accounts[3]],
        [DECIMAL_PRECISION.mul(2e8), DECIMAL_PRECISION.mul(2e8), DECIMAL_PRECISION.mul(2e8), DECIMAL_PRECISION.mul(2e8), DECIMAL_PRECISION.mul(2e8)]
      ])) as FixSupplyToken;
      await fixSupplyToken.deployed();
      expect(1).to.equal(0, "no error thrown");
    } catch (err: any) {
      expect(err.message).to.contain("arrays must have same lenght");
    }
  });

  describe("Mintable Token Owner", function () {
    beforeEach(async function () {
      mintableTokenOwner = (await deployContract(sut.wallets[0], "MintableTokenOwner", [mintableToken.address])) as MintableTokenOwner;
      await mintableTokenOwner.deployed();
      await mintableTokenOwner.addMinter(sut.accounts[0]);
      await mintableToken.transferOwnership(mintableTokenOwner.address);
    });

    it("allows the owner to add minters", async function () {
      await mintableTokenOwner.addMinter(sut.accounts[1]);
      expect(await mintableTokenOwner.minters(sut.accounts[1])).to.be.true;
    });

    it("reverts if a non owner tries to add a minter", async function () {
      await expect(mintableTokenOwner.connect(sut.wallets[1]).addMinter(sut.accounts[2])).to.be.revertedWith("Ownable: caller is not the owner");
    });

    describe("with minters", function () {
      beforeEach(async function () {
        await mintableTokenOwner.addMinter(sut.accounts[1]);
      });
      it("allows the minter to mint some tokens to an arbitrary address", async function () {
        await expect(mintableTokenOwner.connect(sut.wallets[1]).mint(sut.accounts[2], "100000000000000000"))
          .to.emit(mintableToken, "Transfer")
          .withArgs("0x0000000000000000000000000000000000000000", sut.accounts[2], "100000000000000000");
      });

      it("reverts if a non minter tries to mint", async function () {
        await expect(mintableTokenOwner.connect(sut.wallets[2]).mint(sut.accounts[2], "100000000000000000")).to.be.revertedWith(
          "MintableTokenOwner:mint: the sender must be in the minters list"
        );
      });
    });
  });
});
