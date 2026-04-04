import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import type { RawServerDefault } from "fastify";

import { ConfigService } from "@nestjs/config";
import { useContainer } from "class-validator";
import { randomBytes } from "node:crypto";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { ApiConfig } from "../../src/config/configuration.ts";

import { AppModule } from "../../src/app.module.ts";
import { getNestFastifyApplication } from "../utils/app.ts";
import { getServer } from "../utils/getServer.ts";

describe("Track and Trace API v1 - Documents (e2e)", () => {
  let app: NestFastifyApplication;
  let server: RawServerDefault | string;
  let configService: ConfigService<ApiConfig, true>;
  let lastDocumentEvents: {
    eventId: string;
    href: string;
  }[] = [];
  let documentWithEvents: string;

  beforeAll(async () => {
    app = await getNestFastifyApplication({
      imports: [AppModule],
    });

    useContainer(app.select(AppModule), { fallbackOnErrors: true });

    configService = app.get<ConfigService<ApiConfig, true>>(ConfigService);

    if (process.env.TEST_ENV !== "remote") {
      await app.init();
      const fastifyInstance = app.getHttpAdapter().getInstance();
      await fastifyInstance.ready();
    }

    server = getServer(app, configService);

    documentWithEvents = configService.get("testDocWithEvents", {
      infer: true,
    });

    // Get last events
    const getAllEvents = await request(server).get(
      `/documents/${documentWithEvents}/events?page[size]=50`,
    );
    const { total: totalEvents } = getAllEvents.body as {
      total: number;
    };

    if (totalEvents > 50) {
      const getEventsLastPage = await request(server).get(
        `/documents/${documentWithEvents}/events?page[after]=${Math.ceil(totalEvents / 10)}&page[size]=10`,
      );
      const { items: events } = getEventsLastPage.body as {
        items: {
          eventId: string;
          href: string;
        }[];
      };
      lastDocumentEvents = events;
    } else if (totalEvents > 0) {
      const { items: events } = getAllEvents.body as {
        items: {
          eventId: string;
          href: string;
        }[];
      };
      lastDocumentEvents = events;
    }
  });

  afterAll(async () => {
    await app.close();
  });

  describe("GET /documents", () => {
    it("should return a paginated collection of documents", async () => {
      expect.assertions(2);

      const response = await request(server).get("/documents");

      const total =
        ((response.body as Record<string, unknown>)?.["total"] as number) ?? 0;

      expect(response.body).toStrictEqual({
        items:
          total > 0
            ? expect.arrayContaining([
                {
                  documentId: expect.stringContaining("0x"),
                  href: expect.stringContaining("/documents/"),
                },
              ])
            : [],
        links: {
          first: expect.stringContaining(
            "/documents?page[after]=1&page[size]=10",
          ),
          last: expect.stringContaining(
            `/documents?page[after]=${Math.max(Math.ceil(total / 10), 1)}&page[size]=10`,
          ),
          next: expect.stringContaining(
            `/documents?page[after]=${total > 10 ? 2 : 1}&page[size]=10`,
          ),
          prev: expect.stringContaining(
            "/documents?page[after]=1&page[size]=10",
          ),
        },
        pageSize: 10,
        self: expect.stringContaining("/documents?page[after]=1&page[size]=10"),
        total: expect.any(Number),
      });
      expect(response.status).toBe(200);
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
  });

  describe.each(["latest", "deprecated"] as const)(
    "GET /documents/{documentId} (version: %s)",
    (version) => {
      it("should return a specific document", async () => {
        expect.assertions(3);

        const response = await request(server).get(
          `/documents/${documentWithEvents}?version=${version}`,
        );

        expect(response.body).toStrictEqual(
          expect.objectContaining({
            creator: expect.any(String),
            ...(version === "deprecated"
              ? {
                  events: expect.arrayContaining([
                    expect.stringMatching(/^0x/),
                  ]),
                }
              : {}),
            metadata: expect.any(String),
            timestamp: {
              datetime: expect.any(String),
              proof: expect.any(String),
              source: expect.stringMatching(/^(block|external)$/),
            },
          }),
        );
        expect(response.status).toBe(200);
        expect(
          (response.headers as { "content-type": string })["content-type"],
        ).toStrictEqual(expect.stringContaining("application/json"));
      });

      it("should throw an error 400 if the document ID is not valid", async () => {
        expect.assertions(12);

        let response = await request(server).get(
          `/documents/no-document?version=${version}`,
        );

        expect(response.body).toStrictEqual({
          detail:
            '["documentId must be 32 bytes encoded in hexadecimal and start with 0x"]',
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
          detail:
            '["documentId must be 32 bytes encoded in hexadecimal and start with 0x"]',
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
          detail:
            '["documentId must be 32 bytes encoded in hexadecimal and start with 0x"]',
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
          detail:
            '["documentId must be 32 bytes encoded in hexadecimal and start with 0x"]',
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
    },
  );

  describe("GET /documents/{documentId}/events", () => {
    it("should throw an error 400 if the document ID is not valid", async () => {
      expect.assertions(12);

      let response = await request(server).get("/documents/no-document/events");

      expect(response.body).toStrictEqual({
        detail:
          '["documentId must be 32 bytes encoded in hexadecimal and start with 0x"]',
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
        detail:
          '["documentId must be 32 bytes encoded in hexadecimal and start with 0x"]',
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
        detail:
          '["documentId must be 32 bytes encoded in hexadecimal and start with 0x"]',
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
        detail:
          '["documentId must be 32 bytes encoded in hexadecimal and start with 0x"]',
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
      expect.assertions(2);

      const response = await request(server).get(
        `/documents/${documentWithEvents}/events`,
      );

      const total =
        ((response.body as Record<string, unknown>)?.["total"] as number) ?? 0;

      expect(response.body).toStrictEqual({
        items:
          total > 0
            ? expect.arrayContaining([
                {
                  eventId: expect.stringContaining("0x"),
                  href: expect.stringContaining(
                    `/documents/${documentWithEvents}/events/`,
                  ),
                },
              ])
            : [],
        links: {
          first: expect.stringContaining(
            `/documents/${documentWithEvents}/events?page[after]=1&page[size]=10`,
          ),
          last: expect.stringContaining(
            `/documents/${documentWithEvents}/events?page[after]=${Math.max(Math.ceil(total / 10), 1)}&page[size]=10`,
          ),
          next: expect.stringContaining(
            `/documents/${documentWithEvents}/events?page[after]=${total > 10 ? 2 : 1}&page[size]=10`,
          ),
          prev: expect.stringContaining(
            `/documents/${documentWithEvents}/events?page[after]=1&page[size]=10`,
          ),
        },
        pageSize: 10,
        self: expect.stringContaining(
          `/documents/${documentWithEvents}/events?page[after]=1&page[size]=10`,
        ),
        total: expect.any(Number),
      });
      expect(response.status).toBe(200);
    });

    it("should throw a Bad Request for bad pagination", async () => {
      expect.assertions(8);

      const documentId = `0x${randomBytes(32).toString("hex")}`;

      const response1 = await request(server).get(
        `/documents/${documentId}/events?page[size]=100`,
      );
      expect(response1.body).toStrictEqual({
        detail: '["page[size] must not be greater than 50"]',
        status: 400,
        title: "Bad Request",
        type: "about:blank",
      });
      expect(response1.status).toBe(400);

      const response2 = await request(server).get(
        `/documents/${documentId}/events?page[size]=0`,
      );
      expect(response2.body).toStrictEqual({
        detail: '["page[size] must not be less than 1"]',
        status: 400,
        title: "Bad Request",
        type: "about:blank",
      });
      expect(response2.status).toBe(400);

      const response3 = await request(server).get(
        `/documents/${documentId}/events?page[after]=0`,
      );
      expect(response3.body).toStrictEqual({
        detail: '["page[after] must not be less than 1"]',
        status: 400,
        title: "Bad Request",
        type: "about:blank",
      });
      expect(response3.status).toBe(400);

      const response4 = await request(server).get(
        `/documents/${documentId}/events?page[after]=abc`,
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
    it("should return a specific event", async () => {
      expect.assertions(3);

      const response = await request(server).get(
        `/documents/${documentWithEvents}/events/${lastDocumentEvents[0]!.eventId}`,
      );

      expect(response.body).toStrictEqual({
        externalHash: expect.any(String),
        hash: expect.stringMatching(/^0x/),
        metadata: expect.any(String),
        origin: expect.any(String),
        sender: expect.stringMatching(/^did:/),
        timestamp: {
          datetime: expect.any(String),
          proof: expect.any(String),
          source: expect.stringMatching(/^(block|external)$/),
        },
      });
      expect(response.status).toBe(200);
      expect(
        (response.headers as { "content-type": string })["content-type"],
      ).toStrictEqual(expect.stringContaining("application/json"));
    });

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

      const wrongDocumentId = `0x${randomBytes(32).toString("hex")}`;
      const wrongEventId = `0x${randomBytes(32).toString("hex")}`;
      const response = await request(server).get(
        `/documents/${wrongDocumentId}/events/${wrongEventId}`,
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

      const wrongEventId = `0x${randomBytes(32).toString("hex")}`;
      const response = await request(server).get(
        `/documents/${documentWithEvents}/events/${wrongEventId}`,
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
  });

  describe("GET /documents/{documentId}/accesses", () => {
    it("should throw an error 400 if the document ID is not valid", async () => {
      expect.assertions(12);

      let response = await request(server).get(
        "/documents/no-document/accesses",
      );

      expect(response.body).toStrictEqual({
        detail:
          '["documentId must be 32 bytes encoded in hexadecimal and start with 0x"]',
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
        detail:
          '["documentId must be 32 bytes encoded in hexadecimal and start with 0x"]',
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
        detail:
          '["documentId must be 32 bytes encoded in hexadecimal and start with 0x"]',
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
        detail:
          '["documentId must be 32 bytes encoded in hexadecimal and start with 0x"]',
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
      expect.assertions(2);

      const response = await request(server).get(
        `/documents/${documentWithEvents}/accesses`,
      );

      const total =
        ((response.body as Record<string, unknown>)?.["total"] as number) ?? 0;

      expect(response.body).toStrictEqual({
        items:
          total > 0
            ? expect.arrayContaining([
                {
                  documentId: documentWithEvents,
                  grantedBy: expect.stringMatching(/^did:/),
                  permission: expect.stringMatching(
                    /^(write|delegate|creator)$/,
                  ),
                  subject: expect.stringMatching(/^did:/),
                },
              ])
            : [],
        links: {
          first: expect.stringContaining(
            `/documents/${documentWithEvents}/accesses?page[after]=1&page[size]=10`,
          ),
          last: expect.stringContaining(
            `/documents/${documentWithEvents}/accesses?page[after]=${Math.max(Math.ceil(total / 10), 1)}&page[size]=10`,
          ),
          next: expect.stringContaining(
            `/documents/${documentWithEvents}/accesses?page[after]=${total > 10 ? 2 : 1}&page[size]=10`,
          ),
          prev: expect.stringContaining(
            `/documents/${documentWithEvents}/accesses?page[after]=1&page[size]=10`,
          ),
        },
        pageSize: 10,
        self: expect.stringContaining(
          `/documents/${documentWithEvents}/accesses?page[after]=1&page[size]=10`,
        ),
        total: expect.any(Number),
      });
      expect(response.status).toBe(200);
    });

    it("should throw a Bad Request for bad pagination", async () => {
      expect.assertions(8);

      const documentId = `0x${randomBytes(32).toString("hex")}`;

      const response1 = await request(server).get(
        `/documents/${documentId}/accesses?page[size]=100`,
      );
      expect(response1.body).toStrictEqual({
        detail: '["page[size] must not be greater than 50"]',
        status: 400,
        title: "Bad Request",
        type: "about:blank",
      });
      expect(response1.status).toBe(400);

      const response2 = await request(server).get(
        `/documents/${documentId}/accesses?page[size]=0`,
      );
      expect(response2.body).toStrictEqual({
        detail: '["page[size] must not be less than 1"]',
        status: 400,
        title: "Bad Request",
        type: "about:blank",
      });
      expect(response2.status).toBe(400);

      const response3 = await request(server).get(
        `/documents/${documentId}/accesses?page[after]=0`,
      );
      expect(response3.body).toStrictEqual({
        detail: '["page[after] must not be less than 1"]',
        status: 400,
        title: "Bad Request",
        type: "about:blank",
      });
      expect(response3.status).toBe(400);

      const response4 = await request(server).get(
        `/documents/${documentId}/accesses?page[after]=abc`,
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
