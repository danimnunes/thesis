# EBSI Core Services Contract Factory

This specification defines a new on-chain component for EBSI Core Services: a Contract Factory system that enables authorised issuers to deploy smart contract instances through a secure, auditable, and governance-compliant process.

## Overview

The factory leverages the **Beacon Proxy pattern**, implemented using Solidity (v0.8.26+), built on open standards from OpenZeppelin, and fully compatible with the Hyperledger Besu Ethereum client.

This approach balances flexibility and control—allowing use cases (such as DEUSS for tokenization) to autonomously deploy smart contracts while maintaining the governance, auditability, and security guarantees expected within the EBSI framework.

## Architecture

The Contract Factory system consists of four main components:

### 1. ProxyTemplateRegistry

- **Purpose**: Manages contract templates with metadata, audit information, and versioning
- **Key Features**:
  - Template registration and management
  - Version control and deprecation
  - Audit trail and repository links
  - Access control for template management

### 2. ProxyFactory

- **Purpose**: Deploys contract instances using the Beacon Proxy pattern
- **Key Features**:
  - Beacon proxy deployment
  - Deployment tracking and audit
  - Contract upgrade management
  - Role-based access control

### 3. UpgradeableBeacon

- **Purpose**: Implements the beacon pattern for upgradeable contracts
- **Key Features**:
  - Implementation pointer management
  - Upgrade functionality
  - Access control for upgrades

### 4. ContractFactoryManager

- **Purpose**: High-level interface for managing the entire factory system
- **Key Features**:
  - Template creation workflow
  - Beacon deployment automation
  - Contract instance deployment
  - System orchestration

## Beacon Proxy Pattern

The system uses the Beacon Proxy pattern, which provides several advantages:

- **Efficient Upgrades**: All proxy instances can be upgraded by updating a single beacon
- **Gas Optimization**: Reduces deployment costs for multiple instances
- **Consistency**: Ensures all instances use the same implementation
- **Security**: Centralized upgrade control with proper access management

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   BeaconProxy   │────│ UpgradeableBeacon│────│ Implementation  │
│   (Instance 1)  │    │                  │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                       │                       │
         │                       │                       │
┌─────────────────┐              │                       │
│   BeaconProxy   │──────────────┘                       │
│   (Instance 2)  │                                      │
└─────────────────┘                                      │
         │                                               │
         │                                               │
┌─────────────────┐                                      │
│   BeaconProxy   │──────────────────────────────────────┘
│   (Instance N)  │
└─────────────────┘
```

## Key Features

### Security & Governance

- **Role-based Access Control**: Granular permissions for different operations
- **Audit Trail**: Complete tracking of all deployments and upgrades
- **Template Validation**: Comprehensive validation of template parameters
- **Upgrade Control**: Centralized upgrade management through beacons

### Flexibility & Scalability

- **Template System**: Reusable contract templates with versioning
- **Multiple Instances**: Deploy unlimited instances from the same template
- **Upgradeable**: Easy implementation updates across all instances
- **Gas Efficient**: Optimized deployment and upgrade processes

### Compliance & Audit

- **Repository Links**: Direct links to source code repositories
- **Audit Reports**: Links to security audit reports
- **Deployment Tracking**: Complete audit trail of all deployments
- **Version History**: Full version control and deprecation support

## Usage Workflow

### 1. Template Creation

```solidity
// Create a new template
await factoryManager.createTemplate(
    "MyContract",
    "1.0.0",
    logicContractAddress,
    "https://github.com/example/contract",
    "https://audit.example.com/report",
    initSelector
);
```

### 2. Contract Deployment

```solidity
// Deploy a contract instance
const deployedAddress = await factoryManager.deployContractInstance(
    templateId,
    initData,
    deploymentId
);
```

### 3. Contract Upgrade

```solidity
// Upgrade all instances of a template
await factoryManager.upgradeTemplateImplementation(
    templateId,
    newLogicAddress
);
```

## Deployment

### Prerequisites

- Node.js 18+
- Hardhat
- OpenZeppelin contracts v5.4.0+

### Quick Start

```bash
# Install dependencies
npm install

# Compile contracts
pnpm exec hardhat compile

# Deploy the system
pnpm exec hardhat run scripts/deploy-factory.ts --network localhost
```

### Deployment Order

1. **ProxyTemplateRegistry** - Template management
2. **ProxyFactory** - Contract deployment
3. **ContractFactoryManager** - System orchestration
4. **SampleImplementation** - Example contract
5. **Role Setup** - Configure permissions
6. **Template Creation** - Register contract templates
7. **Instance Deployment** - Deploy contract instances

## Access Control

The system implements a hierarchical role-based access control system:

- **DEFAULT_ADMIN_ROLE**: System administration and role management
- **TEMPLATE_MANAGER_ROLE**: Template creation and management
- **TEMPLATE_DEPLOYER_ROLE**: Contract deployment
- **UPGRADER_ROLE**: Contract upgrades
- **SYSTEM_ADMIN_ROLE**: High-level system management
- **TEMPLATE_CREATOR_ROLE**: Template creation workflow

## Events & Monitoring

The system emits comprehensive events for monitoring and audit:

- `TemplateAdded`: New template registration
- `TemplateDeprecated`: Template deprecation
- `TemplateUpdated`: Template metadata updates
- `ContractDeployed`: New contract deployment
- `ContractUpgraded`: Contract implementation upgrade
- `TemplateCreated`: Template creation workflow
- `BeaconDeployed`: Beacon contract deployment
- `ImplementationUpgraded`: Beacon implementation upgrade

## Security Considerations

### Access Control

- All critical functions are protected by role-based access control
- Admin functions require specific roles
- Template management is restricted to authorized users

### Validation

- Comprehensive input validation for all parameters
- Address validation and contract existence checks
- Template uniqueness enforcement

### Upgrade Safety

- Beacon upgrade control through dedicated roles
- Implementation validation before upgrades
- Rollback capability through beacon management

## Testing

### Unit Tests

```bash
npm run test:unit
```

### Coverage

```bash
npm run coverage
```

### Integration Tests

```bash
npm run test:integration
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

## License

This project is licensed under the EUPL V1.2 License - see the [LICENSE.txt](LICENSE.txt) file for details.

## Support

For questions and support, please contact the EBSI Core Services team or create an issue in the repository.

## Roadmap

- [ ] Advanced template validation
- [ ] Multi-chain deployment support
- [ ] Automated security scanning
- [ ] Governance proposal system
- [ ] Performance optimization
- [ ] Additional proxy patterns support
