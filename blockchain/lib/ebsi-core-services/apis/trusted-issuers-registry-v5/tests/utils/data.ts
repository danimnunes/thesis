import type { DIDDocument, JsonWebKey } from "did-resolver";
import type { JWK } from "jose";

export function createDidDocument(
  did: string,
  kid: string,
  publicKeyJwk: JWK,
): DIDDocument {
  return {
    "@context": [
      "https://www.w3.org/ns/did/v1",
      "https://w3id.org/security/suites/jws-2020/v1",
    ],
    assertionMethod: [kid],
    authentication: [kid],
    id: did,
    verificationMethod: [
      {
        controller: did,
        id: kid,
        publicKeyJwk: publicKeyJwk as JsonWebKey,
        type: "JsonWebKey2020",
      },
    ],
  };
}
