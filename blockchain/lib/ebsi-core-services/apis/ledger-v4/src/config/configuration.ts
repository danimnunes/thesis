import type { LevelWithSilent } from "pino";

import { ConfigModule } from "@nestjs/config";
import Joi from "joi";

// List here all the values that will be returned by the config factory
export interface ApiConfig {
  apiPort: number;
  apiUrlPrefix: string;
  authorisationApiUrl: string;
  besuReadinessEndpoint: string;
  besuRpcNode: string;
  didRegistryApiUrl: string;
  dockerContainerTag: string;
  domain: string;
  localOrigin: string | undefined;
  logLevel: LevelWithSilent;
  proxyFactoryAddress: string;
  requestTimeout: number;
  testSpecificNodeDomain: string | undefined;
  trustedPoliciesRegistryApiUrl: string;
}

const SERVICE_PREFIX = "ledger";
const SERVICE_VERSION = "v4";

// Declare all the services and their versions used by this service
interface ServiceVersions {
  authorisation: "v4";
  "did-registry": "v5";
  "trusted-policies-registry": "v3";
}

// EBSI Services that must be up and running for this service to be considered healthy
export const RUNTIME_DEPENDENCIES = {
  authorisation: "v4",
  "did-registry": "v5",
  "trusted-policies-registry": "v3",
} as const satisfies Partial<ServiceVersions>;

// Config factory
// Note that process.env — for which provide typings in src/environment.d.ts —
// should have already been validated by Joi in src/app.module.ts
const loadConfig = () => {
  const { DOMAIN } = process.env;

  return {
    apiPort: Number.parseInt(process.env.API_PORT ?? "3000", 10),
    apiUrlPrefix: `/${SERVICE_PREFIX}/${SERVICE_VERSION}`,
    authorisationApiUrl: `${DOMAIN}/authorisation/${RUNTIME_DEPENDENCIES.authorisation}`,
    besuReadinessEndpoint: process.env.BESU_READINESS_ENDPOINT,
    besuRpcNode: process.env.BESU_RPC_NODE,
    didRegistryApiUrl: `${DOMAIN}/did-registry/${RUNTIME_DEPENDENCIES["did-registry"]}`,
    dockerContainerTag: process.env.DOCKER_TAG ?? "",
    domain: DOMAIN,
    localOrigin: process.env.LOCAL_ORIGIN,
    logLevel: process.env.LOG_LEVEL ?? "warn",
    proxyFactoryAddress: process.env.PROXY_FACTORY_CONTRACT_ADDR,
    requestTimeout: Number.parseInt(process.env.REQUEST_TIMEOUT ?? "15000", 10),
    testSpecificNodeDomain: process.env.TEST_SPECIFIC_NODE_DOMAIN,
    trustedPoliciesRegistryApiUrl: `${DOMAIN}/trusted-policies-registry/${RUNTIME_DEPENDENCIES["trusted-policies-registry"]}`,
  } as const satisfies ApiConfig;
};

export const ApiConfigModule = ConfigModule.forRoot({
  envFilePath: [
    `.env.${process.env.NODE_ENV}.local`,
    `.env.${process.env.NODE_ENV}`,
    ".env.default.local",
    ".env.default",
  ],
  load: [loadConfig],
  validationSchema: Joi.object<typeof process.env, true>({
    API_PORT: Joi.string().default("3000"),
    BESU_READINESS_ENDPOINT: Joi.string().uri().required(),
    BESU_RPC_NODE: Joi.string().uri().required(),
    DOCKER_TAG: Joi.string(),
    DOMAIN: Joi.string().uri().required(),
    LOCAL_ORIGIN: Joi.string().uri(),
    LOG_LEVEL: Joi.string().valid(
      "fatal",
      "error",
      "warn",
      "info",
      "debug",
      "trace",
      "silent",
    ),
    NETWORK: Joi.string(),
    // Common API variables
    NODE_ENV: Joi.string()
      .valid("development", "production", "test")
      .default("development"),
    PROXY_FACTORY_CONTRACT_ADDR: Joi.string(),
    REQUEST_TIMEOUT: Joi.string(),
    TEST_ENV: Joi.string(),
    TEST_SPECIFIC_NODE_DOMAIN: Joi.string().uri(),
    // Generic variables
    TZ: Joi.string(),
  }),
});
