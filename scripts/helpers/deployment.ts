import { BigNumber } from "ethers";
import { ethers, network } from "hardhat";
import https from "https";
import { toBN } from "../../test/utils/helpers";
import { DeployOptions, DeployResult } from "hardhat-deploy/types";
import { Deployment } from "hardhat-deploy/dist/types";

type DeploymentFunction = (name: string, options: DeployOptions) => Promise<DeployResult>;

export interface VariableMap {
  [key: string]: any
}

interface DeploymentsMap {
  [key: string]: Deployment & { newlyDeployed: boolean }
}

export interface GasPrediction {
  safeLow: { maxPriorityFee: number, maxFee: number },
  standard: { maxPriorityFee: number, maxFee: number },
  fast: { maxPriorityFee: number, maxFee: number },
  estimatedBaseFee: number,
  blockTime: number,
  blockNumber: number
}

//used to keep code small and pretty
const deploymentResults: DeploymentsMap = {};

export interface FeeData {
  maxFeePerGas: undefined | BigNumber;
  maxPriorityFeePerGas: undefined | BigNumber;
}

export async function feeData(): Promise<FeeData> {
  ethers.provider.getFeeData()
  const prediction: GasPrediction = await new Promise((resolve, reject) => {
    https.get('https://gasstation-mainnet.matic.network/v2', (res) => {
      res.on('data', (data) => {
        resolve(JSON.parse(data.toString()))
      });
    }).on('error', (e) => {
      reject(e)
    });
  })

  return {
    maxFeePerGas: toBN(parseInt((prediction.fast.maxFee * 1e9).toString())),
    maxPriorityFeePerGas: toBN(parseInt((prediction.fast.maxPriorityFee * 1e9).toString())),
    // baseFee: toBN(parseInt((prediction.estimatedBaseFee * 1e9).toString()))
  }
}

export function getDeployFunction(basicDeployFunction: DeploymentFunction, network: string) {
  return async function deployAndGetContract(contractName: string,
                                             deployer: string,
                                             args: any[] = [],
                                             deploymentName: string = contractName) {
    const {maxPriorityFeePerGas, maxFeePerGas} = await feeData()
    // console.log("attempting deployment of", deploymentName)
    let result = await basicDeployFunction(deploymentName, {
      contract: contractName,
      from: deployer,
      args: args,
      log: true,
      gasLimit: "8000000",
      maxFeePerGas,
      maxPriorityFeePerGas
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

