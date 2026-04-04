// SPDX-License-Identifier: EUPL V1.2

pragma solidity ^0.8.26;

import "./SchemaStorage.sol";

library SchemaLib {
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
        SchemaStorage.Schemas storage ss,
        bytes calldata schemaId,
        bytes calldata schema,
        bytes calldata metadata
    ) external returns (bytes32 schemaRevisionId) {
        require(schemaId.length > 0, "schema empty");
        require(schema.length > 0, "revision empty");
        require(metadata.length > 0, "metadata empty");

        schemaRevisionId = sha256(schema);

        // Verify that the schema ID is not already registered (in the Schema ID To Schema Revisions IDs map)
        require(
            ss.schemaIdToRevisionIds[schemaId].length == 0,
            "schema already registered"
        );

        // add schema id to the list
        ss.schemaIds.push(schemaId);
        // add revision id to the list of schema
        ss.schemaIdToRevisionIds[schemaId].push(schemaRevisionId);
        bytes32 metadataId = sha256(metadata);
        // add metadataId to the current revisionId
        ss.schemaIdRevisionIdToMetadataIds[schemaId][schemaRevisionId].push(
            metadataId
        );
        // save metadata of revision
        if (ss.revisionMetadataStore[metadataId].length == 0) {
            ss.revisionMetadataStore[metadataId] = metadata;
        }

        // save schema revision (bytes)
        if ((ss.schemaRevisionStore[schemaRevisionId]).length == 0) {
            ss.schemaRevisionStore[schemaRevisionId] = schema;
        }

        emit SchemaInserted(
            schemaId,
            schemaId,
            schema,
            schemaRevisionId,
            metadata,
            metadataId
        );
    }

    /**
     * @dev getLatestSchemaRevision returns the latest schema revision by schema id.
     */
    function getLatestSchemaRevision(
        SchemaStorage.Schemas storage ss,
        bytes calldata schemaId
    ) external view returns (bytes memory schemaRevision) {
        require(schemaId.length > 0, "schemaId empty");
        require(
            ss.schemaIdToRevisionIds[schemaId].length > 0,
            "schema not found"
        );
        bytes32 latestSchemaRevisionId = ss.schemaIdToRevisionIds[schemaId][
            ss.schemaIdToRevisionIds[schemaId].length - 1
        ];
        schemaRevision = ss.schemaRevisionStore[latestSchemaRevisionId];
    }

    /**
     * @dev getLatestSchemaRevisionMetadataByRevisionId returns schema revision metadata for
     * the given schema revision id.
     */
    function getLatestSchemaRevisionMetadataByRevisionId(
        SchemaStorage.Schemas storage ss,
        bytes calldata schemaId,
        bytes32 schemaRevisionId
    ) external view returns (bytes memory metadata) {
        require(schemaId.length > 0, "schemaId empty");
        require(schemaRevisionId != bytes32(0), "schemaRevisionId empty");
        bytes32[] storage metadataIds = ss.schemaIdRevisionIdToMetadataIds[
            schemaId
        ][schemaRevisionId];
        require(metadataIds.length > 0, "no metadata");

        metadata = ss.revisionMetadataStore[
            metadataIds[metadataIds.length - 1]
        ];
    }

    /**
     * @dev updateSchema enables to update the existing schema.
     */
    function updateSchema(
        SchemaStorage.Schemas storage ss,
        bytes calldata schemaId,
        bytes calldata schema,
        bytes calldata metadata
    ) external returns (bytes32 schemaRevisionId) {
        require(schemaId.length > 0, "schema empty");
        require(schema.length > 0, "revision empty");
        require(metadata.length > 0, "metadata empty");

        schemaRevisionId = sha256(schema);
        bytes32 metadataId = sha256(metadata);

        // Verify that the schema ID is already registered (in the Schema ID To Schema Revisions IDs map)
        require(
            ss.schemaIdToRevisionIds[schemaId].length > 0,
            "schema not registered"
        );

        // Insert the schema to the Schema Revisions Store
        if ((ss.schemaRevisionStore[schemaRevisionId]).length == 0) {
            ss.schemaRevisionStore[schemaRevisionId] = schema;
        }

        // Append a new entry in the Schema ID to Schema Revisions IDs map
        ss.schemaIdToRevisionIds[schemaId].push(schemaRevisionId);
        // Store the metadata to the Metadata Store
        if ((ss.revisionMetadataStore[metadataId]).length == 0) {
            ss.revisionMetadataStore[metadataId] = metadata;
        }

        // Append a new entry in the Schema Revision ID to Metadata IDs store.
        ss.schemaIdRevisionIdToMetadataIds[schemaId][schemaRevisionId].push(
            metadataId
        );

        emit SchemaUpdated(
            schemaId,
            schemaId,
            schema,
            schemaRevisionId,
            metadata,
            metadataId
        );
    }

    /**
     * @dev updateMetadata enables to update the existing metadata.
     */
    function updateMetadata(
        SchemaStorage.Schemas storage ss,
        bytes calldata schemaId,
        bytes32 schemaRevisionId,
        bytes calldata metadata
    ) external returns (bytes32 metadataId) {
        require(schemaId.length > 0, "schemaId empty");
        require(schemaRevisionId != bytes32(0), "schemaRevisionId empty");
        require(metadata.length > 0, "metadata empty");
        // Verify that the Schema ID is already registered
        require(
            ss.schemaIdToRevisionIds[schemaId].length > 0,
            "schema not registered"
        );
        // Verify that the Schema Revision ID is already registered (in the Schema Revision ID To Metadata IDs map)
        require(
            ss
                .schemaIdRevisionIdToMetadataIds[schemaId][schemaRevisionId]
                .length > 0,
            "revision not registered"
        );

        // Compute the SHA2-256 hash of the metadata
        metadataId = sha256(metadata);

        // Store the metadata to the Metadata Store
        if ((ss.revisionMetadataStore[metadataId]).length == 0) {
            ss.revisionMetadataStore[metadataId] = metadata;
        }

        // Append a new entry in the Schema Revision ID to Metadata IDs store.
        ss.schemaIdRevisionIdToMetadataIds[schemaId][schemaRevisionId].push(
            metadataId
        );

        emit MetadataUpdated(
            schemaId,
            schemaId,
            schemaRevisionId,
            metadata,
            metadataId
        );
    }

    /**
     * @dev getSchemaRevision returns a specific schema revision for a specific SchemaRevisionId.
     */
    function getSchemaRevision(
        SchemaStorage.Schemas storage ss,
        bytes calldata schemaId,
        bytes32 schemaRevisionId
    ) external view returns (bytes memory schema) {
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

        schema = ss.schemaRevisionStore[schemaRevisionId];
    }

    /**
     * @dev getSchemaRevisionMetadataByMetadataId returns schema revision metadata
     * for the given schema revision metadata id.
     */
    function getSchemaRevisionMetadataByMetadataId(
        SchemaStorage.Schemas storage ss,
        bytes calldata schemaId,
        bytes32 schemaRevisionId,
        bytes32 metadataId
    ) external view returns (bytes memory metadata) {
        require(schemaId.length > 0, "schemaId empty");
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

        require(metadataId != bytes32(0), "metadataId empty");
        require(
            ss.revisionMetadataStore[metadataId].length > 0,
            "metadata not found"
        );
        metadata = ss.revisionMetadataStore[metadataId];
    }
}
