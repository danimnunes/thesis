import { EdDSASigner, ES256KSigner, ES256Signer } from "@europeum-ebsi/did-jwt";

export function getSigner(
  privateKey: Uint8Array,
  alg: "EdDSA" | "ES256" | "ES256K",
) {
  if (alg === "ES256K") {
    return ES256KSigner(privateKey);
  }

  if (alg === "ES256") {
    return ES256Signer(privateKey);
  }

  if (alg === "EdDSA") {
    return EdDSASigner(privateKey);
  }

  throw new Error(`Unsupported algorithm ${alg as string}`);
}
