import type { Timestamp } from "@ebsiint-sc/timestamp-v4";

import { multibase } from "@ebsiint-api/shared";
import crypto from "node:crypto";
import { describe, expect, it } from "vitest";

import { formatRecords, formatRecordVersions } from "./records.formatter.ts";

describe("formatRecords", () => {
  const records = {
    howMany: 2n,
    items: [
      `0x${crypto.randomBytes(32).toString("hex")}`,
      `0x${crypto.randomBytes(32).toString("hex")}`,
    ],
    next: 0n,
    prev: 0n,
    total: 42n,
  } as Awaited<ReturnType<Timestamp["getRecordIds"]>>;

  it("should use the values returned by the smart contract (except pageSize)", () => {
    expect.assertions(1);

    const page = 3;
    const pageSize = 2;

    const recordIds = [
      multibase.base64url.encode(
        Buffer.from(records.items[0]!.replace(/^0x/, ""), "hex"),
      ),
      multibase.base64url.encode(
        Buffer.from(records.items[1]!.replace(/^0x/, ""), "hex"),
      ),
    ];

    expect(
      formatRecords(records, page, pageSize, "", "?test=true"),
    ).toStrictEqual({
      items: [
        {
          href: `/${recordIds[0]}`,
          recordId: recordIds[0],
        },
        {
          href: `/${recordIds[1]}`,
          recordId: recordIds[1],
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

describe("formatRecordVersions", () => {
  const totalVersions = 20;

  it("should format record versions", () => {
    expect.assertions(1);

    const page = 3;
    const pageSize = 2;

    expect(
      formatRecordVersions(totalVersions, page, pageSize, "", "?test=true"),
    ).toStrictEqual({
      items: [
        {
          href: "/4",
          versionId: 4,
        },
        {
          href: "/5",
          versionId: 5,
        },
      ],
      links: {
        first: `?page[after]=1&page[size]=${pageSize}?test=true`,
        last: `?page[after]=10&page[size]=${pageSize}?test=true`,
        next: `?page[after]=${page + 1}&page[size]=${pageSize}?test=true`,
        prev: `?page[after]=${page - 1}&page[size]=${pageSize}?test=true`,
      },
      pageSize,
      self: `?page[after]=${page}&page[size]=${pageSize}?test=true`,
      total: totalVersions,
    });
  });
});
