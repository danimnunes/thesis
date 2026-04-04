// SPDX-License-Identifier: EUPL V1.2

pragma solidity ^0.8.26;

interface IProxyTemplateRegistry {
    struct ProxyTemplate {
        string name;
        string version;
        address beaconAddress; // Points to logic contract
        string repoURI; // Source code repo
        string auditURI; // Link to audit report
        bytes32 contractHash; // keccak256 of bytecode
        bytes4 initSelector; // Function selector for `initialize(...)`
        bytes32 storageLayoutHash; // For ensuring proxy compatibility
        bool isActive;
    }

    event TemplateAdded(
        bytes32 indexed templateId,
        string name,
        string version
    );
    event TemplateDeprecated(bytes32 indexed templateId);
    event TemplateUpdated(bytes32 indexed templateId);

    function addTemplate(ProxyTemplate calldata newTemplate) external;
    function deprecateTemplate(bytes32 templateId) external;
    function updateTemplateMetadata(
        bytes32 templateId,
        string calldata repoURI,
        string calldata auditURI
    ) external;

    function getTemplate(
        bytes32 templateId
    ) external view returns (ProxyTemplate memory);
    function computeTemplateId(
        string calldata name,
        string calldata version
    ) external pure returns (bytes32);
}
