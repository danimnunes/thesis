import { ethers, network, upgrades } from "hardhat";

import type { Result } from "ethers";

import { expect } from "chai";
import crypto from "node:crypto";

import type { DidRegistryMock, PolicyRegistryMock, Tir } from "../src/types";

import { testDidrAddress, testTprAddress } from "./testAddress";

enum IssuerType {
  Undefined,
  RootTAO,
  TAO,
  TI,
  Revoked,
}

export function decodeResult(result: unknown): Record<string, unknown> {
  // Recursively fix the result object
  return fixObject((result as Result).toObject(true));
}

function fixObject(result: Record<string, unknown>): Record<string, unknown> {
  const keys = Object.keys(result);

  const res: Record<string, unknown> = {};
  for (const key of keys) {
    const val = result[key];
    res[key] = fixValue(val);
  }

  return res;
}

function fixValue(val: unknown): unknown {
  if (typeof val !== "object" || val === null) {
    return val;
  }

  if (Array.isArray(val)) {
    return val.map((v) => fixValue(v));
  }

  // Replace empty objects with empty arrays
  if (Object.keys(val).length === 0) {
    return [];
  }

  // When ethers.js returns an object with only one key "_", it should be converted into a single-item array
  if (Object.keys(val).length === 1 && "_" in val) {
    return [fixValue(val._)];
  }

  return fixObject(val as Record<string, unknown>);
}

function randomDid(): string {
  return `did:ebsi:${crypto.randomBytes(5).toString("hex")}`;
}

function randomHash(): string {
  return `0x${crypto.randomBytes(32).toString("hex")}`;
}

function randomProxy(): string {
  return Buffer.from(
    JSON.stringify({
      headers: {
        Authorization: `Bearer ${crypto.randomBytes(32).toString("hex")}`,
      },
      prefix: "https://localhost/my-provider/revocation/",
      testSuffix: "/credentials/status/1",
    }),
    "utf8",
  ).toString("hex");
}

describe("Issuers", () => {
  let tir: Tir;
  let policyContractMock: PolicyRegistryMock;
  let didContractMock: DidRegistryMock;

  const rootTAO1 = {
    attribute: `0x${crypto.randomBytes(10).toString("hex")}`,
    attributeId: `0x${crypto.randomBytes(32).toString("hex")}`,
    did: "did:ebsi:roottao1",
    revisionId: "",
  };
  rootTAO1.revisionId = ethers.sha256(rootTAO1.attribute);

  const tao1 = {
    attribute: `0x${crypto.randomBytes(10).toString("hex")}`,
    attributeId: `0x${crypto.randomBytes(32).toString("hex")}`,
    did: "did:ebsi:tao1",
    revisionId: "",
  };
  tao1.revisionId = ethers.sha256(tao1.attribute);

  const tao2 = {
    attribute: `0x${crypto.randomBytes(10).toString("hex")}`,
    attributeId: `0x${crypto.randomBytes(32).toString("hex")}`,
    did: "did:ebsi:tao2",
    proxyData: randomProxy(),
    revisionId: "",
  };
  tao2.revisionId = ethers.sha256(tao2.attribute);

  const ti1 = {
    attribute1: `0x${crypto.randomBytes(10).toString("hex")}`,
    attribute2: `0x${crypto.randomBytes(10).toString("hex")}`,
    attributeId1: `0x${crypto.randomBytes(32).toString("hex")}`,
    attributeId2: `0x${crypto.randomBytes(32).toString("hex")}`,
    did: "did:ebsi:ti1",
    revisionId1: "",
    revisionId2: "",
  };
  ti1.revisionId1 = ethers.sha256(ti1.attribute1);
  ti1.revisionId2 = ethers.sha256(ti1.attribute2);

  const proxyData1 = randomProxy();
  const proxyId = ethers.sha256(Buffer.from(proxyData1));
  const didIssuer = ti1.did;

  before(async () => {
    const policyRegistryFactory =
      await ethers.getContractFactory("PolicyRegistryMock");
    const tempPolicyContract = await policyRegistryFactory.deploy();

    const bytecodeTpr = await ethers.provider.getCode(
      await tempPolicyContract.getAddress(),
    );
    await network.provider.send("hardhat_setCode", [
      testTprAddress,
      bytecodeTpr,
    ]);
    policyContractMock = policyRegistryFactory.attach(
      testTprAddress,
    ) as PolicyRegistryMock;
    await policyContractMock.setPolicyResult(true);

    const didRegistryFactory =
      await ethers.getContractFactory("DidRegistryMock");
    const tempDidContract = await didRegistryFactory.deploy();
    await tempDidContract.waitForDeployment();
    const bytecodeDid = await ethers.provider.getCode(
      await tempDidContract.getAddress(),
    );
    await network.provider.send("hardhat_setCode", [
      testDidrAddress,
      bytecodeDid,
    ]);

    didContractMock = didRegistryFactory.attach(
      testDidrAddress,
    ) as DidRegistryMock;
    await didContractMock.setDidResult(false);
  });

  beforeEach(async () => {
    const contractFactory = await ethers.getContractFactory("Tir", {});
    tir = await contractFactory.deploy(testTprAddress, testDidrAddress);
    await tir.waitForDeployment();
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    expect(await tir.getAddress()).to.properAddress;
  });

  async function registerRootTAO1() {
    await policyContractMock.setPolicyResult(true); // is admin
    await didContractMock.setDidResult(false); // the admin is not a controller

    // create rootTAO
    await expect(
      tir.setAttributeMetadata(
        rootTAO1.did,
        rootTAO1.attributeId,
        IssuerType.RootTAO,
        rootTAO1.did,
        rootTAO1.attributeId,
      ),
    ).to.emit(tir, "AddAttributeRevision");

    // get RootTAO attribute

    // Deprecated way
    let issuerHashes = await tir.getIssuer__deprecated(rootTAO1.did);
    expect(issuerHashes).to.eql([rootTAO1.attributeId]);
    let issuerAttr: Awaited<
      | ReturnType<typeof tir.getIssuerAttributeByHash__deprecated>
      | ReturnType<typeof tir.getLatestRevisionAttribute>
    > = await tir.getIssuerAttributeByHash__deprecated(issuerHashes[0]);
    expect(decodeResult(issuerAttr)).to.deep.equal({
      attribData: "0x",
      did: rootTAO1.did,
      issuerType: IssuerType.RootTAO.toString(),
      rootTao: rootTAO1.did,
      tao: rootTAO1.did,
    });

    // New way
    issuerHashes = (await tir.getIssuerAttributes(rootTAO1.did, 1, 50)).items;
    expect(issuerHashes).to.eql([rootTAO1.attributeId]);
    issuerAttr = await tir.getLatestRevisionAttribute(
      rootTAO1.did,
      issuerHashes[0],
    );
    expect(decodeResult(issuerAttr)).to.deep.equal({
      attribData: "0x",
      attributeId: rootTAO1.attributeId,
      did: rootTAO1.did,
      issuerType: IssuerType.RootTAO.toString(),
      rootTao: rootTAO1.did,
      tao: rootTAO1.did,
    });

    expect(
      Number(
        (
          await tir.getIssuerAttributeRevisions(
            rootTAO1.did,
            issuerHashes[0],
            1,
            2,
          )
        ).total,
      ),
    ).to.eq(1);

    expect(
      Number(
        (
          await tir.getIssuerAttributeRevisions__deprecated(
            rootTAO1.did,
            issuerHashes[0],
            1,
            2,
          )
        ).total,
      ),
    ).to.eq(1);

    // get the status of the user
    let issuer = await tir.getIssuer(rootTAO1.did);
    expect(decodeResult(issuer)).to.deep.equal({
      noAttributesAccepted: true,
      totalAttributes: 1,
    });

    await policyContractMock.setPolicyResult(false); // not admin
    await didContractMock.setDidResult(true); // controller of the DID

    // RootTAO registers the credential
    await expect(
      tir.setAttributeData(
        rootTAO1.did,
        rootTAO1.attributeId,
        rootTAO1.attribute,
      ),
    ).to.emit(tir, "AddAttributeRevision");

    // get RootTAO attribute

    // Deprecated way
    issuerHashes = await tir.getIssuer__deprecated(rootTAO1.did);
    expect(issuerHashes).to.eql([rootTAO1.revisionId]);
    issuerAttr = await tir.getIssuerAttributeByHash__deprecated(
      issuerHashes[0],
    );
    expect(decodeResult(issuerAttr)).to.deep.equal({
      attribData: rootTAO1.attribute,
      did: rootTAO1.did,
      issuerType: IssuerType.RootTAO.toString(),
      rootTao: rootTAO1.did,
      tao: rootTAO1.did,
    });

    // New way
    issuerHashes = (await tir.getIssuerAttributes(rootTAO1.did, 1, 50)).items;
    expect(issuerHashes).to.eql([rootTAO1.attributeId]);
    issuerAttr = await tir.getLatestRevisionAttribute(
      rootTAO1.did,
      rootTAO1.attributeId,
    );
    expect(decodeResult(issuerAttr)).to.deep.equal({
      attribData: rootTAO1.attribute,
      attributeId: rootTAO1.revisionId,
      did: rootTAO1.did,
      issuerType: IssuerType.RootTAO.toString(),
      rootTao: rootTAO1.did,
      tao: rootTAO1.did,
    });

    // get RootTAO attribute using revision ID
    issuerAttr = await tir.getRevisionAttribute(
      rootTAO1.did,
      rootTAO1.attributeId,
      rootTAO1.attributeId,
    );
    expect(decodeResult(issuerAttr)).to.deep.equal({
      attribData: "0x",
      attributeId: rootTAO1.attributeId,
      did: rootTAO1.did,
      issuerType: IssuerType.RootTAO.toString(),
      rootTao: rootTAO1.did,
      tao: rootTAO1.did,
    });

    issuerAttr = await tir.getRevisionAttribute(
      rootTAO1.did,
      rootTAO1.attributeId,
      rootTAO1.revisionId,
    );
    expect(decodeResult(issuerAttr)).to.deep.equal({
      attribData: rootTAO1.attribute,
      attributeId: rootTAO1.revisionId,
      did: rootTAO1.did,
      issuerType: IssuerType.RootTAO.toString(),
      rootTao: rootTAO1.did,
      tao: rootTAO1.did,
    });

    // get the status of the user
    issuer = await tir.getIssuer(rootTAO1.did);
    expect(decodeResult(issuer)).to.deep.equal({
      noAttributesAccepted: false,
      totalAttributes: 1,
    });
  }

  async function registerTAO1() {
    await policyContractMock.setPolicyResult(false); // not admin
    await didContractMock.setDidResult(true); // controller of the DID

    // RootTAO registers a TAO
    await expect(
      tir.setAttributeMetadata(
        tao1.did,
        tao1.attributeId,
        IssuerType.TAO,
        rootTAO1.did,
        rootTAO1.attributeId,
      ),
    ).to.emit(tir, "AddAttributeRevision");

    // get the status of the user
    let issuer = await tir.getIssuer(tao1.did);
    expect(decodeResult(issuer)).to.deep.equal({
      noAttributesAccepted: true,
      totalAttributes: 1,
    });

    // TAO registers the credential
    await expect(
      tir.setAttributeData(tao1.did, tao1.attributeId, tao1.attribute),
    ).to.emit(tir, "AddAttributeRevision");

    // get TAO attribute

    // Deprecated way
    let issuerHashes = await tir.getIssuer__deprecated(tao1.did);
    expect(issuerHashes).to.eql([tao1.revisionId]);
    let issuerAttr: Awaited<
      | ReturnType<typeof tir.getIssuerAttributeByHash__deprecated>
      | ReturnType<typeof tir.getLatestRevisionAttribute>
    > = await tir.getIssuerAttributeByHash__deprecated(issuerHashes[0]);
    expect(decodeResult(issuerAttr)).to.deep.equal({
      attribData: tao1.attribute,
      did: tao1.did,
      issuerType: IssuerType.TAO.toString(),
      rootTao: rootTAO1.did,
      tao: rootTAO1.did,
    });

    // New way
    issuerHashes = (await tir.getIssuerAttributes(tao1.did, 1, 50)).items;
    expect(issuerHashes).to.eql([tao1.attributeId]);
    issuerAttr = await tir.getLatestRevisionAttribute(
      tao1.did,
      tao1.attributeId,
    );
    expect(decodeResult(issuerAttr)).to.deep.equal({
      attribData: tao1.attribute,
      attributeId: tao1.revisionId,
      did: tao1.did,
      issuerType: IssuerType.TAO.toString(),
      rootTao: rootTAO1.did,
      tao: rootTAO1.did,
    });

    // get the status of the user
    issuer = await tir.getIssuer(tao1.did);
    expect(decodeResult(issuer)).to.deep.equal({
      noAttributesAccepted: false,
      totalAttributes: 1,
    });
  }

  async function registerTAO2() {
    await policyContractMock.setPolicyResult(false); // not admin
    await didContractMock.setDidResult(true); // controller of the DID

    // RootTAO registers a TAO
    await expect(
      tir.setAttributeMetadata(
        tao2.did,
        tao2.attributeId,
        IssuerType.TAO,
        rootTAO1.did,
        rootTAO1.attributeId,
      ),
    ).to.emit(tir, "AddAttributeRevision");

    // get the status of the user
    let issuer = await tir.getIssuer(tao2.did);
    expect(decodeResult(issuer)).to.deep.equal({
      noAttributesAccepted: true,
      totalAttributes: 1,
    });

    // TAO registers the credential
    await expect(
      tir.setAttributeData(tao2.did, tao2.attributeId, tao2.attribute),
    ).to.emit(tir, "AddAttributeRevision");

    // get TAO attribute

    // Deprecated way
    let issuerHashes = await tir.getIssuer__deprecated(tao2.did);
    expect(issuerHashes).to.eql([tao2.revisionId]);
    let issuerAttr: Awaited<
      | ReturnType<typeof tir.getIssuerAttributeByHash__deprecated>
      | ReturnType<typeof tir.getLatestRevisionAttribute>
    > = await tir.getIssuerAttributeByHash__deprecated(issuerHashes[0]);
    expect(decodeResult(issuerAttr)).to.deep.equal({
      attribData: tao2.attribute,
      did: tao2.did,
      issuerType: IssuerType.TAO.toString(),
      rootTao: rootTAO1.did,
      tao: rootTAO1.did,
    });

    // New way
    issuerHashes = (await tir.getIssuerAttributes(tao2.did, 1, 50)).items;
    expect(issuerHashes).to.eql([tao2.attributeId]);
    issuerAttr = await tir.getLatestRevisionAttribute(
      tao2.did,
      tao2.attributeId,
    );
    expect(decodeResult(issuerAttr)).to.deep.equal({
      attribData: tao2.attribute,
      attributeId: tao2.revisionId,
      did: tao2.did,
      issuerType: IssuerType.TAO.toString(),
      rootTao: rootTAO1.did,
      tao: rootTAO1.did,
    });

    // get the status of the user
    issuer = await tir.getIssuer(tao2.did);
    expect(decodeResult(issuer)).to.deep.equal({
      noAttributesAccepted: false,
      totalAttributes: 1,
    });
  }

  async function registerTI() {
    await policyContractMock.setPolicyResult(false); // not admin
    await didContractMock.setDidResult(true); // controller of the DID

    // TAO registers a TI
    await expect(
      tir.setAttributeMetadata(
        ti1.did,
        ti1.attributeId1,
        IssuerType.TI,
        tao1.did,
        tao1.attributeId,
      ),
    ).to.emit(tir, "AddAttributeRevision");

    // get the status of the user
    let issuer = await tir.getIssuer(ti1.did);
    expect(decodeResult(issuer)).to.deep.equal({
      noAttributesAccepted: true,
      totalAttributes: 1,
    });

    // TI registers the credential
    await expect(
      tir.setAttributeData(ti1.did, ti1.attributeId1, ti1.attribute1),
    ).to.emit(tir, "AddAttributeRevision");

    // get TI attribute

    // Deprecated way
    let issuerHashes = await tir.getIssuer__deprecated(ti1.did);
    expect(issuerHashes).to.eql([ti1.revisionId1]);
    let issuerAttr: Awaited<
      | ReturnType<typeof tir.getIssuerAttributeByHash__deprecated>
      | ReturnType<typeof tir.getLatestRevisionAttribute>
    > = await tir.getIssuerAttributeByHash__deprecated(issuerHashes[0]);
    expect(decodeResult(issuerAttr)).to.deep.equal({
      attribData: ti1.attribute1,
      did: ti1.did,
      issuerType: IssuerType.TI.toString(),
      rootTao: rootTAO1.did,
      tao: tao1.did,
    });

    // New way
    issuerHashes = (await tir.getIssuerAttributes(ti1.did, 1, 50)).items;
    expect(issuerHashes).to.eql([ti1.attributeId1]);
    issuerAttr = await tir.getLatestRevisionAttribute(
      ti1.did,
      ti1.attributeId1,
    );
    expect(decodeResult(issuerAttr)).to.deep.equal({
      attribData: ti1.attribute1,
      attributeId: ti1.revisionId1,
      did: ti1.did,
      issuerType: IssuerType.TI.toString(),
      rootTao: rootTAO1.did,
      tao: tao1.did,
    });

    // get the status of the user
    issuer = await tir.getIssuer(ti1.did);
    expect(decodeResult(issuer)).to.deep.equal({
      noAttributesAccepted: false,
      totalAttributes: 1,
    });
  }

  describe("Attributes", () => {
    it("should reject no authenticated users", async () => {
      await policyContractMock.setPolicyResult(false);
      await didContractMock.setDidResult(false);
      await expect(
        tir.setAttributeMetadata(
          ti1.did,
          ti1.attributeId1,
          IssuerType.RootTAO,
          tao1.did,
          tao1.attributeId,
        ),
      ).to.be.revertedWith(
        "Policy error: sender doesn't have the attribute TIR:setAttributeMetadata",
      );
    });

    it("should insert issuers following the chain of trust", async () => {
      await registerRootTAO1();
      await registerTAO1();
      await registerTAO2();
      await registerTI();
    });

    it("should reject an invalid attributeId or revisionId", async () => {
      await registerRootTAO1();
      await registerTAO1();

      await expect(
        tir.getRevisionAttribute(rootTAO1.did, randomHash(), randomHash()),
      ).to.be.revertedWith("attribute has not been found");

      await expect(
        tir.getRevisionAttribute(
          rootTAO1.did,
          rootTAO1.attributeId,
          randomHash(),
        ),
      ).to.be.revertedWith("revision has not been found");

      await expect(
        tir.getRevisionAttribute(
          rootTAO1.did,
          randomHash(),
          rootTAO1.revisionId,
        ),
      ).to.be.revertedWith("attribute has not been found");

      await expect(
        tir.getRevisionAttribute(
          rootTAO1.did,
          tao1.attributeId,
          rootTAO1.revisionId,
        ),
      ).to.be.revertedWith("attribute has not been found");
    });

    it("should revoke an issuer", async () => {
      await registerRootTAO1();
      await registerTAO1();

      // RootTAO revokes TAO
      await expect(
        tir.setAttributeMetadata(
          tao1.did,
          tao1.attributeId,
          IssuerType.Revoked,
          rootTAO1.did,
          rootTAO1.attributeId,
        ),
      ).to.emit(tir, "AddAttributeRevision");

      // get TAO attribute

      // Deprecated way
      let issuerHashes = await tir.getIssuer__deprecated(tao1.did);
      let issuerAttr: Awaited<
        | ReturnType<typeof tir.getIssuerAttributeByHash__deprecated>
        | ReturnType<typeof tir.getLatestRevisionAttribute>
      > = await tir.getIssuerAttributeByHash__deprecated(issuerHashes[0]);
      expect(decodeResult(issuerAttr)).to.deep.equal({
        attribData: "0x",
        did: tao1.did,
        issuerType: IssuerType.Revoked.toString(),
        rootTao: rootTAO1.did,
        tao: rootTAO1.did,
      });

      // New way
      issuerHashes = (await tir.getIssuerAttributes(tao1.did, 1, 50)).items;
      issuerAttr = await tir.getLatestRevisionAttribute(
        tao1.did,
        issuerHashes[0],
      );
      expect(decodeResult(issuerAttr)).to.deep.equal({
        attribData: "0x",
        attributeId: issuerAttr.attributeId,
        did: tao1.did,
        issuerType: IssuerType.Revoked.toString(),
        rootTao: rootTAO1.did,
        tao: rootTAO1.did,
      });
    });

    it("should not initialize if not proxy", async () => {
      await expect(tir.initialize(1)).to.be.revertedWithCustomError(
        tir,
        "InvalidInitialization",
      );
    });

    it("should initialize if proxy", async () => {
      const contractFactory = await ethers.getContractFactory("Tir", {});
      const tsProxy = await upgrades.deployProxy(contractFactory, [42], {
        constructorArgs: [testTprAddress, testDidrAddress],
        unsafeAllow: [
          "constructor",
          "external-library-linking",
          "state-variable-immutable",
        ],
      });
      await tsProxy.waitForDeployment();
      expect((await tsProxy.version()).toString()).to.equal("42");
    });

    it("should fail to call init on TirDetailed", async () => {
      const contractFactory = await ethers.getContractFactory("Tir", {});
      const tsProxy = await upgrades.deployProxy(contractFactory, [42], {
        constructorArgs: [testTprAddress, testDidrAddress],
        unsafeAllow: [
          "constructor",
          "external-library-linking",
          "state-variable-immutable",
        ],
      });

      await tsProxy.waitForDeployment();

      // FIXME: this test should be awaited, but it fails with another message
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      expect(tsProxy.init(30)).to.be.revertedWith(
        "Initializable: contract is already initialized",
      );
    });

    it("should fail to get issuer if it doesn't exist", async () => {
      await expect(tir.getIssuer__deprecated(randomDid())).to.be.revertedWith(
        "issuer does not exist",
      );
      await expect(
        tir.getIssuerAttributes(randomDid(), 1, 50),
      ).to.be.revertedWith("issuer does not exist");
    });

    it("should fail to init", async () => {
      const contractFactory = await ethers.getContractFactory("TirDetailed");
      const tirDetailedProxy = await upgrades.deployProxy(contractFactory, []);

      await tirDetailedProxy.waitForDeployment();

      await expect(tirDetailedProxy.init(42)).to.be.revertedWithCustomError(
        tirDetailedProxy,
        "NotInitializing",
      );
    });

    it("should fail on 0 address", async () => {
      const contractFactory = await ethers.getContractFactory("Tir", {});
      await expect(
        upgrades.deployProxy(contractFactory, [42], {
          constructorArgs: [ethers.ZeroAddress, ethers.ZeroAddress],
          unsafeAllow: [
            "constructor",
            "external-library-linking",
            "state-variable-immutable",
          ],
        }),
      ).to.be.revertedWith("zero address");
    });

    it("should fail pagination if params are wrong", async () => {
      await expect(tir.getIssuers(1, 51)).to.be.revertedWith(
        "PageSize must be <= 50",
      );
      await expect(tir.getIssuers(1, 0)).to.be.revertedWith(
        "PageSize must be > 0",
      );
      await expect(tir.getIssuers(0, 1)).to.be.revertedWith("Page must be > 0");

      await expect(
        tir.getIssuerAttributeRevisions("", randomHash(), 1, 51),
      ).to.be.revertedWith("PageSize must be <= 50");
      await expect(
        tir.getIssuerAttributeRevisions("", randomHash(), 1, 0),
      ).to.be.revertedWith("PageSize must be > 0");
      await expect(
        tir.getIssuerAttributeRevisions("", randomHash(), 0, 1),
      ).to.be.revertedWith("Page must be > 0");

      await expect(
        tir.getIssuerAttributeRevisions__deprecated("", randomHash(), 1, 51),
      ).to.be.revertedWith("PageSize must be <= 50");
      await expect(
        tir.getIssuerAttributeRevisions__deprecated("", randomHash(), 1, 0),
      ).to.be.revertedWith("PageSize must be > 0");
      await expect(
        tir.getIssuerAttributeRevisions__deprecated("", randomHash(), 0, 1),
      ).to.be.revertedWith("Page must be > 0");
    });

    it("should get issuers", async () => {
      await policyContractMock.setPolicyResult(true);

      // insert issuers
      const issuers: string[] = [];
      for (let i = 0; i < 18; i += 1) {
        issuers[i] = randomDid();
        const attrId = `0x${crypto.randomBytes(32).toString("hex")}`;

        await tir.setAttributeMetadata(
          issuers[i],
          attrId,
          IssuerType.RootTAO,
          issuers[i],
          attrId,
        );
      }

      // get issuers: page 1
      let issPagination = await tir.getIssuers(1, 5);
      expect(decodeResult(issPagination)).to.eql({
        howMany: 5n,
        items: issuers.slice(0, 5),
        next: 2n,
        prev: 1n,
        total: 18n,
      });

      // get issuers: page 2
      issPagination = await tir.getIssuers(2, 5);
      expect(decodeResult(issPagination)).to.eql({
        howMany: 5n,
        items: issuers.slice(5, 10),
        next: 3n,
        prev: 1n,
        total: 18n,
      });

      // get issuers: page 3
      issPagination = await tir.getIssuers(3, 5);
      expect(decodeResult(issPagination)).to.eql({
        howMany: 5n,
        items: issuers.slice(10, 15),
        next: 4n,
        prev: 2n,
        total: 18n,
      });

      // get issuers: page 4
      issPagination = await tir.getIssuers(4, 5);
      expect(decodeResult(issPagination)).to.eql({
        howMany: 3n,
        items: issuers.slice(15, 20),
        next: 4n,
        prev: 3n,
        total: 18n,
      });
    });

    it("should get latest metadata during setAttributeData", async () => {
      await registerRootTAO1();

      await policyContractMock.setPolicyResult(true);

      // revoke that attribute
      await tir.setAttributeMetadata(
        rootTAO1.did,
        rootTAO1.attributeId,
        IssuerType.Revoked,
        rootTAO1.did,
        rootTAO1.attributeId,
      );

      // fill the data
      const attr = `0x${crypto.randomBytes(10).toString("hex")}`;
      await tir.setAttributeData(rootTAO1.did, rootTAO1.attributeId, attr);

      // Deprecated way

      // expect the attribute to be revoked
      let issuerHashes = await tir.getIssuer__deprecated(rootTAO1.did);
      expect(issuerHashes).to.be.an("array");
      expect(issuerHashes).to.have.length(1);

      // get the second attribute
      let issuerAttr: Awaited<
        | ReturnType<typeof tir.getIssuerAttributeByHash__deprecated>
        | ReturnType<typeof tir.getLatestRevisionAttribute>
      > = await tir.getIssuerAttributeByHash__deprecated(issuerHashes[0]);
      expect(decodeResult(issuerAttr)).to.deep.equal({
        attribData: attr,
        did: rootTAO1.did,
        issuerType: IssuerType.Revoked.toString(),
        rootTao: rootTAO1.did,
        tao: rootTAO1.did,
      });

      // New way

      // expect the attribute to be revoked
      issuerHashes = (await tir.getIssuerAttributes(rootTAO1.did, 1, 50)).items;
      expect(issuerHashes).to.be.an("array");
      expect(issuerHashes).to.have.length(1);

      // get the second attribute
      issuerAttr = await tir.getLatestRevisionAttribute(
        rootTAO1.did,
        issuerHashes[0],
      );
      expect(decodeResult(issuerAttr)).to.deep.equal({
        attribData: attr,
        attributeId: ethers.sha256(attr),
        did: rootTAO1.did,
        issuerType: IssuerType.Revoked.toString(),
        rootTao: rootTAO1.did,
        tao: rootTAO1.did,
      });
    });

    it("should get the list of revisions", async () => {
      await registerRootTAO1();

      await policyContractMock.setPolicyResult(true);

      // revoke that attribute
      await tir.setAttributeMetadata(
        rootTAO1.did,
        rootTAO1.attributeId,
        IssuerType.Revoked,
        rootTAO1.did,
        rootTAO1.attributeId,
      );

      // fill the data
      const attrRevoked = `0x${crypto.randomBytes(10).toString("hex")}`;
      await tir.setAttributeData(
        rootTAO1.did,
        rootTAO1.attributeId,
        attrRevoked,
      );

      const revisions = await tir.getIssuerAttributeRevisions(
        rootTAO1.did,
        rootTAO1.attributeId,
        1,
        10,
      );
      expect(decodeResult(revisions)).to.deep.equal({
        howMany: 4n,
        items: [
          // Preregistration - no content (setAttributeMetadata)
          rootTAO1.attributeId,
          // Registration of the credential (setAttributeData)
          rootTAO1.revisionId,
          // Credential Revoked without content (setAttributeMetadata)
          revisions.items[2],
          // Credential Revoked with content (setAttributeData)
          ethers.sha256(attrRevoked),
        ],
        next: 1n,
        prev: 1n,
        total: 4n,
      });

      const revisions__deprecated =
        await tir.getIssuerAttributeRevisions__deprecated(
          rootTAO1.did,
          rootTAO1.attributeId,
          1,
          10,
        );
      expect(decodeResult(revisions__deprecated)).to.deep.equal({
        howMany: 4n,
        items: [
          {
            // Preregistration - no content (setAttributeMetadata)
            attribData: "0x",
            attributeId: rootTAO1.attributeId,
            did: rootTAO1.did,
            issuerType: IssuerType.RootTAO.toString(),
            rootTao: rootTAO1.did,
            tao: rootTAO1.did,
          },
          {
            // Registration of the credential (setAttributeData)
            attribData: rootTAO1.attribute,
            attributeId: revisions__deprecated.items[1].attributeId,
            did: rootTAO1.did,
            issuerType: IssuerType.RootTAO.toString(),
            rootTao: rootTAO1.did,
            tao: rootTAO1.did,
          },
          {
            // Credential Revoked without content (setAttributeMetadata)
            attribData: "0x",
            attributeId: rootTAO1.attributeId,
            did: rootTAO1.did,
            issuerType: IssuerType.Revoked.toString(),
            rootTao: rootTAO1.did,
            tao: rootTAO1.did,
          },
          {
            // Credential Revoked with content (setAttributeData)
            attribData: attrRevoked,
            attributeId: revisions__deprecated.items[3].attributeId,
            did: rootTAO1.did,
            issuerType: IssuerType.Revoked.toString(),
            rootTao: rootTAO1.did,
            tao: rootTAO1.did,
          },
        ],
        next: 1n,
        prev: 1n,
        total: 4n,
      });
    });

    it("should be able to revoke a RootTAO by an admin from TPR", async () => {
      await registerRootTAO1();

      await policyContractMock.setPolicyResult(true);

      // revoke that attribute
      await tir.setAttributeMetadata(
        rootTAO1.did,
        rootTAO1.attributeId,
        IssuerType.Revoked,
        rootTAO1.did,
        rootTAO1.attributeId,
      );

      // Deprecated way

      // expect the attribute to be revoked
      let issuerHashes = await tir.getIssuer__deprecated(rootTAO1.did);
      expect(issuerHashes).to.be.an("array");
      expect(issuerHashes).to.have.length(1);

      // get the second attribute
      let issuerAttr: Awaited<
        | ReturnType<typeof tir.getIssuerAttributeByHash__deprecated>
        | ReturnType<typeof tir.getLatestRevisionAttribute>
      > = await tir.getIssuerAttributeByHash__deprecated(issuerHashes[0]);
      expect(decodeResult(issuerAttr)).to.deep.equal({
        attribData: "0x",
        did: rootTAO1.did,
        issuerType: IssuerType.Revoked.toString(),
        rootTao: rootTAO1.did,
        tao: rootTAO1.did,
      });

      // New way

      // expect the attribute to be revoked
      issuerHashes = (await tir.getIssuerAttributes(rootTAO1.did, 1, 50)).items;
      expect(issuerHashes).to.be.an("array");
      expect(issuerHashes).to.have.length(1);

      // get the second attribute
      issuerAttr = await tir.getLatestRevisionAttribute(
        rootTAO1.did,
        issuerHashes[0],
      );
      expect(decodeResult(issuerAttr)).to.deep.equal({
        attribData: "0x",
        attributeId: issuerAttr.attributeId,
        did: rootTAO1.did,
        issuerType: IssuerType.Revoked.toString(),
        rootTao: rootTAO1.did,
        tao: rootTAO1.did,
      });
    });

    it("should reject 2 dids with the same attribute", async () => {
      await registerRootTAO1();
      await policyContractMock.setPolicyResult(true);

      // create rootTAO
      await expect(
        tir.setAttributeMetadata(
          tao1.did,
          rootTAO1.attributeId,
          IssuerType.TAO,
          rootTAO1.did,
          rootTAO1.attributeId,
        ),
      ).to.be.revertedWith("attribute already stored");
    });

    it("should reject an update of an unknown attribute", async () => {
      await registerRootTAO1();
      await policyContractMock.setPolicyResult(true);

      // create rootTAO
      await expect(
        tir.setAttributeData(rootTAO1.did, tao1.attributeId, tao1.attribute),
      ).to.be.revertedWith("attribute has not been found");
    });

    it("should reject invalid inputs for setAttributeMetadata", async () => {
      await policyContractMock.setPolicyResult(true);
      await didContractMock.setDidResult(true);

      await expect(
        tir.setAttributeMetadata(
          rootTAO1.did,
          rootTAO1.attributeId,
          IssuerType.Undefined,
          rootTAO1.did,
          rootTAO1.attributeId,
        ),
      ).to.be.revertedWith("invalid issuerType");
    });

    it("should reject the get of an unknown attribute", async () => {
      await registerRootTAO1();
      await expect(
        tir.getLatestRevisionAttribute(rootTAO1.did, randomHash()),
      ).to.be.revertedWith("attribute has not been found");
      await expect(
        tir.getLatestRevisionAttribute("other-did", randomHash()),
      ).to.be.revertedWith("issuer does not exist");
      await expect(
        tir.getIssuerAttributeRevisions(rootTAO1.did, randomHash(), 1, 10),
      ).to.be.revertedWith("attribute has not been found");
      await expect(
        tir.getIssuerAttributeRevisions("other-did", randomHash(), 1, 10),
      ).to.be.revertedWith("issuer does not exist");
      await expect(
        tir.getIssuerAttributeRevisions__deprecated(
          rootTAO1.did,
          randomHash(),
          1,
          10,
        ),
      ).to.be.revertedWith("attribute has not been found");
      await expect(
        tir.getIssuerAttributeRevisions__deprecated(
          "other-did",
          randomHash(),
          1,
          10,
        ),
      ).to.be.revertedWith("issuer does not exist");
    });

    it("should reject revision already stored", async () => {
      await registerRootTAO1();
      await expect(
        tir.setAttributeData(
          rootTAO1.did,
          rootTAO1.attributeId,
          rootTAO1.attribute,
        ),
      ).to.be.revertedWith("revision already stored");
    });

    it("A ROOT TAO can update the attribute metadata of a TI that was created by TAO", async () => {
      await policyContractMock.setPolicyResult(true); // is admin
      await didContractMock.setDidResult(true); // the admin is a controller

      await registerRootTAO1();
      await registerTAO1();

      await expect(
        tir.setAttributeMetadata(
          tao1.did,
          tao1.attributeId,
          IssuerType.TAO,
          rootTAO1.did,
          rootTAO1.attributeId,
        ),
      ).to.emit(tir, "AddAttributeRevision");

      await expect(
        tir.setAttributeMetadata(
          ti1.did,
          ti1.attributeId1,
          IssuerType.TI,
          tao1.did,
          tao1.attributeId,
        ),
      ).to.emit(tir, "AddAttributeRevision");

      await expect(
        tir.setAttributeMetadata(
          ti1.did,
          ti1.attributeId1,
          IssuerType.TI,
          rootTAO1.did,
          rootTAO1.attributeId,
        ),
      ).to.emit(tir, "AddAttributeRevision");
    });

    it("should reject invalid authorization for setAttributeData", async () => {
      await policyContractMock.setPolicyResult(true); // is admin
      await didContractMock.setDidResult(false); // the admin is not a controller

      // create rootTAO
      await expect(
        tir.setAttributeMetadata(
          rootTAO1.did,
          rootTAO1.attributeId,
          IssuerType.RootTAO,
          rootTAO1.did,
          rootTAO1.attributeId,
        ),
      ).to.emit(tir, "AddAttributeRevision");

      // The admin cannot update data
      await expect(
        tir.setAttributeData(
          rootTAO1.did,
          rootTAO1.attributeId,
          rootTAO1.attribute,
        ),
      ).to.be.revertedWith("Not the issuer itself");
    });

    it("should reject invalid chain of trust", async () => {
      await policyContractMock.setPolicyResult(false); // not admin
      await didContractMock.setDidResult(true); // controller of the DID

      // RootTAO doesn't exist and tries to register a TAO
      await expect(
        tir.setAttributeMetadata(
          tao1.did,
          tao1.attributeId,
          IssuerType.TAO,
          rootTAO1.did,
          rootTAO1.attributeId,
        ),
      ).to.be.revertedWith("issuer does not exist");

      await registerRootTAO1();
      await registerTAO1();
      await registerTAO2();
      await registerTI();

      // The TI cannot register another TI
      await expect(
        tir.setAttributeMetadata(
          "did:ebsi:newTI",
          `0x${crypto.randomBytes(32).toString("hex")}`,
          IssuerType.TI,
          ti1.did,
          ti1.attributeId1,
        ),
      ).to.be.revertedWith(
        "Policy error: sender is not TAO/RootTao it doesn't have the attribute TIR:setAttributeMetadata",
      );

      // A Root TAO cannot register another Root TAO
      await expect(
        tir.setAttributeMetadata(
          "did:ebsi:newRootTAO",
          `0x${crypto.randomBytes(32).toString("hex")}`,
          IssuerType.RootTAO,
          rootTAO1.did,
          rootTAO1.attributeId,
        ),
      ).to.be.revertedWith(
        "Policy error: sender doesn't have the attribute TIR:setAttributeMetadata",
      );

      // A third TAO cannot update attributes
      // TAO registers a TI
      await expect(
        tir.setAttributeMetadata(
          // TAO 2 adds a new attribute, this is OK
          ti1.did,
          ti1.attributeId2,
          IssuerType.TI,
          tao2.did,
          tao2.attributeId,
        ),
      ).to.emit(tir, "AddAttributeRevision");

      await expect(
        tir.setAttributeMetadata(
          ti1.did,
          ti1.attributeId1,
          IssuerType.Revoked,
          tao2.did,
          tao2.attributeId,
        ),
      ).to.be.revertedWith(
        `Policy error: sender is not TAO/RootTao of current did ${ti1.did} and it doesn't have the attribute TIR:setAttributeMetadata`,
      );
    });
  });

  describe("Proxies", () => {
    beforeEach(async () => {
      await registerRootTAO1();
      await registerTAO1();
      await registerTAO2();
      await registerTI();
    });

    it("addIssuerProxy: rejects if the issuer does not exist", async () => {
      // Focus only on proxy management logic regardless of policy and did validations.
      await policyContractMock.setPolicyResult(true);
      await didContractMock.setDidResult(true);

      const randomDidResult = randomDid();

      await expect(
        tir.addIssuerProxy(randomDidResult, proxyData1),
      ).to.be.revertedWith("issuer does not exist");
    });

    it("addIssuerProxy: inserts a new proxy record", async () => {
      // Focus only on proxy management logic regardless of policy and did validations.
      await policyContractMock.setPolicyResult(true);
      await didContractMock.setDidResult(true);

      await expect(tir.addIssuerProxy(didIssuer, proxyData1)).to.emit(
        tir,
        "AddIssuerProxy",
      );
      const issuerProxies = await tir.getIssuerProxies(didIssuer, 1, 50);
      expect(decodeResult(issuerProxies)).to.eql({
        howMany: 1n,
        items: [proxyId],
        next: 1n,
        prev: 1n,
        total: 1n,
      });
    });

    it("addIssuerProxy permissions: did controller and TIR:updateIssuer", async () => {
      await policyContractMock.setPolicyResult(false);
      await didContractMock.setDidResult(false);

      // Adding a new proxy config
      await expect(
        tir.addIssuerProxy(didIssuer, proxyData1),
      ).to.be.revertedWith(
        `Policy error: sender is not controller of the did ${didIssuer} and it doesn't have the attribute TIR:updateIssuer`,
      );
    });

    it("should reject add issuer proxy with the same data", async () => {
      // Focus only on proxy management logic regardless of policy and did validations.
      await policyContractMock.setPolicyResult(true);
      await didContractMock.setDidResult(true);

      await expect(tir.addIssuerProxy(didIssuer, proxyData1)).to.emit(
        tir,
        "AddIssuerProxy",
      );
      await expect(
        tir.addIssuerProxy(didIssuer, proxyData1),
      ).to.be.revertedWith("proxy already stored");
    });

    it("should reject to update an unknown proxy", async () => {
      // Focus only on proxy management logic regardless of policy and did validations.
      await policyContractMock.setPolicyResult(true);
      await didContractMock.setDidResult(true);

      const proxyId = `0x${crypto.randomBytes(32).toString("hex")}`;
      await expect(
        tir.updateIssuerProxy(didIssuer, proxyId, proxyData1),
      ).to.be.revertedWith("proxy not found");
    });

    it("getIssuerProxyById: get a proxy record", async () => {
      // Focus only on proxy management logic regardless of policy and did validations.
      await policyContractMock.setPolicyResult(true);
      await didContractMock.setDidResult(true);

      await expect(tir.addIssuerProxy(didIssuer, proxyData1)).to.emit(
        tir,
        "AddIssuerProxy",
      );

      const proxyDataReturned = await tir.getIssuerProxyById(
        didIssuer,
        proxyId,
      );
      expect(proxyDataReturned).to.eq(proxyData1);
    });

    it("updateIssuerProxy: update a specific proxy record", async () => {
      // Focus only on proxy management logic regardless of policy and did validations.
      await policyContractMock.setPolicyResult(true);
      await didContractMock.setDidResult(true);

      await expect(tir.addIssuerProxy(didIssuer, proxyData1)).to.emit(
        tir,
        "AddIssuerProxy",
      );

      const proxyData = await tir.getIssuerProxyById(didIssuer, proxyId);

      await expect(
        tir.updateIssuerProxy(didIssuer, proxyId, proxyData),
      ).to.emit(tir, "UpdateIssuerProxy");

      // No new records should be added.
      const issuerProxies = await tir.getIssuerProxies(didIssuer, 1, 50);
      expect(decodeResult(issuerProxies)).to.eql({
        howMany: 1n,
        items: [proxyId],
        next: 1n,
        prev: 1n,
        total: 1n,
      });
    });

    it("should pass check controller when addIssuerProxy is called", async () => {
      await policyContractMock.setPolicyResult(false);
      await didContractMock.setDidResult(true);

      await expect(tir.addIssuerProxy(didIssuer, proxyData1)).to.emit(
        tir,
        "AddIssuerProxy",
      );
    });

    it("should check if it is a controller when updateIssuerProxy is called", async () => {
      await policyContractMock.setPolicyResult(false);
      await didContractMock.setDidResult(true);

      await tir.addIssuerProxy(didIssuer, proxyData1);

      const proxyData = randomProxy();

      await expect(
        tir.updateIssuerProxy(didIssuer, proxyId, proxyData),
      ).to.emit(tir, "UpdateIssuerProxy");
    });

    it("updateIssuerProxy permissions: did controller and TIR:updateIssuer", async () => {
      await policyContractMock.setPolicyResult(true);
      await didContractMock.setDidResult(true);

      await expect(tir.addIssuerProxy(didIssuer, proxyData1)).to.emit(
        tir,
        "AddIssuerProxy",
      );

      // Toggle permissions
      await policyContractMock.setPolicyResult(false);
      await didContractMock.setDidResult(false);

      await expect(
        tir.updateIssuerProxy(didIssuer, proxyId, proxyData1),
      ).to.be.revertedWith(
        `Policy error: sender is not controller of the did ${didIssuer} and it doesn't have the attribute TIR:updateIssuer`,
      );
    });

    it("should remove a proxy", async () => {
      await policyContractMock.setPolicyResult(false);
      await didContractMock.setDidResult(true);

      // create multiple proxies
      const proxies = Array.from({ length: 6 })
        .fill(0)
        .map(() => {
          const data = randomProxy();
          const id = ethers.sha256(Buffer.from(data));
          return { data, id };
        });
      for (const proxy of proxies) {
        await tir.addIssuerProxy(didIssuer, proxy.data);
      }

      let issuerProxies = await tir.getIssuerProxies(didIssuer, 1, 50);
      expect(decodeResult(issuerProxies)).to.eql({
        howMany: 6n,
        items: [
          proxies[0].id,
          proxies[1].id,
          proxies[2].id,
          proxies[3].id,
          proxies[4].id,
          proxies[5].id,
        ],
        next: 1n,
        prev: 1n,
        total: 6n,
      });

      await expect(tir.removeIssuerProxy(didIssuer, proxies[2].id)).to.emit(
        tir,
        "RemoveIssuerProxy",
      );

      issuerProxies = await tir.getIssuerProxies(didIssuer, 1, 50);
      expect(decodeResult(issuerProxies)).to.eql({
        howMany: 5n,
        items: [
          proxies[0].id,
          proxies[1].id,
          proxies[5].id, // proxies[2] removed, and replace by [5]
          proxies[3].id,
          proxies[4].id,
        ],
        next: 1n,
        prev: 1n,
        total: 5n,
      });
    });
  });
});
