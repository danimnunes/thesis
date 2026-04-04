import type { Timestamp } from "@ebsiint-sc/timestamp-v4";

import { describe, expect, it } from "vitest";

import { formatHashAlgorithms } from "./hash-algorithms.formatter.ts";

describe("formatHashAlgorithms", () => {
  const hashAlgorithms = {
    howMany: 2n,
    items: [1n, 2n],
    next: 0n,
    prev: 0n,
    total: 42n,
  } as Awaited<ReturnType<Timestamp["getHashAlgorithms"]>>;

  it("should use the values returned by the smart contract (except pageSize)", () => {
    expect.assertions(1);

    const page = 3;
    const pageSize = 2;

    expect(
      formatHashAlgorithms(hashAlgorithms, page, pageSize, "", "?test=true"),
    ).toStrictEqual({
      items: [
        {
          hashAlgorithmId: 1,
          href: "/1",
        },
        {
          hashAlgorithmId: 2,
          href: "/2",
        },
      ],
      links: {
        first: `?page[after]=1&page[size]=${pageSize}?test=true`,
        last: `?page[after]=21&page[size]=${pageSize}?test=true`,
        next: `?page[after]=${page + 1}&page[size]=${pageSize}?test=true`,
        prev: `?page[after]=${page - 1}&page[size]=${pageSize}?test=true`,
      },
      pageSize,
      self: `?page[after]=${page}&page[size]=${pageSize}?test=true`,
      total: 42,
    });
  });
});
