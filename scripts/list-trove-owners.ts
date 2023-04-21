/* eslint-disable @typescript-eslint/no-var-requires */
import { ethers } from "hardhat";
import { Trove, TroveFactory } from "../src/types";

interface VariableMap {
  [key: string]: any
}

async function listTroveOwners(skip: number = 0) {
  const accounts = await ethers.provider.listAccounts()
  const deployer: string = accounts[0];
  const signer = await ethers.provider.getSigner(accounts[0])
  const factory = await ethers.getContractAt("TroveFactory", "0xB580274e4E99b63D89Ddb42B20A91A24fe5A528c", signer) as TroveFactory
  const tokens = [
    "0x1feB4A11c1d64B165621CA1075DcAC2F8eb3696E",
    "0x79dfD67064c0a4A2eA04C8e5F73f64E1991b42e4",
    "0x1feB4A11c1d64B165621CA1075DcAC2F8eb3696E",
  ]
  let owners: VariableMap = {}
  for(const token of tokens) {
    const troveCount = ( await factory.troveCount(token) ).toNumber()
    console.log(`getting ${troveCount} troves for ${token}`)
    let troveAddress = await factory.firstTrove(token)
    for(let i = 1; i < troveCount; i++) {
      const trove = await ethers.getContractAt("Trove", troveAddress, deployer) as Trove
      const owner = await trove.owner()
      owners[owner] = owners[owner] ? owners[owner] + 1 : 1;
      console.log(`getting trove ${i}`)
      troveAddress = await factory.nextTrove(token, troveAddress)
    }
  }

  return owners
}

listTroveOwners().then(console.log).catch(console.error);

