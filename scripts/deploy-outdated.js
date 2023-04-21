/* eslint-disable @typescript-eslint/no-var-requires */
const { ethers } = require("hardhat");

/* eslint-disable no-undef */
async function main() {
  const routerAddress = "0xee8a637344b4699a89fd25fdc4db07d3266fe572";
  const walletAddress = await (await ethers.getSigners())[0].getAddress();

  const MintableToken = await ethers.getContractFactory("MintableToken");
  const stableCoin = await MintableToken.deploy("TroveStableCoin", "TSC1");
  await stableCoin.deployed();
  const troveToken = await MintableToken.deploy("TroveToken1", "TT1");
  await troveToken.deployed();
  const bonqToken = await MintableToken.deploy("BonqToken", "BONQ");
  await bonqToken.deployed();

  const PriceFeed = await ethers.getContractFactory("PriceFeed");
  const priceFeed = await PriceFeed.deploy(troveToken.address, stableCoin.address, routerAddress, walletAddress);
  await priceFeed.deployed();

  const TokenToPriceFeed = await ethers.getContractFactory("TokenToPriceFeed");
  const tokenToPriceFeed = await TokenToPriceFeed.deploy();
  await tokenToPriceFeed.deployed();

  let tx = await tokenToPriceFeed.setTokenPriceFeed(troveToken.address, priceFeed.address, 120);
  await tx.wait();

  const TroveCreator = await ethers.getContractFactory("TroveCreator");
  const troveCreator = await TroveCreator.deploy();
  await troveCreator.deployed();

  const BONQStaking = await ethers.getContractFactory("BONQStaking");
  const bonqStaking = await BONQStaking.deploy(bonqToken.address);
  await bonqStaking.deployed();

  const TroveFactory = await ethers.getContractFactory("TroveFactory");
  const troveFactory = await TroveFactory.deploy(troveCreator.address, stableCoin.address, bonqStaking.address);
  await troveFactory.deployed();

  tx = await bonqStaking.setFactory(troveFactory.address);
  await tx.wait();

  const CommunityLiquidationPool = await ethers.getContractFactory("CommunityLiquidationPool");
  const communityLiquidationPool = await CommunityLiquidationPool.deploy(troveFactory.address, troveToken.address);
  await communityLiquidationPool.deployed();

  tx = await troveFactory.setLiquidationPool(troveToken.address, communityLiquidationPool.address);
  await tx.wait();

  const StabilityPool = await ethers.getContractFactory("StabilityPool");
  const stabilityPool = await StabilityPool.deploy(troveFactory.address, bonqToken.address);
  await stabilityPool.deployed();
  tx = await troveFactory.setStabilityPool(stabilityPool.address);
  await tx.wait();

  tx = await troveFactory.setTokenPriceFeed(tokenToPriceFeed.address);
  await tx.wait();
  tx = await troveFactory.setLiquidationPool(troveToken.address, communityLiquidationPool.address);
  await tx.wait();
  tx = await troveFactory.setStabilityPool(stabilityPool.address);
  await tx.wait();

  const MintableTokenOwner = await ethers.getContractFactory("MintableTokenOwner");
  const mintableTokenOwner = await MintableTokenOwner.deploy(stableCoin.address);
  await mintableTokenOwner.deployed();
  tx = await mintableTokenOwner.addMinter(walletAddress);
  await tx.wait();

  tx = await stableCoin.transferOwnership(mintableTokenOwner.address);
  await tx.wait();

  tx = await mintableTokenOwner.transferOwnership(troveFactory.address);
  await tx.wait();

  tx = await troveFactory.setTokenOwner();
  await tx.wait();

  console.log("tokens", [troveToken.address]);
  console.log("StableCoin deployed to:", [stableCoin.address]);
  console.log("TroveFactory deployed to:", troveFactory.address);
  console.log("TokenToPriceFeed deployed to:", tokenToPriceFeed.address);
  console.log("StabilityPool deployed to:", stabilityPool.address);
  console.log("BONQ-staking deployed to:", bonqStaking.address);
  console.log("BONQ token deployed to:", bonqToken.address);
  console.log("Token owner deployed to:", mintableTokenOwner.address);
}
