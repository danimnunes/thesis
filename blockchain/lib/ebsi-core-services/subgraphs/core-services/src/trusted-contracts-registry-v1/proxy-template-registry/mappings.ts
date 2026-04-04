import { log } from "@graphprotocol/graph-ts";

import {
  TemplateAdded,
  TemplateDeprecated,
  TemplateUpdated,
} from "../../../generated/ProxyTemplateRegistry/ProxyTemplateRegistry";
import { ContractTemplate } from "../../../generated/schema";
import { decodeTransactionInput } from "./utils";

export function handleTemplateAddedEvent(event: TemplateAdded): void {
  // Decode transaction input
  const decoded = decodeTransactionInput(
    "addTemplate((string,string,address,string,string,bytes32,bytes4,bytes32,bool))",
    event.transaction,
  );

  if (!decoded) {
    log.error("Failed to decode addTemplate parameters - {}", [
      event.transaction.input.toHexString(),
    ]);
    return;
  }

  const txArgs = decoded.toTuple();
  const templateArgs = txArgs[0].toTuple();

  /*
    templateArgs:
      - string name;
      - string version;
      - address beaconAddress;
      - string repoURI;
      - string auditURI;
      - bytes32 contractHash;
      - bytes4 initSelector;
      - bytes32 storageLayoutHash;
      - bool isActive;
  */

  const template = new ContractTemplate(event.params.templateId);

  template.name = templateArgs[0].toString();
  template.version = templateArgs[1].toString();
  template.beaconAddress = templateArgs[2].toAddress();
  template.repoURI = templateArgs[3].toString();
  template.auditURI = templateArgs[4].toString();
  template.contractHash = templateArgs[5].toBytes();
  template.initSelector = templateArgs[6].toBytes();
  template.storageLayoutHash = templateArgs[7].toBytes();
  template.isActive = true; // Set to true in SC

  template.save();
}

export function handleTemplateDeprecatedEvent(event: TemplateDeprecated): void {
  const template = ContractTemplate.load(event.params.templateId);

  if (!template) {
    log.error("Template {} not found", [event.params.templateId.toHexString()]);
    return;
  }

  template.isActive = false;
  template.save();
}

export function handleTemplateUpdatedEvent(event: TemplateUpdated): void {
  const template = ContractTemplate.load(event.params.templateId);

  if (!template) {
    log.error("Template {} not found", [event.params.templateId.toHexString()]);
    return;
  }

  // Decode transaction input
  const decoded = decodeTransactionInput(
    "updateTemplateMetadata(bytes32,string,string)",
    event.transaction,
  );

  if (!decoded) {
    log.error("Failed to decode updateTemplateMetadata parameters - {}", [
      event.transaction.input.toHexString(),
    ]);
    return;
  }

  const txArgs = decoded.toTuple();

  /*
    txArgs:
      - bytes32 templateId
      - string repoURI
      - string auditURI
  */

  template.repoURI = txArgs[1].toString();
  template.auditURI = txArgs[2].toString();

  template.save();
}
