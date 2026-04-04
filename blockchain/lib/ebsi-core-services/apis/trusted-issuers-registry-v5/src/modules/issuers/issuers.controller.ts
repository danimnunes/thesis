import type { PaginatedList } from "@ebsiint-api/shared";
import type { FastifyRequest } from "fastify";

import { Accepts, PaginationQuery } from "@ebsiint-api/shared";
import {
  Controller,
  Get,
  Header,
  Param,
  Query,
  Req,
  UsePipes,
  ValidationPipe,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import type { ApiConfig } from "../../config/configuration.ts";
import type {
  AttributeDetailsObject,
  AttributeObject,
  DidLink,
  IdLink,
  IssuerProxyResponseObject,
  IssuerResponseObject,
  IssuerResponseObject__deprecated,
  ProxyLink,
} from "./issuers.interface.ts";

import {
  GetIssuerAttributeParamsDto,
  GetIssuerAttributeRevisionParamsDto,
  GetIssuerAttributeRevisionsQueryDto,
  GetIssuerParamsDto,
  GetIssuerProxyParamsDto,
  GetIssuerQueryDto,
} from "./dto/index.ts";
import {
  formatAttributes,
  formatIssuers,
  formatProxies,
  formatRevisions,
  formatRevisions__deprecated,
} from "./issuers.formatter.ts";
import { IssuersService } from "./issuers.service.ts";

const validationPipe = new ValidationPipe({
  forbidNonWhitelisted: true,
  transform: true,
  whitelist: true,
});

@Controller("/issuers")
export class IssuersController {
  private readonly issuersService: IssuersService;
  private readonly configService: ConfigService<ApiConfig, true>;

  constructor(
    issuersService: IssuersService,
    configService: ConfigService<ApiConfig, true>,
  ) {
    this.issuersService = issuersService;
    this.configService = configService;
  }

  @Accepts("application/json")
  @Get("")
  @UsePipes(validationPipe)
  async issuers(
    @Query() query: PaginationQuery,
  ): Promise<PaginatedList<DidLink>> {
    const issuers = await this.issuersService.getIssuers(
      query["page[after]"],
      query["page[size]"],
    );
    const apiUrlPrefix = this.configService.get("apiUrlPrefix", {
      infer: true,
    });
    const domain = this.configService.get("domain", { infer: true });
    const baseUrl = `${domain}${apiUrlPrefix}/issuers`;

    return formatIssuers(
      issuers,
      query["page[after]"],
      query["page[size]"],
      baseUrl,
    );
  }

  @Accepts("application/json")
  @Get("/:did")
  @UsePipes(validationPipe)
  async getIssuer(
    @Param() params: GetIssuerParamsDto,
    @Query() query: GetIssuerQueryDto,
  ): Promise<IssuerResponseObject | IssuerResponseObject__deprecated> {
    const { did } = params;

    if (query.version === "deprecated") {
      return this.issuersService.getIssuer__deprecated(did);
    }

    const issuer = await this.issuersService.getIssuer(did);
    const { noAttributesAccepted } = issuer;

    const apiUrlPrefix = this.configService.get("apiUrlPrefix", {
      infer: true,
    });
    const domain = this.configService.get("domain", { infer: true });
    const attributes = `${domain}${apiUrlPrefix}/issuers/${did}/attributes`;

    return {
      attributes,
      did,
      hasAttributes: !noAttributesAccepted,
    };
  }

  @Accepts("application/json")
  @Get("/:did/attributes")
  @UsePipes(validationPipe)
  async getIssuerAttributes(
    @Param() params: GetIssuerParamsDto,
    @Query() query: PaginationQuery,
  ): Promise<PaginatedList<IdLink>> {
    const { did } = params;

    const attributes = await this.issuersService.getAttributes(
      did,
      query["page[after]"],
      query["page[size]"],
    );

    const apiUrlPrefix = this.configService.get("apiUrlPrefix", {
      infer: true,
    });
    const domain = this.configService.get("domain", { infer: true });
    const baseUrl = `${domain}${apiUrlPrefix}/issuers/${did}/attributes`;

    return formatAttributes(
      attributes,
      query["page[after]"],
      query["page[size]"],
      baseUrl,
    );
  }

  @Accepts("application/json")
  @Get("/:did/attributes/:attributeId")
  @UsePipes(validationPipe)
  async getIssuerAttribute(
    @Param() params: GetIssuerAttributeParamsDto,
  ): Promise<AttributeDetailsObject> {
    const { attributeId, did } = params;

    const attribute = await this.issuersService.getAttribute(did, attributeId);

    return {
      attribute,
      did,
    };
  }

  @Accepts("application/json")
  @Get("/:did/attributes/:attributeId/revisions")
  @UsePipes(validationPipe)
  async issuerAttributeIdRevisions(
    @Param() params: GetIssuerAttributeParamsDto,
    @Query() query: GetIssuerAttributeRevisionsQueryDto,
  ): Promise<PaginatedList<AttributeObject> | PaginatedList<IdLink>> {
    const { attributeId, did } = params;
    const version = query.version ?? "latest";

    if (version === "deprecated") {
      await this.issuersService.assertIssuerExists__deprecated(did);

      const { revisions, total } =
        await this.issuersService.getIssuerAttributeIdRevisions__deprecated(
          attributeId,
          did,
          query["page[after]"],
          query["page[size]"],
        );

      const apiUrlPrefix = this.configService.get("apiUrlPrefix", {
        infer: true,
      });
      const domain = this.configService.get("domain", { infer: true });
      const baseUrl = `${domain}${apiUrlPrefix}/issuers/${did}/attributes/${attributeId}/revisions`;

      return formatRevisions__deprecated(
        revisions,
        total,
        query["page[after]"],
        query["page[size]"],
        baseUrl,
        version,
      );
    }

    const revisions = await this.issuersService.getIssuerAttributeIdRevisions(
      attributeId,
      did,
      query["page[after]"],
      query["page[size]"],
    );

    const apiUrlPrefix = this.configService.get("apiUrlPrefix", {
      infer: true,
    });
    const domain = this.configService.get("domain", { infer: true });
    const baseUrl = `${domain}${apiUrlPrefix}/issuers/${did}/attributes/${attributeId}/revisions`;

    return formatRevisions(
      revisions,
      query["page[after]"],
      query["page[size]"],
      baseUrl,
      version,
    );
  }

  @Accepts("application/json")
  @Get("/:did/attributes/:attributeId/revisions/:revisionId")
  @UsePipes(validationPipe)
  async issuerAttributeIdRevision(
    @Param() params: GetIssuerAttributeRevisionParamsDto,
  ): Promise<AttributeDetailsObject> {
    const { attributeId, did, revisionId } = params;

    const attribute = await this.issuersService.getIssuerAttributeIdRevision(
      did,
      attributeId,
      revisionId,
    );

    return {
      attribute,
      did,
    };
  }

  @Accepts("application/json")
  @Get("/:did/proxies")
  @UsePipes(validationPipe)
  async getIssuerProxies(
    @Query() query: PaginationQuery,
    @Param() params: GetIssuerParamsDto,
  ): Promise<PaginatedList<ProxyLink>> {
    const { did } = params;

    const proxies = await this.issuersService.getIssuerProxies(
      did,
      query["page[after]"],
      query["page[size]"],
    );

    const apiUrlPrefix = this.configService.get("apiUrlPrefix", {
      infer: true,
    });
    const domain = this.configService.get("domain", { infer: true });
    const baseUrl = `${domain}${apiUrlPrefix}/issuers/${did}/proxies`;

    return formatProxies(
      proxies,
      query["page[after]"],
      query["page[size]"],
      baseUrl,
    );
  }

  @Accepts("application/json")
  @Get("/:did/proxies/:proxyId")
  @UsePipes(validationPipe)
  async getIssuerProxy(
    @Param() params: GetIssuerProxyParamsDto,
  ): Promise<IssuerProxyResponseObject> {
    const { did, proxyId } = params;

    return this.issuersService.getIssuerProxy(did, proxyId);
  }

  @Accepts("text/plain")
  @Get("/:did/proxies/:proxyId/*")
  // it does not use the restrictive validation pipe because
  // it accepts all routes (*)
  @Header("content-type", "text/plain; charset=utf-8")
  async proxyRequest(
    @Param() params: GetIssuerProxyParamsDto,
    @Req() req: FastifyRequest,
  ): Promise<string> {
    const { did, proxyId } = params;
    const { id: reqId, url } = req;

    // Forward request to issuer's proxy
    return this.issuersService.proxyRequest(did, proxyId, url, reqId);
  }
}
