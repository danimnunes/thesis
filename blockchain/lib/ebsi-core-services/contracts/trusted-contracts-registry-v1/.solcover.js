module.exports = {
  measureBranchCoverage: true,
  measureFunctionCoverage: true,
  measureLineCoverage: true,
  measureStatementCoverage: true,
  skipFiles: [
    "mocks/",
    "interfaces/",
    "SampleImplementation.sol",
    "SampleUpgradeableBeacon.sol",
    "DidRegistryMock.sol",
  ],
};
