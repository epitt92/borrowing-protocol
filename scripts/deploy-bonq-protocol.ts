/* eslint-disable @typescript-eslint/no-var-requires */
import { deployments, ethers, network } from "hardhat";
import {
  ArbitragePoolUniswap,
  BonqProxy,
  BONQStaking,
  StabilityPoolUniswap,
  TokenToPriceFeed,
  Trove,
  TroveFactory
} from "../src/types";
import { DeployOptions, DeployResult } from "hardhat-deploy/types";
import { Deployment } from "hardhat-deploy/dist/types";
import { addCollateralToken, OracleType } from "./createPriceFeeds";
import { BigNumber, Contract } from "ethers";
import { BytesLike } from "ethers/lib/utils";
import { IERC20, MintableToken, PriceAggregator } from "../deployments_package";
import { DECIMAL_PRECISION, getContractAt, toBN } from "../test/utils/helpers";
import https from "https";

interface DeploymentsMap {
  [key: string]: Deployment & { newlyDeployed: boolean }
}

interface VariableMap {
  [key: string]: any
}

//used to keep code small and pretty
const deploymentResults: DeploymentsMap = {};

type DeploymentFunction = (name: string, options: DeployOptions) => Promise<DeployResult>;

export interface GasPrediction {
  safeLow: { maxPriorityFee: number, maxFee: number },
  standard: { maxPriorityFee: number, maxFee: number },
  fast: { maxPriorityFee: number, maxFee: number },
  estimatedBaseFee: number,
  blockTime: number,
  blockNumber: number
}

export interface FeeData {
  maxFeePerGas: undefined | BigNumber;
  maxPriorityFeePerGas: undefined | BigNumber;
  gasLimit: undefined | BigNumber;
}

async function feeData(): Promise<FeeData> {
  ethers.provider.getFeeData()
  let prediction: GasPrediction;
  prediction = await new Promise((resolve, reject) => {
    if(network.name == "polygon") {
      https.get('https://gasstation-mainnet.matic.network/v2', (res) => {
        res.on('data', (data) => {
          resolve(JSON.parse(data.toString()))
        });
      }).on('error', (e) => {
        reject(e)
      });
    } else {
      const prediction: GasPrediction = {
        blockNumber: 0,
        blockTime: 0,
        estimatedBaseFee: 0,
        safeLow: {maxFee: 0, maxPriorityFee: 0},
        standard: {maxFee: 0, maxPriorityFee: 0},
        fast: {maxPriorityFee: 30, maxFee: 30}
      }
      resolve(prediction)
    }
  });

  return {
    maxFeePerGas: toBN(parseInt((prediction.fast.maxFee * 1e9).toString())),
    maxPriorityFeePerGas: toBN(parseInt((prediction.fast.maxPriorityFee * 1e9).toString())),
    gasLimit: network.name == "polygon" ? undefined : toBN("8000000")
    // baseFee: toBN(parseInt((prediction.estimatedBaseFee * 1e9).toString()))
  }
}

function getDeployFunction(basicDeployFunction: DeploymentFunction, network: string) {
  return async function deployAndGetContract(contractName: string,
                                             deployer: string,
                                             args: any[] = [],
                                             deploymentName: string = contractName) {
    const {maxPriorityFeePerGas, maxFeePerGas, gasLimit} = await feeData()
    // console.log("attempting deployment of", deploymentName)
    let result = await basicDeployFunction(deploymentName, {
      contract: contractName,
      from: deployer,
      args: args,
      log: true,
      maxFeePerGas,
      maxPriorityFeePerGas,
      gasLimit
    }) as DeployResult;
    deploymentResults[deploymentName] = result;
    if (result.receipt && result.receipt.contractAddress) {
      console.log("successful deployment", deploymentName, result.receipt.contractAddress, "in tx", result.receipt.transactionHash)
      return ethers.getContractAt(contractName, result.receipt.contractAddress, deployer);
    } else {
      throw new Error(`deployment ${deploymentName} failed\n${result.receipt}`)
    }
  };
}

/* eslint-disable no-undef */
export async function deployBorrowingProtocol(skip: number = 0) {
  const tokenList = [
    "albt",
    "wmatic",
    "usdc",
    "dai",
    "weth",
  ]
  const addresses: VariableMap = {
    default: {
      router: "0xE592427A0AEce92De3Edee1F18E0157C05861564",
      oracles: {},
      erc: {},
      finalOwner: undefined
    },
    mumbai: {
      router: "0xE592427A0AEce92De3Edee1F18E0157C05861564",
      eurusd: undefined,
      oracles: {
      },
      oracleType: {
        wmatic: OracleType.LINK,
        usdc: OracleType.LINK,
        dai: OracleType.LINK,
        weth: OracleType.LINK,
        albt: OracleType.LINK,
      },
      queryString: {
      },
      erc: {
      },
      finalOwner: "0x4A89333f9188849d9E9E7AEA6c69c8700cAae5c5" //Test-Deployer moz
    },
    polygon: {
      router: "0xE592427A0AEce92De3Edee1F18E0157C05861564",
      eurusd: "0x73366fe0aa0ded304479862808e02506fe556a98",
      oracles: {
        wmatic: "0xab594600376ec9fd91f8e885dadf0ce036862de0",
        usdc: "0xfe4a8cc5b5b2366c1b58bea3858e81843581b2f7",
        dai: "0x4746dec9e833a82ec7c2c1356372ccf2cfcd2f3d",
        weth: "0xF9680D99D6C9589e2a93a78A04A279e509205945",
        albt: "0x8f55D884CAD66B79e1a131f6bCB0e66f4fD84d5B",
      },
      oracleType: {
        wmatic: OracleType.LINK,
        usdc: OracleType.LINK,
        dai: OracleType.LINK,
        weth: OracleType.LINK,
        albt: OracleType.TLR,
      },
      queryString: {
          albt: "0x12906c5e9178631dba86f1f750f7ab7451c61e6357160eb890029b9eac1fb235"
      },
      erc: {
        bnq: "0x91efbe97e08d0ffc7d31381c032d05fad8e25aaa",
        wmatic: "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270",
        usdc: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
        dai: "0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063",
        weth: "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619",
        albt: "0x35b2ECE5B1eD6a7a99b83508F8ceEAB8661E0632",
      },
      finalOwner: "0xbf9a4eCC4151f28C03100bA2C0555a3D3e439e69" //Trezor
    },
    mcr: {
      wmatic: 120,
      usdc: 105,
      dai: 105,
      albt: 400,
      weth: 120
    },
    mrf: {
      wmatic: 250,
      usdc: 500,
      dai: 500,
      albt: 250,
      weth: 250
    }
  }

  addresses.hardhat = addresses.polygon

  const {deploy} = deployments;
  const accounts = await ethers.provider.listAccounts()
  const deployer: string = accounts[0];
  console.log(`deployer is ${deployer} with balance ${(await ethers.provider.getBalance(deployer)).toString()}`)
  const signer = await ethers.provider.getSigner(accounts[0])
  const deployAndGetContract = getDeployFunction(deploy, network.name);

  const deployUUPSContract = async function (
      name: string,
      deployer: string,
      args: any = [],
      constructorArgs: any = [],
      proxyContractAdmin: string = deployer,
      proxyArgData: BytesLike = "0x"
  ): Promise<Contract> {
    const implementationContract = await deployAndGetContract(name, deployer, constructorArgs, `${name}Implementation`) as Contract;

    const proxy = await deployAndGetContract("BonqProxy", proxyContractAdmin, [
      implementationContract.address,
      proxyArgData
    ], `${name}Proxy`) as BonqProxy;

    const proxyWithImplementation = (await ethers.getContractAt(name, proxy.address)) as Contract;
    await (await proxyWithImplementation.initialize(...args)).wait();
    return proxyWithImplementation;
  }

  let bonqTokenAddress: string;
  if(!addresses[network.name]) {
    addresses[network.name] = addresses["default"]
    addresses[network.name].finalOwner = deployer
  }
  if(addresses[network.name].erc.bnq) {
    bonqTokenAddress = addresses[network.name].erc.bnq;
  } else {
    const token = await deployAndGetContract(
        "MintableToken",
        deployer,
        ["Bonq", "BNQ"],
        "BNQ"
    ) as MintableToken;
    bonqTokenAddress = token.address
    await (await token.mint(deployer, DECIMAL_PRECISION.mul(6e7))).wait()
  }
  const bnq = await getContractAt("ERC20", bonqTokenAddress) as IERC20

  const stableCoin = await deployAndGetContract(
      "MintableToken",
      deployer,
      ["Bonq EUR", "BEUR"],
      "TroveStableCoin"
  );

  const bonqStaking = (await deployUUPSContract(
      "BONQStaking",
      deployer,
      [bonqTokenAddress],
      []
  )) as BONQStaking;

  const troveFactory = await deployUUPSContract("OriginalTroveFactory", deployer,[stableCoin.address, bonqStaking.address], []) as TroveFactory

  await ( await bonqStaking.setFactory(troveFactory.address, await feeData()) ).wait();

  const mintableTokenOwner = await deployAndGetContract("MintableTokenOwner", deployer, [stableCoin.address]);
  await ( await stableCoin.transferOwnership(mintableTokenOwner.address, await feeData()) ).wait();
  await ( await mintableTokenOwner.transferOwnership(troveFactory.address, await feeData()) ).wait();

  const arbitragePool = await deployUUPSContract("ArbitragePoolUniswap", deployer,[],
      [troveFactory.address, addresses[network.name].router]) as ArbitragePoolUniswap;

  const tokenToPriceFeed: TokenToPriceFeed = await deployAndGetContract("TokenToPriceFeed", deployer) as TokenToPriceFeed;

  const stabilityPool = await deployUUPSContract("StabilityPoolUniswap", deployer,[],
      [troveFactory.address, bonqTokenAddress]) as StabilityPoolUniswap;
  await ( await stabilityPool.setRouter(addresses.default.router, await feeData()) ).wait();
  console.log("transferring BNQ to stability pool")
  await ( await bnq.transfer(stabilityPool.address, DECIMAL_PRECISION.mul(4e7))).wait()
  console.log("setting reward balance")
  await ( await stabilityPool.setBONQAmountForRewards(await feeData()) ).wait();
  const bonqPerMinute = DECIMAL_PRECISION.mul(5e4).div(60).div(24).add(1)
  await ( await stabilityPool.setBONQPerMinute(bonqPerMinute, await feeData()) ).wait();

  await ( await troveFactory.setTokenPriceFeed(tokenToPriceFeed.address, await feeData()) ).wait();
  await ( await troveFactory.setTokenOwner(await feeData()) ).wait();
  await ( await troveFactory.setArbitragePool(arbitragePool.address, await feeData()) ).wait();
  await ( await troveFactory.setStabilityPool(stabilityPool.address, await feeData()) ).wait();

  const troveImplementation = await deployAndGetContract( "Trove", deployer,[troveFactory.address]) as Trove;
  await ( await troveFactory.setTroveImplementation(troveImplementation.address, await feeData()) ).wait();

  if(!addresses[network.name].eurusd) {
    const oracleContract = (await deployAndGetContract(
        "PriceAggregator",
        deployer,
        [],
        `EURUSD_PriceAggregator`
    )) as PriceAggregator;
    await (await oracleContract.setDecimals(8, await feeData())).wait()
    await (await oracleContract.setLatestAnswer("125000000", await feeData())).wait()
    addresses[network.name].eurusd = oracleContract.address
  }

  const eurusdPricefeed = await deployAndGetContract(
      "ChainlinkPriceFeed",
      deployer,
      [addresses[network.name].eurusd, stableCoin.address],
      `USDEUR_ChainlinkPriceFeed`
  );

  for (let tokenName of tokenList) {
    await addCollateralToken(
        addresses[network.name].erc[tokenName],
        addresses[network.name].oracles[tokenName],
        addresses[network.name].oracleType[tokenName],
        addresses[network.name].queryString[tokenName],
        eurusdPricefeed.address,
        tokenName,
        addresses.mcr[tokenName],
        addresses.mrf[tokenName],
        tokenToPriceFeed,
        troveFactory,
        arbitragePool,
        deployer,
        deployAndGetContract
    )
  }

  console.log("BEUR deployed to:", [stableCoin.address]);
  console.log("TroveFactory deployed to:", troveFactory.address);
  console.log("TokenToPriceFeed deployed to:", tokenToPriceFeed.address);
  console.log("StabilityPool deployed to:", stabilityPool.address);
  console.log("ArbitragePool deployed to:", arbitragePool.address);
  console.log("BONQ-staking deployed to:", bonqStaking.address);
  console.log("BONQ token deployed to:", bonqTokenAddress);
  console.log(`transferring ownership to ${addresses[network.name].finalOwner}`)

  await (await arbitragePool.transferOwnership(addresses[network.name].finalOwner, await feeData())).wait()
  await (await bonqStaking.transferOwnership(addresses[network.name].finalOwner, await feeData())).wait()
  await (await stabilityPool.transferOwnership(addresses[network.name].finalOwner, await feeData())).wait()
  await (await tokenToPriceFeed.transferOwnership(addresses[network.name].finalOwner, await feeData())).wait()
  await (await troveFactory.transferOwnership(addresses[network.name].finalOwner, await feeData())).wait()
}

deployBorrowingProtocol().then(console.log).catch(console.error);
