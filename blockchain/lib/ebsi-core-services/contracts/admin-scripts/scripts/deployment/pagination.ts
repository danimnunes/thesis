import type { HardhatRuntimeEnvironment } from "hardhat/types/index.js";

import type { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { deployments, getNamedAccounts } = hre;

  const { deployer } = await getNamedAccounts();
  const opts = {
    from: deployer,
    log: true,
  };

  await deployments.deploy("Pagination", {
    ...opts,
    contract: "contracts/bootstrap-v2/utils/Pagination.sol/Pagination",
  });
};

func.tags = ["Pagination"];

export default func;
