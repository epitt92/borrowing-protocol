import { deployments } from "hardhat";
import { IERC20Metadata, StabilityPoolUniswap, TokenToPriceFeed, TroveFactory } from "../deployments_package";
import { getContractAt } from "../test/utils/helpers";

export async function checkDeployment() {

  const TGNI_URL = "https://gn-mumbai.bonqdao.com/oi2309lsd/subgraphs/name/borrowing-protocol"

  const tokens = {
    bnq: "0x91efbe97e08d0ffc7d31381c032d05fad8e25aaa",
    wmatic: "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270",
    usdc: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
    dai: "0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063",
    weth: "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619",
    albt: "0x35b2ECE5B1eD6a7a99b83508F8ceEAB8661E0632",
  }
  const {get} = deployments;

  const factory = await getContractAt("OriginalTroveFactory", (await get("OriginalTroveFactoryProxy")).address) as TroveFactory

  const bnq =  await getContractAt("ERC20", tokens.bnq) as IERC20Metadata
  const wmatic =  await getContractAt("ERC20", tokens.wmatic) as IERC20Metadata
  const usdc =  await getContractAt("ERC20", tokens.usdc) as IERC20Metadata
  const dai =  await getContractAt("ERC20", tokens.dai) as IERC20Metadata
  const weth =  await getContractAt("ERC20", tokens.weth) as IERC20Metadata
  const albt =  await getContractAt("ERC20", tokens.albt) as IERC20Metadata

  console.log(`factory at ${factory.address} has ${await factory.troveCount(tokens.bnq)} with ${await bnq.name()}`)
  console.log(`factory at ${factory.address} has ${await factory.troveCount(tokens.wmatic)} with ${await wmatic.name()}`)
  console.log(`factory at ${factory.address} has ${await factory.troveCount(tokens.usdc)} with ${await usdc.name()}`)
  console.log(`factory at ${factory.address} has ${await factory.troveCount(tokens.dai)} with ${await dai.name()}`)
  console.log(`factory at ${factory.address} has ${await factory.troveCount(tokens.weth)} with ${await weth.name()}`)
  console.log(`factory at ${factory.address} has ${await factory.troveCount(tokens.albt)} with ${await albt.name()}`)

  const ttpf = await getContractAt("TokenToPriceFeed", await factory.tokenToPriceFeed()) as TokenToPriceFeed

  console.log(`factory ${factory.address} token to pricefeed ${ttpf.address}`)

  console.log("***** token details")
  console.log(`${await bnq.name()} has pricefeed, mcr, mrf of ${await ttpf.tokens(tokens.bnq)}`)
  console.log(`${await wmatic.name()} has pricefeed, mcr, mrf of ${await ttpf.tokens(tokens.wmatic)}`)
  console.log(`${await usdc.name()} has pricefeed, mcr, mrf of ${await ttpf.tokens(tokens.usdc)}`)
  console.log(`${await dai.name()} has pricefeed, mcr, mrf of ${await ttpf.tokens(tokens.dai)}`)
  console.log(`${await weth.name()} has pricefeed, mcr, mrf of ${await ttpf.tokens(tokens.weth)}`)
  console.log(`${await albt.name()} has pricefeed, mcr, mrf of ${await ttpf.tokens(tokens.albt)}`)

  console.log("***** token community liquidation pools")
  console.log(`${await bnq.name()} has liquidation pool ${await factory.liquidationPool(tokens.bnq)}`)
  console.log(`${await wmatic.name()} has liquidation pool ${await factory.liquidationPool(tokens.wmatic)}`)
  console.log(`${await usdc.name()} has liquidation pool ${await factory.liquidationPool(tokens.usdc)}`)
  console.log(`${await dai.name()} has liquidation pool ${await factory.liquidationPool(tokens.dai)}`)
  console.log(`${await weth.name()} has liquidation pool ${await factory.liquidationPool(tokens.weth)}`)
  console.log(`${await albt.name()} has liquidation pool ${await factory.liquidationPool(tokens.albt)}`)

  console.log("***** token prices")
  console.log(`${await wmatic.name()} price is ${await ttpf.tokenPrice(tokens.wmatic)}`)
  console.log(`${await usdc.name()} price is ${await ttpf.tokenPrice(tokens.usdc)}`)
  console.log(`${await dai.name()} price is ${await ttpf.tokenPrice(tokens.dai)}`)
  console.log(`${await weth.name()} price is ${await ttpf.tokenPrice(tokens.weth)}`)
  console.log(`${await albt.name()} price is ${await ttpf.tokenPrice(tokens.albt)}`)

  const stabilityPool = await getContractAt("StabilityPoolUniswap", (await get("StabilityPoolUniswapProxy")).address) as StabilityPoolUniswap
  console.log(`stability pool total rewards ${await stabilityPool.totalBONQRewardsLeft()} distributing per minute ${await stabilityPool.bonqPerMinute()}`)
}

checkDeployment().then(console.log).catch(console.error)
