import type { ProxyFactory } from "@ebsiint-sc/trusted-contracts-registry-v1";

import { describe, expect, it } from "vitest";

import { formatContracts } from "./contracts.formatter.ts";

describe("formatContracts", () => {
  const contracts = {
    howMany: 3n,
    items: [
      "0xd06f39f1b07bdb5040665111ca96c63b100165f8e06ab2787d273d25ad6bb169",
      "0x99ab5f3cfc581c53a9210fc4588416fbc84b3ff09950ddc84e0efd1e2b2e147a",
      "0x4ed9c02a2c28de4ebfb274f8036d961062b05d8ea7a06682725d36224718e03e",
    ],
    next: 3n,
    prev: 1n,
    total: 42n,
  } as Awaited<ReturnType<ProxyFactory["getDeployedContracts"]>>;

  it("should use the values returned by the smart contract (except pageSize)", () => {
    expect.assertions(1);

    const page = 3;
    const pageSize = 2;

    expect(formatContracts(contracts, page, pageSize, "")).toStrictEqual({
      items: [
        {
          address:
            "0xd06f39f1b07bdb5040665111ca96c63b100165f8e06ab2787d273d25ad6bb169",
          href: "/0xd06f39f1b07bdb5040665111ca96c63b100165f8e06ab2787d273d25ad6bb169",
        },
        {
          address:
            "0x99ab5f3cfc581c53a9210fc4588416fbc84b3ff09950ddc84e0efd1e2b2e147a",
          href: "/0x99ab5f3cfc581c53a9210fc4588416fbc84b3ff09950ddc84e0efd1e2b2e147a",
        },
        {
          address:
            "0x4ed9c02a2c28de4ebfb274f8036d961062b05d8ea7a06682725d36224718e03e",
          href: "/0x4ed9c02a2c28de4ebfb274f8036d961062b05d8ea7a06682725d36224718e03e",
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
