import { ethers } from "hardhat";

import type { PolicyRegistry } from "@ebsiint-sc/trusted-policies-registry-v3";

async function main() {
  const paginationFactory = await ethers.getContractFactory("Pagination", {});
  const pagination = await paginationFactory.deploy();
  const policyRegistryFactory = await ethers.getContractFactory(
    "PolicyRegistry",
    {
      libraries: {
        Pagination: await pagination.getAddress(),
      },
    },
  );

  const policyContract =
    (await policyRegistryFactory.deploy()) as PolicyRegistry;
  await policyContract.waitForDeployment();

  console.log("Policy deployed at :", await policyContract.getAddress());

  await policyContract.initialize(1n);

  const tirFactory = await ethers.getContractFactory("Tir", {});

  // FIXME
  // @ts-expect-error DIDR address is missing
  const tir = await tirFactory.deploy(await policyContract.getAddress());

  await tir.initialize(25);

  console.log("Trusted Issuers Registry deployed at :", await tir.getAddress());
  console.log(`Contract version set to: ${(await tir.version()).toString()}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
