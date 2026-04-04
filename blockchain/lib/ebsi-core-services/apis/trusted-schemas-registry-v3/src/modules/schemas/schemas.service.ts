import type { SchemaSCRegistry } from "@ebsiint-sc/trusted-schemas-registry-v3";

import {
  isEthersError,
  NotFoundError,
  remove0xPrefix,
} from "@ebsiint-api/shared";
import { SchemaSCRegistry__factory } from "@ebsiint-sc/trusted-schemas-registry-v3";
import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import pLimit from "p-limit";

import type { ApiConfig } from "../../config/configuration.ts";
import type { ItemsList } from "./schemas.interface.ts";

import { LedgerService } from "../ledger/ledger.service.ts";
import { getContractError, range, schemaIdToHex } from "./schemas.utils.ts";

const MAX_RESULTS_PER_PAGE = 50;
const MAX_CONCURRENT_PROMISES = 10;

@Injectable()
export class SchemasService {
  private readonly contract: SchemaSCRegistry;

  private readonly ledgerService: LedgerService;

  private readonly logger = new Logger(SchemasService.name);

  constructor(
    configService: ConfigService<ApiConfig, true>,
    ledgerService: LedgerService,
  ) {
    this.ledgerService = ledgerService;
    const contractAddress = configService.get("contractAddr", {
      infer: true,
    });
    this.contract = SchemaSCRegistry__factory.connect(contractAddress);
  }

  async getSchema(schemaId: string): Promise<unknown> {
    const provider = this.ledgerService.getProvider();

    let schema: Awaited<
      ReturnType<SchemaSCRegistry["getLatestSchemaRevision"]>
    >;
    const hexSchemaId = schemaIdToHex(schemaId);

    try {
      schema = await this.contract
        // @ts-expect-error Error due to CommonJS vs ESM modules imports
        .connect(provider)
        .getLatestSchemaRevision(hexSchemaId);
    } catch (error) {
      if (isEthersError(error)) {
        this.logger.error(error, error.stack);
      }

      const contractError = getContractError(error);

      throw new NotFoundError("Schema Not Found", {
        detail:
          contractError === "schema not found"
            ? `Schema ${schemaId} not found`
            : contractError,
      });
    }

    const decodedSchemaInfo = JSON.parse(
      Buffer.from(remove0xPrefix(schema), "hex").toString("utf8"),
    );

    return decodedSchemaInfo;
  }

  async getSchemaRevision(
    schemaId: string,
    schemaRevisionId: string,
  ): Promise<unknown> {
    const provider = this.ledgerService.getProvider();

    const hexSchemaId = schemaIdToHex(schemaId);

    // Get revision
    let revision: Awaited<ReturnType<SchemaSCRegistry["getSchemaRevision"]>>;
    try {
      revision = await this.contract
        // @ts-expect-error Error due to CommonJS vs ESM modules imports
        .connect(provider)
        .getSchemaRevision(hexSchemaId, schemaRevisionId);
    } catch (error) {
      if (isEthersError(error)) {
        this.logger.error(error, error.stack);
      }

      const contractError = getContractError(error);

      switch (contractError) {
        case "schema not found": {
          throw new NotFoundError("Schema Not Found", {
            detail: `Schema ${schemaId} not found`,
          });
        }
        case "revision not found": {
          throw new NotFoundError("Revision Not Found", {
            detail: `Revision ${schemaRevisionId} not found`,
          });
        }
        default: {
          throw new NotFoundError("Not Found", {
            detail: contractError,
          });
        }
      }
    }

    const decodedSchemaRevisionInfo = JSON.parse(
      Buffer.from(remove0xPrefix(revision), "hex").toString("utf8"),
    );

    return decodedSchemaRevisionInfo;
  }

  async getSchemaRevisionMetadata(
    schemaId: string,
    schemaRevisionId: string,
    metadataId: string,
  ): Promise<unknown> {
    const provider = this.ledgerService.getProvider();

    const hexSchemaId = schemaIdToHex(schemaId);

    // Get metadata
    let metadata: Awaited<
      ReturnType<SchemaSCRegistry["getSchemaRevisionMetadataByMetadataId"]>
    >;
    try {
      metadata = await this.contract
        // @ts-expect-error Error due to CommonJS vs ESM modules imports
        .connect(provider)
        .getSchemaRevisionMetadataByMetadataId(
          hexSchemaId,
          schemaRevisionId,
          metadataId,
        );
    } catch (error) {
      if (isEthersError(error)) {
        this.logger.error(error, error.stack);
      }

      const contractError = getContractError(error);

      switch (contractError) {
        case "schema not found": {
          throw new NotFoundError("Schema Not Found", {
            detail: `Schema ${schemaId} not found`,
          });
        }
        case "revision not found": {
          throw new NotFoundError("Revision Not Found", {
            detail: `Revision ${schemaRevisionId} not found`,
          });
        }
        case "metadata not found": {
          throw new NotFoundError("Metadata Not Found", {
            detail: `Metadata ${metadataId} not found`,
          });
        }
        default: {
          throw new NotFoundError("Not Found", {
            detail: contractError,
          });
        }
      }
    }

    const decodedMetadata = JSON.parse(
      Buffer.from(remove0xPrefix(metadata), "hex").toString("utf8"),
    );

    return decodedMetadata;
  }

  async getSchemaRevisionMetadataList(
    schemaId: string,
    schemaRevisionId: string,
    page: number,
    pageSize: number,
  ): Promise<ItemsList> {
    const provider = this.ledgerService.getProvider();

    const hexSchemaId = schemaIdToHex(schemaId);

    try {
      // Get metadata
      const metadata = await this.contract
        // @ts-expect-error Error due to CommonJS vs ESM modules imports
        .connect(provider)
        .getSchemaRevisionMetadataIds(
          hexSchemaId,
          schemaRevisionId,
          page,
          pageSize,
        );

      return {
        items: metadata.items,
        total: Number(metadata.total),
      };
    } catch (error) {
      if (isEthersError(error)) {
        this.logger.error(error, error.stack);
      }

      const contractError = getContractError(error);

      switch (contractError) {
        case "schema not found": {
          throw new NotFoundError("Schema Not Found", {
            detail: `Schema ${schemaId} not found`,
          });
        }
        case "revision not found": {
          throw new NotFoundError("Revision Not Found", {
            detail: `Revision ${schemaRevisionId} not found`,
          });
        }
        default: {
          throw new NotFoundError("Not Found", {
            detail: contractError,
          });
        }
      }
    }
  }

  async getSchemaRevisions(
    schemaId: string,
    page: number,
    pageSize: number,
  ): Promise<ItemsList> {
    const provider = this.ledgerService.getProvider();

    const hexSchemaId = schemaIdToHex(schemaId);

    try {
      // Get the revisions
      const revisions = await this.contract
        // @ts-expect-error Error due to CommonJS vs ESM modules imports
        .connect(provider)
        .getSchemaRevisionIds(hexSchemaId, page, pageSize);

      return {
        items: revisions.items,
        total: Number(revisions.total),
      };
    } catch (error) {
      if (isEthersError(error)) {
        this.logger.error(error, error.stack);
      }

      const contractError = getContractError(error);

      throw new NotFoundError("Schema Not Found", {
        detail:
          contractError === "schema not found"
            ? `Schema ${schemaId} not found`
            : contractError,
      });
    }
  }

  async getSchemaRevisions__deprecated(
    schemaId: string,
    page: number,
    pageSize: number,
    validAt?: string,
  ): Promise<ItemsList> {
    const provider = this.ledgerService.getProvider();

    const hexSchemaId = schemaIdToHex(schemaId);

    // Make sure the schema exists
    try {
      await this.contract
        // @ts-expect-error Error due to CommonJS vs ESM modules imports
        .connect(provider)
        .getLatestSchemaRevision(hexSchemaId);
    } catch (error) {
      if (isEthersError(error)) {
        this.logger.error(error, error.stack);
      }
      throw new NotFoundError("Schema Not Found", {
        detail: `Schema ${schemaId} not found`,
      });
    }

    try {
      // Return only revisions valid at the given time (this is excessively inefficient!)
      if (validAt) {
        // Get all revisions IDs
        const allRevisionsIds: string[] = [];

        // Get the first MAX_RESULTS_PER_PAGE revisions IDs
        const revisions = await this.contract
          // @ts-expect-error Error due to CommonJS vs ESM modules imports
          .connect(provider)
          .getSchemaRevisionIds(hexSchemaId, 1, MAX_RESULTS_PER_PAGE);
        allRevisionsIds.push(...revisions.items);
        const total = Number(revisions.total);

        const limit = pLimit(MAX_CONCURRENT_PROMISES); // Limit concurrent promises

        if (total > MAX_RESULTS_PER_PAGE) {
          const contract = this.contract
            // @ts-expect-error Error due to CommonJS vs ESM modules imports
            .connect(provider);
          const otherSchemaRevisionIds = await Promise.all(
            // From page 2 to page "Math.ceil(total / MAX_RESULTS_PER_PAGE)"
            range(2, Math.ceil(total / MAX_RESULTS_PER_PAGE)).map((pageIndex) =>
              limit(() =>
                contract.getSchemaRevisionIds(
                  hexSchemaId,
                  pageIndex,
                  MAX_RESULTS_PER_PAGE,
                ),
              ),
            ),
          );
          // We need to fetch the next pages
          allRevisionsIds.push(
            ...otherSchemaRevisionIds.reduce(
              (arr, row) => [...arr, ...row.items],
              [] as string[],
            ),
          );
        }

        // For each revision ID, get latest metadata
        const contract = this.contract
          // @ts-expect-error Error due to CommonJS vs ESM modules imports
          .connect(provider);
        const allMetadata = await Promise.all(
          allRevisionsIds.map((id) =>
            limit(() =>
              contract.getLatestSchemaRevisionMetadataByRevisionId(
                hexSchemaId,
                id,
              ),
            ),
          ),
        );

        const validRevisionsIds: string[] = [];
        for (const [index, metadata] of allMetadata.entries()) {
          try {
            const decodedMetadata = JSON.parse(
              Buffer.from(remove0xPrefix(metadata), "hex").toString("utf8"),
            ) as Record<string, unknown>;

            const validAtDate = new Date(validAt);

            // If validFrom > validAt, ignore
            if (
              decodedMetadata["validFrom"] &&
              new Date(decodedMetadata["validFrom"] as string) > validAtDate
            ) {
              continue;
            }

            // If validTo < validAt, ignore
            if (
              decodedMetadata["validTo"] &&
              new Date(decodedMetadata["validTo"] as string) < validAtDate
            ) {
              continue;
            }

            validRevisionsIds.push(allRevisionsIds[index]!);
          } catch {
            // Ignore
          }
        }

        return {
          items: validRevisionsIds.slice(
            (page - 1) * pageSize,
            page * pageSize,
          ),
          total: validRevisionsIds.length,
        };
      }

      // Get the revisions
      const revisions = await this.contract
        // @ts-expect-error Error due to CommonJS vs ESM modules imports
        .connect(provider)
        .getSchemaRevisionIds(hexSchemaId, page, pageSize);

      return {
        items: revisions.items,
        total: Number(revisions.total),
      };
    } catch (error) {
      if (isEthersError(error)) {
        this.logger.error(error, error.stack);
      }
      throw new NotFoundError("Revisions Not Found", {
        detail: "Revisions not found",
      });
    }
  }

  async getSchemas(page: number, pageSize: number): Promise<ItemsList> {
    const provider = this.ledgerService.getProvider();

    try {
      const result = await this.contract
        // @ts-expect-error Error due to CommonJS vs ESM modules imports
        .connect(provider)
        .getSchemaIds(page, pageSize);

      return {
        items: result.items,
        total: Number(result.total),
      };
    } catch (error) {
      if (isEthersError(error)) {
        this.logger.error(error, error.stack);
      }
      throw new NotFoundError("Schemas Not Found", {
        detail: `Schemas not found`,
      });
    }
  }
}
