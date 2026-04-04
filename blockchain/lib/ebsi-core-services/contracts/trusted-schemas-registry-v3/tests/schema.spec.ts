import { ethers, network, upgrades } from "hardhat";

import { expect } from "chai";

import type { PolicyRegistryMock, SchemaSCRegistry } from "../src/types";

import { testTprAddress } from "./testAddress";

async function getFactories() {
  const schemaLibFactory = await ethers.getContractFactory("SchemaLib", {});
  const schemaLib = await schemaLibFactory.deploy();

  const contractFactory = await ethers.getContractFactory("SchemaSCRegistry", {
    libraries: {
      SchemaLib: await schemaLib.getAddress(),
    },
  });
  return {
    contractFactory,
    schemaLibFactory,
  };
}

describe("Schema", () => {
  let ts: SchemaSCRegistry;
  let policyContractMock: PolicyRegistryMock;

  before(async () => {
    const policyRegistryFactory =
      await ethers.getContractFactory("PolicyRegistryMock");
    const tempPolicyContract = await policyRegistryFactory.deploy();
    const bytecode = await ethers.provider.getCode(
      await tempPolicyContract.getAddress(),
    );
    await network.provider.send("hardhat_setCode", [testTprAddress, bytecode]);
    policyContractMock = policyRegistryFactory.attach(
      testTprAddress,
    ) as PolicyRegistryMock;
  });

  beforeEach(async () => {
    const { contractFactory } = await getFactories();
    ts = await contractFactory.deploy(testTprAddress);
    await policyContractMock.setPolicyResult(true);
  });

  it("should get current version", async () => {
    expect((await ts.version()).toString()).to.equal("0");
  });

  it("should not initialize if not proxy", async () => {
    await expect(ts.initialize(1)).to.be.revertedWithCustomError(
      ts,
      "InvalidInitialization",
    );
  });

  it("should initialize if proxy", async () => {
    const { contractFactory } = await getFactories();
    const tsProxy = await upgrades.deployProxy(contractFactory, [42], {
      constructorArgs: [testTprAddress],
      unsafeAllow: [
        "constructor",
        "external-library-linking",
        "state-variable-immutable",
      ],
    });
    await tsProxy.waitForDeployment();
    expect((await tsProxy.version()).toString()).to.equal("42");
  });

  it("should fail with invalid construct args", async () => {
    const { contractFactory } = await getFactories();
    await expect(
      upgrades.deployProxy(contractFactory, [42], {
        constructorArgs: [ethers.ZeroAddress],
        unsafeAllow: [
          "constructor",
          "external-library-linking",
          "state-variable-immutable",
        ],
      }),
    ).to.be.revertedWith("zero address");
  });

  it("should fail when user does not have attribute insertSchema", async () => {
    await policyContractMock.setPolicyResult(false);
    const schemaId = ethers.toUtf8Bytes("schemaId");
    const schemaRevision = ethers.toUtf8Bytes("revision");
    const metadata = ethers.toUtf8Bytes("metadata");
    await expect(
      ts.insertSchema(schemaId, schemaRevision, metadata),
    ).to.be.revertedWith(
      "Policy error: sender doesn't have the attribute TSR:insertSchema",
    );
  });

  it("insertSchema fails for empty params", async () => {
    const schemaId = ethers.toUtf8Bytes("schemaId");
    const schemaRevision = ethers.toUtf8Bytes("schema");
    await expect(
      ts.insertSchema(new Uint8Array(), new Uint8Array(), new Uint8Array()),
    ).to.be.revertedWith("schema empty");
    await expect(
      ts.insertSchema(schemaId, new Uint8Array(), new Uint8Array()),
    ).to.be.revertedWith("revision empty");
    await expect(
      ts.insertSchema(schemaId, schemaRevision, new Uint8Array()),
    ).to.be.revertedWith("metadata empty");
  });

  it("insertSchema fails when already registered", async () => {
    const schemaId = ethers.toUtf8Bytes("schemaId");
    const schemaRevision = ethers.toUtf8Bytes("schema");
    const metadata = ethers.toUtf8Bytes("metadata");
    await ts.insertSchema(schemaId, schemaRevision, metadata);

    const metadataId2 = ethers.toUtf8Bytes("other metadata");
    await expect(
      ts.insertSchema(schemaId, schemaRevision, metadataId2),
    ).to.be.revertedWith("schema already registered");
  });

  it("should allow two schemas to have the same content", async () => {
    const schemaId = ethers.toUtf8Bytes("schemaId");
    const schemaRevision = ethers.toUtf8Bytes("schema");
    const metadata = ethers.toUtf8Bytes("metadata");
    await ts.insertSchema(schemaId, schemaRevision, metadata);

    const schemaId2 = ethers.toUtf8Bytes("other schemaId");
    const metadata2 = ethers.toUtf8Bytes("other metadata");
    await expect(ts.insertSchema(schemaId2, schemaRevision, metadata2))
      .to.emit(ts, "SchemaInserted")
      .withArgs(
        ethers.hexlify(schemaId2),
        ethers.hexlify(schemaId2),
        ethers.hexlify(schemaRevision),
        ethers.sha256(schemaRevision),
        ethers.hexlify(metadata2),
        ethers.sha256(metadata2),
      );

    // Verify both schemas return the same revision content
    const revision1 = await ts.getLatestSchemaRevision(schemaId);
    const revision2 = await ts.getLatestSchemaRevision(schemaId2);
    expect(revision1).to.equal(revision2);
    expect(revision1).to.equal(ethers.hexlify(schemaRevision));
  });

  it("insertSchema should succeed", async () => {
    const schemaId = ethers.toUtf8Bytes("schemaId");
    const schemaRevision = ethers.toUtf8Bytes("revision");
    const metadata = ethers.toUtf8Bytes("metadata");
    await expect(ts.insertSchema(schemaId, schemaRevision, metadata))
      .to.emit(ts, "SchemaInserted")
      .withArgs(
        ethers.hexlify(schemaId),
        ethers.hexlify(schemaId),
        ethers.hexlify(schemaRevision),
        ethers.sha256(schemaRevision),
        ethers.hexlify(metadata),
        ethers.sha256(metadata),
      );
    const insertedSchema = await ts.getSchemaRevision(
      schemaId,
      ethers.sha256(schemaRevision),
    );
    expect(insertedSchema).to.equal(ethers.hexlify(schemaRevision));
  });

  it("should fail when user does not have attribute updateSchema", async () => {
    const schemaId = ethers.toUtf8Bytes("schemaId");
    const schemaRevision = ethers.toUtf8Bytes("revision");
    const metadata = ethers.toUtf8Bytes("metadata");
    await ts.insertSchema(schemaId, schemaRevision, metadata);
    await policyContractMock.setPolicyResult(false);
    await expect(
      ts.updateSchema(schemaId, schemaRevision, metadata),
    ).to.be.revertedWith(
      "Policy error: sender doesn't have the attribute TSR:updateSchema",
    );
  });

  it("getSchemaIds should fail with wrong page and pageSize", async () => {
    const schemaId = ethers.toUtf8Bytes("schemaId");
    const schemaRevision = ethers.toUtf8Bytes("schema");
    const metadata = ethers.toUtf8Bytes("metadata");
    await ts.insertSchema(schemaId, schemaRevision, metadata);

    // page = 0 should revert
    await expect(ts.getSchemaIds(0, 1)).to.be.revertedWith("Page must be > 0");

    // pagesize = 0 should revert
    await expect(ts.getSchemaIds(1, 0)).to.be.revertedWith(
      "PageSize must be > 0",
    );

    // pagesize > 50 should revert
    await expect(ts.getSchemaIds(1, 51)).to.be.revertedWith(
      "PageSize must be <= 50",
    );
  });

  it("getSchemaIds should succeed", async () => {
    const schemaIds: string[] = [];
    const metadata = ethers.toUtf8Bytes("metadata");
    for (let i = 1; i <= 10; i += 1) {
      const schemaId = ethers.toUtf8Bytes(`schemaId-${i}`);
      const schemaRevision = ethers.toUtf8Bytes(`schema-${i}`);

      await ts.insertSchema(schemaId, schemaRevision, metadata);
      schemaIds.push(ethers.hexlify(schemaId));
    }

    const result = await ts.getSchemaIds(1, 1);
    expect(result.items).to.deep.equal(schemaIds.slice(0, 1));
    expect(result.total).to.equal(10);
    expect(result.howMany).to.equal(1);
    expect(result.prev).to.equal(1);
    expect(result.next).to.equal(2);

    const result1 = await ts.getSchemaIds(3, 3);
    expect(result1.items).to.deep.equal(schemaIds.slice(6, 9));
    expect(result1.total).to.equal(10);
    expect(result1.howMany).to.equal(3);
    expect(result1.prev).to.equal(2);
    expect(result1.next).to.equal(4);

    const result2 = await ts.getSchemaIds(3, 10);
    expect(result2.items).to.have.length(0);
    expect(result2.total).to.equal(10);
    expect(result2.howMany).to.equal(0);
    expect(result2.prev).to.equal(1);
    expect(result2.next).to.equal(1);
  });

  it("getLatestSchemaRevision fails for missing parameter", async () => {
    await expect(
      ts.getLatestSchemaRevision(new Uint8Array()),
    ).to.be.revertedWith("schemaId empty");
  });

  it("getLatestSchemaRevision fails for missing revision", async () => {
    await expect(
      ts.getLatestSchemaRevision(ethers.toBeHex(1, 32)),
    ).to.be.revertedWith("schema not found");
  });

  it("getLatestSchemaRevision fails for unknown revision", async () => {
    const metadata = ethers.toUtf8Bytes("metadata");
    const schemaId = ethers.toUtf8Bytes("schemaId");
    const schemaRevision = ethers.toUtf8Bytes(`schema`);
    await ts.insertSchema(schemaId, schemaRevision, metadata);
    const schemaId1 = ethers.toUtf8Bytes("schemaId1");
    await expect(ts.getLatestSchemaRevision(schemaId1)).to.be.revertedWith(
      "schema not found",
    );
  });

  it("getLatestSchemaRevision succeeds", async () => {
    const schemaId = ethers.toUtf8Bytes("schemaId");
    for (let i = 1; i <= 3; i += 1) {
      const schemaRevision = ethers.toUtf8Bytes(`schema-${i}`);
      const metadata = ethers.toUtf8Bytes(`metadata-${i}`);
      await (i > 1
        ? ts.updateSchema(schemaId, schemaRevision, metadata)
        : ts.insertSchema(schemaId, schemaRevision, metadata));
    }
    const result = await ts.getLatestSchemaRevision(schemaId);
    expect(result).to.be.equal(ethers.hexlify(ethers.toUtf8Bytes(`schema-3`)));
  });

  it("getSchemaRevisionIds fails for empty schemaId", async () => {
    await expect(
      ts.getSchemaRevisionIds(new Uint8Array(), 1, 1),
    ).to.be.revertedWith("schemaId empty");
  });

  it("getSchemaRevisionIds fails for invalid page and pageSize", async () => {
    const schemaId = ethers.toUtf8Bytes("schemaId");
    await expect(ts.getSchemaRevisionIds(schemaId, 0, 1)).to.be.revertedWith(
      "Page must be > 0",
    );
    await expect(ts.getSchemaRevisionIds(schemaId, 1, 0)).to.be.revertedWith(
      "PageSize must be > 0",
    );
    await expect(ts.getSchemaRevisionIds(schemaId, 1, 51)).to.be.revertedWith(
      "PageSize must be <= 50",
    );
  });

  it("getSchemaRevisionIds succeeds", async () => {
    const schemaId = ethers.toUtf8Bytes("schemaId");
    const revisionsIds: string[] = [];
    for (let i = 1; i <= 10; i += 1) {
      const metadata = ethers.toUtf8Bytes(`metadata-${i}`);
      const schemaRevision = ethers.toUtf8Bytes(`schema-${i}`);
      await (i > 1
        ? ts.updateSchema(schemaId, schemaRevision, metadata)
        : ts.insertSchema(schemaId, schemaRevision, metadata));
      revisionsIds.push(ethers.sha256(schemaRevision));
    }

    const r = await ts.getSchemaRevisionIds(schemaId, 1, 2);
    expect(r.items).to.deep.equal(revisionsIds.slice(0, 2));
    expect(r.howMany).to.equal(2);
    expect(r.total).to.equal(10);
    expect(r.prev).to.equal(1);
    expect(r.next).to.equal(2);

    const r1 = await ts.getSchemaRevisionIds(schemaId, 3, 4);
    expect(r1.items).to.deep.equal(revisionsIds.slice(8, 10));
    expect(r1.howMany).to.equal(2);
    expect(r1.total).to.equal(10);
    expect(r1.prev).to.equal(2);
    expect(r1.next).to.equal(3);

    const r3 = await ts.getSchemaRevisionIds(schemaId, 3, 10);
    expect(r3.items).to.have.length(0);
    expect(r3.howMany).to.equal(0);
    expect(r3.total).to.equal(10);
    expect(r3.prev).to.equal(1);
    expect(r3.next).to.equal(1);
  });

  it("getSchemaRevision fails for unknown schema ID", async () => {
    await expect(
      ts.getSchemaRevision(ethers.ZeroHash, ethers.ZeroHash),
    ).to.be.revertedWith("schema not found");
  });

  it("getSchemaRevision fails for empty parameter", async () => {
    const metadata = ethers.toUtf8Bytes("metadata");
    const schemaId = ethers.toUtf8Bytes("schemaId");
    const schemaRevision = ethers.toUtf8Bytes("schema");
    await ts.insertSchema(schemaId, schemaRevision, metadata);
    await expect(
      ts.getSchemaRevision(schemaId, ethers.ZeroHash),
    ).to.be.revertedWith("revision not found");
  });

  it("getSchemaRevision fails for missing revision", async () => {
    const metadata = ethers.toUtf8Bytes("metadata");
    const schemaId = ethers.toUtf8Bytes("schemaId");
    const schemaRevision = ethers.toUtf8Bytes("schema");
    await ts.insertSchema(schemaId, schemaRevision, metadata);
    const schemaRevision2 = ethers.toUtf8Bytes("schema2");
    await expect(
      ts.getSchemaRevision(schemaId, ethers.sha256(schemaRevision2)),
    ).to.be.revertedWith("revision not found");
  });

  it("getSchemaRevision succeeds", async () => {
    const metadata = ethers.toUtf8Bytes("metadata");
    const schemaId = ethers.toUtf8Bytes("schemaId");
    const schemaRevision = ethers.toUtf8Bytes("schema");
    await ts.insertSchema(schemaId, schemaRevision, metadata);

    const result = await ts.getSchemaRevision(
      schemaId,
      ethers.sha256(schemaRevision),
    );
    expect(result).to.be.equal(ethers.hexlify(schemaRevision));
  });

  it("getLatestSchemaRevisionMetadataByRevisionId fails for empty parameter", async () => {
    await expect(
      ts.getLatestSchemaRevisionMetadataByRevisionId(
        new Uint8Array(0),
        ethers.ZeroHash,
      ),
    ).to.be.revertedWith("schemaId empty");
  });

  it("getLatestSchemaRevisionMetadataByRevisionId fails for unknown revisionId", async () => {
    const metadata = ethers.toUtf8Bytes("metadata");
    const schemaId = ethers.toUtf8Bytes("schemaId");
    const schemaRevision = ethers.toUtf8Bytes("schema");
    await ts.insertSchema(schemaId, schemaRevision, metadata);
    const schemaRevision2 = ethers.toUtf8Bytes("schema2");
    await expect(
      ts.getLatestSchemaRevisionMetadataByRevisionId(
        schemaId,
        ethers.sha256(schemaRevision2),
      ),
    ).to.be.revertedWith("no metadata");
  });

  it("should fail when user does not have attribute updateMetadata", async () => {
    const metadata = ethers.toUtf8Bytes("metadata");
    const schemaId = ethers.toUtf8Bytes("schemaId");
    const schemaRevision1 = ethers.toUtf8Bytes("schema1");
    const schemaRevision2 = ethers.toUtf8Bytes("schema2");
    await ts.insertSchema(schemaId, schemaRevision1, metadata);
    await policyContractMock.setPolicyResult(false);
    await expect(
      ts.updateMetadata(schemaId, ethers.sha256(schemaRevision2), metadata),
    ).to.be.revertedWith(
      "Policy error: sender doesn't have the attribute TSR:updateMetadata",
    );
  });

  it("updateMetadata fails when register is not registered", async () => {
    const metadata = ethers.toUtf8Bytes("metadata");
    const schemaId = ethers.toUtf8Bytes("schemaId");
    const schemaRevision1 = ethers.toUtf8Bytes("schema1");
    const schemaRevision2 = ethers.toUtf8Bytes("schema2");
    await ts.insertSchema(schemaId, schemaRevision1, metadata);
    await expect(
      ts.updateMetadata(schemaId, ethers.sha256(schemaRevision2), metadata),
    ).to.be.revertedWith("revision not registered");
  });

  it("updateMetadata fails for empty parameters", async () => {
    const schemaId = ethers.toUtf8Bytes("schemaId");
    const schemaRevision = ethers.toUtf8Bytes("schema");
    const metadata = ethers.toUtf8Bytes("metadata");
    await ts.insertSchema(schemaId, schemaRevision, metadata);

    await expect(
      ts.updateMetadata(new Uint8Array(), ethers.ZeroHash, metadata),
    ).to.be.revertedWith("schemaId empty");
    await expect(
      ts.updateMetadata(schemaId, ethers.ZeroHash, metadata),
    ).to.be.revertedWith("schemaRevisionId empty");
    await expect(
      ts.updateMetadata(
        schemaId,
        ethers.sha256(schemaRevision),
        new Uint8Array(),
      ),
    ).to.be.revertedWith("metadata empty");
  });

  it("getLatestSchemaRevisionMetadataByRevisionId and updateMetadata succeed", async () => {
    const metadata1 = ethers.toUtf8Bytes("metadata1");
    const metadata2 = ethers.toUtf8Bytes("metadata2");
    const schemaId = ethers.toUtf8Bytes("schemaId");
    const schemaRevision = ethers.toUtf8Bytes("schema");
    const schemaRevisionId = ethers.sha256(schemaRevision);
    await ts.insertSchema(schemaId, schemaRevision, metadata1);
    await expect(ts.updateMetadata(schemaId, schemaRevisionId, metadata2))
      .to.emit(ts, "MetadataUpdated")
      .withArgs(
        ethers.hexlify(schemaId),
        ethers.hexlify(schemaId),
        schemaRevisionId,
        ethers.hexlify(metadata2),
        ethers.sha256(metadata2),
      );
    const metadata = await ts.getLatestSchemaRevisionMetadataByRevisionId(
      schemaId,
      ethers.sha256(schemaRevision),
    );
    expect(metadata).to.be.equal(ethers.hexlify(metadata2));
  });

  it("updateSchema fails for empty params", async () => {
    const schemaId = ethers.toUtf8Bytes("schemaId");
    const schemaRevision = ethers.toUtf8Bytes("schema");
    await expect(
      ts.updateSchema(new Uint8Array(), new Uint8Array(), new Uint8Array()),
    ).to.be.revertedWith("schema empty");
    await expect(
      ts.updateSchema(schemaId, new Uint8Array(), new Uint8Array()),
    ).to.be.revertedWith("revision empty");
    await expect(
      ts.updateSchema(schemaId, schemaRevision, new Uint8Array()),
    ).to.be.revertedWith("metadata empty");
  });

  it("updateSchema fails when schema not registered", async () => {
    const schemaId = ethers.toUtf8Bytes("schemaId");
    const schemaId1 = ethers.toUtf8Bytes("schemaId1");
    const schemaRevision = ethers.toUtf8Bytes("schema");
    const schemaRevision2 = ethers.toUtf8Bytes("schema2");
    const metadata1 = ethers.toUtf8Bytes("metadata1");
    await ts.insertSchema(schemaId, schemaRevision, metadata1);
    await expect(
      ts.updateSchema(schemaId1, schemaRevision2, metadata1),
    ).to.be.revertedWith("schema not registered");
  });

  it("updateSchema succeeds", async () => {
    const schemaId = ethers.toUtf8Bytes("schemaId");
    const schemaRevision1 = ethers.toUtf8Bytes("schema1");
    const schemaRevision2 = ethers.toUtf8Bytes("schema2");
    const schemaRevision3 = ethers.toUtf8Bytes("schema3");
    const metadata1 = ethers.toUtf8Bytes("metadata1");
    const metadata2 = ethers.toUtf8Bytes("metadata2");
    await ts.insertSchema(schemaId, schemaRevision1, metadata1);
    await expect(ts.updateSchema(schemaId, schemaRevision2, metadata2))
      .to.emit(ts, "SchemaUpdated")
      .withArgs(
        ethers.hexlify(schemaId),
        ethers.hexlify(schemaId),
        ethers.hexlify(schemaRevision2),
        ethers.sha256(schemaRevision2),
        ethers.hexlify(metadata2),
        ethers.sha256(metadata2),
      );
    await ts.updateSchema(schemaId, schemaRevision3, metadata2);
    const updatedSchema = await ts.getSchemaRevision(
      schemaId,
      ethers.sha256(schemaRevision2),
    );
    expect(updatedSchema).to.equal(ethers.hexlify(schemaRevision2));
  });

  it("getSchemaRevisionMetadataIds fails for unknown schema ID", async () => {
    const schemaRevision1 = ethers.toUtf8Bytes("schema1");
    const schemaRevisionId = ethers.sha256(schemaRevision1);
    await expect(
      ts.getSchemaRevisionMetadataIds(ethers.ZeroHash, schemaRevisionId, 1, 1),
    ).to.be.revertedWith("schema not found");
  });

  it("getSchemaRevisionMetadataIds fails for empty schemaRevisionId", async () => {
    const schemaId = ethers.toUtf8Bytes("schemaId");
    const schemaRevision1 = ethers.toUtf8Bytes("schema1");
    const metadata1 = ethers.toUtf8Bytes("metadata1");
    await ts.insertSchema(schemaId, schemaRevision1, metadata1);
    await expect(
      ts.getSchemaRevisionMetadataIds(schemaId, ethers.ZeroHash, 1, 1),
    ).to.be.revertedWith("SchemaRevisionId empty");
  });

  it("getSchemaRevisionMetadataIds fails for wrong page and pageSize values", async () => {
    const schemaId = ethers.toUtf8Bytes("schemaId");
    const schemaRevision1 = ethers.toUtf8Bytes("schema1");
    const metadata1 = ethers.toUtf8Bytes("metadata1");
    await ts.insertSchema(schemaId, schemaRevision1, metadata1);
    const schemaRevisionId = ethers.sha256(schemaRevision1);
    // page = 0 should revert
    await expect(
      ts.getSchemaRevisionMetadataIds(schemaId, schemaRevisionId, 0, 1),
    ).to.be.revertedWith("Page must be > 0");

    // pagesize = 0 should revert
    await expect(
      ts.getSchemaRevisionMetadataIds(schemaId, schemaRevisionId, 1, 0),
    ).to.be.revertedWith("PageSize must be > 0");

    // pagesize > 50 should revert
    await expect(
      ts.getSchemaRevisionMetadataIds(schemaId, schemaRevisionId, 1, 51),
    ).to.be.revertedWith("PageSize must be <= 50");
  });

  it("getSchemaRevisionMetadataIds succeeds", async () => {
    const schemaId = ethers.toUtf8Bytes("schemaId");
    const schemaRevision = ethers.toUtf8Bytes("schema");
    const metadata = ethers.toUtf8Bytes("metadata");
    const metadataIds: string[] = [];
    const schemaRevisionId = ethers.sha256(schemaRevision);
    metadataIds.push(ethers.sha256(metadata));

    await ts.insertSchema(schemaId, schemaRevision, metadata);

    for (let i = 1; i <= 10; i += 1) {
      const m = ethers.toUtf8Bytes(`metadata+${i}`);

      await ts.updateMetadata(schemaId, schemaRevisionId, m);

      metadataIds.push(ethers.sha256(m));
    }

    const r = await ts.getSchemaRevisionMetadataIds(
      schemaId,
      schemaRevisionId,
      1,
      1,
    );
    expect(r.items).to.deep.equal(metadataIds.slice(0, 1));
    expect(r.total).to.equal(11);
    expect(r.howMany).to.equal(1);
    expect(r.prev).to.equal(1);
    expect(r.next).to.equal(2);

    const r1 = await ts.getSchemaRevisionMetadataIds(
      schemaId,
      schemaRevisionId,
      3,
      4,
    );
    expect(r1.items).to.deep.equal(metadataIds.slice(8, 11));
    expect(r1.howMany).to.equal(3);
    expect(r1.total).to.equal(11);
    expect(r1.prev).to.equal(2);
    expect(r1.next).to.equal(3);

    const r3 = await ts.getSchemaRevisionMetadataIds(
      schemaId,
      schemaRevisionId,
      3,
      10,
    );
    expect(r3.items).to.have.length(0);
    expect(r3.howMany).to.equal(0);
    expect(r3.total).to.equal(11);
    expect(r3.prev).to.equal(2);
    expect(r3.next).to.equal(2);
  });

  it("getSchemaRevisionMetadataByMetadataId fails for unknown schema ID", async () => {
    const schemaId = ethers.toUtf8Bytes("schemaId");
    const schemaRevision = ethers.toUtf8Bytes("schema");
    const metadata1 = ethers.toUtf8Bytes("metadata1");
    await ts.insertSchema(schemaId, schemaRevision, metadata1);
    await expect(
      ts.getSchemaRevisionMetadataByMetadataId(
        ethers.ZeroHash,
        ethers.ZeroHash,
        ethers.ZeroHash,
      ),
    ).to.be.revertedWith("schema not found");
  });

  it("getSchemaRevisionMetadataByMetadataId fails for unknown schema revision ID", async () => {
    const schemaId = ethers.toUtf8Bytes("schemaId");
    const schemaRevision = ethers.toUtf8Bytes("schema");
    const metadata1 = ethers.toUtf8Bytes("metadata1");
    await ts.insertSchema(schemaId, schemaRevision, metadata1);
    await expect(
      ts.getSchemaRevisionMetadataByMetadataId(
        schemaId,
        ethers.ZeroHash,
        ethers.ZeroHash,
      ),
    ).to.be.revertedWith("revision not found");
  });

  it("getSchemaRevisionMetadataByMetadataId fails for empty metadataId", async () => {
    const schemaId = ethers.toUtf8Bytes("schemaId");
    const schemaRevision = ethers.toUtf8Bytes("schema");
    const metadata1 = ethers.toUtf8Bytes("metadata1");
    await ts.insertSchema(schemaId, schemaRevision, metadata1);
    await expect(
      ts.getSchemaRevisionMetadataByMetadataId(
        schemaId,
        ethers.sha256(schemaRevision),
        ethers.ZeroHash,
      ),
    ).to.be.revertedWith("metadataId empty");
  });

  it("getSchemaRevisionMetadataByMetadataId fails unknown metadataId", async () => {
    const schemaId = ethers.toUtf8Bytes("schemaId");
    const schemaRevision = ethers.toUtf8Bytes("schema");
    const metadata1 = ethers.toUtf8Bytes("metadata1");
    const metadata2 = ethers.toUtf8Bytes("metadata2");
    await ts.insertSchema(schemaId, schemaRevision, metadata1);
    await expect(
      ts.getSchemaRevisionMetadataByMetadataId(
        schemaId,
        ethers.sha256(schemaRevision),
        ethers.sha256(metadata2),
      ),
    ).to.be.revertedWith("metadata not found");
  });

  it("getSchemaRevisionMetadataByMetadataId succeeds", async () => {
    const schemaId = ethers.toUtf8Bytes("schemaId");
    const schemaRevision = ethers.toUtf8Bytes("schema");
    const metadata = ethers.toUtf8Bytes("metadata");
    await ts.insertSchema(schemaId, schemaRevision, metadata);
    const r = await ts.getSchemaRevisionMetadataByMetadataId(
      schemaId,
      ethers.sha256(schemaRevision),
      ethers.sha256(metadata),
    );
    expect(r).to.equal(ethers.hexlify(metadata));
  });

  it("should allow schemas with same content to have different metadata without conflicts", async () => {
    // Create two schemas with the same content but different IDs
    const schemaId1 = ethers.toUtf8Bytes("schemaId1");
    const schemaId2 = ethers.toUtf8Bytes("schemaId2");
    const schemaRevision = ethers.toUtf8Bytes("same schema content");
    const metadata1 = ethers.toUtf8Bytes("metadata for schema 1");
    const metadata2 = ethers.toUtf8Bytes("metadata for schema 2");

    // Insert both schemas
    await ts.insertSchema(schemaId1, schemaRevision, metadata1);
    await ts.insertSchema(schemaId2, schemaRevision, metadata2);

    // Verify both schemas have the same revision content
    const revision1 = await ts.getLatestSchemaRevision(schemaId1);
    const revision2 = await ts.getLatestSchemaRevision(schemaId2);
    expect(revision1).to.equal(revision2);
    expect(revision1).to.equal(ethers.hexlify(schemaRevision));

    const schemaRevisionId = ethers.sha256(schemaRevision);

    // Verify each schema has its own metadata
    const retrievedMetadata1 =
      await ts.getLatestSchemaRevisionMetadataByRevisionId(
        schemaId1,
        schemaRevisionId,
      );
    const retrievedMetadata2 =
      await ts.getLatestSchemaRevisionMetadataByRevisionId(
        schemaId2,
        schemaRevisionId,
      );
    expect(retrievedMetadata1).to.equal(ethers.hexlify(metadata1));
    expect(retrievedMetadata2).to.equal(ethers.hexlify(metadata2));
    expect(retrievedMetadata1).to.not.equal(retrievedMetadata2);

    // Add different metadata to each schema
    const newMetadata1 = ethers.toUtf8Bytes("new metadata for schema 1");
    const newMetadata2 = ethers.toUtf8Bytes("new metadata for schema 2");

    await ts.updateMetadata(schemaId1, schemaRevisionId, newMetadata1);
    await ts.updateMetadata(schemaId2, schemaRevisionId, newMetadata2);

    // Verify the new metadata is correctly stored for each schema
    const latestMetadata1 =
      await ts.getLatestSchemaRevisionMetadataByRevisionId(
        schemaId1,
        ethers.sha256(schemaRevision),
      );
    const latestMetadata2 =
      await ts.getLatestSchemaRevisionMetadataByRevisionId(
        schemaId2,
        ethers.sha256(schemaRevision),
      );
    expect(latestMetadata1).to.equal(ethers.hexlify(newMetadata1));
    expect(latestMetadata2).to.equal(ethers.hexlify(newMetadata2));
    expect(latestMetadata1).to.not.equal(latestMetadata2);

    // Verify both schemas still have the same revision content
    const finalRevision1 = await ts.getLatestSchemaRevision(schemaId1);
    const finalRevision2 = await ts.getLatestSchemaRevision(schemaId2);
    expect(finalRevision1).to.equal(finalRevision2);
    expect(finalRevision1).to.equal(ethers.hexlify(schemaRevision));

    // Verify we can retrieve specific metadata by metadata ID for each schema
    const metadata1ById = await ts.getSchemaRevisionMetadataByMetadataId(
      schemaId1,
      schemaRevisionId,
      ethers.sha256(metadata1),
    );
    const metadata2ById = await ts.getSchemaRevisionMetadataByMetadataId(
      schemaId2,
      schemaRevisionId,
      ethers.sha256(metadata2),
    );
    expect(metadata1ById).to.equal(ethers.hexlify(metadata1));
    expect(metadata2ById).to.equal(ethers.hexlify(metadata2));

    // Verify we can retrieve the new metadata by metadata ID for each schema
    const newMetadata1ById = await ts.getSchemaRevisionMetadataByMetadataId(
      schemaId1,
      schemaRevisionId,
      ethers.sha256(newMetadata1),
    );
    const newMetadata2ById = await ts.getSchemaRevisionMetadataByMetadataId(
      schemaId2,
      schemaRevisionId,
      ethers.sha256(newMetadata2),
    );
    expect(newMetadata1ById).to.equal(ethers.hexlify(newMetadata1));
    expect(newMetadata2ById).to.equal(ethers.hexlify(newMetadata2));
  });
});
