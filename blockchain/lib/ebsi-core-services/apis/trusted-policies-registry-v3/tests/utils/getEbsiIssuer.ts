import type { EbsiIssuer } from "@europeum-ebsi/verifiable-credential";

import { getPublicKeyJwk, getSigner } from "@ebsiint-api/shared";

export async function getEbsiIssuer(
  privateKey: Uint8Array,
  did: string,
  kid?: string,
) {
  const issuerPublicKeyJwk = await getPublicKeyJwk(privateKey, "ES256");

  const issuer = {
    alg: "ES256",
    did,
    kid: kid ?? `${did}#${issuerPublicKeyJwk.kid}`,
    signer: getSigner(privateKey, "ES256"),
  } satisfies EbsiIssuer;

  return issuer;
}
