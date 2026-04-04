// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.26;

import {AddressExtensions} from "../libs/AddressExtensions.sol";
import {Errors} from "../libs/Errors.sol";
import {IProxyDeployer} from "../deployer/IProxyDeployer.sol";
import {OwnableRolesExtension} from "../utils/OwnableRolesExtension.sol";

// EBSI interfaces
import {IProxyFactory} from "@ebsiint-sc/trusted-contracts-registry-v1/contracts/interfaces/IProxyFactory.sol";
import {IProxyTemplateRegistry} from "@ebsiint-sc/trusted-contracts-registry-v1/contracts/interfaces/IProxyTemplateRegistry.sol";

interface IProxyFactoryTemplateRegistry {
    function templateRegistry() external view returns (IProxyTemplateRegistry);
}

/**
 * @title ProxyDeployer
 * @author Deuss Team
 * @notice Abstract helper providing shared EBSI template configuration and proxy deployment
 * @dev Supports multiple template configurations with event-based discovery (no unbounded loops)
 */
abstract contract ProxyDeployer is IProxyDeployer, OwnableRolesExtension {
    using AddressExtensions for address;

    /// @notice Shared EBSI proxy factory for all deployments
    address internal _templateFactory;

    /// @notice Shared EBSI template registry for all deployments
    address internal _templateRegistry;

    /// @notice Shared issuer DID used for proxy deployments authorization/tracking
    string internal _did;

    /// @notice Mapping of templateId => template configuration
    // slither-disable-next-line uninitialized-state
    mapping(bytes32 templateId => TemplateConfig config)
        internal _templateConfigs;

    /**
     * @notice Sets the proxy factory address
     * @param factory Address of the proxy factory
     * @dev If both factory and registry are set, validates they are wired together
     */
    function setFactory(address factory) external onlyOwner {
        factory.assertAddressNotZero();

        _templateFactory = factory;
        emit FactorySet(factory);

        // If registry is already set, verify factory is wired to it
        if (_templateRegistry != address(0)) {
            address factoryRegistry = address(
                IProxyFactoryTemplateRegistry(factory).templateRegistry()
            );
            if (factoryRegistry != _templateRegistry) {
                revert Errors.ProxyDeployer__InvalidRegistry(
                    _templateRegistry,
                    factoryRegistry
                );
            }
        }
    }

    /**
     * @notice Sets the template registry address
     * @param registry Address of the template registry
     * @dev If factory is already set, validates it is wired to this registry
     */
    function setRegistry(address registry) external onlyOwner {
        registry.assertAddressNotZero();

        _templateRegistry = registry;
        emit RegistrySet(registry);

        // If factory is already set, verify it is wired to the provided registry
        if (_templateFactory != address(0)) {
            address factoryRegistry = address(
                IProxyFactoryTemplateRegistry(_templateFactory)
                    .templateRegistry()
            );
            if (factoryRegistry != registry) {
                revert Errors.ProxyDeployer__InvalidRegistry(
                    registry,
                    factoryRegistry
                );
            }
        }
    }

    /**
     * @notice Adds a new template configuration
     * @param name Template name
     * @param version Template version
     * @return templateId The computed template ID
     */
    function addTemplateConfig(
        string calldata name,
        string calldata version
    ) public onlyOwner returns (bytes32 templateId) {
        // Validate inputs
        if (bytes(name).length == 0) revert Errors.EmptyString();
        if (bytes(version).length == 0) revert Errors.EmptyString();

        // Compute template ID (will revert if registry not set)
        templateId = IProxyTemplateRegistry(_templateRegistry)
            .computeTemplateId(name, version);

        // Check if already exists and active
        if (_templateConfigs[templateId].isActive) {
            revert Errors.ProxyDeployer__TemplateAlreadyExists(name, version);
        }

        // Verify template exists and is active in the registry
        IProxyTemplateRegistry.ProxyTemplate
            memory template_ = IProxyTemplateRegistry(_templateRegistry)
                .getTemplate(templateId);
        if (!template_.isActive) {
            revert Errors.ProxyDeployer__TemplateNotActive(name, version);
        }

        // Store template config
        _templateConfigs[templateId] = TemplateConfig({
            name: name,
            version: version,
            isActive: true
        });

        emit TemplateConfigAdded(templateId, name, version);
    }

    /**
     * @notice Deactivates a template configuration (soft delete)
     * @param templateId The template ID to deactivate
     */
    function deactivateTemplateConfig(bytes32 templateId) external onlyOwner {
        TemplateConfig storage config = _templateConfigs[templateId];
        if (!config.isActive)
            revert Errors.ProxyDeployer__TemplateNotFound(templateId);

        config.isActive = false;

        emit TemplateConfigDeactivated(templateId, config.name, config.version);
    }

    /**
     * @notice Returns the factory address
     */
    function getFactory() external view returns (address) {
        return _templateFactory;
    }

    /**
     * @notice Returns the registry address
     */
    function getRegistry() external view returns (address) {
        return _templateRegistry;
    }

    /**
     * @notice Sets the issuer DID used when deploying proxies
     * @param did The issuer DID string (must be non-empty)
     */
    function setDid(string calldata did) external onlyOwner {
        if (bytes(did).length == 0) revert Errors.EmptyString();
        _did = did;
        emit DidSet(did);
    }

    /**
     * @notice Computes the template ID for a given name and version
     * @param name Template name
     * @param version Template version
     * @return templateId The computed template ID (keccak256 hash)
     * @dev Uses the same algorithm as EBSI ProxyTemplateRegistry
     */
    function computeTemplateId(
        string calldata name,
        string calldata version
    ) external pure returns (bytes32 templateId) {
        return keccak256(abi.encode(name, version));
    }

    /**
     * @notice Returns a template configuration by ID
     * @param templateId The template ID
     */
    function getTemplateConfig(
        bytes32 templateId
    ) external view returns (TemplateConfig memory) {
        TemplateConfig memory config = _templateConfigs[templateId];
        if (!config.isActive) {
            revert Errors.ProxyDeployer__TemplateNotFound(templateId);
        }
        return config;
    }

    /**
     * @notice Checks if a template is active
     * @param templateId The template ID
     */
    function isTemplateActive(bytes32 templateId) external view returns (bool) {
        return _templateConfigs[templateId].isActive;
    }

    /**
     * @notice Queries the factory for deployment info
     * @param proxy The proxy address
     */
    function getDeploymentInfo(
        address proxy
    ) external view returns (IProxyFactory.DeploymentInfo memory) {
        if (_templateFactory == address(0)) revert Errors.ZeroAddress();
        return IProxyFactory(_templateFactory).getDeploymentInfo(proxy);
    }

    /**
     * @notice Returns the configured issuer DID
     */
    function getDid() external view returns (string memory) {
        return _did;
    }

    /**
     * @notice Deploys a new proxy via the configured factory using a specific template
     * @param templateId The template ID to use for deployment
     * @param initData ABI-encoded initialization selector and arguments
     * @return proxy The address of the deployed proxy
     */
    function _deployProxy(
        bytes32 templateId,
        bytes memory initData
    ) internal returns (address proxy) {
        TemplateConfig memory config = _templateConfigs[templateId];
        if (!config.isActive)
            revert Errors.ProxyDeployer__TemplateNotFound(templateId);

        string memory did = _did; // @dev it can be empty string if `msg.sender` has `TRUSTED_ISSUER_ROLE` in EBSI ProxyFactory
        proxy = IProxyFactory(_templateFactory).deployProxy(
            config.name,
            config.version,
            initData,
            did
        );

        emit ProxyDeployedViaTemplate(
            proxy,
            templateId,
            config.name,
            config.version,
            did
        );
    }
}
