// SPDX-License-Identifier: EUPL V1.2

pragma solidity ^0.8.26;

import "./interfaces/IProxyTemplateRegistry.sol";
import "./interfaces/IDidRegistry.sol";
import "./interfaces/IProxyFactory.sol";
import "./interfaces/IPolicyRegistry.sol";
import "@openzeppelin/contracts/proxy/beacon/BeaconProxy.sol";
import "@openzeppelin/contracts/proxy/beacon/IBeacon.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";
import "./libraries/Pagination.sol";

contract ProxyFactory is
    IProxyFactory,
    Initializable,
    AccessControlUpgradeable,
    UUPSUpgradeable
{
    using Address for address;
    using Pagination for address[];

    // Policy names for EBSI ecosystem
    string public constant DEPLOY_PROXY_POLICY = "TCR:deployProxy";

    // Custom modifier to check authorization
    modifier isAuthorized(string calldata deployerDID) {
        require(
            policyRegistry.checkPolicy(DEPLOY_PROXY_POLICY, msg.sender),
            "Not authorized: missing policy"
        );
        if (bytes(deployerDID).length == 0) {
            require(
                deployments[msg.sender].isActive,
                "Not authorized: contract is not active"
            );
        } else {
            require(
                didRegistry.checkController(bytes(deployerDID), msg.sender),
                "Not authorized: missing DID authorization"
            );
        }
        _;
    }

    IProxyTemplateRegistry public templateRegistry;
    IDidRegistry public didRegistry;
    IPolicyRegistry public policyRegistry;

    // Mapping from deployed contract address to deployment info
    mapping(address => DeploymentInfo) private deployments;
    address[] private deployedContracts;
    mapping(string => address[]) private didToProxies;

    // Events are defined in IProxyFactory interface

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        address _templateRegistry,
        address _didRegistry,
        address _policyRegistry
    ) public initializer {
        __AccessControl_init();
        require(
            _templateRegistry != address(0),
            "Template registry cannot be zero"
        );
        require(_didRegistry != address(0), "DID registry cannot be zero");
        templateRegistry = IProxyTemplateRegistry(_templateRegistry);
        didRegistry = IDidRegistry(_didRegistry);
        policyRegistry = IPolicyRegistry(_policyRegistry);

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    function deployProxy(
        string calldata templateName,
        string calldata templateVersion,
        bytes calldata initData,
        string calldata deployerDID
    ) external override isAuthorized(deployerDID) returns (address) {
        require(bytes(templateName).length > 0, "Template name required");
        require(bytes(templateVersion).length > 0, "Template version required");

        bytes32 templateId = templateRegistry.computeTemplateId(
            templateName,
            templateVersion
        );
        IProxyTemplateRegistry.ProxyTemplate memory template = templateRegistry
            .getTemplate(templateId);
        require(template.beaconAddress != address(0), "Template not found");
        require(template.isActive, "Template not active");

        // Prepare initialization data with proper function selector
        bytes memory finalInitData = initData;
        if (initData.length >= 4) {
            // Check if initData already has a function selector (first 4 bytes)
            bytes4 dataSelector = bytes4(initData[:4]);
            if (dataSelector != template.initSelector) {
                // Prepend the template's initSelector to the initData
                finalInitData = abi.encodePacked(
                    template.initSelector,
                    initData
                );
            }
        } else {
            // initData is too short, prepend the template's initSelector
            finalInitData = abi.encodePacked(template.initSelector, initData);
        }

        BeaconProxy proxy = new BeaconProxy(
            template.beaconAddress,
            finalInitData
        );
        address proxyAddress = address(proxy);

        string memory deployerDIDorParent = deployerDID;
        if (bytes(deployerDID).length == 0) {
            deployerDIDorParent = deployments[msg.sender].deployerDID;
        }
        deployments[proxyAddress] = DeploymentInfo({
            templateId: templateId,
            deployer: msg.sender,
            deploymentTimestamp: block.timestamp,
            isActive: true,
            deployerDID: deployerDIDorParent
        });

        deployedContracts.push(proxyAddress);
        didToProxies[deployerDIDorParent].push(proxyAddress);

        emit ProxyDeployed(
            proxyAddress,
            templateId,
            msg.sender,
            deployerDIDorParent,
            initData,
            block.timestamp
        );
        return proxyAddress;
    }

    function getDeploymentInfo(
        address contractAddress
    ) external view override returns (DeploymentInfo memory) {
        return deployments[contractAddress];
    }

    function getDeployedContracts(
        uint256 page,
        uint256 pageSize
    )
        external
        view
        returns (
            address[] memory items,
            uint256 total,
            uint256 howMany,
            uint256 prev,
            uint256 next
        )
    {
        require(pageSize <= 50, "PSize not <= 50");
        require(pageSize > 0, "PSize not >0");
        require(page > 0, "Page not >0");
        return deployedContracts.paginate(page, pageSize);
    }

    function getDeployedContractsCount()
        external
        view
        override
        returns (uint256)
    {
        return deployedContracts.length;
    }

    function isContractDeployed(
        address contractAddress
    ) external view override returns (bool) {
        return deployments[contractAddress].deployer != address(0);
    }

    function getProxiesByDID(
        string calldata deployerDID
    ) external view override returns (address[] memory) {
        return didToProxies[deployerDID];
    }

    function getContractsByTemplate(
        bytes32 templateId
    ) external view returns (address[] memory) {
        uint256 count = 0;
        address[] memory temp = new address[](deployedContracts.length);

        for (uint256 i = 0; i < deployedContracts.length; i++) {
            if (deployments[deployedContracts[i]].templateId == templateId) {
                temp[count] = deployedContracts[i];
                count++;
            }
        }

        address[] memory result = new address[](count);
        for (uint256 i = 0; i < count; i++) {
            result[i] = temp[i];
        }

        return result;
    }

    // Getters for private variables
    function getDeployment(
        address contractAddress
    ) external view returns (DeploymentInfo memory) {
        return deployments[contractAddress];
    }

    function getProxiesByDIDCount(
        string calldata deployerDID
    ) external view returns (uint256) {
        return didToProxies[deployerDID].length;
    }

    function getProxiesByDIDAtIndex(
        string calldata deployerDID,
        uint256 index
    ) external view returns (address) {
        require(
            index < didToProxies[deployerDID].length,
            "Index out of bounds"
        );
        return didToProxies[deployerDID][index];
    }

    // Note: Logic contracts ownership is managed by EBSI Governance
    // This contract only manages proxy deployments and upgrades

    function _authorizeUpgrade(
        address newImplementation
    ) internal override onlyRole(DEFAULT_ADMIN_ROLE) {}
}
