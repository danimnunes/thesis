import { task } from "hardhat/config";

import type { ContractTransactionResponse } from "ethers";

import { getDiamondStorage } from "../utils/getDiamondStorage";

interface OwnedUpgradeabilityProxyLike {
  ["initialize(address,address,bytes)"](
    implementation: string,
    admin: string,
    data: string,
  ): Promise<ContractTransactionResponse>;
  getAddress(): Promise<string>;
}

task("initProxy", "init proxy with implementation")
  .addParam("proxy", "The proxy address")
  .addParam("implementation", "The implementation contract name")
  .addOptionalParam("scversion", "Version of the contract")
  .setAction(
    async (
      taskArgs: {
        implementation: string;
        proxy: string;
        scversion: string;
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
      let adminAddr = "0x0";
      try {
        console.log("ASD2");
        adminAddr = BigInt(
          await ethers.provider.getStorage(
            await proxyCtr.getAddress(),
            IMPLEMENTATION_SLOT,
          ),
        ).toString(16);
        console.log("ASD3");
        // eslint-disable-next-line no-empty
      } catch {}
      console.log(`Proxy admin address: ${adminAddr}`);
      // the implementation is in the next storage slot as it is part of the same struct
      let implementationAddr = "0x0";
      try {
        implementationAddr = BigInt(
          await ethers.provider.getStorage(
            await proxyCtr.getAddress(),
            BigInt(IMPLEMENTATION_SLOT) + 1n,
          ),
        ).toString(16);
        // eslint-disable-next-line no-empty
      } catch {}
      console.log(
        `Proxy current implementation address: ${implementationAddr}`,
      );
      let version = "0x0";
      try {
        version = BigInt(
          await ethers.provider.getStorage(
            await proxyCtr.getAddress(),
            TSC_DIAMOND_STORAGE_SLOT,
          ),
        ).toString(16);
        // eslint-disable-next-line no-empty
      } catch {}
      console.log(`current version : ${version}`);

      await deployments.run(taskArgs.implementation);
      const ts = await deployments.get(taskArgs.implementation);
      console.log(`${taskArgs.implementation} deployed at ${ts.address} `);

      const ifaceSetVersion = new ethers.Interface([
        "function initialize(uint256 version)",
      ]);
      const setVersionData = ifaceSetVersion.encodeFunctionData("initialize", [
        1n,
      ]);
      const accounts = await ethers.getSigners();

      console.log(`will init and set version with data: ${setVersionData}`);
      const receipt = await (
        await proxyCtr["initialize(address,address,bytes)"](
          ts.address,
          accounts[0].address,
          setVersionData,
        )
      ).wait(1);
      if (!receipt) {
        throw new Error("Initialize transaction failed");
      }
      console.log(receipt);

      const newImplementationAddr = BigInt(
        await ethers.provider.getStorage(
          await proxyCtr.getAddress(),
          BigInt(IMPLEMENTATION_SLOT) + 1n,
        ),
      ).toString(16);
      console.log(`Proxy implementation address: ${newImplementationAddr}`);

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
