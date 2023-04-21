import { APToken, ArbitragePoolUniswap, MintableToken, TestPriceFeed, WETH9 } from "../../src/types";
import { TroveFactoryTest } from "./TroveFactoryTest";
import { ethers, network } from "hardhat";
import { DECIMAL_PRECISION, deployUUPSContract } from "./helpers";
import { goerliRPC } from "../../config";

export class UniswapV3ArbitragePoolTest extends TroveFactoryTest {
  // @ts-ignore
  public arbitragePool: ArbitragePoolUniswap;
  // @ts-ignore
  public WETH: WETH9;
  // @ts-ignore
  public WETHpriceFeed: TestPriceFeed;
  public tradeFee = this.DECIMAL_PRECISION.div("1000");
  public routerAddress = "0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45";
  public ethAddress = "0xCc00B97Fc7B390410b5a04Be0927e43a80a84361";
  public btcAddress = "0xcB2DcD7FBA7Aa0c1D1dF69E22fCc3176805e8863";
  public beurAddress = "0x532661338a66fAAd61Db5B628a47F72A90B1905c";
  // @ts-ignore
  public beur: MintableToken;
  // @ts-ignore
  public feth: MintableToken;
  // @ts-ignore
  public fbtc: MintableToken;
  public setupSnapshot = "0x0";
  public isSetup = false;

  constructor(public eth: typeof ethers) {
    super(eth);
  }

  public async setup(): Promise<boolean> {
    if (!this.isSetup) {
      console.log("starting setup");
      await network.provider.request({
        method: "hardhat_reset",
        params: [
          {
            forking: {
              jsonRpcUrl: goerliRPC,
              blockNumber: 7957220
            }
          }
        ]
      });
      await super.setup();

      this.feth = (await this.getContractAt("MintableToken", this.ethAddress)) as MintableToken;
      this.fbtc = (await this.getContractAt("MintableToken", this.btcAddress)) as MintableToken;
      this.beur = (await this.getContractAt("MintableToken", this.beurAddress)) as MintableToken;

      this.arbitragePool = (await deployUUPSContract(this.wallets[0], "ArbitragePoolUniswap", [], [this.troveFactory.address, this.routerAddress])) as ArbitragePoolUniswap;

      this.WETH = (await this.deployContract(this.wallets[0], "WETH", [])) as WETH9;
      const WETHliquidationPool = await this.deployContract(this.wallets[0], "CommunityLiquidationPool", [this.troveFactory.address, this.WETH.address]);
      this.WETHpriceFeed = (await this.deployContract(this.wallets[0], "TestPriceFeed", [this.WETH.address])) as TestPriceFeed;
      await this.troveFactory.setWETH(this.WETH.address, WETHliquidationPool.address);
      await this.tokenToPriceFeed.setTokenPriceFeed(this.WETH.address, this.WETHpriceFeed.address, 100, 500);
      await this.WETHpriceFeed.setPrice(this.DECIMAL_PRECISION.mul(1000));

      await this.troveFactory.setArbitragePool(this.arbitragePool.address);

      await this.arbitragePool.addToken(this.beurAddress);
      await this.arbitragePool.addToken(this.ethAddress);
      await this.arbitragePool.addToken(this.btcAddress);
      await this.arbitragePool.addToken(this.troveToken.address);

      await (await this.beur.mint(this.accounts[0], DECIMAL_PRECISION.mul(1e6))).wait();
      await (await this.fbtc.mint(this.accounts[0], DECIMAL_PRECISION.mul(1e6))).wait();
      await (await this.feth.mint(this.accounts[0], DECIMAL_PRECISION.mul(1e6))).wait();
      await (await this.beur.approve(this.arbitragePool.address, DECIMAL_PRECISION.mul(1e6))).wait();
      await (await this.fbtc.approve(this.arbitragePool.address, DECIMAL_PRECISION.mul(1e6))).wait();
      await (await this.feth.approve(this.arbitragePool.address, DECIMAL_PRECISION.mul(1e6))).wait();

      await (await this.arbitragePool.deposit(this.beurAddress, DECIMAL_PRECISION.mul(1e3))).wait();
      await (await this.arbitragePool.deposit(this.btcAddress, DECIMAL_PRECISION.mul(1e3))).wait();
      await (await this.arbitragePool.deposit(this.ethAddress, DECIMAL_PRECISION.mul(1e3))).wait();

      this.isSetup = true;
      this.setupSnapshot = await this.eth.provider.send("evm_snapshot", []);
    } else {
      // make sure we start in the same state with every test
      await this.revert();
    }
    return this.isSetup;
  }

  public async revert() {
    return new Promise((resolve, reject) => {
      this.eth.provider.send("evm_revert", [this.setupSnapshot]).then((result) => {
        if (result) {
          this.eth.provider.send("evm_snapshot", []).then((snapshot) => {
            this.setupSnapshot = snapshot;
            resolve(result);
          });
        } else {
          reject(`could not revert to ${this.setupSnapshot}`);
        }
      });
    });
  }

  public async teardown() {
    return network.provider.request({
      method: "hardhat_reset",
      params: []
    });
  }

  public async getAP(collateralAddress: string): Promise<APToken> {
    return this.getContractAt("APToken", await this.arbitragePool.collateralToAPToken(collateralAddress)) as Promise<APToken>;
  }
}
