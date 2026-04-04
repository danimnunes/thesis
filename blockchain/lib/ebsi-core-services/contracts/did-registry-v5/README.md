# DID Registry Smart Contract v5

![Logo of the project](https://ec.europa.eu/digital-building-blocks/wikis/images/logo/default-space-logo.svg)

> Smart contract registry.

## Table of Contents

1. [Getting started](#Getting)
2. [Building](#Building)
3. [Deployment](#Deployment)
4. [Testing](#Testing)
5. [Licensing](#Licensing)

## Getting started

### Prerequisites

- [Node.js](https://nodejs.org/en/download/)

### Installing

Install dependencies:

```sh
pnpm install
```

## Building

Compile the smart contracts:

```sh
pnpm run compile
```

To verify the accounts that will be used by hardhat

```sh
pnpm exec hardhat accounts
```

## Deployment

To deploy the smart contracts on a network defined in the `hardhat.config.ts`

```sh
pnpm exec hardhat run --network <your-network> scripts/deployment.ts
```

Note that by default smart contracts will be deployed locally using hardhat development node.

## Testing

### Requirements:

- node 14.15 (use nvm)

### Launch all tests

```sh
pnpm run test
```

if you experience some timeout issues try running tests one by one

## Licensing

Copyright (c) 2019 European Commission  
Licensed under the EUPL, Version 1.2 or - as soon they will be approved by the European Commission - subsequent versions of the EUPL (the "Licence");
You may not use this work except in compliance with the Licence.
You may obtain a copy of the Licence at:

- https://joinup.ec.europa.eu/page/eupl-text-11-12

Unless required by applicable law or agreed to in writing, software distributed under the Licence is distributed on an "AS IS" basis, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the Licence for the specific language governing permissions and limitations under the Licence.
