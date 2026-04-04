import type { PresentationDefinitionV2 } from "@sphereon/pex-models";
import type { FastifyRequest } from "fastify";

import { Accepts } from "@ebsiint-api/shared";
import {
  Body,
  Controller,
  Get,
  Header,
  Headers,
  HttpCode,
  Post,
  Query,
  Req,
} from "@nestjs/common";

import type {
  JsonWebKeySet,
  OPMetadata,
  TokenResponse,
} from "./authorisation.interfaces.ts";

import { CUSTOM_SCOPES } from "./authorisation.constants.ts";
import { AuthorisationService } from "./authorisation.service.ts";
import { GetPresentationDefinitionsDto } from "./dto/index.ts";
import { OAuth2TokenError } from "./errors/index.ts";

@Controller("/")
export class AuthorisationController {
  private readonly authorisationService: AuthorisationService;

  constructor(authorisationService: AuthorisationService) {
    this.authorisationService = authorisationService;
  }

  @Accepts("application/json")
  @Get("/.well-known/openid-configuration")
  @HttpCode(200)
  getOPMetadata(): OPMetadata {
    return this.authorisationService.getOPMetadata();
  }

  @Accepts("application/jwk-set+json")
  @Get("/jwks")
  @Header("Content-type", "application/jwk-set+json")
  @HttpCode(200)
  getJwks(): Promise<JsonWebKeySet> {
    return this.authorisationService.getJwks();
  }

  @Accepts("application/json")
  @Get("/presentation-definitions")
  @HttpCode(200)
  getPresentationDefinitions(
    @Query() { scope }: GetPresentationDefinitionsDto,
  ): PresentationDefinitionV2 {
    const customScope = scope.split(" ")[1] as (typeof CUSTOM_SCOPES)[number];
    return this.authorisationService.getPresentationDefinitions(customScope);
  }

  @Accepts("application/json")
  @Header("Cache-Control", "no-store")
  @Header("Pragma", "no-cache")
  @HttpCode(200)
  @Post("/token")
  createAccessToken(
    @Headers("content-type") contentType: string | undefined,
    @Body() body: unknown, // Validate DTO within the service method so we can properly handle the error response
    @Req() req: FastifyRequest,
  ): Promise<TokenResponse> {
    // Only accept application/x-www-form-urlencoded
    // https://openid.net/specs/openid-connect-core-1_0.html#TokenRequest
    if (
      !contentType?.toLowerCase().includes("application/x-www-form-urlencoded")
    ) {
      throw new OAuth2TokenError("invalid_request", {
        errorDescription:
          "Content-type must be application/x-www-form-urlencoded",
      });
    }

    return this.authorisationService.createAccessToken(body, req.id);
  }
}
