/* eslint-disable @typescript-eslint/no-var-requires */
const { ethers } = require("hardhat");

/* eslint-disable no-undef */
async function main() {
  const WETH9Factory = await ethers.getContractFactory("WETH9");

  const WETH9 = await WETH9Factory.deploy();
  await WETH9.deployed();

  console.log("weth9 ", [WETH9.address]);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
