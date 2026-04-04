import { Bytes, ethereum } from "@graphprotocol/graph-ts";
import {
  afterAll,
  assert,
  beforeAll,
  clearStore,
  describe,
  newMockEvent,
  test,
} from "matchstick-as";

import { Schema, SchemaRevision } from "../generated/schema";
import {
  MetadataUpdated,
  SchemaInserted,
  SchemaUpdated,
} from "../generated/TrustedSchemasRegistry/TrustedSchemasRegistry";
import {
  handleMetadataUpdatedEvent,
  handleSchemaInsertedEvent,
  handleSchemaUpdatedEvent,
} from "../src/trusted-schemas-registry-v3/mappings";
import { assertArrayContainsAllValues } from "./trusted-schemas-registry.utils";

function paramBytes(name: string, value: Bytes): ethereum.EventParam {
  return new ethereum.EventParam(name, ethereum.Value.fromBytes(value));
}

describe("Trusted Schemas Registry - entity assertions", () => {
  const schemaId = "0xfa01";
  const revision1Id = "0xba32";
  const schema1 = `{"$schema":"https://json-schema.org/d...`;
  const metadata1 = "{}";
  const metadata1Id = "0x12ef";
  const revision2Id = "0xefa0";
  const schema2 = `{"$schema":"https://json-schema.org/draft...`;
  const metadata2 = "{...}";
  const metadata2Id = "0x5ca1";
  const metadata3 = "{......}";
  const metadata3Id = "0x3d08";

  beforeAll(() => {
    const event = changetype<SchemaInserted>(newMockEvent());

    event.parameters = [
      paramBytes("schemaIdHash", Bytes.fromHexString(schemaId)),
      paramBytes("schemaId", Bytes.fromHexString(schemaId)),
      paramBytes("schema", Bytes.fromUTF8(schema1)),
      paramBytes("schemaRevisionId", Bytes.fromHexString(revision1Id)),
      paramBytes("metadata", Bytes.fromUTF8(metadata1)),
      paramBytes("metadataId", Bytes.fromHexString(metadata1Id)),
    ];

    handleSchemaInsertedEvent(event);
  });

  afterAll(() => {
    clearStore();
  });

  test("Insert schema", () => {
    assert.entityCount("Schema", 1);
    assert.entityCount("SchemaRevision", 1);
    assert.entityCount("SchemaMetadata", 1);

    const schema = Schema.load(Bytes.fromHexString(schemaId));

    if (!schema) {
      throw new Error("Schema not found");
    }

    // Check schema revisions
    const revisions = schema.revisions.load();
    assert.i32Equals(1, revisions.length, "The schema should have 1 revision");

    // The revision ID is schemaId + schemaRevisionId
    const expectedRevisionId = Bytes.fromHexString(schemaId).concat(
      Bytes.fromHexString(revision1Id),
    );
    assert.bytesEquals(expectedRevisionId, revisions[0].id);
    assert.stringEquals(schema1, revisions[0].content);

    // Check revision metadata
    const metadata = revisions[0].metadata.load();
    assert.i32Equals(1, metadata.length, "The revision should have 1 metadata");
    assert.stringEquals(metadata1, metadata[0].content);
  });

  test("Update schema", () => {
    const event = changetype<SchemaUpdated>(newMockEvent());

    event.parameters = [
      paramBytes("schemaIdHash", Bytes.fromHexString(schemaId)),
      paramBytes("schemaId", Bytes.fromHexString(schemaId)),
      paramBytes("schema", Bytes.fromUTF8(schema2)),
      paramBytes("schemaRevisionId", Bytes.fromHexString(revision2Id)),
      paramBytes("metadata", Bytes.fromUTF8(metadata2)),
      paramBytes("metadataId", Bytes.fromHexString(metadata2Id)),
    ];

    handleSchemaUpdatedEvent(event);

    assert.entityCount("Schema", 1);
    assert.entityCount("SchemaRevision", 2);
    assert.entityCount("SchemaMetadata", 2);

    const schema = Schema.load(Bytes.fromHexString(schemaId));

    if (!schema) {
      throw new Error("Schema not found");
    }

    // Check schema revisions
    const revisions = schema.revisions.load();
    assert.i32Equals(2, revisions.length, "The schema should have 2 revisions");

    // We can't trust the order of the revisions, hence we can simply check that they're all included
    const actualRevisionIds = revisions.map<string>((revision) =>
      revision.id.toHexString(),
    );
    const expectedRevision1Id = Bytes.fromHexString(schemaId)
      .concat(Bytes.fromHexString(revision1Id))
      .toHexString();
    const expectedRevision2Id = Bytes.fromHexString(schemaId)
      .concat(Bytes.fromHexString(revision2Id))
      .toHexString();
    assertArrayContainsAllValues(
      actualRevisionIds,
      [expectedRevision1Id, expectedRevision2Id],
      "Schema should contain the revisions [expectedRevision1Id, expectedRevision2Id]",
    );

    // Check revision #1
    const revision1IdBytes = Bytes.fromHexString(schemaId).concat(
      Bytes.fromHexString(revision1Id),
    );
    const revision1 = SchemaRevision.load(revision1IdBytes);
    if (!revision1) throw new Error("Revision not found");
    assert.stringEquals(schema1, revision1.content);
    const revision1Metadata = revision1.metadata.load();
    assert.i32Equals(
      1,
      revision1Metadata.length,
      "The revision should have 1 metadata",
    );
    assert.stringEquals(metadata1, revision1Metadata[0].content);

    // Check revision #2
    const revision2IdBytes = Bytes.fromHexString(schemaId).concat(
      Bytes.fromHexString(revision2Id),
    );
    const revision2 = SchemaRevision.load(revision2IdBytes);
    if (!revision2) throw new Error("Revision not found");
    assert.stringEquals(schema2, revision2.content);
    const revision2Metadata = revision2.metadata.load();
    assert.i32Equals(
      1,
      revision2Metadata.length,
      "The revision should have 1 metadata",
    );
    assert.stringEquals(metadata2, revision2Metadata[0].content);
  });

  test("Update metadata", () => {
    const event = changetype<MetadataUpdated>(newMockEvent());

    event.parameters = [
      paramBytes("schemaIdHash", Bytes.fromHexString(schemaId)),
      paramBytes("schemaId", Bytes.fromHexString(schemaId)),
      paramBytes("schemaRevisionId", Bytes.fromHexString(revision2Id)),
      paramBytes("metadata", Bytes.fromUTF8(metadata3)),
      paramBytes("metadataId", Bytes.fromHexString(metadata3Id)),
    ];

    handleMetadataUpdatedEvent(event);

    const schema = Schema.load(Bytes.fromHexString(schemaId));

    if (!schema) {
      throw new Error("Schema not found");
    }

    // Check schema revisions
    const revisions = schema.revisions.load();
    assert.i32Equals(2, revisions.length, "The schema should have 2 revisions");

    // Check revision #1
    const revision1IdBytes = Bytes.fromHexString(schemaId).concat(
      Bytes.fromHexString(revision1Id),
    );
    const revision1 = SchemaRevision.load(revision1IdBytes);
    if (!revision1) throw new Error("Revision not found");
    assert.stringEquals(schema1, revision1.content);
    const revision1Metadata = revision1.metadata.load();
    assert.i32Equals(
      1,
      revision1Metadata.length,
      "The revision should have 1 metadata",
    );
    assert.stringEquals(metadata1, revision1Metadata[0].content);

    // Check revision #2
    const revision2IdBytes = Bytes.fromHexString(schemaId).concat(
      Bytes.fromHexString(revision2Id),
    );
    const revision2 = SchemaRevision.load(revision2IdBytes);
    if (!revision2) throw new Error("Revision not found");
    assert.stringEquals(schema2, revision2.content);
    const revision2Metadata = revision2.metadata.load();
    assert.i32Equals(
      2,
      revision2Metadata.length,
      "The revision should have 2 metadata",
    );

    // We can't trust the order of the metadata
    const actualMetadataContents = revision2Metadata.map<string>(
      (metadata) => metadata.content,
    );
    assertArrayContainsAllValues(
      actualMetadataContents,
      [metadata2, metadata3],
      "Revision #2 should contain the metadata [metadata2, metadata3]",
    );
  });

  test("Schema insertion with name and version parsing", () => {
    // Test that handleSchemaInsertedEvent properly parses name and version from metadata
    const schemaIdNew = "0xfa05";
    const revisionNewId = "0xba37";
    const schemaNew = `{"$schema":"https://json-schema.org/draft/2020-12/schema","type":"object"}`;
    const metadataWithNameVersion =
      '{"name":"New Test Schema","version":"1.0.0","description":"A new test schema"}';
    const metadataNewId = "0x12f4";

    // Insert a new schema
    const insertEvent = changetype<SchemaInserted>(newMockEvent());
    insertEvent.parameters = [
      paramBytes("schemaIdHash", Bytes.fromHexString(schemaIdNew)),
      paramBytes("schemaId", Bytes.fromHexString(schemaIdNew)),
      paramBytes("schema", Bytes.fromUTF8(schemaNew)),
      paramBytes("schemaRevisionId", Bytes.fromHexString(revisionNewId)),
      paramBytes("metadata", Bytes.fromUTF8(metadataWithNameVersion)),
      paramBytes("metadataId", Bytes.fromHexString(metadataNewId)),
    ];
    handleSchemaInsertedEvent(insertEvent);

    // Load the revision and verify name and version were set
    const revisionId = Bytes.fromHexString(schemaIdNew).concat(
      Bytes.fromHexString(revisionNewId),
    );
    const revision = SchemaRevision.load(revisionId);
    if (!revision) {
      throw new Error("Schema revision not found");
    }

    assert.stringEquals(
      "New Test Schema",
      revision.name!,
      "Schema revision name should be set from metadata during insertion",
    );
    assert.stringEquals(
      "1.0.0",
      revision.version!,
      "Schema revision version should be set from metadata during insertion",
    );
  });

  test("Update metadata with name and version parsing", () => {
    // First, create a schema with a revision that has metadata containing name and version
    const schemaId2 = "0xfa02";
    const revision3Id = "0xba33";
    const schema3 = `{"$schema":"https://json-schema.org/draft/2020-12/schema","type":"object"}`;
    const metadataWithNameVersion =
      '{"name":"Test Schema","version":"1.0.0","description":"A test schema"}';
    const metadata3Id = "0x12f0";

    // Insert a new schema
    const insertEvent = changetype<SchemaInserted>(newMockEvent());
    insertEvent.parameters = [
      paramBytes("schemaIdHash", Bytes.fromHexString(schemaId2)),
      paramBytes("schemaId", Bytes.fromHexString(schemaId2)),
      paramBytes("schema", Bytes.fromUTF8(schema3)),
      paramBytes("schemaRevisionId", Bytes.fromHexString(revision3Id)),
      paramBytes("metadata", Bytes.fromUTF8(metadataWithNameVersion)),
      paramBytes("metadataId", Bytes.fromHexString(metadata3Id)),
    ];
    handleSchemaInsertedEvent(insertEvent);

    // Load the revision and verify it has name/version from initial metadata
    const revisionIdBytes = Bytes.fromHexString(schemaId2).concat(
      Bytes.fromHexString(revision3Id),
    );
    let revision = SchemaRevision.load(revisionIdBytes);
    if (!revision) {
      throw new Error("Schema revision not found");
    }

    // Initially, name and version should be set from the metadata since handleSchemaInsertedEvent now parses them
    assert.stringEquals(
      "Test Schema",
      revision.name!,
      "Schema revision name should be set from initial metadata",
    );
    assert.stringEquals(
      "1.0.0",
      revision.version!,
      "Schema revision version should be set from initial metadata",
    );

    // Now update the metadata with new content that has name and version
    const metadataUpdateId = "0x3d09";
    const updatedMetadata =
      '{"name":"Updated Test Schema","version":"2.0.0","description":"An updated test schema"}';

    const updateEvent = changetype<MetadataUpdated>(newMockEvent());
    updateEvent.parameters = [
      paramBytes("schemaIdHash", Bytes.fromHexString(schemaId2)),
      paramBytes("schemaId", Bytes.fromHexString(schemaId2)),
      paramBytes("schemaRevisionId", Bytes.fromHexString(revision3Id)),
      paramBytes("metadata", Bytes.fromUTF8(updatedMetadata)),
      paramBytes("metadataId", Bytes.fromHexString(metadataUpdateId)),
    ];

    handleMetadataUpdatedEvent(updateEvent);

    // Reload the revision and verify name and version were updated
    revision = SchemaRevision.load(revisionIdBytes);
    if (!revision) {
      throw new Error("Schema revision not found after metadata update");
    }

    assert.stringEquals(
      "Updated Test Schema",
      revision.name!,
      "Schema revision name should be updated",
    );
    assert.stringEquals(
      "2.0.0",
      revision.version!,
      "Schema revision version should be updated",
    );
  });

  test("Metadata update on different revisions should update respective revision name/version", () => {
    // Create a schema with multiple revisions
    const schemaId4 = "0xfa04";
    const revision5Id = "0xba35";
    const revision6Id = "0xba36";
    const schema5 = `{"$schema":"https://json-schema.org/draft/2020-12/schema","type":"object"}`;
    const schema6 = `{"$schema":"https://json-schema.org/draft/2020-12/schema","type":"object","additionalProperties":false}`;
    const metadata5 = '{"name":"Schema v1","version":"1.0.0"}';
    const metadata6 = '{"name":"Schema v2","version":"2.0.0"}';
    const metadata5Id = "0x12f2";
    const metadata6Id = "0x12f3";

    // Insert initial schema
    const insertEvent = changetype<SchemaInserted>(newMockEvent());
    insertEvent.parameters = [
      paramBytes("schemaIdHash", Bytes.fromHexString(schemaId4)),
      paramBytes("schemaId", Bytes.fromHexString(schemaId4)),
      paramBytes("schema", Bytes.fromUTF8(schema5)),
      paramBytes("schemaRevisionId", Bytes.fromHexString(revision5Id)),
      paramBytes("metadata", Bytes.fromUTF8(metadata5)),
      paramBytes("metadataId", Bytes.fromHexString(metadata5Id)),
    ];
    handleSchemaInsertedEvent(insertEvent);

    // Update schema to create a second revision (latest)
    const updateEvent = changetype<SchemaUpdated>(newMockEvent());
    updateEvent.parameters = [
      paramBytes("schemaIdHash", Bytes.fromHexString(schemaId4)),
      paramBytes("schemaId", Bytes.fromHexString(schemaId4)),
      paramBytes("schema", Bytes.fromUTF8(schema6)),
      paramBytes("schemaRevisionId", Bytes.fromHexString(revision6Id)),
      paramBytes("metadata", Bytes.fromUTF8(metadata6)),
      paramBytes("metadataId", Bytes.fromHexString(metadata6Id)),
    ];
    handleSchemaUpdatedEvent(updateEvent);

    // Update metadata on the first revision
    const metadataUpdateId = "0x3d0b";
    const updatedMetadata =
      '{"name":"Updated Old Schema","version":"1.5.0","description":"This should update the first revision"}';

    const metadataUpdateEvent = changetype<MetadataUpdated>(newMockEvent());
    metadataUpdateEvent.parameters = [
      paramBytes("schemaIdHash", Bytes.fromHexString(schemaId4)),
      paramBytes("schemaId", Bytes.fromHexString(schemaId4)),
      paramBytes("schemaRevisionId", Bytes.fromHexString(revision5Id)), // First revision
      paramBytes("metadata", Bytes.fromUTF8(updatedMetadata)),
      paramBytes("metadataId", Bytes.fromHexString(metadataUpdateId)),
    ];

    handleMetadataUpdatedEvent(metadataUpdateEvent);

    // Verify that the first revision name/version were updated
    const revision5IdBytes = Bytes.fromHexString(schemaId4).concat(
      Bytes.fromHexString(revision5Id),
    );
    const revision5 = SchemaRevision.load(revision5IdBytes);
    if (!revision5) {
      throw new Error("First revision not found");
    }

    assert.stringEquals(
      "Updated Old Schema",
      revision5.name!,
      "First revision name should be updated",
    );
    assert.stringEquals(
      "1.5.0",
      revision5.version!,
      "First revision version should be updated",
    );

    // Verify that the second revision name/version were not affected
    const revision6IdBytes = Bytes.fromHexString(schemaId4).concat(
      Bytes.fromHexString(revision6Id),
    );
    const revision6 = SchemaRevision.load(revision6IdBytes);
    if (!revision6) {
      throw new Error("Second revision not found");
    }

    assert.stringEquals(
      "Schema v2",
      revision6.name!,
      "Second revision name should remain unchanged",
    );
    assert.stringEquals(
      "2.0.0",
      revision6.version!,
      "Second revision version should remain unchanged",
    );

    // Now update metadata on the latest revision
    const latestMetadataUpdateId = "0x3d0c";
    const latestUpdatedMetadata =
      '{"name":"Latest Schema Update","version":"3.0.0","description":"This should update the latest revision"}';

    const latestMetadataUpdateEvent =
      changetype<MetadataUpdated>(newMockEvent());
    latestMetadataUpdateEvent.parameters = [
      paramBytes("schemaIdHash", Bytes.fromHexString(schemaId4)),
      paramBytes("schemaId", Bytes.fromHexString(schemaId4)),
      paramBytes("schemaRevisionId", Bytes.fromHexString(revision6Id)), // Latest revision
      paramBytes("metadata", Bytes.fromUTF8(latestUpdatedMetadata)),
      paramBytes("metadataId", Bytes.fromHexString(latestMetadataUpdateId)),
    ];

    handleMetadataUpdatedEvent(latestMetadataUpdateEvent);

    // Reload and verify the latest revision was updated
    const updatedRevision6 = SchemaRevision.load(revision6IdBytes);
    if (!updatedRevision6) {
      throw new Error("Latest revision not found after metadata update");
    }

    assert.stringEquals(
      "Latest Schema Update",
      updatedRevision6.name!,
      "Latest revision name should be updated",
    );
    assert.stringEquals(
      "3.0.0",
      updatedRevision6.version!,
      "Latest revision version should be updated",
    );
  });

  test("Schema update with name and version parsing", () => {
    // Test that handleSchemaUpdatedEvent properly parses name and version from metadata
    const schemaIdUpdate = "0xfa06";
    const revisionUpdate1Id = "0xba38";
    const revisionUpdate2Id = "0xba39";
    const schemaUpdate1 = `{"$schema":"https://json-schema.org/draft/2020-12/schema","type":"object"}`;
    const schemaUpdate2 = `{"$schema":"https://json-schema.org/draft/2020-12/schema","type":"object","additionalProperties":false}`;
    const metadataUpdate1 = '{"name":"Update Schema v1","version":"1.0.0"}';
    const metadataUpdate2 = '{"name":"Update Schema v2","version":"2.0.0"}';
    const metadataUpdate1Id = "0x12f5";
    const metadataUpdate2Id = "0x12f6";

    // Insert initial schema
    const insertEvent = changetype<SchemaInserted>(newMockEvent());
    insertEvent.parameters = [
      paramBytes("schemaIdHash", Bytes.fromHexString(schemaIdUpdate)),
      paramBytes("schemaId", Bytes.fromHexString(schemaIdUpdate)),
      paramBytes("schema", Bytes.fromUTF8(schemaUpdate1)),
      paramBytes("schemaRevisionId", Bytes.fromHexString(revisionUpdate1Id)),
      paramBytes("metadata", Bytes.fromUTF8(metadataUpdate1)),
      paramBytes("metadataId", Bytes.fromHexString(metadataUpdate1Id)),
    ];
    handleSchemaInsertedEvent(insertEvent);

    // Update schema
    const updateEvent = changetype<SchemaUpdated>(newMockEvent());
    updateEvent.parameters = [
      paramBytes("schemaIdHash", Bytes.fromHexString(schemaIdUpdate)),
      paramBytes("schemaId", Bytes.fromHexString(schemaIdUpdate)),
      paramBytes("schema", Bytes.fromUTF8(schemaUpdate2)),
      paramBytes("schemaRevisionId", Bytes.fromHexString(revisionUpdate2Id)),
      paramBytes("metadata", Bytes.fromUTF8(metadataUpdate2)),
      paramBytes("metadataId", Bytes.fromHexString(metadataUpdate2Id)),
    ];
    handleSchemaUpdatedEvent(updateEvent);

    // Load the first revision and verify name and version
    const revision1IdBytes = Bytes.fromHexString(schemaIdUpdate).concat(
      Bytes.fromHexString(revisionUpdate1Id),
    );
    const revision1 = SchemaRevision.load(revision1IdBytes);
    if (!revision1) {
      throw new Error("First revision not found");
    }

    assert.stringEquals(
      "Update Schema v1",
      revision1.name!,
      "First revision name should be set from initial metadata",
    );
    assert.stringEquals(
      "1.0.0",
      revision1.version!,
      "First revision version should be set from initial metadata",
    );

    // Load the second revision and verify name and version were updated
    const revision2IdBytes = Bytes.fromHexString(schemaIdUpdate).concat(
      Bytes.fromHexString(revisionUpdate2Id),
    );
    const revision2 = SchemaRevision.load(revision2IdBytes);
    if (!revision2) {
      throw new Error("Second revision not found");
    }

    assert.stringEquals(
      "Update Schema v2",
      revision2.name!,
      "Second revision name should be updated from latest metadata during schema update",
    );
    assert.stringEquals(
      "2.0.0",
      revision2.version!,
      "Second revision version should be updated from latest metadata during schema update",
    );
  });

  test("Two schemas with same content should have independent metadata without conflicts", () => {
    // Clear the store to ensure we start with a clean state
    clearStore();

    // Test that two different schemas can have the same content (same schemaRevisionId)
    // but maintain separate metadata without conflicts
    const schemaId1 = "0xfa07";
    const schemaId2 = "0xfa08";
    const sharedRevisionId = "0xba40"; // Same revision ID for both schemas
    const sharedSchemaContent = `{"$schema":"https://json-schema.org/draft/2020-12/schema","type":"object","properties":{"name":{"type":"string"}}}`;

    // Different metadata for each schema
    const metadata1 =
      '{"name":"Schema A","version":"1.0.0","description":"First schema with shared content"}';
    const metadata2 =
      '{"name":"Schema B","version":"2.0.0","description":"Second schema with shared content"}';
    const metadata1Id = "0x12f7";
    const metadata2Id = "0x12f8";

    // Insert first schema
    const insertEvent1 = changetype<SchemaInserted>(newMockEvent());
    insertEvent1.parameters = [
      paramBytes("schemaIdHash", Bytes.fromHexString(schemaId1)),
      paramBytes("schemaId", Bytes.fromHexString(schemaId1)),
      paramBytes("schema", Bytes.fromUTF8(sharedSchemaContent)),
      paramBytes("schemaRevisionId", Bytes.fromHexString(sharedRevisionId)),
      paramBytes("metadata", Bytes.fromUTF8(metadata1)),
      paramBytes("metadataId", Bytes.fromHexString(metadata1Id)),
    ];
    handleSchemaInsertedEvent(insertEvent1);

    // Insert second schema with same content but different metadata
    const insertEvent2 = changetype<SchemaInserted>(newMockEvent());
    insertEvent2.parameters = [
      paramBytes("schemaIdHash", Bytes.fromHexString(schemaId2)),
      paramBytes("schemaId", Bytes.fromHexString(schemaId2)),
      paramBytes("schema", Bytes.fromUTF8(sharedSchemaContent)),
      paramBytes("schemaRevisionId", Bytes.fromHexString(sharedRevisionId)),
      paramBytes("metadata", Bytes.fromUTF8(metadata2)),
      paramBytes("metadataId", Bytes.fromHexString(metadata2Id)),
    ];
    handleSchemaInsertedEvent(insertEvent2);

    // Verify we have 2 schemas, 2 revisions, and 2 metadata entries
    assert.entityCount("Schema", 2);
    assert.entityCount("SchemaRevision", 2);
    assert.entityCount("SchemaMetadata", 2);

    // Load both schemas
    const schema1 = Schema.load(Bytes.fromHexString(schemaId1));
    const schema2 = Schema.load(Bytes.fromHexString(schemaId2));

    if (!schema1 || !schema2) {
      throw new Error("Schemas not found");
    }

    // Verify each schema has 1 revision
    const revisions1 = schema1.revisions.load();
    const revisions2 = schema2.revisions.load();
    assert.i32Equals(1, revisions1.length, "Schema 1 should have 1 revision");
    assert.i32Equals(1, revisions2.length, "Schema 2 should have 1 revision");

    // Load the revisions using the unique IDs (schemaId + schemaRevisionId)
    const revision1Id = Bytes.fromHexString(schemaId1).concat(
      Bytes.fromHexString(sharedRevisionId),
    );
    const revision2Id = Bytes.fromHexString(schemaId2).concat(
      Bytes.fromHexString(sharedRevisionId),
    );

    const revision1 = SchemaRevision.load(revision1Id);
    const revision2 = SchemaRevision.load(revision2Id);

    if (!revision1 || !revision2) {
      throw new Error("Revisions not found");
    }

    // Verify both revisions have the same content (shared schemaRevisionId)
    assert.stringEquals(
      sharedSchemaContent,
      revision1.content,
      "Revision 1 should have shared content",
    );
    assert.stringEquals(
      sharedSchemaContent,
      revision2.content,
      "Revision 2 should have shared content",
    );
    assert.bytesEquals(
      revision1.schemaRevisionId,
      Bytes.fromHexString(sharedRevisionId),
      "Revision 1 should have shared revision ID",
    );
    assert.bytesEquals(
      revision2.schemaRevisionId,
      Bytes.fromHexString(sharedRevisionId),
      "Revision 2 should have shared revision ID",
    );

    // Verify each revision has its own metadata
    const metadata1List = revision1.metadata.load();
    const metadata2List = revision2.metadata.load();

    assert.i32Equals(
      1,
      metadata1List.length,
      "Revision 1 should have 1 metadata",
    );
    assert.i32Equals(
      1,
      metadata2List.length,
      "Revision 2 should have 1 metadata",
    );

    // Verify metadata content is different for each schema
    assert.stringEquals(
      metadata1,
      metadata1List[0].content,
      "Schema 1 should have its own metadata",
    );
    assert.stringEquals(
      metadata2,
      metadata2List[0].content,
      "Schema 2 should have its own metadata",
    );

    // Verify metadata IDs are different
    assert.bytesEquals(
      metadata1List[0].metadataId,
      Bytes.fromHexString(metadata1Id),
      "Schema 1 should have correct metadata ID",
    );
    assert.bytesEquals(
      metadata2List[0].metadataId,
      Bytes.fromHexString(metadata2Id),
      "Schema 2 should have correct metadata ID",
    );

    // Verify name and version parsing works independently
    assert.stringEquals(
      "Schema A",
      revision1.name!,
      "Revision 1 should have correct name",
    );
    assert.stringEquals(
      "1.0.0",
      revision1.version!,
      "Revision 1 should have correct version",
    );
    assert.stringEquals(
      "Schema B",
      revision2.name!,
      "Revision 2 should have correct name",
    );
    assert.stringEquals(
      "2.0.0",
      revision2.version!,
      "Revision 2 should have correct version",
    );

    // Now add additional metadata to each schema to test independence
    const additionalMetadata1 =
      '{"name":"Updated Schema A","version":"1.1.0","description":"Updated first schema"}';
    const additionalMetadata2 =
      '{"name":"Updated Schema B","version":"2.1.0","description":"Updated second schema"}';
    const additionalMetadata1Id = "0x12f9";
    const additionalMetadata2Id = "0x12fa";

    // Update metadata for schema 1
    const updateEvent1 = changetype<MetadataUpdated>(newMockEvent());
    updateEvent1.parameters = [
      paramBytes("schemaIdHash", Bytes.fromHexString(schemaId1)),
      paramBytes("schemaId", Bytes.fromHexString(schemaId1)),
      paramBytes("schemaRevisionId", Bytes.fromHexString(sharedRevisionId)),
      paramBytes("metadata", Bytes.fromUTF8(additionalMetadata1)),
      paramBytes("metadataId", Bytes.fromHexString(additionalMetadata1Id)),
    ];
    handleMetadataUpdatedEvent(updateEvent1);

    // Update metadata for schema 2
    const updateEvent2 = changetype<MetadataUpdated>(newMockEvent());
    updateEvent2.parameters = [
      paramBytes("schemaIdHash", Bytes.fromHexString(schemaId2)),
      paramBytes("schemaId", Bytes.fromHexString(schemaId2)),
      paramBytes("schemaRevisionId", Bytes.fromHexString(sharedRevisionId)),
      paramBytes("metadata", Bytes.fromUTF8(additionalMetadata2)),
      paramBytes("metadataId", Bytes.fromHexString(additionalMetadata2Id)),
    ];
    handleMetadataUpdatedEvent(updateEvent2);

    // Reload revisions and verify they now have 2 metadata entries each
    const updatedRevision1 = SchemaRevision.load(revision1Id);
    const updatedRevision2 = SchemaRevision.load(revision2Id);

    if (!updatedRevision1 || !updatedRevision2) {
      throw new Error("Updated revisions not found");
    }

    const updatedMetadata1List = updatedRevision1.metadata.load();
    const updatedMetadata2List = updatedRevision2.metadata.load();

    assert.i32Equals(
      2,
      updatedMetadata1List.length,
      "Updated revision 1 should have 2 metadata",
    );
    assert.i32Equals(
      2,
      updatedMetadata2List.length,
      "Updated revision 2 should have 2 metadata",
    );

    // Verify the latest metadata was applied correctly to each revision
    assert.stringEquals(
      "Updated Schema A",
      updatedRevision1.name!,
      "Updated revision 1 should have updated name",
    );
    assert.stringEquals(
      "1.1.0",
      updatedRevision1.version!,
      "Updated revision 1 should have updated version",
    );
    assert.stringEquals(
      "Updated Schema B",
      updatedRevision2.name!,
      "Updated revision 2 should have updated name",
    );
    assert.stringEquals(
      "2.1.0",
      updatedRevision2.version!,
      "Updated revision 2 should have updated version",
    );

    // Verify both revisions still have the same content
    assert.stringEquals(
      sharedSchemaContent,
      updatedRevision1.content,
      "Updated revision 1 should still have shared content",
    );
    assert.stringEquals(
      sharedSchemaContent,
      updatedRevision2.content,
      "Updated revision 2 should still have shared content",
    );

    // Verify no conflicts - each schema maintains its own metadata independently
    const allMetadata1Contents = updatedMetadata1List.map<string>(
      (m) => m.content,
    );
    const allMetadata2Contents = updatedMetadata2List.map<string>(
      (m) => m.content,
    );

    assertArrayContainsAllValues(
      allMetadata1Contents,
      [metadata1, additionalMetadata1],
      "Schema 1 should contain both its original and updated metadata",
    );

    assertArrayContainsAllValues(
      allMetadata2Contents,
      [metadata2, additionalMetadata2],
      "Schema 2 should contain both its original and updated metadata",
    );

    // Verify that schema 1's metadata doesn't appear in schema 2 and vice versa
    assert.i32Equals(
      -1,
      allMetadata2Contents.indexOf(metadata1),
      "Schema 2 should not contain schema 1's metadata",
    );
    assert.i32Equals(
      -1,
      allMetadata1Contents.indexOf(metadata2),
      "Schema 1 should not contain schema 2's metadata",
    );
  });
});
