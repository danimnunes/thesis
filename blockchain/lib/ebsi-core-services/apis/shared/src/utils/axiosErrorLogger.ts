import type { Logger } from "@nestjs/common";
import type { AxiosError } from "axios";

import { isAxiosError } from "axios";
import { stringify } from "safe-stable-stringify";

export function logAxiosError(
  error: unknown,
  logger: Logger,
  /**
   * Minimum status code to log the error with the "error" level.
   * Errors with a status code below that threshold will be logged with the "log" level.
   */
  minErrorStatus = 400,
): void {
  if (!isAxiosError<unknown, unknown>(error)) return;

  if (error.response) {
    // The request was made and the server responded with a status code that falls out of the range of 2xx
    const level =
      !error.status || error.status >= minErrorStatus ? "error" : "log";

    logger[level](formatError(error, "Bad response"), error.stack);
  } else if (error.request) {
    // The request was made but no response was received
    // `error.request` is an instance of XMLHttpRequest in the browser and an instance of http.ClientRequest in node.js
    logger.error(formatError(error, "No response"), error.stack);
  } else {
    // Something happened in setting up the request that triggered an Error
    logger.error(
      formatError(error, "Request configuration error"),
      error.stack,
    );
  }

  logger.debug(error.toJSON());
}

function formatError(error: AxiosError, message: string) {
  return `AxiosError: ${message}\n${stringify(
    {
      code: error.code,
      message: error.message,
      request: {
        data: error.config?.data as unknown,
        headers: error.config?.headers,
        method: error.config?.method,
        url: error.config?.url,
      },
      response: error.response
        ? {
            data: error.response.data,
            headers: error.response.headers,
            status: error.response.status,
          }
        : undefined,
      status: error.status,
    },
    undefined,
    2,
  )}`;
}
