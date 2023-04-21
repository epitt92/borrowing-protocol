import { ethers } from "hardhat";
import { ERC20, Trove, TroveFactory } from "../deployments_package/types";
import { addressZero, DECIMAL_PRECISION, getEventsFromReceipt } from "../test/utils/helpers";
import { expect, use } from "chai";
import { solidity } from "ethereum-waffle";

use(solidity);

const tokenAddresses = [
  "0x35b2ece5b1ed6a7a99b83508f8ceeab8661e0632", //WALBT
  "0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270", //WMATIC
  "0x2791bca1f2de4661ed88a30c99a7a9449aa84174", //USDC
  "0x8f3cf7ad23cd3cadbd9735aff958023239c6a063", //DAI
  "0x7ceb23fd6bc0add59e62ac25578270cff1b9f619", //WETH
]

async function main() {
  const accounts = await ethers.provider.listAccounts();
  const signer = ethers.provider.getSigner(accounts[0])

  const tcf = await ethers.getContractFactory("Trove")
  const tf = await ethers.getContractAt("TroveFactory", "0x3bB7fFD08f46620beA3a9Ae7F096cF2b213768B3", signer) as TroveFactory

  const ti = await tcf.deploy(tf.address)
  await ti.initialize("0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174", ti.address)

  console.log("set new trove impl")
  await (await tf.setTroveImplementation(ti.address)).wait()

}

async function test() {
  const accounts = await ethers.provider.listAccounts();
  const signer = ethers.provider.getSigner(accounts[0])
  const USDC = await ethers.getContractAt("ERC20", "0x2791bca1f2de4661ed88a30c99a7a9449aa84174", signer) as ERC20
  const DAI = await ethers.getContractAt("ERC20", "0x8f3cf7ad23cd3cadbd9735aff958023239c6a063", signer) as ERC20
  const BEUR = await ethers.getContractAt("ERC20", "0x338Eb4d394a4327E5dB80d08628fa56EA2FD4B81", signer) as ERC20

  const tcf = await ethers.getContractFactory("Trove")
  const tf = await ethers.getContractAt("TroveFactory", "0x3bB7fFD08f46620beA3a9Ae7F096cF2b213768B3", signer) as TroveFactory
  await (await DAI.approve(tf.address, DECIMAL_PRECISION.mul(1000)))
  console.log("ctab")
  let tx = await (await tf.createTroveAndBorrow(DAI.address, DECIMAL_PRECISION.mul(4), accounts[0], DECIMAL_PRECISION.mul(2), addressZero)).wait()
  let newTroveAddress = getEventsFromReceipt(tf.interface, tx, "NewTrove")[0].args.trove;
  const t1 = await ethers.getContractAt("Trove", newTroveAddress, signer) as Trove
  expect(await t1.debt()).to.equal(DECIMAL_PRECISION.mul(2).mul(1005).div(1000).add(DECIMAL_PRECISION))
  console.log("deploy")
  const ti = await tcf.deploy(tf.address)
  await ti.initialize("0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174", ti.address)
  console.log("set new trove impl")
  await (await tf.setTroveImplementation(ti.address)).wait()
  console.log("approve USDC")
  await (await USDC.approve(tf.address, DECIMAL_PRECISION.mul(1000)))
  console.log("ctab2")
  tx = await (await tf.createTroveAndBorrow(USDC.address, "4000000", accounts[0], DECIMAL_PRECISION.mul(2), addressZero)).wait()
  newTroveAddress = getEventsFromReceipt(tf.interface, tx, "NewTrove")[0].args.trove;
  const t2 = await ethers.getContractAt("Trove", newTroveAddress, signer)
  expect(await t2.debt()).to.equal(DECIMAL_PRECISION.mul(2).mul(1005).div(1000).add(DECIMAL_PRECISION))
  expect(await t1.debt()).to.equal(DECIMAL_PRECISION.mul(2).mul(1005).div(1000).add(DECIMAL_PRECISION))

  console.log("ap1")
  await (await t1.setArbitrageParticipation(true)).wait()
  expect(await t1.arbitrageParticipation()).to.be.true

  console.log("ap2")
  await (await t2.setArbitrageParticipation(true)).wait()
  expect(await t2.arbitrageParticipation()).to.be.true

  console.log("approve")
  await (await BEUR.approve(t1.address, DECIMAL_PRECISION.mul(1000)))
  await (await BEUR.approve(t2.address, DECIMAL_PRECISION.mul(1000)))

  console.log("repay1")
  await (await t1.repay(DECIMAL_PRECISION.mul(3), addressZero)).wait()
  console.log("repay2")
  await (await t2.repay(DECIMAL_PRECISION.mul(3), addressZero)).wait()

  expect(await t1.debt()).to.equal("0")
  expect(await t2.debt()).to.equal("0")
}

main().then(console.log).catch(console.error)
