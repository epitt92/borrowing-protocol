/* eslint-disable no-console */
const { BigNumber } = require("ethers");
const { delay } = require("./helpers/utils");
const { ethers } = require("hardhat");

const gasSettings = { gasPrice: "1000000000" }; //{maxFeePerGas: "300", maxPriorityFeePerGas: "10"}
function toBN(num) {
  return BigNumber.from(num.toString());
}
const one = toBN("1000000000000000000");

async function main() {
  const wallet = new ethers.Wallet(process.env.DEPLOY_KEY);

  const updatePriceFeed = async (amount) => {
    const tx = await priceFeed.setPrice(amount, { gasLimit: 8000000, ...gasSettings });
    console.log("Price feed update call");
    await tx.wait();
    console.log("Price feed updated");
  };

  const TokenToPriceFeedFactory = await ethers.getContractFactory("TokenToPriceFeed");
  const MintableTokenFactory = await ethers.getContractFactory("MintableToken");
  const ExternalPriceFeedFactory = await ethers.getContractFactory("ExternalPriceFeed");

  console.log("contracts received");
  const tokenToPriceFeed = await TokenToPriceFeedFactory.deploy(gasSettings);
  await tokenToPriceFeed.deployed();
  const collateralToken = await MintableTokenFactory.deploy("CollateralToken", "CT", gasSettings);
  await collateralToken.deployed();
  console.log("CT address: ", collateralToken.address);
  console.log("TOKENS DEPLOYED");

  const priceFeed = await ExternalPriceFeedFactory.deploy(
    collateralToken.address,
    wallet.address,
    tokenToPriceFeed.address,
    gasSettings
  );
  await priceFeed.deployed();
  console.log(priceFeed.address);
  console.log("Price feed deployed");

  await tokenToPriceFeed.setTokenPriceFeed(collateralToken.address, priceFeed.address, 120, gasSettings);

  await delay(); /// waiting 1 minute.

  await updatePriceFeed(one);

  let collateralTokenPrice = (await priceFeed.price()).toString();
  console.log("Price feed price() called");
  let expectedValue = "1000000000000000000";
  if (collateralTokenPrice !== expectedValue)
    throw new Error(`Collateral token price is not equal to ${expectedValue}. Received value ${collateralTokenPrice}.`);
  console.log("Check 1 passed");

  await delay(); /// waiting 1 minute.

  await updatePriceFeed(one.sub(one.div(4)));
  await delay();
  await updatePriceFeed(one.sub(one.div(3)));

  collateralTokenPrice = (await priceFeed.price()).toString();
  let bottomExpectedValue = "950000000000000000";
  let topExpectedValue = "99000000000000000";
  if (!(collateralTokenPrice > bottomExpectedValue && collateralTokenPrice < topExpectedValue))
    throw new Error(
      `Collateral token price is not equal to ${bottomExpectedValue} - ${topExpectedValue}. Received value ${collateralTokenPrice}.`
    );
  console.log("Check 2 passed");

  await delay(60000); /// waiting 1 minute.

  await updatePriceFeed(one.sub(one.div(2)));

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
