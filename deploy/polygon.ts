/* eslint-disable @typescript-eslint/no-var-requires */
import {
  ArbitragePool,
  BonqProxy,
  BONQStaking,
  StabilityPool,
  TokenToPriceFeed,
  Trove,
  TroveFactory
} from "../src/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployOptions, DeployResult } from "hardhat-deploy/types";
import { Deployment } from "hardhat-deploy/dist/types";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { addCollateralToken } from "../scripts/createPriceFeeds";
import { Contract } from "ethers";
import { BytesLike } from "ethers/lib/utils";

interface DeploymentsMap {
  [key: string]: Deployment & { newlyDeployed: boolean }
}

interface VariableMap {
  [key: string]: any
}

const {ethers} = require("hardhat");

//used to keep code small and pretty
const deploymentResults: DeploymentsMap = {};

type DeploymentFunction = (name: string, options: DeployOptions) => Promise<DeployResult>;

function getDeployFunction(basicDeployFunction: DeploymentFunction, network: string) {
  return async function deployAndGetContract(contractName: string,
                                             deployer: string,
                                             args: any[] = [],
                                             deploymentName: string = contractName) {
    let result = await basicDeployFunction(deploymentName, {
      contract: contractName,
      from: deployer,
      args: args,
      log: true
    }) as DeployResult;
    deploymentResults[deploymentName] = result;
    if (result.receipt && result.receipt.contractAddress) {
      return ethers.getContractAt(contractName, result.receipt.contractAddress, deployer);
    } else {
      throw new Error(`deployment ${deploymentName} failed\n${result.receipt}`)
    }
  };
}

/* eslint-disable no-undef */
module.exports = async ({getNamedAccounts, deployments, network}: HardhatRuntimeEnvironment) => {
  const tokenList = [
    "wmatic",
    "usdc",
    "dai",
    "weth",
    "albt"
  ]
  const addresses: VariableMap = {
    default: {
      router: "0xE592427A0AEce92De3Edee1F18E0157C05861564",
      chainlink: {},
      erc: {},
      finalOwner: undefined
    },
    mumbai: {
      router: "0xE592427A0AEce92De3Edee1F18E0157C05861564",
      chainlink: {},
      erc: {},
      finalOwner: "0x2d45bc72f9c433b4570F9247080F3542eA004629" //Bonq Demo
    },
    polygon: {
      router: "0xE592427A0AEce92De3Edee1F18E0157C05861564",
      chainlink: {
        wmatic: "0xab594600376ec9fd91f8e885dadf0ce036862de0",
        usdc: "0xfe4a8cc5b5b2366c1b58bea3858e81843581b2f7",
        dai: "0xfe4a8cc5b5b2366c1b58bea3858e81843581b2f7",
        weth: "0xc907e116054ad103354f2d350fd2514433d57f6f"
      },
      erc: {
        bnq: "0x3DE4d3eC6F03aa5DD2f03EdBA1b6DCAcE95dB2cD",
        wmatic: "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270",
        usdc: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
        dai: "0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063",
        weth: "0x1BFD67037B42Cf73acF2047067bd4F2C47D9BfD6"
      },
      finalOwner: "0xbf9a4eCC4151f28C03100bA2C0555a3D3e439e69" //Trezor
    },
    mcr: {
      wmatic: 120,
      usdc: 110,
      dai: 110,
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
  const signer: SignerWithAddress = await ethers.provider.getSigner(accounts[0])
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
    );
    bonqTokenAddress = token.address
  }

  const stableCoin = await deployAndGetContract(
      "MintableToken",
      deployer,
      ["bonq EUR", "BEUR"],
      "TroveStableCoin"
  );

  const bonqStaking = (await deployUUPSContract(
      "BONQStaking",
      deployer,
      [bonqTokenAddress],
      []
  )) as BONQStaking;

  const troveFactory = await deployUUPSContract("OriginalTroveFactory", deployer,[stableCoin.address, bonqStaking.address], []) as TroveFactory

  await ( await bonqStaking.setFactory(troveFactory.address) ).wait();

  const mintableTokenOwner = await deployAndGetContract("MintableTokenOwner", deployer, [stableCoin.address]);
  await ( await stableCoin.transferOwnership(mintableTokenOwner.address) ).wait();
  await ( await mintableTokenOwner.transferOwnership(troveFactory.address) ).wait();

  const arbitragePool = await deployUUPSContract("ArbitragePool", deployer,[],
      [troveFactory.address, addresses[network.name].router]) as ArbitragePool;

  const tokenToPriceFeed: TokenToPriceFeed = await deployAndGetContract("TokenToPriceFeed", deployer);

  const stabilityPool = await deployUUPSContract("StabilityPool", deployer,[],
      [troveFactory.address, bonqTokenAddress]) as StabilityPool;

  await ( await troveFactory.setTokenPriceFeed(tokenToPriceFeed.address,) ).wait();
  await ( await troveFactory.setTokenOwner() ).wait();
  await ( await troveFactory.setArbitragePool(arbitragePool.address,) ).wait();
  await ( await troveFactory.setStabilityPool(stabilityPool.address,) ).wait();
  await ( await troveFactory.setStabilityPool(stabilityPool.address,) ).wait();

  const troveImplementation = await deployAndGetContract( "Trove", deployer,[troveFactory.address]) as Trove;
  await ( await troveFactory.setTroveImplementation(troveImplementation.address) ).wait();

  for (let tokenName of tokenList) {
    await addCollateralToken(
        addresses[network.name].erc[tokenName],
        addresses[network.name].chainlink[tokenName],
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

  await (await arbitragePool.transferOwnership(addresses[network.name].finalOwner)).wait()
  await (await bonqStaking.transferOwnership(addresses[network.name].finalOwner)).wait()
  await (await stabilityPool.transferOwnership(addresses[network.name].finalOwner)).wait()
  await (await tokenToPriceFeed.transferOwnership(addresses[network.name].finalOwner)).wait()
  await (await troveFactory.transferOwnership(addresses[network.name].finalOwner)).wait()
}

module.exports.skip = async (hre: HardhatRuntimeEnvironment) => {
  return false;
  // return hre.network.name !== "polygon";
};

