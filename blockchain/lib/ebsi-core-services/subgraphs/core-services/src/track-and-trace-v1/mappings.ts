import { Bytes, ethereum, log, store } from "@graphprotocol/graph-ts";

import {
  Creator,
  Document,
  DocumentEvent,
  Invitation,
  Operator,
} from "../../generated/schema";
import {
  AccessGranted,
  AccessRevoked,
  DidEbsiAuthorised,
  DocumentCreated,
  DocumentRemoved,
  EventWritten,
} from "../../generated/TrackAndTrace/TrackAndTrace";
import { CREATOR_PERMISSION, DELEGATE_PERMISSION } from "./constants";
import { getInvitationId } from "./utils";

class TransactionArguments {
  args: ethereum.Tuple;

  fn: string;

  constructor() {
    // eslint-disable-next-line unicorn/prefer-class-fields
    this.fn = "";
    this.args = new ethereum.Tuple();
  }
}

export function handleAccessGrantedEvent(event: AccessGranted): void {
  const document = Document.load(event.params.docHash);

  if (!document) {
    log.error("Document {} not found", [event.params.docHash.toHexString()]);
    return;
  }

  // Create operator if it doesn't exist
  let operator = Operator.load(event.params.subject);

  if (!operator) {
    operator = new Operator(event.params.subject);
    operator.save();
  }

  // Create invitation
  const invitation = new Invitation(
    getInvitationId(document.id, operator.id, event.params.permission),
  );

  invitation.document = document.id;
  invitation.type = getPermission(event.params.permission);
  invitation.grantedBy = event.params.signer;
  invitation.subject = operator.id;

  if (
    invitation.type == "WRITE" &&
    invitation.grantedBy.toString() != document.creator
  ) {
    // Write access granted by a delegate. Get the delegate and update the children
    const parentInvitation = Invitation.load(
      getInvitationId(document.id, invitation.grantedBy, DELEGATE_PERMISSION),
    );

    if (parentInvitation) {
      invitation.parent = parentInvitation.id;
    }
  }

  invitation.save();
}

export function handleAccessRevokedEvent(event: AccessRevoked): void {
  const txArgs = getTransactionArguments(event);
  const permission = txArgs.args[3].toI32();

  const document = Document.load(event.params.docHash);

  if (!document) {
    log.error("Document {} not found", [event.params.docHash.toHexString()]);
    return;
  }

  const invitation = Invitation.load(
    getInvitationId(document.id, event.params.subject, permission),
  );

  if (!invitation) {
    log.error("Invitation {} not found", [
      `${document.id.toHexString()}${event.params.subject.toHexString()}${permission}`,
    ]);
    return;
  }

  // Remove child invitations
  recursivelyDeleteInvitation(invitation.id);
}

export function handleDidEbsiAuthorisedEvent(event: DidEbsiAuthorised): void {
  let creator = Creator.load(event.params.did);

  // Create creator if it doesn't exist
  if (!creator) {
    creator = new Creator(event.params.did);
  }

  creator.active = event.params.val;
  creator.save();
}

export function handleDocumentCreatedEvent(event: DocumentCreated): void {
  // Load creator
  const creator = Creator.load(event.params.creator);

  if (!creator) {
    log.error("Creator {} not found", [event.params.creator]);
    return;
  }

  // Create document
  const document = new Document(event.params.docHash);
  document.creator = creator.id;
  document.timestamp = event.params.timestamp;
  document.source = getSource(event.params.source);
  document.proof = event.params.proof;
  document.metadata = event.params.metadata;
  document.save();

  // Create operator
  const creatorBytes = Bytes.fromUTF8(event.params.creator);
  let operator = Operator.load(creatorBytes);

  if (!operator) {
    operator = new Operator(creatorBytes);
    operator.save();
  }

  // Create invitation for creator / operator
  const invitation = new Invitation(
    getInvitationId(document.id, creatorBytes, CREATOR_PERMISSION),
  );
  invitation.document = document.id;
  invitation.type = "CREATOR";
  invitation.grantedBy = creatorBytes;
  invitation.subject = operator.id;
  invitation.save();
}

export function handleDocumentRemovedEvent(event: DocumentRemoved): void {
  const document = Document.load(event.params.docHash);

  if (!document) {
    log.error("Document {} not found", [event.params.docHash.toHexString()]);
    return;
  }

  // Remove invitations
  const invitations = document.invitations.load();
  for (let i = 0, k = invitations.length; i < k; i += 1) {
    recursivelyDeleteInvitation(invitations[i].id);
  }

  // Remove events
  const events = document.events.load();
  for (let i = 0, k = events.length; i < k; i += 1) {
    store.remove("DocumentEvent", events[i].id.toHexString());
  }

  // Remove document
  store.remove("Document", document.id.toHexString());
}

export function handleEventWrittenEvent(event: EventWritten): void {
  const txArgs = getTransactionArguments(event);
  const externalHash = txArgs.args[0].toTuple()[1].toString();

  const document = Document.load(event.params.docHash);

  if (!document) {
    log.error("Document {} not found", [event.params.docHash.toHexString()]);
    return;
  }

  const eventId = document.id.concat(event.params.eventHash);

  let writeEvent = DocumentEvent.load(eventId);

  if (writeEvent) {
    log.error("Event {} already exists", [eventId.toHexString()]);
    return;
  }

  writeEvent = new DocumentEvent(eventId);
  writeEvent.document = document.id;
  writeEvent.hash = event.params.eventHash;
  writeEvent.externalHash = externalHash;
  writeEvent.timestamp = event.params.timestamp;
  writeEvent.source = getSource(event.params.source);
  writeEvent.proof = event.params.proof;
  writeEvent.sender = event.params.sender;
  writeEvent.origin = event.params.origin;
  writeEvent.metadata = event.params.metadata;
  writeEvent.save();
}

function getPermission(i: i32): string {
  switch (i) {
    case CREATOR_PERMISSION: {
      return "CREATOR";
    }
    case DELEGATE_PERMISSION: {
      return "DELEGATE";
    }
    default: {
      return "WRITE";
    }
  }
}

function getSource(i: i32): string {
  switch (i) {
    case 0: {
      return "BLOCK";
    }
    case 1: {
      return "EXTERNAL";
    }
    default: {
      return "EXTERNAL";
    }
  }
}

function getTransactionArguments(event: ethereum.Event): TransactionArguments {
  // see https://medium.com/@r2d2_68242/indexing-transaction-input-data-in-a-subgraph-6ff5c55abf20
  const fnSignatureBytes = new Bytes(4);
  fnSignatureBytes.set(event.transaction.input.slice(0, 4));
  const fnSignature = fnSignatureBytes.toU32();

  const txArgs = new TransactionArguments();
  let type = "";
  switch (fnSignature) {
    case 0x32_b9_b5_03: {
      // revokeAccess(bytes32,bytes,bytes,uint8)
      // keccak256 - 0x03b5b932
      type = "(bytes32,bytes,bytes,uint8)";
      txArgs.fn = "revokeAccess";
      break;
    }
    case 0x46_f3_92_f6: {
      // writeEvent((bytes32,string,bytes,string,string),uint256,bytes32)
      // keccak256 - 0xf692f346
      type = "((bytes32,string,bytes,string,string),uint256,bytes32)";
      txArgs.fn = "writeEventExternalTimestamp";
      break;
    }
    case 0x79_05_37_6c: {
      // writeEvent((bytes32,string,bytes,string,string))
      // keccak256 - 0x6c370579
      type = "((bytes32,string,bytes,string,string))";
      txArgs.fn = "writeEvent";
      break;
    }
    default: {
      break;
    }
  }

  const tuplePrefix = new Bytes(32);
  tuplePrefix[31] = 0x20;
  const data = new Bytes(
    event.transaction.input.length - 4 + tuplePrefix.length,
  );
  data.set(tuplePrefix, 0);
  data.set(event.transaction.input.slice(4), 32);
  const decoded = ethereum.decode(type, data);
  txArgs.args = decoded!.toTuple();
  return txArgs;
}

function recursivelyDeleteInvitation(invitationId: Bytes): void {
  log.info("Removing invitation {}", [invitationId.toHexString()]);

  const invitation = Invitation.load(invitationId);

  if (!invitation) {
    log.info("The invitation {} has already been deleted", [
      invitationId.toHexString(),
    ]);
    return;
  }

  const childInvitations = invitation.children.load();
  if (childInvitations.length > 0) {
    for (let i = 0, k = childInvitations.length; i < k; i += 1) {
      recursivelyDeleteInvitation(childInvitations[i].id);
    }
  }

  store.remove("Invitation", invitation.id.toHexString());
}
