import { BigInt, Bytes, crypto, ethereum } from "@graphprotocol/graph-ts";
import { assert, newMockEvent } from "matchstick-as";

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
} from "../generated/Timestamp/Timestamp";
import {
  handleAddNewHashAlgoEvent,
  handleOwnerIdRevokedEvent,
  handleRecordedHashesEvent,
  handleRecordOwnerAddedEvent,
  handleRecordVersionInfoEvent,
  handleTimestampedHashesEvent,
  handleTimestampIdDetachedEvent,
  handleTimestampVersionHashesEvent,
  handleUpdateHashAlgoEvent,
} from "../src/timestamp-v4/mappings";

/**
 * Create a RecordedHashes event that would be emitted by the contract when calling the `appendRecordVersionHashes` function,
 * given the provided recordId, versionId, hashAlgorithmIds, hashValues, timestampData, and versionInfo.
 *
 * @param recordId A bytes32 identifier for the record.
 * @param versionId The version ID.
 * @param hashAlgorithmIds An array of hash algorithm IDs.
 * @param hashValues An array of hashes.
 * @param timestampData An array of timestamp data.
 * @param versionInfo A bytes array containing the version info.
 * @returns The RecordedHashes event that would be emitted.
 */
export function appendRecordVersionHashes(
  recordId: Bytes,
  versionId: i32,
  hashAlgorithmIds: i32[],
  hashValues: Bytes[],
  timestampData: Bytes[],
  versionInfo: Bytes,
): RecordedHashes {
  // Create appendRecordVersionHashes transaction inputs
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
  const tuple: ethereum.Value[] = [
    ethereum.Value.fromFixedBytes(recordId),
    ethereum.Value.fromI32(versionId),
    ethereum.Value.fromI32Array(hashAlgorithmIds),
    ethereum.Value.fromBytesArray(hashValues),
    ethereum.Value.fromBytesArray(timestampData),
    ethereum.Value.fromBytes(versionInfo),
  ];

  // Create RecordedHashes event that would be emitted by the contract
  const event = changetype<RecordedHashes>(newMockEvent());

  // Note: in the contract, sha256 is used instead of keccak256
  const timestampIds = hashValues.map<Bytes>((hashValue) =>
    Bytes.fromByteArray(crypto.keccak256(hashValue)),
  );

  // Note: in the contract, sha256 is used instead of keccak256
  const versionInfoHash = crypto.keccak256(versionInfo);

  /*
    event RecordedHashes(
      bytes32 indexed recordId,
      bytes32[] timestampIds,
      bytes32 versionInfoHash
    );
  */
  event.parameters = [
    new ethereum.EventParam(
      "recordId",
      ethereum.Value.fromFixedBytes(recordId),
    ),
    new ethereum.EventParam(
      "timestampIds",
      ethereum.Value.fromFixedBytesArray(timestampIds),
    ),
    new ethereum.EventParam(
      "versionInfoHash",
      ethereum.Value.fromFixedBytes(Bytes.fromByteArray(versionInfoHash)),
    ),
  ];

  // Set transaction input
  event.transaction.input = encodeTransactionInput(
    "appendRecordVersionHashes(bytes32,uint256,uint256[],bytes[],bytes[],bytes)",
    ethereum.Value.fromTuple(changetype<ethereum.Tuple>(tuple)),
  );

  // Process event
  handleRecordedHashesEvent(event);

  return event;
}

export function assertArrayContainsAllValues<T>(
  array: T[],
  values: T[],
  message: string,
): void {
  for (let i = 0, k = values.length; i < k; ++i) {
    assert.booleanEquals(true, array.includes(values[i]) as boolean, message);
  }
}

/**
 * Create a TimestampIdDetached event that would be emitted by the contract when calling the `detachRecordVersionHash` function,
 * given the provided recordId, versionId, and hashValue.
 *
 * @param recordId A bytes32 identifier for the record.
 * @param versionId The version ID.
 * @param hashValue The hash value of the timestamp to detach.
 * @returns The TimestampIdDetached event that would be emitted.
 */
export function detachRecordVersionHash(
  recordId: Bytes,
  versionId: i32,
  hashValue: Bytes,
): TimestampIdDetached {
  // Create detachRecordVersionHash transaction inputs
  /*
    detachRecordVersionHash(
      bytes32 recordId,
      uint256 versionId,
      bytes calldata hashValue
    )
  */
  const tuple: ethereum.Value[] = [
    ethereum.Value.fromFixedBytes(recordId),
    ethereum.Value.fromI32(versionId),
    ethereum.Value.fromBytes(hashValue),
  ];

  // Create TimestampIdDetached event that would be emitted by the contract
  const event = changetype<TimestampIdDetached>(newMockEvent());

  const timestampId = Bytes.fromByteArray(crypto.keccak256(hashValue));

  // event TimestampIdDetached(bytes32 timestampId)
  event.parameters = [
    new ethereum.EventParam(
      "timestampId",
      ethereum.Value.fromFixedBytes(timestampId),
    ),
  ];

  // Set transaction input
  event.transaction.input = encodeTransactionInput(
    "detachRecordVersionHash(bytes32,uint256,bytes)",
    ethereum.Value.fromTuple(changetype<ethereum.Tuple>(tuple)),
  );

  // Process event
  handleTimestampIdDetachedEvent(event);

  return event;
}

export function getRecordId(
  from: Bytes,
  blockNumber: BigInt,
  hashValue: Bytes,
): Bytes {
  // In the SC: sha256(abi.encode(msg.sender, block.number, hashValue))
  // In the tests, we use a slightly different record ID (keccak instead of sha256)
  return Bytes.fromByteArray(
    crypto.keccak256(from.concatI32(blockNumber.toI32()).concat(hashValue)),
  );
}

/**
 * Create a AddNewHashAlgo event that would be emitted by the contract when calling the `insertHashAlgorithm` function,
 * given the provided hashAlgorithmId, outputLength, ianaName, oid, status and multiHash.
 *
 * @param hashAlgorithmId The hash algorithm ID.
 * @param outputLength The output length of the hash algorithm.
 * @param ianaName The IANA name of the hash algorithm.
 * @param oid The OID of the hash algorithm.
 * @param status The status of the hash algorithm.
 * @param multiHash The multi hash of the hash algorithm.
 * @returns The AddNewHashAlgo event that would be emitted.
 */
export function insertHashAlgorithm(
  hashAlgorithmId: i32,
  outputLength: i32,
  ianaName: string,
  oid: string,
  status: i32,
  multiHash: string,
): AddNewHashAlgo {
  /*
    insertHashAlgorithm(
      uint256 outputLength,
      string memory ianaName,
      string memory oid,
      Status status,
      string memory multiHash
    )
  */
  const tuple: ethereum.Value[] = [
    ethereum.Value.fromI32(outputLength),
    ethereum.Value.fromString(ianaName),
    ethereum.Value.fromString(oid),
    ethereum.Value.fromI32(status),
    ethereum.Value.fromString(multiHash),
  ];

  const event = changetype<AddNewHashAlgo>(newMockEvent());

  event.parameters = [
    new ethereum.EventParam("hashId", ethereum.Value.fromI32(hashAlgorithmId)),
    new ethereum.EventParam(
      "ianaNameHash",
      ethereum.Value.fromFixedBytes(
        Bytes.fromByteArray(crypto.keccak256(Bytes.fromUTF8(ianaName))),
      ),
    ),
    new ethereum.EventParam(
      "outputLength",
      ethereum.Value.fromI32(outputLength),
    ),
    new ethereum.EventParam("oid", ethereum.Value.fromString(oid)),
    new ethereum.EventParam("status", ethereum.Value.fromI32(status)),
    new ethereum.EventParam("multiHash", ethereum.Value.fromString(multiHash)),
  ];

  // Set transaction input
  event.transaction.input = encodeTransactionInput(
    "insertHashAlgorithm(uint256,string,string,uint8,string)",
    ethereum.Value.fromTuple(changetype<ethereum.Tuple>(tuple)),
  );

  handleAddNewHashAlgoEvent(event);

  return event;
}

/**
 * Create a RecordOwnerAdded event that would be emitted by the contract when calling the `insertRecordOwner` function,
 * given the provided recordId, ownerId, notBefore, and notAfter.
 *
 * @param recordId A bytes32 identifier for the record.
 * @param ownerId The owner of the record.
 * @param notBefore A BigInt representing the date when the record owner becomes valid.
 * @param notAfter A BigInt representing the date when the record owner becomes invalid.
 * @returns The RecordOwnerAdded event that would be emitted.
 */
export function insertRecordOwner(
  recordId: Bytes,
  ownerId: string,
  notBefore: BigInt,
  notAfter: BigInt,
): RecordOwnerAdded {
  // Create insertRecordOwner transaction inputs
  /*
    insertRecordOwner(
      bytes32 recordId,
      string calldata ownerId,
      uint256 notBefore,
      uint256 notAfter
    )
  */
  const tuple: ethereum.Value[] = [
    ethereum.Value.fromFixedBytes(recordId),
    ethereum.Value.fromString(ownerId),
    ethereum.Value.fromUnsignedBigInt(notBefore),
    ethereum.Value.fromUnsignedBigInt(notAfter),
  ];

  // Create RecordOwnerAdded event that would be emitted by the contract
  const event = changetype<RecordOwnerAdded>(newMockEvent());

  // event RecordOwnerAdded(string ownerId)
  event.parameters = [
    new ethereum.EventParam("ownerId", ethereum.Value.fromString(ownerId)),
  ];

  // Set transaction input
  event.transaction.input = encodeTransactionInput(
    "insertRecordOwner(bytes32,string,uint256,uint256)",
    ethereum.Value.fromTuple(changetype<ethereum.Tuple>(tuple)),
  );

  // Process event
  handleRecordOwnerAddedEvent(event);

  return event;
}

/**
 * Create a RecordVersionInfo event that would be emitted by the contract when calling the `insertRecordVersionInfo` function,
 * given the provided recordId, versionId, and versionInfo.
 *
 * @param recordId A bytes32 identifier for the record.
 * @param versionId The version ID.
 * @param versionInfo A bytes array containing the version info.
 * @returns The RecordVersionInfo event that would be emitted.
 */
export function insertRecordVersionInfo(
  recordId: Bytes,
  versionId: i32,
  versionInfo: Bytes,
): RecordVersionInfo {
  // Create insertRecordVersionInfo transaction inputs
  /*
    insertRecordVersionInfo(
      bytes32 recordId,
      uint256 versionId,
      bytes calldata versionInfo
    )
  */
  const tuple: ethereum.Value[] = [
    ethereum.Value.fromFixedBytes(recordId),
    ethereum.Value.fromI32(versionId),
    ethereum.Value.fromBytes(versionInfo),
  ];

  // Create RecordVersionInfo event that would be emitted by the contract
  const event = changetype<RecordVersionInfo>(newMockEvent());

  // Note: in the contract, sha256 is used instead of keccak256
  const versionInfoHash = crypto.keccak256(versionInfo);

  /*
    event RecordVersionInfo(
      bytes32 recordId,
      bytes32 versionInfoHash,
      uint versionId
    )
  */
  event.parameters = [
    new ethereum.EventParam(
      "recordId",
      ethereum.Value.fromFixedBytes(recordId),
    ),
    new ethereum.EventParam(
      "versionInfoHash",
      ethereum.Value.fromFixedBytes(Bytes.fromByteArray(versionInfoHash)),
    ),
    new ethereum.EventParam("versionId", ethereum.Value.fromI32(versionId)),
  ];

  // Set transaction input
  event.transaction.input = encodeTransactionInput(
    "insertRecordVersionInfo(bytes32,uint256,bytes)",
    ethereum.Value.fromTuple(changetype<ethereum.Tuple>(tuple)),
  );

  // Process event
  handleRecordVersionInfoEvent(event);

  return event;
}

/**
 * Create a OwnerIdRevoked event that would be emitted by the contract when calling the `revokeRecordOwner` function,
 * given the provided recordId, and ownerId.
 *
 * @param recordId A bytes32 identifier for the record.
 * @param ownerId The owner of the record.
 * @returns The OwnerIdRevoked event that would be emitted.
 */
export function revokeRecordOwner(
  recordId: Bytes,
  ownerId: string,
): OwnerIdRevoked {
  // Create revokeRecordOwner transaction inputs
  /*
    revokeRecordOwner(
      bytes32 recordId,
      string calldata ownerId
    )
  */
  const tuple: ethereum.Value[] = [
    ethereum.Value.fromFixedBytes(recordId),
    ethereum.Value.fromString(ownerId),
  ];

  // Create OwnerIdRevoked event that would be emitted by the contract
  const event = changetype<OwnerIdRevoked>(newMockEvent());

  // event OwnerIdRevoked(string ownerId)
  event.parameters = [
    new ethereum.EventParam("ownerId", ethereum.Value.fromString(ownerId)),
  ];

  // Set transaction input
  event.transaction.input = encodeTransactionInput(
    "revokeRecordOwner(bytes32,string)",
    ethereum.Value.fromTuple(changetype<ethereum.Tuple>(tuple)),
  );

  // Process event
  handleOwnerIdRevokedEvent(event);

  return event;
}

/**
 * Create a TimestampedHashes event that would be emitted by the contract when calling the `timestampHashes` function,
 * given the provided timestampIds, hashAlgorithmIds, hashValues, and timestampData.
 *
 * @param timestampIds An array of timestamp IDs.
 * @param hashAlgorithmIds An array of hash algorithm IDs.
 * @param hashValues An array of hashes.
 * @param timestampData An array of timestamp data.
 * @returns The TimestampedHashes event that would be emitted.
 */
export function timestampHashes(
  timestampIds: Bytes[],
  hashAlgorithmIds: i32[],
  hashValues: Bytes[],
  timestampData: Bytes[],
): TimestampedHashes {
  const event = changetype<TimestampedHashes>(newMockEvent());

  event.parameters = [
    new ethereum.EventParam(
      "timestampIds",
      ethereum.Value.fromBytesArray(timestampIds),
    ),
    new ethereum.EventParam(
      "hashAlgorithmIds",
      ethereum.Value.fromI32Array(hashAlgorithmIds),
    ),
    new ethereum.EventParam(
      "hashValues",
      ethereum.Value.fromBytesArray(hashValues),
    ),
    new ethereum.EventParam(
      "timestampData",
      ethereum.Value.fromBytesArray(timestampData),
    ),
  ];

  handleTimestampedHashesEvent(event);

  return event;
}

/**
 * Create a RecordedHashes event that would be emitted by the contract when calling the `timestampRecordHashes` function,
 * given the provided hashAlgorithmIds, hashValues, timestampData, and versionInfo.
 *
 * @param hashAlgorithmIds An array of hash algorithm IDs.
 * @param hashValues An array of hashes.
 * @param timestampData An array of timestamp data.
 * @param versionInfo A bytes array containing the version info.
 * @returns The RecordedHashes event that would be emitted.
 */
export function timestampRecordHashes(
  hashAlgorithmIds: i32[],
  hashValues: Bytes[],
  timestampData: Bytes[],
  versionInfo: Bytes,
): RecordedHashes {
  // Create timestampRecordHashes transaction inputs
  /*
    timestampRecordHashes(
      uint256[] calldata hashAlgorithmIds,
      bytes[] calldata hashValues,
      bytes[] calldata timestampData,
      bytes calldata versionInfo
    )
  */
  const tuple: ethereum.Value[] = [
    ethereum.Value.fromI32Array(hashAlgorithmIds),
    ethereum.Value.fromBytesArray(hashValues),
    ethereum.Value.fromBytesArray(timestampData),
    ethereum.Value.fromBytes(versionInfo),
  ];

  // Create RecordedHashes event that would be emitted by the contract
  const event = changetype<RecordedHashes>(newMockEvent());

  const recordId = getRecordId(
    event.transaction.from,
    event.block.number,
    hashValues[0],
  );

  // Note: in the contract, sha256 is used instead of keccak256
  const timestampIds = hashValues.map<Bytes>((hashValue) =>
    Bytes.fromByteArray(crypto.keccak256(hashValue)),
  );

  // Note: in the contract, sha256 is used instead of keccak256
  const versionInfoHash = crypto.keccak256(versionInfo);

  /*
    event RecordedHashes(
      bytes32 indexed recordId,
      bytes32[] timestampIds,
      bytes32 versionInfoHash
    );
  */
  event.parameters = [
    new ethereum.EventParam(
      "recordId",
      ethereum.Value.fromFixedBytes(recordId),
    ),
    new ethereum.EventParam(
      "timestampIds",
      ethereum.Value.fromFixedBytesArray(timestampIds),
    ),
    new ethereum.EventParam(
      "versionInfoHash",
      ethereum.Value.fromFixedBytes(Bytes.fromByteArray(versionInfoHash)),
    ),
  ];

  // Set transaction input
  event.transaction.input = encodeTransactionInput(
    "timestampRecordHashes(uint256[],bytes[],bytes[],bytes)",
    ethereum.Value.fromTuple(changetype<ethereum.Tuple>(tuple)),
  );

  // Process event
  handleRecordedHashesEvent(event);

  return event;
}

/**
 * Create a RecordedHashes event that would be emitted by the contract when calling the `timestampRecordVersionHashes` function,
 * given the provided recordId, hashAlgorithmIds, hashValues, timestampData, and versionInfo.
 *
 * @param recordId A bytes32 identifier for the record.
 * @param hashAlgorithmIds An array of hash algorithm IDs.
 * @param hashValues An array of hashes.
 * @param timestampData An array of timestamp data.
 * @param versionInfo A bytes array containing the version info.
 * @returns The RecordedHashes event that would be emitted.
 */
export function timestampRecordVersionHashes(
  recordId: Bytes,
  hashAlgorithmIds: i32[],
  hashValues: Bytes[],
  timestampData: Bytes[],
  versionInfo: Bytes,
): RecordedHashes {
  // Create timestampRecordVersionHashes transaction inputs
  /*
    timestampRecordVersionHashes(
      bytes32 recordId,
      uint256[] calldata hashAlgorithmIds,
      bytes[] calldata hashValues,
      bytes[] calldata timestampData,
      bytes calldata versionInfo
    )
  */
  const tuple: ethereum.Value[] = [
    ethereum.Value.fromFixedBytes(recordId),
    ethereum.Value.fromI32Array(hashAlgorithmIds),
    ethereum.Value.fromBytesArray(hashValues),
    ethereum.Value.fromBytesArray(timestampData),
    ethereum.Value.fromBytes(versionInfo),
  ];

  // Create RecordedHashes event that would be emitted by the contract
  const event = changetype<RecordedHashes>(newMockEvent());

  // Note: in the contract, sha256 is used instead of keccak256
  const timestampIds = hashValues.map<Bytes>((hashValue) =>
    Bytes.fromByteArray(crypto.keccak256(hashValue)),
  );

  // Note: in the contract, sha256 is used instead of keccak256
  const versionInfoHash = crypto.keccak256(versionInfo);

  /*
    event RecordedHashes(
      bytes32 indexed recordId,
      bytes32[] timestampIds,
      bytes32 versionInfoHash
    );
  */
  event.parameters = [
    new ethereum.EventParam(
      "recordId",
      ethereum.Value.fromFixedBytes(recordId),
    ),
    new ethereum.EventParam(
      "timestampIds",
      ethereum.Value.fromFixedBytesArray(timestampIds),
    ),
    new ethereum.EventParam(
      "versionInfoHash",
      ethereum.Value.fromFixedBytes(Bytes.fromByteArray(versionInfoHash)),
    ),
  ];

  // Set transaction input
  event.transaction.input = encodeTransactionInput(
    "timestampRecordVersionHashes(bytes32,uint256[],bytes[],bytes[],bytes)",
    ethereum.Value.fromTuple(changetype<ethereum.Tuple>(tuple)),
  );

  // Process event
  handleRecordedHashesEvent(event);

  return event;
}

/**
 * Create a TimestampVersionHashes event that would be emitted by the contract when calling the `timestampVersionHashes` function,
 * given the provided versionHash, hashAlgorithmIds, hashValues, timestampData, and versionInfo.
 *
 * @param versionHash A bytes array containing the version hash.
 * @param hashAlgorithmIds An array of hash algorithm IDs.
 * @param hashValues An array of hashes.
 * @param timestampData An array of timestamp data.
 * @param versionInfo A bytes array containing the version info.
 * @returns The TimestampVersionHashes event that would be emitted.
 */
export function timestampVersionHashes(
  versionHash: Bytes,
  hashAlgorithmIds: i32[],
  hashValues: Bytes[],
  timestampData: Bytes[],
  versionInfo: Bytes,
): TimestampVersionHashes {
  // Create timestampVersionHashes transaction inputs
  /*
    timestampVersionHashes(
      bytes calldata versionHash,
      uint256[] calldata hashAlgorithmIds,
      bytes[] calldata hashValues,
      bytes[] calldata timestampData,
      bytes calldata versionInfo
    )
  */
  const tuple: ethereum.Value[] = [
    ethereum.Value.fromBytes(versionHash),
    ethereum.Value.fromI32Array(hashAlgorithmIds),
    ethereum.Value.fromBytesArray(hashValues),
    ethereum.Value.fromBytesArray(timestampData),
    ethereum.Value.fromBytes(versionInfo),
  ];

  // Create TimestampVersionHashes event that would be emitted by the contract
  const event = changetype<TimestampVersionHashes>(newMockEvent());

  // Note: in the contract, sha256 is used instead of keccak256
  const timestampIds = hashValues.map<Bytes>((hashValue) =>
    Bytes.fromByteArray(crypto.keccak256(hashValue)),
  );

  /*
    event TimestampVersionHashes(
      bytes versionHash,
      bytes32[] timestampIds,
      bytes versionInfo
    );
  */
  event.parameters = [
    new ethereum.EventParam(
      "versionHash",
      ethereum.Value.fromBytes(versionHash),
    ),
    new ethereum.EventParam(
      "timestampIds",
      ethereum.Value.fromFixedBytesArray(timestampIds),
    ),
    new ethereum.EventParam(
      "versionInfo",
      ethereum.Value.fromBytes(versionInfo),
    ),
  ];

  // Set transaction input
  event.transaction.input = encodeTransactionInput(
    "timestampVersionHashes(bytes,uint256[],bytes[],bytes[],bytes)",
    ethereum.Value.fromTuple(changetype<ethereum.Tuple>(tuple)),
  );

  // Process event
  handleTimestampVersionHashesEvent(event);

  return event;
}

/**
 * Create a UpdateHashAlgo event that would be emitted by the contract when calling the `updateHashAlgorithm` function,
 * given the provided hashAlgorithmId, outputLength, ianaName, oid, status and multiHash.
 *
 * @param hashAlgorithmId The hash algorithm ID.
 * @param outputLength The output length of the hash algorithm.
 * @param ianaName The IANA name of the hash algorithm.
 * @param oid The OID of the hash algorithm.
 * @param status The status of the hash algorithm.
 * @param multiHash The multi hash of the hash algorithm.
 * @returns The UpdateHashAlgo event that would be emitted.
 */
export function updateHashAlgorithm(
  hashAlgorithmId: i32,
  outputLength: i32,
  ianaName: string,
  oid: string,
  status: i32,
  multiHash: string,
): UpdateHashAlgo {
  const event = changetype<UpdateHashAlgo>(newMockEvent());

  event.parameters = [
    new ethereum.EventParam("hashId", ethereum.Value.fromI32(hashAlgorithmId)),
    new ethereum.EventParam(
      "ianaNameHash",
      ethereum.Value.fromString(ianaName),
    ),
    new ethereum.EventParam("ianaName", ethereum.Value.fromString(ianaName)),
    new ethereum.EventParam(
      "outputLength",
      ethereum.Value.fromI32(outputLength),
    ),
    new ethereum.EventParam("oid", ethereum.Value.fromString(oid)),
    new ethereum.EventParam("status", ethereum.Value.fromI32(status)),
    new ethereum.EventParam("multiHash", ethereum.Value.fromString(multiHash)),
  ];

  handleUpdateHashAlgoEvent(event);

  return event;
}

function encodeTransactionInput(
  functionSig: string,
  value: ethereum.Value,
): Bytes {
  const encoded = ethereum.encode(value);

  if (!encoded) {
    throw new Error("Failed to encode transaction input");
  }

  // Get function signature hash
  const sigHash = new Bytes(4);
  sigHash.set(crypto.keccak256(Bytes.fromUTF8(functionSig)).slice(0, 4));

  // Replace 0x0000000000000000000000000000000000000000000000000000000000000020 with the function signature
  return Bytes.fromHexString(
    encoded
      .toHexString()
      .replace(
        "0x0000000000000000000000000000000000000000000000000000000000000020",
        sigHash.toHexString(),
      ),
  );
}
