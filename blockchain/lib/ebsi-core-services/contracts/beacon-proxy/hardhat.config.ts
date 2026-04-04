import type { HardhatUserConfig } from "hardhat/config";
import { task } from "hardhat/config";

import "@gnosis-guild/typechain-hardhat";
import "@nomicfoundation/hardhat-chai-matchers";
import "@nomicfoundation/hardhat-ethers";
import "@nomiclabs/hardhat-solhint";
import "hardhat-abi-exporter";
import "solidity-coverage";

task("accounts", "Prints the list of accounts", async (_, hre) => {
  const accounts = await hre.ethers.getSigners();
  for (const account of accounts) console.log(account.address);
});

const config: HardhatUserConfig = {
  abiExporter: {
    clear: true,
    flat: true,
    path: "./src/abi",
    runOnCompile: true,
  },
  defaultNetwork: "hardhat",
  networks: {
    hardhat: {
      allowUnlimitedContractSize: true,
    },
  },
  paths: {
    artifacts: "./artifacts",
    cache: "./cache",
    sources: "./contracts",
    tests: "./tests",
  },
  solidity: {
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
    version: "0.8.26",
  },
  typechain: {
    outDir: "src/types",
    target: require.resolve("@gnosis-guild/typechain-ethers-v6"),
  },
};

export default config;
