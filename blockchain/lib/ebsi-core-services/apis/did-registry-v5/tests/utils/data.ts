import type { EbsiIssuer } from "@europeum-ebsi/verifiable-credential";
/**
 * Collection of functions for generating fake data to be used in the tests.
 */
import type { DIDDocument } from "did-resolver";

import { getPublicKeyJwk, getSigner } from "@ebsiint-api/shared";
import { hexToBytes } from "@europeum-ebsi/did-jwt";
import { EbsiWallet } from "@europeum-ebsi/wallet-lib";
import { ethers } from "ethers";

export interface UserDetails extends EbsiIssuer {
  didDocument: DIDDocument;
  thumbprint: string;
  wallet: ethers.BaseWallet;
}

export async function createUser(
  wallet?: ethers.BaseWallet,
): Promise<UserDetails> {
  const did = EbsiWallet.createDid();
  const w = wallet ?? ethers.Wallet.createRandom();
  const privateKey = hexToBytes(w.privateKey);
  const {
    alg,
    kid: publicKeyJwkKid,
    ...publicKeyJwk
  } = await getPublicKeyJwk(privateKey, "ES256K");
  const thumbprint = publicKeyJwkKid;

  const kid = `${did}#${thumbprint}`;
  const didDocument = {
    "@context": [
      "https://www.w3.org/ns/did/v1",
      "https://w3id.org/security/suites/jws-2020/v1",
    ],
    assertionMethod: [kid],
    authentication: [kid],
    capabilityInvocation: [kid],
    controller: [did],
    id: did,
    verificationMethod: [
      {
        controller: did,
        id: kid,
        publicKeyJwk,
        type: "JsonWebKey2020",
      },
    ],
  };

  return {
    alg,
    did,
    didDocument,
    kid,
    signer: getSigner(privateKey, alg),
    thumbprint,
    wallet: w,
  };
}
