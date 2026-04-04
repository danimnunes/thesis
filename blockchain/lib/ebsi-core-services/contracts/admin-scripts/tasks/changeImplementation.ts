import { task } from "hardhat/config";

import type { ContractTransactionResponse } from "ethers";

import { getDiamondStorage } from "../utils/getDiamondStorage";

interface OwnedUpgradeabilityProxyLike {
  getAddress(): Promise<string>;
  upgradeTo(newImplementation: string): Promise<ContractTransactionResponse>;
}

task("changeImplementation", "change proxy implementation")
  .addParam("proxy", "The proxy address")
  .addParam("implementation", "The implementation contract name")
  .setAction(
    async (
      taskArgs: {
        implementation: string;
        proxy: string;
      },
      { deployments, ethers },
    ) => {
      const proxyDeployedAddr = taskArgs.proxy;
      const storage = getDiamondStorage(taskArgs.implementation);
      const TSC_DIAMOND_STORAGE_SLOT = ethers.keccak256(
        ethers.toUtf8Bytes(storage),
      );

      const IMPLEMENTATION_SLOT = ethers.keccak256(
        ethers.toUtf8Bytes("diamond.standard.diamond.storage.proxy"),
      );

      const proxyCtr = (await ethers.getContractAt(
        `OwnedUpgradeabilityProxy`,
        proxyDeployedAddr,
      )) as unknown as OwnedUpgradeabilityProxyLike;

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
        ),
      ).toString(16);
      console.log(
        `Proxy current implementation address: ${implementationAddr}`,
      );

      const version = BigInt(
        await ethers.provider.getStorage(
          await proxyCtr.getAddress(),
          TSC_DIAMOND_STORAGE_SLOT,
        ),
      ).toString(16);
      console.log(`current version : ${version}`);

      await deployments.run(taskArgs.implementation, {
        writeDeploymentsToFiles: true,
      });
      const ts = await deployments.get(taskArgs.implementation);
      console.log(`${taskArgs.implementation} deployed at ${ts.address} `);
      console.log(`will upgrade to: ${ts.address}`);
      const receipt = await (await proxyCtr.upgradeTo(ts.address)).wait(1);
      if (!receipt) {
        throw new Error("Upgrade transaction failed");
      }

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
      console.log("Initialization:", receipt.status === 1 ? "ok" : "error");
    },
  );
