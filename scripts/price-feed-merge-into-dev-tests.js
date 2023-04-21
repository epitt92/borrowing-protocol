const { delay } = require("./helpers/utils");
const { ethers } = require("hardhat");

const gasSettings = { gasPrice: "1000000000" }; //{maxFeePerGas: "300", maxPriorityFeePerGas: "10"}

async function main() {
  const wallet = new ethers.Wallet(process.env.DEPLOY_KEY);
  const routerAddress = "0xee8a637344b4699a89fd25fdc4db07d3266fe572";
  const mintingAmount = "10000000000000000000000000000";

  const updatePriceFeed = async (savePrevious = true) => {
    const tx = await priceFeed.update(savePrevious, { gasLimit: 8000000, ...gasSettings });
    console.log("Price feed updated call");
    await tx.wait();
    console.log("Price feed updated");
  };

  console.log(wallet.address);
  const router = await ethers.getContractAt("contracts/interfaces/IRouter.sol:IRouter", routerAddress);
  const MintableTokenFactory = await ethers.getContractFactory("MintableToken");
  const PriceFeedFactory = await ethers.getContractFactory("contracts/price-feed.sol:PriceFeed");

  console.log("contracts received");
  const stableCoin = await MintableTokenFactory.deploy("StableCoin", "SC", gasSettings);
  await stableCoin.deployed();
  const collateralToken = await MintableTokenFactory.deploy("CollateralToken", "CT", gasSettings);
  await collateralToken.deployed();
  console.log("CT address: ", collateralToken.address);
  console.log("SC address: ", stableCoin.address);
  console.log("TOKENS DEPLOYED");
  let tx = await stableCoin.mint(wallet.address, mintingAmount, gasSettings);
  await tx.wait();
  tx = await collateralToken.mint(wallet.address, mintingAmount, gasSettings);
  await tx.wait();
  await (await stableCoin.approve(routerAddress, mintingAmount, gasSettings)).wait();
  await (await collateralToken.approve(routerAddress, mintingAmount, gasSettings)).wait();
  console.log("TOKENS MINTED");
  tx = await router.addLiquidity(
    collateralToken.address,
    stableCoin.address,
    "100000000000000000000000",
    "100000000000000000000000",
    "100000000000000000000000",
    "100000000000000000000000",
    wallet.address,
    Math.round((new Date().getTime() / 1000) * 2),
    { gasLimit: 8000000, ...gasSettings }
  );
  await tx.wait();

  console.log("POOL CREATED, LIQUIDITY ADDED");

  const priceFeed = await PriceFeedFactory.deploy(
    collateralToken.address,
    stableCoin.address,
    routerAddress,
    wallet.address,
    gasSettings
  );
  await priceFeed.deployed();
  console.log(priceFeed.address);
  console.log("Price feed deployed");

  await delay(); /// waiting 1 minute.

  await updatePriceFeed();

  let collateralTokenPrice = (await priceFeed.price()).toString();
  console.log("Price feed price() called");
  let expectedValue = "999686674843000000";
  if (collateralTokenPrice !== expectedValue)
    throw new Error(`Collateral token price is not equal to ${expectedValue}. Received value ${collateralTokenPrice}.`);
  console.log("Check 1 passed");

  tx = await router.swapExactTokensForTokens(
    "10000000000000000000000",
    "1000000000000000000000",
    [collateralToken.address, stableCoin.address],
    wallet.address,
    Math.round((new Date().getTime() / 1000) * 2),
    { gasLimit: 8000000, ...gasSettings }
  );
  await tx.wait();

  await delay(); /// waiting 1 minute.

  await updatePriceFeed(false);
  await delay();
  await updatePriceFeed();

  collateralTokenPrice = (await priceFeed.price()).toString();
  let bottomExpectedValue = "950000000000000000";
  let topExpectedValue = "99000000000000000";
  if (!(collateralTokenPrice > bottomExpectedValue && collateralTokenPrice < topExpectedValue))
    throw new Error(
      `Collateral token price is not equal to ${bottomExpectedValue} - ${topExpectedValue}. Received value ${collateralTokenPrice}.`
    );
  console.log("Check 2 passed");

  tx = await router.swapExactTokensForTokens(
    "10000000000000000000000",
    "1000000000000000000000",
    [collateralToken.address, stableCoin.address],
    wallet.address,
    Math.round((new Date().getTime() / 1000) * 2),
    { gasLimit: 8000000, ...gasSettings }
  );
  await tx.wait();

  await delay(60000); /// waiting 1 minute.

  await updatePriceFeed();

  collateralTokenPrice = (await priceFeed.price()).toString();
  bottomExpectedValue = "930000000000000000";
  topExpectedValue = "98000000000000000";
  if (!(collateralTokenPrice > bottomExpectedValue && collateralTokenPrice < topExpectedValue))
    throw new Error(
      `Collateral token price is not equal to ${bottomExpectedValue} - ${topExpectedValue}. Received value ${collateralTokenPrice}.`
    );
  console.log("Check 3 passed");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
