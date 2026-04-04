import type { HardhatRuntimeEnvironment } from "hardhat/types/index.js";

import type { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { deployments, getNamedAccounts } = hre;

  const { deployer } = await getNamedAccounts();
  const opts = {
    from: deployer,
    log: true,
  };
  await deployments.deploy("SmartContractLib", opts);
};

func.tags = ["SmartContractLib"];
func.dependencies = ["Pagination"];

export default func;
