import { Address, BigInt, Bytes } from "@graphprotocol/graph-ts";
import {
  afterAll,
  assert,
  beforeAll,
  clearStore,
  countEntities,
  describe,
  test,
} from "matchstick-as";

import {
  Record,
  RecordOwner,
  RecordVersion,
  TimestampedHash,
} from "../generated/schema";
import { getVersionId } from "../src/timestamp-v4/utils";
import {
  appendRecordVersionHashes,
  assertArrayContainsAllValues,
  detachRecordVersionHash,
  getRecordId,
  insertHashAlgorithm,
  insertRecordOwner,
  insertRecordVersionInfo,
  revokeRecordOwner,
  timestampHashes,
  timestampRecordHashes,
  timestampRecordVersionHashes,
  timestampVersionHashes,
  updateHashAlgorithm,
} from "./timestamp.utils";

const defaultSender = "0xa16081f360e3847006db660bae1c6d1b2e17ec2a";
const defaultTransactionHash = "0xa16081f360e3847006db660bae1c6d1b2e17ec2a";
const defaultBlock = "1";
const defaultTimestamp = "1";

describe("Hash algorithms", () => {
  afterAll(() => {
    clearStore();
  });

  test("Insert hash algorithm", () => {
    insertHashAlgorithm(
      1,
      256,
      "sha-256",
      "2.16.840.1.101.3.4.2.1",
      1,
      "sha2-256",
    );

    assert.entityCount("HashAlgorithm", 1);
    assert.fieldEquals("HashAlgorithm", "1", "ianaName", "sha-256");
    assert.fieldEquals("HashAlgorithm", "1", "multiHash", "sha2-256");
    assert.fieldEquals("HashAlgorithm", "1", "oid", "2.16.840.1.101.3.4.2.1");
    assert.fieldEquals("HashAlgorithm", "1", "outputLength", "256");
    assert.fieldEquals("HashAlgorithm", "1", "status", "ACTIVE");
  });

  test("Update hash algorithm", () => {
    insertHashAlgorithm(2, 384, "sha-384", "bad-oid", 1, "sha2-384");
    updateHashAlgorithm(
      2,
      384,
      "sha-384",
      "2.16.840.1.101.3.4.2.2",
      1,
      "sha2-384",
    );

    assert.entityCount("HashAlgorithm", 2);
    assert.fieldEquals("HashAlgorithm", "2", "ianaName", "sha-384");
    assert.fieldEquals("HashAlgorithm", "2", "multiHash", "sha2-384");
    assert.fieldEquals("HashAlgorithm", "2", "oid", "2.16.840.1.101.3.4.2.2");
    assert.fieldEquals("HashAlgorithm", "2", "outputLength", "384");
    assert.fieldEquals("HashAlgorithm", "2", "status", "ACTIVE");
  });
});

describe("Timestamps and Records", () => {
  beforeAll(() => {
    // Insert hash algorithm to be used in the following tests
    insertHashAlgorithm(
      1,
      256,
      "sha-256",
      "2.16.840.1.101.3.4.2.1",
      1,
      "sha2-256",
    );
  });

  afterAll(() => {
    clearStore();
  });

  test("Timestamp hashes", () => {
    timestampHashes(
      [
        // timestampIds[x] = sha256(hashValues[x])
        Bytes.fromHexString(
          "0xbf5e8ffa51a9e748985800c1d3d7f1a2a6ae7435136593ca8d9637e3f87c699c",
        ),
      ],
      [1],
      [Bytes.fromHexString("0x00010000")],
      [Bytes.fromHexString("0x00010001")],
    );

    assert.entityCount("TimestampedHash", 1);
    assert.fieldEquals("TimestampedHash", "0x00010000", "hashAlgorithm", "1");
    assert.fieldEquals("TimestampedHash", "0x00010000", "data", "0x00010001");
    assert.fieldEquals(
      "TimestampedHash",
      "0x00010000",
      "hashValue",
      "0x00010000",
    );
    assert.fieldEquals(
      "TimestampedHash",
      "0x00010000",
      "timestampedBy",
      defaultSender,
    );
    assert.fieldEquals(
      "TimestampedHash",
      "0x00010000",
      "blockNumber",
      defaultBlock,
    );
    assert.fieldEquals(
      "TimestampedHash",
      "0x00010000",
      "blockTimestamp",
      defaultTimestamp,
    );
    assert.fieldEquals(
      "TimestampedHash",
      "0x00010000",
      "transactionHash",
      defaultTransactionHash,
    );
    assert.fieldEquals("TimestampedHash", "0x00010000", "records", "[]");

    // Timestamp the same hash again: there should be no new record
    timestampHashes(
      [
        // timestampIds[x] = sha256(hashValues[x])
        Bytes.fromHexString(
          "bf5e8ffa51a9e748985800c1d3d7f1a2a6ae7435136593ca8d9637e3f87c699c",
        ),
      ],
      [1],
      [Bytes.fromHexString("0x00010000")],
      [Bytes.fromHexString("0x00010001")],
    );

    assert.entityCount("TimestampedHash", 1);
  });

  test("Timestamp hashes with different data length", () => {
    timestampHashes(
      [
        // timestampIds[x] = sha256(hashValues[x])
        Bytes.fromHexString(
          "bc3817c13bc4e6f192a840895fa937d252db153efb89bb14a6c2ddf1f9c55409",
        ),
      ],
      [1],
      [Bytes.fromHexString("0x00020000")],
      [],
    );

    assert.entityCount("TimestampedHash", 2);
    assert.fieldEquals("TimestampedHash", "0x00020000", "hashAlgorithm", "1");
    assert.fieldEquals("TimestampedHash", "0x00020000", "data", "0x");
    assert.fieldEquals(
      "TimestampedHash",
      "0x00020000",
      "hashValue",
      "0x00020000",
    );
    assert.fieldEquals(
      "TimestampedHash",
      "0x00020000",
      "timestampedBy",
      defaultSender,
    );
    assert.fieldEquals(
      "TimestampedHash",
      "0x00020000",
      "blockNumber",
      defaultBlock,
    );
    assert.fieldEquals(
      "TimestampedHash",
      "0x00020000",
      "blockTimestamp",
      defaultTimestamp,
    );
    assert.fieldEquals(
      "TimestampedHash",
      "0x00020000",
      "transactionHash",
      defaultTransactionHash,
    );
    assert.fieldEquals("TimestampedHash", "0x00020000", "records", "[]");
  });

  test("Create a new record by using timestampRecordHashes", () => {
    const recordCount = countEntities("Record");
    const recordOwnerCount = countEntities("RecordOwner");
    const versionCount = countEntities("RecordVersion");
    const timestampedHashCount = countEntities("TimestampedHash");

    // Create a new record
    const event = timestampRecordHashes(
      [1],
      [Bytes.fromHexString("0x00030000")],
      [Bytes.fromHexString("0x00ef")],
      Bytes.fromHexString("0xc23e"),
    );

    // Check entities count
    assert.entityCount("Record", recordCount + 1);
    assert.entityCount("RecordOwner", recordOwnerCount + 1);
    assert.entityCount("RecordVersion", versionCount + 1);
    assert.entityCount("TimestampedHash", timestampedHashCount + 1);

    // Load newly created record
    const recordId = getRecordId(
      event.transaction.from,
      event.block.number,
      Bytes.fromHexString("0x00030000"),
    );

    const record = Record.load(recordId);

    if (!record) {
      throw new Error(`Record ${recordId.toHexString()} not found`);
    }

    // Record should have 1 owner
    const recordOwners = record.owners.load();
    assert.i32Equals(1, recordOwners.length);
    const recordOwnerId = recordId.concat(
      Bytes.fromUTF8(event.transaction.from.toHexString().toLowerCase()),
    );
    assert.bytesEquals(recordOwnerId, recordOwners[0].id);

    // Load record owner
    const recordOwner = RecordOwner.load(recordOwnerId);

    if (!recordOwner) {
      throw new Error(`RecordOwner ${recordOwnerId.toHexString()} not found`);
    }

    // Check record owner
    assert.stringEquals(
      event.transaction.from.toHexString(),
      recordOwner.ownerId,
    );
    assert.bigIntEquals(event.block.timestamp, recordOwner.notBefore);
    assert.bigIntEquals(
      BigInt.fromString("18446744073709551615"), // max u64
      recordOwner.notAfter,
    );

    // Load derived versions
    const versions = record.versions.load();

    // Check version
    assert.i32Equals(1, versions.length);
    const recordVersionId = getVersionId(recordId, 0);
    assert.bytesEquals(recordVersionId, versions[0].id);
    assert.bytesEquals(recordId, versions[0].record);
    assert.bigIntEquals(BigInt.fromI32(0), versions[0].versionNumber);
    assert.i32Equals(1, versions[0].infos.length, "Version should have 1 info");
    assert.bytesEquals(Bytes.fromHexString("0xc23e"), versions[0].infos[0]);

    // Check timestamped hashes attached to the version
    assert.i32Equals(
      1,
      versions[0].timestamps.length,
      "Version should have 1 timestamped hash",
    );

    // Load timestamped hash
    const timestampedHash = TimestampedHash.load(versions[0].timestamps[0]);

    if (!timestampedHash) {
      throw new Error(
        `TimestampedHash ${versions[0].timestamps[0].toHexString()} not found`,
      );
    }

    // Check timestamped hash
    assert.bytesEquals(
      Bytes.fromHexString("0x00030000"),
      timestampedHash.hashValue,
    );
    assert.i32Equals(
      1,
      timestampedHash.records.length,
      "TimestampedHash 0x00030000 should have 1 record",
    );
    assert.bytesEquals(recordId, timestampedHash.records[0]);
    assert.stringEquals("1", timestampedHash.hashAlgorithm);
    assert.bytesEquals(
      Bytes.fromHexString("0x00030000"),
      timestampedHash.hashValue,
    );
    assert.bytesEquals(Bytes.fromHexString("0x00ef"), timestampedHash.data);
    assert.addressEquals(
      event.transaction.from,
      Address.fromBytes(timestampedHash.timestampedBy),
    );
    assert.bigIntEquals(event.block.timestamp, timestampedHash.blockTimestamp);
    assert.bigIntEquals(event.block.number, timestampedHash.blockNumber);
    assert.bytesEquals(event.transaction.hash, timestampedHash.transactionHash);
  });

  test("Create a new version on a record by using timestampVersionHashes", () => {
    let recordCount = countEntities("Record");
    let recordOwnerCount = countEntities("RecordOwner");
    let versionCount = countEntities("RecordVersion");
    let timestampedHashCount = countEntities("TimestampedHash");

    // Create a new record
    const firstHashValue = Bytes.fromHexString("0x00040000");
    const timestampRecordHashesEvent = timestampRecordHashes(
      [1],
      [firstHashValue],
      [Bytes.fromHexString("0x00ef")],
      Bytes.fromHexString("0xc23e"),
    );

    // Check entities count
    assert.entityCount("Record", recordCount + 1);
    assert.entityCount("RecordOwner", recordOwnerCount + 1);
    assert.entityCount("RecordVersion", versionCount + 1);
    assert.entityCount("TimestampedHash", timestampedHashCount + 1);

    // Update counts
    recordCount = recordCount + 1;
    recordOwnerCount = recordOwnerCount + 1;
    versionCount = versionCount + 1;
    timestampedHashCount = timestampedHashCount + 1;

    // Create a new version with 1 new timestamped hash, 1 existing timestamped hash tied to a record, and 1 existing timestamped hash not tied to any record
    timestampVersionHashes(
      firstHashValue,
      [1, 1, 1],
      [
        Bytes.fromHexString("0x00040001"),
        Bytes.fromHexString("0x00030000"),
        Bytes.fromHexString("0x00010000"),
      ],
      [Bytes.fromHexString("0x00ef")],
      Bytes.fromHexString("0xc23e"),
    );

    // Check entities count
    assert.entityCount("Record", recordCount);
    assert.entityCount("RecordOwner", recordOwnerCount);
    assert.entityCount("RecordVersion", versionCount + 1);
    assert.entityCount("TimestampedHash", timestampedHashCount + 1);

    // Load newly created record
    const recordId = getRecordId(
      timestampRecordHashesEvent.transaction.from,
      timestampRecordHashesEvent.block.number,
      firstHashValue,
    );

    const record = Record.load(recordId);

    if (!record) {
      throw new Error(`Record ${recordId.toHexString()} not found`);
    }

    // Load versions
    const versions = record.versions.load();

    assert.i32Equals(2, versions.length, "Record should have 2 versions");

    // We can't trust the order of the versions, hence we can simply check that they're all included
    const recordVersion1Id = getVersionId(recordId, 0);
    const recordVersion2Id = getVersionId(recordId, 1);
    const actualVersionIds = versions.map<string>((version) =>
      version.id.toHexString(),
    );
    assertArrayContainsAllValues(
      actualVersionIds,
      [recordVersion1Id.toHexString(), recordVersion2Id.toHexString()],
      "Record should contain the versions [recordVersion1Id, recordVersion2Id]",
    );

    // Check first version
    const recordVersion1 = RecordVersion.load(recordVersion1Id);

    if (!recordVersion1) {
      throw new Error(
        `RecordVersion ${recordVersion1Id.toHexString()} not found`,
      );
    }

    assert.bytesEquals(recordId, recordVersion1.record);
    assert.bigIntEquals(BigInt.fromI32(0), recordVersion1.versionNumber);
    assert.i32Equals(
      1,
      recordVersion1.infos.length,
      "Version should have 1 info",
    );
    assert.bytesEquals(Bytes.fromHexString("0xc23e"), recordVersion1.infos[0]);

    // Check timestamped hashes attached to the version
    assert.i32Equals(
      1,
      recordVersion1.timestamps.length,
      "Version should have 1 timestamped hash",
    );

    // Load timestamped hash
    let timestampedHash = TimestampedHash.load(recordVersion1.timestamps[0]);

    if (!timestampedHash) {
      throw new Error(
        `TimestampedHash ${recordVersion1.timestamps[0].toHexString()} not found`,
      );
    }

    // Check timestamped hash
    assert.bytesEquals(
      Bytes.fromHexString("0x00040000"),
      timestampedHash.hashValue,
    );
    assert.i32Equals(1, timestampedHash.records.length);
    assert.bytesEquals(recordId, timestampedHash.records[0]);
    assert.stringEquals("1", timestampedHash.hashAlgorithm);
    assert.bytesEquals(Bytes.fromHexString("0x00ef"), timestampedHash.data);
    assert.addressEquals(
      timestampRecordHashesEvent.transaction.from,
      Address.fromBytes(timestampedHash.timestampedBy),
    );
    assert.bigIntEquals(
      timestampRecordHashesEvent.block.timestamp,
      timestampedHash.blockTimestamp,
    );
    assert.bigIntEquals(
      timestampRecordHashesEvent.block.number,
      timestampedHash.blockNumber,
    );
    assert.bytesEquals(
      timestampRecordHashesEvent.transaction.hash,
      timestampedHash.transactionHash,
    );

    // Check second version
    const recordVersion2 = RecordVersion.load(recordVersion2Id);

    if (!recordVersion2) {
      throw new Error(
        `RecordVersion ${recordVersion2Id.toHexString()} not found`,
      );
    }

    assert.bytesEquals(recordId, recordVersion2.record);
    assert.bigIntEquals(BigInt.fromI32(1), recordVersion2.versionNumber);
    assert.i32Equals(
      1,
      recordVersion2.infos.length,
      "Version should have 1 info",
    );
    assert.bytesEquals(Bytes.fromHexString("0xc23e"), recordVersion2.infos[0]);

    // Check timestamped hashes attached to the version
    assert.i32Equals(
      3,
      recordVersion2.timestamps.length,
      "Version should have 3 timestamped hashes",
    );

    // Load timestamped hash #1
    timestampedHash = TimestampedHash.load(recordVersion2.timestamps[0]);

    if (!timestampedHash) {
      throw new Error(
        `TimestampedHash ${recordVersion2.timestamps[0].toHexString()} not found`,
      );
    }

    // Check timestamped hash #1
    assert.bytesEquals(
      Bytes.fromHexString("0x00040001"),
      timestampedHash.hashValue,
    );
    assert.i32Equals(1, timestampedHash.records.length);
    assert.bytesEquals(recordId, timestampedHash.records[0]);
    assert.stringEquals("1", timestampedHash.hashAlgorithm);
    assert.bytesEquals(Bytes.fromHexString("0x00ef"), timestampedHash.data);
    assert.addressEquals(
      timestampRecordHashesEvent.transaction.from,
      Address.fromBytes(timestampedHash.timestampedBy),
    );
    assert.bigIntEquals(
      timestampRecordHashesEvent.block.timestamp,
      timestampedHash.blockTimestamp,
    );
    assert.bigIntEquals(
      timestampRecordHashesEvent.block.number,
      timestampedHash.blockNumber,
    );
    assert.bytesEquals(
      timestampRecordHashesEvent.transaction.hash,
      timestampedHash.transactionHash,
    );

    // Load timestamped hash #2
    timestampedHash = TimestampedHash.load(recordVersion2.timestamps[1]);

    if (!timestampedHash) {
      throw new Error(
        `TimestampedHash ${recordVersion2.timestamps[1].toHexString()} not found`,
      );
    }

    // Check timestamped hash #2 (existing timestamped hash tied to another record)
    assert.bytesEquals(
      Bytes.fromHexString("0x00030000"),
      timestampedHash.hashValue,
    );
    assert.i32Equals(
      2,
      timestampedHash.records.length,
      "TimestampedHash 0x00030000 should have 2 records",
    );
    const previousRecordId = getRecordId(
      timestampRecordHashesEvent.transaction.from,
      timestampRecordHashesEvent.block.number,
      Bytes.fromHexString("0x00030000"),
    );
    assertArrayContainsAllValues(
      timestampedHash.records,
      [previousRecordId, recordId],
      "Timestamped hash #2 should contain the 2 records [previousRecordId, recordId]",
    );

    // Load timestamped hash #3
    timestampedHash = TimestampedHash.load(recordVersion2.timestamps[2]);

    if (!timestampedHash) {
      throw new Error(
        `TimestampedHash ${recordVersion2.timestamps[2].toHexString()} not found`,
      );
    }

    // Check timestamped hash #3 (existing timestamped hash not tied to another record)
    assert.bytesEquals(
      Bytes.fromHexString("0x00010000"),
      timestampedHash.hashValue,
    );
    assert.i32Equals(
      1,
      timestampedHash.records.length,
      "TimestampedHash 0x00010000 should have 1 record",
    );
    assertArrayContainsAllValues(
      timestampedHash.records,
      [recordId],
      "Timestamped hash #3 should contain the 1 record [recordId]",
    );
  });

  test("Create a new version on a record by using timestampRecordVersionHashes", () => {
    let recordCount = countEntities("Record");
    let recordOwnerCount = countEntities("RecordOwner");
    let versionCount = countEntities("RecordVersion");
    let timestampedHashCount = countEntities("TimestampedHash");

    // Create a new record
    const firstHashValue = Bytes.fromHexString("0x00050000");
    const timestampRecordHashesEvent = timestampRecordHashes(
      [1],
      [firstHashValue],
      [Bytes.fromHexString("0x00ef")],
      Bytes.fromHexString("0xc23e"),
    );

    // Check entities count
    assert.entityCount("Record", recordCount + 1);
    assert.entityCount("RecordOwner", recordOwnerCount + 1);
    assert.entityCount("RecordVersion", versionCount + 1);
    assert.entityCount("TimestampedHash", timestampedHashCount + 1);

    // Update counts
    recordCount = recordCount + 1;
    recordOwnerCount = recordOwnerCount + 1;
    versionCount = versionCount + 1;
    timestampedHashCount = timestampedHashCount + 1;

    // Compute record ID
    const recordId = getRecordId(
      timestampRecordHashesEvent.transaction.from,
      timestampRecordHashesEvent.block.number,
      firstHashValue,
    );

    // Create a new version with 2 new timestamped hashes
    timestampRecordVersionHashes(
      recordId,
      [1, 1],
      [Bytes.fromHexString("0x00050001"), Bytes.fromHexString("0x00050002")],
      [Bytes.fromHexString("0x00ef")],
      Bytes.fromHexString("0xc23e"),
    );

    // Check entities count
    assert.entityCount("Record", recordCount);
    assert.entityCount("RecordOwner", recordOwnerCount);
    assert.entityCount("RecordVersion", versionCount + 1);
    assert.entityCount("TimestampedHash", timestampedHashCount + 2);

    const record = Record.load(recordId);

    if (!record) {
      throw new Error(`Record ${recordId.toHexString()} not found`);
    }

    // Load versions
    const versions = record.versions.load();

    assert.i32Equals(2, versions.length, "Record should have 2 versions");

    // We can't trust the order of the versions, hence we can simply check that they're all included
    const recordVersion1Id = getVersionId(recordId, 0);
    const recordVersion2Id = getVersionId(recordId, 1);
    const actualVersionIds = versions.map<string>((version) =>
      version.id.toHexString(),
    );
    assertArrayContainsAllValues(
      actualVersionIds,
      [recordVersion1Id.toHexString(), recordVersion2Id.toHexString()],
      "Record should contain the versions [recordVersion1Id, recordVersion2Id]",
    );

    // Check first version
    const recordVersion1 = RecordVersion.load(recordVersion1Id);

    if (!recordVersion1) {
      throw new Error(
        `RecordVersion ${recordVersion1Id.toHexString()} not found`,
      );
    }
    assert.bytesEquals(recordVersion1Id, recordVersion1.id);
    assert.bytesEquals(recordId, recordVersion1.record);
    assert.bigIntEquals(BigInt.fromI32(0), recordVersion1.versionNumber);
    assert.i32Equals(
      1,
      recordVersion1.infos.length,
      "Version should have 1 info",
    );
    assert.bytesEquals(Bytes.fromHexString("0xc23e"), recordVersion1.infos[0]);

    // Check timestamped hashes attached to the version
    assert.i32Equals(
      1,
      recordVersion1.timestamps.length,
      "Version should have 1 timestamped hash",
    );

    // Load timestamped hash
    let timestampedHash = TimestampedHash.load(recordVersion1.timestamps[0]);

    if (!timestampedHash) {
      throw new Error(
        `TimestampedHash ${recordVersion1.timestamps[0].toHexString()} not found`,
      );
    }

    // Check timestamped hash
    assert.bytesEquals(
      Bytes.fromHexString("0x00050000"),
      timestampedHash.hashValue,
    );
    assert.i32Equals(1, timestampedHash.records.length);
    assert.bytesEquals(recordId, timestampedHash.records[0]);
    assert.stringEquals("1", timestampedHash.hashAlgorithm);
    assert.bytesEquals(Bytes.fromHexString("0x00ef"), timestampedHash.data);
    assert.addressEquals(
      timestampRecordHashesEvent.transaction.from,
      Address.fromBytes(timestampedHash.timestampedBy),
    );
    assert.bigIntEquals(
      timestampRecordHashesEvent.block.timestamp,
      timestampedHash.blockTimestamp,
    );
    assert.bigIntEquals(
      timestampRecordHashesEvent.block.number,
      timestampedHash.blockNumber,
    );
    assert.bytesEquals(
      timestampRecordHashesEvent.transaction.hash,
      timestampedHash.transactionHash,
    );

    // Check second version
    const recordVersion2 = RecordVersion.load(recordVersion2Id);

    if (!recordVersion2) {
      throw new Error(
        `RecordVersion ${recordVersion2Id.toHexString()} not found`,
      );
    }

    assert.bigIntEquals(BigInt.fromI32(1), recordVersion2.versionNumber);
    assert.i32Equals(
      1,
      recordVersion2.infos.length,
      "Version should have 1 info",
    );
    assert.bytesEquals(Bytes.fromHexString("0xc23e"), recordVersion2.infos[0]);

    // Check timestamped hashes attached to the version
    assert.i32Equals(
      2,
      recordVersion2.timestamps.length,
      "Version should have 2 timestamped hashes",
    );

    // Load timestamped hash #1
    timestampedHash = TimestampedHash.load(recordVersion2.timestamps[0]);

    if (!timestampedHash) {
      throw new Error(
        `TimestampedHash ${recordVersion2.timestamps[0].toHexString()} not found`,
      );
    }

    // Check timestamped hash #1
    assert.bytesEquals(
      Bytes.fromHexString("0x00050001"),
      timestampedHash.hashValue,
    );
    assert.i32Equals(1, timestampedHash.records.length);
    assert.bytesEquals(recordId, timestampedHash.records[0]);
    assert.stringEquals("1", timestampedHash.hashAlgorithm);
    assert.bytesEquals(Bytes.fromHexString("0x00ef"), timestampedHash.data);
    assert.addressEquals(
      timestampRecordHashesEvent.transaction.from,
      Address.fromBytes(timestampedHash.timestampedBy),
    );
    assert.bigIntEquals(
      timestampRecordHashesEvent.block.timestamp,
      timestampedHash.blockTimestamp,
    );
    assert.bigIntEquals(
      timestampRecordHashesEvent.block.number,
      timestampedHash.blockNumber,
    );
    assert.bytesEquals(
      timestampRecordHashesEvent.transaction.hash,
      timestampedHash.transactionHash,
    );

    // Load timestamped hash #2
    timestampedHash = TimestampedHash.load(recordVersion2.timestamps[1]);

    if (!timestampedHash) {
      throw new Error(
        `TimestampedHash ${recordVersion2.timestamps[1].toHexString()} not found`,
      );
    }

    // Check timestamped hash #2
    assert.bytesEquals(
      Bytes.fromHexString("0x00050002"),
      timestampedHash.hashValue,
    );
    assert.i32Equals(1, timestampedHash.records.length);
    assert.bytesEquals(recordId, timestampedHash.records[0]);
    assert.stringEquals("1", timestampedHash.hashAlgorithm);
    assert.bytesEquals(Bytes.fromHexString("0x"), timestampedHash.data); // Empty value
    assert.addressEquals(
      timestampRecordHashesEvent.transaction.from,
      Address.fromBytes(timestampedHash.timestampedBy),
    );
    assert.bigIntEquals(
      timestampRecordHashesEvent.block.timestamp,
      timestampedHash.blockTimestamp,
    );
    assert.bigIntEquals(
      timestampRecordHashesEvent.block.number,
      timestampedHash.blockNumber,
    );
    assert.bytesEquals(
      timestampRecordHashesEvent.transaction.hash,
      timestampedHash.transactionHash,
    );
  });

  test("Append hashes to an existing version", () => {
    let recordCount = countEntities("Record");
    let recordOwnerCount = countEntities("RecordOwner");
    let versionCount = countEntities("RecordVersion");
    let timestampedHashCount = countEntities("TimestampedHash");

    // Create a new record
    const firstHashValue = Bytes.fromHexString("0x00060000");
    const timestampRecordHashesEvent = timestampRecordHashes(
      [1],
      [firstHashValue],
      [Bytes.fromHexString("0x00ef")],
      Bytes.fromHexString("0xc23e"),
    );

    // Check entities count
    assert.entityCount("Record", recordCount + 1);
    assert.entityCount("RecordOwner", recordOwnerCount + 1);
    assert.entityCount("RecordVersion", versionCount + 1);
    assert.entityCount("TimestampedHash", timestampedHashCount + 1);

    // Update counts
    recordCount = recordCount + 1;
    recordOwnerCount = recordOwnerCount + 1;
    versionCount = versionCount + 1;
    timestampedHashCount = timestampedHashCount + 1;

    // Compute record ID
    const recordId = getRecordId(
      timestampRecordHashesEvent.transaction.from,
      timestampRecordHashesEvent.block.number,
      firstHashValue,
    );

    // Append 2 new timestamped hashes to the existing version 0
    appendRecordVersionHashes(
      recordId,
      0,
      [1, 1],
      [Bytes.fromHexString("0x00060001"), Bytes.fromHexString("0x00060002")],
      [Bytes.fromHexString("0x00ef")],
      Bytes.fromHexString("0xc234"),
    );

    // Check entities count
    assert.entityCount("Record", recordCount);
    assert.entityCount("RecordOwner", recordOwnerCount);
    assert.entityCount("RecordVersion", versionCount);
    assert.entityCount("TimestampedHash", timestampedHashCount + 2);

    const record = Record.load(recordId);

    if (!record) {
      throw new Error(`Record ${recordId.toHexString()} not found`);
    }

    // Load versions
    const versions = record.versions.load();

    assert.i32Equals(1, versions.length, "Record should have 1 version");

    // Check first version
    const recordVersion1Id = getVersionId(recordId, 0);
    assert.bytesEquals(recordVersion1Id, versions[0].id);
    assert.bytesEquals(recordId, versions[0].record);
    assert.bigIntEquals(BigInt.fromI32(0), versions[0].versionNumber);
    assert.i32Equals(2, versions[0].infos.length, "Version should have 2 info");
    assert.bytesEquals(Bytes.fromHexString("0xc23e"), versions[0].infos[0]);
    assert.bytesEquals(Bytes.fromHexString("0xc234"), versions[0].infos[1]);

    // Check timestamped hashes attached to the version
    assert.i32Equals(
      3,
      versions[0].timestamps.length,
      "Version should have 3 timestamped hashes",
    );

    // Load timestamped hash #1
    let timestampedHash = TimestampedHash.load(versions[0].timestamps[0]);

    if (!timestampedHash) {
      throw new Error(
        `TimestampedHash ${versions[0].timestamps[0].toHexString()} not found`,
      );
    }

    // Check timestamped hash #1
    assert.bytesEquals(
      Bytes.fromHexString("0x00060000"),
      timestampedHash.hashValue,
    );
    assert.i32Equals(1, timestampedHash.records.length);
    assert.bytesEquals(recordId, timestampedHash.records[0]);
    assert.stringEquals("1", timestampedHash.hashAlgorithm);
    assert.bytesEquals(Bytes.fromHexString("0x00ef"), timestampedHash.data);
    assert.addressEquals(
      timestampRecordHashesEvent.transaction.from,
      Address.fromBytes(timestampedHash.timestampedBy),
    );
    assert.bigIntEquals(
      timestampRecordHashesEvent.block.timestamp,
      timestampedHash.blockTimestamp,
    );
    assert.bigIntEquals(
      timestampRecordHashesEvent.block.number,
      timestampedHash.blockNumber,
    );
    assert.bytesEquals(
      timestampRecordHashesEvent.transaction.hash,
      timestampedHash.transactionHash,
    );

    // Load timestamped hash #2
    timestampedHash = TimestampedHash.load(versions[0].timestamps[1]);

    if (!timestampedHash) {
      throw new Error(
        `TimestampedHash ${versions[0].timestamps[1].toHexString()} not found`,
      );
    }

    // Check timestamped hash #2
    assert.bytesEquals(
      Bytes.fromHexString("0x00060001"),
      timestampedHash.hashValue,
    );
    assert.i32Equals(1, timestampedHash.records.length);
    assert.bytesEquals(recordId, timestampedHash.records[0]);
    assert.stringEquals("1", timestampedHash.hashAlgorithm);
    assert.bytesEquals(Bytes.fromHexString("0x00ef"), timestampedHash.data);
    assert.addressEquals(
      timestampRecordHashesEvent.transaction.from,
      Address.fromBytes(timestampedHash.timestampedBy),
    );
    assert.bigIntEquals(
      timestampRecordHashesEvent.block.timestamp,
      timestampedHash.blockTimestamp,
    );
    assert.bigIntEquals(
      timestampRecordHashesEvent.block.number,
      timestampedHash.blockNumber,
    );
    assert.bytesEquals(
      timestampRecordHashesEvent.transaction.hash,
      timestampedHash.transactionHash,
    );

    // Load timestamped hash #3
    timestampedHash = TimestampedHash.load(versions[0].timestamps[2]);

    if (!timestampedHash) {
      throw new Error(
        `TimestampedHash ${versions[0].timestamps[2].toHexString()} not found`,
      );
    }

    // Check timestamped hash #3
    assert.bytesEquals(
      Bytes.fromHexString("0x00060002"),
      timestampedHash.hashValue,
    );
    assert.i32Equals(1, timestampedHash.records.length);
    assert.bytesEquals(recordId, timestampedHash.records[0]);
    assert.stringEquals("1", timestampedHash.hashAlgorithm);
    assert.bytesEquals(Bytes.fromHexString("0x"), timestampedHash.data); // Empty data
    assert.addressEquals(
      timestampRecordHashesEvent.transaction.from,
      Address.fromBytes(timestampedHash.timestampedBy),
    );
    assert.bigIntEquals(
      timestampRecordHashesEvent.block.timestamp,
      timestampedHash.blockTimestamp,
    );
    assert.bigIntEquals(
      timestampRecordHashesEvent.block.number,
      timestampedHash.blockNumber,
    );
    assert.bytesEquals(
      timestampRecordHashesEvent.transaction.hash,
      timestampedHash.transactionHash,
    );
  });

  test("Insert a new version info", () => {
    let recordCount = countEntities("Record");
    let recordOwnerCount = countEntities("RecordOwner");
    let versionCount = countEntities("RecordVersion");
    let timestampedHashCount = countEntities("TimestampedHash");

    // Create a new record
    const firstHashValue = Bytes.fromHexString("0x00070000");
    const timestampRecordHashesEvent = timestampRecordHashes(
      [1],
      [firstHashValue],
      [Bytes.fromHexString("0x00ef")],
      Bytes.fromHexString("0xc23e"),
    );

    // Check entities count
    assert.entityCount("Record", recordCount + 1);
    assert.entityCount("RecordOwner", recordOwnerCount + 1);
    assert.entityCount("RecordVersion", versionCount + 1);
    assert.entityCount("TimestampedHash", timestampedHashCount + 1);

    // Update counts
    recordCount = recordCount + 1;
    recordOwnerCount = recordOwnerCount + 1;
    versionCount = versionCount + 1;
    timestampedHashCount = timestampedHashCount + 1;

    // Compute record ID
    const recordId = getRecordId(
      timestampRecordHashesEvent.transaction.from,
      timestampRecordHashesEvent.block.number,
      firstHashValue,
    );

    // Add new version info
    insertRecordVersionInfo(recordId, 0, Bytes.fromHexString("0xc234"));

    // Check entities count
    assert.entityCount("Record", recordCount);
    assert.entityCount("RecordOwner", recordOwnerCount);
    assert.entityCount("RecordVersion", versionCount);
    assert.entityCount("TimestampedHash", timestampedHashCount);

    const record = Record.load(recordId);

    if (!record) {
      throw new Error(`Record ${recordId.toHexString()} not found`);
    }

    // Load versions
    const versions = record.versions.load();

    assert.i32Equals(1, versions.length, "Record should have 1 version");

    // Check first version
    const recordVersion1Id = getVersionId(recordId, 0);
    assert.bytesEquals(recordVersion1Id, versions[0].id);
    assert.bytesEquals(recordId, versions[0].record);
    assert.bigIntEquals(BigInt.fromI32(0), versions[0].versionNumber);
    assert.i32Equals(2, versions[0].infos.length, "Version should have 2 info");
    assert.bytesEquals(Bytes.fromHexString("0xc23e"), versions[0].infos[0]);
    assert.bytesEquals(Bytes.fromHexString("0xc234"), versions[0].infos[1]);
  });

  test("Remove a timestamp from a version", () => {
    let recordCount = countEntities("Record");
    let recordOwnerCount = countEntities("RecordOwner");
    let versionCount = countEntities("RecordVersion");
    let timestampedHashCount = countEntities("TimestampedHash");

    // Create a new record with 2 timestamped hashes
    const firstHashValue = Bytes.fromHexString("0x00080000");
    const timestampRecordHashesEvent = timestampRecordHashes(
      [1, 1],
      [firstHashValue, Bytes.fromHexString("0x00080001")],
      [Bytes.fromHexString("0x00ef"), Bytes.fromHexString("0x00ef")],
      Bytes.fromHexString("0xc23e"),
    );

    // Check entities count
    assert.entityCount("Record", recordCount + 1);
    assert.entityCount("RecordOwner", recordOwnerCount + 1);
    assert.entityCount("RecordVersion", versionCount + 1);
    assert.entityCount("TimestampedHash", timestampedHashCount + 2);

    // Update counts
    recordCount = recordCount + 1;
    recordOwnerCount = recordOwnerCount + 1;
    versionCount = versionCount + 1;
    timestampedHashCount = timestampedHashCount + 2;

    // Compute record ID
    const recordId = getRecordId(
      timestampRecordHashesEvent.transaction.from,
      timestampRecordHashesEvent.block.number,
      firstHashValue,
    );

    // Remove first timestamped hash
    detachRecordVersionHash(recordId, 0, firstHashValue);

    // Check entities count
    assert.entityCount("Record", recordCount);
    assert.entityCount("RecordOwner", recordOwnerCount);
    assert.entityCount("RecordVersion", versionCount);
    assert.entityCount("TimestampedHash", timestampedHashCount);

    const record = Record.load(recordId);

    if (!record) {
      throw new Error(`Record ${recordId.toHexString()} not found`);
    }

    // Load versions
    const versions = record.versions.load();

    assert.i32Equals(1, versions.length, "Record should have 1 version");

    // Check first version
    const recordVersion1Id = getVersionId(recordId, 0);
    assert.bytesEquals(recordVersion1Id, versions[0].id);
    assert.bytesEquals(recordId, versions[0].record);
    assert.bigIntEquals(BigInt.fromI32(0), versions[0].versionNumber);
    assert.i32Equals(1, versions[0].infos.length, "Version should have 1 info");
    assert.bytesEquals(Bytes.fromHexString("0xc23e"), versions[0].infos[0]);

    // Check timestamped hashes attached to the version
    assert.i32Equals(
      1,
      versions[0].timestamps.length,
      `Version should have 1 timestamped hash. Found ${versions[0].timestamps.length} instead`,
    );

    // Load timestamped hash #1
    const timestampedHash = TimestampedHash.load(versions[0].timestamps[0]);

    if (!timestampedHash) {
      throw new Error(
        `TimestampedHash ${versions[0].timestamps[0].toHexString()} not found`,
      );
    }

    // Check timestamped hash #1
    assert.bytesEquals(
      Bytes.fromHexString("0x00080001"),
      timestampedHash.hashValue,
    );
    assert.i32Equals(1, timestampedHash.records.length);
    assert.bytesEquals(recordId, timestampedHash.records[0]);
    assert.stringEquals("1", timestampedHash.hashAlgorithm);
    assert.bytesEquals(Bytes.fromHexString("0x00ef"), timestampedHash.data);
    assert.addressEquals(
      timestampRecordHashesEvent.transaction.from,
      Address.fromBytes(timestampedHash.timestampedBy),
    );
    assert.bigIntEquals(
      timestampRecordHashesEvent.block.timestamp,
      timestampedHash.blockTimestamp,
    );
    assert.bigIntEquals(
      timestampRecordHashesEvent.block.number,
      timestampedHash.blockNumber,
    );
    assert.bytesEquals(
      timestampRecordHashesEvent.transaction.hash,
      timestampedHash.transactionHash,
    );
  });

  test("Insert and revoke record owner", () => {
    const recordCount = countEntities("Record");
    const recordOwnerCount = countEntities("RecordOwner");

    // Create a new record
    const firstHashValue = Bytes.fromHexString("0x00090000");
    const timestampRecordHashesEvent = timestampRecordHashes(
      [1],
      [firstHashValue],
      [Bytes.fromHexString("0x00ef")],
      Bytes.fromHexString("0xc23e"),
    );

    // Check entities count
    assert.entityCount("Record", recordCount + 1);
    assert.entityCount("RecordOwner", recordOwnerCount + 1);

    // Compute record ID
    const recordId = getRecordId(
      timestampRecordHashesEvent.transaction.from,
      timestampRecordHashesEvent.block.number,
      firstHashValue,
    );

    // Insert new record owner
    const newRecordOwner = "0xa16081f360e3847006db660bae1c6d1b2e17ec2b";
    insertRecordOwner(
      recordId,
      newRecordOwner,
      BigInt.fromI32(1000),
      BigInt.fromI32(2000),
    );

    // Check entities count
    assert.entityCount("RecordOwner", recordOwnerCount + 2);

    // Load record
    const record = Record.load(recordId);

    if (!record) {
      throw new Error(`Record ${recordId.toHexString()} not found`);
    }

    // Record should have 2 owners
    let recordOwners = record.owners.load();
    assert.i32Equals(2, recordOwners.length);

    // We can't trust the order of the owners, hence we can simply check that they're all included
    const recordOwner1Id = recordId.concat(
      Bytes.fromUTF8(
        timestampRecordHashesEvent.transaction.from.toHexString().toLowerCase(),
      ),
    );
    const recordOwner2Id = recordId.concat(Bytes.fromUTF8(newRecordOwner));
    const actualRecordOwnerIds = recordOwners.map<string>((recordOwner) =>
      recordOwner.id.toHexString(),
    );
    assertArrayContainsAllValues(
      actualRecordOwnerIds,
      [recordOwner1Id.toHexString(), recordOwner2Id.toHexString()],
      `Record should have the owners [recordOwner1Id, recordOwner2Id]. Expected: [${recordOwner1Id.toHexString()}, ${recordOwner2Id.toHexString()}], Actual: [${actualRecordOwnerIds.join(", ")}]`,
    );

    // Load record owner #1
    const recordOwner1 = RecordOwner.load(recordOwner1Id);

    if (!recordOwner1) {
      throw new Error(`RecordOwner ${recordOwner1Id.toHexString()} not found`);
    }

    // Check record owner #1
    assert.stringEquals(
      timestampRecordHashesEvent.transaction.from.toHexString(),
      recordOwner1.ownerId,
    );
    assert.bigIntEquals(
      timestampRecordHashesEvent.block.timestamp,
      recordOwner1.notBefore,
    );
    assert.bigIntEquals(
      BigInt.fromString("18446744073709551615"), // max u64
      recordOwner1.notAfter,
    );

    // Load record owner #2
    const recordOwner2 = RecordOwner.load(recordOwner2Id);

    if (!recordOwner2) {
      throw new Error(`RecordOwner ${recordOwner2Id.toHexString()} not found`);
    }

    // Check record owner #2
    assert.stringEquals(newRecordOwner, recordOwner2.ownerId);
    assert.bigIntEquals(BigInt.fromI32(1000), recordOwner2.notBefore);
    assert.bigIntEquals(BigInt.fromI32(2000), recordOwner2.notAfter);

    // Revoke record owner #2
    revokeRecordOwner(recordId, newRecordOwner);

    // Check entities count
    assert.entityCount("RecordOwner", recordOwnerCount + 1);

    // Record should have 1 owner
    recordOwners = record.owners.load();
    assert.i32Equals(1, recordOwners.length);
  });
});
