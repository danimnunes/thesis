import { describe, expect, it } from "vitest";

import { encode } from "./encode.utils.ts";

describe("encode", () => {
  it("should convert a public key from hex to jwk", () => {
    expect.assertions(2);
    const publicKeyHex =
      "043B7137065A518C1EBD7E7B19A5F6850E6973E1872DB9C189A6C19B6961C5584D66698D1FAEDE57EE3AA4C37FA48D70588A8C28D51CA9690A9AB2E466A784A30E";
    const publicKeyJwk = {
      crv: "secp256k1",
      kty: "EC",
      x: "O3E3BlpRjB69fnsZpfaFDmlz4YctucGJpsGbaWHFWE0",
      y: "ZmmNH67eV-46pMN_pI1wWIqMKNUcqWkKmrLkZqeEow4",
    };
    expect(encode.publicKey.fromHexToJWK(publicKeyHex)).toStrictEqual(
      publicKeyJwk,
    );
    expect(encode.publicKey.fromHexToJWK(`0x${publicKeyHex}`)).toStrictEqual(
      publicKeyJwk,
    );
  });
});
