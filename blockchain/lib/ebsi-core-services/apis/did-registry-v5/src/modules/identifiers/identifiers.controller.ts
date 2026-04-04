import type { PaginatedList } from "@ebsiint-api/shared";
import type { FastifyReply } from "fastify";

import {
  Accepts,
  getErrorMessage,
  InvalidRequestJsonRpcError,
} from "@ebsiint-api/shared";
import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  Post,
  Query,
  Res,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import type { ApiConfig } from "../../config/configuration.ts";
import type { JsonRpcResponseObject } from "../jsonrpc/jsonrpc.interface.ts";
import type { DidLink } from "./identifiers.interface.ts";

import {
  GetIdentifierParamsDto,
  GetIdentifierQueryDto,
  GetIdentifiersDto,
} from "./dto/index.ts";
import { formatIdentifiers } from "./identifiers.formatter.ts";
import { IdentifiersService } from "./identifiers.service.ts";
import { jsonRpcSchema } from "./validators/JsonRpcSchema.ts";

@Controller("/identifiers")
export class IdentifiersController {
  private readonly identifiersService: IdentifiersService;
  private readonly configService: ConfigService<ApiConfig, true>;

  constructor(
    identifiersService: IdentifiersService,
    configService: ConfigService<ApiConfig, true>,
  ) {
    this.identifiersService = identifiersService;
    this.configService = configService;
  }

  @Accepts("application/json")
  @Get("")
  async getIdentifiers(
    @Query() query: GetIdentifiersDto,
  ): Promise<PaginatedList<DidLink>> {
    const identifiers = await this.identifiersService.getIdentifiers(
      query["page[after]"],
      query["page[size]"],
      query.controller,
      query["verification-method-id"],
      query["verification-relationship"],
    );

    const apiUrlPrefix = this.configService.get("apiUrlPrefix", {
      infer: true,
    });
    const domain = this.configService.get("domain", { infer: true });
    const baseUrl = `${domain}${apiUrlPrefix}/identifiers`;

    return formatIdentifiers(
      identifiers,
      query["page[after]"],
      query["page[size]"],
      baseUrl,
      query.controller,
      query["verification-method-id"],
      query["verification-relationship"],
    );
  }

  @Accepts("application/did+ld+json", "application/did+json")
  @Get("/:did")
  async getDidDocument(
    @Param() params: GetIdentifierParamsDto,
    @Query() query: GetIdentifierQueryDto,
    @Headers("Accept") accept: string,
    @Res() res: FastifyReply,
  ): Promise<Record<string, unknown>> {
    const { did } = params;

    const didDocument = await this.identifiersService.getDidDocument(
      did,
      query["valid-at"],
    );

    if (accept === "application/did+json") {
      const { "@context": context, ...otherProps } = didDocument;
      return res.type("application/did+json").send(otherProps);
    }

    return res.type("application/did+ld+json").send(didDocument);
  }

  @HttpCode(200)
  @Post("/:did/actions")
  async processAction(
    @Param() params: GetIdentifierParamsDto,
    @Body() unsafeBody: unknown,
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

    const { did } = params;
    const { id: requestId, method } = body;
    // "id": An identifier established by the Client that MUST contain a String, Number, or NULL value if included. If it is not included it is assumed to be a notification.
    // See https://www.jsonrpc.org/specification#request_object
    // eslint-disable-next-line unicorn/no-null
    const id = requestId ?? null;

    switch (method) {
      case "checkController": {
        const result = await this.identifiersService.checkController(
          did,
          body,
          id,
        );
        return { id, jsonrpc: "2.0", result };
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
