import type { LevelWithSilent } from "pino";

import { ConfigModule } from "@nestjs/config";
import Joi from "joi";

// List here all the values that will be returned by the config factory
export interface ApiConfig {
  apiPort: number;
  apiUrlPrefix: string;
  axiosRetryDelay: number;
  besuReadinessEndpoint: string;
  // Ledger & SC
  besuRpcNode: string;
  dockerContainerTag: string;
  domain: string;
  localOrigin: string | undefined;
  logLevel: LevelWithSilent;
  proxyFactoryContractAddr: string;
  proxyTemplateContractAddr: string;
  requestTimeout: number;
  // Test-specific variables
  testEnv: string | undefined;
  testSpecificNodeDomain: string | undefined;
}

const SERVICE_PREFIX = "trusted-contracts-registry";
const SERVICE_VERSION = "v1";

// EBSI Services that must be up and running before this service starts
export const BOOTSTRAP_DEPENDENCIES = {} as const;

// EBSI Services that must be up and running for this service to be considered healthy
export const RUNTIME_DEPENDENCIES = {} as const;

const loadConfig = () => {
  const { DOMAIN } = process.env;

  return {
    apiPort: Number.parseInt(process.env.API_PORT ?? "3000", 10),
    apiUrlPrefix: `/${SERVICE_PREFIX}/${SERVICE_VERSION}`,
    axiosRetryDelay: Number.parseInt(
      process.env.AXIOS_RETRY_DELAY ?? "10000",
      10,
    ),
    besuReadinessEndpoint: process.env.BESU_READINESS_ENDPOINT,
    // Ledger & SC
    besuRpcNode: process.env.BESU_RPC_NODE,
    dockerContainerTag: process.env.DOCKER_TAG ?? "",
    domain: DOMAIN,
    localOrigin: process.env.LOCAL_ORIGIN,
    logLevel: process.env.LOG_LEVEL ?? "warn",
    proxyFactoryContractAddr: process.env.PROXY_FACTORY_CONTRACT_ADDR,
    proxyTemplateContractAddr: process.env.PROXY_TEMPLATE_CONTRACT_ADDR,
    requestTimeout: Number.parseInt(process.env.REQUEST_TIMEOUT ?? "15000", 10),
    // Test-specific variables
    testEnv: process.env.TEST_ENV,
    testSpecificNodeDomain: process.env.TEST_SPECIFIC_NODE_DOMAIN,
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
    AXIOS_RETRY_DELAY: Joi.string(),
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
    NODE_ENV: Joi.string()
      .valid("development", "production", "test")
      .default("development"),
    PROXY_FACTORY_CONTRACT_ADDR: Joi.string().required(),
    PROXY_TEMPLATE_CONTRACT_ADDR: Joi.string().required(),
    REQUEST_TIMEOUT: Joi.string(),
    TEST_ENV: Joi.string(),
    TEST_SPECIFIC_NODE_DOMAIN: Joi.string().uri(),
    TZ: Joi.string(),
  }),
});
