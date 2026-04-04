import { ethers } from "hardhat";
import type { Artifact } from "hardhat/types/index.js";

import fs from "node:fs";
import path from "node:path";

async function main() {
  const paginationFactory = await ethers.getContractFactory("Pagination", {});
  const pagination = await paginationFactory.deploy();

  const artifact = JSON.parse(
    fs.readFileSync(
      path.join(
        __dirname,
        "../../",
        "trusted-policies-registry-v3/artifacts",
        "contracts/trusted-policies-registry/PolicyRegistry.sol",
        "PolicyRegistry.json",
      ),
      { encoding: "utf8" },
    ),
  ) as unknown as Artifact;
  const policyRegistryFactory = await ethers.getContractFactoryFromArtifact(
    artifact,
    {
      libraries: {
        Pagination: await pagination.getAddress(),
      },
    },
  );
  const policyContract = await policyRegistryFactory.deploy();
  await policyContract.waitForDeployment();

  console.log("Policy deployed at :", await policyContract.getAddress());

  await policyContract.initialize(1n);

  const vRelationshipsFactory =
    await ethers.getContractFactory("VRelationshipsLib");
  const vRelationshipsLib = await vRelationshipsFactory.deploy();

  const didDocumentFactory = await ethers.getContractFactory("DidDocumentLib", {
    libraries: {
      Pagination: await pagination.getAddress(),
      VRelationshipsLib: await vRelationshipsLib.getAddress(),
    },
  });
  const didDocumentLib = await didDocumentFactory.deploy();

  const controllersFactory = await ethers.getContractFactory("ControllersLib", {
    libraries: {
      Pagination: await pagination.getAddress(),
    },
  });
  const controllersLib = await controllersFactory.deploy();

  const contractFactory = await ethers.getContractFactory("DidRegistry", {
    libraries: {
      ControllersLib: await controllersLib.getAddress(),
      DidDocumentLib: await didDocumentLib.getAddress(),
      VRelationshipsLib: await vRelationshipsLib.getAddress(),
    },
  });
  const ts = await contractFactory.deploy(await policyContract.getAddress());
  await ts.initialize(16);

  console.log("DID Registry deployed at :", await ts.getAddress());
  console.log(`Contract version set to: ${(await ts.version()).toString()}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
