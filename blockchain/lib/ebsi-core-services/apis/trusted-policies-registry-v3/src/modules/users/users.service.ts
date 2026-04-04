import type { PolicyRegistry } from "@ebsiint-sc/trusted-policies-registry-v3";

import { decodeContractError, NotFoundError } from "@ebsiint-api/shared";
import { PolicyRegistry__factory } from "@ebsiint-sc/trusted-policies-registry-v3";
import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import type { ApiConfig } from "../../config/configuration.ts";
import type { UserResponseObject } from "./users.interface.ts";

import { LedgerService } from "../ledger/ledger.service.ts";

@Injectable()
export class UsersService {
  private readonly contract: PolicyRegistry;

  private readonly ledgerService: LedgerService;

  private readonly logger = new Logger(UsersService.name);

  constructor(
    configService: ConfigService<ApiConfig, true>,
    ledgerService: LedgerService,
  ) {
    this.ledgerService = ledgerService;
    const contractAddress = configService.get("contractAddr", { infer: true });
    this.contract = PolicyRegistry__factory.connect(contractAddress);
  }

  async getAllUserAttributes(address: string, page = 1): Promise<string[]> {
    const provider = this.ledgerService.getProvider();

    try {
      const userAttributes = await this.contract
        // @ts-expect-error Error due to CommonJS vs ESM modules imports
        .connect(provider)
        .getUserAttributes(address, page, 50);
      const nextPage = Number(BigInt(userAttributes.next).toString());
      if (nextPage > page) {
        return [
          ...userAttributes.items,
          ...(await this.getAllUserAttributes(address, nextPage)),
        ];
      }
      return userAttributes.items;
    } catch (error) {
      this.logger.error(error);

      // @ts-expect-error Argument of type 'PolicyRegistryInterface' is not assignable to parameter of type 'Interface'
      const decodedError = decodeContractError(this.contract.interface, error);

      // Return empty attributes list
      if (decodedError === "Policy: user has no attribute") {
        return [];
      }

      throw new NotFoundError("User Attributes Not Found", {
        detail: "User Attributes Not Found",
      });
    }
  }

  async getUser(user: string): Promise<UserResponseObject> {
    try {
      return {
        attributes: await this.getAllUserAttributes(user),
        user,
      };
    } catch (error) {
      this.logger.error(error);

      throw new NotFoundError("User Not Found", {
        detail: `User ${user} not found`,
      });
    }
  }

  async getUsers(
    page: number,
    pageSize: number,
  ): ReturnType<PolicyRegistry["getUsers"]> {
    const provider = this.ledgerService.getProvider();

    try {
      return await this.contract
        // @ts-expect-error Error due to CommonJS vs ESM modules imports
        .connect(provider)
        .getUsers(page, pageSize);
    } catch (error) {
      this.logger.error(error);

      throw new NotFoundError("Users Not Found", {
        detail: "Users Not Found",
      });
    }
  }
}
