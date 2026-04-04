import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import type { RawServerDefault } from "fastify";

import { TrackAndTrace__factory } from "@ebsiint-sc/track-and-trace";
import { EbsiWallet } from "@europeum-ebsi/wallet-lib";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import type { Access } from "./accesses.interface.ts";

import { getNestFastifyApplication } from "../../../tests/utils/app.ts";
import { setupTestEnv } from "../../../tests/utils/trackAndTrace.ts";
import { LedgerService } from "../ledger/ledger.service.ts";
import { AccessesModule } from "./accesses.module.ts";

describe("Accesses Module", () => {
  let app: NestFastifyApplication;
  let server: RawServerDefault;
  let testEnv: Awaited<ReturnType<typeof setupTestEnv>>;

  beforeAll(async () => {
    // Spin up test blockchain (hardhat)
    testEnv = await setupTestEnv({});
    const { provider, trackAndTraceContract } = testEnv;

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
      imports: [AccessesModule],
    });

    await app.init();
    const fastifyInstance = app.getHttpAdapter().getInstance();
    await fastifyInstance.ready();
    server = app.getHttpServer();
  });

  afterAll(async () => {
    await app.close();
  });

  describe("HEAD /accesses?creator={did}", () => {
    it("should throw an error 400 if the creator parameter is missing or invalid", async () => {
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

      const { creatorAccount } = testEnv;

      const response = await request(server).head(
        `/accesses?creator=${creatorAccount}`,
      );

      expect(response.body).toStrictEqual({});
      expect(response.status).toBe(204);
    });
  });

  describe("GET /accesses?subject={did}", () => {
    it("should throw an error 400 if the subject parameter is missing or invalid", async () => {
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

    it("should return an empty list when there are no accesses", async () => {
      expect.assertions(2);

      const randomDid = EbsiWallet.createDid();
      const response = await request(server).get(
        `/accesses?subject=${randomDid}`,
      );

      expect(response.body).toStrictEqual({
        items: [],
        links: {
          first: expect.stringContaining(
            `/accesses?page[after]=1&page[size]=10&subject=${randomDid}`,
          ),
          last: expect.stringContaining(
            `/accesses?page[after]=1&page[size]=10&subject=${randomDid}`,
          ),
          next: expect.stringContaining(
            `/accesses?page[after]=1&page[size]=10&subject=${randomDid}`,
          ),
          prev: expect.stringContaining(
            `/accesses?page[after]=1&page[size]=10&subject=${randomDid}`,
          ),
        },
        pageSize: 10,
        self: expect.stringContaining(
          `/accesses?page[after]=1&page[size]=10&subject=${randomDid}`,
        ),
        total: 0,
      });
      expect(response.status).toBe(200);
    });

    it("should return the list of accesses given a DID (did:ebsi)", async () => {
      expect.assertions(2);

      const {
        creatorAccount,
        documentsWithBlockSource,
        grantedDidEbsiAccount,
      } = testEnv;

      const response = await request(server).get(
        `/accesses?subject=${grantedDidEbsiAccount}`,
      );

      const items: Access[] = [];
      for (const doc of documentsWithBlockSource) {
        items.push(
          {
            documentId: doc.documentHash,
            grantedBy: creatorAccount,
            permission: "delegate",
            subject: grantedDidEbsiAccount,
          },
          {
            documentId: doc.documentHash,
            grantedBy: creatorAccount,
            permission: "write",
            subject: grantedDidEbsiAccount,
          },
        );
      }

      expect(response.body).toStrictEqual({
        items,
        links: {
          first: expect.stringContaining(
            `/accesses?page[after]=1&page[size]=10&subject=${grantedDidEbsiAccount}`,
          ),
          last: expect.stringContaining(
            `/accesses?page[after]=1&page[size]=10&subject=${grantedDidEbsiAccount}`,
          ),
          next: expect.stringContaining(
            `/accesses?page[after]=1&page[size]=10&subject=${grantedDidEbsiAccount}`,
          ),
          prev: expect.stringContaining(
            `/accesses?page[after]=1&page[size]=10&subject=${grantedDidEbsiAccount}`,
          ),
        },
        pageSize: 10,
        self: expect.stringContaining(
          `/accesses?page[after]=1&page[size]=10&subject=${grantedDidEbsiAccount}`,
        ),
        total: documentsWithBlockSource.length * 2,
      });
      expect(response.status).toBe(200);
    });

    it("should return the list of accesses given a DID (did:key)", async () => {
      expect.assertions(2);

      const { creatorAccount, documentsWithBlockSource, grantedDidKeyAccount } =
        testEnv;

      const response = await request(server).get(
        `/accesses?subject=${grantedDidKeyAccount}`,
      );

      const items: Access[] = [];
      for (const doc of documentsWithBlockSource) {
        items.push(
          {
            documentId: doc.documentHash,
            grantedBy: creatorAccount,
            permission: "delegate",
            subject: grantedDidKeyAccount,
          },
          {
            documentId: doc.documentHash,
            grantedBy: creatorAccount,
            permission: "write",
            subject: grantedDidKeyAccount,
          },
        );
      }

      expect(response.body).toStrictEqual({
        items,
        links: {
          first: expect.stringContaining(
            `/accesses?page[after]=1&page[size]=10&subject=${grantedDidKeyAccount}`,
          ),
          last: expect.stringContaining(
            `/accesses?page[after]=1&page[size]=10&subject=${grantedDidKeyAccount}`,
          ),
          next: expect.stringContaining(
            `/accesses?page[after]=1&page[size]=10&subject=${grantedDidKeyAccount}`,
          ),
          prev: expect.stringContaining(
            `/accesses?page[after]=1&page[size]=10&subject=${grantedDidKeyAccount}`,
          ),
        },
        pageSize: 10,
        self: expect.stringContaining(
          `/accesses?page[after]=1&page[size]=10&subject=${grantedDidKeyAccount}`,
        ),
        total: documentsWithBlockSource.length * 2,
      });
      expect(response.status).toBe(200);
    });
  });
});
