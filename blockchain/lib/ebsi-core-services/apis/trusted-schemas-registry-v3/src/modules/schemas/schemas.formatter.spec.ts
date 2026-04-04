import { describe, expect, it } from "vitest";

import type { ItemsList } from "./schemas.interface.ts";

import {
  formatSchemaRevisionMetadataList,
  formatSchemaRevisions,
  formatSchemas,
} from "./schemas.formatter.ts";

describe("formatSchemas", () => {
  const schemas: ItemsList = {
    items: ["0x1234", "0x5678"],
    total: 42,
  };

  it("should use the values returned by the smart contract (except pageSize)", () => {
    expect.assertions(1);

    const page = 3;
    const pageSize = 2;

    expect(formatSchemas(schemas, page, pageSize, "")).toStrictEqual({
      items: [
        {
          href: "/z2PM",
          schemaId: "z2PM",
        },
        {
          href: "/z7af",
          schemaId: "z7af",
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

describe("formatSchemaRevisions", () => {
  const schemaRevisions: ItemsList = {
    items: ["rev-id", "rev-id-2"],
    total: 42,
  };

  it("should use the values returned by the smart contract (except pageSize)", () => {
    expect.assertions(2);

    const page = 3;
    const pageSize = 2;

    expect(
      formatSchemaRevisions(schemaRevisions, page, pageSize, "", "", ""),
    ).toStrictEqual({
      items: [
        {
          href: "/rev-id",
          schemaRevisionId: "rev-id",
        },
        {
          href: "/rev-id-2",
          schemaRevisionId: "rev-id-2",
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

    // With "valid-at" in the query
    const validAt = new Date().toISOString();

    expect(
      formatSchemaRevisions(
        schemaRevisions,
        page,
        pageSize,
        "",
        validAt,
        "deprecated",
      ),
    ).toStrictEqual({
      items: [
        {
          href: "/rev-id",
          schemaRevisionId: "rev-id",
        },
        {
          href: "/rev-id-2",
          schemaRevisionId: "rev-id-2",
        },
      ],
      links: {
        first: `?page[after]=1&page[size]=${pageSize}&valid-at=${validAt}&version=deprecated`,
        last: `?page[after]=21&page[size]=${pageSize}&valid-at=${validAt}&version=deprecated`,
        next: `?page[after]=${
          page + 1
        }&page[size]=${pageSize}&valid-at=${validAt}&version=deprecated`,
        prev: `?page[after]=${
          page - 1
        }&page[size]=${pageSize}&valid-at=${validAt}&version=deprecated`,
      },
      pageSize,
      self: `?page[after]=${page}&page[size]=${pageSize}&valid-at=${validAt}&version=deprecated`,
      total: 42,
    });
  });
});

describe("formatSchemaRevisionMetadataList", () => {
  const metadata: ItemsList = {
    items: ["meta-id", "meta-id-2"],
    total: 42,
  };

  it("should use the values returned by the smart contract (except pageSize)", () => {
    expect.assertions(1);

    const page = 3;
    const pageSize = 2;

    expect(
      formatSchemaRevisionMetadataList(metadata, page, pageSize, ""),
    ).toStrictEqual({
      items: [
        {
          href: "/meta-id",
          metadataId: "meta-id",
        },
        {
          href: "/meta-id-2",
          metadataId: "meta-id-2",
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
