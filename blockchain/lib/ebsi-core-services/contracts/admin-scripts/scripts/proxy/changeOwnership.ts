// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
import { deployments, ethers } from "hardhat";

import type { ContractTransactionResponse } from "ethers";

interface OwnedUpgradeabilityProxyLike {
  changeAdmin(newAdmin: string): Promise<ContractTransactionResponse>;
  getAddress(): Promise<string>;
}

async function main() {
  // This can run only after Timestamp have been deployed with a proxy
  const [multiSig] = await ethers.getSigners();
  // We get contracts already deployed
  const dProxy = await deployments.get("OwnedUpgradeabilityProxy");
  console.log(`dProxy ${dProxy.address} `);
  const proxyFactory = await ethers.getContractFactory(
    "OwnedUpgradeabilityProxy",
  );

  const proxy = proxyFactory.attach(
    dProxy.address,
  ) as unknown as OwnedUpgradeabilityProxyLike;

  const res = await (await proxy.changeAdmin(multiSig.address)).wait(1);

  if (!res) {
    throw new Error("Transaction failed");
  }

  const tx = await res.getTransaction();

  console.log(
    `
    Proxy:${await proxy.getAddress()}
    New admin:${multiSig.address}
    TransactionHash:${tx.hash}
    Status:${res.status === 1 ? "ok" : "error"}
    `,
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
