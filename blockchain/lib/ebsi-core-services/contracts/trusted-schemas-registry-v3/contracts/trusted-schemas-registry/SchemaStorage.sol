// SPDX-License-Identifier: EUPL V1.2
pragma solidity ^0.8.26;

contract SchemaStorage {
    // The state variables we care about.
    bytes32 public constant SCHEMA_DIAMOND_STORAGE_POSITION = keccak256(
        "diamond.standard.schema.storage"
    );

    struct Schemas {
        uint256 _version;
        // An ordered list of registered schema IDs
        bytes[] schemaIds;
        // Schema ID to Schema Revisions ID
        mapping(bytes => bytes32[]) schemaIdToRevisionIds;
        // Schema ID + RevisionId to MetadataIDs
        mapping(bytes => mapping(bytes32 => bytes32[])) schemaIdRevisionIdToMetadataIds;
        // Schema Revision Store
        // key is SHA2-256 hash of the given schema revision
        // value is serialized and encoded
        mapping(bytes32 => bytes) schemaRevisionStore;
        // Schema Metadata Store
        // key is SHA2-256 hash of the given schema metadata
        // value is serialized and encoded
        mapping(bytes32 => bytes) revisionMetadataStore;
    }

    // Creates and returns the storage pointer to the struct.
    function schemaStorage() internal pure returns (Schemas storage ms) {
        bytes32 position = SCHEMA_DIAMOND_STORAGE_POSITION;
        assembly {
            ms.slot := position
        }
    }

    // Reserved storage space to allow for layout changes in the future.
    uint256[50] private __gap;
}
