import type { FastifyRequest } from "fastify";

import {
  Accepts,
  getErrorMessage,
  InvalidRequestJsonRpcError,
} from "@ebsiint-api/shared";
import {
  Body,
  Controller,
  HttpCode,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";

import type { SubjectInfo } from "../auth/decorators/index.ts";
import type { JsonRpcResponseObject } from "./jsonrpc.interface.ts";

import { Subject } from "../auth/decorators/index.ts";
import { BearerJwtAuthGuard } from "../auth/guards/index.ts";
import { JsonRpcService } from "./jsonrpc.service.ts";
import { jsonRpcSchema } from "./validators/JsonRpcSchema.ts";

function formatJsonRpcResponse(
  result: unknown,
  id: null | number | string | undefined,
) {
  return {
    // eslint-disable-next-line unicorn/no-null
    id: id ?? null,
    jsonrpc: "2.0",
    result,
  } satisfies JsonRpcResponseObject;
}

@Controller("/jsonrpc")
export class JsonRpcController {
  private readonly jsonRpcService: JsonRpcService;

  constructor(jsonRpcService: JsonRpcService) {
    this.jsonRpcService = jsonRpcService;
  }

  @Accepts("application/json")
  @HttpCode(200)
  @Post()
  @UseGuards(BearerJwtAuthGuard)
  async jsonRpc(
    @Body() unsafeBody: unknown,
    @Subject() subject: SubjectInfo,
    @Req() req: FastifyRequest,
  ): Promise<JsonRpcResponseObject> {
    if (!unsafeBody || typeof unsafeBody !== "object") {
      throw new InvalidRequestJsonRpcError(
        "JSON-RPC payload must be an object",
        // eslint-disable-next-line unicorn/no-null
        null,
      );
    }

    const parsedBody = jsonRpcSchema.safeParse(unsafeBody);

    if (!parsedBody.success) {
      throw new InvalidRequestJsonRpcError(
        getErrorMessage(parsedBody.error),
        // eslint-disable-next-line unicorn/no-null
        null,
      );
    }

    const body = parsedBody.data;
    const { id: requestId, method } = body;
    // "id": An identifier established by the Client that MUST contain a String, Number, or NULL value if included. If it is not included it is assumed to be a notification.
    // See https://www.jsonrpc.org/specification#request_object
    // eslint-disable-next-line unicorn/no-null
    const id = requestId ?? null;
    const { scp: scope, sub } = subject;

    // TODO: if requestId is undefined, the request should be treated as a notification and return a 200 with an empty body
    // See: https://www.jsonrpc.org/specification#notification

    switch (method) {
      case "authoriseDid": {
        const transaction =
          await this.jsonRpcService.buildTransactionAuthoriseDid(
            body,
            id,
            sub,
            scope,
            req.id,
          );
        return formatJsonRpcResponse(transaction, id);
      }
      case "createDocument": {
        const transaction =
          await this.jsonRpcService.buildTransactionCreateDocument(
            body,
            id,
            sub,
            scope,
          );
        return formatJsonRpcResponse(transaction, id);
      }
      case "grantAccess": {
        const transaction =
          await this.jsonRpcService.buildTransactionGrantAccess(
            body,
            id,
            sub,
            scope,
          );
        return formatJsonRpcResponse(transaction, id);
      }
      case "removeDocument": {
        const transaction =
          await this.jsonRpcService.buildTransactionRemoveDocument(
            body,
            id,
            sub,
            scope,
          );
        return formatJsonRpcResponse(transaction, id);
      }
      case "revokeAccess": {
        const transaction =
          await this.jsonRpcService.buildTransactionRevokeAccess(
            body,
            id,
            sub,
            scope,
          );
        return formatJsonRpcResponse(transaction, id);
      }
      case "sendSignedTransaction": {
        const result = await this.jsonRpcService.sendTransaction(
          body,
          id,
          sub,
          scope,
          req.id,
        );
        return formatJsonRpcResponse(result, id);
      }
      case "writeEvent": {
        const transaction =
          await this.jsonRpcService.buildTransactionWriteEvent(
            body,
            id,
            sub,
            scope,
          );
        return formatJsonRpcResponse(transaction, id);
      }
      default: {
        throw new InvalidRequestJsonRpcError(
          `The method '${method}' is invalid`,
          id,
        );
      }
    }
  }
}
