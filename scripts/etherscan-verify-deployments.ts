/* eslint-disable @typescript-eslint/no-var-requires */
import { ethers, network, run } from "hardhat"
import { BigNumber } from "bignumber.js";
import * as fs from "fs"
import { readFileSync } from "fs";

BigNumber.config({DECIMAL_PLACES: 0});

/* eslint-disable no-undef */
async function main() {
  const deploymentFolder = `./deployments_package/deployments/${network.name}`

  for(const file of fs.readdirSync(deploymentFolder)) {
    if(file.endsWith(".json")) {
      const json = JSON.parse(readFileSync(`${deploymentFolder}/${file}`).toString())
      let paramTypes: string[] = []
      const constructor = json.abi.find((el: any) => el.type == "constructor")
      if(constructor && constructor.inputs.length > 0) {
        for (const input of constructor.inputs) {
          paramTypes.push(input.type)
        }
      }
      console.log(file, json.address, ethers.utils.defaultAbiCoder.encode(paramTypes, json.args))
      console.log('launching verification')
      await run("verify:verify", {
        address: json.address,
        constructorArguments: json.args})
    }
  };
}

main().then(console.log).catch(console.error);
