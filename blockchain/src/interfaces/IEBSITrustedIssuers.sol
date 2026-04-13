// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

interface IEBSITrustedIssuers {
    // Returns whether the issuer accepts no attributes (i.e., is not a Trusted Issuer) 
    // and the total number of attributes registered for this issuer.
    function getIssuer(string memory did) external view returns (
        bool noAttributesAccepted, 
        uint256 totalAttributes
    );

    // Registers a new issuer with the given DID, issuer type, and associated data. 
    // The revisionId is used for versioning and can be set to 0 for the initial registration. 
    // The attributeIdTao is a unique identifier for the attribute in the context of the Trusted Issuer Registry.
    function setAttributeMetadata(
        string calldata did,
        bytes32 revisionId,
        uint8 issuerType,
        string calldata taoDid,
        bytes32 attributeIdTao
    ) external;
}