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
@UseGuards(BearerJwtAuthGuard)
export class JsonRpcController {
  private readonly jsonRpcService: JsonRpcService;

  constructor(jsonRpcService: JsonRpcService) {
    this.jsonRpcService = jsonRpcService;
  }

  @Accepts("application/json")
  @HttpCode(200)
  @Post()
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

    switch (method) {
      case "addIssuerProxy": {
        const transaction =
          await this.jsonRpcService.buildTransactionAddIssuerProxy(
            body,
            id,
            scope,
            req.id,
          );
        return formatJsonRpcResponse(transaction, id);
      }
      case "removeIssuerProxy": {
        const transaction =
          await this.jsonRpcService.buildTransactionRemoveIssuerProxy(
            body,
            id,
            scope,
          );
        return formatJsonRpcResponse(transaction, id);
      }
      case "sendSignedTransaction": {
        const result = await this.jsonRpcService.sendTransaction(
          sub,
          body,
          id,
          scope,
          req.id,
        );
        return formatJsonRpcResponse(result, id);
      }
      case "setAttributeData": {
        const transaction =
          await this.jsonRpcService.buildTransactionSetAttributeData(
            body,
            id,
            sub,
            scope,
          );
        return formatJsonRpcResponse(transaction, id);
      }
      case "setAttributeMetadata": {
        const transaction =
          await this.jsonRpcService.buildTransactionSetAttributeMetadata(
            body,
            id,
            scope,
          );
        return formatJsonRpcResponse(transaction, id);
      }
      case "updateIssuerProxy": {
        const transaction =
          await this.jsonRpcService.buildTransactionUpdateIssuerProxy(
            body,
            id,
            scope,
            req.id,
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
