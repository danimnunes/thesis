import { Address, Bytes, crypto, ethereum } from "@graphprotocol/graph-ts";
import { newMockEvent } from "matchstick-as";

import { ProxyDeployed } from "../generated/ProxyFactory/ProxyFactory";
import {
  TemplateAdded,
  TemplateDeprecated,
  TemplateUpdated,
} from "../generated/ProxyTemplateRegistry/ProxyTemplateRegistry";

export function createProxyDeployedEvent(
  proxyAddress: Address,
  templateId: Bytes,
  deployer: Address,
  issuerDID: string,
  initData: Bytes,
  timestamp: i32,
): ProxyDeployed {
  const event = changetype<ProxyDeployed>(newMockEvent());
  event.parameters = [
    new ethereum.EventParam(
      "proxyAddress",
      ethereum.Value.fromAddress(proxyAddress),
    ),
    new ethereum.EventParam(
      "templateId",
      ethereum.Value.fromFixedBytes(templateId),
    ),
    new ethereum.EventParam("deployer", ethereum.Value.fromAddress(deployer)),
    new ethereum.EventParam("issuerDID", ethereum.Value.fromString(issuerDID)),
    new ethereum.EventParam("initData", ethereum.Value.fromBytes(initData)),
    new ethereum.EventParam("timestamp", ethereum.Value.fromI32(timestamp)),
  ];
  return event;
}

export function createTemplateAddedEvent(
  templateId: Bytes,
  name: string,
  version: string,
): TemplateAdded {
  const event = changetype<TemplateAdded>(newMockEvent());

  event.parameters = [
    new ethereum.EventParam("templateId", ethereum.Value.fromBytes(templateId)),
    new ethereum.EventParam("name", ethereum.Value.fromString(name)),
    new ethereum.EventParam("version", ethereum.Value.fromString(version)),
  ];

  return event;
}

export function createTemplateDeprecatedEvent(
  templateId: Bytes,
): TemplateDeprecated {
  const event = changetype<TemplateDeprecated>(newMockEvent());

  event.parameters = [
    new ethereum.EventParam("templateId", ethereum.Value.fromBytes(templateId)),
  ];

  return event;
}

export function createTemplateUpdatedEvent(
  templateId: Bytes,
  repoURI: string,
  auditURI: string,
): TemplateUpdated {
  const event = changetype<TemplateUpdated>(newMockEvent());

  event.parameters = [
    new ethereum.EventParam("templateId", ethereum.Value.fromBytes(templateId)),
    new ethereum.EventParam("repoURI", ethereum.Value.fromString(repoURI)),
    new ethereum.EventParam("auditURI", ethereum.Value.fromString(auditURI)),
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
