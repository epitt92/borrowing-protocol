import { ethers, deployments, network } from "hardhat";
import { DeployOptions, DeployResult } from "hardhat-deploy/types";
import { DECIMAL_PRECISION } from "../test/utils/helpers";
import { FixSupplyToken } from "../deployments_package";

interface VariableMap {
  [key: string]: any
}

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

    if (result.receipt && result.receipt.contractAddress) {
      return ethers.getContractAt(contractName, result.receipt.contractAddress, deployer);
    } else {
      throw new Error(`deployment ${deploymentName} failed\n${result.receipt}`)
    }
  };
}

async function bonqToken() {
  const recipients = [
  	"0x66478C8D894d216B57F484C0880717526709C173", //Rachid
  	"0x437838ab5fF2B5Aad7CDe89eCFdE46F48b948cF3", //Matthijs
  	"0x05857800C55ecCE59A1CF7Dc558180861F729067", //Alliance Block
  	"0x6206Bd4D16d6E1Fb0ed58e1F5586B7988c91F81a", //Micha
  	"0x411d1E6578aA96FbfCb9633B45E3BDFC08b56FF8", //Delia
  	"0x74646F9Ab5255A97d87Ad3bD883C6Ad32263FF90", //Walter
  	"0x302FFE07D99af3E9b672B926904beC796E0beE66", //Michal
  	"0x27F9062Fe5bf9455e1205f43ac888f9bc0180F84", //Klaudia
  	"0x6aF410e7DA792d15a0105b32fFF40e037349cF19", //Volodymyr Sevastianov
  	"0x7573a6E9B5d03652F87E7c1A76065F2763Ae590d", //Nazar Havryliuk
  	"0x8C00005876DeDDBb80B05b51937E0ed518c77653", //Patrick
  	"0x8922b9e8bf201E624574FF65492c5e74D5F82Df3", //BonqDAO wallet
  ]
  const amounts = [
    25000000, //Rachid
    25000000, //Matthijs
    50000000, //Alliance Block
    70000000, //Micha
    40000000, //Delia
    40000000, //Walter
    70000000, //Michal
    240000, //Klaudia
    50000, //Volodymyr Sevastianov
    50000, //Nazar Havryliuk
    3000000, //Patrick
    676660000, //BonqDAO wallet
  ]
  const accounts = await ethers.provider.listAccounts();
  const deployer = ethers.provider.getSigner(accounts[0])
  const deployAndGetContract = getDeployFunction(deployments.deploy, network.name);

  const bnq = await deployAndGetContract("FixSupplyToken", accounts[0], [
      "Bonq Utility Token",
      "BNQ",
      recipients,
      amounts.map(amount => DECIMAL_PRECISION.mul(amount))
  ], "BNQ") as FixSupplyToken

  console.log(await Promise.all(
      recipients.map(async (recipient) => ({
        address: recipient,
        balance: (await bnq.balanceOf(recipient)).div(DECIMAL_PRECISION).toString()
      }))
  ))
  console.log("total supply", (await bnq.totalSupply()).div(DECIMAL_PRECISION).toString())
}

bonqToken().then(console.log).catch(console.error);
