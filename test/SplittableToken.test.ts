import { FixSupplyToken, SplittableToken } from "../src/types";
import { expect, use } from "chai";
import { solidity } from "ethereum-waffle";
import { providers, Signer } from "ethers";
import { DECIMAL_PRECISION, deployContract } from "./utils/helpers";
import { describe } from "mocha";
import { ethers } from "hardhat";

use(solidity);

// Start test block
describe.skip("Splittable Tokens", function () {
  this.timeout(10000);

  let accounts: string[];
  const wallets: Signer[] = [];
  let provider: providers.JsonRpcProvider;
  let splittableToken: SplittableToken;
  let fixSupplyToken: FixSupplyToken;

  beforeEach(async function () {
    provider = ethers.provider;
    accounts = await provider.listAccounts();
    // accounts = ["0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266"]
    // wallets.push(new ethers.Wallet("0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80", provider))
    for (const account of accounts) {
      wallets.push(provider.getSigner(account));
    }
    splittableToken = (await deployContract(wallets[0], "SplittableToken", ["Billion Token for Test", "BTT", "1000000000000000000000000000"])) as SplittableToken;
    await splittableToken.deployed();
  });

  it("has an initial split ratio of 1", async function () {
    expect(await splittableToken.multiplier()).to.equal(DECIMAL_PRECISION);
  });

  it("total supply is 1 Billion", async function () {
    expect(await splittableToken.totalSupply()).to.equal("1000000000000000000000000000");
  });

  it("the owner can increase the total supply", async function () {
    // increase supply by 1.5
    await splittableToken.connect(wallets[0]).increaseSupply("500000000000000000");
    expect(await splittableToken.multiplier()).to.equal("1500000000000000000");
    expect(await splittableToken.totalSupply()).to.equal("1500000000000000000000000000");
  });

  it("when the owner increases the supply an event is emited", async function () {
    await expect(splittableToken.connect(wallets[0]).increaseSupply("500000000000000000"))
      .to.emit(splittableToken, "IncreaseSupply")
      .withArgs("1500000000000000000", "500000000000000000");
  });

  it("the owner can transfer tokens", async function () {
    await splittableToken.transfer(accounts[1], DECIMAL_PRECISION);
    expect(await splittableToken.balanceOf(accounts[1])).to.equal(DECIMAL_PRECISION);
  });

  it("when the owner increases the supply already credit accounts are increased", async function () {
    await splittableToken.transfer(accounts[1], DECIMAL_PRECISION);
    await splittableToken.connect(wallets[0]).increaseSupply("500000000000000000");
    expect(await splittableToken.balanceOf(accounts[1])).to.equal("1500000000000000000");
  });

  it("accounts only benefit from increases after they receive tokens", async function () {
    await splittableToken.transfer(accounts[6], "10000000000000000000");
    for (let i = 1; i <= 5; i++) {
      const w6balance = await splittableToken.balanceOf(accounts[6]);
      await splittableToken.connect(wallets[0]).increaseSupply(DECIMAL_PRECISION);
      await splittableToken.connect(wallets[6]).transfer(accounts[i], DECIMAL_PRECISION);
      expect(await splittableToken.balanceOf(accounts[6])).to.equal(w6balance.mul(2).sub(DECIMAL_PRECISION));
    }

    expect(await splittableToken.balanceOf(accounts[1])).to.equal("5000000000000000000");
    expect(await splittableToken.balanceOf(accounts[2])).to.equal("4000000000000000000");
    expect(await splittableToken.balanceOf(accounts[3])).to.equal("3000000000000000000");
    expect(await splittableToken.balanceOf(accounts[4])).to.equal("2000000000000000000");
    expect(await splittableToken.balanceOf(accounts[5])).to.equal("1000000000000000000");
  });

  describe("working with increased balances", function () {
    beforeEach(async function () {
      await splittableToken.transfer(accounts[1], DECIMAL_PRECISION);
      await splittableToken.connect(wallets[0]).increaseSupply("500000000000000000");
    });

    it("the token holder can transfer the increased tokens", async function () {
      await splittableToken.connect(wallets[1]).transfer(accounts[2], "1250000000000000000");
      expect(await splittableToken.balanceOf(accounts[2])).to.equal("1250000000000000000");
      expect(await splittableToken.balanceOf(accounts[1])).to.equal("250000000000000000");
    });

    it("the token holder can transfer only the increased tokens", async function () {
      await splittableToken.connect(wallets[1]).transfer(accounts[2], "1250000000000000000");
      expect(await splittableToken.balanceOf(accounts[2])).to.equal("1250000000000000000");
      expect(await splittableToken.balanceOf(accounts[1])).to.equal("250000000000000000");
      await splittableToken.connect(wallets[1]).transfer(accounts[2], "250000000000000000");
      expect(await splittableToken.balanceOf(accounts[2])).to.equal("1500000000000000000");
      expect(await splittableToken.balanceOf(accounts[1])).to.equal("0");
    });
  });
});
