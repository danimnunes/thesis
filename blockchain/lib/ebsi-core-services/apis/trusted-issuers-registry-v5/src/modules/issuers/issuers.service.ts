import type { Tir } from "@ebsiint-sc/trusted-issuers-registry-v5";
import type { EbsiEnvConfiguration } from "@europeum-ebsi/verifiable-credential";
import type { AxiosResponse } from "axios";

import {
  BadRequestError,
  InternalServerError,
  isEthersError,
  NotFoundError,
  parseRevertReason,
  prefixWith0x,
  remove0xPrefix,
} from "@ebsiint-api/shared";
import { Tir__factory } from "@ebsiint-sc/trusted-issuers-registry-v5";
import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import axios from "axios";
import { decodeJwt, type JWTPayload } from "jose";

import type { ApiConfig } from "../../config/configuration.ts";
import type {
  AttributeObject,
  IssuerProxyResponseObject,
  IssuerResponseObject__deprecated,
} from "./issuers.interface.ts";

import {
  checkVcdm11BitstringStatusListCredential,
  checkVcdm20BitstringStatusListCredential,
} from "../../shared/validators/isBitstringStatusListCredential.ts";
import { checkStatusList2021Credential } from "../../shared/validators/isStatusList2021Credential.ts";
import { LedgerService } from "../ledger/ledger.service.ts";
import { IssuerTypeNames } from "./issuers.constants.ts";

function getContractError(err: unknown) {
  if (
    !err ||
    typeof err !== "object" ||
    !("data" in err) ||
    typeof err.data !== "string"
  ) {
    return "";
  }

  return parseRevertReason(err.data);
}

@Injectable()
export class IssuersService {
  private readonly contract: Tir;

  private ebsiEnvConfig: EbsiEnvConfiguration;

  private readonly ledgerService: LedgerService;

  private readonly logger = new Logger(IssuersService.name);

  private readonly timeout: number;

  constructor(
    ledgerService: LedgerService,
    configService: ConfigService<ApiConfig, true>,
  ) {
    this.ledgerService = ledgerService;
    this.ebsiEnvConfig = configService.get("ebsiEnvConfig", { infer: true });
    this.timeout = configService.get("requestTimeout", { infer: true });
    const contractAddress = configService.get(
      "besuTrustedIssuersRegistryAddress",
      { infer: true },
    );
    this.contract = Tir__factory.connect(contractAddress);
  }

  async assertIssuerExists__deprecated(did: string): Promise<void> {
    await this.getAttributes(did, 1, 1);
  }

  async getAttribute(did: string, attrId: string): Promise<AttributeObject> {
    const provider = this.ledgerService.getProvider();

    const hash = prefixWith0x(attrId);
    let attribute: Awaited<ReturnType<Tir["getLatestRevisionAttribute"]>>;

    try {
      attribute = await this.contract
        // @ts-expect-error Error due to CommonJS vs ESM modules imports
        .connect(provider)
        .getLatestRevisionAttribute(did, hash);
    } catch (error) {
      if (isEthersError(error)) {
        this.logger.error(error, error.stack);
      }

      const contractError = getContractError(error);

      switch (contractError) {
        case "issuer does not exist": {
          throw new NotFoundError("Issuer Not Found", {
            detail: `Issuer ${did} not found`,
          });
        }
        case "attribute has not been found": {
          throw new NotFoundError("Attribute Not Found", {
            detail: `Attribute ${attrId} not found`,
          });
        }
        default: {
          throw new NotFoundError("Not Found", {
            detail: contractError,
          });
        }
      }
    }

    const { attribData, attributeId, issuerType, rootTao, tao } = attribute;
    const attributeData = Buffer.from(
      remove0xPrefix(attribData),
      "hex",
    ).toString();

    return {
      body: attributeData,
      hash: remove0xPrefix(attributeId),
      issuerType: IssuerTypeNames[Number(issuerType)]!,
      rootTao,
      tao,
    };
  }

  async getAttributeRevision__deprecated(
    revisionId: string,
  ): Promise<AttributeObject> {
    const provider = this.ledgerService.getProvider();

    // This function assumes that the revisionId exists
    const hash = prefixWith0x(revisionId);

    let attributeByHash: Awaited<
      ReturnType<Tir["getIssuerAttributeByHash__deprecated"]>
    >;
    try {
      attributeByHash = await this.contract
        // @ts-expect-error Error due to CommonJS vs ESM modules imports
        .connect(provider)
        .getIssuerAttributeByHash__deprecated(hash);
    } catch (error) {
      if (isEthersError(error)) {
        this.logger.error(error, error.stack);
      }
      throw new NotFoundError("Revision Not Found", {
        detail: `Revision ${hash} not found`,
      });
    }

    const { attribData, issuerType, rootTao, tao } = attributeByHash;
    const attributeData = Buffer.from(
      remove0xPrefix(attribData),
      "hex",
    ).toString();

    return {
      body: attributeData,
      hash: remove0xPrefix(hash),
      issuerType: IssuerTypeNames[Number(issuerType)]!,
      rootTao,
      tao,
    };
  }

  async getAttributes(
    issuerDid: string,
    page: number,
    pageSize: number,
  ): ReturnType<Tir["getIssuerAttributes"]> {
    const provider = this.ledgerService.getProvider();

    try {
      return await this.contract
        // @ts-expect-error Error due to CommonJS vs ESM modules imports
        .connect(provider)
        .getIssuerAttributes(issuerDid, page, pageSize);
    } catch (error) {
      if (isEthersError(error)) {
        this.logger.error(error, error.stack);
      } else {
        this.logger.error(error);
      }

      throw new NotFoundError("Issuer Not Found", {
        detail: `Issuer ${issuerDid} not found`,
      });
    }
  }

  async getAttributes__deprecated(
    issuerDid: string,
  ): Promise<AttributeObject[]> {
    const provider = this.ledgerService.getProvider();

    let attributesLastHash: string[];

    try {
      attributesLastHash = await this.contract
        // @ts-expect-error Error due to CommonJS vs ESM modules imports
        .connect(provider)
        .getIssuer__deprecated(issuerDid);
    } catch (error) {
      if (isEthersError(error)) {
        this.logger.error(error, error.stack);
      } else {
        this.logger.error(error);
      }

      throw new NotFoundError("Issuer Not Found", {
        detail: `Issuer ${issuerDid} not found`,
      });
    }

    if (attributesLastHash.length === 0) {
      throw new NotFoundError("Issuer Not Found", {
        detail: `Issuer ${issuerDid} not found`,
      });
    }

    return Promise.all(
      attributesLastHash.map(async (hash) => {
        return this.getAttributeRevision__deprecated(hash);
      }),
    );
  }

  async getIssuer(issuerDid: string): ReturnType<Tir["getIssuer"]> {
    const provider = this.ledgerService.getProvider();

    try {
      return await this.contract
        // @ts-expect-error Error due to CommonJS vs ESM modules imports
        .connect(provider)
        .getIssuer(issuerDid);
    } catch (error) {
      if (isEthersError(error)) {
        this.logger.error(error, error.stack);
      } else {
        this.logger.error(error);
      }

      throw new NotFoundError("Issuer Not Found", {
        detail: `Issuer ${issuerDid} not found`,
      });
    }
  }

  async getIssuer__deprecated(
    did: string,
  ): Promise<IssuerResponseObject__deprecated> {
    const attributes = await this.getAttributes__deprecated(did);
    return { attributes, did };
  }

  async getIssuerAttributeIdRevision(
    did: string,
    attrId: string,
    revisionId: string,
  ): Promise<AttributeObject> {
    const provider = this.ledgerService.getProvider();

    const attrId0x = prefixWith0x(attrId);
    const revisionId0x = prefixWith0x(revisionId);
    let attribute: Awaited<ReturnType<Tir["getRevisionAttribute"]>>;

    try {
      attribute = await this.contract
        // @ts-expect-error Error due to CommonJS vs ESM modules imports
        .connect(provider)
        .getRevisionAttribute(did, attrId0x, revisionId0x);
    } catch (error) {
      if (isEthersError(error)) {
        this.logger.error(error, error.stack);
      }

      const contractError = getContractError(error);

      switch (contractError) {
        case "issuer does not exist": {
          throw new NotFoundError("Issuer Not Found", {
            detail: `Issuer ${did} not found`,
          });
        }
        case "attribute has not been found": {
          throw new NotFoundError("Attribute Not Found", {
            detail: `Attribute ${attrId} not found`,
          });
        }
        case "revision has not been found": {
          throw new NotFoundError("Revision Not Found", {
            detail: `Revision ${revisionId0x} not found`,
          });
        }
        default: {
          throw new NotFoundError("Not Found", {
            detail: contractError,
          });
        }
      }
    }

    const { attribData, attributeId, issuerType, rootTao, tao } = attribute;
    const attributeData = Buffer.from(
      remove0xPrefix(attribData),
      "hex",
    ).toString();

    return {
      body: attributeData,
      hash: remove0xPrefix(attributeId),
      issuerType: IssuerTypeNames[Number(issuerType)]!,
      rootTao,
      tao,
    };
  }

  async getIssuerAttributeIdRevisions(
    attributeId: string,
    did: string,
    page: number,
    pageSize: number,
  ): ReturnType<Tir["getIssuerAttributeRevisions"]> {
    const provider = this.ledgerService.getProvider();

    // This function assumes that the attributeId exists
    const hash = prefixWith0x(attributeId);

    try {
      return await this.contract
        // @ts-expect-error Error due to CommonJS vs ESM modules imports
        .connect(provider)
        .getIssuerAttributeRevisions(did, hash, page, pageSize);
    } catch (error) {
      if (isEthersError(error)) {
        this.logger.error(error, error.stack);
      }

      const contractError = getContractError(error);

      switch (contractError) {
        case "issuer does not exist": {
          throw new NotFoundError("Issuer Not Found", {
            detail: `Issuer ${did} not found`,
          });
        }
        case "attribute has not been found": {
          throw new NotFoundError("Attribute Not Found", {
            detail: `Attribute ${attributeId} not found`,
          });
        }
        default: {
          throw new NotFoundError("Not Found", {
            detail: contractError,
          });
        }
      }
    }
  }

  async getIssuerAttributeIdRevisions__deprecated(
    attributeId: string,
    did: string,
    page: number,
    pageSize: number,
  ): Promise<{ revisions: AttributeObject[]; total: number }> {
    const provider = this.ledgerService.getProvider();

    // This function assumes that the attributeId exists
    const hash = prefixWith0x(attributeId);

    try {
      const revisionHashes = await this.contract
        // @ts-expect-error Error due to CommonJS vs ESM modules imports
        .connect(provider)
        .getIssuerAttributeRevisions__deprecated(did, hash, page, pageSize);

      const revisions = revisionHashes.items.map((attr) => {
        const { attribData, attributeId, issuerType, rootTao, tao } = attr;
        const attributeData = Buffer.from(
          remove0xPrefix(attribData),
          "hex",
        ).toString();
        return {
          body: attributeData,
          hash: attributeId.slice(2),
          issuerType: IssuerTypeNames[Number(issuerType)]!,
          rootTao,
          tao,
        };
      });

      const total = Number(revisionHashes.total);

      return { revisions, total };
    } catch (error) {
      if (isEthersError(error)) {
        this.logger.error(error, error.stack);
      }

      const contractError = getContractError(error);

      switch (contractError) {
        case "issuer does not exist": {
          throw new NotFoundError("Issuer Not Found", {
            detail: `Issuer ${did} not found`,
          });
        }
        case "attribute has not been found": {
          throw new NotFoundError("Attribute Not Found", {
            detail: `Attribute ${attributeId} not found`,
          });
        }
        default: {
          throw new NotFoundError("Not Found", {
            detail: contractError,
          });
        }
      }
    }
  }

  async getIssuerProxies(did: string, page: number, pageSize: number) {
    const provider = this.ledgerService.getProvider();

    let proxies: Awaited<ReturnType<Tir["getIssuerProxies"]>>;

    try {
      proxies = await this.contract
        // @ts-expect-error Error due to CommonJS vs ESM modules imports
        .connect(provider)
        .getIssuerProxies(did, page, pageSize);
    } catch (error) {
      if (isEthersError(error)) {
        this.logger.error(error, error.stack);
      }
      throw new NotFoundError("Issuer Not Found", {
        detail: `Issuer ${did} not found`,
      });
    }

    return proxies;
  }

  async getIssuerProxy(did: string, proxyId: string) {
    const provider = this.ledgerService.getProvider();

    let proxy: Awaited<ReturnType<Tir["getIssuerProxyById"]>>;
    try {
      proxy = await this.contract
        // @ts-expect-error Error due to CommonJS vs ESM modules imports
        .connect(provider)
        .getIssuerProxyById(did, proxyId);
    } catch (error) {
      if (isEthersError(error)) {
        this.logger.error(error, error.stack);
      }

      const contractError = getContractError(error);

      switch (contractError) {
        case "issuer does not exist": {
          throw new NotFoundError("Issuer Not Found", {
            detail: `Issuer ${did} not found`,
          });
        }
        case "proxy not found": {
          throw new NotFoundError("Proxy Not Found", {
            detail: `Proxy ${proxyId} of issuer ${did} can't be found`,
          });
        }
        default: {
          throw new NotFoundError("Not Found", {
            detail: contractError,
          });
        }
      }
    }

    // Parse proxy string -> JSON Object
    try {
      return JSON.parse(proxy) as IssuerProxyResponseObject;
    } catch {
      throw new InternalServerError("Invalid Proxy", {
        detail: "The server was unable to parse the requested proxy",
      });
    }
  }

  async getIssuers(
    page: number,
    pageSize: number,
  ): ReturnType<Tir["getIssuers"]> {
    const provider = this.ledgerService.getProvider();

    try {
      return await this.contract
        // @ts-expect-error Error due to CommonJS vs ESM modules imports
        .connect(provider)
        .getIssuers(page, pageSize);
    } catch (error) {
      if (isEthersError(error)) {
        this.logger.error(error, error.stack);
      }
      throw new NotFoundError("Failed to get issuers", {
        detail: "Failed to get issuers",
      });
    }
  }

  async proxyRequest(did: string, proxyId: string, url: string, reqId: string) {
    const proxy = await this.getIssuerProxy(did, proxyId);

    // Extract subpath from request URL
    const found = /\/issuers\/.*\/proxies\/\w*\/(.*)$/.exec(url);
    if (!found?.[1]) {
      throw new BadRequestError("Invalid Proxy", {
        detail: "The server was unable to parse the requested proxy",
      });
    }
    const subpath = found[1];

    // Send request to issuer's endpoint
    const credRequestUrl = `${proxy.prefix}/${subpath}`;
    let res: AxiosResponse;
    try {
      res = await axios.get(credRequestUrl, {
        headers: proxy.headers,
        timeout: this.timeout,
      });
    } catch (error) {
      if (error instanceof Error) {
        this.logger.error(
          `Status List Credential ${credRequestUrl} unreachable - ${error.message}`,
        );
      }

      throw new InternalServerError("Unreachable Status List Credential", {
        detail: "The Status List Credential can't be retrieved",
      });
    }

    // Validate result (must be a valid StatusList2021Credential JWT)
    if (typeof res.data !== "string") {
      throw new InternalServerError("Invalid Status List Credential", {
        detail:
          "The Status List Credential returned by the Issuer's proxy is not a JWT",
      });
    }

    let payload: JWTPayload;

    try {
      payload = decodeJwt(res.data);
    } catch {
      throw new InternalServerError("Invalid Status List Credential", {
        detail:
          "The Status List Credential returned by the Issuer's proxy is not a JWT",
      });
    }

    let vcdmVersion: "1.1" | "2.0";
    let vcType: unknown[];

    if (
      "vc" in payload &&
      typeof payload["vc"] === "object" &&
      payload["vc"] &&
      "@context" in payload["vc"] &&
      Array.isArray(payload["vc"]["@context"]) &&
      payload["vc"]["@context"][0] === "https://www.w3.org/2018/credentials/v1"
    ) {
      vcdmVersion = "1.1";

      if (!("type" in payload["vc"]) || !Array.isArray(payload["vc"].type)) {
        throw new InternalServerError("Invalid Status List Credential", {
          detail:
            "The Status List Credential returned by the Issuer's proxy is not a VC JWT",
        });
      }

      vcType = payload["vc"].type;
    } else if (
      "@context" in payload &&
      Array.isArray(payload["@context"]) &&
      payload["@context"][0] === "https://www.w3.org/ns/credentials/v2"
    ) {
      vcdmVersion = "2.0";

      if (!("type" in payload) || !Array.isArray(payload["type"])) {
        throw new InternalServerError("Invalid Status List Credential", {
          detail:
            "The Status List Credential returned by the Issuer's proxy is not a VC JWT",
        });
      }

      vcType = payload["type"];
    } else {
      this.logger.error(`Unable to infer VCDM version in VP JWT ${res.data}`);
      throw new InternalServerError("Invalid Status List Credential", {
        detail:
          "The Status List Credential returned by the Issuer's proxy is not a VC JWT",
      });
    }

    if (
      !vcType.includes("StatusList2021Credential") &&
      !vcType.includes("BitstringStatusListCredential")
    ) {
      throw new InternalServerError("Invalid Status List Credential", {
        detail:
          "The Status List Credential returned by the Issuer's proxy is not a StatusList2021Credential nor a BitstringStatusListCredential JWT",
      });
    }

    const statusListValidation = await (
      vcType.includes("BitstringStatusListCredential")
        ? vcdmVersion === "1.1"
          ? checkVcdm11BitstringStatusListCredential
          : checkVcdm20BitstringStatusListCredential
        : checkStatusList2021Credential
    )(res.data, this.ebsiEnvConfig, reqId);

    if (!statusListValidation.success) {
      this.logger.error(
        `The Status List Credential returned by the Issuer's proxy is invalid: ${statusListValidation.error}`,
      );

      throw new InternalServerError("Invalid Status List Credential", {
        detail:
          "The Status List Credential returned by the Issuer's proxy is invalid",
      });
    }

    return res.data;
  }
}
