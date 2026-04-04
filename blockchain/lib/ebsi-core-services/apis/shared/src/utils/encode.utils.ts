import type { JWK } from "jose";

import { KeyEncoder } from "@europeum-ebsi/key-encoder";
import elliptic from "elliptic";
import { bases, bytes } from "multiformats/basics";

const { base64url } = bases;
const EC = elliptic.ec;
const ec = new EC("secp256k1");

const keyEncoder = new KeyEncoder("secp256k1");

export const encode = {
  privateKey: {
    fromHexToJWK: (keyHex: string): JWK => {
      const hex = keyHex.replace("0x", "");
      const pubPoint = ec.keyFromPrivate(hex, "hex").getPublic();
      return {
        crv: "secp256k1",
        d: base64url.baseEncode(bytes.fromHex(hex)),
        kty: "EC",
        x: base64url.baseEncode(pubPoint.getX().toBuffer("be", 32)),
        y: base64url.baseEncode(pubPoint.getY().toBuffer("be", 32)),
      };
    },
    fromJWKToHex: (keyJwk: JWK) => {
      return bytes.toHex(base64url.baseDecode(keyJwk.d ?? ""));
    },
  },
  publicKey: {
    fromHexToJWK: (keyHex: string) => {
      const hex = keyHex.replace("0x", "");
      const pubPoint = ec.keyFromPublic(hex, "hex").getPublic();
      return {
        crv: "secp256k1",
        kty: "EC",
        x: base64url.baseEncode(pubPoint.getX().toBuffer("be", 32)),
        y: base64url.baseEncode(pubPoint.getY().toBuffer("be", 32)),
      } satisfies JWK;
    },
    fromJWKToHex: (keyJwk: JWK) => {
      return ec
        .keyFromPublic({
          x: bytes.toHex(base64url.baseDecode(keyJwk.x ?? "")),
          y: bytes.toHex(base64url.baseDecode(keyJwk.y ?? "")),
        })
        .getPublic("hex");
    },
    fromJWKToPEM: (keyJwk: JWK) => {
      const keyHex = ec
        .keyFromPublic({
          x: bytes.toHex(base64url.baseDecode(keyJwk.x ?? "")),
          y: bytes.toHex(base64url.baseDecode(keyJwk.y ?? "")),
        })
        .getPublic("hex");
      return keyEncoder.encodePublic(keyHex, "raw", "pem");
    },
  },
};
