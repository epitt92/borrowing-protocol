# Test & Behaviour Driven Development of smart contracts

This is a demo repository of how to test smart contracts with Cucumber JS and Hardhat. It uses
[hardhat](https://hardhat.org) with
[Typescript](https://www.typescriptlang.org) and [Waffle](https://getwaffle.io) and
[Cucumber.js](https://github.com/cucumber/cucumber-js#cucumberjs)

## Building

In order to build after a successful `clone`:

- `npm install`
- `npm run compile`

After all the code has been generated you can check if it actually works:

- `npm run test`
- `npm run cuke`

## Deploying

### Only contracts

- Volta (testnet)
  - `npm run deploy:volta`
- Energy Web Chain (EWC)
  - `npm run deploy:ewc`

### Contracts + Subgraph + npm deployments_package

This can only be done automatically using pipelines. To trigger them we need run two commands on commit, that we want to deploy:

- `git tag vX.X.X`
- `git push origin vX.X.X`

Where `vX.X.X` its next tag version, that needs to be deployed. Note: if you specify previous or current tag version it wouldn't work.

## Developing

To run format your code with Prettier Linter:

- `npm run prettier:solidity`
- `npm run prettier:tests:typescript`

To test your solidity code with solhint or JS/TS with eslint:

- `npm run solhint`
- `npm run eslint:typescript`

To generate documentation

- `npx hardhat docgen`

## NPM Deployments Package

This repo produces organization scoped private npm package with all latest contracts deployments. This kind of packages need authentication to install. In order to authenticate you need to retrieve npm `access_token` from dev-ops team and update your project `.npmrc` file with auth variables. Refer to [this](https://docs.npmjs.com/using-private-packages-in-a-ci-cd-workflow#:~:text=for%20more%20details.-,Create%20and%20check%20in%20a%20project%2Dspecific%20.npmrc%20file,-Use%20a%20project) guide.

Also there is approach that allows us to add npm user account to org and login into npm via shell before installation. But better use access token approach.

Command to install this package:

```
npm i --save @bonq/borrowing_protocol_deployments
```

## Project structure

The project structure described here is the one you get once all dependecies have been installed and the contracts
have been compiled.

### artifacts

contains the result of the smart contract compilation. It will contain JSON files for all the contracts and their
dependencies.

### build

conatains the output of the Typescript compiler. These are the Javascript files which get executed.

### cache

Contains a single file which allows hardhat to keep track of compilation changes

### contracts

The solidity contracts under development

### features

The Gherkin files and the related step implementations

### reports

Output of the `cucumber-js` execution

### src

Generated typings of the smart contract interfaces. This is used in the tests to allow compile time checking of
parameter types.

### test

The Mocha tests to check the contract functionality

## Configuration

For the system to work as intended, some configuration is required

### Hardhat

Hardhat is configured in the `hardhat.config.ts` file. In order to allow `type-chain` to generate the `.d.ts` files
for the smart-contracts, the JSON files have to be listed here.

### Cucumber

Cucumber-js is configured in the `cucumber.cjs` file. As we're using the generated version of the `*.ts` files, we
need to tell cucumber where to find them.

### Typescript

The normal `tsconfig.json` file is used. The notable change is:

- "resolveJsonModule": true - in order to import the JSON definitions of the compiled smart-contracts

### Test addresses

| Account                                         | Private Key                                                        |
| ----------------------------------------------- | ------------------------------------------------------------------ |
| #0: 0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266  | 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 |
| #1: 0x70997970c51812dc3a010c7d01b50e0d17dc79c8  | 0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d |
| #2: 0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc  | 0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a |
| #3: 0x90f79bf6eb2c4f870365e785982e1f101e93b906  | 0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6 |
| #4: 0x15d34aaf54267db7d7c367839aaf71a00a2c6a65  | 0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a |
| #5: 0x9965507d1a55bcc2695c58ba16fb37d819b0a4dc  | 0x8b3a350cf5c34c9194ca85829a2df0ec3153be0318b5e2d3348e872092edffba |
| #6: 0x976ea74026e726554db657fa54763abd0c3a0aa9  | 0x92db14e403b83dfe3df233f83dfa3a0d7096f21ca9b0d6d6b8d88b2b4ec1564e |
| #7: 0x14dc79964da2c08b23698b3d3cc7ca32193d9955  | 0x4bbbf85ce3377467afe5d46f804f221813b2bb87f24d81f60f1fcdbf7cbf4356 |
| #8: 0x23618e81e3f5cdf7f54c3d65f7fbc0abf5b21e8f  | 0xdbda1821b80551c9d65939329250298aa3472ba22feea921c0cf5d620ea67b97 |
| #9: 0xa0ee7a142d267c1f36714e4a8f75612f20a79720  | 0x2a871d0798f97d79848a013d4936a73bf4cc922c825d33c1cf7073dff6d409c6 |
| #10: 0xbcd4042de499d14e55001ccbb24a551f3b954096 | 0xf214f2b2cd398c806f84e317254e0f0b801d0643303237d97a22a48e01628897 |
| #11: 0x71be63f3384f5fb98995898a86b02fb2426c5788 | 0x701b615bbdfb9de65240bc28bd21bbc0d996645a3dd57e7b12bc2bdf6f192c82 |
| #12: 0xfabb0ac9d68b0b445fb7357272ff202c5651694a | 0xa267530f49f8280200edf313ee7af6b827f2a8bce2897751d06a843f644967b1 |
| #13: 0x1cbd3b2770909d4e10f157cabc84c7264073c9ec | 0x47c99abed3324a2707c28affff1267e45918ec8c3f20b8aa892e8b065d2942dd |
| #14: 0xdf3e18d64bc6a983f673ab319ccae4f1a57c7097 | 0xc526ee95bf44d8fc405a158bb884d9d1238d99f0612e9f33d006bb0789009aaa |
| #15: 0xcd3b766ccdd6ae721141f452c550ca635964ce71 | 0x8166f546bab6da521a8369cab06c5d2b9e46670292d85c875ee9ec20e84ffb61 |
| #16: 0x2546bcd3c84621e976d8185a91a922ae77ecec30 | 0xea6c44ac03bff858b476bba40716402b03e41b8e97e276d1baec7c37d42484a0 |
| #17: 0xbda5747bfd65f08deb54cb465eb87d40e51b197e | 0x689af8efa8c651a91ad287602527f3af2fe9f6501a7ac4b061667b5a93e037fd |
| #18: 0xdd2fd4581271e230360230f9337d5c0430bf44c0 | 0xde9be858da4a475276426320d5e9262ecfc3ba460bfac56360bfa6c4c28b4ee0 |
| #19: 0x8626f6940e2eb28930efb4cef49b2d1f2c9c1199 | 0xdf57089febbacf7ba0bc227dafbffa9fc08a93fdc68e1e42411a14efcf23656e |

### Uniswap contracts addresses

| Contract                                      | Address                                    |
| --------------------------------------------- | ------------------------------------------ |
| WETH9                                         | 0x1b489C60833C663F07f71bd255e6e46587B7404e |
| v3 Core Factory                               | 0x2A2F7125B64d543481468E8d34FD38Ca2DBFb198 |
| multicall 2                                   | 0x7b27F450810A7ed824407F1e4fD5b2cEe78AFE0e |
| proxy admin                                   | 0xf1D1502351Ce78a632b4a4E0590Ff83e3D1C5cAf |
| tick lens                                     | 0xCEfF7084B692f5e2f1cd487bD71ef8A4EF7c2397 |
| nft descriptor library V1_3_0                 | 0x59329bbA0e6b11b4545909995Adf452080CD04Eb |
| non fungible token position descriptor V1_3_0 | 0x8882a05CA9A0Ff895a0086aa47f99213caFE6ce9 |
| descriptor proxy                              | 0xD055C593eC991CdAE08937B68D148FB3F5a27537 |
| non fungible token position manager           | 0x3B2ED89F1B2181E434d16CEBD9c8bbfFb3499766 |
| v3 migrator                                   | 0xC3ab6Fd75DF59805530A627cdEc8d79FeA519aB9 |
| v3 staker                                     | 0xa0d279d6965a8A63E8a0bd9419068A5E3314B065 |
| quoter V2                                     | 0x46a257f05bf4b436F8dd33b55bec70833402613E |
| swap router 02                                | 0xD423D5d631ED1F2c46D55634C090F32cEb55DcC8 |

To redeploy all of the contracts clone [this](https://github.com/Uniswap/deploy-v3) repo. Go to created dir and install all of the packages with yarn.

After that run:

```
yarn start -- --help
```

For an `--owner` param you should pass address of a contract. For current deployment I've used `trove factory` contract as an owner, not sure this is correct.

This will show all of the required and optional parameters. You will need to pass them in this way:

```
yarn start -- <parameters>
```

To redeploy WETH9 contract got to `borrowing-protocol` dir and use this command:

```
npx hardhat run scripts/deploy-weth9.js --network volta
```

## Simulation

To run the simulation you need to run:

1. `docker-compose up --build graph-node-reader` in the graph-node-reader repo.
2. `docker-compose -f docker-compose.simulation.yml build` in this repo
3. `docker-compose -f docker-compose.simulation.yml run runner bash`
4. `./docker/runner.sh` in the runner container
5. `Ctrl+C` to stop the sleep.
6. `npm run cucumber` to run the simulation.
