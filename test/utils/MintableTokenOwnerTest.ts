import { SystemUnderTest } from "./SystemUnderTest";
import { ethers } from "hardhat";
import { deployContract } from "./helpers";
import { TestMintableToken, MintableTokenOwner } from "../../src/types";

export class MintableTokenOwnerTest extends SystemUnderTest {
  // @ts-ignore
  public stableCoin: TestMintableToken;
  // @ts-ignore
  public mintableTokenOwner: MintableTokenOwner;

  constructor(public eth: typeof ethers) {
    super(eth);
  }

  public async setup(): Promise<boolean> {
    this.stableCoin = (await deployContract(this.wallets[0], "TestMintableToken", ["Mintable Stable Coin for Test", "MSC"])) as TestMintableToken;
    this.mintableTokenOwner = (await deployContract(this.wallets[0], "MintableTokenOwner", [this.stableCoin.address])) as MintableTokenOwner;
    await this.mintableTokenOwner.addMinter(await this.wallets[0].getAddress());
    await this.stableCoin.transferOwnership(this.mintableTokenOwner.address);

    return true;
  }
}
