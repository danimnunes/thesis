import type { Schemas as VCDM11Schemas } from "@europeum-ebsi/verifiable-credential/vcdm11.js";
import type { Schemas as VCDM20Schemas } from "@europeum-ebsi/verifiable-credential/vcdm20.js";

import * as vcdm11Lib from "@europeum-ebsi/verifiable-credential/vcdm11.js";
import * as vcdm20Lib from "@europeum-ebsi/verifiable-credential/vcdm20.js";
import Joi from "joi";
import { beforeAll, describe, expect, it, vi } from "vitest";

import {
  checkVcdm11BitstringStatusListCredential,
  checkVcdm20BitstringStatusListCredential,
  vcdm11BitstringStatusListCredentialSchema,
  vcdm20BitstringStatusListCredentialSchema,
} from "./isBitstringStatusListCredential.ts";

vi.mock("@europeum-ebsi/verifiable-credential/vcdm11.js", async () => {
  const mod = await vi.importActual<
    typeof import("@europeum-ebsi/verifiable-credential/vcdm11.js")
  >("@europeum-ebsi/verifiable-credential/vcdm11.js");
  // Return a mocked version so we can redefine `verifyCredentialJwt` later
  return {
    ...mod,
  };
});

vi.mock("@europeum-ebsi/verifiable-credential/vcdm20.js", async () => {
  const mod = await vi.importActual<
    typeof import("@europeum-ebsi/verifiable-credential/vcdm20.js")
  >("@europeum-ebsi/verifiable-credential/vcdm20.js");
  // Return a mocked version so we can redefine `verifyCredentialJwt` later
  return {
    ...mod,
  };
});

describe("checkVcdm11BitstringStatusListCredential", () => {
  let validStatusListCredential: VCDM11Schemas["BitstringStatusListCredential"];
  let validStatusListCredentialWithVerifiableAttestation: VCDM11Schemas["Attestation"];

  beforeAll(() => {
    validStatusListCredential = {
      "@context": ["https://www.w3.org/2018/credentials/v1"],
      credentialSchema: {
        id: "https://example.net",
        type: "FullJsonSchemaValidator2021",
      },
      credentialSubject: {
        encodedList:
          "H4sIAAAAAAAAA-3BMQEAAADCoPVPbQwfoAAAAAAAAAAAAAAAAAAAAIC3AYbSVKsAQAAA",
        id: "https://example.net/creds/1#list",
        statusPurpose: "revocation",
        type: "BitstringStatusList",
      },
      id: "https://example.net/creds/1",
      issuanceDate: "2021-04-05T14:27:40Z",
      issued: "2021-04-05T14:27:40Z",
      issuer: "did:ebsi:example",
      type: [
        "VerifiableCredential",
        "VerifiableAttestation",
        "BitstringStatusListCredential",
      ],
      validFrom: "2021-04-05T14:27:40Z",
    };

    validStatusListCredentialWithVerifiableAttestation = {
      "@context": ["https://www.w3.org/2018/credentials/v1"],
      credentialSchema: {
        id: "https://example.net",
        type: "FullJsonSchemaValidator2021",
      },
      credentialSubject: {
        encodedList:
          "H4sIAAAAAAAAA-3BMQEAAADCoPVPbQwfoAAAAAAAAAAAAAAAAAAAAIC3AYbSVKsAQAAA",
        id: "https://example.net/creds/1#list",
        statusPurpose: "revocation",
        type: "BitstringStatusList",
      },
      id: "https://example.net/creds/1",
      issuanceDate: "2021-04-05T14:27:40Z",
      issued: "2021-04-05T14:27:40Z",
      issuer: "did:ebsi:example",
      type: [
        "VerifiableCredential",
        "VerifiableAttestation",
        "BitstringStatusListCredential",
      ],
      validFrom: "2021-04-05T14:27:40Z",
    };
  });

  describe("checkVcdm11BitstringStatusListCredential", () => {
    it("should return false when the credential is not a string", async () => {
      expect.assertions(1);

      await expect(
        checkVcdm11BitstringStatusListCredential(
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
      ).resolves.toStrictEqual({
        error: "JWT is not a string",
        success: false,
      });
    });

    it("should return false when the credential JWT verification fails", async () => {
      expect.assertions(1);

      vi.spyOn(vcdm11Lib, "verifyCredentialJwt").mockImplementation(() => {
        throw new Error("Invalid JWT");
      });

      await expect(
        checkVcdm11BitstringStatusListCredential(
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

    it("should return false when the credential is not a valid BitstringStatusListCredential", async () => {
      expect.assertions(1);

      vi.spyOn(vcdm11Lib, "verifyCredentialJwt").mockImplementation(() =>
        Promise.resolve({
          ...validStatusListCredential,

          type: [
            "VerifiableCredential",
            "InvalidBitstringStatusListCredential",
          ],
        }),
      );

      await expect(
        checkVcdm11BitstringStatusListCredential(
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

      vi.spyOn(vcdm11Lib, "verifyCredentialJwt").mockImplementation(() =>
        Promise.resolve(validStatusListCredential),
      );

      await expect(
        checkVcdm11BitstringStatusListCredential(
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

      vi.spyOn(vcdm11Lib, "verifyCredentialJwt").mockImplementation(() =>
        Promise.resolve(validStatusListCredentialWithVerifiableAttestation),
      );

      await expect(
        checkVcdm11BitstringStatusListCredential(
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

  describe("vcdm11BitstringStatusListCredentialSchema", () => {
    it("should not throw when asserting a valid object", () => {
      expect(() =>
        Joi.assert(
          validStatusListCredential,
          vcdm11BitstringStatusListCredentialSchema,
        ),
      ).not.toThrow();

      expect(() =>
        Joi.assert(
          validStatusListCredentialWithVerifiableAttestation,
          vcdm11BitstringStatusListCredentialSchema,
        ),
      ).not.toThrow();
    });

    it("should throw an error when asserting an invalid object", () => {
      const invalidObject = {
        "@context": ["https://www.w3.org/2018/credentials/v1"],
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
          type: "BitstringStatusList",
        },
        id: "https://example.net/creds/1",
        issuanceDate: "2021-04-05T14:27:40Z",
        issued: "2021-04-05T14:27:40Z",
        issuer: "did:ebsi:example",
        type: [
          // Invalid order: VerifiableCredential must be the first item
          "VerifiableAttestation",
          "VerifiableCredential",
          // "BitstringStatusListCredential" is missing
        ],
        validFrom: "2021-04-05T14:27:40Z",
      };

      expect(() =>
        Joi.assert(invalidObject, vcdm11BitstringStatusListCredentialSchema, {
          abortEarly: false,
        }),
      ).toThrowErrorMatchingSnapshot();
    });
  });
});

describe("checkVcdm20BitstringStatusListCredential", () => {
  let validStatusListCredential: VCDM20Schemas["BitstringStatusListCredential"];
  let validStatusListCredentialWithVerifiableAttestation: VCDM20Schemas["Attestation"];

  beforeAll(() => {
    validStatusListCredential = {
      "@context": ["https://www.w3.org/ns/credentials/v2"],
      credentialSchema: {
        id: "https://example.net",
        type: "FullJsonSchemaValidator2021",
      },
      credentialSubject: {
        encodedList:
          "H4sIAAAAAAAAA-3BMQEAAADCoPVPbQwfoAAAAAAAAAAAAAAAAAAAAIC3AYbSVKsAQAAA",
        id: "https://example.net/creds/1#list",
        statusPurpose: "revocation",
        type: "BitstringStatusList",
      },
      id: "https://example.net/creds/1",
      issuanceDate: "2021-04-05T14:27:40Z",
      issued: "2021-04-05T14:27:40Z",
      issuer: "did:ebsi:example",
      type: [
        "VerifiableCredential",
        "VerifiableAttestation",
        "BitstringStatusListCredential",
      ],
      validFrom: "2021-04-05T14:27:40Z",
    };

    validStatusListCredentialWithVerifiableAttestation = {
      "@context": ["https://www.w3.org/ns/credentials/v2"],
      credentialSchema: {
        id: "https://example.net",
        type: "FullJsonSchemaValidator2021",
      },
      credentialSubject: {
        encodedList:
          "H4sIAAAAAAAAA-3BMQEAAADCoPVPbQwfoAAAAAAAAAAAAAAAAAAAAIC3AYbSVKsAQAAA",
        id: "https://example.net/creds/1#list",
        statusPurpose: "revocation",
        type: "BitstringStatusList",
      },
      id: "https://example.net/creds/1",
      issuanceDate: "2021-04-05T14:27:40Z",
      issued: "2021-04-05T14:27:40Z",
      issuer: "did:ebsi:example",
      type: [
        "VerifiableCredential",
        "VerifiableAttestation",
        "BitstringStatusListCredential",
      ],
      validFrom: "2021-04-05T14:27:40Z",
    };
  });

  describe("checkVcdm20BitstringStatusListCredential", () => {
    it("should return false when the credential is not a string", async () => {
      expect.assertions(1);

      await expect(
        checkVcdm20BitstringStatusListCredential(
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
      ).resolves.toStrictEqual({
        error: "JWT is not a string",
        success: false,
      });
    });

    it("should return false when the credential JWT verification fails", async () => {
      expect.assertions(1);

      vi.spyOn(vcdm20Lib, "verifyCredentialJwt").mockImplementation(() => {
        throw new Error("Invalid JWT");
      });

      await expect(
        checkVcdm20BitstringStatusListCredential(
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

    it("should return false when the credential is not a valid BitstringStatusListCredential", async () => {
      expect.assertions(1);

      vi.spyOn(vcdm20Lib, "verifyCredentialJwt").mockImplementation(() =>
        Promise.resolve({
          ...validStatusListCredential,

          type: [
            "VerifiableCredential",
            "InvalidBitstringStatusListCredential",
          ],
        }),
      );

      await expect(
        checkVcdm20BitstringStatusListCredential(
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

      vi.spyOn(vcdm20Lib, "verifyCredentialJwt").mockImplementation(() =>
        Promise.resolve(validStatusListCredential),
      );

      await expect(
        checkVcdm20BitstringStatusListCredential(
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

      vi.spyOn(vcdm20Lib, "verifyCredentialJwt").mockImplementation(() =>
        Promise.resolve(validStatusListCredentialWithVerifiableAttestation),
      );

      await expect(
        checkVcdm20BitstringStatusListCredential(
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

  describe("vcdm20BitstringStatusListCredentialSchema", () => {
    it("should not throw when asserting a valid object", () => {
      expect(() =>
        Joi.assert(
          validStatusListCredential,
          vcdm20BitstringStatusListCredentialSchema,
        ),
      ).not.toThrow();

      expect(() =>
        Joi.assert(
          validStatusListCredentialWithVerifiableAttestation,
          vcdm20BitstringStatusListCredentialSchema,
        ),
      ).not.toThrow();
    });

    it("should throw an error when asserting an invalid object", () => {
      const invalidObject = {
        "@context": ["https://www.w3.org/2018/credentials/v1"],
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
          type: "BitstringStatusList",
        },
        id: "https://example.net/creds/1",
        issuanceDate: "2021-04-05T14:27:40Z",
        issued: "2021-04-05T14:27:40Z",
        issuer: "did:ebsi:example",
        type: [
          // Invalid order: VerifiableCredential must be the first item
          "VerifiableAttestation",
          "VerifiableCredential",
          // "BitstringStatusListCredential" is missing
        ],
        validFrom: "2021-04-05T14:27:40Z",
      };

      expect(() =>
        Joi.assert(invalidObject, vcdm20BitstringStatusListCredentialSchema, {
          abortEarly: false,
        }),
      ).toThrowErrorMatchingSnapshot();
    });
  });
});
