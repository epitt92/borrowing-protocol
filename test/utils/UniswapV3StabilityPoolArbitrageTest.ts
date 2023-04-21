import { APToken, ArbitragePoolUniswap, TestMintableToken, TestPriceFeed, WETH9 } from "../../src/types";
import { ethers, network } from "hardhat";
import { deployUUPSContract, toBN } from "./helpers";
import { StabilityPoolUniswap } from "../../src/types/StabilityPoolUniswap";
import { ILiquidationPool } from "../../src/types/ILiquidationPool";
import { OriginalTroveFactory } from "../../src/types/OriginalTroveFactory";
import { Trove } from "../../src/types/Trove";
import { TestFeeRecipient } from "../../src/types/TestFeeRecipient";
import { TokenToPriceFeed } from "../../src/types/TokenToPriceFeed";
import { Signer, ContractReceipt } from "ethers";
import { MintableTokenOwnerTest } from "./MintableTokenOwnerTest";
import { MintableTokenOwner } from "../../src/types/MintableTokenOwner";
import { goerliRPC } from "../../config";

export class UniswapV3StabilityPoolArbitrageTest extends MintableTokenOwnerTest {
  // @ts-ignore
  public troveFactory: OriginalTroveFactory;
  // @ts-ignore
  public troveToken: TestMintableToken;
  // @ts-ignore
  public tokenToPriceFeed: TokenToPriceFeed;
  // @ts-ignore
  public priceFeed: TestPriceFeed;
  // @ts-ignore
  public bonqToken: TestMintableToken;
  // @ts-ignore
  public stabilityPool: StabilityPoolUniswap;
  // @ts-ignore
  public liquidationPool: ILiquidationPool;
  // @ts-ignore
  public testFeeRecipient: TestFeeRecipient;
  // @ts-ignore
  private troveFactoryImplementation: OriginalTroveFactory;
  public defaultCollateral = toBN("1000000000000000000");
  public proxyOwner: Signer;

  // @ts-ignore
  public arbitragePool: ArbitragePoolUniswap;
  // @ts-ignore
  public WETH: WETH9;
  // @ts-ignore
  public WETHpriceFeed: TestPriceFeed;
  public tradeFee = this.DECIMAL_PRECISION.div("1000");
  public routerAddress = "0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45";
  public ethAddress = "0xeA2e6868186074a80b59F146e7B8630981372D7c";
  public btcAddress = "0xB114EAae4CA6834652a8292Cb617ad06e6967955";
  public beurAddress = "0x03CDca1753677155D99EE3750a020D304242CA1A";
  // @ts-ignore
  public beur: TestMintableToken;
  // @ts-ignore
  public feth: TestMintableToken;
  // @ts-ignore
  public fbtc: TestMintableToken;
  public setupSnapshot = "0x0";
  public isSetup = false;

  constructor(public eth: typeof ethers) {
    super(eth);
    this.proxyOwner = this.eth.Wallet.createRandom().connect(this.eth.provider);
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

      await this.wallets[9].sendTransaction({ to: await this.proxyOwner.getAddress(), value: this.ONE });

      this.feth = (await this.getContractAt("TestMintableToken", this.ethAddress)) as TestMintableToken;
      this.fbtc = (await this.getContractAt("TestMintableToken", this.btcAddress)) as TestMintableToken;
      this.beur = (await this.getContractAt("TestMintableToken", this.beurAddress)) as TestMintableToken;

      this.mintableTokenOwner = (await this.deployContract(this.wallets[0], "MintableTokenOwner", [this.beur.address])) as MintableTokenOwner;
      await this.mintableTokenOwner.addMinter(await this.wallets[0].getAddress());
      await this.beur.transferOwnership(this.mintableTokenOwner.address);

      this.tokenToPriceFeed = (await this.deployContract(this.wallets[0], "TokenToPriceFeed")) as TokenToPriceFeed;
      this.troveToken = (await this.deployContract(this.wallets[0], "TestMintableToken", ["Mintable Token for Test", "MTT"])) as TestMintableToken;

      this.priceFeed = (await this.deployContract(this.wallets[0], "TestPriceFeed", [this.troveToken.address])) as TestPriceFeed;

      await this.tokenToPriceFeed.setTokenPriceFeed(this.troveToken.address, this.priceFeed.address, 120, 250);

      this.testFeeRecipient = (await this.deployContract(this.wallets[0], "TestFeeRecipient", [this.beur.address])) as TestFeeRecipient;

      this.troveFactory = (await deployUUPSContract(
        this.wallets[0],
        "OriginalTroveFactory",
        [this.beur.address, this.testFeeRecipient.address],
        [],
        this.proxyOwner
      )) as OriginalTroveFactory;

      const troveImplementation = (await this.deployContract(this.wallets[0], "Trove", [this.troveFactory.address])) as Trove;

      await (await this.troveFactory.setTroveImplementation(troveImplementation.address)).wait();
      await (await this.troveFactory.setTokenPriceFeed(this.tokenToPriceFeed.address)).wait();
      await (await this.mintableTokenOwner.transferOwnership(this.troveFactory.address)).wait();
      await (await this.troveFactory.setTokenOwner()).wait();

      this.bonqToken = (await this.deployContract(this.wallets[0], "TestMintableToken", ["BONQ Token for Test", "BONQ"])) as TestMintableToken;

      this.stabilityPool = (await deployUUPSContract(this.wallets[0], "StabilityPoolUniswap", [], [this.troveFactory.address, this.bonqToken.address])) as StabilityPoolUniswap;
      await (await this.troveFactory.setStabilityPool(this.stabilityPool.address)).wait();
      await (await this.stabilityPool.setRouter(this.routerAddress)).wait();

      this.liquidationPool = (await this.deployContract(this.wallets[0], "CommunityLiquidationPool", [this.troveFactory.address, this.troveToken.address])) as ILiquidationPool;
      await (await this.troveFactory.setLiquidationPool(this.troveToken.address, this.liquidationPool.address)).wait();

      this.WETH = (await this.deployContract(this.wallets[0], "WETH", [])) as WETH9;
      const WETHliquidationPool = await this.deployContract(this.wallets[0], "CommunityLiquidationPool", [this.troveFactory.address, this.WETH.address]);
      this.WETHpriceFeed = (await this.deployContract(this.wallets[0], "TestPriceFeed", [this.WETH.address])) as TestPriceFeed;
      await this.troveFactory.setWETH(this.WETH.address, WETHliquidationPool.address);
      await this.tokenToPriceFeed.setTokenPriceFeed(this.WETH.address, this.WETHpriceFeed.address, 100, 250);
      await this.WETHpriceFeed.setPrice(this.DECIMAL_PRECISION.mul(1000));
      this.stableCoin = this.beur;

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

  public async addTrove(signer: Signer = this.wallets[0], tokenAddress: string = this.troveToken.address, mint = true): Promise<Trove> {
    const tx: ContractReceipt = await (await this.troveFactory.connect(signer).createTrove(tokenAddress)).wait();
    const troveAddress = this.getEventsFromReceipt(this.troveFactory.interface, tx, "NewTrove")[0].args.trove;
    const trove = (await this.getContractAt("Trove", troveAddress, signer)) as Trove;
    if (mint) {
      const token = await ethers.getContractAt("TestMintableToken", tokenAddress);
      await token.mint(troveAddress, this.defaultCollateral);
      await trove.increaseCollateral("0", ethers.constants.AddressZero);
    }
    return trove;
  }
}
