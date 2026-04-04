import type { EbsiIssuer } from "@europeum-ebsi/verifiable-credential";

import { getPublicKeyJwk, getSigner } from "@ebsiint-api/shared";
import { hexToBytes } from "@europeum-ebsi/did-jwt";

export async function getEbsiIssuer(
  privateKeyHex: string,
  did: string,
  kid?: string,
) {
  const privateKey = hexToBytes(privateKeyHex);
  const publicKeyJwk = await getPublicKeyJwk(privateKey, "ES256");

  const issuer: EbsiIssuer = {
    alg: "ES256",
    did,
    kid: kid ?? `${did}#${publicKeyJwk.kid}`,
    signer: getSigner(privateKey, "ES256"),
  };
  return issuer;
}
