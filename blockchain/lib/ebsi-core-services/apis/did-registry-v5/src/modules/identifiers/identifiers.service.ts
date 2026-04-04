import type { DidRegistry } from "@ebsiint-sc/did-registry-v5";
import type { JWK } from "jose";

import {
  BadRequestError,
  decodeResult,
  encode,
  getErrorMessage,
  InvalidRequestJsonRpcError,
  isEthersError,
  logAxiosError,
  NotFoundError,
  remove0xPrefix,
} from "@ebsiint-api/shared";
import { DidRegistry__factory } from "@ebsiint-sc/did-registry-v5";
import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { isAxiosError } from "axios";

import type { ApiConfig } from "../../config/configuration.ts";
import type { JsonRpcSchema } from "./validators/JsonRpcSchema.ts";

import { LedgerService } from "../ledger/ledger.service.ts";
import { requestCheckControllerDtoSchema } from "./validators/RequestCheckControllerSchema.ts";

@Injectable()
export class IdentifiersService {
  private readonly didRegistryContract: DidRegistry;

  private readonly ledgerService: LedgerService;

  private readonly logger = new Logger(IdentifiersService.name);

  constructor(
    configService: ConfigService<ApiConfig, true>,
    ledgerService: LedgerService,
  ) {
    this.ledgerService = ledgerService;
    const didRegistryAddress = configService.get("contractAddr", {
      infer: true,
    });
    this.didRegistryContract = DidRegistry__factory.connect(didRegistryAddress);
  }

  async checkController(
    did: string,
    body: JsonRpcSchema,
    id: null | number | string | undefined,
  ): Promise<boolean> {
    const provider = this.ledgerService.getProvider();

    try {
      const parsedBody = requestCheckControllerDtoSchema.parse(body);
      const address = parsedBody.params[0]!;
      return await this.didRegistryContract
        // @ts-expect-error Error due to contracts using CommonJS modules
        .connect(provider)
        ["checkController(string,address)"](did, address);
    } catch (error_) {
      if (!(error_ instanceof Error)) {
        this.logger.error(error_);
        throw error_;
      }

      // Try to decode error
      const errorDescription = this.decodeError(error_);
      if (
        errorDescription &&
        errorDescription.args.length > 0 &&
        typeof errorDescription.args[0] === "string"
      ) {
        throw new InvalidRequestJsonRpcError(errorDescription.args[0], id);
      }

      if (isEthersError(error_)) {
        this.logger.error(error_, error_.stack); // Log the original error with all ethers.js details for internal debugging
        throw new InvalidRequestJsonRpcError(
          error_.error?.message ?? error_.shortMessage,
          id,
          undefined,
          error_.error &&
            "code" in error_.error &&
            typeof error_.error.code === "number"
            ? error_.error.code
            : undefined,
        );
      }

      if (isAxiosError(error_)) {
        logAxiosError(error_, this.logger);
      } else {
        this.logger.error(error_.message, error_.stack);
      }

      const error = new InvalidRequestJsonRpcError(getErrorMessage(error_), id);

      if (error_.stack) {
        error.stack = error_.stack;
      }

      throw error;
    }
  }

  decodeError(error: unknown) {
    if (
      !error ||
      typeof error !== "object" ||
      !("data" in error) ||
      !error.data ||
      !(typeof error.data === "string" || error.data instanceof Uint8Array)
    ) {
      return;
    }

    try {
      const errorDescription = this.didRegistryContract.interface.parseError(
        error.data,
      );

      if (!errorDescription) return;

      return errorDescription;
    } catch {
      // Ignore error
      return;
    }
  }

  async getDidDocument(
    did: string,
    validAt?: string,
  ): Promise<Record<string, unknown>> {
    const provider = this.ledgerService.getProvider();
    const contract = this.didRegistryContract
      // @ts-expect-error Error due to contracts using CommonJS modules
      .connect(provider);
    let document: Awaited<ReturnType<typeof contract.getDidDocument>>;

    try {
      if (validAt) {
        const timestamp = Math.floor(new Date(validAt).getTime() / 1000);
        document = await contract.getDidDocumentByTimestamp(did, timestamp);
      } else {
        document = await contract.getDidDocument(did);
      }

      if (!document.baseDocument) {
        throw new NotFoundError("Identifier Not Found", {
          detail: `Identifier ${did} not found`,
        });
      }

      let baseDocument: Record<string, unknown>;
      try {
        baseDocument = JSON.parse(document.baseDocument) as Record<
          string,
          unknown
        >;
      } catch (error) {
        throw new BadRequestError(BadRequestError.defaultTitle, {
          detail: `Identifier ${did} contains an invalid base document. ${
            error instanceof Error ? error.message : "Unknown error"
          }`,
        });
      }

      let verificationMethod: Record<string, unknown>[];
      try {
        verificationMethod = document.vMethods.map((vMethod, i) => ({
          controller: did,
          id: `${did}#${document.vMethodIds[i]}`,
          publicKeyJwk: vMethod.isSecp256k1
            ? encode.publicKey.fromHexToJWK(vMethod.publicKey)
            : (JSON.parse(
                Buffer.from(
                  remove0xPrefix(vMethod.publicKey),
                  "hex",
                ).toString(),
              ) as JWK),
          type: "JsonWebKey2020",
        }));
      } catch (error) {
        throw new BadRequestError(BadRequestError.defaultTitle, {
          detail: `Identifier ${did} contains an invalid public key in a verification method. ${
            error instanceof Error ? error.message : "Unknown error"
          }`,
        });
      }

      const verificationRelationships: Record<string, string[]> = {};
      for (const vRelationship of document.vRelationships) {
        verificationRelationships[vRelationship.name] ??= [];
        verificationRelationships[vRelationship.name]!.push(
          `${did}#${vRelationship.vMethodId}`,
        );
      }

      return {
        ...baseDocument,
        controller: document.controllers,
        id: did,
        verificationMethod,
        ...verificationRelationships,
      } as Record<string, unknown>;
    } catch (error) {
      if (isEthersError(error)) {
        this.logger.error(error, error.stack);
        // Throw a generic error to avoid leaking information.
        throw new NotFoundError("Identifier Not Found", {
          detail: `Identifier ${did} not found`,
        });
      }

      throw error;
    }
  }

  async getIdentifiers(
    page: number,
    pageSize: number,
    controller?: string,
    vMethodId?: string,
    vRelationship?: string,
  ): ReturnType<DidRegistry["getDids"]> {
    const provider = this.ledgerService.getProvider();
    const contract = this.didRegistryContract
      // @ts-expect-error Error due to contracts using CommonJS modules
      .connect(provider);

    if (controller) {
      if (vMethodId || vRelationship) {
        throw new BadRequestError(BadRequestError.defaultTitle, {
          detail:
            "It is not possible to filter by controller and verification relationship",
        });
      }

      try {
        return await contract.getDidsByController(controller, page, pageSize);
      } catch (error) {
        if (isEthersError(error)) {
          this.logger.error(error, error.stack);
        }

        if (
          error instanceof Error &&
          error.message.includes("controller doesn't exist")
        ) {
          throw new NotFoundError(NotFoundError.defaultTitle, {
            detail: `Controller ${controller} not found`,
          });
        }

        throw new Error(getErrorMessage(error));
      }
    }

    if (vMethodId || vRelationship) {
      if (!vMethodId || !vRelationship) {
        throw new BadRequestError(BadRequestError.defaultTitle, {
          detail:
            "Both verification-method-id and verification-relationship must be defined in the query to filter by verification relationship",
        });
      }

      try {
        const didsWithPeriod = await contract.getDidsByVerificationRelationship(
          vMethodId,
          vRelationship,
          page,
          pageSize,
        );
        const dids: string[] = [];
        const now = Math.floor(Date.now() / 1000);
        for (const didWithPeriod of didsWithPeriod.items) {
          if (
            Number(didWithPeriod.notBefore) <= now &&
            now <= Number(didWithPeriod.notAfter)
          ) {
            dids.push(didWithPeriod.did);
          }
        }

        return {
          // @ts-expect-error Error due to CommonJS vs ESM modules imports
          ...decodeResult(didsWithPeriod),
          items: dids,
        } as unknown as ReturnType<DidRegistry["getDids"]>;
      } catch (error) {
        if (isEthersError(error)) {
          this.logger.error(error, error.stack);
        }
        throw new NotFoundError("No identifiers found", {
          detail: "No identifiers found",
        });
      }
    }

    try {
      return await contract.getDids(page, pageSize);
    } catch (error) {
      if (isEthersError(error)) {
        this.logger.error(error, error.stack);
      }
      throw new NotFoundError("No identifiers found", {
        detail: "No identifiers found",
      });
    }
  }
}
