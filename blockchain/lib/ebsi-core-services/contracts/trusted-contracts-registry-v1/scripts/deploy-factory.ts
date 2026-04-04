import { ethers, upgrades } from "hardhat";

async function main() {
  console.log("Deploying Contract Factory System...");

  // Get signers
  const [deployer] = await ethers.getSigners();

  console.log("Deploying with account:", await deployer.getAddress());
  const balance = await deployer.provider?.getBalance(
    await deployer.getAddress(),
  );
  console.log("Account balance:", balance ? balance.toString() : "Unknown");

  // 1. Deploy ProxyTemplateRegistry
  console.log("\n1. Deploying ProxyTemplateRegistry...");
  const ProxyTemplateRegistry = await ethers.getContractFactory(
    "ProxyTemplateRegistry",
  );

  const templateRegistry = await upgrades.deployProxy(
    ProxyTemplateRegistry,
    [],
  );
  await templateRegistry.waitForDeployment();
  console.log(
    "ProxyTemplateRegistry deployed to:",
    await templateRegistry.getAddress(),
  );

  // 2. Deploy DID Registry
  console.log("\n2. Deploying DID Registry...");
  const DidRegistryMock = await ethers.getContractFactory("DidRegistryMock");
  const didRegistry = await DidRegistryMock.deploy();
  await didRegistry.waitForDeployment();
  console.log("DidRegistryMock deployed to:", await didRegistry.getAddress());

  // 3. Deploy Policy Registry
  console.log("\n3. Deploying Policy Registry...");
  const PolicyRegistryMock =
    await ethers.getContractFactory("PolicyRegistryMock");
  const policyRegistry = await PolicyRegistryMock.deploy();
  await policyRegistry.waitForDeployment();
  console.log(
    "PolicyRegistryMock deployed to:",
    await policyRegistry.getAddress(),
  );

  // 4. Deploy ProxyFactory
  console.log("\n4. Deploying ProxyFactory...");
  const ProxyFactory = await ethers.getContractFactory("ProxyFactory");
  const proxyFactory = await upgrades.deployProxy(ProxyFactory, [
    await templateRegistry.getAddress(),
    await didRegistry.getAddress(),
    await policyRegistry.getAddress(),
  ]);
  await proxyFactory.waitForDeployment();
  console.log("ProxyFactory deployed to:", await proxyFactory.getAddress());
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
