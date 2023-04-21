import { expect, use } from "chai";
import { solidity } from "ethereum-waffle";
import { BigNumber, providers, Signer } from "ethers";
import { MintableToken, MintableTokenOwner, TestPriceFeed, TestFeeRecipient, TokenToPriceFeed, OriginalTroveFactory } from "../src/types";
import { deployContract, deployUUPSContract } from "./utils/helpers";
import { describe } from "mocha";
import { ethers } from "hardhat";

use(solidity);

const ONE = BigNumber.from("1000000000000000000");

describe("Token to Pricefeed Contract", function () {
  this.timeout(90000);

  const wallets: Signer[] = [];
  let accounts: string[];
  let troveFactory: OriginalTroveFactory;
  let troveToken: MintableToken;
  let tokenToPriceFeed: TokenToPriceFeed;
  let priceFeed: TestPriceFeed;
  let provider: providers.JsonRpcProvider;
  let mintableTokenOwner: MintableTokenOwner;
  let stableCoin: MintableToken;
  let testFeeRecipient: TestFeeRecipient;

  before(async function () {
    provider = ethers.provider;
    accounts = await provider.listAccounts();
    for (const account of accounts) {
      wallets.push(provider.getSigner(account));
    }
  });

  beforeEach(async function () {
    troveToken = (await deployContract(wallets[0], "MintableToken", ["Mintable Token for Test", "MTT"])) as MintableToken;

    stableCoin = (await deployContract(wallets[0], "MintableToken", ["Mintable Stable Coin for Test", "MSC"])) as MintableToken;

    mintableTokenOwner = (await deployContract(wallets[0], "MintableTokenOwner", [stableCoin.address])) as MintableTokenOwner;
    await mintableTokenOwner.addMinter(await wallets[0].getAddress());
    await stableCoin.transferOwnership(mintableTokenOwner.address);

    testFeeRecipient = (await deployContract(wallets[0], "TestFeeRecipient", [stableCoin.address])) as TestFeeRecipient;

    troveFactory = (await deployUUPSContract(wallets[0], "OriginalTroveFactory", [stableCoin.address, testFeeRecipient.address], [])) as OriginalTroveFactory;

    tokenToPriceFeed = (await deployContract(wallets[0], "TokenToPriceFeed")) as TokenToPriceFeed;

    await troveFactory.setTokenPriceFeed(tokenToPriceFeed.address);
    await mintableTokenOwner.transferOwnership(troveFactory.address);
    await troveFactory.setTokenOwner();
  });

  it("doesn't allow mcr < 100", async function () {
    priceFeed = (await deployContract(wallets[0], "TestPriceFeed", [troveToken.address])) as TestPriceFeed;

    await expect(tokenToPriceFeed.setTokenPriceFeed(troveToken.address, priceFeed.address, 99, 250)).to.be.revertedWith("f0925e MCR < 100");
  });

  it("allows mcr >= 100", async function () {
    priceFeed = (await deployContract(wallets[0], "TestPriceFeed", [troveToken.address])) as TestPriceFeed;

    await expect(tokenToPriceFeed.setTokenPriceFeed(troveToken.address, priceFeed.address, 100, 250)).not.to.be.reverted;

    const troveToken1 = (await deployContract(wallets[0], "MintableToken", ["Mintable Token for Test 1", "MTT 1"])) as MintableToken;

    await expect(tokenToPriceFeed.setTokenPriceFeed(troveToken1.address, priceFeed.address, 100, 250))
      .to.emit(tokenToPriceFeed, "NewTokenPriceFeed")
      .withArgs(troveToken1.address, priceFeed.address, await troveToken1.name(), await troveToken1.symbol(), ONE, ONE.div(40));

    const troveToken2 = (await deployContract(wallets[0], "MintableToken", ["Mintable Token for Test 2", "MTT 2"])) as MintableToken;

    await expect(tokenToPriceFeed.setTokenPriceFeed(troveToken2.address, priceFeed.address, 120, 250))
      .to.emit(tokenToPriceFeed, "NewTokenPriceFeed")
      .withArgs(troveToken2.address, priceFeed.address, await troveToken2.name(), await troveToken2.symbol(), ONE.mul(120).div(100), ONE.div(40));
  });

  it("gets the price from priceFeed", async function () {
    const troveToken1 = (await deployContract(wallets[0], "MintableToken", ["Mintable Token for Test 1", "MTT 1"])) as MintableToken;

    priceFeed = (await deployContract(wallets[0], "TestPriceFeed", [troveToken1.address])) as TestPriceFeed;
    await tokenToPriceFeed.setTokenPriceFeed(troveToken1.address, priceFeed.address, 120, 250);

    expect(await tokenToPriceFeed.tokenPrice(troveToken1.address)).to.equal(await priceFeed.pricePoint());
    await priceFeed.setPrice(ONE);
    expect(await tokenToPriceFeed.tokenPrice(troveToken1.address)).to.equal(ONE);

    await priceFeed.setPrice(ONE.div(123123));

    expect(await tokenToPriceFeed.tokenPrice(troveToken1.address)).to.equal(ONE.div(123123));

    await priceFeed.setPrice(ONE.mul(ONE));

    expect(await tokenToPriceFeed.tokenPrice(troveToken1.address)).to.equal(ONE.mul(ONE));
  });
});
