#!/bin/bash -eux
set -o pipefail

source .env

export GITHUB_TAG=$1
export NODE_AUTH_TOKEN=$2
export DEPLOY_Key=$3

function timestamp() {
  echo '['$(date +%T)']'
}

cd /app

rm -rf node_modules simulation

echo $(timestamp)' Making sure packages are installed.'
npm install

echo $(timestamp)' Compiling and deploying the chain'
npm run compile
npm run deploy:volta
npm run deploy:volta:test

echo $(timestamp)' Setting version for package'
cd ./deployments_package &&
  npm version ${GITHUB_TAG}
cd ..

echo $(timestamp)' Preparing graph'
npm run prepare:manifest
npx graph codegen
npm run graph:create:dev

echo $(timestamp)' Deploying graph to dev'
echo ${GITHUB_TAG} | npm run graph:deploy:dev:version

echo $(timestamp)' Deploying subgraph to dev'
npm run prepare:manifest -- --network volta-test
npm run graph:create:dev:test
npm run graph:deploy:dev:test
cp constants.ts ./deployments_package/constants.ts

echo $(timestamp)' Publishing to registry'
cd ./deployments_package &&
  npm run build &&
  npm publish
