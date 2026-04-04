#!/bin/sh

dependencies="$(pwd)/scripts/deployment/dependencies.json"
dependenciesUpdated="$(pwd)/scripts/deployment/updated_dependencies.json"


account=`pnpm exec hardhat accounts --network box | sed -n '2p'`
chainId=`curl -X POST --data '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":51}' http://192.168.55.5:8545 | jq ".result" | xargs printf "%d\n"`
# deploy proxy for TPR
output=`pnpm exec hardhat deploy --network box --tags OwnedUpgradeabilityProxy --reset`
tprProxy=`echo $output | grep -o '\b0x[a-fA-F0-9]\{40\}\b'`
pnpm exec hardhat initProxy --network box --proxy $tprProxy --implementation PolicyRegistryV3

# update dependencies
jq --arg chainId "$chainId" --arg tprProxy "$tprProxy" '.[$chainId] += {
  "tprV3Address": $tprProxy
}' $dependencies > $dependenciesUpdated

mv $dependenciesUpdated $dependencies


# deploy proxy for DIDRegistry
output=`pnpm exec hardhat deploy --network box --tags OwnedUpgradeabilityProxy --reset`
DIDRegistryProxy=`echo $output | grep -o '\b0x[a-fA-F0-9]\{40\}\b'`
pnpm exec hardhat initProxy --network box --proxy $DIDRegistryProxy --implementation DidRegistryV5

# update dependencies with did registry service
jq --arg chainId "$chainId" --arg DIDRegistryProxy "$DIDRegistryProxy" '.[$chainId] += {
  "didV5Address": $DIDRegistryProxy
}' $dependencies > $dependenciesUpdated

mv $dependenciesUpdated $dependencies

# deploy proxy for TimestampV4
output=`pnpm exec hardhat deploy --network box --tags OwnedUpgradeabilityProxy --reset`
timestampProxy=`echo $output | grep -o '\b0x[a-fA-F0-9]\{40\}\b'`
pnpm exec hardhat initProxy --network box --proxy $timestampProxy --implementation TimestampV4

# track and trace
output=`pnpm exec hardhat --network box trackAndTrace --admin  $account --upgrader $account --registry $DIDRegistryProxy --tpr $tprProxy`
TrackAndTraceProxy=`echo $output | grep -o '\b0x[a-fA-F0-9]\{40\}\b' | tail -1`

# deploy proxy for TIR V5
output=`pnpm exec hardhat deploy --network box --tags OwnedUpgradeabilityProxy --reset`
tirRegistry=`echo $output | grep -o '\b0x[a-fA-F0-9]\{40\}\b'`
pnpm exec hardhat initProxy --network box --proxy $tirRegistry --implementation TirV5

# deploy proxy for TSR V2
output=`pnpm exec hardhat deploy --network box --tags OwnedUpgradeabilityProxy --reset`
tsrRegistry=`echo $output | grep -o '\b0x[a-fA-F0-9]\{40\}\b'`
pnpm exec hardhat initProxy --network box --proxy $tsrRegistry --implementation SchemaSCRegistryV3


# generate operator wallets


# output
echo "DIDR_SC_V5_ADDRESS=$DIDRegistryProxy" >> deployments.env
echo "TIMESTAMP_SC_V4_ADDRESS=$timestampProxy" >> deployments.env
echo "TNT_SC_V1_ADDRESS=$TrackAndTraceProxy" >> deployments.env
echo "TIR_SC_V5_ADDRESS=$tirRegistry" >> deployments.env
echo "TPR_SC_V3_ADDRESS=$tprProxy" >> deployments.env
echo "TSR_SC_V3_ADDRESS=$tsrRegistry" >> deployments.env
