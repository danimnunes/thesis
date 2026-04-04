import { ethers, network } from "hardhat";

import type { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

import { expect } from "chai";

import type { PolicyRegistryMock, Timestamp } from "../src/types/index.ts";

import { testTprAddress } from "./testAddress";

describe("Hash Algorithm", () => {
  let ts: Timestamp;
  let admin: SignerWithAddress;
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
    [admin] = await ethers.getSigners();
    const stringManipFactory = await ethers.getContractFactory("StringManip");
    const stringManipLib = await stringManipFactory.deploy();

    const haFactory = await ethers.getContractFactory("HashAlgoLib", {});
    const haLib = await haFactory.deploy();

    const tsFactory = await ethers.getContractFactory("TimestampLib", {});
    const tsLib = await tsFactory.deploy();

    const rsFactory = await ethers.getContractFactory("RecordLib", {
      libraries: {
        StringManip: await stringManipLib.getAddress(),
      },
    });
    const rsLib = await rsFactory.deploy();

    const contractFactory = await ethers.getContractFactory("Timestamp", {
      libraries: {
        HashAlgoLib: await haLib.getAddress(),
        RecordLib: await rsLib.getAddress(),
        TimestampLib: await tsLib.getAddress(),
      },
    });
    ts = await contractFactory.deploy(testTprAddress);
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    expect(await ts.getAddress()).to.properAddress;
    await policyContractMock.setPolicyResult(true);
  });

  it("should fail when user does not have attribute insertHashAlgorithm", async () => {
    await policyContractMock.setPolicyResult(false);
    await expect(
      ts.insertHashAlgorithm(256, "SHA2-256", "oid2256", 1, "multi256"),
    ).to.be.revertedWith(
      "Policy error: sender doesn't have the attribute TS:insertHashAlgorithm",
    );
  });

  it("should fail when user does not have attribute updateHashAlgorithm", async () => {
    await policyContractMock.setPolicyResult(false);
    await expect(
      ts.updateHashAlgorithm(0, 1, "sha-256", "oid", 1, "sha2-256"),
    ).to.be.revertedWith(
      "Policy error: sender doesn't have the attribute TS:updateHashAlgorithm",
    );
  });

  it("getHashAlgorithmById should succeed", async () => {
    await expect(
      ts.insertHashAlgorithm(256, "SHA256", "oid256", 1, "multi"),
    ).to.emit(ts, "AddNewHashAlgo");
    const receipt = await ts.getHashAlgorithmById(0);
    expect(receipt.outputLength).to.equal(256);
    expect(receipt.ianaName).to.equal("SHA256");
    expect(receipt.oid).to.equal("oid256");
    expect(receipt.status).to.equal(1);
    expect(receipt.multiHash).to.equal("multi");

    await ts.insertHashAlgorithm(256, "SHA2-256", "oid2256", 1, "multi256");
    await ts.insertHashAlgorithm(512, "SHA512", "oid2", 1, "multi512");
    await ts.insertHashAlgorithm(256, "SHA3-256", "oid3", 1, "multi2-256");
    const receipt2 = await ts.getHashAlgorithmById(2);
    expect(receipt2.outputLength).to.equal(512);
    expect(receipt2.ianaName).to.equal("SHA512");
    expect(receipt2.oid).to.equal("oid2");
    expect(receipt2.status).to.equal(1);
    expect(receipt2.multiHash).to.equal("multi512");
    const receipt3 = await ts.getHashAlgorithmById(3);
    expect(receipt3.outputLength).to.equal(256);
    expect(receipt3.ianaName).to.equal("SHA3-256");
    expect(receipt3.oid).to.equal("oid3");
    expect(receipt3.status).to.equal(1);
    expect(receipt3.multiHash).to.equal("multi2-256");
  });

  it("getHashAlgorithmById should revert if hash is unknown", async () => {
    await expect(ts.getHashAlgorithmById(0)).to.be.revertedWith(
      "hashAlgo unknown",
    );
  });

  it("insertHashAlgorithm should revert for incorrect parameters", async () => {
    await expect(
      ts.connect(admin).insertHashAlgorithm(0, "SHA256", "oid", 1, ""),
    ).to.be.revertedWith("outputLength==0");

    await ts.connect(admin).insertHashAlgorithm(256, "SHA256", "oid", 1, "");
    await expect(
      ts.connect(admin).insertHashAlgorithm(256, "SHA256", "oid", 1, ""),
    ).to.be.revertedWith("ianaName defined");

    await expect(
      ts.insertHashAlgorithm(1, "SHA256", "oid", 0, ""),
    ).to.be.revertedWith("status==0");

    await expect(
      ts.insertHashAlgorithm(256, "", "oid", 1, ""),
    ).to.be.revertedWith("ianaName unknown");
  });

  it("insertHashAlgorithm should work", async () => {
    await expect(
      ts.connect(admin).insertHashAlgorithm(256, "SHA256", "oid", 1, ""),
    )
      .to.emit(ts, "AddNewHashAlgo")
      .withArgs(0, "SHA256", 256, "oid", 1, "");
    await expect(
      ts.connect(admin).insertHashAlgorithm(512, "SHA3-512", "oid2", 1, "tt"),
    )
      .to.emit(ts, "AddNewHashAlgo")
      .withArgs(1, "SHA3-512", 512, "oid2", 1, "tt");
    const receipt = await ts.getHashAlgorithmById(1);
    expect(receipt.outputLength).to.equal(512);
    expect(receipt.ianaName).to.equal("SHA3-512");
    expect(receipt.oid).to.equal("oid2");
    expect(receipt.status).to.equal(1);
    expect(receipt.multiHash).to.equal("tt");
  });

  it("updateHashAlgorithm should revert for incorrect parameters", async () => {
    await expect(
      ts.updateHashAlgorithm(0, 0, "SHA256", "oid", 1, ""),
    ).to.be.revertedWith("outputLength==0");
    await expect(
      ts.updateHashAlgorithm(0, 1, "SHA256", "oid", 0, ""),
    ).to.be.revertedWith("status==0");
    await expect(
      ts.updateHashAlgorithm(0, 1, "SHA256", "oid", 1, ""),
    ).to.be.revertedWith("hashAlgorithmId unknown");
  });

  it("updateHashAlgorithm should revert for empty ianaName", async () => {
    await expect(ts.insertHashAlgorithm(256, "SHA256", "oid", 1, "")).to.emit(
      ts,
      "AddNewHashAlgo",
    );
    await expect(
      ts.insertHashAlgorithm(512, "SHA3-512", "oid2", 1, ""),
    ).to.emit(ts, "AddNewHashAlgo");
    const receipt = await ts.getHashAlgorithmById(1);
    expect(receipt.outputLength).to.equal(512);
    expect(receipt.ianaName).to.equal("SHA3-512");
    expect(receipt.oid).to.equal("oid2");
    expect(receipt.status).to.equal(1);
    expect(receipt.multiHash).to.equal("");

    await expect(
      ts.updateHashAlgorithm(1, 1024, "", "oid3", 2, ""),
    ).to.be.revertedWith("ianaName unknown");
  });

  it("updateHashAlgorithm should update also ianaName", async () => {
    await expect(ts.insertHashAlgorithm(256, "SHA256", "oid", 1, "")).to.emit(
      ts,
      "AddNewHashAlgo",
    );
    await expect(
      ts.insertHashAlgorithm(512, "SHA3-512", "oid2", 1, ""),
    ).to.emit(ts, "AddNewHashAlgo");
    let receipt = await ts.getHashAlgorithmById(1);
    expect(receipt.outputLength).to.equal(512);
    expect(receipt.ianaName).to.equal("SHA3-512");
    expect(receipt.oid).to.equal("oid2");
    expect(receipt.status).to.equal(1);
    expect(receipt.multiHash).to.equal("");
    await ts.updateHashAlgorithm(1, 1024, "SHA3-512", "oid3", 2, "");
    receipt = await ts.getHashAlgorithmById(1);
    expect(receipt.outputLength).to.equal(1024);
    expect(receipt.ianaName).to.equal("SHA3-512");
    expect(receipt.oid).to.equal("oid3");
    expect(receipt.status).to.equal(2);
    expect(receipt.multiHash).to.equal("");
    await ts.updateHashAlgorithm(1, 1024, "SHA4-512", "oid3", 2, "");
    await expect(
      ts.insertHashAlgorithm(512, "SHA3-512", "oid2", 1, ""),
    ).to.emit(ts, "AddNewHashAlgo");
    await expect(
      ts.insertHashAlgorithm(512, "SHA3-512", "oid2", 1, ""),
    ).to.be.revertedWith("ianaName defined");
    await expect(
      ts.insertHashAlgorithm(512, "SHA4-512", "oid2", 1, ""),
    ).to.be.revertedWith("ianaName defined");
  });

  it("updateHashAlgorithm should work", async () => {
    await expect(ts.insertHashAlgorithm(256, "SHA256", "oid", 1, "")).to.emit(
      ts,
      "AddNewHashAlgo",
    );
    await expect(
      ts.insertHashAlgorithm(512, "SHA3-512", "oid2", 1, ""),
    ).to.emit(ts, "AddNewHashAlgo");
    const receipt = await ts.getHashAlgorithmById(1);
    expect(receipt.outputLength).to.equal(512);
    expect(receipt.ianaName).to.equal("SHA3-512");
    expect(receipt.oid).to.equal("oid2");
    expect(receipt.status).to.equal(1);
    expect(receipt.multiHash).to.equal("");

    await expect(ts.updateHashAlgorithm(1, 1024, "SHA4-1024", "oid3", 2, ""))
      .to.emit(ts, "UpdateHashAlgo")
      .withArgs(1, "SHA4-1024", "SHA4-1024", 1024, "oid3", 2, "");
    const updated = await ts.getHashAlgorithmById(1);
    expect(updated.outputLength).to.equal(1024);
    expect(updated.ianaName).to.equal("SHA4-1024");
    expect(updated.oid).to.equal("oid3");
    expect(updated.status).to.equal(2);
    expect(updated.multiHash).to.equal("");
  });

  it("getHashAlgorithms should failed with wrong page and pageSize", async () => {
    const resHashIds: number[] = [];
    for (let i = 1; i < 12; i += 1) {
      const name = `SHA-${i}`;
      const oid = `oid${i}`;
      // Id starts from zero
      resHashIds.push(i - 1);
      // INSERT SHOULD BE DONE IN ORDER !!!

      await expect(
        ts.connect(admin).insertHashAlgorithm(i, name, oid, 1, ""),
      ).to.emit(ts, "AddNewHashAlgo");
    }
    // pagesize = 0 should revert
    await expect(ts.getHashAlgorithms(1, 0)).to.be.revertedWith("PSize not >0");
    // page  = 0 should revert
    await expect(ts.getHashAlgorithms(0, 10)).to.be.revertedWith("Page not >0");

    // pagesize > 50 should revert
    await expect(ts.getHashAlgorithms(1, 51)).to.be.revertedWith(
      "PSize not <= 50",
    );
  });

  it("getHashAlgorithms should work with correct page and pageSize", async () => {
    const resHashIds: number[] = [];
    for (let i = 1; i < 12; i += 1) {
      const name = `SHA-${i}`;
      const oid = `oid${i}`;
      const multiHash = `multi${i}`;
      // Id starts from zero
      resHashIds.push(i - 1);
      // INSERT SHOULD BE DONE IN ORDER !!!

      await expect(ts.insertHashAlgorithm(i, name, oid, 1, multiHash)).to.emit(
        ts,
        "AddNewHashAlgo",
      );
    }

    const r0 = await ts.getHashAlgorithms(1, 1);
    expect(r0.items).to.have.length(1);

    for (const [id, el] of r0.items.entries()) {
      expect(el).to.equal(resHashIds.slice(0, 1)[id]);
    }

    expect(r0.total).to.equal(11);
    expect(r0.howMany).to.equal(1);
    expect(r0.prev).to.equal(1);
    expect(r0.next).to.equal(2);

    const r = await ts.getHashAlgorithms(1, 11);
    expect(r.items).to.have.length(11);

    for (const [id, el] of r.items.entries()) {
      expect(el).to.equal(resHashIds[id]);
    }

    expect(r.total).to.equal(11);
    expect(r.howMany).to.equal(11);
    expect(r.prev).to.equal(1);
    expect(r.next).to.equal(1);

    const r1 = await ts.getHashAlgorithms(5, 11);
    expect(r1.items).to.have.length(0);
    expect(r1.total).to.equal(11);
    expect(r1.howMany).to.equal(0);
    expect(r1.prev).to.equal(1);
    expect(r1.next).to.equal(1);
  });
});
