#!/bin/bash -e

npm install --legacy-peer-deps

npm run compile
npm run solhint
npm run eslint:typescript
npm run test
npx graph codegen
npm run test:subgraph