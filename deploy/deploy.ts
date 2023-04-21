/* eslint-disable @typescript-eslint/no-var-requires */
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { Deployment, DeployOptions, DeployResult } from "hardhat-deploy/types";
import {
  ArbitragePool,
  BonqProxy,
  BONQStaking,
  CommunityLiquidationPool,
  MintableToken,
  MintableTokenOwner,
  StabilityPool,
  TestPriceFeed,
  TokenToPriceFeed,
  Trove,
  TroveFactory
} from "../src/types";
// import { getEventsFromReceipt, toBN } from "../test/utils/helpers";
import { ethers } from "hardhat";
import { Contract } from "ethers";
import { DECIMAL_PRECISION, getEventsFromReceipt, toBN } from "../test/utils/helpers";

interface DeploymentsMap {
  [key: string]: Deployment & { newlyDeployed: boolean };
}

interface VariableMap {
  [key: string]: any;
}

const gasSettings: VariableMap = {
  volta: {
    gasPrice: "1000000000"
  },
  "volta-test": {
    gasPrice: "1000000000"
  },
  hardhat: {},
  goerli: {},
  mumbai: {},
  "goerli-test": {}
}; //{maxFeePerGas: "300", maxPriorityFeePerGas: "10"}

//used to keep code small and pretty
const deploymentResults: DeploymentsMap = {};

type DeploymentFunction = (name: string, options: DeployOptions) => Promise<DeployResult>;

function getDeployFunction(basicDeployFunction: DeploymentFunction, network: string) {
  return async function deployAndGetContract<T extends Contract>(
    contractName: string,
    deployer: string,
    args: any[] = [],
    deploymentName: string = contractName
  ): Promise<T> {
    const result = (await basicDeployFunction(deploymentName, {
      contract: contractName,
      from: deployer,
      args: args,
      log: true,
      ...gasSettings[network]
    })) as DeployResult;
    deploymentResults[deploymentName] = result;
    if (result.receipt && result.receipt.contractAddress) {
      return ethers.getContractAt(contractName, result.receipt.contractAddress, deployer);
    } else {
      throw new Error(`deployment ${deploymentName} failed\n${result.receipt}`);
    }
  };
}

/* eslint-disable no-undef */
const deployFunc = async ({ getNamedAccounts, deployments, network }: HardhatRuntimeEnvironment) => {
  const routerAddress = "0xee8a637344b4699a89fd25fdc4db07d3266fe572";

  const { deploy } = deployments;
  const accounts = await ethers.provider.listAccounts();
  const deployer = accounts[0];
  const proxyContractAdmin = accounts[2];
  const deployAndGetContract = getDeployFunction(deploy, network.name);

  const stableCoin = await deployAndGetContract(
    "MintableToken",
    deployer,
    ["TroveStableCoin", "BEUR"],
    "TroveStableCoin"
  );

  const eth = await deployAndGetContract<MintableToken>("MintableToken", deployer, ["Ethereum", "ETH"], "ETH");
  const albt = await deployAndGetContract<MintableToken>(
    "MintableToken",
    deployer,
    ["Alliance Block Token", "ALBT"],
    "ALBT"
  );
  const bonqToken = await deployAndGetContract<MintableToken>(
    "MintableToken",
    deployer,
    ["BonqToken", "BONQ"],
    "BonqToken"
  );

  const tokenToPriceFeed: TokenToPriceFeed = await deployAndGetContract<TokenToPriceFeed>("TokenToPriceFeed", deployer);

  const ethPricefeed = (await deployAndGetContract<TestPriceFeed>(
    "TestPriceFeed",
    deployer,
    [eth.address, tokenToPriceFeed.address],
    "TestPriceFeed2"
  )) as TestPriceFeed;
  console.log("********** ********** ********** ********** ********** ethPricefeed newlyDeployed");
  await (
    await tokenToPriceFeed.setTokenPriceFeed(eth.address, ethPricefeed.address, 120, gasSettings[network.name])
  ).wait();
  await (await ethPricefeed.setPrice("1500000000000000000000")).wait();

  const albtPriceFeed = (await deployAndGetContract<TestPriceFeed>(
    "TestPriceFeed",
    deployer,
    [albt.address, tokenToPriceFeed.address],
    "TestPriceFeed3"
  )) as TestPriceFeed;
  console.log("********** ********** ********** ********** ********** albtPriceFeed newlyDeployed");
  await (
    await tokenToPriceFeed.setTokenPriceFeed(albt.address, albtPriceFeed.address, 120, gasSettings[network.name])
  ).wait();
  await (await albtPriceFeed.setPrice("500000000000000000")).wait();

  const bonqStakingImplementation = (await deployAndGetContract<BONQStaking>(
    "BONQStaking",
    deployer,
    [],
    "OriginalBONQStaking"
  )) as BONQStaking;
  const bonqStakingProxy = await deployAndGetContract<BonqProxy>(
    "BonqProxy",
    deployer,
    [bonqStakingImplementation.address, "0x"],
    "BONQStakingProxy"
  );
  const bonqStaking = (await ethers.getContractAt("BONQStaking", bonqStakingProxy.address)) as BONQStaking;

  await (await bonqStaking.initialize(bonqToken.address)).wait();

  const troveFactoryImplementation = (await deployAndGetContract(
    "OriginalTroveFactory",
    deployer,
    [],
    "OriginalTroveFactory"
  )) as TroveFactory;
  const proxy = await deployAndGetContract(
    "BonqProxy",
    deployer,
    [troveFactoryImplementation.address, "0x"],
    "TroveFactory"
  );
  const troveFactory = (await ethers.getContractAt("OriginalTroveFactory", proxy.address)) as TroveFactory;
  let troveImplementation: Trove;
  // only set the values if the contract is a new deployment
  if (deploymentResults["TroveFactory"].newlyDeployed) {
    console.log("********** ********** ********** ********** ********** TroveFactory newlyDeployed");
    await (await troveFactory.initialize(stableCoin.address, bonqStaking.address)).wait();

    troveImplementation = (await deployAndGetContract(
      "Trove",
      deployer,
      [troveFactory.address],
      "TroveImplementation"
    )) as Trove;
    let tx = await troveFactory.setTokenPriceFeed(tokenToPriceFeed.address, gasSettings[network.name]);
    await tx.wait();

    const mintableTokenOwner = await deployAndGetContract<MintableTokenOwner>("MintableTokenOwner", deployer, [
      stableCoin.address
    ]);

    tx = await mintableTokenOwner.addMinter(
      await (await ethers.getSigners())[0].getAddress(),
      gasSettings[network.name]
    );
    await tx.wait();

    tx = await mintableTokenOwner.addMinter(deployer, gasSettings[network.name]);
    await tx.wait();

    tx = await stableCoin.transferOwnership(mintableTokenOwner.address, gasSettings[network.name]);
    await tx.wait();

    tx = await mintableTokenOwner.transferOwnership(troveFactory.address, gasSettings[network.name]);
    await tx.wait();

    tx = await troveFactory.setTokenOwner(gasSettings[network.name]);
    await tx.wait();

    tx = await bonqStaking.setFactory(troveFactory.address, gasSettings[network.name]);
    await tx.wait();
  } else {
    troveImplementation = await ethers.getContractAt(
      "Trove",
      await troveFactory.troveImplementation(),
      ethers.provider.getSigner(deployer)
    );
  }

  const communityLiquidationPool2 = await deployAndGetContract<CommunityLiquidationPool>(
    "CommunityLiquidationPool",
    deployer,
    [troveFactory.address, eth.address],
    "CommunityLiquidationPool2"
  );
  const communityLiquidationPool3 = await deployAndGetContract<CommunityLiquidationPool>(
    "CommunityLiquidationPool",
    deployer,
    [troveFactory.address, albt.address],
    "CommunityLiquidationPool3"
  );

  const stabilityPoolImplementation = (await deployAndGetContract<StabilityPool>(
    "StabilityPool",
    deployer,
    [troveFactory.address, bonqToken.address],
    "OriginalStabilityPool"
  )) as StabilityPool;

  const stabilityPoolProxy = await deployAndGetContract<BonqProxy>(
    "BonqProxy",
    deployer,
    [stabilityPoolImplementation.address, "0x"],
    "StabilityPoolProxy"
  );

  const stabilityPool = (await ethers.getContractAt("StabilityPool", stabilityPoolProxy.address)) as StabilityPool;
  await (await stabilityPool.initialize()).wait();

  const arbitragePoolImplementation = (await deployAndGetContract<ArbitragePool>(
    "ArbitragePool",
    deployer,
    [troveFactory.address, routerAddress],
    "OriginalArbitragePool"
  )) as ArbitragePool;
  const arbitragePoolProxy = await deployAndGetContract<BonqProxy>(
    "BonqProxy",
    deployer,
    [arbitragePoolImplementation.address, "0x"],
    "ArbitragePoolProxy"
  );
  const stabilityPool = (await ethers.getContractAt("StabilityPool", stabilityPoolProxy.address)) as StabilityPool;
  await (await stabilityPool.initialize()).wait();

  const arbitragePoolImplementation = (await deployAndGetContract<ArbitragePool>(
    "ArbitragePool",
    deployer,
    [troveFactory.address, routerAddress],
    "OriginalArbitragePool"
  )) as ArbitragePool;
  const arbitragePoolProxy = await deployAndGetContract<BonqProxy>(
    "BonqProxy",
    deployer,
    [arbitragePoolImplementation.address, "0x"],
    "ArbitragePoolProxy"
  );
  const arbitragePool = (await ethers.getContractAt("ArbitragePool", arbitragePoolProxy.address)) as ArbitragePool;

  if (deploymentResults["ArbitragePoolProxy"].newlyDeployed) {
    console.log("********** ********** ********** ********** ********** ArbitragePool newlyDeployed");
    let tx = await arbitragePool.initialize();
    await tx.wait();
    tx = await arbitragePool.addToken(ewt.address);
    await tx.wait();
    tx = await arbitragePool.addToken(eth.address);
    await tx.wait();
    tx = await arbitragePool.addToken(albt.address);
    await tx.wait();
  }

  let tx = await troveFactory.setArbitragePool(arbitragePool.address, gasSettings[network.name]);
  await tx.wait();

  tx = await troveFactory.setStabilityPool(stabilityPool.address, gasSettings[network.name]);
  await tx.wait();

  await tx.wait();
  tx = await troveFactory.setLiquidationPool(eth.address, communityLiquidationPool2.address, gasSettings[network.name]);
  await tx.wait();
  tx = await troveFactory.setLiquidationPool(
    albt.address,
    communityLiquidationPool3.address,
    gasSettings[network.name]
  );
  await tx.wait();
  tx = await troveFactory.setStabilityPool(stabilityPool.address, gasSettings[network.name]);
  await tx.wait();

  // seal the trove implementation just to be on the safe side
  await (await troveImplementation.initialize(eth.address, deployer)).wait();
  await (await troveFactory.setTroveImplementation(troveImplementation.address)).wait();

  await (await bonqToken.mint(stabilityPool.address, DECIMAL_PRECISION.mul(5e8))).wait();
  await (await stabilityPool.setBONQAmountForRewards(DECIMAL_PRECISION.mul(5e8))).wait();
  await (await stabilityPool.setBONQPerMinute(DECIMAL_PRECISION.mul(100))).wait();

  console.log("eth", [eth.address]);
  console.log("albt", [albt.address]);
  console.log("StableCoin deployed to:", [stableCoin.address]);
  console.log("TroveFactory deployed to:", troveFactory.address);
  console.log("TokenToPriceFeed deployed to:", tokenToPriceFeed.address);
  console.log("StabilityPool deployed to:", stabilityPool.address);
  console.log("ArbitragePool deployed to:", arbitragePool.address);
  console.log("BONQ-staking deployed to:", bonqStaking.address);
  console.log("BONQ token deployed to:", bonqToken.address);

  /*
    await setInitialState(
        [
          {
            contract: eth,
            price: "1500000000000000000000"
          },
          {contract: albt, price: "500000000000000000"}
        ],
        troveFactory,
        network.name
    );
  */
};
module.exports.skip = async (hre: HardhatRuntimeEnvironment) => {
  return hre.network.name == "mainnet";
};

async function setInitialState(
  tokens: { contract: MintableToken; price: string }[],
  troveFactory: TroveFactory,
  network: string
) {
  let testAddresses: string[];
  if (["hardhat", "localhost", "ganache", "volta-test", "goerli-test"].find((name) => name == network)) {
    testAddresses = [
      // Tests
      "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266",
      "0x70997970c51812dc3a010c7d01b50e0d17dc79c8",
      "0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc",
      "0x90f79bf6eb2c4f870365e785982e1f101e93b906",
      "0x15d34aaf54267db7d7c367839aaf71a00a2c6a65"
    ];
  } else {
    testAddresses = [
      // Michal
      "0xCe8cfE11582f456150d6B8b89EEB3E7b4654aa8A",
      // Delia
      "0xF69Db912e1A7fE7E90D60b01a87f6CA0Eb024CE8",
      //Danyial
      "0x744D68D541C4AcC9abDC4a8fAA9E275056823f47",
      "0x6224027372486564331a85085E7bd65ac2FE2945",
      "0x0924ab8df0fA80156dD6440F4deB25f2FB566085",
      "0x087357B923B8Bcc6B510cCFA5229aB50536B0705",
      "0x38D89906b0ca475612b87D0F5db08573443B107c",
      // Micha
      "0x4A89333f9188849d9E9E7AEA6c69c8700cAae5c5"
    ];
  }
  console.log(`${network} with ${testAddresses.length} addresses`);
  const ONE = toBN("1000000000000000000");

  for (const token of tokens) {
    console.log(`\n********** creating troves with ${await token.contract.name()}`);
    const owner = await token.contract.owner();
    const signer = await ethers.getSigner(owner);
    await (await token.contract.mint(owner, ONE.mul(1000000000))).wait();
    await (await token.contract.approve(troveFactory.address, ONE.mul(1000000000))).wait();
    for (const address of testAddresses) {
      const tx = await (
        await troveFactory.createTroveAndBorrow(
          token.contract.address,
          ONE.mul(10000),
          address,
          toBN(token.price).mul(5000),
          "0x0000000000000000000000000000000000000000"
        )
      ).wait();
      const event = getEventsFromReceipt(troveFactory.interface, tx, "NewTrove")[0].args;
      const trove = (await ethers.getContractAt("Trove", event.trove, signer)) as Trove;
      console.log(`          ********** transferred ownership of trove ${trove.address} to ${address}`);
      await (await trove.transferOwnership(address)).wait();
    }
  }
}

export default deployFunc;
