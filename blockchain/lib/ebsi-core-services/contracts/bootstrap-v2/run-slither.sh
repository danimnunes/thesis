#!/bin/sh

mkdir tmp
pnpm exec hardhat flatten > ./tmp/contracts.sol
slither ./tmp/contracts.sol
rm -r tmp
