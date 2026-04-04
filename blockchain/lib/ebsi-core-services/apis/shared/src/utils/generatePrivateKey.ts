import { ed25519 } from "@noble/curves/ed25519.js";
import { p256 } from "@noble/curves/nist.js";
import { secp256k1 } from "@noble/curves/secp256k1.js";

export function generatePrivateKey(alg: "EdDSA" | "ES256" | "ES256K") {
  if (alg === "ES256K") {
    return secp256k1.utils.randomSecretKey();
  }

  if (alg === "ES256") {
    return p256.utils.randomSecretKey();
  }

  if (alg === "EdDSA") {
    return ed25519.utils.randomSecretKey();
  }

  throw new Error(`Unsupported algorithm ${alg as string}`);
}
