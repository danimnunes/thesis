/* eslint-disable unicorn/no-null */
import type { RawBodyRequest } from "@nestjs/common";
import type { JsonRpcPayload } from "ethers";
import type { FastifyRequest } from "fastify";

import {
  BesuService as AbstractBesuService,
  encode,
  getErrorMessage,
  InternalServerError,
  logAxiosError,
} from "@ebsiint-api/shared";
import { getResolver as getKeyDidResolver } from "@europeum-ebsi/key-did-resolver";
import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import axios, { isAxiosError } from "axios";
import { Resolver } from "did-resolver";
import { ethers } from "ethers";

import type { ApiConfig } from "../../config/configuration.ts";
import type {
  BesuJsonRpcError,
  BesuResponse,
  BesuServiceResponse,
} from "./besu.interface.ts";
import type { BesuJsonRpcRequestPayload } from "./validators/besu-json-rpc-request-payload.ts";

import { AuthService } from "../auth/auth.service.ts";
import { besuJsonRpcRequestPayload } from "./validators/besu-json-rpc-request-payload.ts";

class JsonRpcError extends Error {
  private readonly code: number;

  private readonly id: null | number | string;

  constructor(
    message: string,
    code: number,
    id: null | number | string,
    options?: ErrorOptions,
  ) {
    super(message, { ...(!!options?.cause && { cause: options.cause }) });
    this.name = "JsonRpcError";
    this.code = code;
    this.id = id ?? null;
  }

  toJSON() {
    return {
      error: {
        code: this.code,
        message: this.message,
      },
      id: this.id,
      jsonrpc: "2.0",
    } satisfies BesuJsonRpcError;
  }
}

const PUBLIC_BESU_METHODS = new Set([
  "eth_blockNumber",
  "eth_call",
  "eth_chainId",
  "eth_estimateGas",
  "eth_getBlockByHash",
  "eth_getBlockByNumber",
  "eth_getBlockReceipts",
  "eth_getBlockTransactionCountByHash",
  "eth_getBlockTransactionCountByNumber",
  "eth_getCode",
  "eth_getLogs",
  "eth_getTransactionByBlockHashAndIndex",
  "eth_getTransactionByBlockNumberAndIndex",
  "eth_getTransactionByHash",
  "eth_getTransactionCount",
  "eth_getTransactionReceipt",
  "eth_getUncleByBlockHashAndIndex",
  "eth_getUncleByBlockNumberAndIndex",
  "eth_getUncleCountByBlockHash",
  "eth_getUncleCountByBlockNumber",
  "net_version",
  // Not allowed:
  // "eth_sendRawTransaction",
]);

const PROTECTED_METHODS = new Set(["eth_sendRawTransaction"]);

@Injectable()
export class BesuService extends AbstractBesuService {
  private readonly authService: AuthService;

  private readonly didRegistry: string;

  private readonly proxyFactoryAddress: string;

  private readonly timeout: number;

  private readonly trustedPoliciesRegistry: string;

  constructor(
    configService: ConfigService<ApiConfig, true>,
    authService: AuthService,
  ) {
    const logger = new Logger(BesuService.name);

    const url = configService.get("besuRpcNode", { infer: true });
    const requestTimeout = configService.get("requestTimeout", { infer: true });

    super(url, requestTimeout, logger);

    this.authService = authService;
    this.didRegistry = configService.get("didRegistryApiUrl", { infer: true });
    this.proxyFactoryAddress = configService.get("proxyFactoryAddress", {
      infer: true,
    });
    this.timeout = requestTimeout;
    this.trustedPoliciesRegistry = configService.get(
      "trustedPoliciesRegistryApiUrl",
      { infer: true },
    );
  }

  async sendToBesu(
    rawBody: RawBodyRequest<FastifyRequest>["rawBody"],
    headers: RawBodyRequest<FastifyRequest>["headers"],
    reqId: string,
  ): Promise<BesuServiceResponse> {
    if (!rawBody) {
      const error = new JsonRpcError("Parse error", -32_700, null);

      this.logger.error(error);

      return {
        data: error.toJSON(),
        status: 400,
      };
    }

    let body: unknown;

    try {
      body = JSON.parse(rawBody.toString());
    } catch (parseError) {
      const error = new JsonRpcError("Parse error", -32_700, null, {
        cause: parseError,
      });

      this.logger.error(error);

      return {
        data: error.toJSON(),
        status: 400,
      };
    }

    // Batch requests
    if (Array.isArray(body)) {
      // The default number of allowed requests in a RPC batch request is 1024
      // https://besu.hyperledger.org/public-networks/how-to/use-besu-api/json-rpc
      if (body.length > 1024) {
        // EXCEEDS_RPC_MAX_BATCH_SIZE
        // https://github.com/hyperledger/besu/blob/4b8d93587eeb22f8cfd9c63f2210336f5e296211/ethereum/api/src/main/java/org/hyperledger/besu/ethereum/api/jsonrpc/internal/response/RpcErrorType.java#L156C31-L156C36
        const error = new JsonRpcError(
          "Number of requests exceeds max batch size",
          -32_005,
          null,
        );

        this.logger.error(error);

        return {
          data: error.toJSON(),
          status: 200,
        };
      }

      return {
        data: await this.handleBatchRequest(body, headers, reqId),
        status: 200,
      };
    }

    // Single request
    return {
      data: await this.handleSingleRequest(body, headers, reqId),
      status: 200,
    };
  }

  private async handleBatchRequest(
    requests: unknown[],
    headers: RawBodyRequest<FastifyRequest>["headers"],
    reqId: string,
  ): Promise<BesuResponse[]> {
    const responses: BesuResponse[] = [];

    // Process requests sequentially because ethers.js' SocketProvider doesn't support batches
    for (const request of requests) {
      responses.push(await this.handleSingleRequest(request, headers, reqId));
    }

    return responses.filter(Boolean);
  }

  private async handleSingleRequest(
    request: unknown,
    headers: RawBodyRequest<FastifyRequest>["headers"],
    reqId: string,
  ): Promise<BesuResponse> {
    const payload = await this.validatePayload(request, headers, reqId);

    // Ignore notifications
    if (!payload) {
      return undefined;
    }

    if (payload instanceof JsonRpcError) {
      return payload.toJSON();
    }

    return this.processRequest(payload);
  }

  private async processRequest(
    payload: BesuJsonRpcRequestPayload,
  ): Promise<BesuResponse> {
    const provider = this.getProvider();

    // Send payload to Besu
    let response;
    try {
      response = await provider._send(payload as JsonRpcPayload);
    } catch (requestError) {
      const error = new JsonRpcError("Internal error", -32_603, payload.id, {
        cause: requestError,
      });

      this.logger.error("An error occurred while querying Besu");
      this.logger.error(error);

      return error.toJSON();
    }

    if (!Array.isArray(response) || response.length !== 1 || !response[0]) {
      this.logger.error("Unsupported response from Besu");
      this.logger.error(response);

      const error = new JsonRpcError("Internal error", -32_603, payload.id);

      return error.toJSON();
    }

    return {
      jsonrpc: "2.0",
      ...response[0],
    };
  }

  private async validatePayload(
    payload: unknown,
    headers: RawBodyRequest<FastifyRequest>["headers"],
    reqId: string,
  ): Promise<BesuJsonRpcRequestPayload | JsonRpcError | undefined> {
    if (!payload || typeof payload !== "object") {
      // https://github.com/ethereum/execution-apis/blob/main/src/engine/common.md#errors
      // -32600 - Invalid Request - The JSON sent is not a valid Request object.
      return new JsonRpcError("Invalid Request", -32_600, null);
    }

    if (!("id" in payload)) {
      // // Notifications aren't handled
      // See https://github.com/hyperledger/besu/blob/169acc7ed262d55e268f7a022118d096d9d0eaba/ethereum/api/src/main/java/org/hyperledger/besu/ethereum/api/jsonrpc/JsonRpcHttpService.java#L705C9-L705C40
      return undefined;
    }

    const parsedBody = besuJsonRpcRequestPayload.safeParse(payload);

    if (!parsedBody.success) {
      // https://github.com/ethereum/execution-apis/blob/main/src/engine/common.md#errors
      // -32600 - Invalid Request - The JSON sent is not a valid Request object.
      return new JsonRpcError(
        getErrorMessage(parsedBody.error, "Invalid Request"),
        -32_600,
        typeof payload.id === "string" || typeof payload.id === "number"
          ? payload.id
          : null,
      );
    }

    const query = parsedBody.data;

    if (PROTECTED_METHODS.has(query.method)) {
      // query.method is eth_sendRawTransaction
      if (typeof query.params?.[0] !== "string") {
        return new JsonRpcError(
          `The method ${query.method} requires a raw transaction.`,
          -32_600,
          query.id,
        );
      }

      let tx: ethers.Transaction;

      try {
        tx = ethers.Transaction.from(query.params[0]);
      } catch (error) {
        this.logger.error(error);

        return new JsonRpcError(`Invalid raw transaction`, -32_600, query.id);
      }

      if (!tx.from) {
        return new JsonRpcError(
          `The method ${query.method} requires a send address (from).`,
          -32_600,
          query.id,
        );
      }

      if (!tx.to) {
        return new JsonRpcError(
          `The method ${query.method} requires a contract address (to).`,
          -32_600,
          query.id,
        );
      }

      // 1. If it's a proxy deployment, check if the deployer is allowed to deploy contracts (no bearer token required)
      //   a/ check if the "to" field is set to the proxy factory
      //   b/ check if the deployer has the correct policy in the TPR
      if (tx.to === this.proxyFactoryAddress) {
        try {
          await axios.get(
            `${this.trustedPoliciesRegistry}/subjects/${tx.from}/policies/${encodeURIComponent("TCR:deployProxy")}`,
            {
              headers: { "x-request-id": reqId },
              timeout: this.timeout,
            },
          );
        } catch (error) {
          if (isAxiosError(error)) {
            logAxiosError(error, this.logger);

            if (error.status === 404) {
              return new JsonRpcError(
                `Address ${tx.from} is not allowed to deploy proxies.`,
                -32_600,
                query.id,
              );
            }
          } else {
            this.logger.error(error);
          }

          return new JsonRpcError("Internal error", -32_603, query.id);
        }

        return query;
      }

      // 2. If it's a contract call, check if the caller is allowed to call the contract
      const accessToken = headers.authorization?.replace("Bearer ", "");

      if (!accessToken) {
        return new JsonRpcError(
          `The method ${query.method} requires an access token.`,
          -32_600,
          query.id,
        );
      }

      let validatedToken: Awaited<
        ReturnType<typeof this.authService.validateToken>
      >;

      try {
        validatedToken = await this.authService.validateToken(
          accessToken,
          reqId,
        );
      } catch (error) {
        this.logger.error(error);

        if (error instanceof InternalServerError) {
          return new JsonRpcError("Internal error", -32_603, query.id);
        }

        return new JsonRpcError(
          error instanceof Error && error.message
            ? error.message
            : `The method ${query.method} requires a valid access token.`,
          -32_600,
          query.id,
        );
      }

      const { authorization_details, sub } = validatedToken;

      if (!authorization_details.addresses.includes(tx.to)) {
        return new JsonRpcError(
          `Access to the contract ${tx.to} is not allowed.`,
          -32_600,
          query.id,
        );
      }

      if (sub.startsWith("did:key:")) {
        // If sub DID uses the did:key method, derive public key and check if it matches the transaction signer
        const didResolver = new Resolver(getKeyDidResolver());
        const result = await didResolver.resolve(sub);
        const publicKeyJwk =
          result.didDocument?.verificationMethod![0]?.publicKeyJwk;

        if (!publicKeyJwk) {
          return new JsonRpcError(
            `DID ${sub} can't be resolved`,
            -32_600,
            query.id,
          );
        }

        if (publicKeyJwk.crv !== "secp256k1") {
          return new JsonRpcError(
            `The DID ${sub} must use secp256k1 curve. Received: ${publicKeyJwk.crv}`,
            -32_600,
            query.id,
          );
        }

        // Derive ethereum address
        const publicKeyHex = encode.publicKey.fromJWKToHex(publicKeyJwk);

        const address = ethers.computeAddress(`0x${publicKeyHex}`);

        if (address.toLowerCase() !== tx.from.toLowerCase()) {
          return new JsonRpcError(
            `The transaction signer ${tx.from} is not allowed to call the contract ${tx.to}.`,
            -32_600,
            query.id,
          );
        }
      } else if (sub.startsWith("did:ebsi:")) {
        // If sub DID uses the did:ebsi method, check if the signer controls the DID document
        let data: {
          error?: { message: string };
          result: boolean;
        };

        try {
          const response = await axios.post<{
            error?: { message: string };
            result: boolean;
          }>(
            `${this.didRegistry}/identifiers/${sub}/actions`,
            {
              jsonrpc: "2.0",
              method: "checkController",
              params: [tx.from],
            },
            {
              headers: { "x-request-id": reqId },
              timeout: this.timeout,
              validateStatus: (s) => s >= 200 && s <= 400,
            },
          );
          data = response.data;
        } catch (error) {
          if (isAxiosError(error)) {
            logAxiosError(error, this.logger);
          } else {
            this.logger.error(error);
          }
          return new JsonRpcError("Internal error", -32_603, query.id);
        }

        if (data.error) {
          return new JsonRpcError(
            `The DID ${sub} does not exist`,
            -32_600,
            query.id,
          );
        }

        if (!data.result) {
          return new JsonRpcError(
            `The DID ${sub} is not controlled by the address ${tx.from}`,
            -32_600,
            query.id,
          );
        }
      } else {
        return new JsonRpcError(
          `Invalid access token: sub ${sub} is not valid`,
          -32_600,
          query.id,
        );
      }

      return query;
    }

    if (!PUBLIC_BESU_METHODS.has(query.method)) {
      // https://github.com/ethereum/execution-apis/blob/main/src/engine/common.md#errors
      // -32601 - Method not found - The method does not exist / is not available.
      return new JsonRpcError(
        `The method ${query.method} does not exist / is not available.`,
        -32_601,
        query.id,
      );
    }

    return query;
  }
}
