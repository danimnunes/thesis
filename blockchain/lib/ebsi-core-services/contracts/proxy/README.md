![Logo of the project](https://ec.europa.eu/digital-building-blocks/wikis/images/logo/default-space-logo.svg)

# Proxy Smart Contract

> Proxy Smart Contract to enable smart contract upgradability

## Table of Contents

1. [Getting started](#Getting)
2. [Building](#Building)
3. [Deploying](#Deploying)
4. [Testing](#Testing)
5. [Design](#Design)
6. [Licensing](#Licensing)
7. [Version](#Version)

## Getting started

### Prerequisites

- [Node.js](https://nodejs.org/en/download/)

### Installing

Install dependencies:

```sh
pnpm install
```

## Building

Build the smart contracts:

```sh
pnpm run build
```

## Deploying

Deploy the smart contracts on the ebsi network
you have specified in the .secret.privatekeys file containing a list of hex encoded private key separated by a return carriage to sign the besu transaction
they should be in this order:
1- proxyAdmin
2- pauser1
3- pauser2

```sh
npx truffle migrate --network ebsi --reset
```

## Testing

### Requirements:

- node 12 (use nvm)

### Launch all tests

```sh
pnpm run test
```

### test change proxy ownership

- launch ganache with the seed you have specified in the .secret.mnemonic file

```sh
npx ganache-cli -m "myth like bonus scare over problem client lizard pioneer submit female collect"
```

- deploy the smart contracts

```sh
npx truffle migrate  --compile-all  --reset
```

Note at the end of the migration script the `ProxyAddress` this will be needed in the next step

- change the proxy admin (e.g. change to Pauser n°1 address)

```sh
node migrations/helpers/changeProxyOwnership.js {proxy SC address} {new proxy admin address}
...
--Transfer Ownership from 0x9bba2ad7178e0e2731db6caf45f80dd4efbdfcd1 to 0x22d491Bde2303f2f43325b2108D26f1eAbA1e32b
...
```

## Change implementation

You can setup a first implementation at the proxy initialization when calling `initialize(implementationAddress,proxyAdminAddress, encodedInitializeFunction)`
It takes three arguments:

- Implementation address
- proxy Admin address who can access the proxy admin function
- an encoded initialize function call of the implementation (optional can be 0 length)

Once the proxy deployed with an actual implementation it is possible to update the implementation address with these two functions (only accessible by the proxy admin)

- `upgradeTo(address newImplementation) ` which upgrade the backing implementation of the proxy. `newImplementation` is the address of the new implementation.
- `upgradeToAndCall(address newImplementation, bytes calldata data)` which upgrade the backing implementation of the proxy and call a function on the new implementation. This is useful to initialize the proxied contract. `newImplementation` is the address of the new implementation. `Data` is data to send as msg.data in the low level call. It should include the signature and the parameters of the function to be called, as described in https://solidity.readthedocs.io/en/v0.4.24/abi-spec.html#function-selector-and-argument-encoding.

```sh
node migrations/helpers/changeProxyImplementation.js {proxy SC address} {new implementation address}
...
--Transfer Implementation from 0x6a7157c287f07b8c5B635Aa661D0FF466d1327Bc to 0x3a452867204D691c3ee4db21A1C72F6765a96Bf8
...
```

## Design

We are using a proxy contract to be able to deploy a new version at the same address.
The address will remain the proxy address whereas the implementation address where calls that are not made by the proxy admin are delegated will be stored in the proxy storage along with proxy admin address.
We use a new solidity feature available since [0.6.4](https://github.com/ethereum/solidity/releases/tag/v0.6.4) that makes it possible to set storage slots for storage reference variables from inline assembly. This novelty is at the heart of the [diamond storage](https://dev.to/mudgen/what-is-diamond-storage-3n7c).
We also leverage OpenZeppelin base class updated to solidity v0.6.12 to take care of the base functionalities like

- admin
- initialize
- owner
- role
- pause

We added a storage contract (see TirStorage.sol) that leverages the storage reference variables from inline assembly. We can then use this contract to get a `struct` that stores all the information about Tir. This will be stored at the proxy contract storage slot and can be retrieved by any smart contract. The data can be retrieved without the need to take extra cautious steps like required when using the unstructured storage pattern.

## Licensing

Copyright (c) 2019 European Commission  
Licensed under the EUPL, Version 1.2 or - as soon they will be approved by the European Commission - subsequent versions of the EUPL (the "Licence");
You may not use this work except in compliance with the Licence.
You may obtain a copy of the Licence at:

- https://joinup.ec.europa.eu/page/eupl-text-11-12

Unless required by applicable law or agreed to in writing, software distributed under the Licence is distributed on an "AS IS" basis, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the Licence for the specific language governing permissions and limitations under the Licence.
