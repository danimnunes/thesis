import { ethers, network } from "hardhat";

import type { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/dist/src/signer-with-address";

import { expect } from "chai";

import type { PolicyRegistryMock, Timestamp } from "../src/types";

import { testTprAddress } from "./testAddress";

describe("Timestamp Hashes", () => {
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
    await ts.insertHashAlgorithm(256, "SHA256", "oid", 1, "");
    await ts.insertHashAlgorithm(512, "SHA512", "oid2", 1, "");
    await ts.insertHashAlgorithm(256, "SHA3-256", "oid3", 1, "");
  });

  it("getTimestamp should succeed", async () => {
    const hash1 = ethers.toUtf8Bytes("e40605e6");
    const hash2 = ethers.toUtf8Bytes("aa54def9");
    const hash3 = ethers.toUtf8Bytes("38862f7");
    const blockNumber = await ethers.provider.getBlockNumber();
    await ts.timestampHashes(
      [0, 1, 2],
      [hash1, hash2, hash3],
      [
        ethers.toUtf8Bytes("btc"),
        ethers.toUtf8Bytes("new"),
        ethers.toUtf8Bytes("ath"),
      ],
    );
    const r1 = await ts.getTimestamp(hash1);
    expect(r1.hash.value).to.equal(ethers.hexlify(hash1));
    expect(r1.hash.algorithm).to.equal(0);
    expect(r1.timestampedBy).to.equal(admin.address);
    expect(r1.data).to.equal(ethers.hexlify(ethers.toUtf8Bytes("btc")));
    expect(r1.blockNumber).to.equal(blockNumber + 1);
    const r3 = await ts.getTimestamp(hash3);
    expect(r3.hash.value).to.equal(ethers.hexlify(hash3));
    expect(r3.hash.algorithm).to.equal(2);
    expect(r3.timestampedBy).to.equal(admin.address);
    expect(r3.data).to.equal(ethers.hexlify(ethers.toUtf8Bytes("ath")));
    expect(r3.blockNumber).to.equal(blockNumber + 1);
  });

  it("getTimestamp should succeed with empty data", async () => {
    const hash1 = ethers.toUtf8Bytes("e40605e6");
    const hash2 = ethers.toUtf8Bytes("aa54def9");
    const hash3 = ethers.toUtf8Bytes("38862f7");
    const blockNumber = await ethers.provider.getBlockNumber();
    await ts.timestampHashes(
      [0, 1, 2],
      [hash1, hash2, hash3],
      [new Uint8Array([]), ethers.toUtf8Bytes("new"), new Uint8Array([])],
    );
    const r1 = await ts.getTimestamp(hash1);
    expect(r1.hash.value).to.equal(ethers.hexlify(hash1));
    expect(r1.hash.algorithm).to.equal(0);
    expect(r1.timestampedBy).to.equal(admin.address);
    expect(ethers.hexlify(r1.data)).to.equal(
      ethers.hexlify(new Uint8Array([])),
    );
    expect(r1.blockNumber).to.equal(blockNumber + 1);
    const r2 = await ts.getTimestamp(hash2);
    expect(r2.data).to.equal(ethers.hexlify(ethers.toUtf8Bytes("new")));
    const r3 = await ts.getTimestamp(hash3);
    expect(r3.hash.value).to.equal(ethers.hexlify(hash3));
    expect(r3.hash.algorithm).to.equal(2);
    expect(r3.timestampedBy).to.equal(admin.address);
    expect(ethers.hexlify(r3.data)).to.equal(
      ethers.hexlify(new Uint8Array([])),
    );
    expect(r3.blockNumber).to.equal(blockNumber + 1);
  });

  it("getTimestamp should revert if hash is unknown", async () => {
    await expect(
      ts.getTimestamp(ethers.toUtf8Bytes("unknow?")),
    ).to.be.revertedWith("timestamp unknown");
  });

  it("getTimestamp should revert if hash is empty", async () => {
    await expect(ts.getTimestamp(new Uint8Array([]))).to.be.revertedWith(
      "hash empty",
    );
  });

  it("getTimestampById should succeed with empty data", async () => {
    const hash1 = ethers.toUtf8Bytes("e40605e6");
    const hash2 = ethers.toUtf8Bytes("aa54def9");
    const hash3 = ethers.toUtf8Bytes("38862f7");
    const blockNumber = await ethers.provider.getBlockNumber();
    await ts.timestampHashes([0, 1, 2], [hash1, hash2, hash3], []);
    const r1 = await ts.getTimestampById(ethers.sha256(hash1));
    expect(r1.hash.value).to.equal(ethers.hexlify(hash1));
    expect(r1.hash.algorithm).to.equal(0);
    expect(r1.timestampedBy).to.equal(admin.address);
    expect(ethers.hexlify(r1.data)).to.equal(
      ethers.hexlify(new Uint8Array([])),
    );
    expect(r1.blockNumber).to.equal(blockNumber + 1);

    const r3 = await ts.getTimestampById(ethers.sha256(hash3));
    expect(r3.hash.value).to.equal(ethers.hexlify(hash3));
    expect(r3.hash.algorithm).to.equal(2);
    expect(r3.timestampedBy).to.equal(admin.address);
    expect(ethers.hexlify(r3.data)).to.equal(
      ethers.hexlify(new Uint8Array([])),
    );
    expect(r3.blockNumber).to.equal(blockNumber + 1);
  });

  it("getTimestampById should succeed", async () => {
    const hash1 = ethers.toUtf8Bytes("e40605e6");
    const hash2 = ethers.toUtf8Bytes("aa54def9");
    const hash3 = ethers.toUtf8Bytes("38862f7");
    const blockNumber = await ethers.provider.getBlockNumber();
    await ts.timestampHashes(
      [0, 1, 2],
      [hash1, hash2, hash3],
      [
        ethers.toUtf8Bytes("btc"),
        ethers.toUtf8Bytes("new"),
        ethers.toUtf8Bytes("ath"),
      ],
    );
    const r1 = await ts.getTimestampById(ethers.sha256(hash1));
    expect(r1.hash.value).to.equal(ethers.hexlify(hash1));
    expect(r1.hash.algorithm).to.equal(0);
    expect(r1.timestampedBy).to.equal(admin.address);
    expect(r1.data).to.equal(ethers.hexlify(ethers.toUtf8Bytes("btc")));
    expect(r1.blockNumber).to.equal(blockNumber + 1);
    const r3 = await ts.getTimestampById(ethers.sha256(hash3));
    expect(r3.hash.value).to.equal(ethers.hexlify(hash3));
    expect(r3.hash.algorithm).to.equal(2);
    expect(r3.timestampedBy).to.equal(admin.address);
    expect(r3.data).to.equal(ethers.hexlify(ethers.toUtf8Bytes("ath")));
    expect(r3.blockNumber).to.equal(blockNumber + 1);
  });

  it("getTimestampById should revert if timestampID is unknown", async () => {
    await expect(
      ts.getTimestampById(ethers.sha256(ethers.toUtf8Bytes("unknow?"))),
    ).to.be.revertedWith("timestamp unknown");
  });

  it("getTimestgetTimestampByIdamp should revert if timestampId is empty", async () => {
    await expect(ts.getTimestampById(ethers.ZeroHash)).to.be.revertedWith(
      "tsId empty",
    );
  });

  it("timestampHashes should failed if > 3", async () => {
    await expect(
      ts.timestampHashes(
        [0, 1, 2, 3],
        [
          ethers.toUtf8Bytes(
            "e40605e6a26268a5eb83c155ea5dd12aeb3314f6ba5d67d4b607de95156e4e12",
          ),
          ethers.toUtf8Bytes(
            "aa54def9e0bb11c1ebbfc97a9ee63af9e95c4f54db29815daa1c0fe991d9d20c",
          ),
          ethers.toUtf8Bytes(
            "38862f7ef560797680273f23ab1974285c3c07bba979a3e92e931bfbe362bcc6",
          ),
        ],
        [
          ethers.toUtf8Bytes("btc"),
          ethers.toUtf8Bytes("new"),
          ethers.toUtf8Bytes("ath"),
        ],
      ),
    ).to.be.revertedWith("hashAlgorithmIds>3");
    await expect(
      ts.timestampHashes(
        [0, 1, 2],
        [
          ethers.toUtf8Bytes(
            "e40605e6a26268a5eb83c155ea5dd12aeb3314f6ba5d67d4b607de95156e4e12",
          ),
          ethers.toUtf8Bytes(
            "aa54def9e0bb11c1ebbfc97a9ee63af9e95c4fdf1d032b1da1c09d20c",
          ),
          ethers.toUtf8Bytes(
            "38862f7ef560797680273f23ab1974285c3c07bba979a3e92e931bfbe362bcc6",
          ),
          ethers.toUtf8Bytes(
            "38862f7ef560797680273f23ab1974285c3c07bba979a3e92e931bfbe362bcc6",
          ),
        ],
        [
          ethers.toUtf8Bytes("btc"),
          ethers.toUtf8Bytes("new"),
          ethers.toUtf8Bytes("ath"),
        ],
      ),
    ).to.be.revertedWith("hashValues>3");
    await expect(
      ts.timestampHashes(
        [0, 1, 2],
        [
          ethers.toUtf8Bytes(
            "e40605e6a26268a5eb83c155ea5dd12aeb3314f6ba5d67d4b607de95156e4e12",
          ),
          ethers.toUtf8Bytes(
            "aa54def9e0bb11c1ebbfc97a9ee63af9e95c1ddae54eff0c4c28cd9d20c",
          ),
          ethers.toUtf8Bytes(
            "38862f7ef560797680273f23ab1974285c3c07bba979a3e92e931bfbe362bcc6",
          ),
        ],
        [
          ethers.toUtf8Bytes("btc"),
          ethers.toUtf8Bytes("new"),
          ethers.toUtf8Bytes("ath"),
          ethers.toUtf8Bytes("ath"),
        ],
      ),
    ).to.be.revertedWith("timestampData>3");
  });

  it("timestampHashes should failed for unknown hash algo", async () => {
    await expect(
      ts.timestampHashes(
        [7, 1, 2],
        [
          ethers.toUtf8Bytes("e40605e6a26268a5eb8"),
          ethers.toUtf8Bytes("aa54defe54eff0c4c28"),
          ethers.toUtf8Bytes("38862f7ef56079768"),
        ],
        [
          ethers.toUtf8Bytes("btc"),
          ethers.toUtf8Bytes("new"),
          ethers.toUtf8Bytes("ath"),
        ],
      ),
    ).to.be.revertedWith("hashAlgo unknown");
  });

  it("timestampHashes should failed for empty value and hash", async () => {
    await expect(ts.insertHashAlgorithm(256, "SHA2561", "oid", 1, "")).to.emit(
      ts,
      "AddNewHashAlgo",
    );
    await expect(ts.insertHashAlgorithm(512, "SHA5122", "oid", 1, "")).to.emit(
      ts,
      "AddNewHashAlgo",
    );
    await expect(
      ts.insertHashAlgorithm(256, "SHA3-2563", "oid", 1, ""),
    ).to.emit(ts, "AddNewHashAlgo");
    await ts.getHashAlgorithms(1, 10);
    await expect(
      ts.timestampHashes(
        [5, 3, 1],
        [
          ethers.toUtf8Bytes("e40605e6a26268a5eb8"),
          new Uint8Array([]),
          ethers.toUtf8Bytes("38862f7ef56079768"),
        ],
        [
          ethers.toUtf8Bytes("btc"),
          ethers.toUtf8Bytes("new"),
          ethers.toUtf8Bytes("ath"),
        ],
      ),
    ).to.be.revertedWith("hashValue empty");
    // should not revert
    await ts.timestampHashes(
      [5, 1, 2],
      [
        ethers.toUtf8Bytes("e40605e6a26268a5eb8"),
        ethers.toUtf8Bytes("aa54def9"),
        ethers.toUtf8Bytes("38862f7ef56079768"),
      ],
      [],
    );
  });

  it("timestampHashes should succeed", async () => {
    const hash1 = ethers.toUtf8Bytes("e40605e6");
    const hash2 = ethers.toUtf8Bytes("aa54def9");
    const hash3 = ethers.toUtf8Bytes("38862f7");
    await ts.timestampHashes(
      [0, 1, 2],
      [hash1, hash2, hash3],
      [
        ethers.toUtf8Bytes("btc"),
        ethers.toUtf8Bytes("new"),
        ethers.toUtf8Bytes("ath"),
      ],
    );

    const receipt = await ts.getTimestamps(1, 10);
    expect(receipt.items).to.deep.equal([
      ethers.sha256(hash1),
      ethers.sha256(hash2),
      ethers.sha256(hash3),
    ]);
  });

  it("timestampHashes should succeed even with empty data", async () => {
    const hash1 = ethers.toUtf8Bytes("e40605e6");
    const hash2 = ethers.toUtf8Bytes("aa54def9");
    const hash3 = ethers.toUtf8Bytes("38862f7");
    await ts.timestampHashes([0, 1, 2], [hash1, hash2, hash3], []);

    const receipt = await ts.getTimestamps(1, 10);
    expect(receipt.items).to.deep.equal([
      ethers.sha256(hash1),
      ethers.sha256(hash2),
      ethers.sha256(hash3),
    ]);
  });

  it("getTimestamps should failed with wrong page and pageSize", async () => {
    const resTsIds: string[] = [];
    for (let i = 1; i < 12; i += 1) {
      const data = `SHA-${i}`;
      const hash = `e40605e6a26268a5eb83c155ea5dd12aeb3314f6ba5d67d4b607de95156e4e1${i}`;
      // Id starts from zero
      resTsIds.push(ethers.sha256(ethers.toUtf8Bytes(hash)));
      // INSERT SHOULD BE DONE IN ORDER !!!

      await ts.timestampHashes(
        [0],
        [ethers.toUtf8Bytes(hash)],
        [ethers.toUtf8Bytes(data)],
      );
    }
    // pagesize = 0 should revert
    await expect(ts.getTimestamps(1, 0)).to.be.revertedWith("PSize not >0");
    // page  = 0 should revert
    await expect(ts.getTimestamps(0, 10)).to.be.revertedWith("Page not >0");

    // pagesize > 50 should revert
    await expect(ts.getTimestamps(1, 51)).to.be.revertedWith("PSize not <= 50");
  });

  it("getTimestamps should succeed", async () => {
    const resTsIds: string[] = [];
    for (let i = 1; i < 12; i += 1) {
      const data = `SHA-${i}`;
      const hash = `e40605e6a26268a5eb83c155ea5dd12aeb3314f6ba5d67d4b607de95156e4e1${i}`;
      // Id starts from zero
      resTsIds.push(ethers.sha256(ethers.toUtf8Bytes(hash)));
      // INSERT SHOULD BE DONE IN ORDER !!!

      await ts.timestampHashes(
        [0],
        [ethers.toUtf8Bytes(hash)],
        [ethers.toUtf8Bytes(data)],
      );
    }

    const r0 = await ts.getTimestamps(1, 1);
    expect(r0.items).to.have.length(1);

    for (const [id, el] of r0.items.entries()) {
      expect(el).to.equal(resTsIds.slice(0, 1)[id]);
    }

    expect(r0.total).to.equal(11);
    expect(r0.howMany).to.equal(1);
    expect(r0.prev).to.equal(1);
    expect(r0.next).to.equal(2);

    const r = await ts.getTimestamps(1, 11);
    expect(r.items).to.have.length(11);

    for (const [id, el] of r.items.entries()) {
      expect(el).to.equal(resTsIds[id]);
    }

    expect(r.total).to.equal(11);
    expect(r.howMany).to.equal(11);
    expect(r.prev).to.equal(1);
    expect(r.next).to.equal(1);

    const r1 = await ts.getTimestamps(5, 11);
    expect(r1.items).to.have.length(0);
    expect(r1.total).to.equal(11);
    expect(r1.howMany).to.equal(0);
    expect(r1.prev).to.equal(1);
    expect(r1.next).to.equal(1);
  });
});
