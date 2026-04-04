module.exports = {
  "*.sol": ["prettier --write --plugin=prettier-plugin-solidity", "solhint"],
  "*.ts": () => "tsc -p tsconfig.json --noEmit",
  "*.{js,ts}": ["eslint --fix"],
  "*.{md,json,yml,yaml}": ["prettier --write"],
};
