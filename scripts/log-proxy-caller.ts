/* eslint-disable @typescript-eslint/no-var-requires */
import { ethers, network, run, deployments } from "hardhat"
import { BigNumber } from "bignumber.js";
import * as fs from "fs"
import { readFileSync } from "fs";

BigNumber.config({DECIMAL_PLACES: 0});

/* eslint-disable no-undef */
async function main() {
  const accounts = await ethers.provider.listAccounts();
  const deployer = ethers.provider.getSigner(accounts[0])
  const sender = ethers.provider.getSigner(accounts[1])

  const tf = await ethers.getContractAt("OriginalTroveFactory",
      "0x5a24D21a8D674de96adD7129404A75BBc709ef0A", deployer)

  return tf.interface.decodeFunctionResult("createTroveAndBorrow(address,uint256,address,uint256,address)",
      "0x36366331302074686520746f6b656e2070726963652066656564206d75737420626520736574").toString()
}

main().then(console.log).catch(console.error);
