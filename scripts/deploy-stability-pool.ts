/* eslint-disable @typescript-eslint/no-var-requires */
import { deployments, ethers, network } from "hardhat";
import { StabilityPoolUniswap } from "../src/types";
import { ERC20 } from "../deployments_package";
import { feeData, getDeployFunction } from "./helpers/deployment";

/* eslint-disable no-undef */
export async function deployBorrowingProtocol(skip: number = 0) {
  const {deploy, get} = deployments;
  const accounts = await ethers.provider.listAccounts()
  const deployer: string = accounts[0];
  const signer = await ethers.provider.getSigner(accounts[0])
  const deployAndGetContract = getDeployFunction(deploy, network.name);

  const bnq = await ethers.getContractAt("ERC20", "0x91efbe97e08d0ffc7d31381c032d05fad8e25aaa", signer) as ERC20
  const factoryDeployment = await get("OriginalTroveFactoryProxy")
  console.log(`factoryDeployment ${factoryDeployment.address}`)
  // const newStabilityPool = await deployAndGetContract("StabilityPoolUniswap", deployer,
  //     [factoryDeployment.address, bnq.address]) as StabilityPoolUniswap

  const newStabilityPool = await ethers.getContractAt(
      "StabilityPoolUniswap", "0xE1e46C14F9E400e928b0ead380B98a9309a2307B", signer) as StabilityPoolUniswap
  const existingStabilityPool = await ethers.getContractAt(
      "StabilityPoolUniswap", "0x661F9159334F2429010eC5972B668D1D084C2E6A", signer) as StabilityPoolUniswap
  console.log(`bnq balance existing ${(await bnq.balanceOf(existingStabilityPool.address)).toString()}`)
  console.log(`bnq balance new ${(await bnq.balanceOf(newStabilityPool.address)).toString()}`)
  await existingStabilityPool.upgradeTo(newStabilityPool.address, await feeData())
}

deployBorrowingProtocol().then(console.log).catch(console.error);
