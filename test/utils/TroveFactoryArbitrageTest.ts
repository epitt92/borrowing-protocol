import { APToken, ArbitragePoolUniswap, IRouter, TestMintableToken, TestPriceFeed, Trove, IUniswapV3Router, WETH } from "../../src/types";
import { TroveFactoryTest } from "./TroveFactoryTest";
import { ethers } from "hardhat";
import { BigNumber, Signer } from "ethers";
import { deployUUPSContract } from "./helpers";

export class TroveFactoryArbitrageTest extends TroveFactoryTest {
  // @ts-ignore
  public arbitragePool: ArbitragePoolUniswap;
  // @ts-ignore
  public router: IUniswapV3Router;
  // @ts-ignore
  public apToken: APToken;
  // @ts-ignore
  public WETH: WETH;
  // @ts-ignore
  public WETHpriceFeed: TestPriceFeed;
  public tradeFee = this.DECIMAL_PRECISION.div("1000");

  constructor(public eth: typeof ethers) {
    super(eth);
  }

  public async setup(): Promise<boolean> {
    await super.setup();
    this.router = await ethers.getContractAt("IUniswapV3Router", "0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45", this.wallets[0]);
    this.arbitragePool = (await deployUUPSContract(this.wallets[0], "ArbitragePoolUniswap", [], [this.troveFactory.address, this.router.address])) as ArbitragePoolUniswap;

    this.WETH = (await this.deployContract(this.wallets[0], "WETH", [])) as WETH;
    const WETHliquidationPool = await this.deployContract(this.wallets[0], "CommunityLiquidationPool", [this.troveFactory.address, this.WETH.address]);

    this.WETHpriceFeed = (await this.deployContract(this.wallets[0], "TestPriceFeed", [this.WETH.address])) as TestPriceFeed;

    await this.troveFactory.setWETH(this.WETH.address, WETHliquidationPool.address);
    await this.tokenToPriceFeed.setTokenPriceFeed(this.WETH.address, this.WETHpriceFeed.address, 100, 250);
    await this.WETHpriceFeed.setPrice(this.DECIMAL_PRECISION.mul(1000));

    await this.troveFactory.setArbitragePool(this.arbitragePool.address);
    await this.arbitragePool.addToken(this.troveToken.address);
    await this.arbitragePool.addToken(this.WETH.address);
    this.apToken = (await this.getContractAt("APToken", await this.arbitragePool.collateralToAPToken(this.troveToken.address))) as APToken;

    return true;
  }

  public async createPool(token0: TestMintableToken, token1: TestMintableToken, t04t1: BigNumber) {
    const base = this.DECIMAL_PRECISION.mul("10000000"); // 10 Mio
    const amountA = base.mul(t04t1).div("1000000");
    const amountB = base;
    // const tx = await this.router.addLiquidity(token0.address, token1.address, amountA, amountB, amountA, amountB, this.accounts[0], Math.round((new Date().getTime() / 1000) * 2));
    // await tx.wait();
  }

  public async addTrove(signer: Signer = this.wallets[0], tokenAddress: string = this.troveToken.address, mint = true): Promise<Trove> {
    const trove = await super.addTrove(signer, tokenAddress, mint);
    await trove.connect(signer).setArbitrageParticipation(true);
    return trove;
  }
}
