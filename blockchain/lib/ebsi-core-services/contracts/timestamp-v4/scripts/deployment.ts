// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
import { ethers } from "hardhat";

async function main() {
  // Hardhat always runs the compile task when running scripts with its command
  // line interface.
  //
  // If this script is run directly using `node` you may want to call compile
  // manually to make sure everything is compiled
  // await hre.run('compile');

  // We get the contract to deploy
  const haFactory = await ethers.getContractFactory("HashAlgoLib");
  const haLib = await haFactory.deploy();
  const tsFactory = await ethers.getContractFactory("TimestampLib", {});
  const tsLib = await tsFactory.deploy();
  const stringManipFactory = await ethers.getContractFactory("StringManip", {});
  const stringManipLib = await stringManipFactory.deploy();

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

  // @ts-expect-error TPR address is missing...
  const ts = await contractFactory.deploy();

  console.log(
    `Timestamp deployed to: ${await ts.getAddress()}
   HashAlgoLib deployed to: ${await haLib.getAddress()}
   TimestampLib deployed to: ${await tsLib.getAddress()}
   RecordLib deployed to: ${await rsLib.getAddress()}
   stringManipLib deployed to: ${await stringManipLib.getAddress()}`,
  );
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
