import { expect, use } from "chai";
import { solidity } from "ethereum-waffle";
import { BigNumber, Contract, providers, Signer } from "ethers";
import {
  ILiquidationPool,
  MintableToken,
  MintableTokenOwner,
  OriginalTroveFactory,
  StabilityPoolUniswap,
  TestFeeRecipient,
  TestPriceFeed,
  TokenToPriceFeed,
  Trove
} from "../src/types";
import { DECIMAL_PRECISION, deployContract, deployUUPSContract, toBN, upgradeUUPSContract } from "./utils/helpers";
import { describe } from "mocha";
import { ethers } from "hardhat";

use(solidity);

describe("Stability Pool", function () {
  this.timeout(60000);

  const wallets: Signer[] = [];
  let accounts: string[];
  let troveFactory: OriginalTroveFactory;
  let troveToken: MintableToken;
  let trove: Trove;
  let trove1: Trove;
  let trove2: Trove;
  let trove3: Trove;
  let lastTrove: Trove;
  let tokenToPriceFeed: TokenToPriceFeed;
  let priceFeed: TestPriceFeed;
  let provider: providers.JsonRpcProvider;
  let mintableTokenOwner: MintableTokenOwner;
  let stableCoin: MintableToken;
  let bonqToken: MintableToken;
  let liquidationPool: ILiquidationPool;
  let stabilityPool: StabilityPoolUniswap;
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

    // stabilityPool = await StabilityPoolUUPS.deploy(troveFactory, bonqToken);
    stabilityPool = (await deployUUPSContract(wallets[0], "StabilityPoolBase", [], [troveFactory.address, bonqToken.address])) as StabilityPoolUniswap;

    await troveFactory.setStabilityPool(stabilityPool.address);
    await troveFactory.setLiquidationPool(troveToken.address, liquidationPool.address);
    await troveFactory.connect(wallets[1]).createTrove(troveToken.address);
    await troveFactory.connect(wallets[1]).createTrove(troveToken.address);
    await troveFactory.connect(wallets[1]).createTrove(troveToken.address);
    await troveFactory.connect(wallets[1]).createTrove(troveToken.address);
    await troveFactory.connect(wallets[1]).createTrove(troveToken.address);

    const TroveContract = await ethers.getContractFactory("Trove");
    trove = TroveContract.attach(await troveFactory.firstTrove(troveToken.address)) as Trove;
    trove1 = TroveContract.attach(await troveFactory.nextTrove(troveToken.address, trove.address)) as Trove;
    trove2 = TroveContract.attach(await troveFactory.nextTrove(troveToken.address, trove1.address)) as Trove;
    trove3 = TroveContract.attach(await troveFactory.nextTrove(troveToken.address, trove2.address)) as Trove;
    lastTrove = TroveContract.attach(await troveFactory.lastTrove(troveToken.address)) as Trove;

    await troveToken.mint(trove.address, "10000000000000000000");
    await troveToken.mint(trove1.address, "10000000000000000000");
    await troveToken.mint(trove2.address, "10000000000000000000");
    await troveToken.mint(trove3.address, "10000000000000000000");
    await troveToken.mint(lastTrove.address, "10000000000000000000");
  });

  it("can receive deposits", async function () {
    const mintingAmount = "100000000000000000000";
    const depositAmount = "100000000000000000";
    await mintableTokenOwner.mint(await wallets[0].getAddress(), mintingAmount);

    await stableCoin.connect(wallets[0]).approve(stabilityPool.address, depositAmount);

    await expect(stabilityPool.connect(wallets[0]).deposit(depositAmount))
      .to.emit(stabilityPool, "Deposit")
      .withArgs(await wallets[0].getAddress(), depositAmount);
  });

  it("contributor cannot perform deposit with 0 value", async function () {
    const depositAmount = "0";
    await stableCoin.connect(wallets[0]).approve(stabilityPool.address, depositAmount);
    await expect(stabilityPool.connect(wallets[0]).deposit(depositAmount)).to.be.revertedWith("d87c1 deposit amount must be bigger than zero");
  });

  it("contributor can perform withdraw", async function () {
    const mintingAmount = "100000000000000000000";
    const withdrawAmount = "100000000000000000";
    await mintableTokenOwner.mint(await wallets[0].getAddress(), mintingAmount);

    await stableCoin.connect(wallets[0]).approve(stabilityPool.address, withdrawAmount);
    await stabilityPool.connect(wallets[0]).deposit(withdrawAmount);

    await expect(stabilityPool.connect(wallets[0]).withdraw(withdrawAmount))
      .to.emit(stabilityPool, "Withdraw")
      .withArgs(await wallets[0].getAddress(), withdrawAmount);
    expect(await stableCoin.balanceOf(accounts[0])).to.be.equal(mintingAmount);
  });

  it("contributor cannot perform withdraw without deposit", async function () {
    const mintingAmount = "100000000000000000000";
    const withdrawAmount = "100000000000000000";
    await mintableTokenOwner.mint(await wallets[0].getAddress(), mintingAmount);

    await stableCoin.connect(wallets[0]).approve(stabilityPool.address, withdrawAmount);

    await expect(stabilityPool.connect(wallets[0]).withdraw(withdrawAmount)).to.be.revertedWith("f6c8a user has no deposit");
  });

  it("stabilityPool is not used when TCR <= 100%", async function () {
    const mintingAmount = "100000000000000000000000";
    const depositAmount = "1000000000000000000000";
    await mintableTokenOwner.mint(await wallets[0].getAddress(), mintingAmount);

    await stableCoin.connect(wallets[0]).approve(stabilityPool.address, depositAmount);
    await stabilityPool.connect(wallets[0]).deposit(depositAmount);
    await trove.connect(wallets[1]).borrow(accounts[1], await trove.collateral(), lastTrove.address);
    await lastTrove.connect(wallets[1]).borrow(accounts[1], await lastTrove.collateral(), trove.address);
    // to make collaterization = 1
    await priceFeed.setPrice(DECIMAL_PRECISION.mul(DECIMAL_PRECISION.mul(10)).div(await trove.collateralization()));
    await expect(trove.liquidate()).to.not.emit(stabilityPool, "TotalDepositUpdated");
    const collateralInSP = await troveToken.balanceOf(stabilityPool.address);
    expect(collateralInSP).to.equal(0);
    const collateral = await trove.collateral();
    expect(collateral).to.equal(0);
  });

  it("contributor can receive full share after trove liquidation", async function () {
    const mintingAmount = "100000000000000000000000";
    const depositAmount = "1000000000000000000000";
    await mintableTokenOwner.mint(await wallets[0].getAddress(), mintingAmount);

    await stableCoin.connect(wallets[0]).approve(stabilityPool.address, depositAmount);
    await stabilityPool.connect(wallets[0]).deposit(depositAmount);
    await trove.connect(wallets[1]).borrow(accounts[1], await trove.collateral(), lastTrove.address);
    await lastTrove.connect(wallets[1]).borrow(accounts[1], await lastTrove.collateral(), trove.address);
    // to make collaterization 1.1
    await priceFeed.setPrice(DECIMAL_PRECISION.mul(DECIMAL_PRECISION.mul(11)).div(await trove.collateralization()));
    const collateral = (await trove.collateral()).toString();
    await trove.liquidate();
    const collateralInSP = (await troveToken.balanceOf(stabilityPool.address)).toString();
    expect(collateralInSP).to.be.equal(collateral);
  });

  it("2 contributors, each can receive 50% of pool collateral", async function () {
    const mintingAmount = "100000000000000000000000";
    const depositAmount1 = "1000000000000000000000";
    const depositAmount2 = "1000000000000000000000";
    const borrowAmount1 = "1000000000000000000";
    await mintableTokenOwner.mint(await wallets[0].getAddress(), mintingAmount);
    await mintableTokenOwner.mint(await wallets[1].getAddress(), mintingAmount);

    await stableCoin.connect(wallets[0]).approve(stabilityPool.address, depositAmount1);
    await stableCoin.connect(wallets[1]).approve(stabilityPool.address, depositAmount2);

    await stabilityPool.connect(wallets[0]).deposit(depositAmount1);
    await stabilityPool.connect(wallets[1]).deposit(depositAmount2);

    await trove.connect(wallets[1]).borrow(accounts[1], borrowAmount1, lastTrove.address);
    await lastTrove.connect(wallets[1]).borrow(accounts[1], borrowAmount1, trove.address);

    await priceFeed.setPrice(DECIMAL_PRECISION.mul(DECIMAL_PRECISION.mul(11)).div(await trove.collateralization()));
    // to make collaterization 1.1

    await expect(trove.liquidate()).to.emit(stabilityPool, "TotalDepositUpdated");

    await expect(stabilityPool.connect(wallets[0]).redeemReward()).to.emit(stabilityPool, "CollateralRewardRedeemed").to.emit(stabilityPool, "BONQRewardRedeemed");

    await expect(stabilityPool.connect(wallets[1]).redeemReward()).to.emit(stabilityPool, "CollateralRewardRedeemed").to.emit(stabilityPool, "BONQRewardRedeemed");

    const firstContCollBalanceBN = await troveToken.balanceOf(accounts[0]);
    const secondContCollBalanceBN = await troveToken.balanceOf(accounts[1]);
    const contributorsBalancesCorrelation = secondContCollBalanceBN.div(firstContCollBalanceBN);
    expect(contributorsBalancesCorrelation.toString()).of.be.equal("1");
  });

  it("2 contributors, they can receive 25%, 75% of pool collateral respectively with factory total debt updated", async function () {
    const mintingAmount = "100000000000000000000000";
    const depositAmount1 = "500000000000000000000";
    const depositAmount2 = "1500000000000000000000";
    const borrowAmount1 = "1000000000000000000";

    await mintableTokenOwner.mint(await wallets[0].getAddress(), mintingAmount);
    await mintableTokenOwner.mint(await wallets[1].getAddress(), mintingAmount);

    await stableCoin.connect(wallets[0]).approve(stabilityPool.address, depositAmount1);
    await stableCoin.connect(wallets[1]).approve(stabilityPool.address, depositAmount2);

    await stabilityPool.connect(wallets[0]).deposit(depositAmount1);
    await stabilityPool.connect(wallets[1]).deposit(depositAmount2);

    await trove.connect(wallets[1]).borrow(accounts[1], borrowAmount1, lastTrove.address);
    await lastTrove.connect(wallets[1]).borrow(accounts[1], borrowAmount1, trove.address);
    const startTotalDebt = await troveFactory.totalDebt();
    const troveDebt = await trove.debt();

    await priceFeed.setPrice(DECIMAL_PRECISION.mul(DECIMAL_PRECISION.mul(11)).div(await trove.collateralization()));
    // to make collaterization 1.1

    await expect(trove.liquidate()).to.emit(stabilityPool, "TotalDepositUpdated");

    await expect(stabilityPool.connect(wallets[0]).redeemReward()).to.emit(stabilityPool, "CollateralRewardRedeemed").to.emit(stabilityPool, "BONQRewardRedeemed");

    await expect(stabilityPool.connect(wallets[1]).redeemReward()).to.emit(stabilityPool, "CollateralRewardRedeemed").to.emit(stabilityPool, "BONQRewardRedeemed");

    const firstContCollBalanceBN = await troveToken.balanceOf(accounts[0]);
    const secondContCollBalanceBN = await troveToken.balanceOf(accounts[1]);
    const contributorsBalancesCorrelation = secondContCollBalanceBN.div(firstContCollBalanceBN);
    const expectedFinishTotalDebt = startTotalDebt.sub(troveDebt);
    const actualTotalDebt = await troveFactory.totalDebt();

    expect(contributorsBalancesCorrelation.toString()).to.be.equal("3");
    expect(expectedFinishTotalDebt).to.be.equal(actualTotalDebt);
  });

  it("3 contributors, they can receive 25%, 25%, 50% of pool collateral respectively", async function () {
    const mintingAmount = "100000000000000000000000";
    const depositAmount1 = "500000000000000000000";
    const depositAmount2 = "500000000000000000000";
    const depositAmount3 = "1000000000000000000000";
    const borrowAmount1 = "1000000000000000000";

    await mintableTokenOwner.mint(await wallets[0].getAddress(), mintingAmount);
    await mintableTokenOwner.mint(await wallets[1].getAddress(), mintingAmount);
    await mintableTokenOwner.mint(await wallets[2].getAddress(), mintingAmount);

    await stableCoin.connect(wallets[0]).approve(stabilityPool.address, depositAmount1);
    await stableCoin.connect(wallets[1]).approve(stabilityPool.address, depositAmount2);
    await stableCoin.connect(wallets[2]).approve(stabilityPool.address, depositAmount3);

    await stabilityPool.connect(wallets[0]).deposit(depositAmount1);
    await stabilityPool.connect(wallets[1]).deposit(depositAmount2);
    await stabilityPool.connect(wallets[2]).deposit(depositAmount3);

    await trove.connect(wallets[1]).borrow(accounts[1], borrowAmount1, lastTrove.address);
    await lastTrove.connect(wallets[1]).borrow(accounts[1], borrowAmount1, trove.address);

    await priceFeed.setPrice(DECIMAL_PRECISION.mul(DECIMAL_PRECISION.mul(11)).div(await trove.collateralization()));
    // to make collaterization 1.1

    await expect(trove.liquidate()).to.emit(stabilityPool, "TotalDepositUpdated");

    const redeemAmount1BN = await stabilityPool.getCollateralReward(troveToken.address, accounts[0]);
    const redeemAmount2BN = await stabilityPool.getCollateralReward(troveToken.address, accounts[1]);
    const redeemAmount3BN = await stabilityPool.getCollateralReward(troveToken.address, accounts[2]);

    await expect(stabilityPool.connect(wallets[0]).redeemReward()).to.emit(stabilityPool, "CollateralRewardRedeemed").to.emit(stabilityPool, "BONQRewardRedeemed");
    await expect(stabilityPool.connect(wallets[1]).redeemReward()).to.emit(stabilityPool, "CollateralRewardRedeemed").to.emit(stabilityPool, "BONQRewardRedeemed");
    await expect(stabilityPool.connect(wallets[2]).redeemReward()).to.emit(stabilityPool, "CollateralRewardRedeemed").to.emit(stabilityPool, "BONQRewardRedeemed");

    const firstContCollBalanceBN = await troveToken.balanceOf(accounts[0]);
    const secondContCollBalanceBN = await troveToken.balanceOf(accounts[1]);
    const thirdContCollBalanceBN = await troveToken.balanceOf(accounts[2]);

    expect(firstContCollBalanceBN).to.be.equal(redeemAmount1BN);
    expect(secondContCollBalanceBN).to.be.equal(redeemAmount2BN);
    expect(thirdContCollBalanceBN).to.be.equal(redeemAmount3BN);

    const contributorsBalancesCorrelation21 = secondContCollBalanceBN.div(firstContCollBalanceBN);
    const contributorsBalancesCorrelation31 = thirdContCollBalanceBN.div(firstContCollBalanceBN);
    const contributorsBalancesCorrelation32 = thirdContCollBalanceBN.div(secondContCollBalanceBN);

    expect(contributorsBalancesCorrelation21.toString()).to.be.equal("1");
    expect(contributorsBalancesCorrelation31.toString()).to.be.equal("2");
    expect(contributorsBalancesCorrelation32.toString()).to.be.equal("2");
  });

  it("5 contributors, they can receive 50% of pool collateral, after series of liquidations, deposits and withdrawals", async function () {
    const mintingAmount = "1000000000000000000000000";
    const depositAmount1 = "100000000000000000000000";
    const depositAmount2 = "100000000000000000000000";
    const withdrawAmount = "100000000000000000000000";
    const borrowAmount1 = "1000000000000000000";

    await mintableTokenOwner.mint(await wallets[0].getAddress(), mintingAmount);
    await mintableTokenOwner.mint(await wallets[1].getAddress(), mintingAmount);
    await mintableTokenOwner.mint(await wallets[2].getAddress(), mintingAmount);
    await mintableTokenOwner.mint(await wallets[3].getAddress(), mintingAmount);
    await mintableTokenOwner.mint(await wallets[4].getAddress(), mintingAmount);

    await trove.connect(wallets[1]).borrow(accounts[1], borrowAmount1, lastTrove.address);
    await trove1.connect(wallets[1]).borrow(accounts[1], borrowAmount1, lastTrove.address);
    await trove2.connect(wallets[1]).borrow(accounts[1], borrowAmount1, lastTrove.address);
    await trove3.connect(wallets[1]).borrow(accounts[1], borrowAmount1, lastTrove.address);
    await lastTrove.connect(wallets[1]).borrow(accounts[1], borrowAmount1, trove.address);

    await stableCoin.connect(wallets[0]).approve(stabilityPool.address, mintingAmount);
    await stableCoin.connect(wallets[1]).approve(stabilityPool.address, mintingAmount);
    await stableCoin.connect(wallets[2]).approve(stabilityPool.address, mintingAmount);
    await stableCoin.connect(wallets[3]).approve(stabilityPool.address, mintingAmount);
    await stableCoin.connect(wallets[4]).approve(stabilityPool.address, mintingAmount);

    await stabilityPool.connect(wallets[0]).deposit(depositAmount1);
    await stabilityPool.connect(wallets[1]).deposit(depositAmount2);

    await priceFeed.setPrice(DECIMAL_PRECISION.mul(DECIMAL_PRECISION.mul(11)).div(await trove.collateralization()));
    // to make collaterization 1.1

    await expect(trove.liquidate()).to.emit(stabilityPool, "TotalDepositUpdated");

    await expect(stabilityPool.connect(wallets[1]).withdraw(withdrawAmount)).to.emit(stabilityPool, "CollateralRewardRedeemed").to.emit(stabilityPool, "BONQRewardRedeemed");

    let spTotalDeposit = (await stableCoin.balanceOf(stabilityPool.address)).toString();

    await stabilityPool.connect(wallets[2]).deposit(spTotalDeposit);

    await expect(trove1.liquidate()).to.emit(stabilityPool, "TotalDepositUpdated");

    await expect(stabilityPool.connect(wallets[2]).withdraw(withdrawAmount)).to.emit(stabilityPool, "CollateralRewardRedeemed").to.emit(stabilityPool, "BONQRewardRedeemed");
    spTotalDeposit = (await stableCoin.balanceOf(stabilityPool.address)).toString();

    await stabilityPool.connect(wallets[3]).deposit(spTotalDeposit);

    expect(await trove2.liquidate()).to.emit(stabilityPool, "TotalDepositUpdated");

    await expect(stabilityPool.connect(wallets[3]).withdraw(withdrawAmount)).to.emit(stabilityPool, "CollateralRewardRedeemed").to.emit(stabilityPool, "BONQRewardRedeemed");

    spTotalDeposit = (await stableCoin.balanceOf(stabilityPool.address)).toString();

    await stabilityPool.connect(wallets[4]).deposit(spTotalDeposit);

    await expect(trove3.liquidate()).to.emit(stabilityPool, "TotalDepositUpdated");

    await expect(stabilityPool.connect(wallets[0]).withdraw(withdrawAmount)).to.emit(stabilityPool, "CollateralRewardRedeemed").to.emit(stabilityPool, "BONQRewardRedeemed");
    await expect(stabilityPool.connect(wallets[4]).withdraw(withdrawAmount)).to.emit(stabilityPool, "CollateralRewardRedeemed").to.emit(stabilityPool, "BONQRewardRedeemed");

    const firstContCollBalanceBN = await troveToken.balanceOf(accounts[0]);
    const secondContCollBalanceBN = await troveToken.balanceOf(accounts[1]);
    const thirdContCollBalanceBN = await troveToken.balanceOf(accounts[2]);
    const fourthContCollBalanceBN = await troveToken.balanceOf(accounts[3]);
    const fifthContCollBalanceBN = await troveToken.balanceOf(accounts[4]);

    const spCollateralBalanceBN = await troveToken.balanceOf(stabilityPool.address);

    const contributorsBalancesCorrelation21 = firstContCollBalanceBN.div(secondContCollBalanceBN);
    const contributorsBalancesSubtraction32 = Math.abs(thirdContCollBalanceBN.sub(secondContCollBalanceBN).toNumber());
    const contributorsBalancesSubtraction43 = Math.abs(fourthContCollBalanceBN.sub(thirdContCollBalanceBN).toNumber());
    const contributorsBalancesSubtraction54 = Math.abs(fifthContCollBalanceBN.sub(fourthContCollBalanceBN).toNumber());

    const precisionError = 100000;
    expect(contributorsBalancesCorrelation21.toString()).to.be.equal("3");
    expect(contributorsBalancesSubtraction32 < precisionError).to.be.true;
    expect(contributorsBalancesSubtraction43 < precisionError).to.be.true;
    expect(contributorsBalancesSubtraction54 < precisionError).to.be.true;

    expect(spCollateralBalanceBN.toNumber() < 150000).to.be.true;
  });

  it("3 contributors, they can receive shared amount of BONQ", async function () {
    const mintingAmount = "100000000000000000000000";
    const depositAmount1 = "500000000000000000000";
    const depositAmount2 = "500000000000000000000";
    const depositAmount3 = "1000000000000000000000";
    const borrowAmount1 = "1000000000000000000";

    const bonqPerMinute = 40000000000;
    await mintableTokenOwner.mint(await wallets[0].getAddress(), mintingAmount);
    await mintableTokenOwner.mint(await wallets[1].getAddress(), mintingAmount);
    await mintableTokenOwner.mint(await wallets[2].getAddress(), mintingAmount);
    await bonqToken.mint(stabilityPool.address, "2000000000000000000000");

    await stableCoin.connect(wallets[0]).approve(stabilityPool.address, depositAmount1);
    await stableCoin.connect(wallets[1]).approve(stabilityPool.address, depositAmount2);
    await stableCoin.connect(wallets[2]).approve(stabilityPool.address, depositAmount3);

    await stabilityPool.connect(wallets[0]).setBONQAmountForRewards();
    await stabilityPool.connect(wallets[0]).setBONQPerMinute(bonqPerMinute);
    await provider.send("evm_increaseTime", [10 * 60 * 60]); // 1 (but time shift when totalDeposits = 0 must be missed)
    await provider.send("evm_mine", []); // to create new block
    const initialTime = (await provider.getBlock(await provider.getBlockNumber())).timestamp;
    await stabilityPool.connect(wallets[0]).deposit(depositAmount1);
    await provider.send("evm_increaseTime", [10 * 60 * 60]); // 2
    await stabilityPool.connect(wallets[1]).deposit(depositAmount2);
    await provider.send("evm_increaseTime", [10 * 60 * 60]); // 3
    await stabilityPool.connect(wallets[2]).deposit(depositAmount3);
    await provider.send("evm_increaseTime", [10 * 60 * 60]); // 4

    await trove.connect(wallets[1]).borrow(accounts[1], borrowAmount1, lastTrove.address);
    await provider.send("evm_increaseTime", [10 * 60 * 60]); // 5

    await lastTrove.connect(wallets[1]).borrow(accounts[1], borrowAmount1, trove.address);
    await provider.send("evm_increaseTime", [10 * 60 * 60]); // 6

    await priceFeed.setPrice(DECIMAL_PRECISION.mul(DECIMAL_PRECISION.mul(11)).div(await trove.collateralization()));
    // to make collaterization 1.1

    await expect(trove.liquidate()).to.emit(stabilityPool, "TotalDepositUpdated");
    await provider.send("evm_increaseTime", [10 * 60 * 60]); // 7
    await provider.send("evm_mine", []); // to create new block
    const endingTime = (await provider.getBlock(provider.getBlockNumber())).timestamp;

    await expect(stabilityPool.connect(wallets[0]).redeemReward()).to.emit(stabilityPool, "CollateralRewardRedeemed").to.emit(stabilityPool, "BONQRewardRedeemed");

    await expect(stabilityPool.connect(wallets[1]).redeemReward()).to.emit(stabilityPool, "CollateralRewardRedeemed").to.emit(stabilityPool, "BONQRewardRedeemed");

    await expect(stabilityPool.connect(wallets[2]).redeemReward()).to.emit(stabilityPool, "CollateralRewardRedeemed").to.emit(stabilityPool, "BONQRewardRedeemed");

    const firstContCollBalanceBN = await bonqToken.balanceOf(accounts[0]);
    const secondContCollBalanceBN = await bonqToken.balanceOf(accounts[1]);
    const thirdContCollBalanceBN = await bonqToken.balanceOf(accounts[2]);

    const contributorsBONQsum = BigNumber.from(firstContCollBalanceBN).add(BigNumber.from(secondContCollBalanceBN)).add(BigNumber.from(thirdContCollBalanceBN));

    const computedBONQreward = BigNumber.from(endingTime - initialTime)
      .div(60)
      .mul(BigNumber.from(bonqPerMinute));
    expect(contributorsBONQsum).to.be.closeTo(computedBONQreward, bonqPerMinute * 2);
    expect(thirdContCollBalanceBN).to.be.above(secondContCollBalanceBN);
    expect(secondContCollBalanceBN).to.be.below(firstContCollBalanceBN);
  });

  it("when BONQ per minute changes, it only impacts rewards after the change", async function () {
    const mintingAmount = "100000000000000000000000";
    const depositAmount = "1000000000000000000000";
    // let totalBonqForShare = BigNumber.from(0);
    // const increaseTotalShare = (newAmount: BigNumber) => { totalBonqForShare = totalBonqForShare.add(newAmount)}
    const bonqForRewards = BigNumber.from("100000000000000000000000");
    const bonqPerMinute = BigNumber.from("100000000000000000000");

    for (let i = 0; i < 5; i++) {
      await mintableTokenOwner.mint(await wallets[i].getAddress(), mintingAmount);
    }

    for (let i = 0; i < 5; i++) {
      await stableCoin.connect(wallets[i]).approve(stabilityPool.address, depositAmount);
    }

    for (let i = 0; i < 5; i++) {
      await stabilityPool.connect(wallets[i]).deposit(depositAmount);
    }

    await bonqToken.mint(stabilityPool.address, bonqForRewards);
    await stabilityPool.connect(wallets[0]).setBONQAmountForRewards();
    await stabilityPool.connect(wallets[0]).setBONQPerMinute(bonqPerMinute);

    await provider.send("evm_increaseTime", [10 * 60]); // 10 min
    await provider.send("evm_mine", []); // to create new block

    for (let i = 0; i < 5; i++) {
      expect(await stabilityPool.getDepositorBONQGain(await wallets[i].getAddress())).to.equal(bonqPerMinute.mul(10).div(5));
    }

    await stabilityPool.connect(wallets[0]).setBONQPerMinute(bonqPerMinute.mul(2));

    await provider.send("evm_increaseTime", [10 * 60]); // 10 min
    await provider.send("evm_mine", []); // to create new block

    expect(await stabilityPool.getDepositorBONQGain(await wallets[0].getAddress())).to.equal(bonqPerMinute.mul(30).div(5));
  });

  it("5 contributors, BONQ stops distributing when totalBonq ends", async function () {
    const mintingAmount = "100000000000000000000000";
    const depositAmount = "1000000000000000000000";
    // let totalBonqForShare = BigNumber.from(0);
    // const increaseTotalShare = (newAmount: BigNumber) => { totalBonqForShare = totalBonqForShare.add(newAmount)}
    const firstBonqForRewards = BigNumber.from("100000000000000000000000");
    const firstBonqPerMinute = BigNumber.from("100000000000000000000");

    await mintableTokenOwner.mint(await wallets[0].getAddress(), mintingAmount);
    await mintableTokenOwner.mint(await wallets[1].getAddress(), mintingAmount);
    await mintableTokenOwner.mint(await wallets[2].getAddress(), mintingAmount);
    await mintableTokenOwner.mint(await wallets[3].getAddress(), mintingAmount);
    await mintableTokenOwner.mint(await wallets[4].getAddress(), mintingAmount);

    await stableCoin.connect(wallets[0]).approve(stabilityPool.address, depositAmount);
    await stableCoin.connect(wallets[1]).approve(stabilityPool.address, depositAmount);
    await stableCoin.connect(wallets[2]).approve(stabilityPool.address, depositAmount);
    await stableCoin.connect(wallets[3]).approve(stabilityPool.address, depositAmount);
    await stableCoin.connect(wallets[4]).approve(stabilityPool.address, depositAmount);

    await stabilityPool.connect(wallets[0]).deposit(depositAmount);
    await stabilityPool.connect(wallets[1]).deposit(depositAmount);
    await stabilityPool.connect(wallets[2]).deposit(depositAmount);
    await stabilityPool.connect(wallets[3]).deposit(depositAmount);
    await stabilityPool.connect(wallets[4]).deposit(depositAmount);

    await bonqToken.mint(stabilityPool.address, firstBonqForRewards);
    await stabilityPool.connect(wallets[0]).setBONQAmountForRewards();
    await stabilityPool.connect(wallets[0]).setBONQPerMinute(firstBonqPerMinute);

    await provider.send("evm_increaseTime", [10 * 60]); // 10 min
    await provider.send("evm_mine", []); // to create new block

    const bonqRewardView0 = await stabilityPool.getDepositorBONQGain(await wallets[0].getAddress());

    await stableCoin.connect(wallets[0]).approve(stabilityPool.address, toBN(depositAmount).mul(3));
    await stabilityPool.connect(wallets[0]).deposit(toBN(depositAmount).mul(3));

    await provider.send("evm_increaseTime", [10 * 60]); // 10 min
    await provider.send("evm_mine", []); // to create new block

    const bonqRewardView01 = await stabilityPool.getDepositorBONQGain(await wallets[0].getAddress());

    await expect(stabilityPool.connect(wallets[0]).redeemReward()).to.emit(stabilityPool, "BONQRewardRedeemed");

    await expect(stabilityPool.connect(wallets[1]).redeemReward()).to.emit(stabilityPool, "BONQRewardRedeemed");

    await expect(stabilityPool.connect(wallets[2]).redeemReward()).to.emit(stabilityPool, "BONQRewardRedeemed");

    await expect(stabilityPool.connect(wallets[3]).redeemReward()).to.emit(stabilityPool, "BONQRewardRedeemed");

    await expect(stabilityPool.connect(wallets[4]).redeemReward()).to.emit(stabilityPool, "BONQRewardRedeemed");

    let bonqBalanceBNQ0 = await bonqToken.balanceOf(accounts[0]);
    let bonqBalanceBNQ1 = await bonqToken.balanceOf(accounts[1]);
    let bonqBalanceBNQ2 = await bonqToken.balanceOf(accounts[2]);
    let bonqBalanceBNQ3 = await bonqToken.balanceOf(accounts[3]);
    let bonqBalanceBNQ4 = await bonqToken.balanceOf(accounts[4]);
    expect(bonqRewardView0.add(bonqRewardView01)).to.equal(bonqBalanceBNQ0);
    expect(bonqBalanceBNQ0).to.equal(firstBonqPerMinute.mul(7));
    expect(bonqBalanceBNQ1).to.equal(firstBonqPerMinute.mul(325).div(100));
    expect(bonqBalanceBNQ2).to.equal(firstBonqPerMinute.mul(325).div(100));
    expect(bonqBalanceBNQ3).to.equal(firstBonqPerMinute.mul(325).div(100));
    expect(bonqBalanceBNQ4).to.equal(firstBonqPerMinute.mul(325).div(100));

    await provider.send("evm_increaseTime", [1000 * 60]); // 10 min
    await provider.send("evm_mine", []); // to create new block

    const bonqRewardView00 = await stabilityPool.getDepositorBONQGain(await wallets[0].getAddress());
    const bonqRewardView10 = await stabilityPool.getDepositorBONQGain(await wallets[1].getAddress());
    const bonqRewardView20 = await stabilityPool.getDepositorBONQGain(await wallets[2].getAddress());
    const bonqRewardView30 = await stabilityPool.getDepositorBONQGain(await wallets[3].getAddress());
    const bonqRewardView40 = await stabilityPool.getDepositorBONQGain(await wallets[4].getAddress());

    let bonqBalances = bonqBalanceBNQ0.add(bonqBalanceBNQ1).add(bonqBalanceBNQ2).add(bonqBalanceBNQ3).add(bonqBalanceBNQ4);
    const bonqRawards1 = bonqRewardView00.add(bonqRewardView10).add(bonqRewardView20).add(bonqRewardView30).add(bonqRewardView40);

    expect(bonqBalances.add(bonqRawards1)).to.equal(firstBonqForRewards);

    await expect(stabilityPool.connect(wallets[0]).redeemReward()).to.emit(stabilityPool, "BONQRewardRedeemed");

    await expect(stabilityPool.connect(wallets[1]).redeemReward()).to.emit(stabilityPool, "BONQRewardRedeemed");

    await expect(stabilityPool.connect(wallets[2]).redeemReward()).to.emit(stabilityPool, "BONQRewardRedeemed");

    await expect(stabilityPool.connect(wallets[3]).redeemReward()).to.emit(stabilityPool, "BONQRewardRedeemed");

    await expect(stabilityPool.connect(wallets[4]).redeemReward()).to.emit(stabilityPool, "BONQRewardRedeemed");

    bonqBalanceBNQ0 = await bonqToken.balanceOf(accounts[0]);
    bonqBalanceBNQ1 = await bonqToken.balanceOf(accounts[1]);
    bonqBalanceBNQ2 = await bonqToken.balanceOf(accounts[2]);
    bonqBalanceBNQ3 = await bonqToken.balanceOf(accounts[3]);
    bonqBalanceBNQ4 = await bonqToken.balanceOf(accounts[4]);

    bonqBalances = bonqBalanceBNQ0.add(bonqBalanceBNQ1).add(bonqBalanceBNQ2).add(bonqBalanceBNQ3).add(bonqBalanceBNQ4);

    expect(bonqBalances).to.equal(firstBonqForRewards);

    const bonqRewardView02 = await stabilityPool.getDepositorBONQGain(await wallets[0].getAddress());
    const bonqRewardView12 = await stabilityPool.getDepositorBONQGain(await wallets[1].getAddress());
    const bonqRewardView22 = await stabilityPool.getDepositorBONQGain(await wallets[2].getAddress());
    const bonqRewardView32 = await stabilityPool.getDepositorBONQGain(await wallets[3].getAddress());
    const bonqRewardView42 = await stabilityPool.getDepositorBONQGain(await wallets[4].getAddress());
    const bonqRawards2 = bonqRewardView02.add(bonqRewardView12).add(bonqRewardView22).add(bonqRewardView32).add(bonqRewardView42);

    expect(bonqRawards2).to.equal(0);

    await provider.send("evm_increaseTime", [1000 * 60]); // 10 min
    await provider.send("evm_mine", []); // to create new block

    await expect(stabilityPool.connect(wallets[0]).redeemReward()).to.emit(stabilityPool, "BONQRewardRedeemed");

    await expect(stabilityPool.connect(wallets[1]).redeemReward()).to.emit(stabilityPool, "BONQRewardRedeemed");

    await expect(stabilityPool.connect(wallets[2]).redeemReward()).to.emit(stabilityPool, "BONQRewardRedeemed");

    await expect(stabilityPool.connect(wallets[3]).redeemReward()).to.emit(stabilityPool, "BONQRewardRedeemed");

    await expect(stabilityPool.connect(wallets[4]).redeemReward()).to.emit(stabilityPool, "BONQRewardRedeemed");

    bonqBalanceBNQ0 = await bonqToken.balanceOf(accounts[0]);
    bonqBalanceBNQ1 = await bonqToken.balanceOf(accounts[1]);
    bonqBalanceBNQ2 = await bonqToken.balanceOf(accounts[2]);
    bonqBalanceBNQ3 = await bonqToken.balanceOf(accounts[3]);
    bonqBalanceBNQ4 = await bonqToken.balanceOf(accounts[4]);

    const bonqBalances2 = bonqBalanceBNQ0.add(bonqBalanceBNQ1).add(bonqBalanceBNQ2).add(bonqBalanceBNQ3).add(bonqBalanceBNQ4);

    expect(bonqBalances2).to.equal(bonqBalances);
  });

  it("4 contributors, they can receive honest share of BONQ, after series of liquidations, deposits and withdrawals", async function () {
    const mintingAmount = "100000000000000000000000";
    const depositAmount1 = "500000000000000000000";
    const depositAmount2 = "500000000000000000000";
    const depositAmount3 = "500000000000000000000";
    const depositAmount4 = "1000000000000000000000";
    const borrowAmount1 = "1000000000000000000";
    // let totalBonqForShare = BigNumber.from(0);
    // const increaseTotalShare = (newAmount: BigNumber) => { totalBonqForShare = totalBonqForShare.add(newAmount)}
    const firstBonqForRewards = BigNumber.from("2000000000000000000000");
    const firstBonqPerMinute = BigNumber.from(40000000000);
    const secondBonqForRewards = BigNumber.from("500000000000000000000"); // 1/8
    const secondBonqPerMinute = BigNumber.from(5000000000);

    await bonqToken.mint(stabilityPool.address, firstBonqForRewards);
    await mintableTokenOwner.mint(await wallets[0].getAddress(), mintingAmount);
    await mintableTokenOwner.mint(await wallets[1].getAddress(), mintingAmount);
    await mintableTokenOwner.mint(await wallets[2].getAddress(), mintingAmount);
    await mintableTokenOwner.mint(await wallets[3].getAddress(), mintingAmount);

    await stableCoin.connect(wallets[0]).approve(stabilityPool.address, depositAmount1);
    await stableCoin.connect(wallets[1]).approve(stabilityPool.address, depositAmount2);
    await stableCoin.connect(wallets[2]).approve(stabilityPool.address, depositAmount4);
    await stableCoin.connect(wallets[3]).approve(stabilityPool.address, depositAmount4);

    await stabilityPool.connect(wallets[0]).setBONQAmountForRewards();
    await stabilityPool.connect(wallets[0]).setBONQPerMinute(firstBonqPerMinute);
    await provider.send("evm_increaseTime", [10 * 60 * 60]); // 1 (but time shift when totalDeposits = 0 must be missed)
    await provider.send("evm_mine", []); // to create new block
    await stabilityPool.connect(wallets[0]).deposit(depositAmount1); // first user dep 500000000000000000000
    const initialTime1 = (await provider.getBlock(await provider.getBlockNumber())).timestamp;
    await stabilityPool.connect(wallets[1]).deposit(depositAmount2); // second user dep 500000000000000000000
    await provider.send("evm_increaseTime", [10 * 60 * 60]); // +10h left with total dep 1000000000000000000000
    // increaseTotalShare(firstBonqPerMinute.mul(HOURS10));

    await trove.connect(wallets[1]).borrow(accounts[1], borrowAmount1, lastTrove.address);
    await trove1.connect(wallets[1]).borrow(accounts[1], borrowAmount1, lastTrove.address);
    await trove2.connect(wallets[1]).borrow(accounts[1], borrowAmount1, lastTrove.address);
    await trove3.connect(wallets[1]).borrow(accounts[1], borrowAmount1, lastTrove.address);
    await lastTrove.connect(wallets[1]).borrow(accounts[1], borrowAmount1, trove.address);

    await priceFeed.setPrice(DECIMAL_PRECISION.mul(DECIMAL_PRECISION.mul(11)).div(await trove.collateralization()));
    // to make collaterization 1.1
    // error for future totalDeposits could be near 0.00005

    await expect(trove.liquidate()).to.emit(stabilityPool, "TotalDepositUpdated"); // total dep 1000000000000000000000 - 50000000000000000
    await provider.send("evm_increaseTime", [10 * 60 * 60]); // +10h left with total dep 999950000000000000000 ()

    await expect(stabilityPool.connect(wallets[1]).withdraw(depositAmount2)) // second user dep now 0
      .to.emit(stabilityPool, "BONQRewardRedeemed"); // but must be rewarded

    await stabilityPool.connect(wallets[2]).deposit(depositAmount3); // third user dep 500000000000000000000
    await provider.send("evm_increaseTime", [10 * 60 * 60]); // +10h left with total dep 999975000000000000000

    await expect(stabilityPool.connect(wallets[2]).deposit(depositAmount3)) // third user total dep 1000000000000000000000
      .to.emit(stabilityPool, "BONQRewardRedeemed");
    await expect(stabilityPool.connect(wallets[3]).deposit(depositAmount4)) // fourth user dep 1000000000000000000000
      .to.emit(stabilityPool, "BONQRewardRedeemed");
    await provider.send("evm_increaseTime", [30 * 60 * 60]); // +30h left with total dep 2499975000000000000000
    await provider.send("evm_mine", []); // to create new block

    const endingTime1 = (await provider.getBlock(provider.getBlockNumber())).timestamp; // total +- 60h left

    const bonqRewardView0 = await stabilityPool.getDepositorBONQGain(await wallets[0].getAddress());
    await expect(stabilityPool.connect(wallets[0]).redeemReward()) // 1/3 * 1/2 + 1/6 * 1/2 + 1/2 * 1/5 = 0.35
      .to.emit(stabilityPool, "BONQRewardRedeemed");

    await expect(stabilityPool.connect(wallets[1]).redeemReward()) // 1/3 * 1/2 = 0.16(6)...
      .to.emit(stabilityPool, "BONQRewardRedeemed");

    await expect(stabilityPool.connect(wallets[2]).redeemReward()) // 1/6 * 1/2 + 1/2 * 2/5 = 0.28(3)...
      .to.emit(stabilityPool, "BONQRewardRedeemed");

    await expect(stabilityPool.connect(wallets[3]).redeemReward()) // 1/2 * 2/5 = 0.2
      .to.emit(stabilityPool, "BONQRewardRedeemed");
    const firstBalanceBNQ1 = await bonqToken.balanceOf(accounts[0]);
    const secondBalanceBNQ1 = await bonqToken.balanceOf(accounts[1]);
    const thirdBalanceBNQ1 = await bonqToken.balanceOf(accounts[2]);
    const fourthBalanceBNQ1 = await bonqToken.balanceOf(accounts[3]);
    const computedBONQreward1 = BigNumber.from(endingTime1 - initialTime1)
      .div(60)
      .mul(BigNumber.from(firstBonqPerMinute));

    expect(bonqRewardView0).to.equal(firstBalanceBNQ1);

    expect(secondBalanceBNQ1.add(thirdBalanceBNQ1)).to.be.closeTo(firstBalanceBNQ1.add(fourthBalanceBNQ1.div(2)), firstBonqPerMinute.mul(2).toNumber());

    expect(firstBalanceBNQ1.add(secondBalanceBNQ1).add(thirdBalanceBNQ1).add(fourthBalanceBNQ1)).to.be.closeTo(computedBONQreward1, firstBonqPerMinute.mul(2).toNumber());

    await bonqToken.mint(stabilityPool.address, secondBonqForRewards);
    await stabilityPool.connect(wallets[0]).setBONQAmountForRewards();
    await stabilityPool.connect(wallets[0]).setBONQPerMinute(secondBonqPerMinute);

    const initialTime2 = (await provider.getBlock(await provider.getBlockNumber())).timestamp;
    await provider.send("evm_increaseTime", [10 * 60 * 60]); //

    await stableCoin.connect(wallets[1]).approve(stabilityPool.address, depositAmount2);
    await expect(stabilityPool.connect(wallets[1]).deposit(depositAmount2)).to.emit(stabilityPool, "BONQRewardRedeemed");

    await provider.send("evm_increaseTime", [200 * 60 * 60]); //
    await provider.send("evm_mine", []); // to create new block

    const endingTime2 = (await provider.getBlock(provider.getBlockNumber())).timestamp;

    await expect(stabilityPool.connect(wallets[0]).redeemReward()).to.emit(stabilityPool, "BONQRewardRedeemed");

    await expect(stabilityPool.connect(wallets[1]).redeemReward()).to.emit(stabilityPool, "BONQRewardRedeemed");

    await expect(stabilityPool.connect(wallets[2]).redeemReward()).to.emit(stabilityPool, "BONQRewardRedeemed");

    await expect(stabilityPool.connect(wallets[3]).redeemReward()).to.emit(stabilityPool, "BONQRewardRedeemed");

    const computedBONQreward2 = BigNumber.from(endingTime2 - initialTime2)
      .div(60)
      .mul(BigNumber.from(secondBonqPerMinute));

    const firstBalanceBNQ = await bonqToken.balanceOf(accounts[0]);
    const secondBalanceBNQ = await bonqToken.balanceOf(accounts[1]);
    const thirdBalanceBNQ = await bonqToken.balanceOf(accounts[2]);
    const fourthBalanceBNQ = await bonqToken.balanceOf(accounts[3]);

    const contributorsBONQsum = BigNumber.from(firstBalanceBNQ).add(BigNumber.from(secondBalanceBNQ)).add(BigNumber.from(thirdBalanceBNQ)).add(BigNumber.from(fourthBalanceBNQ));

    const computedBONQrewardFinal = computedBONQreward1.add(computedBONQreward2);
    const error_of_time = firstBonqPerMinute.add(secondBonqPerMinute);
    expect(contributorsBONQsum).to.be.closeTo(computedBONQrewardFinal, error_of_time.mul(2).toNumber());
  });

  it("bonq token can be replaced in upgrade", async function () {
    const newBnq = (await deployContract(wallets[0], "MintableToken", ["New BNQ", "NBNQ"])) as MintableToken;
    // ReplacementStabilityPool
    stabilityPool = (await upgradeUUPSContract(stabilityPool as Contract, wallets[0], "ReplacementStabilityPoolUniswap", [
      troveFactory.address,
      newBnq.address
    ])) as StabilityPoolUniswap;

    expect(await stabilityPool.bonqToken()).to.be.equal(newBnq.address);
  });

  it("Stake rewards remain after upgrade", async function () {
    const mintingAmount = "100000000000000000000000";
    const depositAmount1 = "1000000000000000000000";
    const depositAmount2 = "1000000000000000000000";
    const borrowAmount1 = "1000000000000000000";
    await mintableTokenOwner.mint(await wallets[0].getAddress(), mintingAmount);
    await mintableTokenOwner.mint(await wallets[1].getAddress(), mintingAmount);

    await stableCoin.connect(wallets[0]).approve(stabilityPool.address, depositAmount1);
    await stableCoin.connect(wallets[1]).approve(stabilityPool.address, depositAmount2);

    await stabilityPool.connect(wallets[0]).deposit(depositAmount1);
    await stabilityPool.connect(wallets[1]).deposit(depositAmount2);

    await trove.connect(wallets[1]).borrow(accounts[1], borrowAmount1, lastTrove.address);
    await lastTrove.connect(wallets[1]).borrow(accounts[1], borrowAmount1, trove.address);

    await priceFeed.setPrice(DECIMAL_PRECISION.mul(DECIMAL_PRECISION.mul(11)).div(await trove.collateralization()));
    // to make collaterization 1.1

    await expect(trove.liquidate()).to.emit(stabilityPool, "TotalDepositUpdated");

    // ReplacementStabilityPool
    stabilityPool = (await upgradeUUPSContract(stabilityPool as Contract, wallets[0], "ReplacementStabilityPoolUniswap", [
      troveFactory.address,
      bonqToken.address
    ])) as StabilityPoolUniswap;

    await expect(stabilityPool.connect(wallets[0]).redeemReward()).to.emit(stabilityPool, "CollateralRewardRedeemed").to.emit(stabilityPool, "BONQRewardRedeemed");

    await expect(stabilityPool.connect(wallets[1]).redeemReward()).to.emit(stabilityPool, "CollateralRewardRedeemed").to.emit(stabilityPool, "BONQRewardRedeemed");

    const firstContCollBalanceBN = await troveToken.balanceOf(accounts[0]);
    const secondContCollBalanceBN = await troveToken.balanceOf(accounts[1]);
    const contributorsBalancesCorrelation = secondContCollBalanceBN.div(firstContCollBalanceBN);
    expect(contributorsBalancesCorrelation.toString()).of.be.equal("1");
  });
});
