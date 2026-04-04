import type { PolicyRegistry } from "@ebsiint-sc/trusted-policies-registry-v3";

import { describe, expect, it } from "vitest";

import type { SubjectPolicies } from "./subjects.interface.ts";

import { formatPolicies, formatSubjects } from "./subjects.formatter.ts";

describe("formatSubjects", () => {
  const subjects = {
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

    expect(formatSubjects(subjects, page, pageSize, "")).toStrictEqual({
      items: [
        {
          href: `/0x123456`,
          subject: "0x123456",
        },
        {
          href: "/0xab1234",
          subject: "0xab1234",
        },
        {
          href: "/0xcd1234",
          subject: "0xcd1234",
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

describe("formatPolicies", () => {
  const subjects = {
    items: ["attr1", "attr2", "attr3"],
    total: 42,
  } satisfies SubjectPolicies;

  it("should use the values returned by the smart contract (except pageSize)", () => {
    expect.assertions(1);

    const page = 3;
    const pageSize = 2;

    expect(formatPolicies(subjects, page, pageSize, "")).toStrictEqual({
      items: [
        {
          href: "/attr1",
          policyName: "attr1",
        },
        {
          href: "/attr2",
          policyName: "attr2",
        },
        {
          href: "/attr3",
          policyName: "attr3",
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
