module.exports = {
  extends: "solhint:recommended",
  rules: {
    // needed for proxy delegatecall
    "avoid-low-level-calls": "off",
    // we are using solc ^0.8.26
    "compiler-version": ["error", "0.8.26"],
    "func-visibility": ["warn", { ignoreConstructors: true }],
    // needed for virtual functions
    "no-empty-blocks": "off",
    // inline are needed to store data at a specific location see *Storage.sol
    "no-inline-assembly": "off",
  },
};
