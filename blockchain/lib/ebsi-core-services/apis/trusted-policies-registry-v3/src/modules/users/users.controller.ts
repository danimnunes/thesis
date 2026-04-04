import type { PaginatedList } from "@ebsiint-api/shared";

import { Accepts, PaginationQuery } from "@ebsiint-api/shared";
import { Controller, Get, Param, Query } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import type { ApiConfig } from "../../config/configuration.ts";
import type { UserLink, UserResponseObject } from "./users.interface.ts";

import { GetUserParams } from "./dto/index.ts";
import { formatUsers } from "./users.formatter.ts";
import { UsersService } from "./users.service.ts";

@Controller("/users")
export class UsersController {
  private readonly usersService: UsersService;
  private readonly configService: ConfigService<ApiConfig, true>;

  constructor(
    usersService: UsersService,
    configService: ConfigService<ApiConfig, true>,
  ) {
    this.usersService = usersService;
    this.configService = configService;
  }

  @Accepts("application/json")
  @Get("")
  async getUsers(
    @Query() query: PaginationQuery,
  ): Promise<PaginatedList<UserLink>> {
    const users = await this.usersService.getUsers(
      query["page[after]"],
      query["page[size]"],
    );

    const apiUrlPrefix = this.configService.get("apiUrlPrefix", {
      infer: true,
    });
    const domain = this.configService.get("domain", { infer: true });
    const baseUrl = `${domain}${apiUrlPrefix}/users`;

    return formatUsers(
      users,
      query["page[after]"],
      query["page[size]"],
      baseUrl,
    );
  }

  @Accepts("application/json")
  @Get("/:user")
  async getUser(@Param() params: GetUserParams): Promise<UserResponseObject> {
    return this.usersService.getUser(params.user);
  }
}
