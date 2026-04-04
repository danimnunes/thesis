import "@ebsiint-sc/trusted-contracts-registry-v1/dist/hardhat.d.ts";

import hre from "hardhat";

import "@openzeppelin/hardhat-upgrades";

import type { ProxyFactory } from "@ebsiint-sc/trusted-contracts-registry-v1";
import type { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers.js";

import "@nomicfoundation/hardhat-ethers";
import { EbsiWallet } from "@europeum-ebsi/wallet-lib";
import { randomBytes } from "node:crypto";

import type { TestContract, TestTemplate } from "./data.ts";

interface SetupOptions {
  contractsTotal?: number;
  templatesTotal?: number;
}

export async function setupTestEnv({
  contractsTotal = 1,
  templatesTotal = 1,
}: SetupOptions = {}) {
  const ethersProvider = hre.ethers.provider;
  const templates: TestTemplate[] = [];
  const contracts: TestContract[] = [];
  const trustedIssuerDid = EbsiWallet.createDid();

  // Deploy contracts
  const {
    proxyFactoryContract,
    proxyTemplateRegistryContract,
    sampleBeaconContract,
    trustedIssuer,
  } = await deployContracts();

  // Deploy templates
  for (let i = 0; i < templatesTotal; i++) {
    const templateName = `SampleContract-${randomBytes(16).toString("hex")}`;
    const templateVersion = "1.0.0";
    const repoURI = "https://github.com/example/sample-contract";
    const auditURI = "https://audit.example.com/sample-contract";
    // Compute the correct function selector for initialize(string,string,address,bytes32)
    const initSelector = hre.ethers
      .keccak256(
        hre.ethers.toUtf8Bytes("initialize(string,string,address,bytes32)"),
      )
      .slice(0, 10);
    const contractHash = hre.ethers.keccak256("0x");
    const storageLayoutHash = hre.ethers.keccak256("0x");

    const newTemplate = {
      auditURI: auditURI,
      beaconAddress: await sampleBeaconContract.getAddress(),
      contractHash: contractHash,
      initSelector,
      isActive: true,
      name: templateName,
      repoURI: repoURI,
      storageLayoutHash: storageLayoutHash,
      version: templateVersion,
    } satisfies Partial<TestTemplate>;

    await proxyTemplateRegistryContract.addTemplate(newTemplate);

    templates.push({
      ...newTemplate,
      id: hre.ethers.keccak256(
        hre.ethers.AbiCoder.defaultAbiCoder().encode(
          ["string", "string"],
          [templateName, templateVersion],
        ),
      ),
    });
  }

  // Deploy proxies
  for (let i = 0; i < contractsTotal; i++) {
    const initData = hre.ethers.AbiCoder.defaultAbiCoder().encode(
      ["string", "string", "address", "bytes32"],
      [
        "MyInstance",
        "1.0.0",
        trustedIssuer.address,
        hre.ethers.keccak256("0x"),
      ],
    );

    await deployProxy(
      proxyFactoryContract,
      trustedIssuer,
      templates[0]!.name,
      templates[0]!.version,
      trustedIssuerDid,
      initData,
    );

    const deployedContracts = await proxyFactoryContract.getDeployedContracts(
      1,
      1 + i,
    );

    const address = deployedContracts.items[i]!;

    const deploymentInfo =
      await proxyFactoryContract.getDeploymentInfo(address);

    contracts.push({
      address,
      deployer: deploymentInfo.deployer,
      deployerDID: deploymentInfo.deployerDID,
      deploymentTimestamp: deploymentInfo.deploymentTimestamp,
      isActive: deploymentInfo.isActive,
      templateId: deploymentInfo.templateId,
    });
  }

  // Return test env variables
  return {
    contracts,
    provider: ethersProvider,
    proxyFactoryContract,
    proxyTemplateRegistryContract,
    templates,
    trustedIssuer,
    trustedIssuerDid,
  };
}

async function deployContracts() {
  const signers = (await hre.ethers.getSigners()) as [
    SignerWithAddress,
    SignerWithAddress,
    SignerWithAddress,
    ...SignerWithAddress[],
  ];

  const [owner, admin, trustedIssuer, user] = signers;

  // Deploy DID Registry Mock
  const didMockFactory = await hre.ethers.getContractFactory("DidRegistryMock");
  const didRegistryMock = await didMockFactory.deploy();

  // Setup the DID registry to return true for controller checks
  await didRegistryMock.setMockedValue(true);

  // Deploy TPR Mock
  const policyRegistryMockFactory =
    await hre.ethers.getContractFactory("PolicyRegistryMock");
  const policyRegistryMock = await policyRegistryMockFactory.deploy();
  await policyRegistryMock.waitForDeployment();

  const proxyTemplateRegistryFactory = await hre.ethers.getContractFactory(
    "ProxyTemplateRegistry",
  );

  const proxyTemplateRegistryContract = await hre.upgrades.deployProxy(
    proxyTemplateRegistryFactory,
    [await policyRegistryMock.getAddress()],
  );

  await proxyTemplateRegistryContract.waitForDeployment();

  // Deploy ProxyFactory
  const proxyFactoryContractFactory =
    await hre.ethers.getContractFactory("ProxyFactory");

  const proxyFactoryContract = await hre.upgrades.deployProxy(
    proxyFactoryContractFactory,
    [
      await proxyTemplateRegistryContract.getAddress(),
      await didRegistryMock.getAddress(),
      await policyRegistryMock.getAddress(),
    ],
  );

  await proxyFactoryContract.waitForDeployment();

  // Deploy SampleUpgradeableBeacon and register it as a template
  const sampleImplementationFactory = await hre.ethers.getContractFactory(
    "SampleImplementation",
  );
  const sampleImplementationContract =
    await sampleImplementationFactory.deploy();
  await sampleImplementationContract.waitForDeployment();

  const sampleUpgradeableBeaconFactory = await hre.ethers.getContractFactory(
    "SampleUpgradeableBeacon",
  );
  const sampleBeaconContract = await sampleUpgradeableBeaconFactory.deploy(
    await sampleImplementationContract.getAddress(),
  );
  await sampleBeaconContract.waitForDeployment();

  return {
    admin,
    owner,
    proxyFactoryContract,
    proxyTemplateRegistryContract,
    sampleBeaconContract,
    trustedIssuer,
    user,
  };
}

async function deployProxy(
  contract: ProxyFactory,
  deployer: SignerWithAddress,
  templateName: string,
  templateVersion: string,
  issuerDid: string,
  initData: string,
) {
  const tx = await contract
    .connect(deployer)
    .deployProxy(templateName, templateVersion, initData, issuerDid);

  await tx.wait();

  return tx;
}
