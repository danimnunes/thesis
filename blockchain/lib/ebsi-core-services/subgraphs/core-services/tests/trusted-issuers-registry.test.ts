import { BigInt, Bytes, ethereum } from "@graphprotocol/graph-ts";
import {
  afterAll,
  assert,
  beforeAll,
  clearStore,
  describe,
  test,
} from "matchstick-as";

import {
  DidDocument,
  Issuer,
  IssuerAttribute,
  IssuerAttributeRevision,
} from "../generated/schema";
import {
  ROOT_TAO,
  TAO,
  TI,
} from "../src/trusted-issuers-registry-v5/constants";
import {
  handleAddAttributeRevisionEvent,
  handleAddIssuerProxyEvent,
  handleRemoveIssuerProxyEvent,
  handleUpdateIssuerProxyEvent,
} from "../src/trusted-issuers-registry-v5/mappings";
import { getIssuerType } from "../src/trusted-issuers-registry-v5/utils";
import {
  assertArrayContainsAllValues,
  createAddAttributeRevisionEvent,
  createAddIssuerProxyEvent,
  createRemoveIssuerProxyEvent,
  createUpdateIssuerProxyEvent,
  encodeTransactionInput,
} from "./trusted-issuers-registry.utils";

describe("Trusted Issuers Registry - entity assertions", () => {
  const rootTao = "did:ebsi:roottao";
  const rootTaoAttributeId =
    "0xee5e41cb17fa69b61fda65c03d2f7d11172729c7f8559a51b5eeecd21fdb95e1";

  const tao = "did:ebsi:tao";
  const taoAttributeId =
    "0x4c7d968e36f8a3885911dd433d5aa58f1c104856d642a3c2ec0fa6c3ae04a9b5";

  const ti = "did:ebsi:1";
  const tiAttributeId =
    "0x9c3b1f5c1f7700cb3d8527f10cf3631f17b3bf294d3d2eeb434d157c1e07408d";
  const tiRevisionId =
    "0xb5e299b7b4ce8d2ba6c471f24f9b02e0207102246689aef1d989fc3c731a8ef4";
  const tiAttributeBody = "eyJhbGciOiJFUzI1NiIsI..";

  const proxyId =
    "0xadb69cdf99910e337ac18e7d8358aee5425514e3f63db994c07649bafe665c88";
  const proxyData =
    '{"prefix":"https://root-tao.ebsi.eu/root-tao/v1","headers":{},"testSuffix":"/credentials/status/1"}';
  const proxyDataUpdated =
    '{"prefix":"https://root-tao.ebsi.eu/root-tao/v1","headers":{},"testSuffix":"/credentials/status/2"}';

  beforeAll(() => {
    // Initialize the TIR with a RootTAO
    const issuer = new Issuer(rootTao);
    issuer.save();

    const attribute = new IssuerAttribute(
      Bytes.fromHexString(rootTaoAttributeId),
    );
    attribute.issuer = issuer.id;
    attribute.latestRevision = Bytes.fromHexString(rootTaoAttributeId);
    attribute.save();

    const revision = new IssuerAttributeRevision(
      Bytes.fromHexString(rootTaoAttributeId),
    );
    revision.attribute = attribute.id;
    revision.body = "";
    revision.issuerType = getIssuerType(ROOT_TAO);
    revision.tao = rootTao;
    revision.rootTao = rootTao;
    revision.timestamp = BigInt.fromI32(1);
    revision.save();
  });

  afterAll(() => {
    clearStore();
  });

  test("Validate initial state", () => {
    assert.entityCount("Issuer", 1);
    assert.entityCount("IssuerAttribute", 1);

    const issuer = Issuer.load(rootTao);

    if (!issuer) {
      throw new Error("Issuer not found");
    }

    // Check DID document
    if (issuer.didDocument) {
      throw new Error("DID document should not be present");
    }

    const attributes = issuer.attributes.load();

    assert.i32Equals(
      1,
      attributes.length,
      `The issuer should have 1 attribute. Actual: ${attributes.length}`,
    );
    assert.bytesEquals(
      Bytes.fromHexString(rootTaoAttributeId),
      attributes[0].id,
      "The attribute ID should be correct",
    );

    // Check latest attribute revision ID
    assert.bytesEquals(
      attributes[0].latestRevision,
      Bytes.fromHexString(rootTaoAttributeId),
      "The latest revision ID should be rootTaoAttributeId",
    );

    const revisions = attributes[0].revisions.load();

    assert.i32Equals(
      1,
      revisions.length,
      `The attribute should have 1 revision. Actual: ${attributes.length}`,
    );
    assert.bytesEquals(
      Bytes.fromHexString(rootTaoAttributeId),
      revisions[0].id,
      "The revision ID should be correct",
    );

    assert.fieldEquals(
      "IssuerAttributeRevision",
      rootTaoAttributeId,
      "issuerType",
      getIssuerType(ROOT_TAO),
    );
    assert.fieldEquals(
      "IssuerAttributeRevision",
      rootTaoAttributeId,
      "tao",
      rootTao,
    );
    assert.fieldEquals(
      "IssuerAttributeRevision",
      rootTaoAttributeId,
      "rootTao",
      rootTao,
    );
    assert.fieldEquals(
      "IssuerAttributeRevision",
      rootTaoAttributeId,
      "body",
      "",
    );
    assert.fieldEquals(
      "IssuerAttributeRevision",
      rootTaoAttributeId,
      "timestamp",
      "1",
    );

    const proxies = issuer.proxies.load();

    assert.i32Equals(0, proxies.length, "The issuer should have 0 proxy");
  });

  test("Add a new issuer (TAO)", () => {
    // Create DID document for the  TAO (optional)
    const didDocument = new DidDocument(tao);
    didDocument.baseDocument = "{}";
    didDocument.save();

    // The Root TAO calls `setAttributeMetadata` with the following parameters:
    // - did: did:ebsi:tao
    // - revisionId: 0x4c7d968e36f8a3885911dd433d5aa58f1c104856d642a3c2ec0fa6c3ae04a9b5
    // - issuerType: TAO
    // - taoDid: did:ebsi:roottao
    // - attributeIdTao: 0xee5e41cb17fa69b61fda65c03d2f7d11172729c7f8559a51b5eeecd21fdb95e1

    // The smart contract emits the event AddAttributeRevision
    const event = createAddAttributeRevisionEvent(
      tao,
      Bytes.fromHexString(taoAttributeId),
      Bytes.fromHexString(taoAttributeId),
      TAO,
    );

    // Create transaction input
    const tuple: ethereum.Value[] = [
      ethereum.Value.fromString(tao),
      ethereum.Value.fromFixedBytes(Bytes.fromHexString(taoAttributeId)),
      ethereum.Value.fromI32(TAO),
      ethereum.Value.fromString(rootTao),
      ethereum.Value.fromFixedBytes(Bytes.fromHexString(rootTaoAttributeId)),
    ];

    // Set transaction input
    event.transaction.input = encodeTransactionInput(
      "setAttributeMetadata(string,bytes32,uint8,string,bytes32)",
      ethereum.Value.fromTuple(changetype<ethereum.Tuple>(tuple)),
    );

    // Process event
    handleAddAttributeRevisionEvent(event);

    // Validate state
    const issuer = Issuer.load(tao);

    if (!issuer) {
      throw new Error("Issuer not found");
    }

    // Check DID document
    if (!issuer.didDocument) {
      throw new Error("DID document not found");
    }
    const documentId = changetype<string>(issuer.didDocument); // Cast to string
    assert.stringEquals(
      documentId,
      issuer.id,
      "The DID document should be correct",
    );

    const issuerDidDocument = DidDocument.load(documentId);

    if (!issuerDidDocument) {
      throw new Error("DID document not found");
    }

    if (!issuerDidDocument.trustedIssuer) {
      throw new Error("DID document's trustedIssuer property is null");
    }

    assert.stringEquals(
      changetype<string>(issuerDidDocument.trustedIssuer),
      issuer.id,
      "The DID document should have the correct trusted issuer",
    );

    const attributes = issuer.attributes.load();

    assert.i32Equals(
      1,
      attributes.length,
      `The issuer should have 1 attribute. Actual: ${attributes.length}`,
    );
    assert.bytesEquals(
      Bytes.fromHexString(taoAttributeId),
      attributes[0].id,
      "The attribute ID should be correct",
    );

    // Check latest attribute revision ID
    assert.bytesEquals(
      attributes[0].latestRevision,
      Bytes.fromHexString(taoAttributeId),
      "The latest revision ID should be taoAttributeId",
    );

    const revisions = attributes[0].revisions.load();

    assert.i32Equals(
      1,
      revisions.length,
      `The attribute should have 1 revision. Actual: ${attributes.length}`,
    );
    assert.bytesEquals(
      Bytes.fromHexString(taoAttributeId),
      revisions[0].id,
      "The revision ID should be correct",
    );

    assert.fieldEquals(
      "IssuerAttributeRevision",
      taoAttributeId,
      "issuerType",
      getIssuerType(TAO),
    );
    assert.fieldEquals(
      "IssuerAttributeRevision",
      taoAttributeId,
      "tao",
      rootTao,
    );
    assert.fieldEquals(
      "IssuerAttributeRevision",
      taoAttributeId,
      "rootTao",
      rootTao,
    );
    assert.fieldEquals("IssuerAttributeRevision", taoAttributeId, "body", "");
    assert.fieldEquals(
      "IssuerAttributeRevision",
      taoAttributeId,
      "timestamp",
      event.block.timestamp.toString(),
    );

    const proxies = issuer.proxies.load();

    assert.i32Equals(0, proxies.length, "The issuer should have 0 proxy");
  });

  test("Add a new issuer (TI) and register attribute", () => {
    // The TAO calls `setAttributeMetadata` with the following parameters:
    // - did: did:ebsi:1
    // - revisionId: 0x9c3b1f5c1f7700cb3d8527f10cf3631f17b3bf294d3d2eeb434d157c1e07408d
    // - issuerType: TI
    // - taoDid: did:ebsi:tao
    // - attributeIdTao: 0x4c7d968e36f8a3885911dd433d5aa58f1c104856d642a3c2ec0fa6c3ae04a9b5

    // The smart contract emits the event AddAttributeRevision
    let event = createAddAttributeRevisionEvent(
      ti,
      Bytes.fromHexString(tiAttributeId),
      Bytes.fromHexString(tiAttributeId),
      TI,
    );

    // Create transaction input
    let tuple: ethereum.Value[] = [
      ethereum.Value.fromString(ti),
      ethereum.Value.fromFixedBytes(Bytes.fromHexString(tiAttributeId)),
      ethereum.Value.fromI32(TI),
      ethereum.Value.fromString(tao),
      ethereum.Value.fromFixedBytes(Bytes.fromHexString(taoAttributeId)),
    ];

    // Set transaction input
    event.transaction.input = encodeTransactionInput(
      "setAttributeMetadata(string,bytes32,uint8,string,bytes32)",
      ethereum.Value.fromTuple(changetype<ethereum.Tuple>(tuple)),
    );

    // Process event
    handleAddAttributeRevisionEvent(event);

    // Validate state
    let issuer = Issuer.load(ti);

    if (!issuer) {
      throw new Error("Issuer not found");
    }

    let attributes = issuer.attributes.load();

    assert.i32Equals(
      1,
      attributes.length,
      `The issuer should have 1 attribute. Actual: ${attributes.length}`,
    );
    assert.bytesEquals(
      Bytes.fromHexString(tiAttributeId),
      attributes[0].id,
      "The attribute ID should be correct",
    );

    let revisions = attributes[0].revisions.load();

    assert.i32Equals(
      1,
      revisions.length,
      `The attribute should have 1 revision. Actual: ${attributes.length}`,
    );
    assert.bytesEquals(
      Bytes.fromHexString(tiAttributeId),
      revisions[0].id,
      "The revision ID should be correct",
    );

    assert.fieldEquals(
      "IssuerAttributeRevision",
      tiAttributeId,
      "issuerType",
      getIssuerType(TI),
    );
    assert.fieldEquals("IssuerAttributeRevision", tiAttributeId, "tao", tao);
    assert.fieldEquals(
      "IssuerAttributeRevision",
      tiAttributeId,
      "rootTao",
      rootTao,
    );
    assert.fieldEquals("IssuerAttributeRevision", tiAttributeId, "body", "");
    assert.fieldEquals(
      "IssuerAttributeRevision",
      tiAttributeId,
      "timestamp",
      event.block.timestamp.toString(),
    );

    let proxies = issuer.proxies.load();

    assert.i32Equals(0, proxies.length, "The issuer should have 0 proxy");

    // The TI calls `setAttributeData` with the following parameters:
    // - did: did:ebsi:1
    // - attributeId: 0x9c3b1f5c1f7700cb3d8527f10cf3631f17b3bf294d3d2eeb434d157c1e07408d
    // - attributeData: Bytes.fromUTF8("eyJhbGciOiJFUzI1NiIsI..")

    // The smart contract emits the event AddAttributeRevision
    event = createAddAttributeRevisionEvent(
      ti,
      Bytes.fromHexString(tiAttributeId),
      Bytes.fromHexString(tiRevisionId),
      TI,
    );

    // Create transaction input
    tuple = [
      ethereum.Value.fromString(ti), // did
      ethereum.Value.fromFixedBytes(Bytes.fromHexString(tiAttributeId)), // attributeId
      ethereum.Value.fromBytes(Bytes.fromUTF8(tiAttributeBody)), // attributeData
    ];

    // Set transaction input
    event.transaction.input = encodeTransactionInput(
      "setAttributeData(string,bytes32,bytes)",
      ethereum.Value.fromTuple(changetype<ethereum.Tuple>(tuple)),
    );

    // Process event
    handleAddAttributeRevisionEvent(event);

    // Validate state
    issuer = Issuer.load(ti);

    if (!issuer) {
      throw new Error("Issuer not found");
    }

    attributes = issuer.attributes.load();

    assert.i32Equals(
      1,
      attributes.length,
      `The issuer should have 1 attribute. Actual: ${attributes.length}`,
    );
    assert.bytesEquals(
      Bytes.fromHexString(tiAttributeId),
      attributes[0].id,
      "The attribute ID should be correct",
    );

    // Check latest attribute revision ID
    assert.bytesEquals(
      attributes[0].latestRevision,
      Bytes.fromHexString(tiRevisionId),
      "The latest revision ID should be tiRevisionId",
    );

    revisions = attributes[0].revisions.load();

    assert.i32Equals(
      2,
      revisions.length,
      `The attribute should have 2 revisions. Actual: ${attributes.length}`,
    );

    const revisionIds = revisions.map<string>((r) => r.id.toHex());
    assertArrayContainsAllValues(
      revisionIds,
      [tiAttributeId, tiRevisionId],
      "The revisions IDs should be [tiAttributeId, tiRevisionId]",
    );

    // Verify revision #1 (tiAttributeId)
    assert.fieldEquals(
      "IssuerAttributeRevision",
      tiAttributeId,
      "issuerType",
      getIssuerType(TI),
    );
    assert.fieldEquals("IssuerAttributeRevision", tiAttributeId, "tao", tao);
    assert.fieldEquals(
      "IssuerAttributeRevision",
      tiAttributeId,
      "rootTao",
      rootTao,
    );
    assert.fieldEquals("IssuerAttributeRevision", tiAttributeId, "body", "");
    assert.fieldEquals(
      "IssuerAttributeRevision",
      tiAttributeId,
      "timestamp",
      event.block.timestamp.toString(),
    );

    // Verify revision #2 (tiRevisionId)
    assert.fieldEquals(
      "IssuerAttributeRevision",
      tiRevisionId,
      "issuerType",
      getIssuerType(TI),
    );
    assert.fieldEquals("IssuerAttributeRevision", tiRevisionId, "tao", tao);
    assert.fieldEquals(
      "IssuerAttributeRevision",
      tiRevisionId,
      "rootTao",
      rootTao,
    );
    assert.fieldEquals(
      "IssuerAttributeRevision",
      tiRevisionId,
      "body",
      tiAttributeBody,
    );
    assert.fieldEquals(
      "IssuerAttributeRevision",
      tiRevisionId,
      "timestamp",
      event.block.timestamp.toString(),
    );

    proxies = issuer.proxies.load();

    assert.i32Equals(0, proxies.length, "The issuer should have 0 proxy");
  });

  test("Add a proxy", () => {
    const event = createAddIssuerProxyEvent(
      rootTao,
      Bytes.fromHexString(proxyId),
    );

    // Create transaction input
    const tuple: ethereum.Value[] = [
      ethereum.Value.fromString(rootTao),
      ethereum.Value.fromString(proxyData),
    ];

    // Set transaction input
    event.transaction.input = encodeTransactionInput(
      "addIssuerProxy(string,string)",
      ethereum.Value.fromTuple(changetype<ethereum.Tuple>(tuple)),
    );

    // Process event
    handleAddIssuerProxyEvent(event);

    const issuer = Issuer.load(rootTao);

    if (!issuer) {
      throw new Error("Issuer not found");
    }

    const proxies = issuer.proxies.load();

    assert.i32Equals(
      1,
      proxies.length,
      `The issuer should have 1 proxy. Actual: ${proxies.length}`,
    );
    assert.bytesEquals(
      Bytes.fromHexString(proxyId),
      proxies[0].id,
      "The proxy ID should be correct",
    );
    assert.fieldEquals("IssuerProxy", proxyId, "data", proxyData);
  });

  test("Update a proxy", () => {
    const event = createUpdateIssuerProxyEvent(
      rootTao,
      Bytes.fromHexString(proxyId),
    );

    // Create transaction input
    const tuple: ethereum.Value[] = [
      ethereum.Value.fromString(rootTao),
      ethereum.Value.fromBytes(Bytes.fromHexString(proxyId)),
      ethereum.Value.fromString(proxyDataUpdated),
    ];

    // Set transaction input
    event.transaction.input = encodeTransactionInput(
      "updateIssuerProxy(string,bytes32,string)",
      ethereum.Value.fromTuple(changetype<ethereum.Tuple>(tuple)),
    );

    // Process event
    handleUpdateIssuerProxyEvent(event);

    const issuer = Issuer.load(rootTao);

    if (!issuer) {
      throw new Error("Issuer not found");
    }

    const proxies = issuer.proxies.load();

    assert.i32Equals(
      1,
      proxies.length,
      `The issuer should have 1 proxy. Actual: ${proxies.length}`,
    );
    assert.bytesEquals(
      Bytes.fromHexString(proxyId),
      proxies[0].id,
      "The proxy ID should be correct",
    );
    assert.fieldEquals("IssuerProxy", proxyId, "data", proxyDataUpdated);
  });

  test("Remove a proxy", () => {
    const event = createRemoveIssuerProxyEvent(
      rootTao,
      Bytes.fromHexString(proxyId),
    );

    // Create transaction input
    const tuple: ethereum.Value[] = [
      ethereum.Value.fromString(rootTao),
      ethereum.Value.fromBytes(Bytes.fromHexString(proxyId)),
    ];

    // Set transaction input
    event.transaction.input = encodeTransactionInput(
      "removeIssuerProxy(string,bytes32)",
      ethereum.Value.fromTuple(changetype<ethereum.Tuple>(tuple)),
    );

    // Process event
    handleRemoveIssuerProxyEvent(event);

    const issuer = Issuer.load(rootTao);

    if (!issuer) {
      throw new Error("Issuer not found");
    }

    const proxies = issuer.proxies.load();

    assert.i32Equals(
      0,
      proxies.length,
      `The issuer should have 0 proxies. Actual: ${proxies.length}`,
    );
  });
});
