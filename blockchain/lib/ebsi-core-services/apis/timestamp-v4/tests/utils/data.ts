/**
 * Collection of functions for generating fake data to be used in the tests.
 */
import type { DIDDocument, JsonWebKey } from "did-resolver";

import { encode } from "@ebsiint-api/shared";
import { EbsiWallet } from "@europeum-ebsi/wallet-lib";
import { ethers } from "ethers";
import { calculateJwkThumbprint } from "jose";

export interface UserDetails {
  did: string;
  didDocument: DIDDocument;
  kid: string;
  privateKeyJwk: JsonWebKey;
  publicKeyJwk: JsonWebKey;
  thumbprint: string;
  wallet: ethers.BaseWallet;
}

export async function createUser(wallet?: ethers.Wallet): Promise<UserDetails> {
  const did = EbsiWallet.createDid();
  const w = wallet ?? ethers.Wallet.createRandom();
  const privateKeyJwk = encode.privateKey.fromHexToJWK(
    w.privateKey,
  ) as unknown as JsonWebKey;
  const publicKeyJwk = encode.publicKey.fromHexToJWK(
    w.signingKey.publicKey,
  ) as unknown as JsonWebKey;
  const thumbprint = await calculateJwkThumbprint(publicKeyJwk, "sha256");

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
    did,
    didDocument,
    kid,
    privateKeyJwk,
    publicKeyJwk,
    thumbprint,
    wallet: w,
  };
}
