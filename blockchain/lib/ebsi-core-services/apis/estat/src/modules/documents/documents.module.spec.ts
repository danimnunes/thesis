import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import type { RawServerDefault } from "fastify";

import { TrackAndTrace__factory } from "@ebsiint-sc/track-and-trace";
import { randomBytes } from "node:crypto";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import type { TestDocument } from "../../../tests/utils/data.ts";
import type {
  Document,
  Document__deprecated,
  DocumentAccesses,
  Event,
} from "./documents.interface.ts";

import { getNestFastifyApplication } from "../../../tests/utils/app.ts";
import { setupTestEnv } from "../../../tests/utils/estat.ts";
import { LedgerService } from "../ledger/ledger.service.ts";
import { DocumentsModule } from "./documents.module.ts";

const DOCUMENTS_WITH_BLOCK_SOURCE = 3;
const DOCUMENTS_WITH_EXTERNAL_SOURCE = 3;
const DOCUMENT_EVENTS = 3;

describe("Documents Module", () => {
  let app: NestFastifyApplication;
  let server: RawServerDefault;
  let testEnv: Awaited<ReturnType<typeof setupTestEnv>>;
  let documentsWithBlockSource: TestDocument[];
  let documentsWithExternalSource: TestDocument[];

  beforeAll(async () => {
    // Spin up test blockchain (hardhat)
    testEnv = await setupTestEnv({
      documentEventsTotal: DOCUMENT_EVENTS,
      documentsWithBlockSourceTotal: DOCUMENTS_WITH_BLOCK_SOURCE,
      documentsWithExternalSourceTotal: DOCUMENTS_WITH_EXTERNAL_SOURCE,
    });
    const { provider, trackAndTraceContract } = testEnv;
    documentsWithBlockSource = testEnv.documentsWithBlockSource;
    documentsWithExternalSource = testEnv.documentsWithExternalSource;

    // Mock contract
    vi.spyOn(TrackAndTrace__factory, "connect").mockImplementation(
      // Create new instance without runner (provider)
      () => trackAndTraceContract.connect(),
    );

    // Mock LedgerService
    vi.spyOn(LedgerService.prototype, "getProvider").mockImplementation(
      // @ts-expect-error Error due to a mismatch between ESM and CommonJS modules
      () => provider,
    );

    app = await getNestFastifyApplication({
      imports: [DocumentsModule],
    });

    await app.init();
    const fastifyInstance = app.getHttpAdapter().getInstance();
    await fastifyInstance.ready();
    server = app.getHttpServer();
  });

  afterAll(async () => {
    await app.close();
  });

  describe("GET /documents", () => {
    it("should return a paginated collection of documents", async () => {
      expect.assertions(3);

      const response = await request(server).get("/documents");

      expect(response.body).toStrictEqual({
        items: [
          ...documentsWithBlockSource.map((document) => ({
            documentId: document.documentHash,
            href: expect.stringContaining(
              `/documents/${document.documentHash}`,
            ),
          })),
          ...documentsWithExternalSource.map((document) => ({
            documentId: document.documentHash,
            href: expect.stringContaining(
              `/documents/${document.documentHash}`,
            ),
          })),
        ],
        links: {
          first: expect.stringContaining(
            "/documents?page[after]=1&page[size]=10",
          ),
          last: expect.stringContaining(
            "/documents?page[after]=1&page[size]=10",
          ),
          next: expect.stringContaining(
            "/documents?page[after]=1&page[size]=10",
          ),
          prev: expect.stringContaining(
            "/documents?page[after]=1&page[size]=10",
          ),
        },
        pageSize: 10,
        self: expect.stringContaining("/documents?page[after]=1&page[size]=10"),
        total: DOCUMENTS_WITH_BLOCK_SOURCE + DOCUMENTS_WITH_EXTERNAL_SOURCE,
      });
      expect((response.body as { items: string }).items).toHaveLength(
        DOCUMENTS_WITH_BLOCK_SOURCE + DOCUMENTS_WITH_EXTERNAL_SOURCE,
      );
      expect(response.status).toBe(200);
    });

    it("should handle the pagination properly", async () => {
      expect.assertions(12);

      const allDocs = [
        ...documentsWithBlockSource.map((document) => ({
          documentId: document.documentHash,
          href: expect.stringContaining(`/documents/${document.documentHash}`),
        })),
        ...documentsWithExternalSource.map((document) => ({
          documentId: document.documentHash,
          href: expect.stringContaining(`/documents/${document.documentHash}`),
        })),
      ];

      const response1 = await request(server).get("/documents?page[size]=2");
      expect(response1.body).toStrictEqual({
        items: allDocs.slice(0, 2),
        links: {
          first: expect.stringContaining(
            "/documents?page[after]=1&page[size]=2",
          ),
          last: expect.stringContaining(
            "/documents?page[after]=3&page[size]=2",
          ),
          next: expect.stringContaining(
            "/documents?page[after]=2&page[size]=2",
          ),
          prev: expect.stringContaining(
            "/documents?page[after]=1&page[size]=2",
          ),
        },
        pageSize: 2,
        self: expect.stringContaining("/documents?page[after]=1&page[size]=2"),
        total: DOCUMENTS_WITH_BLOCK_SOURCE + DOCUMENTS_WITH_EXTERNAL_SOURCE,
      });
      expect((response1.body as { items: string }).items).toHaveLength(2);
      expect(response1.status).toBe(200);

      // next page
      const response2 = await request(server).get(
        "/documents?page[after]=2&page[size]=2",
      );
      expect(response2.body).toStrictEqual({
        items: allDocs.slice(2, 4),
        links: {
          first: expect.stringContaining(
            "/documents?page[after]=1&page[size]=2",
          ),
          last: expect.stringContaining(
            "/documents?page[after]=3&page[size]=2",
          ),
          next: expect.stringContaining(
            "/documents?page[after]=3&page[size]=2",
          ),
          prev: expect.stringContaining(
            "/documents?page[after]=1&page[size]=2",
          ),
        },
        pageSize: 2,
        self: expect.stringContaining("/documents?page[after]=2&page[size]=2"),
        total: DOCUMENTS_WITH_BLOCK_SOURCE + DOCUMENTS_WITH_EXTERNAL_SOURCE,
      });
      expect((response2.body as { items: string }).items).toHaveLength(2);
      expect(response2.status).toBe(200);

      // big page
      const response3 = await request(server).get(
        "/documents?page[after]=100&page[size]=2",
      );
      expect(response3.body).toStrictEqual({
        items: [],
        links: {
          first: expect.stringContaining(
            "/documents?page[after]=1&page[size]=2",
          ),
          last: expect.stringContaining(
            "/documents?page[after]=3&page[size]=2",
          ),
          next: expect.stringContaining(
            "/documents?page[after]=3&page[size]=2",
          ),
          prev: expect.stringContaining(
            "/documents?page[after]=3&page[size]=2",
          ),
        },
        pageSize: 2,
        self: expect.stringContaining(
          "/documents?page[after]=100&page[size]=2",
        ),
        total: DOCUMENTS_WITH_BLOCK_SOURCE + DOCUMENTS_WITH_EXTERNAL_SOURCE,
      });
      expect((response3.body as { items: string }).items).toHaveLength(0);
      expect(response3.status).toBe(200);

      // page["after"] defined but page["size"] undefined
      const response4 = await request(server).get("/documents?page[after]=1");
      expect(response4.body).toStrictEqual({
        items: allDocs,
        links: {
          first: expect.stringContaining(
            "/documents?page[after]=1&page[size]=10",
          ),
          last: expect.stringContaining(
            "/documents?page[after]=1&page[size]=10",
          ),
          next: expect.stringContaining(
            "/documents?page[after]=1&page[size]=10",
          ),
          prev: expect.stringContaining(
            "/documents?page[after]=1&page[size]=10",
          ),
        },
        pageSize: 10,
        self: expect.stringContaining("/documents?page[after]=1&page[size]=10"),
        total: DOCUMENTS_WITH_BLOCK_SOURCE + DOCUMENTS_WITH_EXTERNAL_SOURCE,
      });
      expect((response4.body as { items: string }).items).toHaveLength(
        DOCUMENTS_WITH_BLOCK_SOURCE + DOCUMENTS_WITH_EXTERNAL_SOURCE,
      );
      expect(response4.status).toBe(200);
    });

    it("should throw a Bad Request for bad pagination", async () => {
      expect.assertions(8);

      const response1 = await request(server).get("/documents?page[size]=100");
      expect(response1.body).toStrictEqual({
        detail: '["page[size] must not be greater than 50"]',
        status: 400,
        title: "Bad Request",
        type: "about:blank",
      });
      expect(response1.status).toBe(400);

      const response2 = await request(server).get("/documents?page[size]=0");
      expect(response2.body).toStrictEqual({
        detail: '["page[size] must not be less than 1"]',
        status: 400,
        title: "Bad Request",
        type: "about:blank",
      });
      expect(response2.status).toBe(400);

      const response3 = await request(server).get("/documents?page[after]=0");
      expect(response3.body).toStrictEqual({
        detail: '["page[after] must not be less than 1"]',
        status: 400,
        title: "Bad Request",
        type: "about:blank",
      });
      expect(response3.status).toBe(400);

      const response4 = await request(server).get("/documents?page[after]=abc");
      expect(response4.body).toStrictEqual({
        detail:
          '["page[after] must not be less than 1","page[after] must be a number conforming to the specified constraints"]',
        status: 400,
        title: "Bad Request",
        type: "about:blank",
      });
      expect(response4.status).toBe(400);
    });

    it("should reject a non whitelisted query", async () => {
      expect.assertions(2);

      const response = await request(server).get(
        "/documents?invalid-query=abc",
      );

      expect(response.body).toStrictEqual({
        detail: '["property invalid-query should not exist"]',
        status: 400,
        title: "Bad Request",
        type: "about:blank",
      });
      expect(response.status).toBe(400);
    });
  });

  describe.each(["latest", "deprecated"] as const)(
    "GET /documents/{documentId} (version: %s)",
    (version) => {
      it("should throw an error 400 if the document ID is not valid", async () => {
        expect.assertions(12);

        let response = await request(server).get(
          `/documents/no-document?version=${version}`,
        );

        expect(response.body).toStrictEqual({
          detail: JSON.stringify([
            "documentId must be 32 bytes encoded in hexadecimal and start with 0x",
          ]),
          status: 400,
          title: "Bad Request",
          type: "about:blank",
        });
        expect(response.status).toBe(400);
        expect(
          (response.headers as { "content-type": string })["content-type"],
        ).toStrictEqual(expect.stringContaining("application/problem+json"));

        response = await request(server).get(
          `/documents/0xnothexadecimal?version=${version}`,
        );

        expect(response.body).toStrictEqual({
          detail: JSON.stringify([
            "documentId must be 32 bytes encoded in hexadecimal and start with 0x",
          ]),
          status: 400,
          title: "Bad Request",
          type: "about:blank",
        });
        expect(response.status).toBe(400);
        expect(
          (response.headers as { "content-type": string })["content-type"],
        ).toStrictEqual(expect.stringContaining("application/problem+json"));

        response = await request(server).get(
          `/documents/${randomBytes(32).toString("hex")}?version=${version}`,
        );

        expect(response.body).toStrictEqual({
          detail: JSON.stringify([
            "documentId must be 32 bytes encoded in hexadecimal and start with 0x",
          ]),
          status: 400,
          title: "Bad Request",
          type: "about:blank",
        });
        expect(response.status).toBe(400);
        expect(
          (response.headers as { "content-type": string })["content-type"],
        ).toStrictEqual(expect.stringContaining("application/problem+json"));

        response = await request(server).get(
          `/documents/0x${randomBytes(24).toString("hex")}?version=${version}`,
        );

        expect(response.body).toStrictEqual({
          detail: JSON.stringify([
            "documentId must be 32 bytes encoded in hexadecimal and start with 0x",
          ]),
          status: 400,
          title: "Bad Request",
          type: "about:blank",
        });
        expect(response.status).toBe(400);
        expect(
          (response.headers as { "content-type": string })["content-type"],
        ).toStrictEqual(expect.stringContaining("application/problem+json"));
      });

      it("should throw an error if the document is not found", async () => {
        expect.assertions(3);

        const documentId = `0x${randomBytes(32).toString("hex")}`;
        const response = await request(server).get(
          `/documents/${documentId}?version=${version}`,
        );

        expect(response.body).toStrictEqual({
          detail: `Document ${documentId} not found`,
          status: 404,
          title: "Document Not Found",
          type: "about:blank",
        });
        expect(response.status).toBe(404);
        expect(
          (response.headers as { "content-type": string })["content-type"],
        ).toStrictEqual(expect.stringContaining("application/problem+json"));
      });

      it("should return a specific document with block source identified by its document ID", async () => {
        expect.assertions(3);

        const document = testEnv.documentsWithBlockSource[0]!;

        const response = await request(server).get(
          `/documents/${document.documentHash}?version=${version}`,
        );

        expect(response.body).toStrictEqual({
          creator: document.didEbsiCreator,
          ...(version === "deprecated"
            ? { events: document.events.map((event) => event.eventHash) }
            : {}),
          metadata: document.documentMetadata,
          timestamp: {
            datetime: document.timestamp.datetime,
            proof: document.timestamp.proof,
            source: "block",
          },
        } satisfies Document | Document__deprecated);
        expect(response.status).toBe(200);
        expect(
          (response.headers as { "content-type": string })["content-type"],
        ).toStrictEqual(expect.stringContaining("application/json"));
      });

      it("should return a specific document with external source identified by its document ID", async () => {
        expect.assertions(3);

        const document = testEnv.documentsWithExternalSource[0]!;

        const response = await request(server).get(
          `/documents/${document.documentHash}?version=${version}`,
        );

        expect(response.body).toStrictEqual({
          creator: document.didEbsiCreator,
          ...(version === "deprecated"
            ? { events: document.events.map((event) => event.eventHash) }
            : {}),
          metadata: document.documentMetadata,
          timestamp: {
            datetime: expect.stringMatching(/^0x/),
            proof: document.timestamp?.proof,
            source: "external",
          },
        } satisfies Document);
        expect(response.status).toBe(200);
        expect(
          (response.headers as { "content-type": string })["content-type"],
        ).toStrictEqual(expect.stringContaining("application/json"));
      });
    },
  );

  describe("GET /documents/{documentId}/events", () => {
    it("should throw an error 400 if the document ID is not valid", async () => {
      expect.assertions(12);

      let response = await request(server).get("/documents/no-document/events");

      expect(response.body).toStrictEqual({
        detail: JSON.stringify([
          "documentId must be 32 bytes encoded in hexadecimal and start with 0x",
        ]),
        status: 400,
        title: "Bad Request",
        type: "about:blank",
      });
      expect(response.status).toBe(400);
      expect(
        (response.headers as { "content-type": string })["content-type"],
      ).toStrictEqual(expect.stringContaining("application/problem+json"));

      response = await request(server).get(
        "/documents/0xnothexadecimal/events",
      );

      expect(response.body).toStrictEqual({
        detail: JSON.stringify([
          "documentId must be 32 bytes encoded in hexadecimal and start with 0x",
        ]),
        status: 400,
        title: "Bad Request",
        type: "about:blank",
      });
      expect(response.status).toBe(400);
      expect(
        (response.headers as { "content-type": string })["content-type"],
      ).toStrictEqual(expect.stringContaining("application/problem+json"));

      response = await request(server).get(
        `/documents/${randomBytes(32).toString("hex")}/events`,
      );

      expect(response.body).toStrictEqual({
        detail: JSON.stringify([
          "documentId must be 32 bytes encoded in hexadecimal and start with 0x",
        ]),
        status: 400,
        title: "Bad Request",
        type: "about:blank",
      });
      expect(response.status).toBe(400);
      expect(
        (response.headers as { "content-type": string })["content-type"],
      ).toStrictEqual(expect.stringContaining("application/problem+json"));

      response = await request(server).get(
        `/documents/0x${randomBytes(24).toString("hex")}/events`,
      );

      expect(response.body).toStrictEqual({
        detail: JSON.stringify([
          "documentId must be 32 bytes encoded in hexadecimal and start with 0x",
        ]),
        status: 400,
        title: "Bad Request",
        type: "about:blank",
      });
      expect(response.status).toBe(400);
      expect(
        (response.headers as { "content-type": string })["content-type"],
      ).toStrictEqual(expect.stringContaining("application/problem+json"));
    });

    it("should throw an error if the document is not found", async () => {
      expect.assertions(3);

      const documentId = `0x${randomBytes(32).toString("hex")}`;
      const response = await request(server).get(
        `/documents/${documentId}/events`,
      );

      expect(response.body).toStrictEqual({
        detail: `Document ${documentId} not found`,
        status: 404,
        title: "Document Not Found",
        type: "about:blank",
      });
      expect(response.status).toBe(404);
      expect(
        (response.headers as { "content-type": string })["content-type"],
      ).toStrictEqual(expect.stringContaining("application/problem+json"));
    });

    it("should return a paginated collection of events", async () => {
      expect.assertions(3);

      const document = testEnv.documentsWithBlockSource[0]!;

      const response = await request(server).get(
        `/documents/${document.documentHash}/events`,
      );

      expect(response.body).toStrictEqual({
        items: document.events.map((event) => ({
          eventId: event.eventHash,
          href: expect.stringContaining(
            `/documents/${document.documentHash}/events/${event.eventHash}`,
          ),
        })),
        links: {
          first: expect.stringContaining(
            `/documents/${document.documentHash}/events?page[after]=1&page[size]=10`,
          ),
          last: expect.stringContaining(
            `/documents/${document.documentHash}/events?page[after]=1&page[size]=10`,
          ),
          next: expect.stringContaining(
            `/documents/${document.documentHash}/events?page[after]=1&page[size]=10`,
          ),
          prev: expect.stringContaining(
            `/documents/${document.documentHash}/events?page[after]=1&page[size]=10`,
          ),
        },
        pageSize: 10,
        self: expect.stringContaining(
          `/documents/${document.documentHash}/events?page[after]=1&page[size]=10`,
        ),
        total: DOCUMENT_EVENTS,
      });
      expect((response.body as { items: string }).items).toHaveLength(
        DOCUMENT_EVENTS,
      );
      expect(response.status).toBe(200);
    });

    it("should handle the pagination properly", async () => {
      expect.assertions(12);

      const document = testEnv.documentsWithBlockSource[0]!;

      const response1 = await request(server).get(
        `/documents/${document.documentHash}/events?page[size]=2`,
      );

      expect(response1.body).toStrictEqual({
        items: document.events.slice(0, 2).map((event) => ({
          eventId: event.eventHash,
          href: expect.stringContaining(
            `/documents/${document.documentHash}/events/${event.eventHash}`,
          ),
        })),
        links: {
          first: expect.stringContaining(
            `/documents/${document.documentHash}/events?page[after]=1&page[size]=2`,
          ),
          last: expect.stringContaining(
            `/documents/${document.documentHash}/events?page[after]=2&page[size]=2`,
          ),
          next: expect.stringContaining(
            `/documents/${document.documentHash}/events?page[after]=2&page[size]=2`,
          ),
          prev: expect.stringContaining(
            `/documents/${document.documentHash}/events?page[after]=1&page[size]=2`,
          ),
        },
        pageSize: 2,
        self: expect.stringContaining(
          `/documents/${document.documentHash}/events?page[after]=1&page[size]=2`,
        ),
        total: DOCUMENT_EVENTS,
      });
      expect((response1.body as { items: string }).items).toHaveLength(
        Math.min(DOCUMENT_EVENTS, 2),
      );
      expect(response1.status).toBe(200);

      // next page
      const response2 = await request(server).get(
        `/documents/${document.documentHash}/events?page[after]=2&page[size]=2`,
      );
      expect(response2.body).toStrictEqual({
        items: document.events.slice(2, 4).map((event) => ({
          eventId: event.eventHash,
          href: expect.stringContaining(
            `/documents/${document.documentHash}/events/${event.eventHash}`,
          ),
        })),
        links: {
          first: expect.stringContaining(
            `/documents/${document.documentHash}/events?page[after]=1&page[size]=2`,
          ),
          last: expect.stringContaining(
            `/documents/${document.documentHash}/events?page[after]=2&page[size]=2`,
          ),
          next: expect.stringContaining(
            `/documents/${document.documentHash}/events?page[after]=2&page[size]=2`,
          ),
          prev: expect.stringContaining(
            `/documents/${document.documentHash}/events?page[after]=1&page[size]=2`,
          ),
        },
        pageSize: 2,
        self: expect.stringContaining(
          `/documents/${document.documentHash}/events?page[after]=2&page[size]=2`,
        ),
        total: DOCUMENT_EVENTS,
      });
      expect((response2.body as { items: string }).items).toHaveLength(
        document.events.slice(2, 4).length,
      );
      expect(response2.status).toBe(200);

      // big page
      const response3 = await request(server).get(
        `/documents/${document.documentHash}/events?page[after]=100&page[size]=2`,
      );
      expect(response3.body).toStrictEqual({
        items: [],
        links: {
          first: expect.stringContaining(
            `/documents/${document.documentHash}/events?page[after]=1&page[size]=2`,
          ),
          last: expect.stringContaining(
            `/documents/${document.documentHash}/events?page[after]=2&page[size]=2`,
          ),
          next: expect.stringContaining(
            `/documents/${document.documentHash}/events?page[after]=2&page[size]=2`,
          ),
          prev: expect.stringContaining(
            `/documents/${document.documentHash}/events?page[after]=2&page[size]=2`,
          ),
        },
        pageSize: 2,
        self: expect.stringContaining(
          `/documents/${document.documentHash}/events?page[after]=100&page[size]=2`,
        ),
        total: DOCUMENT_EVENTS,
      });
      expect((response3.body as { items: string }).items).toHaveLength(0);
      expect(response3.status).toBe(200);

      // page["after"] defined but page["size"] undefined
      const response4 = await request(server).get(
        `/documents/${document.documentHash}/events?page[after]=1`,
      );
      expect(response4.body).toStrictEqual({
        items: document.events.map((event) => ({
          eventId: event.eventHash,
          href: expect.stringContaining(
            `/documents/${document.documentHash}/events/${event.eventHash}`,
          ),
        })),
        links: {
          first: expect.stringContaining(
            `/documents/${document.documentHash}/events?page[after]=1&page[size]=10`,
          ),
          last: expect.stringContaining(
            `/documents/${document.documentHash}/events?page[after]=1&page[size]=10`,
          ),
          next: expect.stringContaining(
            `/documents/${document.documentHash}/events?page[after]=1&page[size]=10`,
          ),
          prev: expect.stringContaining(
            `/documents/${document.documentHash}/events?page[after]=1&page[size]=10`,
          ),
        },
        pageSize: 10,
        self: expect.stringContaining(
          `/documents/${document.documentHash}/events?page[after]=1&page[size]=10`,
        ),
        total: DOCUMENT_EVENTS,
      });
      expect((response4.body as { items: string }).items).toHaveLength(
        DOCUMENT_EVENTS,
      );
      expect(response4.status).toBe(200);
    });

    it("should throw a Bad Request for bad pagination", async () => {
      expect.assertions(8);

      const document = testEnv.documentsWithBlockSource[0]!;

      const response1 = await request(server).get(
        `/documents/${document.documentHash}/events?page[size]=100`,
      );
      expect(response1.body).toStrictEqual({
        detail: '["page[size] must not be greater than 50"]',
        status: 400,
        title: "Bad Request",
        type: "about:blank",
      });
      expect(response1.status).toBe(400);

      const response2 = await request(server).get(
        `/documents/${document.documentHash}/events?page[size]=0`,
      );
      expect(response2.body).toStrictEqual({
        detail: '["page[size] must not be less than 1"]',
        status: 400,
        title: "Bad Request",
        type: "about:blank",
      });
      expect(response2.status).toBe(400);

      const response3 = await request(server).get(
        `/documents/${document.documentHash}/events?page[after]=0`,
      );
      expect(response3.body).toStrictEqual({
        detail: '["page[after] must not be less than 1"]',
        status: 400,
        title: "Bad Request",
        type: "about:blank",
      });
      expect(response3.status).toBe(400);

      const response4 = await request(server).get(
        `/documents/${document.documentHash}/events?page[after]=abc`,
      );
      expect(response4.body).toStrictEqual({
        detail:
          '["page[after] must not be less than 1","page[after] must be a number conforming to the specified constraints"]',
        status: 400,
        title: "Bad Request",
        type: "about:blank",
      });
      expect(response4.status).toBe(400);
    });
  });

  describe("GET /documents/{documentId}/events/{eventId}", () => {
    it("should throw an error 400 if the document ID or event ID are not valid", async () => {
      expect.assertions(12);

      let response = await request(server).get(
        "/documents/no-document/events/no-event",
      );

      expect(response.body).toStrictEqual({
        detail: JSON.stringify([
          "documentId must be 32 bytes encoded in hexadecimal and start with 0x",
          "eventId must be 32 bytes encoded in hexadecimal and start with 0x",
        ]),
        status: 400,
        title: "Bad Request",
        type: "about:blank",
      });
      expect(response.status).toBe(400);
      expect(
        (response.headers as { "content-type": string })["content-type"],
      ).toStrictEqual(expect.stringContaining("application/problem+json"));

      response = await request(server).get(
        "/documents/0xnothexadecimal/events/0xnothexadecimal",
      );

      expect(response.body).toStrictEqual({
        detail: JSON.stringify([
          "documentId must be 32 bytes encoded in hexadecimal and start with 0x",
          "eventId must be 32 bytes encoded in hexadecimal and start with 0x",
        ]),
        status: 400,
        title: "Bad Request",
        type: "about:blank",
      });
      expect(response.status).toBe(400);
      expect(
        (response.headers as { "content-type": string })["content-type"],
      ).toStrictEqual(expect.stringContaining("application/problem+json"));

      response = await request(server).get(
        `/documents/${randomBytes(32).toString("hex")}/events/${randomBytes(32).toString("hex")}`,
      );

      expect(response.body).toStrictEqual({
        detail: JSON.stringify([
          "documentId must be 32 bytes encoded in hexadecimal and start with 0x",
          "eventId must be 32 bytes encoded in hexadecimal and start with 0x",
        ]),
        status: 400,
        title: "Bad Request",
        type: "about:blank",
      });
      expect(response.status).toBe(400);
      expect(
        (response.headers as { "content-type": string })["content-type"],
      ).toStrictEqual(expect.stringContaining("application/problem+json"));

      response = await request(server).get(
        `/documents/0x${randomBytes(24).toString("hex")}/events/0x${randomBytes(24).toString("hex")}`,
      );

      expect(response.body).toStrictEqual({
        detail: JSON.stringify([
          "documentId must be 32 bytes encoded in hexadecimal and start with 0x",
          "eventId must be 32 bytes encoded in hexadecimal and start with 0x",
        ]),
        status: 400,
        title: "Bad Request",
        type: "about:blank",
      });
      expect(response.status).toBe(400);
      expect(
        (response.headers as { "content-type": string })["content-type"],
      ).toStrictEqual(expect.stringContaining("application/problem+json"));
    });

    it("should throw an error if the document is not found", async () => {
      expect.assertions(3);

      const document = testEnv.documentsWithBlockSource[0]!;
      const wrongDocumentId = `0x${randomBytes(32).toString("hex")}`;
      const event = document.events[0]!;
      const response = await request(server).get(
        `/documents/${wrongDocumentId}/events/${event.eventHash}`,
      );

      expect(response.body).toStrictEqual({
        detail: `Document ${wrongDocumentId} not found`,
        status: 404,
        title: "Document Not Found",
        type: "about:blank",
      });
      expect(response.status).toBe(404);
      expect(
        (response.headers as { "content-type": string })["content-type"],
      ).toStrictEqual(expect.stringContaining("application/problem+json"));
    });

    it("should throw an error if the event is not found", async () => {
      expect.assertions(3);

      const document = testEnv.documentsWithBlockSource[0]!;
      const wrongEventId = `0x${randomBytes(32).toString("hex")}`;
      const response = await request(server).get(
        `/documents/${document.documentHash}/events/${wrongEventId}`,
      );

      expect(response.body).toStrictEqual({
        detail: `Event ${wrongEventId} not found`,
        status: 404,
        title: "Event Not Found",
        type: "about:blank",
      });
      expect(response.status).toBe(404);
      expect(
        (response.headers as { "content-type": string })["content-type"],
      ).toStrictEqual(expect.stringContaining("application/problem+json"));
    });

    it("should return a specific event identified by its document ID and event ID", async () => {
      expect.assertions(3);

      const document = testEnv.documentsWithBlockSource[0]!;
      const event = document.events[0]!;

      const response = await request(server).get(
        `/documents/${document.documentHash}/events/${event.eventHash}`,
      );

      expect(response.body).toStrictEqual({
        externalHash: event.externalHash,
        hash: expect.stringMatching(/^0x/),
        metadata: event.metadata,
        origin: event.origin,
        sender: event.sender,
        timestamp: {
          datetime: event.timestamp.datetime,
          proof: event.timestamp.proof,
          source: "block",
        },
      } satisfies Event);
      expect(response.status).toBe(200);
      expect(
        (response.headers as { "content-type": string })["content-type"],
      ).toStrictEqual(expect.stringContaining("application/json"));
    });
  });

  describe("GET /documents/{documentId}/accesses", () => {
    it("should throw an error 400 if the document ID is not valid", async () => {
      expect.assertions(12);

      let response = await request(server).get(
        "/documents/no-document/accesses",
      );

      expect(response.body).toStrictEqual({
        detail: JSON.stringify([
          "documentId must be 32 bytes encoded in hexadecimal and start with 0x",
        ]),
        status: 400,
        title: "Bad Request",
        type: "about:blank",
      });
      expect(response.status).toBe(400);
      expect(
        (response.headers as { "content-type": string })["content-type"],
      ).toStrictEqual(expect.stringContaining("application/problem+json"));

      response = await request(server).get(
        "/documents/0xnothexadecimal/accesses",
      );

      expect(response.body).toStrictEqual({
        detail: JSON.stringify([
          "documentId must be 32 bytes encoded in hexadecimal and start with 0x",
        ]),
        status: 400,
        title: "Bad Request",
        type: "about:blank",
      });
      expect(response.status).toBe(400);
      expect(
        (response.headers as { "content-type": string })["content-type"],
      ).toStrictEqual(expect.stringContaining("application/problem+json"));

      response = await request(server).get(
        `/documents/${randomBytes(32).toString("hex")}/accesses`,
      );

      expect(response.body).toStrictEqual({
        detail: JSON.stringify([
          "documentId must be 32 bytes encoded in hexadecimal and start with 0x",
        ]),
        status: 400,
        title: "Bad Request",
        type: "about:blank",
      });
      expect(response.status).toBe(400);
      expect(
        (response.headers as { "content-type": string })["content-type"],
      ).toStrictEqual(expect.stringContaining("application/problem+json"));

      response = await request(server).get(
        `/documents/0x${randomBytes(24).toString("hex")}/accesses`,
      );

      expect(response.body).toStrictEqual({
        detail: JSON.stringify([
          "documentId must be 32 bytes encoded in hexadecimal and start with 0x",
        ]),
        status: 400,
        title: "Bad Request",
        type: "about:blank",
      });
      expect(response.status).toBe(400);
      expect(
        (response.headers as { "content-type": string })["content-type"],
      ).toStrictEqual(expect.stringContaining("application/problem+json"));
    });

    it("should throw an error if the document is not found", async () => {
      expect.assertions(3);

      const documentId = `0x${randomBytes(32).toString("hex")}`;
      const response = await request(server).get(
        `/documents/${documentId}/accesses`,
      );

      expect(response.body).toStrictEqual({
        detail: `Document ${documentId} not found`,
        status: 404,
        title: "Document Not Found",
        type: "about:blank",
      });
      expect(response.status).toBe(404);
      expect(
        (response.headers as { "content-type": string })["content-type"],
      ).toStrictEqual(expect.stringContaining("application/problem+json"));
    });

    it("should return a paginated collection of accesses", async () => {
      expect.assertions(3);

      const { grantedDidEbsiAccount, grantedDidKeyAccount } = testEnv;
      const document = testEnv.documentsWithBlockSource[0]!;

      const response = await request(server).get(
        `/documents/${document.documentHash}/accesses`,
      );

      expect(response.body).toStrictEqual({
        items: [
          {
            documentId: document.documentHash,
            grantedBy: document.didEbsiCreator,
            permission: "creator",
            subject: document.didEbsiCreator,
          },
          {
            documentId: document.documentHash,
            grantedBy: document.didEbsiCreator,
            permission: "delegate",
            subject: grantedDidEbsiAccount,
          },
          {
            documentId: document.documentHash,
            grantedBy: document.didEbsiCreator,
            permission: "write",
            subject: grantedDidEbsiAccount,
          },
          {
            documentId: document.documentHash,
            grantedBy: document.didEbsiCreator,
            permission: "delegate",
            subject: grantedDidKeyAccount,
          },
          {
            documentId: document.documentHash,
            grantedBy: document.didEbsiCreator,
            permission: "write",
            subject: grantedDidKeyAccount,
          },
        ] satisfies DocumentAccesses,
        links: {
          first: expect.stringContaining(
            `/documents/${document.documentHash}/accesses?page[after]=1&page[size]=10`,
          ),
          last: expect.stringContaining(
            `/documents/${document.documentHash}/accesses?page[after]=1&page[size]=10`,
          ),
          next: expect.stringContaining(
            `/documents/${document.documentHash}/accesses?page[after]=1&page[size]=10`,
          ),
          prev: expect.stringContaining(
            `/documents/${document.documentHash}/accesses?page[after]=1&page[size]=10`,
          ),
        },
        pageSize: 10,
        self: expect.stringContaining(
          `/documents/${document.documentHash}/accesses?page[after]=1&page[size]=10`,
        ),
        total: 5,
      });
      expect((response.body as { items: string }).items).toHaveLength(5);
      expect(response.status).toBe(200);
    });

    it("should handle the pagination properly", async () => {
      expect.assertions(12);

      const { grantedDidEbsiAccount, grantedDidKeyAccount } = testEnv;
      const document = testEnv.documentsWithBlockSource[0]!;

      const response1 = await request(server).get(
        `/documents/${document.documentHash}/accesses?page[size]=2`,
      );

      expect(response1.body).toStrictEqual({
        items: [
          {
            documentId: document.documentHash,
            grantedBy: document.didEbsiCreator,
            permission: "creator",
            subject: document.didEbsiCreator,
          },
          {
            documentId: document.documentHash,
            grantedBy: document.didEbsiCreator,
            permission: "delegate",
            subject: grantedDidEbsiAccount,
          },
        ] satisfies DocumentAccesses,
        links: {
          first: expect.stringContaining(
            `/documents/${document.documentHash}/accesses?page[after]=1&page[size]=2`,
          ),
          last: expect.stringContaining(
            `/documents/${document.documentHash}/accesses?page[after]=3&page[size]=2`,
          ),
          next: expect.stringContaining(
            `/documents/${document.documentHash}/accesses?page[after]=2&page[size]=2`,
          ),
          prev: expect.stringContaining(
            `/documents/${document.documentHash}/accesses?page[after]=1&page[size]=2`,
          ),
        },
        pageSize: 2,
        self: expect.stringContaining(
          `/documents/${document.documentHash}/accesses?page[after]=1&page[size]=2`,
        ),
        total: 5,
      });
      expect((response1.body as { items: string }).items).toHaveLength(2);
      expect(response1.status).toBe(200);

      // next page
      const response2 = await request(server).get(
        `/documents/${document.documentHash}/accesses?page[after]=2&page[size]=2`,
      );
      expect(response2.body).toStrictEqual({
        items: [
          {
            documentId: document.documentHash,
            grantedBy: document.didEbsiCreator,
            permission: "write",
            subject: grantedDidEbsiAccount,
          },
          {
            documentId: document.documentHash,
            grantedBy: document.didEbsiCreator,
            permission: "delegate",
            subject: grantedDidKeyAccount,
          },
        ] satisfies DocumentAccesses,
        links: {
          first: expect.stringContaining(
            `/documents/${document.documentHash}/accesses?page[after]=1&page[size]=2`,
          ),
          last: expect.stringContaining(
            `/documents/${document.documentHash}/accesses?page[after]=3&page[size]=2`,
          ),
          next: expect.stringContaining(
            `/documents/${document.documentHash}/accesses?page[after]=3&page[size]=2`,
          ),
          prev: expect.stringContaining(
            `/documents/${document.documentHash}/accesses?page[after]=1&page[size]=2`,
          ),
        },
        pageSize: 2,
        self: expect.stringContaining(
          `/documents/${document.documentHash}/accesses?page[after]=2&page[size]=2`,
        ),
        total: 5,
      });
      expect((response2.body as { items: string }).items).toHaveLength(2);
      expect(response2.status).toBe(200);

      // big page
      const response3 = await request(server).get(
        `/documents/${document.documentHash}/accesses?page[after]=100&page[size]=2`,
      );
      expect(response3.body).toStrictEqual({
        items: [],
        links: {
          first: expect.stringContaining(
            `/documents/${document.documentHash}/accesses?page[after]=1&page[size]=2`,
          ),
          last: expect.stringContaining(
            `/documents/${document.documentHash}/accesses?page[after]=3&page[size]=2`,
          ),
          next: expect.stringContaining(
            `/documents/${document.documentHash}/accesses?page[after]=3&page[size]=2`,
          ),
          prev: expect.stringContaining(
            `/documents/${document.documentHash}/accesses?page[after]=3&page[size]=2`,
          ),
        },
        pageSize: 2,
        self: expect.stringContaining(
          `/documents/${document.documentHash}/accesses?page[after]=100&page[size]=2`,
        ),
        total: 5,
      });
      expect((response3.body as { items: string }).items).toHaveLength(0);
      expect(response3.status).toBe(200);

      // page["after"] defined but page["size"] undefined
      const response4 = await request(server).get(
        `/documents/${document.documentHash}/accesses?page[after]=1`,
      );
      expect(response4.body).toStrictEqual({
        items: [
          {
            documentId: document.documentHash,
            grantedBy: document.didEbsiCreator,
            permission: "creator",
            subject: document.didEbsiCreator,
          },
          {
            documentId: document.documentHash,
            grantedBy: document.didEbsiCreator,
            permission: "delegate",
            subject: grantedDidEbsiAccount,
          },
          {
            documentId: document.documentHash,
            grantedBy: document.didEbsiCreator,
            permission: "write",
            subject: grantedDidEbsiAccount,
          },
          {
            documentId: document.documentHash,
            grantedBy: document.didEbsiCreator,
            permission: "delegate",
            subject: grantedDidKeyAccount,
          },
          {
            documentId: document.documentHash,
            grantedBy: document.didEbsiCreator,
            permission: "write",
            subject: grantedDidKeyAccount,
          },
        ] satisfies DocumentAccesses,
        links: {
          first: expect.stringContaining(
            `/documents/${document.documentHash}/accesses?page[after]=1&page[size]=10`,
          ),
          last: expect.stringContaining(
            `/documents/${document.documentHash}/accesses?page[after]=1&page[size]=10`,
          ),
          next: expect.stringContaining(
            `/documents/${document.documentHash}/accesses?page[after]=1&page[size]=10`,
          ),
          prev: expect.stringContaining(
            `/documents/${document.documentHash}/accesses?page[after]=1&page[size]=10`,
          ),
        },
        pageSize: 10,
        self: expect.stringContaining(
          `/documents/${document.documentHash}/accesses?page[after]=1&page[size]=10`,
        ),
        total: 5,
      });
      expect((response4.body as { items: string }).items).toHaveLength(5);
      expect(response4.status).toBe(200);
    });

    it("should throw a Bad Request for bad pagination", async () => {
      expect.assertions(8);

      const document = testEnv.documentsWithBlockSource[0]!;

      const response1 = await request(server).get(
        `/documents/${document.documentHash}/accesses?page[size]=100`,
      );
      expect(response1.body).toStrictEqual({
        detail: '["page[size] must not be greater than 50"]',
        status: 400,
        title: "Bad Request",
        type: "about:blank",
      });
      expect(response1.status).toBe(400);

      const response2 = await request(server).get(
        `/documents/${document.documentHash}/accesses?page[size]=0`,
      );
      expect(response2.body).toStrictEqual({
        detail: '["page[size] must not be less than 1"]',
        status: 400,
        title: "Bad Request",
        type: "about:blank",
      });
      expect(response2.status).toBe(400);

      const response3 = await request(server).get(
        `/documents/${document.documentHash}/accesses?page[after]=0`,
      );
      expect(response3.body).toStrictEqual({
        detail: '["page[after] must not be less than 1"]',
        status: 400,
        title: "Bad Request",
        type: "about:blank",
      });
      expect(response3.status).toBe(400);

      const response4 = await request(server).get(
        `/documents/${document.documentHash}/accesses?page[after]=abc`,
      );
      expect(response4.body).toStrictEqual({
        detail:
          '["page[after] must not be less than 1","page[after] must be a number conforming to the specified constraints"]',
        status: 400,
        title: "Bad Request",
        type: "about:blank",
      });
      expect(response4.status).toBe(400);
    });
  });
});
