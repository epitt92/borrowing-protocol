import { expect, use } from "chai";
import { solidity } from "ethereum-waffle";
import { BigNumber, ContractReceipt, ContractTransaction, providers, Signer } from "ethers";
import {
  ILiquidationPool,
  MintableToken,
  MintableTokenOwner,
  TestPriceFeed,
  TestFeeRecipient,
  TokenToPriceFeed,
  OriginalTroveFactory,
  Trove,
  StabilityPoolBase
} from "../src/types";
import { deployContract, deployUUPSContract } from "./utils/helpers";
import { describe } from "mocha";
import { ethers } from "hardhat";

use(solidity);

const TEN = BigNumber.from("10000000000000000000");

describe("Community Liquidation Pool", function () {
  this.timeout(100000);

  const wallets: Signer[] = [];
  let accounts: string[];
  let troveFactory: OriginalTroveFactory;
  let troveToken: MintableToken;
  let trove1: Trove;
  let trove2: Trove;
  let trove3: Trove;
  let trove4: Trove;
  let trove5: Trove;
  let trovesArray: Trove[];
  let tokenToPriceFeed: TokenToPriceFeed;
  let priceFeed: TestPriceFeed;
  let provider: providers.JsonRpcProvider;
  let mintableTokenOwner: MintableTokenOwner;
  let stableCoin: MintableToken;
  let bonqToken: MintableToken;
  let liquidationPool: ILiquidationPool;
  let testFeeRecipient: TestFeeRecipient;

  before(async function () {
    provider = ethers.provider;
    accounts = await provider.listAccounts();
    for (const account of accounts) {
      wallets.push(provider.getSigner(account));
    }
  });

  const addTrove = async function (owner: Signer = wallets[1], tokenAddress = troveToken.address, mint = true): Promise<Trove> {
    const tx: ContractTransaction = await troveFactory.connect(owner).createTrove(tokenAddress);
    const receipt: ContractReceipt = await tx.wait();
    // @ts-ignore
    const troveAddress = receipt.events.filter((x) => {
      return x.event == "NewTrove";
    })[0].args.trove;
    return (await ethers.getContractAt("Trove", troveAddress)) as Trove;
  };

  beforeEach(async function () {
    troveToken = (await deployContract(wallets[0], "MintableToken", ["Mintable Token for Test", "MTT"])) as MintableToken;

    stableCoin = (await deployContract(wallets[0], "MintableToken", ["Mintable Stable Coin for Test", "MSC"])) as MintableToken;

    bonqToken = (await deployContract(wallets[0], "MintableToken", ["BONQ Token for Test", "BONQ"])) as MintableToken;

    mintableTokenOwner = (await deployContract(wallets[0], "MintableTokenOwner", [stableCoin.address])) as MintableTokenOwner;
    await mintableTokenOwner.addMinter(await wallets[0].getAddress());
    await stableCoin.transferOwnership(mintableTokenOwner.address);

    tokenToPriceFeed = (await deployContract(wallets[0], "TokenToPriceFeed")) as TokenToPriceFeed;

    priceFeed = (await deployContract(wallets[0], "TestPriceFeed", [troveToken.address])) as TestPriceFeed;

    await tokenToPriceFeed.setTokenPriceFeed(troveToken.address, priceFeed.address, 120, 250);

    testFeeRecipient = (await deployContract(wallets[0], "TestFeeRecipient", [stableCoin.address])) as TestFeeRecipient;

    troveFactory = (await deployUUPSContract(wallets[0], "OriginalTroveFactory", [stableCoin.address, testFeeRecipient.address], [])) as OriginalTroveFactory;

    const troveImplementation = (await deployContract(wallets[0], "Trove", [troveFactory.address])) as Trove;

    await (await troveFactory.setTroveImplementation(troveImplementation.address)).wait();
    await troveFactory.setTokenPriceFeed(tokenToPriceFeed.address);
    await mintableTokenOwner.transferOwnership(troveFactory.address);
    await troveFactory.setTokenOwner();

    liquidationPool = await deployContract(wallets[0], "CommunityLiquidationPool", [troveFactory.address, troveToken.address]);
    const stabilityPool = (await deployUUPSContract(wallets[0], "StabilityPoolBase", [], [troveFactory.address, bonqToken.address])) as StabilityPoolBase;

    await troveFactory.setStabilityPool(stabilityPool.address);

    await troveFactory.setLiquidationPool(troveToken.address, liquidationPool.address);
    await troveFactory.connect(wallets[1]).createTrove(troveToken.address);
    await troveFactory.connect(wallets[1]).createTrove(troveToken.address);
    await troveFactory.connect(wallets[1]).createTrove(troveToken.address);
    await troveFactory.connect(wallets[1]).createTrove(troveToken.address);
    await troveFactory.connect(wallets[1]).createTrove(troveToken.address);

    const TroveContract = await ethers.getContractFactory("Trove");
    trove1 = TroveContract.attach(await troveFactory.firstTrove(troveToken.address)) as Trove;
    trove2 = TroveContract.attach(await troveFactory.nextTrove(troveToken.address, trove1.address)) as Trove;
    trove3 = TroveContract.attach(await troveFactory.nextTrove(troveToken.address, trove2.address)) as Trove;
    trove4 = TroveContract.attach(await troveFactory.nextTrove(troveToken.address, trove3.address)) as Trove;
    trove5 = TroveContract.attach(await troveFactory.lastTrove(troveToken.address)) as Trove;

    await troveToken.mint(accounts[1], TEN.mul(10000));
    for (const troveObj of [trove1, trove2, trove3, trove4, trove5]) {
      await troveToken.connect(wallets[1]).approve(troveObj.address, TEN);
      await troveObj.connect(wallets[1]).increaseCollateral(TEN, trove1.address);
    }
  });

  it("distributes 25% of liquidated collateral when 1 out of 5 troves are liquidated", async function () {
    await priceFeed.setPrice(TEN);
    await trove2.connect(wallets[1]).borrow(accounts[1], TEN.div(10).mul(4), trove5.address); // borrow 4 + 1reserve , with colValue 100
    await priceFeed.setPrice(TEN.div(20)); // 0.5 price => colValue == debt
    // const troveCollateralization = (await trove2.collateralization()).toString();
    const troveCollateralToLiquidate = await trove2.collateral();
    const troveDebtToLiquidate = await trove2.debt();
    let poolCollateral = await liquidationPool.collateral();
    let poolDebt = await liquidationPool.debt();
    expect(poolCollateral).to.be.equal(0);
    expect(poolDebt).to.be.equal(0);
    expect(troveCollateralToLiquidate).to.be.gt(0);
    expect(troveDebtToLiquidate).to.be.gt(0);

    await trove2.liquidate();

    poolCollateral = await liquidationPool.collateral();
    poolDebt = await liquidationPool.debt();
    expect(poolCollateral).to.be.equal(troveCollateralToLiquidate);
    expect(poolDebt).to.be.equal(troveDebtToLiquidate);

    let troveCollateral = await trove2.collateral();
    let troveDebt = await trove2.debt();
    expect(troveCollateral).to.be.equal(0);
    expect(troveDebt).to.be.equal(0);

    const reward = troveCollateralToLiquidate.div(4);
    const debt = troveDebtToLiquidate.div(4);

    const restTroves = [trove1, trove3, trove4, trove5];

    for (const troveObj of restTroves) {
      troveCollateral = await troveObj.collateral();
      troveDebt = await troveObj.debt();
      const [unclaimedCollateral, unclaimedDebt] = await troveObj.unclaimedCollateralRewardAndDebt();
      expect(troveCollateral).to.be.equal(troveCollateralToLiquidate.add(reward));
      expect(troveDebt).to.be.equal(debt);
      expect(unclaimedCollateral).to.be.equal(reward);
      expect(unclaimedDebt).to.be.equal(debt);
    }
  });

  it("distributes the same amount to same troves", async function () {
    await priceFeed.setPrice(TEN);
    await trove1.connect(wallets[1]).borrow(accounts[1], TEN.div(10).mul(4), trove5.address); // borrow 4 + 1reserve , with colValue 100
    await trove2.connect(wallets[1]).borrow(accounts[1], TEN.div(10).mul(4), trove5.address); // borrow 4 + 1reserve , with colValue 100
    await priceFeed.setPrice(TEN.div(20)); // 0.5 price => colValue == debt

    const troveCollateralToLiquidate1 = await trove1.collateral();
    const troveDebtToLiquidate1 = await trove1.debt();
    const troveCollateralToLiquidate2 = await trove2.collateral();
    const troveDebtToLiquidate2 = await trove2.debt();

    await trove1.liquidate();
    await trove2.liquidate();

    const poolCollateralBalance = await troveToken.balanceOf(liquidationPool.address);
    const poolCollateral = await liquidationPool.collateral();
    const poolDebt = await liquidationPool.debt();
    expect(poolCollateralBalance).to.be.equal(troveCollateralToLiquidate1.add(troveCollateralToLiquidate2));
    expect(poolCollateral).to.be.equal(troveCollateralToLiquidate1.add(troveCollateralToLiquidate2));
    expect(poolDebt).to.be.equal(troveDebtToLiquidate1.add(troveDebtToLiquidate2));

    let troveCollateral = await trove1.collateral();
    let troveDebt = await trove1.debt();
    expect(troveCollateral).to.be.equal(0);
    expect(troveDebt).to.be.equal(0);
    troveCollateral = await trove2.collateral();
    troveDebt = await trove2.debt();
    expect(troveCollateral).to.be.equal(0);
    expect(troveDebt).to.be.equal(0);

    const reward = troveCollateralToLiquidate1.add(troveCollateralToLiquidate2).div(3);
    const debt = troveDebtToLiquidate1.add(troveDebtToLiquidate2).div(3);

    const restTroves = [trove3, trove4, trove5];

    for (const troveObj of restTroves) {
      troveCollateral = await troveObj.collateral();
      troveDebt = await troveObj.debt();
      const [unclaimedCollateral, unclaimedDebt] = await troveObj.unclaimedCollateralRewardAndDebt();
      const expectedCollateral = troveCollateralToLiquidate1.add(reward);
      expect(troveCollateral).to.be.gte(expectedCollateral.sub(10)); // >= (expected-10) (10 of 1e18) 0
      expect(troveCollateral).to.be.lte(expectedCollateral);
      expect(troveDebt).to.be.gte(debt.sub(10)); // >= (expected-10) (10 of 1e18)
      expect(troveDebt).to.be.lte(debt);
      expect(unclaimedCollateral).to.be.gte(reward.sub(10)); // >= (expected-10) (10 of 1e18)
      expect(unclaimedCollateral).to.be.lte(reward);
      expect(unclaimedDebt).to.be.gte(debt.sub(10)); // >= (expected-10) (10 of 1e18)
      expect(unclaimedDebt).to.be.lte(debt);
    }
  });

  it("does not distribute rewards from prior liquidations", async function () {
    await priceFeed.setPrice(TEN);
    await trove2.connect(wallets[1]).borrow(accounts[1], TEN.div(10).mul(4), trove5.address); // borrow 4 + 1reserve , with colValue 100
    await priceFeed.setPrice(TEN.div(20)); // 0.5 price => colValue == debt
    // const troveCollateralization = (await trove2.collateralization()).toString();
    const trove2CollateralToLiquidate = await trove2.collateral();

    await trove2.liquidate();

    const lateTrove = await addTrove(wallets[1]);

    let [unclaimedCollateral1] = await trove1.unclaimedCollateralRewardAndDebt();
    await troveToken.connect(wallets[1]).approve(lateTrove.address, await trove1.collateral());
    await lateTrove.connect(wallets[1]).increaseCollateral(await trove1.collateral(), trove1.address);
    let [unclaimedCollateralLate, unclaimedDebtLate] = await lateTrove.unclaimedCollateralRewardAndDebt();
    expect(unclaimedCollateralLate).to.equal(0);
    expect(unclaimedDebtLate).to.equal(0);

    // liquidate second trove
    await priceFeed.setPrice(TEN);
    await trove3.connect(wallets[1]).borrow(accounts[1], TEN.div(10).mul(4), trove5.address); // borrow 4 + 1reserve , with colValue 100
    await priceFeed.setPrice(TEN.div(20)); // 0.5 price => colValue == debt

    const trove3CollateralToLiquidate = await trove3.collateral();
    const trove3DebtToLiquidate = await trove3.debt();
    await trove3.liquidate();

    [unclaimedCollateralLate, unclaimedDebtLate] = await lateTrove.unclaimedCollateralRewardAndDebt();
    expect(unclaimedCollateralLate).to.equal(trove3CollateralToLiquidate.div(4));
    expect(unclaimedDebtLate).to.equal(trove3DebtToLiquidate.div(4));

    [unclaimedCollateral1] = await trove1.unclaimedCollateralRewardAndDebt();

    expect(unclaimedCollateral1).to.equal(trove2CollateralToLiquidate.div(4).add(trove3CollateralToLiquidate.div(4)));
  });

  const create3NewTroves = async () => {
    for (let i = 0; i < 3; i++) {
      const newTrove = await addTrove();
      await troveToken.connect(wallets[1]).approve(newTrove.address, TEN);
      await newTrove.connect(wallets[1]).increaseCollateral(TEN, trove1.address);
      await newTrove.connect(wallets[1]).borrow(accounts[1], TEN.div(10).mul(4), trove5.address);
      trovesArray.push(newTrove);
    }
  };

  const liquidateTrove = async (index: number) => {
    const trove = trovesArray[index];
    await priceFeed.setPrice(TEN.div(20)); // 0.5 price => colValue == debt
    const trovesCollateralToLiquidate = await trove.collateral();
    await trove.liquidate();
    await priceFeed.setPrice(TEN); // 10 price => colValue >> debt
    trovesArray.splice(index, 1);
    return trovesCollateralToLiquidate;
  };

  const collectUnclaimedCollateralAndDebt = async () => {
    let totalUnclaimedCollateral = BigNumber.from(0);
    let totalUnclaimedDebt = BigNumber.from(0);
    for (const troveObj of trovesArray) {
      const [unclaimedCollateral, unclaimedDebt] = await troveObj.unclaimedCollateralRewardAndDebt();
      totalUnclaimedCollateral = totalUnclaimedCollateral.add(unclaimedCollateral);
      totalUnclaimedDebt = totalUnclaimedDebt.add(unclaimedDebt);
    }
    return [totalUnclaimedCollateral, totalUnclaimedDebt];
  };

  it("distributes rewards correctly", async function () {
    await priceFeed.setPrice(TEN);
    await trove1.connect(wallets[1]).borrow(accounts[1], TEN.div(10).mul(4), trove5.address);
    await trove2.connect(wallets[1]).borrow(accounts[1], TEN.div(10).mul(4), trove5.address);
    await trove3.connect(wallets[1]).borrow(accounts[1], TEN.div(10).mul(4), trove5.address);
    await trove4.connect(wallets[1]).borrow(accounts[1], TEN.div(10).mul(4), trove5.address);
    await trove5.connect(wallets[1]).borrow(accounts[1], TEN.div(10).mul(4), trove5.address);
    trovesArray = [trove1, trove2, trove3, trove4, trove5];

    for (let i = 0; i < 15; i++) {
      const liquidatedCollateral = await liquidateTrove(i * 2);
      const lastTrove = trovesArray[trovesArray.length - 2];
      const [unclaimedCollateral, unclaimedDebt] = await lastTrove.unclaimedCollateralRewardAndDebt();

      const expectedUnclaimedCollateral = liquidatedCollateral.mul(await lastTrove.collateral()).div(await troveFactory.totalCollateral(troveToken.address));
      const expectedUnclaimedDebt = (await liquidationPool.debt()).mul(expectedUnclaimedCollateral).div(await liquidationPool.collateral());

      expect(unclaimedCollateral).to.be.closeTo(expectedUnclaimedCollateral, 1000);
      expect(unclaimedDebt).to.be.closeTo(expectedUnclaimedDebt, 1000);

      await create3NewTroves();
    }

    const [totalUnclaimedCollateral, totalUnclaimedDebt] = await collectUnclaimedCollateralAndDebt();
    expect(totalUnclaimedCollateral).to.be.closeTo(await troveToken.balanceOf(liquidationPool.address), 10000);
    expect(totalUnclaimedDebt).to.be.gt(0);
    expect(totalUnclaimedDebt).to.be.closeTo(await liquidationPool.debt(), 10000);

    for (const troveObj of trovesArray) {
      const [unclaimedCol, unclaimedDeb] = await troveObj.unclaimedCollateralRewardAndDebt();
      const troveCollateral = await troveObj.collateral();
      const troveDebt = await troveObj.debt();
      expect(troveCollateral).to.be.equal(TEN.add(unclaimedCol));
      expect(troveDebt).to.be.equal(TEN.div(10000).mul(5020).add(unclaimedDeb));

      await troveToken.connect(wallets[1]).approve(troveObj.address, 1);
      await troveObj.connect(wallets[1]).increaseCollateral(1, trove2.address);

      const expectedNewCollateral = troveCollateral.add(1);
      const [newUnclaimedCol, newUnclaimedDeb] = await troveObj.unclaimedCollateralRewardAndDebt();
      const newTroveCollateral = await troveObj.collateral();
      const newTroveDebt = await troveObj.debt();
      expect(newUnclaimedCol).to.be.equal(0);
      expect(newUnclaimedDeb).to.be.equal(0);
      expect(newTroveCollateral).to.be.equal(expectedNewCollateral);
      expect(await troveToken.balanceOf(troveObj.address)).to.be.equal(expectedNewCollateral);
      expect(newTroveDebt).to.be.equal(troveDebt);
    }
  });
});
