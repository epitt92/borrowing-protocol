#!/bin/bash

# This is a workaround for a "feature" of nodejs, that changes uid/gid to folder owner when run as root: 
# https://docs.npmjs.com/cli/v8/using-npm/scripts#user
export XDG_CONFIG_HOME=./tmp/config
export XDG_CACHE_HOME=./tmp/cache
export XDG_STATE_HOME=./tmp/logs
export XDG_DATA_HOME=./tmp/data

chmod 777 ./tmp

npm install --legacy-peer-deps

npm run compile
npm run deploy:volta:test
npm run graph-test:merge:volta-test