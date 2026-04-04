import { json, JSONValueKind } from "@graphprotocol/graph-ts";
import { log } from "matchstick-as";

import { Schema, SchemaMetadata, SchemaRevision } from "../../generated/schema";
import {
  MetadataUpdated,
  SchemaInserted,
  SchemaUpdated,
} from "../../generated/TrustedSchemasRegistry/TrustedSchemasRegistry";

export function handleMetadataUpdatedEvent(event: MetadataUpdated): void {
  const revisionId = event.params.schemaId.concat(
    event.params.schemaRevisionId,
  );
  const revision = SchemaRevision.load(revisionId);

  if (!revision) {
    log.error("Revision {} not found", [revisionId.toHexString()]);
    return;
  }

  const metadataId = revisionId.concat(event.params.metadataId);
  const metadata = new SchemaMetadata(metadataId);
  metadata.content = event.params.metadata.toString();
  metadata.metadataId = event.params.metadataId;
  metadata.revision = revision.id;
  metadata.save();

  // Parse metadata JSON to extract name and version for this revision
  updateRevisionWithNameAndVersion(revision, metadata.content);
}

export function handleSchemaInsertedEvent(event: SchemaInserted): void {
  const schema = new Schema(event.params.schemaId);
  schema.save();

  const revisionId = event.params.schemaId.concat(
    event.params.schemaRevisionId,
  );
  const revision = new SchemaRevision(revisionId);
  revision.content = event.params.schema.toString();
  revision.schemaRevisionId = event.params.schemaRevisionId;
  revision.schema = schema.id;
  revision.save();

  const metadataId = revisionId.concat(event.params.metadataId);
  const metadata = new SchemaMetadata(metadataId);
  metadata.content = event.params.metadata.toString();
  metadata.metadataId = event.params.metadataId;
  metadata.revision = revision.id;
  metadata.save();

  // Parse metadata JSON to extract name and version for this revision
  updateRevisionWithNameAndVersion(revision, metadata.content);
}

export function handleSchemaUpdatedEvent(event: SchemaUpdated): void {
  const schema = Schema.load(event.params.schemaId);

  if (!schema) {
    log.error("Schema {} not found", [event.params.schemaId.toHexString()]);
    return;
  }

  const revisionId = event.params.schemaId.concat(
    event.params.schemaRevisionId,
  );
  const revision = new SchemaRevision(revisionId);
  revision.content = event.params.schema.toString();
  revision.schemaRevisionId = event.params.schemaRevisionId;
  revision.schema = schema.id;
  revision.save();

  const metadataId = revisionId.concat(event.params.metadataId);
  const metadata = new SchemaMetadata(metadataId);
  metadata.content = event.params.metadata.toString();
  metadata.metadataId = event.params.metadataId;
  metadata.revision = revision.id;
  metadata.save();

  // Parse metadata JSON to extract name and version for this revision
  updateRevisionWithNameAndVersion(revision, metadata.content);
}

// Helper function to update schema revision with name and version if they exist
function updateRevisionWithNameAndVersion(
  revision: SchemaRevision,
  metadataContent: string,
): void {
  const result = json.try_fromString(metadataContent);

  if (!result.isOk) {
    log.warning("Failed to parse metadata JSON: {}", [metadataContent]);
    return;
  }

  const jsonValue = result.value;

  if (jsonValue.kind !== JSONValueKind.OBJECT) {
    log.warning("Metadata JSON is not an object: {}", [metadataContent]);
    return;
  }

  const obj = jsonValue.toObject();

  // Extract name
  const nameValue = obj.get("name");
  let name = "";
  if (nameValue && nameValue.kind === JSONValueKind.STRING) {
    name = nameValue.toString();
  }

  // Extract version
  const versionValue = obj.get("version");
  let version = "";
  if (versionValue && versionValue.kind === JSONValueKind.STRING) {
    version = versionValue.toString();
  }

  if (name && version) {
    revision.name = name;
    revision.version = version;
    revision.save();
  }
}
