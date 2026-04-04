import type { FastifyReply, FastifyRequest } from "fastify";

import { errorCodes } from "fastify";
import { PinoLogger } from "nestjs-pino";
import pino from "pino";

export const frameworkErrors = (
  error: unknown,
  req: FastifyRequest,
  res: FastifyReply,
) => {
  const logger = PinoLogger.root; // TODO: create child?
  if (logger) {
    const { headers, method, url } = pino.stdSerializers.req(req.raw);
    logger.info(
      {
        context: "frameworkErrors",
        error,
        request: {
          /* eslint-disable perfectionist/sort-objects */
          method,
          url,
          headers,
          /* eslint-enable perfectionist/sort-objects */
        },
      },
      "Invalid request received",
    );
  }

  if (error instanceof errorCodes.FST_ERR_BAD_URL) {
    res.code(400);

    res.send({
      detail: `${req.url} is not a valid url component`,
      status: 400,
      title: "Bad Request",
      type: "about:blank",
    });
  } else {
    res.code(500);

    res.send({
      detail:
        "The server encountered an internal error and was unable to complete your request",
      status: 500,
      title: "Internal Server Error",
      type: "about:blank",
    });
  }
};
