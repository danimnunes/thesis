/**
 * Hardhat doesn't support ESM in TypeScript projects.
 * https://hardhat.org/hardhat-runner/docs/advanced/using-esm#hardhat-support-for-es-modules
 */
const path = require("node:path");
require("@nomicfoundation/hardhat-ethers");
require("@openzeppelin/hardhat-upgrades");

const tntScPath = path.resolve(
  require.resolve("@ebsiint-sc/track-and-trace"),
  "../..", // relative to "dist/index.js"
);

/** @type {import('hardhat/config').HardhatUserConfig} */
const config = {
  defaultNetwork: "hardhat",
  networks: {
    hardhat: { allowUnlimitedContractSize: true, hardfork: "berlin" },
  },
  paths: {
    artifacts: path.resolve(tntScPath, "./artifacts"),
    cache: path.resolve(tntScPath, "./cache"),
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
