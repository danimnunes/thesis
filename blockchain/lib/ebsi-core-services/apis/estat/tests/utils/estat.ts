import "@ebsiint-sc/track-and-trace/dist/hardhat.d.ts";

import hre from "hardhat";

import "@openzeppelin/hardhat-upgrades";

import type { TrackAndTrace } from "@ebsiint-sc/track-and-trace";
import type { HardhatEthersProvider } from "@nomicfoundation/hardhat-ethers/internal/hardhat-ethers-provider.js";
import type { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers.js";

import "@nomicfoundation/hardhat-ethers";
import { EbsiWallet } from "@europeum-ebsi/wallet-lib";
import { exportJWK, generateKeyPair } from "jose";

import type { TestDocument } from "./data.ts";

import { AccountType, Permission } from "../../src/shared/constants.ts";
import { didToHex } from "../../src/shared/utils.ts";
import { createDocument, createEvent } from "./data.ts";

interface SetupOptions {
  documentEventsTotal?: number;
  documentsWithBlockSourceTotal?: number;
  documentsWithExternalSourceTotal?: number;
}

export async function setupTestEnv({
  documentEventsTotal = 1,
  documentsWithBlockSourceTotal = 1,
  documentsWithExternalSourceTotal = 1,
}: SetupOptions = {}): Promise<{
  creatorAccount: string;
  documentsWithBlockSource: TestDocument[];
  documentsWithExternalSource: TestDocument[];
  grantedDidEbsiAccount: string;
  grantedDidKeyAccount: string;
  provider: HardhatEthersProvider;
  trackAndTraceContract: TrackAndTrace;
}> {
  const ethersProvider = hre.ethers.provider;
  const documentsWithBlockSource: TestDocument[] = [];
  const documentsWithExternalSource: TestDocument[] = [];
  const supportOfficeAccount = EbsiWallet.createDid();
  const creatorAccount = EbsiWallet.createDid();
  const grantedDidEbsiAccount = EbsiWallet.createDid();
  const { publicKey: didKeyPublicKey } = await generateKeyPair("ES256K");
  const didKeyPublicKeyJwk = await exportJWK(didKeyPublicKey);
  const grantedDidKeyAccount = EbsiWallet.createDid(
    "NATURAL_PERSON",
    didKeyPublicKeyJwk,
  );

  // Deploy contract
  const { broadcaster, trackAndTraceContract } =
    await deployTrackAndTraceContract();

  // Authorise creator account
  await trackAndTraceContract
    .connect(broadcaster)
    .authoriseDid(supportOfficeAccount, creatorAccount, true);

  // Deploy documents
  for (let i = 0; i < documentsWithBlockSourceTotal; i++) {
    documentsWithBlockSource.push(
      await insertDocumentWithBlockSource(
        trackAndTraceContract,
        creatorAccount,
      ),
    );
  }

  for (let i = 0; i < documentsWithExternalSourceTotal; i++) {
    documentsWithExternalSource.push(
      await insertDocumentWithExternalSource(
        trackAndTraceContract,
        creatorAccount,
      ),
    );
  }

  // Add events to first element of documentsWithBlockSource
  for (let i = 0; i < documentEventsTotal; i++) {
    await addEvent(trackAndTraceContract, documentsWithBlockSource[0]!);
  }

  // Grant access to a did:ebsi account
  for (let i = 0; i < documentsWithBlockSourceTotal; i++) {
    await grantAccess(
      trackAndTraceContract,
      documentsWithBlockSource[i]!.documentHash,
      creatorAccount,
      grantedDidEbsiAccount,
      AccountType.DID_EBSI,
    );
  }

  // Grant access to a did:key account
  for (let i = 0; i < documentsWithBlockSourceTotal; i++) {
    await grantAccess(
      trackAndTraceContract,
      documentsWithBlockSource[i]!.documentHash,
      creatorAccount,
      grantedDidKeyAccount,
      AccountType.DID_KEY,
    );
  }

  // Return test env variables
  return {
    creatorAccount,
    documentsWithBlockSource,
    documentsWithExternalSource,
    grantedDidEbsiAccount,
    grantedDidKeyAccount,
    provider: ethersProvider,
    trackAndTraceContract,
  };
}

async function addEvent(contract: TrackAndTrace, doc: TestDocument) {
  const event = createEvent(doc.documentHash, doc.didEbsiCreator);

  const tx = await contract["writeEvent((bytes32,string,bytes,string,string))"](
    {
      documentHash: event.documentHash,
      externalHash: event.externalHash,
      metadata: event.metadata,
      origin: event.origin,
      sender: await didToHex(event.sender),
    },
  );

  const receipt = await tx.wait();

  if (!receipt) {
    throw new Error("Receipt not found");
  }

  const block = await hre.ethers.provider.getBlock(receipt.blockHash);

  if (!block) {
    throw new Error("Block not found");
  }

  event.timestamp = {
    datetime: `0x${block.timestamp.toString(16)}`,
    proof: `0x${block.number.toString(16).padStart(64, "0")}`,
  };

  doc.events.push(event);
}

async function deployTrackAndTraceContract(): Promise<{
  broadcaster: SignerWithAddress;
  trackAndTraceContract: TrackAndTrace;
}> {
  const signers = (await hre.ethers.getSigners()) as [
    SignerWithAddress,
    SignerWithAddress,
    SignerWithAddress,
    ...SignerWithAddress[],
  ];
  const [admin, upgrader, broadcaster] = signers;

  const trackAndTraceLibFactory = await hre.ethers.getContractFactory(
    "TrackAndTraceLib",
    {},
  );
  const trackAndTraceLibContract = await trackAndTraceLibFactory.deploy();

  await trackAndTraceLibContract.waitForDeployment();

  const trackAndTraceContractFactory = await hre.ethers.getContractFactory(
    "TrackAndTrace",
    {
      libraries: {
        TrackAndTraceLib: await trackAndTraceLibContract.getAddress(),
      },
    },
  );

  // deploy TPR mock
  const policyRegistryFactory =
    await hre.ethers.getContractFactory("PolicyRegistryMock");
  const tprMock = await policyRegistryFactory.deploy();

  // deploy DID mock
  const didMockFactory = await hre.ethers.getContractFactory("DidRegistryMock");
  const didRegistryMock = await didMockFactory.deploy();

  const trackAndTraceContract = await hre.upgrades.deployProxy(
    trackAndTraceContractFactory,
    [
      admin.address,
      upgrader.address,
      await tprMock.getAddress(),
      await didRegistryMock.getAddress(),
    ],
    { unsafeAllow: ["external-library-linking"] },
  );

  await didRegistryMock.setDidResult(true);
  await tprMock.setPolicyResult(true);

  return {
    broadcaster,
    trackAndTraceContract,
  };
}

async function grantAccess(
  contract: TrackAndTrace,
  documentHash: string,
  grantedByAccount: string,
  subjectAccount: string,
  subjectAccType: (typeof AccountType)[keyof typeof AccountType],
) {
  // permission to delegate
  const txDelegate = await contract.grantAccess(
    documentHash,
    Buffer.from(grantedByAccount),
    await didToHex(subjectAccount),
    AccountType.DID_EBSI,
    subjectAccType,
    Permission.DELEGATE,
  );
  await txDelegate.wait();

  // permission to write
  const txWrite = await contract.grantAccess(
    documentHash,
    Buffer.from(grantedByAccount),
    await didToHex(subjectAccount),
    AccountType.DID_EBSI,
    subjectAccType,
    Permission.WRITE,
  );
  await txWrite.wait();
}

async function insertDocumentWithBlockSource(
  contract: TrackAndTrace,
  creatorAccount: string,
) {
  const doc = createDocument(creatorAccount, false);

  const tx = await contract["createDocument(bytes32,string,string)"](
    doc.documentHash,
    doc.documentMetadata,
    doc.didEbsiCreator,
  );

  const receipt = await tx.wait();

  if (!receipt) {
    throw new Error("Receipt not found");
  }

  const block = await hre.ethers.provider.getBlock(receipt.blockHash);

  if (!block) {
    throw new Error("Block not found");
  }

  doc.timestamp = {
    datetime: `0x${block.timestamp.toString(16)}`,
    proof: `0x${block.number.toString(16).padStart(64, "0")}`,
  };

  return doc;
}

async function insertDocumentWithExternalSource(
  contract: TrackAndTrace,
  creatorAccount: string,
) {
  const doc = createDocument(creatorAccount, true);

  await contract["createDocument(bytes32,string,string,uint256,bytes32)"](
    doc.documentHash,
    doc.documentMetadata,
    doc.didEbsiCreator,
    doc.timestamp.datetime,
    doc.timestamp.proof,
  );

  return doc;
}
