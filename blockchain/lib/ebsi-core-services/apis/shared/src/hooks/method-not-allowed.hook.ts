import type { onRequestHookHandler } from "fastify";

import type { HttpMethod } from "../errors/MethodNotAllowedError.ts";

import {
  HTTP_METHODS,
  MethodNotAllowedError,
} from "../errors/MethodNotAllowedError.ts";

/**
 * Fastify "onRequest" hook that returns an error 405 when the route exist but not with the HTTP method of the current request.
 * We're using a hook instead of a middleware because the middleware is triggered too late (after the routing).
 */
export const methodNotAllowed: onRequestHookHandler = (
  request,
  _reply,
  done,
) => {
  const { url } = request;
  const method = request.method as HttpMethod;

  // If no route is found
  if (!request.server.hasRoute({ method, url })) {
    // Check if the route exists with a different method
    const allowedMethods = HTTP_METHODS.filter(
      (httpMethod) =>
        httpMethod !== method &&
        request.server.hasRoute({ method: httpMethod, url }),
    );

    // If the route exist with a different method, return error 405
    if (allowedMethods.length > 0) {
      throw new MethodNotAllowedError(
        MethodNotAllowedError.defaultTitle,
        allowedMethods,
        {
          detail: `Cannot ${method} ${url}. Allowed HTTP methods: ${allowedMethods.join(", ")}`,
        },
      );
    }

    // Otherwise, let Nest.js return an error 404
  }

  done();
};
