/* eslint-disable @typescript-eslint/no-var-requires */
import { deployments, ethers, network } from "hardhat";
import { ArbitragePoolUniswap } from "../deployments_package";
import { getDeployFunction } from "./helpers/deployment";

/* eslint-disable no-undef */

async function deployArbitragePool(skip: number = 0) {
  const {deploy, get} = deployments;
  const accounts = await ethers.provider.listAccounts()
  const deployer: string = accounts[0];
  const signer = await ethers.provider.getSigner(accounts[0])
  const deployAndGetContract = getDeployFunction(deploy, network.name);

  const router = "0xE592427A0AEce92De3Edee1F18E0157C05861564"
  const factoryDeployment = await get("OriginalTroveFactoryProxy")
  const newArbitragePool = await deployAndGetContract("ArbitragePoolUniswap", deployer,
      [factoryDeployment.address, router]) as ArbitragePoolUniswap

}

deployArbitragePool().then(console.log).catch(console.error);
