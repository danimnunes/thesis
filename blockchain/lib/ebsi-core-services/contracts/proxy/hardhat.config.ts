import type { HardhatUserConfig } from "hardhat/config";
import { task } from "hardhat/config";

import "@gnosis-guild/typechain-hardhat";
import "@nomicfoundation/hardhat-chai-matchers";
import "@nomiclabs/hardhat-solhint";
import "@nomicfoundation/hardhat-ethers";
import "hardhat-abi-exporter";
import "solidity-coverage";
import * as fs from "node:fs";

// The solhint plugin overrides the check task, runs solhint
// on the project's sources and prints the report to the console
// when running pnpm run test

const mnemonicPath = `${__dirname}/.secret.mnemonic`;

let mnemonic = "test test test test test test test test test test test junk";
if (fs.existsSync(mnemonicPath)) {
  console.log(".secret.mnemonic exists and will be used");
  mnemonic = fs.readFileSync(mnemonicPath).toString().trim();
}

task("accounts", "Prints the list of accounts", async (_, hre) => {
  const accounts = await hre.ethers.getSigners();
  for (const account of accounts) console.log(account.address);
});

const config: HardhatUserConfig = {
  abiExporter: {
    clear: true,
    flat: true,
    path: "./src/abi",
  },
  defaultNetwork: "hardhat",
  networks: {
    hardhat: {},
    local: {
      accounts: { mnemonic },
      url: "http://localhost:8545",
    },
    mainnet: {
      accounts: { mnemonic },
      url: "https://api-test.ebsi.eu/ledger/v3/blockchains/besu",
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
