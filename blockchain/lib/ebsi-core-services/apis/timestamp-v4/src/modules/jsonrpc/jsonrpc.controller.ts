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

import type { UserInfo } from "../auth/decorators/index.ts";
import type { JsonRpcResponseObject } from "./jsonrpc.interface.ts";

import { User } from "../auth/decorators/index.ts";
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
    @User() user: UserInfo,
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
    const id = requestId ?? undefined;

    switch (method) {
      case "appendRecordVersionHashes": {
        const result =
          await this.jsonRpcService.buildTransactionAppendRecordVersionHashes(
            body,
            id,
          );
        return formatJsonRpcResponse(result, id);
      }
      case "detachRecordVersionHash": {
        const result =
          await this.jsonRpcService.buildTransactionDetachRecordVersionHash(
            body,
            id,
          );
        return formatJsonRpcResponse(result, id);
      }
      case "insertHashAlgorithm": {
        const result =
          await this.jsonRpcService.buildTransactionInsertHashAlgorithm(
            body,
            id,
          );
        return formatJsonRpcResponse(result, id);
      }
      case "insertRecordOwner": {
        const result =
          await this.jsonRpcService.buildTransactionInsertRecordOwner(body, id);
        return formatJsonRpcResponse(result, id);
      }
      case "insertRecordVersionInfo": {
        const result =
          await this.jsonRpcService.buildTransactionInsertRecordVersionInfo(
            body,
            id,
          );
        return formatJsonRpcResponse(result, id);
      }
      case "revokeRecordOwner": {
        const result =
          await this.jsonRpcService.buildTransactionRevokeRecordOwner(body, id);
        return formatJsonRpcResponse(result, id);
      }
      case "sendSignedTransaction": {
        const result = await this.jsonRpcService.sendTransaction(
          body,
          user,
          id,
          req.id,
        );
        return formatJsonRpcResponse(result, id);
      }
      case "timestampHashes": {
        const result =
          await this.jsonRpcService.buildTransactionTimestampHashes(body, id);
        return formatJsonRpcResponse(result, id);
      }
      case "timestampRecordHashes": {
        const result =
          await this.jsonRpcService.buildTransactionTimestampRecordHashes(
            body,
            id,
          );
        return formatJsonRpcResponse(result, id);
      }
      case "timestampRecordVersionHashes": {
        const result =
          await this.jsonRpcService.buildTransactionTimestampRecordVersionHashes(
            body,
            id,
          );
        return formatJsonRpcResponse(result, id);
      }
      case "timestampVersionHashes": {
        const result =
          await this.jsonRpcService.buildTransactionTimestampVersionHashes(
            body,
            id,
          );
        return formatJsonRpcResponse(result, id);
      }
      case "updateHashAlgorithm": {
        const result =
          await this.jsonRpcService.buildTransactionUpdateHashAlgorithm(
            body,
            id,
          );
        return formatJsonRpcResponse(result, id);
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
