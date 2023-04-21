import { ethers, network } from "hardhat";
import { DECIMAL_PRECISION, getEventsFromReceipt, toBN } from "../test/utils/helpers";
import { BigNumber, Contract } from "ethers";
import { MintableToken, Trove, TroveFactory } from "../src/types";
import path from "path";
import { readFileSync } from "fs";
import { ChainlinkPriceFeed, PriceAggregator } from "../deployments_package";

const ONE = BigNumber.from(1e9).mul(1e9)

async function main() {
  const tokenList = [
    // {symbol: "ALBT", price: 1526},
    {symbol: "WMATIC", price: 9414},
    {symbol: "USDC", price: 10000},
    {symbol: "DAI", price: 10000},
    {symbol: "WETH", price: 17155400},
  ]

  const ONE = DECIMAL_PRECISION
  const accounts = await ethers.provider.listAccounts();
  const deployer = ethers.provider.getSigner(accounts[0])
  const deploymentsPath = path.resolve(process.cwd(), "deployments_package/deployments");

  const getContract = async function (deploymentName: string, contract: string): Promise<Contract> {
    const deployment = JSON.parse(readFileSync(path.resolve(deploymentsPath, network.name, `${deploymentName}.json`)).toString());
    return await ethers.getContractAt(contract, deployment.address, deployer)
  }

  const troveFactory = await getContract("OriginalTroveFactoryProxy", "TroveFactory") as TroveFactory

  for (const token of tokenList) {
    const tokenContract = await getContract(token.symbol, "MintableToken") as MintableToken
    const priceOracle = await getContract(`${token.symbol}_PriceAggregator`, "PriceAggregator") as PriceAggregator
    const usdPrice = toBN(1e8).mul(token.price).div(10000)
    console.log(`setting price of ${token.symbol} to ${token.price} precision ${usdPrice.toString()}`)
    await ( await priceOracle.setLatestAnswer(usdPrice) ).wait()

    let priceFeed = await getContract(`${token.symbol}_EURPriceFeed`, "ConvertedPriceFeed") as ChainlinkPriceFeed
    console.log(`emit price signal for ${token.symbol} to ${( await priceFeed.price() ).toString()}`)
    await ( await priceFeed.emitPriceSignal() ).wait()


    await setInitialState(
        [
          {contract: tokenContract, price: await priceFeed.price()}
        ],
        troveFactory,
        network.name
    );
  }
}

async function setInitialState(
    tokens: { contract: MintableToken; price: BigNumber }[],
    troveFactory: TroveFactory,
    network: string
) {
  let testAddresses: string[];
  if (["hardhat", "localhost", "ganache"].find((name) => name == network)) {
    testAddresses = [
      // Tests
      "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266",
      "0x70997970c51812dc3a010c7d01b50e0d17dc79c8",
      "0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc",
      "0x90f79bf6eb2c4f870365e785982e1f101e93b906",
      "0x15d34aaf54267db7d7c367839aaf71a00a2c6a65",
    ];
  } else {
    testAddresses = [
      // Michal
      "0xCe8cfE11582f456150d6B8b89EEB3E7b4654aa8A",
      // Delia
      "0xF69Db912e1A7fE7E90D60b01a87f6CA0Eb024CE8",
      // Micha
      "0x4A89333f9188849d9E9E7AEA6c69c8700cAae5c5",
      "0xa0ee7a142d267c1f36714e4a8f75612f20a79720",
    ];
  }
  console.log(`${network} with ${testAddresses.length} addresses`);

  for (const token of tokens) {
    console.log(`\n********** creating troves with ${await token.contract.name()}`);
    const owner = await token.contract.owner();
    const signer = await ethers.getSigner(owner);
    console.log(`minting ${await token.contract.name()}`)
    await ( await token.contract.mint(owner, ONE.mul(1e9)) ).wait();
    console.log(`approving ${await token.contract.name()}`)
    await ( await token.contract.approve(troveFactory.address, ONE.mul(1e9)) ).wait();
    for (const address of testAddresses) {
      console.log(`create trove with ${await token.contract.name()} for ${address}`,
          `with ${ONE.mul(5e6).mul(DECIMAL_PRECISION).div(token.price)} collateral`,
          `and ${ONE.mul(2e6)} of debt`)
      const tx = await (
          await troveFactory.createTroveAndBorrow(
              token.contract.address,
              ONE.mul(5e6).mul(DECIMAL_PRECISION).div(token.price),
              address,
              ONE.mul(1e6),
              "0x0000000000000000000000000000000000000000",
              {gasLimit: 8000000}
          )
      ).wait();
      const event = getEventsFromReceipt(troveFactory.interface, tx, "NewTrove")[0].args;
      const trove = ( await ethers.getContractAt("Trove", event.trove, signer) ) as Trove;
      console.log(`          ********** transferred ownership of trove ${trove.address} to ${address}`);
      await ( await trove.transferOwnership(address) ).wait();
    }
  }
}

main().then(console.log).catch(console.error)
