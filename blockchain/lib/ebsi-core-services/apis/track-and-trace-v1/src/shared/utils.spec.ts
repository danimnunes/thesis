import { encode } from "@ebsiint-api/shared";
import { EbsiWallet } from "@europeum-ebsi/wallet-lib";
import { exportJWK, generateKeyPair } from "jose";
import { describe, expect, it } from "vitest";

import { didToHex, hexToDid } from "./utils.ts";

describe("hexToDid", () => {
  it("should throw an error if the input can not be converted to a DID", () => {
    expect.assertions(1);

    expect(() => hexToDid("")).toThrow(
      new Error(
        "The public key must be secp256k1 uncompressed (64 bytes or 65 bytes with 0x04 prefix)",
      ),
    );
  });

  it("should return the expected did:ebsi DID", async () => {
    expect.assertions(2);

    const did = EbsiWallet.createDid();

    expect(hexToDid(`0x${Buffer.from(did).toString("hex")}`)).toStrictEqual(
      did,
    );
    expect(hexToDid(await didToHex(did))).toStrictEqual(did);
  });

  it("should return the expected did:key DID", async () => {
    expect.assertions(3);

    // Create random did:key DID
    const { publicKey } = await generateKeyPair("ES256K");
    const publicKeyJwk = await exportJWK(publicKey);
    const did = EbsiWallet.createDid("NATURAL_PERSON", publicKeyJwk);

    const publicKeyHex = encode.publicKey.fromJWKToHex(publicKeyJwk);

    // With "04" prefix
    expect(hexToDid(`0x${publicKeyHex}`)).toStrictEqual(did);
    // Without "04" prefix
    expect(hexToDid(`0x${publicKeyHex.replace(/^04/, "")}`)).toStrictEqual(did);

    expect(hexToDid(await didToHex(did))).toStrictEqual(did);
  });
});

describe("didToHex", () => {
  it("should reject did:key with a curve different to secp256k1", async () => {
    expect.assertions(1);

    const { publicKey } = await generateKeyPair("ES256");
    const publicKeyJwk = await exportJWK(publicKey);
    const did = EbsiWallet.createDid("NATURAL_PERSON", publicKeyJwk);

    await expect(didToHex(did)).rejects.toThrow(
      `The DID ${did} must use secp256k1 curve. Received: P-256`,
    );
  });

  it("should return the expected hex for a did:ebsi", async () => {
    expect.assertions(1);

    const did = EbsiWallet.createDid();

    await expect(didToHex(did)).resolves.toBe(
      `0x${Buffer.from(did).toString("hex")}`,
    );
  });

  it("should return the expected hex for a did:key", async () => {
    // Create random did:key DID
    const { publicKey } = await generateKeyPair("ES256K");
    const publicKeyJwk = await exportJWK(publicKey);
    const did = EbsiWallet.createDid("NATURAL_PERSON", publicKeyJwk);

    const publicKeyHex = encode.publicKey.fromJWKToHex(publicKeyJwk);
    const didBuffer = Buffer.from(publicKeyHex, "hex");

    await expect(didToHex(did)).resolves.toBe(
      `0x${didBuffer.subarray(1).toString("hex")}`,
    );
  });
});
