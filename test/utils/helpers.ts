import { BigNumber, Contract, Signer } from "ethers";
import { BytesLike, Interface } from "ethers/lib/utils";
import { ethers } from "hardhat";
import { LogDescription } from "@ethersproject/abi/src.ts/interface";
import { TransactionReceipt } from "@ethersproject/abstract-provider";
import { BonqProxy, UUPSUpgradeable } from "../../src/types";

function toBN(num: any) {
  return BigNumber.from(num.toString());
}

const addressZero = "0x0000000000000000000000000000000000000000";
const LIQUIDATION_RESERVE = toBN(1e18);
const DECIMAL_PRECISION = toBN(1e18);

function randBetween(min: number, max: number) {
  // min and max included
  return Math.floor(Math.random() * (max - min + 1) + min);
}

async function deployContract(signer: Signer, name: string, args?: any, libraries?: any): Promise<any> {
  const factory = await ethers.getContractFactory(name, { libraries });
  args = args ? args : [];
  const contract = await factory.connect(signer).deploy(...args);

  await contract.deployed();

  return contract;
}

async function deployContractByBytecode(signer: Signer, abi: any[], bytecode: BytesLike, args?: any): Promise<any> {
  const factory = await ethers.getContractFactory(abi, bytecode);
  args = args ? args : [];
  const contract = await factory.connect(signer).deploy(...args);

  await contract.deployed();

  return contract;
}

async function deployUUPSContract(
  signer: Signer,
  name: string,
  args: any = [],
  constructorArgs: any = [],
  proxyContractAdmin: Signer = signer,
  proxyArgData: BytesLike = "0x"
): Promise<Contract> {
  const implementationContract = (await deployContract(signer, name, constructorArgs)) as Contract;

  const proxy = (await deployContract(proxyContractAdmin, "BonqProxy", [implementationContract.address, proxyArgData])) as BonqProxy;

  const proxyWithImplementation = (await ethers.getContractAt(name, proxy.address)) as Contract;
  await (await proxyWithImplementation.initialize(...args)).wait();
  return proxyWithImplementation;
}

async function upgradeUUPSContract(proxy: Contract | UUPSUpgradeable, signer: Signer, name: string, constructorArgs: any = [], proxyCallData: any = "0x"): Promise<Contract> {
  const newImplementationContract = (await deployContract(signer, name, constructorArgs)) as Contract;

  if (proxyCallData !== "0x" && proxyCallData != null) {
    await (await (proxy as UUPSUpgradeable).upgradeToAndCall(newImplementationContract.address, proxyCallData)).wait();
  } else {
    await (await (proxy as UUPSUpgradeable).upgradeTo(newImplementationContract.address)).wait();
  }
  const newProxyWithImplementation = await getContractAt(name, proxy.address);
  return newProxyWithImplementation;
}

async function getContractAt(name: string, address: string) {
  const factory = await ethers.getContractFactory(name);
  return factory.attach(address);
}

function getEventsFromReceipt(contractInterface: Interface, receipt: TransactionReceipt, eventName = ""): LogDescription[] {
  const events: LogDescription[] = [];
  for (const log of receipt.logs)
    try {
      const event = contractInterface.parseLog(log);
      if (event.name === eventName || eventName == "") {
        events.push(event);
      }
    } catch (err) {
      // do nothing
    }
  return events;
}

export {
  toBN,
  randBetween,
  deployContract,
  deployUUPSContract,
  upgradeUUPSContract,
  deployContractByBytecode,
  getContractAt,
  addressZero,
  getEventsFromReceipt,
  LIQUIDATION_RESERVE,
  DECIMAL_PRECISION
};
