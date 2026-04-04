module.exports = {
  "**/openapi.yaml": "spectral lint",
  "*.sol": ["solhint"],
  "*.ts": () => "tsc -p tsconfig.json --noEmit",
  "*.{js,ts}": ["eslint --fix"],
  "*.{md,json,yml,yaml}": ["prettier --write"],
};
