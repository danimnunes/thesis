import { ethers } from "hardhat";

import type { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import type { InterfaceAbi, Result } from "ethers";

import { expect } from "chai";
import { Contract, ContractFactory } from "ethers";
import fs from "node:fs";
import path from "node:path";

import type {
  BondRegistry,
  CompanyWallet,
  EscrowManager,
  InterestDiscovery,
  IProxyFactory,
  IProxyTemplateRegistry,
} from "../src/types";

import {
  BondRegistry__factory,
  CompanyWallet__factory,
  EscrowManager__factory,
  InterestDiscovery__factory,
  IProxyFactory__factory,
  IProxyTemplateRegistry__factory,
} from "../src/types";

interface ArtifactJson {
  abi: InterfaceAbi;
  bytecode: string;
}

type DidRegistryMockContract = Contract & {
  getAddress(): Promise<string>;
  setMockedValue(value: boolean): Promise<unknown>;
};

type PolicyRegistryMockContract = Contract & {
  getAddress(): Promise<string>;
  setMockedValue(value: boolean): Promise<unknown>;
};

const trustedArtifactsRoot = path.resolve(
  __dirname,
  "../../trusted-contracts-registry-v1/artifacts/contracts",
);

const hardhatDeployArtifactsRoot = path.resolve(
  path.dirname(require.resolve("hardhat-deploy/package.json")),
  "./extendedArtifacts",
);

function decodeResult(result: unknown): Record<string, unknown> {
  return fixObject((result as Result).toObject(true));
}

async function deployFromArtifact(
  artifactFile: string,
  args: unknown[] = [],
): Promise<Awaited<ReturnType<ContractFactory["deploy"]>>> {
  const [deployer] = await ethers.getSigners();
  const artifact = readArtifact(artifactFile);
  const factory = new ContractFactory(
    artifact.abi,
    artifact.bytecode,
    deployer,
  );
  const contract = await factory.deploy(...args);
  await contract.waitForDeployment();
  return contract;
}

async function deployUupsProxyFromArtifacts(
  implementationArtifactFile: string,
  initializeArgs: unknown[],
): Promise<Contract> {
  const [deployer] = await ethers.getSigners();
  const implementationArtifact = readArtifact(implementationArtifactFile);
  const implementationFactory = new ContractFactory(
    implementationArtifact.abi,
    implementationArtifact.bytecode,
    deployer,
  );
  const implementation = await implementationFactory.deploy();
  await implementation.waitForDeployment();

  const proxyArtifact = readArtifact(
    path.resolve(hardhatDeployArtifactsRoot, "ERC1967Proxy.json"),
  );
  const proxyFactoryArtifact = new ContractFactory(
    proxyArtifact.abi,
    proxyArtifact.bytecode,
    deployer,
  );

  const initializeData = implementation.interface.encodeFunctionData(
    "initialize",
    initializeArgs,
  );

  const proxy = await proxyFactoryArtifact.deploy(
    await implementation.getAddress(),
    initializeData,
  );
  await proxy.waitForDeployment();

  return new Contract(
    await proxy.getAddress(),
    implementationArtifact.abi,
    deployer,
  );
}

function fixObject(result: Record<string, unknown>): Record<string, unknown> {
  const keys = Object.keys(result);
  const out: Record<string, unknown> = {};
  for (const key of keys) {
    out[key] = fixValue(result[key]);
  }
  return out;
}

function fixValue(value: unknown): unknown {
  if (typeof value !== "object" || value === null) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => fixValue(item));
  }

  if (Object.keys(value).length === 0) {
    return [];
  }

  if (Object.keys(value).length === 1 && "_" in value) {
    return [fixValue(value._)];
  }

  return fixObject(value as Record<string, unknown>);
}

function isArtifactJson(value: unknown): value is ArtifactJson {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return Array.isArray(candidate.abi) && typeof candidate.bytecode === "string";
}

function readArtifact(artifactPath: string): ArtifactJson {
  const raw = fs.readFileSync(artifactPath, "utf8");
  const parsed: unknown = JSON.parse(raw);
  if (!isArtifactJson(parsed)) {
    throw new TypeError(`Invalid artifact format: ${artifactPath}`);
  }
  return parsed;
}

describe("Deuss - smoke tests", () => {
  let ownerSigner: SignerWithAddress;
  const issuerDid = "did:ebsi:deuss-tests";
  const templateVersion = "1.0.0";

  let proxyFactory: IProxyFactory;
  let proxyTemplateRegistry: IProxyTemplateRegistry;

  let bondRegistry: BondRegistry;
  let escrowManager: EscrowManager;
  let interestDiscovery: InterestDiscovery;
  let companyWallet: CompanyWallet;

  let bondRegistryProxyAddress: string;
  let escrowManagerProxyAddress: string;
  let interestDiscoveryProxyAddress: string;
  let companyWalletRegistryProxyAddress: string;
  let companyWalletProxyAddress: string;

  async function deployProxyFromTemplate(
    templateName: string,
    initTypes: string[],
    initValues: unknown[],
  ): Promise<string> {
    const initData = ethers.AbiCoder.defaultAbiCoder().encode(
      initTypes,
      initValues,
    );

    const proxyAddress = await proxyFactory.deployProxy.staticCall(
      templateName,
      templateVersion,
      initData,
      issuerDid,
    );

    await proxyFactory.deployProxy(
      templateName,
      templateVersion,
      initData,
      issuerDid,
    );

    return proxyAddress;
  }

  beforeEach(async () => {
    [ownerSigner] = await ethers.getSigners();

    const didRegistryMock = (await deployFromArtifact(
      path.resolve(
        trustedArtifactsRoot,
        "mocks/DidRegistryMock.sol/DidRegistryMock.json",
      ),
    )) as unknown as DidRegistryMockContract;
    await didRegistryMock.setMockedValue(true);

    const policyRegistryMock = (await deployFromArtifact(
      path.resolve(
        trustedArtifactsRoot,
        "mocks/PolicyRegistryMock.sol/PolicyRegistryMock.json",
      ),
    )) as unknown as PolicyRegistryMockContract;
    await policyRegistryMock.setMockedValue(true);

    const proxyTemplateRegistryContract = await deployUupsProxyFromArtifacts(
      path.resolve(
        trustedArtifactsRoot,
        "ProxyTemplateRegistry.sol/ProxyTemplateRegistry.json",
      ),
      [await policyRegistryMock.getAddress()],
    );
    proxyTemplateRegistry = IProxyTemplateRegistry__factory.connect(
      await proxyTemplateRegistryContract.getAddress(),
      ownerSigner,
    );

    const proxyFactoryContract = await deployUupsProxyFromArtifacts(
      path.resolve(trustedArtifactsRoot, "ProxyFactory.sol/ProxyFactory.json"),
      [
        await proxyTemplateRegistry.getAddress(),
        await didRegistryMock.getAddress(),
        await policyRegistryMock.getAddress(),
      ],
    );
    proxyFactory = IProxyFactory__factory.connect(
      await proxyFactoryContract.getAddress(),
      ownerSigner,
    );

    const addressExtensionsFactory =
      await ethers.getContractFactory("AddressExtensions");
    const addressExtensions = await addressExtensionsFactory.deploy();
    const addressExtensionsAddress = await addressExtensions.getAddress();

    const bondRegistryImplFactory = await ethers.getContractFactory(
      "BondRegistry",
      {
        libraries: { AddressExtensions: addressExtensionsAddress },
      },
    );
    const bondRegistryImpl = await bondRegistryImplFactory.deploy();

    const escrowManagerImplFactory = await ethers.getContractFactory(
      "EscrowManager",
      {
        libraries: { AddressExtensions: addressExtensionsAddress },
      },
    );
    const escrowManagerImpl = await escrowManagerImplFactory.deploy();

    const interestDiscoveryImplFactory = await ethers.getContractFactory(
      "InterestDiscovery",
      {
        libraries: { AddressExtensions: addressExtensionsAddress },
      },
    );
    const interestDiscoveryImpl = await interestDiscoveryImplFactory.deploy();

    const companyWalletRegistryImplFactory = await ethers.getContractFactory(
      "CompanyWalletRegistry",
      {
        libraries: { AddressExtensions: addressExtensionsAddress },
      },
    );
    const companyWalletRegistryImpl =
      await companyWalletRegistryImplFactory.deploy();

    const companyWalletImplFactory = await ethers.getContractFactory(
      "CompanyWallet",
      {
        libraries: { AddressExtensions: addressExtensionsAddress },
      },
    );
    const companyWalletImpl = await companyWalletImplFactory.deploy();

    const beaconFactory = await ethers.getContractFactory(
      "SampleUpgradeableBeaconV5",
    );

    const bondRegistryBeacon = await beaconFactory.deploy(
      await bondRegistryImpl.getAddress(),
      ownerSigner.address,
    );
    const escrowManagerBeacon = await beaconFactory.deploy(
      await escrowManagerImpl.getAddress(),
      ownerSigner.address,
    );
    const interestDiscoveryBeacon = await beaconFactory.deploy(
      await interestDiscoveryImpl.getAddress(),
      ownerSigner.address,
    );
    const companyWalletRegistryBeacon = await beaconFactory.deploy(
      await companyWalletRegistryImpl.getAddress(),
      ownerSigner.address,
    );
    const companyWalletBeacon = await beaconFactory.deploy(
      await companyWalletImpl.getAddress(),
      ownerSigner.address,
    );

    const templates = [
      {
        beacon: await bondRegistryBeacon.getAddress(),
        initSelector: ethers
          .keccak256(ethers.toUtf8Bytes("initialize(address,uint256)"))
          .slice(0, 10),
        name: "BondRegistry",
      },
      {
        beacon: await escrowManagerBeacon.getAddress(),
        initSelector: ethers
          .keccak256(ethers.toUtf8Bytes("initialize(address,address)"))
          .slice(0, 10),
        name: "EscrowManager",
      },
      {
        beacon: await interestDiscoveryBeacon.getAddress(),
        initSelector: ethers
          .keccak256(
            ethers.toUtf8Bytes(
              "initialize(address,uint256,address,address,address,uint256)",
            ),
          )
          .slice(0, 10),
        name: "InterestDiscovery",
      },
      {
        beacon: await companyWalletRegistryBeacon.getAddress(),
        initSelector: ethers
          .keccak256(ethers.toUtf8Bytes("initialize(address)"))
          .slice(0, 10),
        name: "CompanyWalletRegistry",
      },
      {
        beacon: await companyWalletBeacon.getAddress(),
        initSelector: ethers
          .keccak256(ethers.toUtf8Bytes("initialize(address,address)"))
          .slice(0, 10),
        name: "CompanyWallet",
      },
    ];

    for (const template of templates) {
      await proxyTemplateRegistry.addTemplate({
        auditURI: `audit://${template.name}`,
        beaconAddress: template.beacon,
        contractHash: ethers.keccak256(
          ethers.toUtf8Bytes(`contract:${template.name}`),
        ),
        initSelector: template.initSelector,
        isActive: true,
        name: template.name,
        repoURI: `repo://${template.name}`,
        storageLayoutHash: ethers.keccak256(
          ethers.toUtf8Bytes(`storage:${template.name}`),
        ),
        version: templateVersion,
      });
    }

    bondRegistryProxyAddress = await deployProxyFromTemplate(
      "BondRegistry",
      ["address", "uint256"],
      [ownerSigner.address, 30n * 24n * 60n * 60n],
    );

    escrowManagerProxyAddress = await deployProxyFromTemplate(
      "EscrowManager",
      ["address", "address"],
      [ownerSigner.address, ownerSigner.address],
    );

    companyWalletRegistryProxyAddress = await deployProxyFromTemplate(
      "CompanyWalletRegistry",
      ["address"],
      [ownerSigner.address],
    );

    companyWalletProxyAddress = await deployProxyFromTemplate(
      "CompanyWallet",
      ["address", "address"],
      [ownerSigner.address, companyWalletRegistryProxyAddress],
    );

    interestDiscoveryProxyAddress = await deployProxyFromTemplate(
      "InterestDiscovery",
      ["address", "uint256", "address", "address", "address", "uint256"],
      [
        ownerSigner.address,
        24n * 60n * 60n,
        bondRegistryProxyAddress,
        escrowManagerProxyAddress,
        companyWalletRegistryProxyAddress,
        3n,
      ],
    );

    bondRegistry = BondRegistry__factory.connect(
      bondRegistryProxyAddress,
      ownerSigner,
    );
    escrowManager = EscrowManager__factory.connect(
      escrowManagerProxyAddress,
      ownerSigner,
    );
    interestDiscovery = InterestDiscovery__factory.connect(
      interestDiscoveryProxyAddress,
      ownerSigner,
    );
    companyWallet = CompanyWallet__factory.connect(
      companyWalletProxyAddress,
      ownerSigner,
    );
  });

  it("deploys five templates and five proxies through proxy factory", async () => {
    expect(await proxyFactory.getDeployedContractsCount()).to.equal(5n);

    const cwTemplateId = await proxyTemplateRegistry.computeTemplateId(
      "CompanyWallet",
      templateVersion,
    );

    const template = await proxyTemplateRegistry.getTemplate(cwTemplateId);
    const decodedTemplate = decodeResult(template);
    expect(decodedTemplate).to.include({
      isActive: true,
      name: "CompanyWallet",
      version: templateVersion,
    });
    expect(decodedTemplate.beaconAddress).to.not.equal(ethers.ZeroAddress);

    const deploymentInfo = await proxyFactory.getDeploymentInfo(
      companyWalletProxyAddress,
    );
    const decodedDeploymentInfo = decodeResult(deploymentInfo);
    expect(decodedDeploymentInfo).to.include({
      deployer: ownerSigner.address,
      deployerDID: issuerDid,
      isActive: true,
      templateId: cwTemplateId,
    });
  });

  it("uses deployed proxies and validates relevant get flows", async () => {
    expect(await companyWallet.getCompanyWalletRegistry()).to.equal(
      companyWalletRegistryProxyAddress,
    );

    expect(await interestDiscovery.getBondRegistry()).to.equal(
      bondRegistryProxyAddress,
    );
    expect(await interestDiscovery.getEscrowManager()).to.equal(
      escrowManagerProxyAddress,
    );
    expect(await interestDiscovery.getCompanyWalletRegistry()).to.equal(
      companyWalletRegistryProxyAddress,
    );

    const bond = await bondRegistry.getBondById(0);
    const decodedBond = decodeResult(bond);
    expect(decodedBond).to.include({
      issuer: ethers.ZeroAddress,
      tokenAddress: ethers.ZeroAddress,
    });

    const escrow = await escrowManager.getEscrow(1);
    expect(decodeResult(escrow)).to.eql({
      amount: 0n,
      denomination: 0n,
      depositor: ethers.ZeroAddress,
      tokenAddress: ethers.ZeroAddress,
      tokenId: 0n,
    });

    const offer = await interestDiscovery.getOffer(1);
    const decodedOffer = decodeResult(offer);
    expect(decodedOffer).to.include({
      owner: ethers.ZeroAddress,
      tokenAddress: ethers.ZeroAddress,
    });
  });
});
