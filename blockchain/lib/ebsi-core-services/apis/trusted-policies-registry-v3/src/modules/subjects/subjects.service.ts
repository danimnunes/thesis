import type { PolicyRegistry } from "@ebsiint-sc/trusted-policies-registry-v3";

import {
  decodeContractError,
  InternalServerError,
  NotFoundError,
} from "@ebsiint-api/shared";
import { PolicyRegistry__factory } from "@ebsiint-sc/trusted-policies-registry-v3";
import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import type { ApiConfig } from "../../config/configuration.ts";
import type { SubjectPolicies } from "./subjects.interface.ts";

import { LedgerService } from "../ledger/ledger.service.ts";

@Injectable()
export class SubjectsService {
  private readonly contract: PolicyRegistry;

  private readonly ledgerService: LedgerService;

  private readonly logger = new Logger(SubjectsService.name);

  constructor(
    configService: ConfigService<ApiConfig, true>,
    ledgerService: LedgerService,
  ) {
    this.ledgerService = ledgerService;
    const contractAddress = configService.get("contractAddr", { infer: true });
    this.contract = PolicyRegistry__factory.connect(contractAddress);
  }

  async getSubject(user: string): Promise<boolean> {
    await this.getSubjectPolicies(user, 1, 1);
    return true;
  }

  async getSubjectPolicies(
    user: string,
    page: number,
    pageSize: number,
  ): Promise<SubjectPolicies> {
    const provider = this.ledgerService.getProvider();

    try {
      const res = await this.contract
        // @ts-expect-error Error due to CommonJS vs ESM modules imports
        .connect(provider)
        .getUserAttributes(user, page, pageSize);

      return {
        items: res.items,
        total: Number(res.total),
      };
    } catch (error) {
      this.logger.error(error);

      // @ts-expect-error Argument of type 'PolicyRegistryInterface' is not assignable to parameter of type 'Interface'
      const decodedError = decodeContractError(this.contract.interface, error);

      if (decodedError === "Policy: user does not exist") {
        throw new NotFoundError("Subject Not Found", {
          detail: `Subject ${user} not found`,
        });
      }

      if (decodedError === "Policy: user has no attribute") {
        return {
          items: [],
          total: 0,
        };
      }

      throw new InternalServerError(InternalServerError.defaultTitle, {
        detail: "Unexpected smart contract error",
      });
    }
  }

  async getSubjects(
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

      throw new InternalServerError(InternalServerError.defaultTitle, {
        detail: "Unexpected smart contract error",
      });
    }
  }

  async isSubjectPolicy(
    user: string,
    policyName: string,
  ): ReturnType<PolicyRegistry["isUserAttribute"]> {
    const provider = this.ledgerService.getProvider();

    try {
      return await this.contract
        // @ts-expect-error Error due to CommonJS vs ESM modules imports
        .connect(provider)
        .isUserAttribute(user, policyName);
    } catch (error) {
      this.logger.error(error);

      // @ts-expect-error Argument of type 'PolicyRegistryInterface' is not assignable to parameter of type 'Interface'
      const decodedError = decodeContractError(this.contract.interface, error);

      if (decodedError === "Policy: user does not exist") {
        throw new NotFoundError("Subject Not Found", {
          detail: `Subject ${user} not found`,
        });
      }

      if (decodedError === "Policy: user has no attribute") {
        return false;
      }

      throw new InternalServerError(InternalServerError.defaultTitle, {
        detail: "Unexpected smart contract error",
      });
    }
  }
}
