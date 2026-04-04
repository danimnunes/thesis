import type { EbsiEnvConfiguration } from "@europeum-ebsi/verifiable-presentation";
import type { LevelWithSilent } from "pino";

import { ConfigModule } from "@nestjs/config";
import Joi from "joi";

// List here all the values that will be returned by the config factory
export interface ApiConfig {
  apiES256PrivateKey: string;
  apiPort: number;
  apiUrlPrefix: string;
  authorisationCredentialSchema: string;
  dependencies: {
    readonly "did-registry": "v5";
    readonly estat?: "v1";
    readonly "track-and-trace": "v1";
    readonly "trusted-contracts-registry": "v1";
    readonly "trusted-issuers-registry": "v5";
    readonly "trusted-policies-registry": "v3";
    readonly "trusted-schemas-registry": "v3";
  };
  didRegistry: string;
  dockerContainerTag: string;
  domain: string;
  ebsiEnvConfig: EbsiEnvConfiguration;
  estatAccessesEndpoint: string | undefined;
  localOrigin: string | undefined;
  logLevel: LevelWithSilent;
  requestTimeout: number;
  // Test-specific variables
  testEnv: string | undefined;
  testIssuerAlg: string | undefined;
  testIssuerAttribute: string | undefined;
  testIssuerKid: string | undefined;
  testIssuerPrivateKey: string | undefined;
  testOidSchemaPattern: string;
  testSpecificNodeDomain: string | undefined;
  testTntAuthorisedUserKid: string | undefined;
  testTntAuthorisedUserPrivateKey: string | undefined;
  trackAndTraceAccessesEndpoint: string;
  trustedContractsRegistry: string;
  trustedIssuersRegistry: string;
  trustedPoliciesRegistry: string;
}

type Services = EbsiEnvConfiguration["services"] & {
  "track-and-trace": `v${number}`;
  "trusted-contracts-registry": `v${number}`;
};

const SERVICE_PREFIX = "authorisation";
const SERVICE_VERSION = "v4";

// Config factory
// Note that process.env — for which provide typings in src/environment.d.ts —
// should have already been validated by Joi in src/app.module.ts
const loadConfig = () => {
  const { DOMAIN, NETWORK, URI_SCHEME } = process.env;

  // EBSI Services Authorisation API v4 depends on
  const DEPENDENCIES = {
    "did-registry": "v5",
    ...(["pilot", "test"].includes(NETWORK) ? ({ estat: "v1" } as const) : {}),
    "track-and-trace": "v1",
    "trusted-contracts-registry": "v1",
    "trusted-issuers-registry": "v5",
    "trusted-policies-registry": "v3",
    "trusted-schemas-registry": "v3",
  } as const satisfies Services;

  const ebsiEnvConfig = {
    hosts: [
      DOMAIN.replace(/^https?:\/\//, ""), // remove http protocol scheme
    ],
    network: {
      isOptional: NETWORK === "production",
      name: NETWORK,
    },
    scheme: URI_SCHEME ?? "ebsi",
    services: DEPENDENCIES,
  } as const satisfies EbsiEnvConfiguration;

  return {
    apiES256PrivateKey: process.env.API_ES256_PRIVATE_KEY,
    apiPort: Number.parseInt(process.env.API_PORT ?? "3000", 10),
    apiUrlPrefix: `/${SERVICE_PREFIX}/${SERVICE_VERSION}`,
    authorisationCredentialSchema: `${DOMAIN}/trusted-schemas-registry/${DEPENDENCIES["trusted-schemas-registry"]}/schemas/${process.env.AUTHORISATION_CREDENTIAL_SCHEMA}`,
    dependencies: DEPENDENCIES,
    didRegistry: `${DOMAIN}/did-registry/${DEPENDENCIES["did-registry"]}/identifiers`,
    dockerContainerTag: process.env.DOCKER_TAG ?? "",
    domain: DOMAIN,
    ebsiEnvConfig,
    estatAccessesEndpoint: ["pilot", "test"].includes(NETWORK)
      ? `${DOMAIN}/estat/${DEPENDENCIES.estat}/accesses`
      : undefined,
    localOrigin: process.env.LOCAL_ORIGIN,
    logLevel: process.env.LOG_LEVEL ?? "warn",
    requestTimeout: Number.parseInt(process.env.REQUEST_TIMEOUT ?? "15000", 10),
    testEnv: process.env.TEST_ENV,
    testIssuerAlg: process.env.TEST_ISSUER_ALG,
    testIssuerAttribute: process.env.TEST_ISSUER_ATTRIBUTE,
    testIssuerKid: process.env.TEST_ISSUER_KID,
    testIssuerPrivateKey: process.env.TEST_ISSUER_PRIVATE_KEY,
    testOidSchemaPattern: process.env.TEST_OID_SCHEMA_PATTERN ?? "",
    testSpecificNodeDomain: process.env.TEST_SPECIFIC_NODE_DOMAIN,
    testTntAuthorisedUserKid: process.env.TEST_TNT_AUTHORISED_USER_KID,
    testTntAuthorisedUserPrivateKey:
      process.env.TEST_TNT_AUTHORISED_USER_PRIVATE_KEY,
    trackAndTraceAccessesEndpoint: `${DOMAIN}/track-and-trace/${DEPENDENCIES["track-and-trace"]}/accesses`,
    trustedContractsRegistry: `${DOMAIN}/trusted-contracts-registry/${DEPENDENCIES["trusted-contracts-registry"]}/contracts`,
    trustedIssuersRegistry: `${DOMAIN}/trusted-issuers-registry/${DEPENDENCIES["trusted-issuers-registry"]}/issuers`,
    trustedPoliciesRegistry: `${DOMAIN}/trusted-policies-registry/${DEPENDENCIES["trusted-policies-registry"]}/users`,
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
    API_ES256_PRIVATE_KEY: Joi.string().required(),
    API_PORT: Joi.string().default("3000"),
    AUTHORISATION_CREDENTIAL_SCHEMA: Joi.string().required(),
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
    NODE_ENV: Joi.string()
      .valid("development", "production", "test")
      .default("development"),
    REQUEST_TIMEOUT: Joi.string(),
    // Test-specific variables
    TEST_ENV: Joi.string(),
    TEST_ISSUER_ALG: Joi.string(),
    TEST_ISSUER_ATTRIBUTE: Joi.string().uri(),
    TEST_ISSUER_KID: Joi.string(),
    TEST_ISSUER_PRIVATE_KEY: Joi.string(),
    TEST_OID_SCHEMA_PATTERN: Joi.string(),
    TEST_SPECIFIC_NODE_DOMAIN: Joi.string().uri(),
    TEST_TNT_AUTHORISED_USER_KID: Joi.string(),
    TEST_TNT_AUTHORISED_USER_PRIVATE_KEY: Joi.string(),
    // Generic variables
    TZ: Joi.string(),
    // EBSI URI Scheme prefix
    URI_SCHEME: Joi.string(),
  }),
});
