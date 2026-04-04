import type { Schemas } from "@europeum-ebsi/verifiable-credential/vcdm11.js";

import * as vcLib from "@europeum-ebsi/verifiable-credential/vcdm11.js";
import Joi from "joi";
import { describe, expect, it, vi } from "vitest";

import {
  checkStatusList2021Credential,
  statusList2021CredentialSchema,
} from "./isStatusList2021Credential.ts";

vi.mock("@europeum-ebsi/verifiable-credential/vcdm11.js", async () => {
  const mod = await vi.importActual<
    typeof import("@europeum-ebsi/verifiable-credential/vcdm11.js")
  >("@europeum-ebsi/verifiable-credential/vcdm11.js");
  // Return a mocked version so we can redefine property `verifyCredentialJwt` later
  return {
    ...mod,
  };
});

const validStatusListCredential = {
  "@context": [
    "https://www.w3.org/2018/credentials/v1",
    "https://w3id.org/vc/status-list/2021/v1",
  ],
  credentialSchema: {
    id: "https://example.net",
    type: "FullJsonSchemaValidator2021",
  },
  credentialSubject: {
    encodedList:
      "H4sIAAAAAAAAA-3BMQEAAADCoPVPbQwfoAAAAAAAAAAAAAAAAAAAAIC3AYbSVKsAQAAA",
    id: "https://example.net/creds/1#list",
    statusPurpose: "revocation",
    type: "StatusList2021",
  },
  id: "https://example.net/creds/1",
  issuanceDate: "2021-04-05T14:27:40Z",
  issued: "2021-04-05T14:27:40Z",
  issuer: "did:ebsi:example",
  type: ["VerifiableCredential", "StatusList2021Credential"],
  validFrom: "2021-04-05T14:27:40Z",
} satisfies Schemas["Attestation"];

const validStatusListCredentialWithVerifiableAttestation = {
  "@context": [
    "https://www.w3.org/2018/credentials/v1",
    "https://w3id.org/vc/status-list/2021/v1",
  ],
  credentialSchema: {
    id: "https://example.net",
    type: "FullJsonSchemaValidator2021",
  },
  credentialSubject: {
    encodedList:
      "H4sIAAAAAAAAA-3BMQEAAADCoPVPbQwfoAAAAAAAAAAAAAAAAAAAAIC3AYbSVKsAQAAA",
    id: "https://example.net/creds/1#list",
    statusPurpose: "revocation",
    type: "StatusList2021",
  },
  id: "https://example.net/creds/1",
  issuanceDate: "2021-04-05T14:27:40Z",
  issued: "2021-04-05T14:27:40Z",
  issuer: "did:ebsi:example",
  type: [
    "VerifiableCredential",
    "VerifiableAttestation",
    "StatusList2021Credential",
  ],
  validFrom: "2021-04-05T14:27:40Z",
} satisfies Schemas["Attestation"];

describe("checkStatusList2021Credential", () => {
  it("should return false when the credential is not a string", async () => {
    expect.assertions(1);

    await expect(
      checkStatusList2021Credential(
        {
          not: "a string",
        },
        {
          hosts: ["example.net"],
          network: { name: "test" },
          scheme: "ebsi",
          services: {
            "did-registry": "v5",
            "trusted-issuers-registry": "v5",
            "trusted-policies-registry": "v3",
            "trusted-schemas-registry": "v3",
          },
        },
        "reqId",
      ),
    ).resolves.toStrictEqual({ error: "JWT is not a string", success: false });
  });

  it("should return false when the credential JWT verification fails", async () => {
    expect.assertions(1);

    vi.spyOn(vcLib, "verifyCredentialJwt").mockImplementation(() => {
      throw new Error("Invalid JWT");
    });

    await expect(
      checkStatusList2021Credential(
        "jwt",
        {
          hosts: ["example.net"],
          network: { name: "test" },
          scheme: "ebsi",
          services: {
            "did-registry": "v5",
            "trusted-issuers-registry": "v5",
            "trusted-policies-registry": "v3",
            "trusted-schemas-registry": "v3",
          },
        },
        "reqId",
      ),
    ).resolves.toStrictEqual({ error: "Invalid JWT", success: false });
  });

  it("should return false when the credential is not a valid StatusList2021Credential", async () => {
    expect.assertions(1);

    vi.spyOn(vcLib, "verifyCredentialJwt").mockImplementation(() =>
      Promise.resolve({
        ...validStatusListCredential,

        type: ["VerifiableCredential", "InvalidStatusList2021Credential"],
      }),
    );

    await expect(
      checkStatusList2021Credential(
        "jwt",
        {
          hosts: ["example.net"],
          network: { name: "test" },
          scheme: "ebsi",
          services: {
            "did-registry": "v5",
            "trusted-issuers-registry": "v5",
            "trusted-policies-registry": "v3",
            "trusted-schemas-registry": "v3",
          },
        },
        "reqId",
      ),
    ).resolves.toMatchSnapshot();
  });

  it("should return true when the credential JWT verification succeeds", async () => {
    expect.assertions(1);

    vi.spyOn(vcLib, "verifyCredentialJwt").mockImplementation(() =>
      Promise.resolve(validStatusListCredential),
    );

    await expect(
      checkStatusList2021Credential(
        "jwt",
        {
          hosts: ["example.net"],
          network: { name: "test" },
          scheme: "ebsi",
          services: {
            "did-registry": "v5",
            "trusted-issuers-registry": "v5",
            "trusted-policies-registry": "v3",
            "trusted-schemas-registry": "v3",
          },
        },
        "reqId",
      ),
    ).resolves.toStrictEqual({ success: true });
  });

  it("should return true when the credential JWT verification succeeds (with VerifiableAttestation)", async () => {
    expect.assertions(1);

    vi.spyOn(vcLib, "verifyCredentialJwt").mockImplementation(() =>
      Promise.resolve(validStatusListCredentialWithVerifiableAttestation),
    );

    await expect(
      checkStatusList2021Credential(
        "jwt",
        {
          hosts: ["example.net"],
          network: { name: "test" },
          scheme: "ebsi",
          services: {
            "did-registry": "v5",
            "trusted-issuers-registry": "v5",
            "trusted-policies-registry": "v3",
            "trusted-schemas-registry": "v3",
          },
        },
        "reqId",
      ),
    ).resolves.toStrictEqual({ success: true });
  });
});

describe("statusList2021CredentialSchema", () => {
  it("should not throw when asserting a valid object", () => {
    expect(() =>
      Joi.assert(validStatusListCredential, statusList2021CredentialSchema),
    ).not.toThrow();

    expect(() =>
      Joi.assert(
        validStatusListCredentialWithVerifiableAttestation,
        statusList2021CredentialSchema,
      ),
    ).not.toThrow();
  });

  it("should throw an error when asserting an invalid object", () => {
    const invalidObject = {
      "@context": [
        "https://www.w3.org/2018/credentials/v1",
        // Missing context:
        // "https://w3id.org/vc/status-list/2021/v1",
      ],
      credentialSchema: {
        id: "https://example.net",
        type: "FullJsonSchemaValidator2021",
      },
      credentialSubject: {
        encodedList:
          "H4sIAAAAAAAAA-3BMQEAAADCoPVPbQwfoAAAAAAAAAAAAAAAAAAAAIC3AYbSVKsAQAAA",
        id: "https://example.net/creds/1#list",
        // Invalid purpose
        statusPurpose: "invalid",
        type: "StatusList2021",
      },
      id: "https://example.net/creds/1",
      issuanceDate: "2021-04-05T14:27:40Z",
      issued: "2021-04-05T14:27:40Z",
      issuer: "did:ebsi:example",
      type: [
        // Invalid order: VerifiableCredential must be the first item
        "VerifiableAttestation",
        "VerifiableCredential",
        // "StatusList2021Credential" is missing
      ],
      validFrom: "2021-04-05T14:27:40Z",
    };

    expect(() =>
      Joi.assert(invalidObject, statusList2021CredentialSchema, {
        abortEarly: false,
      }),
    ).toThrowErrorMatchingSnapshot();
  });
});
