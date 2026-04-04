// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.26;

import {IProxyFactory} from "@ebsiint-sc/trusted-contracts-registry-v1/contracts/interfaces/IProxyFactory.sol";

/**
 * @title IProxyDeployer
 * @author Deuss Team
 * @notice Interface for ProxyDeployer providing shared EBSI template configuration and proxy deployment
 */
interface IProxyDeployer {
    /**
     * @notice Template configuration data for EBSI deployments
     * @param name Template name
     * @param version Template version
     * @param isActive Whether this template config is active
     */
    struct TemplateConfig {
        string name;
        string version;
        bool isActive;
    }

    /// @notice Emitted when factory address is set
    event FactorySet(address indexed factory);

    /// @notice Emitted when registry address is set
    event RegistrySet(address indexed registry);

    /// @notice Emitted when a template config is added
    event TemplateConfigAdded(
        bytes32 indexed templateId,
        string name,
        string version
    );

    /// @notice Emitted when a template config is deactivated
    event TemplateConfigDeactivated(
        bytes32 indexed templateId,
        string name,
        string version
    );

    /// @notice Emitted when a proxy is deployed
    event ProxyDeployedViaTemplate(
        address indexed proxy,
        bytes32 indexed templateId,
        string name,
        string version,
        string issuerDID
    );

    /// @notice Emitted when issuer DID is set
    event DidSet(string did);

    /**
     * @notice Sets the proxy factory address
     * @param factory Address of the proxy factory
     * @dev If both factory and registry are set, validates they are wired together
     */
    function setFactory(address factory) external;

    /**
     * @notice Sets the template registry address
     * @param registry Address of the template registry
     * @dev If factory is already set, validates it is wired to this registry
     */
    function setRegistry(address registry) external;

    /**
     * @notice Adds a new template configuration
     * @param name Template name
     * @param version Template version
     * @return templateId The computed template ID
     */
    function addTemplateConfig(
        string calldata name,
        string calldata version
    ) external returns (bytes32 templateId);

    /**
     * @notice Deactivates a template configuration (soft delete)
     * @param templateId The template ID to deactivate
     */
    function deactivateTemplateConfig(bytes32 templateId) external;

    /**
     * @notice Returns the factory address
     */
    function getFactory() external view returns (address);

    /**
     * @notice Returns the registry address
     */
    function getRegistry() external view returns (address);

    /**
     * @notice Sets the issuer DID used when deploying proxies
     * @param did The issuer DID string
     */
    function setDid(string calldata did) external;

    /**
     * @notice Returns the configured issuer DID
     */
    function getDid() external view returns (string memory);

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
    ) external pure returns (bytes32 templateId);

    /**
     * @notice Returns a template configuration by ID
     * @param templateId The template ID
     */
    function getTemplateConfig(
        bytes32 templateId
    ) external view returns (TemplateConfig memory);

    /**
     * @notice Checks if a template is active
     * @param templateId The template ID
     */
    function isTemplateActive(bytes32 templateId) external view returns (bool);

    /**
     * @notice Queries the factory for deployment info
     * @param proxy The proxy address
     */
    function getDeploymentInfo(
        address proxy
    ) external view returns (IProxyFactory.DeploymentInfo memory);
}
