import { encode, remove0xPrefix } from "@ebsiint-api/shared";
import { getResolver, util } from "@europeum-ebsi/key-did-resolver";
import { Resolver } from "did-resolver";

import { Permission, PermissionLabel } from "./constants.ts";

export async function didToHex(did: string) {
  if (did.startsWith("did:key")) {
    const didResolver = new Resolver(getResolver());
    const result = await didResolver.resolve(did);
    const publicKeyJwk =
      result.didDocument?.verificationMethod![0]?.publicKeyJwk;

    if (!publicKeyJwk) {
      throw new Error(`DID ${did} can't be resolved`);
    }

    if (publicKeyJwk.crv !== "secp256k1") {
      throw new Error(
        `The DID ${did} must use secp256k1 curve. Received: ${publicKeyJwk.crv}`,
      );
    }
    const publicKeyHex = remove0xPrefix(
      encode.publicKey.fromJWKToHex(publicKeyJwk),
    );

    if (Buffer.from(publicKeyHex, "hex").byteLength === 65) {
      return `0x${publicKeyHex.slice(2)}`; // Remove first byte "04"
    }

    return `0x${publicKeyHex}`;
  }
  return `0x${Buffer.from(did).toString("hex")}`;
}

export function hexToDid(hex: string) {
  let buffer = Buffer.from(remove0xPrefix(hex), "hex");

  const utf8String = buffer.toString("utf8");
  if (utf8String.startsWith("did:ebsi:")) {
    return utf8String;
  }

  if (
    !(
      buffer.byteLength === 64 ||
      (buffer.byteLength === 65 && buffer[0] === 0x04)
    )
  ) {
    throw new Error(
      "The public key must be secp256k1 uncompressed (64 bytes or 65 bytes with 0x04 prefix)",
    );
  }

  if (buffer.byteLength === 64) {
    // Add first byte "04"
    buffer = Buffer.from([0x04, ...buffer]);
  }

  const publicKeyJwk = encode.publicKey.fromHexToJWK(
    `0x${buffer.toString("hex")}`,
  );

  return util.createDid(publicKeyJwk);
}

export function permissionToString(permission: number) {
  switch (permission) {
    case Permission.CREATOR: {
      return PermissionLabel[Permission.CREATOR];
    }
    case Permission.DELEGATE: {
      return PermissionLabel[Permission.DELEGATE];
    }
    case Permission.WRITE: {
      return PermissionLabel[Permission.WRITE];
    }
    default: {
      throw new Error(`unsupported permission ${permission}`);
    }
  }
}
