import { BigInt, Bytes, ethereum } from "@graphprotocol/graph-ts";

import {
  ControllerRelationship,
  DidDocumentEvent,
  VerificationMethod,
  VerificationRelationship,
} from "../../generated/schema";

export const computeEventId = (
  transaction: ethereum.Transaction,
  eventName: string,
  did: string,
): Bytes => {
  return Bytes.fromUTF8(
    `${transaction.hash.toHexString()}-${eventName}-${did}`,
  );
};

export const storeEvent = (
  ethereumEvent: ethereum.Event,
  eventName: string,
  did: string,
): void => {
  const event = new DidDocumentEvent(
    computeEventId(ethereumEvent.transaction, eventName, did),
  );

  event.didDocument = did;
  event.signer = ethereumEvent.transaction.from;
  event.blockNumber = ethereumEvent.block.number;
  event.timestamp = ethereumEvent.block.timestamp;
  event.event = eventName;
  event.txId = ethereumEvent.transaction.hash;

  event.save();
};

export function createControllerRelationship(
  did: string,
  controller: string,
): ControllerRelationship {
  const controllerRelationship = new ControllerRelationship(
    `${did}#${controller}`,
  );

  controllerRelationship.controller = controller;
  controllerRelationship.controlledDocument = did;
  controllerRelationship.status = "ACTIVE";

  return controllerRelationship;
}

export function createVerificationMethod(
  did: string,
  didFragment: string,
  publicKey: Bytes,
  isSecp256k1: boolean,
): VerificationMethod {
  const verificationMethod = new VerificationMethod(`${did}#${didFragment}`);

  verificationMethod.didDocument = did;
  verificationMethod.publicKey = publicKey;
  verificationMethod.isSecp256k1 = isSecp256k1;
  verificationMethod.status = "ACTIVE";

  return verificationMethod;
}

export function createVerificationRelationship(
  verificationMethod: VerificationMethod,
  did: string,
  purpose: string,
  notBefore: BigInt,
  notAfter: BigInt,
  index: BigInt,
): VerificationRelationship {
  const verificationRelationship = new VerificationRelationship(
    `${verificationMethod.id}__${index.toString()}`,
  );

  verificationRelationship.didDocument = did;
  verificationRelationship.purpose = purpose;
  verificationRelationship.verificationMethod = verificationMethod.id;
  verificationRelationship.notBefore = notBefore;
  verificationRelationship.notAfter = notAfter;

  return verificationRelationship;
}

export function loadControllerRelationship(
  did: string,
  controller: string,
): ControllerRelationship | null {
  return ControllerRelationship.load(`${did}#${controller}`);
}

export function loadVerificationMethod(
  did: string,
  didFragment: string,
  // If we put "null" first, Matchstick won't be able to compile
  // eslint-disable-next-line perfectionist/sort-union-types
): VerificationMethod | null {
  return VerificationMethod.load(`${did}#${didFragment}`);
}
