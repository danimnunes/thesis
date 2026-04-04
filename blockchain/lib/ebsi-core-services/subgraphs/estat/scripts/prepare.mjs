#!/usr/bin/env node
import Mustache from "mustache";
import { readFileSync, realpathSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

if (!process.env["ESTAT_SC_V1_ADDRESS"]) {
  console.error("ESTAT_SC_V1_ADDRESS must be defined");
  process.exit(1);
}

if (!process.env["ESTAT_SC_V1_START_BLOCK"]) {
  console.error("ESTAT_SC_V1_START_BLOCK must be defined");
  process.exit(1);
}

const { dirname } = import.meta;

function resolveSymlinks(fileToResolve) {
  return path.resolve(
    realpathSync(fileURLToPath(import.meta.resolve(fileToResolve))),
  );
}

const source = readFileSync(
  path.resolve(dirname, "../subgraph.template.yaml"),
).toString();

const contents = Mustache.render(source, {
  trackAndTraceAbi: resolveSymlinks(
    "@ebsiint-sc/track-and-trace/src/abi/TrackAndTrace.json",
  ),
  trackAndTraceAddress: process.env["ESTAT_SC_V1_ADDRESS"],
  trackAndTraceStartBlock: Number.parseInt(
    process.env["ESTAT_SC_V1_START_BLOCK"],
    10,
  ),
});

writeFileSync(path.resolve(dirname, "../subgraph.yaml"), contents);

console.log("subgraph.yaml generated successfully!");
