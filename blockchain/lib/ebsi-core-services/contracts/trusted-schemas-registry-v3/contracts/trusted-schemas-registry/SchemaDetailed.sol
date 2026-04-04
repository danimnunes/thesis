// SPDX-License-Identifier: EUPL V1.2
// solhint-disable max-line-length

pragma solidity ^0.8.26;

import "./SchemaStorage.sol";
import "./SchemaLib.sol";
import "@ebsiint-sc/trusted-policies-registry-v3/contracts/trusted-policies-registry/interfaces/IPolicyRegistry.sol";
import "@ebsiint-sc/bootstrap-v2/contracts/utils/Pagination.sol";

abstract contract SchemaDetailed is SchemaStorage {
    using SchemaLib for Schemas;
    using Pagination for uint256;

    event SchemaInserted(
        bytes indexed schemaIdHash,
        bytes schemaId,
        bytes schema,
        bytes32 schemaRevisionId,
        bytes metadata,
        bytes32 metadataId
    );

    event SchemaUpdated(
        bytes indexed schemaIdHash,
        bytes schemaId,
        bytes schema,
        bytes32 schemaRevisionId,
        bytes metadata,
        bytes32 metadataId
    );

    event MetadataUpdated(
        bytes indexed schemaIdHash,
        bytes schemaId,
        bytes32 schemaRevisionId,
        bytes metadata,
        bytes32 metadataId
    );

    /**
     * @dev insertSchema enables to register new schema.
     */
    function insertSchema(
        bytes calldata schemaId,
        bytes calldata schema,
        bytes calldata metadata
    ) external returns (bytes32 schemaRevisionId) {
        require(
            getTrustedPolicyRegistry().checkPolicy(
                "TSR:insertSchema",
                msg.sender
            ),
            "Policy error: sender doesn't have the attribute TSR:insertSchema"
        );
        Schemas storage ss = schemaStorage();
        schemaRevisionId = ss.insertSchema(schemaId, schema, metadata);
    }

    /**
     * @dev getSchemaIds returns a paginated list of registered schema ids.
     */
    function getSchemaIds(
        uint256 page,
        uint256 pageSize
    )
        external
        view
        returns (
            bytes[] memory items,
            uint256 total,
            uint256 howMany,
            uint256 prev,
            uint256 next
        )
    {
        require(pageSize <= 50, "PageSize must be <= 50");
        require(pageSize > 0, "PageSize must be > 0");
        require(page > 0, "Page must be > 0");
        Schemas storage ss = schemaStorage();
        uint256[] memory ids;
        (ids, total, howMany, prev, next) = ss.schemaIds.length.paginate(
            page,
            pageSize
        );
        items = new bytes[](howMany);
        for (uint256 i = 0; i < howMany; i++) {
            items[i] = ss.schemaIds[ids[i]];
        }
    }

    /**
     * @dev updateSchema enables to update the existing schema.
     */
    function updateSchema(
        bytes calldata schemaId,
        bytes calldata schema,
        bytes calldata metadata
    ) external returns (bytes32 schemaRevisionId) {
        require(
            getTrustedPolicyRegistry().checkPolicy(
                "TSR:updateSchema",
                msg.sender
            ),
            "Policy error: sender doesn't have the attribute TSR:updateSchema"
        );
        Schemas storage ss = schemaStorage();
        schemaRevisionId = ss.updateSchema(schemaId, schema, metadata);
    }

    /**
     * @dev updateMetadata enables to update the existing metadata.
     */
    function updateMetadata(
        bytes calldata schemaId,
        bytes32 schemaRevisionId,
        bytes calldata metadata
    ) external returns (bytes32 metadataId) {
        require(
            getTrustedPolicyRegistry().checkPolicy(
                "TSR:updateMetadata",
                msg.sender
            ),
            "Policy error: sender doesn't have the attribute TSR:updateMetadata"
        );
        Schemas storage ss = schemaStorage();
        metadataId = ss.updateMetadata(schemaId, schemaRevisionId, metadata);
    }

    /**
     * @dev getLatestSchemaRevision returns the latest schema revision by schema id.
     */
    function getLatestSchemaRevision(
        bytes calldata schemaId
    ) external view returns (bytes memory schema) {
        Schemas storage ss = schemaStorage();
        schema = ss.getLatestSchemaRevision(schemaId);
    }

    /**
     * @dev getSchemaRevisionIds returns a paginated list of schema revision ids for the given schema id.
     */
    function getSchemaRevisionIds(
        bytes calldata schemaId,
        uint256 page,
        uint256 pageSize
    )
        external
        view
        returns (
            bytes32[] memory items,
            uint256 total,
            uint256 howMany,
            uint256 prev,
            uint256 next
        )
    {
        require(schemaId.length > 0, "schemaId empty");
        require(pageSize <= 50, "PageSize must be <= 50");
        require(pageSize > 0, "PageSize must be > 0");
        require(page > 0, "Page must be > 0");
        Schemas storage ss = schemaStorage();
        require(
            ss.schemaIdToRevisionIds[schemaId].length > 0,
            "schema not found"
        );
        uint256[] memory ids;
        (ids, total, howMany, prev, next) = ss
            .schemaIdToRevisionIds[schemaId]
            .length
            .paginate(page, pageSize);
        items = new bytes32[](howMany);
        for (uint256 i = 0; i < howMany; i++) {
            items[i] = ss.schemaIdToRevisionIds[schemaId][ids[i]];
        }
    }

    /**
     * @dev getSchemaRevision returns a specific schema revision for a specific SchemaRevisionId.
     */
    function getSchemaRevision(
        bytes calldata schemaId,
        bytes32 schemaRevisionId
    ) external view returns (bytes memory schema) {
        Schemas storage ss = schemaStorage();
        schema = ss.getSchemaRevision(schemaId, schemaRevisionId);
    }

    /**
     * @dev getLatestSchemaRevisionMetadataByRevisionId returns schema revision metadata for the given schema revision id.
     */
    function getLatestSchemaRevisionMetadataByRevisionId(
        bytes calldata schemaId,
        bytes32 schemaRevisionId
    ) external view returns (bytes memory metadata) {
        Schemas storage ss = schemaStorage();
        metadata = ss.getLatestSchemaRevisionMetadataByRevisionId(
            schemaId,
            schemaRevisionId
        );
    }

    /**
     * @dev getSchemaRevisionMetadataIds returns a paginated list of schema revision metadata ids, for a specific SchemaRevisionId
     */
    function getSchemaRevisionMetadataIds(
        bytes calldata schemaId,
        bytes32 schemaRevisionId,
        uint256 page,
        uint256 pageSize
    )
        external
        view
        returns (
            bytes32[] memory items,
            uint256 total,
            uint256 howMany,
            uint256 prev,
            uint256 next
        )
    {
        require(schemaRevisionId != bytes32(0), "SchemaRevisionId empty");
        require(pageSize <= 50, "PageSize must be <= 50");
        require(pageSize > 0, "PageSize must be > 0");
        require(page > 0, "Page must be > 0");
        Schemas storage ss = schemaStorage();
        require(
            ss.schemaIdToRevisionIds[schemaId].length > 0,
            "schema not found"
        );
        require(
            ss
                .schemaIdRevisionIdToMetadataIds[schemaId][schemaRevisionId]
                .length > 0,
            "revision not found"
        );
        uint256[] memory ids;
        (ids, total, howMany, prev, next) = ss
            .schemaIdRevisionIdToMetadataIds[schemaId][schemaRevisionId]
            .length
            .paginate(page, pageSize);
        items = new bytes32[](howMany);
        for (uint256 i = 0; i < howMany; i++) {
            items[i] = ss.schemaIdRevisionIdToMetadataIds[schemaId][
                schemaRevisionId
            ][ids[i]];
        }
    }

    /**
     * @dev getSchemaRevisionMetadataByMetadataId returns schema revision metadata for the given schema revision metadata id.
     */
    function getSchemaRevisionMetadataByMetadataId(
        bytes calldata schemaId,
        bytes32 schemaRevisionId,
        bytes32 metadataId
    ) external view returns (bytes memory metadata) {
        Schemas storage ss = schemaStorage();
        metadata = ss.getSchemaRevisionMetadataByMetadataId(
            schemaId,
            schemaRevisionId,
            metadataId
        );
    }

    // internal functions

    function getTrustedPolicyRegistry()
        internal
        view
        virtual
        returns (IPolicyRegistry);

    // Reserved storage space to allow for layout changes in the future.
    uint256[50] private __gap;
}
