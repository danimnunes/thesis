![EBSI Logo](https://ec.europa.eu/digital-building-blocks/wikis/images/logo/default-space-logo.svg)

# Admin scripts for smart contract

> Smart contract utility scripts.

## Prerequisites

Copy `.env.example` file to `.env` and configure the necessary settings.

## Compiling

Compile the smart contracts:

```sh
pnpm exec nx compile @ebsiint-sc/admin-scripts
```

This will take all the latest solidity source code from smart contracts projects (workspace packages under `@ebsiint-sc/` namespace) and create an output `src` folder with all the information related to the smart contracts:

- `abi`
- `artifacts`
- `types`

## Running tasks

Tasks which are run through npm scripts (defined within `package.json`) can be run through `nx` as documented in [SC docs](../../docs/Contracts.md). The compile task mentioned in the previous section is a perfect example.

In order to run non-npm tasks for tool within the project and not part of `package.json` scripts, change directory to the current project and run commands directly without `nx` prefix.

To verify the accounts that will be used by hardhat:

```sh
pnpm exec hardhat accounts
```

To verify the chainId that will be used by hardhat:

```sh
pnpm exec hardhat --network pilot chainId
```

To get the latest block number on the specified network:

```sh
pnpm exec hardhat --network pilot blockNumber
```

To get some information about a transaction:

```sh
pnpm exec hardhat --network pilot tx --hash 0xd0f11a38650c987063b689b5384ae17e6506fbd179e50e47a84111695331302ds
```

List all available tasks:

```sh
pnpm exec hardhat
```

## Deployment

To deploy the smart contracts on a network defined in the `hardhat.config.ts` use the `--tag` option to specify the deployment script that you want to run. The tag is exported at the end of the deployment file e.g. `func.tags = ["Timestamp"];`

Note that by default smart contracts will be deployed locally using hardhat development node.

Deployment scripts are located in the `scripts/deployment` folder

```sh
pnpm exec hardhat --network ebsi deploy --tags OwnedUpgradeabilityProxy --gasprice 0
```

Running a deployment script will add information about deployment like the smart contract addresses per network inside the `deployments` folder.

If you want to deploy again the smart contract add the `--reset` option.

### Bootstrap network

Here we present how to deploy the different contracts in test env. For pilot or conformance change `--network` param.

**Trusted Policies Registry**

First deploy the proxy

```sh
pnpm exec hardhat --network test deploy --tags OwnedUpgradeabilityProxy --gasprice 0 --reset
```

Copy the address of the proxy and use it to deploy the implementation:

```sh
pnpm exec hardhat --network test initProxy --proxy PROXY_ADDRESS_TPR --implementation PolicyRegistryV3
```

Grant the role operator to some addresses. This operator will have the right to insert data (policies and users) in this registry (see the [CLI bootstrap script](https://gitlab.com/europeum/public/cli/-/tree/main/src/scripts/bootstrap)):

```sh
pnpm exec hardhat --network test grantRole --proxy PROXY_ADDRESS_TPR --operator OPERATOR_ADDRESS
```

Change the admin to the multisig wallet

```sh
pnpm exec hardhat --network test changeOwnership --proxy PROXY_ADDRESS_TPR
```

Update the `scripts/deployment/dependencies.ts` with the new proxy address. This address will be linked in the deployment of the other contracts.

**DID Registry**

Follow a similar process like the previous contract to deploy the DID Registry (expect the grantRole, which doesn't apply here):

```sh
pnpm exec hardhat --network test deploy --tags OwnedUpgradeabilityProxy --gasprice 0 --reset
pnpm exec hardhat --network test initProxy --proxy PROXY_ADDRESS_DIDR --implementation DidRegistryV5
pnpm exec hardhat --network test changeOwnership --proxy PROXY_ADDRESS_DIDR
```

Update the `scripts/deployment/dependencies.ts` with the new proxy address. This address will be linked in the deployment of Trusted Apps Registry and Trusted Issuers Registry.

**Trusted Issuers Registry**

Deploy proxy and implementation for Trusted Issuers Registry, and change the admin to the multisig wallet:

```sh
pnpm exec hardhat --network test deploy --tags OwnedUpgradeabilityProxy --gasprice 0 --reset
pnpm exec hardhat --network test initProxy --proxy PROXY_ADDRESS_TIR --implementation TirV5
pnpm exec hardhat --network test changeOwnership --proxy PROXY_ADDRESS_TIR
```

**Trusted Apps Registry**

Deploy proxy and implementation for Trusted Apps Registry, and change the admin to the multisig wallet:

```sh
pnpm exec hardhat --network test deploy --tags OwnedUpgradeabilityProxy --gasprice 0 --reset
pnpm exec hardhat --network test initProxy --proxy PROXY_ADDRESS_TAR --implementation TarV3
pnpm exec hardhat --network test changeOwnership --proxy PROXY_ADDRESS_TAR
```

**Trusted Schemas Registry**

Deploy proxy and implementation for Trusted Schemas Registry, and change the admin to the multisig wallet:

```sh
pnpm exec hardhat --network test deploy --tags OwnedUpgradeabilityProxy --gasprice 0 --reset
pnpm exec hardhat --network test initProxy --proxy PROXY_ADDRESS_TSR --implementation SchemaSCRegistryV3
pnpm exec hardhat --network test changeOwnership --proxy PROXY_ADDRESS_TSR
```

**Timestamp**

Deploy proxy and implementation for Timestamp, and change the admin to the multisig wallet:

```sh
pnpm exec hardhat --network test deploy --tags OwnedUpgradeabilityProxy --gasprice 0 --reset
pnpm exec hardhat --network test initProxy --proxy PROXY_ADDRESS_TIMESTAMP --implementation TimestampV4
pnpm exec hardhat --network test changeOwnership --proxy PROXY_ADDRESS_TIMESTAMP
```

**Trusted Contracts Registry**

The Trusted Contracts Registry consists of two contracts: ProxyTemplateRegistry and ProxyFactory. These contracts manage the deployment and lifecycle of trusted smart contract proxies.

Deploy both contracts using the dedicated task:

```sh
pnpm exec hardhat --network test trustedContractsRegistry \
  --didregistry <DID_REGISTRY_ADDRESS> \
  --policyregistry <POLICY_REGISTRY_ADDRESS>
```

Example:

```sh
pnpm exec hardhat --network test trustedContractsRegistry \
  --didregistry 0x26E603f6FdCfC007c7bdC5be5f2c91D2a64a32E7 \
  --policyregistry 0x3d5edA0b5183e245bA9713B58834525EDfE46E90
```

This will deploy:

1. **ProxyTemplateRegistry** - Manages contract templates (beacons, versions, metadata)
2. **ProxyFactory** - Deploys proxy instances from templates

**Finding Deployed Addresses**

After deployment, addresses are saved in:

```
contracts/admin-scripts/settings/<network>/trusted-contracts-registry.json
```

Example file content:

```json
{
  "proxyTemplateRegistryAddress": "0x123...",
  "proxyFactoryAddress": "0x456...",
  "didRegistryAddress": "0x789...",
  "policyRegistryAddress": "0xabc..."
}
```

**Adding a Template**

After deploying the Trusted Contracts Registry, you need to add contract templates to the ProxyTemplateRegistry. Templates define which contracts can be deployed through the ProxyFactory.

**Basic Usage (Auto-deploy Mock Contracts)**

For testing, the simplest approach is to let the task deploy mock contracts automatically:

```sh
pnpm exec hardhat --network test addTemplate \
  --registry <PROXY_TEMPLATE_REGISTRY_ADDRESS> \
  --name "MyContract" \
  --templateversion "1.0.0"
```

This will:

1. Deploy a `SampleImplementation` contract
2. Deploy a `SampleUpgradeableBeacon` pointing to the implementation
3. Register the template in the ProxyTemplateRegistry
4. Save all addresses to the settings file

**Production Usage (With Existing Beacon)**

For production deployments, provide your own beacon address:

```sh
pnpm exec hardhat --network test addTemplate \
  --registry <PROXY_TEMPLATE_REGISTRY_ADDRESS> \
  --name "MyContract" \
  --templateversion "1.0.0" \
  --beacon <YOUR_BEACON_ADDRESS> \
  --repouri "https://github.com/your-org/contract" \
  --audituri "https://audit.com/report"
```

**Advanced Usage (Deploy Beacon Only)**

If you have an existing implementation but need a new beacon:

```sh
pnpm exec hardhat --network test addTemplate \
  --registry <PROXY_TEMPLATE_REGISTRY_ADDRESS> \
  --name "MyContract" \
  --templateversion "1.0.0" \
  --implementation <YOUR_IMPLEMENTATION_ADDRESS> \
  --repouri "https://github.com/your-org/contract" \
  --audituri "https://audit.com/report"
```

**Command Parameters**

Required:

- `--registry`: Address of the ProxyTemplateRegistry contract
- `--name`: Name of the template (e.g., "MyContract", "TokenContract")
- `--templateversion`: Version of the template (e.g., "1.0.0", "2.1.0")

Optional:

- `--beacon`: Address of existing UpgradeableBeacon (if not provided, deploys SampleUpgradeableBeacon)
- `--implementation`: Address of existing implementation contract (only used if beacon not provided)
- `--repouri`: Repository URI for source code (default: "https://github.com/example/repo")
- `--audituri`: Audit report URI (default: "https://audit.example.com/report")
- `--suffix`: Deployment suffix for settings file (default: "EBSI")

**Example: Complete Production Deployment**

```sh
# Deploy your implementation contract first
# Then deploy your beacon pointing to the implementation
# Then add the template:

pnpm exec hardhat --network test addTemplate \
  --registry 0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512 \
  --name "TokenContract" \
  --templateversion "1.0.0" \
  --beacon 0x1234567890123456789012345678901234567890 \
  --repouri "https://github.com/my-org/token-contract" \
  --audituri "https://audits.example.com/token-contract-v1.0.0.pdf"
```

**Where Template Data is Stored**

Template information is saved to:

```
contracts/admin-scripts/settings/<network>/trusted-contracts-registry.json
```

The settings file will include:

```json
{
  "proxyTemplateRegistryAddress": "0x...",
  "proxyFactoryAddress": "0x...",
  "beacon_MyContract_1.0.0": "0x...",
  "implementation_MyContract_1.0.0": "0x...",
  "templateId_MyContract_1.0.0": "0x..."
}
```

**Template Components**

Each template includes:

- **Name & Version**: Unique identifier for the template
- **Beacon Address**: Points to the implementation contract
- **Repository URI**: Link to source code
- **Audit URI**: Link to security audit report
- **Contract Hash**: keccak256 hash of the bytecode
- **Init Selector**: Function selector for the initialize function
- **Storage Layout Hash**: Ensures proxy compatibility
- **Active Status**: Whether the template can be used for new deployments

**Next Steps**

After adding a template, you can deploy proxy instances using the ProxyFactory:

- Users with TRUSTED_ISSUER_ROLE can deploy proxies
- Or users whose DID is authorized in the Policy Registry can deploy proxies
- Proxies are deployed using the `deployProxy` function with the template name and version

**Updating Existing Deployments**

After deployment, you may need to update the configuration of existing contracts (e.g., updating registry addresses):

Update Policy Registry for ProxyTemplateRegistry:

```sh
pnpm exec hardhat --network test updateTrustedContractsRegistry \
  --contract templateRegistry \
  --action setPolicyRegistry \
  --address <NEW_POLICY_REGISTRY_ADDRESS>
```

**Note:** The updated addresses are automatically saved to the settings file.

**Upgrading Contracts**

To upgrade the ProxyTemplateRegistry:

```sh
pnpm exec hardhat --network test trustedContractsRegistryUpgrade \
  --contract templateRegistry
```

To upgrade the ProxyFactory:

```sh
pnpm exec hardhat --network test trustedContractsRegistryUpgrade \
  --contract factory
```

### Other Deployments

To deploy the smart contract without upgrade-ability use the deploy script with the contract deployment tag.

```sh
pnpm exec hardhat --network pilot deploy --tags <TAG>  --gasprice 0 --reset
```

To deploy an new implementation use `changeImplementation`:

```sh
pnpm exec hardhat --network pilot changeImplementation --proxy PROXY_ADDRESS --implementation TAG
```

## Scripts

you can run scripts with the following command `hardhat --network <networkName> run <script>`.
Scripts are located in the `scripts` folder.

e.g.

```sh
pnpm exec hardhat --network local run ./scripts/proxy/changeOwnership.ts
```

### Insert Administrator Appendix

           | App Name              	| Deployment Tag   	| Contract ABI artifact                             	|
           :-----:|:-----:|:-----:
           | TrustedIssuersRegistry | Tir              	| contracts/trusted-issuers-registry-ethereum-sc/contracts/tir/Tir.sol:Tir                            	|

### Insert App Hash Algo

Add the default hash algorithms to Timestamp:

```
pnpm exec hardhat --network localWithData addHashAlgo --proxy PROXY_ADDRESS --contract CONTRACT
```

Deploy/upgrade/ upgrade with reinitialize new TrackAndTrace

```
pnpm exec hardhat --network <test|pilot|prod|conformance> trackAndTrace --admin  <address|0x28774ee74a79e27af87f4a7668542be43e2f742b> --upgrader <address|0x28774ee74a79e27af87f4a7668542be43e2f742b> --registry <address|0x76C8190D7422e5fa2A0190Bc2313bab0b2afEC78> --tpr <address|0x61b6AD18C74C2158445F524E9f868Da13Aba8E2F>
pnpm exec hardhat trackAndTraceUpgrade --network <test|pilot|prod|conformance>
pnpm exec hardhat --network <test|pilot|prod|conformance> trackAndTrace --admin  <address|0x28774ee74a79e27af87f4a7668542be43e2f742b> --upgrader <address|0x28774ee74a79e27af87f4a7668542be43e2f742b> --registry <address|0x76C8190D7422e5fa2A0190Bc2313bab0b2afEC78> --tpr <address|0x61b6AD18C74C2158445F524E9f868Da13Aba8E2F>
```

###

Deploy new TrustedSchemaRegistryV3

```
pnpm exec hardhat --network <test|pilot|prod|conformance> trustedSchemaRegistryV3 --upgrader <address of admin> --tpr <address of tpr>
```

Deploy new TrustedIssuersRegistryV4

```
pnpm exec hardhat --network <test|pilot|prod|conformance> trustedIssuersRegistryV4 --upgrader <address of admin> --tpr <address of tpr> --did <address of did registry>
```

# Hardhat console

Hardhat comes built-in with an interactive JavaScript console. You can use it by running pnpm exec hardhat console. Anything that has been injected into the Hardhat Runtime Environment will be available in the global scope.

Hardhat's console supports await top-level await (i.e. `console.log(await web3.eth.getBalance()`).

you can also launch it on a specific network

```sh
pnpm exec hardhat --network local console
```

## Licensing

Copyright (c) 2019 European Commission  
Licensed under the EUPL, Version 1.2 or - as soon they will be approved by the European Commission - subsequent versions of the EUPL (the "Licence");
You may not use this work except in compliance with the Licence.
You may obtain a copy of the Licence at:

- https://joinup.ec.europa.eu/page/eupl-text-11-12

Unless required by applicable law or agreed to in writing, software distributed under the Licence is distributed on an "AS IS" basis, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the Licence for the specific language governing permissions and limitations under the Licence.
