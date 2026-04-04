import { ethers } from "hardhat";
import type { HardhatRuntimeEnvironment } from "hardhat/types/index.js";

import type { DeployFunction } from "hardhat-deploy/types";

import dependencies from "./dependencies.json";

function validateChainId(
  chainId: string,
): asserts chainId is keyof typeof dependencies {
  if (!(chainId in dependencies)) throw new Error(`Invalid chainId ${chainId}`);
}

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { deployments, getNamedAccounts } = hre;

  const { deployer } = await getNamedAccounts();

  // get Proxy of TPR and didr - deployed new ones for undefined vars
  const chainId = `${(await ethers.provider.getNetwork()).chainId}`;

  validateChainId(chainId);

  console.log(`chain id ${chainId}`);

  const deps = dependencies[chainId];

  if (!("tprV3Address" in deps)) {
    throw new Error("tprV3Address does not exist");
  }

  let tprAddress = deps.tprV3Address;

  if (!ethers.isAddress(tprAddress)) {
    console.log(`Deploying TPR for testnet`);
    // deploy for testnet
    await deployments.run("PolicyRegistryV3");
    tprAddress = (await deployments.get("PolicyRegistryV3")).address;
  }

  if (!("didV5Address" in deps)) {
    throw new Error("didV5Address does not exist");
  }

  let didAddress = deps.didV5Address;

  if (!ethers.isAddress(didAddress)) {
    console.log(`Deploying DIDr for testnet`);
    // deploy for testnet
    await deployments.run("DidRegistryV5");
    didAddress = (await deployments.get("DidRegistryV5")).address;
  }

  console.log(`Registry addresses did: ${didAddress}, tpr: ${tprAddress}`);

  const ts = await deployments.deploy("TirV5", {
    args: [tprAddress, didAddress],
    contract: "contracts/trusted-issuers-registry-v5/tir/Tir.sol:Tir",
    from: deployer,
    log: true,
  });

  deployments.log("Trusted Issuers Registry v5 deployed at:", ts.address);
};

func.tags = ["TirV5"];

export default func;
