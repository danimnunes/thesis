#!/usr/bin/env node
import Mustache from "mustache";
import { readFileSync, realpathSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

if (!process.env["DIDR_SC_V5_ADDRESS"]) {
  console.error("DIDR_SC_V5_ADDRESS must be defined");
  process.exit(1);
}

if (!process.env["DIDR_SC_V5_START_BLOCK"]) {
  console.error("DIDR_SC_V5_START_BLOCK must be defined");
  process.exit(1);
}

if (!process.env["PROXY_FACTORY_SC_V1_ADDRESS"]) {
  console.error("PROXY_FACTORY_SC_V1_ADDRESS must be defined");
  process.exit(1);
}

if (!process.env["PROXY_FACTORY_SC_V1_START_BLOCK"]) {
  console.error("PROXY_FACTORY_SC_V1_START_BLOCK must be defined");
  process.exit(1);
}

if (!process.env["PROXY_TEMPLATE_REGISTRY_SC_V1_ADDRESS"]) {
  console.error("PROXY_TEMPLATE_REGISTRY_SC_V1_ADDRESS must be defined");
  process.exit(1);
}

if (!process.env["PROXY_TEMPLATE_REGISTRY_SC_V1_START_BLOCK"]) {
  console.error("PROXY_TEMPLATE_REGISTRY_SC_V1_START_BLOCK must be defined");
  process.exit(1);
}

if (!process.env["TIMESTAMP_SC_V4_ADDRESS"]) {
  console.error("TIMESTAMP_SC_V4_ADDRESS must be defined");
  process.exit(1);
}

if (!process.env["TIMESTAMP_SC_V4_START_BLOCK"]) {
  console.error("TIMESTAMP_SC_V4_START_BLOCK must be defined");
  process.exit(1);
}

if (!process.env["TNT_SC_V1_ADDRESS"]) {
  console.error("TNT_SC_V1_ADDRESS must be defined");
  process.exit(1);
}

if (!process.env["TNT_SC_V1_START_BLOCK"]) {
  console.error("TNT_SC_V1_START_BLOCK must be defined");
  process.exit(1);
}

if (!process.env["TIR_SC_V5_ADDRESS"]) {
  console.error("TIR_SC_V5_ADDRESS must be defined");
  process.exit(1);
}

if (!process.env["TIR_SC_V5_START_BLOCK"]) {
  console.error("TIR_SC_V5_START_BLOCK must be defined");
  process.exit(1);
}

if (!process.env["TPR_SC_V3_ADDRESS"]) {
  console.error("TPR_SC_V3_ADDRESS must be defined");
  process.exit(1);
}

if (!process.env["TPR_SC_V3_START_BLOCK"]) {
  console.error("TPR_SC_V3_START_BLOCK must be defined");
  process.exit(1);
}

if (!process.env["TSR_SC_V3_ADDRESS"]) {
  console.error("TSR_SC_V3_ADDRESS must be defined");
  process.exit(1);
}

if (!process.env["TSR_SC_V3_START_BLOCK"]) {
  console.error("TSR_SC_V3_START_BLOCK must be defined");
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

// Patch TIR SC ABI, add old event name with the typo that was fixed in commit a060911fc59a19ef664ac9da08ccff8e07c78885
// This is required in order to index all the data on testnet
const trustedIssuersRegistryAbi = JSON.parse(
  readFileSync(
    resolveSymlinks("@ebsiint-sc/trusted-issuers-registry-v5/src/abi/Tir.json"),
  ).toString(),
);

// @ts-expect-error "abi" type is not properly defined
trustedIssuersRegistryAbi.push({
  anonymous: false,
  inputs: [
    {
      indexed: false,
      internalType: "string",
      name: "did",
      type: "string",
    },
    {
      indexed: true,
      internalType: "bytes32",
      name: "attributeId",
      type: "bytes32",
    },
    {
      indexed: true,
      internalType: "bytes32",
      name: "revisionId",
      type: "bytes32",
    },
    {
      indexed: false,
      internalType: "enum IssuerStorage.IssuerType",
      name: "issuerType",
      type: "uint8",
    },
  ],
  name: "AddAtrributeRevision", // Old event name
  type: "event",
});

writeFileSync(
  path.resolve(dirname, "../node_modules/Tir.json"),
  JSON.stringify(trustedIssuersRegistryAbi, undefined, 2),
  {},
);

const contents = Mustache.render(source, {
  // DID Registry SC v5
  didRegistryAbi: resolveSymlinks(
    "@ebsiint-sc/did-registry-v5/src/abi/DidRegistry.json",
  ),
  didRegistryAddress: process.env["DIDR_SC_V5_ADDRESS"],
  didRegistryStartBlock: Number.parseInt(
    process.env["DIDR_SC_V5_START_BLOCK"],
    10,
  ),
  // TCR - Proxy Factory SC v1
  proxyFactoryAbi: resolveSymlinks(
    "@ebsiint-sc/trusted-contracts-registry-v1/src/abi/ProxyFactory.json",
  ),
  proxyFactoryAddress: process.env["PROXY_FACTORY_SC_V1_ADDRESS"],
  proxyFactoryStartBlock: Number.parseInt(
    process.env["PROXY_FACTORY_SC_V1_START_BLOCK"],
    10,
  ),
  // TCR - Proxy Template Registry SC v1
  proxyTemplateRegistryAbi: resolveSymlinks(
    "@ebsiint-sc/trusted-contracts-registry-v1/src/abi/ProxyTemplateRegistry.json",
  ),
  proxyTemplateRegistryAddress:
    process.env["PROXY_TEMPLATE_REGISTRY_SC_V1_ADDRESS"],
  proxyTemplateRegistryStartBlock: Number.parseInt(
    process.env["PROXY_TEMPLATE_REGISTRY_SC_V1_START_BLOCK"],
    10,
  ),
  // Timestamp SC v4
  timestampAbi: resolveSymlinks(
    "@ebsiint-sc/timestamp-v4/src/abi/Timestamp.json",
  ),
  timestampAddress: process.env["TIMESTAMP_SC_V4_ADDRESS"],
  timestampStartBlock: Number.parseInt(
    process.env["TIMESTAMP_SC_V4_START_BLOCK"],
    10,
  ),
  trackAndTraceAbi: resolveSymlinks(
    "@ebsiint-sc/track-and-trace/src/abi/TrackAndTrace.json",
  ),
  trackAndTraceAddress: process.env["TNT_SC_V1_ADDRESS"],
  trackAndTraceStartBlock: Number.parseInt(
    process.env["TNT_SC_V1_START_BLOCK"],
    10,
  ),
  trustedIssuersRegistryAbi: path.resolve(dirname, "../node_modules/Tir.json"),
  trustedIssuersRegistryAddress: process.env["TIR_SC_V5_ADDRESS"],
  trustedIssuersRegistryStartBlock: Number.parseInt(
    process.env["TIR_SC_V5_START_BLOCK"],
    10,
  ),
  trustedPoliciesRegistryAbi: resolveSymlinks(
    "@ebsiint-sc/trusted-policies-registry-v3/src/abi/PolicyRegistry.json",
  ),
  trustedPoliciesRegistryAddress: process.env["TPR_SC_V3_ADDRESS"],
  trustedPoliciesRegistryStartBlock: Number.parseInt(
    process.env["TPR_SC_V3_START_BLOCK"],
    10,
  ),
  trustedSchemasRegistryAbi: resolveSymlinks(
    "@ebsiint-sc/trusted-schemas-registry-v3/src/abi/SchemaSCRegistry.json",
  ),
  trustedSchemasRegistryAddress: process.env["TSR_SC_V3_ADDRESS"],
  trustedSchemasRegistryStartBlock: Number.parseInt(
    process.env["TSR_SC_V3_START_BLOCK"],
    10,
  ),
});

writeFileSync(path.resolve(dirname, "../subgraph.yaml"), contents);

console.log("subgraph.yaml generated successfully!");
