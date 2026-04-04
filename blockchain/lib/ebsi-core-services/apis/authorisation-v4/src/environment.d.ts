import type { LevelWithSilent } from "pino";

// Provide typings for process.env
declare global {
  namespace NodeJS {
    interface ProcessEnv {
      API_ES256_PRIVATE_KEY: string;
      API_PORT?: string;
      AUTHORISATION_CREDENTIAL_SCHEMA: string;
      DOCKER_TAG?: string;
      DOMAIN: string;
      LOCAL_ORIGIN?: string;
      LOG_LEVEL?: LevelWithSilent;
      NETWORK: string;
      NODE_ENV: "development" | "production" | "test";
      REQUEST_TIMEOUT?: string;
      TEST_ENV?: string;
      TEST_ISSUER_ALG?: string;
      TEST_ISSUER_ATTRIBUTE?: string;
      TEST_ISSUER_KID?: string;
      TEST_ISSUER_PRIVATE_KEY?: string;
      TEST_OID_SCHEMA_PATTERN?: string;
      TEST_SPECIFIC_NODE_DOMAIN?: string;
      TEST_TNT_AUTHORISED_USER_KID?: string;
      TEST_TNT_AUTHORISED_USER_PRIVATE_KEY?: string;
      URI_SCHEME?: string;
    }
  }
}

// eslint-disable-next-line unicorn/require-module-specifiers
export {};
