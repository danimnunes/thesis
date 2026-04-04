import { BigInt, Bytes, ethereum, log, store } from "@graphprotocol/graph-ts";

import {
  HashAlgorithm,
  Record,
  RecordOwner,
  RecordVersion,
  TimestampedHash,
} from "../../generated/schema";
import {
  AddNewHashAlgo,
  OwnerIdRevoked,
  RecordedHashes,
  RecordOwnerAdded,
  RecordVersionInfo,
  TimestampedHashes,
  TimestampIdDetached,
  TimestampVersionHashes,
  UpdateHashAlgo,
} from "../../generated/Timestamp/Timestamp";
import { decodeTransactionInput, getStatus, getVersionId } from "./utils";

// List of function signature hashes (see https://web3tools.chainstacklabs.com/generate-solidity-functions-signature)
// 0x36144701 <-> insertHashAlgorithm(uint256,string,string,uint8,string)
// 0xac909e7c <-> timestampVersionHashes(bytes,uint256[],bytes[],bytes[],bytes)
// 0x4e94e93c <-> timestampRecordHashes(uint256[],bytes[],bytes[],bytes)
// 0x4b9e4322 <-> timestampRecordVersionHashes(bytes32,uint256[],bytes[],bytes[],bytes)
// 0x3b280237 <-> appendRecordVersionHashes(bytes32,uint256,uint256[],bytes[],bytes[],bytes)
// 0xd688c00e <-> insertRecordVersionInfo(bytes32,uint256,bytes)
// 0xa6253dcc <-> detachRecordVersionHash(bytes32,uint256,bytes)
// 0xb25ed476 <-> insertRecordOwner(bytes32,string,uint256,uint256)
// 0xca803c63 <-> revokeRecordOwner(bytes32,string)

export function handleAddNewHashAlgoEvent(event: AddNewHashAlgo): void {
  log.info("Handling AddNewHashAlgo event", []);

  // Parse transaction input
  /*
    insertHashAlgorithm(
      uint256 outputLength,
      string memory ianaName,
      string memory oid,
      Status status,
      string memory multiHash
    )
  */
  const decoded = decodeTransactionInput(
    "insertHashAlgorithm(uint256,string,string,uint8,string)",
    event.transaction,
  );

  if (!decoded) {
    log.error("Failed to decode insertHashAlgorithm input - {}", [
      event.transaction.input.toHexString(),
    ]);
    return;
  }

  const txInputs = decoded.toTuple();
  const ianaName = txInputs[1].toString();

  const hashAlgorithm = new HashAlgorithm(event.params.hashId.toString());

  hashAlgorithm.ianaName = ianaName;
  hashAlgorithm.multiHash = event.params.multiHash;
  hashAlgorithm.oid = event.params.oid;
  hashAlgorithm.outputLength = event.params.outputLength;
  hashAlgorithm.status = getStatus(event.params.status);

  hashAlgorithm.save();
}

export function handleOwnerIdRevokedEvent(event: OwnerIdRevoked): void {
  log.info("Handling OwnerIdRevoked event", []);

  // Parse transaction input
  /*
    revokeRecordOwner(
      bytes32 recordId,
      string calldata ownerId
    )
  */
  const decoded = decodeTransactionInput(
    "revokeRecordOwner(bytes32,string)",
    event.transaction,
  );

  if (!decoded) {
    log.error("Failed to decode revokeRecordOwner input - {}", [
      event.transaction.input.toHexString(),
    ]);
    return;
  }

  const txInputs = decoded.toTuple();
  const recordId = txInputs[0].toBytes();
  const ownerId = txInputs[1].toString();

  const record = new Record(recordId);

  if (!record) {
    log.error("Record {} not found", [recordId.toHexString()]);
    return;
  }

  const recordOwnerId = record.id.concat(Bytes.fromUTF8(ownerId));

  // Load record owner
  const recordOwner = RecordOwner.load(recordOwnerId);

  if (!recordOwner) {
    log.error("RecordOwner {} not found", [recordOwnerId.toHexString()]);
    return;
  }

  // Revoke record owner
  store.remove("RecordOwner", recordOwnerId.toHexString());
}

export function handleRecordedHashesEvent(event: RecordedHashes): void {
  log.info("Handling RecordedHashes event", []);

  // The invoked method is either:
  // 0x4e94e93c <-> timestampRecordHashes(uint256[],bytes[],bytes[],bytes)
  // 0x4b9e4322 <-> timestampRecordVersionHashes(bytes32,uint256[],bytes[],bytes[],bytes)
  // 0x3b280237 <-> appendRecordVersionHashes(bytes32,uint256,uint256[],bytes[],bytes[],bytes)

  const fnSignatureBytes = new Bytes(4);
  fnSignatureBytes.set(event.transaction.input.slice(0, 4));

  if (fnSignatureBytes.equals(Bytes.fromHexString("0x4e94e93c"))) {
    return handleTimestampRecordHashesCall(event);
  } else if (fnSignatureBytes.equals(Bytes.fromHexString("0x4b9e4322"))) {
    return handleTimestampRecordVersionHashesCall(event);
  } else if (fnSignatureBytes.equals(Bytes.fromHexString("0x3b280237"))) {
    return handleAppendRecordVersionHashesCall(event);
  }

  log.error("Unhandled function signature {}", [
    fnSignatureBytes.toHexString(),
  ]);
}

export function handleRecordOwnerAddedEvent(event: RecordOwnerAdded): void {
  log.info("Handling RecordOwnerAdded event", []);

  // Parse transaction input
  /*
    insertRecordOwner(
      bytes32 recordId,
      string calldata ownerId,
      uint256 notBefore,
      uint256 notAfter
    )
  */
  const decoded = decodeTransactionInput(
    "insertRecordOwner(bytes32,string,uint256,uint256)",
    event.transaction,
  );

  if (!decoded) {
    log.error("Failed to decode insertRecordOwner input - {}", [
      event.transaction.input.toHexString(),
    ]);
    return;
  }

  const txInputs = decoded.toTuple();
  const recordId = txInputs[0].toBytes();
  const ownerId = txInputs[1].toString();
  const notBefore = txInputs[2].toBigInt();
  const notAfter = txInputs[3].toBigInt();

  const record = new Record(recordId);

  if (!record) {
    log.error("Record {} not found", [recordId.toHexString()]);
    return;
  }

  const recordOwnerId = record.id.concat(Bytes.fromUTF8(ownerId));

  // Create record owner
  const recordOwner = new RecordOwner(recordOwnerId);
  recordOwner.notBefore = notBefore;
  recordOwner.notAfter = notAfter;
  recordOwner.ownerId = ownerId;
  recordOwner.record = record.id;
  recordOwner.save();
}

export function handleRecordVersionInfoEvent(event: RecordVersionInfo): void {
  log.info("Handling RecordVersionInfo event", []);

  // Load existing record
  const record = Record.load(event.params.recordId);

  if (!record) {
    log.error("Record {} not found", [event.params.recordId.toHexString()]);
    return;
  }

  // Load existing version
  const version = RecordVersion.load(
    getVersionId(record.id, event.params.versionId.toI32()),
  );

  if (!version) {
    log.error("Version {} not found", [event.params.versionId.toHexString()]);
    return;
  }

  // Parse transaction input
  /*
    insertRecordVersionInfo(
      bytes32 recordId,
      uint256 versionId,
      bytes calldata versionInfo
    )
  */
  const decoded = decodeTransactionInput(
    "insertRecordVersionInfo(bytes32,uint256,bytes)",
    event.transaction,
  );

  if (!decoded) {
    log.error("Failed to decode insertRecordVersionInfo input - {}", [
      event.transaction.input.toHexString(),
    ]);
    return;
  }

  const txInputs = decoded.toTuple();
  const versionInfo = txInputs[2].toBytes();

  // Add new version info
  const infos = version.infos;
  infos.push(versionInfo);
  version.infos = infos;

  version.save();
}

export function handleTimestampedHashesEvent(event: TimestampedHashes): void {
  log.info("Handling TimestampedHashes event", []);

  recordTimestampedHashes(
    event.params.hashAlgorithmIds,
    event.params.hashValues,
    event.params.timestampData,
    [],
    event.block,
    event.transaction,
  );
}

export function handleTimestampIdDetachedEvent(
  event: TimestampIdDetached,
): void {
  log.info("Handling TimestampIdDetached event", []);

  // Parse transaction input
  /*
    detachRecordVersionHash(
      bytes32 recordId,
      uint256 versionId,
      bytes calldata hashValue
    )
  */
  const decoded = decodeTransactionInput(
    "detachRecordVersionHash(bytes32,uint256,bytes)",
    event.transaction,
  );

  if (!decoded) {
    log.error("Failed to decode detachRecordVersionHash input - {}", [
      event.transaction.input.toHexString(),
    ]);
    return;
  }

  const txInputs = decoded.toTuple();
  const recordId = txInputs[0].toBytes();
  const versionId = txInputs[1].toBigInt();
  const hashValue = txInputs[2].toBytes();

  // Load existing record
  const record = Record.load(recordId);

  if (!record) {
    log.error("Record {} not found", [recordId.toHexString()]);
    return;
  }

  // Load existing version
  const version = RecordVersion.load(
    getVersionId(record.id, versionId.toI32()),
  );

  if (!version) {
    log.error("Version {} not found", [versionId.toHexString()]);
    return;
  }

  // Remove timestamp from version
  const timestamps: Bytes[] = [];
  for (let i = 0; i < version.timestamps.length; i += 1) {
    if (version.timestamps[i].equals(hashValue)) {
      log.info("Timestamp {} detached from version {} of record {}", [
        hashValue.toHexString(),
        version.id.toHexString(),
        record.id.toHexString(),
      ]);
    } else {
      timestamps.push(version.timestamps[i]);
    }
  }
  version.timestamps = timestamps;

  version.save();
}

export function handleTimestampVersionHashesEvent(
  event: TimestampVersionHashes,
): void {
  log.info("Handling timestampVersionHashes event", []);

  const timestampedHash = TimestampedHash.load(event.params.versionHash);

  if (!timestampedHash) {
    log.error("TimestampedHash {} not found", [
      event.params.versionHash.toHexString(),
    ]);
    return;
  }

  if (timestampedHash.records.length !== 1) {
    log.error("TimestampedHash {} does not have 1 record", [
      event.params.versionHash.toHexString(),
    ]);
    return;
  }

  // Load existing record
  const record = Record.load(timestampedHash.records[0]);

  if (!record) {
    log.error("Record {} not found", [
      timestampedHash.records[0].toHexString(),
    ]);
    return;
  }

  const versions = record.versions.load();

  // Create new version
  const nextVersionId = versions.length;

  const version = new RecordVersion(getVersionId(record.id, nextVersionId));

  // Parse transaction input
  /*
    timestampVersionHashes(
      bytes calldata versionHash,
      uint256[] calldata hashAlgorithmIds,
      bytes[] calldata hashValues,
      bytes[] calldata timestampData,
      bytes calldata versionInfo
    )
  */
  const decoded = decodeTransactionInput(
    "timestampVersionHashes(bytes,uint256[],bytes[],bytes[],bytes)",
    event.transaction,
  );

  if (!decoded) {
    log.error("Failed to decode timestampVersionHashes input - {}", [
      event.transaction.input.toHexString(),
    ]);
    return;
  }

  const txInputs = decoded.toTuple();
  const hashAlgorithmIds = txInputs[1].toBigIntArray();
  const hashValues = txInputs[2].toBytesArray();
  const timestampData = txInputs[3].toBytesArray();

  recordTimestampedHashes(
    hashAlgorithmIds,
    hashValues,
    timestampData,
    [record.id],
    event.block,
    event.transaction,
  );

  version.timestamps = hashValues;
  version.versionNumber = BigInt.fromU32(nextVersionId);
  version.record = record.id;
  version.infos = [event.params.versionInfo];
  version.save();

  // Save record
  record.save();
}

export function handleUpdateHashAlgoEvent(event: UpdateHashAlgo): void {
  log.info("Handling UpdateHashAlgo event", []);

  const hashAlgorithm = HashAlgorithm.load(event.params.hashId.toString());

  if (!hashAlgorithm) {
    log.error("HashAlgorithm {} not found", [
      event.params.hashId.toHexString(),
    ]);
    return;
  }

  hashAlgorithm.ianaName = event.params.ianaName;
  hashAlgorithm.multiHash = event.params.multiHash;
  hashAlgorithm.oid = event.params.oid;
  hashAlgorithm.outputLength = event.params.outputLength;
  hashAlgorithm.status = getStatus(event.params.status);

  hashAlgorithm.save();
}

function handleAppendRecordVersionHashesCall(event: RecordedHashes): void {
  log.info("Handling appendRecordVersionHashes call", []);

  // Load existing record
  const record = Record.load(event.params.recordId);

  if (!record) {
    log.error("Record {} not found", [event.params.recordId.toHexString()]);
    return;
  }

  // Parse transaction input
  /*
    appendRecordVersionHashes(
      bytes32 recordId,
      uint256 versionId,
      uint256[] calldata hashAlgorithmIds,
      bytes[] calldata hashValues,
      bytes[] calldata timestampData,
      bytes calldata versionInfo
    )
  */
  const decoded = decodeTransactionInput(
    "appendRecordVersionHashes(bytes32,uint256,uint256[],bytes[],bytes[],bytes)",
    event.transaction,
  );

  if (!decoded) {
    log.error("Failed to decode appendRecordVersionHashes input - {}", [
      event.transaction.input.toHexString(),
    ]);
    return;
  }

  const txInputs = decoded.toTuple();
  const versionId = txInputs[1].toBigInt();
  const hashAlgorithmIds = txInputs[2].toBigIntArray();
  const hashValues = txInputs[3].toBytesArray();
  const timestampData = txInputs[4].toBytesArray();
  const versionInfo = txInputs[5].toBytes();

  // Load existing version
  const version = RecordVersion.load(
    getVersionId(record.id, versionId.toI32()),
  );

  if (!version) {
    log.error("Version {} not found", [versionId.toHexString()]);
    return;
  }

  recordTimestampedHashes(
    hashAlgorithmIds,
    hashValues,
    timestampData,
    [record.id],
    event.block,
    event.transaction,
  );

  // Add timestamps to version
  const timestamps = version.timestamps;
  for (let i = 0; i < hashValues.length; i += 1) {
    timestamps.push(hashValues[i]);
  }
  version.timestamps = timestamps;

  // Add version info
  if (versionInfo.byteLength > 0) {
    const infos = version.infos;
    infos.push(versionInfo);
    version.infos = infos;
  }

  version.save();
}

function handleTimestampRecordHashesCall(event: RecordedHashes): void {
  log.info("Handling timestampRecordHashes call", []);

  // Create record
  const recordId = event.params.recordId;
  const record = new Record(recordId);

  const ownerId = event.transaction.from.toHexString().toLowerCase();
  const recordOwnerId = record.id.concat(Bytes.fromUTF8(ownerId));
  const recordOwner = new RecordOwner(recordOwnerId);
  recordOwner.notBefore = event.block.timestamp;
  recordOwner.notAfter = BigInt.fromString("18446744073709551615"); // max u64
  recordOwner.ownerId = ownerId;
  recordOwner.record = record.id;
  recordOwner.save();

  // Parse transaction input
  /*
    timestampRecordHashes(
      uint256[] calldata hashAlgorithmIds,
      bytes[] calldata hashValues,
      bytes[] calldata timestampData,
      bytes calldata versionInfo
    )
  */
  const decoded = decodeTransactionInput(
    "timestampRecordHashes(uint256[],bytes[],bytes[],bytes)",
    event.transaction,
  );

  if (!decoded) {
    log.error("Failed to decode timestampRecordHashes input - {}", [
      event.transaction.input.toHexString(),
    ]);
    return;
  }

  const txInputs = decoded.toTuple();
  const hashAlgorithmIds = txInputs[0].toBigIntArray();
  const hashValues = txInputs[1].toBytesArray();
  const timestampData = txInputs[2].toBytesArray();
  const versionInfo = txInputs[3].toBytes();

  // Create timestamps
  recordTimestampedHashes(
    hashAlgorithmIds,
    hashValues,
    timestampData,
    [recordId],
    event.block,
    event.transaction,
  );

  // Create version
  const version = new RecordVersion(getVersionId(record.id, 0));
  version.timestamps = hashValues; // hash values are used a timestamp ID
  version.versionNumber = BigInt.fromU32(0);
  version.record = record.id;
  version.infos = [versionInfo];
  version.save();

  // Save record
  record.save();
}

function handleTimestampRecordVersionHashesCall(event: RecordedHashes): void {
  log.info("Handling timestampRecordVersionHashes call", []);

  // Load existing record
  const record = Record.load(event.params.recordId);

  if (!record) {
    log.error("Record {} not found", [event.params.recordId.toHexString()]);
    return;
  }

  const versions = record.versions.load();

  // Create new version
  const nextVersionId = versions.length;

  const version = new RecordVersion(getVersionId(record.id, nextVersionId));

  // Parse transaction input
  /*
    timestampRecordVersionHashes(
      bytes32 recordId,
      uint256[] calldata hashAlgorithmIds,
      bytes[] calldata hashValues,
      bytes[] calldata timestampData,
      bytes calldata versionInfo
    )
  */
  const decoded = decodeTransactionInput(
    "timestampRecordVersionHashes(bytes32,uint256[],bytes[],bytes[],bytes)",
    event.transaction,
  );

  if (!decoded) {
    log.error("Failed to decode timestampRecordVersionHashes input - {}", [
      event.transaction.input.toHexString(),
    ]);
    return;
  }

  const txInputs = decoded.toTuple();
  const hashAlgorithmIds = txInputs[1].toBigIntArray();
  const hashValues = txInputs[2].toBytesArray();
  const timestampData = txInputs[3].toBytesArray();
  const versionInfo = txInputs[4].toBytes();

  recordTimestampedHashes(
    hashAlgorithmIds,
    hashValues,
    timestampData,
    [record.id],
    event.block,
    event.transaction,
  );

  version.timestamps = hashValues;
  version.versionNumber = BigInt.fromU32(nextVersionId);
  version.record = record.id;
  version.infos = [versionInfo];
  version.save();
}

function recordTimestampedHashes(
  hashAlgorithmIds: BigInt[],
  hashValues: Bytes[],
  timestampData: Bytes[],
  records: Bytes[],
  block: ethereum.Block,
  transaction: ethereum.Transaction,
): void {
  for (let i = 0; i < hashAlgorithmIds.length; i += 1) {
    let timestamp = TimestampedHash.load(hashValues[i]);

    if (timestamp) {
      const allRecords = timestamp.records.concat(records);
      timestamp.records = allRecords;
    } else {
      timestamp = new TimestampedHash(hashValues[i]);

      timestamp.blockNumber = block.number;
      timestamp.blockTimestamp = block.timestamp;
      timestamp.timestampedBy = transaction.from;
      timestamp.transactionHash = transaction.hash;
      timestamp.hashAlgorithm = hashAlgorithmIds[i].toString();
      timestamp.hashValue = hashValues[i];
      timestamp.records = records;
      timestamp.data =
        i < timestampData.length ? timestampData[i] : new Bytes(0);
    }

    timestamp.save();
  }
}
