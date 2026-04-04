import type { HardhatUserConfig } from "hardhat/config";

import type { TypechainUserConfig } from "@gnosis-guild/typechain-hardhat/dist/types";

import "@nomiclabs/hardhat-solhint";
import "@gnosis-guild/typechain-hardhat";
import "hardhat-deploy";
import "hardhat-deploy-ethers";
import "hardhat-abi-exporter";

// The solhint plugin overrides the check task, runs solhint
// on the project's sources and prints the report to the console
// when running pnpm run test

const config: HardhatUserConfig & {
  namedAccounts?: Record<
    string,
    number | Record<string, null | number | string> | string
  >;
  typechain: TypechainUserConfig;
} = {
  abiExporter: {
    clear: true,
    flat: true,
    path: "./src/abi",
  },
  defaultNetwork: "hardhat",
  paths: {
    artifacts: "src/artifacts",
    cache: "./cache",
    sources: "./contracts",
  },
  solidity: {
    compilers: [
      {
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
          // remove viaIR when legacy contract are deprecated
          viaIR: true,
        },
        version: "0.8.26",
      },
      {
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
          viaIR: true,
        },
        version: "0.8.26",
      },
    ],
  },
  typechain: {
    outDir: "src/types",
    target: require.resolve("@gnosis-guild/typechain-ethers-v6"),
  },
};

export default config;
