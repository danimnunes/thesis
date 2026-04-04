import type { HardhatUserConfig } from "hardhat/config";

import "@nomiclabs/hardhat-solhint";
import "@gnosis-guild/typechain-hardhat";
import "hardhat-deploy";
import "hardhat-deploy-ethers";
import "hardhat-abi-exporter";
import "@openzeppelin/hardhat-upgrades";
import "@nomicfoundation/hardhat-verify";

import "./tasks/index";

import type { TypechainUserConfig } from "@gnosis-guild/typechain-hardhat/dist/types";

import * as dotenv from "dotenv";
import * as fs from "node:fs";
import path from "node:path";

dotenv.config({ path: path.resolve(__dirname, ".env") });

// The solhint plugin overrides the check task, runs solhint
// on the project's sources and prints the report to the console
// when running pnpm run test

const mnemonicPath = `${__dirname}/.secret.mnemonic`;
const privKeyPath = `${__dirname}/.secret.privatekey`;
let mnemonic =
  process.env.MNEMONIC ??
  "test test test test test test test test test test test junk";
let privKey =
  process.env.PRIVATE_KEY ??
  "0x6a41084b4e952f85d4ea71f1af325fa9925f98befd72f8a12534c67b5679fe0e";

if (fs.existsSync(mnemonicPath)) {
  console.log(".secret.mnemonic exists and will be used");
  mnemonic = fs.readFileSync(mnemonicPath).toString().trim();
  privKey = fs.readFileSync(privKeyPath).toString().trim();
}

const accounts = {
  // use default accounts
  mnemonic,
};

const {
  CONFORMANCE_HARDHAT_NETWORK_URL,
  PILOT_HARDHAT_NETWORK_URL,
  TEST_HARDHAT_NETWORK_URL,
} = process.env;

const config = {
  abiExporter: {
    clear: true,
    flat: true,
    path: "./src/abi",
  },
  defaultNetwork: "local",
  etherscan: {
    apiKey: {
      test: "empty",
    },
    customChains: [
      {
        chainId: 6175, // EBSI testnet (test network from TEST_HARDHAT_NETWORK_URL)
        network: "test",
        urls: {
          apiURL: "https://blockexplorer-test.ebsi.eu/api",
          browserURL: "https://blockexplorer-test.ebsi.eu",
        },
      },
    ],
  },
  namedAccounts: {
    admin: 2,
    deployer: 0,
    multiSig: {
      default: 3, // here this will by default take the first account as deployer
      local: "0x28774ee74a79e27af87f4a7668542be43e2f742b", // it can also specify a specific network name
    },
    user: 1,
  },
  networks: {
    box: {
      accounts,
      url: "http://192.168.55.5:8545", // config for node1-besu-1
    },
    conformance: {
      accounts: [privKey],
      gas: 20_000_000,
      gasPrice: 0,
      url: CONFORMANCE_HARDHAT_NETWORK_URL!,
    },
    hardhat: {},
    local: {
      accounts: [privKey],
      // accounts,
      gas: 20_000_000,
      gasPrice: 0,
      url: TEST_HARDHAT_NETWORK_URL!,
    },
    localWithData: {
      accounts,
      gas: 70_000_000,
      gasPrice: 0,
      url: TEST_HARDHAT_NETWORK_URL!,
    },
    pilot: {
      accounts: [privKey],
      gas: 20_000_000,
      gasPrice: 0,
      url: PILOT_HARDHAT_NETWORK_URL!,
    },
    sokol: {
      accounts: [privKey],
      gas: 20_000_000,
      gasPrice: 0,
      url: TEST_HARDHAT_NETWORK_URL!,
    },
    test: {
      accounts: [privKey],
      gas: 20_000_000,
      gasPrice: 0,
      timeout: 120_000, // 2 min (RPC can be slow; avoid HeadersTimeoutError)
      url: TEST_HARDHAT_NETWORK_URL!,
    },
  },
  paths: {
    artifacts: "src/artifacts",
    cache: "./cache",
    deploy: "./scripts/deployment",
    deployments: "./deployments",
    sources: "./contracts",
    tests: "./tests",
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
} satisfies HardhatUserConfig & {
  namedAccounts?: Record<
    string,
    number | Record<string, null | number | string> | string
  >;
  typechain: TypechainUserConfig;
};

export default config;
