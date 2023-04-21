import { expect, use } from "chai";
import { solidity } from "ethereum-waffle";
import { BigNumber, Contract, providers, Signer } from "ethers";
import { ILiquidationPool, MintableToken, MintableTokenOwner, TestPriceFeed, BONQStaking, TokenToPriceFeed, OriginalTroveFactory, Trove, StabilityPoolBase } from "../src/types";
import { deployContract, deployUUPSContract, toBN, upgradeUUPSContract } from "./utils/helpers";
import { describe } from "mocha";
import { ethers } from "hardhat";
import { ReplacementBONQStaking } from "../src/types/ReplacementBONQStaking";

use(solidity);

const ZERO = toBN("0");

describe("BONQ Staking", function () {
  this.timeout(60000);
  const wallets: Signer[] = [];
  let accounts: string[];
  let troveFactory: OriginalTroveFactory;
  //   let troveToken: MintableToken;
  //   let trove: Trove;
  //   let trove1: Trove;
  //   let trove2: Trove;
  //   let trove3: Trove;
  //   let lastTrove: Trove;
  // //   let tokenToPriceFeed: TokenToPriceFeed;
  // //   let priceFeed: PriceFeed;
  let provider: providers.JsonRpcProvider;
  let mintableTokenOwner: MintableTokenOwner;
  let stableCoin: MintableToken;
  let bonqToken: MintableToken;
  // //   let liquidationPool: ILiquidationPool;
  //   let stabilityPool: StabilityPool;
  let bonqStaking: BONQStaking;

  beforeEach(async function () {
    provider = ethers.provider;
    accounts = await provider.listAccounts();
    for (const account of accounts) {
      wallets.push(provider.getSigner(account));
    }

    stableCoin = (await deployContract(wallets[0], "MintableToken", ["Mintable Stable Coin for Test", "MSC"])) as MintableToken;

    bonqToken = (await deployContract(wallets[0], "MintableToken", ["BONQ Token for Test", "BONQ"])) as MintableToken;

    mintableTokenOwner = (await deployContract(wallets[0], "MintableTokenOwner", [stableCoin.address])) as MintableTokenOwner;
    await mintableTokenOwner.addMinter(await wallets[0].getAddress());
    await stableCoin.transferOwnership(mintableTokenOwner.address);

    bonqStaking = (await deployUUPSContract(wallets[0], "BONQStaking", [bonqToken.address], [])) as BONQStaking;

    troveFactory = (await deployUUPSContract(wallets[0], "OriginalTroveFactory", [stableCoin.address, bonqStaking.address], [])) as OriginalTroveFactory;

    await bonqStaking.setFactory(troveFactory.address);

    await mintableTokenOwner.transferOwnership(troveFactory.address);
    await troveFactory.setTokenOwner();
  });

  it("stake and unstake and ", async () => {
    const mintingAmount = "100000000000000000000";
    const depositAmount = "100000000000000000";
    const withdrawAmount = "30000000000000000";
    const totalAmount = "70000000000000000";

    await bonqToken.mint(await wallets[1].getAddress(), mintingAmount);
    await bonqToken.connect(wallets[1]).approve(bonqStaking.address, ethers.constants.MaxInt256);

    expect(await bonqStaking.connect(wallets[1]).stake(depositAmount))
      .to.emit(bonqStaking, "TotalBONQStakedUpdated")
      .withArgs(depositAmount)
      .to.emit(bonqStaking, "StakeChanged")
      .withArgs(await wallets[1].getAddress(), depositAmount)
      .to.emit(bonqStaking, "StakerSnapshotsUpdated")
      .withArgs(await wallets[1].getAddress(), 0, 0);

    expect(await bonqStaking.connect(wallets[1]).unstake(withdrawAmount))
      .to.emit(bonqStaking, "TotalBONQStakedUpdated")
      .withArgs(totalAmount)
      .to.emit(bonqStaking, "StakeChanged")
      .withArgs(await wallets[1].getAddress(), totalAmount)
      .to.emit(bonqStaking, "StakerSnapshotsUpdated")
      .withArgs(await wallets[1].getAddress(), 0, 0);
  });

  it("takeFees 3 times (2 stakers with one unstake)", async () => {
    const mintingAmount = "100000000000000000000";
    const stakeAmount1 = "100000000000000000";
    const feeAmount1 = BigNumber.from("10000000000000000");
    const unstakeAmount = "30000000000000000";
    const totalAmount2 = "70000000000000000";
    const feeAmount2 = BigNumber.from("10000000000000000");
    const stakeAmount2 = "100000000000000000";
    const totalAmount3 = "170000000000000000";
    const feeAmount3 = BigNumber.from("10000000000000000");
    const F_BEUR_1 = feeAmount1.mul(ethers.utils.parseUnits("1.0")).div(BigNumber.from(stakeAmount1));
    const reward1 = F_BEUR_1.mul(BigNumber.from(stakeAmount1)).div(ethers.utils.parseUnits("1.0"));

    const F_BEUR_2 = F_BEUR_1.add(feeAmount2.mul(ethers.utils.parseUnits("1.0")).div(BigNumber.from(totalAmount2)));

    const reward2 = reward1.add(F_BEUR_2.sub(F_BEUR_1).mul(BigNumber.from(totalAmount2)).div(ethers.utils.parseUnits("1.0")));

    const F_BEUR_3 = F_BEUR_2.add(feeAmount3.mul(ethers.utils.parseUnits("1.0")).div(BigNumber.from(totalAmount3)));

    const reward3 = F_BEUR_3.sub(F_BEUR_2).mul(BigNumber.from(stakeAmount2)).div(ethers.utils.parseUnits("1.0"));

    await bonqToken.mint(await wallets[1].getAddress(), mintingAmount);
    await bonqToken.mint(await wallets[2].getAddress(), mintingAmount);
    await bonqToken.connect(wallets[1]).approve(bonqStaking.address, ethers.constants.MaxInt256);
    await bonqToken.connect(wallets[2]).approve(bonqStaking.address, ethers.constants.MaxInt256);
    await mintableTokenOwner.mint(await wallets[0].getAddress(), ethers.constants.MaxInt256);
    await stableCoin.connect(wallets[0]).approve(bonqStaking.address, ethers.constants.MaxInt256);

    expect(await bonqStaking.connect(wallets[1]).stake(stakeAmount1))
      .to.emit(bonqStaking, "TotalBONQStakedUpdated")
      .withArgs(stakeAmount1)
      .to.emit(bonqStaking, "StakeChanged")
      .withArgs(await wallets[1].getAddress(), stakeAmount1)
      .to.emit(bonqStaking, "StakerSnapshotsUpdated")
      .withArgs(await wallets[1].getAddress(), 0, 0);

    expect(await bonqStaking.connect(wallets[0]).takeFees(feeAmount1))
      .to.emit(bonqStaking, "FeeTaken")
      .withArgs(feeAmount1, F_BEUR_1, false);

    expect(await bonqStaking.connect(wallets[1]).getUnpaidStableCoinGain(await wallets[1].getAddress())).to.equal(reward1);

    expect(await bonqStaking.connect(wallets[1]).unstake(unstakeAmount))
      .to.emit(bonqStaking, "TotalBONQStakedUpdated")
      .withArgs(totalAmount2)
      .to.emit(bonqStaking, "StakeChanged")
      .withArgs(await wallets[1].getAddress(), totalAmount2)
      .to.emit(bonqStaking, "StakerSnapshotsUpdated")
      .withArgs(await wallets[1].getAddress(), F_BEUR_1, reward1);

    expect(await bonqStaking.connect(wallets[0]).takeFees(feeAmount2))
      .to.emit(bonqStaking, "FeeTaken")
      .withArgs(feeAmount2, F_BEUR_2, false);

    expect(await bonqStaking.connect(wallets[1]).getUnpaidStableCoinGain(await wallets[1].getAddress())).to.equal(reward2);

    expect(await bonqStaking.connect(wallets[2]).stake(stakeAmount2))
      .to.emit(bonqStaking, "TotalBONQStakedUpdated")
      .withArgs(totalAmount3)
      .to.emit(bonqStaking, "StakeChanged")
      .withArgs(await wallets[2].getAddress(), stakeAmount2)
      .to.emit(bonqStaking, "StakerSnapshotsUpdated")
      .withArgs(await wallets[2].getAddress(), F_BEUR_2, 0);

    expect(await bonqStaking.connect(wallets[0]).takeFees(feeAmount3))
      .to.emit(bonqStaking, "FeeTaken")
      .withArgs(feeAmount3, F_BEUR_3, false);

    expect(await bonqStaking.connect(wallets[2]).getUnpaidStableCoinGain(await wallets[2].getAddress())).to.equal(reward3);
  });

  it("stake after takeFees and unstake whole reward ", async () => {
    const mintingAmount = "100000000000000000000";
    const depositAmount = "100000000000000000";
    const withdrawAmount = "30000000000000000";
    const totalAmount = "70000000000000000";
    const feeAmount1 = BigNumber.from("10000000000000000");

    await bonqToken.mint(await wallets[1].getAddress(), mintingAmount);
    await bonqToken.connect(wallets[1]).approve(bonqStaking.address, ethers.constants.MaxInt256);
    await mintableTokenOwner.mint(await wallets[0].getAddress(), ethers.constants.MaxInt256);
    await stableCoin.connect(wallets[0]).approve(bonqStaking.address, ethers.constants.MaxInt256);

    expect(await bonqStaking.connect(wallets[0]).takeFees(feeAmount1))
      .to.emit(bonqStaking, "FeeTaken")
      .withArgs(feeAmount1, feeAmount1, false);

    expect(await bonqStaking.connect(wallets[1]).stake(depositAmount))
      .to.emit(bonqStaking, "TotalBONQStakedUpdated")
      .withArgs(depositAmount)
      .to.emit(bonqStaking, "StakeChanged")
      .withArgs(await wallets[1].getAddress(), depositAmount)
      .to.emit(bonqStaking, "StakerSnapshotsUpdated")
      .withArgs(await wallets[1].getAddress(), feeAmount1, feeAmount1);

    expect(await bonqStaking.connect(wallets[1]).getUnpaidStableCoinGain(await wallets[1].getAddress())).to.equal(feeAmount1);

    expect(await bonqStaking.connect(wallets[1]).unstake(withdrawAmount))
      .to.emit(bonqStaking, "TotalBONQStakedUpdated")
      .withArgs(totalAmount)
      .to.emit(bonqStaking, "StakeChanged")
      .withArgs(await wallets[1].getAddress(), totalAmount)
      .to.emit(bonqStaking, "StakerSnapshotsUpdated")
      .withArgs(await wallets[1].getAddress(), feeAmount1, feeAmount1);
  });

  it("2 users stake very low BONQ and take normal fees correctly", async () => {
    const depositAmount = toBN("1000");
    const withdrawAmount = toBN("1000");
    const feeAmount1 = toBN("100000000000000000");

    await bonqToken.mint(await wallets[1].getAddress(), depositAmount);
    await bonqToken.mint(await wallets[2].getAddress(), depositAmount);
    await bonqToken.connect(wallets[1]).approve(bonqStaking.address, ethers.constants.MaxInt256);
    await bonqToken.connect(wallets[2]).approve(bonqStaking.address, ethers.constants.MaxInt256);
    await mintableTokenOwner.mint(await wallets[0].getAddress(), ethers.constants.MaxInt256);
    await stableCoin.connect(wallets[0]).approve(bonqStaking.address, ethers.constants.MaxInt256);

    expect(await bonqStaking.connect(wallets[0]).takeFees(feeAmount1))
      .to.emit(bonqStaking, "FeeTaken")
      .withArgs(feeAmount1, feeAmount1, false);

    expect(await bonqStaking.connect(wallets[1]).stake(depositAmount))
      .to.emit(bonqStaking, "TotalBONQStakedUpdated")
      .withArgs(depositAmount)
      .to.emit(bonqStaking, "StakeChanged")
      .withArgs(await wallets[1].getAddress(), depositAmount)
      .to.emit(bonqStaking, "StakerSnapshotsUpdated")
      .withArgs(await wallets[1].getAddress(), feeAmount1, feeAmount1);

    expect(await bonqStaking.connect(wallets[2]).stake(depositAmount))
      .to.emit(bonqStaking, "TotalBONQStakedUpdated")
      .withArgs(depositAmount.mul(2))
      .to.emit(bonqStaking, "StakeChanged")
      .withArgs(await wallets[2].getAddress(), depositAmount)
      .to.emit(bonqStaking, "StakerSnapshotsUpdated")
      .withArgs(await wallets[2].getAddress(), feeAmount1, 0);

    expect(await bonqStaking.connect(wallets[1]).getUnpaidStableCoinGain(await wallets[1].getAddress())).to.equal(feeAmount1);

    expect(await bonqStaking.connect(wallets[0]).takeFees(feeAmount1)).to.emit(bonqStaking, "FeeTaken");
    expect(await bonqStaking.connect(wallets[0]).takeFees(feeAmount1)).to.emit(bonqStaking, "FeeTaken");

    expect(await bonqStaking.connect(wallets[0]).takeFees(feeAmount1)).to.emit(bonqStaking, "FeeTaken");

    expect(await bonqStaking.connect(wallets[0]).takeFees(feeAmount1)).to.emit(bonqStaking, "FeeTaken");

    expect(await bonqStaking.getUnpaidStableCoinGain(await wallets[1].getAddress())).to.equal(feeAmount1.mul(3));

    expect(await bonqStaking.getUnpaidStableCoinGain(await wallets[2].getAddress())).to.equal(feeAmount1.mul(2));

    expect(await bonqStaking.connect(wallets[1]).unstake(withdrawAmount))
      .to.emit(bonqStaking, "TotalBONQStakedUpdated")
      .withArgs(depositAmount)
      .to.emit(bonqStaking, "StakeChanged")
      .withArgs(await wallets[1].getAddress(), ZERO)
      .to.emit(bonqStaking, "StakerSnapshotsUpdated")
      .withArgs(await wallets[1].getAddress(), await bonqStaking.F_StableCoin(), feeAmount1.mul(3));
  });

  it("BONQ staking can be replaced with a new version", async function () {
    bonqStaking = (await upgradeUUPSContract(bonqStaking as Contract, wallets[0], "ReplacementBONQStaking", [])) as BONQStaking;

    expect((await (bonqStaking as unknown as ReplacementBONQStaking).name()).toString()).to.equal("ReplacementBONQStaking");

    const mintingAmount = "100000000000000000000";
    const depositAmount = "100000000000000000";
    const withdrawAmount = "30000000000000000";
    const totalAmount = "70000000000000000";

    await bonqToken.mint(await wallets[1].getAddress(), mintingAmount);
    await bonqToken.connect(wallets[1]).approve(bonqStaking.address, ethers.constants.MaxInt256);

    expect(await bonqStaking.connect(wallets[1]).stake(depositAmount))
      .to.emit(bonqStaking, "TotalBONQStakedUpdated")
      .withArgs(depositAmount)
      .to.emit(bonqStaking, "StakeChanged")
      .withArgs(await wallets[1].getAddress(), depositAmount)
      .to.emit(bonqStaking, "StakerSnapshotsUpdated")
      .withArgs(await wallets[1].getAddress(), 0, 0);

    expect(await bonqStaking.connect(wallets[1]).unstake(withdrawAmount))
      .to.emit(bonqStaking, "TotalBONQStakedUpdated")
      .withArgs(totalAmount)
      .to.emit(bonqStaking, "StakeChanged")
      .withArgs(await wallets[1].getAddress(), totalAmount)
      .to.emit(bonqStaking, "StakerSnapshotsUpdated")
      .withArgs(await wallets[1].getAddress(), 0, 0);
  });

  // ReedemReward test

  describe("ReedemReward test", function () {
    this.timeout(60000);

    let troveFactory: OriginalTroveFactory;
    let troveToken: MintableToken;
    let trove: Trove;
    let lastTrove: Trove;
    let tokenToPriceFeed: TokenToPriceFeed;
    let priceFeed: TestPriceFeed;
    let mintableTokenOwner: MintableTokenOwner;
    let stableCoin: MintableToken;
    let bonqToken: MintableToken;
    let liquidationPool: ILiquidationPool;
    let stabilityPool: StabilityPoolBase;
    let bonqStaking: BONQStaking;

    beforeEach(async function () {
      provider = ethers.provider;
      accounts = await provider.listAccounts();
      for (const account of accounts) {
        wallets.push(provider.getSigner(account));
      }

      troveToken = (await deployContract(wallets[0], "MintableToken", ["Mintable Token for Test", "MTT"])) as MintableToken;

      stableCoin = (await deployContract(wallets[0], "MintableToken", ["Mintable Stable Coin for Test", "MSC"])) as MintableToken;

      bonqToken = (await deployContract(wallets[0], "MintableToken", ["BONQ Token for Test", "BONQ"])) as MintableToken;

      mintableTokenOwner = (await deployContract(wallets[0], "MintableTokenOwner", [stableCoin.address])) as MintableTokenOwner;
      await mintableTokenOwner.addMinter(await wallets[0].getAddress());
      await stableCoin.transferOwnership(mintableTokenOwner.address);

      tokenToPriceFeed = (await deployContract(wallets[0], "TokenToPriceFeed")) as TokenToPriceFeed;

      priceFeed = (await deployContract(wallets[0], "TestPriceFeed", [troveToken.address])) as TestPriceFeed;

      await tokenToPriceFeed.setTokenPriceFeed(troveToken.address, priceFeed.address, 120, 250);

      bonqStaking = (await deployUUPSContract(wallets[0], "BONQStaking", [bonqToken.address], [])) as BONQStaking;

      troveFactory = (await deployUUPSContract(wallets[0], "OriginalTroveFactory", [stableCoin.address, bonqStaking.address], [])) as OriginalTroveFactory;

      await troveFactory.setTokenPriceFeed(tokenToPriceFeed.address);
      await mintableTokenOwner.transferOwnership(troveFactory.address);
      await troveFactory.setTokenOwner();

      liquidationPool = await deployContract(wallets[0], "CommunityLiquidationPool", [troveFactory.address, troveToken.address]);
      stabilityPool = (await deployUUPSContract(wallets[0], "StabilityPoolBase", [], [troveFactory.address, bonqToken.address])) as StabilityPoolBase;

      const troveImplementation = (await deployContract(wallets[0], "Trove", [troveFactory.address])) as Trove;

      await (await troveFactory.setTroveImplementation(troveImplementation.address)).wait();
      await troveFactory.setStabilityPool(stabilityPool.address);
      await troveFactory.setLiquidationPool(troveToken.address, liquidationPool.address);

      await troveFactory.connect(wallets[1]).createTrove(troveToken.address);
      await troveFactory.connect(wallets[2]).createTrove(troveToken.address);

      const TroveContract = await ethers.getContractFactory("Trove");
      trove = TroveContract.attach(await troveFactory.firstTrove(troveToken.address)) as Trove;
      lastTrove = TroveContract.attach(await troveFactory.lastTrove(troveToken.address)) as Trove;

      await troveToken.mint(trove.address, "10000000000000000000");
      await troveToken.mint(lastTrove.address, "10000000000000000000");
      await bonqToken.mint(await wallets[2].getAddress(), "20000000000000000000");
      await bonqStaking.setFactory(troveFactory.address);
    });

    it("2 contributors, redeemFees and StableDelayed is working", async () => {
      const borrowAmount1 = BigNumber.from("8000000000000000000");
      const borrowAmount2 = BigNumber.from("1000000000000000000");
      const stakeAmount2 = BigNumber.from("10000000000000");

      const beurFees1 = await bonqStaking.getBorrowingFee(borrowAmount1);
      const beurFees2 = await bonqStaking.getBorrowingFee(borrowAmount2);

      expect(await bonqStaking.getRewardsTotal()).to.equal(0);
      await (await trove.connect(wallets[1]).borrow(accounts[1], borrowAmount1, lastTrove.address)).wait();

      expect(await bonqStaking.getRewardsTotal()).to.equal(beurFees1);

      await bonqToken.connect(wallets[2]).approve(bonqStaking.address, ethers.constants.MaxInt256);
      await bonqStaking.connect(wallets[2]).stake(stakeAmount2);

      expect(await bonqStaking.getUnpaidStableCoinGain(accounts[2])).to.equal(beurFees1);

      await lastTrove.connect(wallets[2]).borrow(accounts[2], borrowAmount2, lastTrove.address);

      const recordBEUR = await bonqStaking.F_StableCoin();
      const unclaimedStablecoin1 = await bonqStaking.getUnpaidStableCoinGain(accounts[1]);
      const unclaimedStablecoin2 = await bonqStaking.getUnpaidStableCoinGain(accounts[2]);
      expect(unclaimedStablecoin1.add(unclaimedStablecoin2)).to.equal(beurFees1.add(beurFees2));
      const totalDebt = borrowAmount2.add(beurFees2);

      expect(await lastTrove.netDebt()).to.be.equal(totalDebt);

      const maxToRepay = await lastTrove.netDebt();
      const reedemAmount = beurFees1;
      const finalReedemAmount = reedemAmount <= maxToRepay ? maxToRepay : reedemAmount;

      expect(await bonqStaking.connect(wallets[2]).redeemReward(finalReedemAmount, lastTrove.address, lastTrove.address))
        .to.emit(bonqStaking, "StakerSnapshotsUpdated")
        .withArgs(await wallets[2].getAddress(), recordBEUR, beurFees1.add(beurFees2))
        .to.emit(bonqStaking, "RewardRedeemed")
        .withArgs(await wallets[2].getAddress(), finalReedemAmount, lastTrove.address);

      expect(await lastTrove.netDebt()).to.be.equal(totalDebt.sub(finalReedemAmount));

      await lastTrove.connect(wallets[2]).borrow(accounts[2], borrowAmount1, lastTrove.address);

      await expect(bonqStaking.connect(wallets[2]).redeemReward(ethers.constants.MaxInt256, lastTrove.address, lastTrove.address)).to.be.revertedWith(
        "2ff8c _amount must fit rewards amount"
      );
    });
  });
});
