import { BigInt, Bytes } from "@graphprotocol/graph-ts";
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
  handleBaseDocumentUpdatedEvent,
  handleControllerAddedEvent,
  handleControllerRevokedEvent,
  handleDidDocumentInsertedEvent,
  handleVerificationMethodAddedEvent,
  handleVerificationMethodExpiredEvent,
  handleVerificationMethodRevokedEvent,
  handleVerificationMethodRolledEvent,
  handleVerificationRelationshipAddedEvent,
} from "../src/did-registry-v5/mappings";
import { computeEventId } from "../src/did-registry-v5/utils";
import {
  createBaseDocumentUpdatedEvent,
  createControllerAddedEvent,
  createControllerRevokedEvent,
  createDidDocumentInsertedEvent,
  createVerificationMethodAddedEvent,
  createVerificationMethodExpiredEvent,
  createVerificationMethodRevokedEvent,
  createVerificationMethodRolledEvent,
  createVerificationRelationshipAddedEvent,
} from "./did-registry.utils";

describe("DID Registry - entity assertions", () => {
  const did = "did:ebsi:zZeKyEJfUTGwajhNyNX928z";

  beforeAll(() => {
    const event = createDidDocumentInsertedEvent(
      did,
      "{}",
      "keys-1",
      Bytes.fromHexString("ff1234567890"),
      true,
      BigInt.fromI32(1000),
      BigInt.fromI32(2000),
    );

    handleDidDocumentInsertedEvent(event);
  });

  afterAll(() => {
    clearStore();
  });

  test("Insert DID document", () => {
    const newDid = "did:ebsi:z224tCapjMEJEdLU6n1iG2yH";
    const keyId = "new-key";

    const insertDidDocumentEvent = createDidDocumentInsertedEvent(
      newDid,
      '{"@context":"https://www.w3.org/ns/did/v1"}',
      keyId,
      Bytes.fromHexString("ddeeffaabbcc"),
      true,
      BigInt.fromI32(1000),
      BigInt.fromI32(2000),
    );

    const didDocumentCount = countEntities("DidDocument");
    const controllerRelationshipCount = countEntities("ControllerRelationship");
    const verificationMethodCount = countEntities("VerificationMethod");
    const verificationRelationshipCount = countEntities(
      "VerificationRelationship",
    );

    handleDidDocumentInsertedEvent(insertDidDocumentEvent);

    // Check if the event has been stored
    const eventId = computeEventId(
      insertDidDocumentEvent.transaction,
      "InsertDidDocument",
      did,
    );
    assert.fieldEquals(
      "DidDocumentEvent",
      eventId.toHexString(),
      "didDocument",
      did,
    );

    // Check if the new DID document has been stored
    assert.entityCount("DidDocument", didDocumentCount + 1);
    assert.fieldEquals(
      "DidDocument",
      newDid,
      "baseDocument",
      '{"@context":"https://www.w3.org/ns/did/v1"}',
    );

    // Check if the new controller relationship has been stored
    assert.entityCount(
      "ControllerRelationship",
      controllerRelationshipCount + 1,
    );

    const cId = `${newDid}#${newDid}`;
    assert.fieldEquals("ControllerRelationship", cId, "controller", newDid);
    assert.fieldEquals(
      "ControllerRelationship",
      cId,
      "controlledDocument",
      newDid,
    );
    assert.fieldEquals("ControllerRelationship", cId, "status", "ACTIVE");

    // Check if the new verification method has been stored
    assert.entityCount("VerificationMethod", verificationMethodCount + 1);

    const vmId = `${newDid}#${keyId}`;
    assert.fieldEquals("VerificationMethod", vmId, "didDocument", newDid);
    assert.fieldEquals("VerificationMethod", vmId, "isSecp256k1", "true");
    assert.fieldEquals(
      "VerificationMethod",
      vmId,
      "publicKey",
      "0xddeeffaabbcc",
    );
    assert.fieldEquals("VerificationMethod", vmId, "status", "ACTIVE");

    // Check if the new verification relationships ("capabilityInvocation" and "authentication") have been stored
    assert.entityCount(
      "VerificationRelationship",
      verificationRelationshipCount + 2,
    );

    const vrId1 = `${newDid}#${keyId}__0`;
    const vrId2 = `${newDid}#${keyId}__1`;
    assert.fieldEquals(
      "VerificationRelationship",
      vrId1,
      "verificationMethod",
      `${newDid}#${keyId}`,
    );
    assert.fieldEquals("VerificationRelationship", vrId1, "notBefore", "1000");
    assert.fieldEquals("VerificationRelationship", vrId1, "notAfter", "2000");
    assert.fieldEquals(
      "VerificationRelationship",
      vrId2,
      "purpose",
      "authentication",
    );
    assert.fieldEquals("VerificationRelationship", vrId2, "notBefore", "1000");
    assert.fieldEquals("VerificationRelationship", vrId2, "notAfter", "2000");
  });

  test("Update base document", () => {
    const newBaseDocument = '{"@context":"https://www.w3.org/ns/did/v1"}';

    const event = createBaseDocumentUpdatedEvent(did, newBaseDocument);

    const didDocumentCount = countEntities("DidDocument");

    handleBaseDocumentUpdatedEvent(event);

    // Check if the event has been stored
    const eventId = computeEventId(
      event.transaction,
      "UpdateBaseDocument",
      did,
    );
    assert.fieldEquals(
      "DidDocumentEvent",
      eventId.toHexString(),
      "didDocument",
      did,
    );

    // The number of entities has not changed
    assert.entityCount("DidDocument", didDocumentCount);

    // The base document has been updated
    assert.fieldEquals("DidDocument", did, "baseDocument", newBaseDocument);
  });

  test("Add and revoke controller", () => {
    // Create another DID document
    const did2 = "did:ebsi:zsG1AGXCuZ46tSAE2UT6kdE";

    const didDocumentInsertedEvent = createDidDocumentInsertedEvent(
      did2,
      "{}",
      "keys-1",
      Bytes.fromHexString("aabbccddeeff"),
      true,
      BigInt.fromI32(1000),
      BigInt.fromI32(2000),
    );

    const controllerRelationshipCount = countEntities("ControllerRelationship");

    handleDidDocumentInsertedEvent(didDocumentInsertedEvent);

    // Add DID as controller
    const controllerAddedEvent = createControllerAddedEvent(did, did2);

    handleControllerAddedEvent(controllerAddedEvent);

    // Check if the event has been stored
    const controllerAddedEventId = computeEventId(
      controllerAddedEvent.transaction,
      "AddController",
      did,
    ).toHexString();
    assert.fieldEquals(
      "DidDocumentEvent",
      controllerAddedEventId,
      "didDocument",
      did,
    );

    // Check if the new controller relationships have been stored
    assert.entityCount(
      "ControllerRelationship",
      controllerRelationshipCount + 2, // 1 was added by handleDidDocumentInsertedEvent, the other by handleControllerAddedEvent
    );

    // Check controller relationships
    const crId1 = `${did}#${did}`;
    const crId2 = `${did}#${did2}`;
    assert.fieldEquals("ControllerRelationship", crId1, "controller", did);
    assert.fieldEquals(
      "ControllerRelationship",
      crId1,
      "controlledDocument",
      did,
    );
    assert.fieldEquals("ControllerRelationship", crId1, "status", "ACTIVE");
    assert.fieldEquals("ControllerRelationship", crId2, "controller", did2);
    assert.fieldEquals(
      "ControllerRelationship",
      crId2,
      "controlledDocument",
      did,
    );
    assert.fieldEquals("ControllerRelationship", crId2, "status", "ACTIVE");

    // Revoke controller
    const controllerRevokedEvent = createControllerRevokedEvent(did, did2);

    handleControllerRevokedEvent(controllerRevokedEvent);

    // Check if the event has been stored
    const revokeControllerEventId = computeEventId(
      controllerRevokedEvent.transaction,
      "RevokeController",
      did,
    ).toHexString();
    assert.fieldEquals(
      "DidDocumentEvent",
      revokeControllerEventId,
      "didDocument",
      did,
    );

    // Check if the new controller relationships are still present
    assert.entityCount(
      "ControllerRelationship",
      controllerRelationshipCount + 2, // The count has not changed
    );

    // Check controller relationships
    assert.fieldEquals("ControllerRelationship", crId1, "controller", did);
    assert.fieldEquals(
      "ControllerRelationship",
      crId1,
      "controlledDocument",
      did,
    );
    assert.fieldEquals("ControllerRelationship", crId1, "status", "ACTIVE");
    assert.fieldEquals("ControllerRelationship", crId2, "controller", did2);
    assert.fieldEquals(
      "ControllerRelationship",
      crId2,
      "controlledDocument",
      did,
    );
    assert.fieldEquals("ControllerRelationship", crId2, "status", "REVOKED");
  });

  test("Add verification method", () => {
    const verificationMethodAddedEvent = createVerificationMethodAddedEvent(
      did,
      "keys-2",
      Bytes.fromHexString("7b226b7479223a"),
      false,
    );

    const verificationMethodCount = countEntities("VerificationMethod");

    handleVerificationMethodAddedEvent(verificationMethodAddedEvent);

    // Check if the event has been stored
    const eventId = computeEventId(
      verificationMethodAddedEvent.transaction,
      "AddVerificationMethod",
      did,
    ).toHexString();
    assert.fieldEquals("DidDocumentEvent", eventId, "didDocument", did);

    // Check if the new verification method has been stored
    assert.entityCount("VerificationMethod", verificationMethodCount + 1);

    // Check verification method
    const id = `${did}#keys-2`;
    assert.fieldEquals("VerificationMethod", id, "didDocument", did);
    assert.fieldEquals(
      "VerificationMethod",
      id,
      "publicKey",
      "0x7b226b7479223a",
    );
    assert.fieldEquals("VerificationMethod", id, "isSecp256k1", "false");
    assert.fieldEquals("VerificationMethod", id, "status", "ACTIVE");
  });

  test("Add verification relationship", () => {
    const verificationRelationshipAddedEvent =
      createVerificationRelationshipAddedEvent(
        did,
        "assertionMethod",
        "keys-1",
        BigInt.fromI32(1000),
        BigInt.fromI32(2000),
      );

    const verificationRelationshipCount = countEntities(
      "VerificationRelationship",
    );

    handleVerificationRelationshipAddedEvent(
      verificationRelationshipAddedEvent,
    );

    // Check if the event has been stored
    const eventId = computeEventId(
      verificationRelationshipAddedEvent.transaction,
      "AddVerificationRelationship",
      did,
    ).toHexString();
    assert.fieldEquals("DidDocumentEvent", eventId, "didDocument", did);

    // Check if the new verification relationship has been stored
    assert.entityCount(
      "VerificationRelationship",
      verificationRelationshipCount + 1,
    );

    // Check verification relationship
    const vrId = `${did}#keys-1__2`;
    assert.fieldEquals("VerificationRelationship", vrId, "didDocument", did);
    assert.fieldEquals(
      "VerificationRelationship",
      vrId,
      "verificationMethod",
      `${did}#keys-1`,
    );
    assert.fieldEquals(
      "VerificationRelationship",
      vrId,
      "purpose",
      "assertionMethod",
    );
    assert.fieldEquals("VerificationRelationship", vrId, "notBefore", "1000");
    assert.fieldEquals("VerificationRelationship", vrId, "notAfter", "2000");
  });

  test("Revoke verification method", () => {
    const verificationMethodRevokedEvent = createVerificationMethodRevokedEvent(
      did,
      "keys-1",
      BigInt.fromI32(1500),
    );

    const verificationMethodCount = countEntities("VerificationMethod");

    handleVerificationMethodRevokedEvent(verificationMethodRevokedEvent);

    // Check if the event has been stored
    const eventId = computeEventId(
      verificationMethodRevokedEvent.transaction,
      "RevokeVerificationMethod",
      did,
    ).toHexString();
    assert.fieldEquals("DidDocumentEvent", eventId, "didDocument", did);

    // The number of entities has not changed
    assert.entityCount("VerificationMethod", verificationMethodCount);

    // The verification method has been revoked
    const id = `${did}#keys-1`;
    assert.fieldEquals("VerificationMethod", id, "status", "REVOKED");
  });

  test("Expire verification method", () => {
    const keyId = "key-to-be-revoked";

    // Add new verification method
    const verificationMethodAddedEvent = createVerificationMethodAddedEvent(
      did,
      keyId,
      Bytes.fromHexString("7b226b7479223a"),
      false,
    );

    const verificationMethodCount = countEntities("VerificationMethod");

    handleVerificationMethodAddedEvent(verificationMethodAddedEvent);

    // Check if the verification method has been stored
    const verificationMethodId = `${did}#${keyId}`;
    assert.entityCount("VerificationMethod", verificationMethodCount + 1);
    assert.fieldEquals(
      "VerificationMethod",
      verificationMethodId,
      "didDocument",
      did,
    );
    assert.fieldEquals(
      "VerificationMethod",
      verificationMethodId,
      "publicKey",
      "0x7b226b7479223a",
    );
    assert.fieldEquals(
      "VerificationMethod",
      verificationMethodId,
      "isSecp256k1",
      "false",
    );
    assert.fieldEquals(
      "VerificationMethod",
      verificationMethodId,
      "status",
      "ACTIVE",
    );

    // Add verification relationship
    const verificationRelationshipAddedEvent =
      createVerificationRelationshipAddedEvent(
        did,
        "assertionMethod",
        keyId,
        BigInt.fromI32(1000),
        BigInt.fromI32(2000),
      );

    const verificationRelationshipCount = countEntities(
      "VerificationRelationship",
    );

    handleVerificationRelationshipAddedEvent(
      verificationRelationshipAddedEvent,
    );

    // Check if the verification relationship has been stored
    assert.entityCount(
      "VerificationRelationship",
      verificationRelationshipCount + 1,
    );
    const vrId = `${did}#${keyId}__0`;
    assert.fieldEquals("VerificationRelationship", vrId, "didDocument", did);
    assert.fieldEquals(
      "VerificationRelationship",
      vrId,
      "verificationMethod",
      `${did}#${keyId}`,
    );
    assert.fieldEquals(
      "VerificationRelationship",
      vrId,
      "purpose",
      "assertionMethod",
    );
    assert.fieldEquals("VerificationRelationship", vrId, "notBefore", "1000");
    assert.fieldEquals("VerificationRelationship", vrId, "notAfter", "2000");

    // Expire verification method
    const verificationMethodExpiredEvent = createVerificationMethodExpiredEvent(
      did,
      keyId,
      BigInt.fromI32(1500),
    );

    handleVerificationMethodExpiredEvent(verificationMethodExpiredEvent);

    // Check if the event has been stored
    const eventId = computeEventId(
      verificationMethodExpiredEvent.transaction,
      "ExpireVerificationMethod",
      did,
    ).toHexString();
    assert.fieldEquals("DidDocumentEvent", eventId, "didDocument", did);

    // Check if the verification method is still active
    assert.entityCount("VerificationMethod", verificationMethodCount + 1);
    assert.fieldEquals(
      "VerificationMethod",
      verificationMethodId,
      "status",
      "ACTIVE",
    );

    // The verification relationship has an expiration date corresponding to the "notAfter" parameter
    assert.fieldEquals(
      "VerificationRelationship",
      vrId,
      "verificationMethod",
      `${did}#${keyId}`,
    );
    assert.fieldEquals("VerificationRelationship", vrId, "notAfter", "1500");
  });

  test("Roll verification method", () => {
    const initialKeyId = "key-to-be-rolled";

    // Add new verification method
    const verificationMethodAddedEvent = createVerificationMethodAddedEvent(
      did,
      initialKeyId,
      Bytes.fromHexString("7b226b7479223a"),
      false,
    );

    const verificationMethodCount = countEntities("VerificationMethod");

    handleVerificationMethodAddedEvent(verificationMethodAddedEvent);

    // Check if the verification method has been stored
    const initialVerificationMethodId = `${did}#${initialKeyId}`;
    assert.entityCount("VerificationMethod", verificationMethodCount + 1);
    assert.fieldEquals(
      "VerificationMethod",
      initialVerificationMethodId,
      "didDocument",
      did,
    );
    assert.fieldEquals(
      "VerificationMethod",
      initialVerificationMethodId,
      "publicKey",
      "0x7b226b7479223a",
    );
    assert.fieldEquals(
      "VerificationMethod",
      initialVerificationMethodId,
      "isSecp256k1",
      "false",
    );
    assert.fieldEquals(
      "VerificationMethod",
      initialVerificationMethodId,
      "status",
      "ACTIVE",
    );

    // Add verification relationship
    const verificationRelationshipAddedEvent =
      createVerificationRelationshipAddedEvent(
        did,
        "assertionMethod",
        initialKeyId,
        BigInt.fromI32(1000),
        BigInt.fromI32(2000),
      );

    const verificationRelationshipCount = countEntities(
      "VerificationRelationship",
    );

    handleVerificationRelationshipAddedEvent(
      verificationRelationshipAddedEvent,
    );

    // Check if the verification relationship has been stored
    assert.entityCount(
      "VerificationRelationship",
      verificationRelationshipCount + 1,
    );
    const vrId = `${did}#${initialKeyId}__0`;
    assert.fieldEquals("VerificationRelationship", vrId, "didDocument", did);
    assert.fieldEquals(
      "VerificationRelationship",
      vrId,
      "verificationMethod",
      `${did}#${initialKeyId}`,
    );
    assert.fieldEquals(
      "VerificationRelationship",
      vrId,
      "purpose",
      "assertionMethod",
    );
    assert.fieldEquals("VerificationRelationship", vrId, "notBefore", "1000");
    assert.fieldEquals("VerificationRelationship", vrId, "notAfter", "2000");

    // Roll verification method
    const newKeyId = "new-key";
    const verificationMethodRolledEvent = createVerificationMethodRolledEvent(
      did,
      newKeyId,
      Bytes.fromHexString("7b226b7479223b"),
      false,
      BigInt.fromI32(1500),
      BigInt.fromI32(1500),
      initialKeyId,
      BigInt.fromI32(1000),
    );

    handleVerificationMethodRolledEvent(verificationMethodRolledEvent);

    // Check if the event has been stored
    const eventId = computeEventId(
      verificationMethodRolledEvent.transaction,
      "RollVerificationMethod",
      did,
    ).toHexString();
    assert.fieldEquals("DidDocumentEvent", eventId, "didDocument", did);

    // Check if the verification method has been stored
    assert.entityCount("VerificationMethod", verificationMethodCount + 2);

    // Check if the initial verification method is still active
    assert.fieldEquals(
      "VerificationMethod",
      initialVerificationMethodId,
      "status",
      "ACTIVE",
    );

    // Check if the new verification method has been stored
    const newVerificationMethodId = `${did}#${newKeyId}`;
    assert.entityCount("VerificationMethod", verificationMethodCount + 2);
    assert.fieldEquals(
      "VerificationMethod",
      newVerificationMethodId,
      "didDocument",
      did,
    );
    assert.fieldEquals(
      "VerificationMethod",
      newVerificationMethodId,
      "publicKey",
      "0x7b226b7479223b",
    );
    assert.fieldEquals(
      "VerificationMethod",
      newVerificationMethodId,
      "isSecp256k1",
      "false",
    );
    assert.fieldEquals(
      "VerificationMethod",
      newVerificationMethodId,
      "status",
      "ACTIVE",
    );

    // The old verification relationship has an expiration date corresponding to the initial "notAfter" parameter + the new "duration" parameter
    assert.fieldEquals(
      "VerificationRelationship",
      vrId,
      "verificationMethod",
      `${did}#${initialKeyId}`,
    );
    assert.fieldEquals("VerificationRelationship", vrId, "notAfter", "2500"); // 1500 (initial "notAfter" value) + 1000 (value of "duration")

    // Check if the new verification relationship has been stored
    assert.entityCount(
      "VerificationRelationship",
      verificationRelationshipCount + 2,
    );
    const newVerificationRelationshipId = `${did}#${newKeyId}__1`;
    assert.fieldEquals(
      "VerificationRelationship",
      newVerificationRelationshipId,
      "didDocument",
      did,
    );
    assert.fieldEquals(
      "VerificationRelationship",
      newVerificationRelationshipId,
      "verificationMethod",
      `${did}#${newKeyId}`,
    );
    assert.fieldEquals(
      "VerificationRelationship",
      newVerificationRelationshipId,
      "purpose",
      "assertionMethod",
    );
    assert.fieldEquals(
      "VerificationRelationship",
      newVerificationRelationshipId,
      "notBefore",
      "1500",
    );
    assert.fieldEquals(
      "VerificationRelationship",
      newVerificationRelationshipId,
      "notAfter",
      "1500",
    );
  });
});
