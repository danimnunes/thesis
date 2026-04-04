import type { EbsiIssuer } from "@europeum-ebsi/verifiable-credential";

import { encode, getSigner, waitToBeMined } from "@ebsiint-api/shared";
import { hexToBytes } from "@europeum-ebsi/did-jwt";
import { util } from "@europeum-ebsi/key-did-resolver";
import { ConfigService } from "@nestjs/config";
import { ethers } from "ethers";
import { randomBytes } from "node:crypto";
import request from "supertest";
import { expect, it } from "vitest";

import type { ApiConfig } from "../../src/config/configuration.ts";
import type {
  Document,
  DocumentAccesses,
  Event,
} from "../../src/modules/documents/documents.interface.ts";
import type { JsonRpcResponseObject } from "../../src/modules/jsonrpc/jsonrpc.interface.ts";
import type {
  AuthoriseDidSchema,
  CreateDocumentSchema,
  GrantAccessSchema,
  RemoveDocumentSchema,
  RevokeAccessSchema,
  UnsignedTransaction,
  WriteEventSchema,
} from "../../src/modules/jsonrpc/validators/index.ts";

import { AppModule } from "../../src/app.module.ts";
import { formatEthersUnsignedTransaction } from "../../src/modules/jsonrpc/jsonrpc.utils.ts";
import { AccountType, Permission } from "../../src/shared/constants.ts";
import { didToHex } from "../../src/shared/utils.ts";
import { getNestFastifyApplication } from "../utils/app.ts";
import { describeWriteOps } from "../utils/describeWriteOps.ts";
import { getAccessToken } from "../utils/getAccessToken.ts";
import { getServer } from "../utils/getServer.ts";

interface Actor {
  info: EbsiIssuer;
  wallet: ethers.BaseWallet;
}

interface SupertestJsonRpcResponse {
  body: JsonRpcResponseObject;
  status: number;
}

describeWriteOps()("Track and Trace - User Journey (e2e)", () => {
  it("should support a complete user journey", async () => {
    const app = await getNestFastifyApplication({
      imports: [AppModule],
    });

    const configService =
      app.get<ConfigService<ApiConfig, true>>(ConfigService);

    if (process.env.TEST_ENV !== "remote") {
      await app.init();
      const fastifyInstance = app.getHttpAdapter().getInstance();
      await fastifyInstance.ready();
    }

    const server = getServer(app, configService);

    const ledgerApi = `${configService.get("ledgerApiUrl", { infer: true })}/blockchains/besu`;

    // Prepare the different actors

    // Authoriser (existing user with a VC to onboard)
    const authoriserKid = configService.get("testAuthorisedLegalEntityKid", {
      infer: true,
    });

    if (!authoriserKid) {
      throw new Error("TEST_AUTHORISED_LEGAL_ENTITY_KID must be defined");
    }

    const authoriserDid = authoriserKid.split("#")[0]!;
    const authoriserPrivateKeyHex = configService.get(
      "testAuthorisedLegalEntityPrivateKey",
      {
        infer: true,
      },
    );

    if (!authoriserPrivateKeyHex) {
      throw new Error(
        "TEST_AUTHORISED_LEGAL_ENTITY_PRIVATE_KEY must be defined",
      );
    }

    const authoriserPrivateKey = hexToBytes(authoriserPrivateKeyHex);
    const vcOnboard = configService.get(
      "testAuthorisedLegalEntityVcToOnboard",
      {
        infer: true,
      },
    );

    if (!vcOnboard) {
      throw new Error(
        "TEST_AUTHORISED_LEGAL_ENTITY_VC_TO_ONBOARD must be defined",
      );
    }

    const authoriser = {
      info: {
        alg: "ES256K",
        did: authoriserDid,
        kid: authoriserKid,
        signer: getSigner(authoriserPrivateKey, "ES256K"),
      },
      wallet: new ethers.Wallet(authoriserPrivateKeyHex),
    } satisfies Actor;

    // Document and events creator (did:ebsi, already registered in the DIDR)
    const documentCreatorKid = configService.get("testRegularLegalEntityKid", {
      infer: true,
    });

    if (!documentCreatorKid) {
      throw new Error("TEST_REGULAR_LEGAL_ENTITY_KID must be defined");
    }

    const documentCreatorDid = documentCreatorKid.split("#")[0]!;
    const documentCreatorPrivateKeyHex = configService.get(
      "testRegularLegalEntityPrivateKey",
      { infer: true },
    );

    if (!documentCreatorPrivateKeyHex) {
      throw new Error("TEST_REGULAR_LEGAL_ENTITY_PRIVATE_KEY must be defined");
    }

    const documentCreatorPrivateKey = hexToBytes(documentCreatorPrivateKeyHex);

    const documentCreator = {
      info: {
        alg: "ES256K",
        did: documentCreatorDid,
        kid: documentCreatorKid,
        signer: getSigner(documentCreatorPrivateKey, "ES256K"),
      },
      wallet: new ethers.Wallet(documentCreatorPrivateKeyHex),
    } satisfies Actor;

    // Delegate (did:key)
    const didKeyDelegateWallet = ethers.Wallet.createRandom();
    const didKeyDelegatePrivateKey = hexToBytes(
      didKeyDelegateWallet.privateKey,
    );
    const didKeyDelegatePublicKeyJwk = encode.publicKey.fromHexToJWK(
      didKeyDelegateWallet.publicKey,
    );
    const didKeyDelegateDid = util.createDid(didKeyDelegatePublicKeyJwk);
    const didKeyDelegateFragmentIdentifier = didKeyDelegateDid.replace(
      "did:key:",
      "",
    );
    const didKeyDelegateKid = `${didKeyDelegateDid}#${didKeyDelegateFragmentIdentifier}`;

    const didKeyDelegate = {
      info: {
        alg: "ES256K",
        did: didKeyDelegateDid,
        kid: didKeyDelegateKid,
        signer: getSigner(didKeyDelegatePrivateKey, "ES256K"),
      },
      wallet: didKeyDelegateWallet,
    } satisfies Actor;

    // Events creator (did:key)
    const didKeyEventsCreatorWallet = ethers.Wallet.createRandom();
    const didKeyEventsCreatorPrivateKey = hexToBytes(
      didKeyEventsCreatorWallet.privateKey,
    );
    const didKeyEventsCreatorPublicKeyJwk = encode.publicKey.fromHexToJWK(
      didKeyEventsCreatorWallet.publicKey,
    );
    const didKeyEventsCreatorDid = util.createDid(
      didKeyEventsCreatorPublicKeyJwk,
    );
    const didKeyEventsCreatorFragmentIdentifier =
      didKeyEventsCreatorDid.replace("did:key:", "");
    const didKeyEventsCreatorKid = `${didKeyEventsCreatorDid}#${didKeyEventsCreatorFragmentIdentifier}`;

    const didKeyEventsCreator = {
      info: {
        alg: "ES256K",
        did: didKeyEventsCreatorDid,
        kid: didKeyEventsCreatorKid,
        signer: getSigner(didKeyEventsCreatorPrivateKey, "ES256K"),
      },
      wallet: didKeyEventsCreatorWallet,
    } satisfies Actor;

    // Helper functions to avoid code repetition
    async function buildTransaction({
      accessToken,
      method,
      params,
    }: {
      accessToken: string;
      method: string;
      params: unknown[];
    }) {
      const responseBuild: SupertestJsonRpcResponse = await request(server)
        .post("/jsonrpc")
        .auth(accessToken, { type: "bearer" })
        .send({ id: 231, jsonrpc: "2.0", method, params });

      return responseBuild;
    }

    async function signAndSendTransaction({
      accessToken,
      signer,
      unsignedTransaction,
    }: {
      accessToken: string;
      signer: ethers.BaseWallet;
      unsignedTransaction: unknown;
    }) {
      const uTx = formatEthersUnsignedTransaction(
        unsignedTransaction as UnsignedTransaction,
      );

      const sgnTx = await signer.signTransaction(uTx);
      const signature = ethers.Transaction.from(sgnTx).signature;
      if (!signature) {
        throw new Error("Signature not found");
      }
      const { r, s, v } = signature;

      const responseSend: SupertestJsonRpcResponse = await request(server)
        .post("/jsonrpc")
        .auth(accessToken, { type: "bearer" })
        .send({
          id: "45",
          jsonrpc: "2.0",
          method: "sendSignedTransaction",
          params: [
            {
              protocol: "eth",
              r,
              s,
              signedRawTransaction: sgnTx,
              unsignedTransaction,
              v: `0x${v.toString(16)}`,
            },
          ],
        });

      return responseSend;
    }

    const ebsiEnvConfig = configService.get("ebsiEnvConfig", {
      infer: true,
    });

    // "authoriser" allows "documentCreator" to create documents

    // Pre-requisites: "authoriser" has obtained a VC from an allowlisted entity and can get an access token with "tnt_authorise" scope
    const authoriserAccessToken = await getAccessToken(
      configService.get("authorisationApiUrl", { infer: true }),
      authoriser.info,
      "openid tnt_authorise",
      ebsiEnvConfig,
      vcOnboard,
    );

    let responseBuild = await buildTransaction({
      accessToken: authoriserAccessToken,
      method: "authoriseDid",
      params: [
        {
          authorisedDid: documentCreator.info.did,
          from: authoriser.wallet.address,
          senderDid: authoriser.info.did,
          whiteList: true,
        } satisfies AuthoriseDidSchema,
      ],
    });

    expect(responseBuild.status).toBe(200);

    let responseSend = await signAndSendTransaction({
      accessToken: authoriserAccessToken,
      signer: authoriser.wallet,
      unsignedTransaction: responseBuild.body.result,
    });

    expect(responseSend.status).toBe(200);

    // wait to be mined
    let receipt = await waitToBeMined(
      ledgerApi,
      responseSend.body.result as string,
    );
    expect(receipt.status).toBe("0x1");

    // Check if "documentCreator" is registered as a creator
    let response = await request(server).head(
      `/accesses?creator=${documentCreator.info.did}`,
    );

    expect(response.status).toBe(204);

    // "documentCreator" creates a new document
    const documentCreatorCreateAccessToken = await getAccessToken(
      configService.get("authorisationApiUrl", { infer: true }),
      documentCreator.info,
      "openid tnt_create",
      ebsiEnvConfig,
    );

    const document1 = {
      creator: documentCreator.info.did,
      hash: `0x${randomBytes(32).toString("hex")}`,
      metadata: "test metadata",
      timestamp: {
        datetime: "",
        proof: "",
      },
    };

    responseBuild = await buildTransaction({
      accessToken: documentCreatorCreateAccessToken,
      method: "createDocument",
      params: [
        {
          didEbsiCreator: document1.creator,
          documentHash: document1.hash,
          documentMetadata: document1.metadata,
          from: documentCreator.wallet.address,
        } satisfies CreateDocumentSchema,
      ],
    });

    expect(responseBuild.status).toBe(200);

    responseSend = await signAndSendTransaction({
      accessToken: documentCreatorCreateAccessToken,
      signer: documentCreator.wallet,
      unsignedTransaction: responseBuild.body.result,
    });

    expect(responseSend.status).toBe(200);

    // Wait for tx to be included in a block
    receipt = await waitToBeMined(
      ledgerApi,
      responseSend.body.result as string,
    );
    expect(receipt.status).toBe("0x1");

    // Get block containing the transaction
    const provider = new ethers.JsonRpcProvider(ledgerApi, undefined, {
      staticNetwork: true, // Do not request chain ID on requests to validate the underlying chain has not changed
    });
    let block = await provider.getBlock(receipt.blockHash);

    if (!block) {
      throw new Error("Block not found");
    }

    // Extract datetime and proof from block
    document1.timestamp.datetime = `0x${block.timestamp.toString(16)}`;
    document1.timestamp.proof = `0x${block.number.toString(16).padStart(64, "0")}`;

    // Check document
    response = await request(server).get(`/documents/${document1.hash}`);

    expect(response.body).toStrictEqual({
      creator: document1.creator,
      metadata: document1.metadata,
      timestamp: {
        datetime: document1.timestamp.datetime,
        proof: document1.timestamp.proof,
        source: "block",
      },
    } satisfies Document);

    // "documentCreator" adds a new event to the document
    const documentCreatorWriteAccessToken = await getAccessToken(
      configService.get("authorisationApiUrl", { infer: true }),
      documentCreator.info,
      "openid tnt_write",
      ebsiEnvConfig,
    );

    const document1Event1 = {
      externalHash: `0x${randomBytes(32).toString("hex")}`,
      hash: "",
      metadata: "test event metadata",
      origin: "",
      sender: documentCreator.info.did,
      timestamp: {
        datetime: "",
        proof: "",
      },
    };

    responseBuild = await buildTransaction({
      accessToken: documentCreatorWriteAccessToken,
      method: "writeEvent",
      params: [
        {
          eventParams: {
            documentHash: document1.hash,
            externalHash: document1Event1.externalHash,
            metadata: document1Event1.metadata,
            origin: document1Event1.origin,
            sender: await didToHex(document1Event1.sender),
          },
          from: documentCreator.wallet.address,
        } satisfies WriteEventSchema,
      ],
    });

    expect(responseBuild.status).toBe(200);

    responseSend = await signAndSendTransaction({
      accessToken: documentCreatorWriteAccessToken,
      signer: documentCreator.wallet,
      unsignedTransaction: responseBuild.body.result,
    });

    expect(responseSend.status).toBe(200);

    // Wait for tx to be included in a block
    receipt = await waitToBeMined(
      ledgerApi,
      responseSend.body.result as string,
    );
    expect(receipt.status).toBe("0x1");

    // Get block containing the transaction
    block = await provider.getBlock(receipt.blockHash);

    if (!block) {
      throw new Error("Block not found");
    }

    // Extract datetime and proof from block
    document1Event1.timestamp.datetime = `0x${block.timestamp.toString(16)}`;
    document1Event1.timestamp.proof = `0x${block.number.toString(16).padStart(64, "0")}`;

    // Event hash is `keccak256(bytes(eventParams.externalHash))`
    document1Event1.hash = ethers.keccak256(
      Buffer.from(document1Event1.externalHash, "utf8"), // Note: externalHash is treated as an UTF-8 string
    );

    // Check document
    response = await request(server).get(`/documents/${document1.hash}`);

    expect(response.body).toStrictEqual({
      creator: document1.creator,
      metadata: document1.metadata,
      timestamp: {
        datetime: document1.timestamp.datetime,
        proof: document1.timestamp.proof,
        source: "block",
      },
    } satisfies Document);

    // Check event
    response = await request(server).get(
      `/documents/${document1.hash}/events/${document1Event1.hash}`,
    );

    expect(response.body).toStrictEqual({
      externalHash: document1Event1.externalHash,
      hash: document1Event1.hash,
      metadata: document1Event1.metadata,
      origin: document1Event1.origin,
      sender: document1Event1.sender,
      timestamp: {
        datetime: document1Event1.timestamp.datetime,
        proof: document1Event1.timestamp.proof,
        source: "block",
      },
    } satisfies Event);

    // "documentCreator" grants "delegate" permission to "didKeyDelegate" for the document
    responseBuild = await buildTransaction({
      accessToken: documentCreatorWriteAccessToken,
      method: "grantAccess",
      params: [
        {
          documentHash: document1.hash,
          from: documentCreator.wallet.address,
          grantedByAccount: await didToHex(documentCreator.info.did),
          grantedByAccType: AccountType.DID_EBSI,
          permission: Permission.DELEGATE,
          subjectAccount: await didToHex(didKeyDelegate.info.did),
          subjectAccType: AccountType.DID_KEY,
        } satisfies GrantAccessSchema,
      ],
    });

    expect(responseBuild.status).toBe(200);

    responseSend = await signAndSendTransaction({
      accessToken: documentCreatorWriteAccessToken,
      signer: documentCreator.wallet,
      unsignedTransaction: responseBuild.body.result,
    });

    expect(responseSend.status).toBe(200);

    // Wait for tx to be included in a block
    receipt = await waitToBeMined(
      ledgerApi,
      responseSend.body.result as string,
    );
    expect(receipt.status).toBe("0x1");

    // Check access
    response = await request(server).get(
      `/documents/${document1.hash}/accesses`,
    );

    expect(response.body).toStrictEqual({
      items: [
        {
          documentId: document1.hash,
          grantedBy: documentCreator.info.did,
          permission: "creator",
          subject: documentCreator.info.did,
        },
        {
          documentId: document1.hash,
          grantedBy: documentCreator.info.did,
          permission: "delegate",
          subject: didKeyDelegate.info.did,
        },
      ] satisfies DocumentAccesses,
      links: {
        first: expect.stringContaining(
          `/documents/${document1.hash}/accesses?page[after]=1&page[size]=10`,
        ),
        last: expect.stringContaining(
          `/documents/${document1.hash}/accesses?page[after]=1&page[size]=10`,
        ),
        next: expect.stringContaining(
          `/documents/${document1.hash}/accesses?page[after]=1&page[size]=10`,
        ),
        prev: expect.stringContaining(
          `/documents/${document1.hash}/accesses?page[after]=1&page[size]=10`,
        ),
      },
      pageSize: 10,
      self: expect.stringContaining(
        `/documents/${document1.hash}/accesses?page[after]=1&page[size]=10`,
      ),
      total: 2,
    });

    // "didKeyDelegate" grants "write" permission to "didKeyEventsCreator" for the document
    const didKeyDelegateWriteAccessToken = await getAccessToken(
      configService.get("authorisationApiUrl", { infer: true }),
      didKeyDelegate.info,
      "openid tnt_write",
      ebsiEnvConfig,
    );

    responseBuild = await buildTransaction({
      accessToken: didKeyDelegateWriteAccessToken,
      method: "grantAccess",
      params: [
        {
          documentHash: document1.hash,
          from: didKeyDelegate.wallet.address,
          grantedByAccount: await didToHex(didKeyDelegate.info.did),
          grantedByAccType: AccountType.DID_KEY,
          permission: Permission.WRITE,
          subjectAccount: await didToHex(didKeyEventsCreator.info.did),
          subjectAccType: AccountType.DID_KEY,
        } satisfies GrantAccessSchema,
      ],
    });

    expect(responseBuild.status).toBe(200);

    responseSend = await signAndSendTransaction({
      accessToken: didKeyDelegateWriteAccessToken,
      signer: didKeyDelegate.wallet,
      unsignedTransaction: responseBuild.body.result,
    });

    expect(responseSend.status).toBe(200);

    // Wait for tx to be included in a block
    receipt = await waitToBeMined(
      ledgerApi,
      responseSend.body.result as string,
    );
    expect(receipt.status).toBe("0x1");

    // Check access
    response = await request(server).get(
      `/documents/${document1.hash}/accesses`,
    );

    expect(response.body).toStrictEqual({
      items: [
        {
          documentId: document1.hash,
          grantedBy: documentCreator.info.did,
          permission: "creator",
          subject: documentCreator.info.did,
        },
        {
          documentId: document1.hash,
          grantedBy: documentCreator.info.did,
          permission: "delegate",
          subject: didKeyDelegate.info.did,
        },
        {
          documentId: document1.hash,
          grantedBy: didKeyDelegate.info.did,
          permission: "write",
          subject: didKeyEventsCreator.info.did,
        },
      ] satisfies DocumentAccesses,
      links: {
        first: expect.stringContaining(
          `/documents/${document1.hash}/accesses?page[after]=1&page[size]=10`,
        ),
        last: expect.stringContaining(
          `/documents/${document1.hash}/accesses?page[after]=1&page[size]=10`,
        ),
        next: expect.stringContaining(
          `/documents/${document1.hash}/accesses?page[after]=1&page[size]=10`,
        ),
        prev: expect.stringContaining(
          `/documents/${document1.hash}/accesses?page[after]=1&page[size]=10`,
        ),
      },
      pageSize: 10,
      self: expect.stringContaining(
        `/documents/${document1.hash}/accesses?page[after]=1&page[size]=10`,
      ),
      total: 3,
    });

    // "didKeyEventsCreator" adds a new event (external timestamp) to the document
    const didKeyEventsCreatorWriteAccessToken = await getAccessToken(
      configService.get("authorisationApiUrl", { infer: true }),
      didKeyEventsCreator.info,
      "openid tnt_write",
      ebsiEnvConfig,
    );

    const document1Event2 = {
      externalHash: `0x${randomBytes(32).toString("hex")}`,
      hash: "",
      metadata: "test event metadata",
      origin: "",
      sender: didKeyEventsCreator.info.did,
      timestamp: {
        datetime: Math.floor(Date.now() / 1000),
        proof: `0x${randomBytes(32).toString("hex")}`,
      },
    };

    responseBuild = await buildTransaction({
      accessToken: didKeyEventsCreatorWriteAccessToken,
      method: "writeEvent",
      params: [
        {
          eventParams: {
            documentHash: document1.hash,
            externalHash: document1Event2.externalHash,
            metadata: document1Event2.metadata,
            origin: document1Event2.origin,
            sender: await didToHex(document1Event2.sender),
          },
          from: didKeyEventsCreator.wallet.address,
          timestamp: document1Event2.timestamp.datetime,
          timestampProof: document1Event2.timestamp.proof,
        } satisfies WriteEventSchema,
      ],
    });

    expect(responseBuild.status).toBe(200);

    responseSend = await signAndSendTransaction({
      accessToken: didKeyEventsCreatorWriteAccessToken,
      signer: didKeyEventsCreator.wallet,
      unsignedTransaction: responseBuild.body.result,
    });

    expect(responseSend.status).toBe(200);

    // Wait for tx to be included in a block
    receipt = await waitToBeMined(
      ledgerApi,
      responseSend.body.result as string,
    );
    expect(receipt.status).toBe("0x1");

    // Event hash is `keccak256(bytes(eventParams.externalHash))`
    document1Event2.hash = ethers.keccak256(
      Buffer.from(document1Event2.externalHash, "utf8"), // Note: externalHash is treated as an UTF-8 string
    );

    // Check document
    response = await request(server).get(`/documents/${document1.hash}`);

    expect(response.body).toStrictEqual({
      creator: document1.creator,
      metadata: document1.metadata,
      timestamp: {
        datetime: document1.timestamp.datetime,
        proof: document1.timestamp.proof,
        source: "block",
      },
    } satisfies Document);

    // Check event
    response = await request(server).get(
      `/documents/${document1.hash}/events/${document1Event2.hash}`,
    );

    expect(response.body).toStrictEqual({
      externalHash: document1Event2.externalHash,
      hash: document1Event2.hash,
      metadata: document1Event2.metadata,
      origin: document1Event2.origin,
      sender: document1Event2.sender,
      timestamp: {
        datetime: `0x${document1Event2.timestamp.datetime.toString(16)}`,
        proof: document1Event2.timestamp.proof,
        source: "external",
      },
    } satisfies Event);

    // "didKeyDelegate" revokes "write" permission to "didKeyEventsCreator" for the document
    responseBuild = await buildTransaction({
      accessToken: didKeyDelegateWriteAccessToken,
      method: "revokeAccess",
      params: [
        {
          documentHash: document1.hash,
          from: didKeyDelegate.wallet.address,
          permission: Permission.WRITE,
          revokedByAccount: await didToHex(didKeyDelegate.info.did),
          subjectAccount: await didToHex(didKeyEventsCreator.info.did),
        } satisfies RevokeAccessSchema,
      ],
    });

    expect(responseBuild.status).toBe(200);

    responseSend = await signAndSendTransaction({
      accessToken: didKeyDelegateWriteAccessToken,
      signer: didKeyDelegate.wallet,
      unsignedTransaction: responseBuild.body.result,
    });

    expect(responseSend.status).toBe(200);

    // Wait for tx to be included in a block
    receipt = await waitToBeMined(
      ledgerApi,
      responseSend.body.result as string,
    );
    expect(receipt.status).toBe("0x1");

    // Check access
    response = await request(server).get(
      `/documents/${document1.hash}/accesses`,
    );

    expect(response.body).toStrictEqual({
      items: [
        {
          documentId: document1.hash,
          grantedBy: documentCreator.info.did,
          permission: "creator",
          subject: documentCreator.info.did,
        },
        {
          documentId: document1.hash,
          grantedBy: documentCreator.info.did,
          permission: "delegate",
          subject: didKeyDelegate.info.did,
        },
      ] satisfies DocumentAccesses,
      links: {
        first: expect.stringContaining(
          `/documents/${document1.hash}/accesses?page[after]=1&page[size]=10`,
        ),
        last: expect.stringContaining(
          `/documents/${document1.hash}/accesses?page[after]=1&page[size]=10`,
        ),
        next: expect.stringContaining(
          `/documents/${document1.hash}/accesses?page[after]=1&page[size]=10`,
        ),
        prev: expect.stringContaining(
          `/documents/${document1.hash}/accesses?page[after]=1&page[size]=10`,
        ),
      },
      pageSize: 10,
      self: expect.stringContaining(
        `/documents/${document1.hash}/accesses?page[after]=1&page[size]=10`,
      ),
      total: 2,
    });

    // "documentCreator" revokes "delegate" permission to "didKeyDelegate" for the document
    responseBuild = await buildTransaction({
      accessToken: documentCreatorWriteAccessToken,
      method: "revokeAccess",
      params: [
        {
          documentHash: document1.hash,
          from: documentCreator.wallet.address,
          permission: Permission.DELEGATE,
          revokedByAccount: await didToHex(documentCreator.info.did),
          subjectAccount: await didToHex(didKeyDelegate.info.did),
        } satisfies RevokeAccessSchema,
      ],
    });

    expect(responseBuild.status).toBe(200);

    responseSend = await signAndSendTransaction({
      accessToken: documentCreatorWriteAccessToken,
      signer: documentCreator.wallet,
      unsignedTransaction: responseBuild.body.result,
    });

    expect(responseSend.status).toBe(200);

    // Wait for tx to be included in a block
    receipt = await waitToBeMined(
      ledgerApi,
      responseSend.body.result as string,
    );
    expect(receipt.status).toBe("0x1");

    // Check access
    response = await request(server).get(
      `/documents/${document1.hash}/accesses`,
    );

    expect(response.body).toStrictEqual({
      items: [
        {
          documentId: document1.hash,
          grantedBy: documentCreator.info.did,
          permission: "creator",
          subject: documentCreator.info.did,
        },
      ] satisfies DocumentAccesses,
      links: {
        first: expect.stringContaining(
          `/documents/${document1.hash}/accesses?page[after]=1&page[size]=10`,
        ),
        last: expect.stringContaining(
          `/documents/${document1.hash}/accesses?page[after]=1&page[size]=10`,
        ),
        next: expect.stringContaining(
          `/documents/${document1.hash}/accesses?page[after]=1&page[size]=10`,
        ),
        prev: expect.stringContaining(
          `/documents/${document1.hash}/accesses?page[after]=1&page[size]=10`,
        ),
      },
      pageSize: 10,
      self: expect.stringContaining(
        `/documents/${document1.hash}/accesses?page[after]=1&page[size]=10`,
      ),
      total: 1,
    });

    // "documentCreator" removes document1
    responseBuild = await buildTransaction({
      accessToken: documentCreatorWriteAccessToken,
      method: "removeDocument",
      params: [
        {
          documentHash: document1.hash,
          from: documentCreator.wallet.address,
        } satisfies RemoveDocumentSchema,
      ],
    });

    expect(responseBuild.status).toBe(200);

    responseSend = await signAndSendTransaction({
      accessToken: documentCreatorWriteAccessToken,
      signer: documentCreator.wallet,
      unsignedTransaction: responseBuild.body.result,
    });

    expect(responseSend.status).toBe(200);

    // Wait for tx to be included in a block
    receipt = await waitToBeMined(
      ledgerApi,
      responseSend.body.result as string,
    );
    expect(receipt.status).toBe("0x1");

    // Check document
    response = await request(server).get(`/documents/${document1.hash}`);

    expect(response.body).toStrictEqual({
      detail: `Document ${document1.hash} not found`,
      status: 404,
      title: "Document Not Found",
      type: "about:blank",
    });

    // Close server
    await app.close();
  });
});
