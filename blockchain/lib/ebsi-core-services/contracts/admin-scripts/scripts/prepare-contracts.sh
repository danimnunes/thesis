#!/bin/sh

SCRIPT_DIR="$( cd -- "$(dirname "$0")" >/dev/null 2>&1 ; pwd -P )"

# echo $'\n'Cleaning up contracts/ folder

# rm -rf ${SCRIPT_DIR}/../contracts

echo Consolidating smart contracts

rm -rf ${SCRIPT_DIR}/../contracts
rm -rf ${SCRIPT_DIR}/../src
mkdir ${SCRIPT_DIR}/../contracts

echo Copy the bootstrap-v2 smart contract
cp -r ${SCRIPT_DIR}/../../bootstrap-v2/contracts ${SCRIPT_DIR}/../contracts/bootstrap-v2

echo Copy the did-registry-v5 smart contract
cp -r ${SCRIPT_DIR}/../../did-registry-v5/contracts ${SCRIPT_DIR}/../contracts/did-registry-v5

echo Copy the proxy smart contract
cp -r ${SCRIPT_DIR}/../../proxy/contracts ${SCRIPT_DIR}/../contracts/proxy

echo Copy the timestamp-v4 smart contract
cp -r ${SCRIPT_DIR}/../../timestamp-v4/contracts ${SCRIPT_DIR}/../contracts/timestamp-v4

echo Copy the trusted-issuers-registry-v5 smart contract
cp -r ${SCRIPT_DIR}/../../trusted-issuers-registry-v5/contracts ${SCRIPT_DIR}/../contracts/trusted-issuers-registry-v5

echo Copy the trusted-policies-registry-v3 smart contract
cp -r ${SCRIPT_DIR}/../../trusted-policies-registry-v3/contracts ${SCRIPT_DIR}/../contracts/trusted-policies-registry-v3

echo Copy the trusted-schemas-registry-v3 smart contract
cp -r ${SCRIPT_DIR}/../../trusted-schemas-registry-v3/contracts ${SCRIPT_DIR}/../contracts/trusted-schemas-registry-v3

echo Copy the track-and-trace smart contract
cp -r ${SCRIPT_DIR}/../../track-and-trace/contracts ${SCRIPT_DIR}/../contracts/track-and-trace

echo Copy the trusted-contracts-registry-v1 smart contract
cp -r ${SCRIPT_DIR}/../../trusted-contracts-registry-v1/contracts ${SCRIPT_DIR}/../contracts/trusted-contracts-registry-v1

echo Copy the beacon-proxy smart contract
cp -r ${SCRIPT_DIR}/../../beacon-proxy/contracts ${SCRIPT_DIR}/../contracts/beacon-proxy
