import { ethers } from "hardhat";

async function main() {
  const proxyDeployedAddr = `0x7FC3C7805095a6863243bFc73Da563A1E1CA2763`;

  const TSC_DIAMOND_STORAGE_SLOT = ethers.keccak256(
    ethers.toUtf8Bytes(
      "diamond.standard.trusted.ledger.smart.contracts.storage",
    ),
  );
  const IMPLEMENTATION_SLOT = ethers.keccak256(
    ethers.toUtf8Bytes("diamond.standard.diamond.storage.proxy"),
  );

  const [deployer, user] = await ethers.getSigners();
  console.log("deployer:", deployer.address, "user:", user.address);

  const proxyCtr = await ethers.getContractAt(
    `OwnedUpgradeabilityProxy`,
    proxyDeployedAddr,
  );

  // these infos are not easily accessible as they are restricted by an onlyAdmin modifier
  // to retrieve them we use the low level getStorage call
  const adminAddr = BigInt(
    await ethers.provider.getStorage(
      await proxyCtr.getAddress(),
      IMPLEMENTATION_SLOT,
    ),
  ).toString(16);
  console.log(`Proxy admin address: ${adminAddr}`);
  // the implementation is in the next storage slot as it is part of the same struct
  const implementationAddr = BigInt(
    await ethers.provider.getStorage(
      await proxyCtr.getAddress(),
      BigInt(IMPLEMENTATION_SLOT) + 1n,
    ),
  ).toString(16);
  console.log(`Proxy implementation address: ${implementationAddr}`);

  const version = BigInt(
    await ethers.provider.getStorage(
      await proxyCtr.getAddress(),
      TSC_DIAMOND_STORAGE_SLOT,
    ),
  ).toString(16);
  console.log(`version : ${version}`);

  const newImplementationAddr = BigInt(
    await ethers.provider.getStorage(
      await proxyCtr.getAddress(),
      BigInt(IMPLEMENTATION_SLOT) + 1n,
    ),
  ).toString(16);
  console.log(`Proxy new implementation address: ${newImplementationAddr}`);

  const newVersion = BigInt(
    await ethers.provider.getStorage(
      await proxyCtr.getAddress(),
      TSC_DIAMOND_STORAGE_SLOT,
    ),
  ).toString(16);
  console.log(`new version : ${newVersion}`);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
