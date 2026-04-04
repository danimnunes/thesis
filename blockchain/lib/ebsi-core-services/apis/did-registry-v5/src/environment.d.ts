import type { LevelWithSilent } from "pino";

// Provide typings for process.env
declare global {
  namespace NodeJS {
    interface ProcessEnv {
      API_PORT?: string;
      AXIOS_RETRY_DELAY?: string;
      BESU_READINESS_ENDPOINT: string;
      BESU_RPC_NODE: string;
      BLOCKSCOUT_BEARER_TOKEN?: string;
      BLOCKSCOUT_URL?: string;
      CONTRACT_ADDR: string;
      DOCKER_TAG?: string;
      DOMAIN: string;
      LOCAL_ORIGIN?: string;
      LOG_LEVEL?: LevelWithSilent;
      NETWORK: string;
      NODE_ENV: "development" | "production" | "test";
      REQUEST_TIMEOUT?: string;
      TEST_AUTH_API_V4_ES256_PRIVATE_KEY?: string;
      TEST_ENABLE_WRITE_OPS?: string;
      TEST_ENV?: string;
      TEST_SPECIFIC_NODE_DOMAIN?: string;
      URI_SCHEME?: string;
    }
  }

  // Avoid lint:tsc errors:
  // node_modules/hardhat/src/types/config.ts:273:11 - error TS2503: Cannot find namespace 'Mocha'.
  // https://github.com/DefinitelyTyped/DefinitelyTyped/blob/master/types/mocha/index.d.ts#L2276
  namespace Mocha {
    type MochaOptions = Record<string, unknown>;
  }
}

// eslint-disable-next-line unicorn/require-module-specifiers
export {};
