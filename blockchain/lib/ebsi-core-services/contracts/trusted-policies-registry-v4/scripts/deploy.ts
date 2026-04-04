import { ethers } from "hardhat";

async function main() {
  const paginationFactory = await ethers.getContractFactory("Pagination");
  const pagination = await paginationFactory.deploy();
  const policyRegistryFactory = await ethers.getContractFactory(
    "PolicyRegistry",
    {
      libraries: {
        Pagination: await pagination.getAddress(),
      },
    },
  );
  const policyContract = await policyRegistryFactory.deploy();
  await policyContract.waitForDeployment();

  console.log("Policy deployed at :", await policyContract.getAddress());

  await policyContract.initialize();

  console.log("Policy contract initialized");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
