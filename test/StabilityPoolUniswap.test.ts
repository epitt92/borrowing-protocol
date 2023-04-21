import { expect, use } from "chai";
import { solidity } from "ethereum-waffle";
import { BigNumber, Contract, Signer } from "ethers";
import { Trove, StabilityPoolUniswap } from "../src/types";
import { DECIMAL_PRECISION, toBN, upgradeUUPSContract } from "./utils/helpers";
import { describe } from "mocha";
import { ethers } from "hardhat";
import { UniswapV3StabilityPoolArbitrageTest } from "./utils/UniswapV3StabilityPoolArbitrageTest";

use(solidity);

describe("Stability Pool Uniswap", function () {
  this.timeout(100000);
  const sut = new UniswapV3StabilityPoolArbitrageTest(ethers);
  const provider = sut.eth.provider;

  let wallets: Signer[];
  let accounts: string[];
  let trove: Trove;
  let trove1: Trove;
  let trove2: Trove;
  let trove3: Trove;
  let lastTrove: Trove;

  before(async function () {
    await sut.ready;
    await sut.setup();
    wallets = sut.wallets;
    accounts = sut.accounts;
  });

  after(async function () {
    await sut.teardown();
  });

  beforeEach(async function () {
    await sut.revert();

    await sut.troveFactory.connect(wallets[1]).createTrove(sut.troveToken.address);
    await sut.troveFactory.connect(wallets[1]).createTrove(sut.troveToken.address);
    await sut.troveFactory.connect(wallets[1]).createTrove(sut.troveToken.address);
    await sut.troveFactory.connect(wallets[1]).createTrove(sut.troveToken.address);
    await sut.troveFactory.connect(wallets[1]).createTrove(sut.troveToken.address);

    const TroveContract = await ethers.getContractFactory("Trove");
    trove = TroveContract.attach(await sut.troveFactory.firstTrove(sut.troveToken.address)) as Trove;
    trove1 = TroveContract.attach(await sut.troveFactory.nextTrove(sut.troveToken.address, trove.address)) as Trove;
    trove2 = TroveContract.attach(await sut.troveFactory.nextTrove(sut.troveToken.address, trove1.address)) as Trove;
    trove3 = TroveContract.attach(await sut.troveFactory.nextTrove(sut.troveToken.address, trove2.address)) as Trove;
    lastTrove = TroveContract.attach(await sut.troveFactory.lastTrove(sut.troveToken.address)) as Trove;

    await sut.troveToken.mint(trove.address, "10000000000000000000");
    await sut.troveToken.mint(trove1.address, "10000000000000000000");
    await sut.troveToken.mint(trove2.address, "10000000000000000000");
    await sut.troveToken.mint(trove3.address, "10000000000000000000");
    await sut.troveToken.mint(lastTrove.address, "10000000000000000000");
  });

  it("can receive deposits", async function () {
    const mintingAmount = "100000000000000000000";
    const depositAmount = "100000000000000000";
    await sut.mintableTokenOwner.mint(await wallets[0].getAddress(), mintingAmount);

    await sut.stableCoin.connect(wallets[0]).approve(sut.stabilityPool.address, depositAmount);

    await expect(sut.stabilityPool.connect(wallets[0]).deposit(depositAmount))
      .to.emit(sut.stabilityPool, "Deposit")
      .withArgs(await wallets[0].getAddress(), depositAmount);
  });

  it("contributor cannot perform deposit with 0 value", async function () {
    const depositAmount = "0";
    await sut.stableCoin.connect(wallets[0]).approve(sut.stabilityPool.address, depositAmount);
    await expect(sut.stabilityPool.connect(wallets[0]).deposit(depositAmount)).to.be.revertedWith("d87c1 deposit amount must be bigger than zero");
  });

  it("contributor can perform withdraw", async function () {
    const mintingAmount = "100000000000000000000";
    const withdrawAmount = "100000000000000000";
    await sut.mintableTokenOwner.mint(await wallets[0].getAddress(), mintingAmount);

    await sut.stableCoin.connect(wallets[0]).approve(sut.stabilityPool.address, withdrawAmount);
    await sut.stabilityPool.connect(wallets[0]).deposit(withdrawAmount);

    await expect(sut.stabilityPool.connect(wallets[0]).withdraw(withdrawAmount))
      .to.emit(sut.stabilityPool, "Withdraw")
      .withArgs(await wallets[0].getAddress(), withdrawAmount);
    expect(await sut.stableCoin.balanceOf(accounts[0])).to.be.equal(mintingAmount);
  });

  it("contributor cannot perform withdraw without deposit", async function () {
    const mintingAmount = "100000000000000000000";
    const withdrawAmount = "100000000000000000";
    await sut.mintableTokenOwner.mint(await wallets[0].getAddress(), mintingAmount);

    await sut.stableCoin.connect(wallets[0]).approve(sut.stabilityPool.address, withdrawAmount);

    await expect(sut.stabilityPool.connect(wallets[0]).withdraw(withdrawAmount)).to.be.revertedWith("f6c8a user has no deposit");
  });

  it("stabilityPool is not used when TCR <= 100%", async function () {
    const mintingAmount = "100000000000000000000000";
    const depositAmount = "1000000000000000000000";
    await sut.mintableTokenOwner.mint(await wallets[0].getAddress(), mintingAmount);

    await sut.stableCoin.connect(wallets[0]).approve(sut.stabilityPool.address, depositAmount);
    await sut.stabilityPool.connect(wallets[0]).deposit(depositAmount);
    await trove.connect(wallets[1]).borrow(accounts[1], await trove.collateral(), lastTrove.address);
    await lastTrove.connect(wallets[1]).borrow(accounts[1], await lastTrove.collateral(), trove.address);
    // to make collaterization = 1
    await sut.priceFeed.setPrice(DECIMAL_PRECISION.mul(DECIMAL_PRECISION.mul(10)).div(await trove.collateralization()));
    await expect(trove.liquidate()).to.not.emit(sut.stabilityPool, "TotalDepositUpdated");
    const collateralInSP = await sut.troveToken.balanceOf(sut.stabilityPool.address);
    expect(collateralInSP).to.equal(0);
    const collateral = await trove.collateral();
    expect(collateral).to.equal(0);
  });

  it("contributor can receive full share after trove liquidation", async function () {
    const mintingAmount = "100000000000000000000000";
    const depositAmount = "1000000000000000000000";
    await sut.mintableTokenOwner.mint(await wallets[0].getAddress(), mintingAmount);

    await sut.stableCoin.connect(wallets[0]).approve(sut.stabilityPool.address, depositAmount);
    await sut.stabilityPool.connect(wallets[0]).deposit(depositAmount);
    await trove.connect(wallets[1]).borrow(accounts[1], await trove.collateral(), lastTrove.address);
    await lastTrove.connect(wallets[1]).borrow(accounts[1], await lastTrove.collateral(), trove.address);
    // to make collaterization 1.1
    await sut.priceFeed.setPrice(DECIMAL_PRECISION.mul(DECIMAL_PRECISION.mul(11)).div(await trove.collateralization()));
    const collateral = (await trove.collateral()).toString();
    await trove.liquidate();
    const collateralInSP = (await sut.troveToken.balanceOf(sut.stabilityPool.address)).toString();
    expect(collateralInSP).to.be.equal(collateral);
  });

  it("2 contributors, each can receive 50% of pool collateral", async function () {
    const mintingAmount = "100000000000000000000000";
    const depositAmount1 = "1000000000000000000000";
    const depositAmount2 = "1000000000000000000000";
    const borrowAmount1 = "1000000000000000000";
    await sut.mintableTokenOwner.mint(await wallets[0].getAddress(), mintingAmount);
    await sut.mintableTokenOwner.mint(await wallets[1].getAddress(), mintingAmount);

    await sut.stableCoin.connect(wallets[0]).approve(sut.stabilityPool.address, depositAmount1);
    await sut.stableCoin.connect(wallets[1]).approve(sut.stabilityPool.address, depositAmount2);

    await sut.stabilityPool.connect(wallets[0]).deposit(depositAmount1);
    await sut.stabilityPool.connect(wallets[1]).deposit(depositAmount2);

    await trove.connect(wallets[1]).borrow(accounts[1], borrowAmount1, lastTrove.address);
    await lastTrove.connect(wallets[1]).borrow(accounts[1], borrowAmount1, trove.address);

    await sut.priceFeed.setPrice(DECIMAL_PRECISION.mul(DECIMAL_PRECISION.mul(11)).div(await trove.collateralization()));
    // to make collaterization 1.1

    await expect(trove.liquidate()).to.emit(sut.stabilityPool, "TotalDepositUpdated");

    await expect(sut.stabilityPool.connect(wallets[0]).redeemReward()).to.emit(sut.stabilityPool, "CollateralRewardRedeemed").to.emit(sut.stabilityPool, "BONQRewardRedeemed");

    await expect(sut.stabilityPool.connect(wallets[1]).redeemReward()).to.emit(sut.stabilityPool, "CollateralRewardRedeemed").to.emit(sut.stabilityPool, "BONQRewardRedeemed");

    const firstContCollBalanceBN = await sut.troveToken.balanceOf(accounts[0]);
    const secondContCollBalanceBN = await sut.troveToken.balanceOf(accounts[1]);
    const contributorsBalancesCorrelation = secondContCollBalanceBN.div(firstContCollBalanceBN);
    expect(contributorsBalancesCorrelation.toString()).of.be.equal("1");
  });

  it("2 contributors, they can receive 25%, 75% of pool collateral respectively with factory total debt updated", async function () {
    const mintingAmount = "100000000000000000000000";
    const depositAmount1 = "500000000000000000000";
    const depositAmount2 = "1500000000000000000000";
    const borrowAmount1 = "1000000000000000000";

    await sut.mintableTokenOwner.mint(await wallets[0].getAddress(), mintingAmount);
    await sut.mintableTokenOwner.mint(await wallets[1].getAddress(), mintingAmount);

    await sut.stableCoin.connect(wallets[0]).approve(sut.stabilityPool.address, depositAmount1);
    await sut.stableCoin.connect(wallets[1]).approve(sut.stabilityPool.address, depositAmount2);

    await sut.stabilityPool.connect(wallets[0]).deposit(depositAmount1);
    await sut.stabilityPool.connect(wallets[1]).deposit(depositAmount2);

    await trove.connect(wallets[1]).borrow(accounts[1], borrowAmount1, lastTrove.address);
    await lastTrove.connect(wallets[1]).borrow(accounts[1], borrowAmount1, trove.address);
    const startTotalDebt = await sut.troveFactory.totalDebt();
    const troveDebt = await trove.debt();

    await sut.priceFeed.setPrice(DECIMAL_PRECISION.mul(DECIMAL_PRECISION.mul(11)).div(await trove.collateralization()));
    // to make collaterization 1.1

    await expect(trove.liquidate()).to.emit(sut.stabilityPool, "TotalDepositUpdated");

    await expect(sut.stabilityPool.connect(wallets[0]).redeemReward()).to.emit(sut.stabilityPool, "CollateralRewardRedeemed").to.emit(sut.stabilityPool, "BONQRewardRedeemed");

    await expect(sut.stabilityPool.connect(wallets[1]).redeemReward()).to.emit(sut.stabilityPool, "CollateralRewardRedeemed").to.emit(sut.stabilityPool, "BONQRewardRedeemed");

    const firstContCollBalanceBN = await sut.troveToken.balanceOf(accounts[0]);
    const secondContCollBalanceBN = await sut.troveToken.balanceOf(accounts[1]);
    const contributorsBalancesCorrelation = secondContCollBalanceBN.div(firstContCollBalanceBN);
    const expectedFinishTotalDebt = startTotalDebt.sub(troveDebt);
    const actualTotalDebt = await sut.troveFactory.totalDebt();

    expect(contributorsBalancesCorrelation.toString()).to.be.equal("3");
    expect(expectedFinishTotalDebt).to.be.equal(actualTotalDebt);
  });

  it("3 contributors, they can receive 25%, 25%, 50% of pool collateral respectively", async function () {
    const mintingAmount = "100000000000000000000000";
    const depositAmount1 = "500000000000000000000";
    const depositAmount2 = "500000000000000000000";
    const depositAmount3 = "1000000000000000000000";
    const borrowAmount1 = "1000000000000000000";

    await sut.mintableTokenOwner.mint(await wallets[0].getAddress(), mintingAmount);
    await sut.mintableTokenOwner.mint(await wallets[1].getAddress(), mintingAmount);
    await sut.mintableTokenOwner.mint(await wallets[2].getAddress(), mintingAmount);

    await sut.stableCoin.connect(wallets[0]).approve(sut.stabilityPool.address, depositAmount1);
    await sut.stableCoin.connect(wallets[1]).approve(sut.stabilityPool.address, depositAmount2);
    await sut.stableCoin.connect(wallets[2]).approve(sut.stabilityPool.address, depositAmount3);

    await sut.stabilityPool.connect(wallets[0]).deposit(depositAmount1);
    await sut.stabilityPool.connect(wallets[1]).deposit(depositAmount2);
    await sut.stabilityPool.connect(wallets[2]).deposit(depositAmount3);

    await trove.connect(wallets[1]).borrow(accounts[1], borrowAmount1, lastTrove.address);
    await lastTrove.connect(wallets[1]).borrow(accounts[1], borrowAmount1, trove.address);

    await sut.priceFeed.setPrice(DECIMAL_PRECISION.mul(DECIMAL_PRECISION.mul(11)).div(await trove.collateralization()));
    // to make collaterization 1.1

    await expect(trove.liquidate()).to.emit(sut.stabilityPool, "TotalDepositUpdated");

    const redeemAmount1BN = await sut.stabilityPool.getCollateralReward(sut.troveToken.address, accounts[0]);
    const redeemAmount2BN = await sut.stabilityPool.getCollateralReward(sut.troveToken.address, accounts[1]);
    const redeemAmount3BN = await sut.stabilityPool.getCollateralReward(sut.troveToken.address, accounts[2]);

    await expect(sut.stabilityPool.connect(wallets[0]).redeemReward()).to.emit(sut.stabilityPool, "CollateralRewardRedeemed").to.emit(sut.stabilityPool, "BONQRewardRedeemed");
    await expect(sut.stabilityPool.connect(wallets[1]).redeemReward()).to.emit(sut.stabilityPool, "CollateralRewardRedeemed").to.emit(sut.stabilityPool, "BONQRewardRedeemed");
    await expect(sut.stabilityPool.connect(wallets[2]).redeemReward()).to.emit(sut.stabilityPool, "CollateralRewardRedeemed").to.emit(sut.stabilityPool, "BONQRewardRedeemed");

    const firstContCollBalanceBN = await sut.troveToken.balanceOf(accounts[0]);
    const secondContCollBalanceBN = await sut.troveToken.balanceOf(accounts[1]);
    const thirdContCollBalanceBN = await sut.troveToken.balanceOf(accounts[2]);

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

    await sut.mintableTokenOwner.mint(await wallets[0].getAddress(), mintingAmount);
    await sut.mintableTokenOwner.mint(await wallets[1].getAddress(), mintingAmount);
    await sut.mintableTokenOwner.mint(await wallets[2].getAddress(), mintingAmount);
    await sut.mintableTokenOwner.mint(await wallets[3].getAddress(), mintingAmount);
    await sut.mintableTokenOwner.mint(await wallets[4].getAddress(), mintingAmount);

    await trove.connect(wallets[1]).borrow(accounts[1], borrowAmount1, lastTrove.address);
    await trove1.connect(wallets[1]).borrow(accounts[1], borrowAmount1, lastTrove.address);
    await trove2.connect(wallets[1]).borrow(accounts[1], borrowAmount1, lastTrove.address);
    await trove3.connect(wallets[1]).borrow(accounts[1], borrowAmount1, lastTrove.address);
    await lastTrove.connect(wallets[1]).borrow(accounts[1], borrowAmount1, trove.address);

    await sut.stableCoin.connect(wallets[0]).approve(sut.stabilityPool.address, mintingAmount);
    await sut.stableCoin.connect(wallets[1]).approve(sut.stabilityPool.address, mintingAmount);
    await sut.stableCoin.connect(wallets[2]).approve(sut.stabilityPool.address, mintingAmount);
    await sut.stableCoin.connect(wallets[3]).approve(sut.stabilityPool.address, mintingAmount);
    await sut.stableCoin.connect(wallets[4]).approve(sut.stabilityPool.address, mintingAmount);

    await sut.stabilityPool.connect(wallets[0]).deposit(depositAmount1);
    await sut.stabilityPool.connect(wallets[1]).deposit(depositAmount2);

    await sut.priceFeed.setPrice(DECIMAL_PRECISION.mul(DECIMAL_PRECISION.mul(11)).div(await trove.collateralization()));
    // to make collaterization 1.1

    await expect(trove.liquidate()).to.emit(sut.stabilityPool, "TotalDepositUpdated");

    await expect(sut.stabilityPool.connect(wallets[1]).withdraw(withdrawAmount))
      .to.emit(sut.stabilityPool, "CollateralRewardRedeemed")
      .to.emit(sut.stabilityPool, "BONQRewardRedeemed");

    let spTotalDeposit = (await sut.stableCoin.balanceOf(sut.stabilityPool.address)).toString();

    await sut.stabilityPool.connect(wallets[2]).deposit(spTotalDeposit);

    await expect(trove1.liquidate()).to.emit(sut.stabilityPool, "TotalDepositUpdated");

    await expect(sut.stabilityPool.connect(wallets[2]).withdraw(withdrawAmount))
      .to.emit(sut.stabilityPool, "CollateralRewardRedeemed")
      .to.emit(sut.stabilityPool, "BONQRewardRedeemed");
    spTotalDeposit = (await sut.stableCoin.balanceOf(sut.stabilityPool.address)).toString();

    await sut.stabilityPool.connect(wallets[3]).deposit(spTotalDeposit);

    expect(await trove2.liquidate()).to.emit(sut.stabilityPool, "TotalDepositUpdated");

    await expect(sut.stabilityPool.connect(wallets[3]).withdraw(withdrawAmount))
      .to.emit(sut.stabilityPool, "CollateralRewardRedeemed")
      .to.emit(sut.stabilityPool, "BONQRewardRedeemed");

    spTotalDeposit = (await sut.stableCoin.balanceOf(sut.stabilityPool.address)).toString();

    await sut.stabilityPool.connect(wallets[4]).deposit(spTotalDeposit);

    await expect(trove3.liquidate()).to.emit(sut.stabilityPool, "TotalDepositUpdated");

    await expect(sut.stabilityPool.connect(wallets[0]).withdraw(withdrawAmount))
      .to.emit(sut.stabilityPool, "CollateralRewardRedeemed")
      .to.emit(sut.stabilityPool, "BONQRewardRedeemed");
    await expect(sut.stabilityPool.connect(wallets[4]).withdraw(withdrawAmount))
      .to.emit(sut.stabilityPool, "CollateralRewardRedeemed")
      .to.emit(sut.stabilityPool, "BONQRewardRedeemed");

    const firstContCollBalanceBN = await sut.troveToken.balanceOf(accounts[0]);
    const secondContCollBalanceBN = await sut.troveToken.balanceOf(accounts[1]);
    const thirdContCollBalanceBN = await sut.troveToken.balanceOf(accounts[2]);
    const fourthContCollBalanceBN = await sut.troveToken.balanceOf(accounts[3]);
    const fifthContCollBalanceBN = await sut.troveToken.balanceOf(accounts[4]);

    const spCollateralBalanceBN = await sut.troveToken.balanceOf(sut.stabilityPool.address);

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
    await sut.bonqToken.mint(sut.stabilityPool.address, "2000000000000000000000");
    await sut.mintableTokenOwner.mint(await wallets[0].getAddress(), mintingAmount);
    await sut.mintableTokenOwner.mint(await wallets[1].getAddress(), mintingAmount);
    await sut.mintableTokenOwner.mint(await wallets[2].getAddress(), mintingAmount);

    await sut.stableCoin.connect(wallets[0]).approve(sut.stabilityPool.address, depositAmount1);
    await sut.stableCoin.connect(wallets[1]).approve(sut.stabilityPool.address, depositAmount2);
    await sut.stableCoin.connect(wallets[2]).approve(sut.stabilityPool.address, depositAmount3);

    await sut.stabilityPool.connect(wallets[0]).setBONQAmountForRewards();
    await sut.stabilityPool.connect(wallets[0]).setBONQPerMinute(bonqPerMinute);
    await provider.send("evm_increaseTime", [10 * 60 * 60]); // 1 (but time shift when totalDeposits = 0 must be missed)
    await provider.send("evm_mine", []); // to create new block
    const initialTime = (await provider.getBlock(await provider.getBlockNumber())).timestamp;
    await sut.stabilityPool.connect(wallets[0]).deposit(depositAmount1);
    await provider.send("evm_increaseTime", [10 * 60 * 60]); // 2
    await sut.stabilityPool.connect(wallets[1]).deposit(depositAmount2);
    await provider.send("evm_increaseTime", [10 * 60 * 60]); // 3
    await sut.stabilityPool.connect(wallets[2]).deposit(depositAmount3);
    await provider.send("evm_increaseTime", [10 * 60 * 60]); // 4

    await trove.connect(wallets[1]).borrow(accounts[1], borrowAmount1, lastTrove.address);
    await provider.send("evm_increaseTime", [10 * 60 * 60]); // 5

    await lastTrove.connect(wallets[1]).borrow(accounts[1], borrowAmount1, trove.address);
    await provider.send("evm_increaseTime", [10 * 60 * 60]); // 6

    await sut.priceFeed.setPrice(DECIMAL_PRECISION.mul(DECIMAL_PRECISION.mul(11)).div(await trove.collateralization()));
    // to make collaterization 1.1

    await expect(trove.liquidate()).to.emit(sut.stabilityPool, "TotalDepositUpdated");
    await provider.send("evm_increaseTime", [10 * 60 * 60]); // 7
    await provider.send("evm_mine", []); // to create new block
    const endingTime = (await provider.getBlock(provider.getBlockNumber())).timestamp;

    await expect(sut.stabilityPool.connect(wallets[0]).redeemReward()).to.emit(sut.stabilityPool, "CollateralRewardRedeemed").to.emit(sut.stabilityPool, "BONQRewardRedeemed");

    await expect(sut.stabilityPool.connect(wallets[1]).redeemReward()).to.emit(sut.stabilityPool, "CollateralRewardRedeemed").to.emit(sut.stabilityPool, "BONQRewardRedeemed");

    await expect(sut.stabilityPool.connect(wallets[2]).redeemReward()).to.emit(sut.stabilityPool, "CollateralRewardRedeemed").to.emit(sut.stabilityPool, "BONQRewardRedeemed");

    const firstContCollBalanceBN = await sut.bonqToken.balanceOf(accounts[0]);
    const secondContCollBalanceBN = await sut.bonqToken.balanceOf(accounts[1]);
    const thirdContCollBalanceBN = await sut.bonqToken.balanceOf(accounts[2]);

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
      await sut.mintableTokenOwner.mint(await wallets[i].getAddress(), mintingAmount);
    }

    for (let i = 0; i < 5; i++) {
      await sut.stableCoin.connect(wallets[i]).approve(sut.stabilityPool.address, depositAmount);
    }

    for (let i = 0; i < 5; i++) {
      await sut.stabilityPool.connect(wallets[i]).deposit(depositAmount);
    }

    await sut.bonqToken.mint(sut.stabilityPool.address, bonqForRewards);
    await sut.stabilityPool.connect(wallets[0]).setBONQAmountForRewards();
    await sut.stabilityPool.connect(wallets[0]).setBONQPerMinute(bonqPerMinute);

    await provider.send("evm_increaseTime", [10 * 60]); // 10 min
    await provider.send("evm_mine", []); // to create new block

    for (let i = 0; i < 5; i++) {
      expect(await sut.stabilityPool.getDepositorBONQGain(await wallets[i].getAddress())).to.equal(bonqPerMinute.mul(10).div(5));
    }

    await sut.stabilityPool.connect(wallets[0]).setBONQPerMinute(bonqPerMinute.mul(2));

    await provider.send("evm_increaseTime", [10 * 60]); // 10 min
    await provider.send("evm_mine", []); // to create new block

    expect(await sut.stabilityPool.getDepositorBONQGain(await wallets[0].getAddress())).to.equal(bonqPerMinute.mul(30).div(5));
  });

  it("5 contributors, BONQ stops distributing when totalBonq ends", async function () {
    const mintingAmount = "100000000000000000000000";
    const depositAmount = "1000000000000000000000";
    // let totalBonqForShare = BigNumber.from(0);
    // const increaseTotalShare = (newAmount: BigNumber) => { totalBonqForShare = totalBonqForShare.add(newAmount)}
    const firstBonqForRewards = BigNumber.from("100000000000000000000000");
    const firstBonqPerMinute = BigNumber.from("100000000000000000000");

    await sut.mintableTokenOwner.mint(await wallets[0].getAddress(), mintingAmount);
    await sut.mintableTokenOwner.mint(await wallets[1].getAddress(), mintingAmount);
    await sut.mintableTokenOwner.mint(await wallets[2].getAddress(), mintingAmount);
    await sut.mintableTokenOwner.mint(await wallets[3].getAddress(), mintingAmount);
    await sut.mintableTokenOwner.mint(await wallets[4].getAddress(), mintingAmount);

    await sut.stableCoin.connect(wallets[0]).approve(sut.stabilityPool.address, depositAmount);
    await sut.stableCoin.connect(wallets[1]).approve(sut.stabilityPool.address, depositAmount);
    await sut.stableCoin.connect(wallets[2]).approve(sut.stabilityPool.address, depositAmount);
    await sut.stableCoin.connect(wallets[3]).approve(sut.stabilityPool.address, depositAmount);
    await sut.stableCoin.connect(wallets[4]).approve(sut.stabilityPool.address, depositAmount);

    await sut.stabilityPool.connect(wallets[0]).deposit(depositAmount);
    await sut.stabilityPool.connect(wallets[1]).deposit(depositAmount);
    await sut.stabilityPool.connect(wallets[2]).deposit(depositAmount);
    await sut.stabilityPool.connect(wallets[3]).deposit(depositAmount);
    await sut.stabilityPool.connect(wallets[4]).deposit(depositAmount);

    await sut.bonqToken.mint(sut.stabilityPool.address, firstBonqForRewards);
    await sut.stabilityPool.connect(wallets[0]).setBONQAmountForRewards();
    await sut.stabilityPool.connect(wallets[0]).setBONQPerMinute(firstBonqPerMinute);

    await provider.send("evm_increaseTime", [10 * 60]); // 10 min
    await provider.send("evm_mine", []); // to create new block

    const bonqRewardView0 = await sut.stabilityPool.getDepositorBONQGain(await wallets[0].getAddress());

    await sut.stableCoin.connect(wallets[0]).approve(sut.stabilityPool.address, toBN(depositAmount).mul(3));
    await sut.stabilityPool.connect(wallets[0]).deposit(toBN(depositAmount).mul(3));

    await provider.send("evm_increaseTime", [10 * 60]); // 10 min
    await provider.send("evm_mine", []); // to create new block

    const bonqRewardView01 = await sut.stabilityPool.getDepositorBONQGain(await wallets[0].getAddress());

    await expect(sut.stabilityPool.connect(wallets[0]).redeemReward()).to.emit(sut.stabilityPool, "BONQRewardRedeemed");

    await expect(sut.stabilityPool.connect(wallets[1]).redeemReward()).to.emit(sut.stabilityPool, "BONQRewardRedeemed");

    await expect(sut.stabilityPool.connect(wallets[2]).redeemReward()).to.emit(sut.stabilityPool, "BONQRewardRedeemed");

    await expect(sut.stabilityPool.connect(wallets[3]).redeemReward()).to.emit(sut.stabilityPool, "BONQRewardRedeemed");

    await expect(sut.stabilityPool.connect(wallets[4]).redeemReward()).to.emit(sut.stabilityPool, "BONQRewardRedeemed");

    let bonqBalanceBNQ0 = await sut.bonqToken.balanceOf(accounts[0]);
    let bonqBalanceBNQ1 = await sut.bonqToken.balanceOf(accounts[1]);
    let bonqBalanceBNQ2 = await sut.bonqToken.balanceOf(accounts[2]);
    let bonqBalanceBNQ3 = await sut.bonqToken.balanceOf(accounts[3]);
    let bonqBalanceBNQ4 = await sut.bonqToken.balanceOf(accounts[4]);
    expect(bonqRewardView0.add(bonqRewardView01)).to.equal(bonqBalanceBNQ0);
    expect(bonqBalanceBNQ0).to.equal(firstBonqPerMinute.mul(7));
    expect(bonqBalanceBNQ1).to.equal(firstBonqPerMinute.mul(325).div(100));
    expect(bonqBalanceBNQ2).to.equal(firstBonqPerMinute.mul(325).div(100));
    expect(bonqBalanceBNQ3).to.equal(firstBonqPerMinute.mul(325).div(100));
    expect(bonqBalanceBNQ4).to.equal(firstBonqPerMinute.mul(325).div(100));

    await provider.send("evm_increaseTime", [1000 * 60]); // 10 min
    await provider.send("evm_mine", []); // to create new block

    const bonqRewardView00 = await sut.stabilityPool.getDepositorBONQGain(await wallets[0].getAddress());
    const bonqRewardView10 = await sut.stabilityPool.getDepositorBONQGain(await wallets[1].getAddress());
    const bonqRewardView20 = await sut.stabilityPool.getDepositorBONQGain(await wallets[2].getAddress());
    const bonqRewardView30 = await sut.stabilityPool.getDepositorBONQGain(await wallets[3].getAddress());
    const bonqRewardView40 = await sut.stabilityPool.getDepositorBONQGain(await wallets[4].getAddress());

    let bonqBalances = bonqBalanceBNQ0.add(bonqBalanceBNQ1).add(bonqBalanceBNQ2).add(bonqBalanceBNQ3).add(bonqBalanceBNQ4);
    const bonqRawards1 = bonqRewardView00.add(bonqRewardView10).add(bonqRewardView20).add(bonqRewardView30).add(bonqRewardView40);

    expect(bonqBalances.add(bonqRawards1)).to.equal(firstBonqForRewards);

    await expect(sut.stabilityPool.connect(wallets[0]).redeemReward()).to.emit(sut.stabilityPool, "BONQRewardRedeemed");

    await expect(sut.stabilityPool.connect(wallets[1]).redeemReward()).to.emit(sut.stabilityPool, "BONQRewardRedeemed");

    await expect(sut.stabilityPool.connect(wallets[2]).redeemReward()).to.emit(sut.stabilityPool, "BONQRewardRedeemed");

    await expect(sut.stabilityPool.connect(wallets[3]).redeemReward()).to.emit(sut.stabilityPool, "BONQRewardRedeemed");

    await expect(sut.stabilityPool.connect(wallets[4]).redeemReward()).to.emit(sut.stabilityPool, "BONQRewardRedeemed");

    bonqBalanceBNQ0 = await sut.bonqToken.balanceOf(accounts[0]);
    bonqBalanceBNQ1 = await sut.bonqToken.balanceOf(accounts[1]);
    bonqBalanceBNQ2 = await sut.bonqToken.balanceOf(accounts[2]);
    bonqBalanceBNQ3 = await sut.bonqToken.balanceOf(accounts[3]);
    bonqBalanceBNQ4 = await sut.bonqToken.balanceOf(accounts[4]);

    bonqBalances = bonqBalanceBNQ0.add(bonqBalanceBNQ1).add(bonqBalanceBNQ2).add(bonqBalanceBNQ3).add(bonqBalanceBNQ4);

    expect(bonqBalances).to.equal(firstBonqForRewards);

    const bonqRewardView02 = await sut.stabilityPool.getDepositorBONQGain(await wallets[0].getAddress());
    const bonqRewardView12 = await sut.stabilityPool.getDepositorBONQGain(await wallets[1].getAddress());
    const bonqRewardView22 = await sut.stabilityPool.getDepositorBONQGain(await wallets[2].getAddress());
    const bonqRewardView32 = await sut.stabilityPool.getDepositorBONQGain(await wallets[3].getAddress());
    const bonqRewardView42 = await sut.stabilityPool.getDepositorBONQGain(await wallets[4].getAddress());
    const bonqRawards2 = bonqRewardView02.add(bonqRewardView12).add(bonqRewardView22).add(bonqRewardView32).add(bonqRewardView42);

    expect(bonqRawards2).to.equal(0);

    await provider.send("evm_increaseTime", [1000 * 60]); // 10 min
    await provider.send("evm_mine", []); // to create new block

    await expect(sut.stabilityPool.connect(wallets[0]).redeemReward()).to.emit(sut.stabilityPool, "BONQRewardRedeemed");

    await expect(sut.stabilityPool.connect(wallets[1]).redeemReward()).to.emit(sut.stabilityPool, "BONQRewardRedeemed");

    await expect(sut.stabilityPool.connect(wallets[2]).redeemReward()).to.emit(sut.stabilityPool, "BONQRewardRedeemed");

    await expect(sut.stabilityPool.connect(wallets[3]).redeemReward()).to.emit(sut.stabilityPool, "BONQRewardRedeemed");

    await expect(sut.stabilityPool.connect(wallets[4]).redeemReward()).to.emit(sut.stabilityPool, "BONQRewardRedeemed");

    bonqBalanceBNQ0 = await sut.bonqToken.balanceOf(accounts[0]);
    bonqBalanceBNQ1 = await sut.bonqToken.balanceOf(accounts[1]);
    bonqBalanceBNQ2 = await sut.bonqToken.balanceOf(accounts[2]);
    bonqBalanceBNQ3 = await sut.bonqToken.balanceOf(accounts[3]);
    bonqBalanceBNQ4 = await sut.bonqToken.balanceOf(accounts[4]);

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

    await sut.mintableTokenOwner.mint(await wallets[0].getAddress(), mintingAmount);
    await sut.mintableTokenOwner.mint(await wallets[1].getAddress(), mintingAmount);
    await sut.mintableTokenOwner.mint(await wallets[2].getAddress(), mintingAmount);
    await sut.mintableTokenOwner.mint(await wallets[3].getAddress(), mintingAmount);

    await sut.stableCoin.connect(wallets[0]).approve(sut.stabilityPool.address, depositAmount1);
    await sut.stableCoin.connect(wallets[1]).approve(sut.stabilityPool.address, depositAmount2);
    await sut.stableCoin.connect(wallets[2]).approve(sut.stabilityPool.address, depositAmount4);
    await sut.stableCoin.connect(wallets[3]).approve(sut.stabilityPool.address, depositAmount4);

    await sut.bonqToken.mint(sut.stabilityPool.address, firstBonqForRewards);
    await sut.stabilityPool.connect(wallets[0]).setBONQAmountForRewards();
    await sut.stabilityPool.connect(wallets[0]).setBONQPerMinute(firstBonqPerMinute);
    await provider.send("evm_increaseTime", [10 * 60 * 60]); // 1 (but time shift when totalDeposits = 0 must be missed)
    await provider.send("evm_mine", []); // to create new block
    await sut.stabilityPool.connect(wallets[0]).deposit(depositAmount1); // first user dep 500000000000000000000
    const initialTime1 = (await provider.getBlock(await provider.getBlockNumber())).timestamp;
    await sut.stabilityPool.connect(wallets[1]).deposit(depositAmount2); // second user dep 500000000000000000000
    await provider.send("evm_increaseTime", [10 * 60 * 60]); // +10h left with total dep 1000000000000000000000
    // increaseTotalShare(firstBonqPerMinute.mul(HOURS10));

    await trove.connect(wallets[1]).borrow(accounts[1], borrowAmount1, lastTrove.address);
    await trove1.connect(wallets[1]).borrow(accounts[1], borrowAmount1, lastTrove.address);
    await trove2.connect(wallets[1]).borrow(accounts[1], borrowAmount1, lastTrove.address);
    await trove3.connect(wallets[1]).borrow(accounts[1], borrowAmount1, lastTrove.address);
    await lastTrove.connect(wallets[1]).borrow(accounts[1], borrowAmount1, trove.address);

    await sut.priceFeed.setPrice(DECIMAL_PRECISION.mul(DECIMAL_PRECISION.mul(11)).div(await trove.collateralization()));
    // to make collaterization 1.1
    // error for future totalDeposits could be near 0.00005

    await expect(trove.liquidate()).to.emit(sut.stabilityPool, "TotalDepositUpdated"); // total dep 1000000000000000000000 - 50000000000000000
    await provider.send("evm_increaseTime", [10 * 60 * 60]); // +10h left with total dep 999950000000000000000 ()

    await expect(sut.stabilityPool.connect(wallets[1]).withdraw(depositAmount2)) // second user dep now 0
      .to.emit(sut.stabilityPool, "BONQRewardRedeemed"); // but must be rewarded

    await sut.stabilityPool.connect(wallets[2]).deposit(depositAmount3); // third user dep 500000000000000000000
    await provider.send("evm_increaseTime", [10 * 60 * 60]); // +10h left with total dep 999975000000000000000

    await expect(sut.stabilityPool.connect(wallets[2]).deposit(depositAmount3)) // third user total dep 1000000000000000000000
      .to.emit(sut.stabilityPool, "BONQRewardRedeemed");
    await expect(sut.stabilityPool.connect(wallets[3]).deposit(depositAmount4)) // fourth user dep 1000000000000000000000
      .to.emit(sut.stabilityPool, "BONQRewardRedeemed");
    await provider.send("evm_increaseTime", [30 * 60 * 60]); // +30h left with total dep 2499975000000000000000
    await provider.send("evm_mine", []); // to create new block

    const endingTime1 = (await provider.getBlock(provider.getBlockNumber())).timestamp; // total +- 60h left

    const bonqRewardView0 = await sut.stabilityPool.getDepositorBONQGain(await wallets[0].getAddress());
    await expect(sut.stabilityPool.connect(wallets[0]).redeemReward()) // 1/3 * 1/2 + 1/6 * 1/2 + 1/2 * 1/5 = 0.35
      .to.emit(sut.stabilityPool, "BONQRewardRedeemed");

    await expect(sut.stabilityPool.connect(wallets[1]).redeemReward()) // 1/3 * 1/2 = 0.16(6)...
      .to.emit(sut.stabilityPool, "BONQRewardRedeemed");

    await expect(sut.stabilityPool.connect(wallets[2]).redeemReward()) // 1/6 * 1/2 + 1/2 * 2/5 = 0.28(3)...
      .to.emit(sut.stabilityPool, "BONQRewardRedeemed");

    await expect(sut.stabilityPool.connect(wallets[3]).redeemReward()) // 1/2 * 2/5 = 0.2
      .to.emit(sut.stabilityPool, "BONQRewardRedeemed");
    const firstBalanceBNQ1 = await sut.bonqToken.balanceOf(accounts[0]);
    const secondBalanceBNQ1 = await sut.bonqToken.balanceOf(accounts[1]);
    const thirdBalanceBNQ1 = await sut.bonqToken.balanceOf(accounts[2]);
    const fourthBalanceBNQ1 = await sut.bonqToken.balanceOf(accounts[3]);
    const computedBONQreward1 = BigNumber.from(endingTime1 - initialTime1)
      .div(60)
      .mul(BigNumber.from(firstBonqPerMinute));

    expect(bonqRewardView0).to.equal(firstBalanceBNQ1);

    expect(secondBalanceBNQ1.add(thirdBalanceBNQ1)).to.be.closeTo(firstBalanceBNQ1.add(fourthBalanceBNQ1.div(2)), firstBonqPerMinute.mul(2).toNumber());

    expect(firstBalanceBNQ1.add(secondBalanceBNQ1).add(thirdBalanceBNQ1).add(fourthBalanceBNQ1)).to.be.closeTo(computedBONQreward1, firstBonqPerMinute.mul(2).toNumber());
    await sut.bonqToken.mint(sut.stabilityPool.address, secondBonqForRewards);
    await sut.stabilityPool.connect(wallets[0]).setBONQAmountForRewards();
    await sut.stabilityPool.connect(wallets[0]).setBONQPerMinute(secondBonqPerMinute);

    const initialTime2 = (await provider.getBlock(await provider.getBlockNumber())).timestamp;
    await provider.send("evm_increaseTime", [10 * 60 * 60]); //

    await sut.stableCoin.connect(wallets[1]).approve(sut.stabilityPool.address, depositAmount2);
    await expect(sut.stabilityPool.connect(wallets[1]).deposit(depositAmount2)).to.emit(sut.stabilityPool, "BONQRewardRedeemed");

    await provider.send("evm_increaseTime", [200 * 60 * 60]); //
    await provider.send("evm_mine", []); // to create new block

    const endingTime2 = (await provider.getBlock(provider.getBlockNumber())).timestamp;

    await expect(sut.stabilityPool.connect(wallets[0]).redeemReward()).to.emit(sut.stabilityPool, "BONQRewardRedeemed");

    await expect(sut.stabilityPool.connect(wallets[1]).redeemReward()).to.emit(sut.stabilityPool, "BONQRewardRedeemed");

    await expect(sut.stabilityPool.connect(wallets[2]).redeemReward()).to.emit(sut.stabilityPool, "BONQRewardRedeemed");

    await expect(sut.stabilityPool.connect(wallets[3]).redeemReward()).to.emit(sut.stabilityPool, "BONQRewardRedeemed");

    const computedBONQreward2 = BigNumber.from(endingTime2 - initialTime2)
      .div(60)
      .mul(BigNumber.from(secondBonqPerMinute));

    const firstBalanceBNQ = await sut.bonqToken.balanceOf(accounts[0]);
    const secondBalanceBNQ = await sut.bonqToken.balanceOf(accounts[1]);
    const thirdBalanceBNQ = await sut.bonqToken.balanceOf(accounts[2]);
    const fourthBalanceBNQ = await sut.bonqToken.balanceOf(accounts[3]);

    const contributorsBONQsum = BigNumber.from(firstBalanceBNQ).add(BigNumber.from(secondBalanceBNQ)).add(BigNumber.from(thirdBalanceBNQ)).add(BigNumber.from(fourthBalanceBNQ));

    const computedBONQrewardFinal = computedBONQreward1.add(computedBONQreward2);
    const error_of_time = firstBonqPerMinute.add(secondBonqPerMinute);
    expect(contributorsBONQsum).to.be.closeTo(computedBONQrewardFinal, error_of_time.mul(2).toNumber());
  });

  it("Stake rewards remain after upgrade", async function () {
    const mintingAmount = "100000000000000000000000";
    const depositAmount1 = "1000000000000000000000";
    const depositAmount2 = "1000000000000000000000";
    const borrowAmount1 = "1000000000000000000";
    await sut.mintableTokenOwner.mint(await wallets[0].getAddress(), mintingAmount);
    await sut.mintableTokenOwner.mint(await wallets[1].getAddress(), mintingAmount);

    await sut.stableCoin.connect(wallets[0]).approve(sut.stabilityPool.address, depositAmount1);
    await sut.stableCoin.connect(wallets[1]).approve(sut.stabilityPool.address, depositAmount2);

    await sut.stabilityPool.connect(wallets[0]).deposit(depositAmount1);
    await sut.stabilityPool.connect(wallets[1]).deposit(depositAmount2);

    await trove.connect(wallets[1]).borrow(accounts[1], borrowAmount1, lastTrove.address);
    await lastTrove.connect(wallets[1]).borrow(accounts[1], borrowAmount1, trove.address);

    await sut.priceFeed.setPrice(DECIMAL_PRECISION.mul(DECIMAL_PRECISION.mul(11)).div(await trove.collateralization()));
    // to make collaterization 1.1

    await expect(trove.liquidate()).to.emit(sut.stabilityPool, "TotalDepositUpdated");

    // ReplacementStabilityPoolUniswap
    const stabilityPool = (await upgradeUUPSContract(sut.stabilityPool as Contract, wallets[0], "ReplacementStabilityPoolUniswap", [
      sut.troveFactory.address,
      sut.bonqToken.address
    ])) as StabilityPoolUniswap;

    await expect(stabilityPool.connect(wallets[0]).redeemReward()).to.emit(stabilityPool, "CollateralRewardRedeemed").to.emit(stabilityPool, "BONQRewardRedeemed");

    await expect(stabilityPool.connect(wallets[1]).redeemReward()).to.emit(stabilityPool, "CollateralRewardRedeemed").to.emit(stabilityPool, "BONQRewardRedeemed");

    const firstContCollBalanceBN = await sut.troveToken.balanceOf(accounts[0]);
    const secondContCollBalanceBN = await sut.troveToken.balanceOf(accounts[1]);
    const contributorsBalancesCorrelation = secondContCollBalanceBN.div(firstContCollBalanceBN);
    expect(contributorsBalancesCorrelation.toString()).of.be.equal("1");
  });

  describe("arbitrage", function () {
    let arbitragePath: string[];
    let feesPath: string[];
    const depositAmount = DECIMAL_PRECISION.mul(1000000);

    beforeEach(async function () {
      arbitragePath = [sut.beurAddress, sut.btcAddress, sut.ethAddress, sut.beurAddress];
      feesPath = ["500", "500", "500"];
      await sut.revert();
    });

    it("fails when the path does not start with stable coin", async function () {
      const amount = DECIMAL_PRECISION.mul("16000");
      // remove the first element
      arbitragePath.splice(0, 1);
      await expect(sut.stabilityPool.arbitrage(amount, arbitragePath, feesPath, 0)).to.be.revertedWith("eafe9 must start and end with same coin");
    });

    it("fails when the path does not end with stable coin", async function () {
      const amount = DECIMAL_PRECISION.mul("16000");
      // remove the last element
      arbitragePath.splice(3, 1);
      await expect(sut.stabilityPool.arbitrage(amount, arbitragePath, feesPath, 0)).to.be.revertedWith("eafe9 must start and end with same coin");
    });

    it("can take advantage of the imbalance in the path beur - btc - eth - beur", async function () {
      await (await sut.beur.mint(sut.accounts[0], depositAmount)).wait();
      await (await sut.beur.approve(sut.stabilityPool.address, depositAmount)).wait();

      await (await sut.stabilityPool.deposit(depositAmount)).wait();
      await expect(sut.stabilityPool.arbitrage(DECIMAL_PRECISION.mul(10), arbitragePath, feesPath, 0))
        .to.emit(sut.stabilityPool, "Arbitrage")
        .withArgs(arbitragePath, DECIMAL_PRECISION.mul(10), "1982667616352282521");
    });

    it("reverts with the unprofitable amount for path beur - btc - eth - beur", async function () {
      await (await sut.beur.mint(sut.accounts[0], depositAmount)).wait();
      await (await sut.beur.approve(sut.stabilityPool.address, depositAmount)).wait();

      await (await sut.stabilityPool.deposit(depositAmount)).wait();
      await expect(sut.stabilityPool.arbitrage(DECIMAL_PRECISION.mul(1e7), arbitragePath, feesPath, 0)).to.be.revertedWith("Too little received");
    });

    it("reverts with the unprofitable path btc - eth - beur - btc", async function () {
      await (await sut.beur.mint(sut.accounts[0], depositAmount)).wait();
      await (await sut.beur.approve(sut.stabilityPool.address, depositAmount)).wait();

      await (await sut.stabilityPool.deposit(depositAmount)).wait();
      arbitragePath = [sut.beurAddress, sut.ethAddress, sut.btcAddress, sut.beurAddress];
      await expect(sut.stabilityPool.arbitrage(DECIMAL_PRECISION.mul(1), arbitragePath, feesPath, 0)).to.be.revertedWith("Too little received");
    });

    it("fails when too late", async function () {
      await (await sut.beur.mint(sut.accounts[0], depositAmount)).wait();
      await (await sut.beur.approve(sut.stabilityPool.address, depositAmount)).wait();

      await (await sut.stabilityPool.deposit(depositAmount)).wait();
      const amount = DECIMAL_PRECISION.mul(100);
      const blockTime = toBN((await sut.eth.provider.getBlock("latest")).timestamp);
      await expect(sut.stabilityPool.arbitrage(amount, arbitragePath, feesPath, blockTime.sub(12))).to.be.revertedWith("eafe9 too late");
    });

    it("distributes arbitrage profits among sp liquidity providers", async function () {
      const spContributors = 4;
      const amount = DECIMAL_PRECISION.mul(1e4);

      for (let i = 1; i <= spContributors; i++) {
        await (await sut.beur.mint(accounts[i], amount)).wait();
        await (await sut.beur.connect(wallets[i]).approve(sut.stabilityPool.address, amount)).wait();

        await (await sut.stabilityPool.connect(wallets[i]).deposit(DECIMAL_PRECISION.mul(1e3))).wait();
      }

      for (let tokens = 5; tokens <= 15; tokens += 5) {
        await expect(sut.stabilityPool.arbitrage(DECIMAL_PRECISION.mul(tokens), arbitragePath, feesPath, "0")).to.emit(sut.stabilityPool, "Arbitrage");

        for (let i = 1; i <= spContributors; i++) {
          const depositAfterArbitrage = await sut.stabilityPool.connect(wallets[i]).getWithdrawableDeposit(accounts[i]);

          expect(depositAfterArbitrage.mul(spContributors)).to.be.closeTo(await sut.beur.balanceOf(sut.stabilityPool.address), 1e5);
        }
      }

      for (let i = 1; i <= spContributors; i++) {
        const depositAfterArbitrage = await sut.stabilityPool.connect(wallets[i]).getWithdrawableDeposit(accounts[i]);
        await expect(sut.stabilityPool.connect(wallets[i]).withdraw(BigInt(1e30)))
          .to.emit(sut.stabilityPool, "Withdraw")
          .withArgs(accounts[i], depositAfterArbitrage);
      }
    });
  });
});
