import { ethers, network } from "hardhat";

import type { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/dist/src/signer-with-address";

import { expect } from "chai";
import crypto from "node:crypto";

import type { PolicyRegistryMock, Timestamp } from "../src/types";

import { testTprAddress } from "./testAddress";

const MAX_UINT256 =
  "115792089237316195423570985008687907853269984665640564039457584007913129639935";

const randomHash = () => `0x${crypto.randomBytes(32).toString("hex")}`;

describe("Record Hashes", () => {
  let ts: Timestamp;
  let admin: SignerWithAddress;
  let user: SignerWithAddress;
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
    [admin, user] = await ethers.getSigners();

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
    expect(await ts.getAddress()).to.be.properAddress;
    await policyContractMock.setPolicyResult(true);
    await ts.insertHashAlgorithm(256, "SHA256", "oid", 1, "");
    await ts.insertHashAlgorithm(512, "SHA512", "oid2", 1, "");
    await ts.insertHashAlgorithm(256, "SHA3-256", "oid3", 1, "");
  });

  it("timestampVersionHashes should failed if > 3", async () => {
    await expect(
      ts.timestampVersionHashes(
        ethers.toUtf8Bytes("versionHash"),
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
        ethers.toUtf8Bytes("info: btc to the moon"),
      ),
    ).to.be.revertedWith("hashAlgorithmIds>3");
    await expect(
      ts.timestampVersionHashes(
        ethers.toUtf8Bytes("versionHash"),
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
        ethers.toUtf8Bytes("info: btc to the moon"),
      ),
    ).to.be.revertedWith("hashValues>3");
    await expect(
      ts.timestampVersionHashes(
        ethers.toUtf8Bytes("versionHash"),
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
        ethers.toUtf8Bytes("info: btc to the moon"),
      ),
    ).to.be.revertedWith("timestampData>3");
  });

  it("timestampVersionHashes should failed for unknown hash algo", async () => {
    await expect(
      ts.timestampVersionHashes(
        ethers.toUtf8Bytes("versionHash"),
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
        ethers.toUtf8Bytes("info: btc to the moon"),
      ),
    ).to.be.revertedWith("hashAlgo unknown");
  });

  it("timestampVersionHashes should failed if record doesn't exists", async () => {
    await expect(
      ts.timestampVersionHashes(
        new Uint8Array([89]),
        [1, 2, 0],
        [
          ethers.toUtf8Bytes("e40605e6a26268a5eb8"),
          new Uint8Array([8]),
          ethers.toUtf8Bytes("38862f7ef56079768"),
        ],
        [
          ethers.toUtf8Bytes("btc"),
          ethers.toUtf8Bytes("new"),
          new Uint8Array([]),
        ],
        ethers.toUtf8Bytes("info: btc to the moon"),
      ),
    ).to.be.revertedWith("wrong record count");
  });

  it("timestampVersionHashes should failed for empty value and hash", async () => {
    await expect(
      ts.timestampVersionHashes(
        ethers.toUtf8Bytes("versionHash"),
        [0, 1, 2],
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
        ethers.toUtf8Bytes("info: btc to the moon"),
      ),
    ).to.be.revertedWith("hashValue empty");

    await expect(
      ts.timestampVersionHashes(
        new Uint8Array([]),
        [1, 2, 0],
        [
          ethers.toUtf8Bytes("e40605e6a26268a5eb8"),
          new Uint8Array([8]),
          ethers.toUtf8Bytes("38862f7ef56079768"),
        ],
        [
          ethers.toUtf8Bytes("btc"),
          ethers.toUtf8Bytes("new"),
          new Uint8Array([]),
        ],
        ethers.toUtf8Bytes("info: btc to the moon"),
      ),
    ).to.be.revertedWith("versionHash empty");
    //  should not revert is optional params are empty
    const hash1 = ethers.toUtf8Bytes("e40605e6");
    const hash2 = ethers.toUtf8Bytes("aa54def9");
    const hash3 = ethers.toUtf8Bytes("38862f7");
    await ts.timestampRecordHashes(
      [0, 1, 2],
      [hash1, hash2, hash3],
      [
        ethers.toUtf8Bytes("btc"),
        ethers.toUtf8Bytes("new"),
        ethers.toUtf8Bytes("ath"),
      ],
      ethers.toUtf8Bytes("info: btc to the moon"),
    );
    const tsids = [
      ethers.sha256(ethers.toUtf8Bytes("e40605e6a26268a5eb8")),
      ethers.sha256(new Uint8Array([8])),
      ethers.sha256(ethers.toUtf8Bytes("38862f7ef56079768")),
    ];

    await expect(
      ts.timestampVersionHashes(
        hash1,
        [2, 0, 1],
        [
          ethers.toUtf8Bytes("e40605e6a26268a5eb8"),
          new Uint8Array([8]),
          ethers.toUtf8Bytes("38862f7ef56079768"),
        ],
        [],
        new Uint8Array([]),
      ),
    )
      .to.emit(ts, "TimestampedHashes")
      .withArgs(
        tsids,
        [2, 0, 1],
        [
          ethers.hexlify(ethers.toUtf8Bytes("e40605e6a26268a5eb8")),
          ethers.hexlify(new Uint8Array([8])),
          ethers.hexlify(ethers.toUtf8Bytes("38862f7ef56079768")),
        ],
        [],
      );
  });
  // TODO it("timestampVersionHashes should failed for too many records", async   () => {});
  it("timestampVersionHashes should failed for empty records", async () => {
    const hash1 = ethers.toUtf8Bytes("e40605e6");
    const hash2 = ethers.toUtf8Bytes("aa54def9");
    const hash3 = ethers.toUtf8Bytes("38862f7");
    await expect(
      ts.timestampVersionHashes(
        hash1,
        [0, 1, 2],
        [hash1, hash2, hash3],
        [
          ethers.toUtf8Bytes("btc"),
          ethers.toUtf8Bytes("new"),
          ethers.toUtf8Bytes("ath"),
        ],
        ethers.toUtf8Bytes("info: btc to the moon"),
      ),
    ).to.be.revertedWith("wrong record count");
  });

  it("timestampVersionHashes should failed for two records", async () => {
    const hash1 = randomHash();
    const hash2 = randomHash();
    const hash3 = randomHash();
    const hash4 = randomHash();

    await ts.timestampRecordHashes(
      [0, 1, 2],
      [hash1, hash2, hash3],
      [
        ethers.toUtf8Bytes("btc"),
        ethers.toUtf8Bytes("new"),
        ethers.toUtf8Bytes("ath"),
      ],
      ethers.toUtf8Bytes("info: btc to the moon"),
    );

    await ts.timestampRecordHashes(
      [0, 1],
      [hash4, hash2], // new record with timestamp used in the previous one
      [],
      ethers.toUtf8Bytes("info"),
    );

    // timestampVersionHashes can not be used to add a version, because
    // the timestamp id is not enough to know the record id
    await expect(
      ts.timestampVersionHashes(
        hash2, // hash linked to 2 records
        [0, 1, 2],
        [hash1, hash2, hash3],
        [
          ethers.toUtf8Bytes("btc"),
          ethers.toUtf8Bytes("new"),
          ethers.toUtf8Bytes("ath"),
        ],
        new Uint8Array([]),
      ),
    ).to.be.revertedWith("wrong record count");
  });

  it("timestampVersionHashes should fail for sender not owner", async () => {
    const hash1 = ethers.toUtf8Bytes("e40605e6");
    const hash2 = ethers.toUtf8Bytes("aa54def9");
    const hash3 = ethers.toUtf8Bytes("38862f7");
    await ts.timestampRecordHashes(
      [0, 1, 2],
      [hash1, hash2, hash3],
      [
        ethers.toUtf8Bytes("btc"),
        ethers.toUtf8Bytes("new"),
        ethers.toUtf8Bytes("ath"),
      ],
      ethers.toUtf8Bytes("info: btc to the moon"),
    );
    const tsUser = ts.connect(user);
    await expect(
      tsUser.timestampVersionHashes(
        hash1,
        [0, 1, 2],
        [hash1, hash2, hash3],
        [
          ethers.toUtf8Bytes("btc"),
          ethers.toUtf8Bytes("new"),
          ethers.toUtf8Bytes("ath"),
        ],
        ethers.toUtf8Bytes("info: btc to the moon"),
      ),
    ).to.be.revertedWith("sender is not listed as owner");
  });

  it("timestampVersionHashes should succeed", async () => {
    const hash1 = ethers.toUtf8Bytes("e40605e6");
    const hash2 = ethers.toUtf8Bytes("aa54def9");
    const hash3 = ethers.toUtf8Bytes("38862f7");
    await ts.timestampRecordHashes(
      [0, 1, 2],
      [hash1, hash2, hash3],
      [
        ethers.toUtf8Bytes("btc"),
        ethers.toUtf8Bytes("new"),
        ethers.toUtf8Bytes("ath"),
      ],
      ethers.toUtf8Bytes("info: btc to the moon"),
    );
    const tsids = [
      ethers.sha256(hash1),
      ethers.sha256(hash2),
      ethers.sha256(hash3),
    ];
    const timestampData = [
      ethers.toUtf8Bytes("btc"),
      ethers.toUtf8Bytes("new"),
      ethers.toUtf8Bytes("ath"),
    ].map((d) => `0x${Buffer.from(d).toString("hex")}`);
    await expect(
      ts.timestampVersionHashes(
        hash1,
        [0, 1, 2],
        [hash1, hash2, hash3],
        timestampData,
        ethers.toUtf8Bytes("info: btc to the moon"),
      ),
    )
      .to.emit(ts, "TimestampedHashes")
      .withArgs(
        tsids,
        [0, 1, 2],
        [ethers.hexlify(hash1), ethers.hexlify(hash2), ethers.hexlify(hash3)],
        timestampData,
      );
    const receipt = await ts.getTimestamps(1, 10);
    expect(receipt.items).to.deep.equal([
      ethers.sha256(hash1),
      ethers.sha256(hash2),
      ethers.sha256(hash3),
    ]);
    // should work with empty  versionInfo
    const hash1prime = ethers.toUtf8Bytes("othere40605e6");
    await ts.timestampRecordHashes(
      [0, 1, 2],
      [hash1prime, hash2, hash3],
      timestampData,
      ethers.toUtf8Bytes("info: btc to the moon"),
    );
    await ts.timestampVersionHashes(
      hash1prime,
      [0, 1, 2],
      [hash1prime, hash2, hash3],
      timestampData,
      new Uint8Array([]),
    );
  });

  it("timestampVersionHashes should succeed with empty data", async () => {
    const hash1 = ethers.toUtf8Bytes("e40605e6");
    const hash2 = ethers.toUtf8Bytes("aa54def9");
    const hash3 = ethers.toUtf8Bytes("38862f7");
    await ts.timestampRecordHashes(
      [0, 1, 2],
      [hash1, hash2, hash3],
      [],
      ethers.toUtf8Bytes("info: btc to the moon"),
    );
    const tsids = [
      ethers.sha256(hash1),
      ethers.sha256(hash2),
      ethers.sha256(hash3),
    ];
    await expect(
      ts.timestampVersionHashes(
        hash1,
        [0, 1, 2],
        [hash1, hash2, hash3],
        [],
        ethers.toUtf8Bytes("info: btc to the moon"),
      ),
    )
      .to.emit(ts, "TimestampedHashes")
      .withArgs(
        tsids,
        [0, 1, 2],
        [ethers.hexlify(hash1), ethers.hexlify(hash2), ethers.hexlify(hash3)],
        [],
      );
    const receipt = await ts.getTimestamps(1, 10);
    expect(receipt.items).to.deep.equal([
      ethers.sha256(hash1),
      ethers.sha256(hash2),
      ethers.sha256(hash3),
    ]);

    // should work with empty  versionInfo
    const hash1prime = ethers.toUtf8Bytes("othere40605e6");
    await ts.timestampRecordHashes(
      [0, 1, 2],
      [hash1prime, hash2, hash3],
      [],
      ethers.toUtf8Bytes("info: btc to the moon"),
    );
    await ts.timestampVersionHashes(
      hash1prime,
      [0, 1, 2],
      [hash1prime, hash2, hash3],
      [],
      new Uint8Array([]),
    );
  });

  it("timestampRecordHashes should failed if hash algo and values length are different", async () => {
    await expect(
      ts.timestampRecordHashes(
        [0, 1],
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
        ethers.toUtf8Bytes("info: btc to the moon"),
      ),
    ).to.be.revertedWith("hashvalue/algo count mismatch");
  });

  it("timestampRecordHashes should failed if > 3", async () => {
    await expect(
      ts.timestampRecordHashes(
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
        ethers.toUtf8Bytes("info: btc to the moon"),
      ),
    ).to.be.revertedWith("hashAlgorithmIds>3");
    await expect(
      ts.timestampRecordHashes(
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
        ethers.toUtf8Bytes("info: btc to the moon"),
      ),
    ).to.be.revertedWith("hashValues>3");
    await expect(
      ts.timestampRecordHashes(
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
        ethers.toUtf8Bytes("info: btc to the moon"),
      ),
    ).to.be.revertedWith("timestampData>3");
  });

  it("timestampRecordHashes should failed for unknown hash algo", async () => {
    await expect(
      ts.timestampRecordHashes(
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
        ethers.toUtf8Bytes("info: btc to the moon"),
      ),
    ).to.be.revertedWith("hashAlgo unknown");
  });

  it("timestampRecordHashes should failed for empty value and hash", async () => {
    await expect(
      ts.timestampRecordHashes(
        [0, 1, 2],
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
        ethers.toUtf8Bytes("info: btc to the moon"),
      ),
    ).to.be.revertedWith("hashValue empty");

    // should not revert is optional params are empty
    await ts.timestampRecordHashes(
      [2, 1, 0],
      [
        ethers.toUtf8Bytes("e40605e6a26268a5eb8"),
        new Uint8Array([8]),
        ethers.toUtf8Bytes("38862f7ef56079768"),
      ],
      [],
      new Uint8Array([]),
    );
    const ids = await ts.getRecordIds(1, 10);
    expect(ids.items).to.have.length(1);
  });

  it("timestampRecordHashes should succeed with same info twice because recordId contains blocknumber", async () => {
    const hash1 = ethers.toUtf8Bytes("e40605e6");
    const hash2 = ethers.toUtf8Bytes("aa54def9");
    const hash3 = ethers.toUtf8Bytes("38862f7");

    await ts.timestampRecordHashes(
      [0, 1, 2],
      [hash1, hash2, hash3],
      [
        ethers.toUtf8Bytes("btc"),
        ethers.toUtf8Bytes("new"),
        ethers.toUtf8Bytes("ath"),
      ],
      ethers.toUtf8Bytes("info: btc to the moon"),
    );
  });

  it("timestampRecordHashes should succeed", async () => {
    const hash1 = ethers.toUtf8Bytes("e40605e6");
    const hash2 = ethers.toUtf8Bytes("aa54def9");
    const hash3 = ethers.toUtf8Bytes("38862f7");
    const tsids = [
      ethers.sha256(hash1),
      ethers.sha256(hash2),
      ethers.sha256(hash3),
    ];
    let blockNumber = await ethers.provider.getBlockNumber();
    blockNumber += 1;
    //  recordId = sha256(abi.encode(msg.sender, block.number, hashValue));
    const recordId = ethers.sha256(
      ethers.AbiCoder.defaultAbiCoder().encode(
        ["address", "uint256", "bytes"],
        [admin.address, blockNumber, hash1],
      ),
    );
    await expect(
      ts.timestampRecordHashes(
        [0, 1, 2],
        [hash1, hash2, hash3],
        [
          ethers.toUtf8Bytes("btc"),
          ethers.toUtf8Bytes("new"),
          ethers.toUtf8Bytes("ath"),
        ],
        ethers.toUtf8Bytes("info: btc to the moon"),
      ),
    )
      .to.emit(ts, "RecordedHashes")
      .withArgs(
        recordId,
        tsids,
        ethers.sha256(ethers.toUtf8Bytes("info: btc to the moon")),
      );
    const receipt = await ts.getTimestamps(1, 10);
    expect(receipt.items).to.deep.equal([
      ethers.sha256(hash1),
      ethers.sha256(hash2),
      ethers.sha256(hash3),
    ]);
    const ids = await ts.getRecordIds(1, 10);
    expect(ids.items).to.have.length(1);
    const firstTsIds = await ts.getRecordIdsByFirstVersionHash(hash2, 1, 10);
    expect(firstTsIds.items).to.deep.equal([recordId]);
  });

  it("timestampRecordHashes should succeed with empty data", async () => {
    const hash1 = ethers.toUtf8Bytes("e40605e6");
    const hash2 = ethers.toUtf8Bytes("aa54def9");
    const hash3 = ethers.toUtf8Bytes("38862f7");
    const tsids = [
      ethers.sha256(hash1),
      ethers.sha256(hash2),
      ethers.sha256(hash3),
    ];
    let blockNumber = await ethers.provider.getBlockNumber();
    blockNumber += 1;
    //  recordId = sha256(abi.encode(msg.sender, block.number, hashValue));
    const recordId = ethers.sha256(
      ethers.AbiCoder.defaultAbiCoder().encode(
        ["address", "uint256", "bytes"],
        [admin.address, blockNumber, hash1],
      ),
    );
    await expect(
      ts.timestampRecordHashes(
        [0, 1, 2],
        [hash1, hash2, hash3],
        [],
        ethers.toUtf8Bytes("info: btc to the moon"),
      ),
    )
      .to.emit(ts, "RecordedHashes")
      .withArgs(
        recordId,
        tsids,
        ethers.sha256(ethers.toUtf8Bytes("info: btc to the moon")),
      );
    const receipt = await ts.getTimestamps(1, 10);
    expect(receipt.items).to.deep.equal([
      ethers.sha256(hash1),
      ethers.sha256(hash2),
      ethers.sha256(hash3),
    ]);
    const ids = await ts.getRecordIds(1, 10);
    expect(ids.items).to.have.length(1);
    const firstTsIds = await ts.getRecordIdsByFirstVersionHash(hash2, 1, 10);
    expect(firstTsIds.items).to.deep.equal([recordId]);
  });

  it("timestampRecordVersionHashes should failed if > 3", async () => {
    await expect(
      ts.timestampRecordVersionHashes(
        ethers.sha256(ethers.toUtf8Bytes("recordId")),
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
        ethers.toUtf8Bytes("info: btc to the moon"),
      ),
    ).to.be.revertedWith("hashAlgorithmIds>3");
    await expect(
      ts.timestampRecordVersionHashes(
        ethers.sha256(ethers.toUtf8Bytes("recordId")),
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
        ethers.toUtf8Bytes("info: btc to the moon"),
      ),
    ).to.be.revertedWith("hashValues>3");
    await expect(
      ts.timestampRecordVersionHashes(
        ethers.sha256(ethers.toUtf8Bytes("recordId")),
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
        ethers.toUtf8Bytes("info: btc to the moon"),
      ),
    ).to.be.revertedWith("timestampData>3");
  });

  it("timestampRecordVersionHashes should failed for unknown hash algo", async () => {
    await expect(
      ts.timestampRecordVersionHashes(
        ethers.sha256(ethers.toUtf8Bytes("recordId")),
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
        ethers.toUtf8Bytes("info: btc to the moon"),
      ),
    ).to.be.revertedWith("hashAlgo unknown");
  });

  it("timestampRecordVersionHashes should failed if record doesn't exists", async () => {
    await expect(
      ts.timestampRecordVersionHashes(
        ethers.sha256(new Uint8Array([89])),
        [1, 2, 0],
        [
          ethers.toUtf8Bytes("e40605e6a26268a5eb8"),
          new Uint8Array([8]),
          ethers.toUtf8Bytes("38862f7ef56079768"),
        ],
        [
          ethers.toUtf8Bytes("btc"),
          ethers.toUtf8Bytes("new"),
          new Uint8Array([]),
        ],
        ethers.toUtf8Bytes("info: btc to the moon"),
      ),
    ).to.be.revertedWith("record unknown");
  });

  it("timestampRecordVersionHashes should failed for empty value and hash", async () => {
    await expect(
      ts.timestampRecordVersionHashes(
        ethers.sha256(ethers.toUtf8Bytes("recordId")),
        [0, 1, 2],
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
        ethers.toUtf8Bytes("info: btc to the moon"),
      ),
    ).to.be.revertedWith("hashValue empty");

    await expect(
      ts.timestampRecordVersionHashes(
        ethers.ZeroHash,
        [1, 2, 0],
        [
          ethers.toUtf8Bytes("e40605e6a26268a5eb8"),
          new Uint8Array([8]),
          ethers.toUtf8Bytes("38862f7ef56079768"),
        ],
        [
          ethers.toUtf8Bytes("btc"),
          ethers.toUtf8Bytes("new"),
          new Uint8Array([]),
        ],
        ethers.toUtf8Bytes("info: btc to the moon"),
      ),
    ).to.be.revertedWith("recordId empty");
    //  should not revert is optional params are empty
    const hash1 = ethers.toUtf8Bytes("e40605e6");
    const hash2 = ethers.toUtf8Bytes("aa54def9");
    const hash3 = ethers.toUtf8Bytes("38862f7");
    let blockNumber = await ethers.provider.getBlockNumber();
    blockNumber += 1;
    //  recordId = sha256(abi.encode(msg.sender, block.number, hashValue));
    const recordId = ethers.sha256(
      ethers.AbiCoder.defaultAbiCoder().encode(
        ["address", "uint256", "bytes"],
        [admin.address, blockNumber, hash1],
      ),
    );
    await ts.timestampRecordHashes(
      [0, 1, 2],
      [hash1, hash2, hash3],
      [
        ethers.toUtf8Bytes("btc"),
        ethers.toUtf8Bytes("new"),
        ethers.toUtf8Bytes("ath"),
      ],
      ethers.toUtf8Bytes("info: btc to the moon"),
    );
    const tsids = [
      ethers.sha256(ethers.toUtf8Bytes("e40605e6a26268a5eb8")),
      ethers.sha256(new Uint8Array([8])),
      ethers.sha256(ethers.toUtf8Bytes("38862f7ef56079768")),
    ];

    await expect(
      ts.timestampRecordVersionHashes(
        recordId,
        [2, 0, 1],
        [
          ethers.toUtf8Bytes("e40605e6a26268a5eb8"),
          new Uint8Array([8]),
          ethers.toUtf8Bytes("38862f7ef56079768"),
        ],
        [],
        new Uint8Array([]),
      ),
    )
      .to.emit(ts, "RecordedHashes")
      .withArgs(recordId, tsids, ethers.ZeroHash);
  });

  it("timestampRecordVersionHashes should fail for sender not owner", async () => {
    const hash1 = ethers.toUtf8Bytes("e40605e6");
    const hash2 = ethers.toUtf8Bytes("aa54def9");
    const hash3 = ethers.toUtf8Bytes("38862f7");
    let blockNumber = await ethers.provider.getBlockNumber();
    blockNumber += 1;
    //  recordId = sha256(abi.encode(msg.sender, block.number, hashValue));
    const recordId = ethers.sha256(
      ethers.AbiCoder.defaultAbiCoder().encode(
        ["address", "uint256", "bytes"],
        [admin.address, blockNumber, hash1],
      ),
    );
    await ts.timestampRecordHashes(
      [0, 1, 2],
      [hash1, hash2, hash3],
      [
        ethers.toUtf8Bytes("btc"),
        ethers.toUtf8Bytes("new"),
        ethers.toUtf8Bytes("ath"),
      ],
      ethers.toUtf8Bytes("info: btc to the moon"),
    );
    const hash1prime = ethers.toUtf8Bytes("othere40605e6");
    const hash2prime = ethers.toUtf8Bytes("again40605e6");
    const hash3prime = ethers.toUtf8Bytes("new40605e6");
    const tsUser = ts.connect(user);
    const versionInfoprime = ethers.toUtf8Bytes("new infon");
    await expect(
      tsUser.timestampRecordVersionHashes(
        recordId,
        [2, 0, 1],
        [hash1prime, hash2prime, hash3prime],
        [
          ethers.toUtf8Bytes("oneprime"),
          ethers.toUtf8Bytes("twoprime"),
          ethers.toUtf8Bytes("threeprime"),
        ],
        versionInfoprime,
      ),
    ).to.be.revertedWith("sender is not listed as owner");
  });

  it("timestampRecordVersionHashes should succeed", async () => {
    const hash1 = ethers.toUtf8Bytes("e40605e6");
    const hash2 = ethers.toUtf8Bytes("aa54def9");
    const hash3 = ethers.toUtf8Bytes("38862f7");
    const hashValues = [hash1, hash2, hash3];
    let blockNumber = await ethers.provider.getBlockNumber();
    blockNumber += 1;
    //  recordId = sha256(abi.encode(msg.sender, block.number, hashValue));
    const recordId = ethers.sha256(
      ethers.AbiCoder.defaultAbiCoder().encode(
        ["address", "uint256", "bytes"],
        [admin.address, blockNumber, hash1],
      ),
    );
    await ts.timestampRecordHashes(
      [0, 1, 2],
      [hash1, hash2, hash3],
      [
        ethers.toUtf8Bytes("btc"),
        ethers.toUtf8Bytes("new"),
        ethers.toUtf8Bytes("ath"),
      ],
      ethers.toUtf8Bytes("info: btc to the moon"),
    );

    const hash1prime = ethers.toUtf8Bytes("othere40605e6");
    const hash2prime = ethers.toUtf8Bytes("again40605e6");
    const hash3prime = ethers.toUtf8Bytes("new40605e6");
    const hashPrimeValues = [hash1prime, hash2prime, hash3prime];
    const tsids = [
      ethers.sha256(hash1prime),
      ethers.sha256(hash2prime),
      ethers.sha256(hash3prime),
    ];
    const versionInfoprime = ethers.toUtf8Bytes("new infon");
    await expect(
      ts.timestampRecordVersionHashes(
        recordId,
        [2, 0, 1],
        [hash1prime, hash2prime, hash3prime],
        [
          ethers.toUtf8Bytes("oneprime"),
          ethers.toUtf8Bytes("twoprime"),
          ethers.toUtf8Bytes("threeprime"),
        ],
        versionInfoprime,
      ),
    )
      .to.emit(ts, "RecordedHashes")
      .withArgs(recordId, tsids, ethers.sha256(versionInfoprime));

    const receipt = await ts.getTimestamps(1, 10);
    expect(receipt.items).to.deep.equal([
      ethers.sha256(hash1),
      ethers.sha256(hash2),
      ethers.sha256(hash3),
      ethers.sha256(hash1prime),
      ethers.sha256(hash2prime),
      ethers.sha256(hash3prime),
    ]);
    // check that two versions exists
    const vd0 = await ts.getRecordVersion(recordId, 0, 1, 10);
    expect(vd0.hashAlgorithmIds).to.have.length(3);
    expect(vd0.hashAlgorithmIds[0]).to.equal(0);
    expect(vd0.hashAlgorithmIds[1]).to.equal(1);
    expect(vd0.hashAlgorithmIds[2]).to.equal(2);
    expect(vd0.hashValues).to.have.length(3);

    for (const [id, el] of vd0.hashValues.entries()) {
      expect(el).to.equal(ethers.hexlify(hashValues[id]));
    }

    // expect(vd0.hashValues).to.equal([hash1, hash2, hash3]);
    expect(vd0.infoIds).to.have.length(1);
    expect(vd0.infoIds[0]).to.equal(
      ethers.sha256(ethers.toUtf8Bytes("info: btc to the moon")),
    );
    expect(vd0.total).to.equal(3);
    expect(vd0.howMany).to.equal(3);
    expect(vd0.prev).to.equal(1);
    expect(vd0.next).to.equal(1);

    const vd1 = await ts.getRecordVersion(recordId, 1, 1, 10);
    expect(vd1.hashAlgorithmIds).to.have.length(3);
    expect(vd1.hashAlgorithmIds[0]).to.equal(2);
    expect(vd1.hashAlgorithmIds[1]).to.equal(0);
    expect(vd1.hashAlgorithmIds[2]).to.equal(1);
    expect(vd1.hashValues).to.have.length(3);

    for (const [id, el] of vd1.hashValues.entries()) {
      expect(el).to.equal(ethers.hexlify(hashPrimeValues[id]));
    }

    // expect(vd0.hashValues).to.equal([hash1, hash2, hash3]);
    expect(vd1.infoIds).to.have.length(1);
    expect(vd1.infoIds[0]).to.equal(ethers.sha256(versionInfoprime));
    expect(vd1.total).to.equal(3);
    expect(vd1.howMany).to.equal(3);
    expect(vd1.prev).to.equal(1);
    expect(vd1.next).to.equal(1);
  });

  it("timestampRecordVersionHashes should succeed with empty data", async () => {
    const hash1 = ethers.toUtf8Bytes("e40605e6");
    const hash2 = ethers.toUtf8Bytes("aa54def9");
    const hash3 = ethers.toUtf8Bytes("38862f7");
    const hashValues = [hash1, hash2, hash3];
    let blockNumber = await ethers.provider.getBlockNumber();
    blockNumber += 1;
    //  recordId = sha256(abi.encode(msg.sender, block.number, hashValue));
    const recordId = ethers.sha256(
      ethers.AbiCoder.defaultAbiCoder().encode(
        ["address", "uint256", "bytes"],
        [admin.address, blockNumber, hash1],
      ),
    );
    await ts.timestampRecordHashes(
      [0, 1, 2],
      [hash1, hash2, hash3],
      [],
      ethers.toUtf8Bytes("info: btc to the moon"),
    );

    const hash1prime = ethers.toUtf8Bytes("othere40605e6");
    const hash2prime = ethers.toUtf8Bytes("again40605e6");
    const hash3prime = ethers.toUtf8Bytes("new40605e6");
    const hashPrimeValues = [hash1prime, hash2prime, hash3prime];
    const tsids = [
      ethers.sha256(hash1prime),
      ethers.sha256(hash2prime),
      ethers.sha256(hash3prime),
    ];
    const versionInfoprime = ethers.toUtf8Bytes("new infon");
    await expect(
      ts.timestampRecordVersionHashes(
        recordId,
        [2, 0, 1],
        [hash1prime, hash2prime, hash3prime],
        [],
        versionInfoprime,
      ),
    )
      .to.emit(ts, "RecordedHashes")
      .withArgs(recordId, tsids, ethers.sha256(versionInfoprime));

    const receipt = await ts.getTimestamps(1, 10);
    expect(receipt.items).to.deep.equal([
      ethers.sha256(hash1),
      ethers.sha256(hash2),
      ethers.sha256(hash3),
      ethers.sha256(hash1prime),
      ethers.sha256(hash2prime),
      ethers.sha256(hash3prime),
    ]);
    // check that two versions exists
    const vd0 = await ts.getRecordVersion(recordId, 0, 1, 10);
    expect(vd0.hashAlgorithmIds).to.have.length(3);
    expect(vd0.hashAlgorithmIds[0]).to.equal(0);
    expect(vd0.hashAlgorithmIds[1]).to.equal(1);
    expect(vd0.hashAlgorithmIds[2]).to.equal(2);
    expect(vd0.hashValues).to.have.length(3);

    for (const [id, el] of vd0.hashValues.entries()) {
      expect(el).to.equal(ethers.hexlify(hashValues[id]));
    }

    // expect(vd0.hashValues).to.equal([hash1, hash2, hash3]);
    expect(vd0.infoIds).to.have.length(1);
    expect(vd0.infoIds[0]).to.equal(
      ethers.sha256(ethers.toUtf8Bytes("info: btc to the moon")),
    );
    expect(vd0.total).to.equal(3);
    expect(vd0.howMany).to.equal(3);
    expect(vd0.prev).to.equal(1);
    expect(vd0.next).to.equal(1);

    const vd1 = await ts.getRecordVersion(recordId, 1, 1, 10);
    expect(vd1.hashAlgorithmIds).to.have.length(3);
    expect(vd1.hashAlgorithmIds[0]).to.equal(2);
    expect(vd1.hashAlgorithmIds[1]).to.equal(0);
    expect(vd1.hashAlgorithmIds[2]).to.equal(1);
    expect(vd1.hashValues).to.have.length(3);

    for (const [id, el] of vd1.hashValues.entries()) {
      expect(el).to.equal(ethers.hexlify(hashPrimeValues[id]));
    }

    // expect(vd0.hashValues).to.equal([hash1, hash2, hash3]);
    expect(vd1.infoIds).to.have.length(1);
    expect(vd1.infoIds[0]).to.equal(ethers.sha256(versionInfoprime));
    expect(vd1.total).to.equal(3);
    expect(vd1.howMany).to.equal(3);
    expect(vd1.prev).to.equal(1);
    expect(vd1.next).to.equal(1);
  });

  it("getRecord should failed with wrong recordId", async () => {
    const hash1 = ethers.toUtf8Bytes("e40605e6");

    // pagesize = 0 should revert
    await expect(ts.getRecord(ethers.ZeroHash)).to.be.revertedWith(
      "recordId empty",
    );
    // page  = 0 should revert
    await expect(ts.getRecord(ethers.sha256(hash1))).to.be.revertedWith(
      "record unknown",
    );
  });

  it("getRecord should succeed", async () => {
    const hash1Value = ethers.toUtf8Bytes(`value-1`);
    const hash2Value = ethers.toUtf8Bytes(`value-2`);
    const hash3Value = ethers.toUtf8Bytes(`value-3`);
    let blockNumber = await ethers.provider.getBlockNumber();
    blockNumber += 1;
    //  recordId = sha256(abi.encode(msg.sender, block.number, hashValue));
    const recordId = ethers.sha256(
      ethers.AbiCoder.defaultAbiCoder().encode(
        ["address", "uint256", "bytes"],
        [admin.address, blockNumber, hash1Value],
      ),
    );
    // INSERT SHOULD BE DONE IN ORDER !!!
    await ts.timestampRecordHashes(
      [0, 1, 2],
      [hash1Value, hash2Value, hash3Value],
      [
        ethers.toUtf8Bytes("btc"),
        ethers.toUtf8Bytes("new"),
        ethers.toUtf8Bytes("ath"),
      ],
      ethers.toUtf8Bytes("info: btc to the moon"),
    );

    const r0 = await ts.getRecord(recordId);
    expect(r0.ownerIds).to.have.length(1);
    expect(r0.revokedOwnerIds).to.deep.equal([]);
    expect(r0.totalVersions).to.equal(1);

    // add version
    const hash1prime = ethers.toUtf8Bytes("othere40605e6");
    const hash2prime = ethers.toUtf8Bytes("again40605e6");
    const hash3prime = ethers.toUtf8Bytes("new40605e6");
    const tsids = [
      ethers.sha256(hash1prime),
      ethers.sha256(hash2prime),
      ethers.sha256(hash3prime),
    ];
    const versionInfoprime = ethers.toUtf8Bytes("new infon");
    await expect(
      ts.timestampRecordVersionHashes(
        recordId,
        [2, 0, 1],
        [hash1prime, hash2prime, hash3prime],
        [
          ethers.toUtf8Bytes("oneprime"),
          ethers.toUtf8Bytes("twoprime"),
          ethers.toUtf8Bytes("threeprime"),
        ],
        versionInfoprime,
      ),
    )
      .to.emit(ts, "RecordedHashes")
      .withArgs(recordId, tsids, ethers.sha256(versionInfoprime));
    const r1 = await ts.getRecord(recordId);
    expect(r1.ownerIds).to.deep.equal([admin.address.toLowerCase()]);
    expect(r1.revokedOwnerIds).to.deep.equal([]);
    expect(r1.totalVersions).to.equal(2);
    /// add ownerdIds and revoke some
    const notBefore = Date.now();
    const notAfter = notBefore + 1_000_000;
    await ts.insertRecordOwner(recordId, "anotherownerId", notBefore, notAfter);
    const r2 = await ts.getRecord(recordId);
    expect(r2.ownerIds).to.deep.equal([
      admin.address.toLowerCase(),
      "anotherownerId",
    ]);
    expect(r2.revokedOwnerIds).to.deep.equal([]);
    expect(r2.totalVersions).to.equal(2);
    await ts.revokeRecordOwner(recordId, "anotherownerId");
    const r3 = await ts.getRecord(recordId);
    expect(r3.ownerIds).to.deep.equal([admin.address.toLowerCase()]);
    expect(r3.revokedOwnerIds).to.deep.equal(["anotherownerId"]);
    expect(r2.totalVersions).to.equal(2);
  });

  it("getRecordIds should failed with wrong page and pageSize", async () => {
    const hash1 = ethers.toUtf8Bytes("e40605e6");
    const hash2 = ethers.toUtf8Bytes("aa54def9");
    const hash3 = ethers.toUtf8Bytes("38862f7");
    await ts.timestampRecordHashes(
      [0, 1, 2],
      [hash1, hash2, hash3],
      [
        ethers.toUtf8Bytes("btc"),
        ethers.toUtf8Bytes("new"),
        ethers.toUtf8Bytes("ath"),
      ],
      ethers.toUtf8Bytes("info: btc to the moon"),
    );
    // pagesize = 0 should revert
    await expect(ts.getRecordIds(1, 0)).to.be.revertedWith("PSize not >0");
    // page  = 0 should revert
    await expect(ts.getRecordIds(0, 10)).to.be.revertedWith("Page not >0");

    // pagesize > 50 should revert
    await expect(ts.getRecordIds(1, 51)).to.be.revertedWith("PSize not <= 50");
  });

  it("getRecordIds should succeed", async () => {
    const recIds: string[] = [];
    for (let i = 1; i < 12; i += 1) {
      const hash1Value = ethers.toUtf8Bytes(`value-1-${i}`);
      const hash2Value = ethers.toUtf8Bytes(`value-2-${i}`);
      const hash3Value = ethers.toUtf8Bytes(`value-3-${i}`);

      let blockNumber = await ethers.provider.getBlockNumber();
      blockNumber += 1;
      //  recordId = sha256(abi.encode(msg.sender, block.number, hashValue));
      const recordId = ethers.sha256(
        ethers.AbiCoder.defaultAbiCoder().encode(
          ["address", "uint256", "bytes"],
          [admin.address, blockNumber, hash1Value],
        ),
      );
      // INSERT SHOULD BE DONE IN ORDER !!!

      await ts.timestampRecordHashes(
        [0, 1, 2],
        [hash1Value, hash2Value, hash3Value],
        [
          ethers.toUtf8Bytes("btc"),
          ethers.toUtf8Bytes("new"),
          ethers.toUtf8Bytes("ath"),
        ],
        ethers.toUtf8Bytes("info: btc to the moon"),
      );
      recIds.push(recordId);
    }

    const r0 = await ts.getRecordIds(1, 1);
    expect(r0.items).to.have.length(1);

    for (const [id, el] of r0.items.entries()) {
      expect(el).to.equal(recIds.slice(0, 1)[id]);
    }

    expect(r0.total).to.equal(11);
    expect(r0.howMany).to.equal(1);
    expect(r0.prev).to.equal(1);
    expect(r0.next).to.equal(2);

    const r = await ts.getRecordIds(1, 11);
    expect(r.items).to.have.length(11);

    for (const [id, el] of r.items.entries()) {
      expect(el).to.equal(recIds[id]);
    }

    expect(r.total).to.equal(11);
    expect(r.howMany).to.equal(11);
    expect(r.prev).to.equal(1);
    expect(r.next).to.equal(1);

    const r1 = await ts.getRecordIds(5, 11);
    expect(r1.items).to.have.length(0);
    expect(r1.total).to.equal(11);
    expect(r1.howMany).to.equal(0);
    expect(r1.prev).to.equal(1);
    expect(r1.next).to.equal(1);
  });

  it("getRecordIdsByFirstVersionHash should failed with wrong hash, page and pageSize", async () => {
    const hash1 = ethers.toUtf8Bytes("e40605e6");
    const hash2 = ethers.toUtf8Bytes("aa54def9");
    const hash3 = ethers.toUtf8Bytes("38862f7");
    await ts.timestampRecordHashes(
      [0, 1, 2],
      [hash1, hash2, hash3],
      [
        ethers.toUtf8Bytes("btc"),
        ethers.toUtf8Bytes("new"),
        ethers.toUtf8Bytes("ath"),
      ],
      ethers.toUtf8Bytes("info: btc to the moon"),
    );
    // pagesize = 0 should revert
    await expect(
      ts.getRecordIdsByFirstVersionHash(hash1, 1, 0),
    ).to.be.revertedWith("PSize not >0");
    // page  = 0 should revert
    await expect(
      ts.getRecordIdsByFirstVersionHash(hash1, 0, 10),
    ).to.be.revertedWith("Page not >0");

    // pagesize > 50 should revert
    await expect(
      ts.getRecordIdsByFirstVersionHash(hash1, 1, 51),
    ).to.be.revertedWith("PSize not <= 50");
    // hash empty
    await expect(
      ts.getRecordIdsByFirstVersionHash(new Uint8Array([]), 1, 51),
    ).to.be.revertedWith("hashValue empty");
  });

  it("getRecordIdsByFirstVersionHash should succeed", async () => {
    const hash1 = ethers.toUtf8Bytes("e40605e6");
    const hash2 = ethers.toUtf8Bytes("aa54def9");
    const hash3 = ethers.toUtf8Bytes("38862f7");
    let blockNumber = await ethers.provider.getBlockNumber();
    blockNumber += 1;
    //  recordId = sha256(abi.encode(msg.sender, block.number, hashValue));
    const recordId = ethers.sha256(
      ethers.AbiCoder.defaultAbiCoder().encode(
        ["address", "uint256", "bytes"],
        [admin.address, blockNumber, hash1],
      ),
    );

    await ts.timestampRecordHashes(
      [0, 1, 2],
      [hash1, hash2, hash3],
      [
        ethers.toUtf8Bytes("btc"),
        ethers.toUtf8Bytes("new"),
        ethers.toUtf8Bytes("ath"),
      ],
      ethers.toUtf8Bytes("info: btc to the moon"),
    );

    const firstTsIds = await ts.getRecordIdsByFirstVersionHash(hash2, 1, 10);
    expect(firstTsIds.items).to.deep.equal([recordId]);
    expect(firstTsIds.total).to.equal(1);
    expect(firstTsIds.howMany).to.equal(1);
    expect(firstTsIds.prev).to.equal(1);
    expect(firstTsIds.next).to.equal(1);
    blockNumber = await ethers.provider.getBlockNumber();
    blockNumber += 1;
    //  recordId = sha256(abi.encode(msg.sender, block.number, hashValue));
    const recordId2 = ethers.sha256(
      ethers.AbiCoder.defaultAbiCoder().encode(
        ["address", "uint256", "bytes"],
        [admin.address, blockNumber, hash2],
      ),
    );

    await ts.timestampRecordHashes(
      [1, 2],
      [hash2, hash3],
      [ethers.toUtf8Bytes("yolo")],
      new Uint8Array([]),
    );

    const firstTsIds2 = await ts.getRecordIdsByFirstVersionHash(hash2, 1, 10);
    expect(firstTsIds2.items).to.deep.equal([recordId, recordId2]);
    expect(firstTsIds2.total).to.equal(2);
    expect(firstTsIds2.howMany).to.equal(2);
    expect(firstTsIds2.prev).to.equal(1);
    expect(firstTsIds2.next).to.equal(1);
  });

  it("getRecordVersion should succeed", async () => {
    const hash1 = ethers.toUtf8Bytes("e40605e6");
    const hash2 = ethers.toUtf8Bytes("aa54def9");
    const hash3 = ethers.toUtf8Bytes("38862f7");
    const hashvalues = [hash1, hash2, hash3];
    let blockNumber = await ethers.provider.getBlockNumber();
    blockNumber += 1;
    //  recordId = sha256(abi.encode(msg.sender, block.number, hashValue));
    const recordId = ethers.sha256(
      ethers.AbiCoder.defaultAbiCoder().encode(
        ["address", "uint256", "bytes"],
        [admin.address, blockNumber, hash1],
      ),
    );

    await ts.timestampRecordHashes(
      [0, 1, 2],
      hashvalues,
      [
        ethers.toUtf8Bytes("btc"),
        ethers.toUtf8Bytes("new"),
        ethers.toUtf8Bytes("ath"),
      ],
      ethers.toUtf8Bytes("info: btc to the moon"),
    );

    const hash1prime = ethers.toUtf8Bytes("e40605e6prime");
    const hash2prime = ethers.toUtf8Bytes("aa54def9prime");
    const hashvaluesprime = [hash1prime, hash2prime];
    const tsids = [ethers.sha256(hash1prime), ethers.sha256(hash2prime)];
    const timestampData = [
      ethers.toUtf8Bytes("btcprime"),
      ethers.toUtf8Bytes("new prime"),
    ].map((d) => `0x${Buffer.from(d).toString("hex")}`);
    await expect(
      ts.timestampVersionHashes(
        hash1,
        [2, 0],
        hashvaluesprime,
        timestampData,
        new Uint8Array([]),
      ),
    )
      .to.emit(ts, "TimestampedHashes")
      .withArgs(
        tsids,
        [2, 0],
        [ethers.hexlify(hash1prime), ethers.hexlify(hash2prime)],
        timestampData,
      );

    const receipt = await ts.getTimestamps(1, 10);
    expect(receipt.items).to.deep.equal([
      ethers.sha256(hash1),
      ethers.sha256(hash2),
      ethers.sha256(hash3),
      ethers.sha256(hash1prime),
      ethers.sha256(hash2prime),
    ]);

    const ids = await ts.getRecordIds(1, 10);
    expect(ids.items).to.have.length(1);
    expect(ids.items[0]).to.equal(recordId);

    const vd0 = await ts.getRecordVersion(recordId, 0, 1, 10);
    expect(vd0.hashAlgorithmIds).to.have.length(3);
    expect(vd0.hashAlgorithmIds[0]).to.equal(0);
    expect(vd0.hashAlgorithmIds[1]).to.equal(1);
    expect(vd0.hashAlgorithmIds[2]).to.equal(2);
    expect(vd0.hashValues).to.have.length(3);

    for (const [id, el] of vd0.hashValues.entries()) {
      expect(el).to.equal(ethers.hexlify(hashvalues[id]));
    }

    // expect(vd0.hashValues).to.equal([hash1, hash2, hash3]);
    expect(vd0.infoIds).to.have.length(1);
    expect(vd0.infoIds[0]).to.equal(
      ethers.sha256(ethers.toUtf8Bytes("info: btc to the moon")),
    );
    expect(vd0.total).to.equal(3);
    expect(vd0.howMany).to.equal(3);
    expect(vd0.prev).to.equal(1);
    expect(vd0.next).to.equal(1);

    const vd1 = await ts.getRecordVersion(recordId, 1, 1, 10);
    expect(vd1.hashAlgorithmIds).to.have.length(2);
    expect(vd1.hashAlgorithmIds[0]).to.equal(2);
    expect(vd1.hashAlgorithmIds[1]).to.equal(0);
    expect(vd1.hashValues).to.have.length(2);

    for (const [id, el] of vd1.hashValues.entries()) {
      expect(el).to.equal(ethers.hexlify(hashvaluesprime[id]));
    }

    expect(vd1.infoIds).to.have.length(0);
    expect(vd1.total).to.equal(2);
    expect(vd1.howMany).to.equal(2);
    expect(vd1.prev).to.equal(1);
    expect(vd1.next).to.equal(1);
  });

  it("getRecordVersion should failed with wrong recordId, page or pageSize", async () => {
    const hash1 = ethers.toUtf8Bytes("e40605e6");
    const hash2 = ethers.toUtf8Bytes("aa54def9");
    const hash3 = ethers.toUtf8Bytes("38862f7");
    let blockNumber = await ethers.provider.getBlockNumber();
    blockNumber += 1;
    //  recordId = sha256(abi.encode(msg.sender, block.number, hashValue));
    const recordId = ethers.sha256(
      ethers.AbiCoder.defaultAbiCoder().encode(
        ["address", "uint256", "bytes"],
        [admin.address, blockNumber, hash1],
      ),
    );
    await ts.timestampRecordHashes(
      [0, 1, 2],
      [hash1, hash2, hash3],
      [
        ethers.toUtf8Bytes("btc"),
        ethers.toUtf8Bytes("new"),
        ethers.toUtf8Bytes("ath"),
      ],
      ethers.toUtf8Bytes("info: btc to the moon"),
    );
    // pagesize = 0 should revert
    await expect(
      ts.getRecordVersion(ethers.ZeroHash, 0, 1, 0),
    ).to.be.revertedWith("recordId empty");
    // pagesize = 0 should revert
    await expect(ts.getRecordVersion(recordId, 0, 1, 0)).to.be.revertedWith(
      "PSize not >0",
    );
    // page  = 0 should revert
    await expect(ts.getRecordVersion(recordId, 0, 0, 10)).to.be.revertedWith(
      "Page not >0",
    );

    // pagesize > 50 should revert
    await expect(ts.getRecordVersion(recordId, 0, 1, 51)).to.be.revertedWith(
      "PSize not <= 50",
    );
  });

  it("getRecordVersionInfo should failed with empty versionInfoId", async () => {
    //  should revert
    await expect(ts.getRecordVersionInfo(ethers.ZeroHash)).to.be.revertedWith(
      "versionInfoId empty",
    );
  });

  it("getRecordVersionInfo should succeed", async () => {
    const hash1 = ethers.toUtf8Bytes("e40605e6");
    const hash2 = ethers.toUtf8Bytes("aa54def9");
    const hash3 = ethers.toUtf8Bytes("38862f7");
    const hashvalues = [hash1, hash2, hash3];

    const versionInfo = ethers.toUtf8Bytes("info: btc to the moon");
    await ts.timestampRecordHashes(
      [0, 1, 2],
      hashvalues,
      [
        ethers.toUtf8Bytes("btc"),
        ethers.toUtf8Bytes("new"),
        ethers.toUtf8Bytes("ath"),
      ],
      versionInfo,
    );

    const info = await ts.getRecordVersionInfo(ethers.sha256(versionInfo));
    expect(info).to.equal(ethers.hexlify(versionInfo));

    const hash1prime = ethers.toUtf8Bytes("e40605e6prime");
    const hash2prime = ethers.toUtf8Bytes("aa54def9prime");
    const hashvaluesprime = [hash1prime, hash2prime];

    const versionInfoprime = ethers.toUtf8Bytes("PRIME info: btc to the moon");

    await ts.timestampVersionHashes(
      hash1,
      [2, 0],
      hashvaluesprime,
      [ethers.toUtf8Bytes("btcprime"), ethers.toUtf8Bytes("new prime")],
      versionInfoprime,
    );

    const infoPrime = await ts.getRecordVersionInfo(
      ethers.sha256(versionInfoprime),
    );
    expect(infoPrime).to.equal(ethers.hexlify(versionInfoprime));
  });

  it("appendRecordVersionHashes should failed with empty recordId", async () => {
    //  should revert
    const hash1 = ethers.toUtf8Bytes("e40605e6");

    await expect(
      ts.appendRecordVersionHashes(
        ethers.ZeroHash,
        0,
        [2],
        [hash1],
        [ethers.toUtf8Bytes("btcprime"), ethers.toUtf8Bytes("new prime")],
        new Uint8Array([]),
      ),
    ).to.be.revertedWith("recordId empty");
  });

  it("appendRecordVersionHashes should failed for unknown recordId or versionId", async () => {
    //  should revert
    const hash1 = ethers.toUtf8Bytes("e40605e6");
    await expect(
      ts.appendRecordVersionHashes(
        ethers.sha256(hash1),
        0,
        [0],
        [hash1],
        [ethers.toUtf8Bytes("btcprime"), ethers.toUtf8Bytes("new prime")],
        new Uint8Array([]),
      ),
    ).to.be.revertedWith("record/version unknown");

    let blockNumber = await ethers.provider.getBlockNumber();
    blockNumber += 1;
    //  recordId = sha256(abi.encode(msg.sender, block.number, hashValue));
    const recordId = ethers.sha256(
      ethers.AbiCoder.defaultAbiCoder().encode(
        ["address", "uint256", "bytes"],
        [admin.address, blockNumber, hash1],
      ),
    );

    await ts.timestampRecordHashes(
      [0],
      [hash1],
      [ethers.toUtf8Bytes("btc")],
      ethers.toUtf8Bytes("info: btc to the moon"),
    );
    // version  does not exist should revert
    await expect(
      ts.appendRecordVersionHashes(
        recordId,
        1,
        [0],
        [hash1],
        [ethers.toUtf8Bytes("second one")],
        new Uint8Array([]),
      ),
    ).to.be.revertedWith("record/version unknown");
  });

  it("should reject more than 10 records per timestamp", async () => {
    const hash1 = randomHash();
    // create 10 records sharing the same hash
    for (let i = 0; i < 10; i += 1) {
      await ts.timestampRecordHashes(
        [0, 1],
        [randomHash(), hash1],
        [],
        ethers.toUtf8Bytes("info"),
      );
    }
    // the 11th record should be rejected
    await expect(
      ts.timestampRecordHashes(
        [0, 1],
        [randomHash(), hash1],
        [],
        ethers.toUtf8Bytes("info"),
      ),
    ).to.be.revertedWith("limit of records per timestamp exceeded");
  });

  it("should reject more than 10 timestamps per version in a record", async () => {
    const hash1 = randomHash();

    let blockNumber = await ethers.provider.getBlockNumber();
    blockNumber += 1;
    const recordId = ethers.sha256(
      ethers.AbiCoder.defaultAbiCoder().encode(
        ["address", "uint256", "bytes"],
        [admin.address, blockNumber, hash1],
      ),
    );

    // create record
    await ts.timestampRecordHashes(
      [0],
      [hash1],
      [],
      ethers.toUtf8Bytes("info"),
    );

    // append new timestamps to the first version of that record
    for (let i = 0; i < 9; i += 1) {
      await ts.appendRecordVersionHashes(
        recordId,
        0,
        [0],
        [randomHash()],
        [],
        new Uint8Array([]),
      );
    }

    // the 11th timestamp should be rejected
    await expect(
      ts.appendRecordVersionHashes(
        recordId,
        0,
        [0],
        [randomHash()],
        [],
        new Uint8Array([]),
      ),
    ).to.be.revertedWith("limit of timestamps per version exceeded");
  });

  it("should reject 2 timestamps with different hash algorithms", async () => {
    const hash1 = ethers.toUtf8Bytes("e40605e6");
    await ts.timestampRecordHashes(
      [0],
      [hash1],
      [ethers.toUtf8Bytes("btc")],
      ethers.toUtf8Bytes("info: btc to the moon"),
    );

    await expect(ts.timestampHashes([1], [hash1], [])).to.be.revertedWith(
      "timestamp with different hashAlgo",
    );
  });

  it("appendRecordVersionHashes should fail for sender not owner", async () => {
    const hash1 = ethers.toUtf8Bytes("e40605e6");
    const hash2 = ethers.toUtf8Bytes("aa54def9");
    const hash3 = ethers.toUtf8Bytes("38862f7");
    const hashvalues = [hash1, hash2, hash3];
    let blockNumber = await ethers.provider.getBlockNumber();
    blockNumber += 1;
    //  recordId = sha256(abi.encode(msg.sender, block.number, hashValue));
    const recordId = ethers.sha256(
      ethers.AbiCoder.defaultAbiCoder().encode(
        ["address", "uint256", "bytes"],
        [admin.address, blockNumber, hash1],
      ),
    );

    await ts.timestampRecordHashes(
      [0, 1, 2],
      hashvalues,
      [
        ethers.toUtf8Bytes("btc"),
        ethers.toUtf8Bytes("new"),
        ethers.toUtf8Bytes("ath"),
      ],
      ethers.toUtf8Bytes("info: btc to the moon"),
    );

    const hash1prime = ethers.toUtf8Bytes("e40605e6prime");
    const hash2prime = ethers.toUtf8Bytes("aa54def9prime");
    const hashvaluesprime = [hash1prime, hash2prime];
    const versionInfoprime = ethers.toUtf8Bytes("new info");
    const tsUser = ts.connect(user);
    await expect(
      tsUser.appendRecordVersionHashes(
        recordId,
        0,
        [2, 0],
        hashvaluesprime,
        [ethers.toUtf8Bytes("btcprime"), ethers.toUtf8Bytes("new prime")],
        versionInfoprime,
      ),
    ).to.be.revertedWith("sender is not listed as owner");
  });

  it("appendRecordVersionHashes should succeed", async () => {
    const hash1 = ethers.toUtf8Bytes("e40605e6");
    const hash2 = ethers.toUtf8Bytes("aa54def9");
    const hash3 = ethers.toUtf8Bytes("38862f7");
    let hashvalues = [hash1, hash2, hash3];
    let blockNumber = await ethers.provider.getBlockNumber();
    blockNumber += 1;
    //  recordId = sha256(abi.encode(msg.sender, block.number, hashValue));
    const recordId = ethers.sha256(
      ethers.AbiCoder.defaultAbiCoder().encode(
        ["address", "uint256", "bytes"],
        [admin.address, blockNumber, hash1],
      ),
    );

    await ts.timestampRecordHashes(
      [0, 1, 2],
      hashvalues,
      [
        ethers.toUtf8Bytes("btc"),
        ethers.toUtf8Bytes("new"),
        ethers.toUtf8Bytes("ath"),
      ],
      ethers.toUtf8Bytes("info: btc to the moon"),
    );

    const hash1prime = ethers.toUtf8Bytes("e40605e6prime");
    const hash2prime = ethers.toUtf8Bytes("aa54def9prime");
    const hashvaluesprime = [hash1prime, hash2prime];
    const tsids = [ethers.sha256(hash1prime), ethers.sha256(hash2prime)];
    const versionInfoprime = ethers.toUtf8Bytes("new info");
    await expect(
      ts.appendRecordVersionHashes(
        recordId,
        0,
        [2, 0],
        hashvaluesprime,
        [ethers.toUtf8Bytes("btcprime"), ethers.toUtf8Bytes("new prime")],
        versionInfoprime,
      ),
    )
      .to.emit(ts, "RecordedHashes")
      .withArgs(recordId, tsids, ethers.sha256(versionInfoprime));
    hashvalues = [...hashvalues, ...hashvaluesprime];
    const receipt = await ts.getTimestamps(1, 10);
    expect(receipt.items).to.deep.equal([
      ethers.sha256(hash1),
      ethers.sha256(hash2),
      ethers.sha256(hash3),
      ethers.sha256(hash1prime),
      ethers.sha256(hash2prime),
    ]);

    const ids = await ts.getRecordIds(1, 10);
    expect(ids.items).to.have.length(1);
    expect(ids.items[0]).to.equal(recordId);

    const vd0 = await ts.getRecordVersion(recordId, 0, 1, 10);
    expect(vd0.hashAlgorithmIds).to.have.length(5);
    expect(vd0.hashAlgorithmIds[0]).to.equal(0);
    expect(vd0.hashAlgorithmIds[1]).to.equal(1);
    expect(vd0.hashAlgorithmIds[2]).to.equal(2);
    expect(vd0.hashAlgorithmIds[3]).to.equal(2);
    expect(vd0.hashAlgorithmIds[4]).to.equal(0);
    expect(vd0.hashValues).to.have.length(5);

    for (const [id, el] of vd0.hashValues.entries()) {
      expect(el).to.equal(ethers.hexlify(hashvalues[id]));
    }

    expect(vd0.infoIds).to.have.length(2);
    expect(vd0.infoIds[0]).to.equal(
      ethers.sha256(ethers.toUtf8Bytes("info: btc to the moon")),
    );
    expect(vd0.infoIds[1]).to.equal(ethers.sha256(versionInfoprime));
    expect(vd0.total).to.equal(5);
    expect(vd0.howMany).to.equal(5);
    expect(vd0.prev).to.equal(1);
    expect(vd0.next).to.equal(1);

    const vd1 = await ts.getRecordVersion(recordId, 1, 1, 10);
    expect(vd1.hashAlgorithmIds).to.have.length(0);
    expect(vd1.hashValues).to.have.length(0);
    expect(vd1.infoIds).to.have.length(0);
    expect(vd1.total).to.equal(0);
    expect(vd1.howMany).to.equal(0);
  });

  it("appendRecordVersionHashes should succeed with empty data", async () => {
    const hash1 = ethers.toUtf8Bytes("e40605e6");
    const hash2 = ethers.toUtf8Bytes("aa54def9");
    const hash3 = ethers.toUtf8Bytes("38862f7");
    let hashvalues = [hash1, hash2, hash3];
    let blockNumber = await ethers.provider.getBlockNumber();
    blockNumber += 1;
    //  recordId = sha256(abi.encode(msg.sender, block.number, hashValue));
    const recordId = ethers.sha256(
      ethers.AbiCoder.defaultAbiCoder().encode(
        ["address", "uint256", "bytes"],
        [admin.address, blockNumber, hash1],
      ),
    );

    await ts.timestampRecordHashes(
      [0, 1, 2],
      hashvalues,
      [],
      ethers.toUtf8Bytes("info: btc to the moon"),
    );

    const hash1prime = ethers.toUtf8Bytes("e40605e6prime");
    const hash2prime = ethers.toUtf8Bytes("aa54def9prime");
    const hashvaluesprime = [hash1prime, hash2prime];
    const tsids = [ethers.sha256(hash1prime), ethers.sha256(hash2prime)];
    const versionInfoprime = ethers.toUtf8Bytes("new info");
    await expect(
      ts.appendRecordVersionHashes(
        recordId,
        0,
        [2, 0],
        hashvaluesprime,
        [],
        versionInfoprime,
      ),
    )
      .to.emit(ts, "RecordedHashes")
      .withArgs(recordId, tsids, ethers.sha256(versionInfoprime));
    hashvalues = [...hashvalues, ...hashvaluesprime];
    const receipt = await ts.getTimestamps(1, 10);
    expect(receipt.items).to.deep.equal([
      ethers.sha256(hash1),
      ethers.sha256(hash2),
      ethers.sha256(hash3),
      ethers.sha256(hash1prime),
      ethers.sha256(hash2prime),
    ]);

    const ids = await ts.getRecordIds(1, 10);
    expect(ids.items).to.have.length(1);
    expect(ids.items[0]).to.equal(recordId);

    const vd0 = await ts.getRecordVersion(recordId, 0, 1, 10);
    expect(vd0.hashAlgorithmIds).to.have.length(5);
    expect(vd0.hashAlgorithmIds[0]).to.equal(0);
    expect(vd0.hashAlgorithmIds[1]).to.equal(1);
    expect(vd0.hashAlgorithmIds[2]).to.equal(2);
    expect(vd0.hashAlgorithmIds[3]).to.equal(2);
    expect(vd0.hashAlgorithmIds[4]).to.equal(0);
    expect(vd0.hashValues).to.have.length(5);

    for (const [id, el] of vd0.hashValues.entries()) {
      expect(el).to.equal(ethers.hexlify(hashvalues[id]));
    }

    expect(vd0.infoIds).to.have.length(2);
    expect(vd0.infoIds[0]).to.equal(
      ethers.sha256(ethers.toUtf8Bytes("info: btc to the moon")),
    );
    expect(vd0.infoIds[1]).to.equal(ethers.sha256(versionInfoprime));
    expect(vd0.total).to.equal(5);
    expect(vd0.howMany).to.equal(5);
    expect(vd0.prev).to.equal(1);
    expect(vd0.next).to.equal(1);

    const vd1 = await ts.getRecordVersion(recordId, 1, 1, 10);
    expect(vd1.hashAlgorithmIds).to.have.length(0);
    expect(vd1.hashValues).to.have.length(0);
    expect(vd1.infoIds).to.have.length(0);
    expect(vd1.total).to.equal(0);
    expect(vd1.howMany).to.equal(0);
  });

  it("insertRecordVersionInfo should failed with empty recordId or versionInfo", async () => {
    //  should revert
    const hash1 = ethers.toUtf8Bytes("e40605e6");

    await expect(
      ts.insertRecordVersionInfo(ethers.ZeroHash, 0, new Uint8Array([])),
    ).to.be.revertedWith("recordId empty");
    await expect(
      ts.insertRecordVersionInfo(ethers.sha256(hash1), 0, new Uint8Array([])),
    ).to.be.revertedWith("versionInfo empty");
  });

  it("insertRecordVersionInfo should failed for unknown recordId or versionId", async () => {
    //  should revert
    const hash1 = ethers.toUtf8Bytes("e40605e6");
    const versionInfo = ethers.toUtf8Bytes("second one");
    await expect(
      ts.insertRecordVersionInfo(ethers.sha256(hash1), 0, versionInfo),
    ).to.be.revertedWith("record/version unknown");

    let blockNumber = await ethers.provider.getBlockNumber();
    blockNumber += 1;
    //  recordId = sha256(abi.encode(msg.sender, block.number, hashValue));
    const recordId = ethers.sha256(
      ethers.AbiCoder.defaultAbiCoder().encode(
        ["address", "uint256", "bytes"],
        [admin.address, blockNumber, hash1],
      ),
    );

    await ts.timestampRecordHashes(
      [0],
      [hash1],
      [ethers.toUtf8Bytes("btc")],
      ethers.toUtf8Bytes("info: btc to the moon"),
    );
    // version  does not exist should revert
    await expect(
      ts.insertRecordVersionInfo(recordId, 1, versionInfo),
    ).to.be.revertedWith("record/version unknown");
  });

  it("insertRecordVersionInfo should fail for sender not owner", async () => {
    const hash1 = ethers.toUtf8Bytes("e40605e6");
    const hash2 = ethers.toUtf8Bytes("aa54def9");
    const hash3 = ethers.toUtf8Bytes("38862f7");
    const hashvalues = [hash1, hash2, hash3];
    let blockNumber = await ethers.provider.getBlockNumber();
    blockNumber += 1;
    //  recordId = sha256(abi.encode(msg.sender, block.number, hashValue));
    const recordId = ethers.sha256(
      ethers.AbiCoder.defaultAbiCoder().encode(
        ["address", "uint256", "bytes"],
        [admin.address, blockNumber, hash1],
      ),
    );

    await ts.timestampRecordHashes(
      [0, 1, 2],
      hashvalues,
      [
        ethers.toUtf8Bytes("btc"),
        ethers.toUtf8Bytes("new"),
        ethers.toUtf8Bytes("ath"),
      ],
      ethers.toUtf8Bytes("info: btc to the moon"),
    );

    const versionInfoprime = ethers.toUtf8Bytes("new info");
    const tsUser = ts.connect(user);
    await expect(
      tsUser.insertRecordVersionInfo(recordId, 0, versionInfoprime),
    ).to.be.revertedWith("sender is not listed as owner");
  });

  it("insertRecordVersionInfo should succeed", async () => {
    const hash1 = ethers.toUtf8Bytes("e40605e6");
    const hash2 = ethers.toUtf8Bytes("aa54def9");
    const hash3 = ethers.toUtf8Bytes("38862f7");
    const hashvalues = [hash1, hash2, hash3];
    let blockNumber = await ethers.provider.getBlockNumber();
    blockNumber += 1;
    //  recordId = sha256(abi.encode(msg.sender, block.number, hashValue));
    const recordId = ethers.sha256(
      ethers.AbiCoder.defaultAbiCoder().encode(
        ["address", "uint256", "bytes"],
        [admin.address, blockNumber, hash1],
      ),
    );

    await ts.timestampRecordHashes(
      [0, 1, 2],
      hashvalues,
      [
        ethers.toUtf8Bytes("btc"),
        ethers.toUtf8Bytes("new"),
        ethers.toUtf8Bytes("ath"),
      ],
      ethers.toUtf8Bytes("info: btc to the moon"),
    );

    const versionInfoprime = ethers.toUtf8Bytes("new info");

    await ts.insertRecordVersionInfo(recordId, 0, versionInfoprime);

    const receipt = await ts.getTimestamps(1, 10);
    expect(receipt.items).to.deep.equal([
      ethers.sha256(hash1),
      ethers.sha256(hash2),
      ethers.sha256(hash3),
    ]);

    const ids = await ts.getRecordIds(1, 10);
    expect(ids.items).to.have.length(1);
    expect(ids.items[0]).to.equal(recordId);

    const vd0 = await ts.getRecordVersion(recordId, 0, 1, 10);
    expect(vd0.hashAlgorithmIds).to.have.length(3);
    expect(vd0.hashAlgorithmIds[0]).to.equal(0);
    expect(vd0.hashAlgorithmIds[1]).to.equal(1);
    expect(vd0.hashAlgorithmIds[2]).to.equal(2);
    expect(vd0.hashValues).to.have.length(3);

    for (const [id, el] of vd0.hashValues.entries()) {
      expect(el).to.equal(ethers.hexlify(hashvalues[id]));
    }

    expect(vd0.infoIds).to.have.length(2);
    expect(vd0.infoIds[0]).to.equal(
      ethers.sha256(ethers.toUtf8Bytes("info: btc to the moon")),
    );
    expect(vd0.infoIds[1]).to.equal(ethers.sha256(versionInfoprime));
    expect(vd0.total).to.equal(3);
    expect(vd0.howMany).to.equal(3);
    expect(vd0.prev).to.equal(1);
    expect(vd0.next).to.equal(1);

    const vd1 = await ts.getRecordVersion(recordId, 1, 1, 10);
    expect(vd1.hashAlgorithmIds).to.have.length(0);
    expect(vd1.hashValues).to.have.length(0);
    expect(vd1.infoIds).to.have.length(0);
    expect(vd1.total).to.equal(0);
    expect(vd1.howMany).to.equal(0);
  });

  it("detachRecordVersionHash should fail for sender not owner", async () => {
    const hash1 = ethers.toUtf8Bytes("e40605e6");
    let blockNumber = await ethers.provider.getBlockNumber();
    blockNumber += 1;
    //  recordId = sha256(abi.encode(msg.sender, block.number, hashValue));
    const recordId = ethers.sha256(
      ethers.AbiCoder.defaultAbiCoder().encode(
        ["address", "uint256", "bytes"],
        [admin.address, blockNumber, hash1],
      ),
    );
    // will create a version 0 with one timestamp Id (sha256(hash1)) under recordId
    await ts.timestampRecordHashes(
      [1],
      [hash1],
      [ethers.toUtf8Bytes("btc")],
      new Uint8Array([]),
    );
    const receiptBefore = await ts.getTimestamps(1, 10);

    expect(receiptBefore.items).to.deep.equal([ethers.sha256(hash1)]);
    const vd0 = await ts.getRecordVersion(recordId, 0, 1, 10);

    expect(vd0.hashAlgorithmIds).to.have.length(1);
    expect(vd0.hashAlgorithmIds[0]).to.equal(1);
    expect(vd0.hashValues).to.have.length(1);
    expect(vd0.hashValues).to.deep.equal([ethers.hexlify(hash1)]);
    expect(vd0.total).to.equal(1);
    expect(vd0.howMany).to.equal(1);
    expect(vd0.prev).to.equal(1);
    expect(vd0.next).to.equal(1);
    const tsUser = ts.connect(user);
    await expect(
      tsUser.detachRecordVersionHash(recordId, 0, hash1),
    ).to.be.revertedWith("sender is not listed as owner");
  });

  it("detachRecordVersionHash should succeed with only one tsId in the version", async () => {
    const hash1 = ethers.toUtf8Bytes("e40605e6");
    let blockNumber = await ethers.provider.getBlockNumber();
    blockNumber += 1;
    //  recordId = sha256(abi.encode(msg.sender, block.number, hashValue));
    const recordId = ethers.sha256(
      ethers.AbiCoder.defaultAbiCoder().encode(
        ["address", "uint256", "bytes"],
        [admin.address, blockNumber, hash1],
      ),
    );
    // will create a version 0 with one timestamp Id (sha256(hash1)) under recordId
    await ts.timestampRecordHashes(
      [1],
      [hash1],
      [ethers.toUtf8Bytes("btc")],
      new Uint8Array([]),
    );
    const receiptBefore = await ts.getTimestamps(1, 10);

    expect(receiptBefore.items).to.deep.equal([ethers.sha256(hash1)]);
    const vd0 = await ts.getRecordVersion(recordId, 0, 1, 10);

    expect(vd0.hashAlgorithmIds).to.have.length(1);
    expect(vd0.hashAlgorithmIds[0]).to.equal(1);
    expect(vd0.hashValues).to.have.length(1);
    expect(vd0.hashValues).to.deep.equal([ethers.hexlify(hash1)]);
    expect(vd0.total).to.equal(1);
    expect(vd0.howMany).to.equal(1);
    expect(vd0.prev).to.equal(1);
    expect(vd0.next).to.equal(1);

    await ts.detachRecordVersionHash(recordId, 0, hash1);
    // should stay the same as we don't remove the timestamp we simply detach it from the version
    const receiptAfter = await ts.getTimestamps(1, 10);
    expect(receiptAfter.items).to.deep.equal([ethers.sha256(hash1)]);

    const ids = await ts.getRecordIds(1, 10);
    expect(ids.items).to.have.length(1);
    expect(ids.items[0]).to.equal(recordId);

    const vd1 = await ts.getRecordVersion(recordId, 0, 1, 10);
    expect(vd1.hashAlgorithmIds).to.have.length(0);
    expect(vd1.hashValues).to.have.length(0);
    expect(vd1.total).to.equal(0);
    expect(vd1.howMany).to.equal(0);
  });

  it("getRecordIdsByOwnerId should failed with wrong recordId, OwnerId, page or pageSize", async () => {
    const hash1 = ethers.toUtf8Bytes("e40605e6");
    const hash2 = ethers.toUtf8Bytes("aa54def9");
    const hash3 = ethers.toUtf8Bytes("38862f7");

    await ts.timestampRecordHashes(
      [0, 1, 2],
      [hash1, hash2, hash3],
      [
        ethers.toUtf8Bytes("btc"),
        ethers.toUtf8Bytes("new"),
        ethers.toUtf8Bytes("ath"),
      ],
      ethers.toUtf8Bytes("info: btc to the moon"),
    );
    // pagesize = 0 should revert
    await expect(ts.getRecordIdsByOwnerId("", 1, 10)).to.be.revertedWith(
      "ownerId empty",
    );
    // pagesize = 0 should revert
    await expect(ts.getRecordIdsByOwnerId("ownerId", 1, 0)).to.be.revertedWith(
      "PSize not >0",
    );
    // page  = 0 should revert
    await expect(ts.getRecordIdsByOwnerId("ownerId", 0, 10)).to.be.revertedWith(
      "Page not >0",
    );

    // pagesize > 50 should revert
    await expect(ts.getRecordIdsByOwnerId("ownerId", 1, 51)).to.be.revertedWith(
      "PSize not <= 50",
    );
  });

  it("getRecordIdsByOwnerId should succeed", async () => {
    const hash1Value = ethers.toUtf8Bytes(`value-1`);
    const hash2Value = ethers.toUtf8Bytes(`value-2`);
    const hash3Value = ethers.toUtf8Bytes(`value-3`);
    let blockNumber = await ethers.provider.getBlockNumber();
    blockNumber += 1;
    //  recordId = sha256(abi.encode(msg.sender, block.number, hashValue));
    const recordId = ethers.sha256(
      ethers.AbiCoder.defaultAbiCoder().encode(
        ["address", "uint256", "bytes"],
        [admin.address, blockNumber, hash1Value],
      ),
    );
    // INSERT SHOULD BE DONE IN ORDER !!!
    await ts.timestampRecordHashes(
      [0, 1, 2],
      [hash1Value, hash2Value, hash3Value],
      [
        ethers.toUtf8Bytes("btc"),
        ethers.toUtf8Bytes("new"),
        ethers.toUtf8Bytes("ath"),
      ],
      ethers.toUtf8Bytes("info: btc to the moon"),
    );

    const r0 = await ts.getRecord(recordId);
    expect(r0.ownerIds).to.have.length(1);
    expect(r0.revokedOwnerIds).to.deep.equal([]);
    expect(r0.totalVersions).to.equal(1);

    // add version
    const hash1prime = ethers.toUtf8Bytes("othere40605e6");
    const hash2prime = ethers.toUtf8Bytes("again40605e6");
    const hash3prime = ethers.toUtf8Bytes("new40605e6");
    const tsids = [
      ethers.sha256(hash1prime),
      ethers.sha256(hash2prime),
      ethers.sha256(hash3prime),
    ];
    const versionInfoprime = ethers.toUtf8Bytes("new infon");
    await expect(
      ts.timestampRecordVersionHashes(
        recordId,
        [2, 0, 1],
        [hash1prime, hash2prime, hash3prime],
        [
          ethers.toUtf8Bytes("oneprime"),
          ethers.toUtf8Bytes("twoprime"),
          ethers.toUtf8Bytes("threeprime"),
        ],
        versionInfoprime,
      ),
    )
      .to.emit(ts, "RecordedHashes")
      .withArgs(recordId, tsids, ethers.sha256(versionInfoprime));
    const r1 = await ts.getRecord(recordId);
    expect(r1.ownerIds).to.deep.equal([admin.address.toLowerCase()]);
    expect(r1.revokedOwnerIds).to.deep.equal([]);
    expect(r1.totalVersions).to.equal(2);
    /// add ownerdIds and revoke some
    const notBefore = Date.now();
    const notAfter = notBefore + 1_000_000;
    await ts.insertRecordOwner(recordId, "anotherownerId", notBefore, notAfter);
    const r2 = await ts.getRecord(recordId);
    expect(r2.ownerIds).to.deep.equal([
      admin.address.toLowerCase(),
      "anotherownerId",
    ]);
    expect(r2.revokedOwnerIds).to.deep.equal([]);
    expect(r2.totalVersions).to.equal(2);
    await ts.revokeRecordOwner(recordId, "anotherownerId");
    const r3 = await ts.getRecord(recordId);
    expect(r3.ownerIds).to.deep.equal([admin.address.toLowerCase()]);
    expect(r3.revokedOwnerIds).to.deep.equal(["anotherownerId"]);
    expect(r2.totalVersions).to.equal(2);
  });

  it("revokeRecordOwner should failed with wrong recordId, OwnerId ", async () => {
    const hash1 = ethers.toUtf8Bytes("e40605e6");
    const hash2 = ethers.toUtf8Bytes("aa54def9");
    const hash3 = ethers.toUtf8Bytes("38862f7");
    let blockNumber = await ethers.provider.getBlockNumber();
    blockNumber += 1;
    //  recordId = sha256(abi.encode(msg.sender, block.number, hashValue));
    const recordId = ethers.sha256(
      ethers.AbiCoder.defaultAbiCoder().encode(
        ["address", "uint256", "bytes"],
        [admin.address, blockNumber, hash1],
      ),
    );
    await ts.timestampRecordHashes(
      [0, 1, 2],
      [hash1, hash2, hash3],
      [
        ethers.toUtf8Bytes("btc"),
        ethers.toUtf8Bytes("new"),
        ethers.toUtf8Bytes("ath"),
      ],
      ethers.toUtf8Bytes("info: btc to the moon"),
    );

    await expect(ts.revokeRecordOwner(recordId, "")).to.be.revertedWith(
      "ownerId empty",
    );

    await expect(
      ts.revokeRecordOwner(ethers.ZeroHash, "ownerId"),
    ).to.be.revertedWith("recordId empty");

    await expect(
      ts.revokeRecordOwner(ethers.sha256(hash1), admin.address),
    ).to.be.revertedWith("record unknown");

    await expect(
      ts.revokeRecordOwner(recordId, user.address),
    ).to.be.revertedWith("ownerId unknown");
  });

  it("revokeRecordOwner should fail for sender not owner", async () => {
    const hash1 = ethers.toUtf8Bytes("e40605e6");
    const hash2 = ethers.toUtf8Bytes("aa54def9");
    const hash3 = ethers.toUtf8Bytes("38862f7");
    let blockNumber = await ethers.provider.getBlockNumber();
    blockNumber += 1;
    //  recordId = sha256(abi.encode(msg.sender, block.number, hashValue));
    const recordId = ethers.sha256(
      ethers.AbiCoder.defaultAbiCoder().encode(
        ["address", "uint256", "bytes"],
        [admin.address, blockNumber, hash1],
      ),
    );
    await ts.timestampRecordHashes(
      [0, 1, 2],
      [hash1, hash2, hash3],
      [
        ethers.toUtf8Bytes("btc"),
        ethers.toUtf8Bytes("new"),
        ethers.toUtf8Bytes("ath"),
      ],
      ethers.toUtf8Bytes("info: btc to the moon"),
    );
    // add ownerdIds and revoke some
    const notBefore = Date.now();
    const notAfter = notBefore + 1_000_000;
    await ts.insertRecordOwner(recordId, "anotherownerId", notBefore, notAfter);
    const r0 = await ts.getRecord(recordId);
    expect(r0.ownerIds).to.deep.equal([
      admin.address.toLowerCase(),
      "anotherownerId",
    ]);
    expect(r0.revokedOwnerIds).to.deep.equal([]);
    expect(r0.totalVersions).to.equal(1);

    // revoke the second owner
    const tsUser = ts.connect(user);
    await expect(
      tsUser.revokeRecordOwner(recordId, "anotherownerId"),
    ).to.be.revertedWith("sender is not listed as owner");
  });

  it("revokeRecordOwner should work", async () => {
    const hash1 = ethers.toUtf8Bytes("e40605e6");
    const hash2 = ethers.toUtf8Bytes("aa54def9");
    const hash3 = ethers.toUtf8Bytes("38862f7");
    let blockNumber = await ethers.provider.getBlockNumber();
    blockNumber += 1;
    //  recordId = sha256(abi.encode(msg.sender, block.number, hashValue));
    const recordId = ethers.sha256(
      ethers.AbiCoder.defaultAbiCoder().encode(
        ["address", "uint256", "bytes"],
        [admin.address, blockNumber, hash1],
      ),
    );
    await ts.timestampRecordHashes(
      [0, 1, 2],
      [hash1, hash2, hash3],
      [
        ethers.toUtf8Bytes("btc"),
        ethers.toUtf8Bytes("new"),
        ethers.toUtf8Bytes("ath"),
      ],
      ethers.toUtf8Bytes("info: btc to the moon"),
    );
    // add ownerdIds and revoke some
    const notBefore = Date.now();
    const notAfter = notBefore + 1_000_000;
    await ts.insertRecordOwner(recordId, "anotherownerId", notBefore, notAfter);
    const r0 = await ts.getRecord(recordId);
    expect(r0.ownerIds).to.deep.equal([
      admin.address.toLowerCase(),
      "anotherownerId",
    ]);
    expect(r0.revokedOwnerIds).to.deep.equal([]);
    expect(r0.totalVersions).to.equal(1);

    // revoke the second owner
    await ts.revokeRecordOwner(recordId, "anotherownerId");
    const r1 = await ts.getRecord(recordId);
    expect(r1.ownerIds).to.deep.equal([admin.address.toLowerCase()]);
    expect(r1.revokedOwnerIds).to.deep.equal(["anotherownerId"]);
    expect(r1.totalVersions).to.equal(1);

    // revoke the first owner warning ownerId is case sensitive
    await ts.revokeRecordOwner(recordId, admin.address.toLowerCase());
    const r2 = await ts.getRecord(recordId);
    expect(r2.ownerIds).to.deep.equal([]);
    expect(r2.revokedOwnerIds).to.deep.equal([
      "anotherownerId",
      admin.address.toLowerCase(),
    ]);
    expect(r2.totalVersions).to.equal(1);
  });

  it("insertRecordOwner should failed with wrong date, recordId, OwnerId ", async () => {
    const hash1 = ethers.toUtf8Bytes("e40605e6");
    const hash2 = ethers.toUtf8Bytes("aa54def9");
    const hash3 = ethers.toUtf8Bytes("38862f7");

    let blockNumber = await ethers.provider.getBlockNumber();
    blockNumber += 1;
    //  recordId = sha256(abi.encode(msg.sender, block.number, hashValue));
    const recordId = ethers.sha256(
      ethers.AbiCoder.defaultAbiCoder().encode(
        ["address", "uint256", "bytes"],
        [admin.address, blockNumber, hash1],
      ),
    );
    await ts.timestampRecordHashes(
      [0, 1, 2],
      [hash1, hash2, hash3],
      [
        ethers.toUtf8Bytes("btc"),
        ethers.toUtf8Bytes("new"),
        ethers.toUtf8Bytes("ath"),
      ],
      ethers.toUtf8Bytes("info: btc to the moon"),
    );

    await expect(ts.insertRecordOwner(recordId, "", 1, 2)).to.be.revertedWith(
      "ownerId empty",
    );
    await expect(
      ts.insertRecordOwner(ethers.ZeroHash, "ownerId", 1, 2),
    ).to.be.revertedWith("recordId empty");
    await expect(
      ts.insertRecordOwner(ethers.sha256(hash1), "ownerId", 1, 2),
    ).to.be.revertedWith("record unknown");
    await expect(
      ts.insertRecordOwner(recordId, admin.address.toLowerCase(), 1, 2),
    ).to.be.revertedWith("ownerId exist");
    // notBefore== 0 &&  notAfter ==0
    await expect(
      ts.insertRecordOwner(recordId, "ownerId", 0, 0),
    ).to.be.revertedWith("date incorrect");
    // notBefore== 0 &&  notAfter>0
    await expect(
      ts.insertRecordOwner(recordId, "ownerId", 0, 2),
    ).to.be.revertedWith("date incorrect");
    // notBefore== 2 &&  notAfter ==1
    await expect(
      ts.insertRecordOwner(recordId, "ownerId", 2, 1),
    ).to.be.revertedWith("date incorrect");
  });

  it("insertRecordOwner should fail for sender not owner ", async () => {
    const hash1 = ethers.toUtf8Bytes("e40605e6");
    const hash2 = ethers.toUtf8Bytes("aa54def9");
    const hash3 = ethers.toUtf8Bytes("38862f7");

    let blockNumber = await ethers.provider.getBlockNumber();
    blockNumber += 1;
    //  recordId = sha256(abi.encode(msg.sender, block.number, hashValue));
    const recordId = ethers.sha256(
      ethers.AbiCoder.defaultAbiCoder().encode(
        ["address", "uint256", "bytes"],
        [admin.address, blockNumber, hash1],
      ),
    );
    await ts.timestampRecordHashes(
      [0, 1, 2],
      [hash1, hash2, hash3],
      [
        ethers.toUtf8Bytes("btc"),
        ethers.toUtf8Bytes("new"),
        ethers.toUtf8Bytes("ath"),
      ],
      ethers.toUtf8Bytes("info: btc to the moon"),
    );
    const r0 = await ts.getRecord(recordId);
    expect(r0.ownerIds).to.deep.equal([admin.address.toLowerCase()]);
    expect(r0.revokedOwnerIds).to.deep.equal([]);
    expect(r0.totalVersions).to.equal(1);
    const tsUser = ts.connect(user);
    await expect(
      tsUser.insertRecordOwner(recordId, "ownerId", 1, 2),
    ).to.be.revertedWith("sender is not listed as owner");
  });

  it("insertRecordOwner should work ", async () => {
    const hash1 = ethers.toUtf8Bytes("e40605e6");
    const hash2 = ethers.toUtf8Bytes("aa54def9");
    const hash3 = ethers.toUtf8Bytes("38862f7");

    let blockNumber = await ethers.provider.getBlockNumber();
    blockNumber += 1;
    //  recordId = sha256(abi.encode(msg.sender, block.number, hashValue));
    const recordId = ethers.sha256(
      ethers.AbiCoder.defaultAbiCoder().encode(
        ["address", "uint256", "bytes"],
        [admin.address, blockNumber, hash1],
      ),
    );
    await ts.timestampRecordHashes(
      [0, 1, 2],
      [hash1, hash2, hash3],
      [
        ethers.toUtf8Bytes("btc"),
        ethers.toUtf8Bytes("new"),
        ethers.toUtf8Bytes("ath"),
      ],
      ethers.toUtf8Bytes("info: btc to the moon"),
    );
    const r0 = await ts.getRecord(recordId);
    expect(r0.ownerIds).to.deep.equal([admin.address.toLowerCase()]);
    expect(r0.revokedOwnerIds).to.deep.equal([]);
    expect(r0.totalVersions).to.equal(1);

    await ts.insertRecordOwner(recordId, "ownerId", 1, 2);
    const r1 = await ts.getRecord(recordId);
    expect(r1.ownerIds).to.deep.equal([admin.address.toLowerCase(), "ownerId"]);
    expect(r1.revokedOwnerIds).to.deep.equal([]);
    expect(r1.totalVersions).to.equal(1);

    await ts.insertRecordOwner(recordId, "anotherOwnerId", 112_345_646_787, 0);
    const r2 = await ts.getRecord(recordId);
    expect(r2.ownerIds).to.deep.equal([
      admin.address.toLowerCase(),
      "ownerId",
      "anotherOwnerId",
    ]);
    expect(r2.revokedOwnerIds).to.deep.equal([]);
    expect(r2.totalVersions).to.equal(1);
  });

  it("getRecordOwnerInfo should failed with wrong recordId, OwnerId ", async () => {
    const hash1 = ethers.toUtf8Bytes("e40605e6");
    const hash2 = ethers.toUtf8Bytes("aa54def9");
    const hash3 = ethers.toUtf8Bytes("38862f7");
    let blockNumber = await ethers.provider.getBlockNumber();
    blockNumber += 1;
    //  recordId = sha256(abi.encode(msg.sender, block.number, hashValue));
    const recordId = ethers.sha256(
      ethers.AbiCoder.defaultAbiCoder().encode(
        ["address", "uint256", "bytes"],
        [admin.address, blockNumber, hash1],
      ),
    );
    await ts.timestampRecordHashes(
      [0, 1, 2],
      [hash1, hash2, hash3],
      [
        ethers.toUtf8Bytes("btc"),
        ethers.toUtf8Bytes("new"),
        ethers.toUtf8Bytes("ath"),
      ],
      ethers.toUtf8Bytes("info: btc to the moon"),
    );

    await expect(ts.getRecordOwnerInfo(recordId, "")).to.be.revertedWith(
      "ownerId empty",
    );

    await expect(
      ts.getRecordOwnerInfo(ethers.ZeroHash, "ownerId"),
    ).to.be.revertedWith("recordId empty");

    await expect(
      ts.getRecordOwnerInfo(ethers.sha256(hash1), admin.address),
    ).to.be.revertedWith("record unknown");
  });

  it("getRecordOwnerInfo should work", async () => {
    const hash1 = ethers.toUtf8Bytes("e40605e6");
    const hash2 = ethers.toUtf8Bytes("aa54def9");
    const hash3 = ethers.toUtf8Bytes("38862f7");
    let blockNumber = await ethers.provider.getBlockNumber();
    blockNumber += 1;
    //  recordId = sha256(abi.encode(msg.sender, block.number, hashValue));
    const recordId = ethers.sha256(
      ethers.AbiCoder.defaultAbiCoder().encode(
        ["address", "uint256", "bytes"],
        [admin.address, blockNumber, hash1],
      ),
    );
    await ts.timestampRecordHashes(
      [0, 1, 2],
      [hash1, hash2, hash3],
      [
        ethers.toUtf8Bytes("btc"),
        ethers.toUtf8Bytes("new"),
        ethers.toUtf8Bytes("ath"),
      ],
      ethers.toUtf8Bytes("info: btc to the moon"),
    );
    const blockTs = await ethers.provider.getBlock(blockNumber);

    if (!blockTs) {
      throw new Error("block not found");
    }

    const inf1 = await ts.getRecordOwnerInfo(
      recordId,
      admin.address.toLowerCase(),
    );
    expect(inf1.notBefore).to.equal(blockTs.timestamp);
    expect(inf1.notAfter).to.equal(MAX_UINT256);
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    expect(inf1.revoked).to.be.false;

    // add ownerdIds and revoke some
    const notBefore = Date.now();
    const notAfter = notBefore + 1_000_000;
    await ts.insertRecordOwner(recordId, "anotherownerId", notBefore, notAfter);
    const inf2 = await ts.getRecordOwnerInfo(recordId, "anotherownerId");
    expect(inf2.notBefore).to.equal(notBefore);
    expect(inf2.notAfter).to.equal(notAfter);
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    expect(inf2.revoked).to.be.false;

    // revoke the second owner
    await ts.revokeRecordOwner(recordId, "anotherownerId");
    const inf3 = await ts.getRecordOwnerInfo(recordId, "anotherownerId");
    expect(inf3.notBefore).to.equal(notBefore);
    expect(inf3.notAfter).to.equal(notAfter);
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    expect(inf3.revoked).to.be.true;

    // revoke the first owner warning ownerId is case sensitive
    await ts.revokeRecordOwner(recordId, admin.address.toLowerCase());
    const inf4 = await ts.getRecordOwnerInfo(
      recordId,
      admin.address.toLowerCase(),
    );
    expect(inf4.notBefore).to.equal(blockTs.timestamp);
    expect(inf4.notAfter).to.equal(MAX_UINT256);
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    expect(inf4.revoked).to.be.true;
  });
});
