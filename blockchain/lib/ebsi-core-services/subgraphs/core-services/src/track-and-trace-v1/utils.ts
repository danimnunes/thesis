import { Bytes } from "@graphprotocol/graph-ts";

export function getInvitationId(
  documentId: Bytes,
  operatorId: Bytes,
  permission: i32,
): Bytes {
  return documentId.concat(operatorId).concatI32(permission);
}
