import type { PolicyRegistry } from "@ebsiint-sc/trusted-policies-registry-v3";

import { describe, expect, it } from "vitest";

import { formatPolicies } from "./policies.formatter.ts";

describe("formatPolicies", () => {
  const policies = {
    howMany: 3n,
    items: ["my-policy-1", "my-policy-2", "my-policy-3"],
    next: 3n,
    prev: 1n,
    total: 42n,
  } as Awaited<ReturnType<PolicyRegistry["getPolicyNames"]>>;

  it("should use the values returned by the smart contract (except pageSize)", () => {
    expect.assertions(1);

    const page = 3;
    const pageSize = 2;

    expect(formatPolicies(policies, page, pageSize, "")).toStrictEqual({
      items: [
        {
          href: `/my-policy-1`,
          policyName: "my-policy-1",
        },
        {
          href: "/my-policy-2",
          policyName: "my-policy-2",
        },
        {
          href: "/my-policy-3",
          policyName: "my-policy-3",
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
