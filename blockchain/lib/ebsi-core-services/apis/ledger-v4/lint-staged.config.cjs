module.exports = {
  "*.ts": () => "tsc -p tsconfig.json --noEmit",
  "*.{js,ts}": ["eslint --fix"],
  "*.{md,json,yml,yaml}": ["prettier --write"],
  "api/openapi.yaml": "spectral lint",
};
