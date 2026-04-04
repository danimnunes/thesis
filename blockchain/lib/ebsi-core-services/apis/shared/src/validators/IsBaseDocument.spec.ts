import { describe, expect, it } from "vitest";

import { isBaseDocument } from "./IsBaseDocument.ts";

describe("isBaseDocument", () => {
  it("should validate if it is a valid base document", () => {
    // bad context
    expect(isBaseDocument("")).toStrictEqual({
      error: "baseDocument must be a stringified JSON document",
      success: false,
    });
    expect(isBaseDocument("bad-context")).toStrictEqual({
      error: "baseDocument must be a stringified JSON document",
      success: false,
    });
    expect(isBaseDocument("{}")).toStrictEqual({
      error: "'@context' attribute is missing",
      success: false,
    });
    expect(isBaseDocument('{"noContext":"bad"}')).toStrictEqual({
      error: "'@context' attribute is missing",
      success: false,
    });
    expect(isBaseDocument('{"@context":""}')).toStrictEqual({
      error: "'@context' attribute is missing",
      success: false,
    });
    expect(isBaseDocument('{"@context":[]}')).toStrictEqual({
      error:
        "'@context' attribute must be 'https://www.w3.org/ns/did/v1' or an array with 'https://www.w3.org/ns/did/v1' as first element",
      success: false,
    });
    expect(isBaseDocument('{"@context":["bad-context"]}')).toStrictEqual({
      error:
        "'@context' attribute must be 'https://www.w3.org/ns/did/v1' or an array with 'https://www.w3.org/ns/did/v1' as first element",
      success: false,
    });

    // good context
    expect(
      isBaseDocument('{"@context":"https://www.w3.org/ns/did/v1"}'),
    ).toStrictEqual({ success: true });
    expect(
      isBaseDocument('{"@context":["https://www.w3.org/ns/did/v1"]}'),
    ).toStrictEqual({ success: true });
    expect(
      isBaseDocument(
        '{"@context":["https://www.w3.org/ns/did/v1","https://w3id.org/security/suites/jws-2020/v1"]}',
      ),
    ).toStrictEqual({ success: true });

    // no restricted fields (singular)
    expect(
      isBaseDocument(
        '{"@context":["https://www.w3.org/ns/did/v1"],"controller":"did:ebsi:z25jWQYxVzeL2z2fiYesZj9M"}',
      ),
    ).toStrictEqual({
      error: "attribute 'controller' is not allowed",
      success: false,
    });

    // no restricted fields (plural)
    expect(
      isBaseDocument(
        '{"@context":["https://www.w3.org/ns/did/v1"],"controller":"did:ebsi:z25jWQYxVzeL2z2fiYesZj9M", "id": "0x00"}',
      ),
    ).toStrictEqual({
      error: "attributes 'id', 'controller' are not allowed",
      success: false,
    });
  });
});
