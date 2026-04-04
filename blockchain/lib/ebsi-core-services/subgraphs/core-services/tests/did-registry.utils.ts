import { BigInt, Bytes, ethereum } from "@graphprotocol/graph-ts";
import { newMockEvent } from "matchstick-as";

import {
  BaseDocumentUpdated,
  ControllerAdded,
  ControllerRevoked,
  DidDocumentInserted,
  VerificationMethodAdded,
  VerificationMethodExpired,
  VerificationMethodRevoked,
  VerificationMethodRolled,
  VerificationRelationshipAdded,
} from "../generated/DidRegistry/DidRegistry";

export function createBaseDocumentUpdatedEvent(
  did: string,
  baseDocument: string,
): BaseDocumentUpdated {
  const event = changetype<BaseDocumentUpdated>(newMockEvent());

  event.parameters = [
    new ethereum.EventParam("did", ethereum.Value.fromString(did)),
    new ethereum.EventParam(
      "baseDocument",
      ethereum.Value.fromString(baseDocument),
    ),
  ];

  return event;
}

export function createControllerAddedEvent(
  did: string,
  controller: string,
): ControllerAdded {
  const event = changetype<ControllerAdded>(newMockEvent());

  event.parameters = [
    new ethereum.EventParam("did", ethereum.Value.fromString(did)),
    new ethereum.EventParam(
      "controller",
      ethereum.Value.fromString(controller),
    ),
  ];

  return event;
}

export function createControllerRevokedEvent(
  did: string,
  controller: string,
): ControllerRevoked {
  const event = changetype<ControllerRevoked>(newMockEvent());

  event.parameters = [
    new ethereum.EventParam("did", ethereum.Value.fromString(did)),
    new ethereum.EventParam(
      "controller",
      ethereum.Value.fromString(controller),
    ),
  ];

  return event;
}

export function createDidDocumentInsertedEvent(
  did: string,
  baseDocument: string,
  vMethodId: string,
  publicKey: Bytes,
  isSecp256k1: boolean,
  notBefore: BigInt,
  notAfter: BigInt,
): DidDocumentInserted {
  const event = changetype<DidDocumentInserted>(newMockEvent());

  event.parameters = [
    new ethereum.EventParam("did", ethereum.Value.fromString(did)),
    new ethereum.EventParam(
      "baseDocument",
      ethereum.Value.fromString(baseDocument),
    ),

    new ethereum.EventParam("vMethodId", ethereum.Value.fromString(vMethodId)),

    new ethereum.EventParam("publicKey", ethereum.Value.fromBytes(publicKey)),

    new ethereum.EventParam(
      "isSecp256k1",
      ethereum.Value.fromBoolean(isSecp256k1),
    ),

    new ethereum.EventParam(
      "notBefore",
      ethereum.Value.fromUnsignedBigInt(notBefore),
    ),

    new ethereum.EventParam(
      "notAfter",
      ethereum.Value.fromUnsignedBigInt(notAfter),
    ),
  ];

  return event;
}

export function createVerificationMethodAddedEvent(
  did: string,
  vMethodId: string,
  publicKey: Bytes,
  isSecp256k1: boolean,
): VerificationMethodAdded {
  const event = changetype<VerificationMethodAdded>(newMockEvent());

  event.parameters = [
    new ethereum.EventParam("did", ethereum.Value.fromString(did)),
    new ethereum.EventParam("vMethodId", ethereum.Value.fromString(vMethodId)),
    new ethereum.EventParam("publicKey", ethereum.Value.fromBytes(publicKey)),
    new ethereum.EventParam(
      "isSecp256k1",
      ethereum.Value.fromBoolean(isSecp256k1),
    ),
  ];

  return event;
}

export function createVerificationMethodExpiredEvent(
  did: string,
  vMethodId: string,
  notAfter: BigInt,
): VerificationMethodExpired {
  const event = changetype<VerificationMethodExpired>(newMockEvent());

  event.parameters = [
    new ethereum.EventParam("did", ethereum.Value.fromString(did)),
    new ethereum.EventParam("vMethodId", ethereum.Value.fromString(vMethodId)),
    new ethereum.EventParam(
      "notAfter",
      ethereum.Value.fromUnsignedBigInt(notAfter),
    ),
  ];

  return event;
}

export function createVerificationMethodRevokedEvent(
  did: string,
  vMethodId: string,
  notAfter: BigInt,
): VerificationMethodRevoked {
  const event = changetype<VerificationMethodRevoked>(newMockEvent());

  event.parameters = [
    new ethereum.EventParam("did", ethereum.Value.fromString(did)),
    new ethereum.EventParam("vMethodId", ethereum.Value.fromString(vMethodId)),
    new ethereum.EventParam(
      "notAfter",
      ethereum.Value.fromUnsignedBigInt(notAfter),
    ),
  ];

  return event;
}

export function createVerificationMethodRolledEvent(
  did: string,
  vMethodId: string,
  publicKey: Bytes,
  isSecp256k1: boolean,
  notBefore: BigInt,
  notAfter: BigInt,
  oldVMethodId: string,
  duration: BigInt,
): VerificationMethodRolled {
  const event = changetype<VerificationMethodRolled>(newMockEvent());

  event.parameters = [
    new ethereum.EventParam("did", ethereum.Value.fromString(did)),
    new ethereum.EventParam("vMethodId", ethereum.Value.fromString(vMethodId)),
    new ethereum.EventParam("publicKey", ethereum.Value.fromBytes(publicKey)),
    new ethereum.EventParam(
      "isSecp256k1",
      ethereum.Value.fromBoolean(isSecp256k1),
    ),
    new ethereum.EventParam(
      "notBefore",
      ethereum.Value.fromUnsignedBigInt(notBefore),
    ),
    new ethereum.EventParam(
      "notAfter",
      ethereum.Value.fromUnsignedBigInt(notAfter),
    ),
    new ethereum.EventParam(
      "oldVMethodId",
      ethereum.Value.fromString(oldVMethodId),
    ),
    new ethereum.EventParam(
      "duration",
      ethereum.Value.fromUnsignedBigInt(duration),
    ),
  ];

  return event;
}

export function createVerificationRelationshipAddedEvent(
  did: string,
  name: string,
  vMethodId: string,
  notBefore: BigInt,
  notAfter: BigInt,
): VerificationRelationshipAdded {
  const event = changetype<VerificationRelationshipAdded>(newMockEvent());

  event.parameters = [
    new ethereum.EventParam("did", ethereum.Value.fromString(did)),
    new ethereum.EventParam("name", ethereum.Value.fromString(name)),
    new ethereum.EventParam("vMethodId", ethereum.Value.fromString(vMethodId)),
    new ethereum.EventParam(
      "notBefore",
      ethereum.Value.fromUnsignedBigInt(notBefore),
    ),
    new ethereum.EventParam(
      "notAfter",
      ethereum.Value.fromUnsignedBigInt(notAfter),
    ),
  ];

  return event;
}
