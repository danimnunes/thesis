import { BigInt, Bytes, ethereum } from "@graphprotocol/graph-ts";
import { assert, newMockEvent } from "matchstick-as";

import {
  AccessGranted,
  AccessRevoked,
  DidEbsiAuthorised,
  DocumentCreated,
  DocumentRemoved,
  EventWritten,
} from "../generated/TrackAndTrace/TrackAndTrace";

export function assertArrayContainsAllValues<T>(
  array: T[],
  values: T[],
  message: string,
): void {
  for (let i = 0, k = values.length; i < k; ++i) {
    assert.booleanEquals(true, array.includes(values[i]) as boolean, message);
  }
}

export function createAccessGrantedEvent(
  docHash: string,
  subject: string,
  signer: string,
  permission: string,
): AccessGranted {
  const event = changetype<AccessGranted>(newMockEvent());
  event.parameters = [
    paramBytes("docHash", Bytes.fromHexString(docHash)),
    paramBytes("subject", Bytes.fromHexString(subject)),
    paramBytes("signer", Bytes.fromHexString(signer)),
    paramI32("permission", permission == "DELEGATE" ? 0 : 1),
  ];
  return event;
}

export function createAccessRevokedEvent(
  docHash: string,
  subject: string,
  signer: string,
): AccessRevoked {
  const event = changetype<AccessRevoked>(newMockEvent());
  event.parameters = [
    paramBytes("docHash", Bytes.fromHexString(docHash)),
    paramBytes("subject", Bytes.fromHexString(subject)),
    paramBytes("signer", Bytes.fromHexString(signer)),
  ];
  return event;
}

export function createDidEbsiAuthorisedEvent(
  did: string,
  val: boolean,
): DidEbsiAuthorised {
  const event = changetype<DidEbsiAuthorised>(newMockEvent());
  event.parameters = [paramString("did", did), paramBoolean("val", val)];
  return event;
}

export function createDocumentCreatedEvent(
  docHash: string,
  metadata: string,
  creator: string,
  timestamp: u64,
  source: string,
  proof: string,
): DocumentCreated {
  const event = changetype<DocumentCreated>(newMockEvent());
  event.parameters = [
    paramBytes("docHash", Bytes.fromHexString(docHash)),
    paramString("metadata", metadata),
    paramString("creator", creator),
    paramBigInt("timestamp", BigInt.fromU64(timestamp)),
    paramI32("source", source == "BLOCK" ? 0 : 1),
    paramBytes("proof", Bytes.fromHexString(proof)),
  ];
  return event;
}

export function createDocumentRemovedEvent(docHash: string): DocumentRemoved {
  const event = changetype<DocumentRemoved>(newMockEvent());
  event.parameters = [paramBytes("docHash", Bytes.fromHexString(docHash))];
  return event;
}

export function createEventWrittenEvent(
  docHash: string,
  eventHash: string,
  sender: string,
  metadata: string,
  origin: string,
  timestamp: u64,
  source: string,
  proof: string,
): EventWritten {
  const event = changetype<EventWritten>(newMockEvent());
  event.parameters = [
    paramBytes("docHash", Bytes.fromHexString(docHash)),
    paramBytes("eventHash", Bytes.fromHexString(eventHash)),
    paramBytes("sender", Bytes.fromHexString(sender)),
    paramString("metadata", metadata),
    paramString("origin", origin),
    paramBigInt("timestamp", BigInt.fromU64(timestamp)),
    paramI32("source", source == "BLOCK" ? 0 : 1),
    paramBytes("proof", Bytes.fromHexString(proof)),
  ];
  return event;
}

function paramBigInt(name: string, value: BigInt): ethereum.EventParam {
  return new ethereum.EventParam(
    name,
    ethereum.Value.fromUnsignedBigInt(value),
  );
}

function paramBoolean(name: string, value: boolean): ethereum.EventParam {
  return new ethereum.EventParam(name, ethereum.Value.fromBoolean(value));
}

function paramBytes(name: string, value: Bytes): ethereum.EventParam {
  return new ethereum.EventParam(name, ethereum.Value.fromBytes(value));
}

function paramI32(name: string, value: i32): ethereum.EventParam {
  return new ethereum.EventParam(name, ethereum.Value.fromI32(value));
}

function paramString(name: string, value: string): ethereum.EventParam {
  return new ethereum.EventParam(name, ethereum.Value.fromString(value));
}
