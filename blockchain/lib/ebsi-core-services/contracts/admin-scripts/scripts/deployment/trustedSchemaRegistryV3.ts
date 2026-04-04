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
  const opts = {
    from: deployer,
    log: true,
  };
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

  const schemaLib = await deployments.deploy("SchemaLib", {
    ...opts,
    contract:
      "contracts/trusted-schemas-registry-v3/trusted-schemas-registry/SchemaLib.sol:SchemaLib",
  });

  const ts = await deployments.deploy("SchemaSCRegistryV3", {
    ...opts,
    args: [tprAddress],
    contract:
      "contracts/trusted-schemas-registry-v3/trusted-schemas-registry/SchemaSCRegistry.sol:SchemaSCRegistry",
    libraries: {
      SchemaLib: schemaLib.address,
    },
  });

  deployments.log("Trusted Schema Registry v3 deployed at:", ts.address);
};

func.tags = ["SchemaSCRegistryV3"];

export default func;
