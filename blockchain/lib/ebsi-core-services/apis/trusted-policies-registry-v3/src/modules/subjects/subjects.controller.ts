import type { PaginatedList } from "@ebsiint-api/shared";

import { Accepts, NotFoundError, PaginationQuery } from "@ebsiint-api/shared";
import { Controller, Get, Param, Query } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import type { ApiConfig } from "../../config/configuration.ts";
import type {
  SubjectLink,
  SubjectPolicy,
  SubjectPolicyLink,
  SubjectResponseObject,
} from "./subjects.interface.ts";

import { GetSubjectParams, GetSubjectPolicyParams } from "./dto/index.ts";
import { formatPolicies, formatSubjects } from "./subjects.formatter.ts";
import { SubjectsService } from "./subjects.service.ts";

@Controller("/subjects")
export class SubjectsController {
  private readonly subjectsService: SubjectsService;
  private readonly configService: ConfigService<ApiConfig, true>;

  constructor(
    subjectsService: SubjectsService,
    configService: ConfigService<ApiConfig, true>,
  ) {
    this.subjectsService = subjectsService;
    this.configService = configService;
  }

  @Accepts("application/json")
  @Get("")
  async getSubjects(
    @Query() query: PaginationQuery,
  ): Promise<PaginatedList<SubjectLink>> {
    const subjects = await this.subjectsService.getSubjects(
      query["page[after]"],
      query["page[size]"],
    );

    const apiUrlPrefix = this.configService.get("apiUrlPrefix", {
      infer: true,
    });
    const domain = this.configService.get("domain", { infer: true });
    const baseUrl = `${domain}${apiUrlPrefix}/subjects`;

    return formatSubjects(
      subjects,
      query["page[after]"],
      query["page[size]"],
      baseUrl,
    );
  }

  @Accepts("application/json")
  @Get("/:subject")
  async getSubject(
    @Param() params: GetSubjectParams,
  ): Promise<SubjectResponseObject> {
    await this.subjectsService.getSubject(params.subject);
    return { subject: params.subject };
  }

  @Accepts("application/json")
  @Get("/:subject/policies")
  async getSubjectPolicies(
    @Param() params: GetSubjectParams,
    @Query() query: PaginationQuery,
  ): Promise<PaginatedList<SubjectPolicyLink>> {
    const policies = await this.subjectsService.getSubjectPolicies(
      params.subject,
      query["page[after]"],
      query["page[size]"],
    );

    const apiUrlPrefix = this.configService.get("apiUrlPrefix", {
      infer: true,
    });
    const domain = this.configService.get("domain", { infer: true });
    const baseUrl = `${domain}${apiUrlPrefix}/subjects/${params.subject}/policies`;

    return formatPolicies(
      policies,
      query["page[after]"],
      query["page[size]"],
      baseUrl,
    );
  }

  @Accepts("application/json")
  @Get("/:subject/policies/:policyName")
  async getSubjectPolicy(
    @Param() params: GetSubjectPolicyParams,
  ): Promise<SubjectPolicy> {
    const { policyName, subject } = params;

    const policyExists = await this.subjectsService.isSubjectPolicy(
      subject,
      policyName,
    );

    if (!policyExists) {
      throw new NotFoundError("Subject Policy Not Found", {
        detail: `Subject ${subject} doesn't have the policy ${policyName}`,
      });
    }

    return {
      policyName,
      subject,
    };
  }
}
