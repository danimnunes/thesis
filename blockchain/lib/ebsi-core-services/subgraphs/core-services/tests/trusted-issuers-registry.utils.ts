import { Bytes, crypto, ethereum } from "@graphprotocol/graph-ts";
import { assert, newMockEvent } from "matchstick-as";

import {
  AddAttributeRevision,
  AddIssuerProxy,
  RemoveIssuerProxy,
  UpdateIssuerProxy,
} from "../generated/TrustedIssuersRegistry/TrustedIssuersRegistry";

export function assertArrayContainsAllValues<T>(
  array: T[],
  values: T[],
  message: string,
): void {
  for (let i = 0, k = values.length; i < k; ++i) {
    assert.booleanEquals(true, array.includes(values[i]) as boolean, message);
  }
}

export function createAddAttributeRevisionEvent(
  did: string,
  attributeId: Bytes,
  revisionId: Bytes,
  issuerType: i32,
): AddAttributeRevision {
  const event = changetype<AddAttributeRevision>(newMockEvent());

  event.parameters = [
    new ethereum.EventParam("did", ethereum.Value.fromString(did)),
    new ethereum.EventParam(
      "attributeId",
      ethereum.Value.fromBytes(attributeId),
    ),
    new ethereum.EventParam("revisionId", ethereum.Value.fromBytes(revisionId)),
    new ethereum.EventParam("issuerType", ethereum.Value.fromI32(issuerType)),
  ];

  return event;
}

export function createAddIssuerProxyEvent(
  did: string,
  proxyId: Bytes,
): AddIssuerProxy {
  const event = changetype<AddIssuerProxy>(newMockEvent());

  event.parameters = [
    new ethereum.EventParam("did", ethereum.Value.fromString(did)),
    new ethereum.EventParam("proxyId", ethereum.Value.fromBytes(proxyId)),
  ];

  return event;
}

export function createRemoveIssuerProxyEvent(
  did: string,
  proxyId: Bytes,
): RemoveIssuerProxy {
  const event = changetype<RemoveIssuerProxy>(newMockEvent());

  event.parameters = [
    new ethereum.EventParam("did", ethereum.Value.fromString(did)),
    new ethereum.EventParam("proxyId", ethereum.Value.fromBytes(proxyId)),
  ];

  return event;
}

export function createUpdateIssuerProxyEvent(
  did: string,
  proxyId: Bytes,
): UpdateIssuerProxy {
  const event = changetype<UpdateIssuerProxy>(newMockEvent());

  event.parameters = [
    new ethereum.EventParam("did", ethereum.Value.fromString(did)),
    new ethereum.EventParam("proxyId", ethereum.Value.fromBytes(proxyId)),
  ];

  return event;
}

export function encodeTransactionInput(
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
