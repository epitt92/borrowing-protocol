import { expect, use } from "chai";
import { deployContract, toBN } from "./utils/helpers";
import { before, describe } from "mocha";
import { ethers, network } from "hardhat";
import { providers, Signer } from "ethers";
import { ArrakisVaultPriceFeed, ArrakisVaultUSDC, ArrakisVaultWETH, IArrakisVault, TestMintableToken, TestPriceFeed } from "../src/types";
import { solidity } from "ethereum-waffle";
import { polygonRPC } from "../config";

use(solidity);

const ONE = toBN("1000000000000000000");

describe("Arrakis Price Feed", function () {
  let provider: providers.JsonRpcProvider;
  const wallets: Signer[] = [];
  let accounts: string[];
  let usdc: TestMintableToken;
  let weth: TestMintableToken;
  let usdcPF: TestPriceFeed;
  let wethPF: TestPriceFeed;
  let usdcVault: ArrakisVaultUSDC;
  let wethVault: ArrakisVaultWETH;

  before(async function () {
    provider = ethers.provider;
    accounts = await provider.listAccounts();
    for (const account of accounts) {
      wallets.push(provider.getSigner(account));
    }
  });

  describe("with hardhat test chain", function () {
    beforeEach(async function () {
      usdc = (await deployContract(wallets[0], "TestMintableToken", ["BONQ Token for Test", "BONQ"])) as TestMintableToken;
      await usdc.setDecimals(6);
      weth = (await deployContract(wallets[0], "TestMintableToken", ["BONQ Token for Test", "BONQ"])) as TestMintableToken;

      usdcPF = await deployContract(wallets[0], "TestPriceFeed", [usdc.address]);
      await usdcPF.setPrice(ONE.mul(100).div(125));
      wethPF = (await deployContract(wallets[0], "TestPriceFeed", [weth.address])) as TestPriceFeed;
      await wethPF.setPrice(ONE.mul(1250));

      usdcVault = await deployContract(wallets[0], "ArrakisVaultUSDC", [usdc.address]);
      wethVault = await deployContract(wallets[0], "ArrakisVaultWETH", [usdc.address]);
    });

    it("fails to deploy a price feed without either a vault or a pricefeed", async function () {
      await expect(deployContract(wallets[0], "ArrakisVaultPriceFeed", [ethers.constants.AddressZero, ethers.constants.AddressZero])).to.be.revertedWith(
        "e2637b vault must not be address 0x0"
      );
      await expect(deployContract(wallets[0], "ArrakisVaultPriceFeed", [usdc.address, ethers.constants.AddressZero])).to.be.revertedWith(
        "e2637b priceFeed must not be address 0x0"
      );
    });

    it("successfully creates a price feed with valid parameters", async function () {
      const pf: ArrakisVaultPriceFeed = await deployContract(wallets[0], "ArrakisVaultPriceFeed", [usdcVault.address, usdcPF.address]);
      expect(await pf.token()).to.equal(usdcVault.address);
      expect(await pf.vault()).to.equal(usdcVault.address);
      expect(await pf.priceFeed()).to.equal(usdcPF.address);
    });

    describe("with USDC price feed", function () {
      let priceFeed: ArrakisVaultPriceFeed;
      beforeEach(async function () {
        priceFeed = (await deployContract(wallets[0], "ArrakisVaultPriceFeed", [usdcVault.address, usdcPF.address])) as ArrakisVaultPriceFeed;
      });

      it("usdc is token0", async function () {
        expect(await priceFeed.isToken0()).to.be.true;
      });

      it("gets the latest price when calling price()", async function () {
        expect(await usdcPF.price()).to.equal(ONE.mul(8).div(10));
        expect(await priceFeed.precision()).to.equal(1e6);
        const balances = await usdcVault.getUnderlyingBalances();
        expect(balances[0]).to.equal(toBN(8e8));
        expect(balances[1]).to.equal(ONE.mul(1000));
        expect(await priceFeed.price()).to.equal(ONE.mul(800).mul(8).div(10).div(1000));
      });

      it("emits the PriceUpdate event when requested", async function () {
        await expect(await priceFeed.emitPriceSignal())
          .to.emit(priceFeed, "PriceUpdate")
          .withArgs(usdcVault.address, await priceFeed.price(), await priceFeed.price());
      });
    });

    describe("with WETH price feed", function () {
      let priceFeed: ArrakisVaultPriceFeed;
      beforeEach(async function () {
        priceFeed = (await deployContract(wallets[0], "ArrakisVaultPriceFeed", [wethVault.address, wethPF.address])) as ArrakisVaultPriceFeed;
      });

      it("weth is not token0", async function () {
        expect(await priceFeed.isToken0()).to.be.false;
      });

      it("gets the latest price when calling price()", async function () {
        expect(await wethPF.price()).to.equal(ONE.mul(1250));
        expect(await priceFeed.precision()).to.equal(ONE);
        const balances = await wethVault.getUnderlyingBalances();
        expect(balances[0]).to.equal(ONE.mul(1000));
        expect(balances[1]).to.equal(ONE.mul(80));
        expect(await wethVault.totalSupply()).to.equal(ONE.mul(1000));
        expect(await priceFeed.price()).to.equal(ONE.mul(80).mul(1250).div(1000));
      });

      it("emits the PriceUpdate event when requested", async function () {
        await expect(await priceFeed.emitPriceSignal())
          .to.emit(priceFeed, "PriceUpdate")
          .withArgs(wethVault.address, await priceFeed.price(), await priceFeed.price());
      });
    });
  });

  describe("with forked matic chain", function () {
    before(async function () {
      await network.provider.request({
        method: "hardhat_reset",
        params: [
          {
            forking: {
              jsonRpcUrl: polygonRPC,
              blockNumber: 37901501
            }
          }
        ]
      });
    });
    describe("with USDC price feed", function () {
      let priceFeed: ArrakisVaultPriceFeed;
      const usdcVaultAddress = "0x388E289A1705fa7b8808AB13f0e0f865E2Ff94eE";
      beforeEach(async function () {
        usdcPF = await ethers.getContractAt("ConvertedPriceFeed", "0x6813998Ac241d3FCAd1C079c2940859720e42CC6", wallets[0]);
        usdcVault = await ethers.getContractAt("IArrakisVault", usdcVaultAddress, wallets[0]);
        priceFeed = (await deployContract(wallets[0], "ArrakisVaultPriceFeed", [usdcVaultAddress, usdcPF.address])) as ArrakisVaultPriceFeed;
      });

      it("usdc is token0", async function () {
        expect(await priceFeed.isToken0()).to.be.true;
      });

      it("gets the latest price when calling price()", async function () {
        const price = await usdcPF.price();
        expect(price).to.equal("932382706150001864");
        const balances = await usdcVault.getUnderlyingBalances();
        const lpTokenSupply = await usdcVault.totalSupply();
        const usdcBalance = balances[0].mul(ONE).div(1e6);
        expect(balances[0]).to.equal(toBN("185876024468"));
        expect(balances[1]).to.equal("127762551123592396909016");
        expect(await priceFeed.price()).to.equal(usdcBalance.mul(price).div(lpTokenSupply));
      });

      it("emits the PriceUpdate event when requested", async function () {
        await expect(await priceFeed.emitPriceSignal())
          .to.emit(priceFeed, "PriceUpdate")
          .withArgs(usdcVaultAddress, await priceFeed.price(), await priceFeed.price());
      });
    });

    describe("with WETH price feed", function () {
      let priceFeed: ArrakisVaultPriceFeed;
      const wethVaultAddress = "0x8B8533471920231Acca16104a0c81fA50D8C9a53";
      beforeEach(async function () {
        wethPF = await ethers.getContractAt("ConvertedPriceFeed", "0x686599c91F29F5CaD303cb4DB354458B23ea4eb1", wallets[0]);
        wethVault = await ethers.getContractAt("IArrakisVault", wethVaultAddress, wallets[0]);
        priceFeed = (await deployContract(wallets[0], "ArrakisVaultPriceFeed", [wethVaultAddress, wethPF.address])) as ArrakisVaultPriceFeed;
      });

      it("weth is not token0", async function () {
        expect(await priceFeed.isToken0()).to.be.false;
      });

      it("gets the latest price when calling price()", async function () {
        const price = await wethPF.price();
        expect(price).to.equal("1237282288442173572520");
        const balances = await wethVault.getUnderlyingBalances();
        const lpTokenSupply = await wethVault.totalSupply();
        const wethBalance = balances[1];
        expect(balances[0]).to.equal(toBN("966801503405950084613"));
        expect(balances[1]).to.equal("789275517167493908");
        expect(await priceFeed.price()).to.equal(wethBalance.mul(price).div(lpTokenSupply));
      });

      it("emits the PriceUpdate event when requested", async function () {
        await expect(await priceFeed.emitPriceSignal())
          .to.emit(priceFeed, "PriceUpdate")
          .withArgs(wethVaultAddress, await priceFeed.price(), await priceFeed.price());
      });
    });
  });
});
