/**
 * Hardhat doesn't support ESM in TypeScript projects.
 * https://hardhat.org/hardhat-runner/docs/advanced/using-esm#hardhat-support-for-es-modules
 */
const path = require("node:path");
require("@nomicfoundation/hardhat-ethers");

const timestampScPath = path.resolve(
  require.resolve("@ebsiint-sc/timestamp-v4"),
  "../..", // relative to "dist/index.js"
);

/** @type {import('hardhat/config').HardhatUserConfig} */
const config = {
  defaultNetwork: "hardhat",
  networks: {
    hardhat: {
      gas: "auto", // Required to send multiple transactions 1 block during the tests, see https://github.com/ethers-io/ethers.js/issues/4192#issuecomment-1617725919
      hardfork: "berlin",
    },
  },
  paths: {
    artifacts: path.resolve(timestampScPath, "./artifacts"),
  },
  solidity: {
    settings: {
      optimizer: {
        enabled: true,
        runs: 10,
      },
    },
    version: "0.8.26",
  },
};

module.exports = config;
