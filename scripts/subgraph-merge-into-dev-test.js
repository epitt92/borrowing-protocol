/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-var-requires */
const { BigNumber } = require("ethers");
const { exec } = require("child_process");
const { ethers } = require("hardhat");
const { promisify } = require("util");
const {
  queryTokenById,
  queryTroveById,
  queryWalletById,
  querySPGlobalsById,
  queryTroveRedemption,
  queryTroveDebtHistory
} = require("./helpers/queries");
const { request } = require("graphql-request");
const { getSubgraphsSyncWaiter } = require("./helpers/subgraph-graphql-setup");
const hre = require("hardhat");

const execPromisified = async (command) => {
  console.log(`Running ${command} command...`);
  return promisify(exec)(command);
};

const { GRAPH_MERGE_TEST_GRAPH_NODE_GRAPHQL_URL, GRAPH_MERGE_TEST_GRAPH_NODE_INDEXER_GRAPHQL_URL } = process.env;
let graphCreateCommand = "npm run graph:create:dev:test-temp";
let graphDeployCommand = "npm run graph:deploy:dev:test-temp";
let graphDeleteCommand = "npm run graph:remove:dev:test-temp";
if (hre.network.name === "localhost") {
  graphCreateCommand = "npm run graph:create:local";
  graphDeployCommand = "npm run graph:deploy:local";
  graphDeleteCommand = "npm run graph:remove:local";
}

const TROVE_FACTORY = require(`../deployments_package/deployments/${hre.network.name}/TroveFactory.json`);
const TOKEN_TO_PRICE_FEED = require(`../deployments_package/deployments/${hre.network.name}/TokenToPriceFeed.json`);
const STABILITY_POOL = require(`../deployments_package/deployments/${hre.network.name}/StabilityPoolProxy.json`);
const BONQ_STAKING = require(`../deployments_package/deployments/${hre.network.name}/BONQStakingProxy.json`);
const BONQ_TOKEN = require(`../deployments_package/deployments/${hre.network.name}/BonqToken.json`);

const gasSettings = { gasPrice: "1000000000" };
const DECIMAL_PRECISION = BigNumber.from("1000000000000000000");

/* eslint-disable no-undef */
async function main() {
  const walletAddress = await (await ethers.getSigners())[0].getAddress();
  const subgraph = (query) => request(GRAPH_MERGE_TEST_GRAPH_NODE_GRAPHQL_URL, query);
  const waitForSync = getSubgraphsSyncWaiter(GRAPH_MERGE_TEST_GRAPH_NODE_INDEXER_GRAPHQL_URL, 60);

  const troveFactory = await ethers.getContractAt("OriginalTroveFactory", TROVE_FACTORY.address);
  const tokenToPriceFeed = await ethers.getContractAt("TokenToPriceFeed", TOKEN_TO_PRICE_FEED.address);
  const stabilityPool = await ethers.getContractAt("StabilityPool", STABILITY_POOL.address);
  const bonqStaking = await ethers.getContractAt("BONQStaking", BONQ_STAKING.address);
  const bonqToken = await ethers.getContractAt("MintableToken", BONQ_TOKEN.address);
  const stableCoin = await ethers.getContractAt("MintableToken", await troveFactory.stableCoin());
  const stableCoinOwner = await ethers.getContractAt("MintableTokenOwner", await troveFactory.tokenOwner());

  const Trove = await ethers.getContractFactory("Trove");

  const latestBlockNumber = await ethers.provider.getBlockNumber();

  let startBlockOption = `--start-block ${latestBlockNumber}`;

  if (hre.network.name === "localhost") {
    startBlockOption = "";
  }

  await execPromisified("cp subgraph.yaml subgraph-backup.yaml");
  await execPromisified(`npm run prepare:manifest -- --network ${hre.network.name} ${startBlockOption}`);
  await execPromisified("npm run graph:codegen");
  await execPromisified(graphCreateCommand);
  await execPromisified(graphDeployCommand);

  // new token test
  console.log("New token test");
  const MintableToken = await ethers.getContractFactory("MintableToken");
  const newTroveToken = await MintableToken.deploy("NewToken", "NT", gasSettings);
  await newTroveToken.deployed();

  let tx = await newTroveToken.mint(walletAddress, "1000000000000000000000000", gasSettings);
  await tx.wait();

  tx = await stableCoinOwner.mint(walletAddress, "1000000000000000000000000", gasSettings);
  await tx.wait();

  const PriceFeed = await ethers.getContractFactory("TestPriceFeed");
  const priceFeed = await PriceFeed.deploy(newTroveToken.address, tokenToPriceFeed.address, gasSettings);
  await priceFeed.deployed();

  tx = await tokenToPriceFeed.setTokenPriceFeed(newTroveToken.address, priceFeed.address, 120, gasSettings);
  await tx.wait();

  const CommunityLiquidationPool = await ethers.getContractFactory("CommunityLiquidationPool");
  const communityLiquidationPool = await CommunityLiquidationPool.deploy(
    troveFactory.address,
    newTroveToken.address,
    gasSettings
  );
  await communityLiquidationPool.deployed();

  tx = await troveFactory.setLiquidationPool(newTroveToken.address, communityLiquidationPool.address, gasSettings);
  await tx.wait();

  await waitForSync(2000);
  console.log(newTroveToken.address);
  let query = queryTokenById(newTroveToken.address.toLowerCase());
  let responseData = await subgraph(query);
  if (!responseData || responseData.token.id !== newTroveToken.address.toLowerCase())
    throw new Error("Subgraph test failure. Tokens entity isn't synced right.");
  console.log("New token test passed.✅\n");

  // new trove test
  console.log("New trove test");

  tx = await troveFactory.createTrove(newTroveToken.address, gasSettings);
  await tx.wait();
  let troveAddress = await troveFactory.firstTrove(newTroveToken.address, gasSettings);
  let trove = Trove.attach(troveAddress);

  await waitForSync(2000);

  query = queryTroveById(troveAddress.toLowerCase());
  responseData = await subgraph(query);

  if (!responseData || responseData.trove.id !== troveAddress.toLowerCase())
    throw new Error("Subgraph test failure. Troves entity isn't synced right.");
  console.log("New trove test passed.✅\n");

  // token update price test
  console.log("Token update price test");

  tx = await priceFeed.setPrice("1000000000000000000", {
    gasLimit: 8000000,
    ...gasSettings
  });
  await tx.wait();

  await waitForSync(2000);

  query = queryTokenById(newTroveToken.address.toLowerCase());

  responseData = await subgraph(query);

  if (
    !responseData ||
    responseData.token.priceAverage !== (await priceFeed.price()).toString() ||
    responseData.token.pricePoint !== (await priceFeed.pricePoint()).toString()
  )
    throw new Error("Subgraph test failure. Token prices isn't synced right.");
  console.log("Token update price test passed.✅\n");

  // trove collateral update test
  console.log("Trove collateral update test");

  tx = await newTroveToken.mint(troveAddress, "1000000000000000000000", gasSettings);
  await tx.wait();
  tx = await trove.increaseCollateral(0, troveAddress, gasSettings);
  await tx.wait();

  await waitForSync(2000);

  query = queryTroveById(troveAddress.toLowerCase());

  responseData = await subgraph(query);
  if (
    !responseData ||
    responseData.trove.collateral !== (await trove.collateral()).toString() ||
    responseData.trove.collateralization !== (await trove.collateralization()).toString()
  ) {
    console.log("actual collateral", (await trove.collateral()).toString());
    console.log("received collateral", responseData.trove.collateral);
    console.log("actual collateralization", (await trove.collateralization()).toString());
    console.log("received collateralization", responseData.trove.collateralization);
    throw new Error("Subgraph test failure. Trove collateral isn't synced right.");
  }
  console.log("Trove collateral update test passed.✅\n");

  // trove debt update test
  console.log("Trove debt update test");

  const debtBeforeBorrowBN = await trove.debt();

  tx = await trove.borrow(walletAddress, "1000000000000000000", troveAddress, { gasLimit: "8000000", ...gasSettings });
  const debtUpdateTxReceipt = await tx.wait();

  const debtAfterBorrowBN = await trove.debt();

  await waitForSync(2000);

  query = queryTroveById(troveAddress.toLowerCase());

  responseData = await subgraph(query);

  if (!responseData || responseData.trove.debt !== (await trove.debt()).toString()) {
    console.log("actual debt", (await trove.debt()).toString());
    console.log("received debt", responseData.trove.debt);
    throw new Error("Subgraph test failure. Trove debt isn't synced right.");
  }
  console.log("Trove debt update test passed.✅\n");

  // trove debt update test
  console.log("Trove debt update history test");

  query = queryTroveDebtHistory();

  responseData = await subgraph(query);

  const debtHistory = responseData.troveDebtHistories.find((history) => {
    return history.id.includes(debtUpdateTxReceipt.transactionHash);
  });
  const expectedDebtChange = debtAfterBorrowBN.sub(debtBeforeBorrowBN).toString();
  if (!responseData || debtHistory.amount !== expectedDebtChange || debtHistory.action !== "borrow") {
    console.log("actual amount", expectedDebtChange);
    console.log("received amount", debtHistory.amount);
    throw new Error("Subgraph test failure. Trove debt history isn't synced right.");
  }
  console.log("Trove debt update history test passed.✅\n");

  // trove liquidation and removal test
  console.log("Trove liquidation and removal test");

  tx = await troveFactory.createTrove(newTroveToken.address, gasSettings);
  await tx.wait();

  const lastTroveAddress = await troveFactory.nextTrove(newTroveToken.address, trove.address);
  tx = await newTroveToken.mint(lastTroveAddress, "1000000000000000000000", gasSettings);

  const lastTrove = Trove.attach(lastTroveAddress);
  await tx.wait();
  tx = await lastTrove.increaseCollateral(0, lastTroveAddress, gasSettings);
  await tx.wait();
  tx = await priceFeed.setPrice("100000", gasSettings);
  await tx.wait();
  tx = await trove.liquidate(gasSettings);
  await tx.wait();

  await waitForSync(2000);

  query = queryTroveById(troveAddress.toLowerCase());

  responseData = await subgraph(query);

  if (!responseData || !responseData.trove.isLiquidated || !responseData.trove.isRemoved) {
    console.log("received isLiquidated", responseData.trove.isLiquidated);
    console.log("received isRemoved", responseData.trove.isRemoved);
    throw new Error("Subgraph test failure. Trove liquidation isn't synced right.");
  }

  tx = await priceFeed.setPrice("10000000000000000000", gasSettings);
  await tx.wait();
  console.log("Trove liquidation and removal test passed.✅\n");

  // stability pool deposit update test

  console.log("Stability Pool deposit update test");

  const deposit = "1000000000000000000";
  tx = await stableCoin.approve(stabilityPool.address, deposit, gasSettings);
  await tx.wait();
  console.log("deposit approved. balance is", (await stableCoin.balanceOf(walletAddress)).toString());
  tx = await stabilityPool.deposit(deposit, gasSettings);
  await tx.wait();
  console.log("deposit done. balance is", (await stableCoin.balanceOf(walletAddress)).toString());

  await waitForSync(2000);

  query = queryWalletById(walletAddress.toLowerCase());
  responseData = await subgraph(query);

  const startDepositBN = responseData.wallet.stabilityPoolDeposit
    ? BigNumber.from(responseData.wallet.stabilityPoolDeposit)
    : BigNumber.from("0");

  console.log("deposit approved. balance is", (await stableCoin.balanceOf(walletAddress)).toString());
  tx = await stableCoin.approve(stabilityPool.address, deposit, gasSettings);
  await tx.wait();
  tx = await stabilityPool.deposit(deposit, gasSettings);
  await tx.wait();
  console.log("deposit done. balance is", (await stableCoin.balanceOf(walletAddress)).toString());

  await waitForSync(2000);

  responseData = await subgraph(query);
  const finalDepositBN = BigNumber.from(responseData?.wallet?.stabilityPoolDeposit);
  const depositDifference = finalDepositBN.sub(startDepositBN).toString();

  if (!responseData || depositDifference !== deposit)
    throw new Error("Subgraph test failure. Stability pool deposit isn't synced right.");
  console.log("Stability Pool deposit update test passed.✅\n");

  // stability pool bonq reward per minute and total bonq rewards update test
  console.log("Stability Pool bonq reward per minute and total bonq rewards update test");
  const bonqPerMinute = "1000000000000000000";
  const totalBonqRewards = "1000000000000000000000000000000";
  tx = await stabilityPool.setBONQPerMinute(bonqPerMinute, gasSettings);
  await tx.wait();
  tx = await bonqToken.mint(stabilityPool.address, totalBonqRewards, gasSettings);
  await tx.wait();
  tx = await stabilityPool.setBONQAmountForRewards(totalBonqRewards, gasSettings);
  await tx.wait();

  await waitForSync(2000);

  query = querySPGlobalsById(stabilityPool.address.toLowerCase());

  responseData = await subgraph(query);

  if (
    !responseData ||
    responseData.stabilityPoolGlobals.bonqRewardPerMinute !== bonqPerMinute ||
    responseData.stabilityPoolGlobals.totalBonqRewards !== totalBonqRewards
  ) {
    console.log("bonqPerMinute", bonqPerMinute);
    console.log("totalBonqRewards", totalBonqRewards);
    console.log("received bonqPerMinute", responseData.stabilityPoolGlobals.bonqRewardPerMinute);
    console.log("received totalBonqRewards", responseData.stabilityPoolGlobals.totalBonqRewards);
    throw new Error("Subgraph test failure. Bonq rewards settings isn't synced right.");
  }
  console.log("Stability Pool bonq reward per minute and total bonq rewards update test passed.✅");

  // BonqStaking and Redemption test

  console.log("BonqStaking and Redemption test");

  console.log("cretaing new trove...");
  tx = await troveFactory.createTrove(newTroveToken.address, gasSettings);
  await tx.wait();
  troveAddress = await troveFactory.firstTrove(newTroveToken.address, gasSettings);
  trove = Trove.attach(troveAddress);

  console.log("setting price to 1...");
  tx = await priceFeed.setPrice(DECIMAL_PRECISION, gasSettings);
  await tx.wait();

  console.log("preparing for redemption...");

  const newDebtMultiplier = (await trove.collateralization()).div(13).mul(10); /// Divide collaterization by 1.3 (1.3 is needed)
  const newDebtValue = (await trove.debt()).mul(newDebtMultiplier.sub(DECIMAL_PRECISION)).div(DECIMAL_PRECISION);
  tx = await trove.borrow(walletAddress, newDebtValue, troveAddress, { gasLimit: "8000000", ...gasSettings });

  await tx.wait();
  const redemptionTroveAddress = await troveFactory.firstTrove(newTroveToken.address);
  const redemptionTrove = Trove.attach(redemptionTroveAddress);
  const redemptionTroveDebt = await redemptionTrove.debt();
  const redemptionRate = await troveFactory.getRedemptionFeeRatio(redemptionTroveAddress);

  console.log("trying to redeem...");

  const redemptionAmount = redemptionTroveDebt.mul(DECIMAL_PRECISION.add(redemptionRate).mul(2)).div(DECIMAL_PRECISION);

  tx = await stableCoin.approve(troveFactory.address, redemptionAmount);
  await tx.wait();

  tx = await troveFactory.redeemStableCoinForCollateral(
    newTroveToken.address,
    redemptionAmount,
    redemptionRate.mul(4).div(3),
    redemptionTroveAddress,
    ethers.constants.AddressZero,
    gasSettings
  );
  const receipt = await tx.wait();
  console.log("trying to getData...");
  await waitForSync(2000);

  console.log("trying to query...");
  const logIndex = receipt.logs[receipt.logs.length - 1].logIndex;
  const redemptionLogId = receipt.transactionHash.concat("-").concat(logIndex.toString());
  query = queryTroveRedemption(redemptionLogId);

  console.log("trying to subgraph...");
  responseData = await subgraph(query);

  if (!responseData || !(responseData.troveRedemption.stableCoinRedeemed > 0)) {
    console.log("collateralRedeemed", responseData.troveRedemption.stableCoinRedeemed);
    console.log("stableCoinRedeemed", responseData.troveRedemption.stableCoinRedeemed);
    console.log("troveRedemption", responseData.troveRedemption);
    throw new Error("Subgraph test failure. TroveFactory redemption did not succeed or is not synced right.");
  }
  console.log("BonqStaking and Redemption test passed.✅\n");
  console.log("\n===============================///===============================\n");
  console.log("✅All tests are passed.✅\n");

  await execPromisified(graphDeleteCommand);
  await execPromisified("mv subgraph-backup.yaml subgraph.yaml");
}

main()
  .then(() => process.exit(0))
  .catch(async (error) => {
    let errorHandlingError = null;
    try {
      await execPromisified(graphDeleteCommand);
      await execPromisified("mv subgraph-backup.yaml subgraph.yaml");
    } catch (err) {
      errorHandlingError = err;
    }
    console.error(error);
    if (errorHandlingError) {
      console.error(errorHandlingError);
    }
  });
