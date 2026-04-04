import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import type { RawServerDefault } from "fastify";

import { ProxyTemplateRegistry__factory } from "@ebsiint-sc/trusted-contracts-registry-v1";
import { randomBytes } from "node:crypto";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import type { TestTemplate } from "../../../tests/utils/data.ts";

import { getNestFastifyApplication } from "../../../tests/utils/app.ts";
import { setupTestEnv } from "../../../tests/utils/tcr.ts";
import { LedgerService } from "../ledger/ledger.service.ts";
import { TemplatesModule } from "./templates.module.ts";

describe("Templates Module", () => {
  let app: NestFastifyApplication;
  let server: RawServerDefault;
  let testEnv: Awaited<ReturnType<typeof setupTestEnv>>;
  let templates: TestTemplate[];

  beforeAll(async () => {
    // Spin up test blockchain (hardhat)
    testEnv = await setupTestEnv({
      templatesTotal: 3,
    });
    const { provider, proxyTemplateRegistryContract } = testEnv;
    templates = testEnv.templates;

    // Mock contract
    vi.spyOn(ProxyTemplateRegistry__factory, "connect").mockImplementation(
      // Create new instance without runner (provider)
      () => proxyTemplateRegistryContract.connect(),
    );

    // Mock LedgerService
    vi.spyOn(LedgerService.prototype, "getProvider").mockImplementation(
      // @ts-expect-error Error due to a mismatch between ESM and CommonJS modules
      () => provider,
    );

    app = await getNestFastifyApplication({
      imports: [TemplatesModule],
    });

    await app.init();
    const fastifyInstance = app.getHttpAdapter().getInstance();
    await fastifyInstance.ready();
    server = app.getHttpServer();
  });

  afterAll(async () => {
    await app.close();
  });

  describe("GET /templates", () => {
    it("should return a paginated collection of templates", async () => {
      expect.assertions(3);

      const response = await request(server).get("/templates");

      expect(response.body).toStrictEqual({
        items: templates.map((template) => ({
          href: expect.stringContaining(`/templates/${template.id}`),
          id: template.id,
        })),
        links: {
          first: expect.stringContaining(
            "/templates?page[after]=1&page[size]=10",
          ),
          last: expect.stringContaining(
            "/templates?page[after]=1&page[size]=10",
          ),
          next: expect.stringContaining(
            "/templates?page[after]=1&page[size]=10",
          ),
          prev: expect.stringContaining(
            "/templates?page[after]=1&page[size]=10",
          ),
        },
        pageSize: 10,
        self: expect.stringContaining("/templates?page[after]=1&page[size]=10"),
        total: templates.length,
      });
      expect((response.body as { items: string }).items).toHaveLength(
        templates.length,
      );
      expect(response.status).toBe(200);
    });

    it("should handle the pagination properly", async () => {
      expect.assertions(12);

      const allTemplates = templates.map((template) => ({
        href: expect.stringContaining(`/templates/${template.id}`),
        id: template.id,
      }));
      const response1 = await request(server).get("/templates?page[size]=2");
      expect(response1.body).toStrictEqual({
        items: allTemplates.slice(0, 2),
        links: {
          first: expect.stringContaining(
            "/templates?page[after]=1&page[size]=2",
          ),
          last: expect.stringContaining(
            "/templates?page[after]=2&page[size]=2",
          ),
          next: expect.stringContaining(
            "/templates?page[after]=2&page[size]=2",
          ),
          prev: expect.stringContaining(
            "/templates?page[after]=1&page[size]=2",
          ),
        },
        pageSize: 2,
        self: expect.stringContaining("/templates?page[after]=1&page[size]=2"),
        total: templates.length,
      });
      expect((response1.body as { items: string }).items).toHaveLength(2);
      expect(response1.status).toBe(200);

      // next page
      const response2 = await request(server).get(
        "/templates?page[after]=2&page[size]=2",
      );
      expect(response2.body).toStrictEqual({
        items: allTemplates.slice(2, 4),
        links: {
          first: expect.stringContaining(
            "/templates?page[after]=1&page[size]=2",
          ),
          last: expect.stringContaining(
            "/templates?page[after]=2&page[size]=2",
          ),
          next: expect.stringContaining(
            "/templates?page[after]=2&page[size]=2",
          ),
          prev: expect.stringContaining(
            "/templates?page[after]=1&page[size]=2",
          ),
        },
        pageSize: 2,
        self: expect.stringContaining("/templates?page[after]=2&page[size]=2"),
        total: templates.length,
      });
      expect((response2.body as { items: string }).items).toHaveLength(1);
      expect(response2.status).toBe(200);

      // big page
      const response3 = await request(server).get(
        "/templates?page[after]=100&page[size]=2",
      );
      expect(response3.body).toStrictEqual({
        items: [],
        links: {
          first: expect.stringContaining(
            "/templates?page[after]=1&page[size]=2",
          ),
          last: expect.stringContaining(
            "/templates?page[after]=2&page[size]=2",
          ),
          next: expect.stringContaining(
            "/templates?page[after]=2&page[size]=2",
          ),
          prev: expect.stringContaining(
            "/templates?page[after]=2&page[size]=2",
          ),
        },
        pageSize: 2,
        self: expect.stringContaining(
          "/templates?page[after]=100&page[size]=2",
        ),
        total: templates.length,
      });
      expect((response3.body as { items: string }).items).toHaveLength(0);
      expect(response3.status).toBe(200);

      // page["after"] defined but page["size"] undefined
      const response4 = await request(server).get("/templates?page[after]=1");
      expect(response4.body).toStrictEqual({
        items: allTemplates,
        links: {
          first: expect.stringContaining(
            "/templates?page[after]=1&page[size]=10",
          ),
          last: expect.stringContaining(
            "/templates?page[after]=1&page[size]=10",
          ),
          next: expect.stringContaining(
            "/templates?page[after]=1&page[size]=10",
          ),
          prev: expect.stringContaining(
            "/templates?page[after]=1&page[size]=10",
          ),
        },
        pageSize: 10,
        self: expect.stringContaining("/templates?page[after]=1&page[size]=10"),
        total: templates.length,
      });
      expect((response4.body as { items: string }).items).toHaveLength(
        templates.length,
      );
      expect(response4.status).toBe(200);
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

    it("should reject a non whitelisted query", async () => {
      expect.assertions(2);

      const response = await request(server).get(
        "/templates?invalid-query=abc",
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

  describe("GET /templates/{id}", () => {
    it("should throw an error 400 if the template ID is not valid", async () => {
      expect.assertions(12);

      let response = await request(server).get(`/templates/no-template`);

      expect(response.body).toStrictEqual({
        detail: JSON.stringify([
          "id must be 32 bytes encoded in hexadecimal and start with 0x",
        ]),
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
        detail: JSON.stringify([
          "id must be 32 bytes encoded in hexadecimal and start with 0x",
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
        `/templates/${randomBytes(40).toString("hex")}`,
      );

      expect(response.body).toStrictEqual({
        detail: JSON.stringify([
          "id must be 32 bytes encoded in hexadecimal and start with 0x",
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
        `/templates/0x${randomBytes(24).toString("hex")}`,
      );

      expect(response.body).toStrictEqual({
        detail: JSON.stringify([
          "id must be 32 bytes encoded in hexadecimal and start with 0x",
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

    it("should return a specific template identified by its id", async () => {
      expect.assertions(3);

      const template = testEnv.templates[0]!;

      const response = await request(server).get(`/templates/${template.id}`);

      expect(response.body).toStrictEqual(template);
      expect(response.status).toBe(200);
      expect(
        (response.headers as { "content-type": string })["content-type"],
      ).toStrictEqual(expect.stringContaining("application/json"));
    });
  });
});
