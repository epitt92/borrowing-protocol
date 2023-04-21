import { ethers, network } from "hardhat";
import { deployContract } from "../test/utils/helpers";
import { BigNumber, Contract, Signer } from "ethers";
import {
  ArbitragePoolUniswap,
  ChainlinkPriceFeed,
  ConvertedPriceFeed,
  ERC20,
  IERC20Metadata,
  IPriceFeed,
  PriceAggregator,
  TokenToPriceFeed,
  TroveFactory
} from "../src/types";
import path from "path";
import { readFileSync } from "fs";

const ONE = BigNumber.from(1e9).mul(1e9)

export enum OracleType {LINK, TLR}

export async function addCollateralToken(tokenAddress: string,
                                  usdOracleAddress: string,
                                  oracleType: OracleType,
                                  queryId: string,
                                  eurusdPriceFeed: string,
                                  tokenName: string,
                                  mcr: number,
                                  mrf: number,
                                  tokenToPriceFeed: TokenToPriceFeed,
                                  troveFactory: TroveFactory,
                                  arbitragePool: ArbitragePoolUniswap,
                                  deployer: string,
                                  deploymentFunction: Function) {
  let token: ERC20;
  if (tokenAddress) {
    console.log('********** token provided **********')
    if(!usdOracleAddress) throw new Error(`token address provided but no oracle for ${tokenName}`)
    const oracle = await ethers.getContractAt("PriceAggregator", usdOracleAddress, deployer);
    usdOracleAddress = oracle.address
    token = await ethers.getContractAt("ERC20", tokenAddress, deployer);
  } else {
    tokenName = tokenName.toUpperCase();
    token = await deploymentFunction(
        "TestMintableToken",
        deployer,
        [`testnet ${tokenName}`, tokenName],
        tokenName
    )
    const oracleContract = await deploymentFunction(
        "PriceAggregator",
        deployer,
        [],
        `${tokenName}_PriceAggregator`
    ) as PriceAggregator
    await (await oracleContract.setDecimals(8)).wait()
    await (await oracleContract.setLatestAnswer("125000000")).wait()
    usdOracleAddress = oracleContract.address
  }
  console.log(tokenName, token.address);
  if(mcr > -1) {
    let usdPricefeed: IPriceFeed;
    if(oracleType == OracleType.LINK) {
      usdPricefeed = await deploymentFunction(
          "ChainlinkPriceFeed",
          deployer,
          [usdOracleAddress, token.address],
          `${tokenName}_ChainlinkPriceFeed`
      );
    } else {
      usdPricefeed = await deploymentFunction(
          "TellorPriceFeed",
          deployer,
          [
            usdOracleAddress,
            token.address,
            queryId],
          `${tokenName}_TellorPriceFeed`
      ) as IPriceFeed;
      console.log(`the USD price for ${tokenName} is ${await usdPricefeed.price()}`)
    }
    const eurPricefeed = await deploymentFunction(
        "ConvertedPriceFeed",
        deployer,
        [
          usdPricefeed.address,
          eurusdPriceFeed,
          token.address
        ],
        `${tokenName}_EURPriceFeed`
    ) as ConvertedPriceFeed
    let tx = await ( await tokenToPriceFeed.setTokenPriceFeed(token.address, eurPricefeed.address, mcr, mrf) ).wait();
    console.log(`the price in pricefeed for ${tokenName} with address ${token.address} is ${await eurPricefeed.price()}`)
    console.log(`********** the price feed in token to pricefeed for ${tokenName} is ${(await tokenToPriceFeed.tokens(token.address)).priceFeed}`,
        `it should be ${eurPricefeed.address}`)
    console.log(`********** the price in token to pricefeed for ${tokenName} is ${await tokenToPriceFeed.tokenPrice(token.address)}`)
    await ( await arbitragePool.addToken(token.address) ).wait();
    const pool = await deploymentFunction( "CommunityLiquidationPool", deployer, [
      troveFactory.address,
      token.address
    ],
        `${tokenName}_LiquidationPool`
        );
    await ( await troveFactory.setLiquidationPool(token.address, pool.address) ).wait();
  }

}

async function peristedDeployer(name: string,
    deployer: string,
    args: any[],
    deploymentName: string
): Promise<Contract> {
  return deployContract(
      ethers.provider.getSigner(deployer),
      name,
      args
  )
}

const createPriceFeed = async function (token: string,
                                        price: number,
                                        mcr: number,
                                        mrf: number,
                                        tokenToPriceFeed: TokenToPriceFeed,
                                        eurusdPriceFeedAddress: string,
                                        deployer: Signer,
                                        priceOracle: string,
                                        queryId?: string,
                                        contractDeployer: Function = peristedDeployer
): Promise<{ priceFeed: string, eurusdPriceFeedAddress: string }> {
  const ONE8 = ethers.BigNumber.from(1e8)
  let usdPricefeed: IPriceFeed;
  if(!priceOracle) {
    console.log("creating oracle for", token)
    queryId = undefined //remove queryID to avoid problems later on
    const oracle = await contractDeployer(
        "PriceAggregator",
        await deployer.getAddress(),
        []
    ) as PriceAggregator;
    await ( await oracle.setLatestAnswer(ONE8.mul(price * 10000).div(10000)) ).wait();
    priceOracle = oracle.address;
  }

  if(queryId) {
    usdPricefeed = await contractDeployer(
        "TellorPriceFeed",
        await deployer.getAddress(),
        [priceOracle, token, queryId]
    ) as IPriceFeed;
  } else {
    usdPricefeed = await contractDeployer(
        "ChainlinkPriceFeed",
        await deployer.getAddress(),
        [priceOracle, token]
    ) as IPriceFeed;
  }

  if(!eurusdPriceFeedAddress) {
    console.log("deploying EUR oracle")
    const oracle = await contractDeployer(
        "PriceAggregator",
        await deployer.getAddress(),
        []
    ) as PriceAggregator;

    await (await oracle.setLatestAnswer(ONE8.mul(105).div(100))).wait();

    const eurusdPriceFeed = await contractDeployer(
        "ChainlinkPriceFeed",
        await deployer.getAddress(),
        [oracle.address, token]
    ) as ChainlinkPriceFeed;

    eurusdPriceFeedAddress = eurusdPriceFeed.address
  }

  const eurPriceFeed = await contractDeployer(
      "ConvertedPriceFeed",
      await deployer.getAddress(),
      [
        usdPricefeed.address,
        eurusdPriceFeedAddress,
        8,
        token
      ]
  ) as ConvertedPriceFeed;
  const tc = await ethers.getContractAt("IERC20Metadata", token, deployer) as IERC20Metadata
  await (await tokenToPriceFeed.setTokenPriceFeed(
      token,
      eurPriceFeed.address,
      mcr,
      mrf
  )).wait();

  await (await eurPriceFeed.emitPriceSignal()).wait()

  return {priceFeed: eurPriceFeed.address, eurusdPriceFeedAddress: eurusdPriceFeedAddress}
}

export async function createPriceFeeds(ttpf?: TokenToPriceFeed) {
  const tokenList = [
    {symbol: 'ALBT', price: 0.05, mcr: 400, mrf: 250, oracle: "0x35b2ECE5B1eD6a7a99b83508F8ceEAB8661E0632", queryId: "0x12906c5e9178631dba86f1f750f7ab7451c61e6357160eb890029b9eac1fb235"},
    {symbol: 'DAI', price: 1, mcr: 110, mrf: 500},
    {symbol: 'USDC', price: 1, mcr: 110, mrf: 500},
    {symbol: 'WETH', price: 1200, mcr: 120, mrf: 250},
    {symbol: 'WMATIC', price: 0.9226, mcr: 120, mrf: 250},
  ]
  const accounts = await ethers.provider.listAccounts();
  const deployer = ethers.provider.getSigner(accounts[0])
  const deploymentsPath = path.resolve(process.cwd(), "deployments_package/deployments");

  if(!ttpf) {
    let deployment = JSON.parse(readFileSync(path.resolve(deploymentsPath, network.name, `TokenToPriceFeed.json`)).toString());
    ttpf = await ethers.getContractAt("TokenToPriceFeed", deployment.address, deployer) as TokenToPriceFeed
  }

  let eurusdPriceFeed
  for(const item of tokenList) {
    let token = JSON.parse(readFileSync(path.resolve(deploymentsPath, network.name, `${item.symbol}.json`)).toString());
    console.log("calling with eurusdPriceFeedAddress of ", eurusdPriceFeed)
    // @ts-ignore
    const {priceFeed, eurusdPriceFeedAddress} = await createPriceFeed(
        token.address,
        item.price,
        120,
        250,
        ttpf,
        eurusdPriceFeed ,
        deployer)
    eurusdPriceFeed = eurusdPriceFeedAddress
    const pf = await ethers.getContractAt("IPriceFeed", priceFeed, deployer)
    console.log(`${item.symbol} price is ${await pf.price()}`)
  }
}
