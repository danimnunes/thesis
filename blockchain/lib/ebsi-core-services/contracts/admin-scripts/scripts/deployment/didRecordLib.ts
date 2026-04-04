import type { HardhatRuntimeEnvironment } from "hardhat/types/index.js";

import type { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { deployments, getNamedAccounts } = hre;
  const { deployer } = await getNamedAccounts();

  const opts = {
    from: deployer,
    log: true,
  };
  const didTimestampLib = await deployments.deploy("DidTimestampLib", {
    ...opts,
    contract:
      "contracts/did-registry-v5/did-registry/DidTimestampLib.sol:DidTimestampLib",
  });

  await deployments.deploy("DidRecordLib", {
    ...opts,
    contract:
      "contracts/did-registry-v5/did-registry/DidRecordLib.sol/DidRecordLib",
    libraries: {
      DidTimestampLib: didTimestampLib.address,
    },
  });
};

func.tags = ["DidRecordLib"];
func.dependencies = ["DidTimestampLib"];

export default func;
