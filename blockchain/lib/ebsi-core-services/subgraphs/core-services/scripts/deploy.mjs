#!/usr/bin/env node
import { $ } from "execa";
import { readFileSync } from "node:fs";
import path from "node:path";

if (!process.env["NODE_URL"]) {
  console.error("NODE_URL must be defined");
  process.exit(1);
}

if (!process.env["IPFS_URL"]) {
  console.error("IPFS_URL must be defined");
  process.exit(1);
}

const { dirname } = import.meta;

const packageJson = JSON.parse(
  readFileSync(path.resolve(dirname, "../package.json"), "utf8"),
);

if (
  !packageJson ||
  typeof packageJson !== "object" ||
  !("version" in packageJson) ||
  typeof packageJson["version"] !== "string"
) {
  console.error("Invalid package.json");
  process.exit(1);
}

const { version } = packageJson;

const graphBinary = path.resolve(dirname, "../node_modules/.bin/graph");

const $$ = $({ stdio: "inherit" }).sync;

$$`${graphBinary} codegen`;
$$`${graphBinary} build`;
$$`${graphBinary} create ebsi/core-services --node ${process.env["NODE_URL"]}`;
$$`${graphBinary} deploy ebsi/core-services --version-label ${version} --node ${process.env["NODE_URL"]} --ipfs ${process.env["IPFS_URL"]}`;
