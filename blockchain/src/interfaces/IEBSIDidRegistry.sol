// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

interface IEBSIDidRegistry {
    /**
     * @notice Returns the DID Document associated with the given address.
     * If the address does not have a registered DID, the EBSI v5 returns an empty string.
     */
    function getDidDocument(string memory did) external view returns (
        string memory baseDocument,
        string[] memory controllers,
        string[] memory vMethodIds,
        bytes[] memory vMethods,
        bytes[] memory vRelationships
    );

    function insertDidDocument(
        string memory did,
        string memory baseDocument,
        string memory vMethodId,
        bytes memory publicKey,
        bool isSecp256k1,
        uint256 notBefore,
        uint256 notAfter
    ) external returns (bool);
}