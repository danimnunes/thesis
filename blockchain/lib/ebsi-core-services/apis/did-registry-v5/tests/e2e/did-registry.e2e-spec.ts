import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import type { DIDDocument } from "did-resolver";
import type { RawServerDefault } from "fastify";

import { EbsiWallet } from "@europeum-ebsi/wallet-lib";
import { ConfigService } from "@nestjs/config";
import { ethers } from "ethers";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { ApiConfig } from "../../src/config/configuration.ts";

import { AppModule } from "../../src/app.module.ts";
import { getNestFastifyApplication } from "../utils/app.ts";
import { getServer } from "../utils/getServer.ts";

describe("DID Registry API v5 (e2e)", () => {
  let app: NestFastifyApplication;
  let server: RawServerDefault | string;
  let configService: ConfigService<ApiConfig, true>;

  let lastIdentifiers: {
    did: string;
    href: string;
  }[];

  beforeAll(async () => {
    app = await getNestFastifyApplication({
      imports: [AppModule],
    });

    configService = app.get<ConfigService<ApiConfig, true>>(ConfigService);

    if (process.env.TEST_ENV !== "remote") {
      await app.init();
      await app.getHttpAdapter().getInstance().ready();
    }

    server = getServer(app, configService);

    // Get last identifier
    const getAllIdentifiers = await request(server).get(
      "/identifiers?page[size]=50",
    );
    const { total } = getAllIdentifiers.body as {
      total: number;
    };
    const getIdentifiersLastPage = await request(server).get(
      `/identifiers?page[after]=${Math.ceil(total / 10)}&page[size]=10`,
    );
    const { items: identifiers } = getIdentifiersLastPage.body as {
      items: {
        did: string;
        href: string;
      }[];
    };
    lastIdentifiers = identifiers;
  });

  afterAll(async () => {
    await app.close();
  });

  describe("GET /identifiers", () => {
    it("should return a paginated collection of identifiers", async () => {
      expect.assertions(2);

      const response = await request(server).get("/identifiers");

      const total =
        ((response.body as Record<string, unknown>)?.["total"] as number) ?? 0;

      expect(response.body).toStrictEqual({
        items: expect.arrayContaining([
          {
            did: expect.stringContaining("did:"),
            href: expect.stringContaining("/identifiers/"),
          },
        ]),
        links: {
          first: expect.stringContaining(
            "/identifiers?page[after]=1&page[size]=10",
          ),
          last: expect.stringContaining(
            `/identifiers?page[after]=${Math.ceil(total / 10)}&page[size]=10`,
          ),
          next: expect.stringContaining(
            `/identifiers?page[after]=${total > 10 ? 2 : 1}&page[size]=10`,
          ),
          prev: expect.stringContaining(
            "/identifiers?page[after]=1&page[size]=10",
          ),
        },
        pageSize: 10,
        self: expect.stringContaining(
          "/identifiers?page[after]=1&page[size]=10",
        ),
        total: expect.any(Number),
      });
      expect(response.status).toBe(200);
    });

    it("should return a paginated collection of identifiers filtered by verification relationship", async () => {
      expect.assertions(2);

      /**
       * To perform this test we need a DID that contains at
       * least 1 valid verification relationship.
       * Since a document could have all the keys expired, then
       * we use a for loop to check and get one from the last page of
       * DIDs.
       * At the end we have: did, 1 verification relationship, and
       * its corresponding verification method id
       */
      let did = "";
      let vMethodId = "";
      let vRelationship = "";

      for (const identifier of lastIdentifiers) {
        const resp = await request(server).get(
          `/identifiers/${identifier.did}`,
        );
        const didDocument = resp.body as DIDDocument;
        const vr = (
          [
            "authentication",
            "assertionMethod",
            "keyAgreement",
            "capabilityInvocation",
            "capabilityDelegation",
          ] as const
        ).find((r) => {
          return Object.keys(didDocument).includes(r);
        });

        if (vr) {
          did = identifier.did;
          vRelationship = vr;
          vMethodId = (didDocument[vr] as string[])[0]!.split("#")[1]!;
          break;
        }
      }

      /**
       * Call /identifiers and specify the verification relationship
       * and the verification method id
       */
      const extraQuery = `verification-method-id=${vMethodId}&verification-relationship=${vRelationship}`;
      const response = await request(server).get(`/identifiers?${extraQuery}`);

      const total =
        ((response.body as Record<string, unknown>)?.["total"] as number) ?? 0;

      expect(response.body).toStrictEqual({
        items: expect.arrayContaining([
          // the list of items should contain at least the DID obtained above
          {
            did,
            href: expect.stringContaining("/identifiers/"),
          },
        ]),
        links: {
          first: expect.stringContaining(
            `/identifiers?page[after]=1&page[size]=10&${extraQuery}`,
          ),
          last: expect.stringContaining(
            `/identifiers?page[after]=${Math.ceil(
              total / 10,
            )}&page[size]=10&${extraQuery}`,
          ),
          next: expect.stringContaining(
            `/identifiers?page[after]=${
              total > 10 ? 2 : 1
            }&page[size]=10&${extraQuery}`,
          ),
          prev: expect.stringContaining(
            `/identifiers?page[after]=1&page[size]=10&${extraQuery}`,
          ),
        },
        pageSize: 10,
        self: expect.stringContaining(
          `/identifiers?page[after]=1&page[size]=10&${extraQuery}`,
        ),
        total: expect.any(Number),
      });
      expect(response.status).toBe(200);
    });

    it("should throw a Bad Request for bad pagination", async () => {
      expect.assertions(8);

      const response1 = await request(server).get(
        "/identifiers?page[size]=100",
      );
      expect(response1.body).toStrictEqual({
        detail: '["page[size] must not be greater than 50"]',
        status: 400,
        title: "Bad Request",
        type: "about:blank",
      });
      expect(response1.status).toBe(400);

      const response2 = await request(server).get("/identifiers?page[size]=0");
      expect(response2.body).toStrictEqual({
        detail: '["page[size] must not be less than 1"]',
        status: 400,
        title: "Bad Request",
        type: "about:blank",
      });
      expect(response2.status).toBe(400);

      const response3 = await request(server).get("/identifiers?page[after]=0");
      expect(response3.body).toStrictEqual({
        detail: '["page[after] must not be less than 1"]',
        status: 400,
        title: "Bad Request",
        type: "about:blank",
      });
      expect(response3.status).toBe(400);

      const response4 = await request(server).get(
        "/identifiers?page[after]=abc",
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

  describe("GET /identifiers/{did}", () => {
    it("should return a specific identifier", async () => {
      expect.assertions(4);

      const response = await request(server).get(
        `/identifiers/${lastIdentifiers[0]!.did}`,
      );

      expect(response.body).toStrictEqual(
        expect.objectContaining({
          controller: expect.arrayContaining([]),
          id: expect.stringContaining("did:"),
          verificationMethod: expect.arrayContaining([]),
        }),
      );
      expect(
        response.body as { "@context": string | string[] }["@context"],
      ).toBeDefined();
      expect(response.status).toBe(200);
      expect(
        (response.headers as { "content-type": string })["content-type"],
      ).toStrictEqual(expect.stringContaining("application/did+ld+json"));
    });

    it("should return a did document valid at specific time", async () => {
      expect.assertions(3);

      const response = await request(server).get(
        `/identifiers/${lastIdentifiers[0]!.did}?valid-at=1970-01-01`,
      );

      expect(response.body).toStrictEqual(
        expect.objectContaining({
          controller: expect.arrayContaining([]),
          id: expect.stringContaining("did:"),
          verificationMethod: [], // no keys in 1970
        }),
      );
      expect(
        response.body as { "@context": string | string[] }["@context"],
      ).toBeDefined();
      expect(response.status).toBe(200);
    });

    it("should return a specific identifier as 'application/did+json' if 'Accept' header is 'application/did+json'", async () => {
      expect.assertions(3);

      const response = await request(server)
        .get(`/identifiers/${lastIdentifiers[0]!.did}`)
        .set("Accept", "application/did+json");

      expect(response.body).toStrictEqual(
        expect.objectContaining({
          controller: expect.arrayContaining([]),
          id: expect.stringContaining("did:"),
          verificationMethod: expect.arrayContaining([]),
        }),
      );
      expect(response.status).toBe(200);
      expect(
        (response.headers as { "content-type": string })["content-type"],
      ).toStrictEqual(expect.stringContaining("application/did+json"));
    });

    it("should throw an error if the identifier is not a valid did", async () => {
      expect.assertions(2);

      const response = await request(server).get("/identifiers/invalid");

      expect(response.body).toStrictEqual({
        detail: '["did must be a valid DID v1"]',
        status: 400,
        title: "Bad Request",
        type: "about:blank",
      });
      expect(response.status).toBe(400);
    });

    it("should throw an error if the identifier is not found", async () => {
      expect.assertions(2);

      const randomDid = EbsiWallet.createDid();
      const response = await request(server).get(`/identifiers/${randomDid}`);

      expect(response.body).toStrictEqual({
        detail: `Identifier ${randomDid} not found`,
        status: 404,
        title: "Identifier Not Found",
        type: "about:blank",
      });
      expect(response.status).toBe(404);
    });
  });

  describe("POST /identifiers/{did}/actions", () => {
    it("should perform the action checkController", async () => {
      expect.assertions(2);

      const randomAddress = ethers.Wallet.createRandom().address;
      const response = await request(server)
        .post(`/identifiers/${lastIdentifiers[0]!.did}/actions`)
        .send({
          id: 123,
          jsonrpc: "2.0",
          method: "checkController",
          params: [randomAddress],
        });

      expect(response.body).toStrictEqual({
        id: 123,
        jsonrpc: "2.0",
        result: false,
      });
      expect(response.status).toBe(200);
    });
  });
});
