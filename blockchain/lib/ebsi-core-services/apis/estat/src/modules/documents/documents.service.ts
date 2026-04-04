import type { TrackAndTrace } from "@ebsiint-sc/track-and-trace";

import { isEthersError, NotFoundError } from "@ebsiint-api/shared";
import { TrackAndTrace__factory } from "@ebsiint-sc/track-and-trace";
import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import type { ApiConfig } from "../../config/configuration.ts";
import type {
  Document,
  Document__deprecated,
  DocumentAccesses,
  Event,
} from "./documents.interface.ts";

import { Permission } from "../../shared/constants.ts";
import { hexToDid, permissionToString } from "../../shared/utils.ts";
import { LedgerService } from "../ledger/ledger.service.ts";

@Injectable()
export class DocumentsService {
  private readonly contract: TrackAndTrace;

  private readonly ledgerService: LedgerService;

  private readonly logger = new Logger(DocumentsService.name);

  constructor(
    configService: ConfigService<ApiConfig, true>,
    ledgerService: LedgerService,
  ) {
    this.ledgerService = ledgerService;
    const contractAddress = configService.get("contractAddr", {
      infer: true,
    });
    this.contract = TrackAndTrace__factory.connect(contractAddress);
  }

  async getDocument(documentId: string): Promise<Document> {
    const provider = this.ledgerService.getProvider();

    let document: Awaited<ReturnType<TrackAndTrace["getDocument"]>>;

    try {
      document = await this.contract
        // @ts-expect-error Error due to CommonJS vs ESM modules imports
        .connect(provider)
        .getDocument(documentId);
    } catch (error) {
      if (isEthersError(error)) {
        this.logger.error(error, error.stack);
      }
      throw new NotFoundError("Document Not Found", {
        detail: `Document ${documentId} not found`,
      });
    }

    return {
      creator: document.creator,
      metadata: document.documentMetadata,
      timestamp: {
        datetime: `0x${document.documentTimestamp.timestamp.toString(16)}`,
        proof: document.documentTimestamp.proof,
        source: document.documentTimestamp.source === 0n ? "block" : "external",
      },
    } satisfies Document;
  }

  async getDocument__deprecated(
    documentId: string,
  ): Promise<Document__deprecated> {
    const provider = this.ledgerService.getProvider();

    let document: Awaited<ReturnType<TrackAndTrace["getDocument__deprecated"]>>;

    try {
      document = await this.contract
        // @ts-expect-error Error due to CommonJS vs ESM modules imports
        .connect(provider)
        .getDocument__deprecated(documentId);
    } catch (error) {
      if (isEthersError(error)) {
        this.logger.error(error, error.stack);
      }
      throw new NotFoundError("Document Not Found", {
        detail: `Document ${documentId} not found`,
      });
    }

    return {
      creator: document.creator,
      events: document.eventHashes,
      metadata: document.documentMetadata,
      timestamp: {
        datetime: `0x${document.documentTimestamp.timestamp.toString(16)}`,
        proof: document.documentTimestamp.proof,
        source: document.documentTimestamp.source === 0n ? "block" : "external",
      },
    } satisfies Document__deprecated;
  }

  async getDocumentAccesses(documentId: string): Promise<DocumentAccesses> {
    const pageSize = 50;
    let currentPage = 1;
    const documentAccesses: DocumentAccesses = [];

    const provider = this.ledgerService.getProvider();

    let invitedUsers: Awaited<
      ReturnType<TrackAndTrace["getAccessesByDocument"]>
    >;

    do {
      try {
        invitedUsers = await this.contract
          // @ts-expect-error Error due to CommonJS vs ESM modules imports
          .connect(provider)
          .getAccessesByDocument(documentId, currentPage, pageSize);
      } catch (error) {
        if (isEthersError(error)) {
          this.logger.error(error, error.stack);
        }
        throw new NotFoundError("Document Not Found", {
          detail: `Document ${documentId} not found`,
        });
      }

      const fetchedDocumentAccesses = await Promise.all(
        invitedUsers.items.map(async (did) => {
          const [grantedByAccounts, , access] = await this.contract
            // @ts-expect-error Error due to CommonJS vs ESM modules imports
            .connect(provider)
            .getGrantedBy(documentId, did, [
              Permission.DELEGATE,
              Permission.WRITE,
              Permission.CREATOR,
            ]);

          const accesses: DocumentAccesses = [];

          for (const [
            permission,
            grantedByAccount,
          ] of grantedByAccounts.entries()) {
            if (!grantedByAccount || grantedByAccount === "0x") continue;
            if (!access[permission]) continue;

            accesses.push({
              documentId,
              grantedBy: hexToDid(grantedByAccount),
              permission: permissionToString(permission),
              subject: hexToDid(did),
            });
          }

          return accesses;
        }),
      );

      documentAccesses.push(...fetchedDocumentAccesses.flat());

      currentPage += 1;
    } while (Number(invitedUsers.total) > (currentPage - 1) * pageSize);

    return documentAccesses;
  }

  async getDocumentEvent(documentId: string, eventId: string): Promise<Event> {
    const provider = this.ledgerService.getProvider();

    let event;
    try {
      event = await this.contract
        // @ts-expect-error Error due to CommonJS vs ESM modules imports
        .connect(provider)
        .getFunction("getEvent")(documentId, eventId);
    } catch (error) {
      if (isEthersError(error)) {
        this.logger.error(error, error.stack);
      }

      if (
        error instanceof Error &&
        error.message.includes("Document does not exist")
      ) {
        throw new NotFoundError("Document Not Found", {
          detail: `Document ${documentId} not found`,
        });
      }

      throw new NotFoundError("Event Not Found", {
        detail: `Event ${eventId} not found`,
      });
    }

    return {
      externalHash: event.externalHash,
      hash: event.hash,
      metadata: event.eventMetadata,
      origin: event.origin,
      sender: hexToDid(event.sender),
      timestamp: {
        datetime: `0x${event.eventTimestamp.timestamp.toString(16)}`,
        proof: event.eventTimestamp.proof,
        source: event.eventTimestamp.source === 0n ? "block" : "external",
      },
    } satisfies Event;
  }

  async getDocumentEvents(
    documentId: string,
    page: number,
    pageSize: number,
  ): ReturnType<TrackAndTrace["getEvents"]> {
    const provider = this.ledgerService.getProvider();

    try {
      return await this.contract
        // @ts-expect-error Error due to CommonJS vs ESM modules imports
        .connect(provider)
        .getEvents(documentId, page, pageSize);
    } catch (error) {
      if (isEthersError(error)) {
        this.logger.error(error, error.stack);
      }
      throw new NotFoundError("Document Not Found", {
        detail: `Document ${documentId} not found`,
      });
    }
  }

  async getDocuments(
    page: number,
    pageSize: number,
  ): ReturnType<TrackAndTrace["getDocuments"]> {
    const provider = this.ledgerService.getProvider();

    try {
      return await this.contract
        // @ts-expect-error Error due to CommonJS vs ESM modules imports
        .connect(provider)
        .getDocuments(page, pageSize);
    } catch (error) {
      if (isEthersError(error)) {
        this.logger.error(error, error.stack);
      }
      throw new NotFoundError("No documents found", {
        detail: "No documents found",
      });
    }
  }
}
