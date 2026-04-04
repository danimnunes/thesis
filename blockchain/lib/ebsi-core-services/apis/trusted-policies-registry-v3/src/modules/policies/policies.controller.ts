import type { PaginatedList } from "@ebsiint-api/shared";

import { Accepts, PaginationQuery } from "@ebsiint-api/shared";
import { Controller, Get, Param, Query } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import type { ApiConfig } from "../../config/configuration.ts";
import type { PolicyLink, PolicyResponseObject } from "./policies.interface.ts";

import { GetPolicyParams } from "./dto/index.ts";
import { formatPolicies } from "./policies.formatter.ts";
import { PoliciesService } from "./policies.service.ts";

@Controller("/policies")
export class PoliciesController {
  private readonly policiesService: PoliciesService;
  private readonly configService: ConfigService<ApiConfig, true>;

  constructor(
    policiesService: PoliciesService,
    configService: ConfigService<ApiConfig, true>,
  ) {
    this.policiesService = policiesService;
    this.configService = configService;
  }

  @Accepts("application/json")
  @Get("")
  async getPolicies(
    @Query() query: PaginationQuery,
  ): Promise<PaginatedList<PolicyLink>> {
    const policies = await this.policiesService.getPolicyNames(
      query["page[after]"],
      query["page[size]"],
    );

    const apiUrlPrefix = this.configService.get("apiUrlPrefix", {
      infer: true,
    });
    const domain = this.configService.get("domain", { infer: true });
    const baseUrl = `${domain}${apiUrlPrefix}/policies`;

    return formatPolicies(
      policies,
      query["page[after]"],
      query["page[size]"],
      baseUrl,
    );
  }

  @Accepts("application/json")
  @Get("/:policyName")
  async getPolicy(
    @Param() params: GetPolicyParams,
  ): Promise<PolicyResponseObject> {
    const { policyName } = params;

    return this.policiesService.getPolicy(policyName);
  }
}
