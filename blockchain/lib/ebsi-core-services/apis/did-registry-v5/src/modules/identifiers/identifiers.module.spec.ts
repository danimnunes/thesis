import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import type { RawServerDefault } from "fastify";

import { encode } from "@ebsiint-api/shared";
import { DidRegistry__factory } from "@ebsiint-sc/did-registry-v5";
import { EbsiWallet } from "@europeum-ebsi/wallet-lib";
import { ethers } from "ethers";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import type { UserDetails } from "../../../tests/utils/data.ts";

import { getNestFastifyApplication } from "../../../tests/utils/app.ts";
import { createUser } from "../../../tests/utils/data.ts";
import { setupTestEnv } from "../../../tests/utils/didRegistry.ts";
import { LedgerService } from "../ledger/ledger.service.ts";
import { IdentifiersModule } from "./identifiers.module.ts";

const DID_DOCUMENTS = 3;

describe("Identifiers Module", () => {
  let app: NestFastifyApplication;
  let server: RawServerDefault;
  let testEnv: Awaited<ReturnType<typeof setupTestEnv>>;
  let users: UserDetails[];

  beforeAll(async () => {
    // Spin up test blockchain (hardhat)
    testEnv = await setupTestEnv({
      didDocumentsTotal: DID_DOCUMENTS,
    });
    const { didRegistryContract, provider } = testEnv;
    users = testEnv.users;

    const didRegistryContractAddress = await didRegistryContract.getAddress();

    // Stub environment variables
    vi.stubEnv("CONTRACT_ADDR", didRegistryContractAddress);

    // Mock DidRegistry contract
    vi.spyOn(DidRegistry__factory, "connect").mockImplementation(() =>
      // Create new instance without runner (provider)
      didRegistryContract.connect(),
    );

    // Mock LedgerService
    vi.spyOn(LedgerService.prototype, "getProvider").mockImplementation(
      // @ts-expect-error Error due to a mismatch between ESM and CommonJS modules
      () => provider,
    );

    app = await getNestFastifyApplication({
      imports: [IdentifiersModule],
    });

    await app.init();
    const fastifyInstance = app.getHttpAdapter().getInstance();
    await fastifyInstance.ready();
    server = app.getHttpServer();
  });

  afterAll(async () => {
    await app.close();
  });

  describe("GET /identifiers", () => {
    it("should return a paginated collection of DID documents", async () => {
      expect.assertions(3);

      const response = await request(server).get("/identifiers");
      expect(response.body).toStrictEqual({
        items: expect.arrayContaining(
          users.map((user) => ({
            did: user.did,
            href: expect.stringContaining(`/identifiers/${user.did}`),
          })),
        ),
        links: {
          first: expect.stringContaining(
            "/identifiers?page[after]=1&page[size]=10",
          ),
          last: expect.stringContaining(
            "/identifiers?page[after]=1&page[size]=10",
          ),
          next: expect.stringContaining(
            "/identifiers?page[after]=1&page[size]=10",
          ),
          prev: expect.stringContaining(
            "/identifiers?page[after]=1&page[size]=10",
          ),
        },
        pageSize: 10,
        self: expect.stringContaining(
          "/identifiers?page[after]=1&page[size]=10",
        ),
        total: DID_DOCUMENTS,
      });
      expect((response.body as { items: string }).items).toHaveLength(
        DID_DOCUMENTS,
      );
      expect(response.status).toBe(200);
    });

    it("should reject a non whitelisted query", async () => {
      expect.assertions(2);

      const response = await request(server).get(
        "/identifiers?invalid-query=abc",
      );

      expect(response.body).toStrictEqual({
        detail: '["property invalid-query should not exist"]',
        status: 400,
        title: "Bad Request",
        type: "about:blank",
      });
      expect(response.status).toBe(400);
    });

    it("should return an empty array for an unknown controller", async () => {
      expect.assertions(2);

      const controller = EbsiWallet.createDid();

      const response = await request(server).get(
        `/identifiers?controller=${controller}`,
      );
      expect(response.body).toStrictEqual({
        detail: `Controller ${controller} not found`,
        status: 404,
        title: "Not Found",
        type: "about:blank",
      });
      expect(response.status).toBe(404);
    });

    it("should return DIDs filtered by controller", async () => {
      expect.assertions(2);

      const controller = users[0]!.did;

      const response = await request(server).get(
        `/identifiers?controller=${controller}`,
      );
      expect(response.body).toStrictEqual({
        items: [
          {
            did: controller,
            href: expect.any(String),
          },
        ],
        links: {
          first: expect.stringContaining(
            `/identifiers?page[after]=1&page[size]=10&controller=${controller}`,
          ),
          last: expect.stringContaining(
            `/identifiers?page[after]=1&page[size]=10&controller=${controller}`,
          ),
          next: expect.stringContaining(
            `/identifiers?page[after]=1&page[size]=10&controller=${controller}`,
          ),
          prev: expect.stringContaining(
            `/identifiers?page[after]=1&page[size]=10&controller=${controller}`,
          ),
        },
        pageSize: 10,
        self: expect.stringContaining(
          `/identifiers?page[after]=1&page[size]=10&controller=${controller}`,
        ),
        total: 1,
      });
      expect(response.status).toBe(200);
    });

    it("should return DIDs filtered by verification relationship", async () => {
      expect.assertions(2);

      const extraQuery = `verification-method-id=${
        users[0]!.thumbprint
      }&verification-relationship=capabilityInvocation`;
      const response = await request(server).get(`/identifiers?${extraQuery}`);
      expect(response.body).toStrictEqual({
        items: [
          {
            did: users[0]!.did,
            href: expect.any(String),
          },
        ],
        links: {
          first: expect.stringContaining(
            `/identifiers?page[after]=1&page[size]=10&${extraQuery}`,
          ),
          last: expect.stringContaining(
            `/identifiers?page[after]=1&page[size]=10&${extraQuery}`,
          ),
          next: expect.stringContaining(
            `/identifiers?page[after]=1&page[size]=10&${extraQuery}`,
          ),
          prev: expect.stringContaining(
            `/identifiers?page[after]=1&page[size]=10&${extraQuery}`,
          ),
        },
        pageSize: 10,
        self: expect.stringContaining(
          `/identifiers?page[after]=1&page[size]=10&${extraQuery}`,
        ),
        total: 1,
      });
      expect(response.status).toBe(200);
    });

    it("should handle the pagination properly", async () => {
      expect.assertions(12);

      const response1 = await request(server).get("/identifiers?page[size]=2");
      expect(response1.body).toStrictEqual({
        items: expect.arrayContaining([]),
        links: {
          first: expect.stringContaining(
            "/identifiers?page[after]=1&page[size]=2",
          ),
          last: expect.stringContaining(
            "/identifiers?page[after]=2&page[size]=2",
          ),
          next: expect.stringContaining(
            "/identifiers?page[after]=2&page[size]=2",
          ),
          prev: expect.stringContaining(
            "/identifiers?page[after]=1&page[size]=2",
          ),
        },
        pageSize: 2,
        self: expect.stringContaining(
          "/identifiers?page[after]=1&page[size]=2",
        ),
        total: DID_DOCUMENTS,
      });
      expect((response1.body as { items: string }).items).toHaveLength(2);
      expect(response1.status).toBe(200);

      // next page
      const response2 = await request(server).get(
        "/identifiers?page[after]=2&page[size]=2",
      );
      expect(response2.body).toStrictEqual({
        items: expect.arrayContaining([]),
        links: {
          first: expect.stringContaining(
            "/identifiers?page[after]=1&page[size]=2",
          ),
          last: expect.stringContaining(
            "/identifiers?page[after]=2&page[size]=2",
          ),
          next: expect.stringContaining(
            "/identifiers?page[after]=2&page[size]=2",
          ),
          prev: expect.stringContaining(
            "/identifiers?page[after]=1&page[size]=2",
          ),
        },
        pageSize: 2,
        self: expect.stringContaining(
          "/identifiers?page[after]=2&page[size]=2",
        ),
        total: DID_DOCUMENTS,
      });
      expect((response2.body as { items: string }).items).toHaveLength(1);
      expect(response2.status).toBe(200);

      // big page
      const response3 = await request(server).get(
        "/identifiers?page[after]=100&page[size]=2",
      );
      expect(response3.body).toStrictEqual({
        items: expect.arrayContaining([]),
        links: {
          first: expect.stringContaining(
            "/identifiers?page[after]=1&page[size]=2",
          ),
          last: expect.stringContaining(
            "/identifiers?page[after]=2&page[size]=2",
          ),
          next: expect.stringContaining(
            "/identifiers?page[after]=2&page[size]=2",
          ),
          prev: expect.stringContaining(
            "/identifiers?page[after]=2&page[size]=2",
          ),
        },
        pageSize: 2,
        self: expect.stringContaining(
          "/identifiers?page[after]=100&page[size]=2",
        ),
        total: DID_DOCUMENTS,
      });
      expect((response3.body as { items: string }).items).toHaveLength(0);
      expect(response3.status).toBe(200);

      // page["after"] defined but page["size"] undefined
      const response4 = await request(server).get("/identifiers?page[after]=1");
      expect(response4.body).toStrictEqual({
        items: expect.arrayContaining([]),
        links: {
          first: expect.stringContaining(
            "/identifiers?page[after]=1&page[size]=10",
          ),
          last: expect.stringContaining(
            "/identifiers?page[after]=1&page[size]=10",
          ),
          next: expect.stringContaining(
            "/identifiers?page[after]=1&page[size]=10",
          ),
          prev: expect.stringContaining(
            "/identifiers?page[after]=1&page[size]=10",
          ),
        },
        pageSize: 10,
        self: expect.stringContaining(
          "/identifiers?page[after]=1&page[size]=10",
        ),
        total: DID_DOCUMENTS,
      });
      expect((response4.body as { items: string }).items).toHaveLength(3);
      expect(response4.status).toBe(200);
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
    it("should return a specific DID document", async () => {
      expect.assertions(3);

      const { did, didDocument } = users[0]!;

      const response = await request(server).get(`/identifiers/${did}`);

      expect(response.body).toStrictEqual(didDocument);
      expect(response.status).toBe(200);
      expect(
        (response.headers as { "content-type": string })["content-type"],
      ).toStrictEqual(expect.stringContaining("application/did+ld+json"));
    });

    it("should return a specific DID document as 'application/did+json' if 'Accept' header is 'application/did+json'", async () => {
      expect.assertions(4);

      const { did, didDocument } = users[0]!;

      const response = await request(server)
        .get(`/identifiers/${did}`)
        .set("Accept", "application/did+json");

      const { "@context": context, ...didDocWithoutContext } = didDocument;

      expect(response.body).toStrictEqual(didDocWithoutContext);
      expect(
        (response.body as Record<string, unknown>)["@context"],
      ).toBeUndefined();
      expect(response.status).toBe(200);
      expect(
        (response.headers as { "content-type": string })["content-type"],
      ).toStrictEqual(expect.stringContaining("application/did+json"));
    });

    it("should return a DID document valid at a specific time", async () => {
      expect.assertions(10);

      const user = await createUser();
      const publicKeyJwk1 = encode.publicKey.fromHexToJWK(
        user.wallet.signingKey.publicKey,
      );
      const thumbprint1 = user.thumbprint;
      const publicKeyJwk2 = {
        crv: "P-256",
        kty: "EC",
        x: "S72xRvIMPce-tPHJOaB8km4mPkcz2brMxtAQ8GDfAVg",
        y: "6szYD97Mp2BQnIwAVg2axxJSY3JsG8LQknyR7WH09Pc",
      };
      const thumbprint2 = "2hyKWiLemt60cgMhW7RZOFjXN7nBjAml3bjk4IAYQtQ";
      const publicKeyJwk3 = {
        crv: "Ed25519",
        kty: "OKP",
        x: "AHjO0ivGIlmGBoqeVGEs4OA7Am9tmG-qpcGoz_wf58Y",
      };
      const thumbprint3 = "jjgyWrlP1LJR1q2cGNrPEj_7wnwafmQoij4wBHbj_iY";

      // creation of a new did document
      let tx = await testEnv.didRegistryContract.insertDidDocument(
        user.did,
        JSON.stringify({ "@context": user.didDocument["@context"] }),
        thumbprint1,
        user.wallet.signingKey.publicKey,
        true,
        new Date("2022-01-01").getTime() / 1000,
        new Date("2030-01-01").getTime() / 1000,
      );
      await tx.wait();

      // new key and relationship added later
      tx = await testEnv.didRegistryContract.addVerificationMethod(
        user.did,
        thumbprint2,
        Buffer.from(JSON.stringify(publicKeyJwk2)),
        false,
      );
      await tx.wait();

      tx = await testEnv.didRegistryContract.addVerificationRelationship(
        user.did,
        "authentication",
        thumbprint2,
        new Date("2024-01-01").getTime() / 1000,
        new Date("2029-01-01").getTime() / 1000,
      );
      await tx.wait();

      // the first key is rolled
      tx = await testEnv.didRegistryContract.rollVerificationMethod({
        did: user.did,
        duration: 3 * 30 * 24 * 3600, // 3 months of transition
        isSecp256k1: false,
        notAfter: new Date("2040-01-01").getTime() / 1000,
        notBefore: new Date("2027-01-01").getTime() / 1000,
        oldVMethodId: thumbprint1,
        publicKey: Buffer.from(JSON.stringify(publicKeyJwk3)),
        vMethodId: thumbprint3,
      });
      await tx.wait();

      // new controller added
      tx = await testEnv.didRegistryContract.addController(
        user.did,
        users[0]!.did,
      );
      await tx.wait();

      // controllers are the same for the whole history
      const controllers = [user.did, users[0]!.did];

      // expect first key in 2022
      let response = await request(server).get(
        `/identifiers/${user.did}?valid-at=2022-02-01`,
      );
      expect(response.body).toStrictEqual({
        "@context": user.didDocument["@context"],
        authentication: [`${user.did}#${thumbprint1}`],
        capabilityInvocation: [`${user.did}#${thumbprint1}`],
        controller: controllers,
        id: user.did,
        verificationMethod: [
          {
            controller: user.did,
            id: `${user.did}#${thumbprint1}`,
            publicKeyJwk: publicKeyJwk1,
            type: "JsonWebKey2020",
          },
        ],
      });
      expect(response.status).toBe(200);

      // expect 2 keys in 2024
      response = await request(server).get(
        `/identifiers/${user.did}?valid-at=2024-02-01`,
      );
      expect(response.body).toStrictEqual({
        "@context": user.didDocument["@context"],
        authentication: [
          `${user.did}#${thumbprint1}`,
          `${user.did}#${thumbprint2}`,
        ],
        capabilityInvocation: [`${user.did}#${thumbprint1}`],
        controller: controllers,
        id: user.did,
        verificationMethod: [
          {
            controller: user.did,
            id: `${user.did}#${thumbprint1}`,
            publicKeyJwk: publicKeyJwk1,
            type: "JsonWebKey2020",
          },
          {
            controller: user.did,
            id: `${user.did}#${thumbprint2}`,
            publicKeyJwk: publicKeyJwk2,
            type: "JsonWebKey2020",
          },
        ],
      });
      expect(response.status).toBe(200);

      // expect 3 keys in the beginning of 2027 (because of the transition period for the rolling)
      response = await request(server).get(
        `/identifiers/${user.did}?valid-at=2027-02-01`,
      );
      expect(response.body).toStrictEqual({
        "@context": user.didDocument["@context"],
        authentication: [
          `${user.did}#${thumbprint1}`,
          `${user.did}#${thumbprint2}`,
          `${user.did}#${thumbprint3}`,
        ],
        capabilityInvocation: [
          `${user.did}#${thumbprint1}`,
          `${user.did}#${thumbprint3}`,
        ],
        controller: controllers,
        id: user.did,
        verificationMethod: [
          {
            controller: user.did,
            id: `${user.did}#${thumbprint1}`,
            publicKeyJwk: publicKeyJwk1,
            type: "JsonWebKey2020",
          },
          {
            controller: user.did,
            id: `${user.did}#${thumbprint2}`,
            publicKeyJwk: publicKeyJwk2,
            type: "JsonWebKey2020",
          },
          {
            controller: user.did,
            id: `${user.did}#${thumbprint3}`,
            publicKeyJwk: publicKeyJwk3,
            type: "JsonWebKey2020",
          },
        ],
      });
      expect(response.status).toBe(200);

      // expect 2 keys in the middle of 2027 (first key removed after rolling)
      response = await request(server).get(
        `/identifiers/${user.did}?valid-at=2027-06-01`,
      );
      expect(response.body).toStrictEqual({
        "@context": user.didDocument["@context"],
        authentication: [
          `${user.did}#${thumbprint2}`,
          `${user.did}#${thumbprint3}`,
        ],
        capabilityInvocation: [`${user.did}#${thumbprint3}`],
        controller: controllers,
        id: user.did,
        verificationMethod: [
          {
            controller: user.did,
            id: `${user.did}#${thumbprint2}`,
            publicKeyJwk: publicKeyJwk2,
            type: "JsonWebKey2020",
          },
          {
            controller: user.did,
            id: `${user.did}#${thumbprint3}`,
            publicKeyJwk: publicKeyJwk3,
            type: "JsonWebKey2020",
          },
        ],
      });
      expect(response.status).toBe(200);

      // expect only 1 key by 2030 (second key expired)
      response = await request(server).get(
        `/identifiers/${user.did}?valid-at=2030-02-01`,
      );
      expect(response.body).toStrictEqual({
        "@context": user.didDocument["@context"],
        authentication: [`${user.did}#${thumbprint3}`],
        capabilityInvocation: [`${user.did}#${thumbprint3}`],
        controller: controllers,
        id: user.did,
        verificationMethod: [
          {
            controller: user.did,
            id: `${user.did}#${thumbprint3}`,
            publicKeyJwk: publicKeyJwk3,
            type: "JsonWebKey2020",
          },
        ],
      });
      expect(response.status).toBe(200);
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

    it("should throw an error if the did document is bad formatted", async () => {
      expect.assertions(4);

      let user = await createUser();
      const now = Math.floor(Date.now() / 1000);
      let tx = await testEnv.didRegistryContract.insertDidDocument(
        user.did,
        "bad base document",
        user.thumbprint,
        user.wallet.signingKey.publicKey,
        true,
        now,
        now + 3600,
      );
      await tx.wait();

      let response = await request(server).get(`/identifiers/${user.did}`);

      expect(response.body).toStrictEqual({
        detail: `Identifier ${user.did} contains an invalid base document. Unexpected token 'b', "bad base document" is not valid JSON`,
        status: 400,
        title: "Bad Request",
        type: "about:blank",
      });
      expect(response.status).toBe(400);

      user = await createUser();
      tx = await testEnv.didRegistryContract.insertDidDocument(
        user.did,
        JSON.stringify(user.didDocument["@context"]),
        user.thumbprint,
        user.wallet.signingKey.publicKey,
        true,
        now,
        now + 3600,
      );
      await tx.wait();

      tx = await testEnv.didRegistryContract.addVerificationMethod(
        user.did,
        "method2",
        "0xff", // bad public key
        false,
      );
      await tx.wait();

      tx = await testEnv.didRegistryContract.addVerificationRelationship(
        user.did,
        "assertionMethod",
        "method2",
        now,
        now + 3600,
      );
      await tx.wait();

      response = await request(server).get(`/identifiers/${user.did}`);

      expect(response.body).toStrictEqual({
        detail: expect.stringContaining(
          `Identifier ${user.did} contains an invalid public key in a verification method. Unexpected token`,
        ),
        status: 400,
        title: "Bad Request",
        type: "about:blank",
      });
      expect(response.status).toBe(400);
    });
  });

  describe("POST /identifiers/{did}/actions", () => {
    it("should perform the action checkController", async () => {
      expect.assertions(4);

      const { did, wallet } = users[0]!;
      let response = await request(server)
        .post(`/identifiers/${did}/actions`)
        .send({
          id: 123,
          jsonrpc: "2.0",
          method: "checkController",
          params: [wallet.address],
        });

      expect(response.body).toStrictEqual({
        id: 123,
        jsonrpc: "2.0",
        result: true,
      });
      expect(response.status).toBe(200);

      const randomAddress = ethers.Wallet.createRandom().address;
      response = await request(server)
        .post(`/identifiers/${did}/actions`)
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

    it("should throw an error for bad use of actions", async () => {
      const randomAddress = ethers.Wallet.createRandom().address;
      const { did } = users[0]!;

      let response = await request(server)
        .post(`/identifiers/bad-did/actions`)
        .send({
          jsonrpc: "2.0",
          method: "checkController",
          params: [randomAddress],
        });

      expect(response.body).toStrictEqual({
        detail: `["did must be a valid DID v1"]`,
        status: 400,
        title: "Bad Request",
        type: "about:blank",
      });
      expect(response.status).toBe(400);

      // Request without payload
      response = await request(server)
        .post(`/identifiers/${did}/actions`)
        .send();

      expect(response.body).toStrictEqual({
        error: {
          code: -32_600,
          message: "JSON-RPC payload must be an object",
        },
        // eslint-disable-next-line unicorn/no-null
        id: null,
        jsonrpc: "2.0",
      });
      expect(response.status).toBe(400);

      response = await request(server)
        .post(`/identifiers/${did}/actions`)
        .send({
          jsonrpc: "2.0",
          method: "bad method",
          params: [randomAddress],
        });

      expect(response.body).toStrictEqual({
        error: {
          code: -32_600,
          message: "The method 'bad method' is invalid",
        },
        // eslint-disable-next-line unicorn/no-null
        id: null,
        jsonrpc: "2.0",
      });
      expect(response.status).toBe(400);

      response = await request(server)
        .post(`/identifiers/${did}/actions`)
        .send({
          jsonrpc: "2.0",
          method: "checkController",
          params: ["bad address"],
        });

      expect(response.body).toStrictEqual({
        error: {
          code: -32_600,
          message: "Invalid 'params.0': Invalid Ethereum address",
        },
        // eslint-disable-next-line unicorn/no-null
        id: null,
        jsonrpc: "2.0",
      });
      expect(response.status).toBe(400);

      const randomDid = EbsiWallet.createDid();
      response = await request(server)
        .post(`/identifiers/${randomDid}/actions`)
        .send({
          jsonrpc: "2.0",
          method: "checkController",
          params: [randomAddress],
        });

      expect(response.body).toStrictEqual({
        error: {
          code: -32_600,
          message: "did doesn't exist",
        },
        // eslint-disable-next-line unicorn/no-null
        id: null,
        jsonrpc: "2.0",
      });
      expect(response.status).toBe(400);
    });
  });
});
