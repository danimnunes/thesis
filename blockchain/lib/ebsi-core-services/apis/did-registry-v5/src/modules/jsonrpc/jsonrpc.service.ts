import type { DidRegistry } from "@ebsiint-sc/did-registry-v5";

import {
  decodeResult,
  getErrorMessage,
  InvalidRequestJsonRpcError,
  isEthersError,
  logAxiosError,
} from "@ebsiint-api/shared";
import { DidRegistry__factory } from "@ebsiint-sc/did-registry-v5";
import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { isAxiosError } from "axios";
import { ethers } from "ethers";
import { stringify } from "safe-stable-stringify";

import type { ApiConfig } from "../../config/configuration.ts";
import type { JsonRpcSchema } from "./validators/JsonRpcSchema.ts";
import type {
  SendSignedTransactionParamsSchema,
  UnsignedTransaction,
} from "./validators/RequestSendSignedTransactionSchema.ts";

import { DIDR_INVITE_SCOPE, DIDR_WRITE_SCOPE } from "../auth/auth.constants.ts";
import { LedgerService } from "../ledger/ledger.service.ts";
import {
  formatEthersSignature,
  formatEthersUnsignedTransaction,
} from "./jsonrpc.utils.ts";
import {
  addControllerSchema,
  requestAddControllerDtoSchema,
} from "./validators/RequestAddControllerSchema.ts";
import {
  addServiceSchema,
  requestAddServiceDtoSchema,
} from "./validators/RequestAddServiceSchema.ts";
import {
  addVerificationMethodSchema,
  requestAddVerificationMethodDtoSchema,
} from "./validators/RequestAddVerificationMethodSchema.ts";
import {
  addVerificationRelationshipSchema,
  requestAddVerificationRelationshipDtoSchema,
} from "./validators/RequestAddVerificationRelationshipSchema.ts";
import {
  expireVerificationMethodSchema,
  requestExpireVerificationMethodDtoSchema,
} from "./validators/RequestExpireVerificationMethodSchema.ts";
import {
  insertDidDocumentSchema,
  requestInsertDidDocumentDtoSchema,
} from "./validators/RequestInsertDidDocumentSchema.ts";
import {
  requestRevokeControllerDtoSchema,
  revokeControllerSchema,
} from "./validators/RequestRevokeControllerSchema.ts";
import {
  requestRevokeServiceDtoSchema,
  revokeServiceSchema,
} from "./validators/RequestRevokeServiceSchema.ts";
import {
  requestRevokeVerificationMethodDtoSchema,
  revokeVerificationMethodSchema,
} from "./validators/RequestRevokeVerificationMethodSchema.ts";
import {
  requestRollVerificationMethodDtoSchema,
  rollVerificationMethodSchema,
} from "./validators/RequestRollVerificationMethodSchema.ts";
import { requestSendSignedTransactionDtoSchema } from "./validators/RequestSendSignedTransactionSchema.ts";
import {
  requestUpdateBaseDocumentDtoSchema,
  updateBaseDocumentSchema,
} from "./validators/RequestUpdateBaseDocumentSchema.ts";

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
  const expectedScopes = Array.isArray(validScopes)
    ? validScopes
    : [validScopes];

  if (!expectedScopes.some((scp) => scope.includes(scp))) {
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
  private readonly contract: DidRegistry;
  private readonly contractAddress: string;
  private readonly ledgerService: LedgerService;
  private readonly logger = new Logger(JsonRpcService.name);

  constructor(
    configService: ConfigService<ApiConfig, true>,
    ledgerService: LedgerService,
  ) {
    this.ledgerService = ledgerService;
    this.contractAddress = configService.get("contractAddr", {
      infer: true,
    });
    this.contract = DidRegistry__factory.connect(this.contractAddress);
  }

  async buildTransaction(
    from: string,
    params: string,
  ): Promise<UnsignedTransaction> {
    const provider = this.ledgerService.getProvider();

    try {
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

      try {
        const gasEstimation = await this.estimateGas(unsignedTransaction);
        // Multiply by 1.4
        unsignedTransaction.gasLimit = `0x${(
          (gasEstimation * 14n) /
          10n
        ).toString(16)}`;
      } catch {
        this.logger.warn("Gas could not be estimated. Using 0x1000000");
        unsignedTransaction.gasLimit = "0x1000000";
      }

      return unsignedTransaction;
    } catch (error) {
      if (isEthersError(error)) {
        this.logger.error(error, error.stack);
      }
      throw new Error("Could not build transaction.");
    }
  }

  async buildTransactionAddController(
    body: JsonRpcSchema,
    id: null | number | string | undefined,
    scope: string,
  ): Promise<UnsignedTransaction> {
    try {
      // Access Token must contain DIDR_WRITE_SCOPE scope
      assertScopeContains(scope, DIDR_WRITE_SCOPE, "addController");

      const parsedBody = await requestAddControllerDtoSchema.parseAsync(body);

      const { controller, did, from } = parsedBody.params[0]!;

      const data = this.contract.interface.encodeFunctionData("addController", [
        did,
        controller,
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

  async buildTransactionAddService(
    body: JsonRpcSchema,
    id: null | number | string | undefined,
    scope: string,
  ) {
    try {
      // Access Token must contain DIDR_WRITE_SCOPE scope
      assertScopeContains(scope, DIDR_WRITE_SCOPE, "updateBaseDocument");

      const parsedBody = await requestAddServiceDtoSchema.parseAsync(body);

      const { did, from, service } = parsedBody.params[0]!;

      const didDocument = await this.getDidDocument(did);

      let baseDocument: { [x: string]: unknown; service?: unknown[] };
      try {
        baseDocument = JSON.parse(didDocument.baseDocument) as Record<
          string,
          unknown
        >;
      } catch (error) {
        throw new InvalidRequestJsonRpcError(
          `Identifier ${did} contains an invalid base document. ${
            error instanceof Error ? error.message : "Unknown error"
          }`,
          id,
        );
      }

      baseDocument.service ??= [];
      baseDocument.service.push(JSON.parse(service));

      const data = this.contract.interface.encodeFunctionData(
        "updateBaseDocument",
        [did, stringify(baseDocument)],
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

  async buildTransactionAddVerificationMethod(
    body: JsonRpcSchema,
    id: null | number | string | undefined,
    scope: string,
  ): Promise<UnsignedTransaction> {
    try {
      // Access Token must contain DIDR_WRITE_SCOPE scope
      assertScopeContains(scope, DIDR_WRITE_SCOPE, "addVerificationMethod");

      const parsedBody =
        await requestAddVerificationMethodDtoSchema.parseAsync(body);

      const { did, from, isSecp256k1, publicKey, vMethodId } =
        parsedBody.params[0]!;

      const data = this.contract.interface.encodeFunctionData(
        "addVerificationMethod",
        [did, vMethodId, publicKey, isSecp256k1],
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

  async buildTransactionAddVerificationRelationship(
    body: JsonRpcSchema,
    id: null | number | string | undefined,
    scope: string,
  ): Promise<UnsignedTransaction> {
    try {
      // Access Token must contain DIDR_WRITE_SCOPE scope
      assertScopeContains(
        scope,
        DIDR_WRITE_SCOPE,
        "addVerificationRelationship",
      );

      const parsedBody =
        await requestAddVerificationRelationshipDtoSchema.parseAsync(body);

      const { did, from, name, notAfter, notBefore, vMethodId } =
        parsedBody.params[0]!;

      const data = this.contract.interface.encodeFunctionData(
        "addVerificationRelationship",
        [did, name, vMethodId, notBefore, notAfter],
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

  async buildTransactionExpireVerificationMethod(
    body: JsonRpcSchema,
    id: null | number | string | undefined,
    scope: string,
  ): Promise<UnsignedTransaction> {
    try {
      // Access Token must contain DIDR_WRITE_SCOPE scope
      assertScopeContains(scope, DIDR_WRITE_SCOPE, "expireVerificationMethod");

      const parsedBody =
        await requestExpireVerificationMethodDtoSchema.parseAsync(body);

      const { did, from, notAfter, vMethodId } = parsedBody.params[0]!;

      const data = this.contract.interface.encodeFunctionData(
        "expireVerificationMethod",
        [did, vMethodId, notAfter],
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

  async buildTransactionInsertDidDocument(
    body: JsonRpcSchema,
    id: null | number | string | undefined,
    sub: string,
    scope: string,
  ): Promise<UnsignedTransaction> {
    try {
      // Access Token must contain DIDR_INVITE_SCOPE or DIDR_WRITE_SCOPE scope
      assertScopeContains(
        scope,
        [DIDR_INVITE_SCOPE, DIDR_WRITE_SCOPE],
        "insertDidDocument",
      );

      const parsedBody =
        await requestInsertDidDocumentDtoSchema.parseAsync(body);

      const {
        baseDocument,
        did,
        from,
        isSecp256k1,
        notAfter,
        notBefore,
        publicKey,
        vMethodId,
      } = parsedBody.params[0]!;

      if (scope.includes(DIDR_INVITE_SCOPE)) {
        // Verify that the Access Token sub and the payload DID match
        assertDidMatchesSub(did, sub);
      }

      const data = this.contract.interface.encodeFunctionData(
        "insertDidDocument",
        [
          did,
          baseDocument,
          vMethodId,
          publicKey,
          isSecp256k1,
          notBefore,
          notAfter,
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

  async buildTransactionRevokeController(
    body: JsonRpcSchema,
    id: null | number | string | undefined,
    scope: string,
  ): Promise<UnsignedTransaction> {
    try {
      // Access Token must contain DIDR_WRITE_SCOPE scope
      assertScopeContains(scope, DIDR_WRITE_SCOPE, "revokeController");

      const parsedBody =
        await requestRevokeControllerDtoSchema.parseAsync(body);

      const { controller, did, from } = parsedBody.params[0]!;

      const data = this.contract.interface.encodeFunctionData(
        "revokeController",
        [did, controller],
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

  async buildTransactionRevokeService(
    body: JsonRpcSchema,
    id: null | number | string | undefined,
    scope: string,
  ) {
    try {
      // Access Token must contain DIDR_WRITE_SCOPE scope
      assertScopeContains(scope, DIDR_WRITE_SCOPE, "updateBaseDocument");

      const parsedBody = await requestRevokeServiceDtoSchema.parseAsync(body);

      const { did, from, serviceId } = parsedBody.params[0]!;

      const didDocument = await this.getDidDocument(did);

      let baseDocument: { [x: string]: unknown; service?: { id: string }[] };
      try {
        baseDocument = JSON.parse(didDocument.baseDocument) as Record<
          string,
          unknown
        >;
      } catch (error) {
        throw new InvalidRequestJsonRpcError(
          `Identifier ${did} contains an invalid base document. ${
            error instanceof Error ? error.message : "Unknown error"
          }`,
          id,
        );
      }

      if (baseDocument.service) {
        const i = baseDocument.service.findIndex((s) => s.id === serviceId);
        if (i !== -1) {
          baseDocument.service.splice(i, 1);
        }
      }

      const data = this.contract.interface.encodeFunctionData(
        "updateBaseDocument",
        [did, stringify(baseDocument)],
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

  async buildTransactionRevokeVerificationMethod(
    body: JsonRpcSchema,
    id: null | number | string | undefined,
    scope: string,
  ): Promise<UnsignedTransaction> {
    try {
      // Access Token must contain DIDR_WRITE_SCOPE scope
      assertScopeContains(scope, DIDR_WRITE_SCOPE, "revokeVerificationMethod");

      const parsedBody =
        await requestRevokeVerificationMethodDtoSchema.parseAsync(body);

      const { did, from, notAfter, vMethodId } = parsedBody.params[0]!;

      const data = this.contract.interface.encodeFunctionData(
        "revokeVerificationMethod",
        [did, vMethodId, notAfter],
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

  async buildTransactionRollVerificationMethod(
    body: JsonRpcSchema,
    id: null | number | string | undefined,
    scope: string,
  ): Promise<UnsignedTransaction> {
    try {
      // Access Token must contain DIDR_WRITE_SCOPE scope
      assertScopeContains(scope, DIDR_WRITE_SCOPE, "rollVerificationMethod");

      const parsedBody =
        await requestRollVerificationMethodDtoSchema.parseAsync(body);

      const { args, from } = parsedBody.params[0]!;

      const data = this.contract.interface.encodeFunctionData(
        "rollVerificationMethod",
        [args],
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

  async buildTransactionUpdateBaseDocument(
    body: JsonRpcSchema,
    id: null | number | string | undefined,
    scope: string,
  ): Promise<UnsignedTransaction> {
    try {
      // Access Token must contain DIDR_WRITE_SCOPE scope
      assertScopeContains(scope, DIDR_WRITE_SCOPE, "updateBaseDocument");

      const parsedBody =
        await requestUpdateBaseDocumentDtoSchema.parseAsync(body);

      const { baseDocument, did, from } = parsedBody.params[0]!;

      const data = this.contract.interface.encodeFunctionData(
        "updateBaseDocument",
        [did, baseDocument],
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

  async getDidDocument(did: string): ReturnType<DidRegistry["getDidDocument"]> {
    const provider = this.ledgerService.getProvider();

    try {
      return await this.contract
        // @ts-expect-error Error due to contracts using CommonJS modules
        .connect(provider)
        .getDidDocument(did);
    } catch (error) {
      if (isEthersError(error)) {
        this.logger.error(error, error.stack);
        // Throw a generic error to avoid leaking information.
        throw new InvalidRequestJsonRpcError(
          `Identifier ${did} Not Found`,
          did,
        );
      }

      throw error;
    }
  }

  async sendTransaction(
    body: JsonRpcSchema,
    id: null | number | string | undefined,
    sub: string,
    scope: string,
  ): Promise<string> {
    try {
      const chainId = await this.getChainId();

      const parsedBody =
        await requestSendSignedTransactionDtoSchema(chainId).parseAsync(body);

      const request = parsedBody.params[0]!;

      await this.verifyTransaction(sub, request, scope);

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
    clientId: string,
    param: SendSignedTransactionParamsSchema,
    scope: string,
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
      case "addController": {
        assertScopeContains(scope, DIDR_WRITE_SCOPE, fragment.name);
        await addControllerSchema.parseAsync(argsObject);
        break;
      }
      case "addService": {
        assertScopeContains(scope, DIDR_WRITE_SCOPE, fragment.name);
        await addServiceSchema.parseAsync(argsObject);
        break;
      }
      case "addVerificationMethod": {
        assertScopeContains(scope, DIDR_WRITE_SCOPE, fragment.name);
        await addVerificationMethodSchema.parseAsync(argsObject);
        break;
      }
      case "addVerificationRelationship": {
        assertScopeContains(scope, DIDR_WRITE_SCOPE, fragment.name);
        await addVerificationRelationshipSchema.parseAsync(argsObject);
        break;
      }
      case "expireVerificationMethod": {
        assertScopeContains(scope, DIDR_WRITE_SCOPE, fragment.name);
        await expireVerificationMethodSchema.parseAsync(argsObject);
        break;
      }
      case "insertDidDocument": {
        assertScopeContains(
          scope,
          [DIDR_INVITE_SCOPE, DIDR_WRITE_SCOPE],
          fragment.name,
        );

        const castArgs = await insertDidDocumentSchema.parseAsync(argsObject);

        if (scope.includes(DIDR_INVITE_SCOPE)) {
          assertDidMatchesSub(castArgs.did, clientId);
        }
        break;
      }
      case "revokeController": {
        assertScopeContains(scope, DIDR_WRITE_SCOPE, fragment.name);
        await revokeControllerSchema.parseAsync(argsObject);
        break;
      }
      case "revokeService": {
        assertScopeContains(scope, DIDR_WRITE_SCOPE, fragment.name);
        await revokeServiceSchema.parseAsync(argsObject);
        break;
      }
      case "revokeVerificationMethod": {
        assertScopeContains(scope, DIDR_WRITE_SCOPE, fragment.name);
        await revokeVerificationMethodSchema.parseAsync(argsObject);
        break;
      }
      case "rollVerificationMethod": {
        assertScopeContains(scope, DIDR_WRITE_SCOPE, fragment.name);
        await rollVerificationMethodSchema.parseAsync(argsObject);
        break;
      }
      case "updateBaseDocument": {
        assertScopeContains(scope, DIDR_WRITE_SCOPE, fragment.name);
        await updateBaseDocumentSchema.parseAsync(argsObject);
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
