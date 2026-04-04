import { Bytes, log, store } from "@graphprotocol/graph-ts";

import {
  DidDocument,
  Issuer,
  IssuerAttribute,
  IssuerAttributeRevision,
  IssuerProxy,
} from "../../generated/schema";
import {
  AddAttributeRevision,
  AddIssuerProxy,
  RemoveIssuerProxy,
  UpdateIssuerProxy,
} from "../../generated/TrustedIssuersRegistry/TrustedIssuersRegistry";
import { ROOT_TAO } from "./constants";
import { decodeTransactionInput, getIssuerType } from "./utils";

// List of function signature hashes (see https://web3tools.chainstacklabs.com/generate-solidity-functions-signature)
// 0x66fb2ae2 <-> setAttributeMetadata(string,bytes32,uint8,string,bytes32)
// 0x1bef3e0c <-> setAttributeData(string,bytes32,bytes)
// 0xf4fd7649 <-> addIssuerProxy(string,string)
// 0x7beeda81 <-> updateIssuerProxy(string,bytes32,string)
// 0xa6256c18 <-> removeIssuerProxy(string,bytes32)

export function handleAddAttributeRevisionEvent(
  event: AddAttributeRevision,
): void {
  log.info("Adding revision {} to {}", [
    event.params.attributeId.toHexString(),
    event.params.did,
  ]);

  const fnSignatureBytes = new Bytes(4);
  fnSignatureBytes.set(event.transaction.input.slice(0, 4));

  if (fnSignatureBytes.equals(Bytes.fromHexString("0x66fb2ae2"))) {
    handleSetAttributeMetadata(event);
    return;
  }

  if (fnSignatureBytes.equals(Bytes.fromHexString("0x1bef3e0c"))) {
    handleSetAttributeData(event);
    return;
  }

  log.error("Unhandled function signature {}", [
    fnSignatureBytes.toHexString(),
  ]);
}

export function handleAddIssuerProxyEvent(event: AddIssuerProxy): void {
  log.info("Adding proxy {} to {}", [
    event.params.proxyId.toHexString(),
    event.params.did,
  ]);

  const issuer = Issuer.load(event.params.did);

  if (!issuer) {
    log.error("Issuer {} doesn't exist", [event.params.did]);
    return;
  }

  const proxy = new IssuerProxy(event.params.proxyId);
  proxy.issuer = issuer.id;

  // Get proxy data from transaction input
  const decoded = decodeTransactionInput(
    "addIssuerProxy(string,string)",
    event.transaction,
  );

  if (!decoded) {
    log.error("Failed to decode proxy data - {}", [
      event.transaction.input.toHexString(),
    ]);
    return;
  }

  // Set proxy data (second parameter of the transaction input)
  proxy.data = decoded.toTuple()[1].toString();

  proxy.save();
}

export function handleRemoveIssuerProxyEvent(event: RemoveIssuerProxy): void {
  log.info("Removing proxy {} to {}", [
    event.params.proxyId.toHexString(),
    event.params.did,
  ]);

  store.remove("IssuerProxy", event.params.proxyId.toHexString());
}

export function handleUpdateIssuerProxyEvent(event: UpdateIssuerProxy): void {
  log.info("Updating proxy {} to {}", [
    event.params.proxyId.toHexString(),
    event.params.did,
  ]);

  const issuer = Issuer.load(event.params.did);

  if (!issuer) {
    log.error("Issuer {} doesn't exist", [event.params.did]);
    return;
  }

  const proxy = IssuerProxy.load(event.params.proxyId);

  if (!proxy) {
    log.error("Proxy {} doesn't exist", [event.params.proxyId.toHexString()]);
    return;
  }

  // Get proxy data from transaction input
  const decoded = decodeTransactionInput(
    "updateIssuerProxy(string,bytes32,string)",
    event.transaction,
  );

  if (!decoded) {
    log.error("Failed to decode proxy data - {}", [
      event.transaction.input.toHexString(),
    ]);
    return;
  }

  // Set proxy data (third parameter of the transaction input)
  proxy.data = decoded.toTuple()[2].toString();

  proxy.save();
}

function handleSetAttributeData(event: AddAttributeRevision): void {
  log.info("Handling setAttributeData call for DID {}", [event.params.did]);

  // Load issuer
  const issuer = Issuer.load(event.params.did);

  if (!issuer) {
    log.error("Issuer {} doesn't exist", [event.params.did]);
    return;
  }

  // Load attribute
  const attribute = IssuerAttribute.load(event.params.attributeId);

  if (!attribute) {
    log.error("Attribute {} of issuer {} doesn't exist", [
      event.params.attributeId.toHexString(),
      event.params.did,
    ]);
    return;
  }

  // Load latest revision
  const latestRevision = IssuerAttributeRevision.load(attribute.latestRevision);

  if (!latestRevision) {
    log.error("Latest revision {} doesn't exist", [
      attribute.latestRevision.toHexString(),
    ]);
    return;
  }

  // Decode transaction input
  const decoded = decodeTransactionInput(
    "setAttributeData(string,bytes32,bytes)",
    event.transaction,
  );

  if (!decoded) {
    log.error("Failed to decode setAttributeData parameters - {}", [
      event.transaction.input.toHexString(),
    ]);
    return;
  }

  // setAttributeMetadata parameters:
  // 0 - string calldata did
  // 1 - bytes32 attributeId
  // 2 - bytes calldata attributeData
  const decodedTuple = decoded.toTuple();

  // Create new revision
  const newRevision = new IssuerAttributeRevision(event.params.revisionId);
  newRevision.attribute = attribute.id;
  newRevision.body = decodedTuple[2].toBytes().toString();
  newRevision.issuerType = latestRevision.issuerType;
  newRevision.tao = latestRevision.tao;
  newRevision.rootTao = latestRevision.rootTao;
  newRevision.timestamp = event.block.timestamp;
  newRevision.save();

  attribute.latestRevision = newRevision.id;
  attribute.save();
}

function handleSetAttributeMetadata(event: AddAttributeRevision): void {
  log.info("Handling setAttributeMetadata call for DID {}", [event.params.did]);

  // Load issuer
  let issuer = Issuer.load(event.params.did);

  if (issuer) {
    log.info("Issuer {} already exists", [event.params.did]);
  } else {
    log.info("Creating new issuer {}", [event.params.did]);

    // Create a new issuer
    issuer = new Issuer(event.params.did);
    issuer.save();
  }

  // Check if DID document exists and attach it to the issuer
  const didDocument = DidDocument.load(issuer.id);

  if (didDocument) {
    log.info("Attaching DID document to issuer {}", [event.params.did]);
    issuer.didDocument = didDocument.id;
    issuer.save();
    didDocument.trustedIssuer = issuer.id;
    didDocument.save();
  } else {
    log.info("DID document {} doesn't exist", [event.params.did]);
  }

  // Load attribute
  let attribute = IssuerAttribute.load(event.params.attributeId);

  if (attribute) {
    log.info("Attribute {} already exists", [
      event.params.attributeId.toHexString(),
    ]);
  } else {
    log.info("Creating new attribute {}", [
      event.params.attributeId.toHexString(),
    ]);

    // If the attribute doesn't exist yet, create a new attribute and attach it to the issuer
    attribute = new IssuerAttribute(event.params.attributeId);
    attribute.issuer = issuer.id;
  }

  // Decode transaction input
  const decoded = decodeTransactionInput(
    "setAttributeMetadata(string,bytes32,uint8,string,bytes32)",
    event.transaction,
  );

  if (!decoded) {
    log.error("Failed to decode setAttributeMetadata parameters - {}", [
      event.transaction.input.toHexString(),
    ]);
    return;
  }

  // setAttributeMetadata parameters:
  // 0 - string calldata did
  // 1 - bytes32 revisionId
  // 2 - IssuerType issuerType
  // 3 - string calldata taoDid
  // 4 - bytes32 attributeIdTao
  const decodedTuple = decoded.toTuple();

  const issuerType = decodedTuple[2].toI32();

  // Create new revision
  const revision = new IssuerAttributeRevision(event.params.revisionId);
  revision.attribute = attribute.id;
  revision.body = "";
  revision.issuerType = getIssuerType(issuerType);

  if (issuerType === ROOT_TAO) {
    revision.tao = event.params.did;
    revision.rootTao = event.params.did;
  } else {
    const taoDid = decodedTuple[3].toString();
    revision.tao = taoDid;

    // "attributeIdTao" can be any attribute revision, hence why we first need to load the revision, then the related attribute, and finally the latest revision of the attribute
    const taoAttributeId = decodedTuple[4].toBytes();

    const taoAttributeRevision = IssuerAttributeRevision.load(taoAttributeId);

    if (!taoAttributeRevision) {
      log.error("Attribute revision {} of TAO {} doesn't exist", [
        taoAttributeId.toHexString(),
        taoDid,
      ]);
      return;
    }

    const taoAttribute = IssuerAttribute.load(taoAttributeRevision.attribute);

    if (!taoAttribute) {
      log.error("Attribute {} of TAO {} doesn't exist", [
        taoAttributeId.toHexString(),
        taoDid,
      ]);
      return;
    }

    const taoAttributeLatestRevision = IssuerAttributeRevision.load(
      taoAttribute.latestRevision,
    );

    if (!taoAttributeLatestRevision) {
      log.error("Revision {} of attribute {} of TAO {} doesn't exist", [
        taoAttribute.latestRevision.toHexString(),
        taoAttributeId.toHexString(),
        taoDid,
      ]);
      return;
    }

    revision.rootTao = taoAttributeLatestRevision.rootTao;
  }

  revision.timestamp = event.block.timestamp;
  revision.save();

  attribute.latestRevision = revision.id;
  attribute.save();
}
