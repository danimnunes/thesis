---
"@ebsiint-sc/admin-scripts": minor
---

Add deployment tasks and tooling for Trusted Contracts Registry

**New Features:**

- Added `trustedContractsRegistry` task to deploy ProxyTemplateRegistry and ProxyFactory contracts
- Added `trustedContractsRegistryUpgrade` task to upgrade deployed contracts
- Added `addTemplate` task to register contract templates with auto-deployment support for test beacons
- Added Solidity 0.8.26 compiler support to both hardhat configs
- Integrated trusted-contracts-registry-v1 into prepare-contracts script

**Documentation:**

- Added comprehensive deployment guide in README.md
- Documented all task parameters and usage examples
- Added information about where deployed addresses are stored (settings files)
- Included production and testing deployment workflows

**Settings Storage:**

- Deployed contract addresses saved to `settings/<network>/trusted-contracts-registry.json`
- Template information (beacon, implementation, templateId) automatically persisted
