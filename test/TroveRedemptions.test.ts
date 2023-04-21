// noinspection JSPotentiallyInvalidUsageOfThis

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
  Trove,
  TroveFactory,
  StabilityPoolBase,
  BONQStaking
} from "../src/types";
import { DECIMAL_PRECISION, deployContract, deployUUPSContract, getEventsFromReceipt, toBN } from "./utils/helpers";
import { describe } from "mocha";

import { ethers } from "hardhat";
import exp from "constants";
use(solidity);

// Start test block
describe("Trove Redemptions", function () {
  this.timeout(50000);

  const wallets: Signer[] = [];
  let accounts: string[];
  let troveFactory: TroveFactory;
  let provider: providers.JsonRpcProvider;
  let mintableTokenOwner: MintableTokenOwner;
  let troveToken: MintableToken;
  let stableCoin: MintableToken;
  let bonqToken: MintableToken;
  let stabilityPool: StabilityPoolBase;
  let tokenToPriceFeed: TokenToPriceFeed;
  let priceFeed: TestPriceFeed;
  let liquidationPool: ILiquidationPool;

  beforeEach(async function () {
    provider = ethers.provider;
    accounts = await provider.listAccounts();
    for (const account of accounts) {
      wallets.push(provider.getSigner(account));
    }

    troveToken = (await deployContract(wallets[0], "MintableToken", ["Mintable Token for Test", "MTT"])) as MintableToken;

    stableCoin = (await deployContract(wallets[0], "MintableToken", ["Mintable Stable Coin for Test", "MSC"])) as MintableToken;
  });

  describe("with trove factory", function () {
    let testFeeRecipient: TestFeeRecipient;

    const addTrove = async function (owner: Signer = wallets[0], tokenAddress = troveToken.address, mint = true): Promise<Trove> {
      const tx: ContractTransaction = await troveFactory.connect(owner).createTrove(tokenAddress);
      const receipt: ContractReceipt = await tx.wait();
      // @ts-ignore
      const troveAddress = receipt.events.filter((x) => {
        return x.event == "NewTrove";
      })[0].args.trove;
      const trove: Trove = (await ethers.getContractAt("Trove", troveAddress)) as Trove;
      if (mint) {
        const token = await ethers.getContractAt("MintableToken", tokenAddress);
        await token.mint(troveAddress, DECIMAL_PRECISION.mul(10));
        await trove.connect(owner).increaseCollateral(0, trove.address);
      }
      return trove;
    };

    beforeEach(async function () {
      mintableTokenOwner = (await deployContract(wallets[0], "MintableTokenOwner", [stableCoin.address])) as MintableTokenOwner;
      await mintableTokenOwner.addMinter(await wallets[0].getAddress());
      await stableCoin.transferOwnership(mintableTokenOwner.address);

      tokenToPriceFeed = (await deployContract(wallets[0], "TokenToPriceFeed")) as TokenToPriceFeed;

      priceFeed = (await deployContract(wallets[0], "TestPriceFeed", [troveToken.address])) as TestPriceFeed;

      await tokenToPriceFeed.setTokenPriceFeed(troveToken.address, priceFeed.address, 120, 1000);

      await priceFeed.setPrice(DECIMAL_PRECISION.mul(2));

      testFeeRecipient = (await deployContract(wallets[0], "TestFeeRecipient", [stableCoin.address])) as TestFeeRecipient;

      troveFactory = (await deployUUPSContract(wallets[0], "OriginalTroveFactory", [stableCoin.address, testFeeRecipient.address], [])) as TroveFactory;

      const troveImplementation = (await deployContract(wallets[0], "Trove", [troveFactory.address])) as Trove;

      await (await troveFactory.setTroveImplementation(troveImplementation.address)).wait();
      await troveFactory.setTokenPriceFeed(tokenToPriceFeed.address);
      await mintableTokenOwner.transferOwnership(troveFactory.address);
      await troveFactory.setTokenOwner();
      liquidationPool = await deployContract(wallets[0], "CommunityLiquidationPool", [troveFactory.address, troveToken.address]);
      await troveFactory.setLiquidationPool(troveToken.address, liquidationPool.address);
      bonqToken = (await deployContract(wallets[0], "MintableToken", ["BONQ Token for Test", "BONQ"])) as MintableToken;
      stabilityPool = (await deployUUPSContract(wallets[0], "StabilityPoolBase", [], [troveFactory.address, bonqToken.address])) as StabilityPoolBase;
      await troveFactory.setStabilityPool(stabilityPool.address);
    });

    const totalCollateral = "1000000000000000000";
    const amount = "1000000000000000000";

    describe("multiple troves redemptions", async function () {
      let troves: Trove[];
      const lastTroveIdx = 5;
      const accounts: string[] = [];

      beforeEach(async function () {
        troves = await addTroves();
        for (const wallet of wallets) {
          accounts.push(await wallet.getAddress());
        }
      });

      async function addTroves(): Promise<Trove[]> {
        // when the addTroves functionality resides in beforeEach, the tests fail
        const troves: Trove[] = [];
        for (let i = 0; i <= lastTroveIdx; i++) {
          const trove: Trove = await addTrove(wallets[i + 1]);
          troves.push(trove);
          await mintableTokenOwner.mint(await wallets[i + 1].getAddress(), amount);
        }
        return troves;
      }

      describe("trove redemption", function () {
        let troveToken1: MintableToken, priceFeed1: TestPriceFeed, communityLiquidationPool1: ILiquidationPool, trove1: Trove, trove11: Trove, trove12: Trove;

        const get_sorted_troves = async function () {
          const trove_token = troveToken1.address;
          const result = [] as string[];
          result.push(await troveFactory.firstTrove(trove_token));
          const last_trove = await troveFactory.lastTrove(trove_token);
          let next_trove = await troveFactory.nextTrove(trove_token, result[0]);
          while (next_trove != last_trove) {
            result.push(next_trove);
            try {
              next_trove = await troveFactory.nextTrove(trove_token, next_trove);
            } catch {
              break;
            }
          }
          result.push(last_trove);
          return result;
        };

        beforeEach(async () => {
          troveToken1 = await deployContract(wallets[0], "MintableToken", ["TroveToken1", "TT1"]);

          priceFeed1 = await deployContract(wallets[0], "TestPriceFeed", [troveToken1.address]);
          await tokenToPriceFeed.setTokenPriceFeed(troveToken1.address, priceFeed1.address, 120, 250);

          await priceFeed1.setPrice(DECIMAL_PRECISION.mul(2));

          communityLiquidationPool1 = await deployContract(wallets[0], "CommunityLiquidationPool", [troveFactory.address, troveToken1.address]);

          await troveFactory.setLiquidationPool(troveToken1.address, communityLiquidationPool1.address);

          trove1 = await addTrove(wallets[0], troveToken1.address);
          trove11 = await addTrove(wallets[0], troveToken1.address);
          trove12 = await addTrove(wallets[1], troveToken1.address);
          await priceFeed1.setPrice(DECIMAL_PRECISION.mul(4)); // TCR = ~200% as the debt is 1BEUR + 1BEUR liquidation reserve
          await trove1.connect(wallets[0]).borrow(accounts[0], toBN(amount), trove11.address);
          await trove11.connect(wallets[0]).borrow(accounts[0], toBN(amount), trove12.address);
          await trove12.connect(wallets[1]).borrow(accounts[0], toBN(amount), trove11.address);
        });

        it("can not redeem with bad TCR or bad fee rate", async function () {
          const redemptionAmount1 = toBN(amount); // '1000000000000000000'
          await mintableTokenOwner.mint(await wallets[4].getAddress(), redemptionAmount1.mul(2));
          const maxRate = toBN(DECIMAL_PRECISION).div(20); // 5%
          const lastTroveTCR = await trove11.collateralization();
          const lastTroveHint = trove12.address;

          await expect(
            troveFactory.connect(wallets[4]).redeemStableCoinForCollateral(troveToken1.address, redemptionAmount1, maxRate, lastTroveTCR, lastTroveHint)
          ).to.be.revertedWith("a7f99 StableCoin is not approved for factory");

          await stableCoin.connect(wallets[4]).approve(troveFactory.address, ethers.constants.MaxInt256);
          await expect(troveFactory.connect(wallets[4]).redeemStableCoinForCollateral(troveToken1.address, redemptionAmount1, maxRate.div(50), lastTroveTCR, lastTroveHint)).to.not
            .be.reverted;

          const liquidationPrice = toBN(DECIMAL_PRECISION).mul(1).div(5); // 0.2
          await priceFeed1.setPrice(liquidationPrice);

          await expect(
            troveFactory.connect(wallets[4]).redeemStableCoinForCollateral(troveToken1.address, redemptionAmount1, maxRate, lastTroveTCR, lastTroveHint)
          ).to.be.revertedWith("a7f99 first trove is undercollateralised and must be liquidated");
        });

        it("redeems from few troves with normal amount to price", async function () {
          const bonqStaking = (await deployUUPSContract(wallets[0], "BONQStaking", [bonqToken.address], [])) as BONQStaking;

          await bonqStaking.setFactory(troveFactory.address);
          await bonqStaking.setInitialLastFee(0);
          await troveFactory.setFeeRecipient(bonqStaking.address);

          const initialPrice = toBN(DECIMAL_PRECISION).mul(3); // 149% < TCR < 150%
          await priceFeed1.setPrice(initialPrice);
          const redemptionAmount1 = toBN(amount).mul(3);
          await mintableTokenOwner.mint(await wallets[4].getAddress(), redemptionAmount1.mul(2));
          const initalBeurBalance = await stableCoin.balanceOf(accounts[4]);
          const initalColBalance = await troveToken1.balanceOf(accounts[4]);
          const maxRate = toBN(DECIMAL_PRECISION).div(20); // 5%
          const lastTroveTCR = await trove11.collateralization();
          const lastTroveHint = trove11.address;
          await stableCoin.connect(wallets[4]).approve(troveFactory.address, ethers.constants.MaxInt256);

          const startBaseRate = await bonqStaking.baseRate();
          const expectedStableCoinRedeemed = BigNumber.from("2926829268292682926");
          const baseRateIncrease = expectedStableCoinRedeemed
            .mul(DECIMAL_PRECISION)
            .div((await stableCoin.totalSupply()).sub(expectedStableCoinRedeemed).sub(DECIMAL_PRECISION.mul(2)));
          const calculatedFinishBaseRate = startBaseRate.add(baseRateIncrease);

          expect(await troveFactory.connect(wallets[4]).redeemStableCoinForCollateral(troveToken1.address, redemptionAmount1, maxRate, lastTroveTCR, lastTroveHint))
            .to.emit(troveFactory, "Redemption")
            .withArgs(
              troveToken1.address,
              expectedStableCoinRedeemed,
              // collateral amount = stable coin amount divided by collateral price
              expectedStableCoinRedeemed.div(3),
              1,
              startBaseRate,
              calculatedFinishBaseRate,
              lastTroveHint
            );

          const beurBalance1 = await stableCoin.balanceOf(accounts[4]);
          const colBalance1 = await troveToken1.balanceOf(accounts[4]);
          const idealSwap = colBalance1.sub(initalColBalance).mul(initialPrice).div(DECIMAL_PRECISION);

          expect(initalBeurBalance.sub(beurBalance1)).to.be.closeTo(idealSwap, DECIMAL_PRECISION.div(8));
          expect(idealSwap).to.be.below(redemptionAmount1);
        });

        it("fees are decayed, paid, and with right order", async function () {
          const initialPrice = toBN(DECIMAL_PRECISION).mul(3);
          await priceFeed1.setPrice(initialPrice);

          const collateralisation1_1 = await trove1.collateralization();
          const collateralisation11_1 = await trove11.collateralization();
          const collateralisation12_1 = await trove12.collateralization();

          const bonqStaking = (await deployUUPSContract(wallets[0], "BONQStaking", [bonqToken.address], [])) as BONQStaking;
          await bonqStaking.setFactory(troveFactory.address);
          await bonqStaking.setInitialLastFee(0);
          await troveFactory.setFeeRecipient(bonqStaking.address);

          const redemptionAmount1 = toBN(amount); // '1000000000000000000'
          await mintableTokenOwner.mint(await wallets[4].getAddress(), redemptionAmount1.mul(2));
          const initalBeurBalance = await stableCoin.balanceOf(accounts[4]);
          const initalColBalance = await troveToken1.balanceOf(accounts[4]);
          const maxRate = toBN(DECIMAL_PRECISION); // 5%
          const lastTroveTCR = await trove11.collateralization();
          const lastTroveHint = trove12.address;
          await stableCoin.connect(wallets[4]).approve(troveFactory.address, ethers.constants.MaxInt256);

          const first_trove_order = await get_sorted_troves();

          let baseRate = await bonqStaking.baseRate();

          const CR1 = await trove11.collateralization();

          const realRedemptionAmount1 = await troveFactory.getRedemptionAmount(await troveFactory.getRedemptionFeeRatio(trove11.address), redemptionAmount1.div(500));
          const feeAmount1 = await troveFactory.getRedemptionFee(await troveFactory.getRedemptionFeeRatio(trove11.address), realRedemptionAmount1);
          expect(baseRate).to.equal(0);

          await troveFactory.connect(wallets[4]).redeemStableCoinForCollateral(troveToken1.address, redemptionAmount1.div(500), maxRate, lastTroveTCR, lastTroveHint);
          expect(await stableCoin.balanceOf(bonqStaking.address)).to.be.closeTo(feeAmount1, feeAmount1.div(20)); // +-5%
          const baseRate2 = await bonqStaking.baseRate();
          expect(baseRate2).to.be.gt(baseRate);

          const trove_order2 = await get_sorted_troves();
          expect(first_trove_order[0]).to.be.equal(trove_order2[trove_order2.length - 1]);

          await expect(troveFactory.connect(wallets[4]).redeemStableCoinForCollateral(troveToken1.address, redemptionAmount1.div(200), maxRate, lastTroveTCR, lastTroveHint)).to.not
            .be.reverted;

          const baseRate3 = await bonqStaking.baseRate();
          expect(baseRate3).to.be.gt(baseRate2);

          const trove_order3 = await get_sorted_troves();
          expect(trove_order2[0]).to.be.equal(trove_order3[trove_order3.length - 1]);
          expect(first_trove_order[0]).to.be.equal(trove_order3[trove_order3.length - 2]);

          await expect(troveFactory.connect(wallets[4]).redeemStableCoinForCollateral(troveToken1.address, redemptionAmount1, maxRate, lastTroveTCR, lastTroveHint)).to.not.be
            .reverted;

          baseRate = await bonqStaking.baseRate();
          const decayed1 = await bonqStaking.calcDecayedBaseRate(baseRate);
          await provider.send("evm_increaseTime", [2048 * 4 * 60]); // 1 (but time shift when totalDeposits = 0 must be missed)
          await provider.send("evm_mine", []); // to create new block
          expect(await bonqStaking.calcDecayedBaseRate(baseRate)).to.be.lt(decayed1);
          const beurBalance1 = await stableCoin.balanceOf(accounts[4]);
          const colBalance1 = await troveToken1.balanceOf(accounts[4]);
          const idealSwap = colBalance1.sub(initalColBalance).mul(initialPrice).div(DECIMAL_PRECISION);

          expect(initalBeurBalance.sub(beurBalance1)).to.be.closeTo(idealSwap, maxRate);
          const collateralisation1_2 = await trove1.collateralization();
          const collateralisation11_2 = await trove11.collateralization();
          const collateralisation12_2 = await trove12.collateralization();
          expect(collateralisation1_2).to.be.gt(collateralisation1_1);
          expect(collateralisation11_2).to.be.gt(collateralisation11_1);
          expect(collateralisation12_2).to.be.gt(collateralisation12_1);
        });

        after(async function () {
          await troveFactory.setFeeRecipient(testFeeRecipient.address);
        });
      });

      describe("Redemption fees", function () {
        let troveToken1: MintableToken,
          priceFeed1: TestPriceFeed,
          communityLiquidationPool1: ILiquidationPool,
          bonqStaking: BONQStaking,
          trove1: Trove,
          trove11: Trove,
          trove12: Trove;

        beforeEach(async () => {
          troveToken1 = await deployContract(wallets[0], "MintableToken", ["TroveToken1", "TT1"]);

          priceFeed1 = await deployContract(wallets[0], "TestPriceFeed", [troveToken1.address]);

          await tokenToPriceFeed.setTokenPriceFeed(troveToken1.address, priceFeed1.address, 100, 150000);
          await priceFeed1.setPrice(DECIMAL_PRECISION.mul(2));

          communityLiquidationPool1 = await deployContract(wallets[0], "CommunityLiquidationPool", [troveFactory.address, troveToken1.address]);

          await troveFactory.setLiquidationPool(troveToken1.address, communityLiquidationPool1.address);

          bonqStaking = (await deployUUPSContract(wallets[0], "BONQStaking", [bonqToken.address], [])) as BONQStaking;
          await bonqStaking.setFactory(troveFactory.address);
          await bonqStaking.setInitialLastFee(0);
          await troveFactory.setFeeRecipient(bonqStaking.address);

          trove1 = await addTrove(wallets[0], troveToken1.address);
          trove11 = await addTrove(wallets[0], troveToken1.address);
          trove12 = await addTrove(wallets[1], troveToken1.address);
        });

        describe("Testing BonqStaking getRedemptionFeeRatio for different MCR", function () {
          // test with constant MCR, and list of (CR -> Fee) pair values
          const createGetRedemptionFeeRatioTest = function (_MCR: number, _MRF: number, cr_to_fee: [number, BigNumber][]) {
            return async function () {
              await await tokenToPriceFeed.setTokenPriceFeed(troveToken1.address, priceFeed1.address, _MCR, _MRF);
              await trove1.connect(wallets[0]).borrow(accounts[0], toBN(amount), trove1.address);
              const collateral = await trove1.collateral();
              for (const [TCR, IDEAL_FEE] of cr_to_fee) {
                await (await priceFeed1.setPrice((await trove1.debt()).mul(DECIMAL_PRECISION).div(collateral).mul(TCR).div(100))).wait();
                expect(await troveFactory.getRedemptionFeeRatio(trove1.address)).to.be.closeTo(
                  IDEAL_FEE.add(1),
                  IDEAL_FEE.div(1000).mul(8), // +-0.6% of error
                  `ERROR for ${_MCR.toString()} MCR with ${TCR} CR to result in ${IDEAL_FEE.toString()} rate`
                );
              }
            };
          };

          it(
            "Test MCR 100%",
            createGetRedemptionFeeRatioTest(100, 5000, [
              // 100% MCR
              [100, DECIMAL_PRECISION.mul(95).div(1000)], // 100% -> 9.5%
              [101, DECIMAL_PRECISION.mul(951).div(10000)], // 101% -> 9.51%
              [102, DECIMAL_PRECISION.mul(954).div(10000)], // 102% -> 9.54%
              [105, DECIMAL_PRECISION.mul(975).div(10000)], // 105% -> 9.75%
              [110, DECIMAL_PRECISION.mul(105).div(1000)], // 110% -> 10.5%
              [120, DECIMAL_PRECISION.mul(135).div(1000)], // 120% -> 13.5%
              [140, DECIMAL_PRECISION.mul(255).div(1000)], // 140% -> 25.5%
              [150, DECIMAL_PRECISION.mul(345).div(1000)], // 150% -> 34.5%
              [255, DECIMAL_PRECISION.mul(5000).div(10000)], // 255% -> 248.34% but capped at 50%
              [555, DECIMAL_PRECISION.mul(5000).div(10000)], // 555% -> 2075.62% but capped at 50%
              [1600, DECIMAL_PRECISION.mul(5000).div(10000)], // 1600% -> 22509.5% (extra CR = 15 * MCR) but capped at 50%
              [1700, DECIMAL_PRECISION.mul(5000).div(10000)] // 1700% -> 22509.5% (same as for 1600%) but capped at 50%
            ])
          );

          it(
            "Test MCR 110%",
            createGetRedemptionFeeRatioTest(110, 2500, [
              // 110% MCR
              [110, DECIMAL_PRECISION.mul(132).div(10000)], // 110% -> 1.32%
              [111, DECIMAL_PRECISION.mul(132).div(10000)], // 111% -> 1.32%
              [112, DECIMAL_PRECISION.mul(132).div(10000)], // 112% -> 1.32%
              [115, DECIMAL_PRECISION.mul(136).div(10000)], // 115% -> 1.36%
              [120, DECIMAL_PRECISION.mul(147).div(10000)], // 120% -> 1.47%
              [130, DECIMAL_PRECISION.mul(192).div(10000)], // 130% -> 1.92%
              [140, DECIMAL_PRECISION.mul(267).div(10000)], // 140% -> 2.67%
              [150, DECIMAL_PRECISION.mul(372).div(10000)], // 150% -> 3.72%
              [265, DECIMAL_PRECISION.mul(2500).div(10000)], // 265% -> 37.21% capped at 25%
              [565, DECIMAL_PRECISION.mul(2500).div(10000)], // 565% -> 311.78% capped at 25%
              [1760, DECIMAL_PRECISION.mul(2500).div(10000)], // 1760% -> 4092.23% (extra CR = 15 * MCR) capped at 25%
              [2000, DECIMAL_PRECISION.mul(2500).div(10000)] // 1900% -> 4092.23% (same as for 1760%) capped at 25%
            ])
          );

          it(
            "Test MCR 150%",
            createGetRedemptionFeeRatioTest(150, 1000, [
              // 150% MCR
              [150, DECIMAL_PRECISION.mul(5).div(1000)], // 150% -> 0.5%
              [151, DECIMAL_PRECISION.mul(5).div(1000)], // 151% -> 0.5%
              [152, DECIMAL_PRECISION.mul(5).div(1000)], // 152% -> 0.5%
              [155, DECIMAL_PRECISION.mul(504).div(100000)], // 155% -> 0.504%
              [160, DECIMAL_PRECISION.mul(52).div(10000)], // 160% -> 0.52%
              [170, DECIMAL_PRECISION.mul(58).div(10000)], // 170% -> 0.58%
              [180, DECIMAL_PRECISION.mul(67).div(10000)], // 180% -> 0.67%
              [190, DECIMAL_PRECISION.mul(80).div(10000)], // 190% -> 0.80%
              [305, DECIMAL_PRECISION.mul(502).div(10000)], // 305% -> 5.02%
              [605, DECIMAL_PRECISION.mul(1000).div(10000)], // 305% -> 39.58% capped at 10%
              [2400, DECIMAL_PRECISION.mul(1000).div(10000)], // 2400% -> 957.95% (extra CR = 15 * MCR) capped at 10%
              [3000, DECIMAL_PRECISION.mul(1000).div(10000)] // 3000% -> 957.95% (same as for 2400%) capped at 10%
            ])
          );

          it(
            "Test MCR 500%",
            createGetRedemptionFeeRatioTest(500, 500, [
              // 500% MCR
              [500, DECIMAL_PRECISION.mul(5).div(1000)], // 500% -> 0.5%
              [501, DECIMAL_PRECISION.mul(5).div(1000)], // 501% -> 0.5%
              [502, DECIMAL_PRECISION.mul(5).div(1000)], // 502% -> 0.5%
              [505, DECIMAL_PRECISION.mul(5).div(1000)], // 505% -> 0.5%
              [510, DECIMAL_PRECISION.mul(5).div(1000)], // 510% -> 0.5%
              [570, DECIMAL_PRECISION.mul(51).div(10000)], // 570% -> 0.51%
              [692, DECIMAL_PRECISION.mul(58).div(10000)], // 692% -> 0.58%
              [880, DECIMAL_PRECISION.mul(82).div(10000)], // 880% -> 0.82%
              [1104, DECIMAL_PRECISION.mul(131).div(10000)], // 1104% -> 1.31%
              [1400, DECIMAL_PRECISION.mul(229).div(10000)], // 1400% -> 2.29%
              [8000, DECIMAL_PRECISION.mul(500).div(10000)], // 8000% -> 124.81% (extra CR = 15 * MCR) capped at 5%
              [9000, DECIMAL_PRECISION.mul(500).div(10000)] // 9000% -> 124.81% (same as for 8000%) capped at 5%
            ])
          );
        });

        describe("Testing fees on Trove redemptions for different MCR", function () {
          // test with Trove CR -> to ideal Fee values
          const createRedemptionCRtoFeeTest = function (_troveCR: number, _idealRate: BigNumber, _feeReductionPercentage = 0) {
            return async function () {
              const lastTroveHint = trove1.address;
              const redemptionAmount = DECIMAL_PRECISION.div(10);
              const maxRate = _idealRate.mul(11).div(10); // +10% from idealRate
              const idealAmount = redemptionAmount.mul(DECIMAL_PRECISION).div(DECIMAL_PRECISION.add(_idealRate));
              let idealFee = idealAmount.mul(_idealRate).div(DECIMAL_PRECISION);
              let feeRefund = BigNumber.from(0);
              if (_feeReductionPercentage > 0) {
                feeRefund = idealFee.mul(_feeReductionPercentage).div(100);
                idealFee = idealFee.sub(idealFee.mul(_feeReductionPercentage).div(100));
              }

              await trove1.connect(wallets[0]).borrow(accounts[0], toBN(amount), trove1.address);
              await priceFeed1.setPrice(
                DECIMAL_PRECISION.mul(await trove1.debt())
                  .div(await trove1.collateral())
                  .mul(_troveCR)
                  .div(100)
              );
              expect(await trove1.collateralization(), _troveCR.toString() + "% CR").to.equal(DECIMAL_PRECISION.mul(_troveCR).div(100));

              await mintableTokenOwner.mint(await wallets[4].getAddress(), DECIMAL_PRECISION.mul(10));
              await stableCoin.connect(wallets[4]).approve(troveFactory.address, ethers.constants.MaxInt256);

              const TCR = await trove1.collateralization();
              const bonqStakingBal1 = await stableCoin.balanceOf(bonqStaking.address);

              if (_feeReductionPercentage !== 0) {
                const stakeAmount = DECIMAL_PRECISION.mul(_feeReductionPercentage);
                let tx = await bonqToken.mint(accounts[0], stakeAmount.mul(2));
                await tx.wait();
                tx = await bonqToken.mint(accounts[1], stakeAmount);
                await tx.wait();
                tx = await bonqToken.approve(trove1.address, stakeAmount);
                await tx.wait();
                tx = await bonqToken.approve(trove11.address, stakeAmount);
                await tx.wait();
                tx = await bonqToken.connect(wallets[1]).approve(trove12.address, stakeAmount);
                await tx.wait();

                tx = await bonqToken.transfer(trove1.address, stakeAmount);
                await tx.wait();
                tx = await bonqToken.transfer(trove11.address, stakeAmount);
                await tx.wait();
                tx = await bonqToken.connect(wallets[1]).transfer(trove11.address, stakeAmount);
                await tx.wait();
              }

              const trove1DebtBeforeRedemption = await trove1.debt();
              const trove11DebtBeforeRedemption = await trove11.debt();
              const trove12DebtBeforeRedemption = await trove12.debt();
              const troveDebtSumBeforeRedemption = trove1DebtBeforeRedemption.add(trove11DebtBeforeRedemption).add(trove12DebtBeforeRedemption);

              await expect(troveFactory.connect(wallets[4]).redeemStableCoinForCollateral(troveToken1.address, redemptionAmount, maxRate, TCR, lastTroveHint)).to.emit(
                troveFactory,
                "Redemption"
              );

              const bonqStakingBal2 = await stableCoin.balanceOf(bonqStaking.address);
              expect(bonqStakingBal2.sub(bonqStakingBal1)).to.be.closeTo(idealFee, idealFee.mul(6).div(1000)); // +-0.6% of error

              const trove1DebtAfterRedemption = await trove1.debt();
              const trove11DebtAfterRedemption = await trove11.debt();
              const trove12DebtAfterRedemption = await trove12.debt();
              const troveDebtSumAfterRedemption = trove1DebtAfterRedemption.add(trove11DebtAfterRedemption).add(trove12DebtAfterRedemption);

              expect(troveDebtSumAfterRedemption).to.be.closeTo(
                troveDebtSumBeforeRedemption.sub(redemptionAmount).add(idealFee),
                _feeReductionPercentage ? DECIMAL_PRECISION.div(1e12) : idealFee.mul(6).div(1000)
              );
            };
          };

          describe("MCR 100% ", function () {
            beforeEach(async () => {
              await (await tokenToPriceFeed.setTokenPriceFeed(troveToken1.address, priceFeed1.address, 100, 1500000)).wait();
              const tx = await troveFactory.setMaxTroveBONQStake(DECIMAL_PRECISION.mul(100));
              await tx.wait();
            });

            it(
              "TCR => Redemption fee: 101% => 9.51%",
              createRedemptionCRtoFeeTest(101, DECIMAL_PRECISION.mul(951).div(10000)) // 9.51%
            );

            it(
              "TCR => Redemption fee: 120% => 13.5%",
              createRedemptionCRtoFeeTest(120, DECIMAL_PRECISION.mul(135).div(1000)) // 13.5%
            );

            it(
              "TCR => Redemption fee: 150% => 34.5%",
              createRedemptionCRtoFeeTest(150, DECIMAL_PRECISION.mul(345).div(1000)) // 34.5%
            );

            it(
              "TCR => Redemption fee: 480% => 1453.50%",
              createRedemptionCRtoFeeTest(480, DECIMAL_PRECISION.mul(14535).div(1000)) // 1453.50%
            );

            it(
              "TCR => Redemption fee: 101% => 9.51% with 25% fee reduction",
              createRedemptionCRtoFeeTest(101, DECIMAL_PRECISION.mul(951).div(10000), 25) // 9.51%
            );

            it(
              "TCR => Redemption fee: 120% => 13.5% with 55% fee reduction",
              createRedemptionCRtoFeeTest(120, DECIMAL_PRECISION.mul(135).div(1000), 55) // 13.5%
            );

            it(
              "TCR => Redemption fee: 150% => 34.5% with 75% fee reduction",
              createRedemptionCRtoFeeTest(150, DECIMAL_PRECISION.mul(345).div(1000), 75) // 34.5%
            );

            it(
              "TCR => Redemption fee: 480% => 1453.50% with 100% fee reduction",
              createRedemptionCRtoFeeTest(480, DECIMAL_PRECISION.mul(14535).div(1000), 100) // 1453.50%
            );
          });

          describe("MCR 120% ", function () {
            beforeEach(async () => {
              await tokenToPriceFeed.setTokenPriceFeed(troveToken1.address, priceFeed1.address, 120, 1500000);
            });

            it(
              "TCR => Redemption fee: 120% => 0.5%",
              createRedemptionCRtoFeeTest(120, DECIMAL_PRECISION.mul(5).div(1000)) // 0.5%
            );

            it(
              "TCR => Redemption fee: 150% => 1.13%",
              createRedemptionCRtoFeeTest(150, DECIMAL_PRECISION.mul(113).div(10000)) // 1.13%
            );

            it(
              "TCR => Redemption fee: 275% => 17.09%",
              createRedemptionCRtoFeeTest(275, DECIMAL_PRECISION.mul(1709).div(10000)) // 17.09%
            );
          });

          describe("MCR 200% ", function () {
            beforeEach(async () => {
              await tokenToPriceFeed.setTokenPriceFeed(troveToken1.address, priceFeed1.address, 200, 1500000);
            });

            it(
              "TCR => Redemption fee: 201% => 0.5%",
              createRedemptionCRtoFeeTest(201, DECIMAL_PRECISION.mul(5).div(1000)) // 0.5%
            );

            it(
              "TCR => Redemption fee: 220% => 0.52%",
              createRedemptionCRtoFeeTest(220, DECIMAL_PRECISION.mul(52).div(10000)) // 0.52%
            );

            it(
              "TCR => Redemption fee: 280% => 0.85%",
              createRedemptionCRtoFeeTest(280, DECIMAL_PRECISION.mul(85).div(10000)) // 0.85%
            );

            it(
              "TCR => Redemption fee: 580% => 8.35%",
              createRedemptionCRtoFeeTest(580, DECIMAL_PRECISION.mul(835).div(10000)) // 8.35%
            );
          });

          describe("Multiplie Troves with different CR in one redemption", function () {
            beforeEach(async () => {
              await tokenToPriceFeed.setTokenPriceFeed(troveToken1.address, priceFeed1.address, 120, 2000);
            });

            it("Compound redemption with full redemptions:  ", async function () {
              await troveToken1.mint(trove1.address, DECIMAL_PRECISION.mul(5));
              await troveToken1.mint(trove11.address, DECIMAL_PRECISION.mul(5));
              await trove1.increaseCollateral(0, trove1.address);
              await trove11.increaseCollateral(0, trove1.address);
              await stableCoin.approve(trove1.address, ethers.constants.MaxInt256);
              await stableCoin.approve(trove11.address, ethers.constants.MaxInt256);

              const borrowAmount1 = DECIMAL_PRECISION.mul(10);
              const redemptionAmount1 = DECIMAL_PRECISION.mul(10);
              const idealRate1 = DECIMAL_PRECISION.mul(1125).div(100000); // 1.125%
              // take the liquidation reserve into account
              const idealFee1 = redemptionAmount1.sub(DECIMAL_PRECISION).mul(idealRate1).div(DECIMAL_PRECISION);
              const leftOver = DECIMAL_PRECISION.sub(idealFee1);

              const borrowAmount2 = DECIMAL_PRECISION.mul(10).mul(6).div(11);
              const redemptionAmount2 = DECIMAL_PRECISION.mul(2);
              const idealRate2 = toBN("171840277777777777"); // 17.18%
              const idealFee2 = redemptionAmount2.add(leftOver).mul(idealRate2).div(DECIMAL_PRECISION);

              // borrow and then repay the fee to have a round number
              await trove1.connect(wallets[0]).borrow(accounts[0], borrowAmount1, trove1.address);
              await trove1.repay((await trove1.debt()).sub(borrowAmount1), trove1.address);

              // borrow and then repay the fee to have a round number
              await trove11.connect(wallets[0]).borrow(accounts[0], borrowAmount2, trove1.address);
              await trove11.repay((await trove11.debt()).sub(borrowAmount2), trove11.address);

              await (await priceFeed1.setPrice(DECIMAL_PRECISION)).wait();

              expect(await troveFactory.getRedemptionFeeRatio(trove1.address)).to.be.equal(idealRate1);
              expect(await troveFactory.getRedemptionFeeRatio(trove11.address)).to.be.equal(idealRate2);

              // TCR after => +- 1.5 and 2.75
              expect(await trove1.collateralization(), "150% CR").to.be.equal(DECIMAL_PRECISION.mul(150).div(100));
              expect(await trove11.collateralization(), "275% CR").to.be.equal(DECIMAL_PRECISION.mul(275).div(100));
              await mintableTokenOwner.mint(await wallets[4].getAddress(), redemptionAmount1.add(redemptionAmount2).mul(2));
              await stableCoin.connect(wallets[4]).approve(troveFactory.address, ethers.constants.MaxInt256);
              const TCR = await trove11.collateralization();

              const bonqStakingBal1 = await stableCoin.balanceOf(bonqStaking.address);
              const receipt = await (
                await troveFactory
                  .connect(wallets[4])
                  .redeemStableCoinForCollateral(troveToken1.address, redemptionAmount1.add(redemptionAmount2), DECIMAL_PRECISION, TCR, trove11.address)
              ).wait();

              const event = getEventsFromReceipt(troveFactory.interface, receipt, "Redemption")[0].args;
              expect(event.token).to.equal(troveToken1.address);
              expect(event.lastTroveRedeemed).to.equal(trove11.address);
              expect(redemptionAmount1.add(redemptionAmount2).sub(idealFee1).sub(idealFee2)).to.be.closeTo(event.stableAmount, event.stableAmount.div(100));
            });
          });
        });
      });
    });
  });
});
