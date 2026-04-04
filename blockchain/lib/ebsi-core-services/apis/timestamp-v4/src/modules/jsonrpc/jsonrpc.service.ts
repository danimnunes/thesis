import type { Timestamp } from "@ebsiint-sc/timestamp-v4";

import {
  decodeResult,
  getErrorMessage,
  InvalidRequestJsonRpcError,
  isEthersError,
  logAxiosError,
} from "@ebsiint-api/shared";
import { Timestamp__factory } from "@ebsiint-sc/timestamp-v4";
import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import axios, { isAxiosError } from "axios";
import { ethers } from "ethers";

import type { ApiConfig } from "../../config/configuration.ts";
import type { UserInfo } from "../auth/auth.interface.ts";
import type { JsonRpcSchema } from "./validators/JsonRpcSchema.ts";
import type {
  SendSignedTransactionParamsSchema,
  UnsignedTransaction,
} from "./validators/RequestSendSignedTransaction.ts";

import { LedgerService } from "../ledger/ledger.service.ts";
import {
  formatEthersSignature,
  formatEthersUnsignedTransaction,
} from "./jsonrpc.utils.ts";
import {
  appendRecordVersionHashesSchema,
  requestAppendRecordVersionHashesDtoSchema,
} from "./validators/RequestAppendRecordVersionHashes.ts";
import {
  detachRecordVersionHashSchema,
  requestDetachRecordVersionHashDtoSchema,
} from "./validators/RequestDetachRecordVersionHashes.ts";
import {
  insertHashAlgorithmSchema,
  requestInsertHashAlgorithmDtoSchema,
} from "./validators/RequestInsertHashAlgorithm.ts";
import {
  insertRecordOwnerSchema,
  requestInsertRecordOwnerDtoSchema,
} from "./validators/RequestInsertRecordOwner.ts";
import {
  insertRecordVersionInfoSchema,
  requestInsertRecordVersionInfoDtoSchema,
} from "./validators/RequestInsertRecordVersionInfo.ts";
import {
  requestRevokeRecordOwnerDtoSchema,
  revokeRecordOwnerSchema,
} from "./validators/RequestRevokeRecordOwner.ts";
import { requestSendSignedTransactionDtoSchema } from "./validators/RequestSendSignedTransaction.ts";
import {
  requestTimestampHashesDtoSchema,
  timestampHashesSchema,
} from "./validators/RequestTimestampHashes.ts";
import {
  requestTimestampRecordHashesDtoSchema,
  timestampRecordHashesSchema,
} from "./validators/RequestTimestampRecordHashes.ts";
import {
  requestTimestampRecordVersionHashesDtoSchema,
  timestampRecordVersionHashesSchema,
} from "./validators/RequestTimestampRecordVersionHashes.ts";
import {
  requestTimestampVersionHashesDtoSchema,
  timestampVersionHashesSchema,
} from "./validators/RequestTimestampVersionHashes.ts";
import {
  requestUpdateHashAlgorithmDtoSchema,
  updateHashAlgorithmSchema,
} from "./validators/RequestUpdateHashAlgorithm.ts";

// Cache algorithms' output lengths for 30 minutes
const ALGORITHMS_EXP = 30 * 60 * 1000; // 30 minutes

@Injectable()
export class JsonRpcService {
  private algIdsToOutputLength: Record<
    number,
    { exp: number; outputLength: number }
  > = {};

  private chainId: string | undefined;

  private readonly configService: ConfigService<ApiConfig, true>;

  private readonly contract: Timestamp;

  private readonly contractAddress: string;

  private readonly didRegistry: string;

  private readonly ledgerService: LedgerService;

  private readonly logger = new Logger(JsonRpcService.name);

  private readonly timeout: number;

  constructor(
    configService: ConfigService<ApiConfig, true>,
    ledgerService: LedgerService,
  ) {
    this.configService = configService;
    this.ledgerService = ledgerService;

    this.didRegistry = this.configService.get("didRegistryApiUrl", {
      infer: true,
    });

    this.contractAddress = this.configService.get("contractAddr", {
      infer: true,
    });

    this.contract = Timestamp__factory.connect(this.contractAddress);

    this.timeout = configService.get("requestTimeout", { infer: true });
  }

  async buildTransaction(
    from: string,
    params: string,
  ): Promise<UnsignedTransaction> {
    const provider = this.ledgerService.getProvider();

    const nonceInt = await provider.getTransactionCount(from);

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

  async buildTransactionAppendRecordVersionHashes(
    body: JsonRpcSchema,
    id?: number | string,
  ): Promise<UnsignedTransaction> {
    try {
      const parsedBody =
        await requestAppendRecordVersionHashesDtoSchema.parseAsync(body);

      const {
        from,
        hashAlgorithmIds,
        hashValues,
        recordId,
        timestampData,
        versionId,
        versionInfo,
      } = parsedBody.params[0]!;

      await this.checkHashes(hashAlgorithmIds, hashValues);

      const data = this.contract.interface.encodeFunctionData(
        "appendRecordVersionHashes",
        [
          recordId,
          versionId,
          hashAlgorithmIds,
          hashValues,
          timestampData ?? [],
          versionInfo,
        ],
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

  async buildTransactionDetachRecordVersionHash(
    body: JsonRpcSchema,
    id?: number | string,
  ): Promise<UnsignedTransaction> {
    try {
      const parsedBody =
        await requestDetachRecordVersionHashDtoSchema.parseAsync(body);

      const { from, hashValue, recordId, versionId } = parsedBody.params[0]!;

      const data = this.contract.interface.encodeFunctionData(
        "detachRecordVersionHash",
        [recordId, versionId, hashValue],
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

  async buildTransactionInsertHashAlgorithm(
    body: JsonRpcSchema,
    id?: number | string,
  ): Promise<UnsignedTransaction> {
    try {
      const parsedBody =
        await requestInsertHashAlgorithmDtoSchema.parseAsync(body);

      const { from, ianaName, multiHash, oid, outputLength, status } =
        parsedBody.params[0]!;

      const data = this.contract.interface.encodeFunctionData(
        "insertHashAlgorithm",
        [outputLength, ianaName ?? "", oid ?? "", status, multiHash],
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

  async buildTransactionInsertRecordOwner(
    body: JsonRpcSchema,
    id?: number | string,
  ): Promise<UnsignedTransaction> {
    try {
      const parsedBody =
        await requestInsertRecordOwnerDtoSchema.parseAsync(body);

      const { from, notAfter, notBefore, ownerId, recordId } =
        parsedBody.params[0]!;

      const data = this.contract.interface.encodeFunctionData(
        "insertRecordOwner",
        [recordId, ownerId.toLowerCase(), notBefore, notAfter],
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

  async buildTransactionInsertRecordVersionInfo(
    body: JsonRpcSchema,
    id?: number | string,
  ): Promise<UnsignedTransaction> {
    try {
      const parsedBody =
        await requestInsertRecordVersionInfoDtoSchema.parseAsync(body);

      const { from, recordId, versionId, versionInfo } = parsedBody.params[0]!;

      const data = this.contract.interface.encodeFunctionData(
        "insertRecordVersionInfo",
        [recordId, versionId, versionInfo],
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

  async buildTransactionRevokeRecordOwner(
    body: JsonRpcSchema,
    id?: number | string,
  ): Promise<UnsignedTransaction> {
    try {
      const parsedBody =
        await requestRevokeRecordOwnerDtoSchema.parseAsync(body);

      const { from, ownerId, recordId } = parsedBody.params[0]!;

      const data = this.contract.interface.encodeFunctionData(
        "revokeRecordOwner",
        [recordId, ownerId.toLowerCase()],
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

  async buildTransactionTimestampHashes(
    body: JsonRpcSchema,
    id?: number | string,
  ): Promise<UnsignedTransaction> {
    try {
      const parsedBody = await requestTimestampHashesDtoSchema.parseAsync(body);

      const { from, hashAlgorithmIds, hashValues, timestampData } =
        parsedBody.params[0]!;

      await this.checkHashes(hashAlgorithmIds, hashValues);

      const data = this.contract.interface.encodeFunctionData(
        "timestampHashes",
        [hashAlgorithmIds, hashValues, timestampData ?? []],
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

  async buildTransactionTimestampRecordHashes(
    body: JsonRpcSchema,
    id?: number | string,
  ): Promise<UnsignedTransaction> {
    try {
      const parsedBody =
        await requestTimestampRecordHashesDtoSchema.parseAsync(body);

      const { from, hashAlgorithmIds, hashValues, timestampData, versionInfo } =
        parsedBody.params[0]!;

      await this.checkHashes(hashAlgorithmIds, hashValues);

      const data = this.contract.interface.encodeFunctionData(
        "timestampRecordHashes",
        [hashAlgorithmIds, hashValues, timestampData ?? [], versionInfo],
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

  async buildTransactionTimestampRecordVersionHashes(
    body: JsonRpcSchema,
    id?: number | string,
  ): Promise<UnsignedTransaction> {
    try {
      const parsedBody =
        await requestTimestampRecordVersionHashesDtoSchema.parseAsync(body);

      const {
        from,
        hashAlgorithmIds,
        hashValues,
        recordId,
        timestampData,
        versionInfo,
      } = parsedBody.params[0]!;

      await this.checkHashes(hashAlgorithmIds, hashValues);

      const data = this.contract.interface.encodeFunctionData(
        "timestampRecordVersionHashes",
        [
          recordId,
          hashAlgorithmIds,
          hashValues,
          timestampData ?? [],
          versionInfo,
        ],
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

  async buildTransactionTimestampVersionHashes(
    body: JsonRpcSchema,
    id?: number | string,
  ): Promise<UnsignedTransaction> {
    try {
      const parsedBody =
        await requestTimestampVersionHashesDtoSchema.parseAsync(body);

      const {
        from,
        hashAlgorithmIds,
        hashValues,
        timestampData,
        versionHash,
        versionInfo,
      } = parsedBody.params[0]!;

      await this.checkHashes(hashAlgorithmIds, hashValues);

      const data = this.contract.interface.encodeFunctionData(
        "timestampVersionHashes",
        [
          versionHash,
          hashAlgorithmIds,
          hashValues,
          timestampData ?? [],
          versionInfo,
        ],
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

  async buildTransactionUpdateHashAlgorithm(
    body: JsonRpcSchema,
    id?: number | string,
  ): Promise<UnsignedTransaction> {
    try {
      const parsedBody =
        await requestUpdateHashAlgorithmDtoSchema.parseAsync(body);

      const {
        from,
        hashAlgorithmId,
        ianaName,
        multiHash,
        oid,
        outputLength,
        status,
      } = parsedBody.params[0]!;

      const data = this.contract.interface.encodeFunctionData(
        "updateHashAlgorithm",
        [
          hashAlgorithmId,
          outputLength,
          ianaName ?? "",
          oid ?? "",
          status,
          multiHash,
        ],
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

  async checkHashes(
    hashAlgorithmIds: ethers.BigNumberish[],
    hashValues: string[],
  ): Promise<void> {
    if (hashAlgorithmIds.length !== hashValues.length) {
      throw new Error(
        "hashAlgorithmIds and hashValues don't have the same length",
      );
    }

    const now = Date.now();
    const uniqHashAlgorithmIds = [...new Set(hashAlgorithmIds)];

    const provider = this.ledgerService.getProvider();

    await Promise.all(
      uniqHashAlgorithmIds.map(async (algId) => {
        const algIdNumber = Number(ethers.getBigInt(algId));
        const outputLength = this.algIdsToOutputLength[algIdNumber];
        if (outputLength && outputLength.exp > now) {
          // Use cached result
          return;
        }

        // Get hash algorithm corresponding to algId
        try {
          const hashAlgorithm = await this.contract
            // @ts-expect-error Error due to contracts using CommonJS modules
            .connect(provider)
            .getHashAlgorithmById(algId);

          const outputLength = Number(hashAlgorithm.outputLength);

          this.algIdsToOutputLength[algIdNumber] = {
            exp: now + ALGORITHMS_EXP,
            outputLength,
          };
        } catch (error) {
          if (isEthersError(error)) {
            this.logger.error(error, error.stack);
          }
          throw new Error(`Can't find hash algorithm with ID: ${algIdNumber}`);
        }
      }),
    );

    // Compare lengths
    for (const [index, hashValue] of hashValues.entries()) {
      const algId = hashAlgorithmIds[index]!;
      const algIdNumber = Number(ethers.getBigInt(algId));
      const expectedOutputLength =
        this.algIdsToOutputLength[algIdNumber]!.outputLength;
      const hashLength =
        Buffer.from(hashValue.replace("0x", ""), "hex").byteLength * 8;
      if (hashLength !== expectedOutputLength) {
        throw new Error(
          `Hash ${hashValue}'s length (${hashLength} bits) is different from the expected length (${expectedOutputLength} bits)`,
        );
      }
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
    body: JsonRpcSchema,
    user: UserInfo,
    id: null | number | string | undefined,
    reqId: string,
  ): Promise<string> {
    try {
      const chainId = await this.getChainId();

      const parsedBody =
        await requestSendSignedTransactionDtoSchema(chainId).parseAsync(body);

      const request = parsedBody.params[0]!;
      const { signer } = await this.verifyTransaction(request);

      await this.verifyEthereumAddress(signer, user, reqId);

      const provider = this.ledgerService.getProvider();

      const tx = await provider.broadcastTransaction(
        request.signedRawTransaction,
      );
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

  async verifyEthereumAddress(
    address: string,
    user: UserInfo,
    reqId: string,
  ): Promise<void> {
    if (!(await this.isDidControlledByAddress(user.sub, address, reqId))) {
      throw new Error(
        `The DID ${user.sub} is not controlled by the address ${address}`,
      );
    }
  }

  async verifyTransaction(param: SendSignedTransactionParamsSchema): Promise<{
    args: ethers.Result;
    functionName: string;
    signer: string;
  }> {
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
    const signer = ethers.recoverAddress(digest, signature).toLowerCase();

    if (signer !== unsignedTransaction.from.toLowerCase()) {
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
      case "appendRecordVersionHashes": {
        const castArgs =
          await appendRecordVersionHashesSchema.parseAsync(argsObject);
        await this.checkHashes(castArgs.hashAlgorithmIds, castArgs.hashValues);
        break;
      }
      case "detachRecordVersionHash": {
        await detachRecordVersionHashSchema.parseAsync(argsObject);
        break;
      }
      case "insertHashAlgorithm": {
        await insertHashAlgorithmSchema.parseAsync(argsObject);
        break;
      }
      case "insertRecordOwner": {
        await insertRecordOwnerSchema.parseAsync(argsObject);
        break;
      }
      case "insertRecordVersionInfo": {
        await insertRecordVersionInfoSchema.parseAsync(argsObject);
        break;
      }
      case "revokeRecordOwner": {
        await revokeRecordOwnerSchema.parseAsync(argsObject);
        break;
      }
      case "timestampHashes": {
        const castArgs = await timestampHashesSchema.parseAsync(argsObject);
        await this.checkHashes(castArgs.hashAlgorithmIds, castArgs.hashValues);
        break;
      }
      case "timestampRecordHashes": {
        const castArgs =
          await timestampRecordHashesSchema.parseAsync(argsObject);
        await this.checkHashes(castArgs.hashAlgorithmIds, castArgs.hashValues);
        break;
      }
      case "timestampRecordVersionHashes": {
        const castArgs =
          await timestampRecordVersionHashesSchema.parseAsync(argsObject);
        await this.checkHashes(castArgs.hashAlgorithmIds, castArgs.hashValues);
        break;
      }
      case "timestampVersionHashes": {
        const castArgs =
          await timestampVersionHashesSchema.parseAsync(argsObject);
        await this.checkHashes(castArgs.hashAlgorithmIds, castArgs.hashValues);
        break;
      }
      case "updateHashAlgorithm": {
        await updateHashAlgorithmSchema.parseAsync(argsObject);
        break;
      }
      default: {
        throw new Error(
          `The function name ${fragment.name} can not be used in this context`,
        );
      }
    }

    return {
      // @ts-expect-error Error due to contracts using CommonJS modules
      args,
      functionName: fragment.name,
      signer,
    };
  }
}
