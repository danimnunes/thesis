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

  // get Proxy of TPR
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
  console.log(`Trusted Policy Registry Address is ${tprAddress}`);

  const optsPagination = {
    from: deployer,
    log: true,
  };

  const controller = await deployments.deploy("ControllersLib", {
    ...optsPagination,
    contract:
      "contracts/did-registry-v5/did-registry/ControllersLib.sol:ControllersLib",
  });
  console.log(`Controller deployed;`);

  const optsv = {
    from: deployer,
    log: true,
  };
  const vRelation = await deployments.deploy("VRelationshipsLib", {
    ...optsv,
    contract:
      "contracts/did-registry-v5/did-registry/VRelationshipsLib.sol/VRelationshipsLib",
  });
  console.log(`VRelationships lib deployed`);
  const optsPagVrel = {
    from: deployer,
    libraries: {
      VRelationshipsLib: vRelation.address,
    },
    log: true,
  };
  const didDocument = await deployments.deploy("DidDocumentLib", {
    ...optsPagVrel,
    contract:
      "contracts/did-registry-v5/did-registry/DidDocumentLib.sol:DidDocumentLib",
  });

  console.log(`Did Document deployed;`);

  const ts = await deployments.deploy("DidRegistryV5", {
    args: [tprAddress],
    contract:
      "contracts/did-registry-v5/did-registry/DidRegistry.sol:DidRegistry",
    from: deployer,
    libraries: {
      ControllersLib: controller.address,
      DidDocumentLib: didDocument.address,
      VRelationshipsLib: vRelation.address,
    },
  });

  deployments.log("Did Registry V5 deployed at:", ts.address);
};

func.tags = ["DidRegistryV5"];

export default func;
