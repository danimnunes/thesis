import "@ebsiint-sc/timestamp-v4/dist/hardhat.d.ts";

import hre from "hardhat";

import type { HashName } from "@ebsiint-api/shared";
import type { PolicyRegistryMock, Timestamp } from "@ebsiint-sc/timestamp-v4";
import type { ContractTransactionResponse } from "ethers";

import "@nomicfoundation/hardhat-ethers";
import { HardhatEthersProvider } from "@nomicfoundation/hardhat-ethers/internal/hardhat-ethers-provider.js";
import { ethers } from "ethers";
import { randomBytes } from "node:crypto";

const validHashAlgorithms = [
  "sha-256",
  "sha-512",
  "sha3-224",
  "sha3-256",
  "sha3-384",
  "sha3-512",
  "shake-256",
  "keccak-224",
  "keccak-256",
  "keccak-384",
  "keccak-512",
] as const;

type ValidIanaHashAlgorithms = (typeof validHashAlgorithms)[number];

const ianaToMultihashAlg = {
  "keccak-224": "keccak-224",
  "keccak-256": "keccak-256",
  "keccak-384": "keccak-384",
  "keccak-512": "keccak-512",
  "sha3-224": "sha3-224",
  "sha3-256": "sha3-256",
  "sha3-384": "sha3-384",
  "sha3-512": "sha3-512",
  "sha-256": "sha2-256",
  "sha-512": "sha2-512",
  "shake-256": "shake-256",
} as const satisfies Record<ValidIanaHashAlgorithms, HashName>;

type ValidMultihashAlgorithms =
  (typeof ianaToMultihashAlg)[ValidIanaHashAlgorithms];

export const multihashToNodeHashAlg = {
  "keccak-224": "keccak-224",
  "keccak-256": "keccak-256",
  "keccak-384": "keccak-384",
  "keccak-512": "keccak-512",
  "sha2-256": "sha256",
  "sha2-512": "sha512",
  "sha3-224": "sha3-224",
  "sha3-256": "sha3-256",
  "sha3-384": "sha3-384",
  "sha3-512": "sha3-512",
  "shake-256": "shake-256",
} as const satisfies Record<ValidMultihashAlgorithms, string>;

const outputLengths = {
  "keccak-224": 224,
  "keccak-256": 256,
  "keccak-384": 384,
  "keccak-512": 512,
  "sha3-224": 224,
  "sha3-256": 256,
  "sha3-384": 384,
  "sha3-512": 512,
  "sha-256": 256,
  "sha-512": 512,
  "shake-256": 256,
} as const satisfies Record<ValidIanaHashAlgorithms, number>;

interface HashAlgorithmObject {
  ianaName: ValidIanaHashAlgorithms;
  multihash: ValidMultihashAlgorithms;
  oid: string;
  outputLength: number;
  status: number;
}

interface HashObject {
  hashAlgorithmIds: number[];
  hashValues: string[];
  timestampData: string[];
  tx: ContractTransactionResponse;
}

interface RecordObject {
  hashAlgorithmIds: number[];
  hashValues: string[];
  recordId: string;
  timestampData: string[];
  versionInfo: string;
}

interface SetupOptions {
  hashAlgorithmsTotal?: number;
  hashesTotal?: number;
  recordsTotal?: number;
}

export function createHash(alg: ValidIanaHashAlgorithms): string {
  const outputLength = outputLengths[alg];
  return `0x${randomBytes(outputLength / 8).toString("hex")}`;
}

export async function insertHash(
  contract: Timestamp,
  hashAlgorithm: HashAlgorithmObject,
): Promise<HashObject> {
  const hashAlgorithmIds = [0];
  const hashValues = [createHash(hashAlgorithm.ianaName)];
  const timestampData = [`0x${randomBytes(4).toString("hex")}`];

  const tx = await contract.timestampHashes(
    hashAlgorithmIds,
    hashValues,
    timestampData,
  );

  return {
    hashAlgorithmIds,
    hashValues,
    timestampData,
    tx: tx as unknown as ContractTransactionResponse,
  };
}

export async function setupTestEnv(opts?: SetupOptions): Promise<{
  hashAlgorithms: HashAlgorithmObject[];
  hashes: HashObject[];
  policyContractMock: PolicyRegistryMock;
  provider: HardhatEthersProvider;
  records: RecordObject[];
  sender: string;
  timestampContract: Timestamp;
}> {
  const { hashAlgorithmsTotal, hashesTotal, recordsTotal } = {
    hashAlgorithmsTotal: 1,
    hashesTotal: 0,
    recordsTotal: 1,
    ...opts,
  };
  const ethersProvider = hre.ethers.provider;
  const signer = await ethersProvider.getSigner();
  const sender = await signer.getAddress();

  // Deploy contract
  const { policyContractMock, timestampContract } =
    await deployTimestampContract();

  // Insert fake data
  const hashAlgorithms: HashAlgorithmObject[] = [];
  for (let i = 0; i < hashAlgorithmsTotal; i++) {
    hashAlgorithms.push(await insertHashAlgorithm(timestampContract, i));
  }

  const records: RecordObject[] = [];
  for (let i = 0; i < recordsTotal; i++) {
    records.push(
      await insertRecord(timestampContract, sender, hashAlgorithms[0]!),
    );
  }

  const hashes: HashObject[] = [];
  for (let i = 0; i < hashesTotal; i++) {
    hashes.push(await insertHash(timestampContract, hashAlgorithms[0]!));
  }

  // Return test env variables
  return {
    hashAlgorithms,
    hashes,
    policyContractMock,
    provider: ethersProvider,
    records,
    sender,
    timestampContract,
  };
}

async function deployTimestampContract(): Promise<{
  policyContractMock: PolicyRegistryMock;
  timestampContract: Timestamp;
}> {
  const testTprAddress = "0xb2a560271ce08135e245F490b8794794A13a1208";
  const policyRegistryFactory =
    await hre.ethers.getContractFactory("PolicyRegistryMock");
  const tempPolicyContract = await policyRegistryFactory.deploy();

  const bytecode = await hre.ethers.provider.getCode(
    await tempPolicyContract.getAddress(),
  );
  await hre.network.provider.send("hardhat_setCode", [
    testTprAddress,
    bytecode,
  ]);
  const policyContractMock = policyRegistryFactory.attach(
    testTprAddress,
  ) as PolicyRegistryMock;

  // Deploy libs
  const stringManipFactory = await hre.ethers.getContractFactory("StringManip");
  const stringManipLib = await stringManipFactory.deploy();

  const haFactory = await hre.ethers.getContractFactory("HashAlgoLib");
  const haLib = await haFactory.deploy();

  const tsFactory = await hre.ethers.getContractFactory("TimestampLib", {});
  const tsLib = await tsFactory.deploy();

  const rsFactory = await hre.ethers.getContractFactory("RecordLib", {
    libraries: {
      StringManip: await stringManipLib.getAddress(),
    },
  });
  const rsLib = await rsFactory.deploy();

  const timestampContractFactory = await hre.ethers.getContractFactory(
    "Timestamp",
    {
      libraries: {
        HashAlgoLib: await haLib.getAddress(),
        RecordLib: await rsLib.getAddress(),
        TimestampLib: await tsLib.getAddress(),
      },
    },
  );

  const timestampContract =
    await timestampContractFactory.deploy(testTprAddress);

  await policyContractMock.setPolicyResult(true);

  return { policyContractMock, timestampContract };
}

async function insertHashAlgorithm(
  contract: Timestamp,
  index: number,
): Promise<HashAlgorithmObject> {
  const ianaName = validHashAlgorithms[index]!;
  const outputLength = outputLengths[ianaName];
  const oid = "oid-test";
  const status = 1;
  const multihash = ianaToMultihashAlg[ianaName];

  await contract.insertHashAlgorithm(
    outputLength,
    ianaName,
    oid,
    status,
    multihash,
  );

  return {
    ianaName,
    multihash,
    oid,
    outputLength,
    status,
  };
}

async function insertRecord(
  contract: Timestamp,
  sender: string,
  hashAlgorithm: HashAlgorithmObject,
): Promise<RecordObject> {
  const hashAlgorithmIds = Array.from({ length: 3 }).fill(0) as number[];
  const hashValues = Array.from({ length: 3 }).map(() =>
    createHash(hashAlgorithm.ianaName),
  );
  const timestampData = Array.from({ length: 3 }).map(
    () => `0x${randomBytes(4).toString("hex")}`,
  );
  const versionInfo = `0x${Buffer.from(
    JSON.stringify({ test: "my test" }),
    "utf8",
  ).toString("hex")}`;

  const { blockNumber } = await contract.timestampRecordHashes(
    hashAlgorithmIds,
    hashValues,
    timestampData,
    versionInfo,
  );

  const types = ["address", "uint256", "bytes"];
  const values = [sender, blockNumber, hashValues[0]];
  const enc = ethers.AbiCoder.defaultAbiCoder().encode(types, values);
  const recordId = ethers.sha256(enc);

  return {
    hashAlgorithmIds,
    hashValues,
    recordId,
    timestampData,
    versionInfo,
  };
}
