import type { LoggerService } from "@nestjs/common";
import type { AxiosRequestConfig } from "axios";

import axios, { AxiosError } from "axios";
import http from "node:http";
import https from "node:https";

const isNotFoundError = (data?: unknown): boolean => {
  if (!data || typeof data !== "object" || data === null) return false;

  return "title" in data && "status" in data && data.status === 404;
};

const validateRequestConfigHeaders = (config: AxiosRequestConfig): boolean => {
  return (
    !config.headers ||
    (typeof config.headers === "object" &&
      config.headers["EBSI-REMOTE-API"] !== "true")
  );
};

const errorNeedsInterception = (error: AxiosError): boolean => {
  return (
    !error.response ||
    error.response.status >= 500 ||
    (error.response.status === 404 && !isNotFoundError(error.response.data))
  );
};

export function setupInterceptors(
  domain: string,
  localOrigin?: string,
  logger?: LoggerService,
): void {
  // Setup axios agents
  axios.defaults.httpAgent = new http.Agent({ keepAlive: true });
  axios.defaults.httpsAgent = new https.Agent({ keepAlive: true });

  if (!domain || !localOrigin) {
    // Don't define interceptors if the domain or local origin is not set
    return;
  }

  // Request interceptor
  axios.interceptors.request.use((config) => {
    if (
      validateRequestConfigHeaders(config) &&
      config.url?.startsWith(domain)
    ) {
      const localUrl = config.url.replace(domain, localOrigin);

      if (logger) {
        logger.verbose!(
          `Replacing ${config.url} with ${localUrl}`,
          "Axios Request Interceptor",
        );
      }

      config.url = localUrl;
    }

    return config;
  });

  // Response interceptor
  axios.interceptors.response.use(
    undefined,
    // This function is triggered whenever an axios request doesn't return a 2xx
    (error: unknown) => {
      if (!(error instanceof AxiosError)) {
        // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
        return Promise.reject(error);
      }

      if (
        errorNeedsInterception(error) &&
        error.config?.url?.startsWith(localOrigin)
      ) {
        const { config } = error;

        const remoteUrl = config.url!.replace(localOrigin, domain);

        if (logger) {
          logger.debug!(error.toJSON(), "Axios Response Interceptor");
          logger.verbose!(
            `Replacing ${config.url} with ${remoteUrl}`,
            "Axios Response Interceptor",
          );
        }

        // Replace local URL with remote
        config.url = remoteUrl;

        // Add custom header to avoid replacing the URL again
        (config.headers as Record<string, unknown>)["EBSI-REMOTE-API"] = "true";

        // Retry request
        return axios.request(config);
      }

      return Promise.reject(error);
    },
  );
}
