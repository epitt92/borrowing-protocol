import { ethers } from "hardhat";
import { MintableTokenOwnerTest } from "./MintableTokenOwnerTest";
import {
  ILiquidationPool,
  MintableToken,
  OriginalTroveFactory,
  StabilityPoolUniswap,
  TestFeeRecipient,
  TestMintableToken,
  TestPriceFeed,
  TokenToPriceFeed,
  Trove
} from "../../src/types";
import { ContractReceipt, Signer } from "ethers";
import { addressZero, deployUUPSContract, toBN } from "./helpers";

export class TroveFactoryTest extends MintableTokenOwnerTest {
  // @ts-ignore
  public troveFactory: OriginalTroveFactory;
  // @ts-ignore
  public troveToken: TestMintableToken;
  // @ts-ignore
  public tokenToPriceFeed: TokenToPriceFeed;
  // @ts-ignore
  public priceFeed: TestPriceFeed;
  // @ts-ignore
  public bonqToken: MintableToken;
  // @ts-ignore
  public stabilityPool: StabilityPoolUniswap;
  // @ts-ignore
  public liquidationPool: ILiquidationPool;
  // @ts-ignore
  public testFeeRecipient: TestFeeRecipient;
  // @ts-ignore
  private troveFactoryImplementation: OriginalTroveFactory;
  public ONE = toBN("1000000000000000000");
  public defaultCollateral = this.ONE;
  public precision = this.ONE;
  public proxyOwner: Signer;

  constructor(public eth: typeof ethers, public decimals: number = 18) {
    super(eth);
    this.proxyOwner = this.eth.Wallet.createRandom().connect(this.eth.provider);
  }

  public async setup(): Promise<boolean> {
    await super.setup();

    this.precision = toBN(10).pow(this.decimals);
    this.defaultCollateral = toBN(10).pow(this.decimals);

    await this.wallets[9].sendTransaction({ to: await this.proxyOwner.getAddress(), value: this.ONE });

    this.tokenToPriceFeed = (await this.deployContract(this.wallets[0], "TokenToPriceFeed")) as TokenToPriceFeed;
    this.troveToken = (await this.deployContract(this.wallets[0], "TestMintableToken", ["Mintable Token for Test", "MTT"])) as TestMintableToken;
    this.troveToken.setDecimals(this.decimals);

    this.priceFeed = (await this.deployContract(this.wallets[0], "TestPriceFeed", [this.troveToken.address])) as TestPriceFeed;

    await this.tokenToPriceFeed.setTokenPriceFeed(this.troveToken.address, this.priceFeed.address, 120, 250);

    this.testFeeRecipient = (await this.deployContract(this.wallets[0], "TestFeeRecipient", [this.stableCoin?.address])) as TestFeeRecipient;

    this.troveFactory = (await deployUUPSContract(
      this.wallets[0],
      "OriginalTroveFactory",
      [this.stableCoin?.address, this.testFeeRecipient.address],
      [],
      this.proxyOwner
    )) as OriginalTroveFactory;

    const troveImplementation = (await this.deployContract(this.wallets[0], "Trove", [this.troveFactory.address])) as Trove;

    await (await this.troveFactory.setTroveImplementation(troveImplementation.address)).wait();
    await (await this.troveFactory.setTokenPriceFeed(this.tokenToPriceFeed.address)).wait();
    await (await this.mintableTokenOwner.transferOwnership(this.troveFactory.address)).wait();
    await (await this.troveFactory.setTokenOwner()).wait();

    this.bonqToken = (await this.deployContract(this.wallets[0], "MintableToken", ["BONQ Token for Test", "BONQ"])) as MintableToken;
    this.stabilityPool = (await deployUUPSContract(this.wallets[0], "StabilityPoolUniswap", [], [this.troveFactory.address, this.bonqToken.address])) as StabilityPoolUniswap;
    await (await this.troveFactory.setStabilityPool(this.stabilityPool.address)).wait();

    this.liquidationPool = (await this.deployContract(this.wallets[0], "CommunityLiquidationPool", [this.troveFactory.address, this.troveToken.address])) as ILiquidationPool;
    await (await this.troveFactory.setLiquidationPool(this.troveToken.address, this.liquidationPool.address)).wait();

    return true;
  }

  public async addTroveToken(): Promise<[TestMintableToken, TestPriceFeed]> {
    const troveToken = (await this.deployContract(this.wallets[0], "TestMintableToken", ["TroveToken1", "TT1"])) as TestMintableToken;
    await troveToken.setDecimals(this.decimals);
    const priceFeed = (await this.deployContract(this.wallets[0], "TestPriceFeed", [troveToken.address])) as TestPriceFeed;
    await this.tokenToPriceFeed.setTokenPriceFeed(troveToken.address, priceFeed.address, 120, 5000);
    const communityLiquidationPool = (await this.deployContract(this.wallets[0], "CommunityLiquidationPool", [this.troveFactory.address, troveToken.address])) as ILiquidationPool;
    await this.troveFactory.setLiquidationPool(troveToken.address, communityLiquidationPool.address);

    return [troveToken, priceFeed];
  }

  public async addTrove(signer: Signer = this.wallets[0], tokenAddress: string = this.troveToken.address, mint = true): Promise<Trove> {
    const tx: ContractReceipt = await (await this.troveFactory.connect(signer).createTrove(tokenAddress)).wait();
    const troveAddress = this.getEventsFromReceipt(this.troveFactory.interface, tx, "NewTrove")[0].args.trove;
    const trove = (await this.getContractAt("Trove", troveAddress, signer)) as Trove;
    if (mint) {
      const token = await ethers.getContractAt("MintableToken", tokenAddress);
      await token.mint(troveAddress, this.defaultCollateral);
      await trove.increaseCollateral("0", addressZero);
    }
    return trove;
  }
}
