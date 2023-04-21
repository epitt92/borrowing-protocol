import "hardhat-deploy";
import "@typechain/hardhat";
import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-etherscan";
import "@nomiclabs/hardhat-waffle";
import "solidity-docgen";
// import "hardhat-gas-reporter";

import dotenv from "dotenv";
import { ethereumRPC, mumbaiRPC, polygonRPC } from "./config";

dotenv.config({
  path: __dirname + "/.env"
});

const deployKey = process.env.DEPLOY_KEY;
const testTokenOwner1 = process.env.TEST_TOKEN_OWNER;
const proxyContractAdmin = "0x2a871d0798f97d79848a013d4936a73bf4cc922c825d33c1cf7073dff6d409c6";
const localChainId = +( process.env.LOCAL_CHAIN_ID || 31337 );

const hardhatTestAccounts = [
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
  "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d",
  "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a",
  "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6",
  "0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a",
  "0x8b3a350cf5c34c9194ca85829a2df0ec3153be0318b5e2d3348e872092edffba",
  "0x92db14e403b83dfe3df233f83dfa3a0d7096f21ca9b0d6d6b8d88b2b4ec1564e",
  "0x4bbbf85ce3377467afe5d46f804f221813b2bb87f24d81f60f1fcdbf7cbf4356",
  "0xdbda1821b80551c9d65939329250298aa3472ba22feea921c0cf5d620ea67b97",
  "0x2a871d0798f97d79848a013d4936a73bf4cc922c825d33c1cf7073dff6d409c6",
  "0xf214f2b2cd398c806f84e317254e0f0b801d0643303237d97a22a48e01628897",
  "0x701b615bbdfb9de65240bc28bd21bbc0d996645a3dd57e7b12bc2bdf6f192c82",
  "0xa267530f49f8280200edf313ee7af6b827f2a8bce2897751d06a843f644967b1",
  "0x47c99abed3324a2707c28affff1267e45918ec8c3f20b8aa892e8b065d2942dd",
  "0xc526ee95bf44d8fc405a158bb884d9d1238d99f0612e9f33d006bb0789009aaa",
  "0x8166f546bab6da521a8369cab06c5d2b9e46670292d85c875ee9ec20e84ffb61",
  "0xea6c44ac03bff858b476bba40716402b03e41b8e97e276d1baec7c37d42484a0",
  "0x689af8efa8c651a91ad287602527f3af2fe9f6501a7ac4b061667b5a93e037fd",
  "0xde9be858da4a475276426320d5e9262ecfc3ba460bfac56360bfa6c4c28b4ee0",
  "0xdf57089febbacf7ba0bc227dafbffa9fc08a93fdc68e1e42411a14efcf23656e",
];
/*
(0) 0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266 (10000 ETH)
(1) 0x70997970c51812dc3a010c7d01b50e0d17dc79c8 (10000 ETH)
(2) 0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc (10000 ETH)
(3) 0x90f79bf6eb2c4f870365e785982e1f101e93b906 (10000 ETH)
(4) 0x15d34aaf54267db7d7c367839aaf71a00a2c6a65 (10000 ETH)
(5) 0x9965507d1a55bcc2695c58ba16fb37d819b0a4dc (10000 ETH)
(6) 0x976ea74026e726554db657fa54763abd0c3a0aa9 (10000 ETH)
(7) 0x14dc79964da2c08b23698b3d3cc7ca32193d9955 (10000 ETH)
(8) 0x23618e81e3f5cdf7f54c3d65f7fbc0abf5b21e8f (10000 ETH)
(9) 0xa0ee7a142d267c1f36714e4a8f75612f20a79720 (10000 ETH)
*/
const anvilTestAccounts = [
    deployKey,
"0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
"0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d",
"0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a",
"0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6",
"0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a",
"0x8b3a350cf5c34c9194ca85829a2df0ec3153be0318b5e2d3348e872092edffba",
"0x92db14e403b83dfe3df233f83dfa3a0d7096f21ca9b0d6d6b8d88b2b4ec1564e",
"0x4bbbf85ce3377467afe5d46f804f221813b2bb87f24d81f60f1fcdbf7cbf4356",
"0xdbda1821b80551c9d65939329250298aa3472ba22feea921c0cf5d620ea67b97",
"0x2a871d0798f97d79848a013d4936a73bf4cc922c825d33c1cf7073dff6d409c6",
];
const ganacheAccounts = [
  "0x4f3edf983ac636a65a842ce7c78d9aa706d3b113bce9c46f30d7d21715b23b1d",
  "0x6cbed15c793ce57650b9877cf6fa156fbef513c4e6134f022a85b1ffdd59b2a1",
  "0x6370fd033278c143179d81c5526140625662b8daa446c22ee2d73db3707e620c",
  "0x646f1ce2fdad0e6deeeb5c7e8e5543bdde65e86029e2fd9fc169899c440a7913",
  "0xadd53f9a7e588d003326d1cbf9e4a43c061aadd9bc938c843a79e7b4fd2ad743",
  "0x395df67f0c2d2d9fe1ad08d1bc8b6627011959b79c53d7dd6a3536a33ab8a4fd",
  "0xe485d098507f54e7733a205420dfddbe58db035fa577fc294ebd14db90767a52",
  "0xa453611d9419d0e56f499079478fd72c37b251a94bfde4d19872c44cf65386e3",
  "0x829e924fdf021ba3dbbc4225edfece9aca04b929d6e75613329ca6f1d31c0bb4",
  "0xb0057716d5917badaf911b193b12b910811c1497b5bada8d7711f758981c3773",
  "0x77c5495fbb039eed474fc940f29955ed0531693cc9212911efd35dff0373153f",
  "0xd99b5b29e6da2528bf458b26237a6cf8655a3e3276c1cdc0de1f98cefee81c01",
  "0x9b9c613a36396172eab2d34d72331c8ca83a358781883a535d2941f66db07b24",
  "0x0874049f95d55fb76916262dc70571701b5c4cc5900c0691af75f1a8a52c8268",
  "0x21d7212f3b4e5332fd465877b64926e3532653e2798a11255a46f533852dfe46",
  "0x47b65307d0d654fd4f786b908c04af8fface7710fc998b37d219de19c39ee58c",
  "0x66109972a14d82dbdb6894e61f74708f26128814b3359b64f8b66565679f7299",
  "0x2eac15546def97adc6d69ca6e28eec831189baa2533e7910755d15403a0749e8",
  "0x2e114163041d2fb8d45f9251db259a68ee6bdbfd6d10fe1ae87c5c4bcd6ba491",
  "0xae9a2e131e9b359b198fa280de53ddbe2247730b881faae7af08e567e58915bd",
];
// noinspection JSValidateJSDoc
/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
  solidity: {
    compilers: [
      {
        version: "0.8.17",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200
          },
/*
          modelChecker: {
            divModNoSlacks: true,
            engine: "all",
            invariants: ["contract", "reentrancy"],
            showUnproved: false,
            solvers: ["z3"],
            targets: ["underflow", "overflow", "divByZero", "balance", "assert", "popEmptyArray", "outOfBounds"],
            timeout: 20000
          },
*/
          outputSelection: {
            "*": {
              "*": ["userdoc"],
              "": [
                "ast" // Enable the AST output of every single file.
              ]
            },
            // Enable the abi and opcodes output of MyContract defined in file def.
            def: {
              MyContract: ["abi", "evm.bytecode.opcodes"]
            }
          }
        }
      },
      {
        version: "0.6.6",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200
          }
        }
      },
      {
        version: "0.5.0",
        settings: {
          optimizer: {
            enabled: true,
            runs: 1000
          }
        }
      },
      {
        version: "0.6.0",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200
          }
        }
      },
      {
        version: "0.7.6",
        settings: {
          optimizer: {
            enabled: true,
            runs: 10
          }
        }
      }
    ]
  },
  networks: {
/*
    hardhat: {
      forking: {
        url: polygonRPC,
        blockNumber: 36054438,
      },
    },
*/
    mumbai: {
      url: mumbaiRPC,
      // url: "http://127.0.0.1:8545/",
      accounts: [deployKey, testTokenOwner1, proxyContractAdmin],
      chainId: 80001,
      gasPrice: 50000000000,
      saveDeployments: true
    },
    matic: {
      url: polygonRPC,
      accounts: anvilTestAccounts,
      chainId: 137,
      saveDeployments: true
    },
    "local-matic": {
      url: "http://127.0.0.1:8545/",
      accounts: anvilTestAccounts,
      chainId: 137,
      saveDeployments: true
    },
    localhost: {
      url: "http://127.0.0.1:8545/",
      accounts: [deployKey, testTokenOwner1, proxyContractAdmin],
      chainId: 137,
      saveDeployments: true
    },
    ganache: {
      url: "http://127.0.0.1:7545/",
      accounts: ganacheAccounts,
      chainId: 1337,
      saveDeployments: true
    },
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY,
  },
  namedAccounts: {
    deployer: {
      default: 0 // index of account in accounts array passed in networks
    },
    tokenOwner1: {
      "volta-test": 1,
      localhost: 1,
      hardhat: 1
    }
  },
  typechain: {
    outDir: "src/types",
    target: "ethers-v5",
    alwaysGenerateOverloads: false, // should overloads with full signatures like deposit(uint256) be generated always, even if there are no overloads?
    externalArtifacts: [
      "artifacts/@openzeppelin/contracts/token/ERC20/IERC20.sol/IERC20.json",
      "artifacts/@openzeppelin/contracts/token/ERC20/ERC20.sol/ERC20.json",
      "artifacts/@openzeppelin/contracts/access/Ownable.sol/Ownable.json",
      "artifacts/@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol/IERC20Metadata.json",
      "artifacts/@openzeppelin/contracts/utils/Context.sol/Context.json",
      "artifacts/@openzeppelin/contracts/utils/Context.sol/Context.json",
      "node_modules/@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol/TransparentUpgradeableProxy.json",
      "node_modules/@uniswap/v3-core/artifacts/contracts/UniswapV3Factory.sol/UniswapV3Factory.json"
    ] // optional array of glob patterns with external artifacts to process (for example external libs from node_modules)
  },
  paths: {
    deployments: "deployments_package/deployments",
    deploy: "deploy"
  },
  docgen: {output: "solcOutput"}
  // docgen: {
  //   path: './docs',
  //   clear: true,
  //   runOnCompile: true,
  // }
};
