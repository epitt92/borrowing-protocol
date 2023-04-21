import { ethers, network } from "hardhat";
import { ERC20, Trove, TroveFactory } from "../deployments_package";
import { GraphQLClient } from "graphql-request";
import { Wallet } from "ethers";
import { DECIMAL_PRECISION } from "../test/utils/helpers";

const setupLogger = () => ( {
  error: console.error,
  info: console.info,
  trace: console.log
} )

const deploymentFolder = `../deployments_package/deployments/${network.name}/`;
const TROVE_FACTORY = require(`${deploymentFolder}TroveFactory.json`);

const privateKey = process.env.LIQUIDATION_PRIVATE_KEY || "";
const testRun = process.env.TEST_RUN && process.env.TEST_RUN.toLowerCase() == "true";

const graphClient = new GraphQLClient(process.env.GRAPH_NODE_GRAPHQL_URL as string, {
  headers: {
    authorization: process.env.GRAPH_AUTHORIZATION_STRING
  } as HeadersInit
});

const getTokens = async (): Promise<string[]> => {
  const tokensQuery = `
      query {
        tokens {
          symbol
          id
          pricePoint
          mcr
        }
      }
    `;
  const data = await graphClient.request(tokensQuery);
  const tokenContractsAddresses = data.tokens.map((tkn: { id: string }) => tkn.id);
  // console.log({ tokenContractsAddresses });

  return await tokenContractsAddresses;
};

interface IFailedTrove {
  trove: string; // address
  error: Error;
}

class FailedTrove implements IFailedTrove {
  constructor(public trove: string, public error: Error) {
    this.trove = trove;
    this.error = error;
  }
}

const logger = setupLogger();

const liquidateTrove = async (trove: Trove, beur: ERC20, recipient: string): Promise<string | FailedTrove> => {
  const troveAddress = trove.address;
  try {
    const liqReward = await trove.liquidationReserve();
    let tx = await trove.liquidate();
    await tx.wait();
    tx = await beur.transferFrom(troveAddress, recipient, liqReward);
    await tx.wait();
    logger.info({troveAddress}, "Trove was liquidated");
    return troveAddress;
  } catch (error) {
    logger.error(error, "Error in trove liquidation");
    return new FailedTrove(troveAddress, error as Error);
  }
};

async function doTroveLiquidations(tokens: string[]) {
  const wallet = new Wallet(privateKey);
  const signer = wallet.connect(ethers.provider);
  const troveFactory = await ethers.getContractAt("OriginalTroveFactory", TROVE_FACTORY.address, signer) as TroveFactory;
  const beur = await ethers.getContractAt("ERC20", await troveFactory.stableCoin(), signer) as ERC20

  const toLiquidate: Trove[] = []
  for (const token of tokens) {
    let trove: Trove = await ethers.getContractAt("Trove", await troveFactory.firstTrove(token), signer);
    logger.info(`there are ${( await troveFactory.troveCount(token) ).toString()} troves for token ${token}`)
    let icr = await trove.collateralization()
    let mcr = await trove.mcr()
    while (icr.lt(mcr)) {
      if (icr.lt(mcr)) {
        logger.trace(`liquidating trove ${trove.address} with icr: ${icr.mul(100).div(DECIMAL_PRECISION)} and mcr: ${mcr.mul(100).div(DECIMAL_PRECISION)} `)
        toLiquidate.push(trove)
      } else {
        logger.trace(`*********** trove ${trove.address} with icr: ${icr.mul(100).div(DECIMAL_PRECISION)} and mcr: ${mcr.mul(100).div(DECIMAL_PRECISION)} `)
      }
      trove = await ethers.getContractAt("Trove", await troveFactory.nextTrove(token, trove.address), signer);
      mcr = await trove.mcr()
      icr = await trove.collateralization()
    }
    logger.trace(`stopped at trove ${trove.address} with icr: ${icr.mul(100).div(DECIMAL_PRECISION)} and mcr: ${mcr.mul(100).div(DECIMAL_PRECISION)} `)
  }

  logger.trace(`liquidating ${toLiquidate.length} troves`)
  for (const trove of toLiquidate) {
    if (!testRun) {
      await liquidateTrove(trove, beur, wallet.address)
    } else {
      logger.trace(`fake liquidating trove ${trove.address}`)
    }
  }
}

getTokens()
    .then((tokens) => {
      return doTroveLiquidations(tokens)
    })
    .catch(logger.error);
