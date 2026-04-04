import type { JWK, KeyLike } from "jose";

import { EbsiWallet } from "@europeum-ebsi/wallet-lib";
import elliptic from "elliptic";
import { ethers } from "ethers";
import { calculateJwkThumbprint, importJWK } from "jose";

const EC = elliptic.ec;

export interface UserData {
  baseDocument: string;
  did: string;
  ES256: {
    privateKey: KeyLike | Uint8Array;
    privateKeyJwk: JWK;
    publicKeyHex: string;
    publicKeyJwk: JWK;
    vMethodId: string;
  };
  ES256K: {
    privateKey: KeyLike | Uint8Array;
    privateKeyJwk: JWK;
    publicKeyHex: string;
    publicKeyJwk: JWK;
    vMethodId: string;
  };
  notAfter: number;
  notBefore: number;
}

export async function generateDidParams(
  wallet: ethers.BaseWallet,
): Promise<UserData> {
  const did = EbsiWallet.createDid();
  const baseDocument = JSON.stringify({
    "@context": [
      "https://www.w3.org/ns/did/v1",
      "https://w3id.org/security/suites/jws-2020/v1",
    ],
  });
  const jwksES256K = getJwks(wallet.privateKey, "ES256K");
  const jwksES256 = getJwks(wallet.privateKey, "ES256");
  const notBefore = Math.floor(Date.now() / 1000);
  const notAfter = notBefore + 84_600 * 365 * 5;
  return {
    baseDocument,
    did,
    ES256: {
      ...jwksES256,
      privateKey: await importJWK(jwksES256.privateKeyJwk, "ES256"),
      publicKeyHex: `0x${Buffer.from(JSON.stringify(jwksES256.publicKeyJwk)).toString("hex")}`,
      vMethodId: await calculateJwkThumbprint(jwksES256.publicKeyJwk, "sha256"),
    },
    ES256K: {
      ...jwksES256K,
      privateKey: await importJWK(jwksES256K.privateKeyJwk, "ES256K"),
      publicKeyHex: wallet.signingKey.publicKey,
      vMethodId: await calculateJwkThumbprint(
        jwksES256K.publicKeyJwk,
        "sha256",
      ),
    },
    notAfter,
    notBefore,
  };
}

/** Base64url-encode bytes (no padding, URL-safe). Avoids ESM-only multiformats subpath under CJS (e.g. Hardhat). */
function base64urlEncode(data: Buffer | Uint8Array): string {
  const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
  return buf
    .toString("base64")
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

function getJwks(privateKeyHex: string, alg: "ES256" | "ES256K") {
  const ec = alg === "ES256" ? new EC("p256") : new EC("secp256k1");
  const privateKey = removePrefix0x(privateKeyHex);
  const keyPair = ec.keyFromPrivate(privateKey, "hex");
  const validation = keyPair.validate();
  if (validation.result === false) {
    throw new Error(validation.reason);
  }
  const pubPoint = keyPair.getPublic();
  const curve = alg === "ES256" ? "P-256" : "secp256k1";
  const publicKeyJwk = {
    crv: curve,
    kty: "EC",
    x: base64urlEncode(pubPoint.getX().toBuffer("be", 32)),
    y: base64urlEncode(pubPoint.getY().toBuffer("be", 32)),
  };
  const privateKeyJwk = {
    ...publicKeyJwk,
    d: base64urlEncode(Buffer.from(privateKey, "hex")),
  };
  return { privateKeyJwk, publicKeyJwk };
}

function removePrefix0x(key: string): string {
  return key.startsWith("0x") ? key.slice(2) : key;
}
