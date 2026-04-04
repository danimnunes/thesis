import { Address, Bytes, ethereum } from "@graphprotocol/graph-ts";
import {
  afterAll,
  assert,
  beforeAll,
  clearStore,
  describe,
  test,
} from "matchstick-as";

import {
  ContractProxy,
  ContractTemplate,
  DidDocument,
} from "../generated/schema";
import { handleProxyDeployedEvent } from "../src/trusted-contracts-registry-v1/proxy-factory/mappings";
import {
  handleTemplateAddedEvent,
  handleTemplateDeprecatedEvent,
  handleTemplateUpdatedEvent,
} from "../src/trusted-contracts-registry-v1/proxy-template-registry/mappings";
import {
  createProxyDeployedEvent,
  createTemplateAddedEvent,
  createTemplateDeprecatedEvent,
  createTemplateUpdatedEvent,
  encodeTransactionInput,
} from "./trusted-contracts-registry.utils";

describe("Trusted Contracts Registry - entity assertions", () => {
  beforeAll(() => {
    // Create DID document for the contract deployer
    const didDocument = new DidDocument("did:ebsi:zqz4ibiG9bWhPBiebPeeGVB");
    didDocument.baseDocument = "{}";
    didDocument.save();
  });
  afterAll(() => {
    clearStore();
  });

  test("Add a new template", () => {
    const templateId = Bytes.fromHexString(
      "0x957cef8a6ccfa45ea37ec9976fa2cdeb916d96039d6dac5bd68e37284bc187f4",
    );
    const name = "SampleContract-495e006501ff64fc8c325a0da420d19b";
    const version = "1.0.0";
    const beaconAddress = Address.fromBytes(
      Bytes.fromHexString("0x2279B7A0a67DB372996a5FaB50D91eAA73d2eBe6"),
    );
    const repoURI = "https://github.com/example/sample-contract";
    const auditURI = "https://audit.example.com/sample-contract";
    const contractHash = Bytes.fromHexString(
      "0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470",
    );
    const initSelector = Bytes.fromHexString("0xd1ec8bf7");
    const storageLayoutHash = Bytes.fromHexString(
      "0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470",
    );
    const isActive = true;

    const event = createTemplateAddedEvent(templateId, name, version);

    // Create transaction input
    const newTemplate: ethereum.Value[] = [
      ethereum.Value.fromString(name),
      ethereum.Value.fromString(version),
      ethereum.Value.fromAddress(beaconAddress),
      ethereum.Value.fromString(repoURI),
      ethereum.Value.fromString(auditURI),
      ethereum.Value.fromFixedBytes(contractHash),
      ethereum.Value.fromFixedBytes(initSelector),
      ethereum.Value.fromFixedBytes(storageLayoutHash),
      ethereum.Value.fromBoolean(isActive),
    ];
    const tuple: ethereum.Value[] = [
      ethereum.Value.fromTuple(changetype<ethereum.Tuple>(newTemplate)),
    ];

    // Set transaction input
    event.transaction.input = encodeTransactionInput(
      "addTemplate((string,string,address,string,string,bytes32,bytes4,bytes32,bool))",
      ethereum.Value.fromTuple(changetype<ethereum.Tuple>(tuple)),
    );

    handleTemplateAddedEvent(event);

    assert.entityCount(
      "ContractTemplate",
      1,
      "There should be 1 ContractTemplate",
    );

    const contractTemplateEntity = ContractTemplate.load(templateId);

    if (!contractTemplateEntity) {
      throw new Error("ContractTemplate not found");
    }

    assert.stringEquals(name, contractTemplateEntity.name);
    assert.stringEquals(version, contractTemplateEntity.version);
    assert.addressEquals(
      beaconAddress,
      Address.fromBytes(contractTemplateEntity.beaconAddress),
    );
    assert.stringEquals(repoURI, contractTemplateEntity.repoURI);
    assert.stringEquals(auditURI, contractTemplateEntity.auditURI);
    assert.bytesEquals(contractHash, contractTemplateEntity.contractHash);
    assert.bytesEquals(initSelector, contractTemplateEntity.initSelector);
    assert.bytesEquals(
      storageLayoutHash,
      contractTemplateEntity.storageLayoutHash,
    );
    assert.booleanEquals(true, contractTemplateEntity.isActive);
  });

  test("Update a template", () => {
    const templateId = Bytes.fromHexString(
      "0x957cef8a6ccfa45ea37ec9976fa2cdeb916d96039d6dac5bd68e37284bc187f4",
    );

    const repoURI = "https://github.com/example/sample-contract-updated";
    const auditURI = "https://audit.example.com/sample-contract-updated";

    const event = createTemplateUpdatedEvent(templateId, repoURI, auditURI);

    // Create transaction input
    const tuple: ethereum.Value[] = [
      ethereum.Value.fromBytes(templateId),
      ethereum.Value.fromString(repoURI),
      ethereum.Value.fromString(auditURI),
    ];

    // Set transaction input
    event.transaction.input = encodeTransactionInput(
      "updateTemplateMetadata(bytes32,string,string)",
      ethereum.Value.fromTuple(changetype<ethereum.Tuple>(tuple)),
    );

    handleTemplateUpdatedEvent(event);

    assert.entityCount(
      "ContractTemplate",
      1,
      "There should be 1 ContractTemplate",
    );

    const contractTemplateEntity = ContractTemplate.load(templateId);

    if (!contractTemplateEntity) {
      throw new Error("ContractTemplate not found");
    }

    assert.stringEquals(repoURI, contractTemplateEntity.repoURI);
    assert.stringEquals(auditURI, contractTemplateEntity.auditURI);
  });

  test("Deprecate a template", () => {
    const templateId = Bytes.fromHexString(
      "0x957cef8a6ccfa45ea37ec9976fa2cdeb916d96039d6dac5bd68e37284bc187f4",
    );

    const event = createTemplateDeprecatedEvent(templateId);

    handleTemplateDeprecatedEvent(event);

    assert.entityCount(
      "ContractTemplate",
      1,
      "There should be 1 ContractTemplate",
    );

    const contractTemplateEntity = ContractTemplate.load(templateId);

    if (!contractTemplateEntity) {
      throw new Error("ContractTemplate not found");
    }

    assert.booleanEquals(false, contractTemplateEntity.isActive);
  });

  test("Deploy new proxy", () => {
    const proxyAddress = Address.fromBytes(
      Bytes.fromHexString("0x61c36a8d610163660E21a8b7359e1Cac0C9133e1"),
    );
    const templateId = Bytes.fromHexString(
      "0x957cef8a6ccfa45ea37ec9976fa2cdeb916d96039d6dac5bd68e37284bc187f4",
    );
    const deployer = Address.fromBytes(
      Bytes.fromHexString("0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC"),
    );
    const issuerDID = "did:ebsi:zqz4ibiG9bWhPBiebPeeGVB";
    const initData = Bytes.fromHexString("0x");
    const timestamp = 1_760_600_272;

    const event = createProxyDeployedEvent(
      proxyAddress,
      templateId,
      deployer,
      issuerDID,
      initData,
      timestamp,
    );

    handleProxyDeployedEvent(event);

    assert.entityCount("ContractProxy", 1, "There should be 1 ContractProxy");

    const contractProxyEntity = ContractProxy.load(proxyAddress);

    if (!contractProxyEntity) {
      throw new Error("ContractProxy not found");
    }

    assert.addressEquals(
      deployer,
      Address.fromBytes(contractProxyEntity.deployerAddress),
    );
    assert.bytesEquals(initData, contractProxyEntity.initData);
    assert.booleanEquals(
      true,
      contractProxyEntity.isActive,
      "The contractProxy should be active",
    );
    assert.stringEquals(issuerDID, contractProxyEntity.deployerDidDocument);
    assert.bytesEquals(templateId, contractProxyEntity.template);
    assert.i32Equals(timestamp, contractProxyEntity.timestamp.toI32());

    // Verify relationships
    const template = ContractTemplate.load(contractProxyEntity.template);

    if (!template) {
      throw new Error(
        `ContractTemplate ${contractProxyEntity.template.toHexString()} not found`,
      );
    }

    const proxies = template.proxies.load();
    assert.i32Equals(1, proxies.length);
    assert.bytesEquals(contractProxyEntity.id, proxies[0].id);

    const didDocument = DidDocument.load(
      contractProxyEntity.deployerDidDocument,
    );

    if (!didDocument) {
      throw new Error(
        `DidDocument ${contractProxyEntity.deployerDidDocument} not found`,
      );
    }
  });

  test("Deploy proxy by regular address (not a ContractProxy)", () => {
    const proxyAddress = Address.fromBytes(
      Bytes.fromHexString("0x70997970C51812dc3A010C7d01b50e0d17dc79C8"),
    );
    const templateId = Bytes.fromHexString(
      "0x957cef8a6ccfa45ea37ec9976fa2cdeb916d96039d6dac5bd68e37284bc187f4",
    );
    const deployer = Address.fromBytes(
      Bytes.fromHexString("0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc"),
    );
    const issuerDID = "did:ebsi:zqz4ibiG9bWhPBiebPeeGVB";
    const initData = Bytes.fromHexString("0x");
    const timestamp = 1_760_600_300;

    const event = createProxyDeployedEvent(
      proxyAddress,
      templateId,
      deployer,
      issuerDID,
      initData,
      timestamp,
    );

    handleProxyDeployedEvent(event);

    assert.entityCount("ContractProxy", 2, "There should be 2 ContractProxies");

    const contractProxyEntity = ContractProxy.load(proxyAddress);

    if (!contractProxyEntity) {
      throw new Error("ContractProxy not found");
    }

    // deployerAddress should be set
    assert.addressEquals(
      deployer,
      Address.fromBytes(contractProxyEntity.deployerAddress),
    );

    // deployerProxy should be null since deployer is not a ContractProxy
    if (contractProxyEntity.deployerProxy) {
      throw new Error(
        "deployerProxy should be null for regular address deployer",
      );
    }

    // Check deployedProxies is empty
    const deployedProxies = contractProxyEntity.deployedProxies.load();
    assert.i32Equals(0, deployedProxies.length);
  });

  test("Deploy proxy by another ContractProxy (recursion level 1)", () => {
    const deployerProxyAddress = Address.fromBytes(
      Bytes.fromHexString("0x61c36a8d610163660E21a8b7359e1Cac0C9133e1"),
    );
    const newProxyAddress = Address.fromBytes(
      Bytes.fromHexString("0x5FbDB2315678afecb367f032d93F642f64180aa3"),
    );
    const templateId = Bytes.fromHexString(
      "0x957cef8a6ccfa45ea37ec9976fa2cdeb916d96039d6dac5bd68e37284bc187f4",
    );
    const issuerDID = "did:ebsi:zqz4ibiG9bWhPBiebPeeGVB";
    const initData = Bytes.fromHexString("0x1234");
    const timestamp = 1_760_600_400;

    // Deploy a new proxy where the deployer is an existing ContractProxy
    const event = createProxyDeployedEvent(
      newProxyAddress,
      templateId,
      deployerProxyAddress, // deployer is the first proxy we created
      issuerDID,
      initData,
      timestamp,
    );

    handleProxyDeployedEvent(event);

    assert.entityCount("ContractProxy", 3, "There should be 3 ContractProxies");

    const newProxyEntity = ContractProxy.load(newProxyAddress);

    if (!newProxyEntity) {
      throw new Error("New ContractProxy not found");
    }

    // deployerAddress should be set to the deployer proxy address
    assert.addressEquals(
      deployerProxyAddress,
      Address.fromBytes(newProxyEntity.deployerAddress),
    );

    // deployerProxy should reference the deployer ContractProxy
    if (!newProxyEntity.deployerProxy) {
      throw new Error("deployerProxy should not be null");
    }
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    assert.bytesEquals(deployerProxyAddress, newProxyEntity.deployerProxy!);

    // Verify the deployer proxy has this new proxy in its deployedProxies
    const deployerProxyEntity = ContractProxy.load(deployerProxyAddress);

    if (!deployerProxyEntity) {
      throw new Error("Deployer ContractProxy not found");
    }

    const deployedProxies = deployerProxyEntity.deployedProxies.load();
    assert.i32Equals(1, deployedProxies.length);
    assert.bytesEquals(newProxyAddress, deployedProxies[0].id);
  });

  test("Deploy proxy by a proxy that was deployed by another proxy (recursion level 2)", () => {
    const level1ProxyAddress = Address.fromBytes(
      Bytes.fromHexString("0x5FbDB2315678afecb367f032d93F642f64180aa3"),
    );
    const level2ProxyAddress = Address.fromBytes(
      Bytes.fromHexString("0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512"),
    );
    const templateId = Bytes.fromHexString(
      "0x957cef8a6ccfa45ea37ec9976fa2cdeb916d96039d6dac5bd68e37284bc187f4",
    );
    const issuerDID = "did:ebsi:zqz4ibiG9bWhPBiebPeeGVB";
    const initData = Bytes.fromHexString("0x5678");
    const timestamp = 1_760_600_500;

    // Deploy a new proxy where the deployer is a proxy that was deployed by another proxy
    const event = createProxyDeployedEvent(
      level2ProxyAddress,
      templateId,
      level1ProxyAddress, // deployer is itself deployed by another proxy
      issuerDID,
      initData,
      timestamp,
    );

    handleProxyDeployedEvent(event);

    assert.entityCount("ContractProxy", 4, "There should be 4 ContractProxies");

    const level2ProxyEntity = ContractProxy.load(level2ProxyAddress);

    if (!level2ProxyEntity) {
      throw new Error("Level 2 ContractProxy not found");
    }

    // deployerProxy should reference the level 1 proxy
    if (!level2ProxyEntity.deployerProxy) {
      throw new Error("level2 deployerProxy should not be null");
    }
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    assert.bytesEquals(level1ProxyAddress, level2ProxyEntity.deployerProxy!);

    // Verify the chain: level2 -> level1 -> level0
    const level1ProxyEntity = ContractProxy.load(level1ProxyAddress);

    if (!level1ProxyEntity) {
      throw new Error("Level 1 ContractProxy not found");
    }

    // level1 should have level2 in its deployedProxies
    const level1DeployedProxies = level1ProxyEntity.deployedProxies.load();
    assert.i32Equals(1, level1DeployedProxies.length);
    assert.bytesEquals(level2ProxyAddress, level1DeployedProxies[0].id);

    // level1 should have a deployer proxy (level0)
    if (!level1ProxyEntity.deployerProxy) {
      throw new Error("level1 deployerProxy should not be null");
    }

    const level0ProxyAddress = level1ProxyEntity.deployerProxy;
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    const level0ProxyEntity = ContractProxy.load(level0ProxyAddress!);

    if (!level0ProxyEntity) {
      throw new Error("Level 0 ContractProxy not found");
    }

    // level0 should have level1 in its deployedProxies
    const level0DeployedProxies = level0ProxyEntity.deployedProxies.load();
    assert.i32Equals(1, level0DeployedProxies.length);
    assert.bytesEquals(level1ProxyAddress, level0DeployedProxies[0].id);
  });

  test("Multiple proxies deployed by the same parent proxy", () => {
    const parentProxyAddress = Address.fromBytes(
      Bytes.fromHexString("0x61c36a8d610163660E21a8b7359e1Cac0C9133e1"),
    );
    const childProxy1Address = Address.fromBytes(
      Bytes.fromHexString("0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0"),
    );
    const childProxy2Address = Address.fromBytes(
      Bytes.fromHexString("0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9"),
    );
    const templateId = Bytes.fromHexString(
      "0x957cef8a6ccfa45ea37ec9976fa2cdeb916d96039d6dac5bd68e37284bc187f4",
    );
    const issuerDID = "did:ebsi:zqz4ibiG9bWhPBiebPeeGVB";
    const initData = Bytes.fromHexString("0x");
    const timestamp1 = 1_760_600_600;
    const timestamp2 = 1_760_600_700;

    // Deploy first child proxy
    const event1 = createProxyDeployedEvent(
      childProxy1Address,
      templateId,
      parentProxyAddress,
      issuerDID,
      initData,
      timestamp1,
    );

    handleProxyDeployedEvent(event1);

    // Deploy second child proxy
    const event2 = createProxyDeployedEvent(
      childProxy2Address,
      templateId,
      parentProxyAddress,
      issuerDID,
      initData,
      timestamp2,
    );

    handleProxyDeployedEvent(event2);

    assert.entityCount("ContractProxy", 6, "There should be 6 ContractProxies");

    // Verify parent proxy has both children in deployedProxies
    const parentProxyEntity = ContractProxy.load(parentProxyAddress);

    if (!parentProxyEntity) {
      throw new Error("Parent ContractProxy not found");
    }

    const deployedProxies = parentProxyEntity.deployedProxies.load();
    assert.i32Equals(3, deployedProxies.length); // 1 from earlier test + 2 new ones

    // Verify both children reference the parent
    const childProxy1Entity = ContractProxy.load(childProxy1Address);
    const childProxy2Entity = ContractProxy.load(childProxy2Address);

    if (!childProxy1Entity || !childProxy2Entity) {
      throw new Error("Child ContractProxy not found");
    }

    if (!childProxy1Entity.deployerProxy || !childProxy2Entity.deployerProxy) {
      throw new Error("Child deployerProxy should not be null");
    }
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    assert.bytesEquals(parentProxyAddress, childProxy1Entity.deployerProxy!);
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    assert.bytesEquals(parentProxyAddress, childProxy2Entity.deployerProxy!);
  });
});
