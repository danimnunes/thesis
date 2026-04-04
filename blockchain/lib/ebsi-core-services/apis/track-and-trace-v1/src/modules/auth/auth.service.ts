import type { AxiosResponse } from "axios";
import type { Cache } from "cache-manager";
import type {
  JSONWebKeySet,
  JWTPayload,
  ProtectedHeaderParameters,
} from "jose";

import {
  InternalServerError,
  logAxiosError,
  UnauthorizedError,
} from "@ebsiint-api/shared";
import { CACHE_MANAGER } from "@nestjs/cache-manager";
import { Inject, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import axios, { isAxiosError } from "axios";
import { decodeJwt, decodeProtectedHeader, importJWK, jwtVerify } from "jose";

import type { ApiConfig } from "../../config/configuration.ts";
import type { SubjectInfo } from "./auth.interface.ts";

import { jwksSchema } from "./validators/jwks.validator.ts";
import { openidConfigurationSchema } from "./validators/openid-configuration.validator.ts";

const CACHE_KEY = "jwks";
const CACHE_TTL = 300_000; // 5 minutes

@Injectable()
export class AuthService {
  private readonly authorisationApiUrl: string;

  private readonly cacheManager: Cache;

  private readonly logger = new Logger(AuthService.name);

  private readonly timeout: number;

  constructor(
    configService: ConfigService<ApiConfig, true>,
    @Inject(CACHE_MANAGER) cacheManager: Cache,
  ) {
    this.cacheManager = cacheManager;
    this.timeout = configService.get("requestTimeout", { infer: true });
    this.authorisationApiUrl = configService.get("authorisationApiUrl", {
      infer: true,
    });
  }

  async validateToken(
    bearerToken: string,
    reqId: string,
  ): Promise<SubjectInfo> {
    let jwtHeader: ProtectedHeaderParameters;
    let payload: JWTPayload;
    try {
      payload = decodeJwt(bearerToken);
      jwtHeader = decodeProtectedHeader(bearerToken);
    } catch (error) {
      throw new UnauthorizedError(UnauthorizedError.defaultTitle, {
        detail: `Invalid Authorisation Token: ${error instanceof Error ? error.message : "Unknown error"}`,
      });
    }

    // Verify that the access token has been issued by Authorisation API v4
    const { kid } = jwtHeader;
    if (!kid || typeof kid !== "string") {
      throw new UnauthorizedError(UnauthorizedError.defaultTitle, {
        detail: "Invalid JWT: empty or missing kid",
      });
    }

    const authApiPublicKeyJwk = await this.getAuthorisationApiJwk(kid, reqId);
    if (!authApiPublicKeyJwk) {
      throw new UnauthorizedError(UnauthorizedError.defaultTitle, {
        detail:
          "Invalid Access Token. Couldn't find a public key related to the given kid.",
      });
    }

    try {
      await jwtVerify(bearerToken, await importJWK(authApiPublicKeyJwk));
    } catch {
      throw new UnauthorizedError(UnauthorizedError.defaultTitle, {
        detail: "Access Token signature validation failed",
      });
    }

    // We only validate "sub" and "scp" (the only properties we need later)
    const { scp, sub } = payload;

    if (!sub) {
      throw new UnauthorizedError(UnauthorizedError.defaultTitle, {
        detail: "Invalid JWT: empty or missing sub",
      });
    }

    if (!scp || typeof scp !== "string") {
      throw new UnauthorizedError(UnauthorizedError.defaultTitle, {
        detail: "Invalid JWT: empty or missing scp",
      });
    }

    // The Access Token `scp` must contain one of the valid scopes.
    const validScopes = ["tnt_authorise", "tnt_create", "tnt_write"] as const;
    if (!validScopes.some((s) => scp.includes(s))) {
      throw new UnauthorizedError(UnauthorizedError.defaultTitle, {
        detail:
          "Invalid JWT: scp must contain tnt_authorise, tnt_create or tnt_write",
      });
    }

    return { scp, sub };
  }

  private async getAuthorisationApiJwk(kid: string, reqId: string) {
    let jwks = await this.cacheManager.get<JSONWebKeySet>(CACHE_KEY);

    if (!jwks) {
      let rawAuthApiOpenIdConfig: AxiosResponse<unknown>;
      try {
        rawAuthApiOpenIdConfig = await axios.get<unknown>(
          `${this.authorisationApiUrl}/.well-known/openid-configuration`,
          {
            headers: { "x-request-id": reqId },
            timeout: this.timeout,
          },
        );
      } catch (error) {
        if (isAxiosError(error)) {
          logAxiosError(error, this.logger);
        } else if (error instanceof Error) {
          this.logger.error(error.message, error.stack);
        } else {
          this.logger.error(error);
        }

        throw new InternalServerError(InternalServerError.defaultTitle, {
          detail: "Couldn't get Authorisation API OpenID Configuration",
        });
      }

      const parsedAuthApiOpenIdConfig = openidConfigurationSchema.safeParse(
        rawAuthApiOpenIdConfig.data,
      );

      if (!parsedAuthApiOpenIdConfig.success) {
        throw new InternalServerError(InternalServerError.defaultTitle, {
          detail:
            "Authorisation API didn't respond as expected (invalid OpenID Configuration)",
        });
      }

      const { jwks_uri: jwksUri } = parsedAuthApiOpenIdConfig.data;

      let rawAuthApiJwks: AxiosResponse<unknown>;

      try {
        rawAuthApiJwks = await axios.get<unknown>(jwksUri, {
          headers: { "x-request-id": reqId },
          timeout: this.timeout,
        });
      } catch (error) {
        if (isAxiosError(error)) {
          logAxiosError(error, this.logger);
        } else if (error instanceof Error) {
          this.logger.error(error.message, error.stack);
        } else {
          this.logger.error(error);
        }

        throw new InternalServerError(InternalServerError.defaultTitle, {
          detail: "Couldn't get Authorisation API JWKS",
        });
      }

      const parsedAuthApiJwks = jwksSchema.safeParse(rawAuthApiJwks.data);

      if (!parsedAuthApiJwks.success) {
        throw new InternalServerError(InternalServerError.defaultTitle, {
          detail: "Authorisation API didn't respond as expected (invalid JWKS)",
        });
      }

      jwks = parsedAuthApiJwks.data as JSONWebKeySet;

      // Store result in cache
      await this.cacheManager.set(CACHE_KEY, jwks, CACHE_TTL);
    }

    return jwks.keys.find((key) => key.kid === kid);
  }
}
