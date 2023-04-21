import { expect, use } from "chai";
import { solidity } from "ethereum-waffle";
import { providers, Signer } from "ethers";
import { describe } from "mocha";
import { ethers } from "hardhat";
const gasSettings = { gasPrice: "1000000000" }; //{maxFeePerGas: "300", maxPriorityFeePerGas: "10"}

use(solidity);

// Start test block
describe("ExternalPriceFeed", function () {
  this.timeout(10000);

  let accounts: string[];
  const wallets: Signer[] = [];
  let provider: providers.JsonRpcProvider;

  beforeEach(async function () {
    provider = ethers.provider;
    accounts = await provider.listAccounts();
    for (const account of accounts) {
      wallets.push(provider.getSigner(account));
    }
  });

  it("can save correct moving average for series of setPrice calls", async function () {
    const setPriceFeedPrice = async (price = "1000000000000000000") => {
      const tx = await priceFeed.setPrice(price, { gasLimit: 8000000, ...gasSettings });
      await tx.wait();
    };
    const [wallet] = wallets;

    const MintableTokenFactory = await ethers.getContractFactory("MintableToken");
    const PriceFeedFactory = await ethers.getContractFactory("ExternalPriceFeed");
    const TokenToPriceFeedFactory = await ethers.getContractFactory("TokenToPriceFeed");

    const collateralToken = await MintableTokenFactory.deploy("CollateralToken", "CT", gasSettings);
    await collateralToken.deployed();

    const tokenToPriceFeed = await TokenToPriceFeedFactory.deploy(gasSettings);
    await tokenToPriceFeed.deployed();

    const priceFeed = await PriceFeedFactory.deploy(collateralToken.address, await wallet.getAddress(), tokenToPriceFeed.address, gasSettings);
    await priceFeed.deployed();
    tokenToPriceFeed.setTokenPriceFeed(collateralToken.address, priceFeed.address, "120", 250);

    await provider.send("evm_increaseTime", [60]);
    await provider.send("evm_mine", []);
    await setPriceFeedPrice();

    let collateralTokenPrice = (await priceFeed.price()).toString();
    const expectedValue = "1000000000000000000";
    expect(collateralTokenPrice).to.equal(expectedValue);

    await provider.send("evm_increaseTime", [60]);
    await provider.send("evm_mine", []);
    await setPriceFeedPrice("800000000000000000");

    await provider.send("evm_increaseTime", [60]);
    await provider.send("evm_mine", []);
    await setPriceFeedPrice("800000000000000000");

    collateralTokenPrice = (await priceFeed.price()).toString();
    expect(+collateralTokenPrice).to.be.above(980000000000000000);
    expect(+collateralTokenPrice).to.be.below(985000000000000000);

    await provider.send("evm_increaseTime", [60]);
    await provider.send("evm_mine", []);
    await setPriceFeedPrice("100000000000000000");

    collateralTokenPrice = (await priceFeed.price()).toString();
    expect(+collateralTokenPrice).to.be.above(930000000000000000);
    expect(+collateralTokenPrice).to.be.below(940000000000000000);
  });
});
