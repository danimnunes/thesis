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

  // get chain Id
  const chainId = `${(await ethers.provider.getNetwork()).chainId}`;

  validateChainId(chainId);

  console.log(`chain id ${chainId}`);

  const deps = dependencies[chainId];

  if (!("tprV3Address" in deps)) {
    throw new Error("tprV3Address does not exist");
  }

  let tprAddress = deps.tprV3Address;

  if (tprAddress) {
    console.log(`reusing tpr address ${tprAddress}`);
  } else {
    await deployments.run("PolicyRegistryV3");
    tprAddress = (await deployments.get("PolicyRegistryV3")).address;
  }

  const { deployer } = await getNamedAccounts();
  const hashAlgoLib = await deployments.deploy("HashAlgoLib", {
    contract: "contracts/timestamp-v4/timestamp/HashAlgoLib.sol:HashAlgoLib",
    from: deployer,
    log: true,
  });
  const timestampLib = await deployments.deploy("TimestampLib", {
    contract: "contracts/timestamp-v4/timestamp/TimestampLib.sol:TimestampLib",
    from: deployer,
    log: true,
  });
  const stringManip = await deployments.deploy("StringManip", {
    contract: "contracts/bootstrap-v2/utils/StringManip.sol:StringManip",
    from: deployer,
    log: true,
  });
  const recordLib = await deployments.deploy("RecordLib", {
    contract: "contracts/timestamp-v4/timestamp/RecordLib.sol:RecordLib",
    from: deployer,
    libraries: {
      StringManip: stringManip.address,
    },
    log: true,
  });

  const ts = await deployments.deploy("TimestampV4", {
    args: [tprAddress],
    contract: "contracts/timestamp-v4/timestamp/Timestamp.sol:Timestamp",
    from: deployer,
    libraries: {
      HashAlgoLib: hashAlgoLib.address,
      RecordLib: recordLib.address,
      TimestampLib: timestampLib.address,
    },
    log: true,
  });
  deployments.log("HashAlgoLib deployed at: ", hashAlgoLib.address);
  deployments.log("TimestampLib deployed at: ", timestampLib.address);
  deployments.log("RecordLib deployed at: ", recordLib.address);

  deployments.log("Timestamp v4 deployed at:", ts.address);
};

func.tags = ["TimestampV4"];

export default func;
