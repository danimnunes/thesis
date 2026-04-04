import { task } from "hardhat/config";

task("getImplementation", "get proxy implementation address")
  .addParam("proxy", "The proxy address")
  .addParam("implementation", "The implementation contract name")
  .addParam("block", "the block number to get the implementation from")
  .setAction(
    async (
      taskArgs: {
        block: string;
        implementation: string;
        proxy: string;
      },
      { ethers },
    ) => {
      const proxyDeployedAddr = taskArgs.proxy;

      const IMPLEMENTATION_SLOT = ethers.keccak256(
        ethers.toUtf8Bytes("diamond.standard.diamond.storage.proxy"),
      );

      const proxyCtr = await ethers.getContractAt(
        `OwnedUpgradeabilityProxy`,
        proxyDeployedAddr,
      );

      // these infos are not easily accessible as they are restricted by an onlyAdmin modifier
      // to retrieve them we use the low level getStorage call
      const adminAddr =
        "0x" +
        BigInt(
          await ethers.provider.getStorage(
            await proxyCtr.getAddress(),
            IMPLEMENTATION_SLOT,
          ),
        ).toString(16);
      console.log(`Proxy admin address: ${adminAddr}`);
      const [signers] = await ethers.getSigners();
      console.log(`Deployer address: ${signers.address}`);
      if (signers.address.toLowerCase() !== adminAddr.toLowerCase()) {
        console.log(`Transaction will fail because not the correct admin`);
        process.exit(0);
      }
      // the implementation is in the next storage slot as it is part of the same struct
      const implementationAddr = BigInt(
        await ethers.provider.getStorage(
          await proxyCtr.getAddress(),
          BigInt(IMPLEMENTATION_SLOT) + 1n,
          BigInt(taskArgs.block),
        ),
      ).toString(16);
      console.log(
        `Proxy current implementation address: ${implementationAddr}`,
      );
    },
  );

task("getImplementationUUPS", "get proxy implementation address")
  .addParam("proxy", "The proxy address")
  .addParam("block", "the block number to get the implementation from")
  .setAction(
    async (
      taskArgs: {
        block: string;
        proxy: string;
      },
      { ethers },
    ) => {
      const uupsSlot =
        "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";

      // the implementation is in the next storage slot as it is part of the same struct
      const implementationAddr = BigInt(
        await ethers.provider.getStorage(
          taskArgs.proxy,
          BigInt(uupsSlot),
          BigInt(taskArgs.block),
        ),
      ).toString(16);
      console.log(
        `Proxy current implementation address: ${implementationAddr}`,
      );
    },
  );
