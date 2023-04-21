import { expect, use } from "chai";
import { deployContract, toBN } from "./utils/helpers";
import { describe } from "mocha";
import { ethers } from "hardhat";
import { providers, Signer } from "ethers";
import { ChainlinkPriceFeed, ConvertedPriceFeed, MintableToken, PriceAggregator } from "../src/types";
import { solidity } from "ethereum-waffle";

use(solidity);

const ONE = toBN("1000000000000000000");

describe("ChainLink Price Feed", function () {
  let provider: providers.JsonRpcProvider;
  const wallets: Signer[] = [];
  let accounts: string[];
  let token: MintableToken;
  let aggregator: PriceAggregator;

  before(async function () {
    provider = ethers.provider;
    accounts = await provider.listAccounts();
    for (const account of accounts) {
      wallets.push(provider.getSigner(account));
    }
  });

  beforeEach(async function () {
    token = (await deployContract(wallets[0], "MintableToken", ["BONQ Token for Test", "BONQ"])) as MintableToken;
    aggregator = (await deployContract(wallets[0], "PriceAggregator", [])) as PriceAggregator;
    await (await aggregator.setDecimals(8)).wait();
    await (await aggregator.setLatestAnswer("100000000")).wait();
  });

  it("fails to deploy a price feed without either a token or an aggregator", async function () {
    await expect(deployContract(wallets[0], "ChainlinkPriceFeed", [ethers.constants.AddressZero, ethers.constants.AddressZero])).to.be.revertedWith(
      "e2637b _oracle must not be address 0x0"
    );
    await expect(deployContract(wallets[0], "ChainlinkPriceFeed", [aggregator.address, ethers.constants.AddressZero])).to.be.revertedWith("e2637b _token must not be address 0x0");
  });

  it("successfully creates a price feed with valid parameters", async function () {
    const pf: ChainlinkPriceFeed = await deployContract(wallets[0], "ChainlinkPriceFeed", [aggregator.address, token.address]);
    expect(await pf.token()).to.equal(token.address);
    expect(await pf.oracle()).to.equal(aggregator.address);
  });

  describe("with price feed", function () {
    let priceFeed: ChainlinkPriceFeed;
    beforeEach(async function () {
      priceFeed = await deployContract(wallets[0], "ChainlinkPriceFeed", [aggregator.address, token.address]);
    });

    it("gets the latest price when calling price()", async function () {
      expect(await priceFeed.price()).to.equal(ONE);
      expect(await priceFeed.pricePoint()).to.equal(ONE);

      await (await aggregator.setLatestAnswer("200000000")).wait();

      expect(await priceFeed.price()).to.equal(ONE.mul(2));
      expect(await priceFeed.pricePoint()).to.equal(ONE.mul(2));
    });

    it("emits the PriceUpdate event when requested", async function () {
      await expect(await priceFeed.emitPriceSignal())
        .to.emit(priceFeed, "PriceUpdate")
        .withArgs(token.address, await priceFeed.price(), await priceFeed.price());
    });

    describe("converted price feed", function () {
      let eurusd: PriceAggregator;
      let convertedPF: ConvertedPriceFeed;

      it("converts the price correctly", async function () {
        eurusd = (await deployContract(wallets[0], "PriceAggregator", [])) as PriceAggregator;
        await (await eurusd.setDecimals(8)).wait();
        const eurusdPf = await deployContract(wallets[0], "ChainlinkPriceFeed", [eurusd.address, token.address]);
        convertedPF = (await deployContract(wallets[0], "ConvertedPriceFeed", [priceFeed.address, eurusdPf.address, token.address])) as ConvertedPriceFeed;
        await await eurusd.setLatestAnswer("80000000");
        await (await aggregator.setLatestAnswer("200000000")).wait();
        expect(await convertedPF.price()).to.equal(ONE.mul(25).div(10));
      });
    });
  });
});
