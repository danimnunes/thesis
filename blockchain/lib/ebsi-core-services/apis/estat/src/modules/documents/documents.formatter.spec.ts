import type { TrackAndTrace } from "@ebsiint-sc/track-and-trace";

import { describe, expect, it } from "vitest";

import type { DocumentAccesses } from "./documents.interface.ts";

import {
  formatDocumentAccesses,
  formatDocumentEvents,
  formatDocuments,
} from "./documents.formatter.ts";

describe("formatDocuments", () => {
  const documents = {
    howMany: 3n,
    items: [
      "0xd06f39f1b07bdb5040665111ca96c63b100165f8e06ab2787d273d25ad6bb169",
      "0x99ab5f3cfc581c53a9210fc4588416fbc84b3ff09950ddc84e0efd1e2b2e147a",
      "0x4ed9c02a2c28de4ebfb274f8036d961062b05d8ea7a06682725d36224718e03e",
    ],
    total: 42n,
  } as Awaited<ReturnType<TrackAndTrace["getDocuments"]>>;

  it("should use the values returned by the smart contract (except pageSize)", () => {
    expect.assertions(1);

    const page = 3;
    const pageSize = 2;

    expect(formatDocuments(documents, page, pageSize, "")).toStrictEqual({
      items: [
        {
          documentId:
            "0xd06f39f1b07bdb5040665111ca96c63b100165f8e06ab2787d273d25ad6bb169",
          href: "/0xd06f39f1b07bdb5040665111ca96c63b100165f8e06ab2787d273d25ad6bb169",
        },
        {
          documentId:
            "0x99ab5f3cfc581c53a9210fc4588416fbc84b3ff09950ddc84e0efd1e2b2e147a",
          href: "/0x99ab5f3cfc581c53a9210fc4588416fbc84b3ff09950ddc84e0efd1e2b2e147a",
        },
        {
          documentId:
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

describe("formatDocumentEvents", () => {
  const events = {
    howMany: 3n,
    items: [
      "0xd06f39f1b07bdb5040665111ca96c63b100165f8e06ab2787d273d25ad6bb169",
      "0x99ab5f3cfc581c53a9210fc4588416fbc84b3ff09950ddc84e0efd1e2b2e147a",
      "0x4ed9c02a2c28de4ebfb274f8036d961062b05d8ea7a06682725d36224718e03e",
    ],
    total: 42n,
  } as Awaited<ReturnType<TrackAndTrace["getDocuments"]>>;

  it("should use the values returned by the smart contract (except pageSize)", () => {
    expect.assertions(1);

    const page = 3;
    const pageSize = 2;

    expect(formatDocumentEvents(events, page, pageSize, "")).toStrictEqual({
      items: [
        {
          eventId:
            "0xd06f39f1b07bdb5040665111ca96c63b100165f8e06ab2787d273d25ad6bb169",
          href: "/0xd06f39f1b07bdb5040665111ca96c63b100165f8e06ab2787d273d25ad6bb169",
        },
        {
          eventId:
            "0x99ab5f3cfc581c53a9210fc4588416fbc84b3ff09950ddc84e0efd1e2b2e147a",
          href: "/0x99ab5f3cfc581c53a9210fc4588416fbc84b3ff09950ddc84e0efd1e2b2e147a",
        },
        {
          eventId:
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

describe("formatDocumentAccesses", () => {
  const accesses = [
    {
      documentId:
        "0xd06f39f1b07bdb5040665111ca96c63b100165f8e06ab2787d273d25ad6bb169",
      grantedBy: "did:ebsi:zbymX5AX8D2ibRy6EgxQVEu",
      permission: "creator",
      subject: "did:ebsi:zbymX5AX8D2ibRy6EgxQVEu",
    },
    {
      documentId:
        "0xd06f39f1b07bdb5040665111ca96c63b100165f8e06ab2787d273d25ad6bb169",
      grantedBy: "did:ebsi:zbymX5AX8D2ibRy6EgxQVEu",
      permission: "delegate",
      subject: "did:ebsi:zhbiAY9JHxAxao5vGUCq2RT",
    },
    {
      documentId:
        "0xd06f39f1b07bdb5040665111ca96c63b100165f8e06ab2787d273d25ad6bb169",
      grantedBy: "did:ebsi:zbymX5AX8D2ibRy6EgxQVEu",
      permission: "write",
      subject: "did:ebsi:zhbiAY9JHxAxao5vGUCq2RT",
    },
  ] satisfies DocumentAccesses;

  it("should use filter the values returned by the DocumentsService", () => {
    expect.assertions(3);

    const pageSize = 2;

    // First page
    let page = 1;
    expect(formatDocumentAccesses(accesses, page, pageSize, "")).toStrictEqual({
      items: [
        {
          documentId:
            "0xd06f39f1b07bdb5040665111ca96c63b100165f8e06ab2787d273d25ad6bb169",
          grantedBy: "did:ebsi:zbymX5AX8D2ibRy6EgxQVEu",
          permission: "creator",
          subject: "did:ebsi:zbymX5AX8D2ibRy6EgxQVEu",
        },
        {
          documentId:
            "0xd06f39f1b07bdb5040665111ca96c63b100165f8e06ab2787d273d25ad6bb169",
          grantedBy: "did:ebsi:zbymX5AX8D2ibRy6EgxQVEu",
          permission: "delegate",
          subject: "did:ebsi:zhbiAY9JHxAxao5vGUCq2RT",
        },
      ],
      links: {
        first: `?page[after]=1&page[size]=${pageSize}`,
        last: `?page[after]=2&page[size]=${pageSize}`,
        next: `?page[after]=2&page[size]=${pageSize}`,
        prev: `?page[after]=1&page[size]=${pageSize}`,
      },
      pageSize,
      self: `?page[after]=${page}&page[size]=${pageSize}`,
      total: 3,
    });

    // Second page
    page = 2;
    expect(formatDocumentAccesses(accesses, page, pageSize, "")).toStrictEqual({
      items: [
        {
          documentId:
            "0xd06f39f1b07bdb5040665111ca96c63b100165f8e06ab2787d273d25ad6bb169",
          grantedBy: "did:ebsi:zbymX5AX8D2ibRy6EgxQVEu",
          permission: "write",
          subject: "did:ebsi:zhbiAY9JHxAxao5vGUCq2RT",
        },
      ],
      links: {
        first: `?page[after]=1&page[size]=${pageSize}`,
        last: `?page[after]=2&page[size]=${pageSize}`,
        next: `?page[after]=2&page[size]=${pageSize}`,
        prev: `?page[after]=1&page[size]=${pageSize}`,
      },
      pageSize,
      self: `?page[after]=${page}&page[size]=${pageSize}`,
      total: 3,
    });

    // Empty page
    page = 3;
    expect(formatDocumentAccesses(accesses, page, pageSize, "")).toStrictEqual({
      items: [],
      links: {
        first: `?page[after]=1&page[size]=${pageSize}`,
        last: `?page[after]=2&page[size]=${pageSize}`,
        next: `?page[after]=2&page[size]=${pageSize}`,
        prev: `?page[after]=2&page[size]=${pageSize}`,
      },
      pageSize,
      self: `?page[after]=${page}&page[size]=${pageSize}`,
      total: 3,
    });
  });
});
