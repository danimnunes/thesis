import type { HardhatRuntimeEnvironment } from "hardhat/types/index.js";

import type { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { deployments, getNamedAccounts } = hre;

  const { deployer } = await getNamedAccounts();

  await deployments.deploy("OwnedUpgradeabilityProxy", {
    from: deployer,
    log: true,
  });
};

func.tags = ["OwnedUpgradeabilityProxy"];

export default func;
