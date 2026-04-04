import type { OnApplicationBootstrap } from "@nestjs/common";
import type { AxiosInstance } from "axios";

import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import axios from "axios";
import axiosRetry from "axios-retry";

import type { ApiConfig } from "./config/configuration.ts";

import { BOOTSTRAP_DEPENDENCIES } from "./config/configuration.ts";

@Injectable()
export class AppService implements OnApplicationBootstrap {
  private readonly axiosClient: AxiosInstance;

  private readonly domain: string;

  private readonly localOrigin: string | undefined;

  private readonly logger = new Logger(AppService.name);

  constructor(configService: ConfigService<ApiConfig, true>) {
    this.domain = configService.get("domain", { infer: true });
    this.localOrigin = configService.get("localOrigin", { infer: true });

    const axiosRetryDelay = configService.get("axiosRetryDelay", {
      infer: true,
    });
    this.axiosClient = axios.create({ headers: { "EBSI-Healthcheck": "1" } });

    axiosRetry(this.axiosClient, {
      onRetry: (_, error, requestConfig) => {
        if (error.response) {
          // The request was made and the server responded with a status code that falls out of the range of 2xx
          this.logger.error({
            data: error.response.data,
            status: error.response.status,
            url: requestConfig.url,
          });
        } else {
          // Something happened in setting up the request that triggered an Error
          this.logger.error({ message: error.message, url: requestConfig.url });
        }
      },
      retries: 30, // Retry 30 times (with a delay of 10s -> ~5 minutes)
      retryCondition: () => true, // Ignore error response, retry anyway
      retryDelay: () => axiosRetryDelay, // Default: every 10 seconds
    });
  }

  async check(url: string) {
    try {
      await this.axiosClient.get(url);
    } catch {
      // If after all the attempts the URL is still not reachable, throw an error
      throw new Error(`Unable to get ${url}, shutting down...`);
    }
  }

  async onApplicationBootstrap() {
    // Wait for bootstrap dependencies to be up and running
    this.logger.debug("Checking dependencies...");

    await Promise.all(
      (
        Object.keys(
          BOOTSTRAP_DEPENDENCIES,
        ) as (keyof typeof BOOTSTRAP_DEPENDENCIES)[]
      ).map(async (dependency) =>
        this.check(
          `${this.localOrigin ?? this.domain}/${dependency}/${BOOTSTRAP_DEPENDENCIES[dependency]}`,
        ),
      ),
    );

    // Let's go!
    this.logger.debug("All the bootstrap dependencies are ready");
  }
}
