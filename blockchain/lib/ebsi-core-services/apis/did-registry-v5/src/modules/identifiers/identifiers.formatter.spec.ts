import type { DidRegistry } from "@ebsiint-sc/did-registry-v5";

import { describe, expect, it } from "vitest";

import { formatIdentifiers } from "./identifiers.formatter.ts";

describe("formatIdentifiers", () => {
  const identifiers = {
    howMany: 3n,
    items: [
      "did:ebsi:z224tCapjMEJEdLU6n1iG2yH",
      "did:ebsi:zsG1AGXCuZ46tSAE2UT6kdE",
      "did:ebsi:zjNQGmQjYQ6Wo3o5A7QnjR9",
    ],
    next: 3n,
    prev: 1n,
    total: 42n,
  } as Awaited<ReturnType<DidRegistry["getDids"]>>;

  it("should use the values returned by the smart contract (except pageSize)", () => {
    expect.assertions(1);

    const page = 3;
    const pageSize = 2;

    expect(formatIdentifiers(identifiers, page, pageSize, "")).toStrictEqual({
      items: [
        {
          did: "did:ebsi:z224tCapjMEJEdLU6n1iG2yH",
          href: "/did:ebsi:z224tCapjMEJEdLU6n1iG2yH",
        },
        {
          did: "did:ebsi:zsG1AGXCuZ46tSAE2UT6kdE",
          href: "/did:ebsi:zsG1AGXCuZ46tSAE2UT6kdE",
        },
        {
          did: "did:ebsi:zjNQGmQjYQ6Wo3o5A7QnjR9",
          href: "/did:ebsi:zjNQGmQjYQ6Wo3o5A7QnjR9",
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
