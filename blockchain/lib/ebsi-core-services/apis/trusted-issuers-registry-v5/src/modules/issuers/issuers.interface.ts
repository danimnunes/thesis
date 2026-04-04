import { IssuerTypeNames } from "./issuers.constants.ts";

export interface AttributeDetailsObject {
  attribute: AttributeObject;
  did: string;
}

export interface AttributeObject {
  body: string;
  hash: string;
  issuerType: IssuerTypeName;
  rootTao: string;
  tao: string;
}

export interface DidLink {
  did: string;
  href: string;
}

export interface IdLink {
  href: string;
  id: string;
}

export interface IssuerProxyResponseObject {
  headers: Record<string, boolean | number | string>;
  prefix: string;
  testSuffix: string;
}

export interface IssuerResponseObject {
  attributes: string;
  did: string;
  hasAttributes: boolean;
}

export interface IssuerResponseObject__deprecated {
  attributes: AttributeObject[];
  did: string;
}

export type IssuerTypeName = (typeof IssuerTypeNames)[number];

export interface ProxyLink {
  href: string;
  proxyId: string;
}
