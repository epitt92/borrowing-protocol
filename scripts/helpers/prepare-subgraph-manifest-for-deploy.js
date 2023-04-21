const { readFileSync, writeFileSync } = require("fs");

const commandLineArgs = require("command-line-args");
const path = require("path");
const yaml = require("js-yaml");

const cliOptionDefinitions = [
  { name: "network", type: String },
  { name: "start-block", type: Number }
];

const args = commandLineArgs(cliOptionDefinitions);

const networkArgToNetwork = {
  "mumbai-test": "mumbai",
  mumbai: "mumbai",
  docker: "mainnet",
  matic: "matic",
  localhost: "mainnet"
};
const uupsContractsConfig = {
  TroveFactory: {
    abiDeploymentName: "OriginalTroveFactoryImplementation",
    proxyDeploymentName: "OriginalTroveFactoryProxy"
  },
  BONQStaking: {
    abiDeploymentName: "BONQStakingImplementation",
    proxyDeploymentName: "BONQStakingProxy"
  },
  StabilityPool: {
    abiDeploymentName: "StabilityPoolUniswapImplementation",
    proxyDeploymentName: "StabilityPoolUniswapProxy"
  }
};

async function main() {
  const networkArg = args.network || "localhost";
  const network = networkArgToNetwork[networkArg] || "localhost";
  let blockNumber = args["start-block"];
  console.log("Using network: %s", network);
  if (blockNumber) {
    console.warn("Specifying block number in non test deployments may cause issues.");
  }

  const manifestPath = path.resolve(process.cwd(), "subgraph.yaml");
  const deploymentsPath = path.resolve(process.cwd(), "deployments_package/deployments");
  const subgraphManifest = yaml.load(readFileSync(manifestPath));
  subgraphManifest.dataSources = subgraphManifest.dataSources.map((dataSource) => {
    const uupsConfig = uupsContractsConfig[dataSource.name];
    if (uupsConfig) {
      const abiDeploymentPath = path.resolve(deploymentsPath, networkArg, `${uupsConfig.abiDeploymentName}.json`);
      const proxyDeploymentPath = path.resolve(deploymentsPath, networkArg, `${uupsConfig.proxyDeploymentName}.json`);
      const abiDeployment = JSON.parse(readFileSync(abiDeploymentPath));
      const proxyDeployment = JSON.parse(readFileSync(proxyDeploymentPath));
      if (!abiDeployment) throw new Error(`There is no abi deployment with ${uupsConfig.abiDeploymentName}.json name`);
      if (!proxyDeployment)
        throw new Error(`There is no proxy deployment with ${uupsConfig.proxyDeploymentName}.json name`);
      dataSource.source.address = proxyDeployment.address;
      dataSource.source.startBlock = blockNumber || abiDeployment.receipt.blockNumber;
      dataSource.network = network;
      return dataSource;
    }
    const deploymentPath = path.resolve(deploymentsPath, networkArg, `${dataSource.name}.json`);
    try {
      const deployment = JSON.parse(readFileSync(deploymentPath));
      if (!deployment) throw new Error(`There is no deployment with ${dataSource.name}.json name`);
      dataSource.source.address = deployment.address;
      dataSource.source.startBlock = blockNumber || deployment.receipt.blockNumber;
      blockNumber = dataSource.source.startBlock
    } catch (error) {
      console.log(`no deployment for ${dataSource.name}`)
      dataSource.source.startBlock = blockNumber;
    }
    dataSource.network = network;
    return dataSource;
  });
  writeFileSync(manifestPath, yaml.dump(subgraphManifest));
  console.log("Finished✅\n");
}

main()
  .then(() => process.exit(0))
  .catch(async (error) => {
    console.error(error);
    process.exit(1);
  });
