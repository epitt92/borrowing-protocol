/* eslint-disable @typescript-eslint/no-var-requires */
import { deployments, ethers, network } from "hardhat";
import { ArbitragePoolUniswap } from "../deployments_package";
import { getDeployFunction } from "./helpers/deployment";

/* eslint-disable no-undef */

async function deployContracts(skip: number = 0) {
  const {deploy, get} = deployments;
  const accounts = await ethers.provider.listAccounts()
  const deployer: string = accounts[0];
  const signer = await ethers.provider.getSigner(accounts[0])
  const deployAndGetContract = getDeployFunction(deploy, network.name);

  const newTroveFactoryImplementation = await deployAndGetContract("OriginalTroveFactory", deployer, [],
      "TroveFactoryImplementation.v1.01");

  const newBNQStakingImplementation = await deployAndGetContract("BONQStaking", deployer, [],
      "BONQStakingImplementation.v1.01");

  const factoryProxy = await get("OriginalTroveFactoryProxy")
  console.log(`factoryProxy.address ${factoryProxy.address}`)
  const newTroveImplementation = await deployAndGetContract("Trove", deployer, [factoryProxy.address],
      "TroveImplementation.v1.01");

}

deployContracts().then(console.log).catch(console.error);
