import type { PaginatedList } from "@ebsiint-api/shared";
import type { Tir } from "@ebsiint-sc/trusted-issuers-registry-v5";

import { paginate, remove0xPrefix } from "@ebsiint-api/shared";

import type {
  AttributeObject,
  DidLink,
  IdLink,
  ProxyLink,
} from "./issuers.interface.ts";

export function formatAttributes(
  attributes: Awaited<ReturnType<Tir["getIssuerAttributes"]>>,
  page: number,
  pageSize: number,
  baseUrl: string,
): PaginatedList<IdLink> {
  const total = Number(attributes.total);

  // Reshape items
  const items = attributes.items.map((attrId) => {
    const id = remove0xPrefix(attrId);
    return {
      href: `${baseUrl}/${id}`,
      id,
    };
  });

  return paginate<IdLink>(items, baseUrl, total, page, pageSize);
}

export function formatIssuers(
  issuers: Awaited<ReturnType<Tir["getIssuers"]>>,
  page: number,
  pageSize: number,
  baseUrl: string,
): PaginatedList<DidLink> {
  const total = Number(issuers.total);

  // Reshape items
  const items = issuers.items.map((did) => ({
    did,
    href: `${baseUrl}/${did}`,
  }));

  return paginate<DidLink>(items, baseUrl, total, page, pageSize);
}

export function formatProxies(
  issuerProxies: Awaited<ReturnType<Tir["getIssuerProxies"]>>,
  page: number,
  pageSize: number,
  baseUrl: string,
): PaginatedList<ProxyLink> {
  const total = Number(issuerProxies.total);

  const items: ProxyLink[] = issuerProxies.items.map((proxyId) => ({
    href: `${baseUrl}/${proxyId}`,
    proxyId,
  }));

  return paginate<ProxyLink>(items, baseUrl, total, page, pageSize);
}

export function formatRevisions(
  attributes: Awaited<ReturnType<Tir["getIssuerAttributeRevisions"]>>,
  page: number,
  pageSize: number,
  baseUrl: string,
  version: string | undefined,
): PaginatedList<IdLink> {
  const total = Number(attributes.total);
  const extraQuery = version ? `&version=${version}` : "";

  // Reshape items
  const items = attributes.items.map((attrId) => {
    const id = remove0xPrefix(attrId);
    return {
      href: `${baseUrl}/${id}`,
      id,
    };
  });

  return paginate<IdLink>(items, baseUrl, total, page, pageSize, extraQuery);
}

export function formatRevisions__deprecated(
  revisions: AttributeObject[],
  total: number,
  page: number,
  pageSize: number,
  baseUrl: string,
  version: string | undefined,
): PaginatedList<AttributeObject> {
  const extraQuery = version ? `&version=${version}` : "";

  return paginate<AttributeObject>(
    revisions,
    baseUrl,
    total,
    page,
    pageSize,
    extraQuery,
  );
}
