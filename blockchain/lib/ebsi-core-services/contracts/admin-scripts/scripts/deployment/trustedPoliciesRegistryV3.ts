import type { HardhatRuntimeEnvironment } from "hardhat/types/index.js";

import type { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { deployments, getNamedAccounts } = hre;

  const { deployer } = await getNamedAccounts();
  const opts = {
    from: deployer,
    log: true,
  };

  const ts = await deployments.deploy("PolicyRegistryV3", {
    ...opts,
    contract:
      "contracts/trusted-policies-registry-v3/trusted-policies-registry/PolicyRegistry.sol:PolicyRegistry",
  });

  deployments.log("Trusted Policies Registry v3 deployed at:", ts.address);
};

func.tags = ["PolicyRegistryV3"];

export default func;
