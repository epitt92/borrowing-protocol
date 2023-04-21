import { expect } from "chai";
import { ArbitragePoolUniswap, ReplacementArbitragePoolUniswap } from "../src/types";
import { ethers } from "hardhat";
import { before, describe } from "mocha";
import { UniswapV3ArbitragePoolTest } from "./utils/UniswapV3ArbitragePoolTest";
import { DECIMAL_PRECISION, toBN, upgradeUUPSContract } from "./utils/helpers";
import { Contract, Signer } from "ethers";

// Start test block
describe("Arbitrage Pool with Uniswap V3", function () {
  this.timeout(60000);
  const sut = new UniswapV3ArbitragePoolTest(ethers);
  let wallets: Signer[];
  let accounts: string[];

  before(async function () {
    await sut.ready;
    await sut.setup();
    wallets = sut.wallets;
    accounts = sut.accounts;
  });

  after(async function () {
    await sut.teardown();
  });

  describe("deployment", function () {
    it("sets up UniswapV3ArbitragePoolTest", async function () {
      expect(sut.isSetup).to.be.true;
    });
  });

  describe("arbitrage pool functions", function () {
    it("reverts to the snapshot", async function () {
      expect(await sut.beur.balanceOf(accounts[5])).to.equal(0);
      await sut.beur.mint(accounts[5], DECIMAL_PRECISION.mul(100));
      expect(await sut.beur.balanceOf(accounts[5])).to.equal(DECIMAL_PRECISION.mul(100));
      await sut.revert();
      expect(await sut.beur.balanceOf(accounts[5])).to.equal(0);
    });

    it("ArbitragePoolUniswap can be replaced with a new version", async function () {
      sut.arbitragePool = (await upgradeUUPSContract(sut.arbitragePool as Contract, wallets[0], "ReplacementArbitragePoolUniswap", [
        sut.troveFactory.address,
        sut.routerAddress
      ])) as ArbitragePoolUniswap;

      expect((await (sut.arbitragePool as unknown as ReplacementArbitragePoolUniswap).name()).toString()).to.equal("ReplacementArbitragePoolUniswap");
    });

    it("APToken has right name and symbol", async function () {
      const apToken = await sut.getAP(sut.btcAddress);
      expect(await apToken.name()).to.be.equal("APToken for " + (await sut.fbtc.name()));
      expect(await apToken.symbol()).to.be.equal("AP" + (await sut.fbtc.symbol()));
    });

    it("can receive deposits", async function () {
      const apToken = await sut.getAP(sut.beurAddress);
      const mintingAmount = "100000000000000000000";
      const depositAmount = "100000000000000000";
      await sut.beur.mint(await wallets[1].getAddress(), mintingAmount);

      await sut.beur.connect(wallets[1]).approve(sut.arbitragePool.address, depositAmount);

      await expect(sut.arbitragePool.connect(wallets[1]).deposit(sut.beurAddress, depositAmount))
        .to.emit(sut.arbitragePool, "Deposit")
        .withArgs(sut.beurAddress, await wallets[1].getAddress(), depositAmount, depositAmount);
      expect(await apToken.balanceOf(accounts[1])).to.be.equal(depositAmount);
    });

    it("contributor cannot perform deposit with 0 value", async function () {
      const depositAmount = "0";
      await sut.troveToken.connect(wallets[0]).approve(sut.arbitragePool.address, depositAmount);
      await expect(sut.arbitragePool.connect(wallets[0]).deposit(sut.troveToken.address, depositAmount)).to.be.revertedWith("d7db9 deposit amount must be bigger than zero");
    });

    it("contributor can perform withdraw", async function () {
      const apToken = await sut.getAP(sut.troveToken.address);
      const mintingAmount = "100000000000000000000";
      const withdrawAmount = "100000000000000000";
      await sut.troveToken.mint(await wallets[0].getAddress(), mintingAmount);

      await sut.troveToken.connect(wallets[0]).approve(sut.arbitragePool.address, withdrawAmount);

      await expect(sut.arbitragePool.connect(wallets[0]).deposit(sut.troveToken.address, withdrawAmount))
        .to.emit(sut.arbitragePool, "Deposit")
        .withArgs(sut.troveToken.address, await wallets[0].getAddress(), withdrawAmount, withdrawAmount);

      await apToken.connect(wallets[0]).approve(sut.arbitragePool.address, mintingAmount);

      await expect(sut.arbitragePool.connect(wallets[0]).withdraw(sut.troveToken.address, withdrawAmount))
        .to.emit(sut.arbitragePool, "Withdraw")
        .withArgs(sut.troveToken.address, await wallets[0].getAddress(), withdrawAmount, withdrawAmount);
      expect(await sut.troveToken.balanceOf(accounts[0])).to.be.equal(mintingAmount);
      expect(await apToken.balanceOf(accounts[0])).to.be.equal(0);
    });

    it("contributor cannot perform withdraw without deposit", async function () {
      const apToken = await sut.getAP(sut.troveToken.address);
      const mintingAmount = "100000000000000000000";
      const withdrawAmount = "100000000000000000";
      await sut.troveToken.mint(await wallets[0].getAddress(), mintingAmount);

      await sut.troveToken.connect(wallets[0]).approve(sut.arbitragePool.address, withdrawAmount);
      await apToken.connect(wallets[0]).approve(sut.arbitragePool.address, withdrawAmount);

      await expect(sut.arbitragePool.connect(wallets[0]).withdraw(sut.troveToken.address, withdrawAmount)).to.be.revertedWith("ERC20: transfer amount exceeds balance");
    });
  });

  describe("arbitrage", function () {
    let arbitragePath: string[];
    let feesPath: string[];

    beforeEach(async function () {
      arbitragePath = [sut.ethAddress, sut.btcAddress, sut.beurAddress, sut.ethAddress];
      feesPath = ["500", "500", "500"];
      await sut.revert();
    });

    it("fails when the path does not start with collateral token", async function () {
      const amount = DECIMAL_PRECISION.mul("16000");
      // remove the first element
      arbitragePath.splice(0, 1);
      await expect(sut.arbitragePool.arbitrage(sut.ethAddress, amount, arbitragePath, feesPath, 0)).to.be.revertedWith("92852 must start with collateralToken");
    });

    it("fails when the path does not end with collateral token", async function () {
      const amount = DECIMAL_PRECISION.mul("16000");
      // remove the last element
      arbitragePath.splice(3, 1);
      await expect(sut.arbitragePool.arbitrage(sut.ethAddress, amount, arbitragePath, feesPath, 0)).to.be.revertedWith("92852 must end with _collateralToken");
    });

    it("can take advantage of the imbalance in the path eth - btc - beur - eth", async function () {
      await expect(sut.arbitragePool.arbitrage(sut.ethAddress, DECIMAL_PRECISION.mul(10), arbitragePath, feesPath, 0))
        .to.emit(sut.arbitragePool, "Arbitrage")
        .withArgs(sut.ethAddress, arbitragePath, DECIMAL_PRECISION.mul(10), "3014478479198207521");
    });

    it("reverts with the unprofitable amount for path eth - btc - beur - eth", async function () {
      await (await sut.feth.approve(sut.arbitragePool.address, DECIMAL_PRECISION.mul(1e6))).wait();
      await (await sut.arbitragePool.deposit(sut.ethAddress, DECIMAL_PRECISION.mul(1e5))).wait();
      await expect(sut.arbitragePool.arbitrage(sut.ethAddress, DECIMAL_PRECISION.mul(1e5), arbitragePath, feesPath, 0)).to.be.revertedWith("Too little received");
    });

    it("reverts with the unprofitable path btc - eth - beur - btc", async function () {
      arbitragePath = [sut.btcAddress, sut.ethAddress, sut.beurAddress, sut.btcAddress];
      await expect(sut.arbitragePool.arbitrage(sut.btcAddress, DECIMAL_PRECISION.mul(1), arbitragePath, feesPath, 0)).to.be.revertedWith("Too little received");
    });

    it("fails when too late", async function () {
      const amount = DECIMAL_PRECISION.mul(100);
      const blockTime = toBN((await sut.eth.provider.getBlock("latest")).timestamp);
      await expect(sut.arbitragePool.arbitrage(sut.ethAddress, amount, arbitragePath, feesPath, blockTime.sub(12))).to.be.revertedWith("92852 too late");
    });

    it("distributes arbitrage profits among liquidity providers", async function () {
      await sut.revert();
      const apContributors = 4;
      const apToken = await sut.getAP(sut.ethAddress);
      const amount = DECIMAL_PRECISION.mul(1e4);

      for (let i = 1; i <= apContributors; i++) {
        await (await sut.feth.mint(accounts[i], amount)).wait();
        await (await sut.feth.connect(wallets[i]).approve(sut.arbitragePool.address, amount)).wait();
        await (await apToken.connect(wallets[i]).approve(sut.arbitragePool.address, amount)).wait();

        await (await sut.arbitragePool.connect(wallets[i]).deposit(sut.ethAddress, DECIMAL_PRECISION.mul(1e3))).wait();
      }

      // check that each contributor received their share of tokens. one contributor is added in beforeEach
      for (let i = 1; i <= apContributors; i++) {
        expect(await apToken.balanceOf(accounts[i])).to.equal((await apToken.totalSupply()).div(apContributors + 1));
      }

      for (let tokens = 5; tokens <= 15; tokens += 5) {
        const apBalance = await sut.feth.balanceOf(sut.arbitragePool.address);

        await expect(sut.arbitragePool.arbitrage(sut.feth.address, DECIMAL_PRECISION.mul(tokens), arbitragePath, feesPath, "0")).to.emit(sut.arbitragePool, "Arbitrage");

        const arbitrageGain = toBN(await sut.feth.balanceOf(sut.arbitragePool.address)).sub(apBalance);

        for (let i = 1; i <= apContributors; i++) {
          const collateralBalance = (await apToken.balanceOf(accounts[i])).mul(await sut.arbitragePool.getAPtokenPrice(sut.ethAddress)).div(DECIMAL_PRECISION);
          expect(collateralBalance.mul(apContributors + 1)).to.be.closeTo(await sut.feth.balanceOf(sut.arbitragePool.address), 1e5);
        }
        const totalCollateralBalance = (await apToken.totalSupply()).mul(await sut.arbitragePool.getAPtokenPrice(sut.ethAddress)).div(DECIMAL_PRECISION);
        expect(totalCollateralBalance).to.closeTo(await sut.feth.balanceOf(sut.arbitragePool.address), 1e5);
      }

      for (let i = 1; i <= apContributors; i++) {
        const withdrawnAPT = await apToken.balanceOf(accounts[i]);
        const collateralBalance = (await apToken.balanceOf(accounts[i])).mul(await sut.arbitragePool.getAPtokenPrice(sut.ethAddress)).div(DECIMAL_PRECISION);
        await expect(sut.arbitragePool.connect(wallets[i]).withdraw(sut.feth.address, await apToken.balanceOf(accounts[i])))
          .to.emit(sut.arbitragePool, "Withdraw")
          .withArgs(sut.feth.address, accounts[i], collateralBalance, withdrawnAPT);
      }
    });
  });
});
