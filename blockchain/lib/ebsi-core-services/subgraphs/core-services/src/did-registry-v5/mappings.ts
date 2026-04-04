import { BigInt, log } from "@graphprotocol/graph-ts";

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
} from "../../generated/DidRegistry/DidRegistry";
import { DidDocument } from "../../generated/schema";
import {
  createControllerRelationship,
  createVerificationMethod,
  createVerificationRelationship,
  loadControllerRelationship,
  loadVerificationMethod,
  storeEvent,
} from "./utils";

export function handleBaseDocumentUpdatedEvent(
  event: BaseDocumentUpdated,
): void {
  const did = event.params.did;

  log.info("Updating base document of DID document {}", [did]);

  const didDocument = DidDocument.load(did);

  if (didDocument === null) {
    log.error("DID document {} not found", [did]);
    return;
  }

  didDocument.baseDocument = event.params.baseDocument;
  didDocument.save();

  storeEvent(event, "UpdateBaseDocument", did);
}

export function handleControllerAddedEvent(event: ControllerAdded): void {
  const did = event.params.did;
  const controllerId = event.params.controller;

  log.info("Adding controller {} to DID document {}", [controllerId, did]);

  const controller = createControllerRelationship(did, controllerId);
  controller.save();

  storeEvent(event, "AddController", did);
}

export function handleControllerRevokedEvent(event: ControllerRevoked): void {
  const did = event.params.did;
  const controller = event.params.controller;

  log.info("Revoking controller {} of DID document {}", [controller, did]);

  const controllerRelationship = loadControllerRelationship(did, controller);

  if (controllerRelationship === null) return;

  controllerRelationship.status = "REVOKED";
  controllerRelationship.save();

  storeEvent(event, "RevokeController", did);
}

export function handleDidDocumentInsertedEvent(
  event: DidDocumentInserted,
): void {
  const did = event.params.did;
  const didFragment = event.params.vMethodId;

  log.info("Inserting DID document {}", [did]);

  const didDocument = new DidDocument(did);

  didDocument.baseDocument = event.params.baseDocument;

  const controllerRelationship = createControllerRelationship(did, did);

  controllerRelationship.save();

  const verificationMethod = createVerificationMethod(
    did,
    didFragment,
    event.params.publicKey,
    event.params.isSecp256k1,
  );

  verificationMethod.save();

  const verificationRelationship1 = createVerificationRelationship(
    verificationMethod,
    did,
    "capabilityInvocation",
    event.params.notBefore,
    event.params.notAfter,
    BigInt.fromU32(0),
  );

  verificationRelationship1.save();

  const verificationRelationship2 = createVerificationRelationship(
    verificationMethod,
    did,
    "authentication",
    event.params.notBefore,
    event.params.notAfter,
    BigInt.fromU32(1),
  );

  verificationRelationship2.save();

  didDocument.save();

  storeEvent(event, "InsertDidDocument", did);
}

export function handleVerificationMethodAddedEvent(
  event: VerificationMethodAdded,
): void {
  const did = event.params.did;
  const didFragment = event.params.vMethodId;

  log.info("Adding verification method {} to DID document {}", [
    didFragment,
    did,
  ]);

  const verificationMethod = createVerificationMethod(
    did,
    didFragment,
    event.params.publicKey,
    event.params.isSecp256k1,
  );

  verificationMethod.save();

  storeEvent(event, "AddVerificationMethod", did);
}

export function handleVerificationMethodExpiredEvent(
  event: VerificationMethodExpired,
): void {
  const did = event.params.did;
  const didFragment = event.params.vMethodId;

  log.info("Expiring verification method {} of DID document {}", [
    didFragment,
    did,
  ]);

  const verificationMethod = loadVerificationMethod(did, didFragment);

  if (verificationMethod === null) return;

  const verificationRelationships =
    verificationMethod.verificationRelationships.load();

  for (let i = 0; i < verificationRelationships.length; i += 1) {
    const verificationRelationship = verificationRelationships[i];
    verificationRelationship.notAfter = event.params.notAfter;
    verificationRelationship.save();
  }

  storeEvent(event, "ExpireVerificationMethod", did);
}

export function handleVerificationMethodRevokedEvent(
  event: VerificationMethodRevoked,
): void {
  const did = event.params.did;
  const didFragment = event.params.vMethodId;

  log.info("Revoking verification method {} of DID document {}", [
    didFragment,
    did,
  ]);

  const verificationMethod = loadVerificationMethod(did, didFragment);

  if (verificationMethod === null) return;

  verificationMethod.status = "REVOKED";
  verificationMethod.save();

  const verificationRelationships =
    verificationMethod.verificationRelationships.load();

  for (let i = 0; i < verificationRelationships.length; i += 1) {
    const verificationRelationship = verificationRelationships[i];
    verificationRelationship.notAfter = event.params.notAfter;
    verificationRelationship.save();
  }

  storeEvent(event, "RevokeVerificationMethod", did);
}

export function handleVerificationMethodRolledEvent(
  event: VerificationMethodRolled,
): void {
  const did = event.params.did;
  const oldVMethodFragment = event.params.oldVMethodId;
  const newVMethodFragment = event.params.vMethodId;

  log.info("Rolling verification method from {} to {} of DID document {}", [
    oldVMethodFragment,
    newVMethodFragment,
    did,
  ]);

  // Add new verification method
  const verificationMethod = createVerificationMethod(
    did,
    newVMethodFragment,
    event.params.publicKey,
    event.params.isSecp256k1,
  );

  verificationMethod.save();

  // Update verification relationships
  const oldVerificationMethod = loadVerificationMethod(did, oldVMethodFragment);

  if (oldVerificationMethod === null) return;

  const verificationRelationships =
    oldVerificationMethod.verificationRelationships.load();

  for (let i = 0; i < verificationRelationships.length; i += 1) {
    const oldVerificationRelationship = verificationRelationships[i];
    oldVerificationRelationship.notAfter = event.params.notBefore.plus(
      event.params.duration,
    );
    oldVerificationRelationship.save();

    const newVerificationRelationship = createVerificationRelationship(
      verificationMethod,
      did,
      oldVerificationRelationship.purpose,
      event.params.notBefore,
      event.params.notAfter,
      BigInt.fromI32(verificationRelationships.length + i),
    );
    newVerificationRelationship.save();
  }

  storeEvent(event, "RollVerificationMethod", did);
}

export function handleVerificationRelationshipAddedEvent(
  event: VerificationRelationshipAdded,
): void {
  const did = event.params.did;
  const didFragment = event.params.vMethodId;
  const purpose = event.params.name;

  log.info(
    "Adding verification relationship {} for method {} to DID document {}",
    [purpose, didFragment, did],
  );

  const verificationMethod = loadVerificationMethod(did, didFragment);

  if (verificationMethod === null) return;

  const verificationRelationships =
    verificationMethod.verificationRelationships.load();

  const verificationRelationship = createVerificationRelationship(
    verificationMethod,
    did,
    purpose,
    event.params.notBefore,
    event.params.notAfter,
    BigInt.fromI32(verificationRelationships.length),
  );

  verificationRelationship.save();

  storeEvent(event, "AddVerificationRelationship", did);
}
