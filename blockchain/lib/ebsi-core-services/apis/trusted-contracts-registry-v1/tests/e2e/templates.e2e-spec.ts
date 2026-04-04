import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import type { RawServerDefault } from "fastify";

import { ConfigService } from "@nestjs/config";
import { useContainer } from "class-validator";
import { ethers } from "ethers";
import { randomBytes } from "node:crypto";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { ApiConfig } from "../../src/config/configuration.ts";
import type {
  Template,
  TemplatesLink,
} from "../../src/modules/templates/templates.interface.ts";

import { AppModule } from "../../src/app.module.ts";
import { getNestFastifyApplication } from "../utils/app.ts";
import { getServer } from "../utils/getServer.ts";

describe("Trusted Contracts Registry API v1 - Templates (e2e)", () => {
  let app: NestFastifyApplication;
  let server: RawServerDefault | string;
  let configService: ConfigService<ApiConfig, true>;

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
  });

  afterAll(async () => {
    await app.close();
  });

  describe("GET /templates", () => {
    it("should return a paginated collection of templates", async () => {
      expect.assertions(2);

      const response = await request(server).get("/templates");

      const total =
        ((response.body as Record<string, unknown>)?.["total"] as number) ?? 0;

      expect(response.body).toStrictEqual({
        items:
          total > 0
            ? expect.arrayContaining([
                {
                  href: expect.stringContaining("/templates/"),
                  id: expect.stringContaining("0x"),
                },
              ])
            : [],
        links: {
          first: expect.stringContaining(
            "/templates?page[after]=1&page[size]=10",
          ),
          last: expect.stringContaining(
            `/templates?page[after]=${Math.max(Math.ceil(total / 10), 1)}&page[size]=10`,
          ),
          next: expect.stringContaining(
            `/templates?page[after]=${total > 10 ? 2 : 1}&page[size]=10`,
          ),
          prev: expect.stringContaining(
            "/templates?page[after]=1&page[size]=10",
          ),
        },
        pageSize: 10,
        self: expect.stringContaining("/templates?page[after]=1&page[size]=10"),
        total: expect.any(Number),
      });
      expect(response.status).toBe(200);
    });

    it("should throw a Bad Request for bad pagination", async () => {
      expect.assertions(8);

      const response1 = await request(server).get("/templates?page[size]=100");
      expect(response1.body).toStrictEqual({
        detail: '["page[size] must not be greater than 50"]',
        status: 400,
        title: "Bad Request",
        type: "about:blank",
      });
      expect(response1.status).toBe(400);

      const response2 = await request(server).get("/templates?page[size]=0");
      expect(response2.body).toStrictEqual({
        detail: '["page[size] must not be less than 1"]',
        status: 400,
        title: "Bad Request",
        type: "about:blank",
      });
      expect(response2.status).toBe(400);

      const response3 = await request(server).get("/templates?page[after]=0");
      expect(response3.body).toStrictEqual({
        detail: '["page[after] must not be less than 1"]',
        status: 400,
        title: "Bad Request",
        type: "about:blank",
      });
      expect(response3.status).toBe(400);

      const response4 = await request(server).get("/templates?page[after]=abc");
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

  describe("GET /templates/{id}", () => {
    it("should return a specific template", async () => {
      let response = await request(server).get("/templates");

      const { items } = response.body as { items: TemplatesLink[] };

      if (items.length === 0) {
        expect.assertions(0);
        return;
      }

      expect.assertions(3);

      const firstTemplateId = items[0]!.id;

      response = await request(server).get(`/templates/${firstTemplateId}`);

      expect(response.body).toStrictEqual({
        auditURI: expect.any(String),
        beaconAddress: expect.stringMatching(/^0x/),
        contractHash: expect.stringMatching(/^0x/),
        id: firstTemplateId,
        initSelector: expect.any(String),
        isActive: true,
        name: expect.any(String),
        repoURI: expect.any(String),
        storageLayoutHash: expect.stringMatching(/^0x/),
        version: expect.any(String),
      } satisfies Template);
      expect(response.status).toBe(200);
      expect(
        (response.headers as { "content-type": string })["content-type"],
      ).toStrictEqual(expect.stringContaining("application/json"));
    });

    it("should throw an error 400 if the template ID is not valid", async () => {
      expect.assertions(12);

      let response = await request(server).get(`/templates/no-template`);

      expect(response.body).toStrictEqual({
        detail:
          '["id must be 32 bytes encoded in hexadecimal and start with 0x"]',
        status: 400,
        title: "Bad Request",
        type: "about:blank",
      });
      expect(response.status).toBe(400);
      expect(
        (response.headers as { "content-type": string })["content-type"],
      ).toStrictEqual(expect.stringContaining("application/problem+json"));

      response = await request(server).get(`/templates/0xnothexadecimal`);

      expect(response.body).toStrictEqual({
        detail:
          '["id must be 32 bytes encoded in hexadecimal and start with 0x"]',
        status: 400,
        title: "Bad Request",
        type: "about:blank",
      });
      expect(response.status).toBe(400);
      expect(
        (response.headers as { "content-type": string })["content-type"],
      ).toStrictEqual(expect.stringContaining("application/problem+json"));

      response = await request(server).get(
        `/templates/${ethers.Wallet.createRandom().address}`,
      );

      expect(response.body).toStrictEqual({
        detail:
          '["id must be 32 bytes encoded in hexadecimal and start with 0x"]',
        status: 400,
        title: "Bad Request",
        type: "about:blank",
      });
      expect(response.status).toBe(400);
      expect(
        (response.headers as { "content-type": string })["content-type"],
      ).toStrictEqual(expect.stringContaining("application/problem+json"));

      response = await request(server).get(
        `/templates/0x${randomBytes(24).toString("hex")}`,
      );

      expect(response.body).toStrictEqual({
        detail:
          '["id must be 32 bytes encoded in hexadecimal and start with 0x"]',
        status: 400,
        title: "Bad Request",
        type: "about:blank",
      });
      expect(response.status).toBe(400);
      expect(
        (response.headers as { "content-type": string })["content-type"],
      ).toStrictEqual(expect.stringContaining("application/problem+json"));
    });

    it("should throw an error if the template is not found", async () => {
      expect.assertions(3);

      const id = `0x${randomBytes(32).toString("hex")}`;
      const response = await request(server).get(`/templates/${id}`);

      expect(response.body).toStrictEqual({
        detail: `Template ${id} not found`,
        status: 404,
        title: "Template Not Found",
        type: "about:blank",
      });
      expect(response.status).toBe(404);
      expect(
        (response.headers as { "content-type": string })["content-type"],
      ).toStrictEqual(expect.stringContaining("application/problem+json"));
    });
  });
});
