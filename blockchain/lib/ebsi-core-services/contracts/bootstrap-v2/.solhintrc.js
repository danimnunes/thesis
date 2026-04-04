module.exports = {
  extends: "solhint:recommended",
  rules: {
    "compiler-version": ["error", "0.8.26"],
    // we use a library which triggers too often this rule
    "mark-callable-contracts": "off",
    // inline is needed to store data at a specific location see *Storage.sol
    "no-inline-assembly": "off",
  },
};
