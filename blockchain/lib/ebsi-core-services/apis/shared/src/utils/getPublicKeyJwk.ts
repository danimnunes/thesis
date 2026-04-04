import { bytesToBase64url, hexToBytes } from "@europeum-ebsi/did-jwt";
import { ed25519 } from "@noble/curves/ed25519.js";
import { p256 } from "@noble/curves/nist.js";
import { secp256k1 } from "@noble/curves/secp256k1.js";
import { calculateJwkThumbprint } from "jose";

export async function getPublicKeyJwk(
  privateKey: Uint8Array,
  alg: "EdDSA" | "ES256" | "ES256K",
) {
  if (alg === "ES256K") {
    const pubKeyBytes = secp256k1.getPublicKey(privateKey, false);
    const point = secp256k1.Point.fromBytes(pubKeyBytes).toAffine();

    const jwk = {
      crv: "secp256k1",
      kty: "EC",
      x: bytesToBase64url(hexToBytes(point.x.toString(16))),
      y: bytesToBase64url(hexToBytes(point.y.toString(16))),
    } as const;

    const kid = await calculateJwkThumbprint(jwk);

    return {
      ...jwk,
      alg,
      kid,
    };
  }

  if (alg === "ES256") {
    const pubKeyBytes = p256.getPublicKey(privateKey, false);
    const point = p256.Point.fromBytes(pubKeyBytes).toAffine();
    const jwk = {
      crv: "P-256",
      kty: "EC",
      x: bytesToBase64url(hexToBytes(point.x.toString(16))),
      y: bytesToBase64url(hexToBytes(point.y.toString(16))),
    } as const;

    const kid = await calculateJwkThumbprint(jwk);

    return {
      ...jwk,
      alg,
      kid,
    };
  }

  if (alg === "EdDSA") {
    const publicKey = ed25519.getPublicKey(privateKey);

    const jwk = {
      crv: "Ed25519",
      kty: "OKP",
      x: bytesToBase64url(publicKey),
    } as const;

    const kid = await calculateJwkThumbprint(jwk);

    return {
      ...jwk,
      alg,
      kid,
    };
  }

  throw new Error(`Unsupported algorithm ${alg as string}`);
}
