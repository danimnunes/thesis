import { Bytes } from "@graphprotocol/graph-ts";
import { afterAll, assert, clearStore, describe, test } from "matchstick-as";

import { Creator, Document, Invitation, Operator } from "../generated/schema";
import {
  CREATOR_PERMISSION,
  DELEGATE_PERMISSION,
  WRITE_PERMISSION,
} from "../src/track-and-trace-v1/constants";
import {
  handleAccessGrantedEvent,
  handleAccessRevokedEvent,
  handleDidEbsiAuthorisedEvent,
  handleDocumentCreatedEvent,
  handleDocumentRemovedEvent,
  handleEventWrittenEvent,
} from "../src/track-and-trace-v1/mappings";
import { getInvitationId } from "../src/track-and-trace-v1/utils";
import {
  assertArrayContainsAllValues,
  createAccessGrantedEvent,
  createAccessRevokedEvent,
  createDidEbsiAuthorisedEvent,
  createDocumentCreatedEvent,
  createDocumentRemovedEvent,
  createEventWrittenEvent,
} from "./track-and-trace.utils";

const creator = "did:ebsi:zgUB1p2zNmGtymUwzHrxh24";
const creatorHex =
  "0x6469643a656273693a7a6755423170327a4e6d4774796d55777a487278683234";
// const subject = "did:ebsi:z256asBWmHBsj2ZNVxG5Mhkp";
const subjectHex =
  "0x6469643a656273693a7a323536617342576d4842736a325a4e567847354d686b70";
const docId =
  "0x698214a0fde86449d48c93cca9bb939f3d8af451646b36162727c16b1ab02fce";
const docTimeNumber = 1_722_930_142;
const docTime = "1722930142";
const docProof =
  "0x0000000000000000000000000000000000000000000000000000000000b874b2";
const creatorInvitationId = getInvitationId(
  Bytes.fromHexString(docId),
  Bytes.fromHexString(creatorHex),
  CREATOR_PERMISSION,
);

describe("Track and Trace - entity assertions", () => {
  afterAll(() => {
    clearStore();
  });

  test(
    "throw error for an invalid input",
    () => {
      const event = createAccessRevokedEvent(docId, subjectHex, creatorHex);
      // input pointing to a different function signature
      event.transaction.input = Bytes.fromHexString(
        "0xff421956000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000000a0000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000206469643a656273693a7a6755423170327a4e6d4774796d55777a48727868323400000000000000000000000000000000000000000000000000000000000000206469643a656273693a7a6755423170327a4e6d4774796d55777a487278683234",
      );
      handleAccessRevokedEvent(event);
    },
    true,
  );

  test("register a new creator", () => {
    const event = createDidEbsiAuthorisedEvent(creator, true);
    handleDidEbsiAuthorisedEvent(event);

    assert.entityCount("Creator", 1, "There should be 1 creator");

    const creatorEntity = Creator.load(creator);

    if (!creatorEntity) {
      throw new Error("Creator not found");
    }

    assert.booleanEquals(
      true,
      creatorEntity.active,
      "The creator should be active",
    );

    const documents = creatorEntity.documents.load();

    if (!documents) {
      throw new Error("Documents not found");
    }

    assert.i32Equals(
      0,
      documents.length,
      "The creator should have 0 related document",
    );
  });

  test("register a new document", () => {
    const event = createDocumentCreatedEvent(
      docId,
      "metadata1",
      creator,
      docTimeNumber,
      "BLOCK",
      docProof,
    );

    handleDocumentCreatedEvent(event);

    const invitationId = creatorInvitationId.toHexString();

    assert.entityCount("Creator", 1, "There should be 1 creator");

    const creatorEntity = Creator.load(creator);

    if (!creatorEntity) {
      throw new Error("Creator not found");
    }

    assert.booleanEquals(
      true,
      creatorEntity.active,
      "The creator should be active",
    );

    const documents = creatorEntity.documents.load();

    if (!documents) {
      throw new Error("Documents not found");
    }

    assert.i32Equals(
      1,
      documents.length,
      "The creator should have 1 related document",
    );
    assert.bytesEquals(
      Bytes.fromHexString(docId),
      documents[0].id,
      "The document should have the correct ID",
    );

    assert.entityCount("Document", 1);
    assert.fieldEquals("Document", docId, "creator", creator);
    assert.fieldEquals("Document", docId, "timestamp", docTime);
    assert.fieldEquals("Document", docId, "source", "BLOCK");
    assert.fieldEquals("Document", docId, "proof", docProof);
    assert.fieldEquals("Document", docId, "metadata", "metadata1");

    const events = documents[0].events.load();
    assert.i32Equals(
      0,
      events.length,
      "The document should have 0 related event",
    );

    const invitations = documents[0].invitations.load();
    assert.i32Equals(
      1,
      invitations.length,
      "The document should have 1 related invitation",
    );

    assert.entityCount("Invitation", 1);
    assert.fieldEquals("Invitation", invitationId, "document", docId);
    assert.fieldEquals("Invitation", invitationId, "type", "CREATOR");
    assert.fieldEquals("Invitation", invitationId, "grantedBy", creatorHex);
    assert.fieldEquals("Invitation", invitationId, "subject", creatorHex);
    assert.i32Equals(
      0,
      invitations[0].children.load().length,
      "The invitation should have 0 child",
    );
    assert.booleanEquals(
      true,
      !invitations[0].parent,
      "The invitation should not have a parent",
    );

    assert.entityCount("Operator", 1);

    const operatorEntity = Operator.load(Bytes.fromHexString(creatorHex));

    if (!operatorEntity) {
      throw new Error("Operator not found");
    }

    const operatorInvitations = operatorEntity.invitations.load();

    if (!operatorInvitations) {
      throw new Error("Operator invitations not found");
    }

    assert.i32Equals(
      1,
      operatorInvitations.length,
      "The operator should have 1 related invitation",
    );
    assert.bytesEquals(
      Bytes.fromHexString(invitationId),
      operatorInvitations[0].id,
      "The operator invitation should have the correct ID",
    );
  });

  test("grant write access to another account", () => {
    const event = createAccessGrantedEvent(
      docId,
      subjectHex,
      creatorHex,
      "WRITE",
    );

    handleAccessGrantedEvent(event);

    const invitationIdBytes = getInvitationId(
      Bytes.fromHexString(docId),
      Bytes.fromHexString(subjectHex),
      WRITE_PERMISSION,
    );
    const invitationId = invitationIdBytes.toHexString();

    assert.entityCount("Document", 1);
    assert.fieldEquals("Document", docId, "creator", creator);
    assert.fieldEquals("Document", docId, "timestamp", docTime);
    assert.fieldEquals("Document", docId, "source", "BLOCK");
    assert.fieldEquals("Document", docId, "proof", docProof);
    assert.fieldEquals("Document", docId, "metadata", "metadata1");

    const document = Document.load(Bytes.fromHexString(docId));

    if (!document) {
      throw new Error(`Document ${docId} not found`);
    }

    const events = document.events.load();
    assert.i32Equals(
      0,
      events.length,
      "The document should have 0 related event",
    );

    const invitations = document.invitations.load();

    assert.i32Equals(
      2,
      invitations.length,
      "The document should have 2 related invitations",
    );

    // We can't trust the order of the invitations, hence we can simply check that they're all included
    const invitationsIds = invitations.map<string>((inv) =>
      inv.id.toHexString(),
    );
    assertArrayContainsAllValues(
      invitationsIds,
      [creatorInvitationId.toHexString(), invitationId],
      "documentInvitations should contain [creatorInvitationId, invitationId]",
    );

    assert.entityCount("Invitation", 2);
    assert.fieldEquals("Invitation", invitationId, "type", "WRITE");
    assert.fieldEquals("Invitation", invitationId, "grantedBy", creatorHex);
    assert.fieldEquals("Invitation", invitationId, "subject", subjectHex);

    const invitation = Invitation.load(Bytes.fromHexString(invitationId));
    if (!invitation) {
      throw new Error(`Invitation ${invitationId} not found`);
    }
    assert.i32Equals(
      0,
      invitation.children.load().length,
      "The invitation should have 0 child",
    );
    assert.booleanEquals(
      true,
      !invitations[0].parent,
      "The invitation should not have a parent",
    );

    assert.entityCount("Operator", 2);

    const operator = Operator.load(Bytes.fromHexString(subjectHex));

    if (!operator) {
      throw new Error(`Operator ${subjectHex} not found`);
    }

    const operatorInvitations = operator.invitations.load();
    assert.i32Equals(
      1,
      operatorInvitations.length,
      "The operator should have 1 related invitation",
    );
    assert.bytesEquals(
      Bytes.fromHexString(invitationId),
      operatorInvitations[0].id,
      "The operator invitation should have the correct ID",
    );
  });

  test("revoke write access to another account", () => {
    const event = createAccessRevokedEvent(docId, subjectHex, creatorHex);

    /**
     * input taken from transaction hash
     * https://blockscout-test.ebsi.eu/tx/0x5db18c28c350a192ceda953e63591e9c33abbc6e7649e7a0d8f3f81d1dab7d5e
     * (revokeAccess)
     */
    event.transaction.input = Bytes.fromHexString(
      "0x03b5b932698214a0fde86449d48c93cca9bb939f3d8af451646b36162727c16b1ab02fce000000000000000000000000000000000000000000000000000000000000008000000000000000000000000000000000000000000000000000000000000000c0000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000206469643a656273693a7a6755423170327a4e6d4774796d55777a48727868323400000000000000000000000000000000000000000000000000000000000000216469643a656273693a7a323536617342576d4842736a325a4e567847354d686b7000000000000000000000000000000000000000000000000000000000000000",
    );

    handleAccessRevokedEvent(event);

    assert.entityCount("Document", 1);
    assert.fieldEquals("Document", docId, "creator", creator);
    assert.fieldEquals("Document", docId, "timestamp", docTime);
    assert.fieldEquals("Document", docId, "source", "BLOCK");
    assert.fieldEquals("Document", docId, "proof", docProof);
    assert.fieldEquals("Document", docId, "metadata", "metadata1");

    const document = Document.load(Bytes.fromHexString(docId));

    if (!document) {
      throw new Error(`Document ${docId} not found`);
    }

    const events = document.events.load();
    assert.i32Equals(
      0,
      events.length,
      "The document should have 0 related event",
    );

    const invitations = document.invitations.load();
    assert.i32Equals(
      1,
      invitations.length,
      "The document should have 1 related invitation",
    );
    assert.bytesEquals(
      creatorInvitationId,
      invitations[0].id,
      "The invitation should have the correct ID",
    );

    assert.entityCount("Invitation", 1);

    assert.entityCount("Operator", 2);

    const operator = Operator.load(Bytes.fromHexString(subjectHex));

    if (!operator) {
      throw new Error(`Operator ${subjectHex} not found`);
    }

    const operatorInvitations = operator.invitations.load();
    assert.i32Equals(
      0,
      operatorInvitations.length,
      "The operator should have 0 related invitation",
    );
  });

  test("grant delegate access to another account and write access to children", () => {
    const event = createAccessGrantedEvent(
      docId,
      subjectHex,
      creatorHex,
      "DELEGATE",
    );

    handleAccessGrantedEvent(event);

    const delegateInvitationIdBytes = getInvitationId(
      Bytes.fromHexString(docId),
      Bytes.fromHexString(subjectHex),
      DELEGATE_PERMISSION,
    );
    const delegateInvitationId = delegateInvitationIdBytes.toHexString();
    assert.entityCount("Document", 1);
    assert.fieldEquals("Document", docId, "creator", creator);
    assert.fieldEquals("Document", docId, "timestamp", docTime);
    assert.fieldEquals("Document", docId, "source", "BLOCK");
    assert.fieldEquals("Document", docId, "proof", docProof);
    assert.fieldEquals("Document", docId, "metadata", "metadata1");

    const document = Document.load(Bytes.fromHexString(docId));

    if (!document) {
      throw new Error(`Document ${docId} not found`);
    }

    const events = document.events.load();
    assert.i32Equals(
      0,
      events.length,
      "The document should have 0 related event",
    );

    let documentInvitations = document.invitations.load();
    assert.i32Equals(
      2,
      documentInvitations.length,
      "The document should have 2 related invitations",
    );

    // We can't trust the order of the invitations, hence we can simply check that they're all included
    let documentInvitationsIds = documentInvitations.map<string>((inv) =>
      inv.id.toHexString(),
    );
    assertArrayContainsAllValues(
      documentInvitationsIds,
      [creatorInvitationId.toHexString(), delegateInvitationId],
      "documentInvitations should contain [creatorInvitationId, delegateInvitationId]",
    );

    assert.entityCount("Invitation", 2);
    assert.fieldEquals("Invitation", delegateInvitationId, "type", "DELEGATE");
    assert.fieldEquals(
      "Invitation",
      delegateInvitationId,
      "grantedBy",
      creatorHex,
    );
    assert.fieldEquals(
      "Invitation",
      delegateInvitationId,
      "subject",
      subjectHex,
    );

    const invitation = Invitation.load(
      Bytes.fromHexString(delegateInvitationId),
    );
    if (!invitation) {
      throw new Error(`Invitation ${delegateInvitationId} not found`);
    }
    assert.i32Equals(
      0,
      invitation.children.load().length,
      "The invitation should have 0 child",
    );
    assert.booleanEquals(
      true,
      !invitation.parent,
      "The invitation should not have a parent",
    );

    assert.entityCount("Operator", 2);

    const operator = Operator.load(Bytes.fromHexString(subjectHex));

    if (!operator) {
      throw new Error(`Operator ${subjectHex} not found`);
    }

    let operatorInvitations = operator.invitations.load();
    assert.i32Equals(
      1,
      operatorInvitations.length,
      "The operator should have 1 related invitation",
    );
    assert.bytesEquals(
      Bytes.fromHexString(delegateInvitationId),
      operatorInvitations[0].id,
      "The operator invitation should have the correct ID",
    );

    // create children
    const invitedOperatorId = "0xaa79";
    const eventChildren = createAccessGrantedEvent(
      docId,
      invitedOperatorId,
      subjectHex,
      "WRITE",
    );

    handleAccessGrantedEvent(eventChildren);

    const childInvitationIdBytes = getInvitationId(
      Bytes.fromHexString(docId),
      Bytes.fromHexString(invitedOperatorId),
      WRITE_PERMISSION,
    );
    const childInvitationId = childInvitationIdBytes.toHexString();

    documentInvitations = document.invitations.load();
    assert.i32Equals(
      3,
      documentInvitations.length,
      "The document should have 3 related invitations",
    );

    // We can't trust the order of the invitations, hence we can simply check that they're all included
    documentInvitationsIds = documentInvitations.map<string>((inv) =>
      inv.id.toHexString(),
    );
    assertArrayContainsAllValues(
      documentInvitationsIds,
      [
        creatorInvitationId.toHexString(),
        delegateInvitationId,
        childInvitationId,
      ],
      "documentInvitations should contain [creatorInvitationId, delegateInvitationId, childInvitationId]",
    );

    assert.entityCount("Invitation", 3);

    // Parent with a child
    assert.fieldEquals("Invitation", delegateInvitationId, "type", "DELEGATE");
    assert.fieldEquals(
      "Invitation",
      delegateInvitationId,
      "grantedBy",
      creatorHex,
    );
    assert.fieldEquals(
      "Invitation",
      delegateInvitationId,
      "subject",
      subjectHex,
    );

    const delegateInvitation = Invitation.load(
      Bytes.fromHexString(delegateInvitationId),
    );

    if (!delegateInvitation) {
      throw new Error(`Delegate invitation ${delegateInvitationId} not found`);
    }

    const delegateInvitationChildren = delegateInvitation.children.load();
    assert.i32Equals(
      1,
      delegateInvitationChildren.length,
      "Delegate invitation should have one child",
    );
    assert.bytesEquals(
      Bytes.fromHexString(childInvitationId),
      delegateInvitationChildren[0].id,
      "Delegate invitation should have the correct ID",
    );

    // Child
    assert.fieldEquals("Invitation", childInvitationId, "type", "WRITE");
    assert.fieldEquals(
      "Invitation",
      childInvitationId,
      "grantedBy",
      subjectHex,
    );
    assert.fieldEquals(
      "Invitation",
      childInvitationId,
      "subject",
      invitedOperatorId,
    );

    const childInvitation = Invitation.load(
      Bytes.fromHexString(childInvitationId),
    );

    if (!childInvitation) {
      throw new Error(`Child invitation ${childInvitationId} not found`);
    }

    assert.i32Equals(
      0,
      childInvitation.children.load().length,
      "The child invitation should have 0 related child",
    );

    assert.entityCount("Operator", 3);

    operatorInvitations = operator.invitations.load();
    assert.i32Equals(
      1,
      operatorInvitations.length,
      "The operator should have 1 related invitation",
    );
    assert.bytesEquals(
      Bytes.fromHexString(delegateInvitationId),
      operatorInvitations[0].id,
      "The operator invitation should have the correct ID",
    );

    const invitedOperator = Operator.load(
      Bytes.fromHexString(invitedOperatorId),
    );

    if (!invitedOperator) {
      throw new Error(`Operator ${invitedOperatorId} not found`);
    }

    const invitedOperatorInvitations = invitedOperator.invitations.load();
    assert.i32Equals(
      1,
      invitedOperatorInvitations.length,
      "The invited operator should have 1 related invitation",
    );
    assert.bytesEquals(
      Bytes.fromHexString(childInvitationId),
      invitedOperatorInvitations[0].id,
      "The invited operator invitation should have the correct ID",
    );

    // Check parent invitation
    const parent = invitedOperatorInvitations[0].parent;

    if (!parent) {
      throw new Error(`Parent invitation not found`);
    }

    assert.bytesEquals(
      Bytes.fromHexString(delegateInvitationId),
      parent,
      `The parent invitation ID should be ${delegateInvitationId}`,
    );
  });

  test("revoke delegate access to another account and revoke in cascade", () => {
    const event = createAccessRevokedEvent(docId, subjectHex, creatorHex);

    // input to revoke delegate access
    event.transaction.input = Bytes.fromHexString(
      "0x03b5b932698214a0fde86449d48c93cca9bb939f3d8af451646b36162727c16b1ab02fce000000000000000000000000000000000000000000000000000000000000008000000000000000000000000000000000000000000000000000000000000000c0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000206469643a656273693a7a6755423170327a4e6d4774796d55777a48727868323400000000000000000000000000000000000000000000000000000000000000216469643a656273693a7a323536617342576d4842736a325a4e567847354d686b7000000000000000000000000000000000000000000000000000000000000000",
    );
    handleAccessRevokedEvent(event);

    assert.entityCount("Document", 1);
    assert.fieldEquals("Document", docId, "creator", creator);
    assert.fieldEquals("Document", docId, "timestamp", docTime);
    assert.fieldEquals("Document", docId, "source", "BLOCK");
    assert.fieldEquals("Document", docId, "proof", docProof);
    assert.fieldEquals("Document", docId, "metadata", "metadata1");

    const document = Document.load(Bytes.fromHexString(docId));

    if (!document) {
      throw new Error(`Document ${docId} not found`);
    }

    const events = document.events.load();
    assert.i32Equals(
      0,
      events.length,
      "The document should have 0 related event",
    );

    const documentInvitations = document.invitations.load();
    assert.i32Equals(
      1,
      documentInvitations.length,
      "The document should have 1 related invitation",
    );
    assert.bytesEquals(
      creatorInvitationId,
      documentInvitations[0].id,
      `The document invitation ID should be ${creatorInvitationId.toHexString()}`,
    );

    assert.entityCount("Invitation", 1);

    assert.entityCount("Operator", 3);

    const subjectOperator = Operator.load(Bytes.fromHexString(subjectHex));

    if (!subjectOperator) {
      throw new Error(`Operator ${subjectHex} not found`);
    }

    const subjectOperatorInvitations = subjectOperator.invitations.load();
    assert.i32Equals(
      0,
      subjectOperatorInvitations.length,
      "The subject operator should have 0 related invitation",
    );
  });

  test("write an event", () => {
    const event = createEventWrittenEvent(
      docId,
      "0xeeda",
      creatorHex,
      "metadata2",
      "origin1",
      1_722_931_438,
      "BLOCK",
      "0xb87554",
    );

    /**
     * input taken from transaction hash
     * https://blockscout-test.ebsi.eu/tx/0xbb39133ba217b6c49092689269d2ae6f838a74e8f938b025c088aac890c57f46
     * (writeEvent)
     */
    event.transaction.input = Bytes.fromHexString(
      "0x6c3705790000000000000000000000000000000000000000000000000000000000000020698214a0fde86449d48c93cca9bb939f3d8af451646b36162727c16b1ab02fce00000000000000000000000000000000000000000000000000000000000000a00000000000000000000000000000000000000000000000000000000000000120000000000000000000000000000000000000000000000000000000000000016000000000000000000000000000000000000000000000000000000000000001a0000000000000000000000000000000000000000000000000000000000000004230783936326631376332363361373965333166643432636336663634323638656237636564353065323834666330646435626530646430366331623463613962323200000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000206469643a656273693a7a6755423170327a4e6d4774796d55777a48727868323400000000000000000000000000000000000000000000000000000000000000076f726967696e310000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000096d65746164617461320000000000000000000000000000000000000000000000",
    );

    handleEventWrittenEvent(event);

    assert.entityCount("Document", 1);
    assert.fieldEquals("Document", docId, "creator", creator);
    assert.fieldEquals("Document", docId, "timestamp", docTime);
    assert.fieldEquals("Document", docId, "source", "BLOCK");
    assert.fieldEquals("Document", docId, "proof", docProof);
    assert.fieldEquals("Document", docId, "metadata", "metadata1");

    const document = Document.load(Bytes.fromHexString(docId));

    if (!document) {
      throw new Error(`Document ${docId} not found`);
    }

    const events = document.events.load();
    assert.i32Equals(
      1,
      events.length,
      "The document should have 1 related event",
    );

    const expectedEventId = Bytes.fromHexString(docId).concat(
      Bytes.fromHexString("0xeeda"),
    );
    assert.bytesEquals(expectedEventId, events[0].id);

    const documentInvitations = document.invitations.load();
    assert.i32Equals(
      1,
      documentInvitations.length,
      "The document should have 1 related invitation",
    );
    assert.bytesEquals(
      creatorInvitationId,
      documentInvitations[0].id,
      `The document invitation ID should be ${creatorInvitationId.toHexString()}`,
    );

    const eventId = events[0].id.toHexString();

    assert.entityCount("DocumentEvent", 1);
    assert.fieldEquals(
      "DocumentEvent",
      eventId,
      "externalHash",
      "0x962f17c263a79e31fd42cc6f64268eb7ced50e284fc0dd5be0dd06c1b4ca9b22",
    );
    assert.fieldEquals("DocumentEvent", eventId, "hash", "0xeeda");
    assert.fieldEquals("DocumentEvent", eventId, "timestamp", "1722931438");
    assert.fieldEquals("DocumentEvent", eventId, "source", "BLOCK");
    assert.fieldEquals("DocumentEvent", eventId, "proof", "0xb87554");
    assert.fieldEquals("DocumentEvent", eventId, "sender", creatorHex);
    assert.fieldEquals("DocumentEvent", eventId, "origin", "origin1");
    assert.fieldEquals("DocumentEvent", eventId, "metadata", "metadata2");
    assert.fieldEquals("DocumentEvent", eventId, "document", docId);
  });

  test("remove document", () => {
    // create some invitations
    const eventInv1 = createAccessGrantedEvent(
      docId,
      "0xa210",
      creatorHex,
      "DELEGATE",
    );
    handleAccessGrantedEvent(eventInv1);

    const eventInv2 = createAccessGrantedEvent(
      docId,
      "0xa210",
      creatorHex,
      "WRITE",
    );
    handleAccessGrantedEvent(eventInv2);

    const eventInv3 = createAccessGrantedEvent(
      docId,
      "0x0101",
      "0xa210",
      "WRITE",
    );
    handleAccessGrantedEvent(eventInv3);

    const inv1Bytes = getInvitationId(
      Bytes.fromHexString(docId),
      Bytes.fromHexString("0xa210"),
      DELEGATE_PERMISSION,
    );
    const inv1 = inv1Bytes.toHexString();

    const inv2Bytes = getInvitationId(
      Bytes.fromHexString(docId),
      Bytes.fromHexString("0xa210"),
      WRITE_PERMISSION,
    );
    const inv2 = inv2Bytes.toHexString();

    const inv3Bytes = getInvitationId(
      Bytes.fromHexString(docId),
      Bytes.fromHexString("0x0101"),
      WRITE_PERMISSION,
    );
    const inv3 = inv3Bytes.toHexString();

    assert.entityCount("Document", 1);
    assert.fieldEquals("Document", docId, "creator", creator);
    assert.fieldEquals("Document", docId, "timestamp", docTime);
    assert.fieldEquals("Document", docId, "source", "BLOCK");
    assert.fieldEquals("Document", docId, "proof", docProof);
    assert.fieldEquals("Document", docId, "metadata", "metadata1");

    const document = Document.load(Bytes.fromHexString(docId));

    if (!document) {
      throw new Error(`Document ${docId} not found`);
    }

    const events = document.events.load();

    assert.i32Equals(
      1,
      events.length,
      `The document should have 1 related event. Expected: 1, Actual: ${events.length}`,
    );

    const expectedEventId = Bytes.fromHexString(docId).concat(
      Bytes.fromHexString("0xeeda"),
    );

    assert.bytesEquals(
      expectedEventId,
      events[0].id,
      `events[0].id should be correct. Expected: ${expectedEventId.toHexString()}, actual: ${events[0].id.toHexString()}`,
    );

    const documentInvitations = document.invitations.load();

    assert.i32Equals(
      4,
      documentInvitations.length,
      `The document should have 4 related invitations. Expected: 4, Actual: ${documentInvitations.length}`,
    );

    // We can't trust the order of the invitations, hence we can simply check that they're all included
    const documentInvitationsIds = documentInvitations.map<string>((inv) =>
      inv.id.toHexString(),
    );
    assertArrayContainsAllValues(
      documentInvitationsIds,
      [creatorInvitationId.toHexString(), inv1, inv2, inv3],
      "documentInvitations should contain [creatorInvitationId, inv1, inv2, inv3]",
    );

    assert.entityCount("Creator", 1);

    let creatorEntity = Creator.load(creator);

    if (!creatorEntity) {
      throw new Error("Creator not found");
    }

    assert.booleanEquals(
      true,
      creatorEntity.active,
      "The creator should be active",
    );

    let creatorDocuments = creatorEntity.documents.load();

    if (!creatorDocuments) {
      throw new Error("Documents not found");
    }

    assert.i32Equals(
      1,
      creatorDocuments.length,
      "The creator should have 1 related document",
    );
    assert.bytesEquals(Bytes.fromHexString(docId), creatorDocuments[0].id);

    assert.entityCount("Invitation", 4);
    assert.fieldEquals("Invitation", inv1, "type", "DELEGATE");
    assert.fieldEquals("Invitation", inv1, "grantedBy", creatorHex);
    assert.fieldEquals("Invitation", inv1, "subject", "0xa210");

    const invitation1 = Invitation.load(Bytes.fromHexString(inv1));
    if (!invitation1) {
      throw new Error(`Invitation ${inv1} not found`);
    }
    const invitation1Children = invitation1.children.load();
    assert.i32Equals(
      1,
      invitation1Children.length,
      "The invitation #1 should have 1 child",
    );
    assert.bytesEquals(
      Bytes.fromHexString(inv3),
      invitation1Children[0].id,
      `The child invitation ID should be ${inv3}`,
    );
    assert.booleanEquals(
      true,
      !invitation1.parent,
      "The invitation #1 should not have a parent",
    );

    assert.fieldEquals("Invitation", inv2, "type", "WRITE");
    assert.fieldEquals("Invitation", inv2, "grantedBy", creatorHex);
    assert.fieldEquals("Invitation", inv2, "subject", "0xa210");

    const invitation2 = Invitation.load(Bytes.fromHexString(inv2));
    if (!invitation2) {
      throw new Error(`Invitation ${inv2} not found`);
    }
    const invitation2Children = invitation2.children.load();
    assert.i32Equals(
      0,
      invitation2Children.length,
      "The invitation #2 should have 0 child",
    );
    assert.booleanEquals(
      true,
      !invitation2.parent,
      "The invitation #2 should not have a parent",
    );

    assert.fieldEquals("Invitation", inv3, "type", "WRITE");
    assert.fieldEquals("Invitation", inv3, "grantedBy", "0xa210");
    assert.fieldEquals("Invitation", inv3, "subject", "0x0101");

    const invitation3 = Invitation.load(Bytes.fromHexString(inv3));
    if (!invitation3) {
      throw new Error(`Invitation ${inv3} not found`);
    }
    const invitation3Children = invitation3.children.load();
    assert.i32Equals(
      0,
      invitation3Children.length,
      "The invitation #3 should have 0 child",
    );
    assert.bytesEquals(
      Bytes.fromHexString(inv1),
      invitation3.parent!,
      "The invitation #3 should have a parent (invitation #1)",
    );

    assert.entityCount("Operator", 5);

    let operator = Operator.load(Bytes.fromHexString("0xa210"));
    if (!operator) {
      throw new Error(`Operator 0xa210 not found`);
    }
    let operatorInvitations = operator.invitations.load();
    assert.i32Equals(
      2,
      operatorInvitations.length,
      "The operator 0xa210 should have 2 invitations",
    );

    // We can't trust the order of the invitations, hence we can simply check that they're all included
    const operatorInvitationsIds = operatorInvitations.map<string>((inv) =>
      inv.id.toHexString(),
    );
    assertArrayContainsAllValues(
      operatorInvitationsIds,
      [inv1, inv2],
      "Operator 0xa210 should have 2 invitations: [${inv1}, ${inv2}]",
    );

    operator = Operator.load(Bytes.fromHexString("0x0101"));
    if (!operator) {
      throw new Error(`Operator 0x0101 not found`);
    }
    operatorInvitations = operator.invitations.load();
    assert.i32Equals(
      1,
      operatorInvitations.length,
      "The operator 0x0101 should have 1 invitation",
    );
    assert.bytesEquals(
      Bytes.fromHexString(inv3),
      operatorInvitations[0].id,
      "Operator 0x0101 should have 1 invitation: inv3",
    );

    // The document is then removed
    const event = createDocumentRemovedEvent(docId);

    handleDocumentRemovedEvent(event);

    assert.entityCount("Document", 0);

    assert.entityCount("Creator", 1);
    assert.fieldEquals("Creator", creator, "active", "true");

    creatorEntity = Creator.load(creator);

    if (!creatorEntity) {
      throw new Error("Creator not found");
    }

    creatorDocuments = creatorEntity.documents.load();
    assert.i32Equals(
      0,
      creatorDocuments.length,
      "The creator should have 0 documents",
    );

    assert.entityCount("Invitation", 0);

    assert.entityCount("Operator", 5);
    // assert.fieldEquals("Operator", "0xa210", "invitations", "[]");
    operator = Operator.load(Bytes.fromHexString("0xa210"));
    if (!operator) {
      throw new Error(`Operator 0xa210 not found`);
    }
    operatorInvitations = operator.invitations.load();
    assert.i32Equals(
      0,
      operatorInvitations.length,
      "The operator 0xa210 should have 0 invitation",
    );

    operator = Operator.load(Bytes.fromHexString("0x0101"));
    if (!operator) {
      throw new Error(`Operator 0x0101 not found`);
    }
    operatorInvitations = operator.invitations.load();
    assert.i32Equals(
      0,
      operatorInvitations.length,
      "The operator 0x0101 should have 0 invitation",
    );
  });
});
