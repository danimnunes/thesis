import type { PolicyRegistry } from "@ebsiint-sc/trusted-policies-registry-v3";

import { describe, expect, it } from "vitest";

import { formatUsers } from "./users.formatter.ts";

describe("formatUsers", () => {
  const users = {
    howMany: 3n,
    items: ["0x123456", "0xab1234", "0xcd1234"],
    next: 3n,
    prev: 1n,
    total: 42n,
  } as Awaited<ReturnType<PolicyRegistry["getPolicyNames"]>>;

  it("should use the values returned by the smart contract (except pageSize)", () => {
    expect.assertions(1);

    const page = 3;
    const pageSize = 2;

    expect(formatUsers(users, page, pageSize, "")).toStrictEqual({
      items: [
        {
          href: `/0x123456`,
          user: "0x123456",
        },
        {
          href: "/0xab1234",
          user: "0xab1234",
        },
        {
          href: "/0xcd1234",
          user: "0xcd1234",
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
