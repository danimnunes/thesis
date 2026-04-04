import type { SchemaSCRegistry } from "@ebsiint-sc/trusted-schemas-registry-v3";

import {
  decodeResult,
  getErrorMessage,
  InvalidRequestJsonRpcError,
  isEthersError,
  logAxiosError,
} from "@ebsiint-api/shared";
import { SchemaSCRegistry__factory } from "@ebsiint-sc/trusted-schemas-registry-v3";
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
  insertSchemaSchema,
  requestInsertSchemaSchema,
} from "./validators/RequestInsertSchemaSchema.ts";
import { requestSendSignedTransactionDtoSchema } from "./validators/RequestSendSignedTransactionSchema.ts";
import {
  requestUpdateMetadataSchema,
  updateMetadataSchema,
} from "./validators/RequestUpdateMetadataSchema.ts";
import {
  requestUpdateSchemaSchema,
  updateSchemaSchema,
} from "./validators/RequestUpdateSchemaSchema.ts";

@Injectable()
export class JsonRpcService {
  private chainId: string | undefined;

  private readonly contract: SchemaSCRegistry;

  private readonly contractAddress: string;

  private readonly didRegistry: string;

  private readonly ledgerService: LedgerService;

  private readonly logger = new Logger(JsonRpcService.name);

  private readonly timeout: number;

  constructor(
    configService: ConfigService<ApiConfig, true>,
    ledgerService: LedgerService,
  ) {
    this.ledgerService = ledgerService;
    this.didRegistry = configService.get("didRegistryApiUrl", { infer: true });
    this.contractAddress = configService.get("contractAddr", {
      infer: true,
    });
    this.contract = SchemaSCRegistry__factory.connect(this.contractAddress);
    this.timeout = configService.get("requestTimeout", { infer: true });
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

    try {
      const gasEstimation = await this.estimateGas(unsignedTransaction);
      // Multiply by 1.4
      unsignedTransaction.gasLimit = `0x${((gasEstimation * 14n) / 10n).toString(16)}`;
    } catch {
      this.logger.warn("Gas could not be estimated. Using 0x1000000");
      unsignedTransaction.gasLimit = "0x1000000";
    }

    return unsignedTransaction;
  }

  async buildTransactionInsertSchema(
    body: JsonRpcSchema,
    id: null | number | string | undefined,
  ): Promise<UnsignedTransaction> {
    try {
      const parsedBody = await requestInsertSchemaSchema.parseAsync(body);

      const { from, metadata, schema, schemaId } = parsedBody.params[0]!;

      const data = this.contract.interface.encodeFunctionData("insertSchema", [
        schemaId,
        schema,
        metadata,
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

  async buildTransactionUpdateMetadata(
    body: JsonRpcSchema,
    id: null | number | string | undefined,
  ): Promise<UnsignedTransaction> {
    try {
      const parsedBody = await requestUpdateMetadataSchema.parseAsync(body);

      const { from, metadata, schemaId, schemaRevisionId } =
        parsedBody.params[0]!;

      const data = this.contract.interface.encodeFunctionData(
        "updateMetadata",
        [schemaId, schemaRevisionId, metadata],
      );

      return await this.buildTransaction(from, data);
    } catch (error_) {
      const error = new InvalidRequestJsonRpcError(getErrorMessage(error_), id);
      if (error_ instanceof Error && error_.stack) {
        error.stack = error_.stack;
      }
      throw error;
    }
  }

  async buildTransactionUpdateSchema(
    body: JsonRpcSchema,
    id: null | number | string | undefined,
  ): Promise<UnsignedTransaction> {
    try {
      const parsedBody = await requestUpdateSchemaSchema.parseAsync(body);

      const { from, metadata, schema, schemaId } = parsedBody.params[0]!;

      const data = this.contract.interface.encodeFunctionData("updateSchema", [
        schemaId,
        schema,
        metadata,
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

  async checkWritePermission(
    address: string,
    clientId: string,
    reqId: string,
  ): Promise<void> {
    // Check DID Registry
    if (!(await this.isDidControlledByAddress(clientId, address, reqId))) {
      throw new Error(
        `The DID ${clientId} is not controlled by the address ${address}`,
      );
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

  async getBlockNumber(): Promise<number> {
    const provider = this.ledgerService.getProvider();

    try {
      return await provider.getBlockNumber();
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
      `${this.didRegistry}/identifiers/${did}/actions`,
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
    clientId: string,
    body: JsonRpcSchema,
    id: null | number | string | undefined,
    reqId: string,
  ): Promise<string> {
    try {
      const chainId = await this.getChainId();

      const parsedBody =
        await requestSendSignedTransactionDtoSchema(chainId).parseAsync(body);

      const request = parsedBody.params[0]!;

      const { signer } = await this.verifyTransaction(request);

      await this.checkWritePermission(signer, clientId, reqId);

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
  ): Promise<{ functionName: string; signer: string }> {
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

    if (signedSerializedTransaction !== signedRawTransaction) {
      throw new Error(
        `The unsigned transaction + signature (${signedSerializedTransaction}) does not match with the signedRawTransaction (${signedRawTransaction})`,
      );
    }

    // recover address used to sign
    const digest = ethers.keccak256(unsignedSerializedTransaction);
    const signer = ethers.recoverAddress(digest, signature);

    if (signer.toLowerCase() !== unsignedTransaction.from.toLowerCase()) {
      throw new Error(
        `The signer of the transaction (${signer}) does not match with unsignedTransaction.from (${unsignedTransaction.from}) `,
      );
    }

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
      case "insertSchema": {
        await insertSchemaSchema.parseAsync(argsObject);
        break;
      }
      case "updateMetadata": {
        await updateMetadataSchema.parseAsync(argsObject);
        break;
      }
      case "updateSchema": {
        await updateSchemaSchema.parseAsync(argsObject);
        break;
      }
      default: {
        throw new Error(
          `The function name ${fragment.name} can not be used in this context`,
        );
      }
    }

    return {
      functionName: fragment.name,
      signer,
    };
  }
}
