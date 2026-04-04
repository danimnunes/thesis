/**
 * Hardhat doesn't support ESM in TypeScript projects.
 * https://hardhat.org/hardhat-runner/docs/advanced/using-esm#hardhat-support-for-es-modules
 */
const path = require("node:path");
require("@nomicfoundation/hardhat-ethers");

const tprScPath = path.resolve(
  require.resolve("@ebsiint-sc/trusted-policies-registry-v3"),
  "../..", // relative to "dist/index.js"
);

/** @type {import('hardhat/config').HardhatUserConfig} */
const config = {
  defaultNetwork: "hardhat",
  networks: {
    hardhat: { hardfork: "berlin" },
  },
  paths: {
    artifacts: path.resolve(tprScPath, "./artifacts"),
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
