// SPDX-License-Identifier: EUPL V1.2

pragma solidity ^0.8.26;

interface IProxyFactory {
    struct DeploymentInfo {
        bytes32 templateId;
        address deployer;
        uint256 deploymentTimestamp;
        bool isActive;
        string deployerDID;
    }

    // Emitted on every deployment for logging & observability
    event ProxyDeployed(
        address indexed proxyAddress,
        bytes32 indexed templateId,
        address indexed deployer,
        string deployerDID,
        bytes initData,
        uint256 timestamp
    );

    function deployProxy(
        string calldata templateName,
        string calldata templateVersion,
        bytes calldata initData,
        string calldata deployerDID
    ) external returns (address);

    function getProxiesByDID(
        string calldata deployerDID
    ) external view returns (address[] memory);

    function getDeploymentInfo(
        address contractAddress
    ) external view returns (DeploymentInfo memory);
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
        );
    function getDeployedContractsCount() external view returns (uint256);
    function isContractDeployed(
        address contractAddress
    ) external view returns (bool);
}
