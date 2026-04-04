import type { Tir } from "@ebsiint-sc/trusted-issuers-registry-v5";

import { describe, expect, it } from "vitest";

import {
  formatAttributes,
  formatIssuers,
  formatProxies,
} from "./issuers.formatter.ts";

describe("formatIssuers", () => {
  const issuers = {
    howMany: 3n,
    items: ["0x001", "0x002", "0x003"],
    next: 3n,
    prev: 1n,
    total: 42n,
  } as Awaited<ReturnType<Tir["getIssuers"]>>;

  it("should use the values returned by the smart contract (except pageSize)", () => {
    expect.assertions(1);

    const page = 3;
    const pageSize = 2;

    expect(formatIssuers(issuers, page, pageSize, "")).toStrictEqual({
      items: [
        {
          did: "0x001",
          href: "/0x001",
        },
        {
          did: "0x002",
          href: "/0x002",
        },
        {
          did: "0x003",
          href: "/0x003",
        },
      ],
      links: {
        first: `?page[after]=1&page[size]=${pageSize}`,
        last: `?page[after]=21&page[size]=${pageSize}`,
        next: `?page[after]=${page + 1}&page[size]=${pageSize}`,
        prev: `?page[after]=${page - 1}&page[size]=${pageSize}`,
      },
      pageSize,
      self: `?page[after]=${page}&page[size]=${pageSize}`,
      total: 42,
    });
  });
});

describe("formatAttributes", () => {
  const attributes = {
    howMany: 3n,
    items: ["0x001", "0x002"],
    next: 3n,
    prev: 1n,
    total: 16n,
  } as Awaited<ReturnType<Tir["getIssuerAttributes"]>>;

  it("should display only the first 2 items", () => {
    expect.assertions(1);

    const page = 1;
    const pageSize = 2;

    expect(formatAttributes(attributes, page, 2, "")).toStrictEqual({
      items: [
        {
          href: "/001",
          id: "001",
        },
        {
          href: "/002",
          id: "002",
        },
      ],
      links: {
        first: `?page[after]=1&page[size]=${pageSize}`,
        last: `?page[after]=8&page[size]=${pageSize}`,
        next: `?page[after]=2&page[size]=${pageSize}`,
        prev: `?page[after]=1&page[size]=${pageSize}`,
      },
      pageSize,
      self: `?page[after]=${page}&page[size]=${pageSize}`,
      total: Number(attributes.total),
    });
  });
});

describe("formatProxies", () => {
  const proxies = {
    howMany: 2n,
    items: ["0xProxy1", "0xProxy2"],
    total: 2n,
  } as Awaited<ReturnType<Tir["getIssuerProxies"]>>;
  const baseUrl = "";

  it("should use the values returned by the smart contract (except pageSize)", () => {
    expect.assertions(1);
    const page = 1;
    const pageSize = 10;
    expect(formatProxies(proxies, page, pageSize, baseUrl)).toStrictEqual({
      items: [
        {
          href: "/0xProxy1",
          proxyId: "0xProxy1",
        },
        {
          href: "/0xProxy2",
          proxyId: "0xProxy2",
        },
      ],
      links: {
        first: `?page[after]=1&page[size]=${pageSize}`,
        last: `?page[after]=1&page[size]=${pageSize}`,
        next: `?page[after]=1&page[size]=${pageSize}`,
        prev: `?page[after]=1&page[size]=${pageSize}`,
      },
      pageSize,
      self: `?page[after]=${page}&page[size]=${pageSize}`,
      total: 2,
    });
  });
});
