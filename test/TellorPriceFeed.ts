import { expect, use } from "chai";
import { deployContract, toBN } from "./utils/helpers";
import { describe } from "mocha";
import { ethers } from "hardhat";
import { providers, Signer } from "ethers";
import { ConvertedPriceFeed, MintableToken, TellorDataFeed, TellorPriceFeed, TokenToPriceFeed } from "../src/types";
import { solidity } from "ethereum-waffle";
import { PriceAggregator } from "../deployments_package";

use(solidity);

const ONE = toBN("1000000000000000000");

describe("Tellor Price Feed", function () {
  let provider: providers.JsonRpcProvider;
  const wallets: Signer[] = [];
  let accounts: string[];
  let token: MintableToken;
  let aggregator: TellorDataFeed;

  before(async function () {
    provider = ethers.provider;
    accounts = await provider.listAccounts();
    for (const account of accounts) {
      wallets.push(provider.getSigner(account));
    }
  });

  beforeEach(async function () {
    token = (await deployContract(wallets[0], "MintableToken", ["BONQ Token for Test", "BONQ"])) as MintableToken;
    aggregator = (await deployContract(wallets[0], "TellorDataFeed", [])) as TellorDataFeed;
    // aggregator = ( await ethers.getContractAt("TellorDataFeed", "0x8f55D884CAD66B79e1a131f6bCB0e66f4fD84d5B", wallets[0]) ) as TellorDataFeed;
  });

  it("fails to deploy a price feed without either a token or an aggregator", async function () {
    await expect(
      deployContract(wallets[0], "TellorPriceFeed", [
        ethers.constants.AddressZero,
        ethers.constants.AddressZero,
        "0x12906c5e9178631dba86f1f750f7ab7451c61e6357160eb890029b9eac1fb235"
      ])
    ).to.be.revertedWith("e2637b _oracle must not be address 0x0");
    await expect(
      deployContract(wallets[0], "TellorPriceFeed", [aggregator.address, ethers.constants.AddressZero, "0x12906c5e9178631dba86f1f750f7ab7451c61e6357160eb890029b9eac1fb235"])
    ).to.be.revertedWith("e2637b _token must not be address 0x0");
  });

  it("successfully creates a price feed with valid parameters", async function () {
    const pf: TellorPriceFeed = await deployContract(wallets[0], "TellorPriceFeed", [
      aggregator.address,
      token.address,
      "0x12906c5e9178631dba86f1f750f7ab7451c61e6357160eb890029b9eac1fb235"
    ]);
    expect(await pf.token()).to.equal(token.address);
    expect(await pf.oracle()).to.equal(aggregator.address);
    expect(await pf.queryId()).to.equal("0x12906c5e9178631dba86f1f750f7ab7451c61e6357160eb890029b9eac1fb235");
  });

  describe("with price feed", function () {
    let priceFeed: TellorPriceFeed;

    beforeEach(async function () {
      priceFeed = await deployContract(wallets[0], "TellorPriceFeed", [aggregator.address, token.address, "0x12906c5e9178631dba86f1f750f7ab7451c61e6357160eb890029b9eac1fb235"]);
    });

    it("gets the latest price when calling price()", async function () {
      expect(await priceFeed.price()).to.equal(ONE.div(2));
      expect(await priceFeed.pricePoint()).to.equal(ONE.div(2));
    });

    it("emits the PriceUpdate event when requested", async function () {
      await expect(await priceFeed.emitPriceSignal())
        .to.emit(priceFeed, "PriceUpdate")
        .withArgs(token.address, await priceFeed.price(), await priceFeed.price());
    });

    describe("converted price feed", function () {
      let eurusd: PriceAggregator;
      let convertedPF: ConvertedPriceFeed;

      beforeEach(async function () {
        eurusd = (await deployContract(wallets[0], "PriceAggregator", [])) as PriceAggregator;
        await (await eurusd.setDecimals(8)).wait();
        const eurusdPf = await deployContract(wallets[0], "ChainlinkPriceFeed", [eurusd.address, token.address]);
        convertedPF = (await deployContract(wallets[0], "ConvertedPriceFeed", [priceFeed.address, eurusdPf.address, token.address])) as ConvertedPriceFeed;
        // 0.8 EUR per USD
        await await eurusd.setLatestAnswer("80000000");
      });

      it("converts the price correctly", async function () {
        expect(await convertedPF.price()).to.equal(ONE.mul(625).div(1000));
      });

      it("works when added to TokenToPriceFeed", async function () {
        const tokenToPriceFeed: TokenToPriceFeed = (await deployContract(wallets[0], "TokenToPriceFeed", [])) as TokenToPriceFeed;
        await await tokenToPriceFeed.setTokenPriceFeed(token.address, convertedPF.address, 500, 500);
        expect((await tokenToPriceFeed.tokens(token.address)).priceFeed).to.equal(convertedPF.address);
        console.log((await tokenToPriceFeed.tokenPrice(token.address)).toString());
        expect(await tokenToPriceFeed.tokenPrice(token.address)).to.equal(await convertedPF.price());
      });
    });
  });
});
