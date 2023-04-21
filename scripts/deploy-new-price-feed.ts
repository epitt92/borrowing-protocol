/* eslint-disable @typescript-eslint/no-var-requires */
import { deployments, ethers, network } from "hardhat";
import { getDeployFunction } from "./helpers/deployment";

const arrakisVault = "0x388E289A1705fa7b8808AB13f0e0f865E2Ff94eE"

/* eslint-disable no-undef */
export async function deployPriceFeed() {
  const {deploy, get} = deployments;
  const accounts = await ethers.provider.listAccounts()
  const signer = await ethers.provider.getSigner(accounts[0])
  const deployAndGetContract = getDeployFunction(deploy, network.name);
  const tokenPriceFeed = "0xBF0e427fD849994EA8Ed6C607C73327A7ff10AE3"
  await deployAndGetContract("ArrakisVaultPriceFeed", accounts[0], [arrakisVault, tokenPriceFeed], "ArrakisLP-USDC-BEUR")
}

export async function deployCommunityLiquidationPool() {
  const {deploy, get} = deployments;
  const accounts = await ethers.provider.listAccounts()
  const signer = await ethers.provider.getSigner(accounts[0])
  const deployAndGetContract = getDeployFunction(deploy, network.name);
  const factory = await get("OriginalTroveFactoryProxy")
  await deployAndGetContract("CommunityLiquidationPool", accounts[0], [factory.address, arrakisVault], "ArrakisLP-USDC-BEUR-CommunityLiquidation")
}

// deployPriceFeed().then(console.log).catch(console.error);
deployCommunityLiquidationPool().then(console.log).catch(console.error);
