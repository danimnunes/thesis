import type { Tir } from "@ebsiint-sc/trusted-issuers-registry-v5";
import type { EbsiEnvConfiguration } from "@europeum-ebsi/verifiable-credential";

import {
  decodeResult,
  getErrorMessage,
  InvalidRequestJsonRpcError,
  isEthersError,
  logAxiosError,
} from "@ebsiint-api/shared";
import { Tir__factory } from "@ebsiint-sc/trusted-issuers-registry-v5";
import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import axios, { isAxiosError } from "axios";
import { ethers } from "ethers";

import type { ApiConfig } from "../../config/configuration.ts";
import type { JsonRpcSchema } from "./validators/JsonRpcSchema.ts";
import type {
  SendSignedTransactionParamsSchema,
  UnsignedTransaction,
} from "./validators/RequestSendSignedTransactionSchema.ts";

import { LedgerService } from "../ledger/ledger.service.ts";
import {
  formatEthersSignature,
  formatEthersUnsignedTransaction,
} from "./jsonrpc.utils.ts";
import {
  createAddIssuerProxySchema,
  createRequestAddIssuerProxySchema,
} from "./validators/RequestAddIssuerProxySchema.ts";
import {
  removeIssuerProxySchema,
  requestRemoveIssuerProxySchema,
} from "./validators/RequestRemoveIssuerProxySchema.ts";
import { requestSendSignedTransactionDtoSchema } from "./validators/RequestSendSignedTransactionSchema.ts";
import {
  requestSetAttributeDataSchema,
  setAttributeDataSchema,
} from "./validators/RequestSetAttributeDataSchema.ts";
import {
  requestSetAttributeMetadataSchema,
  setAttributeMetadataSchema,
} from "./validators/RequestSetAttributeMetadataSchema.ts";
import {
  createRequestUpdateIssuerProxySchema,
  createUpdateIssuerProxySchema,
} from "./validators/RequestUpdateIssuerProxySchema.ts";

function assertDidMatchesSub(did: string, sub: string) {
  if (did !== sub) {
    throw new Error("Access token sub doesn't match the DID from the payload");
  }
}

function assertScopeContains(
  scope: string,
  validScopes: string | string[],
  methodName: string,
) {
  const scopeWithoutOpenid = scope.replace("openid ", "");
  const expectedScopes = Array.isArray(validScopes)
    ? validScopes
    : [validScopes];

  if (!expectedScopes.includes(scopeWithoutOpenid)) {
    throw new Error(
      `'${methodName}' requires an access token with the scope '${expectedScopes.join(
        "' or '",
      )}'`,
    );
  }
}

@Injectable()
export class JsonRpcService {
  private chainId: string | undefined;

  private readonly contract: Tir;

  private readonly contractAddress: string;

  private readonly didRegistryApiUrl: string;

  private readonly ebsiEnvConfig: EbsiEnvConfiguration;

  private readonly ledgerService: LedgerService;

  private readonly logger = new Logger(JsonRpcService.name);

  private readonly timeout: number;

  constructor(
    configService: ConfigService<ApiConfig, true>,
    ledgerService: LedgerService,
  ) {
    this.ledgerService = ledgerService;
    this.didRegistryApiUrl = configService.get("didRegistryApiUrl", {
      infer: true,
    });
    this.contractAddress = configService.get(
      "besuTrustedIssuersRegistryAddress",
      { infer: true },
    );
    this.contract = Tir__factory.connect(this.contractAddress);
    this.timeout = configService.get("requestTimeout", { infer: true });
    this.ebsiEnvConfig = configService.get("ebsiEnvConfig", { infer: true });
  }

  async buildTransaction(
    from: string,
    params: string,
  ): Promise<UnsignedTransaction> {
    const nonceInt = await this.ledgerService
      .getProvider()
      .getTransactionCount(from);

    const unsignedTransaction = {
      chainId: await this.getChainId(),
      data: params,
      from,
      gasLimit: "0x1000000",
      gasPrice: "0x0",
      nonce: `0x${BigInt(nonceInt).toString(16)}`,
      to: this.contractAddress,
      value: "0x0",
    } satisfies UnsignedTransaction;

    let gasEstimation: bigint | string = "unset";

    try {
      gasEstimation = await this.estimateGas(unsignedTransaction);

      // Multiply by 1.4
      unsignedTransaction.gasLimit = `0x${((gasEstimation * 14n) / 10n).toString(16)}`;
    } catch {
      this.logger.warn(
        `Gas could not be estimated.${
          gasEstimation === "unset"
            ? ""
            : `Received ${gasEstimation.toString()}.`
        } Using 0x1000000`,
      );
      unsignedTransaction.gasLimit = "0x1000000";
    }

    return unsignedTransaction;
  }

  async buildTransactionAddIssuerProxy(
    body: JsonRpcSchema,
    id: null | number | string | undefined,
    scope: string,
    reqId: string,
  ): Promise<UnsignedTransaction> {
    const method = "addIssuerProxy";

    try {
      assertScopeContains(scope, "tir_write", method);

      const requestAddIssuerProxySchema = createRequestAddIssuerProxySchema(
        this.ebsiEnvConfig,
        reqId,
        this.timeout,
      );

      const parsedBody = await requestAddIssuerProxySchema.parseAsync(body);

      const { did, from, proxyData } = parsedBody.params[0]!;

      const data = this.contract.interface.encodeFunctionData(method, [
        did,
        proxyData,
      ]);

      return await this.buildTransaction(from, data);
    } catch (error_) {
      const error = new InvalidRequestJsonRpcError(getErrorMessage(error_), id);
      if (error_ instanceof Error && error_.stack) {
        error.stack = error_.stack;
      }
      throw error;
    }
  }

  async buildTransactionRemoveIssuerProxy(
    body: JsonRpcSchema,
    id: null | number | string | undefined,
    scope: string,
  ): Promise<UnsignedTransaction> {
    const method = "removeIssuerProxy";

    try {
      assertScopeContains(scope, "tir_write", method);

      const parsedBody = await requestRemoveIssuerProxySchema.parseAsync(body);

      const { did, from, proxyId } = parsedBody.params[0]!;

      const data = this.contract.interface.encodeFunctionData(method, [
        did,
        proxyId,
      ]);

      return await this.buildTransaction(from, data);
    } catch (error_) {
      const error = new InvalidRequestJsonRpcError(getErrorMessage(error_), id);
      if (error_ instanceof Error && error_.stack) {
        error.stack = error_.stack;
      }
      throw error;
    }
  }

  async buildTransactionSetAttributeData(
    body: JsonRpcSchema,
    id: null | number | string | undefined,
    sub: string,
    scope: string,
  ): Promise<UnsignedTransaction> {
    const method = "setAttributeData";

    const provider = this.ledgerService.getProvider();

    try {
      assertScopeContains(scope, ["tir_invite", "tir_write"], method);

      const parsedBody = await requestSetAttributeDataSchema(
        this.contract
          // @ts-expect-error Error due to CommonJS vs ESM modules imports
          .connect(provider),
      ).parseAsync(body);

      const { attributeData, attributeId, did, from } = parsedBody.params[0]!;

      if (scope.includes("tir_invite")) {
        // Verify that the Access Token sub and the payload DID match
        assertDidMatchesSub(did, sub);
      }

      const data = this.contract.interface.encodeFunctionData(method, [
        did,
        attributeId,
        attributeData,
      ]);

      return await this.buildTransaction(from, data);
    } catch (error_) {
      const error = new InvalidRequestJsonRpcError(getErrorMessage(error_), id);
      if (error_ instanceof Error && error_.stack) {
        error.stack = error_.stack;
      }
      throw error;
    }
  }

  async buildTransactionSetAttributeMetadata(
    body: JsonRpcSchema,
    id: null | number | string | undefined,
    scope: string,
  ): Promise<UnsignedTransaction> {
    const method = "setAttributeMetadata";

    try {
      assertScopeContains(scope, "tir_write", method);

      const parsedBody =
        await requestSetAttributeMetadataSchema.parseAsync(body);

      const { attributeIdTao, did, from, issuerType, revisionId, taoDid } =
        parsedBody.params[0]!;

      const data = this.contract.interface.encodeFunctionData(method, [
        did,
        revisionId,
        issuerType,
        taoDid,
        attributeIdTao,
      ]);

      return await this.buildTransaction(from, data);
    } catch (error_) {
      const error = new InvalidRequestJsonRpcError(getErrorMessage(error_), id);
      if (error_ instanceof Error && error_.stack) {
        error.stack = error_.stack;
      }
      throw error;
    }
  }

  async buildTransactionUpdateIssuerProxy(
    body: JsonRpcSchema,
    id: null | number | string | undefined,
    scope: string,
    reqId: string,
  ): Promise<UnsignedTransaction> {
    const method = "updateIssuerProxy";

    try {
      assertScopeContains(scope, "tir_write", method);

      const requestUpdateIssuerProxySchema =
        createRequestUpdateIssuerProxySchema(
          this.ebsiEnvConfig,
          reqId,
          this.timeout,
        );

      const parsedBody = await requestUpdateIssuerProxySchema.parseAsync(body);

      const { did, from, proxyData, proxyId } = parsedBody.params[0]!;

      const data = this.contract.interface.encodeFunctionData(method, [
        did,
        proxyId,
        proxyData,
      ]);

      return await this.buildTransaction(from, data);
    } catch (error_) {
      const error = new InvalidRequestJsonRpcError(getErrorMessage(error_), id);
      if (error_ instanceof Error && error_.stack) {
        error.stack = error_.stack;
      }
      throw error;
    }
  }

  async estimateGas(transaction: UnsignedTransaction): Promise<bigint> {
    const { data, from, to, value } = transaction;

    const provider = this.ledgerService.getProvider();

    try {
      return await provider.estimateGas({
        data,
        from,
        to,
        value,
      });
    } catch (error) {
      if (isEthersError(error)) {
        this.logger.error(error, error.stack);
      }
      throw new Error(getErrorMessage(error));
    }
  }

  async getChainId(): Promise<string> {
    if (!this.chainId) {
      const provider = this.ledgerService.getProvider();

      try {
        const { chainId } = await provider.getNetwork();
        this.chainId = `0x${BigInt(chainId).toString(16)}`;
      } catch (error) {
        if (isEthersError(error)) {
          this.logger.error(error, error.stack);
        }
        throw new Error(getErrorMessage(error));
      }
    }

    return this.chainId;
  }

  async isDidControlledByAddress(
    did: string,
    controllerAddress: string,
    reqId: string,
  ): Promise<boolean> {
    const { data } = await axios.post<{
      error?: { message: string };
      result: boolean;
    }>(
      `${this.didRegistryApiUrl}/identifiers/${did}/actions`,
      {
        jsonrpc: "2.0",
        method: "checkController",
        params: [controllerAddress],
      },
      {
        headers: { "x-request-id": reqId },
        timeout: this.timeout,
        validateStatus: (s) => s >= 200 && s <= 400,
      },
    );

    if (data.error) {
      throw new Error(`The DID ${did} does not exist`);
    }

    return data.result;
  }

  async sendTransaction(
    sub: string,
    body: JsonRpcSchema,
    id: null | number | string | undefined,
    scope: string,
    reqId: string,
  ): Promise<string> {
    try {
      const chainId = await this.getChainId();

      const parsedBody =
        await requestSendSignedTransactionDtoSchema(chainId).parseAsync(body);

      const request = parsedBody.params[0]!;

      const { signer } = await this.verifyTransaction(
        request,
        sub,
        scope,
        reqId,
      );

      if (!(await this.isDidControlledByAddress(sub, signer, reqId))) {
        throw new Error(
          `The DID ${sub} is not controlled by the address ${signer}`,
        );
      }

      const tx = await this.ledgerService
        .getProvider()
        .broadcastTransaction(request.signedRawTransaction);
      return tx.hash;
    } catch (error_) {
      if (isEthersError(error_)) {
        this.logger.error(error_, error_.stack); // Log the original error with all ethers.js details for internal debugging
        throw new InvalidRequestJsonRpcError(
          error_.error?.message ?? error_.shortMessage,
          id,
          undefined,
          error_.error &&
            "code" in error_.error &&
            typeof error_.error.code === "number"
            ? error_.error.code
            : undefined,
        );
      }

      if (error_ instanceof Error) {
        if (isAxiosError(error_)) {
          logAxiosError(error_, this.logger);
        } else {
          this.logger.error(error_.message, error_.stack);
        }

        const error = new InvalidRequestJsonRpcError(
          getErrorMessage(error_),
          id,
        );

        if (error_.stack) {
          error.stack = error_.stack;
        }

        throw error;
      }

      this.logger.error(error_);
      throw error_;
    }
  }

  async verifyTransaction(
    param: SendSignedTransactionParamsSchema,
    sub: string,
    scope: string,
    reqId: string,
  ): Promise<{ args: unknown; functionName: string; signer: string }> {
    const { r, s, signedRawTransaction, unsignedTransaction, v } = param;

    const unsignedTx = formatEthersUnsignedTransaction(unsignedTransaction);
    const signature = formatEthersSignature(r, s, v);

    // Serialize transaction with and without signature
    const unsignedSerializedTransaction =
      ethers.Transaction.from(unsignedTx).unsignedSerialized;
    const signedSerializedTransaction = ethers.Transaction.from({
      ...unsignedTx,
      signature,
    }).serialized;

    if (signedSerializedTransaction !== signedRawTransaction)
      throw new Error(
        `The unsigned transaction + signature (${signedSerializedTransaction}) does not match with the signedRawTransaction (${signedRawTransaction})`,
      );

    // recover address used to sign
    const digest = ethers.keccak256(unsignedSerializedTransaction);
    const signer = ethers.recoverAddress(digest, signature);

    if (signer.toLowerCase() !== unsignedTransaction.from.toLowerCase())
      throw new Error(
        `The signer of the transaction (${signer}) does not match with unsignedTransaction.from (${unsignedTransaction.from}) `,
      );

    const chainId = await this.getChainId();
    if (unsignedTransaction.chainId !== chainId) {
      throw new Error(
        `Invalid unsignedTransaction.chainId. Expected ${chainId}. Received ${unsignedTransaction.chainId}`,
      );
    }

    if (unsignedTransaction.to !== this.contractAddress) {
      throw new Error(
        `Invalid unsignedTransaction.to. Expected ${this.contractAddress}. Received ${unsignedTransaction.to}`,
      );
    }

    // verify function and parameters encoded in unsignedTransaction.data
    const parsedTransaction =
      this.contract.interface.parseTransaction(unsignedTransaction);

    if (!parsedTransaction) {
      throw new Error("Invalid unsignedTransaction.data");
    }

    const { args, fragment } = parsedTransaction;

    // Extract named args from args (args is a mixed array with named and unnamed values)
    const argsObject = {
      // @ts-expect-error Error due to CommonJS vs ESM modules imports
      ...decodeResult(args),
      from: unsignedTransaction.from,
    };

    switch (fragment.name) {
      case "addIssuerProxy": {
        assertScopeContains(scope, "tir_write", fragment.name);
        const addIssuerProxySchema = createAddIssuerProxySchema(
          this.ebsiEnvConfig,
          reqId,
          this.timeout,
        );
        await addIssuerProxySchema.parseAsync(argsObject);
        break;
      }
      case "removeIssuerProxy": {
        assertScopeContains(scope, "tir_write", fragment.name);
        await removeIssuerProxySchema.parseAsync(argsObject);
        break;
      }
      case "setAttributeData": {
        assertScopeContains(
          scope,
          ["tir_invite", "tir_write"], // One of "tir_invite" or "tir_write"
          fragment.name,
        );
        const provider = this.ledgerService.getProvider();
        const castArgs = await setAttributeDataSchema(
          this.contract
            // @ts-expect-error Error due to CommonJS vs ESM modules imports
            .connect(provider),
        ).parseAsync(argsObject);
        if (scope.includes("tir_invite")) {
          assertDidMatchesSub(castArgs.did, sub);
        }
        break;
      }
      case "setAttributeMetadata": {
        assertScopeContains(scope, "tir_write", fragment.name);
        await setAttributeMetadataSchema.parseAsync(argsObject);
        break;
      }
      case "updateIssuerProxy": {
        assertScopeContains(scope, "tir_write", fragment.name);
        const updateIssuerProxySchema = createUpdateIssuerProxySchema(
          this.ebsiEnvConfig,
          reqId,
          this.timeout,
        );
        await updateIssuerProxySchema.parseAsync(argsObject);
        break;
      }
      default: {
        throw new Error(
          `The function name ${fragment.name} can not be used in this context`,
        );
      }
    }

    return {
      args,
      functionName: fragment.name,
      signer,
    };
  }
}
