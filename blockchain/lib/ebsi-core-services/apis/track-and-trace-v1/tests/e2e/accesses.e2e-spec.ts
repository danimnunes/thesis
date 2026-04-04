import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import type { RawServerDefault } from "fastify";

import { EbsiWallet } from "@europeum-ebsi/wallet-lib";
import { ConfigService } from "@nestjs/config";
import { useContainer } from "class-validator";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { ApiConfig } from "../../src/config/configuration.ts";

import { AppModule } from "../../src/app.module.ts";
import { getNestFastifyApplication } from "../utils/app.ts";
import { getServer } from "../utils/getServer.ts";

describe("Track and Trace API v1 - Accesses (e2e)", () => {
  let app: NestFastifyApplication;
  let server: RawServerDefault | string;
  let configService: ConfigService<ApiConfig, true>;
  let testAuthorisedLegalEntityDid: string;

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

    const testAuthorisedLegalEntityKid = configService.get(
      "testAuthorisedLegalEntityKid",
      {
        infer: true,
      },
    );

    if (!testAuthorisedLegalEntityKid) {
      throw new Error("TEST_AUTHORISED_LEGAL_ENTITY_KID must be defined");
    }

    testAuthorisedLegalEntityDid = testAuthorisedLegalEntityKid.split("#")[0]!;
  });

  afterAll(async () => {
    await app.close();
  });

  describe("HEAD /accesses", () => {
    it("should throw an error 400 if the creator parameter is not missing or invalid", async () => {
      expect.assertions(4);

      // Missing `creator` param
      let response = await request(server).head("/accesses");

      expect(response.body).toStrictEqual({});
      expect(response.status).toBe(400);

      // Invalid `creator` param (not a did:ebsi DID)
      response = await request(server).head("/accesses?creator=1234");

      expect(response.body).toStrictEqual({});
      expect(response.status).toBe(400);
    });

    it("should throw an error 404 if the DID is not a creator", async () => {
      expect.assertions(2);

      const did = EbsiWallet.createDid();
      const response = await request(server).head(`/accesses?creator=${did}`);

      expect(response.body).toStrictEqual({});
      expect(response.status).toBe(404);
    });

    it("should return 204 when the DID is a creator", async () => {
      expect.assertions(2);

      const response = await request(server).head(
        `/accesses?creator=${testAuthorisedLegalEntityDid}`,
      );

      expect(response.body).toStrictEqual({});
      expect(response.status).toBe(204);
    });
  });

  describe("GET /accesses", () => {
    it("should throw an error 400 if the subject is invalid", async () => {
      expect.assertions(4);

      // Missing `subject` param
      let response = await request(server).get("/accesses");

      expect(response.body).toStrictEqual({
        detail: `["subject must be a valid DID string"]`,
        status: 400,
        title: "Bad Request",
        type: "about:blank",
      });
      expect(response.status).toBe(400);

      // Invalid `subject` param (not a did:ebsi DID)
      response = await request(server).get("/accesses?subject=1234");

      expect(response.body).toStrictEqual({
        detail: `["subject must be a valid DID string"]`,
        status: 400,
        title: "Bad Request",
        type: "about:blank",
      });
      expect(response.status).toBe(400);
    });

    it("should return the list of accesses given a DID", async () => {
      expect.assertions(2);

      const response = await request(server).get(
        `/accesses?subject=${testAuthorisedLegalEntityDid}`,
      );

      expect(response.body).toStrictEqual({
        items: expect.arrayContaining([
          expect.objectContaining({
            documentId: expect.any(String),
            grantedBy: expect.stringMatching(/^did:/),
            permission: expect.stringMatching(/^(write|delegate|creator)$/),
            subject: testAuthorisedLegalEntityDid,
          }),
        ]),
        links: {
          first: expect.stringContaining(
            `/accesses?page[after]=1&page[size]=10&subject=${testAuthorisedLegalEntityDid}`,
          ),
          last: expect.stringContaining("/accesses?page[after]="),
          next: expect.stringContaining("/accesses?page[after]="),
          prev: expect.stringContaining(
            `/accesses?page[after]=1&page[size]=10&subject=${testAuthorisedLegalEntityDid}`,
          ),
        },
        pageSize: 10,
        self: expect.stringContaining(
          `/accesses?page[after]=1&page[size]=10&subject=${testAuthorisedLegalEntityDid}`,
        ),
        total: expect.any(Number),
      });
      expect(response.status).toBe(200);
    });
  });
});
