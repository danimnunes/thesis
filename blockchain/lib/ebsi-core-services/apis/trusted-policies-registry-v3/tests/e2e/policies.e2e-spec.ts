import type { PaginatedList } from "@ebsiint-api/shared";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import type { RawServerDefault } from "fastify";

import { ConfigService } from "@nestjs/config";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { ApiConfig } from "../../src/config/configuration.ts";
import type { PolicyLink } from "../../src/modules/policies/policies.interface.ts";

import { AppModule } from "../../src/app.module.ts";
import { getNestFastifyApplication } from "../utils/app.ts";
import { getServer } from "../utils/getServer.ts";

interface SupertestPoliciesResponse {
  body: PaginatedList<PolicyLink>;
  status: number;
}

describe("TPR API v3 - Policies (e2e)", () => {
  let app: NestFastifyApplication;
  let server: RawServerDefault | string;
  let configService: ConfigService<ApiConfig, true>;

  beforeAll(async () => {
    app = await getNestFastifyApplication({
      imports: [AppModule],
    });

    if (process.env.TEST_ENV !== "remote") {
      await app.init();
      const fastifyInstance = app.getHttpAdapter().getInstance();
      await fastifyInstance.ready();
    }

    configService = app.get<ConfigService<ApiConfig, true>>(ConfigService);
    server = getServer(app, configService);
  });

  afterAll(async () => {
    await app.close();
  });

  describe("GET /policies", () => {
    it("should return a collection of policies", async () => {
      expect.assertions(2);
      const response: SupertestPoliciesResponse =
        await request(server).get("/policies");

      expect(response.body).toStrictEqual(
        expect.objectContaining({
          items: expect.arrayContaining([]),
          links: expect.objectContaining({
            first: expect.stringContaining(
              "/trusted-policies-registry/v3/policies?page[after]=1&page[size]=10",
            ),
            last: expect.stringContaining(
              "/trusted-policies-registry/v3/policies?page[after]=",
            ),
            next: expect.stringContaining(
              "/trusted-policies-registry/v3/policies?page[after]=",
            ),
            prev: expect.stringContaining(
              "/trusted-policies-registry/v3/policies?page[after]=1&page[size]=10",
            ),
          }),
          pageSize: expect.any(Number),
          self: expect.stringContaining(
            "/trusted-policies-registry/v3/policies?page[after]=1&page[size]=10",
          ),
          total: expect.any(Number),
        }),
      );
      expect(response.status).toBe(200);
    });
  });

  describe("GET /policies/{policyId}", () => {
    it("should return a specific policy", async () => {
      expect.assertions(2);

      // Get last policy
      const getPoliciesResponse: SupertestPoliciesResponse =
        await request(server).get("/policies");

      const policyId = `${getPoliciesResponse.body.total}`;
      const lastPageUrl = getPoliciesResponse.body.links!.last;
      const lastPage: SupertestPoliciesResponse = await request(server).get(
        lastPageUrl.slice(lastPageUrl.lastIndexOf("/policies")),
      );

      const response = await request(server).get(
        `/policies/${lastPage.body.items.at(-1)!.policyName}`,
      );

      expect(response.body).toStrictEqual({
        description: expect.any(String),
        policyId,
        policyName: expect.any(String),
        status: expect.any(Boolean),
      });
      expect(response.status).toBe(200);
    });

    it("should throw an error if the policy is not found", async () => {
      expect.assertions(2);

      const response = await request(server).get("/policies/69042");

      expect(response.body).toStrictEqual({
        detail: "Policy 69042 not found",
        status: 404,
        title: "Policy Not Found",
        type: "about:blank",
      });
      expect(response.status).toBe(404);
    });
  });
});
