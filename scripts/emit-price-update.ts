import { ethers } from "hardhat";
import { Signer } from "ethers";
import { ConvertedPriceFeed, IPriceFeed, TellorPriceFeed } from "../src/types";
import { PriceFeed, TokenToPriceFeed } from "../deployments_package";

const tokenAddresses = [
  "0x35b2ece5b1ed6a7a99b83508f8ceeab8661e0632",
  "0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270",
  "0x2791bca1f2de4661ed88a30c99a7a9449aa84174",
  "0x8f3cf7ad23cd3cadbd9735aff958023239c6a063",
  "0x7ceb23fd6bc0add59e62ac25578270cff1b9f619",
]

export async function emitPriceUpdate(tokens: string[], signer: Signer) {
  const txs = []
  const ttpf = await ethers.getContractAt("TokenToPriceFeed", "0x20D50159aff262f953C8913Ec859Cac13A010b8a", signer) as TokenToPriceFeed
  for(const ta of tokens) {
    console.log("get token price feed")
    const pf = await ethers.getContractAt("ConvertedPriceFeed", await ttpf.tokenPriceFeed(ta), signer) as PriceFeed
    txs.push((await pf.emitPriceSignal()).wait())
  }
  return txs
}

async function main() {
  const accounts = await ethers.provider.listAccounts();
  const signer = ethers.provider.getSigner(accounts[0])
  const txs = await emitPriceUpdate(tokenAddresses, signer)
  await Promise.all(txs)
}

main().then(console.log).catch(console.error)
