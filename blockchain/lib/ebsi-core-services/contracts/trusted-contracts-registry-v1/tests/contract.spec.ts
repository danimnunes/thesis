/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unused-expressions */

import { ethers, upgrades } from "hardhat";

import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { expect } from "chai";

describe("Contract Factory System", function () {
  let proxyTemplateRegistry: any;
  let proxyFactory: any;
  let sampleImplementation: any;
  let sampleBeacon: any;
  let didRegistryMock: any;
  let policyRegistryMock: any;

  let owner: SignerWithAddress;
  let admin: SignerWithAddress;
  let trustedIssuer: SignerWithAddress;
  let user: SignerWithAddress;

  const templateName = "SampleContract";
  const templateVersion = "1.0.0";
  const repoURI = "https://github.com/example/sample-contract";
  const auditURI = "https://audit.example.com/sample-contract";
  const contractHash = ethers.keccak256("0x");
  // Compute the correct function selector for initialize(string,string,address,bytes32)
  const initSelector = ethers
    .keccak256(ethers.toUtf8Bytes("initialize(string,string,address,bytes32)"))
    .slice(0, 10);
  const storageLayoutHash = ethers.keccak256("0x");
  const testDID = "did:ebsi:test:123456789";

  before(async function () {
    [owner, admin, trustedIssuer, user] = await ethers.getSigners();
  });

  describe("Deployment", function () {
    it("Should deploy DID Registry Mock", async function () {
      const DidRegistryMock =
        await ethers.getContractFactory("DidRegistryMock");
      didRegistryMock = await DidRegistryMock.deploy();
      await didRegistryMock.waitForDeployment();

      // Setup the DID registry to return true for controller checks
      await didRegistryMock.setMockedValue(true);

      expect(await didRegistryMock.getAddress()).to.not.equal(
        ethers.ZeroAddress,
      );
    });

    it("Should deploy Policy Registry Mock", async function () {
      const PolicyRegistryMock =
        await ethers.getContractFactory("PolicyRegistryMock");
      policyRegistryMock = await PolicyRegistryMock.deploy();
      await policyRegistryMock.waitForDeployment();

      // Setup the policy registry to return true for policy checks
      await policyRegistryMock.setMockedValue(true);

      expect(await policyRegistryMock.getAddress()).to.not.equal(
        ethers.ZeroAddress,
      );
    });

    it("Should deploy ProxyTemplateRegistry as upgradeable proxy", async function () {
      const ProxyTemplateRegistry = await ethers.getContractFactory(
        "ProxyTemplateRegistry",
      );
      proxyTemplateRegistry = await upgrades.deployProxy(
        ProxyTemplateRegistry,
        [await policyRegistryMock.getAddress()],
      );
      await proxyTemplateRegistry.waitForDeployment();

      expect(await proxyTemplateRegistry.getAddress()).to.not.equal(
        ethers.ZeroAddress,
      );
    });

    it("Should deploy ProxyFactory as upgradeable proxy", async function () {
      const ProxyFactory = await ethers.getContractFactory("ProxyFactory");
      proxyFactory = await upgrades.deployProxy(ProxyFactory, [
        await proxyTemplateRegistry.getAddress(),
        await didRegistryMock.getAddress(),
        await policyRegistryMock.getAddress(),
      ]);
      await proxyFactory.waitForDeployment();

      expect(await proxyFactory.getAddress()).to.not.equal(ethers.ZeroAddress);
    });

    it("Should deploy SampleImplementation", async function () {
      const SampleImplementation = await ethers.getContractFactory(
        "SampleImplementation",
      );
      sampleImplementation = await SampleImplementation.deploy();
      await sampleImplementation.waitForDeployment();

      expect(await sampleImplementation.getAddress()).to.not.equal(
        ethers.ZeroAddress,
      );
    });

    it("Should deploy SampleUpgradeableBeacon", async function () {
      const SampleUpgradeableBeacon = await ethers.getContractFactory(
        "SampleUpgradeableBeacon",
      );
      sampleBeacon = await SampleUpgradeableBeacon.deploy(
        await sampleImplementation.getAddress(),
      );
      await sampleBeacon.waitForDeployment();

      expect(await sampleBeacon.getAddress()).to.not.equal(ethers.ZeroAddress);
      expect(await sampleBeacon.implementation()).to.equal(
        await sampleImplementation.getAddress(),
      );
    });
  });

  describe("ProxyTemplateRegistry", function () {
    it("Should add template successfully", async function () {
      const template = {
        auditURI: auditURI,
        beaconAddress: await sampleBeacon.getAddress(),
        contractHash: contractHash,
        initSelector: initSelector,
        isActive: true,
        name: templateName,
        repoURI: repoURI,
        storageLayoutHash: storageLayoutHash,
        version: templateVersion,
      };

      await proxyTemplateRegistry.addTemplate(template);

      const templateId = await proxyTemplateRegistry.computeTemplateId(
        templateName,
        templateVersion,
      );
      const retrievedTemplate =
        await proxyTemplateRegistry.getTemplate(templateId);

      expect(retrievedTemplate.name).to.equal(templateName);
      expect(retrievedTemplate.version).to.equal(templateVersion);
      expect(retrievedTemplate.beaconAddress).to.equal(
        await sampleBeacon.getAddress(),
      );
      expect(retrievedTemplate.isActive).to.be.true;
    });

    it("Should compute correct template ID", async function () {
      const expectedId = ethers.keccak256(
        ethers.AbiCoder.defaultAbiCoder().encode(
          ["string", "string"],
          [templateName, templateVersion],
        ),
      );

      const computedId = await proxyTemplateRegistry.computeTemplateId(
        templateName,
        templateVersion,
      );
      expect(computedId).to.equal(expectedId);
    });

    it("Should deprecate template", async function () {
      const templateId = await proxyTemplateRegistry.computeTemplateId(
        templateName,
        templateVersion,
      );

      await proxyTemplateRegistry.deprecateTemplate(templateId);

      const retrievedTemplate =
        await proxyTemplateRegistry.getTemplate(templateId);
      expect(retrievedTemplate.isActive).to.be.false;
    });

    it("Should update template metadata", async function () {
      const templateId = await proxyTemplateRegistry.computeTemplateId(
        templateName,
        templateVersion,
      );
      const newRepoURI = "https://github.com/example/updated-contract";
      const newAuditURI = "https://audit.example.com/updated-contract";

      await proxyTemplateRegistry.updateTemplateMetadata(
        templateId,
        newRepoURI,
        newAuditURI,
      );

      const retrievedTemplate =
        await proxyTemplateRegistry.getTemplate(templateId);
      expect(retrievedTemplate.repoURI).to.equal(newRepoURI);
      expect(retrievedTemplate.auditURI).to.equal(newAuditURI);
    });

    it("Should get template count", async function () {
      const count = await proxyTemplateRegistry.getTemplateCount();
      expect(count).to.be.greaterThan(0);
    });

    it("Should get template IDs", async function () {
      const result = await proxyTemplateRegistry.getTemplateIds(1, 10);
      const templateIds = result.items;
      expect(templateIds.length).to.be.greaterThan(0);
      expect(result.total).to.be.greaterThan(0);
    });
  });

  describe("ProxyFactory", function () {
    it("Should deploy proxy successfully", async function () {
      // Create a new active template with correct initSelector
      const correctInitSelector = initSelector; // Use the computed selector
      const newTemplate = {
        auditURI: auditURI,
        beaconAddress: await sampleBeacon.getAddress(),
        contractHash: contractHash,
        initSelector: correctInitSelector,
        isActive: true,
        name: "ActiveTemplate",
        repoURI: repoURI,
        storageLayoutHash: storageLayoutHash,
        version: "1.0.0",
      };

      await proxyTemplateRegistry.addTemplate(newTemplate);

      // Create initData without the function selector (it should be added automatically)
      const initData = ethers.AbiCoder.defaultAbiCoder().encode(
        ["string", "string", "address", "bytes32"],
        ["MyInstance", "1.0.0", user.address, ethers.keccak256("0x")],
      );

      const deployTx = await proxyFactory
        .connect(trustedIssuer)
        .deployProxy("ActiveTemplate", "1.0.0", initData, testDID);

      const receipt = await deployTx.wait();
      expect(receipt.status).to.equal(1);
    });

    it("Should get deployment info", async function () {
      const result = await proxyFactory.getDeployedContracts(1, 10);
      const deployedContracts = result.items;
      expect(deployedContracts.length).to.be.greaterThan(0);

      const deploymentInfo = await proxyFactory.getDeploymentInfo(
        deployedContracts[0],
      );
      expect(deploymentInfo.templateId).to.not.equal(ethers.ZeroHash);
      expect(deploymentInfo.deployer).to.not.equal(ethers.ZeroAddress);
      expect(deploymentInfo.isActive).to.be.true;
    });

    it("Should get proxies by DID", async function () {
      const proxies = await proxyFactory.getProxiesByDID(testDID);
      expect(proxies.length).to.be.greaterThan(0);
    });

    it("Should check contract deployment status", async function () {
      const result = await proxyFactory.getDeployedContracts(1, 10);
      const deployedContracts = result.items;
      const isDeployed = await proxyFactory.isContractDeployed(
        deployedContracts[0],
      );
      expect(isDeployed).to.be.true;
    });

    it("Should get contracts by template", async function () {
      const templateId = await proxyTemplateRegistry.computeTemplateId(
        "ActiveTemplate",
        "1.0.0",
      );
      const contracts = await proxyFactory.getContractsByTemplate(templateId);
      expect(contracts.length).to.be.greaterThan(0);
    });
  });

  describe("Access Control", function () {
    it("Should only allow EBSI_ADMIN_ROLE to grant roles", async function () {
      const role = ethers.keccak256(ethers.toUtf8Bytes("EBSI_ADMIN_ROLE"));
      const adminRole = await proxyFactory.getRoleAdmin(role);
      await expect(proxyFactory.connect(user).grantRole(role, user.address))
        .to.be.revertedWithCustomError(
          proxyFactory,
          "AccessControlUnauthorizedAccount",
        )
        .withArgs(user.address, adminRole);
    });

    it("Should only allow authorized users to deploy proxies", async function () {
      // First, ensure the user is not authorized for this DID
      await didRegistryMock.setMockedValue(false);

      const initData = ethers.AbiCoder.defaultAbiCoder().encode(
        ["string", "string", "address", "bytes32"],
        ["Unauthorized", "1.0.0", user.address, ethers.keccak256("0x")],
      );

      await expect(
        proxyFactory
          .connect(user)
          .deployProxy("ActiveTemplate", "1.0.0", initData, testDID),
      ).to.be.revertedWith("Not authorized: missing DID authorization");
    });
  });

  describe("Upgradeability", function () {
    it("Should upgrade ProxyTemplateRegistry", async function () {
      const ProxyTemplateRegistryV2 = await ethers.getContractFactory(
        "ProxyTemplateRegistry",
      );

      await upgrades.upgradeProxy(
        await proxyTemplateRegistry.getAddress(),
        ProxyTemplateRegistryV2,
      );

      // Verify it still works
      const count = await proxyTemplateRegistry.getTemplateCount();
      expect(count).to.be.greaterThan(0);
    });

    it("Should upgrade ProxyFactory", async function () {
      const ProxyFactoryV2 = await ethers.getContractFactory("ProxyFactory");

      await upgrades.upgradeProxy(
        await proxyFactory.getAddress(),
        ProxyFactoryV2,
      );

      // Verify it still works
      const deployedCount = await proxyFactory.getDeployedContractsCount();
      expect(deployedCount).to.be.greaterThan(0);
    });
  });

  describe("Proxy deploying proxies", function () {
    let helloWorldImplementation: any;
    let helloWorldBeacon: any;
    let helloWorldDeployerImplementation: any;
    let helloWorldDeployerBeacon: any;
    let helloWorldDeployerProxy: any;

    const trustedIssuerDID = "did:ebsi:trustedissuer";

    it("Should deploy HelloWorld (SampleImplementation) and create template", async function () {
      // Reset mocked values to true (may have been changed by previous tests)
      await didRegistryMock.setMockedValue(true);
      await policyRegistryMock.setMockedValue(true);

      // Deploy SampleImplementation (HelloWorld)
      const HelloWorldImpl = await ethers.getContractFactory(
        "SampleImplementation",
      );
      helloWorldImplementation = await HelloWorldImpl.deploy();
      await helloWorldImplementation.waitForDeployment();

      expect(await helloWorldImplementation.getAddress()).to.not.equal(
        ethers.ZeroAddress,
      );

      // Deploy beacon for HelloWorld
      const SampleUpgradeableBeacon = await ethers.getContractFactory(
        "SampleUpgradeableBeacon",
      );
      helloWorldBeacon = await SampleUpgradeableBeacon.deploy(
        await helloWorldImplementation.getAddress(),
      );
      await helloWorldBeacon.waitForDeployment();

      expect(await helloWorldBeacon.getAddress()).to.not.equal(
        ethers.ZeroAddress,
      );
      expect(await helloWorldBeacon.implementation()).to.equal(
        await helloWorldImplementation.getAddress(),
      );

      // Create template for HelloWorld
      const helloWorldTemplate = {
        auditURI: auditURI,
        beaconAddress: await helloWorldBeacon.getAddress(),
        contractHash: contractHash,
        initSelector: initSelector,
        isActive: true,
        name: "HelloWorld",
        repoURI: repoURI,
        storageLayoutHash: storageLayoutHash,
        version: "1.0.0",
      };

      await proxyTemplateRegistry.addTemplate(helloWorldTemplate);

      const templateId = await proxyTemplateRegistry.computeTemplateId(
        "HelloWorld",
        "1.0.0",
      );
      const retrievedTemplate =
        await proxyTemplateRegistry.getTemplate(templateId);

      expect(retrievedTemplate.name).to.equal("HelloWorld");
      expect(retrievedTemplate.version).to.equal("1.0.0");
      expect(retrievedTemplate.isActive).to.be.true;
    });

    it("Should deploy HelloWorldDeployer (SampleDeployer) and create template", async function () {
      // Deploy SampleDeployer (HelloWorldDeployer)
      const HelloWorldDeployerImpl =
        await ethers.getContractFactory("SampleDeployer");
      helloWorldDeployerImplementation = await HelloWorldDeployerImpl.deploy();
      await helloWorldDeployerImplementation.waitForDeployment();

      expect(await helloWorldDeployerImplementation.getAddress()).to.not.equal(
        ethers.ZeroAddress,
      );

      // Deploy beacon for HelloWorldDeployer
      const SampleUpgradeableBeacon = await ethers.getContractFactory(
        "SampleUpgradeableBeacon",
      );
      helloWorldDeployerBeacon = await SampleUpgradeableBeacon.deploy(
        await helloWorldDeployerImplementation.getAddress(),
      );
      await helloWorldDeployerBeacon.waitForDeployment();

      expect(await helloWorldDeployerBeacon.getAddress()).to.not.equal(
        ethers.ZeroAddress,
      );
      expect(await helloWorldDeployerBeacon.implementation()).to.equal(
        await helloWorldDeployerImplementation.getAddress(),
      );

      // Compute the initialize function selector for HelloWorldDeployer
      // initialize(address owner, address _proxyFactory)
      const deployerInitSelector = ethers
        .keccak256(ethers.toUtf8Bytes("initialize(address,address)"))
        .slice(0, 10);

      // Create template for HelloWorldDeployer
      const deployerTemplate = {
        auditURI: auditURI,
        beaconAddress: await helloWorldDeployerBeacon.getAddress(),
        contractHash: contractHash,
        initSelector: deployerInitSelector,
        isActive: true,
        name: "HelloWorldDeployer",
        repoURI: repoURI,
        storageLayoutHash: storageLayoutHash,
        version: "1.0.0",
      };

      await proxyTemplateRegistry.addTemplate(deployerTemplate);

      const templateId = await proxyTemplateRegistry.computeTemplateId(
        "HelloWorldDeployer",
        "1.0.0",
      );
      const retrievedTemplate =
        await proxyTemplateRegistry.getTemplate(templateId);

      expect(retrievedTemplate.name).to.equal("HelloWorldDeployer");
      expect(retrievedTemplate.version).to.equal("1.0.0");
      expect(retrievedTemplate.isActive).to.be.true;
    });

    it("Should deploy HelloWorldDeployer proxy using trusted issuer", async function () {
      // Deploy HelloWorldDeployer as a proxy
      const deployerInitData = ethers.AbiCoder.defaultAbiCoder().encode(
        ["address", "address"],
        [trustedIssuer.address, await proxyFactory.getAddress()],
      );

      const deployTx = await proxyFactory
        .connect(trustedIssuer)
        .deployProxy(
          "HelloWorldDeployer",
          "1.0.0",
          deployerInitData,
          trustedIssuerDID,
        );

      const receipt = await deployTx.wait();
      expect(receipt.status).to.equal(1);

      // Get the deployed proxy address from the event
      const event = receipt.logs.find(
        (log: { fragment: { name: string } }) =>
          log.fragment?.name === "ProxyDeployed",
      );
      const deployedProxyAddress = event.args[0];

      // Get the contract instance
      helloWorldDeployerProxy = await ethers.getContractAt(
        "SampleDeployer",
        deployedProxyAddress,
      );

      expect(await helloWorldDeployerProxy.getAddress()).to.not.equal(
        ethers.ZeroAddress,
      );
      expect(await helloWorldDeployerProxy.owner()).to.equal(
        trustedIssuer.address,
      );
      expect(await helloWorldDeployerProxy.proxyFactory()).to.equal(
        await proxyFactory.getAddress(),
      );

      // Verify deployment info
      const deploymentInfo = await proxyFactory.getDeploymentInfo(
        await helloWorldDeployerProxy.getAddress(),
      );
      expect(deploymentInfo.deployerDID).to.equal(trustedIssuerDID);
      expect(deploymentInfo.isActive).to.be.true;
    });

    it("Should deploy HelloWorld proxy from HelloWorldDeployer using different user", async function () {
      // Prepare initData for deploying a HelloWorld proxy
      const helloWorldInitData = ethers.AbiCoder.defaultAbiCoder().encode(
        ["string", "string", "address", "bytes32"],
        ["MyHelloWorld", "1.0.0", user.address, ethers.keccak256("0x")],
      );

      // User calls deployHelloWorldProxy from the HelloWorldDeployer contract
      // the DID registry should not be called
      await didRegistryMock.setMockedValue(false);

      const deployTx = await helloWorldDeployerProxy
        .connect(user)
        .deployHelloWorldProxy(helloWorldInitData);

      const receipt = await deployTx.wait();
      expect(receipt.status).to.equal(1);

      // Get the ProxyDeployed event from the ProxyFactory contract
      const proxyDeployedEvent = receipt.logs
        .map((log: unknown) => {
          try {
            return proxyFactory.interface.parseLog(log) as unknown;
          } catch {
            return;
          }
        })
        .find((parsed: { name: string }) => parsed?.name === "ProxyDeployed");

      expect(proxyDeployedEvent).to.not.be.undefined;
      const helloWorldProxyAddress = proxyDeployedEvent.args[0];
      expect(helloWorldProxyAddress).to.not.equal(ethers.ZeroAddress);

      // Verify deployment info
      const deploymentInfo = await proxyFactory.getDeploymentInfo(
        helloWorldProxyAddress,
      );
      expect(deploymentInfo.deployer).to.equal(
        await helloWorldDeployerProxy.getAddress(),
      );
      expect(deploymentInfo.deployerDID).to.equal(trustedIssuerDID);
      expect(deploymentInfo.isActive).to.be.true;

      // Verify the deployed contract is a HelloWorld instance
      const helloWorldProxy = await ethers.getContractAt(
        "SampleImplementation",
        helloWorldProxyAddress,
      );
      expect(await helloWorldProxy.name()).to.equal("MyHelloWorld");
      expect(await helloWorldProxy.version()).to.equal("1.0.0");
    });

    it("Should reject deployment from a non-registered contract", async function () {
      // Deploy SimpleDeployer directly (not through ProxyFactory)
      const SimpleDeployerFactory =
        await ethers.getContractFactory("SimpleDeployer");
      const simpleDeployerImpl = await SimpleDeployerFactory.deploy(
        await proxyFactory.getAddress(),
      );
      await simpleDeployerImpl.waitForDeployment();

      const notTrustedContract: any = await ethers.getContractAt(
        "SimpleDeployer",
        await simpleDeployerImpl.getAddress(),
      );

      expect(await notTrustedContract.getAddress()).to.not.equal(
        ethers.ZeroAddress,
      );

      // Verify this contract is not registered in the ProxyFactory
      const deploymentInfo = await proxyFactory.getDeploymentInfo(
        await notTrustedContract.getAddress(),
      );
      expect(deploymentInfo.isActive).to.be.false;
      expect(deploymentInfo.deployer).to.equal(ethers.ZeroAddress);

      // Prepare initData for deploying a HelloWorld proxy
      const helloWorldInitData = ethers.AbiCoder.defaultAbiCoder().encode(
        ["string", "string", "address", "bytes32"],
        [
          "UnauthorizedHelloWorld",
          "1.0.0",
          user.address,
          ethers.keccak256("0x"),
        ],
      );

      // Reset mocked values to true to ensure policy check passes
      await didRegistryMock.setMockedValue(true);
      await policyRegistryMock.setMockedValue(true);

      // Try to deploy a proxy from the non-registered contract
      // This should fail because the contract is not active in the ProxyFactory
      await expect(
        notTrustedContract
          .connect(user)
          .deployHelloWorldProxy(helloWorldInitData),
      ).to.be.revertedWith("Not authorized: contract is not active");
    });
  });

  describe("Additional ProxyFactory Functions", function () {
    it("Should get deployment info for non-existent contract", async function () {
      const deploymentInfo = await proxyFactory.getDeploymentInfo(
        ethers.ZeroAddress,
      );
      expect(deploymentInfo.deployer).to.equal(ethers.ZeroAddress);
      expect(deploymentInfo.templateId).to.equal(ethers.ZeroHash);
      expect(deploymentInfo.isActive).to.be.false;
    });

    it("Should check contract deployment status for non-existent contract", async function () {
      const isDeployed = await proxyFactory.isContractDeployed(
        ethers.ZeroAddress,
      );
      expect(isDeployed).to.be.false;
    });

    it("Should get proxies by DID for non-existent DID", async function () {
      const proxies = await proxyFactory.getProxiesByDID(
        "did:ebsi:nonexistent:123",
      );
      expect(proxies.length).to.equal(0);
    });

    it("Should get contracts by template for non-existent template", async function () {
      const nonExistentTemplateId = ethers.keccak256("0x");
      const contracts = await proxyFactory.getContractsByTemplate(
        nonExistentTemplateId,
      );
      expect(contracts.length).to.equal(0);
    });

    it("Should get deployment for specific contract", async function () {
      const result = await proxyFactory.getDeployedContracts(1, 10);
      const deployedContracts = result.items;
      if (deployedContracts.length > 0) {
        const deployment = await proxyFactory.getDeployment(
          deployedContracts[0],
        );
        expect(deployment.deployer).to.not.equal(ethers.ZeroAddress);
        expect(deployment.templateId).to.not.equal(ethers.ZeroHash);
      }
    });

    it("Should get proxies by DID count", async function () {
      const count = await proxyFactory.getProxiesByDIDCount(testDID);
      expect(count).to.be.greaterThan(0);
    });

    it("Should get proxies by DID at specific index", async function () {
      const count = await proxyFactory.getProxiesByDIDCount(testDID);
      if (count > 0) {
        const proxy = await proxyFactory.getProxiesByDIDAtIndex(testDID, 0);
        expect(proxy).to.not.equal(ethers.ZeroAddress);
      }
    });

    it("Should fail to get proxies by DID at invalid index", async function () {
      const count = await proxyFactory.getProxiesByDIDCount(testDID);
      await expect(
        proxyFactory.getProxiesByDIDAtIndex(testDID, Number(count) + 1),
      ).to.be.revertedWith("Index out of bounds");
    });

    it("Should revoke role", async function () {
      const role = ethers.keccak256(ethers.toUtf8Bytes("EBSI_ADMIN_ROLE"));
      // First grant the role to admin
      await proxyFactory.grantRole(role, admin.address);
      // Then revoke it
      await proxyFactory.revokeRole(role, admin.address);

      const hasRole = await proxyFactory.hasRole(role, admin.address);
      expect(hasRole).to.be.false;
    });

    it("Should check role for account", async function () {
      const role = await proxyFactory.DEFAULT_ADMIN_ROLE();
      // Owner should have DEFAULT_ADMIN_ROLE granted during initialization
      const hasRole = await proxyFactory.hasRole(role, owner.address);
      expect(hasRole).to.be.true;
    });
  });

  describe("Additional ProxyTemplateRegistry Functions", function () {
    it("Should check if template is active", async function () {
      const templateId = await proxyTemplateRegistry.computeTemplateId(
        "ActiveTemplate",
        "1.0.0",
      );
      const isActive = await proxyTemplateRegistry.isTemplateActive(templateId);
      expect(isActive).to.be.true;
    });

    it("Should check if non-existent template is active", async function () {
      const nonExistentTemplateId = ethers.keccak256("0x");
      const isActive = await proxyTemplateRegistry.isTemplateActive(
        nonExistentTemplateId,
      );
      expect(isActive).to.be.false;
    });

    it("Should fail to add template with empty name", async function () {
      const invalidTemplate = {
        auditURI: auditURI,
        beaconAddress: await sampleBeacon.getAddress(),
        contractHash: contractHash,
        initSelector: initSelector,
        isActive: true,
        name: "",
        repoURI: repoURI,
        storageLayoutHash: storageLayoutHash,
        version: "1.0.0",
      };

      await expect(
        proxyTemplateRegistry.addTemplate(invalidTemplate),
      ).to.be.revertedWith("Template name cannot be empty");
    });

    it("Should fail to add template with empty version", async function () {
      const invalidTemplate = {
        auditURI: auditURI,
        beaconAddress: await sampleBeacon.getAddress(),
        contractHash: contractHash,
        initSelector: initSelector,
        isActive: true,
        name: "TestTemplate",
        repoURI: repoURI,
        storageLayoutHash: storageLayoutHash,
        version: "",
      };

      await expect(
        proxyTemplateRegistry.addTemplate(invalidTemplate),
      ).to.be.revertedWith("Template version cannot be empty");
    });

    it("Should fail to add template with zero beacon address", async function () {
      const invalidTemplate = {
        auditURI: auditURI,
        beaconAddress: ethers.ZeroAddress,
        contractHash: contractHash,
        initSelector: initSelector,
        isActive: true,
        name: "TestTemplate",
        repoURI: repoURI,
        storageLayoutHash: storageLayoutHash,
        version: "1.0.0",
      };

      await expect(
        proxyTemplateRegistry.addTemplate(invalidTemplate),
      ).to.be.revertedWith("Beacon address cannot be zero");
    });

    it("Should fail to add template with empty repo URI", async function () {
      const invalidTemplate = {
        auditURI: auditURI,
        beaconAddress: await sampleBeacon.getAddress(),
        contractHash: contractHash,
        initSelector: initSelector,
        isActive: true,
        name: "TestTemplate",
        repoURI: "",
        storageLayoutHash: storageLayoutHash,
        version: "1.0.0",
      };

      await expect(
        proxyTemplateRegistry.addTemplate(invalidTemplate),
      ).to.be.revertedWith("Repository URI cannot be empty");
    });

    it("Should fail to add template with empty audit URI", async function () {
      const invalidTemplate = {
        auditURI: "",
        beaconAddress: await sampleBeacon.getAddress(),
        contractHash: contractHash,
        initSelector: initSelector,
        isActive: true,
        name: "TestTemplate",
        repoURI: repoURI,
        storageLayoutHash: storageLayoutHash,
        version: "1.0.0",
      };

      await expect(
        proxyTemplateRegistry.addTemplate(invalidTemplate),
      ).to.be.revertedWith("Audit URI cannot be empty");
    });

    it("Should fail to add template with zero contract hash", async function () {
      const invalidTemplate = {
        auditURI: auditURI,
        beaconAddress: await sampleBeacon.getAddress(),
        contractHash: ethers.ZeroHash,
        initSelector: initSelector,
        isActive: true,
        name: "TestTemplate",
        repoURI: repoURI,
        storageLayoutHash: storageLayoutHash,
        version: "1.0.0",
      };

      await expect(
        proxyTemplateRegistry.addTemplate(invalidTemplate),
      ).to.be.revertedWith("Contract hash cannot be zero");
    });

    it("Should fail to add template with zero storage layout hash", async function () {
      const invalidTemplate = {
        auditURI: auditURI,
        beaconAddress: await sampleBeacon.getAddress(),
        contractHash: contractHash,
        initSelector: initSelector,
        isActive: true,
        name: "TestTemplate",
        repoURI: repoURI,
        storageLayoutHash: ethers.ZeroHash,
        version: "1.0.0",
      };

      await expect(
        proxyTemplateRegistry.addTemplate(invalidTemplate),
      ).to.be.revertedWith("Storage layout hash cannot be zero");
    });

    it("Should fail to add duplicate template", async function () {
      const duplicateTemplate = {
        auditURI: auditURI,
        beaconAddress: await sampleBeacon.getAddress(),
        contractHash: contractHash,
        initSelector: initSelector,
        isActive: true,
        name: "ActiveTemplate",
        repoURI: repoURI,
        storageLayoutHash: storageLayoutHash,
        version: "1.0.0",
      };

      await expect(
        proxyTemplateRegistry.addTemplate(duplicateTemplate),
      ).to.be.revertedWith("Template already exists");
    });

    it("Should fail to deprecate non-existent template", async function () {
      const nonExistentTemplateId = ethers.keccak256("0x");
      await expect(
        proxyTemplateRegistry.deprecateTemplate(nonExistentTemplateId),
      ).to.be.revertedWith("Template does not exist");
    });

    it("Should fail to deprecate already deprecated template", async function () {
      const templateId = await proxyTemplateRegistry.computeTemplateId(
        "ActiveTemplate",
        "1.0.0",
      );

      // Deprecate first time
      await proxyTemplateRegistry.deprecateTemplate(templateId);

      // Try to deprecate again
      await expect(
        proxyTemplateRegistry.deprecateTemplate(templateId),
      ).to.be.revertedWith("Template already deprecated");
    });

    it("Should fail to update metadata for non-existent template", async function () {
      const nonExistentTemplateId = ethers.keccak256("0x");
      await expect(
        proxyTemplateRegistry.updateTemplateMetadata(
          nonExistentTemplateId,
          "new-repo",
          "new-audit",
        ),
      ).to.be.revertedWith("Template does not exist");
    });

    it("Should fail to update metadata with empty repo URI", async function () {
      const templateId = await proxyTemplateRegistry.computeTemplateId(
        "ActiveTemplate",
        "1.0.0",
      );
      await expect(
        proxyTemplateRegistry.updateTemplateMetadata(
          templateId,
          "",
          "new-audit",
        ),
      ).to.be.revertedWith("Repository URI cannot be empty");
    });

    it("Should fail to update metadata with empty audit URI", async function () {
      const templateId = await proxyTemplateRegistry.computeTemplateId(
        "ActiveTemplate",
        "1.0.0",
      );
      await expect(
        proxyTemplateRegistry.updateTemplateMetadata(
          templateId,
          "new-repo",
          "",
        ),
      ).to.be.revertedWith("Audit URI cannot be empty");
    });

    it("Should revoke role in registry", async function () {
      const role = await proxyTemplateRegistry.DEFAULT_ADMIN_ROLE();
      // First grant the role to admin, then revoke it
      await proxyTemplateRegistry.grantRole(role, admin.address);
      await proxyTemplateRegistry.revokeRole(role, admin.address);

      const hasRole = await proxyTemplateRegistry.hasRole(role, admin.address);
      expect(hasRole).to.be.false;
    });

    it("Should check role in registry", async function () {
      const role = await proxyTemplateRegistry.DEFAULT_ADMIN_ROLE();
      const hasRole = await proxyTemplateRegistry.hasRole(role, owner.address);
      expect(hasRole).to.be.true;
    });
  });

  describe("Edge Cases and Error Handling", function () {
    it("Should handle deployProxy with empty template name", async function () {
      const initData = ethers.AbiCoder.defaultAbiCoder().encode(
        ["string", "string", "address", "bytes32"],
        ["Test", "1.0.0", user.address, ethers.keccak256("0x")],
      );
      await didRegistryMock.setMockedValue(true);
      await policyRegistryMock.setMockedValue(true);

      await expect(
        proxyFactory
          .connect(trustedIssuer)
          .deployProxy("", "1.0.0", initData, testDID),
      ).to.be.revertedWith("Template name required");
    });

    it("Should handle deployProxy with empty template version", async function () {
      const initData = ethers.AbiCoder.defaultAbiCoder().encode(
        ["string", "string", "address", "bytes32"],
        ["Test", "1.0.0", user.address, ethers.keccak256("0x")],
      );

      await expect(
        proxyFactory
          .connect(trustedIssuer)
          .deployProxy("Test", "", initData, testDID),
      ).to.be.revertedWith("Template version required");
    });

    it("Should handle deployProxy with non-existent template", async function () {
      const initData = ethers.AbiCoder.defaultAbiCoder().encode(
        ["string", "string", "address", "bytes32"],
        ["Test", "1.0.0", user.address, ethers.keccak256("0x")],
      );

      await expect(
        proxyFactory
          .connect(trustedIssuer)
          .deployProxy("NonExistent", "1.0.0", initData, testDID),
      ).to.be.revertedWith("Template not found");
    });

    it("Should handle deployProxy with inactive template", async function () {
      // Create a fresh template for this test
      const freshTemplate = {
        auditURI: auditURI,
        beaconAddress: await sampleBeacon.getAddress(),
        contractHash: contractHash,
        initSelector: initSelector,
        isActive: true,
        name: "InactiveTemplate",
        repoURI: repoURI,
        storageLayoutHash: storageLayoutHash,
        version: "1.0.0",
      };

      await proxyTemplateRegistry.addTemplate(freshTemplate);

      // Now deprecate the fresh template
      const templateId = await proxyTemplateRegistry.computeTemplateId(
        "InactiveTemplate",
        "1.0.0",
      );
      await proxyTemplateRegistry.deprecateTemplate(templateId);

      const initData = ethers.AbiCoder.defaultAbiCoder().encode(
        ["string", "string", "address", "bytes32"],
        ["Test", "1.0.0", user.address, ethers.keccak256("0x")],
      );

      await expect(
        proxyFactory
          .connect(trustedIssuer)
          .deployProxy("InactiveTemplate", "1.0.0", initData, testDID),
      ).to.be.revertedWith("Template not active");
    });
  });
});
